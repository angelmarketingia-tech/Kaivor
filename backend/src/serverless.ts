import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require('express');
import type { Express } from 'express';

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();
  initialized = true;
  return server;
}
