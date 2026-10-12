# Compensación de honorarios ya pagados — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar como deuda del médico los honorarios ya pagados de facturas anuladas y saldarla por descuento automático en la liquidación o por devolución directa.

**Architecture:** Libro `deudas_honorarios` (CARGO / ABONO_LIQUIDACION / ABONO_DEVOLUCION) creado en tiempo de ejecución. Lógica pura en `lib/deudasHonorarios.ts` (probada con vitest); acceso a datos en `lib/deudasHonorariosDb.ts`; tres rutas (liquidar modificada, devolución y consulta nuevas); pantalla en `TablaHonorarios.tsx` más un componente nuevo en `components/honorarios/`.

**Tech Stack:** Next.js 16 (rutas en `src/app/api`), TypeScript estricto, `pg`, zod, vitest, Tailwind v4, componentes propios en `components/ui`.

**Spec:** `docs/superpowers/specs/2026-10-12-compensacion-honorarios-design.md`

## Global Constraints

- Dinero siempre en centavos enteros con `toCents` / `centsToStr` de `lib/money.ts`; nunca float.
- Tasa BCV solo vía `obtenerTasaBcv()` de `lib/tasaBcv.ts`; sin valores por defecto ni tasas fijas.
- Médico comparado con `upper(trim(medico))` en SQL y `trim().toUpperCase()` en TS.
- Tipos de movimiento exactos: `'CARGO' | 'ABONO_LIQUIDACION' | 'ABONO_DEVOLUCION'`; tipo en tesorería: `'DEVOLUCION_HONORARIO'`.
- Candado por médico: `SELECT pg_advisory_xact_lock(hashtext('deuda:' || upper(trim($1))))` dentro de la transacción.
- Errores con `ApiError(status, mensaje)`; textos al usuario en español.
- Avisos en pantalla con `useAvisos()` (`avisar`, `confirmar`); nunca `alert/confirm/prompt`.
- Comandos en `frontend/`: `npm test`, `npm run typecheck`, `npm run lint`.

## Review Focus

1. Dos liquidaciones simultáneas del mismo médico: solo una descuenta la deuda (candado por médico). Revisar que el candado se toma antes de leer el saldo, en liquidar y en devolución.
2. Mismo médico escrito con distinta mayúscula o espacios: un solo saldo. Prueba `claveMedico` en Task 1.
3. Liquidación cubierta por deuda (`aPagar = 0`) con montos de pago escritos: se rechaza. Prueba `cuadraPago(500, 0) === false` en Task 1.
4. Devolución en Bs que, tras convertir, supera la deuda por redondeo: se rechaza. Prueba `validarDevolucion` en Task 1.
5. Anulación repetida de la misma factura: un solo CARGO por honorario. Verificación SQL con `ON CONFLICT DO NOTHING` en Task 2.

---

### Task 1: Lógica pura de deudas

**Files:**
- Create: `frontend/src/lib/deudasHonorarios.ts`
- Test: `frontend/src/lib/deudasHonorarios.test.ts`

**Interfaces:**
- Produces:
  - `type TipoMovDeuda = 'CARGO' | 'ABONO_LIQUIDACION' | 'ABONO_DEVOLUCION'`
  - `claveMedico(medico: string): string` → `trim().toUpperCase()`
  - `saldoDeuda(movs: { tipo: TipoMovDeuda; monto_usd: string | number }[]): number` (centavos; CARGO suma, ABONO_* resta)
  - `exigirSaldoValido(cents: number): number` → devuelve `cents`; si `< 0` lanza `ApiError(500, 'El saldo de deuda del médico es negativo: revise deudas_honorarios.')`
  - `descuentoAplicable(deudaCents: number, adeudadoCents: number): number` → `max(0, min(deuda, adeudado))`
  - `cuadraPago(entregadoCents: number, aPagarCents: number): boolean` → `Math.abs(entregado − aPagar) <= 2`
  - `usdDeBs(bsCents: number, tasa: number): number` → `Math.round(bsCents / tasa)`; lanza `ApiError(400, 'Debe indicar una tasa BCV válida.')` si `!(tasa > 0)`
  - `validarDevolucion(montoUsdCents: number, deudaCents: number): void` → `ApiError(400)` si monto ≤ 0, si deuda ≤ 0 o si monto > deuda (mensaje incluye la deuda con `centsToStr`)

- [ ] **Step 1: Write the failing test** `deudasHonorarios.test.ts` with:

```ts
expect(saldoDeuda([{ tipo: 'CARGO', monto_usd: '30.00' }, { tipo: 'ABONO_LIQUIDACION', monto_usd: '20.00' }, { tipo: 'ABONO_DEVOLUCION', monto_usd: 5 }])).toBe(500);
expect(saldoDeuda([])).toBe(0);
expect(claveMedico(' Dra. Silvia ')).toBe(claveMedico('DRA. SILVIA'));
expect(descuentoAplicable(3000, 2000)).toBe(2000);   // deuda mayor: paga 0, quedan 10
expect(descuentoAplicable(2000, 2000)).toBe(2000);
expect(descuentoAplicable(1000, 2000)).toBe(1000);
expect(descuentoAplicable(0, 2000)).toBe(0);
expect(descuentoAplicable(-100, 2000)).toBe(0);
expect(cuadraPago(500, 0)).toBe(false);
expect(cuadraPago(2, 0)).toBe(true);
expect(cuadraPago(1998, 2000)).toBe(true);
expect(cuadraPago(1997, 2000)).toBe(false);
expect(usdDeBs(874732, 874.7321)).toBe(1000);        // Bs 8.747,32 a 874,7321 = $10,00
expect(() => usdDeBs(100, 0)).toThrow(ApiError);
expect(() => exigirSaldoValido(-1)).toThrow(ApiError);
expect(exigirSaldoValido(0)).toBe(0);
expect(() => validarDevolucion(1001, 1000)).toThrow(/10\.00/);
expect(() => validarDevolucion(0, 1000)).toThrow(ApiError);
expect(() => validarDevolucion(500, 0)).toThrow(ApiError);
expect(() => validarDevolucion(1000, 1000)).not.toThrow();
```

- [ ] **Step 2: Run** `npx vitest run src/lib/deudasHonorarios.test.ts` — Expected: FAIL, "Cannot find module './deudasHonorarios'".
- [ ] **Step 3: Implement** the Produces list in `lib/deudasHonorarios.ts` (import `ApiError` from `@/lib/apiHelpers`, `toCents`/`centsToStr` from `@/lib/money`).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(honorarios): logica pura de deudas de honorarios`.

### Task 2: Tabla, acceso a datos y cargo en la anulación

**Files:**
- Create: `frontend/src/lib/deudasHonorariosDb.ts`
- Modify: `frontend/src/lib/anulacion.ts:47-52`

**Interfaces:**
- Consumes: `saldoDeuda`, `exigirSaldoValido`, `TipoMovDeuda` (Task 1).
- Produces:
  - `asegurarDeudasHonorarios(): Promise<void>` — idempotente, memoizada con `listo` como `asegurarDescuentos()`; ejecuta exactamente el DDL de la spec (tabla + `deudas_honorarios_cargo_unico` + `deudas_honorarios_medico`).
  - `bloquearYSaldo(client: PoolClient, medico: string): Promise<number>` — toma el candado por médico, lee los movimientos `WHERE upper(trim(medico)) = upper(trim($1))` y devuelve `exigirSaldoValido(saldoDeuda(rows))`.
  - `registrarMovDeuda(client: PoolClient, m: { medico: string; tipo: TipoMovDeuda; cents: number; fecha: string; usuario: string; descripcion: string; honorarioId?: number; facturaId?: number; pagoHonorarioId?: number; movimientoId?: number }): Promise<void>` — `INSERT … ON CONFLICT DO NOTHING`; no inserta si `cents <= 0`.
  - `deudasPorMedico(medico?: string): Promise<{ medico: string; saldoUsd: number; movimientos: { id: number; tipo: TipoMovDeuda; monto_usd: string; fecha: string; descripcion: string | null; usuario: string | null; factura_id: number | null; pago_honorario_id: number | null }[] }[]>` — agrupa por `claveMedico`, usa el nombre del movimiento más reciente, ordena movimientos por `creado_en DESC`, omite médicos sin movimientos.

- [ ] **Step 1: Implement** `lib/deudasHonorariosDb.ts` with the Produces list.
- [ ] **Step 2: Modify `anulacion.ts`**: llamar `await asegurarDeudasHonorarios()` al inicio de `revertirTesoreriaPorAnulacion`; la consulta de pagados pasa a `SELECT id, medico, monto_usd …`; por cada fila, `registrarMovDeuda(client, { tipo: 'CARGO', honorarioId: id, facturaId, cents: toCents(monto_usd), fecha, usuario, descripcion: \`Anulación factura ${facturaId}${motivo ? ': ' + motivo : ''}\` })`; la advertencia pasa a `Se registró una deuda de $${centsToStr(cents)} a ${medico}; se descontará en su próxima liquidación.`
- [ ] **Step 3: Verify SQL against Supabase without touching data** — una sola llamada `execute_sql` (proyecto `zjboatbvefmtuvnabowf`) que cree `deudas_honorarios` como `CREATE TEMP TABLE` con el DDL de la spec, inserte dos CARGO con el mismo `honorario_id` usando `ON CONFLICT DO NOTHING`, un ABONO_LIQUIDACION, y termine con el `SELECT` de `bloquearYSaldo` (sin el candado). Expected: el segundo CARGO no entra y el saldo es CARGO − ABONO.
- [ ] **Step 4: Run** `npm run typecheck && npm test` — Expected: 0 errores; todas las pruebas pasan.
- [ ] **Step 5: Commit** `feat(honorarios): deuda registrada al anular factura con honorario pagado`.

### Task 3: Descuento automático en la liquidación

**Files:**
- Modify: `frontend/src/app/api/tesoreria/honorarios/liquidar/route.ts:58-109`

**Interfaces:**
- Consumes: `bloquearYSaldo`, `registrarMovDeuda`, `asegurarDeudasHonorarios` (Task 2); `descuentoAplicable`, `cuadraPago` (Task 1).
- Produces: respuesta JSON con dos campos nuevos `descuentoDeudaUsd: number` y `aPagarUsd: number` (Task 6 los muestra).

- [ ] **Step 1: Modify the route** según la spec, sección "Liquidación": `asegurarDeudasHonorarios()` antes de la transacción; dentro, `bloquearYSaldo(client, b.medico)` antes de validar la selección; `descuento = descuentoAplicable(deuda, sumaUsd)`, `aPagar = sumaUsd − descuento`; el cuadre usa `cuadraPago(entregadoUsd, aPagar)` con mensaje `El pago no cubre la liquidación: entregado $X vs a pagar $Y (descuento por deuda $Z).`; tras crear `pagos_honorarios`, `registrarMovDeuda({ tipo: 'ABONO_LIQUIDACION', pagoHonorarioId: pago.id, cents: descuento, descripcion: \`Descuento en liquidación ${pago.id}\` })`.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm test` — Expected: 0 errores; todas las pruebas pasan.
- [ ] **Step 3: Commit** `feat(honorarios): la liquidacion descuenta la deuda del medico`.

### Task 4: Devolución directa

**Files:**
- Create: `frontend/src/app/api/tesoreria/honorarios/deudas/devolucion/route.ts`

**Interfaces:**
- Consumes: `bloquearYSaldo`, `registrarMovDeuda`, `asegurarDeudasHonorarios` (Task 2); `usdDeBs`, `validarDevolucion` (Task 1); `obtenerTasaBcv` (`lib/tasaBcv.ts`); `resolverFechaOperacion`, `camposFechaOperacion` (`lib/fechaOperacion.ts`); `marcarCierreModificado` (`lib/cierre.ts`).
- Produces: `POST` con cuerpo `{ medico: string; forma: 'EFECTIVO_USD' | 'EFECTIVO_BS' | 'PAGO_MOVIL_BS'; monto: string | number; referencia?: string; observaciones?: string; fecha?; motivo_retroactivo? }` → `{ mensaje: string; montoUsd: number; saldoRestanteUsd: number }`.

- [ ] **Step 1: Implement** según la spec, sección "Devolución": zod schema con los campos de arriba; cuenta = `forma` (los tres son códigos de `cuentas_bancarias`); `EFECTIVO_USD` usa el monto como USD; los Bs se convierten con `usdDeBs(cents, tasa.tasa)` y, si `obtenerTasaBcv()` devuelve `null`, `ApiError(503, 'No hay tasa BCV disponible para convertir la devolución.')`; `validarDevolucion` después de convertir; acreditar `saldo_actual` con `FOR UPDATE` y `ApiError(500)` si la cuenta no existe; `movimientos_tesoreria` tipo `DEVOLUCION_HONORARIO`, moneda según la forma, `RETURNING id`; `ABONO_DEVOLUCION` con `movimientoId`; `marcarCierreModificado` si `diaCerrado`.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint` — Expected: 0 errores.
- [ ] **Step 3: Commit** `feat(honorarios): registrar devolucion de deuda de honorarios`.

### Task 5: Consulta de deudas

**Files:**
- Create: `frontend/src/app/api/tesoreria/honorarios/deudas/route.ts`

**Interfaces:**
- Consumes: `deudasPorMedico`, `asegurarDeudasHonorarios` (Task 2).
- Produces: `GET /api/tesoreria/honorarios/deudas[?medico=]` → el arreglo de `deudasPorMedico` (Task 6 lo consume).

- [ ] **Step 1: Implement** el `GET` (patrón de `honorarios/pendientes/route.ts`, `errorResponse` en el catch).
- [ ] **Step 2: Run** `npm run typecheck && npm run lint` — Expected: 0 errores.
- [ ] **Step 3: Commit** `feat(honorarios): consulta de deudas por medico`.

### Task 6: Pantalla

**Files:**
- Create: `frontend/src/components/honorarios/DeudaMedico.tsx`
- Modify: `frontend/src/components/TablaHonorarios.tsx`

**Interfaces:**
- Consumes: `GET /api/tesoreria/honorarios/deudas` (Task 5), `POST …/deudas/devolucion` (Task 4), respuesta de liquidar con `descuentoDeudaUsd` / `aPagarUsd` (Task 3).
- Produces: `DeudaMedico({ medico: string; saldoUsd: number; movimientos: …; onCambio: () => void })` — etiqueta "Debe $X", botón "Registrar devolución" (Dialog con forma, monto, referencia; muestra deuda y equivalente USD si es Bs) e historial desplegable.

- [ ] **Step 1: Implement `DeudaMedico.tsx`** con los componentes de `components/ui` y `useAvisos()`; botón con estado (`Registrando…`), errores del servidor con `avisar({ tipo: 'error' })`.
- [ ] **Step 2: Modify `TablaHonorarios.tsx`**: cargar deudas junto con los pendientes; mostrar `DeudaMedico` en la fila del médico con saldo > 0; en el diálogo de liquidar mostrar "Adeudado $X − Descuento por deuda $Y = A pagar $Z" con `descuento = min(deuda, adeudado)` en centavos; los campos cuadran contra *A pagar*; si es 0, el botón dice "Registrar liquidación (cubierta por deuda)".
- [ ] **Step 3: Run** `npm run typecheck && npm run lint && npm test` — Expected: 0 errores; todas las pruebas pasan.
- [ ] **Step 4: Verify in the browser** con el dev server (`next dev -p 3111`, env de prueba) y rutas `/api/**` simuladas: un médico con deuda $30 y pendientes $20 muestra "Debe $30,00" y "A pagar $0,00"; el diálogo de devolución muestra la deuda. Capturas en el scratchpad.
- [ ] **Step 5: Commit** `feat(honorarios): deuda y devolucion en la pantalla de honorarios`.
