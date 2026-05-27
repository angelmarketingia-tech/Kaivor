'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Branding {
  logoData: string | null;
  logoFileName: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
  primaryColor: string;
  invoiceTemplate: string;
  logoPosition: string;
  logoSize: string;
  showLogoOnInvoice: boolean;
  showLogoOnReceipt: boolean;
  showLogoOnPdf: boolean;
  footerMessage: string;
  legalNote: string | null;
}

const DEFAULT: Branding = {
  logoData: null, logoFileName: null, logoWidth: null, logoHeight: null,
  primaryColor: '#7c3aed', invoiceTemplate: 'moderno',
  logoPosition: 'left', logoSize: 'medium',
  showLogoOnInvoice: true, showLogoOnReceipt: true, showLogoOnPdf: true,
  footerMessage: 'Gracias por su compra.', legalNote: null,
};

const TEMPLATES = [
  { id: 'clasico', label: 'Clásico', desc: 'Líneas sobrias, tipografía serif' },
  { id: 'moderno', label: 'Moderno', desc: 'Limpio, con acentos de color' },
  { id: 'minimalista', label: 'Minimalista', desc: 'Mínimo, mucho espacio en blanco' },
  { id: 'premium', label: 'Premium', desc: 'Elegante, con cabecera destacada' },
];

const LOGO_SIZE_PX: Record<string, number> = { small: 40, medium: 64, large: 96 };

function extractDominantColor(img: HTMLImageElement): string {
  try {
    const canvas = document.createElement('canvas');
    const size = 40;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#7c3aed';
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 200) continue;
      const br = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (br > 240 || br < 15) continue; // skip near-white / near-black
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
    }
    if (count === 0) return '#7c3aed';
    const toHex = (n: number) => Math.round(n / count).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch { return '#7c3aed'; }
}

export default function BillingTemplatesPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<Branding>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [aiRec, setAiRec] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<Partial<Branding> | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    axios.get(`${API}/settings/branding`, { headers })
      .then(r => setBranding({ ...DEFAULT, ...r.data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('No pudimos subir el logo. Verifica que sea PNG.', 'err');
      return;
    }
    if (file.size > 1_000_000) {
      showToast('No pudimos subir el logo. El archivo no debe superar 1MB.', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = async () => {
        setUploading(true);
        try {
          const res = await axios.post(`${API}/settings/branding/logo`, {
            logoData: dataUrl, fileName: file.name, width: img.naturalWidth, height: img.naturalHeight,
          }, { headers });
          setBranding(b => ({ ...b, ...res.data }));
          showToast('Logo actualizado correctamente.', 'ok');
        } catch (err: any) {
          showToast(err.response?.data?.message || 'No pudimos subir el logo. Verifica que sea PNG y que el archivo no sea demasiado pesado.', 'err');
        } finally { setUploading(false); }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = async () => {
    try {
      const res = await axios.delete(`${API}/settings/branding/logo`, { headers });
      setBranding(b => ({ ...b, ...res.data }));
      setAiRec(null); setAiSuggestion(null);
      showToast('Logo eliminado.', 'ok');
    } catch { showToast('No pudimos eliminar el logo.', 'err'); }
  };

  const optimizeWithAI = async () => {
    if (!branding.logoData) { showToast('Sube un logo primero.', 'err'); return; }
    let dominantColor = branding.primaryColor;
    await new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => { dominantColor = extractDominantColor(img); resolve(); };
      img.onerror = () => resolve();
      img.src = branding.logoData!;
    });
    try {
      const res = await axios.post(`${API}/settings/branding/ai-optimize`, {
        width: branding.logoWidth, height: branding.logoHeight, dominantColor,
      }, { headers });
      setAiRec(res.data.recommendation);
      setAiSuggestion({
        logoPosition: res.data.logoPosition,
        logoSize: res.data.logoSize,
        invoiceTemplate: res.data.invoiceTemplate,
        primaryColor: res.data.primaryColor,
      });
    } catch { showToast('No pudimos optimizar el diseño.', 'err'); }
  };

  const applySuggestion = () => {
    if (!aiSuggestion) return;
    setBranding(b => ({ ...b, ...aiSuggestion }));
    setAiRec(null); setAiSuggestion(null);
    showToast('Recomendación aplicada. Recuerda guardar.', 'ok');
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.patch(`${API}/settings/branding`, {
        primaryColor: branding.primaryColor,
        invoiceTemplate: branding.invoiceTemplate,
        logoPosition: branding.logoPosition,
        logoSize: branding.logoSize,
        showLogoOnInvoice: branding.showLogoOnInvoice,
        showLogoOnReceipt: branding.showLogoOnReceipt,
        showLogoOnPdf: branding.showLogoOnPdf,
        footerMessage: branding.footerMessage,
        legalNote: branding.legalNote,
      }, { headers });
      setBranding(b => ({ ...b, ...res.data }));
      showToast('Plantilla guardada correctamente.', 'ok');
    } catch { showToast('No pudimos guardar la plantilla.', 'err'); }
    finally { setSaving(false); }
  };

  const restoreDefaults = () => {
    setBranding(b => ({ ...DEFAULT, logoData: b.logoData, logoFileName: b.logoFileName, logoWidth: b.logoWidth, logoHeight: b.logoHeight }));
    setAiRec(null); setAiSuggestion(null);
    showToast('Valores restaurados. Recuerda guardar.', 'ok');
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  const logoPx = LOGO_SIZE_PX[branding.logoSize] ?? 64;
  const posClass = branding.logoPosition === 'center' ? 'justify-center' : branding.logoPosition === 'right' ? 'justify-end' : 'justify-start';

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="mb-5">
          <button onClick={() => router.push('/settings/billing')}
            className="text-sm text-slate-500 hover:text-slate-900 mb-2 inline-flex items-center gap-1">
            ← Facturación
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Diseño de factura</h1>
          <p className="text-sm text-slate-500 mt-0.5">Personaliza el logo, colores y estilo de tus facturas, PDF y tirillas.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: settings */}
          <div className="space-y-4">
            {/* Logo */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Logo de la empresa</h2>
              {branding.logoData ? (
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={branding.logoData} alt="logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{branding.logoFileName}</p>
                    {branding.logoWidth && <p className="text-xs text-slate-500">{branding.logoWidth} × {branding.logoHeight} px</p>}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => fileRef.current?.click()} disabled={uploading}
                        className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-50">
                        {uploading ? 'Subiendo…' : 'Reemplazar'}
                      </button>
                      <button onClick={removeLogo}
                        className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100">
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full border-2 border-dashed border-slate-200 rounded-lg py-8 text-center hover:border-violet-300 hover:bg-violet-50 transition-colors disabled:opacity-50">
                  <p className="text-2xl mb-1">{uploading ? '⏳' : '🖼'}</p>
                  <p className="text-sm font-medium text-slate-700">{uploading ? 'Subiendo logo…' : 'Subir logo PNG'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG o WebP · máx 1MB</p>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>

            {/* AI optimize */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-violet-900">✦ Optimizar diseño con IA</h2>
              </div>
              {!aiRec ? (
                <>
                  <p className="text-xs text-violet-700 mb-3">KAIROS AI analiza las proporciones de tu logo y sugiere tamaño, posición, color y plantilla.</p>
                  <button onClick={optimizeWithAI} disabled={!branding.logoData}
                    className="text-sm bg-violet-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-violet-700 disabled:opacity-40">
                    Optimizar diseño con IA
                  </button>
                  {!branding.logoData && <p className="text-xs text-violet-500 mt-2">Sube un logo para activar esta función.</p>}
                </>
              ) : (
                <>
                  <p className="text-sm text-violet-800 mb-3 leading-relaxed">{aiRec}</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={applySuggestion}
                      className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-violet-700">
                      Aplicar recomendación
                    </button>
                    <button onClick={() => { setAiRec(null); setAiSuggestion(null); }}
                      className="text-xs bg-white text-violet-700 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50">
                      Mantener mi diseño
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Template style */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Estilo visual</h2>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setBranding(b => ({ ...b, invoiceTemplate: t.id }))}
                    className={`text-left p-3 rounded-lg border transition-colors ${branding.invoiceTemplate === t.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <p className="text-sm font-medium text-slate-900">{t.label}</p>
                    <p className="text-xs text-slate-500">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Logo placement */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Posición y tamaño del logo</h2>
              <div className="mb-3">
                <label className="text-xs text-slate-500 block mb-1.5">Posición</label>
                <div className="flex gap-2">
                  {(['left', 'center', 'right'] as const).map(p => (
                    <button key={p} onClick={() => setBranding(b => ({ ...b, logoPosition: p }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg border ${branding.logoPosition === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {p === 'left' ? 'Izquierda' : p === 'center' ? 'Centro' : 'Derecha'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-slate-500 block mb-1.5">Tamaño</label>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as const).map(s => (
                    <button key={s} onClick={() => setBranding(b => ({ ...b, logoSize: s }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg border ${branding.logoSize === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {s === 'small' ? 'Pequeño' : s === 'medium' ? 'Mediano' : 'Grande'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 block">Mostrar logo en</label>
                {([['showLogoOnInvoice', 'Factura completa'], ['showLogoOnPdf', 'PDF'], ['showLogoOnReceipt', 'Tirilla']] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={branding[key] as boolean}
                      onChange={e => setBranding(b => ({ ...b, [key]: e.target.checked }))}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Color + messages */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Color y textos</h2>
              <div className="mb-3">
                <label className="text-xs text-slate-500 block mb-1.5">Color principal</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={branding.primaryColor}
                    onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))}
                    className="w-12 h-9 rounded border border-slate-200 cursor-pointer" />
                  <input type="text" value={branding.primaryColor}
                    onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono" />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-slate-500 block mb-1.5">Mensaje final</label>
                <input type="text" value={branding.footerMessage}
                  onChange={e => setBranding(b => ({ ...b, footerMessage: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Nota legal (opcional)</label>
                <textarea rows={2} value={branding.legalNote || ''}
                  onChange={e => setBranding(b => ({ ...b, legalNote: e.target.value }))}
                  placeholder="Ej: Régimen común. Resolución DIAN N°..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar plantilla'}
              </button>
              <button onClick={restoreDefaults}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">
                Restaurar
              </button>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="lg:sticky lg:top-6 self-start">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Vista previa en tiempo real</p>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Premium template has colored header bar */}
              {branding.invoiceTemplate === 'premium' && (
                <div className="h-2" style={{ backgroundColor: branding.primaryColor }} />
              )}
              <div className="p-6">
                {/* Header */}
                <div className={`flex items-start gap-4 mb-5 ${posClass} ${branding.logoPosition === 'center' ? 'flex-col items-center text-center' : ''}`}>
                  {branding.showLogoOnInvoice && branding.logoData && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={branding.logoData} alt="logo" style={{ height: logoPx }} className="object-contain" />
                  )}
                  <div className={branding.logoPosition === 'center' ? '' : branding.logoPosition === 'right' ? 'mr-auto order-first' : ''}>
                    <p className="font-bold text-slate-900"
                      style={{ fontFamily: branding.invoiceTemplate === 'clasico' ? 'Georgia, serif' : undefined }}>
                      Tu Empresa S.A.S.
                    </p>
                    <p className="text-xs text-slate-500">NIT: 900.123.456-7</p>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Factura</p>
                    <p className="font-bold" style={{ color: branding.primaryColor }}>FAC-2026-000123</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: branding.primaryColor }}>
                    Pagada
                  </span>
                </div>

                <div className={`rounded-lg p-3 mb-4 ${branding.invoiceTemplate === 'minimalista' ? '' : 'bg-slate-50'}`}>
                  <p className="text-xs text-slate-400 uppercase mb-0.5">Cliente</p>
                  <p className="text-sm font-medium text-slate-900">Cliente de ejemplo</p>
                </div>

                <table className="w-full text-sm mb-3">
                  <thead>
                    <tr className="border-b" style={{ borderColor: branding.invoiceTemplate === 'minimalista' ? '#e2e8f0' : branding.primaryColor + '40' }}>
                      <th className="text-left py-1.5 text-xs text-slate-500 font-medium">Descripción</th>
                      <th className="text-right py-1.5 text-xs text-slate-500 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-700">Producto de ejemplo</td><td className="py-1.5 text-right text-slate-700">$100.000</td></tr>
                    <tr><td className="py-1.5 text-slate-700">Servicio mensual</td><td className="py-1.5 text-right text-slate-700">$50.000</td></tr>
                  </tbody>
                </table>

                <div className="flex justify-end mb-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">TOTAL</p>
                    <p className="text-xl font-bold" style={{ color: branding.primaryColor }}>$150.000</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 text-center">
                  <p className="text-xs text-slate-500">{branding.footerMessage}</p>
                  {branding.legalNote && <p className="text-[10px] text-slate-400 mt-1">{branding.legalNote}</p>}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Así se verá la cabecera de tus facturas. El PDF y la tirilla usan la misma configuración.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
