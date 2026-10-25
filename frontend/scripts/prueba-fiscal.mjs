#!/usr/bin/env node
/**
 * Prueba integral de la facturación fiscal (Fase 8) contra un servidor en marcha: factura, nota de crédito por
 * anulación, nota de débito y de crédito manuales, reintento de envíos y contingencia completa (activar, cobrar en
 * talonario, cesar y remitir). Pensada para el sandbox de la imprenta y la marcha en paralelo.
 *
 * CREA COBROS, DOCUMENTOS Y UN TALONARIO DE PRUEBA: úsela solo en un ambiente de pruebas.
 *
 *   PRUEBA_URL=http://localhost:3000 PRUEBA_USUARIO=admin PRUEBA_CLAVE=... \
 *     node scripts/prueba-fiscal.mjs --confirmo-ambiente-de-pruebas
 */
const URL_BASE = process.env.PRUEBA_URL ?? 'http://localhost:3000';
const USUARIO = process.env.PRUEBA_USUARIO ?? 'admin';
const CLAVE = process.env.PRUEBA_CLAVE;

if (!process.argv.includes('--confirmo-ambiente-de-pruebas') || !CLAVE) {
  console.error('Uso: PRUEBA_CLAVE=... node scripts/prueba-fiscal.mjs --confirmo-ambiente-de-pruebas (solo en un ambiente de pruebas).');
  process.exit(2);
}

let cookie = '';
const resultados = [];

async function api(ruta, metodo = 'GET', cuerpo) {
  const r = await fetch(URL_BASE + ruta, {
    method: metodo,
    headers: { 'content-type': 'application/json', cookie },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let json;
  try { json = JSON.parse(texto); } catch { json = texto; }
  return { ok: r.ok, status: r.status, json };
}

async function paso(nombre, fn) {
  try {
    const detalle = await fn();
    resultados.push({ nombre, ok: true, detalle });
    console.log(`✔ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  } catch (e) {
    resultados.push({ nombre, ok: false, detalle: e.message });
    console.log(`✘ ${nombre} — ${e.message}`);
  }
}

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

const cedula = () => `V${10000000 + Math.floor(Math.random() * 9e6)}`;
const cobro = (extra = {}) => ({
  hora: '10:00:00', cedula_paciente: cedula(), nombre_paciente: 'PRUEBA FISCAL', fecha_nacimiento: '1990-01-01', sexo: 'F',
  telefono_paciente: '04140000000', direccion_paciente: 'PRUEBA', precio_usd: 20, tasa_bcv: 0, pago_divisas: 20, pago_punto: 0,
  pago_movil: 0, pago_efectivo_bs: 0, estado: 'ESPERA', ...extra,
});

const sesion = await fetch(URL_BASE + '/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: USUARIO, clave: CLAVE }),
});
if (!sesion.ok) { console.error('No se pudo iniciar sesión:', await sesion.text()); process.exit(1); }
cookie = sesion.headers.get('set-cookie')?.split(';')[0] ?? '';

// Datos para cobrar: tasa BCV vigente y un estudio del catálogo.
const tasa = (await api('/api/bcv')).json?.tasa;
const estudios = (await api('/api/catalogo/estudios?lista=1')).json;
const estudio = (estudios?.estudios ?? []).find((e) => e.activo !== false && Number(e.precio_usd) > 0);
if (!tasa || !estudio) { console.error('Falta la tasa BCV o un estudio activo en el catálogo.'); process.exit(1); }
const precio = Number(estudio?.precio_usd);
const servicio = { area: estudio.area, estudio: estudio.nombre, medico: 'PRUEBA', precioUSD: precio, sala: estudio.sala_defecto ?? 'SALA', codigo: estudio.codigo };
const nuevoCobro = (extra) => api('/api/facturas', 'POST', cobro({ tasa_bcv: Number(tasa), precio_usd: precio, pago_divisas: precio, servicios: [servicio], ...extra }));

let factura;
await paso('Factura al cobrar', async () => {
  const r = await nuevoCobro();
  exigir(r.ok, JSON.stringify(r.json));
  factura = r.json;
  exigir(r.json.fiscal?.estado === 'EMITIDO', `estado ${r.json.fiscal?.estado}: ${r.json.fiscal?.error ?? ''}`);
  return `N° ${r.json.fiscal.numero} · control ${r.json.fiscal.numeroControl}`;
});

await paso('Nota de débito manual', async () => {
  exigir(factura?.fiscal?.documentoId, 'sin factura emitida');
  const r = await api('/api/fiscal/notas', 'POST', { documentoId: factura.fiscal.documentoId, tipo: 'NOTA_DEBITO', montoUsd: '2', motivo: 'Prueba integral: ajuste al alza', pin: CLAVE });
  exigir(r.ok && r.json.estado === 'EMITIDO', JSON.stringify(r.json));
  return `${r.json.denominacion} ${r.json.numero}`;
});

await paso('Nota de crédito parcial manual', async () => {
  const r = await api('/api/fiscal/notas', 'POST', { documentoId: factura.fiscal.documentoId, tipo: 'NOTA_CREDITO', montoUsd: '1', motivo: 'Prueba integral: ajuste a la baja', pin: CLAVE });
  exigir(r.ok && r.json.estado === 'EMITIDO', JSON.stringify(r.json));
  return `${r.json.denominacion} ${r.json.numero}`;
});

await paso('Anulación con nota de crédito', async () => {
  const c = await nuevoCobro();
  exigir(c.ok && c.json.fiscal?.estado === 'EMITIDO', 'el cobro no quedó facturado');
  const r = await api(`/api/facturas/${c.json.factura.id}/estado`, 'PUT', { estado: 'ANULADA', motivo_anulacion: 'Prueba integral de anulación' });
  exigir(r.ok, JSON.stringify(r.json));
  exigir(!(r.json.advertencias_anulacion ?? []).length, (r.json.advertencias_anulacion ?? []).join(' '));
  return `cobro #${c.json.factura.id} anulado`;
});

await paso('Reintento de envíos pendientes', async () => {
  const r = await api('/api/fiscal/pendientes', 'POST');
  exigir(r.ok, JSON.stringify(r.json));
  return JSON.stringify(r.json.procesados);
});

// Contingencia: talonario de prueba con un rango alto para no chocar con talonarios reales.
const base = 90_000_000 + Math.floor(Math.random() * 9_000_000);
const control = (n) => `99-${String(n).padStart(8, '0')}`;
await paso('Registrar talonario de prueba', async () => {
  const r = await api('/api/admin/fiscal/talonarios', 'POST', {
    serie: `P${String(base).slice(-3)}`, imprentaRazonSocial: 'IMPRENTA DE PRUEBA C.A.', imprentaRif: 'J000000000',
    imprentaProvidencia: 'PRUEBA', imprentaFechaProvidencia: '2027-01-01', fechaElaboracion: '2027-01-01',
    controlDesde: control(base), controlHasta: control(base + 9), facturaDesde: 1, facturaHasta: 10,
  });
  exigir(r.ok, JSON.stringify(r.json));
  return `${control(base)} a ${control(base + 9)}`;
});

await paso('Activar contingencia', async () => {
  const r = await api('/api/fiscal/contingencia', 'POST', { accion: 'ACTIVAR', motivo: 'INTERNET', observacion: 'Prueba integral', pin: CLAVE });
  exigir(r.ok, JSON.stringify(r.json));
  return r.json.accion;
});

await paso('Cobro en contingencia sin N° de control es rechazado', async () => {
  const r = await nuevoCobro();
  exigir(r.status === 400, `respuesta ${r.status}`);
});

await paso('Cobro en talonario', async () => {
  const r = await nuevoCobro({ contingencia_control: control(base) });
  exigir(r.ok && r.json.fiscal?.estado === 'CONTINGENCIA', JSON.stringify(r.json.fiscal ?? r.json));
  return `serie ${r.json.fiscal.serie} N° ${r.json.fiscal.numero}`;
});

await paso('N° de control repetido es rechazado', async () => {
  const r = await nuevoCobro({ contingencia_control: control(base) });
  exigir(r.status === 400, `respuesta ${r.status}`);
});

await paso('Cesar contingencia', async () => {
  const r = await api('/api/fiscal/contingencia', 'POST', { accion: 'CERRAR', pin: CLAVE });
  exigir(r.ok, JSON.stringify(r.json));
  return `remitir el ${r.json.plazoEnvio}`;
});

await paso('Remitir contingencia a la imprenta (art. 7)', async () => {
  const r = await api('/api/fiscal/contingencia-envio', 'POST');
  exigir(r.ok && r.json.estado === 'ENVIADA', JSON.stringify(r.json));
  return `${r.json.documentos} documento(s)`;
});

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} pasos correctos.`);
process.exit(fallidos.length ? 1 : 0);
