-- =============================================================================
-- ESQUEMA LIMPIO DE BASE DE DATOS PARA PRODUCCIÓN: IMAGEN SALUD
-- Creado: 27/09/2026
-- Compatible con PostgreSQL 14+ / Supabase
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Secuencias requeridas por las columnas con nextval()
CREATE SEQUENCE IF NOT EXISTS cartera_deudores_id_seq;
CREATE SEQUENCE IF NOT EXISTS cierres_diarios_id_seq;
CREATE SEQUENCE IF NOT EXISTS cuentas_bancarias_id_seq;
CREATE SEQUENCE IF NOT EXISTS egresos_operativos_id_seq;
CREATE SEQUENCE IF NOT EXISTS facturas_caja_id_seq;
CREATE SEQUENCE IF NOT EXISTS facturas_servicios_detalle_id_seq;
CREATE SEQUENCE IF NOT EXISTS honorarios_medicos_pendientes_id_seq;
CREATE SEQUENCE IF NOT EXISTS ingresos_extraordinarios_id_seq;
CREATE SEQUENCE IF NOT EXISTS medicos_id_seq;
CREATE SEQUENCE IF NOT EXISTS movimientos_tesoreria_id_seq;
CREATE SEQUENCE IF NOT EXISTS operaciones_cambiarias_id_seq;
CREATE SEQUENCE IF NOT EXISTS pacientes_id_seq;
CREATE SEQUENCE IF NOT EXISTS pagos_honorarios_id_seq;
CREATE SEQUENCE IF NOT EXISTS resoluciones_pacientes_cierre_id_seq;
CREATE SEQUENCE IF NOT EXISTS transacciones_bancarias_id_seq;
CREATE SEQUENCE IF NOT EXISTS transacciones_tarjetas_transito_id_seq;
CREATE SEQUENCE IF NOT EXISTS usuarios_id_seq;



-- Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER NOT NULL DEFAULT nextval('usuarios_id_seq'::regclass),
  user_login VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  rol VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  telefono VARCHAR(20),
  pregunta_seguridad VARCHAR(255),
  respuesta_seguridad VARCHAR(255),
  PRIMARY KEY (id)
);

-- Tabla: cuentas_bancarias
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id INTEGER NOT NULL DEFAULT nextval('cuentas_bancarias_id_seq'::regclass),
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  moneda VARCHAR(3) NOT NULL,
  saldo_actual NUMERIC NOT NULL DEFAULT 0,
  saldo_transito NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT,
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: medicos
CREATE TABLE IF NOT EXISTS medicos (
  id INTEGER NOT NULL DEFAULT nextval('medicos_id_seq'::regclass),
  cedula_rif VARCHAR(50) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  especialidad VARCHAR(150) NOT NULL,
  turno VARCHAR(20) DEFAULT 'COMPLETO'::character varying,
  comision_pct NUMERIC DEFAULT 70.00,
  telefono VARCHAR(50),
  email VARCHAR(150),
  mpps_matricula VARCHAR(50),
  consultorio_defecto VARCHAR(100),
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id INTEGER NOT NULL DEFAULT nextval('pacientes_id_seq'::regclass),
  cedula VARCHAR(30) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  direccion TEXT,
  telefono VARCHAR(30),
  fecha_nacimiento DATE,
  sexo CHAR(1) CHECK (sexo IN ('M','F')),
  PRIMARY KEY (id)
);

-- Tabla: facturas_caja
CREATE TABLE IF NOT EXISTS facturas_caja (
  id INTEGER NOT NULL DEFAULT nextval('facturas_caja_id_seq'::regclass),
  fecha DATE NOT NULL,
  hora VARCHAR(20),
  cedula_paciente VARCHAR(30),
  nombre_paciente VARCHAR(150),
  estudio VARCHAR(150),
  medico VARCHAR(100),
  precio_usd NUMERIC,
  tasa_bcv NUMERIC,
  pago_punto NUMERIC DEFAULT 0,
  pago_movil NUMERIC DEFAULT 0,
  pago_efectivo_bs NUMERIC DEFAULT 0,
  pago_divisas NUMERIC DEFAULT 0,
  estado VARCHAR(20) DEFAULT 'ESPERA'::character varying,
  servicios JSONB DEFAULT '[]'::jsonb,
  total_honorarios NUMERIC DEFAULT 0,
  total_ganancia NUMERIC DEFAULT 0,
  turno_num INTEGER,
  etapa_actual INTEGER DEFAULT 0,
  telefono_paciente VARCHAR(50),
  estudio_principal_id VARCHAR(100),
  prioridad VARCHAR(20) DEFAULT 'NORMAL'::character varying,
  motivo_anulacion TEXT,
  adjunto_nombre VARCHAR(255),
  adjunto_url TEXT,
  adjunto_tipo VARCHAR(50),
  whatsapp_enviado BOOLEAN DEFAULT false,
  whatsapp_fecha_envio TIMESTAMP WITHOUT TIME ZONE,
  retorno_sala BOOLEAN DEFAULT false,
  sala_anterior VARCHAR(100),
  grupo_clinico VARCHAR(10) DEFAULT 'A'::character varying,
  fecha_nacimiento_paciente DATE,
  PRIMARY KEY (id)
);

-- Tabla: facturas_servicios_detalle
CREATE TABLE IF NOT EXISTS facturas_servicios_detalle (
  id INTEGER NOT NULL DEFAULT nextval('facturas_servicios_detalle_id_seq'::regclass),
  factura_id INTEGER,
  estudio VARCHAR(255) NOT NULL,
  medico VARCHAR(255),
  area VARCHAR(100),
  sala VARCHAR(100),
  precio_usd NUMERIC NOT NULL DEFAULT 0,
  honorarios_medico NUMERIC DEFAULT 0,
  ganancia_clinica NUMERIC DEFAULT 0,
  estado VARCHAR(50) DEFAULT 'ESPERA'::character varying,
  orden INTEGER DEFAULT 1,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: honorarios_medicos_pendientes
CREATE TABLE IF NOT EXISTS honorarios_medicos_pendientes (
  id INTEGER NOT NULL DEFAULT nextval('honorarios_medicos_pendientes_id_seq'::regclass),
  factura_id INTEGER,
  fecha_servicio DATE NOT NULL DEFAULT CURRENT_DATE,
  medico VARCHAR(200) NOT NULL,
  estudio VARCHAR(255) NOT NULL,
  paciente VARCHAR(200),
  monto_usd NUMERIC NOT NULL DEFAULT 0,
  estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE'::character varying,
  pago_id INTEGER,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: pagos_honorarios
CREATE TABLE IF NOT EXISTS pagos_honorarios (
  id INTEGER NOT NULL DEFAULT nextval('pagos_honorarios_id_seq'::regclass),
  medico VARCHAR(200) NOT NULL,
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  dias_liquidados TEXT,
  total_usd_liquidado NUMERIC NOT NULL DEFAULT 0,
  tasa_cambio_bcv NUMERIC NOT NULL DEFAULT 1,
  pago_movil_bs NUMERIC NOT NULL DEFAULT 0,
  comision_pago_movil_bs NUMERIC NOT NULL DEFAULT 0,
  efectivo_bs NUMERIC NOT NULL DEFAULT 0,
  efectivo_usd NUMERIC NOT NULL DEFAULT 0,
  referencia VARCHAR(100),
  observaciones TEXT,
  usuario VARCHAR(100),
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: cierres_diarios
CREATE TABLE IF NOT EXISTS cierres_diarios (
  id INTEGER NOT NULL DEFAULT nextval('cierres_diarios_id_seq'::regclass),
  fecha DATE NOT NULL,
  hora_cierre VARCHAR(20) NOT NULL,
  usuario VARCHAR(100) NOT NULL,
  total_facturado_usd NUMERIC NOT NULL DEFAULT 0,
  total_facturado_bs NUMERIC NOT NULL DEFAULT 0,
  total_punto_bs NUMERIC NOT NULL DEFAULT 0,
  total_movil_bs NUMERIC NOT NULL DEFAULT 0,
  total_efectivo_bs NUMERIC NOT NULL DEFAULT 0,
  total_divisas_usd NUMERIC NOT NULL DEFAULT 0,
  total_egresos_bs NUMERIC NOT NULL DEFAULT 0,
  total_egresos_usd NUMERIC NOT NULL DEFAULT 0,
  total_ingresos_extra_bs NUMERIC NOT NULL DEFAULT 0,
  total_ingresos_extra_usd NUMERIC NOT NULL DEFAULT 0,
  saldo_cierre_efectivo_usd NUMERIC NOT NULL DEFAULT 0,
  saldo_cierre_efectivo_bs NUMERIC NOT NULL DEFAULT 0,
  saldo_cierre_punto_bs NUMERIC NOT NULL DEFAULT 0,
  saldo_cierre_movil_bs NUMERIC NOT NULL DEFAULT 0,
  pacientes_atendidos INTEGER NOT NULL DEFAULT 0,
  estado VARCHAR(50) NOT NULL DEFAULT 'CERRADO'::character varying,
  notas TEXT,
  metadata_auditoria JSONB DEFAULT '{}'::jsonb,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: egresos_operativos
CREATE TABLE IF NOT EXISTS egresos_operativos (
  id INTEGER NOT NULL DEFAULT nextval('egresos_operativos_id_seq'::regclass),
  cuenta_id INTEGER NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  concepto_libre TEXT,
  monto_neto NUMERIC NOT NULL,
  comision_bancaria NUMERIC NOT NULL DEFAULT 0,
  total_debitado NUMERIC NOT NULL,
  moneda VARCHAR(10) NOT NULL,
  referencia VARCHAR(100),
  descripcion TEXT,
  proveedor_beneficiario VARCHAR(200),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora VARCHAR(20),
  usuario VARCHAR(100) NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: ingresos_extraordinarios
CREATE TABLE IF NOT EXISTS ingresos_extraordinarios (
  id INTEGER NOT NULL DEFAULT nextval('ingresos_extraordinarios_id_seq'::regclass),
  cuenta_id INTEGER NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  concepto_libre TEXT,
  monto NUMERIC NOT NULL,
  moneda VARCHAR(10) NOT NULL,
  referencia VARCHAR(100),
  descripcion TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora VARCHAR(20),
  usuario VARCHAR(100) NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: operaciones_cambiarias
CREATE TABLE IF NOT EXISTS operaciones_cambiarias (
  id INTEGER NOT NULL DEFAULT nextval('operaciones_cambiarias_id_seq'::regclass),
  cuenta_origen_id INTEGER,
  monto_bs_base NUMERIC NOT NULL,
  tasa_cambio_manual NUMERIC NOT NULL,
  comision_bancaria_bs NUMERIC NOT NULL DEFAULT 0,
  monto_total_debitado_bs NUMERIC NOT NULL,
  monto_usd_ingreso NUMERIC NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia VARCHAR(100),
  notas TEXT,
  usuario VARCHAR(100),
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: movimientos_tesoreria
CREATE TABLE IF NOT EXISTS movimientos_tesoreria (
  id INTEGER NOT NULL DEFAULT nextval('movimientos_tesoreria_id_seq'::regclass),
  cuenta_id INTEGER,
  tipo VARCHAR(50) NOT NULL,
  monto NUMERIC NOT NULL,
  moneda VARCHAR(3) NOT NULL,
  comision NUMERIC DEFAULT 0,
  monto_neto NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL DEFAULT 0,
  saldo_posterior NUMERIC NOT NULL DEFAULT 0,
  referencia VARCHAR(100),
  descripcion TEXT,
  factura_id INTEGER,
  pago_honorario_id INTEGER,
  operacion_cambiaria_id INTEGER,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora VARCHAR(20),
  usuario VARCHAR(100),
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: transacciones_bancarias
CREATE TABLE IF NOT EXISTS transacciones_bancarias (
  id INTEGER NOT NULL DEFAULT nextval('transacciones_bancarias_id_seq'::regclass),
  cuenta_id INTEGER NOT NULL,
  tipo_transaccion VARCHAR(100) NOT NULL,
  concepto TEXT NOT NULL,
  monto_debito NUMERIC NOT NULL DEFAULT 0,
  monto_credito NUMERIC NOT NULL DEFAULT 0,
  saldo_posterior NUMERIC NOT NULL,
  moneda VARCHAR(10) NOT NULL,
  referencia VARCHAR(100),
  beneficiario VARCHAR(200),
  categoria VARCHAR(100),
  es_comision BOOLEAN NOT NULL DEFAULT false,
  egreso_id INTEGER,
  pago_honorario_id INTEGER,
  operacion_cambiaria_id INTEGER,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora VARCHAR(20),
  usuario VARCHAR(100) NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: transacciones_tarjetas_transito
CREATE TABLE IF NOT EXISTS transacciones_tarjetas_transito (
  id INTEGER NOT NULL DEFAULT nextval('transacciones_tarjetas_transito_id_seq'::regclass),
  factura_id INTEGER,
  fecha_transaccion DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_transaccion VARCHAR(20),
  cedula_paciente VARCHAR(50),
  nombre_paciente VARCHAR(200),
  monto_bruto_bs NUMERIC NOT NULL DEFAULT 0,
  estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE'::character varying,
  monto_neto_acreditado_bs NUMERIC DEFAULT 0,
  comision_bancaria_bs NUMERIC DEFAULT 0,
  fecha_acreditacion DATE,
  referencia_bancaria VARCHAR(100),
  conciliado_por VARCHAR(100),
  conciliado_en TIMESTAMP WITH TIME ZONE,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: cartera_deudores
CREATE TABLE IF NOT EXISTS cartera_deudores (
  id INTEGER NOT NULL DEFAULT nextval('cartera_deudores_id_seq'::regclass),
  factura_id INTEGER,
  paciente_nombre VARCHAR(200) NOT NULL,
  cedula_paciente VARCHAR(50) NOT NULL,
  telefono VARCHAR(50),
  monto_deuda_usd NUMERIC NOT NULL DEFAULT 0,
  monto_deuda_bs NUMERIC NOT NULL DEFAULT 0,
  saldo_restante_usd NUMERIC NOT NULL DEFAULT 0,
  estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE'::character varying,
  fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  observaciones TEXT,
  usuario VARCHAR(100) NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabla: resoluciones_pacientes_cierre
CREATE TABLE IF NOT EXISTS resoluciones_pacientes_cierre (
  id INTEGER NOT NULL DEFAULT nextval('resoluciones_pacientes_cierre_id_seq'::regclass),
  cierre_id INTEGER,
  factura_id INTEGER,
  fecha_original DATE NOT NULL,
  paciente_nombre VARCHAR(200),
  cedula_paciente VARCHAR(50),
  accion VARCHAR(50) NOT NULL,
  motivo_detalle TEXT,
  monto_involucrado_usd NUMERIC DEFAULT 0,
  reasignado_a_fecha DATE,
  usuario VARCHAR(100) NOT NULL,
  fecha_resolucion TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- =============================================================================
-- REGISTROS SEMILLA INICIALES PARA PRODUCCIÓN
-- =============================================================================

-- 1. Cuentas Bancarias / Tesorería (en saldo cero 0.00 para iniciar producción)
INSERT INTO cuentas_bancarias (codigo, nombre, moneda, saldo_actual, saldo_transito, descripcion)
VALUES
  ('EFECTIVO_USD', 'Efectivo Divisas ($)', 'USD', 0.00, 0.00, 'Caja física de divisas en dólares americanos'),
  ('EFECTIVO_BS', 'Efectivo Bolívares (Bs)', 'BS', 0.00, 0.00, 'Caja física de bolívares en efectivo'),
  ('PUNTO_VENTA_BS', 'Punto de Venta (Bs)', 'BS', 0.00, 0.00, 'Cuenta bancaria recaudadora de terminales punto de venta'),
  ('PAGO_MOVIL_BS', 'Pago Móvil (Bs)', 'BS', 0.00, 0.00, 'Cuenta bancaria recaudadora de pagos móviles interbancarios')
ON CONFLICT DO NOTHING;

-- 2. Usuario Administrador Inicial
INSERT INTO usuarios (user_login, password_hash, nombre, rol, email)
VALUES
  ('admin', '!', 'Manuel Administrador', 'admin', 'admin@imagensalud.com'),
  ('cajero1', '!', 'Cajero de Guardia', 'cajero', 'cajero@imagensalud.com')
ON CONFLICT DO NOTHING;

-- Restricciones de unicidad requeridas por la aplicación (ON CONFLICT y búsquedas por código)
CREATE UNIQUE INDEX IF NOT EXISTS ux_pacientes_cedula ON pacientes (cedula);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cuentas_bancarias_codigo ON cuentas_bancarias (codigo);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_login ON usuarios (user_login);
