import type { PoolClient } from 'pg';
import { toCents } from '@/lib/money';
import type { CobroDiferido, ServicioCobrado } from './emision';

type Db = Pick<PoolClient, 'query'>;

export interface CobroCargado extends CobroDiferido {
  estado: string | null;
  /** Ya está cubierto por una factura fiscal. */
  facturado: boolean;
}

/** Servicios guardados en facturas_caja.servicios (USD) → servicios de factura en centavos (precio de lista y descuento). */
export function serviciosDeJson(json: unknown): ServicioCobrado[] {
  const lista = (Array.isArray(json) ? json : []) as Array<Record<string, unknown>>;
  return lista.map((s) => {
    const precio = toCents(s.precioUSD);
    const lista = s.precioLista !== undefined && s.precioLista !== null ? toCents(s.precioLista) : precio;
    return { codigo: typeof s.codigo === 'string' ? s.codigo : null, estudio: String(s.estudio ?? ''), area: String(s.area ?? 'GENERAL'), precioLista: lista, descuento: lista - precio };
  });
}

/** Cobros (facturas_caja) con lo necesario para facturarlos o acreditarlos, bloqueados para la transacción. */
export async function cargarCobros(client: Db, ids: number[]): Promise<CobroCargado[]> {
  const r = await client.query(
    `SELECT f.id, f.estado, f.nombre_paciente, f.cedula_paciente, f.servicios, f.pago_divisas,
            f.receptor_razon_social, f.receptor_rif, f.receptor_domicilio, p.direccion,
            EXISTS (SELECT 1 FROM documentos_fiscales_cobros l WHERE l.factura_caja_id = f.id) AS facturado
     FROM facturas_caja f LEFT JOIN pacientes p ON p.cedula = f.cedula_paciente
     WHERE f.id = ANY($1) ORDER BY f.id FOR UPDATE OF f`,
    [ids]
  );
  return r.rows.map((f) => ({
    id: f.id,
    estado: f.estado,
    facturado: f.facturado,
    paciente: { nombre: f.nombre_paciente, cedula: f.cedula_paciente, direccion: f.direccion ?? '' },
    facturarA: f.receptor_rif ? { razonSocial: f.receptor_razon_social, rif: f.receptor_rif, domicilio: f.receptor_domicilio ?? undefined } : null,
    pagoDivisasUsd: toCents(f.pago_divisas),
    servicios: serviciosDeJson(f.servicios),
  }));
}
