import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API escuchando en http://localhost:${port}/api/v1`);
}

bootstrap();
