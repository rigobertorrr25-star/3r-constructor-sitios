import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  // Render (y la mayoría de hostings) asignan el puerto por su cuenta en PORT; en desarrollo local
  // usamos API_PORT como hasta ahora.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API escuchando en http://localhost:${port}/api/v1`);
}

bootstrap();
