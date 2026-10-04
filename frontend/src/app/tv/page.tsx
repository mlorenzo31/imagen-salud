'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useMemo } from 'react';import { Volume2, VolumeX, Maximize2, Minimize2, Users, Stethoscope } from 'lucide-react';import { Badge } from '@/components/ui/badge';
import { ejecutarLlamadoCompleto } from '@/lib/audioLlamado';
import { 
  GrupoClinico, 
  GRUPOS_CLINICOS, 
  mapearEstudioAGrupo, 
  inferirBoxConsultorio 
} from '@/lib/gruposClinicos';

interface TurnoItem {
  id: number;
  turno_num: number;
  nombre_paciente: string;
  cedula_paciente?: string;
  estudio: string;
  medico?: string;
  estado: string; // 'ESPERA' | 'ATENCION' | 'FINALIZADO' | 'COMPLETADO' | 'ANULADA'
  etapa_actual?: number;
  hora: string;
  fecha: string;
  grupo_clinico?: GrupoClinico;
  box_asignado?: string;
  llamado_en?: string | null;
  es_unificado?: boolean;
  estudios_unificados?: string[];
}

export default function PantallaTVSalaEspera() {
  const [turnos, setTurnos] = useState<TurnoItem[]>([]);
  const [audioHabilitado, setAudioHabilitado] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [horaActual, setHoraActual] = useState<string>('');
  const [fechaActual, setFechaActual] = useState<string>('');

  // Control de llamado activo por grupo para efecto visual "Llamando Ahora" (coral suave #FDF2EC / #E76F3D)
  const [llamadosActivos, setLlamadosActivos] = useState<Record<GrupoClinico, boolean>>({
    A: false,
    B: false,
    C: false
  });
  const anunciados = useRef<Map<number, string>>(new Map());
  const cargaInicial = useRef(false);

  // Reloj digital en tiempo real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setHoraActual(now.toLocaleTimeString('es-VE', { hour12: true }));
      setFechaActual(
        now.toLocaleDateString('es-VE', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Polling de Facturas y Turnos desde la base de datos
  const cargarTurnos = async () => {
    try {
      const res = await fetch('/api/tv/turnos');
      if (res.ok) {
        const data: TurnoItem[] = await res.json();
        // Filtrar turnos activos no anulados y mapear a Grupo Clínico estricto
        const mapeados: TurnoItem[] = data
          .filter((t) => t.estado !== 'ANULADA' && t.estado !== 'ANULADA_SALA')
          .map((t): TurnoItem => {
            const grupo = t.grupo_clinico || mapearEstudioAGrupo(t.estudio);
            return {
              ...t,
              grupo_clinico: grupo,
              box_asignado: t.box_asignado || inferirBoxConsultorio(grupo, t.estudio, t.medico)
            };
          });

        setTurnos(mapeados);

        // Anunciar cada turno que pasa a ATENCIÓN (varios a la vez: p. ej. ecografía y ginecología).
        const enAtencion = mapeados.filter(t => t.estado === 'ATENCION');
        // Nuevo llamado = turno que entra a ATENCIÓN o cuyo llamado_en cambió (re-llamado desde la sala).
        const marca = (t: TurnoItem) => String(t.llamado_en ?? '');
        const nuevos = enAtencion.filter(t => anunciados.current.get(t.id) !== marca(t));
        const primeraCarga = !cargaInicial.current;
        cargaInicial.current = true;
        anunciados.current = new Map(enAtencion.map(t => [t.id, marca(t)]));
        if (!primeraCarga) {
          for (const t of nuevos) {
            const g = t.grupo_clinico as GrupoClinico;
            setLlamadosActivos(prev => ({ ...prev, [g]: true }));
            setTimeout(() => setLlamadosActivos(prev => ({ ...prev, [g]: false })), 7000);
            if (audioHabilitado) {
              const turnoCod = `${g}-${String(t.turno_num).padStart(2, '0')}`;
              void ejecutarLlamadoCompleto(turnoCod, t.nombre_paciente, t.box_asignado || GRUPOS_CLINICOS[g].boxConsultorioDefecto);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error cargando turnos TV:', err);
    }
  };

  useEffect(() => {
    cargarTurnos();
    const interval = setInterval(cargarTurnos, 4000);
    return () => clearInterval(interval);
  }, [audioHabilitado]);

  // Pantalla Completa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  // Turnos clasificados por grupo clínico
  const turnosPorGrupo = useMemo(() => {
    const res: Record<GrupoClinico, { enAtencion: TurnoItem[]; enEspera: TurnoItem[]; totalEnCola: number }> = {
      A: { enAtencion: [], enEspera: [], totalEnCola: 0 },
      B: { enAtencion: [], enEspera: [], totalEnCola: 0 },
      C: { enAtencion: [], enEspera: [], totalEnCola: 0 }
    };

    (['A', 'B', 'C'] as GrupoClinico[]).forEach(g => {
      const delGrupo = turnos.filter(t => t.grupo_clinico === g);
      const enAtencion = delGrupo.filter(t => t.estado === 'ATENCION');
      const enEspera = delGrupo.filter(t => t.estado === 'ESPERA');
      res[g] = {
        enAtencion,
        enEspera: enEspera.slice(0, 2), // Próximos 2 en espera
        totalEnCola: enEspera.length
      };
    });

    return res;
  }, [turnos]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between p-6 lg:p-10 font-sans selection:bg-[#80DDD2] selection:text-slate-900 antialiased">
      
      {/* Header Corporativo Oficial en Blanco Clínico */}
      <header className="bg-white rounded-3xl p-5 lg:p-6 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Image src="/logo.png" alt="Imagen Salud" width={594} height={576} priority className="h-16 w-auto" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900">
                Sala de espera
              </h1>
              <Badge className="bg-[#EBF9F7] text-[#1D7A70] border border-[#80DDD2]/50 text-xs font-bold">
                EN VIVO
              </Badge>
            </div>
            <p className="text-xs lg:text-sm font-bold text-[#2EA89B] uppercase tracking-widest mt-0.5">
              Centro de Atención Radiológica
            </p>
          </div>
        </div>

        {/* Reloj Digital Clínico y Controles */}
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <p className="text-2xl lg:text-4xl font-mono font-black text-[#1D7A70] tracking-tight">
              {horaActual}
            </p>
            <p className="text-xs lg:text-sm text-slate-500 capitalize font-semibold mt-0.5">
              {fechaActual}
            </p>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
            <button
              onClick={() => setAudioHabilitado(!audioHabilitado)}
              className={`p-3 rounded-2xl border transition-all ${
                audioHabilitado 
                  ? 'bg-[#EBF9F7] border-[#80DDD2] text-[#1D7A70] hover:bg-[#80DDD2]/20' 
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
              title={audioHabilitado ? 'Llamado por Voz Activado' : 'Audio Silenciado'}
            >
              {audioHabilitado ? <Volume2 className="w-5 h-5 text-[#2EA89B]" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all"
              title="Pantalla Completa"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* GRID RESPONSIVO DE 3 COLUMNAS: GRUPO A, GRUPO B, GRUPO C */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-6 items-stretch flex-1">
        
        {(['A', 'B', 'C'] as GrupoClinico[]).map((codigoGrupo) => {
          const info = GRUPOS_CLINICOS[codigoGrupo];
          const datos = turnosPorGrupo[codigoGrupo];
          const estaLlamando = llamadosActivos[codigoGrupo];
          const enAtencionLista = datos.enAtencion;
          const proximos = datos.enEspera;

          return (
            <div
              key={codigoGrupo}
              className="flex flex-col justify-between bg-white rounded-3xl p-6 lg:p-7 border-2 border-slate-200/90 shadow-sm transition-all relative overflow-hidden"
            >
              {/* Barra superior de acento según grupo */}
              <div 
                className="absolute top-0 left-0 right-0 h-2.5" 
                style={{ backgroundColor: info.colorHex }} 
              />

              {/* 1. Cabecera del Grupo Clínico */}
              <div className="pt-2 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span 
                    className="px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase"
                    style={{ backgroundColor: info.colorFondoSuave, color: info.colorTexto }}
                  >
                    {info.codigo === 'A' ? 'Grupo A' : info.codigo === 'B' ? 'Grupo B' : 'Grupo C'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{datos.totalEnCola} en espera</span>
                  </div>
                </div>
                <h2 className="text-lg lg:text-xl font-black text-slate-900 mt-2 leading-tight">
                  {info.nombreCorto}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {info.subtitulo}
                </p>
              </div>

              {/* 2. Tarjeta Gigante: TURNO EN ATENCIÓN */}
              <div className="my-auto py-6">
                {enAtencionLista.length > 0 ? (
                  <div className="space-y-4">
                  {enAtencionLista.map((enAtencion) => (
                  <div 
                    key={enAtencion.id}
                    className={`rounded-3xl p-6 border-2 transition-all duration-700 text-center space-y-4 ${
                      estaLlamando
                        ? 'bg-[#FDF2EC] border-[#E76F3D] shadow-xl shadow-[#E76F3D]/15 scale-[1.02]'
                        : 'bg-[#F8FAFC] border-slate-200 shadow-sm'
                    }`}
                  >
                    {/* Badge de Estado: "Llamando Ahora" vs "En Box / Consultorio" */}
                    <div className="flex items-center justify-center">
                      {estaLlamando ? (
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E76F3D] text-white text-xs font-black tracking-wider uppercase animate-pulse shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span>¡Llamando Ahora!</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF9F7] text-[#1D7A70] text-xs font-bold border border-[#80DDD2]/50">
                          <span className="w-2 h-2 rounded-full bg-[#2EA89B]" />
                          <span>En Atención Médica</span>
                        </span>
                      )}
                    </div>

                    {/* NÚMERO DE TURNO GIGANTE (Legibilidad 4K) */}
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Turno Convocado
                      </p>
                      <div 
                        className="font-mono font-black text-5xl lg:text-7xl tracking-tight leading-none"
                        style={{ color: estaLlamando ? '#E76F3D' : '#1D7A70' }}
                      >
                        {codigoGrupo}-{String(enAtencion.turno_num).padStart(2, '0')}
                      </div>
                    </div>

                    {/* Nombre del Paciente */}
                    <div className="pt-2 border-t border-slate-200/70">
                      <h3 className="text-2xl lg:text-3xl font-black text-slate-900 leading-tight">
                        {enAtencion.nombre_paciente}
                      </h3>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        {enAtencion.cedula_paciente || 'Cédula Registrada'}
                      </p>
                    </div>

                    {/* Consultorio / Box Asignado */}
                    <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Pasar a Consultorio / Box
                      </p>
                      <p className="text-sm font-black text-slate-800 mt-0.5">
                        {enAtencion.box_asignado || info.boxConsultorioDefecto}
                      </p>
                      <p className="text-[11px] text-[#2EA89B] font-semibold mt-0.5 line-clamp-1">
                        {enAtencion.estudio}
                      </p>
                    </div>
                  </div>
                  ))}
                  </div>
                ) : (
                  /* Box Disponible / En Espera de Llamado */
                  <div className="rounded-3xl p-8 border-2 border-dashed border-slate-200 text-center space-y-3 bg-[#F8FAFC]">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-700">Área Disponible</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {info.boxConsultorioDefecto}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-slate-500 text-xs">
                      En espera del próximo llamado
                    </Badge>
                  </div>
                )}
              </div>

              {/* 3. Lista Discreta al Pie: PRÓXIMOS 2 EN ESPERA */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Próximos en Espera:</span>
                  <span className="text-[11px] font-mono text-slate-400">Turno & Paciente</span>
                </div>

                {proximos.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
                    No hay turnos pendientes en cola
                  </div>
                ) : (
                  proximos.map((p, idx) => (
                    <div 
                      key={p.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50/90 rounded-2xl border border-slate-200/70 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span 
                          className="font-mono font-black text-xs px-2 py-0.5 rounded-lg"
                          style={{ backgroundColor: info.colorFondoSuave, color: info.colorTexto }}
                        >
                          {codigoGrupo}-{String(p.turno_num).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800 text-xs leading-none">
                            {p.nombre_paciente}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5">
                            {p.estudio}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-semibold">
                        Pos #{idx + 1}
                      </span>
                    </div>
                  ))
                )}
              </div>

            </div>
          );
        })}

      </main>

      {/* Footer Sereno y Amigable */}
      <footer className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#80DDD2] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2EA89B]"></span>
          </span>
          <span className="font-bold text-slate-700">Sistema Turnero Clínico Sereno</span>
          <span>• Por favor permanezca atento a su llamado en pantalla y altavoz</span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Centro Clínico Radiológico Imagen Salud, C.A.</span>
          <span>•</span>
          <span className="font-mono">Resolución TV 4K Ultra HD</span>
        </div>
      </footer>

    </div>
  );
}
