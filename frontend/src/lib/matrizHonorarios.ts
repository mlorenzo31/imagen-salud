/** Honorarios de un doctor en un día (centavos USD): lo generado por sus servicios y lo ya pagado en el sistema. */
export interface FilaHonorario { medico: string; dia: string; generado: number; pagado: number }

export interface TotalesHonorario { generado: number; pagado: number; pendiente: number }
export interface FilaMatriz { medico: string; generado: number[]; pagado: number[]; pendiente: number[]; totales: TotalesHonorario }
export interface Matriz {
  dias: number[];
  medicos: FilaMatriz[];
  totalesDia: { generado: number[]; pagado: number[]; pendiente: number[] };
  total: TotalesHonorario;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
export const mesValido = (mes: string): boolean => MES.test(mes);

export function diasDelMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

const sumar = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Cuadro mensual doctor × día. `pendiente` = generado − pagado (lo que aún no está marcado como pagado en el sistema). */
export function armarMatriz(filas: FilaHonorario[], mes: string): Matriz {
  const n = diasDelMes(mes);
  const vacio = () => Array.from({ length: n }, () => 0);
  const porMedico = new Map<string, { generado: number[]; pagado: number[] }>();
  for (const f of filas) {
    if (!f.dia.startsWith(`${mes}-`)) continue;
    const i = Number(f.dia.slice(8, 10)) - 1;
    if (!(i >= 0 && i < n)) continue;
    const clave = f.medico.trim().toUpperCase();
    const m = porMedico.get(clave) ?? { generado: vacio(), pagado: vacio() };
    porMedico.set(clave, m);
    m.generado[i] += f.generado;
    m.pagado[i] += f.pagado;
  }
  const medicos: FilaMatriz[] = Array.from(porMedico, ([medico, m]) => {
    const pendiente = m.generado.map((g, i) => g - m.pagado[i]);
    return { medico, generado: m.generado, pagado: m.pagado, pendiente, totales: { generado: sumar(m.generado), pagado: sumar(m.pagado), pendiente: sumar(pendiente) } };
  }).sort((a, b) => b.totales.generado - a.totales.generado || a.medico.localeCompare(b.medico));

  const colSum = (campo: 'generado' | 'pagado' | 'pendiente') => Array.from({ length: n }, (_, i) => sumar(medicos.map((m) => m[campo][i])));
  const totalesDia = { generado: colSum('generado'), pagado: colSum('pagado'), pendiente: colSum('pendiente') };
  return {
    dias: Array.from({ length: n }, (_, i) => i + 1), medicos, totalesDia,
    total: { generado: sumar(totalesDia.generado), pagado: sumar(totalesDia.pagado), pendiente: sumar(totalesDia.pendiente) },
  };
}
