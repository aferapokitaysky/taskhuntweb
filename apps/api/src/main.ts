import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { SanitizeResponseInterceptor } from './common/interceptors/sanitize-response.interceptor';

async function bootstrap() {
  const webPublicUrl = process.env.WEB_PUBLIC_URL;
  if (!webPublicUrl && process.env.NODE_ENV === 'production') {
    throw new Error('WEB_PUBLIC_URL environment variable must be set in production');
  }

  const bullBoardUser = process.env.BULL_BOARD_USER;
  const bullBoardPassword = process.env.BULL_BOARD_PASSWORD;
  if (!bullBoardUser || !bullBoardPassword) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BULL_BOARD_USER/BULL_BOARD_PASSWORD must be set in production — /admin/queues would otherwise be public');
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // За реверс-прокси (nginx/Cloudflare/балансировщик) без этого req.ip всегда
  // возвращает адрес прокси, а не клиента — это ломает и rate limiting
  // (ThrottlerGuard бьёт по IP), и анти-фрод (детекция дублей аккаунтов по
  // IP при регистрации): все запросы выглядят пришедшими с одного адреса.
  // trust proxy: 1 — доверяем ровно одному прокси-хопу перед приложением
  // (стандартный безопасный дефолт для одного балансировщика/edge-прокси).
  app.set('trust proxy', 1);

  // Bull Board монтируется в обход Nest-гардов (это express middleware, не контроллер),
  // поэтому /admin/queues защищаем отдельным Basic Auth — там видны и управляются очереди
  // выплат/событий, публичный доступ недопустим.
  app.use('/admin/queues', (req: Request, res: Response, next: NextFunction) => {
    if (!bullBoardUser || !bullBoardPassword) {
      res.status(503).send('Bull Board is disabled: BULL_BOARD_USER/BULL_BOARD_PASSWORD not configured');
      return;
    }
    const header = req.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');
    const decoded = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';
    const [user, password] = decoded.split(':');
    if (user === bullBoardUser && password === bullBoardPassword) {
      next();
      return;
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
    res.status(401).send('Authentication required');
  });

  app.enableShutdownHooks();
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
  app.useGlobalInterceptors(new SanitizeResponseInterceptor());

  process.on('SIGTERM', async () => {
    app.get(Logger).log('SIGTERM signal received. Closing Nest application gracefully...');
    await app.close();
    process.exit(0);
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  app.get(Logger).log(`TaskHunt API listening on :${port}`);
}

bootstrap();
