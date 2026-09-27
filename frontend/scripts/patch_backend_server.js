const fs = require('fs');
const filePath = 'C:/Users/Lenovo/OneDrive/Desktop/backend-imagen-salud/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update POST /api/facturas
const oldPostInsert = `    const queryFactura = \`
      INSERT INTO facturas_caja 
      (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv, 
       pago_punto, pago_movil, pago_efectivo_bs, pago_divisas, estado, 
       servicios, total_honorarios, total_ganancia, turno_num, etapa_actual) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
      RETURNING *
    \`;`;

const newPostInsert = `    const queryFactura = \`
      INSERT INTO facturas_caja 
      (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv, 
       pago_punto, pago_movil, pago_efectivo_bs, pago_divisas, estado, 
       servicios, total_honorarios, total_ganancia, turno_num, etapa_actual,
       telefono_paciente, estudio_principal_id, prioridad, grupo_clinico) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) 
      RETURNING *
    \`;`;

const oldPostValues = `      parseInt(data.etapaActual || data.etapa_actual) || 0
    ];`;

const newPostValues = `      parseInt(data.etapaActual || data.etapa_actual) || 0,
      data.telefono_paciente || data.telefono || null,
      data.estudio_principal_id || null,
      data.prioridad || 'NORMAL',
      data.grupo_clinico || 'A'
    ];`;

// 2. Update PUT /api/facturas/:id/estado
const oldPut = `app.put('/api/facturas/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { estado, etapa_actual } = req.body;
  try {
    let query = 'UPDATE facturas_caja SET estado = $1';
    const values = [estado];
    if (etapa_actual !== undefined) {
      query += ', etapa_actual = $2 WHERE id = $3 RETURNING *';
      values.push(etapa_actual, id);
    } else {
      query += ' WHERE id = $2 RETURNING *';
      values.push(id);
    }
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

const newPut = `app.put('/api/facturas/:id/estado', async (req, res) => {
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
        fields.push(key + ' = $' + idx);
        values.push(body[key]);
        idx++;
      }
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    values.push(id);
    const query = 'UPDATE facturas_caja SET ' + fields.join(', ') + ' WHERE id = $' + idx + ' RETURNING *';
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

if (content.includes('INSERT INTO facturas_caja')) {
  content = content.replace(oldPostInsert, newPostInsert);
  content = content.replace(oldPostValues, newPostValues);
  content = content.replace(oldPut, newPut);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('backend-imagen-salud/server.js patched successfully');
} else {
  console.log('Already patched or string mismatch');
}
