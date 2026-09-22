// Da el rol ADMIN a una cuenta existente. Uso: npm run make-admin -w api -- correo@ejemplo.com
// Se hace por consola a propósito: nadie puede volverse administrador desde la web.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
try {
  process.loadEnvFile('.env');
} catch {
  /* se usa el entorno */
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: npm run make-admin -w api -- correo@ejemplo.com');
  process.exit(1);
}

const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const user = await client.query('select id from users where email = $1', [email]);
  if (user.rowCount === 0) {
    console.error(`No existe una cuenta con ${email}. Primero regístrala en /registro.`);
    process.exit(1);
  }
  await client.query(
    "insert into user_roles (user_id, role) values ($1, 'ADMIN') on conflict do nothing",
    [user.rows[0].id],
  );
  console.log(`${email} ahora es ADMIN. Cierra sesión y vuelve a entrar para que se aplique.`);
} finally {
  await client.end();
}
