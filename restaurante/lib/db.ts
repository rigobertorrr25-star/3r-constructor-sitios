// Conexión a la base propia de Restaurant Control (no es la de la tienda 3R ni la de la asistencia).
import { Pool, type PoolClient } from 'pg';

const SCHEMA = `
-- Un negocio (restaurante, bar…) con una o varias sedes. Todo lo demás cuelga de aquí.
CREATE TABLE IF NOT EXISTS businesses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(120) NOT NULL,
  -- Va en el enlace de ingreso del equipo: /n/{slug}.
  slug       VARCHAR(80) NOT NULL UNIQUE,
  timezone   VARCHAR(60) NOT NULL DEFAULT 'America/Bogota',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  address     VARCHAR(160),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

-- El equipo entra con su código y su PIN (scrypt con sal; nunca el PIN tal cual).
-- location_id vacío = trabaja en todas las sedes. No se borra nadie: se desactiva.
CREATE TABLE IF NOT EXISTS staff (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id  UUID REFERENCES locations(id) ON DELETE SET NULL,
  code         VARCHAR(12) NOT NULL,
  name         VARCHAR(120) NOT NULL,
  role         VARCHAR(20) NOT NULL,
  pin_hash     VARCHAR(200) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  failed_pins  INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  -- Sube al cambiar PIN, rol, sede o al desactivar: las sesiones abiertas con el número viejo dejan de valer.
  session_epoch INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

-- Mesas del plano de cada sede. Posición y tamaño en unidades de un lienzo de 1000 × 640.
CREATE TABLE IF NOT EXISTS dining_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone        VARCHAR(40) NOT NULL DEFAULT 'Salón',
  number      VARCHAR(12) NOT NULL,
  capacity    INT NOT NULL,
  shape       VARCHAR(10) NOT NULL DEFAULT 'square',
  x           INT NOT NULL DEFAULT 20,
  y           INT NOT NULL DEFAULT 20,
  w           INT NOT NULL DEFAULT 110,
  h           INT NOT NULL DEFAULT 110,
  -- Bloqueada: no se puede abrir (mesa dañada, evento privado…).
  is_blocked  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, number)
);

-- Cada vez que se ocupa una mesa. El cronómetro sale de opened_at. No se borran.
CREATE TABLE IF NOT EXISTS table_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id    UUID NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  status      VARCHAR(10) NOT NULL DEFAULT 'open',
  guests      INT NOT NULL,
  notes       VARCHAR(300),
  opened_by   UUID NOT NULL REFERENCES staff(id),
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  bill_at     TIMESTAMPTZ,
  closed_by   UUID REFERENCES staff(id),
  closed_at   TIMESTAMPTZ
);
-- Una sola sesión abierta por mesa, aunque dos meseros toquen "Abrir" al mismo tiempo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_session_per_table ON table_sessions (table_id) WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_sessions_location_opened ON table_sessions (location_id, opened_at);

-- Rastro de todo lo importante: quién hizo qué, cuándo y por qué.
CREATE TABLE IF NOT EXISTS audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID,
  actor_id    UUID,
  actor_name  VARCHAR(120),
  action      VARCHAR(40) NOT NULL,
  entity      VARCHAR(40) NOT NULL,
  entity_id   UUID,
  summary     VARCHAR(300) NOT NULL,
  reason      VARCHAR(300),
  data        JSONB,
  ip          VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_business_created ON audit_events (business_id, created_at DESC);

-- La auditoría no se cambia ni se borra desde la app. Solo se permite al borrar un negocio entero
-- (pruebas o baja definitiva), que activa app.purge dentro de su propia transacción.
CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_events no se puede cambiar ni borrar';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_events_no_change ON audit_events;
CREATE TRIGGER audit_events_no_change BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
`;

// En desarrollo, Next recarga los módulos: el pool se guarda en globalThis para no abrir conexiones de más.
const store = globalThis as unknown as { restaurantePool?: Pool; restauranteSchema?: Promise<void> };

function pool(): Pool {
  if (!store.restaurantePool) {
    if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
    store.restaurantePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return store.restaurantePool;
}

/** Crea las tablas si no existen. Corre una vez por proceso (con un candado, por si arrancan dos a la vez). */
function ensureSchema(): Promise<void> {
  store.restauranteSchema ??= (async () => {
    const client = await pool().connect();
    try {
      await client.query('SELECT pg_advisory_lock(727001)');
      await client.query(SCHEMA);
    } finally {
      await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
      client.release();
    }
  })().catch((error) => {
    store.restauranteSchema = undefined;
    throw error;
  });
  return store.restauranteSchema;
}

/** Algo que puede hacer consultas: el pool o una transacción abierta. */
export type Db = Pick<PoolClient, 'query'>;

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
  await store.restaurantePool?.end();
  store.restaurantePool = undefined;
  store.restauranteSchema = undefined;
}
