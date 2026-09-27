import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface KPIReportItem {
  label: string;
  valor: string;
}

export interface PDFExportOptions {
  titulo: string;
  subtitulo?: string;
  nombreArchivo: string;
  periodo?: string;
  filtrosAplicados?: string[];
  kpis?: KPIReportItem[];
  columnas: string[];
  filas: (string | number)[][];
  totales?: { label: string; valorUSD?: number; valorBS?: number };
  orientacion?: 'portrait' | 'landscape';
}

export interface ExcelSheetData {
  nombreHoja: string;
  data: Record<string, any>[];
}

/**
 * Exporta datos estructurados a un archivo Excel (.xlsx)
 */
export function exportarAExcel(nombreArchivo: string, hojas: ExcelSheetData[]) {
  try {
    const wb = XLSX.utils.book_new();

    hojas.forEach(h => {
      const ws = XLSX.utils.json_to_sheet(h.data);
      if (h.data.length > 0) {
        const colWidths = Object.keys(h.data[0]).map(key => ({
          wch: Math.max(key.length + 3, 14)
        }));
        ws['!cols'] = colWidths;
      }
      XLSX.utils.book_append_sheet(wb, ws, h.nombreHoja.slice(0, 31));
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const cleanFileName = `${nombreArchivo.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
    return true;
  } catch (error) {
    console.error('Error al exportar a Excel:', error);
    return false;
  }
}

/**
 * Exporta un informe ejecutivo con membrete corporativo y tabla a PDF
 */
export function exportarAPDF(options: PDFExportOptions) {
  try {
    const orientacion = options.orientacion || 'landscape';
    const doc = new jsPDF({
      orientation: orientacion,
      unit: 'pt',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Franja Superior Corporativa
    doc.setFillColor(14, 116, 144); // Cyan 700
    doc.rect(0, 0, pageWidth, 42, 'F');

    doc.setFillColor(3, 105, 161); // Sky 700
    doc.rect(0, 42, pageWidth, 4, 'F');

    // Título y Membrete
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CENTRO CLÍNICO RADIOLÓGICO IMAGEN SALUD, C.A.', 30, 26);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const fechaGen = `Generado: ${new Date().toLocaleString('es-VE')}`;
    doc.text(fechaGen, pageWidth - 30, 26, { align: 'right' });

    // 2. Encabezado del Reporte
    let currentY = 65;
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(options.titulo, 30, currentY);

    if (options.subtitulo) {
      currentY += 15;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(options.subtitulo, 30, currentY);
    }

    // 3. Bloque de Filtros Activos
    if (options.filtrosAplicados && options.filtrosAplicados.length > 0) {
      currentY += 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(14, 116, 144);
      doc.text(`FILTROS APLICADOS: ${options.filtrosAplicados.join('  |  ')}`, 30, currentY);
    }

    // 4. Bloque de KPIs Resumen (Tarjetas si existen)
    if (options.kpis && options.kpis.length > 0) {
      currentY += 14;
      const cardWidth = Math.min(130, (pageWidth - 60 - (options.kpis.length - 1) * 10) / options.kpis.length);
      const cardHeight = 40;

      options.kpis.forEach((kpi, idx) => {
        const x = 30 + idx * (cardWidth + 10);
        doc.setFillColor(248, 250, 252); // Slate 50
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 4, 4, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label.toUpperCase(), x + 8, currentY + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(kpi.valor, x + 8, currentY + 30);
      });

      currentY += cardHeight + 15;
    } else {
      currentY += 15;
    }

    // 5. Tabla Principal con autoTable
    autoTable(doc, {
      startY: currentY,
      head: [options.columnas],
      body: options.filas,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 4.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        font: 'helvetica'
      },
      headStyles: {
        fillColor: [15, 23, 42], // Slate 900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Slate 50
      },
      margin: { left: 30, right: 30, bottom: 40 },
      didDrawPage: (data) => {
        // Pie de página
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        const str = `Página ${data.pageNumber}`;
        doc.text(str, pageWidth - 30, pageHeight - 15, { align: 'right' });
        doc.text('Sistema Contable y Clínico Imagen Salud — Documento Confidencial', 30, pageHeight - 15);
      }
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const cleanFileName = `${options.nombreArchivo.replace(/\s+/g, '_')}_${timestamp}.pdf`;
    doc.save(cleanFileName);
    return true;
  } catch (error) {
    console.error('Error al exportar a PDF:', error);
    return false;
  }
}
