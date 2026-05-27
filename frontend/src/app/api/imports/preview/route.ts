import { NextRequest } from 'next/server';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { suggestMapping, ENTITY_FIELDS } from '@/lib/import-mapping';

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { entityType, headers } = await req.json();
    if (!entityType || !ENTITY_FIELDS[entityType]) {
      return Response.json({ message: 'Tipo de entidad no válido' }, { status: 400 });
    }
    if (!Array.isArray(headers) || headers.length === 0) {
      return Response.json({ message: 'No se detectaron columnas en el archivo' }, { status: 400 });
    }
    const mapping = suggestMapping(entityType, headers);
    const fields = ENTITY_FIELDS[entityType];
    const unmappedRequired = fields.filter(f => f.required && !mapping[f.field]).map(f => f.label);

    return Response.json({
      mapping,
      fields,
      headers,
      message: unmappedRequired.length
        ? `KAIROS AI mapeó las columnas automáticamente. Revisa y asigna: ${unmappedRequired.join(', ')}.`
        : `KAIROS AI mapeó ${Object.keys(mapping).length} columna(s) automáticamente. Revisa antes de importar.`,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
