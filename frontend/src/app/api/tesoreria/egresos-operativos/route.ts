import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT e.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo 
      FROM egresos_operativos e
      JOIN cuentas_bancarias c ON e.cuenta_id = c.id
      ORDER BY e.id DESC
      LIMIT 100
    `);
    return NextResponse.json(result.rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      cuenta_id, 
      categoria, 
      concepto_libre, 
      monto_neto, 
      comision_bancaria, 
      referencia, 
      descripcion, 
      proveedor_beneficiario, 
      usuario 
    } = body;

    const netoNum = parseFloat(monto_neto);
    const comisionNum = parseFloat(comision_bancaria) || 0;

    if (isNaN(netoNum) || netoNum <= 0) {
      return NextResponse.json({ error: 'El monto neto del egreso debe ser mayor a 0.' }, { status: 400 });
    }
    if (comisionNum < 0) {
      return NextResponse.json({ error: 'La comisión bancaria no puede ser negativa.' }, { status: 400 });
    }

    const totalDebitado = parseFloat((netoNum + comisionNum).toFixed(2));
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const cuentaRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1 FOR UPDATE', [cuenta_id]);
      if (cuentaRes.rows.length === 0) {
        throw new Error('La cuenta bancaria seleccionada no existe.');
      }

      const cuenta = cuentaRes.rows[0];
      const saldoActual = parseFloat(cuenta.saldo_actual);

      if (saldoActual < totalDebitado) {
        throw new Error(`Saldo insuficiente en ${cuenta.nombre}. Disponible: ${saldoActual.toFixed(2)} ${cuenta.moneda}, Requerido: ${totalDebitado.toFixed(2)} ${cuenta.moneda}`);
      }

      const nuevoSaldo = parseFloat((saldoActual - totalDebitado).toFixed(2));
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2', [nuevoSaldo, cuenta_id]);

      const now = new Date();
      const fecha = now.toISOString().slice(0, 10);
      const hora = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });

      const egresoRes = await client.query(`
        INSERT INTO egresos_operativos 
          (cuenta_id, categoria, concepto_libre, monto_neto, comision_bancaria, total_debitado, moneda, referencia, descripcion, proveedor_beneficiario, fecha, hora, usuario)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        cuenta_id,
        categoria,
        concepto_libre || null,
        netoNum,
        comisionNum,
        totalDebitado,
        cuenta.moneda,
        referencia || `EGR-${Date.now().toString().slice(-6)}`,
        descripcion || null,
        proveedor_beneficiario || 'Beneficiario General',
        fecha,
        hora,
        usuario || 'Administrador'
      ]);

      const egreso = egresoRes.rows[0];

      // Asiento 1: Gasto Principal
      const saldoTrasNeto = parseFloat((saldoActual - netoNum).toFixed(2));
      const conceptoPrincipal = `Egreso Operativo [${categoria}]: ${concepto_libre || descripcion || 'Gasto Operativo'} - Beneficiario: ${proveedor_beneficiario || 'General'}`;
      await client.query(`
        INSERT INTO transacciones_bancarias
          (cuenta_id, tipo_transaccion, concepto, monto_debito, monto_credito, saldo_posterior, moneda, referencia, beneficiario, categoria, es_comision, egreso_id, fecha, hora, usuario)
        VALUES ($1, 'EGRESO_OPERATIVO', $2, $3, 0, $4, $5, $6, $7, $8, false, $9, $10, $11, $12)
      `, [
        cuenta_id,
        conceptoPrincipal,
        netoNum,
        saldoTrasNeto,
        cuenta.moneda,
        referencia || `EGR-${Date.now().toString().slice(-6)}`,
        proveedor_beneficiario || 'General',
        categoria,
        egreso.id,
        fecha,
        hora,
        usuario || 'Administrador'
      ]);

      // Asiento 2: Comisión Bancaria (si aplica)
      if (comisionNum > 0) {
        const conceptoComision = `Gasto por Comisión Bancaria - Pago Móvil Ref: ${referencia || egreso.id}`;
        await client.query(`
          INSERT INTO transacciones_bancarias
            (cuenta_id, tipo_transaccion, concepto, monto_debito, monto_credito, saldo_posterior, moneda, referencia, beneficiario, categoria, es_comision, egreso_id, fecha, hora, usuario)
          VALUES ($1, 'COMISION_BANCARIA', $2, $3, 0, $4, $5, $6, 'Banco Emisor', 'Gasto Financiero', true, $7, $8, $9, $10)
        `, [
          cuenta_id,
          conceptoComision,
          comisionNum,
          nuevoSaldo,
          cuenta.moneda,
          referencia || null,
          egreso.id,
          fecha,
          hora,
          usuario || 'Administrador'
        ]);
      }

      await client.query('COMMIT');
      return NextResponse.json({
        mensaje: 'Egreso operativo registrado exitosamente.',
        egreso,
        saldoActualizado: nuevoSaldo
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
