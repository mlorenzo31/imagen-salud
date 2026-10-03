const API_BASE_URL = '/api';

export interface CuentaBancaria {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  moneda: 'BS' | 'USD';
  saldo_actual: string | number;
  activo: boolean;
}

export interface EgresoPayload {
  cuenta_id: number;
  categoria: string;
  concepto_libre?: string;
  monto_neto: number;
  comision_bancaria: number;
  referencia: string;
  proveedor_beneficiario: string;
  descripcion?: string;
  usuario: string;
}

export interface CambioDivisaPayload {
  cuenta_origen_id: number;
  monto_bs_base: number;
  tasa_cambio_manual: number;
  comision_bancaria_bs: number;
  referencia: string;
  notas?: string;
  usuario: string;
}

export interface LiquidacionHonorariosPayload {
  medico: string;
  honorarios_ids?: number[];
  dias_liquidados?: string[];
  total_usd_liquidado: number;
  tasa_cambio_bcv: number;
  pago_movil_bs: number;
  comision_pago_movil_bs: number;
  efectivo_bs: number;
  efectivo_usd: number;
  referencia: string;
  observaciones?: string;
  usuario: string;
}

async function fetchWithFallback(endpoint: string, options?: RequestInit) {
  return fetch(`${API_BASE_URL}${endpoint}`, { credentials: 'same-origin', ...options });
}

export async function getCuentasBancarias(): Promise<CuentaBancaria[]> {
  const res = await fetchWithFallback('/tesoreria/cuentas');
  if (!res.ok) throw new Error('Error al cargar cuentas bancarias');
  return res.json();
}

export async function registrarEgresoOperativo(payload: EgresoPayload) {
  const res = await fetchWithFallback('/tesoreria/egresos-operativos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al registrar egreso');
  return data;
}

export async function registrarCambioDivisa(payload: CambioDivisaPayload) {
  const res = await fetchWithFallback('/tesoreria/cambio-divisa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al ejecutar cambio de divisa');
  return data;
}

export async function getTransaccionesBancarias(params?: { cuenta_id?: number; es_comision?: boolean }) {
  let query = '';
  if (params) {
    const sp = new URLSearchParams();
    if (params.cuenta_id) sp.append('cuenta_id', params.cuenta_id.toString());
    if (params.es_comision !== undefined) sp.append('es_comision', params.es_comision.toString());
    query = '?' + sp.toString();
  }
  const res = await fetchWithFallback(`/tesoreria/transacciones-bancarias${query}`);
  if (!res.ok) throw new Error('Error al cargar transacciones bancarias');
  return res.json();
}

export async function verificarEstadoCierre() {
  const res = await fetchWithFallback('/cierres/verificar-estado-diario');
  if (!res.ok) throw new Error('Error al verificar estado de cierre');
  return res.json();
}

export async function resolverPacienteCierre(payload: {
  registro_id: number;
  accion: 'CULMINAR' | 'ANULAR' | 'CARTERA_DEUDOR' | 'REASIGNAR_HOY';
  motivo?: string;
  forma_pago?: string;
  monto_abonado?: number;
  usuario: string;
}) {
  const res = await fetchWithFallback('/cierres/resolver-paciente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al resolver paciente');
  return data;
}

export async function ejecutarCierreDefinitivo(payload: {
  fecha_cierre: string;
  observaciones?: string;
  usuario: string;
}) {
  const res = await fetchWithFallback('/cierres/ejecutar-cierre', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al ejecutar cierre');
  return data;
}

export async function liquidarHonorariosMultiforma(payload: LiquidacionHonorariosPayload) {
  const res = await fetchWithFallback('/tesoreria/honorarios/liquidar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al liquidar honorarios');
  return data;
}
