import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const webPublicUrl = process.env.WEB_PUBLIC_URL;
  if (!webPublicUrl && process.env.NODE_ENV === 'production') {
    throw new Error('WEB_PUBLIC_URL environment variable must be set in production');
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const corsOrigin = webPublicUrl ?? 'http://localhost:3000';
  app.enableCors({ origin: corsOrigin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  app.get(Logger).log(`TaskHunt API listening on :${port}`);
}

bootstrap();
