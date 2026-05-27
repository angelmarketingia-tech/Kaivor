import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true permite leer el body crudo para verificar firmas de webhook (WooCommerce)
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Enable CORS
  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? (process.env.FRONTEND_URLS || 'https://kaivor.vercel.app')
          .split(',')
          .map((u) => u.trim())
      : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`✓ ADMIA Backend running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});
