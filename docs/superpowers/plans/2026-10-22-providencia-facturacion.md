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
- [x] Estado fiscal del cobro (`facturas_caja.estado_fiscal`):
  - `FACTURADO`: documento emitido.
  - `PENDIENTE_FACTURAR`: tiene `motivo_diferido` y `facturar_antes_de`.
  - `CONTINGENCIA`: talonario emitido, falta registrarlo en la imprenta.
- [x] Motivos permitidos de diferimiento (lista cerrada, configurable por el admin):
  - anticipo/abono → se factura al prestar el servicio;
  - aseguradora/empresa → factura consolidada al cierre del período;
  - el paciente pide factura a nombre de una empresa → falta razón social y RIF.
- [x] En Recepción, al cobrar: opción "Emitir factura ahora" (por defecto) o "Diferir" con motivo obligatorio y PIN de autorización. Queda en la bitácora.
- [x] **Factura consolidada** a aseguradora o empresa: agrupa cobros pendientes del mismo receptor en una sola factura fiscal y enlaza cada cobro con ella.
- [x] Alertas de pendientes vencidos, sin factura y rechazados en Control Fiscal.
- [ ] Aviso en la barra superior y en el cierre diario; bloqueo de cierre con pendientes vencidos — *pendiente: hoy no existe cierre mensual; decidir si se bloquea el cierre diario.*
- [x] **Tablero de control fiscal** (rol admin/dirección), por día y por mes, en Bs y USD:
  - cobrado frente a facturado y pendiente de facturar (con su antigüedad);
  - emitidas, Notas de Crédito/Débito y contingencias sin registrar;
  - **conciliación**: facturado + pendiente = cobrado en tesorería; las diferencias se señalan en rojo;
  - exportación a Excel (`lib/excel.ts`).
- [x] Pruebas:
  - un cobro diferido aparece en el tablero hasta que se emite su factura;
  - la consolidada cubre exactamente los cobros elegidos;
  - la conciliación da cero diferencias en datos sanos y detecta un cobro sin documento.

### Fase 4 · Anulaciones → Notas de crédito/débito — feb 2027
- [x] Factura con documento fiscal emitido: "anular" = **emitir una Nota de Crédito total** por el mismo medio. `revertirTesoreriaPorAnulacion` (idempotente) se mantiene; el original queda conservado (art. 21).
- [x] Factura sin documento fiscal (borrador o error previo a la emisión): se mantiene la anulación actual.
- [x] Ajustes parciales y al alza: **notas manuales** de crédito/débito sobre una factura emitida (solo admin, con clave), desde Control Fiscal. *El sistema no tiene devoluciones parciales; el dinero se registra en Tesorería.*
- [x] UI: botón "Nota" en Control Fiscal (admin); la NC por anulación sale sola al anular (Historial/Caja y auditoría de cierre). Alerta de "anulado sin nota de crédito".

### Fase 5 · Contingencia (arts. 6, 7, 11) — feb 2027
- [x] Registro de talonarios autorizados (Catálogos > Datos fiscales): serie (art. 20), imprenta y su providencia, fecha de elaboración, rango de N° de control y de factura del mismo tamaño (art. 27); no se permiten rangos de control cruzados.
- [x] **Modo contingencia** en Recepción. Se activa con un motivo del art. 6 (1-4) y la clave del usuario, y pide el **N° de control preimpreso**. El sistema valida que esté en un talonario activo y que no se repita. El N° de factura sale del talonario, con su serie; la numeración digital no se toca.
- [x] Al cesar la contingencia: los documentos físicos (también los registrados con atraso) se **remiten en PDF a la imprenta digital** desde Control Fiscal (relación del art. 7). Alerta "vence hoy" el día siguiente y "vencida" después. Las notas que esperaban a esas facturas salen solas.
  > Nota: la transcripción del art. 7 dice "al día siguiente"; el resumen decía "el mismo día". Se sigue el texto de la Gaceta.
- [ ] Adaptador real de la imprenta para la remisión (`registrarContingencia`): hoy solo el simulado.
- [ ] Decidir (Manu): la NC de una factura de talonario sale hoy por la imprenta digital, ya remitida la factura. ¿El art. 12 ("mismo medio") obliga a emitirla en talonario?

### Fase 6 · Comprobantes de retención (art. 18) — mar 2027
- [x] Numeración **AAAAMM (de emisión) + secuencial de 8 dígitos continuo**: contador único con bloqueo (`secuencia_retencion`, reemplaza el `count(*)` por mes). Solo se reinicia al superar 99.999.999. Los comprobantes ya emitidos **no se renumeran** (ya fueron entregados): el contador arranca después del mayor secuencial existente.
- [x] Campos del art. 18: correo del proveedor, N° de control (obligatorio si hay retención) y N° de factura, período de imposición, total/base/impuesto causado/retenido en Bs (las facturas en $ se convierten con su tasa), fecha de emisión y de **entrega** (se registra en Egresos).
- [x] Comprobante en PDF (Egresos → Comprobantes de retención); el de una compra anulada sale marcado "ANULADO" (art. 21).
- [x] `ModuloRetencionesSeniat`: era de retenciones **recibidas** de clientes y no guardaba nada. Ahora persiste en servidor el comprobante del agente (su N° del art. 18) contra la factura fiscal de la clínica: valida receptor, IVA (los servicios exentos no admiten IVA retenido) y base acumulada; anulación con motivo.
- [ ] Decidir (Manu): IVA e ISLR van hoy en **un solo comprobante** por factura. ¿Separar en dos (numeraciones distintas por impuesto)?
- [ ] "Datos de la imprenta digital, cuando aplique" (art. 18.9): el comprobante lo genera la clínica, no la imprenta; se agrega si se emite por imprenta.

### Fase 7 · Libros y reportes — mar 2027
- [x] **Libro de ventas** del mes (Control Fiscal → Libros y reportes), en Bs: tipo de documento y transacción (01-REG / 02-COMP), serie, N° de factura y de control, factura afectada de las notas, exentas, base/IVA por alícuota, IGTF, IVA retenido por clientes con su comprobante y marca de contingencia. Las NC restan. Exportación con `lib/excel.ts`. Los documentos aún sin N° de control quedan fuera, con aviso.
- [x] Reporte de anulaciones por nota de crédito (original conservado, art. 21; total o parcial) y de contingencias con su cumplimiento del plazo del art. 7.
- [x] Libro de compras: ya mostraba el N° de comprobante de retención; con la Fase 6 sale con el formato nuevo.
- [ ] Formato del libro según el Manual Técnico / la normativa de libros (columnas exactas y archivo TXT para la declaración), cuando se publique.

### Fase 8 · Pruebas integrales y salida — mar–abr 2027
- [x] **Verificación de salida** (Catálogos → Datos fiscales): emisor, imprenta, proveedor (el simulado bloquea en producción), fecha de inicio, talonarios y formatos disponibles, rechazados/pendientes, contingencias vencidas, códigos de operación y correos de proveedores.
- [x] Prueba integral repetible `frontend/scripts/prueba-fiscal.mjs`: factura, ND, NC parcial, anulación con NC, reintentos y contingencia completa (12 pasos). Pasa con el simulado; se repite en el sandbox con la imprenta real.
- [x] Documentos en `docs/fiscal/`: manual de taquilla, borrador de notificación a la Gerencia Regional (Transitoria Segunda) y plan de salida con marcha en paralelo, formatos viejos (Transitoria Primera) y plan de reversa.
- [ ] Pruebas en el sandbox de la imprenta (depende de elegirla y de su adaptador).
- [ ] Marcha en paralelo de 1-2 semanas.
- [ ] Capacitación de taquilla.
- [ ] **Notificar a la Gerencia Regional** el cambio de medio de emisión.
- [ ] Usar o anular los talonarios viejos antes de la vigencia.
- [ ] **Salida a producción antes del 05/04/2027**.

## Riesgos
- **Manual Técnico del SENIAT sin publicar:** puede cambiar formatos o la API. Mitigación: lógica aislada en `lib/fiscal/` y adaptador intercambiable.
- **Condición IVA / IGTF indefinidas:** se cubren con configuración; las pruebas incluyen ambos casos.
- **Dependencia de la imprenta:** su caída obliga a operar en contingencia. Mitigación: cola con reintentos y modo contingencia probado.
- **Facturas históricas:** las emitidas antes de la vigencia no se re-emiten; solo aplica a documentos nuevos.

## Fuera de alcance
Máquina fiscal, Portal/App SENIAT, regímenes especiales del Título IV (transporte aéreo, loterías, combustible, licores) y obligaciones propias de imprentas y fabricantes (Título V).
