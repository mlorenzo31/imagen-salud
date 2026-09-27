import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      cuenta_origen_id, 
      monto_bs_base, 
      tasa_cambio_manual, 
      comision_bancaria_bs, 
      referencia, 
      notas, 
      usuario 
    } = body;

    const bsNum = parseFloat(monto_bs_base);
    const tasaNum = parseFloat(tasa_cambio_manual);
    const comisionNum = parseFloat(comision_bancaria_bs) || 0;

    if (isNaN(bsNum) || bsNum <= 0) return NextResponse.json({ error: 'Monto base en Bs inválido.' }, { status: 400 });
    if (isNaN(tasaNum) || tasaNum <= 0) return NextResponse.json({ error: 'Tasa de cambio inválida.' }, { status: 400 });

    const totalDebitarBs = parseFloat((bsNum + comisionNum).toFixed(2));
    const totalAcreditarUsd = parseFloat((bsNum / tasaNum).toFixed(2));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Debitar cuenta de origen en Bs
      const cuentaOrigenRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1 FOR UPDATE', [cuenta_origen_id]);
      if (cuentaOrigenRes.rows.length === 0) throw new Error('Cuenta origen no encontrada.');
      const cuentaOrigen = cuentaOrigenRes.rows[0];
      const saldoBsActual = parseFloat(cuentaOrigen.saldo_actual);

      if (saldoBsActual < totalDebitarBs) {
        throw new Error(`Saldo insuficiente en ${cuentaOrigen.nombre}. Disponible: ${saldoBsActual.toFixed(2)} Bs`);
      }

      const nuevoSaldoBs = parseFloat((saldoBsActual - totalDebitarBs).toFixed(2));
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2', [nuevoSaldoBs, cuenta_origen_id]);

      // Acreditar cuenta de Efectivo Divisas (id = 1)
      const cuentaUsdRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = 1 FOR UPDATE');
      const saldoUsdActual = parseFloat(cuentaUsdRes.rows[0].saldo_actual);
      const nuevoSaldoUsd = parseFloat((saldoUsdActual + totalAcreditarUsd).toFixed(2));
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = 1', [nuevoSaldoUsd]);

      await client.query('COMMIT');
      return NextResponse.json({
        mensaje: 'Operación cambiaria completada exitosamente.',
        totalDebitadoBs: totalDebitarBs,
        totalAcreditadoUsd: totalAcreditarUsd,
        nuevoSaldoBs,
        nuevoSaldoUsd
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: err.message }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
