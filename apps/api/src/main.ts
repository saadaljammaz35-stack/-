/**
 * API bootstrap.
 *
 * Order matters here. Configuration is validated (and production safety
 * asserted) before anything binds a port, so a misconfigured production deploy
 * dies at startup rather than serving traffic with development secrets.
 */

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { loadConfig } from './config/configuration.js';
import { beginDraining } from './health/health.controller.js';

async function bootstrap(): Promise<void> {
  // Fails fast, before a port is bound, if the environment is unsafe.
  const config = loadConfig();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Trust exactly as many proxy hops as we actually run behind. Trusting all
    // of them lets a client spoof X-Forwarded-For and evade per-IP rate limits.
    rawBody: true,
  });

  app.set?.('trust proxy', config.security.trustProxyHops);
  app.use(helmet({ contentSecurityPolicy: config.env === 'production' }));

  app.enableCors({
    origin:
      config.security.corsOrigins.length > 0 ? [...config.security.corsOrigins] : false,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });

  app.setGlobalPrefix(config.apiPrefix, { exclude: ['health', 'ready', 'live'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Reject unknown fields outright rather than ignoring them: silently
      // dropping an unrecognised `amount` field would be far worse than a 400.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.features.swaggerEnabled && config.env !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('NABD API')
        .setDescription(
          'NABD FinTech Platform API. NABD is not a licensed bank; all movement ' +
            'of real value is delegated to licensed partners behind adapters.',
        )
        .setVersion('0.1.0')
        .addBearerAuth()
        .addGlobalParameters({
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          description: 'Required on every value-moving request.',
        })
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  // Graceful shutdown: stop accepting traffic, let in-flight requests (and
  // their database transactions) finish, then exit.
  app.enableShutdownHooks();
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      beginDraining();
      void app.close().then(() => process.exit(0));
    });
  }

  await app.listen(config.port);
}

void bootstrap();
