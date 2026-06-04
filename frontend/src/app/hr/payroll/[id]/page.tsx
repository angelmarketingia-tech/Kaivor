'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const ST: Record<string, { l: string; c: string }> = {
  draft: { l: 'Borrador', c: 'surface-2 text-soft' },
  calculated: { l: 'Calculada', c: 'bg-blue-100 text-blue-700' },
  approved: { l: 'Aprobada', c: 'bg-brand-100 text-brand-700' },
  paid: { l: 'Pagada', c: 'bg-emerald-100 text-emerald-700' },
  partially_paid: { l: 'Pago parcial', c: 'bg-amber-100 text-amber-700' },
  cancelled: { l: 'Cancelada', c: 'bg-red-100 text-red-700' },
};

export default function PayrollDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [receiptItem, setReceiptItem] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${API}/hr/payroll/${id}`, { headers });
      setData(res.data);
      const emp = await axios.get(`${API}/hr/employees`, { headers });
      setEmployees(emp.data.filter((e: any) => e.status === 'active'));
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 401) { router.push('/auth/login'); return; }
      if (s === 404) setError({ kind: 'notfound', msg: 'Este periodo de nómina no existe.' });
      else setError({ kind: 'fail', msg: 'No pudimos cargar el periodo.' });
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const act = async (body: any, msg: string) => {
    setBusy(true);
    try {
      await axios.patch(`${API}/hr/payroll/${id}`, body, { headers });
      showToast(msg);
      await load();
    } catch (e: any) { showToast(e.response?.data?.message || 'No se pudo completar'); }
    finally { setBusy(false); }
  };

  const receiptHtml = (it: any) => {
    const c = data?.company || {};
    const b = data?.branding || {};
    const color = b.primaryColor || '#A3CC39';
    const logo = b.logoData && b.showLogoOnPdf
      ? `<img src="${b.logoData}" style="max-height:46px;margin-bottom:6px" />` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprobante ${it.employee.firstName}</title>
      <style>@media print{button{display:none}}body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#1e293b}</style></head><body>
      <div style="max-width:540px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:${color};color:#fff;padding:16px 20px">
          ${logo}<div style="font-size:16px;font-weight:700">${c.name || 'Empresa'}</div>
          <div style="font-size:11px;opacity:.9">NIT: ${c.taxId || '—'}</div>
        </div>
        <div style="padding:20px">
          <h2 style="font-size:15px;margin:0 0 4px">Comprobante de nómina</h2>
          <p style="font-size:12px;color:#64748b;margin:0 0 14px">Periodo: ${data.period.name}</p>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="padding:4px 0;color:#64748b">Empleado</td><td style="text-align:right;font-weight:600">${it.employee.firstName} ${it.employee.lastName}</td></tr>
            ${it.employee.documentNumber ? `<tr><td style="padding:4px 0;color:#64748b">Documento</td><td style="text-align:right">${it.employee.documentNumber}</td></tr>` : ''}
            ${it.employee.position ? `<tr><td style="padding:4px 0;color:#64748b">Cargo</td><td style="text-align:right">${it.employee.position}</td></tr>` : ''}
            <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding-top:6px"></td></tr>
            <tr><td style="padding:4px 0;color:#64748b">Salario base</td><td style="text-align:right">${fmt(it.baseSalary)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b">Ingresos</td><td style="text-align:right;color:#16a34a">+${fmt(it.earnings)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b">Deducciones</td><td style="text-align:right;color:#dc2626">-${fmt(it.deductions)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:700;border-top:2px solid #e2e8f0">Neto a pagar</td><td style="text-align:right;font-weight:700;font-size:16px;border-top:2px solid #e2e8f0;color:${color}">${fmt(it.netPay)}</td></tr>
          </table>
          <p style="font-size:12px;color:#64748b;margin-top:12px">Estado: ${it.status === 'paid' ? 'Pagado' : 'Pendiente'}</p>
          ${b.legalNote ? `<p style="font-size:10px;color:#94a3b8;margin-top:8px">${b.legalNote}</p>` : ''}
          <p style="font-size:10px;color:#94a3b8;margin-top:10px;border-top:1px solid #e2e8f0;padding-top:8px">
            Comprobante operativo generado por Kaivor. Valida la información con tu responsable contable o laboral.
          </p>
        </div>
      </div></body></html>`;
  };

  const printReceipt = (it: any) => {
    const w = window.open('', '_blank', 'width=620,height=720');
    if (!w) return;
    w.document.write(receiptHtml(it));
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const sendReceipt = async (it: any, channel: 'email' | 'whatsapp') => {
    setSending(true);
    try {
      const res = await axios.post(`${API}/hr/payroll/${id}/receipts`, { itemId: it.id, channel }, { headers });
      if (channel === 'whatsapp' && res.data.waUrl) window.open(res.data.waUrl, '_blank');
      showToast(res.data.message || 'Enviado');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'No se pudo enviar el comprobante');
    } finally { setSending(false); }
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );
  if (error) return (
    <AppLayout><div className="p-6 max-w-md mx-auto mt-16 text-center">
      <div className="surface rounded-xl border p-8">
        <div className="text-4xl mb-3">{error.kind === 'notfound' ? '🔍' : '⚠️'}</div>
        <h2 className="text-lg font-bold text-default mb-1">{error.msg}</h2>
        <div className="flex gap-2 justify-center mt-4">
          {error.kind === 'fail' && <button onClick={load} className="bg-ink-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-ink-700">Reintentar</button>}
          <Link href="/hr/payroll" className="border border-default px-4 py-2 rounded-lg text-sm text-default">Volver</Link>
        </div>
      </div>
    </div></AppLayout>
  );
  if (!data) return null;

  const p = data.period;
  const st = ST[p.status] ?? ST.draft;
  const inItems = new Set(data.items.map((i: any) => i.employeeId));
  const available = employees.filter(e => !inItems.has(e.id));
  const locked = p.status === 'paid' || p.status === 'cancelled';

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-ink-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/hr/payroll" className="text-soft hover:text-default">Nómina</Link>
          <span className="text-soft">/</span><span className="text-default font-medium">{p.name}</span>
        </div>

        {/* Header */}
        <div className="surface rounded-xl border p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-default">{p.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${st.c} inline-block mt-1`}>{st.l}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-soft">Neto a pagar</p>
              <p className="text-2xl font-bold text-default">{fmt(p.totalNet)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
            <div><p className="text-xs text-soft">Bruto</p><p className="font-medium text-default">{fmt(p.totalGross)}</p></div>
            <div><p className="text-xs text-soft">Deducciones</p><p className="font-medium text-default">{fmt(p.totalDeductions)}</p></div>
            <div><p className="text-xs text-soft">Empleados</p><p className="font-medium text-default">{data.items.length}</p></div>
          </div>
          {/* Actions */}
          {!locked && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-default">
              <button onClick={() => act({ action: 'calculate' }, 'Nómina calculada')} disabled={busy}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">Calcular</button>
              {p.status === 'calculated' && (
                <button onClick={() => act({ action: 'approve' }, 'Nómina aprobada')} disabled={busy}
                  className="text-xs bg-brand text-ink-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-300 disabled:opacity-50">Aprobar</button>
              )}
              {(p.status === 'approved' || p.status === 'partially_paid') && (
                <button onClick={() => act({ action: 'mark-paid' }, 'Nómina marcada como pagada')} disabled={busy}
                  className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">Marcar pagada</button>
              )}
              <button onClick={() => act({ action: 'cancel' }, 'Periodo cancelado')} disabled={busy}
                className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50">Cancelar</button>
            </div>
          )}
        </div>

        {/* Add employee */}
        {!locked && available.length > 0 && (
          <div className="surface rounded-xl border p-3 mb-4 flex items-center gap-2">
            <select id="addEmp" className="flex-1 border border-default rounded-lg px-3 py-2 text-sm bg-transparent text-default">
              <option value="">Agregar empleado al periodo…</option>
              {available.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
            <button onClick={() => {
              const sel = (document.getElementById('addEmp') as HTMLSelectElement).value;
              if (sel) act({ action: 'add-employee', employeeId: sel }, 'Empleado agregado');
            }} disabled={busy} className="bg-ink-900 text-white px-3 py-2 rounded-lg text-sm hover:bg-ink-700">Agregar</button>
          </div>
        )}

        {/* Items */}
        <div className="surface rounded-xl border overflow-hidden">
          {data.items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-soft">Sin empleados en este periodo.</p>
          ) : (
            <div className="divide-y divide-default">
              {data.items.map((it: any) => (
                <div key={it.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-default">{it.employee.firstName} {it.employee.lastName}</p>
                      <p className="text-xs text-soft">Base {fmt(it.baseSalary)} · +{fmt(it.earnings)} · -{fmt(it.deductions)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-default">{fmt(it.netPay)}</span>
                      <button onClick={() => setReceiptItem(it)} className="text-xs text-soft hover:underline">Comprobante</button>
                      {!locked && (
                        <button onClick={() => setEditItem({ ...it })} className="text-xs text-brand hover:underline">Editar</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit item modal */}
        {editItem && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditItem(null)}>
            <div className="surface rounded-xl border p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-default mb-3">{editItem.employee.firstName} {editItem.employee.lastName}</h3>
              <label className="text-xs text-soft block mb-1">Bonificaciones / extras</label>
              <input type="number" value={editItem.earnings} onChange={e => setEditItem({ ...editItem, earnings: e.target.value })}
                className="w-full border border-default rounded-lg px-3 py-2 text-sm mb-3 bg-transparent text-default" />
              <label className="text-xs text-soft block mb-1">Deducciones</label>
              <input type="number" value={editItem.deductions} onChange={e => setEditItem({ ...editItem, deductions: e.target.value })}
                className="w-full border border-default rounded-lg px-3 py-2 text-sm mb-4 bg-transparent text-default" />
              <div className="flex gap-2">
                <button onClick={async () => {
                  await act({ action: 'update-item', itemId: editItem.id, earnings: editItem.earnings, deductions: editItem.deductions }, 'Ítem actualizado');
                  setEditItem(null);
                }} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Guardar</button>
                <button onClick={async () => { await act({ action: 'remove-item', itemId: editItem.id }, 'Empleado removido'); setEditItem(null); }}
                  className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100">Quitar</button>
                <button onClick={() => setEditItem(null)} className="px-3 py-2 rounded-lg text-sm border border-default text-default">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt modal */}
        {receiptItem && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setReceiptItem(null)}>
            <div className="surface rounded-xl border p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-default">Comprobante de nómina</h3>
              <p className="text-xs text-soft mt-0.5 mb-1">
                {receiptItem.employee.firstName} {receiptItem.employee.lastName} · {data.period.name}
              </p>
              <div className="surface-2 rounded-lg p-3 my-3 text-sm">
                <div className="flex justify-between"><span className="text-soft">Salario base</span><span className="text-default">{fmt(receiptItem.baseSalary)}</span></div>
                <div className="flex justify-between"><span className="text-soft">Ingresos</span><span className="text-emerald-600">+{fmt(receiptItem.earnings)}</span></div>
                <div className="flex justify-between"><span className="text-soft">Deducciones</span><span className="text-red-600">-{fmt(receiptItem.deductions)}</span></div>
                <div className="flex justify-between font-bold border-t border-default mt-1 pt-1 text-default"><span>Neto</span><span>{fmt(receiptItem.netPay)}</span></div>
              </div>
              <div className="space-y-2">
                <button onClick={() => printReceipt(receiptItem)}
                  className="w-full bg-ink-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-ink-700">
                  🖨 Imprimir / descargar PDF
                </button>
                <button onClick={() => sendReceipt(receiptItem, 'email')} disabled={sending}
                  className="w-full surface-2 text-default py-2 rounded-lg text-sm font-medium hover-surface-2 disabled:opacity-50">
                  ✉ Enviar por email
                </button>
                <button onClick={() => sendReceipt(receiptItem, 'whatsapp')} disabled={sending}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  💬 Enviar por WhatsApp
                </button>
                <button onClick={() => setReceiptItem(null)}
                  className="w-full border border-default text-soft py-2 rounded-lg text-sm hover-surface-2">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-soft mt-3 surface-2 border border-default rounded-lg px-3 py-2">
          Esta es una gestión operativa de nómina. No reemplaza el cálculo legal de aportes y prestaciones de tu contador.
        </p>
      </div>
    </AppLayout>
  );
}
