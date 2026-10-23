import { describe, expect, it } from 'vitest';
import { pdfRelacionContingencia } from './relacionPdf';

describe('pdfRelacionContingencia (art. 7)', () => {
  it('genera un PDF con la relación de documentos físicos', () => {
    const pdf = pdfRelacionContingencia({
      emisor: { razonSocial: 'Clínica X C.A.', rif: 'J123456789' },
      contingencia: { id: 7, motivo: 'INTERNET', inicio: '2027-02-10 08:00', fin: '2027-02-10 14:30' },
      documentos: [
        { tipo: 'FACTURA', serie: 'C', numero: '00000020', numeroControl: '00-00000120', fecha: '10/02/2027', receptor: 'Ana Pérez · V12345678', totalUsd: 1000, totalBs: 50000 },
      ],
    });
    expect(pdf).toBeInstanceOf(Uint8Array);
    const texto = new TextDecoder('latin1').decode(pdf);
    expect(texto.startsWith('%PDF')).toBe(true);
    expect(texto).toContain('00-00000120');
  });
});
