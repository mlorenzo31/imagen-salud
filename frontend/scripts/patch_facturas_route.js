const fs = require('fs');
const filePath = 'src/app/api/facturas/route.ts';
let content = fs.readFileSync(filePath, 'utf8');

const oldInsert = `    const queryFactura = \`
      INSERT INTO facturas_caja 
      (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv, 
       pago_punto, pago_movil, pago_efectivo_bs, pago_divisas, estado, 
       servicios, total_honorarios, total_ganancia, turno_num, etapa_actual) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
      RETURNING *
    \`;

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
      turnoNum,
      parseInt(data.etapaActual || data.etapa_actual) || 0
    ];`;

const newInsert = `    const queryFactura = \`
      INSERT INTO facturas_caja 
      (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv, 
       pago_punto, pago_movil, pago_efectivo_bs, pago_divisas, estado, 
       servicios, total_honorarios, total_ganancia, turno_num, etapa_actual,
       telefono_paciente, estudio_principal_id, prioridad, grupo_clinico) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) 
      RETURNING *
    \`;

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
      turnoNum,
      parseInt(data.etapaActual || data.etapa_actual) || 0,
      data.telefono_paciente || data.telefono || null,
      data.estudio_principal_id || null,
      data.prioridad || 'NORMAL',
      data.grupo_clinico || 'A'
    ];`;

if (content.includes('queryFactura')) {
  content = content.replace(oldInsert, newInsert);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('src/app/api/facturas/route.ts updated successfully');
} else {
  console.error('Could not find oldInsert target');
}
