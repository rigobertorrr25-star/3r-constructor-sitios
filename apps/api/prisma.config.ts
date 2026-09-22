import { defineConfig, env } from 'prisma/config';

// Prisma 7 no carga .env por sí solo. Node 22+ trae loadEnvFile, sin dependencias extra.
try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env: se usan las variables ya presentes en el entorno (CI, producción).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
