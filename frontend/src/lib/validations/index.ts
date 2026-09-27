import { z } from 'zod';
import {
  REGEX_SOLO_DIGITOS,
  REGEX_SOLO_LETRAS,
  REGEX_TELEFONO_VE,
  limpiarCedulaInput,
  limpiarNombreInput,
  limpiarTelefonoInput,
  validarFichaPaciente
} from '@/lib/pacienteValidation';

export {
  REGEX_SOLO_DIGITOS,
  REGEX_SOLO_LETRAS,
  REGEX_TELEFONO_VE,
  limpiarCedulaInput,
  limpiarNombreInput,
  limpiarTelefonoInput,
  validarFichaPaciente
};

// Esquema Estricto de Paciente
export const pacienteSchema = z.object({
  cedula: z.string().trim()
    .min(5, 'La cédula debe tener al menos 5 dígitos')
    .max(12, 'La cédula no puede superar los 12 caracteres')
    .refine((val) => {
      const digitos = val.replace(/^[VEJPG]-?/i, '');
      return REGEX_SOLO_DIGITOS.test(digitos);
    }, 'La cédula debe contener únicamente dígitos numéricos (sin letras ni símbolos)'),
  nombre: z.string().trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre es demasiado largo')
    .regex(REGEX_SOLO_LETRAS, 'El nombre completo solo puede contener letras y espacios (sin números)'),
  fecha_nacimiento: z.string().trim()
    .min(1, 'La fecha de nacimiento es obligatoria')
    .refine((val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      if (d > hoy) return false;
      const hace125 = new Date();
      hace125.setFullYear(hace125.getFullYear() - 125);
      return d >= hace125;
    }, 'La fecha de nacimiento debe ser una fecha válida en el pasado'),
  edad: z.coerce.number().optional(),
  telefono: z.string().trim()
    .min(10, 'El teléfono debe tener entre 10 y 11 dígitos numéricos')
    .max(12, 'El teléfono no puede superar los 11 dígitos')
    .regex(REGEX_TELEFONO_VE, 'El teléfono debe contener únicamente dígitos numéricos (ej. 04141234567, sin letras)'),
  direccion: z.string().trim()
    .min(5, 'La dirección de residencia es obligatoria (mínimo 5 caracteres)')
});

export type PacienteFormData = z.infer<typeof pacienteSchema>;

// Esquema de Item de Servicio en Carrito
export const servicioItemSchema = z.object({
  area: z.string(),
  estudio: z.string().min(1, 'Estudio requerido'),
  medico: z.string().min(1, 'Médico requerido'),
  precioUSD: z.number().positive('El precio debe ser mayor a 0'),
  sala: z.string(),
  dist: z.object({
    imagen: z.number().min(0),
    medico: z.number().min(0),
    eco: z.number().min(0),
    patologo: z.number().min(0)
  })
});

export type ServicioItemData = z.infer<typeof servicioItemSchema>;

// Esquema Estricto de Creación de Factura
export const facturaCreateSchema = z.object({
  tipoDoc: z.enum(['V', 'E', 'J', 'P']),
  cedula: z.string().trim()
    .min(5, 'La cédula o documento debe tener al menos 5 caracteres')
    .max(12, 'El documento no puede superar 12 caracteres'),
  nombre: z.string().trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .regex(REGEX_SOLO_LETRAS, 'El nombre completo solo puede contener letras y espacios (sin números)'),
  fecha_nacimiento: z.string().trim()
    .min(1, 'La fecha de nacimiento es obligatoria para la ficha clínica')
    .refine((val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      return d <= hoy;
    }, 'La fecha de nacimiento debe ser una fecha válida y no puede ser en el futuro'),
  edad: z.coerce.number().optional(),
  telefono: z.string().trim()
    .min(10, 'El teléfono debe tener entre 10 y 11 dígitos numéricos')
    .max(12, 'El teléfono no puede superar los 11 dígitos')
    .regex(REGEX_TELEFONO_VE, 'El teléfono debe contener únicamente dígitos numéricos (ej. 04141234567, sin letras)'),
  direccion: z.string().trim()
    .min(5, 'La dirección de residencia es obligatoria (mínimo 5 caracteres)'),
  tasaBcv: z.number().positive('La tasa oficial BCV debe ser mayor a cero'),
  servicios: z.array(servicioItemSchema).min(1, 'Debe agregar al menos un servicio al carrito'),
  pagos: z.object({
    divisasUSD: z.number().min(0),
    efectivoBs: z.number().min(0),
    puntoBs: z.number().min(0),
    pagoMovilBs: z.number().min(0)
  })
}).superRefine((val, ctx) => {
  // 1. Validar que la cédula sea numérica estricta si no es pasaporte
  if (val.tipoDoc !== 'P') {
    if (!REGEX_SOLO_DIGITOS.test(val.cedula)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Para tipo V, E o J, la cédula debe contener únicamente dígitos numéricos (sin letras).',
        path: ['cedula']
      });
    } else if (val.cedula.length < 5 || val.cedula.length > 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cédula debe tener entre 5 y 9 dígitos numéricos.',
        path: ['cedula']
      });
    }
  }

  // 2. Validar que si hay consultas o ginecología, el médico no sea genérico
  val.servicios.forEach((s, idx) => {
    if (s.area === 'CONSULTAS' || s.area === 'GINECOLOGIA') {
      if (!s.medico || s.medico === 'De Guardia' || s.medico === 'Técnico Especialista') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `En ${s.area} es obligatorio seleccionar un médico especialista tratante.`,
          path: ['servicios', idx, 'medico']
        });
      }
    }
  });

  // 3. Validar cuadre exacto en USD con tolerancia de ±$0.01
  const totalUsd = val.servicios.reduce((sum, s) => sum + s.precioUSD, 0);
  const totalPagadoUsd = 
    val.pagos.divisasUSD + 
    (val.pagos.efectivoBs / val.tasaBcv) + 
    (val.pagos.puntoBs / val.tasaBcv) + 
    (val.pagos.pagoMovilBs / val.tasaBcv);

  const diferencia = Math.abs(totalPagadoUsd - totalUsd);
  if (diferencia > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `El pago no está cuadrado. Total: $${totalUsd.toFixed(2)}, Pagado: $${totalPagadoUsd.toFixed(2)}, Diferencia: $${(totalUsd - totalPagadoUsd).toFixed(2)}`,
      path: ['pagos']
    });
  }
});

export type FacturaCreateInput = z.infer<typeof facturaCreateSchema>;

// Esquema de Egreso Operativo
export const egresoOperativoSchema = z.object({
  cuenta_id: z.coerce.number().int().positive('Debe seleccionar una cuenta bancaria'),
  categoria: z.string().trim().min(1, 'Debe seleccionar una categoría'),
  concepto_libre: z.string().trim().optional(),
  monto_neto: z.coerce.number().positive('El monto neto debe ser mayor a 0'),
  comision_bancaria: z.coerce.number().min(0, 'La comisión no puede ser negativa'),
  referencia: z.string().trim().min(2, 'Referencia o comprobante bancario requerido'),
  descripcion: z.string().trim().optional(),
  proveedor_beneficiario: z.string().trim().min(2, 'Proveedor o beneficiario requerido'),
  esPagoMovil: z.boolean().default(false)
}).superRefine((val, ctx) => {
  if (val.esPagoMovil && (val.comision_bancaria === undefined || val.comision_bancaria === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Para egresos por Pago Móvil es obligatorio ingresar la comisión exacta del comprobante.',
      path: ['comision_bancaria']
    });
  }
});

export type EgresoOperativoInput = z.infer<typeof egresoOperativoSchema>;

// Esquema de Operación Cambiaria (Compra de Divisas)
export const cambioDivisaSchema = z.object({
  cuenta_origen_id: z.coerce.number().int().positive('Seleccione cuenta en Bolívares'),
  cuenta_destino_id: z.coerce.number().int().positive('Seleccione cuenta en Divisas'),
  monto_bs_debitar: z.coerce.number().positive('El monto a debitar en Bs debe ser mayor a 0'),
  tasa_pactada: z.coerce.number().positive('La tasa pactada debe ser mayor a 0'),
  monto_usd_recibir: z.coerce.number().positive('El monto en USD debe ser mayor a 0'),
  referencia: z.string().trim().min(2, 'Referencia o voucher requerido'),
  operador_cambiario: z.string().trim().min(2, 'Operador cambiario requerido')
});

export type CambioDivisaInput = z.infer<typeof cambioDivisaSchema>;
