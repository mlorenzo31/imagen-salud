# Compras con factura, proveedores y cuentas por pagar — Diseño

Fecha: 2026-10-14 · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

Que Egresos tenga dos formas de registrar salidas de dinero:

1. **Gasto menor** (lo que existe hoy): pagos hormiga y personas sin factura.
2. **Compra con factura**: compra a un proveedor identificado (RIF, dirección), con líneas de productos/servicios de un catálogo, IVA por alícuota, retenciones configurables, de contado o a crédito.

Además, un reporte que muestre lo que realmente egresó (compras + gastos menores + honorarios + comisiones) con su detalle y comparado contra los ingresos, y el Libro de Compras.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Retenciones IVA/ISLR | Configurables, **apagadas por defecto**; porcentajes y tablas en configuración, nunca en el código (la normativa puede cambiar). |
| Productos | Catálogo de productos/servicios por proveedor, **sin inventario** por ahora. |
| Forma de pago | **Contado o crédito**; pagos completos o parciales. |
| Moneda | Facturas en **Bs o en $**; se pagan desde cualquier cuenta. |
| Tasa | Prellenada con la BCV del día (`lib/tasaBcv.ts`) y **editable**; cada factura y cada pago guardan la tasa usada. |
| Base del reporte | **Caja** (lo que salió/entró de las cuentas); lo comprado por pagar se muestra aparte, sin restar. |
| Acceso | Solo admin (igual que el resto de escrituras de tesorería). |

## Estructura (módulo Egresos)

Pestañas: **Gasto menor** · **Compra con factura** · **Por pagar** · **Proveedores y catálogo** · **Reporte** · **Historial** (el actual, incluyendo compras).
Componentes en `components/egresos/`; el estado en el contenedor `ModuloEgresosOperativos.tsx`.

**Configuración fiscal** (admin): retenciones activas sí/no; % IVA retenido (75 / 100); tabla ISLR (concepto, tipo de persona, %, sustraendo); alícuotas vigentes (16, 8, 0).

## Datos (tablas nuevas, creadas en ejecución con `asegurar*()` y RLS)

- `proveedores`: id, rif (único, normalizado), razon_social, direccion, telefono, tipo_persona (NATURAL/JURIDICA), contribuyente_especial, activo.
- `productos_compra`: id, nombre, categoria, alicuota_defecto, proveedor_id (opcional), activo.
- `facturas_compra`: id, proveedor_id, numero_factura, numero_control, fecha, moneda (BS/USD), tasa, base_exenta, total_base, total_iva, total, iva_retenido, islr_retenido, neto_a_pagar, condicion (CONTADO/CREDITO), vencimiento, estado (PENDIENTE/PARCIAL/PAGADA/ANULADA), comprobante_retencion, notas, usuario. Único: (proveedor_id, numero_factura).
- `facturas_compra_lineas`: factura_id, producto_id, descripcion, cantidad, precio_unitario, alicuota, subtotal.
- `pagos_compra`: id, factura_id, cuenta_id, monto_cuenta (moneda de la cuenta), tasa, monto_aplicado (moneda de la factura), fecha, referencia, reversado, usuario.
- `config_fiscal`: clave/valor JSON (retenciones, porcentajes, tabla ISLR, alícuotas).
- `retenciones`: comprobantes de retención emitidos (también sirve para persistir el módulo Retenciones SENIAT, hoy solo en memoria).

Todos los montos en centavos enteros (`lib/money.ts`).

## Cálculos

1. Línea: `subtotal = cantidad × precio_unitario`.
2. Por alícuota: `base = Σ subtotales`; `iva = base × %` (redondeo al céntimo).
3. `total = Σ bases + Σ iva`.
4. Factura en $: los montos para el Libro de Compras se expresan en Bs a la tasa de la factura.
5. Retenciones (si activas): `iva_retenido = iva × (75 % | 100 %)`; `islr_retenido = base × % − sustraendo` según la tabla; `neto_a_pagar = total − retenciones`; se numera el comprobante.
6. Contado: el pago completo del neto se registra en el mismo paso. Crédito: queda por pagar con vencimiento.

## Pagos

- Misma moneda factura/cuenta: se descuenta el monto tal cual.
- Moneda cruzada: tasa del pago (prellenada BCV, editable); `monto_aplicado` se convierte a la moneda de la factura.
- La deuda se lleva en la moneda de la factura; la diferencia cambiaria no se contabiliza, solo se anota.
- No se paga más de lo pendiente ni más del saldo de la cuenta.
- Cada pago genera `movimientos_tesoreria` tipo `PAGO_COMPRA`; si el día está cerrado, `marcarCierreModificado`.
- Estado de la factura: PENDIENTE → PARCIAL → PAGADA según lo aplicado.

## Anulación

Solo sin pagos vigentes. Con pagos, primero se reversa cada pago (movimiento `REVERSO_PAGO_COMPRA` que devuelve el dinero a su cuenta) y luego se anula. El Libro de Compras la muestra como anulada.

## Reporte "Egresos vs ingresos" (por rango de fechas)

- **Ingresos**: cobrado en facturas de pacientes + ingresos extraordinarios.
- **Egresos (caja)**: pagos de compras + gastos menores + honorarios liquidados + comisiones bancarias.
- **Resultado** = ingresos − egresos; en $ y en Bs, cada operación a la tasa de su día.
- **Comprometido** (aparte): saldo por pagar de compras.
- Detalle por proveedor (pagado, facturas, saldo), por producto (cantidad, monto) y por categoría.
- Gráfico de barras ingresos vs egresos por semana o mes.
- Excel: Resumen, Compras (con líneas), Gastos menores, Detalle.

## Libro de Compras (Excel, por mes)

Fecha, RIF, razón social, N° factura, N° control, tipo de transacción (registro / anulada), total con IVA, compras exentas, base imponible y alícuota (una fila por alícuota), IVA, IVA retenido, N° comprobante. Totales por alícuota.

## Errores y validaciones

- RIF con formato válido (J/V/E/G/P + dígitos), sin duplicados.
- Factura duplicada (mismo proveedor y número) → 409.
- Cantidad y precio > 0; alícuota dentro de las vigentes en configuración.
- Pago > pendiente o > saldo de cuenta → 400.
- Anular con pagos vigentes → 409 con el detalle de pagos a reversar.

## Pruebas

Funciones puras con tests (vitest): cálculo de totales por alícuota, retenciones con configuración encendida/apagada, conversión de moneda cruzada, aplicación de pagos parciales y estados, armado del reporte y del Libro de Compras. RBAC: escrituras solo admin.

## Fuera de alcance (esta versión)

Inventario; notas de crédito/débito de proveedores; archivo TXT de retenciones para el portal SENIAT (se hará cuando se confirme la normativa).
