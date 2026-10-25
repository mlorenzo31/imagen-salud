/** Comprobante de retención en PDF con los requisitos del art. 18 (Providencia G.O. 21/10/2026). Servidor. */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fechaFiscal } from '@/lib/fiscal/formato';

export interface DatosComprobante {
  numero: string;
  fechaEmision: string;
  fechaEntrega: string | null;
  /** AAAA-MM. */
  periodoImposicion: string;
  agente: { razonSocial: string; rif: string; domicilio: string };
  proveedor: { razonSocial: string; rif: string; domicilio: string | null; correo: string | null };
  factura: { numero: string; numeroControl: string | null; fecha: string };
  /** Centavos de Bs. */
  montos: { total: number; base: number; iva: number; ivaRetenido: number; islrRetenido: number };
  leyenda: string;
  /** La factura de compra se anuló: el comprobante se conserva marcado (art. 21). */
  anulado?: boolean;
}

const bs = (c: number) => (c / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function pdfComprobanteRetencion(d: DatosComprobante): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const [a, m] = d.periodoImposicion.split('-');
  doc.setFontSize(13);
  doc.text('Comprobante de Retención', 14, 16);
  doc.setFontSize(10);
  doc.text(`N° ${d.numero}`, 150, 16);
  if (d.anulado) { doc.setTextColor(190, 18, 60); doc.text('ANULADO', 150, 22); doc.setTextColor(0, 0, 0); }
  doc.setFontSize(9);
  doc.text([
    `Fecha de emisión: ${fechaFiscal(d.fechaEmision)}    Fecha de entrega: ${d.fechaEntrega ? fechaFiscal(d.fechaEntrega) : '____/____/______'}`,
    `Período de imposición: ${m}/${a}`,
  ], 14, 24);
  autoTable(doc, {
    startY: 32, theme: 'grid', styles: { fontSize: 8 },
    head: [['Agente de retención', 'Proveedor (sujeto retenido)']],
    body: [
      [d.agente.razonSocial, d.proveedor.razonSocial],
      [`RIF ${d.agente.rif}`, `RIF ${d.proveedor.rif}`],
      [`Domicilio fiscal: ${d.agente.domicilio}`, `Domicilio fiscal: ${d.proveedor.domicilio ?? '—'}`],
      ['', `Correo: ${d.proveedor.correo ?? '—'}`],
    ],
  });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: y, theme: 'grid', styles: { fontSize: 8 },
    head: [['Fecha factura', 'N° factura', 'N° de control', 'Total (Bs)', 'Base imponible (Bs)', 'Impuesto causado (Bs)', 'IVA retenido (Bs)', 'ISLR retenido (Bs)']],
    body: [[
      fechaFiscal(d.factura.fecha), d.factura.numero, d.factura.numeroControl ?? '—', bs(d.montos.total), bs(d.montos.base),
      bs(d.montos.iva), bs(d.montos.ivaRetenido), bs(d.montos.islrRetenido),
    ]],
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
  });
  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  doc.text('_____________________________', 14, y2);
  doc.text('_____________________________', 120, y2);
  doc.text('Agente de retención (firma y sello)', 14, y2 + 5);
  doc.text('Recibido por el proveedor', 120, y2 + 5);
  doc.setFontSize(7);
  doc.text(d.leyenda, 14, y2 + 16);
  return new Uint8Array(doc.output('arraybuffer'));
}
