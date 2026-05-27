import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { Request, Response } from 'express';

const server = express();
let initialized = false;

async function bootstrap() {
  if (initialized) return;

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
}

export default async (req: Request, res: Response) => {
  await bootstrap();
  server(req, res);
};
