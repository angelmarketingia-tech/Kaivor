'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

const ROLES = [
  { v: 'admin', l: 'Administrador' }, { v: 'manager', l: 'Gerente' },
  { v: 'accountant', l: 'Contador' }, { v: 'cashier', l: 'Cajero' },
  { v: 'hr_manager', l: 'Jefe RRHH' }, { v: 'viewer', l: 'Solo lectura' },
];

export default function AccountDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: string; msg: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [invite, setInvite] = useState({ userId: '', role: 'viewer' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${API}/accounts/${id}`, { headers });
      setData(res.data);
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 401) { router.push('/auth/login'); return; }
      if (s === 404) setError({ kind: 'notfound', msg: 'Esta cuenta no existe.' });
      else setError({ kind: 'fail', msg: 'No pudimos cargar la cuenta.' });
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const act = async (body: any, msg: string) => {
    try {
      await axios.patch(`${API}/accounts/${id}`, body, { headers });
      showToast(msg);
      load();
    } catch (e: any) { showToast(e.response?.data?.message || 'No se pudo completar'); }
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );
  if (error) return (
    <AppLayout><div className="p-6 max-w-md mx-auto mt-16 text-center">
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="text-4xl mb-3">{error.kind === 'notfound' ? '🔍' : '⚠️'}</div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{error.msg}</h2>
        <div className="flex gap-2 justify-center mt-4">
          {error.kind === 'fail' && <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>}
          <Link href="/accounts" className="border border-slate-200 px-4 py-2 rounded-lg text-sm">Volver</Link>
        </div>
      </div>
    </div></AppLayout>
  );
  if (!data) return null;

  const a = data.account;
  const memberIds = new Set(data.memberships.map((m: any) => m.userId));
  const availableUsers = data.tenantUsers.filter((u: any) => !memberIds.has(u.id));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/accounts" className="text-slate-500 hover:text-slate-900">Cuentas</Link>
          <span className="text-slate-300">/</span><span className="text-slate-900 font-medium">{a.name}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{a.name}</h1>
              <p className="text-sm text-slate-500 capitalize">{a.type} · {a.country} · {a.currency}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {a.status === 'active' ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button onClick={() => act({ action: 'update-account', status: a.status === 'active' ? 'inactive' : 'active' },
              a.status === 'active' ? 'Cuenta desactivada' : 'Cuenta reactivada')}
              className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200">
              {a.status === 'active' ? 'Desactivar cuenta' : 'Reactivar cuenta'}
            </button>
          </div>
        </div>

        {/* Invite member */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Dar acceso a un usuario</h2>
          {availableUsers.length === 0 ? (
            <p className="text-sm text-slate-400">Todos los usuarios de la empresa ya tienen acceso a esta cuenta.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={invite.userId} onChange={e => setInvite(i => ({ ...i, userId: e.target.value }))}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Selecciona un usuario…</option>
                {availableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
              <select value={invite.role} onChange={e => setInvite(i => ({ ...i, role: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
              <button onClick={() => {
                if (!invite.userId) { showToast('Selecciona un usuario'); return; }
                act({ action: 'add-member', userId: invite.userId, role: invite.role }, 'Acceso otorgado');
                setInvite({ userId: '', role: 'viewer' });
              }} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Dar acceso</button>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Usuarios con acceso ({data.memberships.length})</span>
          </div>
          {data.memberships.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Sin usuarios asignados a esta cuenta.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.memberships.map((m: any) => (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{m.userName || m.userId}</p>
                  </div>
                  <select value={m.role} onChange={e => act({ action: 'change-role', membershipId: m.id, role: e.target.value }, 'Rol actualizado')}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                  </select>
                  <button onClick={() => act({ action: 'remove-member', membershipId: m.id }, 'Acceso retirado')}
                    className="text-xs text-slate-400 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
