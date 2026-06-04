'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface PermDef { key: string; label: string; group: string; sensitive?: boolean }
interface Member {
  id: string; email: string | null; username?: string | null; name: string | null; role: string; isActive: boolean;
  effectivePermissions: Record<string, boolean>;
}
interface Usage { plan: string; used: number; limit: number; remaining: number }
interface RoleTemplate { id: string; label: string; baseRole: string; hint: string; permissions?: Record<string, boolean> }

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', manager: 'Gerente', cashier: 'Cajero',
  assistant: 'Asistente', accountant: 'Contador', viewer: 'Solo lectura',
};

export default function TeamPage() {
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const [catalog, setCatalog] = useState<PermDef[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [genericTemplates, setGenericTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // create/edit form
  const [editing, setEditing] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [form, setForm] = useState<{ name: string; email: string; username: string; password: string; role: string; permissions: Record<string, boolean> }>(
    { name: '', email: '', username: '', password: '', role: 'cashier', permissions: {} },
  );
  const [saving, setSaving] = useState(false);
  // Resultado del reseteo de contraseña (se muestra una vez)
  const [resetResult, setResetResult] = useState<{ who: string; password: string } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cat, team, use, tpl] = await Promise.all([
        axios.get(`${API}/users/permissions/catalog`, { headers }),
        axios.get(`${API}/users/team`, { headers }),
        axios.get(`${API}/users/team/usage`, { headers }),
        axios.get(`${API}/users/team/role-templates`, { headers }),
      ]);
      setCatalog(cat.data.permissions || []);
      setMembers(team.data || []);
      setUsage(use.data || null);
      setTemplates(tpl.data.templates || []);
      setGenericTemplates(tpl.data.generic || []);
    } catch (e: any) {
      setError(e.response?.data?.message || 'No se pudo cargar el equipo.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!token) { router.push('/auth/login'); return; } load(); }, []);

  const groups = Array.from(new Set(catalog.map((p) => p.group)));

  // Aplica una plantilla: fija el rol base y precarga sus permisos (los defaults del rol
  // se traen del backend al guardar; aquí mostramos los overrides explícitos de la plantilla).
  const applyTemplate = (t: RoleTemplate) => {
    setSelectedTemplate(t.id);
    setForm((f) => ({ ...f, role: t.baseRole, permissions: t.permissions ? { ...t.permissions } : {} }));
  };

  const openCreate = () => {
    setEditing(null);
    setSelectedTemplate('');
    setShowAdvanced(false);
    const first = templates[0];
    if (first) {
      setForm({ name: '', email: '', username: '', password: '', role: first.baseRole, permissions: first.permissions ? { ...first.permissions } : {} });
      setSelectedTemplate(first.id);
    } else {
      setForm({ name: '', email: '', username: '', password: '', role: 'cashier', permissions: {} });
    }
    setShowForm(true);
  };
  const openEdit = (m: Member) => {
    setEditing(m);
    setSelectedTemplate('');
    setShowAdvanced(true);
    setForm({ name: m.name || '', email: m.email || '', username: (m as any).username || '', password: '', role: m.role, permissions: { ...m.effectivePermissions } });
    setShowForm(true);
  };

  const togglePerm = (key: string) => { setSelectedTemplate(''); setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } })); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.patch(`${API}/users/${editing.id}`, { name: form.name, role: form.role, permissions: form.permissions, ...(form.password ? { password: form.password } : {}) }, { headers });
      } else {
        await axios.post(`${API}/users`, { name: form.name, email: form.email || undefined, username: form.username || undefined, password: form.password, role: form.role, permissions: form.permissions }, { headers });
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'No se pudo guardar.');
    } finally { setSaving(false); }
  };

  const resetPassword = async (m: Member) => {
    if (!confirm(`¿Generar una nueva contraseña para ${m.name || m.email || m.username}? La actual dejará de funcionar.`)) return;
    setResettingId(m.id);
    try {
      const res = await axios.post(`${API}/users/${m.id}/reset-password`, {}, { headers });
      setCopied(false);
      setResetResult({ who: m.name || m.email || m.username || 'Usuario', password: res.data.temporaryPassword });
    } catch (e: any) {
      alert(e.response?.data?.message || 'No se pudo resetear la contraseña.');
    } finally { setResettingId(null); }
  };

  const copyPassword = async () => {
    if (!resetResult) return;
    try { await navigator.clipboard.writeText(resetResult.password); setCopied(true); } catch {}
  };

  const remove = async (m: Member) => {
    if (!confirm(`¿Eliminar a ${m.name || m.email || m.username} del equipo?`)) return;
    try { await axios.delete(`${API}/users/${m.id}`, { headers }); await load(); }
    catch (e: any) { alert(e.response?.data?.message || 'No se pudo eliminar.'); }
  };

  const atLimit = usage && usage.limit !== -1 && usage.remaining <= 0;

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-default border-t-brand rounded-full animate-spin" /></div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="mb-1"><Link href="/settings" className="text-xs text-soft hover:text-brand">← Configuración</Link></div>
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-default">Equipo y permisos</h1>
            <p className="text-sm text-soft mt-0.5">Crea perfiles para tu equipo y controla qué puede ver cada uno.</p>
          </div>
          <button onClick={openCreate} disabled={!!atLimit}
            className="bg-brand text-ink-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-300 transition-colors disabled:opacity-50">
            + Agregar usuario
          </button>
        </div>

        {/* Usage */}
        {usage && (
          <div className="surface rounded-xl border p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-soft uppercase tracking-wide">Usuarios del plan {usage.plan}</p>
              <span className="text-xs font-medium text-default">{usage.used}{usage.limit === -1 ? '' : ` / ${usage.limit}`}</span>
            </div>
            {usage.limit !== -1 && (
              <div className="w-full surface-2 rounded-full h-2">
                <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }} />
              </div>
            )}
            {atLimit && (
              <p className="text-xs text-amber-500 mt-2">
                Alcanzaste el límite de tu plan. <Link href="/pricing" className="text-brand hover:underline font-medium">Mejora tu plan</Link> para agregar más miembros.
              </p>
            )}
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm mb-4">{error}</div>}

        {/* Members list */}
        <div className="surface rounded-xl border divide-default overflow-hidden">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-ink-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {(m.name || m.email || m.username || '?')[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-default truncate">{m.name || m.email || m.username}</p>
                <p className="text-xs text-soft truncate">{m.email || (m.username ? `usuario: ${m.username}` : '')} · {ROLE_LABEL[m.role] || m.role}{!m.isActive && ' · inactivo'}</p>
              </div>
              <button onClick={() => openEdit(m)} className="text-xs text-brand hover:underline font-medium">Permisos</button>
              <button onClick={() => resetPassword(m)} disabled={resettingId === m.id} className="text-xs text-soft hover:text-default disabled:opacity-50">
                {resettingId === m.id ? '…' : 'Resetear clave'}
              </button>
              <button onClick={() => remove(m)} className="text-xs text-soft hover:text-red-500">Eliminar</button>
            </div>
          ))}
          {members.length === 0 && <p className="text-sm text-soft px-4 py-6 text-center">Aún no hay miembros adicionales.</p>}
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setShowForm(false)}>
            <div className="surface rounded-2xl border w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-default flex items-center justify-between">
                <h3 className="font-semibold text-default">{editing ? `Editar ${editing.name || editing.email}` : 'Nuevo usuario'}</h3>
                <button onClick={() => setShowForm(false)} className="text-soft hover:text-default">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-soft block mb-1">Nombre</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej. Cajera 1, Juan Mesero…"
                    className="w-full surface-2 border border-default rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand" />
                </div>

                {/* Plantillas de rol según el tipo de negocio */}
                {!editing && (
                  <div>
                    <label className="text-xs text-soft block mb-1.5">¿Qué hace esta persona en tu negocio?</label>
                    <div className="flex flex-wrap gap-2">
                      {templates.map((t) => (
                        <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${selectedTemplate === t.id ? 'border-brand bg-brand-50 text-brand font-medium' : 'border-default text-default hover:bg-black/5 dark:hover:bg-white/5'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {selectedTemplate && (
                      <p className="text-xs text-soft mt-1.5">{templates.find((t) => t.id === selectedTemplate)?.hint}</p>
                    )}
                    <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="text-xs text-soft hover:text-brand mt-2">
                      {showAdvanced ? '− Ocultar roles avanzados' : '+ Más opciones (roles genéricos)'}
                    </button>
                    {showAdvanced && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {genericTemplates.map((t) => (
                          <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${selectedTemplate === t.id ? 'border-brand bg-brand-50 text-brand font-medium' : 'border-default text-soft hover:bg-black/5 dark:hover:bg-white/5'}`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!editing && (
                  <>
                    <div>
                      <label className="text-xs text-soft block mb-1">Usuario (para iniciar sesión)</label>
                      <input type="text" value={form.username} autoCapitalize="none" autoCorrect="off"
                        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                        placeholder="ej. cajera1"
                        className="w-full surface-2 border border-default rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand" />
                      <p className="text-[11px] text-soft mt-1">Con este usuario y la contraseña el empleado entra. No necesita correo.</p>
                    </div>
                    <div>
                      <label className="text-xs text-soft block mb-1">Correo (opcional)</label>
                      <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="solo si quieres que pueda recuperar su clave por correo"
                        className="w-full surface-2 border border-default rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand" />
                    </div>
                    <div>
                      <label className="text-xs text-soft block mb-1">Contraseña (mín. 8)</label>
                      <input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full surface-2 border border-default rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand" />
                    </div>
                  </>
                )}
                {editing && (
                  <div>
                    <label className="text-xs text-soft block mb-1">Nueva contraseña (opcional)</label>
                    <input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Dejar vacío para no cambiar"
                      className="w-full surface-2 border border-default rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand" />
                  </div>
                )}

                {/* Permission switches grouped */}
                <div>
                  <p className="text-xs font-semibold text-default mb-2">¿Qué puede ver y hacer este usuario?</p>
                  {groups.map((g) => (
                    <div key={g} className="mb-3">
                      <p className="text-[11px] uppercase tracking-wide text-soft mb-1.5">{g}</p>
                      <div className="space-y-1.5">
                        {catalog.filter((p) => p.group === g).map((p) => (
                          <label key={p.key} className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                            <span className={`text-sm ${p.sensitive ? 'text-default font-medium' : 'text-soft'}`}>
                              {p.label}{p.sensitive && <span className="ml-1.5 text-[10px] text-amber-500">sensible</span>}
                            </span>
                            <button type="button" onClick={() => togglePerm(p.key)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${form.permissions[p.key] ? 'bg-brand' : 'bg-ink-300'}`}>
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${form.permissions[p.key] ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-default flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-default text-default hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
                <button onClick={save} disabled={saving || (!editing && ((!form.email && !form.username) || form.password.length < 8))}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-ink-900 hover:bg-brand-300 disabled:opacity-50">
                  {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resultado del reseteo de contraseña */}
        {resetResult && (
          <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setResetResult(null)}>
            <div className="surface rounded-2xl border w-full max-w-sm p-5 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="text-3xl mb-2">🔑</div>
              <h3 className="font-semibold text-default mb-1">Nueva contraseña para {resetResult.who}</h3>
              <p className="text-xs text-soft mb-4">Cópiala y entrégasela. Por seguridad, no se volverá a mostrar.</p>
              <div className="surface-2 border border-default rounded-lg px-3 py-3 mb-3">
                <span className="text-lg font-mono font-bold text-default tracking-wide select-all">{resetResult.password}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={copyPassword}
                  className="flex-1 bg-brand text-ink-900 py-2 rounded-lg text-sm font-semibold hover:bg-brand-300">
                  {copied ? '✓ Copiada' : 'Copiar'}
                </button>
                <button onClick={() => setResetResult(null)}
                  className="px-4 py-2 rounded-lg text-sm border border-default text-default hover:bg-black/5 dark:hover:bg-white/5">
                  Listo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
