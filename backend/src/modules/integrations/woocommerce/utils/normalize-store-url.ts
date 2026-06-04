import { BadRequestException } from '@nestjs/common';

export function normalizeStoreUrl(url: string): string {
  if (typeof url !== 'string' || !url.trim()) {
    throw new BadRequestException('storeUrl es requerido');
  }
  let normalized = url.trim();

  // Agregar https si no tiene protocolo
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }

  // Forzar https
  normalized = normalized.replace(/^http:\/\//, 'https://');

  // Remover trailing slash
  normalized = normalized.replace(/\/+$/, '');

  return normalized;
}
