require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a base de datos (credenciales solo por variables de entorno)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL no está definida. Configúrala en backend/.env (ver .env.example).');
  process.exit(1);
}
const sslCa = process.env.DATABASE_SSL_CA && process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n');
const pool = new Pool({
  connectionString,
  ssl: sslCa ? { ca: sslCa, rejectUnauthorized: true } : { rejectUnauthorized: false }
});

// Middleware de protección para rol Administrador
function verificarRolAdmin(req, res, next) {
  const rol = req.headers['x-user-rol'] || req.headers['x-user-role'] || (req.body && req.body.rol) || (req.query && req.query.rol);
  if (rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Esta función contable es exclusiva para el rol de Administrador.' });
  }
  next();
}

// -----------------------------------------------------------------------------
// ENDPOINTS PACIENTES Y FACTURAS
// -----------------------------------------------------------------------------

// Endpoint para consultar pacientes
app.get('/api/pacientes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pacientes ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para consultar facturas
app.get('/api/facturas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM facturas_caja ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para registrar facturas multiservicio y alimentar Tesorería y Honorarios
app.post('/api/facturas', async (req, res) => {
  const data = req.body;
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
    const nombresEstudios = [];
    const medicosUnicos = new Set();

    servicios.forEach((s, idx) => {
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
    const estudioResumen = nombresEstudios.join(' + ') || data.estudio || 'Consulta Médica';
    const medicoResumen = Array.from(medicosUnicos).join(' / ') || data.medico || 'De Guardia';

    const queryFactura = `
      INSERT INTO facturas_caja 
      (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv, 
       pago_punto, pago_movil, pago_efectivo_bs, pago_divisas, estado, 
       servicios, total_honorarios, total_ganancia, turno_num, etapa_actual,
       telefono_paciente, estudio_principal_id, prioridad, grupo_clinico) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) 
      RETURNING *
    `;

    const pagos = data.pagos || {};
    const puntoMonto = parseFloat(pagos.punto || data.pago_punto) || 0;
    const movilMonto = parseFloat(pagos.movil || data.pago_movil) || 0;
    const efecBsMonto = parseFloat(pagos.efectivoBs || data.pago_efectivo_bs) || 0;
    const divisasMonto = parseFloat(pagos.divisasUSD || data.pago_divisas) || 0;
    const fechaActual = data.fecha || new Date().toISOString().slice(0, 10);
    const horaActual = data.hora || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const usuarioResponsable = data.usuario || 'Cajero';

    const valuesFactura = [
      fechaActual,
      horaActual,
      data.cedula || data.cedula_paciente,
      data.nombre || data.nombre_paciente,
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
      parseInt(data.turnoNum || data.turno_num) || null,
      parseInt(data.etapaActual || data.etapa_actual) || 0,
      data.telefono_paciente || data.telefono || null,
      data.estudio_principal_id || null,
      data.prioridad || 'NORMAL',
      data.grupo_clinico || 'A'
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
        s.estudio,
        s.medico || 'De Guardia',
        s.area || 'GENERAL',
        s.sala || 'SALA_ECO_GINE',
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

    // ALIMENTAR TESORERÍA SEGÚN FORMAS DE COBRO
    // 1. Punto de Venta -> A Tránsito (Pendiente de Acreditación Bancaria)
    if (puntoMonto > 0) {
      await client.query(`
        INSERT INTO transacciones_tarjetas_transito
        (factura_id, fecha_transaccion, hora_transaccion, cedula_paciente, nombre_paciente, monto_bruto_bs, estado)
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE')
      `, [
        facturaCreada.id,
        fechaActual,
        horaActual,
        facturaCreada.cedula_paciente,
        facturaCreada.nombre_paciente,
        puntoMonto
      ]);

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

    // 4. Efectivo Divisas ($) -> Saldo Actual de Caja USD
    if (divisasMonto > 0) {
      const cuentaUSD = await client.query("SELECT id, saldo_actual FROM cuentas_bancarias WHERE codigo = 'EFECTIVO_USD'");
      if (cuentaUSD.rows.length > 0) {
        const cId = cuentaUSD.rows[0].id;
        const saldoAnt = parseFloat(cuentaUSD.rows[0].saldo_actual) || 0;
        const saldoPost = saldoAnt + divisasMonto;
        await client.query("UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2", [saldoPost, cId]);
        await client.query(`
          INSERT INTO movimientos_tesoreria
          (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, factura_id, fecha, hora, usuario)
          VALUES ($1, 'INGRESO_FACTURA', $2, 'USD', 0, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [cId, divisasMonto, saldoAnt, saldoPost, `FACT-${facturaCreada.id}`, `Ingreso divisas factura ${facturaCreada.id} (${facturaCreada.nombre_paciente})`, facturaCreada.id, fechaActual, horaActual, usuarioResponsable]);
      }
    }

    await client.query('COMMIT');
    res.json(facturaCreada);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error al registrar factura:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Endpoint para actualizar estado de factura
app.put('/api/facturas/:id/estado', async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = [
      'estado', 'etapa_actual', 'motivo_anulacion', 'estudio_principal_id',
      'prioridad', 'retorno_sala', 'sala_anterior', 'adjunto_nombre',
      'adjunto_url', 'adjunto_tipo', 'whatsapp_enviado', 'whatsapp_fecha_envio',
      'telefono_paciente'
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ${idx}`);
        values.push(body[key]);
        idx++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE facturas_caja SET ${fields.join(', ')} WHERE id = ${idx} RETURNING *`;

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// MÓDULO DE TESORERÍA, CONCILIACIÓN, CAMBIO Y HONORARIOS (SOLO ADMIN)
// -----------------------------------------------------------------------------

// 1. Consultar cuentas de tesorería y saldos
app.get('/api/tesoreria/cuentas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cuentas_bancarias ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Consultar movimientos del libro mayor de tesorería con filtros
app.get('/api/tesoreria/movimientos', async (req, res) => {
  try {
    const { desde, hasta, cuenta_id, tipo } = req.query;
    let query = `
      SELECT m.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo 
      FROM movimientos_tesoreria m
      JOIN cuentas_bancarias c ON m.cuenta_id = c.id
      WHERE 1=1
    `;
    const values = [];

    if (desde) {
      values.push(desde);
      query += ` AND m.fecha >= $${values.length}`;
    }
    if (hasta) {
      values.push(hasta);
      query += ` AND m.fecha <= $${values.length}`;
    }
    if (cuenta_id) {
      values.push(cuenta_id);
      query += ` AND m.cuenta_id = $${values.length}`;
    }
    if (tipo) {
      values.push(tipo);
      query += ` AND m.tipo = $${values.length}`;
    }

    query += ' ORDER BY m.id DESC';
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Consultar transacciones de tarjetas en tránsito (para alerta persistente de arqueo)
app.get('/api/tesoreria/conciliacion/pendientes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM transacciones_tarjetas_transito 
      WHERE estado = 'PENDIENTE' 
      ORDER BY fecha_transaccion ASC, id ASC
    `);

    let totalPendienteBs = 0;
    result.rows.forEach(r => { totalPendienteBs += parseFloat(r.monto_bruto_bs) || 0; });

    res.json({
      totalPendienteBs,
      cantidadPendiente: result.rows.length,
      transacciones: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Ejecutar conciliación bancaria de tarjetas con registro de comisión
app.post('/api/tesoreria/conciliacion/ejecutar', verificarRolAdmin, async (req, res) => {
  const { transaccion_ids, monto_neto_acreditado_bs, comision_bancaria_bs, fecha_acreditacion, referencia, conciliado_por } = req.body;
  
  if (!Array.isArray(transaccion_ids) || transaccion_ids.length === 0) {
    return res.status(400).json({ error: 'Debe seleccionar al menos una transacción para conciliar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener monto bruto total de las transacciones seleccionadas
    const transRes = await client.query(`
      SELECT id, monto_bruto_bs FROM transacciones_tarjetas_transito 
      WHERE id = ANY($1::int[]) AND estado = 'PENDIENTE'
    `, [transaccion_ids]);

    if (transRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Las transacciones seleccionadas ya fueron conciliadas o no existen.' });
    }

    let totalBrutoBs = 0;
    transRes.rows.forEach(r => { totalBrutoBs += parseFloat(r.monto_bruto_bs) || 0; });

    const montoNeto = parseFloat(monto_neto_acreditado_bs) || (totalBrutoBs - (parseFloat(comision_bancaria_bs) || 0));
    const comision = parseFloat(comision_bancaria_bs) || (totalBrutoBs - montoNeto);
    const fechaAcred = fecha_acreditacion || new Date().toISOString().slice(0, 10);
    const usuario = conciliado_por || 'Administrador';

    // Actualizar las transacciones a CONCILIADO
    await client.query(`
      UPDATE transacciones_tarjetas_transito
      SET estado = 'CONCILIADO',
          monto_neto_acreditado_bs = $1,
          comision_bancaria_bs = $2,
          fecha_acreditacion = $3,
          referencia_bancaria = $4,
          conciliado_por = $5,
          conciliado_en = NOW()
      WHERE id = ANY($6::int[])
    `, [montoNeto, comision, fechaAcred, referencia || 'CONCILIACION', usuario, transaccion_ids]);

    // Actualizar cuentas_bancarias (Punto de Venta)
    const cuentaPV = await client.query("SELECT id, saldo_actual, saldo_transito FROM cuentas_bancarias WHERE codigo = 'PUNTO_VENTA_BS'");
    if (cuentaPV.rows.length > 0) {
      const cId = cuentaPV.rows[0].id;
      const saldoActAnt = parseFloat(cuentaPV.rows[0].saldo_actual) || 0;
      const saldoTransAnt = parseFloat(cuentaPV.rows[0].saldo_transito) || 0;

      const nuevoSaldoTrans = Math.max(0, saldoTransAnt - totalBrutoBs);
      const nuevoSaldoActual = saldoActAnt + montoNeto;

      await client.query(`
        UPDATE cuentas_bancarias
        SET saldo_transito = $1, saldo_actual = $2, actualizado_en = NOW()
        WHERE id = $3
      `, [nuevoSaldoTrans, nuevoSaldoActual, cId]);

      // Registrar movimiento de acreditación neta
      await client.query(`
        INSERT INTO movimientos_tesoreria
        (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
        VALUES ($1, 'CONCILIACION_TARJETA', $2, 'BS', $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        cId,
        totalBrutoBs,
        comision,
        montoNeto,
        saldoActAnt,
        nuevoSaldoActual,
        referencia || 'CONC-POS',
        `Acreditación bancaria neta de ${transRes.rows.length} transacciones de tarjeta. Bruto: Bs. ${totalBrutoBs.toFixed(2)}, Comisión retenida: Bs. ${comision.toFixed(2)}`,
        fechaAcred,
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        usuario
      ]);
    }

    await client.query('COMMIT');
    res.json({
      mensaje: 'Conciliación ejecutada exitosamente.',
      transaccionesConciliadas: transRes.rows.length,
      totalBrutoBs,
      montoNetoAcreditadoBs: montoNeto,
      comisionBancariaBs: comision
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error en conciliación:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 5. Módulo de Compra de Divisas (Cobertura Antidevaluación)
app.post('/api/tesoreria/cambio-divisa', verificarRolAdmin, async (req, res) => {
  const { cuenta_origen_id, monto_bs_base, tasa_cambio_manual, comision_bancaria_bs, referencia, notas, usuario } = req.body;

  const bsBase = parseFloat(monto_bs_base);
  const tasa = parseFloat(tasa_cambio_manual);
  const comision = parseFloat(comision_bancaria_bs) || 0;

  if (isNaN(bsBase) || bsBase <= 0 || isNaN(tasa) || tasa <= 0) {
    return res.status(400).json({ error: 'Monto base en Bs y tasa de cambio deben ser valores numéricos mayores a 0.' });
  }

  const totalDebitadoBs = bsBase + comision;
  const montoUsdIngreso = parseFloat((bsBase / tasa).toFixed(2));
  const fechaOp = new Date().toISOString().slice(0, 10);
  const horaOp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const user = usuario || 'Administrador';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar cuenta origen
    const cOrigenRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1', [cuenta_origen_id]);
    if (cOrigenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta origen no encontrada.' });
    }
    const cOrigen = cOrigenRes.rows[0];
    const saldoOrigenAnt = parseFloat(cOrigen.saldo_actual) || 0;

    if (saldoOrigenAnt < totalDebitadoBs) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Saldo insuficiente en la cuenta ${cOrigen.nombre}. Saldo actual: Bs. ${saldoOrigenAnt.toFixed(2)}, Requerido: Bs. ${totalDebitadoBs.toFixed(2)}` 
      });
    }

    // Cuenta destino (Efectivo Divisas USD)
    const cDestinoRes = await client.query("SELECT * FROM cuentas_bancarias WHERE codigo = 'EFECTIVO_USD'");
    if (cDestinoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: "Cuenta 'Efectivo Divisas ($)' no encontrada." });
    }
    const cDestino = cDestinoRes.rows[0];
    const saldoDestinoAnt = parseFloat(cDestino.saldo_actual) || 0;

    // Registrar en operaciones_cambiarias
    const opRes = await client.query(`
      INSERT INTO operaciones_cambiarias
      (cuenta_origen_id, monto_bs_base, tasa_cambio_manual, comision_bancaria_bs, monto_total_debitado_bs, monto_usd_ingreso, fecha, referencia, notas, usuario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [cOrigen.id, bsBase, tasa, comision, totalDebitadoBs, montoUsdIngreso, fechaOp, referencia || 'CAMBIO-USD', notas || '', user]);
    const op = opRes.rows[0];

    // Actualizar saldos
    const saldoOrigenPost = saldoOrigenAnt - totalDebitadoBs;
    const saldoDestinoPost = saldoDestinoAnt + montoUsdIngreso;

    await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [saldoOrigenPost, cOrigen.id]);
    await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [saldoDestinoPost, cDestino.id]);

    // Movimiento Débito en Cuenta Origen (Bs)
    await client.query(`
      INSERT INTO movimientos_tesoreria
      (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, operacion_cambiaria_id, fecha, hora, usuario)
      VALUES ($1, 'CAMBIO_DIVISA_EGRESO', $2, 'BS', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      cOrigen.id,
      bsBase,
      comision,
      totalDebitadoBs,
      saldoOrigenAnt,
      saldoOrigenPost,
      referencia || `CAMBIO-${op.id}`,
      `Compra de $${montoUsdIngreso} USD a tasa ${tasa} Bs/$. Comisión bancaria: Bs. ${comision.toFixed(2)}`,
      op.id,
      fechaOp,
      horaOp,
      user
    ]);

    // Movimiento Crédito en Cuenta Destino (USD)
    await client.query(`
      INSERT INTO movimientos_tesoreria
      (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, operacion_cambiaria_id, fecha, hora, usuario)
      VALUES ($1, 'CAMBIO_DIVISA_INGRESO', $2, 'USD', 0, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      cDestino.id,
      montoUsdIngreso,
      saldoDestinoAnt,
      saldoDestinoPost,
      referencia || `CAMBIO-${op.id}`,
      `Ingreso por compra de divisas de cobertura cambiaria (Origen: ${cOrigen.nombre})`,
      op.id,
      fechaOp,
      horaOp,
      user
    ]);

    await client.query('COMMIT');
    res.json({
      mensaje: 'Operación cambiaria completada exitosamente.',
      operacion: op,
      saldoOrigenActualizado: saldoOrigenPost,
      saldoDivisasActualizado: saldoDestinoPost
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error en cambio de divisa:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 6. Consultar honorarios médicos pendientes por doctor y fecha
app.get('/api/tesoreria/honorarios/pendientes', async (req, res) => {
  try {
    const { medico, fecha, fecha_desde, fecha_hasta } = req.query;
    let query = `
      SELECT h.*, f.tasa_bcv 
      FROM honorarios_medicos_pendientes h
      JOIN facturas_caja f ON h.factura_id = f.id
      WHERE h.estado = 'PENDIENTE'
    `;
    const values = [];

    if (medico && medico !== 'TODOS') {
      values.push(medico);
      query += ` AND h.medico = $${values.length}`;
    }
    if (fecha) {
      values.push(fecha);
      query += ` AND h.fecha_servicio = $${values.length}`;
    }
    if (fecha_desde) {
      values.push(fecha_desde);
      query += ` AND h.fecha_servicio >= $${values.length}`;
    }
    if (fecha_hasta) {
      values.push(fecha_hasta);
      query += ` AND h.fecha_servicio <= $${values.length}`;
    }

    query += ' ORDER BY h.fecha_servicio ASC, h.id ASC';
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Liquidación de Honorarios Médicos Multiforma Simultáneo con Comisiones
app.post('/api/tesoreria/honorarios/liquidar', verificarRolAdmin, async (req, res) => {
  const { 
    medico, 
    honorarios_ids, 
    dias_liquidados, 
    total_usd_liquidado, 
    tasa_cambio_bcv,
    pago_movil_bs, 
    comision_pago_movil_bs, 
    efectivo_bs, 
    efectivo_usd, 
    referencia, 
    observaciones, 
    usuario 
  } = req.body;

  if (!Array.isArray(honorarios_ids) || honorarios_ids.length === 0) {
    return res.status(400).json({ error: 'Debe seleccionar al menos un honorario para liquidar.' });
  }

  const pMovil = parseFloat(pago_movil_bs) || 0;
  const comisionPM = parseFloat(comision_pago_movil_bs) || 0;
  const efBs = parseFloat(efectivo_bs) || 0;
  const efUsd = parseFloat(efectivo_usd) || 0;
  const tBCV = parseFloat(tasa_cambio_bcv) || 807.39;
  const fechaHoy = new Date().toISOString().slice(0, 10);
  const horaHoy = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const user = usuario || 'Administrador';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar que los honorarios existan y sigan pendientes
    const honRes = await client.query(`
      SELECT id, monto_usd FROM honorarios_medicos_pendientes
      WHERE id = ANY($1::int[]) AND estado = 'PENDIENTE'
    `, [honorarios_ids]);

    if (honRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Los honorarios seleccionados ya fueron pagados o no existen.' });
    }

    let sumaUsdPendiente = 0;
    honRes.rows.forEach(r => { sumaUsdPendiente += parseFloat(r.monto_usd) || 0; });

    // 2. Validar saldos en cuentas a debitar
    // Cuenta Pago Móvil
    let cPM = null;
    if (pMovil > 0 || comisionPM > 0) {
      const pmRes = await client.query("SELECT * FROM cuentas_bancarias WHERE codigo = 'PAGO_MOVIL_BS'");
      cPM = pmRes.rows[0];
      const totalDebPM = pMovil + comisionPM;
      if (parseFloat(cPM.saldo_actual) < totalDebPM) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Saldo insuficiente en Pago Móvil. Saldo actual: Bs. ${parseFloat(cPM.saldo_actual).toFixed(2)}, Requerido (pago + comisión): Bs. ${totalDebPM.toFixed(2)}` });
      }
    }

    // Cuenta Efectivo Bs
    let cEfBs = null;
    if (efBs > 0) {
      const efBsRes = await client.query("SELECT * FROM cuentas_bancarias WHERE codigo = 'EFECTIVO_BS'");
      cEfBs = efBsRes.rows[0];
      if (parseFloat(cEfBs.saldo_actual) < efBs) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Saldo insuficiente en Efectivo Bolívares. Saldo actual: Bs. ${parseFloat(cEfBs.saldo_actual).toFixed(2)}, Requerido: Bs. ${efBs.toFixed(2)}` });
      }
    }

    // Cuenta Efectivo Divisas USD
    let cEfUsd = null;
    if (efUsd > 0) {
      const efUsdRes = await client.query("SELECT * FROM cuentas_bancarias WHERE codigo = 'EFECTIVO_USD'");
      cEfUsd = efUsdRes.rows[0];
      if (parseFloat(cEfUsd.saldo_actual) < efUsd) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Saldo insuficiente en Efectivo Divisas. Saldo actual: $${parseFloat(cEfUsd.saldo_actual).toFixed(2)}, Requerido: $${efUsd.toFixed(2)}` });
      }
    }

    // 3. Crear registro maestro en pagos_honorarios
    const pagoRes = await client.query(`
      INSERT INTO pagos_honorarios
      (medico, fecha_pago, dias_liquidados, total_usd_liquidado, tasa_cambio_bcv, pago_movil_bs, comision_pago_movil_bs, efectivo_bs, efectivo_usd, referencia, observaciones, usuario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      medico,
      fechaHoy,
      dias_liquidados || '',
      parseFloat(total_usd_liquidado) || sumaUsdPendiente,
      tBCV,
      pMovil,
      comisionPM,
      efBs,
      efUsd,
      referencia || `HON-${Date.now()}`,
      observaciones || '',
      user
    ]);
    const pago = pagoRes.rows[0];

    // 4. Marcar honorarios como PAGADOS
    await client.query(`
      UPDATE honorarios_medicos_pendientes
      SET estado = 'PAGADO', pago_id = $1
      WHERE id = ANY($2::int[])
    `, [pago.id, honorarios_ids]);

    // 5. Aplicar débitos a las cuentas y asentar en movimientos_tesoreria
    // A. Débito Pago Móvil
    if (cPM && (pMovil > 0 || comisionPM > 0)) {
      const totalDebPM = pMovil + comisionPM;
      const sAnt = parseFloat(cPM.saldo_actual) || 0;
      const sPost = sAnt - totalDebPM;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [sPost, cPM.id]);
      await client.query(`
        INSERT INTO movimientos_tesoreria
        (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, pago_honorario_id, fecha, hora, usuario)
        VALUES ($1, 'PAGO_HONORARIOS_PM', $2, 'BS', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [cPM.id, pMovil, comisionPM, totalDebPM, sAnt, sPost, referencia || `HON-${pago.id}`, `Pago honorarios Dr(a). ${medico} vía Pago Móvil. Comisión: Bs. ${comisionPM.toFixed(2)}`, pago.id, fechaHoy, horaHoy, user]);
    }

    // B. Débito Efectivo Bs
    if (cEfBs && efBs > 0) {
      const sAnt = parseFloat(cEfBs.saldo_actual) || 0;
      const sPost = sAnt - efBs;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [sPost, cEfBs.id]);
      await client.query(`
        INSERT INTO movimientos_tesoreria
        (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, pago_honorario_id, fecha, hora, usuario)
        VALUES ($1, 'PAGO_HONORARIOS_EF_BS', $2, 'BS', 0, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [cEfBs.id, efBs, sAnt, sPost, referencia || `HON-${pago.id}`, `Pago honorarios Dr(a). ${medico} en Efectivo Bolívares`, pago.id, fechaHoy, horaHoy, user]);
    }

    // C. Débito Efectivo USD
    if (cEfUsd && efUsd > 0) {
      const sAnt = parseFloat(cEfUsd.saldo_actual) || 0;
      const sPost = sAnt - efUsd;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [sPost, cEfUsd.id]);
      await client.query(`
        INSERT INTO movimientos_tesoreria
        (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, pago_honorario_id, fecha, hora, usuario)
        VALUES ($1, 'PAGO_HONORARIOS_EF_USD', $2, 'USD', 0, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [cEfUsd.id, efUsd, sAnt, sPost, referencia || `HON-${pago.id}`, `Pago honorarios Dr(a). ${medico} en Efectivo Divisas ($)`, pago.id, fechaHoy, horaHoy, user]);
    }

    await client.query('COMMIT');
    res.json({
      mensaje: `Liquidación de honorarios a Dr(a). ${medico} ejecutada exitosamente.`,
      pago,
      honorariosLiquidados: honRes.rows.length,
      totalUsd: sumaUsdPendiente
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error en liquidación de honorarios:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Endpoint para analítica de servicios desglosados
app.get('/api/analytics/servicios-detalle', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, f.fecha, f.nombre_paciente, f.cedula_paciente, f.tasa_bcv
      FROM facturas_servicios_detalle d
      JOIN facturas_caja f ON d.factura_id = f.id
      ORDER BY d.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =============================================================================
// RUTAS: INGRESOS EXTRAORDINARIOS, EGRESOS OPERATIVOS Y CONTROL DE CIERRES
// =============================================================================

// 1. Registrar Ingreso Extraordinario
app.post('/api/tesoreria/ingresos-extraordinarios', async (req, res) => {
  const { cuenta_id, categoria, concepto_libre, monto, referencia, descripcion, usuario } = req.body;
  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ error: 'El monto del ingreso extraordinario debe ser mayor a 0.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cuentaRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1', [cuenta_id]);
    if (cuentaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta bancaria no encontrada.' });
    }
    const cuenta = cuentaRes.rows[0];
    const saldoPost = parseFloat(cuenta.saldo_actual) + montoNum;

    await client.query(
      'UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2',
      [saldoPost, cuenta_id]
    );

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const horaHoy = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const ingRes = await client.query(`
      INSERT INTO ingresos_extraordinarios 
      (cuenta_id, categoria, concepto_libre, monto, moneda, referencia, descripcion, fecha, hora, usuario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [cuenta_id, categoria, concepto_libre || null, montoNum, cuenta.moneda, referencia || null, descripcion || null, fechaHoy, horaHoy, usuario || 'Administrador']);

    const conceptoMov = `Ingreso Extraordinario [${categoria}]` + (concepto_libre ? `: ${concepto_libre}` : '');
    const saldoAnt = parseFloat(cuenta.saldo_actual);
    await client.query(`
      INSERT INTO movimientos_tesoreria
      (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
      VALUES ($1, 'INGRESO_EXTRAORDINARIO', $2, $3, 0, $2, $4, $5, $6, $7, $8, $9, $10)
    `, [cuenta_id, montoNum, cuenta.moneda, saldoAnt, saldoPost, referencia || `ING-EXT-${ingRes.rows[0].id}`, conceptoMov, fechaHoy, horaHoy, usuario || 'Administrador']);

    await client.query('COMMIT');
    res.json({ mensaje: 'Ingreso extraordinario registrado exitosamente.', ingreso: ingRes.rows[0], saldoActualizado: saldoPost });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 2. Consultar Ingresos Extraordinarios
app.get('/api/tesoreria/ingresos-extraordinarios', async (req, res) => {
  try {
    const { desde, hasta, cuenta_id } = req.query;
    let q = `
      SELECT i.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo 
      FROM ingresos_extraordinarios i
      JOIN cuentas_bancarias c ON i.cuenta_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (desde) { params.push(desde); q += ` AND i.fecha >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND i.fecha <= $${params.length}`; }
    if (cuenta_id) { params.push(cuenta_id); q += ` AND i.cuenta_id = $${params.length}`; }
    q += ' ORDER BY i.id DESC';

    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Registrar Egreso Operativo (con Comisión Bancaria en Pago Móvil)
app.post('/api/tesoreria/egresos-operativos', async (req, res) => {
  const { cuenta_id, categoria, concepto_libre, monto_neto, comision_bancaria, referencia, descripcion, proveedor_beneficiario, usuario } = req.body;
  const netoNum = parseFloat(monto_neto);
  const comisionNum = parseFloat(comision_bancaria) || 0;

  if (isNaN(netoNum) || netoNum <= 0) {
    return res.status(400).json({ error: 'El monto neto del egreso debe ser mayor a 0.' });
  }
  if (comisionNum < 0) {
    return res.status(400).json({ error: 'La comisión bancaria no puede ser negativa.' });
  }

  const totalDebitado = parseFloat((netoNum + comisionNum).toFixed(2));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cuentaRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1', [cuenta_id]);
    if (cuentaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta bancaria no encontrada.' });
    }
    const cuenta = cuentaRes.rows[0];
    const saldoActual = parseFloat(cuenta.saldo_actual);

    if (saldoActual < totalDebitado) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Saldo insuficiente en ${cuenta.nombre}. Saldo disponible: ${saldoActual.toFixed(2)} ${cuenta.moneda}, Total requerido (Neto + Comisión): ${totalDebitado.toFixed(2)} ${cuenta.moneda}.`
      });
    }

    const saldoPost = parseFloat((saldoActual - totalDebitado).toFixed(2));
    await client.query(
      'UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2',
      [saldoPost, cuenta_id]
    );

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const horaHoy = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const egresoRes = await client.query(`
      INSERT INTO egresos_operativos 
      (cuenta_id, categoria, concepto_libre, monto_neto, comision_bancaria, total_debitado, moneda, referencia, descripcion, proveedor_beneficiario, fecha, hora, usuario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [cuenta_id, categoria, concepto_libre || null, netoNum, comisionNum, totalDebitado, cuenta.moneda, referencia || null, descripcion || null, proveedor_beneficiario || null, fechaHoy, horaHoy, usuario || 'Administrador']);

    const conceptoEgreso = `Egreso Operativo [${categoria}]` + (concepto_libre ? `: ${concepto_libre}` : '') + (proveedor_beneficiario ? ` - Beneficiario: ${proveedor_beneficiario}` : '');
    const saldoTrasNeto = parseFloat((saldoActual - netoNum).toFixed(2));

    await client.query(`
      INSERT INTO movimientos_tesoreria
      (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
      VALUES ($1, 'EGRESO_OPERATIVO', $2, $3, 0, $2, $4, $5, $6, $7, $8, $9, $10)
    `, [cuenta_id, -netoNum, cuenta.moneda, saldoActual, saldoTrasNeto, referencia || `EGR-${egresoRes.rows[0].id}`, conceptoEgreso, fechaHoy, horaHoy, usuario || 'Administrador']);

    if (comisionNum > 0) {
      await client.query(`
        INSERT INTO movimientos_tesoreria
        (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
        VALUES ($1, 'COMISION_BANCARIA', $2, $3, $4, $2, $5, $6, $7, $8, $9, $10, $11)
      `, [cuenta_id, -comisionNum, cuenta.moneda, comisionNum, saldoTrasNeto, saldoPost, referencia || `COM-PM-${egresoRes.rows[0].id}`, `Comisión Pago Móvil / Bancaria [Egreso #${egresoRes.rows[0].id}]`, fechaHoy, horaHoy, usuario || 'Administrador']);
    }

    // REGISTRO DESGLOSADO EN TABLA transacciones_bancarias (ESTADO DE CUENTA)
    // 1. Asiento principal del egreso
    await client.query(`
      INSERT INTO transacciones_bancarias
      (cuenta_id, tipo_transaccion, concepto, monto_debito, monto_credito, saldo_posterior, moneda, referencia, beneficiario, categoria, es_comision, egreso_id, fecha, hora, usuario)
      VALUES ($1, 'EGRESO_OPERATIVO', $2, $3, 0, $4, $5, $6, $7, $8, FALSE, $9, $10, $11, $12)
    `, [cuenta_id, conceptoEgreso, netoNum, saldoTrasNeto, cuenta.moneda, referencia || `EGR-${egresoRes.rows[0].id}`, proveedor_beneficiario || 'Proveedor/Beneficiario', categoria, egresoRes.rows[0].id, fechaHoy, horaHoy, usuario || 'Administrador']);

    // 2. Asiento de comisión bancaria separada (Gasto Financiero)
    if (comisionNum > 0) {
      await client.query(`
        INSERT INTO transacciones_bancarias
        (cuenta_id, tipo_transaccion, concepto, monto_debito, monto_credito, saldo_posterior, moneda, referencia, beneficiario, categoria, es_comision, egreso_id, fecha, hora, usuario)
        VALUES ($1, 'COMISION_BANCARIA', $2, $3, 0, $4, $5, $6, 'Banco Emisor', 'Gasto Financiero', TRUE, $7, $8, $9, $10)
      `, [cuenta_id, `Gasto por Comisión Bancaria - Pago Móvil Ref: ${referencia || ('EGR-' + egresoRes.rows[0].id)}`, comisionNum, saldoPost, cuenta.moneda, referencia || `COM-${egresoRes.rows[0].id}`, egresoRes.rows[0].id, fechaHoy, horaHoy, usuario || 'Administrador']);
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Egreso operativo registrado exitosamente.', egreso: egresoRes.rows[0], saldoActualizado: saldoPost });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 4. Consultar Egresos Operativos
app.get('/api/tesoreria/egresos-operativos', async (req, res) => {
  try {
    const { desde, hasta, cuenta_id } = req.query;
    let q = `
      SELECT e.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo 
      FROM egresos_operativos e
      JOIN cuentas_bancarias c ON e.cuenta_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (desde) { params.push(desde); q += ` AND e.fecha >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND e.fecha <= $${params.length}`; }
    if (cuenta_id) { params.push(cuenta_id); q += ` AND e.cuenta_id = $${params.length}`; }
    q += ' ORDER BY e.id DESC';

    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Verificar Estado Diario y Bloqueo Operativo por Cierres Pendientes
app.get('/api/cierres/verificar-estado-diario', async (req, res) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    
    // Buscar días anteriores con operaciones en facturas_caja que no estén en cierres_diarios
    const diasPendientesRes = await pool.query(`
      SELECT DISTINCT f.fecha::text 
      FROM facturas_caja f
      LEFT JOIN cierres_diarios c ON f.fecha = c.fecha
      WHERE f.fecha < $1 AND c.id IS NULL
      ORDER BY f.fecha::text ASC
    `, [hoy]);

    // Buscar pacientes no finalizados/abiertos de días anteriores
    const pacientesPendientesRes = await pool.query(`
      SELECT f.id, f.fecha::text, f.hora, f.cedula_paciente, f.nombre_paciente, f.estudio, f.medico, f.precio_usd, f.tasa_bcv, f.estado,
             f.pago_punto, f.pago_movil, f.pago_efectivo_bs, f.pago_divisas, f.turno_num
      FROM facturas_caja f
      WHERE f.fecha < $1 AND f.estado IN ('ESPERA', 'ATENCION')
      ORDER BY f.fecha ASC, f.id ASC
    `, [hoy]);

    const tieneDiasSinCerrar = diasPendientesRes.rows.length > 0;
    const tienePacientesAbiertos = pacientesPendientesRes.rows.length > 0;
    const bloqueado = tieneDiasSinCerrar || tienePacientesAbiertos;

    let fechaPendiente = null;
    if (diasPendientesRes.rows.length > 0) {
      fechaPendiente = diasPendientesRes.rows[0].fecha;
    } else if (pacientesPendientesRes.rows.length > 0) {
      fechaPendiente = pacientesPendientesRes.rows[0].fecha;
    }

    res.json({
      bloqueado,
      fecha_actual: hoy,
      fecha_pendiente: fechaPendiente,
      total_dias_pendientes: diasPendientesRes.rows.length,
      dias_pendientes: diasPendientesRes.rows.map(r => r.fecha),
      pacientes_pendientes: pacientesPendientesRes.rows,
      mensaje: bloqueado 
        ? `Bloqueo Operativo Activo: Existen registros contables o pacientes pendientes de cierre en la fecha ${fechaPendiente}.`
        : 'Operación al día. No existen cierres pendientes.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Resolver Paciente Pendiente de Cierre (Culminar, Anular, Cartera de Deudores, Reasignar a Hoy)
app.post('/api/cierres/resolver-paciente', async (req, res) => {
  const { factura_id, accion, motivo, datos_pago, usuario } = req.body;
  if (!factura_id || !accion) {
    return res.status(400).json({ error: 'factura_id y accion son obligatorios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const facRes = await client.query('SELECT * FROM facturas_caja WHERE id = $1', [factura_id]);
    if (facRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }
    const factura = facRes.rows[0];
    const user = usuario || 'Administrador';
    const hoy = new Date().toISOString().slice(0, 10);

    if (accion === 'ANULAR') {
      if (!motivo || motivo.trim().length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debe ingresar un motivo justificado para la anulación.' });
      }
      await client.query("UPDATE facturas_caja SET estado = 'ANULADO' WHERE id = $1", [factura_id]);
      await client.query(`
        INSERT INTO resoluciones_pacientes_cierre 
        (factura_id, fecha_original, paciente_nombre, cedula_paciente, accion, motivo_detalle, monto_involucrado_usd, usuario)
        VALUES ($1, $2, $3, $4, 'ANULADO', $5, $6, $7)
      `, [factura_id, factura.fecha, factura.nombre_paciente, factura.cedula_paciente, motivo, factura.precio_usd, user]);
    } 
    else if (accion === 'CULMINAR_FACTURAR') {
      const pagos = datos_pago || {};
      const punto = parseFloat(pagos.punto) || 0;
      const movil = parseFloat(pagos.movil) || 0;
      const efBs = parseFloat(pagos.efectivoBs) || 0;
      const divUSD = parseFloat(pagos.divisasUSD) || 0;

      await client.query(`
        UPDATE facturas_caja 
        SET estado = 'FINALIZADO', pago_punto = $1, pago_movil = $2, pago_efectivo_bs = $3, pago_divisas = $4
        WHERE id = $5
      `, [punto, movil, efBs, divUSD, factura_id]);

      if (divUSD > 0) {
        await client.query("UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + $1 WHERE codigo = 'EFECTIVO_USD'", [divUSD]);
      }
      if (efBs > 0) {
        await client.query("UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + $1 WHERE codigo = 'EFECTIVO_BS'", [efBs]);
      }
      if (movil > 0) {
        await client.query("UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + $1 WHERE codigo = 'PAGO_MOVIL_BS'", [movil]);
      }
      if (punto > 0) {
        await client.query("UPDATE cuentas_bancarias SET saldo_transito = saldo_transito + $1 WHERE codigo = 'PUNTO_VENTA_BS'", [punto]);
        await client.query(`
          INSERT INTO transacciones_tarjetas_transito (factura_id, paciente_nombre, monto_bruto_bs, estado)
          VALUES ($1, $2, $3, 'PENDIENTE')
        `, [factura_id, factura.nombre_paciente, punto]);
      }

      await client.query(`
        INSERT INTO resoluciones_pacientes_cierre 
        (factura_id, fecha_original, paciente_nombre, cedula_paciente, accion, motivo_detalle, monto_involucrado_usd, usuario)
        VALUES ($1, $2, $3, $4, 'CULMINADO_FACTURADO', $5, $6, $7)
      `, [factura_id, factura.fecha, factura.nombre_paciente, factura.cedula_paciente, motivo || 'Cobro completado durante el proceso de cierre', factura.precio_usd, user]);
    }
    else if (accion === 'CARTERA_DEUDORES') {
      const deudaUSD = parseFloat(factura.precio_usd) || 0;
      const tasa = parseFloat(factura.tasa_bcv) || 807.39;
      const deudaBs = parseFloat((deudaUSD * tasa).toFixed(2));

      await client.query("UPDATE facturas_caja SET estado = 'DEUDOR' WHERE id = $1", [factura_id]);
      await client.query(`
        INSERT INTO cartera_deudores
        (factura_id, paciente_nombre, cedula_paciente, monto_deuda_usd, monto_deuda_bs, saldo_restante_usd, estado, observaciones, usuario)
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE', $7, $8)
      `, [factura_id, factura.nombre_paciente, factura.cedula_paciente, deudaUSD, deudaBs, deudaUSD, motivo || 'Cuenta por cobrar generada durante cierre', user]);

      await client.query(`
        INSERT INTO resoluciones_pacientes_cierre 
        (factura_id, fecha_original, paciente_nombre, cedula_paciente, accion, motivo_detalle, monto_involucrado_usd, usuario)
        VALUES ($1, $2, $3, $4, 'CARTERA_DEUDORES', $5, $6, $7)
      `, [factura_id, factura.fecha, factura.nombre_paciente, factura.cedula_paciente, motivo || 'Cuenta por cobrar registrada', deudaUSD, user]);
    }
    else if (accion === 'REASIGNAR_HOY') {
      await client.query("UPDATE facturas_caja SET fecha = $1 WHERE id = $2", [hoy, factura_id]);
      await client.query(`
        INSERT INTO resoluciones_pacientes_cierre 
        (factura_id, fecha_original, paciente_nombre, cedula_paciente, accion, motivo_detalle, monto_involucrado_usd, reasignado_a_fecha, usuario)
        VALUES ($1, $2, $3, $4, 'REASIGNADO_HOY', $5, $6, $7, $8)
      `, [factura_id, factura.fecha, factura.nombre_paciente, factura.cedula_paciente, motivo || 'Reasignado a la fecha actual para atención posterior', factura.precio_usd, hoy, user]);
    }
    else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Acción de resolución no válida.' });
    }

    await client.query('COMMIT');
    res.json({ mensaje: `Paciente resuelto exitosamente con acción: ${accion}` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 7. Ejecutar Cierre Diario Forzoso / Consolidado
app.post('/api/cierres/ejecutar-cierre', async (req, res) => {
  const { fecha, usuario, notas } = req.body;
  if (!fecha) {
    return res.status(400).json({ error: 'Debe especificar la fecha de cierre.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar si quedan pacientes sin resolver en esa fecha
    const pendientesRes = await client.query(`
      SELECT id FROM facturas_caja 
      WHERE fecha = $1 AND estado IN ('ESPERA', 'ATENCION')
    `, [fecha]);

    if (pendientesRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `No se puede cerrar la caja. Aún existen ${pendientesRes.rows.length} paciente(s) con atención o cobro pendiente en la fecha ${fecha}.`
      });
    }

    // Sumatoria de facturación del día
    const facturasRes = await client.query(`
      SELECT 
        COALESCE(SUM(precio_usd), 0) as total_usd,
        COALESCE(SUM(precio_usd * tasa_bcv), 0) as total_bs,
        COALESCE(SUM(pago_punto), 0) as total_punto,
        COALESCE(SUM(pago_movil), 0) as total_movil,
        COALESCE(SUM(pago_efectivo_bs), 0) as total_ef_bs,
        COALESCE(SUM(pago_divisas), 0) as total_divisas,
        COUNT(id) as total_pacientes
      FROM facturas_caja
      WHERE fecha = $1 AND estado != 'ANULADO'
    `, [fecha]);
    const fTotales = facturasRes.rows[0];

    // Egresos e ingresos extraordinarios de la fecha
    const egresosRes = await client.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN moneda = 'BS' THEN total_debitado ELSE 0 END), 0) as egresos_bs,
        COALESCE(SUM(CASE WHEN moneda = 'USD' THEN total_debitado ELSE 0 END), 0) as egresos_usd
      FROM egresos_operativos WHERE fecha = $1
    `, [fecha]);
    const eTotales = egresosRes.rows[0];

    const ingresosExtraRes = await client.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN moneda = 'BS' THEN monto ELSE 0 END), 0) as extra_bs,
        COALESCE(SUM(CASE WHEN moneda = 'USD' THEN monto ELSE 0 END), 0) as extra_usd
      FROM ingresos_extraordinarios WHERE fecha = $1
    `, [fecha]);
    const iTotales = ingresosExtraRes.rows[0];

    // Obtener saldos actuales de cuentas operativas
    const cuentasRes = await client.query('SELECT codigo, saldo_actual FROM cuentas_bancarias');
    const saldosMap = {};
    cuentasRes.rows.forEach(c => { saldosMap[c.codigo] = parseFloat(c.saldo_actual); });

    const horaCierre = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const user = usuario || 'Administrador';

    const cierreRes = await client.query(`
      INSERT INTO cierres_diarios 
      (fecha, hora_cierre, usuario, total_facturado_usd, total_facturado_bs, total_punto_bs, total_movil_bs, total_efectivo_bs, total_divisas_usd,
       total_egresos_bs, total_egresos_usd, total_ingresos_extra_bs, total_ingresos_extra_usd,
       saldo_cierre_efectivo_usd, saldo_cierre_efectivo_bs, saldo_cierre_punto_bs, saldo_cierre_movil_bs,
       pacientes_atendidos, estado, notas, metadata_auditoria)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'CERRADO', $19, $20)
      ON CONFLICT (fecha) DO UPDATE SET
        hora_cierre = EXCLUDED.hora_cierre,
        usuario = EXCLUDED.usuario,
        total_facturado_usd = EXCLUDED.total_facturado_usd,
        total_facturado_bs = EXCLUDED.total_facturado_bs,
        total_punto_bs = EXCLUDED.total_punto_bs,
        total_movil_bs = EXCLUDED.total_movil_bs,
        total_efectivo_bs = EXCLUDED.total_efectivo_bs,
        total_divisas_usd = EXCLUDED.total_divisas_usd,
        total_egresos_bs = EXCLUDED.total_egresos_bs,
        total_egresos_usd = EXCLUDED.total_egresos_usd,
        total_ingresos_extra_bs = EXCLUDED.total_ingresos_extra_bs,
        total_ingresos_extra_usd = EXCLUDED.total_ingresos_extra_usd,
        saldo_cierre_efectivo_usd = EXCLUDED.saldo_cierre_efectivo_usd,
        saldo_cierre_efectivo_bs = EXCLUDED.saldo_cierre_efectivo_bs,
        saldo_cierre_punto_bs = EXCLUDED.saldo_cierre_punto_bs,
        saldo_cierre_movil_bs = EXCLUDED.saldo_cierre_movil_bs,
        pacientes_atendidos = EXCLUDED.pacientes_atendidos,
        estado = 'CERRADO',
        notas = EXCLUDED.notas,
        metadata_auditoria = EXCLUDED.metadata_auditoria
      RETURNING *
    `, [
      fecha, horaCierre, user,
      fTotales.total_usd, fTotales.total_bs, fTotales.total_punto, fTotales.total_movil, fTotales.total_ef_bs, fTotales.total_divisas,
      eTotales.egresos_bs, eTotales.egresos_usd,
      iTotales.extra_bs, iTotales.extra_usd,
      saldosMap['EFECTIVO_USD'] || 0, saldosMap['EFECTIVO_BS'] || 0, saldosMap['PUNTO_VENTA_BS'] || 0, saldosMap['PAGO_MOVIL_BS'] || 0,
      fTotales.total_pacientes, notas || null, JSON.stringify({ consolidado_en: new Date().toISOString(), usuario: user })
    ]);

    await client.query(`
      UPDATE resoluciones_pacientes_cierre 
      SET cierre_id = $1 
      WHERE fecha_original = $2 AND cierre_id IS NULL
    `, [cierreRes.rows[0].id, fecha]);

    await client.query('COMMIT');
    res.json({ mensaje: `Cierre diario de la fecha ${fecha} consolidado exitosamente.`, cierre: cierreRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// Consultar Transacciones Bancarias (Extracto / Conciliación 1 a 1)
app.get('/api/tesoreria/transacciones-bancarias', async (req, res) => {
  try {
    const { cuenta_id, desde, hasta, tipo, es_comision } = req.query;
    let q = `
      SELECT t.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo
      FROM transacciones_bancarias t
      JOIN cuentas_bancarias c ON t.cuenta_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (cuenta_id) { params.push(cuenta_id); q += ' AND t.cuenta_id = $' + params.length; }
    if (desde) { params.push(desde); q += ' AND t.fecha >= $' + params.length; }
    if (hasta) { params.push(hasta); q += ' AND t.fecha <= $' + params.length; }
    if (tipo) { params.push(tipo); q += ' AND t.tipo_transaccion = $' + params.length; }
    if (es_comision !== undefined) { params.push(es_comision === 'true'); q += ' AND t.es_comision = $' + params.length; }
    q += ' ORDER BY t.id DESC';

    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor backend Imagen Salud activo y conectado en el puerto ${PORT}`);
});
