import 'reflect-metadata';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { initSentry, sentryErrorHandler } from './common/sentry';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require('express');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import type { Express } from 'express';

initSentry();

const server: Express = express();
let initialized = false;

export async function getExpressServer(): Promise<Express> {
  if (initialized) return server;

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    rawBody: true,
    logger: ['error', 'warn'],
  });

  const origins = (process.env.FRONTEND_URLS || 'https://kaivor.vercel.app')
    .split(',')
    .map((s) => s.trim());

  app.enableCors({ origin: origins, credentials: true });
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Map Prisma constraint errors (P2002/P2025/P2003) to clean 4xx instead of 500.
  // Order matters: Prisma filter first (handles P2002/P2025), then the catch-all
  // which captures unhandled 5xx to Sentry and passes 4xx through unchanged.
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new AllExceptionsFilter(httpAdapterHost.httpAdapter),
  );

  await app.init();
  // Sentry error handler must be after all other middleware/init
  server.use(sentryErrorHandler());
  initialized = true;
  return server;
}
