# Bot de WhatsApp (Imagen Salud)

Envía los resultados encolados por el sistema (`wa_outbox`). Requiere un equipo siempre encendido con Node 20+.

1. `npm install`
2. `DATABASE_URL="postgresql://…" npm start` (PowerShell: `$env:DATABASE_URL="…"; npm start`). `APP_URL` ya no es necesaria: la cola trae la dirección de los archivos.
3. En el sistema (admin) aparece el chip **Vincular WhatsApp**: abrirlo y escanear el QR desde WhatsApp → Dispositivos vinculados.
3b. Desde el mismo chip, el administrador (con su clave) puede **Generar QR nuevo** o **Desvincular**. Si se quita la vinculación desde el teléfono, el bot limpia `./auth` y muestra un QR nuevo solo; ya no hay que borrar carpetas. El bot debe estar en ejecución para atender estas órdenes.
4. La sesión queda en `./auth` (no subir a git). Si el bot se apaga, el sistema vuelve solo al envío manual por enlace.

Notas: envíos escalonados 4–9 s; use un número dedicado de la clínica (WhatsApp puede restringir números por envío masivo no solicitado).
Estado: `CONECTADO` / `ESPERANDO_QR` / `CONECTANDO` / `APAGADO` (latido > 90 s = apagado).
