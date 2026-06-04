'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import * as XLSX from 'xlsx';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmtDate = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' } as any);

interface Field { field: string; label: string; required: boolean }
interface Job { id: string; entityType: string; fileName: string | null; totalRows: number; importedRows: number; errorRows: number; status: string; createdAt: string }

type Step = 'pick' | 'map' | 'done';

export default function ImportsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [entityType, setEntityType] = useState<'customers' | 'products'>('customers');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [aiMsg, setAiMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers_ = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    axios.get(`${API}/imports`, { headers: headers_ }).then(r => setJobs(r.data)).catch(() => {});
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (json.length === 0) { showToast('El archivo está vacío.'); return; }
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRows(json);
      setFileName(file.name);
      // Ask backend for AI mapping
      const res = await axios.post(`${API}/imports/preview`, { entityType, headers: hdrs }, { headers: headers_ });
      setMapping(res.data.mapping);
      setFields(res.data.fields);
      setAiMsg(res.data.message);
      setStep('map');
    } catch {
      showToast('No pudimos leer el archivo. Verifica que sea .xlsx o .csv válido.');
    }
  };

  const confirm = async () => {
    const missingReq = fields.filter(f => f.required && !mapping[f.field]);
    if (missingReq.length) { showToast(`Asigna las columnas requeridas: ${missingReq.map(f => f.label).join(', ')}`); return; }
    setImporting(true);
    try {
      const res = await axios.post(`${API}/imports/confirm`, { entityType, mapping, rows, fileName }, { headers: headers_ });
      setResult(res.data);
      setStep('done');
      const jr = await axios.get(`${API}/imports`, { headers: headers_ });
      setJobs(jr.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'No pudimos completar la importación.');
    } finally { setImporting(false); }
  };

  const reset = () => {
    setStep('pick'); setHeaders([]); setRows([]); setMapping({}); setResult(null); setFileName('');
  };

  const downloadTemplate = () => {
    const cols = entityType === 'customers'
      ? ['Nombre', 'Email', 'Telefono', 'NIT', 'Direccion', 'Ciudad']
      : ['Nombre', 'SKU', 'Precio', 'Costo', 'Categoria', 'Codigo Barras'];
    const ws = XLSX.utils.aoa_to_sheet([cols]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, `plantilla-${entityType}.xlsx`);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg bg-ink-900 text-white">{toast}</div>}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-default">Importar desde Excel</h1>
          <p className="text-sm text-soft mt-0.5">Migra tus clientes y productos desde archivos Excel o CSV.</p>
        </div>

        {/* Step: pick */}
        {step === 'pick' && (
          <div className="surface rounded-xl border p-5 mb-5">
            <h2 className="text-sm font-semibold text-default mb-3">¿Qué quieres importar?</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {([['customers', 'Clientes', '◉'], ['products', 'Productos', '▤']] as const).map(([id, label, icon]) => (
                <button key={id} onClick={() => setEntityType(id)}
                  className={`p-4 rounded-lg border text-left transition-colors ${entityType === id ? 'border-brand' : 'border-default hover:border-brand-300'}`}
                  style={entityType === id ? { backgroundColor: 'rgba(163,204,57,0.10)' } : undefined}>
                  <span className="text-xl">{icon}</span>
                  <p className="text-sm font-medium text-default mt-1">{label}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={downloadTemplate}
                className="text-xs surface-2 text-default px-3 py-1.5 rounded-lg hover:bg-surface-2">
                ↓ Descargar plantilla {entityType === 'customers' ? 'clientes' : 'productos'}
              </button>
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-default rounded-lg py-10 text-center hover:border-brand hover:bg-brand-50 transition-colors">
              <p className="text-3xl mb-1">📊</p>
              <p className="text-sm font-medium text-default">Subir archivo Excel o CSV</p>
              <p className="text-xs text-soft mt-0.5">.xlsx, .xls o .csv</p>
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </div>
        )}

        {/* Step: map */}
        {step === 'map' && (
          <div className="surface rounded-xl border p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-default">Mapeo de columnas — {fileName}</h2>
              <button onClick={reset} className="text-xs text-soft hover:text-default">Cambiar archivo</button>
            </div>
            <div className="rounded-lg px-3 py-2 mb-4" style={{ backgroundColor: 'rgba(163,204,57,0.10)', border: '1px solid rgba(163,204,57,0.22)' }}>
              <p className="text-xs text-brand">✦ {aiMsg}</p>
            </div>
            <p className="text-xs text-soft mb-2">{rows.length} fila(s) detectada(s). Asigna cada campo de KAIROS a una columna de tu archivo.</p>
            <div className="space-y-2 mb-4">
              {fields.map(f => (
                <div key={f.field} className="flex items-center gap-3">
                  <span className="text-sm text-default w-40 flex-shrink-0">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </span>
                  <select value={mapping[f.field] || ''}
                    onChange={e => setMapping(m => ({ ...m, [f.field]: e.target.value }))}
                    className="flex-1 surface border rounded-lg px-3 py-1.5 text-sm text-default">
                    <option value="">— Sin asignar —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <p className="text-xs text-soft mb-1">Vista previa (primeras 3 filas):</p>
            <div className="overflow-x-auto mb-4 border border-default rounded-lg">
              <table className="w-full text-xs">
                <thead className="surface-2">
                  <tr>{fields.filter(f => mapping[f.field]).map(f => <th key={f.field} className="px-2 py-1.5 text-left text-soft">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((r, i) => (
                    <tr key={i} className="border-t border-default">
                      {fields.filter(f => mapping[f.field]).map(f => (
                        <td key={f.field} className="px-2 py-1.5 text-default">{String(r[mapping[f.field]] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={confirm} disabled={importing}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {importing ? 'Importando…' : `Importar ${rows.length} ${entityType === 'customers' ? 'cliente(s)' : 'producto(s)'}`}
            </button>
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && result && (
          <div className="surface rounded-xl border p-5 mb-5">
            <div className="text-center mb-4">
              <p className="text-3xl mb-1">{result.errors.length === result.total ? '⚠️' : '✓'}</p>
              <h2 className="text-lg font-bold text-default">Importación completada</h2>
              <p className="text-sm text-soft">
                {result.imported} de {result.total} fila(s) importada(s) correctamente.
              </p>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-amber-800 mb-1">{result.errors.length} fila(s) con error:</p>
                <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                  {result.errors.map((e: any, i: number) => (
                    <li key={i} className="text-xs text-amber-700">Fila {e.row}: {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 bg-brand text-ink-900 py-2 rounded-lg text-sm font-semibold hover:bg-brand-300">
                Importar otro archivo
              </button>
              <Link href={`/${entityType}`} className="flex-1 text-center border border-default text-default py-2 rounded-lg text-sm font-medium hover:bg-surface-2">
                Ver {entityType === 'customers' ? 'clientes' : 'productos'}
              </Link>
            </div>
          </div>
        )}

        {/* History */}
        {jobs.length > 0 && (
          <div className="surface rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b border-default">
              <h2 className="text-sm font-semibold text-default">Historial de importaciones</h2>
            </div>
            <div className="divide-y divide-[color:var(--border)]">
              {jobs.map(j => (
                <div key={j.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-default">
                      {j.entityType === 'customers' ? 'Clientes' : 'Productos'}
                      {j.fileName && <span className="text-soft font-normal"> · {j.fileName}</span>}
                    </p>
                    <p className="text-xs text-soft">{fmtDate(j.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">{j.importedRows} importados</p>
                    {j.errorRows > 0 && <p className="text-xs text-amber-600">{j.errorRows} con error</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
