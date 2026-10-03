import { centsToStr, toCents } from '@/lib/money';

/** Registro normalizado de una atención histórica (montos en centavos). Columnas según Plantilla_3_Carga_Masiva_Atenciones.xlsx. */
export interface RegistroAtencion {
  fecha: string;
  hora: string;
  cedula: string;
  nombre: string;
  telefono: string | null;
  servicio: string;
  area: string;
  grupo: string;
  medico: string;
  precio: number;
  tasa: number;
  divisas: number;
  punto: number;
  movil: number;
  efectivoBs: number;
  referencia: string | null;
  honorarios: number;
  ganancia: number;
  anulada: boolean;
}

export interface ResultadoFila {
  registro: RegistroAtencion | null;
  errores: string[];
  advertencias: string[];
}

type Fila = Record<string, string | number | undefined>;

const clave = (k: string) => k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Busca por nombre de columna ignorando mayúsculas, acentos y separadores. */
function leer(fila: Fila, ...nombres: string[]): string {
  const mapa = new Map(Object.entries(fila).map(([k, v]) => [clave(k), v]));
  for (const n of nombres) {
    const v = mapa.get(clave(n));
    if (v !== undefined && v !== '') return String(v).trim();
  }
  return '';
}

function normalizarFecha(v: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

const dinero = (v: string, etiqueta: string, errores: string[]): number => {
  try {
    return toCents(v);
  } catch {
    errores.push(`${etiqueta} no es un número válido.`);
    return 0;
  }
};

export function normalizarFila(fila: Fila, medicosCatalogo: string[]): ResultadoFila {
  const errores: string[] = [];
  const advertencias: string[] = [];

  const fecha = normalizarFecha(leer(fila, 'Fecha'));
  if (!fecha) errores.push('Fecha inválida (use AAAA-MM-DD o DD/MM/AAAA).');
  const nombre = `${leer(fila, 'Nombres_Paciente', 'Nombres')} ${leer(fila, 'Apellidos_Paciente', 'Apellidos')}`.trim() || leer(fila, 'Paciente', 'Nombre');
  if (!nombre) errores.push('Nombre del paciente requerido.');
  const servicio = leer(fila, 'Servicio_Estudio', 'Servicio', 'Estudio');
  if (!servicio) errores.push('Servicio / Estudio no especificado.');
  const cedula = leer(fila, 'Cedula_Paciente', 'Cedula').toUpperCase();
  if (!cedula) errores.push('Cédula requerida.');

  const precio = dinero(leer(fila, 'Precio_Total_USD', 'Monto_USD', 'Precio'), 'Precio_Total_USD', errores);
  if (precio <= 0) errores.push('Precio_Total_USD debe ser mayor a 0.');
  const tasaNum = Number(leer(fila, 'Tasa_BCV', 'Tasa').replace(',', '.'));
  if (!Number.isFinite(tasaNum) || tasaNum <= 0) errores.push('Tasa_BCV inválida (> 0).');
  const divisas = dinero(leer(fila, 'Pago_Divisas_USD'), 'Pago_Divisas_USD', errores);
  const punto = dinero(leer(fila, 'Pago_Punto_BS'), 'Pago_Punto_BS', errores);
  const movil = dinero(leer(fila, 'Pago_Movil_BS'), 'Pago_Movil_BS', errores);
  const efectivoBs = dinero(leer(fila, 'Pago_Efectivo_BS'), 'Pago_Efectivo_BS', errores);

  const honRaw = leer(fila, 'Honorarios_Medico_USD');
  const honorarios = honRaw ? dinero(honRaw, 'Honorarios_Medico_USD', errores) : Math.round(precio * 0.7);
  if (honorarios < 0 || honorarios > precio) errores.push('Honorarios_Medico_USD debe estar entre 0 y el precio.');
  const ganancia = precio - honorarios;

  const anulada = /anul/i.test(leer(fila, 'Estado_Factura'));
  if (errores.length === 0 && !anulada) {
    const pagado = divisas + Math.round((punto + movil + efectivoBs) / tasaNum);
    if (Math.abs(pagado - precio) > 2) {
      errores.push(`Los pagos no cuadran con el precio (pagado $${centsToStr(pagado)} vs $${centsToStr(precio)}).`);
    }
  }

  const medico = leer(fila, 'Medico_Tratante', 'Medico', 'Doctor');
  if (medico && medicosCatalogo.length > 0 && !medicosCatalogo.some((m) => m.toLowerCase() === medico.toLowerCase())) {
    advertencias.push(`Médico "${medico}" no figura en el catálogo.`);
  }

  if (errores.length > 0 || !fecha) return { registro: null, errores, advertencias };
  return {
    registro: {
      fecha, hora: leer(fila, 'Hora') || '12:00 AM', cedula, nombre: nombre.toUpperCase(),
      telefono: leer(fila, 'Telefono_WhatsApp', 'Telefono') || null, servicio,
      area: leer(fila, 'Area_Modalidad', 'Area') || 'GENERAL',
      grupo: /([ABC])\s*$/i.exec(leer(fila, 'Grupo_Clinico'))?.[1]?.toUpperCase() ?? 'A',
      medico: medico || 'De Guardia', precio, tasa: tasaNum, divisas, punto, movil, efectivoBs,
      referencia: leer(fila, 'Referencia_Bancaria') || null, honorarios, ganancia, anulada,
    },
    errores, advertencias,
  };
}
