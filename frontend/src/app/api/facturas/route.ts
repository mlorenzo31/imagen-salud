import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get('fecha');
    const estado = searchParams.get('estado');
    const cedula = searchParams.get('cedula');
    const busqueda = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '500');

    let q = `
      SELECT 
        fc.*,
        COALESCE(fc.fecha_nacimiento_paciente, p.fecha_nacimiento) as fecha_nacimiento_paciente
      FROM facturas_caja fc
      LEFT JOIN (
        SELECT DISTINCT ON (regexp_replace(cedula, '[^0-9]', '', 'g'))
          regexp_replace(cedula, '[^0-9]', '', 'g') as cedula_clean,
          fecha_nacimiento
        FROM pacientes
      ) p ON regexp_replace(fc.cedula_paciente, '[^0-9]', '', 'g') = p.cedula_clean
      WHERE 1=1
    `;
    const params: any[] = [];

    if (fecha) {
      params.push(fecha);
      q += ' AND fc.fecha = $' + params.length;
    }
    if (estado) {
      params.push(estado);
      q += ' AND fc.estado = $' + params.length;
    }
    if (cedula) {
      const soloNumeros = cedula.replace(/\D/g, '');
      params.push(`%${soloNumeros}%`);
      q += ` AND regexp_replace(fc.cedula_paciente, '[^0-9]', '', 'g') LIKE $` + params.length;
    } else if (busqueda) {
      params.push(`%${busqueda}%`);
      q += ` AND (fc.cedula_paciente ILIKE $${params.length} OR fc.nombre_paciente ILIKE $${params.length} OR fc.estudio ILIKE $${params.length})`;
    }

    q += ` ORDER BY fc.id DESC LIMIT ${isNaN(limit) ? 500 : limit}`;
    const result = await pool.query(q, params);
    return NextResponse.json(result.rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const servicios = Array.isArray(data.servicios) && data.servicios.length > 0 
      ? data.servicios 
      : [{
          estudio: data.estudio || 'Consulta Médica',
          medico: data.medico || 'De Guardia',
          area: data.area || 'GENERAL',
          sala: data.sala || 'SALA_ECO_GINE',
          precioUSD: parseFloat(data.precioUSD) || 0,
          honorariosMedico: parseFloat(data.honorariosMedico) || 0,
          gananciaClinica: (parseFloat(data.precioUSD) || 0) - (parseFloat(data.honorariosMedico) || 0)
        }];

    let totalPrecioUSD = 0;
    let totalHonorarios = 0;
    let totalGanancia = 0;
    const nombresEstudios: string[] = [];
    const medicosUnicos = new Set<string>();

    servicios.forEach((s: any, idx: number) => {
      const pUSD = parseFloat(s.precioUSD || s.precio_usd) || 0;
      let hon = parseFloat(s.honorariosMedico || s.honorarios_medico);
      if (isNaN(hon)) hon = pUSD * 0.70;
      const gan = pUSD - hon;

      s.orden = idx + 1;
      s.precioUSD = pUSD;
      s.honorariosMedico = hon;
      s.gananciaClinica = gan;

      totalPrecioUSD += pUSD;
      totalHonorarios += hon;
      totalGanancia += gan;

      if (s.estudio) nombresEstudios.push(s.estudio);
      if (s.medico) medicosUnicos.add(s.medico);
    });

    const precioFinal = (parseFloat(data.precioUSD) > 0) ? parseFloat(data.precioUSD) : totalPrecioUSD;
    const estudioResumen = (nombresEstudios.join(' + ') || data.estudio || 'CONSULTA MÉDICA').toUpperCase();
    const medicoResumen = (Array.from(medicosUnicos).join(' / ') || data.medico || 'DE GUARDIA').toUpperCase();

    const pagos = data.pagos || {};
    const puntoMonto = parseFloat(pagos.punto || data.pago_punto) || 0;
    const movilMonto = parseFloat(pagos.movil || data.pago_movil) || 0;
    const efecBsMonto = parseFloat(pagos.efectivoBs || data.pago_efectivo_bs) || 0;
    const divisasMonto = parseFloat(pagos.divisasUSD || data.pago_divisas) || 0;
    const fechaActual = data.fecha || new Date().toISOString().slice(0, 10);
    const horaActual = data.hora || new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
    const usuarioResponsable = data.usuario || 'Cajero';

    // Generar turno consecutivo del día si no viene provisto
    let turnoNum = parseInt(data.turnoNum || data.turno_num);
    if (isNaN(turnoNum) || turnoNum <= 0) {
      const tRes = await client.query('SELECT COALESCE(MAX(turno_num), 0) + 1 as prox FROM facturas_caja WHERE fecha = $1', [fechaActual]);
      turnoNum = parseInt(tRes.rows[0].prox) || 1;
    }

    const queryFactura = `
      INSERT INTO facturas_caja 
      (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv, 
       pago_punto, pago_movil, pago_efectivo_bs, pago_divisas, estado, 
       servicios, total_honorarios, total_ganancia, turno_num, etapa_actual,
       telefono_paciente, estudio_principal_id, prioridad, grupo_clinico, fecha_nacimiento_paciente) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) 
      RETURNING *
    `;

    const valuesFactura = [
      fechaActual,
      horaActual,
      data.cedula || data.cedula_paciente,
      (data.nombre || data.nombre_paciente || '').trim().toUpperCase(),
      estudioResumen,
      medicoResumen,
      precioFinal,
      parseFloat(data.tasaBCV || data.tasa_bcv) || 807.39,
      puntoMonto,
      movilMonto,
      efecBsMonto,
      divisasMonto,
      data.estado || 'ESPERA',
      JSON.stringify(servicios),
      totalHonorarios,
      totalGanancia,
      turnoNum,
      parseInt(data.etapaActual || data.etapa_actual) || 0,
      data.telefono_paciente || data.telefono || null,
      data.estudio_principal_id || null,
      data.prioridad || 'NORMAL',
      data.grupo_clinico || 'A',
      data.fecha_nacimiento || data.fecha_nacimiento_paciente || null
    ];

    const resFactura = await client.query(queryFactura, valuesFactura);
    const facturaCreada = resFactura.rows[0];

    // Detalle de servicios
    for (const s of servicios) {
      await client.query(`
        INSERT INTO facturas_servicios_detalle 
        (factura_id, estudio, medico, area, sala, precio_usd, honorarios_medico, ganancia_clinica, estado, orden)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        facturaCreada.id,
        (s.estudio || '').toUpperCase(),
        (s.medico || 'DE GUARDIA').toUpperCase(),
        (s.area || 'GENERAL').toUpperCase(),
        (s.sala || 'SALA_ECO_GINE').toUpperCase(),
        s.precioUSD,
        s.honorariosMedico,
        s.gananciaClinica,
        s.estado || 'ESPERA',
        s.orden
      ]);

      // Causar Honorarios Médicos Pendientes de Liquidación si aplica
      if (s.honorariosMedico > 0 && s.medico && s.medico !== 'De Guardia') {
        await client.query(`
          INSERT INTO honorarios_medicos_pendientes
          (factura_id, fecha_servicio, medico, estudio, paciente, monto_usd, estado)
          VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE')
        `, [
          facturaCreada.id,
          fechaActual,
          s.medico,
          s.estudio,
          facturaCreada.nombre_paciente,
          s.honorariosMedico
        ]);
      }
    }

    // Guardar o actualizar datos del paciente en catálogo
    if (data.cedula && data.nombre) {
      await client.query(`
        INSERT INTO pacientes (cedula, nombre, fecha_nacimiento, direccion, telefono)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (cedula) DO UPDATE 
        SET nombre = EXCLUDED.nombre,
            fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, pacientes.fecha_nacimiento),
            direccion = COALESCE(EXCLUDED.direccion, pacientes.direccion),
            telefono = COALESCE(EXCLUDED.telefono, pacientes.telefono)
      `, [
        data.cedula,
        data.nombre,
        data.fecha_nacimiento || data.fecha_nacimiento_paciente || null,
        data.direccion || null,
        data.telefono || null
      ]);
    }

    // ALIMENTAR TESORERÍA SEGÚN FORMAS DE COBRO
    // 1. Punto de Venta -> A Tránsito
    if (puntoMonto > 0) {
      await client.query(`
        INSERT INTO transacciones_tarjetas_transito
        (factura_id, fecha_transaccion, hora_transaccion, cedula_paciente, nombre_paciente, monto_bruto_bs, estado)
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE')
      `, [facturaCreada.id, fechaActual, horaActual, facturaCreada.cedula_paciente, facturaCreada.nombre_paciente, puntoMonto]);

      await client.query(`
        UPDATE cuentas_bancarias 
        SET saldo_transito = saldo_transito + $1, actualizado_en = NOW()
        WHERE codigo = 'PUNTO_VENTA_BS'
      `, [puntoMonto]);
    }

    // 2. Pago Móvil -> Directo a Saldo Actual de Cuenta Pago Móvil
    if (movilMonto > 0) {
      const cuentaPM = await client.query("SELECT id, saldo_actual FROM cuentas_bancarias WHERE codigo = 'PAGO_MOVIL_BS'");
      if (cuentaPM.rows.length > 0) {
        const cId = cuentaPM.rows[0].id;
        const saldoAnt = parseFloat(cuentaPM.rows[0].saldo_actual) || 0;
        const saldoPost = saldoAnt + movilMonto;
        await client.query("UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2", [saldoPost, cId]);
        await client.query(`
          INSERT INTO movimientos_tesoreria
          (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, factura_id, fecha, hora, usuario)
          VALUES ($1, 'INGRESO_FACTURA', $2, 'BS', 0, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [cId, movilMonto, saldoAnt, saldoPost, `FACT-${facturaCreada.id}`, `Ingreso por factura ${facturaCreada.id} (${facturaCreada.nombre_paciente})`, facturaCreada.id, fechaActual, horaActual, usuarioResponsable]);
      }
    }

    // 3. Efectivo Bolívares -> Saldo Actual de Caja Bs
    if (efecBsMonto > 0) {
      const cuentaEfBs = await client.query("SELECT id, saldo_actual FROM cuentas_bancarias WHERE codigo = 'EFECTIVO_BS'");
      if (cuentaEfBs.rows.length > 0) {
        const cId = cuentaEfBs.rows[0].id;
        const saldoAnt = parseFloat(cuentaEfBs.rows[0].saldo_actual) || 0;
        const saldoPost = saldoAnt + efecBsMonto;
        await client.query("UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2", [saldoPost, cId]);
        await client.query(`
          INSERT INTO movimientos_tesoreria
          (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, factura_id, fecha, hora, usuario)
          VALUES ($1, 'INGRESO_FACTURA', $2, 'BS', 0, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [cId, efecBsMonto, saldoAnt, saldoPost, `FACT-${facturaCreada.id}`, `Ingreso efectivo Bs factura ${facturaCreada.id} (${facturaCreada.nombre_paciente})`, facturaCreada.id, fechaActual, horaActual, usuarioResponsable]);
      }
    }

    // 4. Efectivo Divisas -> Saldo Actual de Caja USD
    if (divisasMonto > 0) {
      const cuentaEfUsd = await client.query("SELECT id, saldo_actual FROM cuentas_bancarias WHERE codigo = 'EFECTIVO_USD'");
      if (cuentaEfUsd.rows.length > 0) {
        const cId = cuentaEfUsd.rows[0].id;
        const saldoAnt = parseFloat(cuentaEfUsd.rows[0].saldo_actual) || 0;
        const saldoPost = saldoAnt + divisasMonto;
        await client.query("UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2", [saldoPost, cId]);
        await client.query(`
          INSERT INTO movimientos_tesoreria
          (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, factura_id, fecha, hora, usuario)
          VALUES ($1, 'INGRESO_FACTURA', $2, 'USD', 0, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [cId, divisasMonto, saldoAnt, saldoPost, `FACT-${facturaCreada.id}`, `Ingreso efectivo USD factura ${facturaCreada.id} (${facturaCreada.nombre_paciente})`, facturaCreada.id, fechaActual, horaActual, usuarioResponsable]);
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({
      mensaje: 'Factura registrada y fondos acreditados en tesorería exitosamente.',
      factura: facturaCreada
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
