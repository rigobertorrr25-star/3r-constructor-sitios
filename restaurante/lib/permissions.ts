// Roles fijos y lo que puede hacer cada uno. Se revisa siempre en el servidor, no solo escondiendo botones.

export const ROLES = ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'bar'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dueño',
  manager: 'Administrador',
  cashier: 'Cajero',
  waiter: 'Mesero',
  kitchen: 'Cocina',
  bar: 'Barra',
};

export const ROLE_HINT: Record<Role, string> = {
  owner: 'Todo, incluidas las sedes y el equipo.',
  manager: 'Opera la sede: plano, equipo y auditoría.',
  cashier: 'Mesas y cierre de cuentas.',
  waiter: 'Abre mesas y pide la cuenta.',
  kitchen: 'Pantalla de cocina.',
  bar: 'Pantalla de barra.',
};

export type Permission =
  | 'tables.view'
  | 'tables.open'
  | 'tables.bill'
  | 'tables.close'
  | 'floor.edit'
  | 'staff.manage'
  | 'locations.manage'
  | 'audit.view';

const GRANTS: Record<Permission, Role[]> = {
  'tables.view': ['owner', 'manager', 'cashier', 'waiter'],
  'tables.open': ['owner', 'manager', 'cashier', 'waiter'],
  'tables.bill': ['owner', 'manager', 'cashier', 'waiter'],
  'tables.close': ['owner', 'manager', 'cashier'],
  'floor.edit': ['owner', 'manager'],
  'staff.manage': ['owner', 'manager'],
  'locations.manage': ['owner'],
  'audit.view': ['owner', 'manager'],
};

export const can = (role: Role, permission: Permission) => GRANTS[permission].includes(role);

export const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

/** Roles que `actor` puede dar o quitar: el administrador no crea dueños ni toca a otros administradores. */
export const assignableRoles = (actor: Role): Role[] => (actor === 'owner' ? [...ROLES] : ROLES.filter((r) => r !== 'owner' && r !== 'manager'));

/** Pantalla inicial de cada rol al entrar. */
export const homeOf = (role: Role) => (role === 'kitchen' || role === 'bar' ? '/app/espera' : '/app');
