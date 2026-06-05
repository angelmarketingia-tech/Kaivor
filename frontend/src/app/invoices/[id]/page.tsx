'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { downloadInvoicePdf, shareInvoicePdf, type PdfInvoice } from '@/lib/invoicePdf';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

interface InvoiceItem { id: string; description: string; quantity: number; unitPrice: number; discountValue: number; discountType: string; taxRate: number; taxAmount: number; subtotal: number; total: number }
interface Payment { id: string; amount: number; method: string; paidAt: string }
interface DeliveryLog { id: string; channel: string; destination: string; sentAt: string }
interface PrintLog { id: string; type: string; paperSize: string; createdAt: string }
interface Invoice {
  id: string; invoiceNumber: string; invoiceDate: string; status: string; paymentStatus: string;
  paymentMethod: string; cashReceived?: number; changeGiven?: number;
  subtotal: number; taxAmount: number; discountAmount: number; total: number; notes?: string;
  tipAmount?: number; serviceCharge?: number; tableNumber?: string; professional?: string;
  dianStatus?: string; dianCude?: string;
  customer: { id: string; name: string; email?: string; phone?: string; taxId?: string };
  company: { name: string; taxId: string; address?: string; phone?: string };
  user?: { name: string };
  items: InvoiceItem[];
  payments: Payment[];
  deliveryLogs: DeliveryLog[];
  printLogs: PrintLog[];
}

interface Branding {
  logoData: string | null;
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

const DEFAULT_BRANDING: Branding = {
  logoData: null, primaryColor: '#7c3aed', invoiceTemplate: 'moderno',
  logoPosition: 'left', logoSize: 'medium',
  showLogoOnInvoice: true, showLogoOnReceipt: true, showLogoOnPdf: true,
  footerMessage: 'Gracias por su compra.', legalNote: null,
};

const PAYMENT_LABELS: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', bank_transfer: 'Transferencia', wallet: 'Wallet' };
const STATUS_CLS: Record<string, string> = { sent: 'bg-blue-100 text-blue-700', accepted: 'bg-emerald-100 text-emerald-700', draft: 'bg-slate-100 text-slate-600', rejected: 'bg-red-100 text-red-700', cancelled: 'bg-slate-100 text-slate-400', pending_validation: 'bg-amber-100 text-amber-700' };
const STATUS_LABELS: Record<string, string> = { sent: 'Emitida', pending_validation: 'Pendiente validación' };
const PAY_CLS: Record<string, string> = { paid: 'bg-emerald-100 text-emerald-700', unpaid: 'bg-amber-100 text-amber-700', partial: 'bg-blue-100 text-blue-700' };
const PAY_LABELS: Record<string, string> = { paid: 'Pagada', unpaid: 'Sin pagar', partial: 'Pago parcial' };
const LOGO_PX: Record<string, number> = { small: 40, medium: 64, large: 96 };

type Tab = 'factura' | 'tirilla' | 'pagos' | 'actividad';

function generateReceiptHTML(inv: Invoice, paperSize: string, b: Branding): string {
  const width = paperSize === '58mm' ? '58mm' : '80mm';
  const logoMaxW = paperSize === '58mm' ? 120 : 170;
  const showLogo = b.showLogoOnReceipt && b.logoData;
  const items = inv.items.map(i => `
    <tr>
      <td style="padding:1px 0;font-size:9px;max-width:${paperSize === '58mm' ? '90px' : '130px'};word-break:break-word">${i.description}</td>
      <td style="padding:1px 2px;text-align:center;font-size:9px">${i.quantity}</td>
      <td style="padding:1px 0;text-align:right;font-size:9px">${fmt(i.unitPrice)}</td>
      <td style="padding:1px 0;text-align:right;font-size:9px;font-weight:bold">${fmt(i.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;width:${width};font-size:9px;color:#000;padding:4px}
    .center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px dashed #000;margin:4px 0}
    table{width:100%;border-collapse:collapse}.right{text-align:right}
    @media print{body{width:${width}}}
  </style></head><body>
    ${showLogo ? `<div class="center" style="margin-bottom:4px"><img src="${b.logoData}" style="max-width:${logoMaxW}px;max-height:50px;object-fit:contain"/></div>` : ''}
    <div class="center bold" style="font-size:11px;margin-bottom:2px">${inv.company.name}</div>
    <div class="center" style="font-size:8px">NIT: ${inv.company.taxId}</div>
    ${inv.company.address ? `<div class="center" style="font-size:8px">${inv.company.address}</div>` : ''}
    ${inv.company.phone ? `<div class="center" style="font-size:8px">Tel: ${inv.company.phone}</div>` : ''}
    <div class="divider"></div>
    <div class="bold">FACTURA ${inv.invoiceNumber}</div>
    <div style="font-size:8px">${fmtDate(inv.invoiceDate)}</div>
    ${inv.user ? `<div style="font-size:8px">Cajero: ${inv.user.name}</div>` : ''}
    ${inv.tableNumber ? `<div style="font-size:8px">Mesa: ${inv.tableNumber}</div>` : ''}
    ${inv.professional ? `<div style="font-size:8px">Atendió: ${inv.professional}</div>` : ''}
    <div class="divider"></div>
    <div style="font-size:8px">Cliente: ${inv.customer.name}</div>
    ${inv.customer.taxId ? `<div style="font-size:8px">Doc: ${inv.customer.taxId}</div>` : ''}
    <div class="divider"></div>
    <table>
      <thead><tr>
        <th style="text-align:left;font-size:8px">Ítem</th>
        <th style="text-align:center;font-size:8px">Cant</th>
        <th style="text-align:right;font-size:8px">P/U</th>
        <th style="text-align:right;font-size:8px">Total</th>
      </tr></thead>
      <tbody>${items}</tbody>
    </table>
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
    ${inv.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Descuento</span><span>-${fmt(inv.discountAmount)}</span></div>` : ''}
    ${inv.taxAmount > 0 ? `<div style="display:flex;justify-content:space-between"><span>IVA</span><span>${fmt(inv.taxAmount)}</span></div>` : ''}
    ${(inv.serviceCharge ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between"><span>Servicio</span><span>${fmt(inv.serviceCharge!)}</span></div>` : ''}
    ${(inv.tipAmount ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between"><span>Propina</span><span>${fmt(inv.tipAmount!)}</span></div>` : ''}
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between" class="bold"><span style="font-size:11px">TOTAL</span><span style="font-size:11px">${fmt(inv.total)}</span></div>
    <div class="divider"></div>
    <div>Forma de pago: ${PAYMENT_LABELS[inv.paymentMethod] ?? inv.paymentMethod}</div>
    ${inv.cashReceived != null ? `<div style="display:flex;justify-content:space-between"><span>Recibido</span><span>${fmt(inv.cashReceived)}</span></div>` : ''}
    ${(inv.changeGiven ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between" class="bold"><span>Cambio</span><span>${fmt(inv.changeGiven!)}</span></div>` : ''}
    ${inv.dianStatus ? `<div class="divider"></div><div style="font-size:8px">DIAN: ${inv.dianStatus.toUpperCase()}</div>${inv.dianCude ? `<div style="font-size:7px;word-break:break-all">CUFE: ${inv.dianCude}</div>` : ''}` : ''}
    <div class="divider"></div>
    <div class="center" style="font-size:8px;margin-top:2px">${b.footerMessage || 'Gracias por su compra.'}</div>
    ${b.legalNote ? `<div class="center" style="font-size:7px;color:#666;margin-top:1px">${b.legalNote}</div>` : ''}
    <div class="center" style="font-size:7px;color:#666;margin-top:1px">Generado por Kaivor</div>
  </body></html>`;
}

function generateInvoicePDF(inv: Invoice, b: Branding): string {
  const showLogo = b.showLogoOnPdf && b.logoData;
  const color = b.primaryColor || '#7c3aed';
  const logoH = (LOGO_PX[b.logoSize] ?? 64) + 8;
  const items = inv.items.map((i, idx) => `
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:8px 12px;font-size:12px;color:#1e293b">${idx + 1}. ${i.description}</td>
      <td style="padding:8px 12px;text-align:center;font-size:12px">${i.quantity}</td>
      <td style="padding:8px 12px;text-align:right;font-size:12px">${fmt(i.unitPrice)}</td>
      <td style="padding:8px 12px;text-align:center;font-size:12px">${i.taxRate}%</td>
      <td style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600">${fmt(i.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.invoiceNumber}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;max-width:800px;margin:0 auto}
    h1{font-size:28px;font-weight:900;color:#0f172a}
    table{width:100%;border-collapse:collapse}
    @media print{body{padding:20px}button{display:none!important}}
  </style></head><body>
    ${b.invoiceTemplate === 'premium' ? `<div style="height:6px;background:${color};margin:-40px -40px 24px"></div>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
      <div>
        ${showLogo ? `<img src="${b.logoData}" style="height:${logoH}px;max-width:240px;object-fit:contain;margin-bottom:8px"/><br>` : ''}
        <h1 style="font-size:22px;color:#0f172a;margin-bottom:4px">${inv.company.name}</h1>
        <p style="font-size:12px;color:#64748b">NIT: ${inv.company.taxId}</p>
        ${inv.company.address ? `<p style="font-size:12px;color:#64748b">${inv.company.address}</p>` : ''}
        ${inv.company.phone ? `<p style="font-size:12px;color:#64748b">Tel: ${inv.company.phone}</p>` : ''}
      </div>
      <div style="text-align:right">
        <h2 style="font-size:22px;font-weight:900;color:${color}">FACTURA</h2>
        <p style="font-size:15px;font-weight:700">${inv.invoiceNumber}</p>
        <p style="font-size:11px;color:#64748b">Fecha: ${new Date(inv.invoiceDate).toLocaleDateString('es-CO')}</p>
        <span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${PAY_LABELS[inv.paymentStatus] ?? inv.paymentStatus}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
      <div style="background:#f8fafc;border-radius:8px;padding:16px">
        <p style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:8px">Facturado a</p>
        <p style="font-weight:700;font-size:14px">${inv.customer.name}</p>
        ${inv.customer.taxId ? `<p style="font-size:12px;color:#64748b">NIT/CC: ${inv.customer.taxId}</p>` : ''}
        ${inv.customer.email ? `<p style="font-size:12px;color:#64748b">${inv.customer.email}</p>` : ''}
        ${inv.customer.phone ? `<p style="font-size:12px;color:#64748b">${inv.customer.phone}</p>` : ''}
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:16px">
        <p style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:8px">Pago</p>
        <p style="font-size:12px"><strong>Método:</strong> ${PAYMENT_LABELS[inv.paymentMethod] ?? inv.paymentMethod}</p>
        ${inv.cashReceived != null ? `<p style="font-size:12px"><strong>Recibido:</strong> ${fmt(inv.cashReceived)}</p>` : ''}
        ${(inv.changeGiven ?? 0) > 0 ? `<p style="font-size:12px"><strong>Cambio:</strong> ${fmt(inv.changeGiven!)}</p>` : ''}
      </div>
    </div>
    <table style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#f8fafc">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase">Descripción</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase">Cant</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase">P. Unit</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase">IVA</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase">Total</th>
      </tr></thead>
      <tbody>${items}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end">
      <div style="min-width:220px;background:#f8fafc;border-radius:8px;padding:16px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:#64748b">Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
        ${inv.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#16a34a;margin-bottom:6px"><span>Descuento</span><span>-${fmt(inv.discountAmount)}</span></div>` : ''}
        ${inv.taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:#64748b">IVA</span><span>${fmt(inv.taxAmount)}</span></div>` : ''}
        ${(inv.serviceCharge ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:#64748b">Servicio</span><span>${fmt(inv.serviceCharge!)}</span></div>` : ''}
        ${(inv.tipAmount ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:#64748b">Propina</span><span>${fmt(inv.tipAmount!)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;border-top:2px solid #e2e8f0;padding-top:8px;margin-top:8px"><span>TOTAL</span><span style="color:${color}">${fmt(inv.total)}</span></div>
      </div>
    </div>
    ${inv.notes ? `<div style="margin-top:24px;padding:12px;background:#fffbeb;border-radius:8px;font-size:12px;color:#92400e"><strong>Notas:</strong> ${inv.notes}</div>` : ''}
    ${inv.dianStatus === 'accepted' ? `<div style="margin-top:16px;padding:12px;background:#f0fdf4;border-radius:8px;font-size:11px;color:#166534"><strong>Factura electrónica DIAN — Aceptada</strong>${inv.dianCude ? `<br><span style="font-size:10px">CUFE: ${inv.dianCude}</span>` : ''}</div>` : `<div style="margin-top:16px;padding:12px;background:#fffbeb;border-radius:8px;font-size:11px;color:#92400e"><strong>Comprobante interno</strong> — No es factura electrónica DIAN.</div>`}
    <div style="margin-top:24px;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px">
      <p style="font-size:13px;color:#475569;font-weight:600">${b.footerMessage || 'Gracias por su compra.'}</p>
      ${b.legalNote ? `<p style="font-size:10px;color:#94a3b8;margin-top:4px">${b.legalNote}</p>` : ''}
    </div>
  </body></html>`;
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: 'notfound' | 'fail'; msg: string } | null>(null);
  const [tab, setTab] = useState<Tab>('factura');
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('80mm');
  const [waLoading, setWaLoading] = useState(false);
  const [noPhone, setNoPhone] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    setError(null);
    try {
      const invRes = await axios.get(`${API}/invoices/${id}`, { headers });
      setInvoice(invRes.data);
      // Branding is best-effort — never block the invoice on it
      try {
        const brandRes = await axios.get(`${API}/settings/branding`, { headers });
        setBranding({ ...DEFAULT_BRANDING, ...brandRes.data });
      } catch { /* keep default branding */ }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) { router.push('/auth/login'); return; }
      if (status === 404) setError({ kind: 'notfound', msg: 'Esta factura no existe o fue eliminada.' });
      else setError({ kind: 'fail', msg: 'No pudimos cargar la factura. Revisa tu conexión e intenta de nuevo.' });
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const printReceipt = async () => {
    if (!invoice) return;
    const w = window.open('', '_blank', 'width=400,height=800,scrollbars=yes');
    if (!w) return;
    w.document.write(generateReceiptHTML(invoice, paperSize, branding));
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
    // Log print
    axios.post(`${API}/invoices/${id}/print-log`, { type: 'receipt', paperSize }, { headers }).catch(() => {});
  };

  const openInvoicePDF = (): boolean => {
    if (!invoice) return false;
    // No window features: mobile browsers ignore/abort sized popups. A plain
    // _blank tab is reliable on both desktop and mobile.
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(generateInvoicePDF(invoice, branding));
    w.document.close();
    // Give mobile webviews a moment to lay out before invoking print.
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* user can print manually */ } }, 400);
    return true;
  };

  const printInvoicePDF = () => {
    if (!invoice) return;
    if (!openInvoicePDF()) {
      alert('Permite las ventanas emergentes para ver el PDF de la factura.');
      return;
    }
    axios.post(`${API}/invoices/${id}/print-log`, { type: 'invoice', paperSize: 'A4' }, { headers }).catch(() => {});
  };

  // Mapea la factura cargada al shape que espera el generador de PDF binario.
  const toPdfInvoice = (): PdfInvoice | null => {
    if (!invoice) return null;
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      status: invoice.status,
      paymentMethod: invoice.paymentMethod,
      subtotal: invoice.subtotal, taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount, total: invoice.total,
      tipAmount: invoice.tipAmount, serviceCharge: invoice.serviceCharge, notes: invoice.notes,
      dianStatus: invoice.dianStatus, dianCude: invoice.dianCude,
      customer: invoice.customer, company: invoice.company,
      items: (invoice.items || []).map((it) => ({
        description: it.description, quantity: it.quantity, unitPrice: it.unitPrice,
        total: it.total, taxRate: it.taxRate,
      })),
    };
  };

  // Branding del negocio para personalizar el PDF (logo, color, mensaje, nota legal).
  const pdfBranding = () => ({
    logoData: branding.logoData,
    primaryColor: branding.primaryColor,
    footerMessage: branding.footerMessage,
    legalNote: branding.legalNote,
    showLogoOnPdf: branding.showLogoOnPdf,
  });

  // Descarga un PDF binario REAL (jsPDF) PERSONALIZADO con el branding del negocio.
  const downloadPdf = () => {
    const inv = toPdfInvoice();
    if (!inv) return;
    downloadInvoicePdf(inv, pdfBranding());
    axios.post(`${API}/invoices/${id}/print-log`, { type: 'pdf', paperSize: 'A4' }, { headers }).catch(() => {});
  };

  // Comparte el PDF personalizado como ARCHIVO por la hoja nativa (móvil); cae a descarga.
  const shareInvoice = async () => {
    const inv = toPdfInvoice();
    if (!inv) return;
    try {
      await shareInvoicePdf(inv, pdfBranding());
    } catch {
      alert('No se pudo compartir en este dispositivo.');
    }
  };

  const sendWhatsApp = async () => {
    setWaLoading(true);
    setNoPhone(false);
    try {
      const res = await axios.post(`${API}/invoices/${id}/send-whatsapp`, {}, { headers });
      window.open(res.data.waUrl, '_blank');
    } catch (err: any) {
      if (err.response?.status === 400) setNoPhone(true);
      else alert(err.response?.data?.message || 'Error al enviar');
    } finally { setWaLoading(false); }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-default border-t-brand rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (error) return (
    <AppLayout>
      <div className="p-6 max-w-md mx-auto mt-16 text-center">
        <div className="surface rounded-xl border p-8">
          <div className="text-4xl mb-3">{error.kind === 'notfound' ? '🔍' : '⚠️'}</div>
          <h2 className="text-lg font-bold text-default mb-1">
            {error.kind === 'notfound' ? 'Factura no encontrada' : 'No pudimos cargar la factura'}
          </h2>
          <p className="text-sm text-soft mb-5">{error.msg}</p>
          <div className="flex gap-2 justify-center">
            {error.kind === 'fail' && (
              <button onClick={load} className="bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-700">
                Reintentar
              </button>
            )}
            <Link href="/invoices" className="border border-default text-default px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
              Volver a facturas
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );

  if (!invoice) return null;

  const statusCls = STATUS_CLS[invoice.status] ?? 'bg-slate-100 text-slate-600';
  const payCls = PAY_CLS[invoice.paymentStatus] ?? 'bg-slate-100 text-slate-600';

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/invoices" className="text-soft hover:text-default">Facturas</Link>
          <span className="text-soft">/</span>
          <span className="text-default font-medium">{invoice.invoiceNumber}</span>
        </div>

        {/* Header */}
        <div className="surface rounded-xl border p-5 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-default">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-soft mt-0.5">{fmtDate(invoice.invoiceDate)}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>
                  {STATUS_LABELS[invoice.status] ?? invoice.status}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${payCls}`}>
                  {PAY_LABELS[invoice.paymentStatus] ?? invoice.paymentStatus}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium surface-2 text-soft">
                  {PAYMENT_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-default">{fmt(invoice.total)}</p>
              {invoice.cashReceived != null && (
                <p className="text-sm text-soft mt-0.5">Recibido: {fmt(invoice.cashReceived)}</p>
              )}
              {(invoice.changeGiven ?? 0) > 0 && (
                <p className="text-sm font-medium text-emerald-600">Cambio: {fmt(invoice.changeGiven!)}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2.5 mt-4 pt-4 border-t border-default">
            <button onClick={printReceipt}
              className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-ink-900 text-white text-sm rounded-lg hover:bg-ink-700 transition-colors">
              🖨 Tirilla
            </button>
            <button onClick={downloadPdf}
              className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] surface-2 text-default text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              📄 Descargar PDF
            </button>
            <button onClick={shareInvoice}
              className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] surface-2 text-default text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              📤 Compartir
            </button>
            <button onClick={printInvoicePDF}
              className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] surface-2 text-default text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              🖨 Imprimir
            </button>
            <button onClick={sendWhatsApp} disabled={waLoading}
              className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
              {waLoading ? '...' : '💬 WhatsApp'}
            </button>
            <button onClick={() => alert('Configura Gmail en Configuración > Integraciones para enviar por email.')}
              className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] surface-2 text-default text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              ✉ Email
            </button>
            <Link href="/invoices/create"
              className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-brand text-ink-900 text-sm rounded-lg hover:bg-brand-300 transition-colors">
              + Nueva factura
            </Link>
          </div>

          {/* No phone warning */}
          {noPhone && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
              <p className="text-amber-800 font-medium">El cliente no tiene número de WhatsApp.</p>
              <p className="text-amber-700 mt-0.5">
                <Link href="/customers" className="underline">Agrega un teléfono al cliente</Link> para enviar la factura.
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 surface-2 rounded-xl p-1 w-fit">
          {(['factura', 'tirilla', 'pagos', 'actividad'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${tab === t ? 'surface text-default shadow-sm' : 'text-soft hover:text-default'}`}>
              {t === 'factura' ? 'Factura' : t === 'tirilla' ? 'Tirilla' : t === 'pagos' ? 'Pagos' : 'Actividad'}
            </button>
          ))}
        </div>

        {/* Tab: Factura */}
        {tab === 'factura' && (
          <div className="space-y-4">
            {/* Customer + Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="surface rounded-xl border p-5">
                <p className="text-xs text-soft uppercase tracking-wide font-medium mb-2">Cliente</p>
                <p className="font-semibold text-default">{invoice.customer.name}</p>
                {invoice.customer.taxId && <p className="text-sm text-soft">NIT/CC: {invoice.customer.taxId}</p>}
                {invoice.customer.email && <p className="text-sm text-soft">{invoice.customer.email}</p>}
                {invoice.customer.phone && <p className="text-sm text-soft">{invoice.customer.phone}</p>}
                <Link href="/customers" className="text-xs text-brand hover:underline mt-1 block">Ver en CRM →</Link>
              </div>
              <div className="surface rounded-xl border p-5">
                <p className="text-xs text-soft uppercase tracking-wide font-medium mb-2">Empresa emisora</p>
                {branding.showLogoOnInvoice && branding.logoData && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={branding.logoData} alt="logo"
                    style={{ height: LOGO_PX[branding.logoSize] ?? 64 }}
                    className="object-contain mb-2" />
                )}
                <p className="font-semibold text-default">{invoice.company.name}</p>
                <p className="text-sm text-soft">NIT: {invoice.company.taxId}</p>
                {invoice.company.address && <p className="text-sm text-soft">{invoice.company.address}</p>}
                {invoice.company.phone && <p className="text-sm text-soft">{invoice.company.phone}</p>}
                {invoice.user && <p className="text-sm text-soft">Cajero: {invoice.user.name}</p>}
              </div>
            </div>

            {/* Items table */}
            <div className="surface rounded-xl border overflow-hidden">
              <table className="w-full">
                <thead className="surface-2 border-b border-default">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase">Descripción</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-soft uppercase hidden sm:table-cell">Cant</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-soft uppercase hidden sm:table-cell">P. Unit</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-soft uppercase hidden md:table-cell">IVA</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-soft uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {invoice.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-5 py-3.5 text-sm text-default break-words">
                        {item.description}
                        {item.discountValue > 0 && <span className="ml-2 text-xs text-emerald-600">-{item.discountType === 'percent' ? `${item.discountValue}%` : fmt(item.discountValue)}</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-center text-soft hidden sm:table-cell">{item.quantity}</td>
                      <td className="px-4 py-3.5 text-sm text-right text-soft hidden sm:table-cell">{fmt(item.unitPrice)}</td>
                      <td className="px-4 py-3.5 text-sm text-right text-soft hidden md:table-cell">{item.taxRate}%</td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-right text-default">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Totals */}
              <div className="border-t border-default px-5 py-4">
                <div className="flex justify-end">
                  <div className="w-52 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-soft">Subtotal</span><span>{fmt(invoice.subtotal)}</span></div>
                    {invoice.discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Descuento</span><span>-{fmt(invoice.discountAmount)}</span></div>}
                    {invoice.taxAmount > 0 && <div className="flex justify-between"><span className="text-soft">IVA</span><span>{fmt(invoice.taxAmount)}</span></div>}
                    {(invoice.serviceCharge ?? 0) > 0 && <div className="flex justify-between"><span className="text-soft">Servicio</span><span>{fmt(invoice.serviceCharge!)}</span></div>}
                    {(invoice.tipAmount ?? 0) > 0 && <div className="flex justify-between"><span className="text-soft">Propina</span><span>{fmt(invoice.tipAmount!)}</span></div>}
                    <div className="flex justify-between font-bold text-base border-t border-default pt-2"><span>TOTAL</span><span>{fmt(invoice.total)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes + DIAN */}
            {(invoice.notes || invoice.dianStatus) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {invoice.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-xs text-amber-700 font-medium uppercase mb-1">Notas</p>
                    <p className="text-sm text-amber-800">{invoice.notes}</p>
                  </div>
                )}
                {invoice.dianStatus === 'accepted' ? (
                  // Solo VERDE si la DIAN aceptó de verdad (proveedor real).
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <p className="text-xs text-emerald-700 font-medium uppercase mb-1">Factura electrónica DIAN</p>
                    <p className="text-sm font-semibold text-emerald-800">Aceptada por la DIAN</p>
                    {invoice.dianCude && <p className="text-xs text-emerald-600 mt-1 break-all">CUFE: {invoice.dianCude}</p>}
                  </div>
                ) : invoice.dianStatus ? (
                  // sandbox/pending/etc → ámbar, honesto: NO es factura legal aún.
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-xs text-amber-700 font-medium uppercase mb-1">Comprobante interno</p>
                    <p className="text-sm text-amber-800">No es factura electrónica DIAN. Estado: {invoice.dianStatus}.</p>
                  </div>
                ) : null}
              </div>
            )}
            {!invoice.dianStatus && (
              <div className="surface-2 border border-default rounded-xl p-4 text-sm text-soft">
                <strong className="text-default">Comprobante interno.</strong> No es factura electrónica DIAN — para emisión legal se requiere un proveedor tecnológico autorizado.
              </div>
            )}
          </div>
        )}

        {/* Tab: Tirilla */}
        {tab === 'tirilla' && (
          <div className="surface rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-default">Vista previa de tirilla</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-soft">Tamaño:</span>
                <button onClick={() => setPaperSize('58mm')}
                  className={`px-2 py-0.5 text-xs rounded font-medium ${paperSize === '58mm' ? 'bg-ink-900 text-white' : 'surface-2 text-soft'}`}>58mm</button>
                <button onClick={() => setPaperSize('80mm')}
                  className={`px-2 py-0.5 text-xs rounded font-medium ${paperSize === '80mm' ? 'bg-ink-900 text-white' : 'surface-2 text-soft'}`}>80mm</button>
              </div>
            </div>
            {/* Receipt preview */}
            <div className="flex justify-center mb-4">
              <div style={{ width: paperSize === '58mm' ? '220px' : '300px' }}
                className="border border-slate-200 rounded p-3 font-mono text-xs shadow-sm bg-white">
                {branding.showLogoOnReceipt && branding.logoData && (
                  <div className="flex justify-center mb-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={branding.logoData} alt="logo" style={{ maxHeight: '40px', maxWidth: '100%' }} className="object-contain" />
                  </div>
                )}
                <p className="text-center font-bold">{invoice.company.name}</p>
                <p className="text-center text-gray-500" style={{ fontSize: '9px' }}>NIT: {invoice.company.taxId}</p>
                {invoice.company.phone && <p className="text-center text-gray-500" style={{ fontSize: '9px' }}>{invoice.company.phone}</p>}
                <hr className="my-1 border-dashed" />
                <p className="font-bold">{invoice.invoiceNumber}</p>
                <p className="text-gray-600" style={{ fontSize: '9px' }}>{new Date(invoice.invoiceDate).toLocaleString('es-CO')}</p>
                {invoice.user && <p style={{ fontSize: '9px' }}>Cajero: {invoice.user.name}</p>}
                <hr className="my-1 border-dashed" />
                <p style={{ fontSize: '9px' }}>Cliente: {invoice.customer.name}</p>
                <hr className="my-1 border-dashed" />
                {invoice.items.map(item => (
                  <div key={item.id} className="flex justify-between" style={{ fontSize: '9px' }}>
                    <span className="truncate mr-1" style={{ maxWidth: paperSize === '58mm' ? '100px' : '150px' }}>{item.description}</span>
                    <span className="whitespace-nowrap">{item.quantity}x{fmt(item.unitPrice)}</span>
                    <span className="font-bold ml-1">{fmt(item.total)}</span>
                  </div>
                ))}
                <hr className="my-1 border-dashed" />
                <div className="flex justify-between" style={{ fontSize: '9px' }}><span>Subtotal</span><span>{fmt(invoice.subtotal)}</span></div>
                {invoice.discountAmount > 0 && <div className="flex justify-between" style={{ fontSize: '9px' }}><span>Descuento</span><span>-{fmt(invoice.discountAmount)}</span></div>}
                {invoice.taxAmount > 0 && <div className="flex justify-between" style={{ fontSize: '9px' }}><span>IVA</span><span>{fmt(invoice.taxAmount)}</span></div>}
                <div className="flex justify-between font-bold" style={{ fontSize: '11px' }}><span>TOTAL</span><span>{fmt(invoice.total)}</span></div>
                <hr className="my-1 border-dashed" />
                <p style={{ fontSize: '9px' }}>Pago: {PAYMENT_LABELS[invoice.paymentMethod]}</p>
                {invoice.cashReceived != null && <div className="flex justify-between" style={{ fontSize: '9px' }}><span>Recibido</span><span>{fmt(invoice.cashReceived)}</span></div>}
                {(invoice.changeGiven ?? 0) > 0 && <div className="flex justify-between font-bold" style={{ fontSize: '9px' }}><span>Cambio</span><span>{fmt(invoice.changeGiven!)}</span></div>}
                <hr className="my-1 border-dashed" />
                <p className="text-center" style={{ fontSize: '8px' }}>{branding.footerMessage || 'Gracias por su compra.'}</p>
                <p className="text-center text-gray-400" style={{ fontSize: '7px' }}>Generado por Kaivor</p>
              </div>
            </div>
            <button onClick={printReceipt}
              className="w-full bg-ink-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-ink-700 transition-colors">
              🖨 Imprimir tirilla {paperSize}
            </button>
          </div>
        )}

        {/* Tab: Pagos */}
        {tab === 'pagos' && (
          <div className="surface rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b border-default flex justify-between">
              <span className="text-sm font-semibold text-default">Registro de pagos</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payCls}`}>{PAY_LABELS[invoice.paymentStatus]}</span>
            </div>
            {invoice.payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-soft text-sm">Sin pagos registrados.</p>
            ) : (
              <div className="divide-y divide-default">
                {invoice.payments.map(p => (
                  <div key={p.id} className="px-5 py-3.5 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-default">{PAYMENT_LABELS[p.method] ?? p.method}</p>
                      <p className="text-xs text-soft">{fmtDate(p.paidAt)}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-700">{fmt(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Actividad */}
        {tab === 'actividad' && (
          <div className="space-y-3">
            {/* Delivery logs */}
            <div className="surface rounded-xl border overflow-hidden">
              <div className="px-5 py-3 border-b border-default">
                <span className="text-sm font-semibold text-default">Envíos</span>
              </div>
              {invoice.deliveryLogs.length === 0 ? (
                <p className="px-5 py-6 text-center text-soft text-sm">No se ha enviado la factura aún.</p>
              ) : (
                <div className="divide-y divide-default">
                  {invoice.deliveryLogs.map(log => (
                    <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-lg">{log.channel === 'whatsapp' ? '💬' : '✉'}</span>
                      <div className="flex-1">
                        <p className="text-sm text-default capitalize">{log.channel}</p>
                        <p className="text-xs text-soft">{log.destination}</p>
                      </div>
                      <p className="text-xs text-soft">{fmtDate(log.sentAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Print logs */}
            <div className="surface rounded-xl border overflow-hidden">
              <div className="px-5 py-3 border-b border-default">
                <span className="text-sm font-semibold text-default">Impresiones</span>
              </div>
              {invoice.printLogs.length === 0 ? (
                <p className="px-5 py-6 text-center text-soft text-sm">Aún no se ha impreso.</p>
              ) : (
                <div className="divide-y divide-default">
                  {invoice.printLogs.map(log => (
                    <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-lg">🖨</span>
                      <div className="flex-1">
                        <p className="text-sm text-default">{log.type === 'receipt' ? 'Tirilla' : 'Factura'} — {log.paperSize}</p>
                      </div>
                      <p className="text-xs text-soft">{fmtDate(log.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
