import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const FIELD_DEFS: Record<string, { field: string; label: string }[]> = {
  customers: [
    { field: 'name', label: 'Nombre' },
    { field: 'taxId', label: 'NIT / Documento' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Teléfono' },
    { field: 'address', label: 'Dirección' },
    { field: 'city', label: 'Ciudad' },
  ],
  products: [
    { field: 'name', label: 'Nombre' },
    { field: 'sku', label: 'SKU' },
    { field: 'price', label: 'Precio' },
    { field: 'cost', label: 'Costo' },
    { field: 'category', label: 'Categoría' },
    { field: 'barcode', label: 'Código de barras' },
  ],
  employees: [
    { field: 'name', label: 'Nombre' },
    { field: 'document', label: 'Documento' },
    { field: 'position', label: 'Cargo' },
    { field: 'department', label: 'Departamento' },
    { field: 'salary', label: 'Salario' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Teléfono' },
  ],
};

function autoMap(header: string): string | null {
  const h = header.toLowerCase().trim();
  const map: Record<string, string> = {
    nombre: 'name', name: 'name', 'razón social': 'name', 'razon social': 'name',
    nit: 'taxId', documento: 'taxId', cédula: 'taxId', cedula: 'taxId', cc: 'taxId',
    email: 'email', correo: 'email',
    teléfono: 'phone', telefono: 'phone', celular: 'phone', phone: 'phone',
    dirección: 'address', direccion: 'address', address: 'address',
    ciudad: 'city', city: 'city',
    sku: 'sku', código: 'sku', codigo: 'sku',
    precio: 'price', price: 'price', valor: 'price',
    costo: 'cost', cost: 'cost',
    categoría: 'category', categoria: 'category', category: 'category',
    'código de barras': 'barcode', barcode: 'barcode', ean: 'barcode',
    cargo: 'position', position: 'position',
    departamento: 'department', department: 'department', área: 'department',
    salario: 'salary', sueldo: 'salary', salary: 'salary',
    document: 'document',
  };
  return map[h] || null;
}

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.importJob.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  preview(entityType: string, headers: string[]) {
    const fields = FIELD_DEFS[entityType] || FIELD_DEFS.customers;
    const mapping: Record<string, string> = {};
    headers.forEach((h, i) => {
      const f = autoMap(h);
      if (f) mapping[String(i)] = f;
    });
    const mapped = Object.keys(mapping).length;
    return {
      mapping,
      fields,
      message: mapped > 0
        ? `Detecté automáticamente ${mapped} columna(s). Revisa el mapeo y confirma.`
        : 'No pude mapear columnas automáticamente. Asígnalas manualmente.',
    };
  }

  async confirm(tenantId: string, entityType: string, mapping: Record<string, string>, rows: any[][], fileName: string) {
    const company = await this.prisma.company.findFirst({ where: { tenantId } });
    const errors: any[] = [];
    let success = 0;

    const toObj = (row: any[]) => {
      const o: any = {};
      Object.entries(mapping).forEach(([idx, field]) => { o[field] = row[parseInt(idx)]; });
      return o;
    };

    for (let i = 0; i < rows.length; i++) {
      const r = toObj(rows[i]);
      try {
        if (entityType === 'customers') {
          if (!r.name) throw new Error('Nombre requerido');
          await this.prisma.customer.create({
            data: {
              tenantId, companyId: company?.id || '',
              name: String(r.name).trim(), taxId: r.taxId ? String(r.taxId).trim() : `IMP-${Date.now()}-${i}`,
              email: r.email || null, phone: r.phone || null, address: r.address || null, city: r.city || null,
            },
          });
          success++;
        } else if (entityType === 'products') {
          if (!r.name) throw new Error('Nombre requerido');
          const p = await this.prisma.product.create({
            data: {
              tenantId, companyId: company?.id || '',
              name: String(r.name).trim(), sku: r.sku ? String(r.sku).trim() : `SKU-${Date.now()}-${i}`,
              price: parseFloat(r.price) || 0, cost: r.cost ? parseFloat(r.cost) : null,
              category: r.category || null, barcode: r.barcode || null,
            },
          });
          success++;
        } else if (entityType === 'employees') {
          if (!r.name) throw new Error('Nombre requerido');
          await this.prisma.employee.create({
            data: {
              tenantId, name: String(r.name).trim(), document: r.document ? String(r.document).trim() : `EMP-${i}`,
              position: r.position || null, department: r.department || null,
              salary: parseFloat(r.salary) || 0, email: r.email || null, phone: r.phone || null,
            },
          });
          success++;
        } else {
          throw new Error('Entidad no soportada');
        }
      } catch (e: any) {
        errors.push({ row: i + 2, error: e.message });
      }
    }

    const job = await this.prisma.importJob.create({
      data: {
        tenantId, entity: entityType, fileName: fileName || 'import.xlsx',
        totalRows: rows.length, successRows: success, failedRows: errors.length, errors,
      },
    });

    return { success, errors, job };
  }
}
