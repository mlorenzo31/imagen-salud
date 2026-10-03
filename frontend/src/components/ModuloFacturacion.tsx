'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  UserPlus, 
  ShoppingCart, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Printer, 
  Search,
  DollarSign,
  Smartphone,
  Landmark,
  Receipt,
  UserCheck,
  ShieldCheck,
  Stethoscope,
  Microscope,
  Lock,
  Clock,
  Sparkles,
  RefreshCw,
  RotateCcw,
  X
} from 'lucide-react';
import { 
  ESTUDIOS_CLINICOS, 
  ESPECIALISTAS_MEDICOS, 
  PATOLOGO_OFICIAL, 
  EstudioItem, 
  EspecialistaItem 
} from '@/lib/catalogos';
import { facturaCreateSchema } from '@/lib/validations';
import { mapearEstudioAGrupo, GrupoClinico, GRUPOS_CLINICOS } from '@/lib/gruposClinicos';
import { normalizarCedulaRif, extraerDigitos } from '@/lib/cedulaRif';
import { calcularEdadReal, aFormatoInputDate } from '@/lib/date';
import {
  limpiarCedulaInput,
  limpiarNombreInput,
  limpiarTelefonoInput,
  validarFichaPaciente,
  FichaErrores
} from '@/lib/pacienteValidation';

interface ModuloFacturacionProps {
  onFacturaEmitida?: () => void;
}

interface CarritoItem {
  id: string;
  area: string;
  estudio: string;
  medico: string;
  precioUSD: number;
  sala: string;
  grupoClinico?: GrupoClinico;
  dist: {
    imagen: number;
    medico: number;
    eco: number;
    patologo: number;
  };
}

const FEATURE_IMPRENTA_DIGITAL = process.env.NEXT_PUBLIC_FEATURE_IMPRENTA_DIGITAL === 'true';

export const ModuloFacturacion: React.FC<ModuloFacturacionProps> = ({ onFacturaEmitida }) => {
  // Estado para gestión multi-estudio y prioridad inicial
  const [estudioPrincipalId, setEstudioPrincipalId] = useState<string | null>(null);
  const [mostrarModalPrioridad, setMostrarModalPrioridad] = useState<boolean>(false);
  const [alertaExito, setAlertaExito] = useState<{ visible: boolean; mensaje: string; estudioPrincipal?: string; totalUSD: number } | null>(null);
  // Ficha Paciente y Estados
  const [tipoDoc, setTipoDoc] = useState<'V' | 'E' | 'J' | 'P'>('V');
  const [cedula, setCedula] = useState<string>('');
  const [nombre, setNombre] = useState<string>('');
  const [fechaNacimiento, setFechaNacimiento] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [erroresFicha, setErroresFicha] = useState<FichaErrores>({});
  
  // Estado del Paciente en BD
  const [pacienteExiste, setPacienteExiste] = useState<boolean | null>(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState<boolean>(false);
  const [guardandoPaciente, setGuardandoPaciente] = useState<boolean>(false);

  // Limpieza reactiva integral de la ficha del paciente al cambiar o corregir cédula
  const limpiarDatosPaciente = () => {
    setNombre('');
    setFechaNacimiento('');
    setTelefono('');
    setDireccion('');
    setPacienteExiste(null);
    setErroresFicha({});
  };

  const limpiarFichaCompleta = () => {
    setCedula('');
    limpiarDatosPaciente();
  };

  const handleCedulaChange = (nuevaCedula: string) => {
    const limpia = limpiarCedulaInput(nuevaCedula, tipoDoc);
    setCedula(limpia);
    limpiarDatosPaciente();
    if (erroresFicha.cedula) {
      setErroresFicha(prev => ({ ...prev, cedula: undefined }));
    }
  };

  const handleTipoDocChange = (nuevoTipo: 'V' | 'E' | 'J' | 'P') => {
    setTipoDoc(nuevoTipo);
    setCedula(prev => limpiarCedulaInput(prev, nuevoTipo));
    limpiarDatosPaciente();
  };

  const handleNombreChange = (nuevoNombre: string) => {
    const limpio = limpiarNombreInput(nuevoNombre);
    setNombre(limpio);
    if (erroresFicha.nombre) {
      setErroresFicha(prev => ({ ...prev, nombre: undefined }));
    }
  };

  const handleTelefonoChange = (nuevoTel: string) => {
    const limpio = limpiarTelefonoInput(nuevoTel);
    setTelefono(limpio);
    if (erroresFicha.telefono) {
      setErroresFicha(prev => ({ ...prev, telefono: undefined }));
    }
  };

  const handleFechaNacimientoChange = (nuevaFecha: string) => {
    setFechaNacimiento(nuevaFecha);
    if (erroresFicha.fecha_nacimiento) {
      setErroresFicha(prev => ({ ...prev, fecha_nacimiento: undefined }));
    }
  };

  const handleDireccionChange = (nuevaDir: string) => {
    setDireccion(nuevaDir.toUpperCase());
    if (erroresFicha.direccion) {
      setErroresFicha(prev => ({ ...prev, direccion: undefined }));
    }
  };

  // Selector de Estudio y Reglas de Doctores
  const [selectedArea, setSelectedArea] = useState<string>('ECOGRAFIA_AM');
  const [selectedEstudioNombre, setSelectedEstudioNombre] = useState<string>('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  
  // Tasa BCV Oficial Automática
  const [tasaBcv, setTasaBcv] = useState<number>(832.49);
  const [cargandoTasaBcv, setCargandoTasaBcv] = useState<boolean>(false);
  const [fuenteTasaBcv, setFuenteTasaBcv] = useState<string>('Consultando BCV...');
  const [tasaManualEditada, setTasaManualEditada] = useState<boolean>(false);

  // Carrito de Estudios
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);

  // Desglose Multimoneda Simultáneo
  const [pagoDivisas, setPagoDivisas] = useState<string>('');
  const [pagoEfectivoBs, setPagoEfectivoBs] = useState<string>('');
  const [pagoPuntoBs, setPagoPuntoBs] = useState<string>('');
  const [pagoMovilBs, setPagoMovilBs] = useState<string>('');

  // Estados de Proceso
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [erroresValidacion, setErroresValidacion] = useState<string[]>([]);
  const [facturaEmitida, setFacturaEmitida] = useState<any>(null);
  // Impresión física desactivada según requerimiento corporativo

  // Sincronización Automática de Tasa Oficial BCV
  const sincronizarTasaBCV = async (notificar: boolean = false) => {
    setCargandoTasaBcv(true);
    try {
      const res = await fetch('/api/bcv');
      if (res.ok) {
        const data = await res.json();
        if (data && data.tasa) {
          const tasaNum = Number(parseFloat(data.tasa).toFixed(2));
          setTasaBcv(tasaNum);
          setFuenteTasaBcv(data.fuente || 'BCV Oficial');
          setTasaManualEditada(false);
          if (notificar) alert(`Tasa oficial del BCV sincronizada con éxito: Bs. ${tasaNum.toFixed(2)}`);
        }
      }
    } catch (err) {
      console.warn('Error sincronizando tasa BCV:', err);
      setFuenteTasaBcv('Tasa de Respaldo');
    } finally {
      setCargandoTasaBcv(false);
    }
  };

  useEffect(() => {
    sincronizarTasaBCV(false);
  }, []);

  // Autoselección según Área
  useEffect(() => {
    const estudiosArea = ESTUDIOS_CLINICOS[selectedArea] || [];
    if (estudiosArea.length > 0) {
      setSelectedEstudioNombre(estudiosArea[0].nombre);
    } else {
      setSelectedEstudioNombre('');
    }

    // Reglas Dinámicas de Doctores
    if (selectedArea === 'ECOGRAFIA_AM') {
      setSelectedDoctor('Dra. Silvia');
    } else if (selectedArea === 'ECOGRAFIA_PM') {
      setSelectedDoctor('Dra. Carmen');
    } else if (selectedArea === 'RADIOLOGIA') {
      setSelectedDoctor('Técnico Radiología');
    } else if (selectedArea === 'MAMOGRAFIA') {
      setSelectedDoctor('Dra. Imagen');
    } else if (selectedArea === 'CONSULTAS') {
      const doctores = ESPECIALISTAS_MEDICOS.CONSULTAS || [];
      setSelectedDoctor(doctores.length > 0 ? doctores[0].nombre : '');
    } else if (selectedArea === 'GINECOLOGIA') {
      const doctores = ESPECIALISTAS_MEDICOS.GINECOLOGIA || [];
      setSelectedDoctor(doctores.length > 0 ? doctores[0].nombre : '');
    }
  }, [selectedArea]);

    // Búsqueda Reactiva de Paciente con Debounce
  useEffect(() => {
    const cleanCedula = cedula.trim();
    if (!cleanCedula || cleanCedula.length < 3) {
      setPacienteExiste(null);
      limpiarDatosPaciente();
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoPaciente(true);
      try {
        const fullCedula = normalizarCedulaRif(`${tipoDoc}${cleanCedula}`);
        const res = await fetch(`/api/pacientes?cedula=${encodeURIComponent(fullCedula)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.nombre) {
            setNombre(data.nombre);
            setFechaNacimiento(aFormatoInputDate(data.fecha_nacimiento));
            setTelefono(data.telefono || '');
            setDireccion(data.direccion || '');
            setPacienteExiste(true);
          } else {
            limpiarDatosPaciente();
            setPacienteExiste(false);
          }
        } else {
          limpiarDatosPaciente();
          setPacienteExiste(false);
        }
      } catch (err) {
        console.error('Error buscando paciente:', err);
        limpiarDatosPaciente();
        setPacienteExiste(false);
      } finally {
        setBuscandoPaciente(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [cedula, tipoDoc]);

  // Guardar Paciente Rápido en Supabase con Validación Estricta
  const handleGuardarPacienteRapido = async () => {
    const valRes = validarFichaPaciente({
      tipoDoc,
      cedula,
      nombre,
      fecha_nacimiento: fechaNacimiento,
      telefono,
      direccion
    });

    if (!valRes.valido) {
      setErroresFicha(valRes.errores);
      const lista = Object.values(valRes.errores).filter(Boolean);
      alert(`Por favor complete los campos obligatorios según sus características:\n\n• ${lista.join('\n• ')}`);
      return;
    }

    setGuardandoPaciente(true);
    try {
      const fullCedula = normalizarCedulaRif(`${tipoDoc}${cedula.trim()}`);
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: fullCedula,
          nombre: nombre.trim().toUpperCase(),
          fecha_nacimiento: fechaNacimiento || null,
          telefono: telefono.trim(),
          direccion: direccion.trim().toUpperCase()
        })
      });
      if (res.ok) {
        setPacienteExiste(true);
        setErroresFicha({});
        alert('✓ Paciente registrado exitosamente en la base de datos.');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Error al registrar paciente.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    } finally {
      setGuardandoPaciente(false);
    }
  };

  // Agregar Estudio al Carrito
  const handleAgregarEstudio = () => {
    const estudiosArea = ESTUDIOS_CLINICOS[selectedArea] || [];
    const estudioObj = estudiosArea.find(e => e.nombre === selectedEstudioNombre);
    if (!estudioObj) return;

    // Validación estricta de médico en Consultas y Ginecología
    if ((selectedArea === 'CONSULTAS' || selectedArea === 'GINECOLOGIA') && (!selectedDoctor || selectedDoctor === 'De Guardia')) {
      alert(`En ${selectedArea} es obligatorio seleccionar al médico especialista tratante.`);
      return;
    }

    let precioEstudio = estudioObj.precio;
    let distEstudio = { ...estudioObj.dist };

    // Si es consulta especializada, el precio y porcentaje dependen del médico
    if (selectedArea === 'CONSULTAS') {
      const esp = ESPECIALISTAS_MEDICOS.CONSULTAS.find(d => d.nombre === selectedDoctor);
      if (esp && esp.precio) {
        precioEstudio = esp.precio;
        const pct = esp.pctMedico || 0.70;
        distEstudio = {
          imagen: Math.round((precioEstudio * (1 - pct)) * 100) / 100,
          medico: Math.round((precioEstudio * pct) * 100) / 100,
          eco: 0,
          patologo: 0
        };
      }
    }

    const nuevoItem: CarritoItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      area: selectedArea,
      estudio: estudioObj.nombre,
      medico: selectedDoctor,
      precioUSD: precioEstudio,
      sala: estudioObj.sala,
      dist: distEstudio
    };

    if (!estudioPrincipalId) setEstudioPrincipalId(nuevoItem.id);
      setCarrito([...carrito, nuevoItem]);
  };

  const handleEliminarItem = (id: string) => {
    const restante = carrito.filter(i => i.id !== id);
    setCarrito(restante);
    if (estudioPrincipalId === id) {
      setEstudioPrincipalId(restante[0]?.id || null);
    }
  };

  // Cálculos Financieros Multimoneda en Vivo
  const totalUSD = carrito.reduce((sum, item) => sum + item.precioUSD, 0);
  const totalBs = totalUSD * tasaBcv;

  const numDivisas = parseFloat(pagoDivisas) || 0;
  const numEfectivoBs = parseFloat(pagoEfectivoBs) || 0;
  const numPuntoBs = parseFloat(pagoPuntoBs) || 0;
  const numPagoMovilBs = parseFloat(pagoMovilBs) || 0;

  const totalPagadoUSD = numDivisas + ((numEfectivoBs + numPuntoBs + numPagoMovilBs) / (tasaBcv > 0 ? tasaBcv : 1));
  const totalPagadoBs = (numDivisas * tasaBcv) + numEfectivoBs + numPuntoBs + numPagoMovilBs;

  const diferenciaUSD = totalUSD - totalPagadoUSD;
  const diferenciaBs = diferenciaUSD * tasaBcv;
  const isCuadrado = Math.abs(diferenciaUSD) <= 0.01 && totalUSD > 0;

  // Auto-completar monto restante en un método de pago
  const handleAutocompletar = (metodo: 'divisas' | 'efectivoBs' | 'punto' | 'pagoMovil') => {
    if (diferenciaUSD <= 0) return;
    if (metodo === 'divisas') {
      setPagoDivisas((numDivisas + diferenciaUSD).toFixed(2));
    } else {
      const faltanteBs = diferenciaUSD * tasaBcv;
      if (metodo === 'efectivoBs') setPagoEfectivoBs((numEfectivoBs + faltanteBs).toFixed(2));
      if (metodo === 'punto') setPagoPuntoBs((numPuntoBs + faltanteBs).toFixed(2));
      if (metodo === 'pagoMovil') setPagoMovilBs((numPagoMovilBs + faltanteBs).toFixed(2));
    }
  };

  // Emisión y Validación Estricta con Zod
  const handleProcesarFactura = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroresValidacion([]);

    // Validación preventiva de ficha de paciente
    const valFicha = validarFichaPaciente({
      tipoDoc,
      cedula,
      nombre,
      fecha_nacimiento: fechaNacimiento,
      telefono,
      direccion
    });

    if (!valFicha.valido) {
      setErroresFicha(valFicha.errores);
      const msgs = Object.values(valFicha.errores).filter(Boolean) as string[];
      setErroresValidacion(msgs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const payloadValidacion = {
      tipoDoc,
      cedula: cedula.trim(),
      nombre: nombre.trim(),
      fecha_nacimiento: fechaNacimiento || undefined,
      edad: fechaNacimiento ? calcularEdadReal(fechaNacimiento) : undefined,
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      tasaBcv: Number(tasaBcv),
      servicios: carrito.map(c => ({
        area: c.area,
        estudio: c.estudio,
        medico: c.medico,
        precioUSD: c.precioUSD,
        sala: c.sala,
        dist: c.dist
      })),
      pagos: {
        divisasUSD: numDivisas,
        efectivoBs: numEfectivoBs,
        puntoBs: numPuntoBs,
        pagoMovilBs: numPagoMovilBs
      }
    };

    const validacion = facturaCreateSchema.safeParse(payloadValidacion);
    if (!validacion.success) {
      const errs = validacion.error.issues.map(i => i.message);
      setErroresValidacion(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      const fullCedula = normalizarCedulaRif(`${tipoDoc}${cedula.trim()}`);
      const fechaHoy = new Date().toISOString().split('T')[0];
      const horaActual = new Date().toLocaleTimeString('es-VE', { hour12: false });

      // Consolidar totales de honorarios y ganancia
      const totalHonorarios = carrito.reduce((sum, c) => sum + c.dist.medico + c.dist.eco + c.dist.patologo, 0);
      const totalGanancia = carrito.reduce((sum, c) => sum + c.dist.imagen, 0);

      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: fechaHoy,
          hora: horaActual,
          cedula_paciente: fullCedula,
          nombre_paciente: nombre.trim().toUpperCase(),
          fecha_nacimiento_paciente: fechaNacimiento || null,
          fecha_nacimiento: fechaNacimiento || null,
          edad_paciente: fechaNacimiento ? calcularEdadReal(fechaNacimiento) : 0,
          telefono_paciente: telefono.trim(),
          direccion_paciente: direccion.trim().toUpperCase(),
          estudio: carrito.map(c => c.estudio).join(' + ').toUpperCase(),
          medico: carrito.map(c => c.medico).join(' / ').toUpperCase(),
          precio_usd: totalUSD,
          tasa_bcv: tasaBcv,
          pago_punto: numPuntoBs,
          pago_movil: numPagoMovilBs,
          pago_efectivo_bs: numEfectivoBs,
          pago_divisas: numDivisas,
          estado: 'ESPERA',
          estudio_principal_id: estudioPrincipalId || (carrito[0] ? carrito[0].id : undefined),
          prioridad: 'ALTA',
          grupo_clinico: carrito[0] ? mapearEstudioAGrupo(carrito[0].estudio) : 'A',
          servicios: carrito,
          total_honorarios: totalHonorarios,
          total_ganancia: totalGanancia
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al emitir factura');
      }

      const dataFactura = await res.json();
      setFacturaEmitida(dataFactura);
      const estPrincipal = carrito.find(c => c.id === (estudioPrincipalId || carrito[0]?.id));
      setAlertaExito({
        visible: true,
        mensaje: 'Cobro asentado en cuentas bancarias. Paciente transferido a Sala de Espera con Estudio Principal prioritario.',
        estudioPrincipal: estPrincipal?.estudio || carrito[0]?.estudio,
        totalUSD: totalUSD
      });

      // Limpiar formulario para el siguiente paciente
      setCedula('');
      setNombre('');
      setFechaNacimiento('');
      setTelefono('');
      setDireccion('');
      setPacienteExiste(null);
      setCarrito([]);
      setEstudioPrincipalId(null);
      setPagoDivisas('');
      setPagoEfectivoBs('');
      setPagoPuntoBs('');
      setPagoMovilBs('');

      if (onFacturaEmitida) onFacturaEmitida();
    } catch (err: any) {
      console.error(err);
      alert(`Error procesando cobro: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const estudiosActuales = ESTUDIOS_CLINICOS[selectedArea] || [];
  const esEstudioTecnico = selectedArea === 'RADIOLOGIA' || selectedArea === 'MAMOGRAFIA';
  const esEcografia = selectedArea === 'ECOGRAFIA_AM' || selectedArea === 'ECOGRAFIA_PM';
  const esGinecologia = selectedArea === 'GINECOLOGIA';
  const esBiopsiaOCitologia = esGinecologia && (
    selectedEstudioNombre.includes('BIOPSIA') || 
    selectedEstudioNombre.includes('CITOLOGIA') || 
    selectedEstudioNombre.includes('COMPLETA')
  );

  return (
    <div className="space-y-6">
      {/* Alertas de Validación Zod */}
      {erroresValidacion.length > 0 && (
        <Card className="border-rose-300 bg-rose-50 shadow-sm animate-in fade-in-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                Existen {erroresValidacion.length} observaciones antes de emitir:
              </h4>
              <ul className="mt-1 list-disc list-inside text-xs text-rose-700 space-y-0.5">
                {erroresValidacion.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid Principal: Ficha Paciente + Estudios */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: Admisión de Paciente & Carrito */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Ficha de Identificación del Paciente */}
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-cyan-600" />
                    <span>1. Ficha del Paciente (Búsqueda Reactiva)</span>
                  </CardTitle>
                  {Boolean(cedula || nombre || telefono || direccion) && (
                    <button
                      type="button"
                      onClick={limpiarFichaCompleta}
                      className="ml-2 text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 border border-slate-200"
                      title="Borrar cédula y limpiar toda la información del paciente"
                    >
                      <RotateCcw className="w-3 h-3 text-rose-500" />
                      <span>Limpiar Datos</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {buscandoPaciente && (
                    <span className="text-[10px] text-cyan-600 font-bold flex items-center gap-1 animate-pulse">
                      <Search className="w-3 h-3" /> Verificando cédula...
                    </span>
                  )}
                  {!buscandoPaciente && pacienteExiste === true && (
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      ✓ Registrado en BD
                    </Badge>
                  )}
                  {!buscandoPaciente && pacienteExiste === false && (
                    <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                      ★ Nuevo Paciente (Alta Rápida)
                    </Badge>
                  )}
                </div>
              </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Tipo de Documento y Cédula */}
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                    Tipo <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={tipoDoc}
                    onChange={(e) => handleTipoDocChange(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="V">V - Venezolano</option>
                    <option value="E">E - Extranjero</option>
                    <option value="J">J - Jurídico</option>
                    <option value="P">P - Pasaporte</option>
                  </select>
                </div>

                <div className="md:col-span-5">
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                    Cédula / Documento <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      placeholder={tipoDoc === 'P' ? "Ej. PAS123456" : "Ej. 13320580"}
                      value={cedula}
                      onChange={(e) => handleCedulaChange(e.target.value)}
                      className={`text-xs font-mono font-bold rounded-xl pr-14 ${
                        erroresFicha.cedula ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' : 'border-slate-300'
                      }`}
                    />
                    {cedula && (
                      <button
                        type="button"
                        onClick={limpiarFichaCompleta}
                        className="absolute right-7 top-2.5 text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                        title="Borrar cédula y limpiar datos"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                  </div>
                  {erroresFicha.cedula ? (
                    <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {erroresFicha.cedula}
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {tipoDoc === 'P' ? 'Alfanumérico sin espacios' : 'Solo números (5-9 dígitos, sin letras)'}
                    </p>
                  )}
                </div>

                <div className="md:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black text-slate-600 uppercase">
                      F. Nacimiento <span className="text-rose-500">*</span>
                    </label>
                    {fechaNacimiento && (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-md">
                        {calcularEdadReal(fechaNacimiento)} años
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => handleFechaNacimientoChange(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={`text-xs font-medium rounded-xl ${
                      erroresFicha.fecha_nacimiento ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {erroresFicha.fecha_nacimiento && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {erroresFicha.fecha_nacimiento}
                    </p>
                  )}
                </div>

                {/* Nombre Completo */}
                <div className="md:col-span-7">
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                    Nombre Completo <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="Ej. María Pérez"
                    value={nombre}
                    onChange={(e) => handleNombreChange(e.target.value)}
                    className={`text-xs font-bold rounded-xl uppercase placeholder:normal-case ${
                      erroresFicha.nombre ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {erroresFicha.nombre ? (
                    <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {erroresFicha.nombre}
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      Solo letras y apellidos (sin números)
                    </p>
                  )}
                </div>

                {/* Teléfono */}
                <div className="md:col-span-5">
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                    Teléfono / Celular <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="04141234567"
                    value={telefono}
                    onChange={(e) => handleTelefonoChange(e.target.value)}
                    maxLength={11}
                    className={`text-xs font-mono rounded-xl ${
                      erroresFicha.telefono ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {erroresFicha.telefono ? (
                    <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {erroresFicha.telefono}
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      Solo números (10 a 11 dígitos, sin letras)
                    </p>
                  )}
                </div>

                {/* Dirección */}
                <div className="md:col-span-12">
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                    Dirección / Residencia <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej. Guatire, Conjunto Residencial Los Robles, Apto 4-B"
                      value={direccion}
                      onChange={(e) => handleDireccionChange(e.target.value)}
                      className={`text-xs rounded-xl flex-1 uppercase placeholder:normal-case ${
                        erroresFicha.direccion ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' : 'border-slate-300'
                      }`}
                    />
                    {pacienteExiste === false && (
                      <Button
                        type="button"
                        onClick={handleGuardarPacienteRapido}
                        disabled={guardandoPaciente}
                        size="sm"
                        className="rounded-xl text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                      >
                        {guardandoPaciente ? 'Guardando...' : 'Guardar Ficha'}
                      </Button>
                    )}
                  </div>
                  {erroresFicha.direccion && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {erroresFicha.direccion}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selector de Estudios Clínicos con Reglas de Negocio */}
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-cyan-600" />
                <span>2. Selección de Estudios & Asignación de Especialista</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                
                {/* 1. Selector de Área Médica */}
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Área Médica</label>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="ECOGRAFIA_AM">Ecografía AM (Mañana)</option>
                    <option value="ECOGRAFIA_PM">Ecografía PM (Tarde)</option>
                    <option value="RADIOLOGIA">Radiología General (Rayos X)</option>
                    <option value="MAMOGRAFIA">Mamografía Digital</option>
                    <option value="CONSULTAS">Consultas Especializadas</option>
                    <option value="GINECOLOGIA">Ginecología & Biopsias</option>
                  </select>
                </div>

                {/* 2. Selector de Estudio */}
                <div className="md:col-span-8">
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                    Estudio o Procedimiento
                  </label>
                  <select
                    value={selectedEstudioNombre}
                    onChange={(e) => setSelectedEstudioNombre(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
                  >
                    {estudiosActuales.map((e, idx) => {
                      const precioBsEstudio = e.precio * tasaBcv;
                      return (
                        <option key={idx} value={e.nombre}>
                          {e.nombre} — ${e.precio.toFixed(2)} (Bs. {precioBsEstudio.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 3. Selector / Reglas de Médico Tratante */}
                <div className="md:col-span-8">
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                    Médico Especialista Asignado
                  </label>
                  
                  {/* CASO: RADIOLOGÍA Y MAMOGRAFÍA (Técnico / 100% Clínica) */}
                  {esEstudioTecnico ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200">
                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">
                        {selectedDoctor} (Personal Técnico Clínico — 100% Clínica)
                      </span>
                    </div>
                  ) : esEcografia ? (
                    /* CASO: ECOGRAFÍA (Ecografista asignado según turno AM/PM) */
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-cyan-50 border border-cyan-200">
                      <Clock className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                      <span className="text-xs font-bold text-cyan-900">
                        {selectedDoctor} (Ecografista de Turno {selectedArea === 'ECOGRAFIA_AM' ? 'Matutino' : 'Vespertino'})
                      </span>
                    </div>
                  ) : (
                    /* CASO: CONSULTAS Y GINECOLOGÍA (Selección Obligatoria) */
                    <select
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-cyan-400 bg-cyan-50/40 text-slate-900 focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">-- Seleccionar Médico Especialista Obligatorio --</option>
                      {(ESPECIALISTAS_MEDICOS[selectedArea] || []).map((doc, idx) => (
                        <option key={idx} value={doc.nombre}>
                          {doc.nombre} {doc.especialidad ? `(${doc.especialidad})` : ''} {doc.precio ? `— $${doc.precio.toFixed(2)} (Bs. ${(doc.precio * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Botón Agregar al Carrito */}
                <div className="md:col-span-4 flex items-end">
                  <Button
                    type="button"
                    onClick={handleAgregarEstudio}
                    className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 h-9 shadow-md shadow-cyan-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar al Carrito</span>
                  </Button>
                </div>

                {/* Banner Informativo si aplica Patología */}
                {esBiopsiaOCitologia && (
                  <div className="md:col-span-12 p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Microscope className="w-4 h-4 text-purple-700 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-purple-950">Estudio con Análisis de Patología</p>
                        <p className="text-[10px] text-purple-700">
                          Asignado automáticamente a: <span className="font-bold">{PATOLOGO_OFICIAL.nombre}</span> ({PATOLOGO_OFICIAL.especialidad})
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-purple-200 text-purple-900 font-mono text-[10px] font-bold">
                      Patología Activa
                    </Badge>
                  </div>
                )}
              </div>

              
                {/* Selector de Prioridad de Primer Llamado (Multi-Estudio) */}
                {carrito.length >= 2 && (
                  <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-cyan-50/70 to-emerald-50/70 border border-cyan-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#80DDD2] animate-pulse" />
                        <h5 className="text-xs font-black text-slate-800 tracking-tight">
                          Prioridad de Primer Llamado en Sala de Espera
                        </h5>
                      </div>
                      <Badge className="bg-[#1D7A70] text-white text-[9px] font-bold">
                        Multi-Estudio ({carrito.length})
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 mb-2.5">
                      Defina cuál estudio debe llamarse de <span className="font-bold text-slate-900">primer lugar</span> en la Sala de Espera. Los estudios restantes permanecerán en cola secundaria protegida.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {carrito.map((c) => {
                        const esSeleccionado = (estudioPrincipalId || carrito[0]?.id) === c.id;
                        const grupo = c.grupoClinico || mapearEstudioAGrupo(c.estudio);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setEstudioPrincipalId(c.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all flex items-start justify-between ${
                              esSeleccionado
                                ? 'bg-white border-[#80DDD2] ring-2 ring-[#80DDD2]/40 shadow-sm'
                                : 'bg-white/60 border-slate-200/80 hover:bg-white text-slate-600'
                            }`}
                          >
                            <div className="pr-2">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px] font-bold border-cyan-300 text-cyan-800 bg-cyan-50">
                                  Grupo {grupo}
                                </Badge>
                                <span className="text-xs font-bold text-slate-900 line-clamp-1">{c.estudio}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">Sala: {c.sala} • {c.medico}</p>
                            </div>
                            <div className="shrink-0 pt-0.5">
                              {esSeleccionado ? (
                                <span className="px-2 py-0.5 rounded-md bg-[#1D7A70] text-white text-[9px] font-black tracking-wide uppercase">
                                  1er Llamado
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[9px] font-medium">
                                  Secundario
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Lista del Carrito */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
                    <span>Estudios en Carrito ({carrito.length})</span>
                  </h4>
                  <p className="text-xs font-mono font-black text-cyan-800">
                    Subtotal: ${totalUSD.toFixed(2)} (Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </p>
                </div>

                {carrito.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                    No hay estudios en el carrito. Seleccione arriba y pulse &quot;Agregar al Carrito&quot;.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {carrito.map((item) => {
                      const itemBs = item.precioUSD * tasaBcv;
                      return (
                        <div 
                          key={item.id} 
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] font-mono font-bold bg-white">
                                {item.area}
                              </Badge>
                              <span className="font-black text-slate-900">{item.estudio}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Médico: <span className="font-bold text-slate-700">{item.medico}</span> • Sala: <span className="font-mono text-cyan-700">{item.sala}</span>
                            </p>
                            {/* Desglose de Liquidación Multimoneda */}
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                              Clínica: ${item.dist.imagen.toFixed(2)} (Bs. {(item.dist.imagen * tasaBcv).toFixed(2)}) | Médico: ${item.dist.medico.toFixed(2)} (Bs. {(item.dist.medico * tasaBcv).toFixed(2)})
                              {item.dist.eco > 0 ? ` | Eco: $${item.dist.eco.toFixed(2)} (Bs. ${(item.dist.eco * tasaBcv).toFixed(2)})` : ''}
                              {item.dist.patologo > 0 ? ` | Patólogo: $${item.dist.patologo.toFixed(2)} (Bs. ${(item.dist.patologo * tasaBcv).toFixed(2)})` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-mono font-black text-slate-900 text-sm">
                                ${item.precioUSD.toFixed(2)}
                              </p>
                              <p className="font-mono text-[10px] text-slate-500 font-semibold">
                                Bs. {itemBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleEliminarItem(item.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: Cobro Multimoneda Simultáneo & Cuadre al Centavo */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden sticky top-6">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black text-slate-800 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>3. Cobro Multimoneda Simultáneo</span>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Badge className="bg-slate-900 text-white font-mono text-[10px] flex items-center gap-1">
                  <span>BCV: Bs. {tasaBcv.toFixed(2)}</span>
                </Badge>
                <button
                  type="button"
                  onClick={() => sincronizarTasaBCV(true)}
                  disabled={cargandoTasaBcv}
                  className="p-1 rounded-lg text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                  title="Sincronizar Tasa Oficial con el BCV en Vivo"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cargandoTasaBcv ? 'animate-spin text-cyan-600' : ''}`} />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              {/* Resumen Total Multimoneda */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span>TOTAL A FACTURAR (MULTIMONEDA)</span>
                  <span className="text-[10px] text-cyan-400 font-medium">{fuenteTasaBcv}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-black font-mono tracking-tight text-white">
                      ${totalUSD.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">Dólares ($)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-mono text-cyan-300 font-black">
                      Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-cyan-400/80 font-medium">Bolívares (Bs)</p>
                  </div>
                </div>
              </div>

              {/* Tasa BCV Oficial con Sincronización */}
              <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                    <span>Tasa Oficial BCV:</span>
                    {tasaManualEditada && (
                      <span className="text-[9px] text-amber-700 font-bold bg-amber-100 px-1 py-0.5 rounded">
                        Manual
                      </span>
                    )}
                  </span>
                  <p className="text-[9px] text-slate-400 mt-0.5">Automático vía API oficial BCV</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">Bs.</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tasaBcv}
                    onChange={(e) => {
                      setTasaBcv(parseFloat(e.target.value) || 1);
                      setTasaManualEditada(true);
                    }}
                    className="w-24 px-2 py-1 text-xs font-mono font-bold text-right border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Formas de Pago Simultáneas con Doble Moneda */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  Desglose de Pago Multimoneda Simultáneo
                </p>

                {/* 1. Efectivo Divisas ($) */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Efectivo Divisas ($)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAutocompletar('divisas')}
                      className="text-[10px] text-cyan-600 font-bold hover:underline"
                    >
                      Completar Faltante
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={pagoDivisas}
                      onChange={(e) => setPagoDivisas(e.target.value)}
                      className="text-xs font-mono font-bold rounded-xl bg-white flex-1"
                    />
                    <span className="text-[10px] font-mono text-emerald-700 font-bold shrink-0 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                      ≈ Bs. {(numDivisas * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* 2. Efectivo Bolívares (Bs) */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-blue-600" />
                      <span>Efectivo Bolívares (Bs)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAutocompletar('efectivoBs')}
                      className="text-[10px] text-cyan-600 font-bold hover:underline"
                    >
                      Completar Faltante
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={pagoEfectivoBs}
                      onChange={(e) => setPagoEfectivoBs(e.target.value)}
                      className="text-xs font-mono font-bold rounded-xl bg-white flex-1"
                    />
                    <span className="text-[10px] font-mono text-blue-700 font-bold shrink-0 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                      ≈ ${(numEfectivoBs / (tasaBcv > 0 ? tasaBcv : 1)).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                {/* 3. Punto de Venta POS (Bs) */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Punto de Venta POS (Bs)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAutocompletar('punto')}
                      className="text-[10px] text-cyan-600 font-bold hover:underline"
                    >
                      Completar Faltante
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={pagoPuntoBs}
                      onChange={(e) => setPagoPuntoBs(e.target.value)}
                      className="text-xs font-mono font-bold rounded-xl bg-white flex-1"
                    />
                    <span className="text-[10px] font-mono text-indigo-700 font-bold shrink-0 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200">
                      ≈ ${(numPuntoBs / (tasaBcv > 0 ? tasaBcv : 1)).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                {/* 4. Pago Móvil (Bs) */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Pago Móvil (Bs)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAutocompletar('pagoMovil')}
                      className="text-[10px] text-cyan-600 font-bold hover:underline"
                    >
                      Completar Faltante
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={pagoMovilBs}
                      onChange={(e) => setPagoMovilBs(e.target.value)}
                      className="text-xs font-mono font-bold rounded-xl bg-white flex-1"
                    />
                    <span className="text-[10px] font-mono text-cyan-700 font-bold shrink-0 bg-cyan-50 px-2 py-1 rounded-lg border border-cyan-200">
                      ≈ ${(numPagoMovilBs / (tasaBcv > 0 ? tasaBcv : 1)).toFixed(2)} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Indicador de Cuadre al Centavo Multimoneda */}
              <div className={`p-4 rounded-2xl border text-xs font-mono ${
                isCuadrado 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' 
                  : totalUSD === 0 
                    ? 'bg-slate-50 border-slate-200 text-slate-500' 
                    : diferenciaUSD > 0 
                      ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold' 
                      : 'bg-rose-50 border-rose-300 text-rose-950 font-bold'
              }`}>
                {/* Línea 1: Total Cobrado */}
                <div className="flex justify-between items-center">
                  <span>Total Cobrado:</span>
                  <span className="font-black text-sm">
                    ${totalPagadoUSD.toFixed(2)} <span className="text-xs font-semibold opacity-75">| Bs. {totalPagadoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                </div>

                {/* Línea 2: Diferencia de Cuadre */}
                <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-200/60">
                  <span>Diferencia de Cuadre:</span>
                  <span className="font-black text-sm">
                    {diferenciaUSD > 0.01 ? (
                      <span className="text-amber-700">
                        Faltan ${diferenciaUSD.toFixed(2)} (Bs. {diferenciaBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    ) : diferenciaUSD < -0.01 ? (
                      <span className="text-rose-700">
                        Excedente/Vuelto ${Math.abs(diferenciaUSD).toFixed(2)} (Bs. {Math.abs(diferenciaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    ) : (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>✓ Cuadre Exacto ($0.00 | Bs. 0.00)</span>
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Botón Principal de Cobro */}
              <Button
                type="button"
                disabled={!isCuadrado || isSubmitting || carrito.length === 0 || !(tasaBcv > 0)}
                onClick={handleProcesarFactura}
                className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 disabled:opacity-40"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Emitiendo Factura y Asignando Turno...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Emitir Factura y Asignar Turno — ${totalUSD.toFixed(2)} (Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Comprobante Térmico Imprimible */}
      {/* Impresión de ticket térmico suprimida según política de caja sin papel */}
    </div>
  );
};
