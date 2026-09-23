import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/**
 * Junta los mensajes de validación en una lista plana, tal cual están escritos. Nest antepone el
 * nombre del campo padre (`brief.…`) a los mensajes de objetos anidados, y eso se vería en pantalla.
 */
function flattenMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenMessages(error.children ?? []),
  ]);
}

/** Configuración compartida entre main.ts y las pruebas e2e. */
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api/v1');
  // Detrás de Render (u otro proxy) hay que confiar en X-Forwarded-For para que cada visitante
  // tenga su propia IP real; si no, todos comparten la IP del proxy y el límite de intentos
  // (@nestjs/throttler) bloquearía a todos juntos o a nadie.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  // Los documentos del editor pueden superar los 100 KB por defecto (tope real: 1 MB validado en el servicio).
  app.useBodyParser('json', { limit: '2mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(flattenMessages(errors)),
    }),
  );
}
