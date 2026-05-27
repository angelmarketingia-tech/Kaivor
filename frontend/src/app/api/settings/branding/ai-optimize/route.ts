import { NextRequest } from 'next/server';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

// Deterministic design optimizer — analyzes logo proportions and recommends layout.
export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { width, height, dominantColor } = await req.json();
    const w = Number(width) || 0;
    const h = Number(height) || 0;

    if (!w || !h) {
      return Response.json({
        logoPosition: 'left', logoSize: 'medium', invoiceTemplate: 'moderno',
        primaryColor: dominantColor || '#7c3aed',
        recommendation: 'KAIROS AI recomienda un logo en la esquina superior izquierda con tamaño mediano para una factura limpia y profesional.',
      });
    }

    const aspect = w / h;
    let logoPosition = 'left';
    let logoSize = 'medium';
    let invoiceTemplate = 'moderno';
    let reason = '';

    if (aspect > 1.8) {
      logoPosition = 'left'; logoSize = 'medium'; invoiceTemplate = 'moderno';
      reason = 'Tu logo es horizontal (apaisado). Lo ideal es ubicarlo en la esquina superior izquierda con tamaño mediano: aprovecha el ancho sin invadir los datos de la empresa.';
    } else if (aspect >= 0.8 && aspect <= 1.25) {
      logoPosition = 'center'; logoSize = 'small'; invoiceTemplate = 'premium';
      reason = 'Tu logo es cuadrado. Centrarlo con tamaño compacto da un aspecto premium y equilibrado, similar a una factura de marca.';
    } else if (aspect < 0.8) {
      logoPosition = 'left'; logoSize = 'small'; invoiceTemplate = 'minimalista';
      reason = 'Tu logo es vertical. Recomendamos tamaño compacto a la izquierda con plantilla minimalista para que no domine la cabecera.';
    } else {
      logoPosition = 'left'; logoSize = 'medium'; invoiceTemplate = 'moderno';
      reason = 'Logo con proporción estándar. Esquina superior izquierda y tamaño mediano funcionan bien.';
    }

    // Very large image — cap the visual size
    if (w > 2000 || h > 2000) {
      logoSize = logoSize === 'large' ? 'medium' : 'small';
      reason += ' El archivo es de alta resolución; limitamos el tamaño visual para que el PDF y la tirilla no se rompan.';
    }

    return Response.json({
      logoPosition, logoSize, invoiceTemplate,
      primaryColor: dominantColor && /^#[0-9a-fA-F]{6}$/.test(dominantColor) ? dominantColor : '#7c3aed',
      aspect: Math.round(aspect * 100) / 100,
      recommendation: `KAIROS AI: ${reason}`,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
