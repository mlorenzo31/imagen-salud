'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAvisos } from '@/components/ui/avisos';
import { useFechaOperacion } from '@/components/FechaOperacion';
import { calcularTotales, CONFIG_FISCAL_DEFECTO, type ConfigFiscal } from '@/lib/compras/calculos';
import { toCents, centsToNumber } from '@/lib/money';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import type { CuentaBancaria } from '@/types';
import { fmt, pedir, type ProductoCompra, type Proveedor } from './comprasApi';

interface Linea { producto_id: number | null; descripcion: string; cantidad: string; precio: string; alicuota: number }
const lineaVacia = (alicuota = 16): Linea => ({ producto_id: null, descripcion: '', cantidad: '1', precio: '', alicuota });
const sel = 'w-full h-9 rounded-xl border border-slate-300 bg-white px-2 text-xs';
const etq = 'block text-xs font-bold text-slate-700 mb-1';

/** Registro de una compra con factura: proveedor, líneas del catálogo, IVA por alícuota, contado o crédito. */
export function FormCompra({ cuentas, onRegistrada }: { cuentas: CuentaBancaria[]; onRegistrada: () => void }) {
  const { avisar } = useAvisos();
  const fechaOp = useFechaOperacion();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<ProductoCompra[]>([]);
  const [cfg, setCfg] = useState<ConfigFiscal>(CONFIG_FISCAL_DEFECTO);
  const [proveedorId, setProveedorId] = useState<number>(0);
  const [numero, setNumero] = useState('');
  const [control, setControl] = useState('');
  const [fechaFactura, setFechaFactura] = useState(fechaOp.payload.fecha ?? '');
  const [moneda, setMoneda] = useState<'BS' | 'USD'>('BS');
  const [tasa, setTasa] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia()]);
  const [condicion, setCondicion] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [vencimiento, setVencimiento] = useState('');
  const [conceptoIslr, setConceptoIslr] = useState('');
  const [cuentaId, setCuentaId] = useState<number>(cuentas[0]?.id ?? 0);
  const [montoPago, setMontoPago] = useState('');
  const [tasaPago, setTasaPago] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => diferir(() => {
    void pedir<Proveedor[]>('/api/tesoreria/compras/proveedores').then((p) => setProveedores(p.filter((x) => x.activo))).catch(() => {});
    void pedir<ProductoCompra[]>('/api/tesoreria/compras/productos').then((p) => setProductos(p.filter((x) => x.activo))).catch(() => {});
    void pedir<ConfigFiscal>('/api/tesoreria/compras/config').then(setCfg).catch(() => {});
    // La tasa se prellena con la BCV del día y se puede modificar.
    void fetch('/api/bcv').then((r) => r.json()).then((d) => { if (d.tasa > 0) { setTasa((t) => t || String(d.tasa)); setTasaPago((t) => t || String(d.tasa)); } }).catch(() => {});
  }), []);

  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const tasaNum = Number(tasa.replace(',', '.')) || 0;

  // Vista previa en centavos con la misma función que usa el servidor.
  const totales = useMemo(() => {
    try {
      const ls = lineas.filter((l) => Number(l.cantidad) > 0 && Number(l.precio) > 0)
        .map((l) => ({ cantidad: Math.round(Number(l.cantidad.replace(',', '.')) * 1000), precio: toCents(l.precio), alicuota: l.alicuota }));
      const cfgMoneda = moneda === 'USD' && tasaNum > 0 ? { ...cfg, islr: cfg.islr.map((r) => ({ ...r, sustraendo: Math.round(r.sustraendo / tasaNum) })) } : cfg;
      return calcularTotales(ls, cfgMoneda, { contribuyenteEspecial: proveedor?.contribuyente_especial ?? false, tipoPersona: proveedor?.tipo_persona ?? 'JURIDICA', conceptoIslr: conceptoIslr || undefined });
    } catch {
      return null;
    }
  }, [lineas, cfg, proveedor, conceptoIslr, moneda, tasaNum]);

  // Monto sugerido para pagar de contado, en la moneda de la cuenta elegida.
  const tasaPagoNum = Number(tasaPago.replace(',', '.')) || 0;
  const sugerido = totales ? (cuenta?.moneda === moneda ? centsToNumber(totales.netoAPagar)
    : tasaPagoNum > 0 ? (moneda === 'USD' ? centsToNumber(totales.netoAPagar) * tasaPagoNum : centsToNumber(totales.netoAPagar) / tasaPagoNum) : 0) : 0;

  const cambiarLinea = (i: number, cambios: Partial<Linea>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)));
  const elegirProducto = (i: number, id: number) => {
    const p = productos.find((x) => x.id === id);
    cambiarLinea(i, p ? { producto_id: p.id, descripcion: p.nombre, alicuota: p.alicuota_defecto } : { producto_id: null });
  };

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) return avisar({ tipo: 'alerta', mensaje: 'Elija el proveedor.' });
    if (!totales || totales.total <= 0) return avisar({ tipo: 'alerta', mensaje: 'Agregue al menos una línea con cantidad y precio.' });
    setEnviando(true);
    try {
      const r = await pedir<{ mensaje: string; comprobante_retencion: string | null }>('/api/tesoreria/compras/facturas', {
        body: {
          proveedor_id: proveedorId, numero_factura: numero, numero_control: control || null, fecha_factura: fechaFactura, moneda, tasa,
          lineas: lineas.filter((l) => Number(l.cantidad) > 0 && Number(l.precio) > 0).map((l) => ({ ...l, producto_id: l.producto_id ?? undefined })),
          condicion, vencimiento: condicion === 'CREDITO' ? vencimiento || null : null, concepto_islr: conceptoIslr || null, notas: notas || null,
          pago: condicion === 'CONTADO' ? { cuenta_id: cuentaId, monto: montoPago || sugerido.toFixed(2), tasa: tasaPago } : null,
          ...fechaOp.payload,
        },
      });
      avisar({ tipo: 'exito', mensaje: r.mensaje + (r.comprobante_retencion ? ` Comprobante de retención ${r.comprobante_retencion}.` : '') });
      setNumero(''); setControl(''); setLineas([lineaVacia()]); setMontoPago(''); setNotas('');
      onRegistrada();
    } catch (err) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(err) });
    } finally {
      setEnviando(false);
    }
  };

  const m = moneda;
  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-3xl">
      <CardContent className="p-6">
        <form onSubmit={registrar} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className={etq}>Proveedor *</label>
              <select value={proveedorId} onChange={(e) => setProveedorId(Number(e.target.value))} className={sel}>
                <option value={0}>Elija un proveedor (créelos en Proveedores y catálogo)</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social} · {p.rif}</option>)}
              </select>
            </div>
            <div><label className={etq}>N° factura *</label><Input value={numero} onChange={(e) => setNumero(e.target.value)} required className="h-9" /></div>
            <div><label className={etq}>N° control</label><Input value={control} onChange={(e) => setControl(e.target.value)} className="h-9" /></div>
            <div><label className={etq}>Fecha de la factura *</label><Input type="date" value={fechaFactura} onChange={(e) => setFechaFactura(e.target.value)} required className="h-9" /></div>
            <div>
              <label className={etq}>Moneda de la factura</label>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as 'BS' | 'USD')} className={sel}><option value="BS">Bolívares</option><option value="USD">Dólares</option></select>
            </div>
            <div><label className={etq}>Tasa (Bs/$) — editable</label><Input type="number" step="0.0001" value={tasa} onChange={(e) => setTasa(e.target.value)} required className="h-9 font-mono" /></div>
            {cfg.retencionesActivas && cfg.islr.length > 0 && (
              <div>
                <label className={etq}>Concepto ISLR</label>
                <select value={conceptoIslr} onChange={(e) => setConceptoIslr(e.target.value)} className={sel}>
                  <option value="">Sin retención ISLR</option>
                  {[...new Set(cfg.islr.map((r) => r.concepto))].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-bold text-slate-800">Líneas</p>
            {lineas.map((l, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-12 items-end">
                <select value={l.producto_id ?? 0} onChange={(e) => elegirProducto(i, Number(e.target.value))} className={`${sel} md:col-span-3`}>
                  <option value={0}>Producto del catálogo…</option>
                  {productos.filter((p) => !p.proveedor_id || p.proveedor_id === proveedorId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <Input placeholder="Descripción" value={l.descripcion} onChange={(e) => cambiarLinea(i, { descripcion: e.target.value })} className="h-9 md:col-span-3" />
                <Input type="number" step="0.001" placeholder="Cant." value={l.cantidad} onChange={(e) => cambiarLinea(i, { cantidad: e.target.value })} className="h-9 md:col-span-1 font-mono" />
                <Input type="number" step="0.01" placeholder={`Precio ${m === 'USD' ? '$' : 'Bs'}`} value={l.precio} onChange={(e) => cambiarLinea(i, { precio: e.target.value })} className="h-9 md:col-span-2 font-mono" />
                <select value={l.alicuota} onChange={(e) => cambiarLinea(i, { alicuota: Number(e.target.value) })} className={`${sel} md:col-span-2`}>
                  {cfg.alicuotas.map((a) => <option key={a} value={a}>{a === 0 ? 'Exento' : `${a} %`}</option>)}
                </select>
                <Button type="button" variant="ghost" onClick={() => setLineas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} className="h-9 md:col-span-1" aria-label="Quitar línea">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setLineas((ls) => [...ls, lineaVacia(cfg.alicuotas[0])])} className="rounded-lg text-xs">
              <Plus className="h-3.5 w-3.5" />Agregar línea
            </Button>
          </div>

          {totales && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 font-mono">
              {totales.porAlicuota.map((p) => <div key={p.alicuota} className="flex justify-between"><span>Base {p.alicuota} % / IVA</span><span>{fmt(centsToNumber(p.base), m)} / {fmt(centsToNumber(p.iva), m)}</span></div>)}
              {totales.exento > 0 && <div className="flex justify-between"><span>Exento</span><span>{fmt(centsToNumber(totales.exento), m)}</span></div>}
              <div className="flex justify-between font-bold"><span>Total factura</span><span>{fmt(centsToNumber(totales.total), m)}</span></div>
              {totales.ivaRetenido > 0 && <div className="flex justify-between text-amber-800"><span>IVA retenido</span><span>−{fmt(centsToNumber(totales.ivaRetenido), m)}</span></div>}
              {totales.islrRetenido > 0 && <div className="flex justify-between text-amber-800"><span>ISLR retenido</span><span>−{fmt(centsToNumber(totales.islrRetenido), m)}</span></div>}
              <div className="flex justify-between font-black text-emerald-800"><span>Neto a pagar</span><span>{fmt(centsToNumber(totales.netoAPagar), m)}</span></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 md:w-80">
            {(['CONTADO', 'CREDITO'] as const).map((c) => (
              <Button key={c} type="button" variant={condicion === c ? 'default' : 'ghost'} onClick={() => setCondicion(c)} className="h-8 rounded-lg text-xs font-bold">
                {c === 'CONTADO' ? 'Contado' : 'Crédito'}
              </Button>
            ))}
          </div>
          {condicion === 'CREDITO' ? (
            <div className="md:w-60"><label className={etq}>Vencimiento</label><Input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} className="h-9" /></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className={etq}>Pagar desde</label>
                <select value={cuentaId} onChange={(e) => setCuentaId(Number(e.target.value))} className={sel}>
                  {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {fmt(c.saldo_actual, c.moneda === 'USD' ? 'USD' : 'BS')}</option>)}
                </select>
              </div>
              {cuenta && cuenta.moneda !== moneda && (
                <div><label className={etq}>Tasa del pago — editable</label><Input type="number" step="0.0001" value={tasaPago} onChange={(e) => setTasaPago(e.target.value)} className="h-9 font-mono" /></div>
              )}
              <div>
                <label className={etq}>Monto ({cuenta?.moneda === 'USD' ? '$' : 'Bs'})</label>
                <Input type="number" step="0.01" value={montoPago} placeholder={sugerido.toFixed(2)} onChange={(e) => setMontoPago(e.target.value)} className="h-9 font-mono" />
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className={etq}>Notas</label><Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" className="h-9" /></div>
            {condicion === 'CONTADO' && <div>{fechaOp.campo}</div>}
          </div>
          <Button type="submit" disabled={enviando || fechaOp.incompleta} className="w-full rounded-xl text-xs font-bold">
            {enviando ? 'Registrando…' : condicion === 'CONTADO' ? 'Registrar y pagar factura' : 'Registrar factura por pagar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
