export function normalizeStoreUrl(url: string): string {
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
