const MAX_BYTES = 4 * 1024 * 1024;
const LADO_MAX = 2200;

/** Reduce imágenes grandes (JPEG ~85%) para cumplir el límite de subida; PDF/DOCX pasan tal cual. */
export async function comprimirImagen(file: File): Promise<File> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size <= 1.2 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export interface ResultadoSubida {
  subidos: number;
  errores: string[];
  adjuntoNombre: string | null;
}

export async function subirAdjuntos(
  facturaId: number,
  archivos: File[],
  onProgreso?: (hecho: number, total: number) => void,
): Promise<ResultadoSubida> {
  const out: ResultadoSubida = { subidos: 0, errores: [], adjuntoNombre: null };
  for (let i = 0; i < archivos.length; i++) {
    onProgreso?.(i, archivos.length);
    const file = await comprimirImagen(archivos[i]);
    if (file.size > MAX_BYTES) { out.errores.push(`${archivos[i].name}: supera 4 MB`); continue; }
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/adjuntos`, { method: 'POST', body: fd });
      const json = (await res.json().catch(() => ({}))) as { error?: string; adjunto_nombre?: string };
      if (!res.ok) { out.errores.push(`${archivos[i].name}: ${json.error ?? 'error al subir'}`); continue; }
      out.subidos++;
      out.adjuntoNombre = json.adjunto_nombre ?? out.adjuntoNombre;
    } catch {
      out.errores.push(`${archivos[i].name}: sin conexión`);
    }
  }
  onProgreso?.(archivos.length, archivos.length);
  return out;
}
