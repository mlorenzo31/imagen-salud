# Plan de salida a producción: facturación fiscal

**Vigencia de la Providencia:** 19/04/2027. **Salida objetivo:** a más tardar el **05/04/2027** (dos semanas de margen).

## Antes de empezar
- **Catálogos → Datos fiscales → "Verificación de salida a producción"** debe estar en verde: sin ningún "Falta".

## Cronograma
| Semana | Actividad | Responsable | Listo cuando |
|---|---|---|---|
| Ene 2027 | Elegir la imprenta digital y contratar su sandbox | Dirección | Contrato y credenciales de prueba |
| Ene–Feb | Adaptador de la imprenta en `lib/fiscal/proveedor.ts` (`emitir` y `registrarContingencia`) | Sistemas | Pruebas unitarias del adaptador |
| Feb | Pedir los talonarios de contingencia (serie y rango de N° de control) y registrarlos | Administración | Talonario en Catálogos → Datos fiscales |
| Feb | Cargar el código de operación de cada estudio y el correo de cada proveedor | Administración | La verificación ya no avisa |
| Mar, sem. 1 | **Pruebas en el sandbox**: `node scripts/prueba-fiscal.mjs --confirmo-ambiente-de-pruebas` | Sistemas | 12/12 pasos correctos con la imprenta real |
| Mar, sem. 2 | Capacitación de taquilla (manual-taquilla.md): cobro, diferir, contingencia, anulación | Administración | Cada cajero hizo un simulacro de contingencia |
| Mar, sem. 3–4 | **Marcha en paralelo**: facturar en sandbox y conciliar a diario con Control Fiscal | Todos | Dos semanas sin diferencias ni rechazos |
| 01/04 | Configurar producción: credenciales reales, `FISCAL_PROVEEDOR=<imprenta>`, fecha de inicio | Sistemas | La verificación sale "Lista para facturar" |
| 01/04 | Enviar la **notificación a la Gerencia Regional** (notificacion-gerencia-regional.md) | Representante legal | Acuse de recibo |
| ≤ 05/04 | **Salida a producción** | Todos | Primera factura real emitida y verificada |
| Hasta el 19/04 | Usar o anular los formatos viejos (Transitoria Primera) | Administración | Acta de anulación y solicitud de destrucción (art. 24, 15 días) |

## Durante la marcha en paralelo, cada día
1. Revisar Control Fiscal: cero cobros "Sin factura", "Rechazada" o "Diferida vencida".
2. Revisar el cuadre: la columna "facturas que no cuadran con sus cobros" debe estar vacía.
3. Comparar el libro de ventas (Libros y reportes) con el portal de la imprenta.
4. Anotar cualquier diferencia y su causa.

## Plan de reversa
Si la imprenta falla de forma sostenida después de la salida:
- **Durante la falla:** activar la contingencia y facturar en talonario. **No** se vuelve al medio anterior.
- **Si la falla supera un día:** contactar al soporte de la imprenta y evaluar el cambio de imprenta.
  - El cambio debe notificarse antes de que la nueva asigne números de control (art. 43).
  - Hay que informar a la nueva imprenta el último N° de control asignado (art. 49).

## Pendientes de decisión
- Condición ante el IVA (ordinario o formal) e IGTF: Catálogos → Datos fiscales.
- Si IVA e ISLR van en comprobantes de retención separados.
- Medio de las notas de crédito de facturas de talonario (art. 12).
