# Bot de WhatsApp (Imagen Salud)

Envía los resultados encolados por el sistema (`wa_outbox`). Requiere un equipo siempre encendido con Node 20+.

1. `npm install`
2. `DATABASE_URL="postgresql://…" APP_URL="https://TU-SISTEMA.vercel.app" npm start` (PowerShell: `$env:DATABASE_URL="…"; $env:APP_URL="…"; npm start`). `APP_URL` permite al bot descargar y enviar los archivos.
3. En el sistema (admin) aparece el chip **Vincular WhatsApp**: abrirlo y escanear el QR desde WhatsApp → Dispositivos vinculados.
4. La sesión queda en `./auth` (no subir a git). Si el bot se apaga, el sistema vuelve solo al envío manual por enlace.

Notas: envíos escalonados 4–9 s; use un número dedicado de la clínica (WhatsApp puede restringir números por envío masivo no solicitado).
Estado: `CONECTADO` / `ESPERANDO_QR` / `CONECTANDO` / `APAGADO` (latido > 90 s = apagado).
