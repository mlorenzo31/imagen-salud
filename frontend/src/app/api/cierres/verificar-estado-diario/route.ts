import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fechaParam = searchParams.get('fecha');

    // 1. Pacientes en cola sin finalizar (En espera o En atencin)
    let querySala = `
      SELECT 
        id, 
        COALESCE(turno_num, id) as numero_turno, 
        COALESCE(nombre_paciente, 'Paciente #' || id) as paciente_nombre, 
        COALESCE(medico, 'De Guardia') as doctor_nombre, 
        COALESCE(estudio, 'Estudio Clnico') as especialidad, 
        COALESCE(precio_usd, 0) as total_usd, 
        COALESCE(telefono_paciente, '') as telefono_paciente,
        estado, 
        fecha,
        'SALA_ESPERA' as tipo_bloqueo
      FROM facturas_caja
      WHERE estado IN ('ESPERA', 'ATENCION')
    `;
    const paramsSala: any[] = [];
    if (fechaParam) {
      querySala += ' AND fecha = $1 ORDER BY id ASC';
      paramsSala.push(fechaParam);
    } else {
      querySala += ' ORDER BY id ASC';
    }
    const resultSala = await pool.query(querySala, paramsSala);

    // 2. Pacientes culminados con documentos adjuntos pendientes de envo por WhatsApp (Bloqueo Crtico de Cierre)
    let queryWhatsApp = `
      SELECT 
        id, 
        COALESCE(turno_num, id) as numero_turno, 
        COALESCE(nombre_paciente, 'Paciente #' || id) as paciente_nombre, 
        COALESCE(telefono_paciente, '') as telefono_paciente,
        COALESCE(adjunto_nombre, '') as adjunto_nombre,
        COALESCE(medico, 'De Guardia') as doctor_nombre, 
        COALESCE(estudio, 'Estudio Clnico') as especialidad, 
        COALESCE(precio_usd, 0) as total_usd, 
        estado, 
        fecha,
        'WHATSAPP_PENDIENTE' as tipo_bloqueo
      FROM facturas_caja
      WHERE (estado IN ('FINALIZADO', 'COMPLETADO') OR etapa_actual = 2)
        AND (whatsapp_enviado = FALSE OR whatsapp_enviado IS NULL)
        AND adjunto_nombre IS NOT NULL 
        AND TRIM(adjunto_nombre) != ''
    `;
    const paramsWhatsApp: any[] = [];
    if (fechaParam) {
      queryWhatsApp += ' AND fecha = $1 ORDER BY id ASC';
      paramsWhatsApp.push(fechaParam);
    } else {
      queryWhatsApp += ' ORDER BY id ASC';
    }
    const resultWhatsApp = await pool.query(queryWhatsApp, paramsWhatsApp);

    // 3. Resumen contable del da
    let resumenQuery = `
      SELECT 
        COUNT(*) as total_facturas,
        COALESCE(SUM(precio_usd), 0) as total_usd,
        COALESCE(SUM(pago_divisas), 0) as "totalDivisasUSD",
        COALESCE(SUM(pago_efectivo_bs), 0) as "totalEfectivoBs",
        COALESCE(SUM(pago_punto), 0) as "totalPuntoBs",
        COALESCE(SUM(pago_movil), 0) as "totalPagoMovilBs"
      FROM facturas_caja
      WHERE estado NOT IN ('ANULADA', 'ANULADA_SALA')
    `;
    if (fechaParam) {
      resumenQuery += ' AND fecha = $1';
    }
    const resumenRes = await pool.query(resumenQuery, fechaParam ? [fechaParam] : []);

    const hayPacientesSala = resultSala.rows.length > 0;
    const hayWhatsAppPendientes = resultWhatsApp.rows.length > 0;
    const puedeCerrar = !hayPacientesSala && !hayWhatsAppPendientes;

    return NextResponse.json({
      puedeCerrar,
      cierre_pendiente: !puedeCerrar,
      fecha_evaluada: fechaParam || new Date().toISOString().split('T')[0],
      pacientesPendientes: resultSala.rows,
      pacientesWhatsAppPendientes: resultWhatsApp.rows,
      totalWhatsAppPendientes: resultWhatsApp.rows.length,
      resumen: resumenRes.rows[0] || {}
    });
  } catch (err: any) {
    console.error('Error en verificar-estado-diario:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
