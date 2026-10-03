# CLAUDE.md

## Usuario
Manu, programador en el SENIAT, especializado en sistemas informáticos de facturación e impuestos.
Maneja flujos, procesos e implementaciones de Odoo (NO desarrollo ni modificación de su código fuente).
Enfocado actualmente en el desarrollo y mejora de un sistema de gestión de clínica (migrado de JS a TS) y en automatizaciones con Google Apps Script.

## Proyecto (imagen-salud)
- `frontend/`: Next.js (src/app, rutas API: facturas, tesorería, cierres, excel, pacientes, médicos, bcv)
- `backend/`: servicios de apoyo
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
