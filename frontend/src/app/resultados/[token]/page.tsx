'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Download, FileText } from 'lucide-react';

interface Archivo { id: number; nombre: string; tipo: string; tamano: number }
interface Datos { paciente: string; estudio: string | null; fecha: string; archivos: Archivo[] }

const tamano = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function PaginaResultados() {
  const { token } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/resultados/${token}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Datos) => setDatos(d))
      .catch(() => setError(true));
  }, [token]);

  const ruta = (a: Archivo, descargar = false) => `/api/resultados/${token}/${a.id}${descargar ? '?descargar=1' : ''}`;
  const descargarTodo = async () => {
    for (const a of datos?.archivos ?? []) {
      const l = document.createElement('a');
      l.href = ruta(a, true);
      l.download = a.nombre;
      document.body.appendChild(l);
      l.click();
      l.remove();
      await new Promise((r) => setTimeout(r, 600));
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Image src="/logo.png" alt="Imagen Salud" width={594} height={576} priority className="mx-auto w-28 h-auto" />
        {error && <p className="text-center text-slate-600">Este enlace no es válido o ya no está disponible.</p>}
        {!datos && !error && <p className="text-center text-slate-500">Cargando resultados…</p>}
        {datos && (
          <>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-slate-900">Resultados de {datos.paciente}</h1>
              <p className="text-sm text-slate-500">{datos.estudio}</p>
            </div>
            {datos.archivos.length > 1 && (
              <button type="button" onClick={descargarTodo} className="mx-auto flex items-center gap-2 rounded-xl bg-clinica-primary px-4 py-2 text-sm font-medium text-white">
                <Download className="size-4" /> Descargar todo ({datos.archivos.length})
              </button>
            )}
            <ul className="space-y-4">
              {datos.archivos.map((a) => (
                <li key={a.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {a.tipo.startsWith('image/') && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ruta(a)} alt={a.nombre} className="w-full bg-slate-100" />
                  )}
                  <div className="flex items-center justify-between gap-3 p-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                      {!a.tipo.startsWith('image/') && <FileText className="size-4 shrink-0 text-slate-500" />}
                      <span className="truncate">{a.nombre}</span>
                      <span className="shrink-0 text-xs text-slate-500">{tamano(a.tamano)}</span>
                    </span>
                    <a href={ruta(a, true)} download={a.nombre} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Download className="size-3.5" /> Descargar
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-center text-xs text-slate-500">Centro Clínico Imagen Salud, C.A.</p>
      </div>
    </main>
  );
}
