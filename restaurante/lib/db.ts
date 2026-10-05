// Conexión a la base propia de Restaurant Control (no es la de la tienda 3R ni la de la asistencia).
import { createHash } from 'node:crypto';
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

-- ───────── módulo 02: carta y pedidos ─────────

-- Carta del negocio (la misma en todas sus sedes). station: a qué pantalla va (kitchen = cocina, bar = barra).
CREATE TABLE IF NOT EXISTS menu_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(60) NOT NULL,
  station     VARCHAR(10) NOT NULL DEFAULT 'kitchen',
  sort        INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

-- Precio en pesos enteros. No se borran: se desactivan (los pedidos viejos los nombran).
CREATE TABLE IF NOT EXISTS menu_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name         VARCHAR(80) NOT NULL,
  description  VARCHAR(200),
  price        BIGINT NOT NULL CHECK (price >= 0),
  station      VARCHAR(10) NOT NULL DEFAULT 'kitchen',
  -- Agotado por hoy: sigue en la carta pero no se puede pedir.
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort         INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_business ON menu_products (business_id, category_id);

-- Cada "Enviar" del mesero: una ronda de la cuenta de una mesa. client_key evita que un doble toque
-- (o un reintento sin internet) mande el mismo pedido dos veces.
CREATE TABLE IF NOT EXISTS order_rounds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  number      INT NOT NULL,
  client_key  UUID NOT NULL,
  sent_by     UUID NOT NULL REFERENCES staff(id),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, number),
  UNIQUE (business_id, client_key)
);

-- Comanda de una ronda para una estación (cocina o barra). La pantalla de cada estación la avanza:
-- sent (enviada) → preparing → ready → delivered.
CREATE TABLE IF NOT EXISTS station_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  round_id     UUID NOT NULL REFERENCES order_rounds(id) ON DELETE CASCADE,
  station      VARCHAR(10) NOT NULL,
  status       VARCHAR(12) NOT NULL DEFAULT 'sent',
  started_at   TIMESTAMPTZ,
  ready_at     TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  UNIQUE (round_id, station)
);
CREATE INDEX IF NOT EXISTS idx_tickets_location_status ON station_tickets (location_id, station, status);

-- Lo pedido. Nombre y precio se copian del producto al pedir: si la carta cambia, la cuenta no.
-- Anular no borra: marca voided_at con quién y por qué.
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  round_id    UUID NOT NULL REFERENCES order_rounds(id) ON DELETE CASCADE,
  ticket_id   UUID NOT NULL REFERENCES station_tickets(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES menu_products(id),
  name        VARCHAR(80) NOT NULL,
  unit_price  BIGINT NOT NULL,
  quantity    INT NOT NULL CHECK (quantity > 0),
  notes       VARCHAR(140),
  voided_at   TIMESTAMPTZ,
  voided_by   UUID REFERENCES staff(id),
  void_reason VARCHAR(300)
);
CREATE INDEX IF NOT EXISTS idx_items_session ON order_items (session_id);

-- ───────── módulo 04: caja y pagos ─────────

-- Descuento máximo (en %) que un cajero puede dar sin el administrador.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cashier_discount_limit INT NOT NULL DEFAULT 10;
-- Propina sugerida (en %). En Colombia es voluntaria: el cliente decide.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS suggested_tip INT NOT NULL DEFAULT 10;

-- Turno de caja de una sede: se abre con una base en efectivo y se cierra contando la plata.
CREATE TABLE IF NOT EXISTS cash_shifts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id    UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  opened_by      UUID NOT NULL REFERENCES staff(id),
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_amount BIGINT NOT NULL CHECK (opening_amount >= 0),
  closed_by      UUID REFERENCES staff(id),
  closed_at      TIMESTAMPTZ,
  expected_cash  BIGINT,
  counted_cash   BIGINT,
  notes          VARCHAR(300)
);
-- Una sola caja abierta por sede.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_shift_per_location ON cash_shifts (location_id) WHERE closed_at IS NULL;

-- Entradas y salidas de efectivo que no son ventas (cambio que trae el dueño, pago a un proveedor…). No se borran.
CREATE TABLE IF NOT EXISTS cash_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  shift_id    UUID NOT NULL REFERENCES cash_shifts(id) ON DELETE CASCADE,
  kind        VARCHAR(4) NOT NULL,
  amount      BIGINT NOT NULL CHECK (amount > 0),
  reason      VARCHAR(200) NOT NULL,
  created_by  UUID NOT NULL REFERENCES staff(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Descuentos de una cuenta. Se anulan, no se borran.
CREATE TABLE IF NOT EXISTS session_discounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  amount      BIGINT NOT NULL CHECK (amount > 0),
  percent     INT,
  reason      VARCHAR(200) NOT NULL,
  applied_by  UUID NOT NULL REFERENCES staff(id),
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at   TIMESTAMPTZ,
  voided_by   UUID REFERENCES staff(id)
);

-- Pagos (una cuenta se puede pagar en varias partes y con varios medios). amount es lo que abona a la cuenta;
-- tip la propina; received y change solo en efectivo. Reversar no borra: marca reversed_at con motivo.
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  shift_id      UUID NOT NULL REFERENCES cash_shifts(id) ON DELETE CASCADE,
  method        VARCHAR(10) NOT NULL,
  amount        BIGINT NOT NULL CHECK (amount > 0),
  tip           BIGINT NOT NULL DEFAULT 0 CHECK (tip >= 0),
  received      BIGINT,
  change_given  BIGINT,
  reference     VARCHAR(60),
  client_key    UUID NOT NULL,
  created_by    UUID NOT NULL REFERENCES staff(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at   TIMESTAMPTZ,
  reversed_by   UUID REFERENCES staff(id),
  reverse_reason VARCHAR(300),
  UNIQUE (business_id, client_key)
);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments (session_id);
CREATE INDEX IF NOT EXISTS idx_payments_shift ON payments (shift_id);

-- ───────── módulos 05 y 06: inventario, recetas y botellas ─────────

-- Insumos del negocio. unit: g, ml o und. unit_cost: pesos por unidad (promedio ponderado de las compras).
-- bottle_size: si es una botella (licor), cuántos ml trae; el conteo se hace en botellas.
CREATE TABLE IF NOT EXISTS inventory_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  unit        VARCHAR(4) NOT NULL,
  unit_cost   NUMERIC(14, 4) NOT NULL DEFAULT 0,
  min_stock   NUMERIC(14, 3) NOT NULL DEFAULT 0,
  bottle_size NUMERIC(10, 2),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

-- Receta de un producto de la carta: cuánto de cada insumo gasta una unidad vendida.
CREATE TABLE IF NOT EXISTS recipe_lines (
  product_id UUID NOT NULL REFERENCES menu_products(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity   NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (product_id, item_id)
);

-- Libro de movimientos por sede (la existencia es la suma). kind: purchase, sale, void (devuelto por anulación),
-- waste (merma), count (ajuste por conteo físico), adjust. quantity con signo. No se cambia ni se borra.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  kind        VARCHAR(10) NOT NULL,
  quantity    NUMERIC(14, 3) NOT NULL,
  unit_cost   NUMERIC(14, 4) NOT NULL DEFAULT 0,
  reason      VARCHAR(200),
  order_item_id UUID,
  -- En un conteo: lo que debía haber y lo que se contó.
  expected    NUMERIC(14, 3),
  counted     NUMERIC(14, 3),
  created_by  UUID REFERENCES staff(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_moves_stock ON inventory_movements (location_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inv_moves_created ON inventory_movements (location_id, created_at DESC);

CREATE OR REPLACE FUNCTION inventory_movements_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'inventory_movements no se puede cambiar ni borrar';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS inventory_movements_no_change ON inventory_movements;
CREATE TRIGGER inventory_movements_no_change BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION inventory_movements_append_only();

-- ───────── módulo 07: gastos y finanzas ─────────

-- Gastos del negocio por sede (arriendo, nómina, servicios, proveedores…). Si se pagó con la plata de la caja,
-- cash_movement_id apunta a la salida de caja que se creó junto. Se anulan con motivo, no se borran.
CREATE TABLE IF NOT EXISTS expenses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id      UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  category         VARCHAR(20) NOT NULL,
  description      VARCHAR(200) NOT NULL,
  supplier         VARCHAR(120),
  amount           BIGINT NOT NULL CHECK (amount > 0),
  spent_on         DATE NOT NULL,
  paid_from_cash   BOOLEAN NOT NULL DEFAULT FALSE,
  cash_movement_id UUID REFERENCES cash_movements(id),
  created_by       UUID NOT NULL REFERENCES staff(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at        TIMESTAMPTZ,
  voided_by        UUID REFERENCES staff(id),
  void_reason      VARCHAR(200)
);
CREATE INDEX IF NOT EXISTS idx_expenses_location_date ON expenses (location_id, spent_on);

-- ───────── módulo 11: clientes, reservas y menú QR ─────────

-- Datos públicos del negocio para su carta y sus reservas en línea.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS public_phone VARCHAR(30);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Clientes del negocio (se reconocen por teléfono). Los usan las reservas y, más adelante, las facturas.
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  email       VARCHAR(160),
  document    VARCHAR(20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, phone)
);

-- Reservas. status: requested (pedida por el cliente en línea, falta confirmar), confirmed, arrived, no_show, cancelled.
CREATE TABLE IF NOT EXISTS reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  table_id    UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  guests      INT NOT NULL CHECK (guests > 0),
  notes       VARCHAR(300),
  deposit     BIGINT NOT NULL DEFAULT 0,
  status      VARCHAR(10) NOT NULL DEFAULT 'confirmed',
  source      VARCHAR(10) NOT NULL DEFAULT 'staff',
  session_id  UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES staff(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservations_location_start ON reservations (location_id, starts_at);

-- ───────── módulo 12: resumen diario con IA ─────────

-- Un resumen por negocio, alcance (sede o todas) y día. Se guarda para no pedirlo a la IA cada vez que se abre.
CREATE TABLE IF NOT EXISTS daily_briefs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scope       VARCHAR(40) NOT NULL,
  day         DATE NOT NULL,
  text        TEXT NOT NULL,
  source      VARCHAR(40) NOT NULL,
  created_by  UUID REFERENCES staff(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, scope, day)
);

-- ───────── módulo 13: servicios y citas (barberías, peluquerías, spas) ─────────

-- Servicios con precio, duración y comisión del profesional (en %).
CREATE TABLE IF NOT EXISTS services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  price       BIGINT NOT NULL CHECK (price >= 0),
  duration    INT NOT NULL CHECK (duration BETWEEN 5 AND 600),
  commission  INT NOT NULL DEFAULT 0 CHECK (commission BETWEEN 0 AND 100),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

-- Citas. Precio y comisión se copian del servicio al agendar. status: scheduled, done, paid, no_show, cancelled.
CREATE TABLE IF NOT EXISTS appointments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id),
  staff_id    UUID NOT NULL REFERENCES staff(id),
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  price       BIGINT NOT NULL,
  commission  INT NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'scheduled',
  notes       VARCHAR(300),
  created_by  UUID REFERENCES staff(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_start ON appointments (staff_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_location_start ON appointments (location_id, starts_at);

-- Un pago es de una cuenta de mesa o de una cita (no de las dos).
ALTER TABLE payments ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_one_target;
ALTER TABLE payments ADD CONSTRAINT payments_one_target CHECK ((session_id IS NULL) <> (appointment_id IS NULL));

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

// Huella del esquema: si no cambió, no se vuelve a correr (cambiar tablas bloquea a quien las está usando, y en
// Vercel arrancan servidores nuevos a cada rato).
const SCHEMA_VERSION = createHash('sha256').update(SCHEMA).digest('hex').slice(0, 16);

/** Crea o actualiza las tablas solo si el esquema cambió desde la última vez. Una vez por proceso, con candado. */
function ensureSchema(): Promise<void> {
  store.restauranteSchema ??= (async () => {
    const client = await pool().connect();
    try {
      const current = async () =>
        (
          await client.query<{ version: string }>(
            `SELECT version FROM schema_meta WHERE id = 1 AND to_regclass('schema_meta') IS NOT NULL`,
          ).catch(() => ({ rows: [] as { version: string }[] }))
        ).rows[0]?.version;
      if ((await current()) === SCHEMA_VERSION) return;
      await client.query('SELECT pg_advisory_lock(727001)');
      try {
        if ((await current()) === SCHEMA_VERSION) return;
        await client.query(SCHEMA);
        await client.query(`CREATE TABLE IF NOT EXISTS schema_meta (id INT PRIMARY KEY, version VARCHAR(32) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
        await client.query(
          `INSERT INTO schema_meta (id, version) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, updated_at = now()`,
          [SCHEMA_VERSION],
        );
      } finally {
        await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
      }
    } finally {
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

/** El pool como `Db`, para funciones que sirven igual dentro o fuera de una transacción. */
export function pooled(): Db {
  return {
    query: (async (sql: string, params?: unknown[]) => {
      await ensureSchema();
      return pool().query(sql, params);
    }) as Db['query'],
  };
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
