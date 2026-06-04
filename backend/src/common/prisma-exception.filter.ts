import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Maps Prisma known-request errors to clean HTTP responses instead of leaking 500s.
 * - P2002 unique constraint  -> 409 Conflict
 * - P2025 record not found    -> 404 Not Found
 * - P2003 FK constraint       -> 400 Bad Request
 * - everything else           -> 400 with a generic message
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaExceptionFilter');

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'Solicitud inválida.';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[] | string | undefined) || '';
        const fields = Array.isArray(target) ? target.join(', ') : String(target);
        if (/taxId|tax_id/i.test(fields)) message = 'Ya existe un registro con ese NIT/documento.';
        else if (/email/i.test(fields)) message = 'Ya existe un registro con ese correo.';
        else if (/sku/i.test(fields)) message = 'Ya existe un producto con ese SKU.';
        else message = 'Ya existe un registro con esos datos (valor duplicado).';
        break;
      }
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'El registro solicitado no existe.';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Referencia inválida: el registro relacionado no existe.';
        break;
      default:
        this.logger.warn(`Unmapped Prisma error ${exception.code}: ${exception.message}`);
        message = 'No se pudo completar la operación por un conflicto en los datos.';
    }

    res.status(status).json({ statusCode: status, message, error: exception.code });
  }
}
