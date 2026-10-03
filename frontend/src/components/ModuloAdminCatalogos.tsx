'use client';

import React, { useState, useMemo, useRef } from 'react';
import { UserRole, PacienteCatalogo, DoctorCatalogo, ServicioCatalogo, GrupoClinico } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Users, Stethoscope, Activity, FileSpreadsheet, Building2 } from 'lucide-react';import { mapearEstudioAGrupo } from '@/lib/gruposClinicos';import { normalizarCedulaRif, extraerDigitos, validarEstructuraCedulaRif } from '@/lib/cedulaRif';import { calcularEdadReal } from '@/lib/date';import { leerHojaComoObjetos } from '@/lib/excel';
import { getErrorMessage } from '@/lib/utils';
import { ModalEstudio } from '@/components/admincatalogos/ModalEstudio';
import { ModalEspecialista } from '@/components/admincatalogos/ModalEspecialista';
import { ModalPaciente } from '@/components/admincatalogos/ModalPaciente';
import { TabCargaMasiva } from '@/components/admincatalogos/TabCargaMasiva';
import { TabEstudios } from '@/components/admincatalogos/TabEstudios';
import { TabEspecialistas } from '@/components/admincatalogos/TabEspecialistas';
import { TabPacientes } from '@/components/admincatalogos/TabPacientes';

interface ModuloAdminCatalogosProps {
  currentRole: UserRole;
}

// Catálogo Inicial de Pacientes
const PACIENTES_INICIALES: PacienteCatalogo[] = [
  {
    id: 1,
    cedula: 'V14589230',
    nombres: 'María Elena Rodríguez',
    telefono: '0414-1234567',
    fecha_nacimiento: '1984-05-12',
    direccion: 'Av. Las Delicias, Maracay',
    historial_visitas: 8,
    saldo_pendiente_usd: 0,
    saldo_pendiente_bs: 0,
    activo: true
  },
  {
    id: 2,
    cedula: 'V18754120',
    nombres: 'Carlos Alberto Gómez',
    telefono: '0424-9876543',
    fecha_nacimiento: '1988-08-20',
    direccion: 'El Castaño, Maracay',
    historial_visitas: 3,
    saldo_pendiente_usd: 15,
    saldo_pendiente_bs: 600,
    activo: true
  },
  {
    id: 3,
    cedula: 'V22345678',
    nombres: 'Daniela Sofía Mendoza',
    telefono: '0412-5554321',
    fecha_nacimiento: '1997-03-15',
    direccion: 'Turmero, Edo. Aragua',
    historial_visitas: 12,
    saldo_pendiente_usd: 0,
    saldo_pendiente_bs: 0,
    activo: true
  },
  {
    id: 4,
    cedula: 'V11234890',
    nombres: 'Roberto José Colmenares',
    telefono: '0416-3332211',
    fecha_nacimiento: '1970-11-04',
    direccion: 'La Victoria, Aragua',
    historial_visitas: 5,
    saldo_pendiente_usd: 0,
    saldo_pendiente_bs: 0,
    activo: true
  }
];

// Catálogo Inicial de Especialistas Médicos
const DOCTORES_INICIALES: DoctorCatalogo[] = [
  {
    id: 1,
    nombre: 'Dra. Carmen Teresa Velásquez',
    especialidad: 'Ginecología y Obstetricia',
    turno: 'AM',
    comision_pct: 70,
    activo: true,
    telefono: '0414-9988771',
    consultorio_defecto: 'Consultorio Ginecológico'
  },
  {
    id: 2,
    nombre: 'Dr. Leonardo Parra',
    especialidad: 'Radiología e Imagenología',
    turno: 'COMPLETO',
    comision_pct: 60,
    activo: true,
    telefono: '0424-7766554',
    consultorio_defecto: 'Sala Mamografía / Rayos X'
  },
  {
    id: 3,
    nombre: 'Dr. Miguel Ángel Rivas',
    especialidad: 'Medicina Interna',
    turno: 'PM',
    comision_pct: 65,
    activo: true,
    telefono: '0412-4433221',
    consultorio_defecto: 'Consultorio 2'
  },
  {
    id: 4,
    nombre: 'Dra. Andrea Morales',
    especialidad: 'Cardiología',
    turno: 'AM',
    comision_pct: 70,
    activo: true,
    telefono: '0416-1122334',
    consultorio_defecto: 'Consultorio 3'
  }
];

// Catálogo Inicial de Estudios Médicos y Tarifas
const SERVICIOS_INICIALES: ServicioCatalogo[] = [
  {
    id: 1,
    codigo: 'ECO-01',
    nombre: 'Ecografía Abdominal Completa',
    grupo_clinico: 'A',
    precio_usd: 35,
    reparto_clinica_pct: 35,
    reparto_medico_pct: 50,
    reparto_eco_pct: 15,
    reparto_patologo_pct: 0,
    activo: true,
    sala_defecto: 'Box Ecografía 1'
  },
  {
    id: 2,
    codigo: 'ECO-02',
    nombre: 'Ecografía Pélvica / Transvaginal',
    grupo_clinico: 'A',
    precio_usd: 30,
    reparto_clinica_pct: 35,
    reparto_medico_pct: 50,
    reparto_eco_pct: 15,
    reparto_patologo_pct: 0,
    activo: true,
    sala_defecto: 'Box Ecografía 1'
  },
  {
    id: 3,
    codigo: 'MAMO-01',
    nombre: 'Mamografía Digital Bilateral',
    grupo_clinico: 'B',
    precio_usd: 45,
    reparto_clinica_pct: 50,
    reparto_medico_pct: 50,
    reparto_eco_pct: 0,
    reparto_patologo_pct: 0,
    activo: true,
    sala_defecto: 'Sala de Mamografía Digital'
  },
  {
    id: 4,
    codigo: 'RX-01',
    nombre: 'Radiografía de Tórax PA / Lateral',
    grupo_clinico: 'B',
    precio_usd: 25,
    reparto_clinica_pct: 50,
    reparto_medico_pct: 50,
    reparto_eco_pct: 0,
    reparto_patologo_pct: 0,
    activo: true,
    sala_defecto: 'Sala de Rayos X'
  },
  {
    id: 5,
    codigo: 'MED-01',
    nombre: 'Consulta de Medicina Interna',
    grupo_clinico: 'C',
    precio_usd: 40,
    reparto_clinica_pct: 30,
    reparto_medico_pct: 70,
    reparto_eco_pct: 0,
    reparto_patologo_pct: 0,
    activo: true,
    sala_defecto: 'Consultorio 2'
  },
  {
    id: 6,
    codigo: 'BIO-01',
    nombre: 'Biopsia con Estudio Histopatológico',
    grupo_clinico: 'A',
    precio_usd: 80,
    reparto_clinica_pct: 30,
    reparto_medico_pct: 40,
    reparto_eco_pct: 0,
    reparto_patologo_pct: 30,
    activo: true,
    sala_defecto: 'Consultorio Ginecológico'
  }
];

export interface FilaDryRun {
  fila: number;
  cedula: string;
  paciente: string;
  estudio: string;
  doctor: string;
  precio_usd: number;
  grupo_clinico: GrupoClinico;
  estadoFila: 'VALIDO' | 'ADVERTENCIA' | 'ERROR';
  errores: string[];
  advertencias: string[];
}

export const ModuloAdminCatalogos: React.FC<ModuloAdminCatalogosProps> = ({ currentRole }) => {
  const [tabActiva, setTabActiva] = useState<'pacientes' | 'doctores' | 'servicios' | 'carga_masiva'>('pacientes');
  const [busqueda, setBusqueda] = useState('');

  // Estados de Catálogos
  const [pacientes, setPacientes] = useState<PacienteCatalogo[]>(PACIENTES_INICIALES);
  const [doctores, setDoctores] = useState<DoctorCatalogo[]>(DOCTORES_INICIALES);
  const [servicios, setServicios] = useState<ServicioCatalogo[]>(SERVICIOS_INICIALES);

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

  // Cargar Especialistas Médicos desde la Base de Datos
  const cargarDoctores = async () => {
    try {
      const res = await fetch('/api/medicos');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDoctores(data);
        }
      }
    } catch (err) {
      console.error('Error cargando especialistas:', err);
    }
  };

  React.useEffect(() => {
    cargarDoctores();
  }, []);

  // Estados de Carga Masiva Inteligente (Dry-Run)
  const [archivoCargado, setArchivoCargado] = useState<File | null>(null);
  const [filasDryRun, setFilasDryRun] = useState<FilaDryRun[]>([]);
  const [procesandoDryRun, setProcesandoDryRun] = useState(false);
  const [progresoImportacion, setProgresoImportacion] = useState<number | null>(null);
  const [importacionExitosa, setImportacionExitosa] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        fecha_nacimiento: '1995-01-01',
        direccion: '',
        historial_visitas: 0,
        saldo_pendiente_usd: 0,
        saldo_pendiente_bs: 0,
        activo: true
      });
      setModalPaciente({ visible: true });
    }
  };

  const handleGuardarPaciente = () => {
    setErrorDuplicadoPaciente(null);
    if (!formPaciente.cedula || !formPaciente.nombres) {
      setErrorDuplicadoPaciente('Cédula y Nombres son obligatorios.');
      return;
    }

    if (/\d/.test(formPaciente.nombres)) {
      setErrorDuplicadoPaciente('El nombre solo puede contener letras (sin números).');
      return;
    }

    if (formPaciente.telefono && /[a-zA-Z]/.test(formPaciente.telefono)) {
      setErrorDuplicadoPaciente('El teléfono solo puede contener números.');
      return;
    }

    const cedulaCanonica = normalizarCedulaRif(formPaciente.cedula);
    const digitos = extraerDigitos(formPaciente.cedula);

    // Validación preventiva anti-duplicidad por cédula
    const duplicado = pacientes.find(p => 
      extraerDigitos(p.cedula) === digitos && 
      String(p.id) !== String(modalPaciente.item?.id)
    );

    if (duplicado) {
      setErrorDuplicadoPaciente(`⚠️ Ya existe el paciente "${duplicado.nombres}" con la Cédula ${duplicado.cedula}. No se permiten duplicados.`);
      return;
    }

    const edadCalculada = formPaciente.fecha_nacimiento ? calcularEdadReal(formPaciente.fecha_nacimiento) : undefined;

    if (modalPaciente.item) {
      // Editar
      setPacientes(prev => prev.map(p => p.id === modalPaciente.item!.id ? { 
        ...p, 
        ...formPaciente, 
        cedula: cedulaCanonica,
        nombres: formPaciente.nombres!.trim().toUpperCase(),
        direccion: (formPaciente.direccion || '').trim().toUpperCase(),
        edad: edadCalculada
      } as PacienteCatalogo : p));
    } else {
      // Crear nuevo
      const nuevo: PacienteCatalogo = {
        id: Date.now(),
        cedula: cedulaCanonica,
        nombres: formPaciente.nombres.trim().toUpperCase(),
        telefono: formPaciente.telefono || '',
        fecha_nacimiento: formPaciente.fecha_nacimiento || '',
        edad: edadCalculada,
        direccion: (formPaciente.direccion || '').trim().toUpperCase(),
        historial_visitas: 1,
        saldo_pendiente_usd: Number(formPaciente.saldo_pendiente_usd) || 0,
        saldo_pendiente_bs: Number(formPaciente.saldo_pendiente_bs) || 0,
        activo: true
      };
      setPacientes([nuevo, ...pacientes]);
    }
    setModalPaciente({ visible: false });
  };

  const handleToggleEstadoPaciente = (id: number | string) => {
    if (isReadOnly) return alert('Acción exclusiva para administradores.');
    setPacientes(prev => prev.map(p => p.id === id ? { ...p, activo: !p.activo } : p));
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
        grupo_clinico: 'A',
        precio_usd: 30,
        reparto_clinica_pct: 35,
        reparto_medico_pct: 50,
        reparto_eco_pct: 15,
        reparto_patologo_pct: 0,
        activo: true,
        sala_defecto: 'Box Ecografía 1'
      });
      setModalServicio({ visible: true });
    }
  };

  const handleGuardarServicio = () => {
    if (!formServicio.nombre || !formServicio.precio_usd) {
      alert('Nombre y Precio Base son obligatorios.');
      return;
    }
    const grupo = formServicio.grupo_clinico || mapearEstudioAGrupo(formServicio.nombre);
    if (modalServicio.item) {
      setServicios(prev => prev.map(s => s.id === modalServicio.item!.id ? { 
        ...s, 
        ...formServicio, 
        nombre: formServicio.nombre!.trim().toUpperCase(),
        grupo_clinico: grupo 
      } as ServicioCatalogo : s));
    } else {
      const nuevo: ServicioCatalogo = {
        id: Date.now(),
        codigo: formServicio.codigo || `EST-${Math.floor(Math.random() * 900 + 100)}`,
        nombre: formServicio.nombre.trim().toUpperCase(),
        grupo_clinico: grupo,
        precio_usd: Number(formServicio.precio_usd),
        reparto_clinica_pct: Number(formServicio.reparto_clinica_pct) || 35,
        reparto_medico_pct: Number(formServicio.reparto_medico_pct) || 50,
        reparto_eco_pct: Number(formServicio.reparto_eco_pct) || 0,
        reparto_patologo_pct: Number(formServicio.reparto_patologo_pct) || 0,
        activo: true,
        sala_defecto: (formServicio.sala_defecto || 'Consultorio General').toUpperCase()
      };
      setServicios([...servicios, nuevo]);
    }
    setModalServicio({ visible: false });
  };

  const handleToggleEstadoServicio = (id: number | string) => {
    if (isReadOnly) return alert('Acción exclusiva para administradores.');
    setServicios(prev => prev.map(s => s.id === id ? { ...s, activo: !s.activo } : s));
  };

  // --- 4. CARGA MASIVA INTELIGENTE (.xlsx / .csv) CON DRY-RUN ---
  const handleSubirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoCargado(file);
    procesarArchivoDryRun(file);
  };

  const procesarArchivoDryRun = (file: File) => {
    setProcesandoDryRun(true);
    setImportacionExitosa(false);
    (async () => {
      try {
        const rows = await leerHojaComoObjetos(await file.arrayBuffer(), file.name);

        // Pre-validaciones por fila (Dry-Run)
        const cedulasVistas = new Set<string>();
        const analizadas = rows.map((r, idx) => {
          const cedula = String(r.cedula || r.Cedula || r.identificacion || '').trim().toUpperCase();
          const paciente = String(r.paciente || r.nombre || r.Paciente || '').trim();
          const estudio = String(r.estudio || r.servicio || r.Estudio || '').trim();
          const doctor = String(r.medico || r.doctor || r.Doctor || '').trim();
          const precio = Number(r.precio || r.monto || r.precio_usd || 0);

          const errores: string[] = [];
          const advertencias: string[] = [];

          // 1. Detección de duplicados en el lote
          if (cedula && cedulasVistas.has(cedula)) {
            advertencias.push('Cédula repetida dentro del archivo');
          }
          if (cedula) cedulasVistas.add(cedula);

          // 2. Detección de estudio sin precio
          if (!precio || precio <= 0) {
            errores.push('Estudio sin tarifa / Precio 0');
          }

          // 3. Detección de datos mínimos faltantes
          if (!paciente) errores.push('Nombre del paciente vacío');
          if (!estudio) errores.push('Nombre del estudio vacío');

          // 4. Detección de médico no registrado
          const doctorExiste = doctores.some(d => d.nombre.toLowerCase().includes(doctor.toLowerCase()));
          if (doctor && !doctorExiste) {
            advertencias.push(`Médico "${doctor}" no figura en catálogo`);
          }

          const estadoFila: 'VALIDO' | 'ADVERTENCIA' | 'ERROR' =
            errores.length > 0 ? 'ERROR' : advertencias.length > 0 ? 'ADVERTENCIA' : 'VALIDO';

          return {
            fila: idx + 2,
            cedula: cedula || 'S/C',
            paciente: paciente || 'DESCONOCIDO',
            estudio: estudio || 'ESTUDIO NO ESPECIFICADO',
            doctor: doctor || 'De Guardia',
            precio_usd: precio,
            grupo_clinico: mapearEstudioAGrupo(estudio),
            estadoFila,
            errores,
            advertencias
          };
        });

        setFilasDryRun(analizadas);
      } catch (err) {
        console.error('Error parseando archivo:', err);
        alert('Error al leer el archivo. Asegúrese de que sea un formato .xlsx o .csv válido.');
      } finally {
        setProcesandoDryRun(false);
      }
    })();
  };

  const handleConfirmarImportacion = async () => {
    if (filasDryRun.length === 0) return;
    const filasValidas = filasDryRun.filter(f => f.estadoFila !== 'ERROR');
    if (filasValidas.length === 0) {
      alert('No hay filas válidas para importar. Por favor corrija los errores.');
      return;
    }

    setProgresoImportacion(10);
    // Simulación de procesamiento por lotes con barra de progreso
    for (let p = 25; p <= 100; p += 25) {
      await new Promise(res => setTimeout(res, 200));
      setProgresoImportacion(p);
    }

    // Persistencia en memoria
    const nuevosPacientes: PacienteCatalogo[] = filasValidas.map((f, idx) => ({
      id: Date.now() + idx,
      cedula: f.cedula,
      nombres: f.paciente,
      telefono: '0414-0000000',
      fecha_nacimiento: '1990-01-01',
      direccion: 'Importado por Lote',
      historial_visitas: 1,
      saldo_pendiente_usd: 0,
      saldo_pendiente_bs: 0,
      activo: true
    }));

    setPacientes(prev => [...nuevosPacientes, ...prev]);
    setProgresoImportacion(null);
    setImportacionExitosa(true);
  };

  // Contadores de Dry-Run
  const statsDryRun = useMemo(() => {
    const total = filasDryRun.length;
    const validas = filasDryRun.filter(f => f.estadoFila === 'VALIDO').length;
    const advertencias = filasDryRun.filter(f => f.estadoFila === 'ADVERTENCIA').length;
    const errores = filasDryRun.filter(f => f.estadoFila === 'ERROR').length;
    return { total, validas, advertencias, errores };
  }, [filasDryRun]);

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
        <TabCargaMasiva handleSubirArchivo={handleSubirArchivo} fileInputRef={fileInputRef} progresoImportacion={progresoImportacion} importacionExitosa={importacionExitosa} setFilasDryRun={setFilasDryRun} setImportacionExitosa={setImportacionExitosa} filasDryRun={filasDryRun} statsDryRun={statsDryRun} handleConfirmarImportacion={handleConfirmarImportacion} />
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
    </div>
  );
};
