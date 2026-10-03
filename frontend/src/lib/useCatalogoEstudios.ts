'use client';

import { useCallback, useEffect, useState } from 'react';
import { ESTUDIOS_CLINICOS, type EstudioItem } from '@/lib/catalogos';

export type CatalogoPorArea = Record<string, EstudioItem[]>;

/**
 * Catálogo de estudios vigente (precios y reparto) desde la base de datos.
 * Arranca con el catálogo incorporado para no dejar nunca la pantalla de cobro vacía, y se actualiza solo.
 */
export function useCatalogoEstudios() {
  const [catalogo, setCatalogo] = useState<CatalogoPorArea>(ESTUDIOS_CLINICOS);
  const [respaldo, setRespaldo] = useState(true);

  const recargar = useCallback(async () => {
    try {
      const res = await fetch('/api/catalogo/estudios');
      if (!res.ok) return;
      const data: { catalogo: CatalogoPorArea; respaldo: boolean } = await res.json();
      if (data.catalogo && Object.keys(data.catalogo).length > 0) {
        setCatalogo(data.catalogo);
        setRespaldo(Boolean(data.respaldo));
      }
    } catch {
      /* sin red: se conserva el catálogo actual */
    }
  }, []);

  useEffect(() => {
    const inicial = setTimeout(recargar, 0);
    const id = setInterval(recargar, 5 * 60 * 1000);
    return () => { clearTimeout(inicial); clearInterval(id); };
  }, [recargar]);

  return { catalogo, respaldo, recargar };
}
