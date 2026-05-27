// Deterministic column-mapping helper — used by the import preview endpoint.
// Maps common Spanish/English spreadsheet headers to internal entity fields.

const norm = (s: string) =>
  s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]/g, '');

const ALIASES: Record<string, Record<string, string[]>> = {
  customers: {
    name: ['nombre', 'cliente', 'nombrecliente', 'razonsocial', 'razon', 'nombrecompleto', 'name'],
    email: ['email', 'correo', 'correoelectronico', 'mail', 'ecorreo'],
    phone: ['telefono', 'celular', 'movil', 'whatsapp', 'tel', 'contacto', 'phone'],
    taxId: ['nit', 'cc', 'documento', 'cedula', 'identificacion', 'rut', 'numerodocumento', 'taxid', 'ndocumento'],
    address: ['direccion', 'address', 'domicilio'],
    city: ['ciudad', 'municipio', 'city'],
  },
  products: {
    name: ['nombre', 'producto', 'nombreproducto', 'descripcion', 'articulo', 'name'],
    sku: ['sku', 'codigo', 'referencia', 'ref', 'codigoproducto', 'cod'],
    price: ['precio', 'precioventa', 'valor', 'preciounitario', 'pvp', 'price'],
    cost: ['costo', 'costounitario', 'preciocompra', 'cost'],
    category: ['categoria', 'tipo', 'linea', 'category'],
    barcode: ['codigobarras', 'codigodebarras', 'barcode', 'ean', 'codbarras'],
    unit: ['unidad', 'medida', 'unit', 'um'],
  },
};

export const ENTITY_FIELDS: Record<string, { field: string; label: string; required: boolean }[]> = {
  customers: [
    { field: 'name', label: 'Nombre', required: true },
    { field: 'email', label: 'Email', required: false },
    { field: 'phone', label: 'Teléfono', required: false },
    { field: 'taxId', label: 'NIT / Documento', required: false },
    { field: 'address', label: 'Dirección', required: false },
    { field: 'city', label: 'Ciudad', required: false },
  ],
  products: [
    { field: 'name', label: 'Nombre', required: true },
    { field: 'sku', label: 'SKU / Código', required: false },
    { field: 'price', label: 'Precio', required: true },
    { field: 'cost', label: 'Costo', required: false },
    { field: 'category', label: 'Categoría', required: false },
    { field: 'barcode', label: 'Código de barras', required: false },
    { field: 'unit', label: 'Unidad', required: false },
  ],
};

// Returns { field: matchedHeader } suggestions for the given entity.
export function suggestMapping(entityType: string, headers: string[]): Record<string, string> {
  const aliases = ALIASES[entityType] ?? {};
  const result: Record<string, string> = {};
  const used = new Set<string>();
  for (const [field, keys] of Object.entries(aliases)) {
    for (const header of headers) {
      if (used.has(header)) continue;
      const nh = norm(header);
      if (keys.includes(nh) || keys.some(k => nh === k || nh.includes(k) || k.includes(nh))) {
        result[field] = header;
        used.add(header);
        break;
      }
    }
  }
  return result;
}
