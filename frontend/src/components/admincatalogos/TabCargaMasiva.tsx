'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Upload } from 'lucide-react';

interface TabCargaMasivaProps {
  onAbrir: () => void;
}

/** La importación real (con simulación previa y validación de pagos) vive en el diálogo de carga masiva. */
export const TabCargaMasiva: React.FC<TabCargaMasivaProps> = ({ onAbrir }) => (
  <Card className="max-w-2xl">
    <CardContent className="flex flex-col items-start gap-4">
      <div className="p-2.5 bg-clinica-selection rounded-xl text-clinica-primary">
        <FileSpreadsheet className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">Carga masiva de atenciones</h3>
        <p className="text-sm text-slate-500">
          Importe el historial de atenciones desde un Excel con la plantilla oficial. Antes de guardar se simula la carga:
          se validan fechas, tasa, cuadre de pagos y duplicados, y solo se registran las filas válidas. Los pacientes se
          crean o actualizan en el catálogo automáticamente.
        </p>
      </div>
      <Button onClick={onAbrir} className="bg-clinica-primary hover:bg-clinica-primary-dark text-white">
        <Upload className="w-4 h-4" />
        Cargar archivo Excel
      </Button>
    </CardContent>
  </Card>
);
