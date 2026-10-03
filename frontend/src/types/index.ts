export type Moneda = 'BS' | 'USD';
export type UserRole = 'admin' | 'asistente' | 'cajero';
export type ModoOperacion = 'operador' | 'vista';
export type GrupoClinico = 'A' | 'B' | 'C';

export interface CuentaBancaria {
  id: number;
  codigo: 'EFECTIVO_USD' | 'EFECTIVO_BS' | 'PUNTO_VENTA_BS' | 'PAGO_MOVIL_BS' | string;
  nombre: string;
  tipo: 'EFECTIVO' | 'BANCO';
  moneda: Moneda;
  saldo_actual: number | string;
  saldo_transito?: number | string;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface TransaccionBancaria {
  id: number;
  cuenta_id: number;
  tipo_transaccion: 'EGRESO_OPERATIVO' | 'COMISION_BANCARIA' | 'INGRESO_EXTRAORDINARIO' | 'LIQUIDACION_HONORARIOS' | 'CAMBIO_DIVISA' | 'REEMBOLSO_PACIENTE';
  concepto: string;
  monto_debito: number | string;
  monto_credito: number | string;
  saldo_posterior: number | string;
  moneda: Moneda;
  referencia?: string;
  beneficiario?: string;
  categoria?: string;
  es_comision: boolean;
  egreso_id?: number | null;
  pago_honorario_id?: number | null;
  operacion_cambiaria_id?: number | null;
  fecha: string;
  hora: string;
  usuario: string;
  creado_en?: string;
  cuenta_nombre?: string;
}

export interface EgresoOperativo {
  id: number;
  cuenta_id: number;
  categoria: string;
  concepto_libre?: string;
  monto_neto: number | string;
  comision_bancaria: number | string;
  total_debitado: number | string;
  moneda: Moneda;
  referencia: string;
  descripcion?: string;
  proveedor_beneficiario: string;
  fecha: string;
  hora: string;
  usuario: string;
  creado_en?: string;
}

export interface IngresoExtraordinario {
  id: number;
  cuenta_id: number;
  categoria: string;
  concepto_libre?: string;
  monto: number | string;
  moneda: Moneda;
  referencia?: string;
  descripcion?: string;
  fecha: string;
  hora: string;
  usuario: string;
  creado_en?: string;
}

export interface RetencionSENIAT {
  id: number;
  nro_comprobante: string;
  periodo_fiscal: string;
  fecha_emision: string;
  paciente_cliente: string;
  cedula_rif: string;
  factura_asociada_id?: number | string;
  base_imponible_usd: number;
  base_imponible_bs: number;
  tasa_bcv: number;
  iva_total_bs: number;
  porcentaje_iva_retenido: 75 | 100;
  monto_iva_retenido_bs: number;
  porcentaje_islr_retenido: number;
  monto_islr_retenido_bs: number;
  total_retenido_bs: number;
  total_retenido_usd: number;
  estado: 'APLICADA' | 'ANULADA';
  usuario: string;
  observaciones?: string;
  creado_en?: string;
}

export interface ConciliacionPOS {
  id: number;
  fecha_operacion: string;
  fecha_cierre_lote: string;
  lote_numero: string;
  tipo_tarjeta: 'TDD' | 'TDC';
  banco: string;
  monto_bruto_pos_bs: number;
  comision_bancaria_bs: number;
  comision_porcentaje: number;
  monto_neto_liquidado_bs: number;
  diferencia_cuadre_bs: number;
  estado: 'CONCILIADO' | 'PENDIENTE' | 'DESCUADRADO';
  notas?: string;
  usuario: string;
  creado_en?: string;
}

export interface ReembolsoPendiente {
  id: number;
  paciente_nombre: string;
  cedula: string;
  turno_num: string;
  servicio: string;
  monto_usd: number;
  monto_bs: number;
  metodo_origen: string;
  cuenta_id: number;
  motivo_anulacion: string;
  fecha: string;
  hora: string;
  estado: 'PENDIENTE_BANCO' | 'REEMBOLSADO' | 'CANCELADO';
  usuario_autoriza: string;
  creado_en?: string;
}

export interface HonorarioMedico {
  id: number;
  medico: string;
  especialidad: string;
  pacientes_atendidos: number;
  total_usd: number;
  tasa_bcv: number;
  honorarios_ids: number[];
  desglose_pagos?: {
    punto_de_venta_usd: number;
    pago_movil_usd: number;
    efectivo_bs_usd: number;
    divisas_usd: number;
  };
}

export interface PacientePendiente {
  id: number;
  numero_turno: string;
  paciente_nombre: string;
  doctor_nombre?: string;
  especialidad?: string;
  total_usd?: number;
  estado: string;
  fecha: string;
  grupo_clinico?: GrupoClinico;
  tipo_bloqueo?: 'SALA_ESPERA' | 'WHATSAPP_PENDIENTE';
  telefono_paciente?: string;
  adjunto_nombre?: string;
}

export interface EstadoCierreDiario {
  puedeCerrar: boolean;
  cierre_pendiente: boolean;
  fecha_pendiente?: string;
  fecha_evaluada?: string;
  pacientesPendientes: PacientePendiente[];
  pacientesWhatsAppPendientes?: PacientePendiente[];
  totalWhatsAppPendientes?: number;
  resumen?: ResumenCierre;
}

export interface ExcelFilaSimulada {
  fila: number;
  paciente: string;
  cedula?: string;
  servicio: string;
  medico: string;
  monto_usd: number;
  monto_bs: number;
  metodo_pago: string;
  valido: boolean;
  observaciones: string[];
}

export interface ExcelDryRunResponse {
  total_filas: number;
  filas_validas: number;
  filas_invalidas: number;
  monto_total_usd: number;
  monto_total_bs: number;
  filas: ExcelFilaSimulada[];
}

export interface FacturaCaja {
  id: number;
  fecha: string;
  hora: string;
  cedula_paciente: string;
  nombre_paciente: string;
  telefono_paciente?: string;
  estudio: string;
  medico?: string;
  precio_usd: number;
  tasa_bcv: number;
  pago_punto?: number;
  pago_movil?: number;
  pago_efectivo_bs?: number;
  pago_divisas?: number;
  estado: string;
  servicios?: ServicioFactura[];
  total_honorarios?: number;
  total_ganancia?: number;
  turno_num?: number;
  etapa_actual?: string | number;
  motivo_anulacion?: string;
  grupo_clinico?: GrupoClinico;
  numero_control_fiscal?: string;
  estudio_principal_id?: string;
  prioridad?: 'ALTA' | 'NORMAL' | 'BAJA';
  retorno_sala?: boolean;
  sala_anterior?: string;
  adjunto_nombre?: string;
  adjunto_url?: string;
  adjunto_tipo?: string;
  whatsapp_enviado?: boolean;
  whatsapp_fecha_envio?: string;
}

// Catlogos Maestros en Tarjetas Interactivas
export interface PacienteCatalogo {
  id: number | string;
  cedula: string;
  nombres: string;
  apellidos?: string;
  telefono: string;
  fecha_nacimiento?: string;
  edad?: number;
  direccion?: string;
  historial_visitas: number;
  saldo_pendiente_usd: number;
  saldo_pendiente_bs: number;
  activo: boolean;
  creado_en?: string;
}

export interface DoctorCatalogo {
  id: number | string;
  cedula_rif?: string;
  nombre: string;
  especialidad: string;
  turno: 'AM' | 'PM' | 'COMPLETO';
  comision_pct: number;
  tarifa_fija_usd?: number;
  activo: boolean;
  telefono?: string;
  email?: string;
  mpps_matricula?: string;
  consultorio_defecto?: string;
  creado_en?: string;
}

export interface ServicioCatalogo {
  id: number | string;
  codigo?: string;
  /** Área del catálogo (ECOGRAFIA_AM, RADIOLOGIA, ...). */
  area?: string;
  /** Reparto en USD (clínica, médico, ecografista, patólogo); suma el precio. */
  dist?: { imagen: number; medico: number; eco: number; patologo: number };
  nombre: string;
  grupo_clinico: GrupoClinico;
  precio_usd: number;
  reparto_clinica_pct: number;
  reparto_medico_pct: number;
  reparto_eco_pct: number;
  reparto_patologo_pct: number;
  activo: boolean;
  sala_defecto?: string;
  descripcion?: string;
  creado_en?: string;
}

// Universal Data View Types
export type DataViewMode = 'bar' | 'line' | 'donut' | 'table';

export interface DataPoint {
  label: string;
  valorUSD: number;
  valorBS?: number;
  secundario?: number;
  porcentaje?: number;
  categoria?: string;
  fecha?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/** Servicio individual dentro de una factura (JSONB en facturas_caja.servicios). */
export interface ServicioFactura {
  id?: string | number;
  estudio?: string;
  nombre?: string;
  medico?: string;
  area?: string;
  sala?: string;
  estado?: string;
  orden?: number;
  precioUSD?: number;
  honorariosMedico?: number;
  gananciaClinica?: number;
}

/** Totales del día devueltos por /api/cierres/verificar-estado-diario y ejecutar-cierre. */
export type ResumenCierre = Record<string, string | number | null | undefined>;
