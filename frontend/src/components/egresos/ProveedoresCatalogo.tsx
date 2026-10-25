'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAvisos } from '@/components/ui/avisos';
import { CONFIG_FISCAL_DEFECTO, type ConfigFiscal, type TipoPersona } from '@/lib/compras/calculos';
import { centsToNumber } from '@/lib/money';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import { pedir, type ProductoCompra, type Proveedor } from './comprasApi';

const etq = 'block text-xs font-bold text-slate-700 mb-1';
const sel = 'w-full h-9 rounded-xl border border-slate-300 bg-white px-2 text-xs';
const provVacio = { id: 0, rif: '', razon_social: '', direccion: '', telefono: '', correo: '', tipo_persona: 'JURIDICA' as TipoPersona, contribuyente_especial: false, activo: true };
const prodVacio = { id: 0, nombre: '', categoria: 'Insumos médicos', alicuota_defecto: 16, proveedor_id: 0, activo: true };

/** Altas y ediciones de proveedores y del catálogo de productos/servicios, y la configuración fiscal (retenciones). */
export function ProveedoresCatalogo({ onCambio }: { onCambio: () => void }) {
  const { avisar } = useAvisos();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<ProductoCompra[]>([]);
  const [cfg, setCfg] = useState<ConfigFiscal>(CONFIG_FISCAL_DEFECTO);
  const [prov, setProv] = useState(provVacio);
  const [prod, setProd] = useState(prodVacio);

  const cargar = useCallback(async () => {
    try {
      const [p, c, f] = await Promise.all([
        pedir<Proveedor[]>('/api/tesoreria/compras/proveedores'), pedir<ProductoCompra[]>('/api/tesoreria/compras/productos'),
        pedir<ConfigFiscal>('/api/tesoreria/compras/config'),
      ]);
      setProveedores(p); setProductos(c); setCfg(f);
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  }, [avisar]);
  useEffect(() => diferir(() => void cargar()), [cargar]);

  const guardar = async (url: string, body: unknown, metodo: 'POST' | 'PUT', ok: string, limpiar: () => void) => {
    try {
      await pedir(url, { method: metodo, body });
      avisar({ tipo: 'exito', mensaje: ok });
      limpiar();
      await cargar();
      onCambio();
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  };

  const guardarProveedor = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, ...body } = prov;
    void guardar(id ? `/api/tesoreria/compras/proveedores/${id}` : '/api/tesoreria/compras/proveedores', body, id ? 'PUT' : 'POST',
      id ? 'Proveedor actualizado.' : 'Proveedor creado.', () => setProv(provVacio));
  };
  const guardarProducto = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, ...body } = prod;
    void guardar(id ? `/api/tesoreria/compras/productos/${id}` : '/api/tesoreria/compras/productos', { ...body, proveedor_id: body.proveedor_id || null },
      id ? 'PUT' : 'POST', id ? 'Producto actualizado.' : 'Producto agregado al catálogo.', () => setProd(prodVacio));
  };
  const guardarConfig = (e: React.FormEvent) => {
    e.preventDefault();
    void guardar('/api/tesoreria/compras/config', { ...cfg, islr: cfg.islr.map((r) => ({ ...r, sustraendo: centsToNumber(r.sustraendo) })) }, 'PUT',
      'Configuración fiscal guardada.', () => {});
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 text-xs">
      <Card className="rounded-3xl border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-black">{prov.id ? 'Editar proveedor' : 'Nuevo proveedor'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={guardarProveedor} className="grid gap-2 md:grid-cols-2">
            <div><label className={etq}>RIF *</label><Input value={prov.rif} onChange={(e) => setProv({ ...prov, rif: e.target.value })} placeholder="J-12345678-9" required className="h-9" /></div>
            <div><label className={etq}>Razón social *</label><Input value={prov.razon_social} onChange={(e) => setProv({ ...prov, razon_social: e.target.value })} required className="h-9" /></div>
            <div className="md:col-span-2"><label className={etq}>Dirección fiscal</label><Input value={prov.direccion ?? ''} onChange={(e) => setProv({ ...prov, direccion: e.target.value })} className="h-9" /></div>
            <div><label className={etq}>Teléfono</label><Input value={prov.telefono ?? ''} onChange={(e) => setProv({ ...prov, telefono: e.target.value })} className="h-9" /></div>
            <div><label className={etq}>Correo (va en el comprobante de retención)</label><Input type="email" value={prov.correo ?? ''} onChange={(e) => setProv({ ...prov, correo: e.target.value })} className="h-9" /></div>
            <div>
              <label className={etq}>Tipo de persona</label>
              <select value={prov.tipo_persona} onChange={(e) => setProv({ ...prov, tipo_persona: e.target.value as TipoPersona })} className={sel}>
                <option value="JURIDICA">Jurídica</option><option value="NATURAL">Natural</option>
              </select>
            </div>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={prov.contribuyente_especial} onChange={(e) => setProv({ ...prov, contribuyente_especial: e.target.checked })} />Contribuyente especial</label>
            {prov.id > 0 && <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={prov.activo} onChange={(e) => setProv({ ...prov, activo: e.target.checked })} />Activo</label>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" className="rounded-xl text-xs font-bold">{prov.id ? 'Guardar cambios' : 'Crear proveedor'}</Button>
              {prov.id > 0 && <Button type="button" variant="outline" onClick={() => setProv(provVacio)} className="rounded-xl text-xs">Cancelar</Button>}
            </div>
          </form>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {proveedores.map((p) => (
              <li key={p.id} className={`flex items-center justify-between px-3 py-1.5 ${p.activo ? '' : 'text-slate-400'}`}>
                <span><b>{p.razon_social}</b> · {p.rif}{p.contribuyente_especial ? ' · Esp.' : ''}</span>
                <Button size="sm" variant="ghost" onClick={() => setProv({ ...p, direccion: p.direccion ?? '', telefono: p.telefono ?? '', correo: p.correo ?? '' })} className="h-7 text-xs">Editar</Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-black">{prod.id ? 'Editar producto o servicio' : 'Catálogo de productos y servicios'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={guardarProducto} className="grid gap-2 md:grid-cols-2">
            <div><label className={etq}>Nombre *</label><Input value={prod.nombre} onChange={(e) => setProd({ ...prod, nombre: e.target.value })} required className="h-9" /></div>
            <div><label className={etq}>Categoría *</label><Input value={prod.categoria} onChange={(e) => setProd({ ...prod, categoria: e.target.value })} required className="h-9" /></div>
            <div>
              <label className={etq}>Alícuota por defecto</label>
              <select value={prod.alicuota_defecto} onChange={(e) => setProd({ ...prod, alicuota_defecto: Number(e.target.value) })} className={sel}>
                {cfg.alicuotas.map((a) => <option key={a} value={a}>{a === 0 ? 'Exento' : `${a} %`}</option>)}
              </select>
            </div>
            <div>
              <label className={etq}>Proveedor (opcional)</label>
              <select value={prod.proveedor_id ?? 0} onChange={(e) => setProd({ ...prod, proveedor_id: Number(e.target.value) })} className={sel}>
                <option value={0}>Cualquier proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
            </div>
            {prod.id > 0 && <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={prod.activo} onChange={(e) => setProd({ ...prod, activo: e.target.checked })} />Activo</label>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" className="rounded-xl text-xs font-bold">{prod.id ? 'Guardar cambios' : 'Agregar al catálogo'}</Button>
              {prod.id > 0 && <Button type="button" variant="outline" onClick={() => setProd(prodVacio)} className="rounded-xl text-xs">Cancelar</Button>}
            </div>
          </form>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {productos.map((p) => (
              <li key={p.id} className={`flex items-center justify-between px-3 py-1.5 ${p.activo ? '' : 'text-slate-400'}`}>
                <span><b>{p.nombre}</b> · {p.categoria} · {p.alicuota_defecto === 0 ? 'Exento' : `${p.alicuota_defecto} %`}</span>
                <Button size="sm" variant="ghost" onClick={() => setProd({ ...p, proveedor_id: p.proveedor_id ?? 0 })} className="h-7 text-xs">Editar</Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200 lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-black">Configuración fiscal</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={guardarConfig} className="space-y-3">
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" checked={cfg.retencionesActivas} onChange={(e) => setCfg({ ...cfg, retencionesActivas: e.target.checked })} />
              Retenciones activas (solo si la clínica es agente de retención)
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={etq}>% IVA retenido</label>
                <select value={cfg.ivaRetenidoPct} onChange={(e) => setCfg({ ...cfg, ivaRetenidoPct: Number(e.target.value) as 75 | 100 })} className={sel}>
                  <option value={75}>75 %</option><option value={100}>100 %</option>
                </select>
              </div>
              <div>
                <label className={etq}>Alícuotas vigentes (%, separadas por coma)</label>
                <Input defaultValue={cfg.alicuotas.join(', ')} key={cfg.alicuotas.join()} onBlur={(e) => setCfg({ ...cfg, alicuotas: e.target.value.split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 0 && x <= 100) })} className="h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-bold">Tabla de retención de ISLR</p>
              {cfg.islr.map((r, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-5">
                  <Input value={r.concepto} placeholder="Concepto" onChange={(e) => setCfg({ ...cfg, islr: cfg.islr.map((x, j) => (j === i ? { ...x, concepto: e.target.value } : x)) })} className="h-9 md:col-span-2" />
                  <select value={r.tipoPersona} onChange={(e) => setCfg({ ...cfg, islr: cfg.islr.map((x, j) => (j === i ? { ...x, tipoPersona: e.target.value as TipoPersona } : x)) })} className={sel}>
                    <option value="JURIDICA">Jurídica</option><option value="NATURAL">Natural</option>
                  </select>
                  <Input type="number" step="0.01" value={r.pct} placeholder="%" onChange={(e) => setCfg({ ...cfg, islr: cfg.islr.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)) })} className="h-9" />
                  <div className="flex gap-1">
                    <Input type="number" step="0.01" value={centsToNumber(r.sustraendo)} placeholder="Sustraendo Bs" onChange={(e) => setCfg({ ...cfg, islr: cfg.islr.map((x, j) => (j === i ? { ...x, sustraendo: Math.round(Number(e.target.value) * 100) } : x)) })} className="h-9" />
                    <Button type="button" variant="ghost" onClick={() => setCfg({ ...cfg, islr: cfg.islr.filter((_, j) => j !== i) })} className="h-9 text-xs">Quitar</Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setCfg({ ...cfg, islr: [...cfg.islr, { concepto: '', tipoPersona: 'JURIDICA', pct: 0, sustraendo: 0 }] })} className="rounded-lg text-xs">Agregar concepto ISLR</Button>
            </div>
            <Button type="submit" className="rounded-xl text-xs font-bold">Guardar configuración</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
