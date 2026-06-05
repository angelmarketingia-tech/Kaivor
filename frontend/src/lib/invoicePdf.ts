// Generador de PDF binario real (jsPDF) para facturas/comprobantes Kaivor.
// Produce un Blob descargable y compartible por la Web Share API (a diferencia
// del antiguo window.print, esto genera un archivo .pdf de verdad).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const DEFAULT_ACCENT = '#A3CC39';
const INK = '#0B1220';

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO');

// hex válido (#RGB o #RRGGBB) para no romper jsPDF con un color inválido del branding.
function safeHex(c: unknown, fallback: string): string {
  return typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : fallback;
}

export interface PdfBranding {
  logoData?: string | null;   // dataURL/base64 del logo del negocio
  primaryColor?: string | null;
  footerMessage?: string | null;
  legalNote?: string | null;
  showLogoOnPdf?: boolean;
}

export interface PdfInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  status?: string;
  paymentMethod?: string;
  subtotal: number; taxAmount: number; discountAmount: number; total: number;
  tipAmount?: number; serviceCharge?: number; notes?: string;
  dianStatus?: string; dianCude?: string;
  customer?: { name?: string; taxId?: string; phone?: string; email?: string };
  company?: { name?: string; taxId?: string; address?: string; phone?: string };
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number; taxRate?: number }>;
}

/** Construye el documento jsPDF PERSONALIZADO con el branding del negocio. */
export function buildInvoiceDoc(inv: PdfInvoice, branding?: PdfBranding): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 48;
  const ACCENT = safeHex(branding?.primaryColor, DEFAULT_ACCENT);
  const showLogo = branding?.showLogoOnPdf !== false && !!branding?.logoData;

  // Barra superior con el color de marca del negocio.
  doc.setFillColor(ACCENT);
  doc.rect(0, 0, W, 8, 'F');

  // Logo del negocio (si tiene), arriba a la izquierda. Empuja el texto hacia la derecha.
  let textX = M;
  if (showLogo) {
    try {
      const fmt = String(branding!.logoData).includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(branding!.logoData as string, fmt, M, 28, 48, 48, undefined, 'FAST');
      textX = M + 60;
    } catch { /* si el logo no es una imagen válida, seguimos sin él */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(INK);
  doc.text((inv.company?.name || 'Kaivor').toString(), textX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#5B6678');
  y += 16;
  if (inv.company?.taxId) { doc.text(`NIT: ${inv.company.taxId}`, textX, y); y += 12; }
  if (inv.company?.address) { doc.text(String(inv.company.address), textX, y); y += 12; }
  if (inv.company?.phone) { doc.text(`Tel: ${inv.company.phone}`, textX, y); y += 12; }
  if (showLogo) y = Math.max(y, 84); // dejar espacio bajo el logo

  // Bloque número/fecha a la derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text(`Comprobante ${inv.invoiceNumber}`, W - M, 48, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#5B6678');
  doc.text(new Date(inv.invoiceDate).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }), W - M, 64, { align: 'right' });

  // Aviso legal: NO es factura electrónica DIAN salvo que el proveedor la haya aceptado.
  const dianAccepted = inv.dianStatus === 'accepted';
  doc.setFontSize(8);
  doc.setTextColor(dianAccepted ? '#16A34A' : '#D97706');
  doc.text(
    dianAccepted ? `Factura electrónica DIAN · CUFE: ${inv.dianCude || ''}` : 'Comprobante interno — no es factura electrónica DIAN',
    W - M, 76, { align: 'right' },
  );

  y = Math.max(y, 96);

  // Cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(INK);
  doc.text('Cliente', M, y); y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#1A2438');
  doc.text(inv.customer?.name || 'Consumidor final', M, y); y += 12;
  if (inv.customer?.taxId) { doc.text(`Doc: ${inv.customer.taxId}`, M, y); y += 12; }
  if (inv.customer?.phone) { doc.text(`Tel: ${inv.customer.phone}`, M, y); y += 12; }
  y += 6;

  // Tabla de ítems
  autoTable(doc, {
    startY: y,
    head: [['Descripción', 'Cant.', 'Precio', 'Total']],
    body: inv.items.map((it) => [
      it.description || '',
      String(it.quantity),
      money(it.unitPrice),
      money(it.total),
    ]),
    styles: { fontSize: 9, cellPadding: 6, textColor: '#1A2438' },
    headStyles: { fillColor: INK, textColor: '#FFFFFF', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#F5F7FA' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: M, right: M },
  });

  // Totales
  let ty = (doc as any).lastAutoTable.finalY + 16;
  const right = W - M;
  const line = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 12 : 9);
    doc.setTextColor(bold ? INK : '#5B6678');
    doc.text(label, right - 160, ty);
    doc.setTextColor(INK);
    doc.text(value, right, ty, { align: 'right' });
    ty += bold ? 20 : 14;
  };
  line('Subtotal', money(inv.subtotal));
  if (inv.discountAmount) line('Descuento', '-' + money(inv.discountAmount));
  if (inv.taxAmount) line('IVA', money(inv.taxAmount));
  if (inv.tipAmount) line('Propina', money(inv.tipAmount));
  if (inv.serviceCharge) line('Servicio', money(inv.serviceCharge));
  // Línea de acento con el color de marca del negocio antes del total
  doc.setDrawColor(ACCENT); doc.setLineWidth(2);
  doc.line(right - 160, ty - 6, right, ty - 6);
  ty += 4;
  line('TOTAL', money(inv.total), true);

  // Mensaje del negocio (personalizado) + nota legal, si están configurados.
  const footerMsg = (branding?.footerMessage || '').trim();
  const legal = (branding?.legalNote || '').trim();
  let fy = ty + 24;
  if (footerMsg) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(INK);
    doc.text(doc.splitTextToSize(footerMsg, W - M * 2), M, fy);
    fy += 18 + (Math.ceil(footerMsg.length / 90) * 12);
  }
  if (legal) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#9CABC2');
    doc.text(doc.splitTextToSize(legal, W - M * 2), M, fy);
  }

  // Pie discreto de la plataforma
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#9CABC2');
  doc.text('Generado con Kaivor · by Daptux.ia', M, doc.internal.pageSize.getHeight() - 30);

  return doc;
}

export function invoicePdfBlob(inv: PdfInvoice, branding?: PdfBranding): Blob {
  return buildInvoiceDoc(inv, branding).output('blob');
}

export function invoicePdfFilename(inv: PdfInvoice): string {
  return `Comprobante-${inv.invoiceNumber}.pdf`;
}

/** Descarga el PDF personalizado (funciona en escritorio y móvil). */
export function downloadInvoicePdf(inv: PdfInvoice, branding?: PdfBranding): void {
  buildInvoiceDoc(inv, branding).save(invoicePdfFilename(inv));
}

/**
 * Comparte el PDF como ARCHIVO usando la Web Share API (móvil moderno).
 * Si no se puede compartir archivo, cae a descarga. Devuelve cómo terminó.
 */
export async function shareInvoicePdf(inv: PdfInvoice, branding?: PdfBranding): Promise<'shared' | 'downloaded'> {
  const blob = invoicePdfBlob(inv, branding);
  const filename = invoicePdfFilename(inv);
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  if (nav?.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `Comprobante ${inv.invoiceNumber}`, text: `Comprobante ${inv.invoiceNumber} — ${money(inv.total)}` });
      return 'shared';
    } catch {
      // usuario canceló o falló — cae a descarga
    }
  }
  downloadInvoicePdf(inv, branding);
  return 'downloaded';
}
