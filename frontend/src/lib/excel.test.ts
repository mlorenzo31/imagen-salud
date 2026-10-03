import { describe, expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/universal';
import { leerHojaComoObjetos } from './excel';

const aBuffer = (texto: string) => new TextEncoder().encode(texto).buffer as ArrayBuffer;

describe('leerHojaComoObjetos', () => {
  it('lee un .xlsx generado y devuelve objetos por cabecera', async () => {
    const blob = await writeExcelFile([
      ['paciente', 'estudio', 'precio'],
      ['ANA PEREZ', 'ECO', 30],
      ['LUIS', 'RX', 20.5],
      [null, null, null],
    ]).toBlob();
    const filas = await leerHojaComoObjetos(await blob.arrayBuffer(), 'datos.xlsx');
    expect(filas).toEqual([
      { paciente: 'ANA PEREZ', estudio: 'ECO', precio: 30 },
      { paciente: 'LUIS', estudio: 'RX', precio: 20.5 },
    ]);
  });

  it('lee CSV con comillas, comas internas y separador punto y coma', async () => {
    const csv = 'paciente;estudio;precio\n"PEREZ, ANA";"ECO ""DOPPLER""";30\nLUIS;RX;20';
    const filas = await leerHojaComoObjetos(aBuffer(csv), 'datos.csv');
    expect(filas[0]).toEqual({ paciente: 'PEREZ, ANA', estudio: 'ECO "DOPPLER"', precio: '30' });
    expect(filas).toHaveLength(2);
  });

  it('un archivo sin datos devuelve lista vacía', async () => {
    expect(await leerHojaComoObjetos(aBuffer('solo,cabecera'), 'x.csv')).toEqual([]);
  });

  it('un archivo corrupto lanza error en vez de procesar basura', async () => {
    await expect(leerHojaComoObjetos(aBuffer('esto no es un xlsx'), 'malo.xlsx')).rejects.toThrow();
  });
});
