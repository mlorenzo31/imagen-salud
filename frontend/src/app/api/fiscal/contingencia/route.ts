import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { exigirPinSesion } from '@/lib/pin';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';
import { getErrorMessage } from '@/lib/utils';
import { MOTIVOS_CONTINGENCIA, motivoContingenciaSchema, plazoEnvio } from '@/lib/fiscal/contingencia';
import { activarContingencia, cerrarContingencia, contingenciaVigente, listarTalonarios } from '@/lib/fiscal/contingenciaDb';
import { asegurarFiscal } from '@/lib/fiscal/fiscalDb';

/** Contingencia vigente y talonarios activos (para la caja). Todos los roles. */
export async function GET() {
  try {
    await asegurarFiscal();
    const hoy = fechaHoraLocal().fecha;
    const [contingencia, talonarios] = await Promise.all([contingenciaVigente(pool, hoy), listarTalonarios(pool)]);
    return NextResponse.json({
      contingencia: contingencia && { ...contingencia, plazoEnvio: contingencia.fechaFin ? plazoEnvio(contingencia.fechaFin) : null },
      talonarios: talonarios.filter((t) => t.activo).map((t) => ({ serie: t.serie, controlDesde: t.controlDesde, controlHasta: t.controlHasta, usados: t.usados })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('ACTIVAR'), motivo: motivoContingenciaSchema, observacion: z.string().trim().max(300).optional(), pin: z.string().min(1, 'Ingrese su clave para confirmar.') }),
  z.object({ accion: z.literal('CERRAR'), pin: z.string().min(1, 'Ingrese su clave para confirmar.') }),
]);

/** Activa (art. 6) o cesa la contingencia. Cualquier rol, con su clave; queda en la bitácora. */
export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, schema);
    await exigirPinSesion(req, b.pin);
    await asegurarFiscal();
    const { fecha, hora } = fechaHoraLocal();
    const usuario = sesionUsuario(req);
    const r = await withTransaction(async (client) => {
      try {
        if (b.accion === 'ACTIVAR') {
          if (!(await listarTalonarios(client)).some((t) => t.activo)) throw new Error('No hay talonarios de contingencia activos (Catálogos > Datos fiscales).');
          const a = await activarContingencia(client, { motivo: b.motivo, observacion: b.observacion || null, usuario, fecha, hora });
          await registrarBitacora(client, {
            tipo: 'FISCAL', fechaAfectada: fecha, ...actorSesion(req),
            descripcion: `Contingencia ${a.reabierta ? 'reabierta' : 'activada'} (N° ${a.id}): ${MOTIVOS_CONTINGENCIA[b.motivo]}.${b.observacion ? ` ${b.observacion}` : ''}`,
            detalle: { contingencia_id: a.id, motivo: b.motivo },
          });
          return { id: a.id, accion: a.reabierta ? 'REABIERTA' : 'ACTIVADA' };
        }
        const c = await cerrarContingencia(client, { usuario, fecha, hora });
        await registrarBitacora(client, {
          tipo: 'FISCAL', fechaAfectada: fecha, ...actorSesion(req),
          descripcion: `Contingencia N° ${c.id} cerrada con ${c.documentos} documento(s) físico(s). Remitir a la imprenta digital el ${plazoEnvio(fecha)} (art. 7).`,
          detalle: { contingencia_id: c.id, documentos: c.documentos },
        });
        return { id: c.id, accion: 'CERRADA', plazoEnvio: plazoEnvio(fecha) };
      } catch (err) {
        throw new ApiError(409, getErrorMessage(err));
      }
    });
    return NextResponse.json(r);
  } catch (err) {
    return errorResponse(err);
  }
}
