-- =============================================================================
-- SCRIPT DE VACIADO / REINICIO A CERO (100% EN BLANCO) PARA PRODUCCIÓN
-- PRECAUCIÓN: Este script elimina todos los registros de prueba y transacciones,
-- dejando la estructura intacta y lista para iniciar operaciones reales.
-- =============================================================================

BEGIN;

-- 1. Vaciar todas las tablas transaccionales y de prueba
TRUNCATE TABLE 
  facturas_servicios_detalle,
  facturas_caja,
  honorarios_medicos_pendientes,
  pagos_honorarios,
  cierres_diarios,
  egresos_operativos,
  ingresos_extraordinarios,
  operaciones_cambiarias,
  movimientos_tesoreria,
  transacciones_bancarias,
  transacciones_tarjetas_transito,
  cartera_deudores,
  resoluciones_pacientes_cierre,
  pacientes,
  medicos
RESTART IDENTITY CASCADE;

-- 2. Restablecer saldos de cuentas de tesorería a 0.00
UPDATE cuentas_bancarias 
SET saldo_actual = 0.00, 
    saldo_transito = 0.00,
    actualizado_en = NOW();

-- 3. Asegurar que los usuarios administradores y cajeros base existan
INSERT INTO usuarios (user_login, nombre, rol, email)
VALUES
  ('admin', 'Manuel Administrador', 'admin', 'admin@imagensalud.com'),
  ('cajero1', 'Cajero de Guardia', 'cajero', 'cajero@imagensalud.com')
ON CONFLICT (id) DO UPDATE 
SET rol = EXCLUDED.rol;

COMMIT;

-- =============================================================================
-- Fin del script: La base de datos ha quedado 100% limpia para producción.
-- =============================================================================
