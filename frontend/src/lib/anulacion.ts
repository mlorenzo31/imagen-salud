import type { PoolClient } from 'pg';
import { centsToStr, toCents } from '@/lib/money';
import { fechaHoraLocal } from '@/lib/apiHelpers';
import { registrarDevolucion } from '@/lib/devoluciones';
import { MEDIOS_TRANSITO, asegurarMedioTransito, medioValido } from '@/lib/transito';

export interface ResultadoAnulacion {
  revertida: boolean;
  advertencias: string[];
}

interface Ctx { facturaId: number; usuario: string; motivo: string; fecha: string; hora: string }

async function movimiento(client: PoolClient, codigo: string, cents: number, moneda: 'BS' | 'USD', c: Ctx, descripcion: string) {
  if (cents <= 0) return;
  const res = await client.query('SELECT id, saldo_actual FROM cuentas_bancarias WHERE codigo = $1 FOR UPDATE', [codigo]);
  if (res.rows.length === 0) return;
  const cuenta = res.rows[0];
  const ant = toCents(cuenta.saldo_actual);
  // Se aplica aunque deje saldo negativo: el saldo debe reflejar la devolución real que la clínica debe hacer.
  const post = ant - cents;
  await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(post), cuenta.id]);
  await client.query(
    `INSERT INTO movimientos_tesoreria
     (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, factura_id, fecha, hora, usuario)
     VALUES ($1,'ANULACION_FACTURA',$2,$3,0,$2,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [cuenta.id, centsToStr(cents), moneda, centsToStr(ant), centsToStr(post), `ANUL-FACT-${c.facturaId}`, descripcion, c.facturaId, c.fecha, c.hora, c.usuario]
  );
}

/**
 * Revierte los efectos contables de una factura que pasa a anulada. Idempotente: si ya existe un asiento
 * ANULACION_FACTURA para la factura, no hace nada. Debe llamarse dentro de una transacción con la factura bloqueada.
 */
export async function revertirTesoreriaPorAnulacion(client: PoolClient, facturaId: number, usuario: string, motivo: string): Promise<ResultadoAnulacion> {
  const advertencias: string[] = [];
  const ya = await client.query("SELECT 1 FROM movimientos_tesoreria WHERE factura_id = $1 AND tipo = 'ANULACION_FACTURA' LIMIT 1", [facturaId]);
  if (ya.rows.length > 0) return { revertida: false, advertencias };

  const fRes = await client.query('SELECT id, nombre_paciente, pago_punto, pago_movil, pago_efectivo_bs, pago_divisas FROM facturas_caja WHERE id = $1', [facturaId]);
  if (fRes.rows.length === 0) return { revertida: false, advertencias };
  const f = fRes.rows[0];
  const { fecha, hora } = fechaHoraLocal();
  const c: Ctx = { facturaId, usuario, motivo, fecha, hora };
  const quien = `factura ${facturaId} (${f.nombre_paciente})${motivo ? ` — ${motivo}` : ''}`;

  // 1. Honorarios: los pendientes se anulan; los ya pagados requieren recuperación con el médico.
  await client.query("UPDATE honorarios_medicos_pendientes SET estado = 'ANULADO' WHERE factura_id = $1 AND estado = 'PENDIENTE'", [facturaId]);
  const pagados = await client.query("SELECT medico, monto_usd FROM honorarios_medicos_pendientes WHERE factura_id = $1 AND estado = 'PAGADO'", [facturaId]);
  for (const h of pagados.rows) {
    advertencias.push(`Honorario ya liquidado a ${h.medico} ($${centsToStr(toCents(h.monto_usd))}): debe compensarse en su próxima liquidación.`);
  }

  // 2. Punto de venta: pendiente → sale del tránsito; ya conciliado → se debita lo acreditado por el banco.
  await asegurarMedioTransito(client);
  const tarjetas = await client.query('SELECT id, estado, medio, monto_bruto_bs, monto_neto_acreditado_bs FROM transacciones_tarjetas_transito WHERE factura_id = $1 FOR UPDATE', [facturaId]);
  const movilEnTransito = tarjetas.rows.some((t) => t.medio === 'PAGO_MOVIL');
  // El dinero cobrado con POS/pago móvil no se debita aquí: se registra una devolución pendiente que luego se paga como egreso validado.
  for (const t of tarjetas.rows) {
    if (t.estado !== 'PENDIENTE' && t.estado !== 'CONCILIADO') continue;
    const info = MEDIOS_TRANSITO[medioValido(t.medio)];
    const bruto = centsToStr(toCents(t.monto_bruto_bs));
    if (t.estado === 'PENDIENTE') {
      await client.query(
        "UPDATE cuentas_bancarias SET saldo_transito = GREATEST(0, saldo_transito - $1::numeric), actualizado_en = NOW() WHERE codigo = $2",
        [bruto, info.cuenta]
      );
    }
    await client.query("UPDATE transacciones_tarjetas_transito SET estado = 'ANULADO' WHERE id = $1", [t.id]);
    await registrarDevolucion(client, facturaId, medioValido(t.medio), info.cuenta, bruto, t.estado === 'CONCILIADO');
    advertencias.push(`Pago con ${info.etiqueta} de Bs. ${bruto}: quedó registrada la devolución pendiente; debe pagarse como egreso en Tesorería.`);
  }

  // 3. Cobros directos.
  // Pago móvil: si quedó en tránsito ya se revirtió arriba; las facturas anteriores a este esquema se acreditaron directo.
  if (!movilEnTransito && toCents(f.pago_movil) > 0) {
    await registrarDevolucion(client, facturaId, 'PAGO_MOVIL', 'PAGO_MOVIL_BS', centsToStr(toCents(f.pago_movil)), true);
    advertencias.push(`Pago móvil de Bs. ${centsToStr(toCents(f.pago_movil))}: quedó registrada la devolución pendiente; debe pagarse como egreso en Tesorería.`);
  }
  await movimiento(client, 'EFECTIVO_BS', toCents(f.pago_efectivo_bs), 'BS', c, `Reverso de efectivo Bs, ${quien}`);
  await movimiento(client, 'EFECTIVO_USD', toCents(f.pago_divisas), 'USD', c, `Reverso de efectivo USD, ${quien}`);

  return { revertida: true, advertencias };
}
