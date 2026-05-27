'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

const STAGES = [
  { v: 'applied', l: 'Postulado' }, { v: 'screening', l: 'Filtro' },
  { v: 'interview', l: 'Entrevista' }, { v: 'offer', l: 'Oferta' },
  { v: 'hired', l: 'Contratado' }, { v: 'rejected', l: 'Descartado' },
];
const STAGE_CLS: Record<string, string> = {
  applied: 'bg-slate-100 text-slate-600', screening: 'bg-blue-100 text-blue-700',
  interview: 'bg-violet-100 text-violet-700', offer: 'bg-amber-100 text-amber-700',
  hired: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700',
};

export default function VacanciesPage() {
  const router = useRouter();
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', department: '', location: '', employmentType: '', salaryRange: '', description: '', requirements: '' });
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [cand, setCand] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    axios.get(`${API}/hr/vacancies`, { headers })
      .then(r => setVacancies(r.data))
      .catch(err => { if (err.response?.status === 403) setLocked(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (!token) { router.push('/auth/login'); return; } load(); }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const create = async () => {
    if (!form.title.trim()) { showToast('El título es requerido'); return; }
    try {
      await axios.post(`${API}/hr/vacancies`, form, { headers });
      showToast('Vacante creada');
      setShowForm(false);
      setForm({ title: '', department: '', location: '', employmentType: '', salaryRange: '', description: '', requirements: '' });
      load();
    } catch { showToast('No se pudo crear'); }
  };

  const openDetail = async (id: string) => {
    try {
      const res = await axios.get(`${API}/hr/vacancies/${id}`, { headers });
      setDetail(res.data);
    } catch { showToast('No se pudo abrir la vacante'); }
  };

  const aiDescription = () => {
    if (!form.title.trim()) { showToast('Escribe primero el título del cargo'); return; }
    const t = form.title.trim();
    setForm(f => ({
      ...f,
      description: `Buscamos un(a) ${t} comprometido(a) para integrarse a nuestro equipo${f.department ? ` en el área de ${f.department}` : ''}. La persona será responsable de las funciones propias del cargo, trabajando de forma colaborativa y orientada a resultados.`,
      requirements: `Experiencia previa como ${t} o en cargos similares. Buena actitud, trabajo en equipo, responsabilidad y disposición para aprender.${f.location ? ` Disponibilidad para trabajar en ${f.location}.` : ''}`,
    }));
    showToast('Descripción generada — revísala y ajústala');
  };

  const addCandidate = async () => {
    if (!cand.firstName.trim() || !cand.lastName.trim()) { showToast('Nombre y apellido requeridos'); return; }
    try {
      await axios.patch(`${API}/hr/vacancies/${detail.vacancy.id}`, { action: 'add-candidate', ...cand }, { headers });
      setCand({ firstName: '', lastName: '', email: '', phone: '' });
      openDetail(detail.vacancy.id);
      showToast('Candidato agregado');
    } catch { showToast('No se pudo agregar'); }
  };

  const moveCandidate = async (candidateId: string, stage: string) => {
    try {
      await axios.patch(`${API}/hr/vacancies/${detail.vacancy.id}`, { action: 'update-candidate', candidateId, stage }, { headers });
      openDetail(detail.vacancy.id);
    } catch { showToast('No se pudo actualizar'); }
  };

  const toggleVacancy = async () => {
    try {
      await axios.patch(`${API}/hr/vacancies/${detail.vacancy.id}`,
        { action: 'update-vacancy', status: detail.vacancy.status === 'open' ? 'closed' : 'open' }, { headers });
      openDetail(detail.vacancy.id);
      load();
    } catch { showToast('No se pudo actualizar'); }
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );
  if (locked) return (
    <AppLayout><div className="p-6 max-w-md mx-auto mt-16 text-center">
      <div className="bg-white rounded-xl border border-violet-200 p-8">
        <div className="text-4xl mb-3">🏢</div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">RRHH es un módulo Business</h2>
        <Link href="/pricing" className="inline-block bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium mt-3">Ver planes →</Link>
      </div>
    </div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/hr" className="text-slate-500 hover:text-slate-900">RRHH</Link>
          <span className="text-slate-300">/</span><span className="text-slate-900 font-medium">Vacantes</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Vacantes</h1>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700">
            {showForm ? 'Cancelar' : '+ Nueva vacante'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {([['title', 'Título del cargo *'], ['department', 'Área'], ['location', 'Ubicación'],
                ['employmentType', 'Tipo (tiempo completo…)'], ['salaryRange', 'Rango salarial']] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-slate-500 block mb-1">{label}</label>
                  <input type="text" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-500">Descripción y requisitos</label>
              <button onClick={aiDescription} className="text-xs text-violet-600 hover:underline">✦ Generar con IA</button>
            </div>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descripción del cargo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none mb-2" />
            <textarea rows={2} value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
              placeholder="Requisitos" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none mb-3" />
            <button onClick={create} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
              Crear vacante
            </button>
          </div>
        )}

        <div className="space-y-2">
          {vacancies.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 text-center py-12">
              <div className="text-3xl mb-2 opacity-30">📋</div>
              <p className="text-sm text-slate-500">Sin vacantes aún.</p>
            </div>
          ) : vacancies.map(v => (
            <button key={v.id} onClick={() => openDetail(v.id)}
              className="w-full bg-white rounded-xl border border-slate-200 p-4 hover:border-violet-300 flex items-center justify-between text-left">
              <div>
                <p className="text-sm font-semibold text-slate-900">{v.title}</p>
                <p className="text-xs text-slate-400">{v.department || 'Sin área'} · {v.candidateCount} candidato(s) · {v.hiredCount} contratado(s)</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${v.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {v.status === 'open' ? 'Abierta' : 'Cerrada'}
              </span>
            </button>
          ))}
        </div>

        {/* Detail modal */}
        {detail && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
            <div className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{detail.vacancy.title}</h3>
                  <p className="text-xs text-slate-400">{detail.vacancy.department || 'Sin área'} · {detail.vacancy.location || ''}</p>
                </div>
                <button onClick={toggleVacancy}
                  className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-200">
                  {detail.vacancy.status === 'open' ? 'Cerrar vacante' : 'Reabrir'}
                </button>
              </div>
              {detail.vacancy.description && <p className="text-xs text-slate-600 mt-2">{detail.vacancy.description}</p>}

              {/* Add candidate */}
              <div className="border-t border-slate-100 mt-4 pt-3">
                <p className="text-xs font-medium text-slate-600 mb-2">Agregar candidato</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input type="text" placeholder="Nombre" value={cand.firstName} onChange={e => setCand(c => ({ ...c, firstName: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                  <input type="text" placeholder="Apellido" value={cand.lastName} onChange={e => setCand(c => ({ ...c, lastName: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                  <input type="text" placeholder="Email" value={cand.email} onChange={e => setCand(c => ({ ...c, email: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                  <input type="text" placeholder="Teléfono" value={cand.phone} onChange={e => setCand(c => ({ ...c, phone: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <button onClick={addCandidate} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700">Agregar candidato</button>
              </div>

              {/* Candidates */}
              <div className="border-t border-slate-100 mt-4 pt-3">
                <p className="text-xs font-medium text-slate-600 mb-2">Candidatos ({detail.candidates.length})</p>
                {detail.candidates.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin candidatos aún.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.candidates.map((c: any) => (
                      <div key={c.id} className="bg-slate-50 rounded-lg p-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">{c.firstName} {c.lastName}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_CLS[c.stage]}`}>
                            {STAGES.find(s => s.v === c.stage)?.l}
                          </span>
                        </div>
                        {(c.email || c.phone) && <p className="text-xs text-slate-400">{c.email} {c.phone}</p>}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {STAGES.map(s => (
                            <button key={s.v} onClick={() => moveCandidate(c.id, s.v)} disabled={c.stage === s.v}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${c.stage === s.v ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                              {s.l}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setDetail(null)} className="mt-4 w-full border border-slate-200 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
