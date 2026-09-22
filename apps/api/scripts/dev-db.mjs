// Postgres local para desarrollo y pruebas, sin Docker ni cuentas en la nube.
// Los datos viven fuera de OneDrive (LOCALAPPDATA) para no chocar con la sincronización.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const dataDir = join(process.env.LOCALAPPDATA ?? homedir(), '3r-pgdata');
const port = Number(process.env.DEV_DB_PORT ?? 54329);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
});

const firstRun = !existsSync(join(dataDir, 'PG_VERSION'));
if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase('builder_dev');

console.log(`Postgres local listo: postgresql://postgres:postgres@localhost:${port}/builder_dev`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
