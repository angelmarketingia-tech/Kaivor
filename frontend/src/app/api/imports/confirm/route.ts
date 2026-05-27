import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { ENTITY_FIELDS } from '@/lib/import-mapping';

const cleanNum = (v: any) => {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { entityType, mapping, rows, fileName } = await req.json();
    if (!entityType || !ENTITY_FIELDS[entityType]) {
      return Response.json({ message: 'Tipo de entidad no válido' }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ message: 'No hay filas para importar' }, { status: 400 });
    }
    if (rows.length > 1000) {
      return Response.json({ message: 'Máximo 1000 filas por importación' }, { status: 400 });
    }

    const company = await prisma.company.findFirst({ where: { tenantId: jwt.tenant_id } });
    if (!company) return Response.json({ message: 'Empresa no encontrada' }, { status: 400 });

    // Resolve a cell value for a field given the mapping
    const val = (row: any, field: string) => {
      const header = mapping[field];
      if (!header) return undefined;
      const v = row[header];
      return v == null ? undefined : String(v).trim();
    };

    const errors: { row: number; reason: string }[] = [];
    let imported = 0;

    if (entityType === 'customers') {
      // Preload existing taxIds to detect duplicates
      const existing = await prisma.customer.findMany({
        where: { tenantId: jwt.tenant_id }, select: { taxId: true },
      });
      const seenTax = new Set(existing.map(c => c.taxId).filter(Boolean) as string[]);

      for (let i = 0; i < rows.length; i++) {
        const name = val(rows[i], 'name');
        if (!name) { errors.push({ row: i + 1, reason: 'Falta el nombre' }); continue; }
        const taxId = val(rows[i], 'taxId') || null;
        if (taxId && seenTax.has(taxId)) { errors.push({ row: i + 1, reason: `Documento duplicado: ${taxId}` }); continue; }
        try {
          await prisma.customer.create({
            data: {
              tenantId: jwt.tenant_id, companyId: company.id, name,
              email: val(rows[i], 'email') || null,
              phone: val(rows[i], 'phone') || null,
              taxId, address: val(rows[i], 'address') || null,
              city: val(rows[i], 'city') || null,
            },
          });
          if (taxId) seenTax.add(taxId);
          imported++;
        } catch (e: any) {
          errors.push({ row: i + 1, reason: e.message?.slice(0, 100) || 'Error al crear' });
        }
      }
    } else if (entityType === 'products') {
      const existing = await prisma.product.findMany({
        where: { tenantId: jwt.tenant_id }, select: { sku: true },
      });
      const seenSku = new Set(existing.map(p => p.sku));

      for (let i = 0; i < rows.length; i++) {
        const name = val(rows[i], 'name');
        if (!name) { errors.push({ row: i + 1, reason: 'Falta el nombre' }); continue; }
        let sku = val(rows[i], 'sku') || `SKU-${Date.now()}-${i}`;
        if (seenSku.has(sku)) sku = `${sku}-${i}`;
        try {
          await prisma.product.create({
            data: {
              tenantId: jwt.tenant_id, companyId: company.id, name, sku,
              price: cleanNum(val(rows[i], 'price')),
              cost: mapping.cost ? cleanNum(val(rows[i], 'cost')) : null,
              category: val(rows[i], 'category') || null,
              barcode: val(rows[i], 'barcode') || null,
              unit: val(rows[i], 'unit') || 'u',
            },
          });
          seenSku.add(sku);
          imported++;
        } catch (e: any) {
          errors.push({ row: i + 1, reason: e.message?.slice(0, 100) || 'Error al crear' });
        }
      }
    }

    const job = await prisma.importJob.create({
      data: {
        tenantId: jwt.tenant_id, userId: jwt.sub, entityType,
        fileName: fileName || null,
        totalRows: rows.length, importedRows: imported, errorRows: errors.length,
        status: errors.length === rows.length ? 'failed' : 'completed',
        errors: errors.length ? errors.slice(0, 200) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: jwt.tenant_id, userId: jwt.sub, action: 'imported',
        resourceType: entityType, resourceId: job.id,
        changes: { imported, errors: errors.length },
      },
    }).catch(() => {});

    return Response.json({ jobId: job.id, imported, errors, total: rows.length });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const jobs = await prisma.importJob.findMany({
      where: { tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    return Response.json(jobs);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
