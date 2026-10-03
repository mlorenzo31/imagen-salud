'use client';

import React, { useState, useMemo, useRef } from 'react';
import { UserRole, PacienteCatalogo, DoctorCatalogo, ServicioCatalogo, GrupoClinico } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Stethoscope,
  Activity,
  FileSpreadsheet,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  DollarSign,
  Phone,
  CreditCard,
  Building2,
  Percent,
  UploadCloud,
  FileText,
  ShieldCheck,
  RefreshCw,
  Power
} from 'lucide-react';
import { GRUPOS_CLINICOS, mapearEstudioAGrupo } from '@/lib/gruposClinicos';
import { normalizarCedulaRif, extraerDigitos, sonMismoDocumento, validarEstructuraCedulaRif } from '@/lib/cedulaRif';
import { aFormatoInputDate, calcularEdadReal, formatearFechaNacimiento, hoyLocal } from '@/lib/date';
import {
  limpiarCedulaInput,
  limpiarNombreInput,
  limpiarTelefonoInput
} from '@/lib/pacienteValidation';
import * as XLSX from 'xlsx';
import { getErrorMessage } from '@/lib/utils';

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

interface FilaDryRun {
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
    const reader = new FileReader();

    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number | undefined>>(ws);

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
    };

    reader.readAsBinaryString(file);
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
        <div className="space-y-4">
          {/* Barra de Filtros y Botón Crear */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar por cédula o nombre..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
              />
            </div>
            {!isReadOnly && (
              <Button
                onClick={() => handleAbrirEditarPaciente()}
                className="h-9 px-4 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Paciente</span>
              </Button>
            )}
          </div>

          {/* Grid de Tarjetas Interactivas de Pacientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pacientes
              .filter(p => p.nombres.toLowerCase().includes(busqueda.toLowerCase()) || p.cedula.toLowerCase().includes(busqueda.toLowerCase()))
              .map(p => (
                <Card
                  key={p.id}
                  className={`border bg-white rounded-2xl transition-all shadow-xs hover:shadow-md ${
                    p.activo ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/70 opacity-75'
                  }`}
                >
                  <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-start justify-between pb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EBF9F7] text-[#1D7A70] flex items-center justify-center font-black text-sm shrink-0 border border-[#80DDD2]/50">
                        {p.nombres.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 leading-snug">{p.nombres}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-bold text-[#1D7A70]">{p.cedula}</span>
                          <Badge variant="outline" className="text-[10px] font-bold py-0.5 px-2 bg-teal-50 text-teal-800 border-teal-200">
                            {p.fecha_nacimiento ? `${calcularEdadReal(p.fecha_nacimiento)} años` : (p.edad ? `${p.edad} años` : 'Edad N/R')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Badge className={p.activo ? 'bg-emerald-100 text-emerald-800 text-[10px]' : 'bg-slate-200 text-slate-600 text-[10px]'}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.telefono || 'Sin teléfono registrado'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400 text-[11px]">Historial de Atenciones:</span>
                        <span className="font-bold text-slate-800">{p.historial_visitas} visitas</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Saldo Pendiente:</span>
                        <span className={`font-mono font-black ${p.saldo_pendiente_usd > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          ${p.saldo_pendiente_usd.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAbrirEditarPaciente(p)}
                          className="flex-1 h-8 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Editar Datos</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleEstadoPaciente(p.id)}
                          className={`h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200 ${
                            p.activo ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                          title={p.activo ? 'Inactivar Paciente' : 'Activar Paciente'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* 2. PESTAÑA: ESPECIALISTAS MÉDICOS EN TARJETAS INTERACTIVAS */}
      {tabActiva === 'doctores' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar por médico o especialidad..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
              />
            </div>
            {!isReadOnly && (
              <Button
                onClick={() => handleAbrirEditarDoctor()}
                className="h-9 px-4 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Especialista</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {doctores
              .filter(d => d.nombre.toLowerCase().includes(busqueda.toLowerCase()) || d.especialidad.toLowerCase().includes(busqueda.toLowerCase()))
              .map(d => (
                <Card
                  key={d.id}
                  className={`border bg-white rounded-2xl transition-all shadow-xs hover:shadow-md ${
                    d.activo ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/70 opacity-75'
                  }`}
                >
                  <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-start justify-between pb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-800 flex items-center justify-center shrink-0 border border-cyan-200">
                        <Stethoscope className="w-5 h-5 text-[#1D7A70]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-slate-900 leading-snug truncate">{d.nombre}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {d.cedula_rif || 'Sin Registrar'}
                          </span>
                          <p className="text-xs text-slate-500 font-medium truncate">{d.especialidad}</p>
                        </div>
                      </div>
                    </div>
                    <Badge className={d.activo ? 'bg-emerald-100 text-emerald-800 text-[10px]' : 'bg-slate-200 text-slate-600 text-[10px]'}>
                      {d.activo ? 'Operativo' : 'Inactivo'}
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Turno Asignado</span>
                        <div className="flex items-center gap-1 mt-0.5 font-bold text-slate-800">
                          <Clock className="w-3 h-3 text-[#1D7A70]" />
                          <span>{d.turno === 'AM' ? 'Mañana (AM)' : d.turno === 'PM' ? 'Tarde (PM)' : 'Jornada Completa'}</span>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Honorario Pactado</span>
                        <div className="flex items-center gap-1 mt-0.5 font-mono font-black text-[#1D7A70]">
                          <Percent className="w-3 h-3 text-[#1D7A70]" />
                          <span>{d.comision_pct}% Comisión</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>Consultorio habitual:</span>
                      <span className="font-semibold text-slate-700">{d.consultorio_defecto}</span>
                    </div>

                    {!isReadOnly && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAbrirEditarDoctor(d)}
                          className="flex-1 h-8 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Editar Especialista</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleEstadoDoctor(d.id)}
                          className={`h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200 ${
                            d.activo ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                          title={d.activo ? 'Desactivar Operativamente' : 'Activar Médico'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* 3. PESTAÑA: ESTUDIOS MÉDICOS Y TARIFAS EN TARJETAS INTERACTIVAS */}
      {tabActiva === 'servicios' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar por estudio o código..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
              />
            </div>
            {!isReadOnly && (
              <Button
                onClick={() => handleAbrirEditarServicio()}
                className="h-9 px-4 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Estudio / Tarifa</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {servicios
              .filter(s => s.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (s.codigo && s.codigo.toLowerCase().includes(busqueda.toLowerCase())))
              .map(s => {
                const infoGrupo = GRUPOS_CLINICOS[s.grupo_clinico];
                return (
                  <Card
                    key={s.id}
                    className={`border bg-white rounded-2xl transition-all shadow-xs hover:shadow-md ${
                      s.activo ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/70 opacity-75'
                    }`}
                  >
                    <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-start justify-between pb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            style={{
                              backgroundColor: infoGrupo.colorFondoSuave,
                              color: infoGrupo.colorTexto,
                              borderColor: infoGrupo.colorBorde
                            }}
                            className="border text-[9px] font-black uppercase tracking-wider"
                          >
                            Grupo {s.grupo_clinico}: {infoGrupo.nombreCorto}
                          </Badge>
                          {s.codigo && (
                            <span className="font-mono text-[10px] text-slate-400 font-bold">
                              #{s.codigo}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-slate-900 leading-snug">{s.nombre}</h4>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-base font-mono font-black text-[#1D7A70]">
                          ${s.precio_usd.toFixed(2)}
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3">
                      {/* Desglose de Regla de Reparto */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                          Regla de Reparto Financiero:
                        </span>
                        <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                          <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                            <span className="text-emerald-700 block font-bold">Clínica</span>
                            <span className="font-black text-emerald-900">{s.reparto_clinica_pct}%</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-cyan-50 border border-cyan-200">
                            <span className="text-cyan-700 block font-bold">Médico</span>
                            <span className="font-black text-cyan-900">{s.reparto_medico_pct}%</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200">
                            <span className="text-indigo-700 block font-bold">Ecógrafo</span>
                            <span className="font-black text-indigo-900">{s.reparto_eco_pct}%</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200">
                            <span className="text-purple-700 block font-bold">Patólogo</span>
                            <span className="font-black text-purple-900">{s.reparto_patologo_pct}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Sala asignada:</span>
                        <span className="font-semibold text-slate-700">{s.sala_defecto || 'Box General'}</span>
                      </div>

                      {!isReadOnly && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAbrirEditarServicio(s)}
                            className="flex-1 h-8 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                            <span>Editar Tarifa</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleEstadoServicio(s.id)}
                            className={`h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200 ${
                              s.activo ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                            title={s.activo ? 'Desactivar Estudio (sin alterar históricos)' : 'Reactivar Estudio'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* 4. PESTAÑA: CARGA MASIVA INTELIGENTE (.xlsx / .csv) CON DRY-RUN */}
      {tabActiva === 'carga_masiva' && (
        <div className="space-y-5">
          {/* Zona Drag & Drop */}
          <Card className="border-2 border-dashed border-[#80DDD2] bg-gradient-to-b from-[#EBF9F7]/40 to-white rounded-2xl p-8 text-center">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-[#80DDD2] text-[#1D7A70] flex items-center justify-center mx-auto">
                <UploadCloud className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Carga Masiva Inteligente de Pacientes y Estudios
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Arrastra o selecciona un archivo <span className="font-bold text-slate-700">.xlsx</span> o <span className="font-bold text-slate-700">.csv</span>. El sistema ejecutará un análisis previo fila por fila (Dry-Run) antes de persistir datos.
                </p>
              </div>
              <div className="pt-2">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleSubirArchivo}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold px-5 h-9 shadow-sm"
                >
                  Seleccionar Archivo de Excel / CSV
                </Button>
              </div>
            </div>
          </Card>

          {/* Barra de Progreso Reactiva */}
          {progresoImportacion !== null && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Procesando e insertando lote en base de datos...</span>
                <span>{progresoImportacion}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#1D7A70] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progresoImportacion}%` }}
                />
              </div>
            </div>
          )}

          {/* Notificación de Éxito */}
          {importacionExitosa && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>¡Lote de datos importado exitosamente en el catálogo activo!</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFilasDryRun([]); setImportacionExitosa(false); }}
                className="h-7 text-xs border-emerald-300 text-emerald-800"
              >
                Limpiar Vista
              </Button>
            </div>
          )}

          {/* Resumen Dry-Run y Tabla de Previsualización */}
          {filasDryRun.length > 0 && (
            <div className="space-y-4">
              {/* Contadores Estadísticos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Filas</span>
                  <p className="text-base font-black text-slate-900">{statsDryRun.total}</p>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Válidas</span>
                  <p className="text-base font-black text-emerald-800">{statsDryRun.validas}</p>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-center">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Con Advertencias</span>
                  <p className="text-base font-black text-amber-800">{statsDryRun.advertencias}</p>
                </div>
                <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 text-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Errores Bloqueantes</span>
                  <p className="text-base font-black text-rose-800">{statsDryRun.errores}</p>
                </div>
              </div>

              {/* Botón de Confirmación en Lote */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">
                  Previsualización fila por fila. Se excluirán automáticamente las filas con errores críticos.
                </p>
                <Button
                  onClick={handleConfirmarImportacion}
                  disabled={progresoImportacion !== null || statsDryRun.validas + statsDryRun.advertencias === 0}
                  className="rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold px-4 h-9 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Confirmar e Importar Lote ({statsDryRun.validas + statsDryRun.advertencias})
                </Button>
              </div>

              {/* Tabla de Dry-Run */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Fila</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3">Cédula</th>
                      <th className="py-2.5 px-3">Paciente</th>
                      <th className="py-2.5 px-3">Estudio</th>
                      <th className="py-2.5 px-3">Grupo</th>
                      <th className="py-2.5 px-3">Médico</th>
                      <th className="py-2.5 px-3 text-right">Tarifa ($)</th>
                      <th className="py-2.5 px-3">Diagnóstico Preventivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filasDryRun.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-400">#{f.fila}</td>
                        <td className="py-2.5 px-3">
                          {f.estadoFila === 'VALIDO' && (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[9px]">Válido</Badge>
                          )}
                          {f.estadoFila === 'ADVERTENCIA' && (
                            <Badge className="bg-amber-100 text-amber-800 text-[9px]">Advertencia</Badge>
                          )}
                          {f.estadoFila === 'ERROR' && (
                            <Badge className="bg-rose-100 text-rose-800 text-[9px]">Error</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{f.cedula}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{f.paciente}</td>
                        <td className="py-2.5 px-3 text-slate-700">{f.estudio}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[9px] font-bold">
                            Grupo {f.grupo_clinico}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{f.doctor}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-[#1D7A70]">
                          ${f.precio_usd.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          {f.errores.map((e: string, i: number) => (
                            <span key={i} className="text-rose-600 font-bold block">✕ {e}</span>
                          ))}
                          {f.advertencias.map((a: string, i: number) => (
                            <span key={i} className="text-amber-600 block">⚠ {a}</span>
                          ))}
                          {f.estadoFila === 'VALIDO' && (
                            <span className="text-emerald-600">✓ Listo para importar</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: EDITAR / CREAR PACIENTE */}
      {modalPaciente.visible && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900">
              {modalPaciente.item ? 'Editar Datos del Paciente' : 'Registrar Nuevo Paciente'}
            </h3>

            {errorDuplicadoPaciente && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorDuplicadoPaciente}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Cédula de Identidad <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formPaciente.cedula || ''}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    const prefijo = val.charAt(0);
                    if (['V', 'E', 'J', 'G', 'P'].includes(prefijo)) {
                      const digitos = limpiarCedulaInput(val.slice(1), prefijo === 'P' ? 'P' : 'V');
                      setFormPaciente({ ...formPaciente, cedula: `${prefijo}${digitos}` });
                    } else {
                      setFormPaciente({ ...formPaciente, cedula: limpiarCedulaInput(val, 'V') });
                    }
                    if (errorDuplicadoPaciente) setErrorDuplicadoPaciente(null);
                  }}
                  placeholder="Ej: V23196410 (Solo números)"
                  className="h-8 text-xs rounded-xl font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Nombres y Apellidos <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formPaciente.nombres || ''}
                  onChange={e => setFormPaciente({ ...formPaciente, nombres: limpiarNombreInput(e.target.value) })}
                  placeholder="Nombre completo (sin números)"
                  className="h-8 text-xs rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Teléfono</label>
                  <Input
                    value={formPaciente.telefono || ''}
                    onChange={e => setFormPaciente({ ...formPaciente, telefono: limpiarTelefonoInput(e.target.value) })}
                    maxLength={11}
                    placeholder="04141234567"
                    className="h-8 text-xs rounded-xl font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 block">F. Nacimiento</label>
                    {formPaciente.fecha_nacimiento && (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        {calcularEdadReal(formPaciente.fecha_nacimiento)} años
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={aFormatoInputDate(formPaciente.fecha_nacimiento)}
                    onChange={e => setFormPaciente({ ...formPaciente, fecha_nacimiento: e.target.value })}
                    max={hoyLocal()}
                    className="h-8 text-xs rounded-xl font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Dirección Habitual</label>
                <Input
                  value={formPaciente.direccion || ''}
                  onChange={e => setFormPaciente({ ...formPaciente, direccion: e.target.value.toUpperCase() })}
                  placeholder="Ciudad / Municipio"
                  className="h-8 text-xs rounded-xl uppercase placeholder:normal-case"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setModalPaciente({ visible: false })}
                className="flex-1 h-8 rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGuardarPaciente}
                className="flex-1 h-8 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold"
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR / CREAR ESPECIALISTA CON BLINDAJE ANTI-DUPLICIDAD */}
      {modalDoctor.visible && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {modalDoctor.item ? 'Editar Especialista Médico' : 'Registrar Nuevo Especialista'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                La Cédula o RIF se valida para impedir registros duplicados en el cuerpo médico.
              </p>
            </div>

            {errorDuplicadoDoctor && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorDuplicadoDoctor}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Cédula / RIF del Especialista <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formDoctor.cedula_rif || ''}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    const prefijo = val.charAt(0);
                    if (['V', 'E', 'J', 'G'].includes(prefijo)) {
                      const digitos = val.slice(1).replace(/\D/g, '').slice(0, 9);
                      setFormDoctor({ ...formDoctor, cedula_rif: `${prefijo}${digitos}` });
                    } else {
                      setFormDoctor({ ...formDoctor, cedula_rif: val.replace(/\D/g, '').slice(0, 9) });
                    }
                    if (errorDuplicadoDoctor) setErrorDuplicadoDoctor(null);
                  }}
                  placeholder="Ej: V12345678 o J315046482"
                  className="h-8 text-xs rounded-xl font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Nombre Completo (Dr. / Dra.) <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formDoctor.nombre || ''}
                  onChange={e => setFormDoctor({ ...formDoctor, nombre: limpiarNombreInput(e.target.value) })}
                  placeholder="Dr. Nombre Apellido"
                  className="h-8 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Especialidad Médica <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formDoctor.especialidad || ''}
                  onChange={e => setFormDoctor({ ...formDoctor, especialidad: e.target.value.toUpperCase() })}
                  placeholder="Ej. Ginecología, Radiología, Traumatología"
                  className="h-8 text-xs rounded-xl uppercase placeholder:normal-case font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Turno Asignado</label>
                  <select
                    value={formDoctor.turno || 'AM'}
                    onChange={e => setFormDoctor({ ...formDoctor, turno: e.target.value as DoctorCatalogo['turno'] })}
                    className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                  >
                    <option value="AM">Mañana (AM)</option>
                    <option value="PM">Tarde (PM)</option>
                    <option value="COMPLETO">Jornada Completa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Honorario (% Comisión)</label>
                  <Input
                    type="number"
                    value={formDoctor.comision_pct || ''}
                    onChange={e => setFormDoctor({ ...formDoctor, comision_pct: parseFloat(e.target.value) || 0 })}
                    placeholder="70"
                    className="h-8 text-xs rounded-xl font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Consultorio / Box Habitual</label>
                <Input
                  value={formDoctor.consultorio_defecto || ''}
                  onChange={e => setFormDoctor({ ...formDoctor, consultorio_defecto: e.target.value.toUpperCase() })}
                  placeholder="Consultorio 1"
                  className="h-8 text-xs rounded-xl uppercase placeholder:normal-case"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                disabled={guardandoDoctor}
                onClick={() => setModalDoctor({ visible: false })}
                className="flex-1 h-8 rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                disabled={guardandoDoctor}
                onClick={handleGuardarDoctor}
                className="flex-1 h-8 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold"
              >
                {guardandoDoctor ? 'Guardando...' : 'Guardar Especialista'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR / CREAR ESTUDIO Y TARIFAS */}
      {modalServicio.visible && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900">
              {modalServicio.item ? 'Editar Tarifa y Estudio Médico' : 'Crear Nuevo Estudio y Tarifa'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Nombre del Estudio / Procedimiento</label>
                <Input
                  value={formServicio.nombre || ''}
                  onChange={e => setFormServicio({ ...formServicio, nombre: e.target.value.toUpperCase() })}
                  placeholder="Nombre oficial del estudio"
                  className="h-8 text-xs rounded-xl uppercase placeholder:normal-case font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Grupo Clínico</label>
                  <select
                    value={formServicio.grupo_clinico || 'A'}
                    onChange={e => setFormServicio({ ...formServicio, grupo_clinico: e.target.value as ServicioCatalogo['grupo_clinico'] })}
                    className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                  >
                    <option value="A">Grupo A: Ginecología & Eco</option>
                    <option value="B">Grupo B: Mamo & Rayos X</option>
                    <option value="C">Grupo C: Consultas Médicas</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Precio Base ($ USD)</label>
                  <Input
                    type="number"
                    value={formServicio.precio_usd || ''}
                    onChange={e => setFormServicio({ ...formServicio, precio_usd: parseFloat(e.target.value) || 0 })}
                    placeholder="35"
                    className="h-8 text-xs rounded-xl font-mono font-bold text-[#1D7A70]"
                  />
                </div>
              </div>

              {/* Repartos Porcentuales */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Reglas de Reparto (%):</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block">Clínica %</label>
                    <Input
                      type="number"
                      value={formServicio.reparto_clinica_pct ?? 35}
                      onChange={e => setFormServicio({ ...formServicio, reparto_clinica_pct: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Médico %</label>
                    <Input
                      type="number"
                      value={formServicio.reparto_medico_pct ?? 50}
                      onChange={e => setFormServicio({ ...formServicio, reparto_medico_pct: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Ecógrafo %</label>
                    <Input
                      type="number"
                      value={formServicio.reparto_eco_pct ?? 0}
                      onChange={e => setFormServicio({ ...formServicio, reparto_eco_pct: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Patólogo %</label>
                    <Input
                      type="number"
                      value={formServicio.reparto_patologo_pct ?? 0}
                      onChange={e => setFormServicio({ ...formServicio, reparto_patologo_pct: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setModalServicio({ visible: false })}
                className="flex-1 h-8 rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGuardarServicio}
                className="flex-1 h-8 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold"
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
