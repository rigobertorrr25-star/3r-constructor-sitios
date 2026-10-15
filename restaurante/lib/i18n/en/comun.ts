// Textos en inglés: comunes (menú, encabezado, roles, estaciones, botones generales).
// La llave es el texto exacto en español (con sus {huecos}).
export const en: Record<string, string> = {
  // Menú de secciones
  Tablero: 'Dashboard',
  Mesas: 'Tables',
  Cocina: 'Kitchen',
  Barra: 'Bar',
  Reservas: 'Reservations',
  Agenda: 'Schedule',
  Caja: 'Cashier',
  Finanzas: 'Finances',
  Facturas: 'Invoices',
  Carta: 'Menu',
  Inventario: 'Inventory',
  Plano: 'Floor plan',
  Equipo: 'Staff',
  Sedes: 'Locations',
  'QR y enlaces': 'QR & links',
  Impresoras: 'Printers',
  Auditoría: 'Audit log',

  // Encabezado
  Salir: 'Sign out',
  'Hay 1 papel sin imprimir: revisa que el computador de impresión esté prendido y las impresoras con papel.':
    '1 ticket hasn’t printed: check that the printing computer is on and the printers have paper.',
  'Hay {n} papeles sin imprimir: revisa que el computador de impresión esté prendido y las impresoras con papel.':
    '{n} tickets haven’t printed: check that the printing computer is on and the printers have paper.',
  'Ver impresoras': 'See printers',
  // Roles (ROLE_LABEL y ROLE_HINT de lib/permissions.ts). «Cocina» y «Barra» ya están arriba.
  Dueño: 'Owner',
  Administrador: 'Manager',
  Cajero: 'Cashier',
  Mesero: 'Server',
  Profesional: 'Professional',
  'Todo, incluidas las sedes y el equipo.': 'Everything, including locations and staff.',
  'Opera la sede: carta, plano, equipo, anulaciones y auditoría.': 'Runs the location: menu, floor plan, staff, voids and audit log.',
  'Mesas, pedidos y cierre de cuentas.': 'Tables, orders and closing checks.',
  'Abre mesas, toma pedidos y pide la cuenta.': 'Opens tables, takes orders and asks for the check.',
  'Pantalla de cocina.': 'Kitchen screen.',
  'Pantalla de barra.': 'Bar screen.',
  'Barbero, estilista, terapeuta…: ve su agenda y sus comisiones.': 'Barber, stylist, therapist…: sees their schedule and commissions.',

  // General
  'Algo salió mal. Intenta otra vez.': 'Something went wrong. Please try again.',
};
