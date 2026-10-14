# Compras con factura, proveedores y cuentas por pagar — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egresos con dos formas de registro (gasto menor y compra con factura a proveedor), cuentas por pagar, retenciones configurables, reporte egresos vs ingresos y Libro de Compras.

**Architecture:** Lógica pura y testeable en `frontend/src/lib/compras/` (cálculos en centavos, sin `pg`); acceso a datos y DDL en ejecución en `lib/compras/comprasDb.ts`; rutas en `app/api/tesoreria/compras/**`; UI en `components/egresos/` con el estado en `ModuloEgresosOperativos.tsx`.

**Tech Stack:** Next.js 16 (rutas API), TypeScript estricto, pg, zod, vitest, `lib/excel.ts`.

**Spec:** `docs/superpowers/specs/2026-10-14-compras-proveedores-design.md`

## Global Constraints

- Dinero SIEMPRE en centavos enteros vía `lib/money.ts` (`toCents`, `centsToStr`, `mulRate`); nunca float.
- Tasa: prellenada con `obtenerTasaBcv()` de `lib/tasaBcv.ts`, editable; nunca hardcodeada. Cada factura y cada pago guardan su tasa.
- Retenciones apagadas por defecto; porcentajes y tabla ISLR solo desde `config_fiscal`.
- Tablas nuevas con `asegurar*()` memoizado, chequeo de catálogo con `table_schema = current_schema()` antes del DDL, `ENABLE ROW LEVEL SECURITY`, y el DDL se llama ANTES de abrir la transacción.
- Escrituras solo admin (ya cubierto: no-GET en `/api/tesoreria` es admin-only; añadir tests RBAC).
- Operaciones con fecha usan `camposFechaOperacion`/`resolverFechaOperacion` y `marcarCierreModificado` si el día está cerrado; `exigirJornadaAlDia` como en `cambio-divisa`.
- Componentes cliente no importan módulos que importan `apiHelpers`/`pg` (solo `import type`). Las funciones puras de `lib/compras/` lanzan `ApiError` importado de `@/lib/apiHelpers` SOLO en archivos que el cliente no importa; las que usa el cliente devuelven `string | null`.
- Textos de UI en español; Excel con `descargarExcel`.

## Review Focus

1. Factura en $ pagada desde cuenta en Bs (y viceversa) con tasa del pago ≠ tasa de factura: el pendiente baja en la moneda de la factura, no en la de la cuenta.
2. Pago que deja un residuo de 1 céntimo por redondeo de conversión: la factura debe quedar PAGADA (tolerancia ±1 céntimo en moneda de la factura).
3. Factura con varias alícuotas y líneas exentas: el Libro de Compras debe emitir una fila por alícuota y las exentas en su columna.
4. Retenciones activadas después de registrar facturas: las facturas viejas no se recalculan.
5. Anular factura con pagos ya reversados: se permite; con un pago vigente: 409.

---

### Task 1: Cálculos puros de la factura

**Files:**
- Create: `frontend/src/lib/compras/calculos.ts`
- Test: `frontend/src/lib/compras/calculos.test.ts`

**Interfaces:**
- Produces:
  - `type Moneda = 'BS' | 'USD'`
  - `interface LineaCompra { cantidad: number /* milésimas: 1 = 1000 */; precio: number /* centavos */; alicuota: number /* % entero: 16, 8, 0 */ }`
  - `interface ConfigFiscal { retencionesActivas: boolean; ivaRetenidoPct: 75 | 100; islr: { concepto: string; tipoPersona: 'NATURAL' | 'JURIDICA'; pct: number; sustraendo: number /* centavos Bs */ }[]; alicuotas: number[] }`
  - `interface TotalesFactura { porAlicuota: { alicuota: number; base: number; iva: number }[]; exento: number; totalBase: number; totalIva: number; total: number; ivaRetenido: number; islrRetenido: number; netoAPagar: number }`
  - `subtotalLinea(l: LineaCompra): number` = round(cantidad × precio / 1000)
  - `calcularTotales(lineas: LineaCompra[], cfg: ConfigFiscal, retencion: { contribuyenteEspecial: boolean; conceptoIslr?: string; tipoPersona: 'NATURAL'|'JURIDICA' }): TotalesFactura`
  - `validarRif(rif: string): string | null` (null = válido; normaliza a `J-12345678-9`)
  - `normalizarRif(rif: string): string`

- [ ] **Step 1: Tests** en `calculos.test.ts`:
  - `subtotalLinea({cantidad: 2500, precio: 1000, alicuota: 16})` → `2500`.
  - Dos líneas 16 % (base 10000) + una exenta (5000) + una 8 % (2000): `porAlicuota` = `[{16, 10000, 1600}, {8, 2000, 160}]`, `exento` 5000, `total` 18760.
  - Con `retencionesActivas: false`: `ivaRetenido` 0, `islrRetenido` 0, `netoAPagar === total`.
  - Activas, 75 %: `ivaRetenido` = 1320 (75 % de 1760); 100 % → 1760.
  - ISLR: concepto con pct 2 y sustraendo 0 sobre `totalBase` 12000 → 240; resultado nunca negativo.
  - `alicuota` no incluida en `cfg.alicuotas` → lanza `Error` con texto `alícuota`.
  - `validarRif('j123456789')` → null y `normalizarRif` → `'J-12345678-9'`; `validarRif('X-1')` → mensaje.
- [ ] **Step 2:** `npx vitest run src/lib/compras/calculos.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar. IVA por alícuota = `Math.round(base × alicuota / 100)`; retención ISLR sobre `totalBase` (sin exento).
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5:** Commit `feat(compras): cálculos de factura, retenciones configurables y RIF`.

### Task 2: Pagos y estados puros

**Files:**
- Create: `frontend/src/lib/compras/pagos.ts`
- Test: `frontend/src/lib/compras/pagos.test.ts`

**Interfaces:**
- Consumes: `Moneda` (Task 1).
- Produces:
  - `montoAplicado(montoCuenta: number, monedaCuenta: Moneda, monedaFactura: Moneda, tasa: number): number` (misma moneda → igual; BS→USD = round(bs/tasa); USD→BS = `mulRate`).
  - `estadoFactura(neto: number, pagado: number): 'PENDIENTE' | 'PARCIAL' | 'PAGADA'` (tolerancia: pendiente ≤ 1 → PAGADA).
  - `validarPago(aplicado: number, pendiente: number, saldoCuenta: number, montoCuenta: number): string | null`.

- [ ] **Step 1: Tests:** `montoAplicado(876800, 'BS', 'USD', 876.8)` → 1000; `montoAplicado(1000, 'USD', 'BS', 876.8)` → 876800; `estadoFactura(10000, 9999)` → `'PAGADA'`; `estadoFactura(10000, 0)` → `'PENDIENTE'`; `estadoFactura(10000, 5000)` → `'PARCIAL'`; `validarPago(10002, 10000, …)` → mensaje "supera lo pendiente"; `validarPago(…, saldoCuenta 100, montoCuenta 200)` → "Saldo insuficiente".
- [ ] **Step 2:** run → FAIL. **Step 3:** implementar. **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(compras): conversión de pagos y estados de factura`.

### Task 3: Esquema y configuración fiscal

**Files:**
- Create: `frontend/src/lib/compras/comprasDb.ts`
- Create: `frontend/src/app/api/tesoreria/compras/config/route.ts` (GET, PUT)
- Modify: `plantillas_y_scripts/schema_produccion_limpio.sql` (añadir tablas)
- Test: `frontend/src/lib/auth.test.ts` (PUT config: asistente false, admin true)

**Interfaces:**
- Produces:
  - `asegurarCompras(): Promise<void>` — crea `proveedores`, `productos_compra`, `facturas_compra`, `facturas_compra_lineas`, `pagos_compra`, `config_fiscal`, `retenciones_compra` con las columnas del spec (cantidad en milésimas `NUMERIC(14,3)`, montos `NUMERIC(14,2)`, tasa `NUMERIC(14,4)`); índices únicos `proveedores(rif)` y `facturas_compra(proveedor_id, numero_factura)`; RLS en todas; inserta config por defecto `{ retencionesActivas: false, ivaRetenidoPct: 75, islr: [], alicuotas: [16, 8, 0] }` si no existe.
  - `leerConfigFiscal(client?): Promise<ConfigFiscal>`.
- [ ] **Step 1:** Test RBAC (PUT `/api/tesoreria/compras/config` asistente → false) → FAIL no aplica (ya cubierto): ejecutar y confirmar PASS como evidencia.
- [ ] **Step 2:** Implementar `asegurarCompras`, `leerConfigFiscal`, la ruta (PUT valida con zod: `ivaRetenidoPct` ∈ {75,100}, `alicuotas` enteros 0–100, `islr[].pct` 0–100).
- [ ] **Step 3:** Validar el DDL contra la base real dentro de `BEGIN … ROLLBACK` (Supabase `execute_sql`) y confirmar que no quedó nada.
- [ ] **Step 4:** `npm run typecheck` → sin errores.
- [ ] **Step 5:** Commit `feat(compras): esquema y configuración fiscal`.

### Task 4: Proveedores y catálogo (API)

**Files:**
- Create: `frontend/src/app/api/tesoreria/compras/proveedores/route.ts` (GET lista con `?q=`, POST), `.../proveedores/[id]/route.ts` (PUT)
- Create: `frontend/src/app/api/tesoreria/compras/productos/route.ts` (GET, POST), `.../productos/[id]/route.ts` (PUT)

**Interfaces:**
- Consumes: `asegurarCompras`, `validarRif`, `normalizarRif`.
- Produces (JSON): `Proveedor { id, rif, razon_social, direccion, telefono, tipo_persona, contribuyente_especial, activo }`, `ProductoCompra { id, nombre, categoria, alicuota_defecto, proveedor_id, activo }`.
- [ ] **Step 1:** Implementar; RIF inválido → 400 con el mensaje de `validarRif`; RIF duplicado → 409 "Ya existe un proveedor con ese RIF"; `alicuota_defecto` debe estar en `config.alicuotas` → 400.
- [ ] **Step 2:** Probar SQL de inserción/consulta en `BEGIN … ROLLBACK` contra la base real.
- [ ] **Step 3:** `npm run typecheck`. **Step 4:** Commit `feat(compras): API de proveedores y catálogo`.

### Task 5: Registrar, listar y anular facturas de compra

**Files:**
- Create: `frontend/src/app/api/tesoreria/compras/facturas/route.ts` (GET con `desde`,`hasta`,`estado`,`proveedor_id`; POST)
- Create: `frontend/src/app/api/tesoreria/compras/facturas/[id]/anular/route.ts` (POST)
- Create: `frontend/src/lib/compras/registrarPago.ts` (función de servidor usada por POST factura contado y por Task 6)

**Interfaces:**
- Consumes: `calcularTotales`, `leerConfigFiscal`, `montoAplicado`, `estadoFactura`, `validarPago`.
- Produces:
  - `registrarPagoCompra(client: PoolClient, p: { facturaId: number; cuentaId: number; montoCuenta: number; tasa: number; fecha: string; hora: string; referencia?: string; usuario: string }): Promise<{ pagoId: number; estado: string }>` — bloquea factura y cuenta `FOR UPDATE`, valida, descuenta `saldo_actual`, inserta `pagos_compra` y `movimientos_tesoreria` tipo `PAGO_COMPRA`, actualiza estado.
  - POST factura body: `{ proveedor_id, numero_factura, numero_control?, fecha, moneda, tasa, lineas: { producto_id?, descripcion, cantidad (decimal), precio (decimal), alicuota }[], condicion: 'CONTADO'|'CREDITO', vencimiento?, concepto_islr?, pago?: { cuenta_id, monto, tasa } , notas?, motivo_retroactivo? }`. CONTADO exige `pago` que cubra `netoAPagar` (estado final PAGADA). Si retenciones activas: inserta `retenciones_compra` con número `AAAAMM` + secuencia de 8 dígitos del mes.
  - Anular: 409 si hay `pagos_compra` con `reversado = false`; si no, estado `ANULADA`.
- [ ] **Step 1:** Implementar. Duplicado (proveedor, número) → 409.
- [ ] **Step 2:** SQL completo (factura + líneas + pago contado + movimiento) probado en `BEGIN … ROLLBACK` contra la base real.
- [ ] **Step 3:** `npm run typecheck && npm test`. **Step 4:** Commit `feat(compras): registrar, listar y anular facturas de compra`.

### Task 6: Pagos a crédito y reverso

**Files:**
- Create: `frontend/src/app/api/tesoreria/compras/pagos/route.ts` (POST pago; GET por factura)
- Create: `frontend/src/app/api/tesoreria/compras/pagos/[id]/reversar/route.ts` (POST)
- Test: `frontend/src/lib/auth.test.ts` (POST pagos/reversar: asistente false)

**Interfaces:**
- Consumes: `registrarPagoCompra`.
- Produces: reverso → devuelve `monto_cuenta` a la cuenta, `movimientos_tesoreria` tipo `REVERSO_PAGO_COMPRA`, `pagos_compra.reversado = true`, recalcula estado; reversar dos veces → 409.
- [ ] **Step 1:** Tests RBAC → PASS (ya cubiertos por regla). **Step 2:** Implementar con `exigirJornadaAlDia`, `resolverFechaOperacion`, `marcarCierreModificado`.
- [ ] **Step 3:** SQL en `BEGIN … ROLLBACK`. **Step 4:** Commit `feat(compras): pagos parciales y reverso`.

### Task 7: Reporte egresos vs ingresos y Libro de Compras

**Files:**
- Create: `frontend/src/lib/compras/reporte.ts` (puro, sin `pg`, importable por el cliente)
- Test: `frontend/src/lib/compras/reporte.test.ts`
- Create: `frontend/src/app/api/tesoreria/compras/reporte/route.ts` (GET `desde`,`hasta`)
- Create: `frontend/src/app/api/tesoreria/compras/libro/route.ts` (GET `mes=AAAA-MM`)

**Interfaces:**
- Produces:
  - `interface MovCaja { fecha: string; tipo: 'INGRESO_FACTURA'|'INGRESO_EXTRA'|'PAGO_COMPRA'|'GASTO_MENOR'|'HONORARIOS'|'COMISION'; bs: number; usd: number /* equivalentes a la tasa de su día */; proveedor?: string; producto?: string; categoria?: string }`
  - `armarReporte(movs: MovCaja[], porPagar: { proveedor: string; usd: number; bs: number }[]): { ingresos: {bs,usd}; egresos: {bs,usd; porTipo: Record<string,{bs,usd}>}; resultado: {bs,usd}; comprometido: {bs,usd}; porProveedor: …[]; porCategoria: …[]; porPeriodo: { periodo: string; ingresos: number; egresos: number }[] }`
  - `filasLibroCompras(facturas: …[]): Record<string, string|number>[]` — una fila por alícuota; ANULADA con montos 0 y tipo "03-ANU"; registro "01-REG".
- [ ] **Step 1: Tests:** resultado = ingresos − egresos; `comprometido` no resta del resultado; factura con 16 % y 8 % → 2 filas; anulada → montos 0; totales al pie por alícuota.
- [ ] **Step 2:** run → FAIL. **Step 3:** implementar `reporte.ts` y las rutas (ingresos desde `facturas_caja` pagos + `ingresos_extraordinarios`; egresos desde `pagos_compra` no reversados, `egresos_operativos`, `pagos_honorarios`, comisiones de `movimientos_tesoreria`). **Step 4:** run → PASS; SQL de las rutas en `BEGIN … ROLLBACK`.
- [ ] **Step 5:** Commit `feat(compras): reporte egresos vs ingresos y Libro de Compras`.

### Task 8: UI en Egresos

**Files:**
- Create: `frontend/src/components/egresos/FormCompra.tsx`, `PorPagar.tsx`, `ProveedoresCatalogo.tsx`, `ReporteEgresos.tsx`, `ConfigFiscal.tsx`
- Modify: `frontend/src/components/ModuloEgresosOperativos.tsx` (pestañas: Gasto menor · Compra con factura · Por pagar · Proveedores y catálogo · Reporte · Historial; config fiscal como botón en Proveedores y catálogo)

**Interfaces:**
- Consumes: rutas de Tasks 3–7; `calcularTotales` NO se importa en el cliente si importa `apiHelpers` → vista previa con una copia mínima o importando `calculos.ts` solo si no importa `apiHelpers` (Task 1 debe mantenerlo libre de `apiHelpers`: lanzar `Error`, y las rutas lo traducen a `ApiError(400)`).
- [ ] **Step 1:** FormCompra: proveedor con búsqueda y alta rápida; líneas desde catálogo con cantidad/precio/alícuota; tasa prellenada desde `/api/bcv` y editable; totales en vivo; contado (cuenta + monto + tasa) o crédito (vencimiento).
- [ ] **Step 2:** PorPagar: lista por proveedor con vencidas resaltadas, pago parcial y reverso; ReporteEgresos con Desde/Hasta, tarjetas, tabla, gráfico de barras (recharts/Tremor ya presente) y Excel (Resumen, Compras, Gastos menores, Detalle) + botón Libro de Compras del mes.
- [ ] **Step 3:** `npm run typecheck && npx eslint src && npm test` → 0 errores, todo en verde.
- [ ] **Step 4:** Commit `feat(compras): pantallas de compras, por pagar, proveedores y reporte`.

### Task 9: Revisión final y entrega

- [ ] **Step 1:** Revisión de toda la rama (reviewer fresco) contra spec y Review Focus; corregir Critical/Important con test RED→GREEN.
- [ ] **Step 2:** Suite completa verde; commit; PR solo cuando el usuario lo pida.
