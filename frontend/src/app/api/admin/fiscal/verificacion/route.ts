import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { asegurarFiscal, leerConfigEmisor } from '@/lib/fiscal/fiscalDb';
import { contingenciaVigente, listarTalonarios } from '@/lib/fiscal/contingenciaDb';
import { verificarSalida } from '@/lib/fiscal/salida';

/** Lista de verificación para la salida a producción de la facturación fiscal. Solo admin (prefijo /api/admin). */
export async function GET() {
  try {
    await Promise.all([asegurarFiscal(), asegurarCompras()]);
    const hoy = fechaHoraLocal().fecha;
    const [emisor, talonarios, vigente, cuentas] = await Promise.all([
      leerConfigEmisor(),
      listarTalonarios(pool),
      contingenciaVigente(pool, hoy),
      pool.query(
        `SELECT
           (SELECT count(*)::int FROM documentos_fiscales WHERE estado = 'ERROR') AS rechazados,
           (SELECT count(*)::int FROM documentos_fiscales WHERE estado IN ('PENDIENTE', 'ENVIANDO')) AS pendientes,
           (SELECT count(*)::int FROM proveedores WHERE activo AND COALESCE(correo, '') = '') AS sin_correo,
           CASE WHEN to_regclass('catalogo_estudios') IS NULL THEN 0
                ELSE (SELECT count(*)::int FROM catalogo_estudios WHERE activo IS NOT FALSE AND COALESCE(codigo, '') = '') END AS sin_codigo`
      ),
    ]);
    const c = cuentas.rows[0];
    return NextResponse.json(verificarSalida({
      hoy, emisor, env: process.env,
      talonarios: talonarios.filter((t) => t.activo).map((t) => ({ serie: t.serie, disponibles: t.facturaHasta - t.facturaDesde + 1 - t.usados })),
      estudiosSinCodigo: c.sin_codigo, documentosRechazados: c.rechazados, documentosPendientes: c.pendientes,
      contingenciaVencida: vigente?.estado === 'VENCIDA', proveedoresSinCorreo: c.sin_correo,
    }));
  } catch (err) {
    return errorResponse(err);
  }
}
