// Roles fijos y lo que puede hacer cada uno. Se revisa siempre en el servidor, no solo escondiendo botones.

export const ROLES = ['owner', 'manager', 'cashier', 'service', 'waiter', 'kitchen', 'bar', 'pro'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dueño',
  manager: 'Administrador',
  cashier: 'Cajero',
  service: 'Jefe de servicio',
  waiter: 'Mesero',
  kitchen: 'Cocina',
  bar: 'Barra',
  pro: 'Profesional',
};

export const ROLE_HINT: Record<Role, string> = {
  owner: 'Todo, incluidas las sedes y el equipo.',
  manager: 'Opera la sede: carta, plano, equipo, anulaciones y auditoría.',
  cashier: 'Mesas, pedidos y cierre de cuentas.',
  service: 'Lo mismo que un mesero, y además anula productos ya comandados y ve las ventas y la propina del día (Mesas del día). No cobra.',
  waiter: 'Abre mesas, toma pedidos y pide la cuenta.',
  kitchen: 'Pantalla de cocina.',
  bar: 'Pantalla de barra.',
  pro: 'Barbero, estilista, terapeuta…: ve su agenda y sus comisiones.',
};

export type Permission =
  | 'tables.view'
  | 'tables.open'
  | 'tables.bill'
  | 'tables.close'
  | 'floor.edit'
  | 'staff.manage'
  | 'locations.manage'
  | 'audit.view'
  | 'orders.take'
  | 'orders.void'
  | 'menu.edit'
  | 'kds.view'
  | 'tickets.deliver'
  | 'cash.operate'
  | 'payments.reverse'
  | 'discounts.unlimited'
  | 'inventory.view'
  | 'inventory.manage'
  | 'inventory.load'
  | 'inventory.waste'
  | 'finance.view'
  | 'expenses.add'
  | 'reservations.manage'
  | 'agenda.view'
  | 'agenda.manage'
  | 'invoices.manage'
  | 'printers.manage'
  | 'waiters.verify'
  | 'sales.view';

const GRANTS: Record<Permission, Role[]> = {
  'tables.view': ['owner', 'manager', 'cashier', 'service', 'waiter'],
  'tables.open': ['owner', 'manager', 'cashier', 'service', 'waiter'],
  'tables.bill': ['owner', 'manager', 'cashier', 'service', 'waiter'],
  'tables.close': ['owner', 'manager', 'cashier'],
  'floor.edit': ['owner', 'manager'],
  'staff.manage': ['owner', 'manager'],
  'locations.manage': ['owner'],
  'audit.view': ['owner', 'manager'],
  'orders.take': ['owner', 'manager', 'cashier', 'service', 'waiter'],
  // Anular lo ya comandado: también la jefe de servicio (28 oct 2026, pedido de Rigoberto).
  'orders.void': ['owner', 'manager', 'service'],
  'menu.edit': ['owner', 'manager'],
  // Pantallas de cocina y barra: cada estación ve la suya; dueño y administrador, las dos.
  'kds.view': ['owner', 'manager', 'kitchen', 'bar'],
  // Marcar "entregado a la mesa": quien lleva los platos.
  'tickets.deliver': ['owner', 'manager', 'cashier', 'service', 'waiter', 'kitchen', 'bar'],
  // Caja: abrir y cerrar turno, cobrar, descuentos (el cajero hasta el límite del negocio), entradas y salidas.
  'cash.operate': ['owner', 'manager', 'cashier'],
  'payments.reverse': ['owner', 'manager'],
  'discounts.unlimited': ['owner', 'manager'],
  'inventory.view': ['owner', 'manager', 'kitchen', 'bar'],
  // Insumos, recetas, compras y conteos.
  'inventory.manage': ['owner', 'manager'],
  // Inventario masivo (armarlo desde la carta, cargar cantidades y mínimos, y crear lo que la IA vio en la foto): también
  // barra y cocina, cada una solo lo de su área. Los costos, no.
  'inventory.load': ['owner', 'manager', 'kitchen', 'bar'],
  // Mermas (se cayó, se dañó): las registra quien las ve.
  'inventory.waste': ['owner', 'manager', 'kitchen', 'bar'],
  // Gastos y estado de resultados. El dueño ve todas las sedes; el administrador, la suya.
  'finance.view': ['owner', 'manager'],
  // Registrar un gasto (con la foto de su factura de compra): también la cajera, desde Facturas. Verlos todos y anularlos, no.
  'expenses.add': ['owner', 'manager', 'cashier'],
  'reservations.manage': ['owner', 'manager', 'cashier', 'service', 'waiter'],
  // Citas: el profesional ve la suya; dueño, administrador y cajero agendan, mueven y cobran.
  'agenda.view': ['owner', 'manager', 'cashier', 'pro'],
  'agenda.manage': ['owner', 'manager', 'cashier'],
  'invoices.manage': ['owner', 'manager', 'cashier'],
  // Impresoras de comandas y el programa de impresión del local.
  'printers.manage': ['owner', 'manager'],
  // Bar sin cajero: ver la cuenta de cada mesero, cerrarla por él y verificar los cierres.
  'waiters.verify': ['owner', 'manager'],
  // Mesas del día: lo cobrado, lo por cobrar y la propina. También la jefe de servicio (28 oct 2026, pedido de Rigoberto), que no cobra.
  'sales.view': ['owner', 'manager', 'cashier', 'service'],
};

export const can = (role: Role, permission: Permission) => GRANTS[permission].includes(role);

export const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

/** Roles que `actor` puede dar o quitar: el administrador no crea dueños ni toca a otros administradores. */
export const assignableRoles = (actor: Role): Role[] => (actor === 'owner' ? [...ROLES] : ROLES.filter((r) => r !== 'owner' && r !== 'manager'));

/** Los roles que se ofrecen al agregar a alguien: un bar solo de licores no tiene cocina ni agenda, y sin cajero no se ofrece cajero. */
export const offeredRoles = (actor: Role, mode: { waitersCollect: boolean; barOnly: boolean }): Role[] =>
  assignableRoles(actor).filter((r) => !(mode.barOnly && (r === 'kitchen' || r === 'pro')) && !(mode.waitersCollect && r === 'cashier'));

/** Pantalla inicial de cada rol al entrar. */
export const homeOf = (role: Role) =>
  role === 'owner' ? '/app/tablero' : role === 'kitchen' ? '/app/cocina' : role === 'bar' ? '/app/barra' : role === 'pro' ? '/app/agenda' : '/app';

/** Estación que le toca a un rol de producción (null = puede ver cualquiera). */
export const ownStation = (role: Role) => (role === 'kitchen' ? 'kitchen' : role === 'bar' ? 'bar' : null);
