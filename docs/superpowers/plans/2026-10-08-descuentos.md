# Descuentos en facturación — plan de implementación

> **Para agentes:** usar superpowers:executing-plans (ejecución nativa en esta sesión, elegida por el usuario al pedir «arma el plan e implementa»). Pasos con casillas `- [ ]`.

**Meta:** descuento manual (cajero, con clave y tope 20 %) y promociones programadas (admin), con reparto CLINICA/PROPORCIONAL, cuadre contra el neto, bitácora y cierre.

**Arquitectura:** función pura `lib/descuento.ts` (centavos) usada por servidor y pantalla; `precio_usd` pasa a ser el neto cobrado; columnas nuevas guardan lista/descuento/motivo; promos en tabla `promociones`; el servidor recalcula todo.

**Stack:** Next.js 16 (App Router), TypeScript estricto, `pg`, zod, vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-descuentos-design.md`

## Restricciones globales
- Dinero en centavos enteros (`lib/money.ts`), nunca float. Tasa solo vía `lib/tasaBcv.ts`.
- Tope cajero: `TOPE_DESCUENTO_CAJERO_BP = 2000` (20 %). Motivo manual ≥ 5 caracteres. Tolerancia de cuadre actual: 2 centavos.
- Un solo origen por factura (promo **o** manual). Promos se aplican solas, sin opción de omitirlas.
- Migraciones idempotentes (`IF NOT EXISTS`), RLS activado en tablas nuevas. Comandos en `frontend/`: `npm run typecheck`, `npm test`, `npm run lint`.
- No hacer PR sin que el usuario lo pida; sí commit + push a `claude/clinic-setup-audit-4w37fl`.

## Review Focus (cada línea tiene su prueba en la tarea indicada)
1. Descuento que deja el total neto ≤ 0 (PCT 100 % o USD ≥ lista) → rechazado (T1).
2. Cajero con 20,01 % sin autorizador → rechazado; autorizador con rol cajero → rechazado (T3).
3. Promo vencida, inactiva o sin coincidencia no aplica; promo + manual → rechazado (T1).
4. CLINICA con honorarios > neto de un servicio → rechazado (T1).
5. Facturas antiguas (`precio_lista_usd` NULL) se leen como lista = neto en cierre/historial (T8).

## Estructura de archivos
- Crear `src/lib/descuento.ts` (+ `descuento.test.ts`): cálculo, reparto, emparejamiento de promos, tope.
- Crear `src/lib/descuentosDb.ts`: migración, `promosActivas(fecha)`, CRUD de promos.
- Crear `src/lib/autorizacionDescuento.ts` (+ test): verifica tope y autorizador.
- Crear `src/app/api/admin/promociones/route.ts`, `src/app/api/promociones/activas/route.ts`.
- Modificar `src/app/api/facturas/route.ts`, `src/lib/auth.ts` (+test), `src/lib/bitacora.ts`, `src/components/ModuloBitacora.tsx`, `src/lib/cierre.ts` (`evaluarDia`), `ModuloCierreDiario.tsx`.
- Crear `src/components/DescuentoPanel.tsx`, `src/components/admincatalogos/PanelPromociones.tsx`; modificar `ModuloFacturacion.tsx`, `ModuloAdminCatalogos.tsx`, detalle de movimiento del Historial.
- Modificar `plantillas_y_scripts/schema_produccion_limpio.sql`.

---

### Task 1: Cálculo puro de descuentos
**Files:** Create `src/lib/descuento.ts`, `src/lib/descuento.test.ts`
**Interfaces — Produces:**
```ts
export const TOPE_DESCUENTO_CAJERO_BP = 2000;
export type ModoReparto = 'CLINICA' | 'PROPORCIONAL';
export interface ServicioBase { area: string; estudio: string; precio: number; honorarios: number; honPatologo: number } // centavos
export interface ServicioNeto { precioLista: number; descuento: number; precio: number; honorarios: number; honMedico: number; honPatologo: number; ganancia: number; promoId: number | null; modo: ModoReparto | null }
export interface DescuentoManual { tipo: 'PCT' | 'USD'; valor: number /* PCT: puntos básicos; USD: centavos */; modo: ModoReparto }
export interface Promo { id: number; nombre: string; porcentajeBp: number; modo: ModoReparto; areas: string[]; estudios: string[]; desde: string; hasta: string; activa: boolean }
export class DescuentoError extends Error {}
export function repartirDescuento(precios: number[], total: number): number[]
export function descuentoTotalManual(totalLista: number, d: DescuentoManual): number
export function aplicarDescuento(servicios: ServicioBase[], descuentos: number[], modo: ModoReparto, promoIds?: (number | null)[]): ServicioNeto[]
export function promoAplicable(promos: Promo[], s: { area: string; estudio: string }, fecha: string): Promo | null
export function calcularFactura(servicios: ServicioBase[], promos: Promo[], fecha: string, manual: DescuentoManual | null): ServicioNeto[]
export const porcentajeEfectivoBp = (totalLista: number, totalDescuento: number): number
```
- [ ] **Step 1: tests (fallan)** en `descuento.test.ts`: `repartirDescuento([1000,1000,1000], 100)` suma 100 y cada parte ∈ {33,34}; `descuentoTotalManual(2000,{tipo:'PCT',valor:2500,modo:'CLINICA'})===500`; `descuentoTotalManual(2000,{tipo:'PCT',valor:10000,...})` lanza `DescuentoError`; USD ≥ lista lanza; servicio $20 (hon 600 = 6,00) con descuento 500, CLINICA → precio 1500, honorarios 600, ganancia 900; PROPORCIONAL → honorarios 450, ganancia 1050; CLINICA con descuento 1500 sobre servicio $20 hon $6 → lanza (ganancia negativa); `promoAplicable` devuelve la promo por `estudios` y por `areas` (si `estudios` vacío), `null` si `activa=false`, si `fecha` < `desde` o > `hasta`; `calcularFactura` con promo aplicable y `manual` no nulo lanza «ya tiene una promoción»; con dos servicios la suma de `descuento` es exacta y `Σ precio + Σ descuento === Σ precioLista`; `porcentajeEfectivoBp(2000,500)===2500`.
- [ ] **Step 2:** `npm test -- descuento` → FALLA (módulo inexistente).
- [ ] **Step 3: implementar** `descuento.ts`. Reparto por resto mayor (piso proporcional + restos a mayor fracción, desempate por índice); PCT: `Math.round(totalLista*bp/10000)`; PROPORCIONAL: `Math.round(x*neto/precio)` para `honorarios` y `honPatologo`, `honMedico = honorarios − honPatologo`, `ganancia = precio − honorarios`; promo por servicio: `Math.round(precio*porcentajeBp/10000)`, cada servicio usa el modo de su promo; validar `0 < D < L` (manual) y neto_i > 0.
- [ ] **Step 4:** `npm test -- descuento` → PASA.
- [ ] **Step 5: commit** `feat(descuentos): cálculo puro con reparto y promociones`.

### Task 2: Datos y promociones (DB)
**Files:** Create `src/lib/descuentosDb.ts`
**Consumes:** `Promo` de T1. **Produces:**
```ts
export function asegurarDescuentos(): Promise<void>
export async function promosActivas(fecha: string, db?: Pick<Pool,'query'>): Promise<Promo[]>
export async function listarPromos(): Promise<PromoFila[]>
export async function guardarPromo(p: PromoEntrada, usuario: string, id?: number): Promise<PromoFila>
export const promoEntradaSchema // zod: nombre, porcentaje (0<p≤100, 2 dec), modo, areas, estudios, fechaDesde, fechaHasta (desde ≤ hasta), activa
```
- [ ] **Step 1: test** de `promoEntradaSchema` en `descuento.test.ts`: rechaza porcentaje 0 y 101, `desde > hasta`, nombre vacío; acepta `{porcentaje: 20, areas:['MAMOGRAFIA']}`.
- [ ] **Step 2:** correr → FALLA.
- [ ] **Step 3: implementar** `asegurarDescuentos` (idempotente, patrón `catalogoDb.asegurarCatalogo`): `ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS` para `precio_lista_usd NUMERIC(12,2)`, `descuento_usd NUMERIC(12,2) NOT NULL DEFAULT 0`, `descuento_modo VARCHAR(12)`, `descuento_origen VARCHAR(10)`, `descuento_motivo TEXT`, `descuento_promo_id INT`, `descuento_autorizado_por VARCHAR(100)`; `ALTER TABLE facturas_servicios_detalle ADD COLUMN IF NOT EXISTS precio_lista_usd NUMERIC(12,2)`; `CREATE TABLE IF NOT EXISTS promociones (...)` + `ENABLE ROW LEVEL SECURITY`. `promosActivas` filtra `activa AND fecha BETWEEN desde AND hasta` y convierte porcentaje a puntos básicos con `Math.round(Number(p)*100)`.
- [ ] **Step 4:** tests PASAN; `npm run typecheck`.
- [ ] **Step 5: commit** `feat(descuentos): migración y promociones`.

### Task 3: Autorización (tope del cajero)
**Files:** Create `src/lib/autorizacionDescuento.ts`, `src/lib/autorizacionDescuento.test.ts`
**Consumes:** `TOPE_DESCUENTO_CAJERO_BP`, `buscarUsuario(usuario)` de `usuariosDb`, `verificarClave`. **Produces:**
```ts
export interface Autorizador { usuario: string; clave: string }
export async function exigirAutorizacionDescuento(a: { rol: string; porcentajeBp: number; autorizador?: Autorizador | null; buscar?: typeof buscarUsuario }): Promise<string | null> // devuelve usuario que autorizó o null si no hizo falta
```
- [ ] **Step 1: tests** (con `buscar` inyectado): cajero 2000 bp → `null`; cajero 2001 bp sin autorizador → lanza `ApiError` 403; con autorizador admin válido → devuelve su usuario; con autorizador de rol `cajero` → lanza 403; clave incorrecta → 401; usuario inactivo → 401; rol `asistente`/`admin` con 5000 bp → `null` sin autorizador; 5 fallos seguidos del mismo autorizador → 429.
- [ ] **Step 2:** FALLA.
- [ ] **Step 3: implementar** con contador de fallos por usuario autorizador (mismo patrón que `lib/pin.ts`: 5 fallos / 15 min).
- [ ] **Step 4:** PASA.
- [ ] **Step 5: commit** `feat(descuentos): autorización por tope`.

### Task 4: Integración en `POST /api/facturas`
**Files:** Modify `src/app/api/facturas/route.ts`, `src/lib/bitacora.ts` (`'DESCUENTO'` en `TipoBitacora`), `src/components/ModuloBitacora.tsx` (etiqueta «Descuento»)
**Consumes:** T1–T3, `exigirPinSesion`, `registrarBitacora`, `actorSesion`.
- [ ] **Step 1: implementar** tras `normalizarServicios`: `await asegurarDescuentos()`; validar `data.descuento` con zod (`tipo`, `valor`, `modo`, `motivo` ≥ 5, `pin`, `autorizador?`); `promos = await promosActivas(fecha)`; `netos = calcularFactura(servicios→ServicioBase, promos, fecha, manual)` (capturar `DescuentoError` → `ApiError(400)`); si hay descuento manual: `await exigirPinSesion(req, pin)` y `exigirAutorizacionDescuento({rol, porcentajeBp: porcentajeEfectivoBp(L, D), autorizador})`. Reemplazar en `servicios` `precio/honorarios/honMedico/honPatologo/ganancia` por los netos; conservar `precioLista`, `descuento` en el JSON. El chequeo `data.precioUSD` sigue contra el total de **lista**; el cuadre de pagos contra el **neto**.
- [ ] **Step 2:** guardar en `INSERT facturas_caja` las columnas nuevas (`precio_lista_usd`=Σ lista, `descuento_usd`, `descuento_modo`, `descuento_origen` `PROMO`/`MANUAL`, `descuento_motivo` (nombre de la promo si es promo), `descuento_promo_id`, `descuento_autorizado_por`) y `precio_lista_usd` en el detalle. Dentro de la misma transacción, si D>0: `registrarBitacora({tipo:'DESCUENTO', fechaAfectada: fecha, descripcion, detalle:{lista, descuento, modo, origen, motivo, autorizadoPor}})`.
- [ ] **Step 3:** `npm run typecheck && npm test` pasan. Revisar a mano que `honorarios_medicos_pendientes` y los ingresos de tesorería usan los valores ya netos.
- [ ] **Step 4: commit** `feat(descuentos): descuento en facturación con bitácora`.

### Task 5: APIs de promociones y permisos
**Files:** Create `src/app/api/admin/promociones/route.ts` (GET lista, POST crea, PUT edita/activa, valida con `promoEntradaSchema`), `src/app/api/promociones/activas/route.ts` (GET `?fecha=` → `Promo[]` activas); Modify `src/lib/auth.ts` (`CAJERO_API` agrega `'/api/promociones/activas'`), `src/lib/auth.test.ts`.
- [ ] **Step 1: test** en `auth.test.ts`: cajero y asistente `GET /api/promociones/activas` → true; cajero y asistente `POST /api/admin/promociones` → false; admin → true.
- [ ] **Step 2:** FALLA; **Step 3:** implementar rutas (patrón `errorResponse`) y el prefijo; **Step 4:** PASA.
- [ ] **Step 5: commit** `feat(descuentos): API de promociones`.

### Task 6: Pantalla de caja
**Files:** Create `src/components/DescuentoPanel.tsx`; Modify `src/components/ModuloFacturacion.tsx`
- [ ] **Step 1:** en `ModuloFacturacion` cargar promos activas (`/api/promociones/activas?fecha=hoy`) y calcular con `calcularFactura` (misma función del servidor, sin manual) para mostrar por servicio lista / descuento / neto con etiqueta «Promo: nombre −X %»; `totalUSD` (a cobrar) = Σ neto; los pagos y `isCuadrado` usan ese total; `payloadValidacion.servicios[].precioUSD` = neto para el esquema local.
- [ ] **Step 2:** `DescuentoPanel` (deshabilitado si hay promo aplicable): tipo %/$, valor, modo (CLINICA/PROPORCIONAL con texto del efecto en honorarios y ganancia, calculado con `calcularFactura`), motivo, clave; si porcentaje efectivo > tope y el rol es cajero, campos usuario y clave del autorizador. Enviar `descuento` en el POST.
- [ ] **Step 3:** `npm run typecheck && npm run lint` sin errores nuevos; verificación visual con el servidor de desarrollo si es posible.
- [ ] **Step 4: commit** `feat(descuentos): pantalla de caja`.

### Task 7: Pantalla de promociones (admin)
**Files:** Create `src/components/admincatalogos/PanelPromociones.tsx`; Modify `src/components/ModuloAdminCatalogos.tsx` (pestaña «Promociones»: tabla, crear/editar, activar/desactivar, vigencia, áreas/estudios del catálogo).
- [ ] Implementar contra `/api/admin/promociones`; `typecheck` + `lint`; **commit** `feat(descuentos): administración de promociones`.

### Task 8: Cierre, historial y datos antiguos
**Files:** Modify `src/lib/cierre.ts` (`evaluarDia.resumen` agrega `totalDescuentosUSD` = `SUM(descuento_usd)` de no anuladas), `src/components/ModuloCierreDiario.tsx` (tarjeta «Descuentos del día»), detalle de movimiento del Historial (lista / descuento / neto con `COALESCE(precio_lista_usd, precio_usd)`), `src/app/api/facturas/route.ts` GET (devuelve `precio_lista_usd`, `descuento_usd`).
- [ ] **Step 1: test** (Review Focus 5) en `descuento.test.ts`: `precioListaCents({precio_lista_usd:null, precio_usd:'20.00'})` devuelve 2000 (helper en `descuento.ts`).
- [ ] **Step 2–3:** FALLA → implementar helper y usarlo en pantallas; **Step 4:** `typecheck` + `test` pasan.
- [ ] **Step 5: commit** `feat(descuentos): cierre e historial muestran descuentos`.

### Task 9: Referencia de esquema y verificación final
**Files:** Modify `plantillas_y_scripts/schema_produccion_limpio.sql` (columnas nuevas + `promociones`).
- [ ] `npm run typecheck && npm test && npm run lint` (0 errores); revisar el diff completo; commit `docs(sql): esquema de descuentos`; `git push`.
- [ ] Informar al usuario y preguntar por el PR/merge; tras el despliegue, probar en producción una factura con descuento y anularla.
