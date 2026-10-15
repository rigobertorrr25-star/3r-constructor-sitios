// Conexión a la base de datos propia de la asistencia (no es la de la tienda 3R).
import { Pool, type PoolClient } from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS businesses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120) NOT NULL,
  -- Va en el enlace que abre el QR: /marcar/{slug}.
  slug         VARCHAR(80) NOT NULL UNIQUE,
  -- Secreto de la tablet de la entrada: va en su enlace y firma los códigos que cambian cada 30 s.
  kiosk_secret VARCHAR(64) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HMAC del PIN con el id del negocio: el PIN nunca se guarda tal cual. Vacío = el empleado todavía no lo creó
-- (lo crea él mismo al escanear). Puede repetirse entre empleados: al marcar, cada uno toca primero su nombre.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(64);
ALTER TABLE employees ALTER COLUMN pin_hash DROP NOT NULL;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_business_id_pin_hash_key;
-- PIN equivocados seguidos; a los 5 el empleado queda bloqueado 15 minutos.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS failed_pins INT NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Turnos del negocio, en hora de Colombia: [{"start":"08:00","end":"15:00"}, …]. El turno de cada jornada
-- se deduce de la hora de llegada (y de salida, si la hay); no se asigna por empleado.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS shifts JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Una jornada: entrada y, cuando marca otra vez, salida.
CREATE TABLE IF NOT EXISTS records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clock_in    TIMESTAMPTZ NOT NULL,
  clock_out   TIMESTAMPTZ,
  -- Cuándo se corrigió a mano (si pasó).
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_records_business_clock_in ON records (business_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_records_employee_clock_in ON records (employee_id, clock_in);

-- Jefes: ven el reporte de su negocio (solo lectura). La clave va con scrypt y sal.
CREATE TABLE IF NOT EXISTS managers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rastro de las correcciones a mano, por si hay un reclamo.
CREATE TABLE IF NOT EXISTS record_changes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id  UUID NOT NULL,
  action     VARCHAR(20) NOT NULL,
  before     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// En desarrollo, Next recarga los módulos: el pool se guarda en globalThis para no abrir conexiones de más.
const store = globalThis as unknown as { asistenciaPool?: Pool; asistenciaSchema?: Promise<void> };

function pool(): Pool {
  if (!store.asistenciaPool) {
    if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
    store.asistenciaPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return store.asistenciaPool;
}

/** Crea las tablas si no existen. Corre una vez por proceso. */
function ensureSchema(): Promise<void> {
  store.asistenciaSchema ??= pool()
    .query(SCHEMA)
    .then(() => undefined)
    .catch((error) => {
      store.asistenciaSchema = undefined;
      throw error;
    });
  return store.asistenciaSchema;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  return (await pool().query(sql, params)).rows as T[];
}

/** Varias consultas que se aplican todas o ninguna. */
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Para las pruebas: cierra las conexiones. */
export async function closePool() {
  await store.asistenciaPool?.end();
  store.asistenciaPool = undefined;
  store.asistenciaSchema = undefined;
}
