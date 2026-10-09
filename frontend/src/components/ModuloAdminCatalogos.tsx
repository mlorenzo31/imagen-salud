'use client';

import React, { useState } from 'react';import { UserRole, PacienteCatalogo, DoctorCatalogo, ServicioCatalogo } from '@/types';import { Badge } from '@/components/ui/badge';
import { Users, Stethoscope, Activity, FileSpreadsheet, Building2, BadgePercent } from 'lucide-react';import { normalizarCedulaRif, extraerDigitos, validarEstructuraCedulaRif } from '@/lib/cedulaRif';import { calcularEdadReal } from '@/lib/date';import { getErrorMessage } from '@/lib/utils';
import { ModalEstudio } from '@/components/admincatalogos/ModalEstudio';
import { ModalEspecialista } from '@/components/admincatalogos/ModalEspecialista';
import { ModalPaciente } from '@/components/admincatalogos/ModalPaciente';
import { TabCargaMasiva } from '@/components/admincatalogos/TabCargaMasiva';
import { ModalCargaMasivaExcel } from '@/components/ModalCargaMasivaExcel';
import { TabEstudios } from '@/components/admincatalogos/TabEstudios';
import { PanelPromociones } from '@/components/admincatalogos/PanelPromociones';
import { TabEspecialistas } from '@/components/admincatalogos/TabEspecialistas';
import { TabPacientes } from '@/components/admincatalogos/TabPacientes';

interface ModuloAdminCatalogosProps {
  currentRole: UserRole;
}

const SALA_POR_AREA: Record<string, string> = {
  ECOGRAFIA_AM: 'SALA_ECO_AM', ECOGRAFIA_PM: 'SALA_ECO_PM', RADIOLOGIA: 'SALA_RAYOS_X',
  MAMOGRAFIA: 'SALA_MAMOGRAFIA', GINECOLOGIA: 'CONSULTORIO_GINECO', CONSULTAS: 'CONSULTORIO_GENERAL',
};

/** Fila de /api/pacientes (con visitas y saldo calculados en el servidor). */
interface PacienteApi {
  id: number; cedula: string; nombre: string; telefono?: string | null; fecha_nacimiento?: string | null; sexo?: 'M' | 'F' | null;
  direccion?: string | null; activo?: boolean; visitas?: number; saldo_pendiente_usd?: string | number;
}

export const ModuloAdminCatalogos: React.FC<ModuloAdminCatalogosProps> = ({ currentRole }) => {
  const [tabActiva, setTabActiva] = useState<'pacientes' | 'doctores' | 'servicios' | 'promociones' | 'carga_masiva'>('pacientes');
  const [busqueda, setBusqueda] = useState('');

  // Estados de Catálogos
  const [pacientes, setPacientes] = useState<PacienteCatalogo[]>([]);
  const [doctores, setDoctores] = useState<DoctorCatalogo[]>([]);
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([]);

  // Estados de Modales de Edición/Creación
  const [modalPaciente, setModalPaciente] = useState<{ visible: boolean; item?: PacienteCatalogo }>({ visible: false });
  const [modalDoctor, setModalDoctor] = useState<{ visible: boolean; item?: DoctorCatalogo }>({ visible: false });
  const [modalServicio, setModalServicio] = useState<{ visible: boolean; item?: ServicioCatalogo }>({ visible: false });

  // Estados de Formularios temporales y Validación Anti-Duplicidad
  const [formPaciente, setFormPaciente] = useState<Partial<PacienteCatalogo>>({});
  const [formDoctor, setFormDoctor] = useState<Partial<DoctorCatalogo>>({});
  const [formServicio, setFormServicio] = useState<Partial<ServicioCatalogo>>({});
  const [errorDuplicadoDoctor, setErrorDuplicadoDoctor] = useState<string | null>(null);
  const [errorDuplicadoPaciente, setErrorDuplicadoPaciente] = useState<string | null>(null);
  const [guardandoDoctor, setGuardandoDoctor] = useState(false);

  // Datos reales desde la base de datos (sin datos de muestra)
  const cargarDoctores = async () => {
    try {
      const res = await fetch('/api/medicos');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDoctores(data);
      }
    } catch (err) {
      console.error('Error cargando especialistas:', err);
    }
  };

  const cargarPacientes = async () => {
    try {
      const res = await fetch('/api/pacientes');
      if (!res.ok) return;
      const data: PacienteApi[] = await res.json();
      if (!Array.isArray(data)) return;
      setPacientes(data.map((p): PacienteCatalogo => {
        const fecha = p.fecha_nacimiento ? String(p.fecha_nacimiento).slice(0, 10) : '';
        return {
          id: p.id, cedula: p.cedula, nombres: p.nombre, telefono: p.telefono || '', fecha_nacimiento: fecha, sexo: p.sexo ?? null,
          edad: fecha ? calcularEdadReal(fecha) : undefined, direccion: p.direccion || '',
          historial_visitas: p.visitas ?? 0, saldo_pendiente_usd: Number(p.saldo_pendiente_usd) || 0, saldo_pendiente_bs: 0,
          activo: p.activo !== false,
        };
      }));
    } catch (err) {
      console.error('Error cargando pacientes:', err);
    }
  };

  const cargarServicios = async () => {
    try {
      const res = await fetch('/api/catalogo/estudios?lista=1');
      if (!res.ok) return;
      const data: { estudios: ServicioCatalogo[] } = await res.json();
      if (Array.isArray(data.estudios)) setServicios(data.estudios);
    } catch (err) {
      console.error('Error cargando estudios:', err);
    }
  };

  const cargarTodo = () => { cargarDoctores(); cargarPacientes(); cargarServicios(); };

  React.useEffect(() => {
    const t = setTimeout(cargarTodo, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [openCarga, setOpenCarga] = useState(false);

  const isReadOnly = currentRole !== 'admin';

  // --- 1. ACCIONES PACIENTES (CON BLINDAJE ANTI-DUPLICIDAD) ---
  const handleAbrirEditarPaciente = (p?: PacienteCatalogo) => {
    if (isReadOnly) return alert('Acción exclusiva para administradores.');
    setErrorDuplicadoPaciente(null);
    if (p) {
      setFormPaciente({ ...p, cedula: normalizarCedulaRif(p.cedula) });
      setModalPaciente({ visible: true, item: p });
    } else {
      setFormPaciente({
        cedula: '',
        nombres: '',
        telefono: '',
        fecha_nacimiento: '',
        sexo: null,
        direccion: '',
        historial_visitas: 0,
        saldo_pendiente_usd: 0,
        saldo_pendiente_bs: 0,
        activo: true
      });
      setModalPaciente({ visible: true });
    }
  };

  const handleGuardarPaciente = async () => {
    setErrorDuplicadoPaciente(null);
    if (!formPaciente.cedula || !formPaciente.nombres) {
      setErrorDuplicadoPaciente('Cédula y Nombres son obligatorios.');
      return;
    }
    if (/\d/.test(formPaciente.nombres)) {
      setErrorDuplicadoPaciente('El nombre solo puede contener letras (sin números).');
      return;
    }
    if (formPaciente.sexo !== 'M' && formPaciente.sexo !== 'F') {
      setErrorDuplicadoPaciente('Seleccione el sexo (M o F).');
      return;
    }
    if (formPaciente.telefono && /[a-zA-Z]/.test(formPaciente.telefono)) {
      setErrorDuplicadoPaciente('El teléfono solo puede contener números.');
      return;
    }

    const digitos = extraerDigitos(formPaciente.cedula);
    const duplicado = pacientes.find(p => extraerDigitos(p.cedula) === digitos && String(p.id) !== String(modalPaciente.item?.id));
    if (duplicado) {
      setErrorDuplicadoPaciente(`⚠️ Ya existe el paciente "${duplicado.nombres}" con la Cédula ${duplicado.cedula}. No se permiten duplicados.`);
      return;
    }

    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: normalizarCedulaRif(formPaciente.cedula),
          nombre: formPaciente.nombres.trim(),
          fecha_nacimiento: formPaciente.fecha_nacimiento || null,
          sexo: formPaciente.sexo,
          direccion: (formPaciente.direccion || '').trim(),
          telefono: (formPaciente.telefono || '').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorDuplicadoPaciente(data.error || 'No se pudo guardar el paciente.');
        return;
      }
      await cargarPacientes();
      setModalPaciente({ visible: false });
    } catch (err) {
      setErrorDuplicadoPaciente(getErrorMessage(err));
    }
  };

  const handleToggleEstadoPaciente = async (id: number | string) => {
    if (isReadOnly) return alert('Acción exclusiva para administradores.');
    const p = pacientes.find(x => x.id === id);
    if (!p) return;
    const res = await fetch('/api/pacientes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id), activo: !p.activo }),
    });
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error || 'No se pudo cambiar el estado.');
    await cargarPacientes();
  };

  // --- 2. ACCIONES ESPECIALISTAS (CON BLINDAJE ESTRICTO ANTI-DUPLICIDAD POR CÉDULA/RIF) ---
  const handleAbrirEditarDoctor = (d?: DoctorCatalogo) => {
    if (isReadOnly) return alert('Acción exclusiva para administradores.');
    setErrorDuplicadoDoctor(null);
    if (d) {
      setFormDoctor({ 
        ...d, 
        cedula_rif: normalizarCedulaRif(d.cedula_rif) 
      });
      setModalDoctor({ visible: true, item: d });
    } else {
      setFormDoctor({
        cedula_rif: '',
        nombre: '',
        especialidad: '',
        turno: 'AM',
        comision_pct: 70,
        activo: true,
        telefono: '',
        consultorio_defecto: 'Consultorio 1'
      });
      setModalDoctor({ visible: true });
    }
  };

  const handleGuardarDoctor = async () => {
    setErrorDuplicadoDoctor(null);
    if (!formDoctor.nombre || !formDoctor.especialidad) {
      setErrorDuplicadoDoctor('Nombre y Especialidad son requeridos.');
      return;
    }

    if (!formDoctor.cedula_rif) {
      setErrorDuplicadoDoctor('La Cédula o RIF del especialista es obligatoria para garantizar la no-duplicidad.');
      return;
    }

    const validacion = validarEstructuraCedulaRif(formDoctor.cedula_rif);
    if (!validacion.valido) {
      setErrorDuplicadoDoctor(validacion.mensaje || 'Formato de Cédula/RIF inválido.');
      return;
    }

    const cedulaCanonica = normalizarCedulaRif(formDoctor.cedula_rif);
    const digitosForm = extraerDigitos(formDoctor.cedula_rif);

    // Validación preventiva en frontend contra la lista de especialistas
    const duplicadoLocal = doctores.find(d => 
      extraerDigitos(d.cedula_rif) === digitosForm && 
      String(d.id) !== String(modalDoctor.item?.id)
    );

    if (duplicadoLocal) {
      setErrorDuplicadoDoctor(`⚠️ Ya existe el especialista "${duplicadoLocal.nombre}" con la Cédula/RIF ${duplicadoLocal.cedula_rif || cedulaCanonica}. No se permiten duplicados.`);
      return;
    }

    setGuardandoDoctor(true);
    try {
      const method = modalDoctor.item?.id ? 'PUT' : 'POST';
      const payload = {
        ...formDoctor,
        id: modalDoctor.item?.id,
        nombre: formDoctor.nombre?.trim().toUpperCase(),
        especialidad: formDoctor.especialidad?.trim().toUpperCase(),
        consultorio_defecto: formDoctor.consultorio_defecto?.trim().toUpperCase(),
        cedula_rif: cedulaCanonica
      };

      const res = await fetch('/api/medicos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (!res.ok) {
        setErrorDuplicadoDoctor(resData.error || 'Error guardando especialista en la base de datos.');
        return;
      }

      await cargarDoctores();
      setModalDoctor({ visible: false });
    } catch (err) {
      setErrorDuplicadoDoctor(getErrorMessage(err) || 'Error de conexión.');
    } finally {
      setGuardandoDoctor(false);
    }
  };

  const handleToggleEstadoDoctor = (id: number | string) => {
    if (isReadOnly) return alert('Acción exclusiva para administradores.');
    setDoctores(prev => prev.map(d => d.id === id ? { ...d, activo: !d.activo } : d));
  };

  // --- 3. ACCIONES ESTUDIOS Y TARIFAS ---
  const handleAbrirEditarServicio = (s?: ServicioCatalogo) => {
    if (isReadOnly) return alert('Acción exclusiva para administradores.');
    if (s) {
      setFormServicio({ ...s });
      setModalServicio({ visible: true, item: s });
    } else {
      setFormServicio({
        codigo: '',
        nombre: '',
        area: 'ECOGRAFIA_AM',
        precio_usd: 0,
        reparto_clinica_pct: 30,
        reparto_medico_pct: 30,
        reparto_eco_pct: 40,
        reparto_patologo_pct: 0,
        activo: true,
      });
      setModalServicio({ visible: true });
    }
  };

  const enviarServicio = async (id: number | string | null, body: Record<string, unknown>) => {
    const res = await fetch(id === null ? '/api/catalogo/estudios' : `/api/catalogo/estudios/${id}`, {
      method: id === null ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo guardar el estudio.');
  };

  const handleGuardarServicio = async () => {
    const precio = Number(formServicio.precio_usd) || 0;
    if (!formServicio.nombre?.trim() || precio <= 0) {
      alert('Nombre y Precio Base son obligatorios.');
      return;
    }
    const pct = (v?: number) => Math.max(0, Number(v) || 0);
    const pctClinica = pct(formServicio.reparto_clinica_pct), pctMedico = pct(formServicio.reparto_medico_pct);
    const pctEco = pct(formServicio.reparto_eco_pct), pctPatologo = pct(formServicio.reparto_patologo_pct);
    if (Math.abs(pctClinica + pctMedico + pctEco + pctPatologo - 100) > 0.01) {
      alert('Las reglas de reparto deben sumar exactamente 100%.');
      return;
    }
    // Reparto en centavos; la parte de la clínica es el resto para que la suma sea exactamente el precio.
    const precioC = Math.round(precio * 100);
    const medico = Math.round((precioC * pctMedico) / 100), eco = Math.round((precioC * pctEco) / 100), patologo = Math.round((precioC * pctPatologo) / 100);
    const imagen = precioC - medico - eco - patologo;
    if (imagen < 0) {
      alert('El reparto supera el precio del estudio.');
      return;
    }
    const area = formServicio.area || 'ECOGRAFIA_AM';
    try {
      await enviarServicio(modalServicio.item ? modalServicio.item.id : null, {
        codigo: formServicio.codigo?.trim() || null,
        area,
        nombre: formServicio.nombre.trim(),
        precio_usd: precioC / 100,
        sala: modalServicio.item?.sala_defecto || SALA_POR_AREA[area] || 'SALA_ECO_GINE',
        dist_imagen: imagen / 100, dist_medico: medico / 100, dist_eco: eco / 100, dist_patologo: patologo / 100,
        activo: formServicio.activo ?? true,
      });
      await cargarServicios();
      setModalServicio({ visible: false });
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleToggleEstadoServicio = async (id: number | string) => {
    if (isReadOnly) return alert('Acción exclusiva para administradores.');
    const s = servicios.find(x => x.id === id);
    if (!s || !s.dist || !s.area) return;
    try {
      await enviarServicio(s.id, {
        codigo: s.codigo || null, area: s.area, nombre: s.nombre, precio_usd: s.precio_usd, sala: s.sala_defecto || 'SALA_ECO_GINE',
        dist_imagen: s.dist.imagen, dist_medico: s.dist.medico, dist_eco: s.dist.eco, dist_patologo: s.dist.patologo, activo: !s.activo,
      });
      await cargarServicios();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-clinica-selection rounded-xl text-clinica-primary">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">Catálogos Maestros & Carga Masiva</h2>
              <Badge className="bg-[#1D7A70] text-white text-[10px] font-mono">
                ERP Clínico
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestión visual interactiva de pacientes, especialistas médicos, tarifas de estudios y motor inteligente de importación
            </p>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => { setTabActiva('pacientes'); setBusqueda(''); }}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              tabActiva === 'pacientes'
                ? 'bg-white text-[#1D7A70] shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Pacientes ({pacientes.length})</span>
          </button>

          <button
            onClick={() => { setTabActiva('doctores'); setBusqueda(''); }}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              tabActiva === 'doctores'
                ? 'bg-white text-[#1D7A70] shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Especialistas ({doctores.length})</span>
          </button>

          <button
            onClick={() => { setTabActiva('servicios'); setBusqueda(''); }}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              tabActiva === 'servicios'
                ? 'bg-white text-[#1D7A70] shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Estudios & Tarifas ({servicios.length})</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={() => { setTabActiva('promociones'); setBusqueda(''); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                tabActiva === 'promociones'
                  ? 'bg-white text-[#1D7A70] shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BadgePercent className="w-3.5 h-3.5" />
              <span>Promociones</span>
            </button>
          )}

          <button
            onClick={() => { setTabActiva('carga_masiva'); setBusqueda(''); }}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              tabActiva === 'carga_masiva'
                ? 'bg-white text-[#1D7A70] shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Carga Masiva</span>
          </button>
        </div>
      </div>

      {/* 1. PESTAÑA: PACIENTES EN TARJETAS INTERACTIVAS */}
      {tabActiva === 'pacientes' && (
        <TabPacientes busqueda={busqueda} setBusqueda={setBusqueda} isReadOnly={isReadOnly} handleAbrirEditarPaciente={handleAbrirEditarPaciente} pacientes={pacientes} handleToggleEstadoPaciente={handleToggleEstadoPaciente} />
      )}

      {tabActiva === 'promociones' && !isReadOnly && <PanelPromociones />}

      {/* 2. PESTAÑA: ESPECIALISTAS MÉDICOS EN TARJETAS INTERACTIVAS */}
      {tabActiva === 'doctores' && (
        <TabEspecialistas busqueda={busqueda} setBusqueda={setBusqueda} isReadOnly={isReadOnly} handleAbrirEditarDoctor={handleAbrirEditarDoctor} doctores={doctores} handleToggleEstadoDoctor={handleToggleEstadoDoctor} />
      )}

      {/* 3. PESTAÑA: ESTUDIOS MÉDICOS Y TARIFAS EN TARJETAS INTERACTIVAS */}
      {tabActiva === 'servicios' && (
        <TabEstudios busqueda={busqueda} setBusqueda={setBusqueda} isReadOnly={isReadOnly} handleAbrirEditarServicio={handleAbrirEditarServicio} servicios={servicios} handleToggleEstadoServicio={handleToggleEstadoServicio} />
      )}

      {/* 4. PESTAÑA: CARGA MASIVA INTELIGENTE (.xlsx / .csv) CON DRY-RUN */}
      {tabActiva === 'carga_masiva' && (
        <TabCargaMasiva onAbrir={() => setOpenCarga(true)} />
      )}

      {/* MODAL: EDITAR / CREAR PACIENTE */}
      {modalPaciente.visible && (
        <ModalPaciente modalPaciente={modalPaciente} errorDuplicadoPaciente={errorDuplicadoPaciente} formPaciente={formPaciente} setFormPaciente={setFormPaciente} setErrorDuplicadoPaciente={setErrorDuplicadoPaciente} setModalPaciente={setModalPaciente} handleGuardarPaciente={handleGuardarPaciente} />
      )}

      {/* MODAL: EDITAR / CREAR ESPECIALISTA CON BLINDAJE ANTI-DUPLICIDAD */}
      {modalDoctor.visible && (
        <ModalEspecialista modalDoctor={modalDoctor} errorDuplicadoDoctor={errorDuplicadoDoctor} formDoctor={formDoctor} setFormDoctor={setFormDoctor} setErrorDuplicadoDoctor={setErrorDuplicadoDoctor} guardandoDoctor={guardandoDoctor} setModalDoctor={setModalDoctor} handleGuardarDoctor={handleGuardarDoctor} />
      )}

      {/* MODAL: EDITAR / CREAR ESTUDIO Y TARIFAS */}
      {modalServicio.visible && (
        <ModalEstudio modalServicio={modalServicio} formServicio={formServicio} setFormServicio={setFormServicio} setModalServicio={setModalServicio} handleGuardarServicio={handleGuardarServicio} />
      )}

      <ModalCargaMasivaExcel open={openCarga} onOpenChange={setOpenCarga} onSuccess={cargarTodo} />
    </div>
  );
};
