# Descuentos en facturación — diseño

Fecha: 2026-10-08 · Estado: pendiente de revisión del usuario

## Objetivo
Poder cobrar a un paciente menos que el precio de lista, con el cobro, los honorarios, la tesorería y el cierre cuadrados con el monto realmente cobrado, y con control: clave de confirmación, tope para el cajero, promociones programadas por el admin y rastro en Bitácora.

## Decisiones acordadas con el usuario
- Descuento **manual** (cajero, con clave) **y** **promociones** programadas (admin, ej. «Mes Rosa — Mamografía −20 %, 1–31 oct»). Ambas.
- Quien autoriza elige el reparto: **CLINICA** (la clínica asume todo; honorarios intactos) o **PROPORCIONAL** (doctor y clínica reducen en el mismo porcentaje).
- Tope del cajero: **20 %** (por encima exige clave de un admin o asistente). Admin y asistente no tienen tope.
- Mejoras posteriores (cada una con su propio diseño): B abonos y saldos, C ganancia por servicio/doctor en el cierre, D honorarios por doctor y día.

## Regla central
`precio_usd` (factura y detalle) pasa a significar **lo que realmente se cobra (neto)**. Así cierre, tesorería, analíticas, anulación y cuadre de pagos siguen funcionando sin cambios. El precio de catálogo se guarda aparte.

## Datos (migración idempotente, `ALTER … IF NOT EXISTS`, también en `schema_produccion_limpio.sql`)
`facturas_caja`: `precio_lista_usd NUMERIC(12,2)`, `descuento_usd NUMERIC(12,2) NOT NULL DEFAULT 0`, `descuento_modo VARCHAR(12)` (`CLINICA`|`PROPORCIONAL`), `descuento_origen VARCHAR(10)` (`MANUAL`|`PROMO`), `descuento_motivo TEXT`, `descuento_promo_id INT`, `descuento_autorizado_por VARCHAR(100)`. Filas anteriores: `precio_lista_usd` NULL = igual a `precio_usd`.
`facturas_servicios_detalle`: `precio_lista_usd NUMERIC(12,2)`.
Tabla nueva `promociones` (RLS activado): `id`, `nombre`, `porcentaje NUMERIC(5,2)` (0 < p ≤ 100), `modo`, `areas TEXT[]`, `estudios TEXT[]`, `fecha_desde DATE`, `fecha_hasta DATE`, `activa BOOLEAN`, `creado_por`, `creado_en`. Una promo aplica a un servicio si su estudio está en `estudios`, o si `estudios` está vacío y su área está en `areas`, y la fecha de la factura está en el rango.

## Cálculo (`lib/descuento.ts`, función pura usada por servidor y pantalla; centavos enteros)
1. Descuento total D: porcentaje `round(L·bp/10000)` (bp = puntos básicos) o monto en USD. Debe cumplirse 0 < D < L (el total neto debe ser > 0).
2. D se reparte entre los servicios en proporción a su precio de lista con **resto mayor** (Σ d_i = D exacto; d_i ≤ precio_i). Neto_i = precio_i − d_i.
3. CLINICA: honorarios_i sin cambio; ganancia_i = neto_i − honorarios_i; si algún honorarios_i > neto_i se rechaza («el descuento deja la ganancia en negativo en …»).
4. PROPORCIONAL: honPatólogo_i' = round(honPat_i·neto_i/precio_i); honorarios_i' = round(hon_i·neto_i/precio_i); honMédico_i' = honorarios_i' − honPatólogo_i'; ganancia_i = neto_i − honorarios_i'.
5. Promoción: se calcula por servicio coincidente (d_i = round(precio_i·p)), no por factura. Con promo aplicable, el descuento manual de esa factura no se permite (un solo origen por factura).

## Flujo y autorización (`POST /api/facturas`)
- Entrada nueva opcional: `descuento: { tipo: 'PCT'|'USD', valor, modo, motivo, pin, autorizador?: { usuario, clave } }`.
- El servidor **recalcula todo**: valida catálogo como hoy, aplica promos activas (automático, sin opción de omitirlas; el admin las desactiva), luego el descuento manual, y exige que los pagos cuadren con el **neto** (tolerancia actual de 2 centavos).
- Manual: siempre `exigirPinSesion` (clave del usuario de la sesión) y motivo obligatorio (≥ 5 caracteres). Si el rol es cajero y D/L > 20 %, exige `autorizador` (admin o asistente activo, clave verificada con el mismo mecanismo y bloqueo por intentos que el login). Constante `TOPE_DESCUENTO_CAJERO_PCT = 20` en `lib/descuento.ts`.
- Promo: sin clave extra (la autorizó el admin al crearla); origen `PROMO`, `descuento_promo_id` guardado.
- Honorarios pendientes, ingresos de tesorería y tránsito de punto/pago móvil usan los valores netos ya existentes en el flujo.

## Promociones (admin)
- API `GET/POST/PUT /api/admin/promociones` (ya cubierta por `SOLO_ADMIN`); lectura de activas para caja: `GET /api/promociones/activas?fecha=` (permitida a cajero).
- Pantalla: pestaña «Promociones» en Catálogos (crear, editar, activar/desactivar, vigencia).

## Pantalla de caja
Por cada servicio: precio de lista, descuento (promo en etiqueta «Promo: Mes Rosa −20 %») y neto. Botón «Aplicar descuento» (manual): %/$ , modo de reparto (CLINICA/PROPORCIONAL con explicación del efecto en honorarios y ganancia), motivo y clave; si supera el tope, campos del autorizador. Resumen: Lista / Descuento / **Total a cobrar**; los pagos se capturan contra el total a cobrar. Detalle de movimiento en Historial muestra lista, descuento y neto.

## Control y reportes
- Bitácora: tipo nuevo `DESCUENTO` por factura con descuento (lista, descuento, modo, origen, motivo, quién, autorizado por).
- Cierre diario: `evaluarDia` agrega «Descuentos del día» (suma de `descuento_usd` de facturas no anuladas); se muestra en pantalla y acta.
- Anular una factura con descuento: sin cambios (revierte pagos netos; honorarios pendientes ya son netos). Se verifica en pruebas.

## Fuera de alcance (YAGNI)
Editar el descuento de una factura ya creada, convenios/descuentos permanentes por paciente, cupones por código, descuentos sobre abonos (se verá en la mejora B).

## Pruebas
Vitest: `lib/descuento.ts` (porcentaje y monto, resto mayor suma exacta, CLINICA con ganancia negativa rechazada, PROPORCIONAL suma exacta, D=0 y D≥L inválidos), emparejamiento de promociones (rango de fechas, área/estudio, inactiva), regla del tope (cajero/asistente/admin), `isAllowed` para rutas nuevas. Verificación manual en producción tras el despliegue con una factura de prueba que luego se anula.
