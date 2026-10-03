# CLAUDE.md

## Usuario
Manu, programador en el SENIAT, especializado en sistemas informáticos de facturación e impuestos.
Maneja flujos, procesos e implementaciones de Odoo (NO desarrollo ni modificación de su código fuente).
Enfocado actualmente en el desarrollo y mejora de un sistema de gestión de clínica (migrado de JS a TS) y en automatizaciones con Google Apps Script.

## Proyecto (imagen-salud)
- `frontend/`: Next.js 16 + TS estricto. Rutas API en `src/app/api`; auth/RBAC en `src/proxy.ts` y `src/lib/auth.ts`; dinero en `src/lib/money.ts` (centavos enteros, NUNCA float)
- `plantillas_y_scripts/`: plantillas Excel y SQL (`schema_produccion_limpio.sql` = esquema de referencia)
- Rama de trabajo: `claude/clinic-setup-audit-4w37fl`

## Reglas de IA
1. Sé ultraconciso.
2. Al modificar código, muestra solo las líneas cambiadas.
3. Atención milimétrica a cálculos, lógica de facturación y tipado estricto en TS.

## Protocolo
- Responde en español, directo y sin relleno.
- No leas archivos completos sin necesidad; respeta `.claudeignore`.
- Avísame proactivamente cuando convenga `/compact` o `/clear`.
- No hagas commit/push ni PR sin pedírtelo.

## Convenciones
- Tasa BCV: siempre vía `lib/tasaBcv.ts` (automática, sin valores por defecto). Nunca hardcodear tasas.
- Anular factura = `lib/anulacion.ts` (revierte tesorería, idempotente). Estados anulados: `lib/estados.ts`.
- Componentes grandes se dividen en subcarpetas (`components/historial/`, `kanban/`, `admincatalogos/`, ...); el estado queda en el contenedor `Modulo*.tsx`.
- Excel: `lib/excel.ts` (read/write-excel-file). No usar `xlsx` (vulnerable).

## Comandos (en frontend/)
- `npm test` (vitest), `npm run typecheck`, `npm run lint`
- Variables requeridas: ver `frontend/.env.example` (DATABASE_URL, AUTH_SECRET, AUTH_PIN_*)
