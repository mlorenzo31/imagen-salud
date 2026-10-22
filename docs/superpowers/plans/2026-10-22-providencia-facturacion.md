# Adecuación a la Providencia SENIAT de Facturación (G.O. 21/10/2026) — Plan de trabajo

**Objetivo:** que toda factura, nota de crédito/débito y comprobante de retención emitido por Imagen Salud cumpla la nueva providencia antes de su entrada en vigencia (**19/04/2027**, 180 días continuos desde el 21/10/2026).

**Decisiones tomadas**
- Medio de emisión: **imprenta digital autorizada** vía API (art. 4.1.2). Contingencia: talonarios autorizados (arts. 6, 7, 11).
- Numeración: **una sola secuencia central** (no aplica "serie", art. 20).
- Condición ante el IVA: **pendiente** (Manu lo está estudiando) → se implementa **configurable** (`ORDINARIO` | `FORMAL`).

**Fuente:** transcripción de la G.O. del 21/10/2026, págs. 473.382–473.388 (sin la 1.ª página: falta el N° de providencia). Ante dudas prevalece la Gaceta.

## Diagnóstico del sistema actual

| Área | Hoy | Brecha con la providencia |
|---|---|---|
| Emisión fiscal | `lib/imprentaDigital.ts` es una simulación: no tiene llamadores, datos del emisor fijos en el código, interruptor en `localStorage` del navegador | No se emite ningún documento fiscal; la integración debe ser del lado del servidor |
| Factura (`facturas_caja`) | Solo `id` interno; sin N° de factura fiscal, N° de control ni fecha de asignación | Arts. 8.2, 8.3, 9.1, 9.4 |
| Fecha/hora | `fecha` DATE y `hora` texto libre | Art. 8.5: DDMMAAAA y HH.MM.SS a.m./p.m. |
| Ítems | Estudio + precio; sin código de operación ni marca de exento | Art. 8.7 "(E)", art. 9.2 código de operación |
| Moneda | Precio en USD + `tasa_bcv` | Art. 8.12: ambos montos y tipo de cambio en la factura |
| Recargos/descuentos | Descuentos guardados; **IGTF no existe** | Art. 8.8: todo concepto adicional o descuento con descripción y valor |
| Anulación | `lib/anulacion.ts` revierte tesorería y marca ANULADA | Con N° de control asignado, el ajuste es **Nota de Crédito** (arts. 12-13) y el original anulado se conserva (art. 21) |
| Retenciones de compras | 14 caracteres AAAAMM+8, pero el secuencial se **reinicia cada mes** y sale de `count(*)` | Art. 18.1: secuencial continuo, solo se reinicia al superar 8 dígitos; faltan correo del proveedor, N° de control, período, base, impuesto causado |
| Módulo Retenciones SENIAT | No persiste (se pierde al recargar) | Debe guardar y numerar en servidor |
| Contingencia | No existe | Arts. 6, 7, 11: talonarios en el local, registro posterior y envío al día siguiente |
| Leyenda legal | No existe | Art. 19: "emitida conforme a la Providencia…" |

## Fases

Cada tarea de código sigue TDD (`npm test`, `npm run typecheck`, `npm run lint` en `frontend/`). Dinero siempre en centavos (`lib/money.ts`); tasa siempre vía `lib/tasaBcv.ts` / `lib/tasaFactura.ts`.

### Fase 0 · Decisiones y gestiones externas (no es código) — nov 2026
- [ ] **Condición IVA** (formal u ordinario) → define la frase "Contribuyentes Formales del IVA" y si hay base imponible/IVA por alícuota. *Responsable: Manu.*
- [ ] **¿La clínica percibe IGTF?** (3 % sobre pagos en divisas, según su calificación) → define si la factura lleva la línea IGTF.
- [ ] Elegir **imprenta digital autorizada**: contrato, ambiente de pruebas (sandbox), documentación de la API, y datos que van impresos (razón social, RIF, nomenclatura y fecha de su providencia de autorización).
- [ ] Encargar **talonarios de contingencia** a imprenta autorizada (rango de control y numeración) — obligatorio tenerlos en el local (art. 6, parágrafo único).
- [ ] Confirmar **N° de la providencia** (página 1 de la Gaceta) para la leyenda del art. 19.
- [ ] Seguir la publicación del **Manual Técnico** y de los lineamientos del SENIAT.

### Fase 1 · Modelo de datos fiscal — nov 2026
Independiente del proveedor; se puede empezar ya.
- [x] Configuración del emisor en `config_fiscal` (ya existe, clave/valor JSONB): razón social, RIF, domicilio fiscal, `condicion_iva`, `percibe_igtf`, datos de la imprenta digital, texto de la leyenda del art. 19. Pantalla de administración (solo admin).
- [x] Tabla `documentos_fiscales`: `tipo` (FACTURA | NOTA_CREDITO | NOTA_DEBITO), `factura_caja_id`, `numero` (consecutivo único), `numero_control` (2+8), `fecha_asignacion_control`, `fecha_emision`, `hora_emision`, `medio` (DIGITAL | CONTINGENCIA), `estado`, `doc_referencia_id` (para notas), totales en centavos (exento, base y IVA por alícuota, IGTF, total Bs y USD), `tasa_cambio`, `payload` JSONB, `pdf_url`, `qr`, respuesta del proveedor. Restricciones UNIQUE en número y número de control.
- [x] Ítems con **código de operación** (art. 9.2): agregar `codigo` al catálogo de estudios (`lib/catalogos.ts`, admin de catálogos) y copiarlo al servicio facturado.
- [x] Receptor (art. 8.6): nombre y cédula/pasaporte ya existen; agregar opción **"Facturar a"** (razón social + RIF) cuando paga una empresa o aseguradora.
- [x] Actualizar `plantillas_y_scripts/schema_produccion_limpio.sql`.

### Fase 2 · Construcción del documento (`lib/fiscal/`) — nov–dic 2026
Funciones puras, con pruebas unitarias.
- [x] `formato.ts`: `fechaFiscal()` → DDMMAAAA; `horaFiscal()` → HH.MM.SS a.m./p.m.; `numeroControl(id, sec)` → `00-00000001`; `marcarExento(desc)` → `desc (E)`.
- [x] `factura.ts`: `construirFactura(facturaCaja, config, tasa)` → documento con todos los requisitos del art. 8:
  - total exento / base e IVA por alícuota;
  - descuentos (8.8);
  - IGTF si aplica;
  - equivalencia en Bs y en divisa con el tipo de cambio (8.12);
  - leyenda del art. 19 y frase de contribuyente formal (condicional).
- [x] `notas.ts`: `construirNotaCredito/Debito(original, motivo, montos)` con referencia a la fecha, el número, el N° de control y el monto de la factura original (arts. 12-13).
- [x] Casos de prueba: factura 100 % exenta, mixta exenta/gravada, pago mixto Bs + USD con IGTF, descuento, receptor con RIF y sin RIF, nota de crédito total y parcial.

### Fase 3 · Integración con la imprenta digital — ene 2027
- [x] Interfaz de servidor `ProveedorFiscal` con `emitir(doc)`, `consultar(id)` y `descargarPdf(id)`.
  - Implementaciones: **adaptador de la imprenta elegida** y **adaptador simulado** (para pruebas y demo).
  - Credenciales en variables de entorno del servidor (`.env.example`); nada en el navegador.
- [x] Retirar `lib/imprentaDigital.ts`: se elimina el interruptor en `localStorage` y los datos fijos.
- [x] Flujo de emisión dentro de `POST /api/facturas`:
  1. Se guarda la factura y una fila en la **cola fiscal**, en la misma transacción.
  2. Se envía a la imprenta con una clave de idempotencia (el id del documento).
  3. Se guarda el N° de control, el PDF y el QR.
  4. Se hacen reintentos con backoff.
  5. Si la imprenta no responde → se pasa a contingencia (Fase 5).
- [ ] La impresión o el envío al paciente (WhatsApp/correo) usan el **PDF de la imprenta** — *pendiente del adaptador de la imprenta elegida (el simulado no genera PDF).*
- [x] Bitácora (`lib/bitacora.ts`) de cada emisión y de cada error.

### Fase 3B · Facturación diferida y tablero de control fiscal — ene–feb 2027
Regla: **todo cobro termina con su factura fiscal**. Diferir solo cambia el *momento* de emitirla, nunca si se emite.
- [ ] Estado fiscal del cobro (`facturas_caja.estado_fiscal`):
  - `FACTURADO`: documento emitido.
  - `PENDIENTE_FACTURAR`: tiene `motivo_diferido` y `facturar_antes_de`.
  - `CONTINGENCIA`: talonario emitido, falta registrarlo en la imprenta.
- [ ] Motivos permitidos de diferimiento (lista cerrada, configurable por el admin):
  - anticipo/abono → se factura al prestar el servicio;
  - aseguradora/empresa → factura consolidada al cierre del período;
  - el paciente pide factura a nombre de una empresa → falta razón social y RIF.
- [ ] En Recepción, al cobrar: opción "Emitir factura ahora" (por defecto) o "Diferir" con motivo obligatorio y PIN de autorización. Queda en la bitácora.
- [ ] **Factura consolidada** a aseguradora o empresa: agrupa cobros pendientes del mismo receptor en una sola factura fiscal y enlaza cada cobro con ella.
- [ ] Alertas: pendientes que vencen hoy o ya vencidos (en la barra superior y en el cierre diario). El **cierre del mes se bloquea** con pendientes vencidos sin justificar.
- [ ] **Tablero de control fiscal** (rol admin/dirección), por día y por mes, en Bs y USD:
  - cobrado frente a facturado y pendiente de facturar (con su antigüedad);
  - emitidas, Notas de Crédito/Débito y contingencias sin registrar;
  - **conciliación**: facturado + pendiente = cobrado en tesorería; las diferencias se señalan en rojo;
  - exportación a Excel (`lib/excel.ts`).
- [ ] Pruebas:
  - un cobro diferido aparece en el tablero hasta que se emite su factura;
  - la consolidada cubre exactamente los cobros elegidos;
  - la conciliación da cero diferencias en datos sanos y detecta un cobro sin documento.

### Fase 4 · Anulaciones → Notas de crédito/débito — feb 2027
- [ ] Factura con documento fiscal emitido: "anular" = **emitir una Nota de Crédito total** por el mismo medio. `revertirTesoreriaPorAnulacion` (idempotente) se mantiene; el original queda conservado (art. 21).
- [ ] Factura sin documento fiscal (borrador o error previo a la emisión): se mantiene la anulación actual.
- [ ] Devoluciones parciales (`lib/devoluciones.ts`) → **Nota de Crédito parcial**; ajustes al alza → **Nota de Débito**.
- [ ] UI en Historial / Caja: botón "Emitir nota de crédito", con motivo y PIN de autorización.

### Fase 5 · Contingencia (arts. 6, 7, 11) — feb 2027
- [ ] Registro de talonarios autorizados: imprenta, rango de N° de control y de factura, fecha de elaboración.
- [ ] **Modo contingencia** en Recepción. Se activa con un motivo de la lista del art. 6 y pide el **N° de control preimpreso** del talonario; el sistema valida el rango y que el número no se repita.
- [ ] Al cesar la contingencia: lista de documentos físicos pendientes y **envío en PDF a la imprenta digital al día siguiente** (art. 7), con alerta si queda alguno sin enviar.
  > Nota: la transcripción del art. 7 dice "al día siguiente"; el resumen decía "el mismo día". Se sigue el texto de la Gaceta.

### Fase 6 · Comprobantes de retención (art. 18) — mar 2027
- [ ] Numeración **AAAAMM + secuencial de 8 dígitos continuo**: contador único con bloqueo (reemplaza `count(*)` en `app/api/tesoreria/compras/facturas/route.ts`). Solo se reinicia al superar 99.999.999. Migración de los comprobantes ya emitidos.
- [ ] Campos del art. 18:
  - correo electrónico del proveedor;
  - N° de control y N° de la factura;
  - período de imposición;
  - monto total, base, impuesto causado y retenido;
  - fecha de emisión y entrega;
  - datos de la imprenta digital, cuando aplique.
- [ ] Comprobante en PDF.
- [ ] `ModuloRetencionesSeniat`: **persistir en servidor** o fusionarlo con las retenciones de compras (decidir al llegar aquí).

### Fase 7 · Libros y reportes — mar 2027
- [ ] **Libro de ventas** con: tipo de documento, N° de factura y de control, notas con su referencia, exentas (E), base/IVA por alícuota, IGTF y marca de contingencia. Exportación con `lib/excel.ts`.
- [ ] Reporte de documentos anulados conservados (art. 21) y de contingencias.
- [ ] Ajustar el libro de compras para mostrar el N° de comprobante de retención nuevo.

### Fase 8 · Pruebas integrales y salida — mar–abr 2027
- [ ] Pruebas en el sandbox de la imprenta: factura, NC, ND, contingencia y reenvío.
- [ ] Marcha en paralelo de 1-2 semanas.
- [ ] Capacitación de taquilla: contingencia y notas de crédito.
- [ ] **Notificar a la Gerencia Regional** el cambio de medio de emisión (Disposición Transitoria Segunda).
- [ ] Usar o anular los talonarios viejos antes de la vigencia (Transitoria Primera).
- [ ] **Salida a producción antes del 05/04/2027** (dos semanas de margen sobre el 19/04/2027).

## Riesgos
- **Manual Técnico del SENIAT sin publicar:** puede cambiar formatos o la API. Mitigación: lógica aislada en `lib/fiscal/` y adaptador intercambiable.
- **Condición IVA / IGTF indefinidas:** se cubren con configuración; las pruebas incluyen ambos casos.
- **Dependencia de la imprenta:** su caída obliga a operar en contingencia. Mitigación: cola con reintentos y modo contingencia probado.
- **Facturas históricas:** las emitidas antes de la vigencia no se re-emiten; solo aplica a documentos nuevos.

## Fuera de alcance
Máquina fiscal, Portal/App SENIAT, regímenes especiales del Título IV (transporte aéreo, loterías, combustible, licores) y obligaciones propias de imprentas y fabricantes (Título V).
