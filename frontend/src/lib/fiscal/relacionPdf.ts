/**
 * Art. 7: relación en PDF de los documentos emitidos en físico durante una contingencia, para remitirla a la
 * imprenta digital al día siguiente de cesar. Funciona en el servidor (jsPDF sin DOM).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { centsToStr } from '@/lib/money';
import { MOTIVOS_CONTINGENCIA, type MotivoContingencia } from './contingencia';

export interface DatosRelacion {
  emisor: { razonSocial: string; rif: string };
  contingencia: { id: number; motivo: MotivoContingencia; inicio: string; fin: string };
  documentos: Array<{
    tipo: string; serie: string; numero: string; numeroControl: string; fecha: string; receptor: string;
    /** Centavos. */
    totalUsd: number; totalBs: number;
  }>;
}

export function pdfRelacionContingencia(d: DatosRelacion): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  doc.setFontSize(13);
  doc.text('Relación de documentos emitidos en formatos de contingencia', 14, 16);
  doc.setFontSize(9);
  doc.text([
    `Emisor: ${d.emisor.razonSocial} · RIF ${d.emisor.rif}`,
    `Contingencia N° ${d.contingencia.id}: ${MOTIVOS_CONTINGENCIA[d.contingencia.motivo]}`,
    `Desde ${d.contingencia.inicio} hasta ${d.contingencia.fin} · ${d.documentos.length} documento(s)`,
  ], 14, 23);
  autoTable(doc, {
    startY: 38,
    head: [['Tipo', 'Serie', 'N° documento', 'N° de control', 'Fecha', 'Receptor', 'Total USD', 'Total Bs']],
    body: d.documentos.map((x) => [x.tipo, x.serie, x.numero, x.numeroControl, x.fecha, x.receptor, centsToStr(x.totalUsd), centsToStr(x.totalBs)]),
    styles: { fontSize: 8 },
    columnStyles: { 6: { halign: 'right' }, 7: { halign: 'right' } },
  });
  return new Uint8Array(doc.output('arraybuffer'));
}
