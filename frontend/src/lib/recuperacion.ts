/** Versión mínima del bot de WhatsApp que entrega mensajes del sistema (códigos) sin pasar por la cola de campañas. */
export const VERSION_WORKER_SISTEMA = 3;
export const CODIGO_VIGENCIA_MIN = 10;
export const CODIGO_MAX_INTENTOS = 5;
export const MENSAJE_GENERICO = 'Si el usuario existe y tiene un WhatsApp registrado, recibirá un código en unos instantes.';

export const mensajeCodigo = (codigo: string): string =>
  `*Imagen Salud*\nSu código para recuperar la clave es: *${codigo}*\nVence en ${CODIGO_VIGENCIA_MIN} minutos. Si usted no lo solicitó, ignore este mensaje y no lo comparta.`;
