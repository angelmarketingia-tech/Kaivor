import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '@/prisma/prisma.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const SKIP_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/mfa/verify',
  '/health',
]);

const RESOURCE_FROM_PATH: Record<string, string> = {
  customers: 'customer',
  products: 'product',
  invoices: 'invoice',
  transactions: 'transaction',
  suppliers: 'supplier',
  employees: 'employee',
  payroll: 'payroll',
  vacancies: 'vacancy',
  automations: 'automation',
  messages: 'message',
  tenants: 'tenant',
  companies: 'company',
  settings: 'settings',
  accounts: 'account',
  integrations: 'integration',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;
    const path = req.path as string;

    return next.handle().pipe(
      tap((result) => {
        if (!MUTATING_METHODS.has(method)) return;
        if (SKIP_PATHS.has(path)) return;
        if (!req.user?.tenantId) return; // unauthenticated — no audit

        const segments = path.split('/').filter(Boolean);
        const resource = RESOURCE_FROM_PATH[segments[0]] || segments[0];
        const resourceId = (result && (result.id || result.invoice?.id || result.product?.id)) || segments[1] || null;

        const action =
          method === 'POST' ? 'created'
          : method === 'DELETE' ? 'deleted'
          : 'updated';

        // Fire-and-forget, don't block response or fail
        this.prisma.auditLog
          .create({
            data: {
              tenantId: req.user.tenantId,
              userId: req.user.userId || null,
              action,
              resourceType: resource,
              resourceId,
              ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
              changes: { method, path },
            },
          })
          .catch(() => {
            /* never crash on audit failure */
          });
      }),
    );
  }
}
