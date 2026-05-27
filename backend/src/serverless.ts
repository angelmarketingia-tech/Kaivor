import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { initSentry, sentryErrorHandler } from './common/sentry';
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

  await app.init();
  // Sentry error handler must be after all other middleware/init
  server.use(sentryErrorHandler());
  initialized = true;
  return server;
}
