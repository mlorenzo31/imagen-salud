# Compensación de honorarios ya pagados — diseño

Fecha: 2026-10-12 · Estado: aprobado en conversación, pendiente de revisión escrita

## Problema

Al anular una factura cuyo honorario ya se liquidó al médico, `lib/anulacion.ts` solo devuelve la advertencia
"debe compensarse en su próxima liquidación". Nada se guarda: el honorario queda `PAGADO` y la siguiente
liquidación paga lo pendiente completo. La deuda del médico se pierde.

## Objetivo y criterio de éxito

Registrar la deuda en el momento de la anulación, mostrarla en Honorarios y saldarla por descuento en
liquidación o por devolución directa, con rastro de cada movimiento.

Criterio: para cada médico, `pagado − descontado − devuelto = Σ honorarios de facturas no anuladas`.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Forma de recuperar | Ambas: descuento en la próxima liquidación (por defecto) y devolución directa |
| Aplicación en liquidación | Automática y parcial: `descuento = min(deuda, adeudado)`; el resto queda para la siguiente |
| Modelo de datos | Libro de movimientos aparte (`deudas_honorarios`), no estados nuevos ni honorarios negativos |
| Moneda | USD, igual que los honorarios. Devolución en Bs se convierte con `lib/tasaBcv.ts` |
| Beneficiarios | Todos los médicos, incluido `PATOLOGO` |
| Vencimientos/intereses | No |

## Modelo de datos

Tabla creada en tiempo de ejecución por `asegurarDeudasHonorarios()` (idempotente, mismo patrón que
`asegurarDescuentos()`):

```sql
CREATE TABLE IF NOT EXISTS deudas_honorarios (
  id                SERIAL PRIMARY KEY,
  medico            TEXT NOT NULL,
  tipo              VARCHAR(20)  NOT NULL CHECK (tipo IN ('CARGO', 'ABONO_LIQUIDACION', 'ABONO_DEVOLUCION')),
  monto_usd         NUMERIC(12,2) NOT NULL CHECK (monto_usd > 0),
  honorario_id      INTEGER,      -- solo CARGO
  factura_id        INTEGER,      -- solo CARGO
  pago_honorario_id INTEGER,      -- solo ABONO_LIQUIDACION
  movimiento_id     INTEGER,      -- solo ABONO_DEVOLUCION (movimientos_tesoreria.id)
  descripcion       TEXT,
  usuario           VARCHAR(100),
  fecha             DATE NOT NULL,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS deudas_honorarios_cargo_unico ON deudas_honorarios (honorario_id) WHERE tipo = 'CARGO';
CREATE INDEX IF NOT EXISTS deudas_honorarios_medico ON deudas_honorarios (upper(trim(medico)));
```

- El signo lo da el tipo: `saldo = Σ CARGO − Σ ABONO_*`.
- El médico se compara con `upper(trim(medico))`, igual que `validarSeleccionHonorarios`.
- El índice único hace idempotente el cargo por honorario (la anulación puede repetirse).

## Lógica pura — `lib/deudasHonorarios.ts`

Todo en centavos enteros (`lib/money.ts`).

- `saldoDeuda(movs: { tipo, monto_usd }[]): number` → centavos ≥ 0 esperado; si diera negativo (datos
  corruptos), se devuelve tal cual para que el llamador lo rechace.
- `descuentoAplicable(deudaCents: number, adeudadoCents: number): number` → `max(0, min(deuda, adeudado))`.
- `usdDeBs(bsCents: number, tasa: number): number` → `Math.round(bsCents / tasa)`; lanza si la tasa no es > 0.

## Flujos

### Anulación (`lib/anulacion.ts`)

Dentro de la misma transacción de la anulación, por cada honorario `PAGADO` de la factura:

```sql
INSERT INTO deudas_honorarios (medico, tipo, monto_usd, honorario_id, factura_id, descripcion, usuario, fecha)
VALUES ($medico, 'CARGO', $monto, $honorario_id, $factura_id, 'Anulación factura N: <motivo>', $usuario, $fecha)
ON CONFLICT DO NOTHING;
```

La advertencia cambia a: `Se registró una deuda de $X a <médico>; se descontará en su próxima liquidación.`

### Liquidación (`POST /api/tesoreria/honorarios/liquidar`)

1. `pg_advisory_xact_lock(hashtext('deuda:' || upper(trim(medico))))` — evita que dos liquidaciones
   simultáneas descuenten la misma deuda.
2. Validación existente (`validarSeleccionHonorarios`), `adeudado = Σ honorarios`.
3. `deuda = saldoDeuda(...)`, `descuento = descuentoAplicable(deuda, adeudado)`, `aPagar = adeudado − descuento`.
4. Cuadre contra `aPagar` (±2 céntimos), ya no contra `adeudado`.
5. `pagos_honorarios` igual que hoy (`total_usd_liquidado` = adeudado bruto).
6. Si `descuento > 0`: `ABONO_LIQUIDACION` por `descuento` con `pago_honorario_id`.
7. Si `aPagar = 0`: se registra la liquidación sin débitos a cuentas.

La respuesta agrega `descuentoDeudaUsd` y `aPagarUsd`.

### Devolución (nuevo `POST /api/tesoreria/honorarios/deudas/devolucion`)

Entrada: `medico`, `forma` (`EFECTIVO_USD` | `EFECTIVO_BS` | `PAGO_MOVIL_BS`), `monto`, `referencia?`,
`observaciones?`, campos de fecha de operación (`camposFechaOperacion`).

1. Mismo candado por médico.
2. `montoUsd` = monto si es USD; si es Bs, `usdDeBs(monto, tasa)` con tasa de `lib/tasaBcv.ts`.
3. Rechaza si `montoUsd ≤ 0`, si no hay deuda o si `montoUsd > deuda` (400, con la deuda actual).
4. Acredita la cuenta (`saldo_actual`) y registra `movimientos_tesoreria` tipo `DEVOLUCION_HONORARIO`.
   El pago móvil se acredita directo al saldo (transferencia del médico, sin conciliación bancaria).
5. `ABONO_DEVOLUCION` por `montoUsd` con `movimiento_id`.
6. Si la fecha cae en día cerrado: `marcarCierreModificado`, como en la liquidación.

### Consulta (nuevo `GET /api/tesoreria/honorarios/deudas`)

Devuelve `[{ medico, saldoUsd, movimientos: [...] }]` solo de médicos con movimientos; `?medico=` filtra.

## Pantalla — `components/TablaHonorarios.tsx`

- Etiqueta "Debe $X" junto al médico con deuda.
- Diálogo de liquidar: "Adeudado $X − Descuento por deuda $Y = A pagar $Z"; los campos cuadran contra
  *A pagar*; si es $0, el botón dice "Registrar liquidación (cubierta por deuda)".
- Botón "Registrar devolución" (solo con deuda): forma, monto, referencia; muestra deuda y equivalente USD.
- Historial desplegable de cargos y abonos con fecha, origen (factura o liquidación) y usuario.

## Errores

| Caso | Respuesta |
|---|---|
| Devolución mayor que la deuda | 400 con la deuda actual |
| Devolución sin deuda | 400 |
| Monto ≤ 0 | 400 |
| Cuenta de destino inexistente | 500 |
| Anulación repetida | No duplica el cargo (índice único) |
| Saldo de deuda negativo (datos corruptos) | 500, no se liquida ni se devuelve |

## Pruebas

- `lib/deudasHonorarios.test.ts`: saldo con cargos y abonos; descuento con deuda menor, igual y mayor que
  lo adeudado; descuento nunca negativo ni mayor que lo adeudado; `usdDeBs` en centavos y tasa inválida.
- Rutas: typecheck y lint (el proyecto no tiene pruebas de rutas con base de datos).
- Verificación local del flujo completo (anular → liquidar con descuento → devolución) con datos simulados.

## Fuera de alcance

Historial contable completo del médico, vencimientos o intereses, recálculo de liquidaciones pasadas.
