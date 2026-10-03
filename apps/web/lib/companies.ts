// Plataforma empresarial: tipos y textos visibles de empresas, roles y módulos (la API guarda solo las claves).

export type CompanyRole = 'owner' | 'admin' | 'hr' | 'supervisor' | 'employee';
export type ModuleArea = 'web' | 'empresa' | 'clientes' | 'automatizacion' | 'ia';

export type CompanyModuleState = { key: string; area: ModuleArea; ready: boolean; enabled: boolean; enabledAt: string | null };

export type CompanySummary = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  industry: string | null;
  status: 'active' | 'suspended';
  role: CompanyRole;
  memberCount: number;
  moduleCount: number;
};

export type CompanyDetail = {
  id: string;
  name: string;
  slug: string;
  taxId: string | null;
  city: string | null;
  phone: string | null;
  industry: string | null;
  status: 'active' | 'suspended';
  createdAt: string;
  memberCount: number;
  me: { memberId: string; role: CompanyRole };
  modules: CompanyModuleState[];
};

export type CompanyMember = {
  id: string;
  role: CompanyRole;
  jobTitle: string | null;
  area: string | null;
  hiredAt: string | null;
  status: 'active' | 'disabled';
  createdAt: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
};

export type CompanyInvite = { id: string; email: string; role: CompanyRole; expiresAt: string; createdAt: string };

export type InvitePreview = { companyName: string; email: string; role: CompanyRole; expired: boolean; accepted: boolean };

export type AdminCompany = {
  id: string;
  name: string;
  city: string | null;
  industry: string | null;
  status: 'active' | 'suspended';
  createdAt: string;
  memberCount: number;
  modules: string[];
  owner: { email: string; firstName: string | null } | null;
  catalog?: { key: string; area: ModuleArea; ready: boolean }[];
};

export const ROLE_LABEL: Record<CompanyRole, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  hr: 'Recursos humanos',
  supervisor: 'Supervisor',
  employee: 'Empleado',
};

const RANK: Record<CompanyRole, number> = { owner: 50, admin: 40, hr: 30, supervisor: 20, employee: 10 };
export const atLeast = (role: CompanyRole, min: CompanyRole) => RANK[role] >= RANK[min];
/** Roles que `actor` puede dar (siempre menores al suyo; el dueño puede dar administrador). */
export const assignableBy = (actor: CompanyRole): CompanyRole[] =>
  (['admin', 'hr', 'supervisor', 'employee'] as CompanyRole[]).filter((r) => actor === 'owner' || RANK[r] < RANK[actor]);
export const outranks = (actor: CompanyRole, target: CompanyRole) => actor === 'owner' || RANK[actor] > RANK[target];

/** Ruta dentro de /empresa/[id] de cada módulo ya construido. */
export const MODULE_ROUTE: Record<string, string> = { crm: 'crm', tickets: 'tickets', employees: 'personal', requests: 'solicitudes', announcements: 'comunicados', documents: 'documentos', doc_generator: 'generador', calendar: 'calendario', alerts: 'alertas', quotes: 'cotizaciones', surveys: 'encuestas', training: 'capacitaciones', knowledge: 'conocimiento', inventory: 'inventario' };

export const AREA_LABEL: Record<ModuleArea, string> = {
  web: 'Web',
  empresa: 'Empresa',
  clientes: 'Clientes y ventas',
  automatizacion: 'Automatización',
  ia: 'Inteligencia artificial',
};

export const MODULE_INFO: Record<string, { name: string; text: string }> = {
  web: { name: 'Página web', text: 'Edita tu página tú mismo: textos, fotos y secciones, con plantillas por tipo de negocio.' },
  store: { name: 'Tienda en línea', text: 'Catálogo, carrito, cupones, pagos y envíos. También compra por WhatsApp.' },
  analytics: { name: 'Analítica web', text: 'Cuántas personas visitan tu página, desde dónde y qué miran.' },
  seo: { name: 'SEO', text: 'Revisa qué le falta a tu página para salir mejor en Google.' },
  employees: { name: 'Portal del empleado', text: 'Perfil de cada empleado: cargo, área, fecha de ingreso y contacto.' },
  requests: { name: 'Permisos y vacaciones', text: 'El empleado pide, el supervisor aprueba y RR. HH. confirma.' },
  announcements: { name: 'Comunicados', text: 'Noticias, anuncios y eventos para todo el equipo.' },
  documents: { name: 'Documentos', text: 'Documentos de la empresa y de cada empleado, en un solo lugar.' },
  doc_generator: { name: 'Generador de documentos', text: 'Certificados laborales, cartas y constancias con los datos ya llenos.' },
  tickets: { name: 'Tickets', text: 'Solicitudes de soporte, mantenimiento o compras con número y estado.' },
  calendar: { name: 'Calendario', text: 'Reuniones, vacaciones, cumpleaños, eventos y vencimientos.' },
  surveys: { name: 'Encuestas', text: 'Satisfacción de clientes y clima laboral, con resultados.' },
  training: { name: 'Capacitaciones', text: 'Cursos con video, material, quiz, progreso y certificado.' },
  knowledge: { name: 'Centro de conocimiento', text: 'Manuales, políticas y procesos internos.' },
  inventory: { name: 'Inventario', text: 'Productos, equipos y herramientas, y a quién están asignados.' },
  crm: { name: 'CRM', text: 'Tus clientes y el embudo de ventas: nuevo, contactado, cotización, negociación y ganado.' },
  quotes: { name: 'Cotizaciones', text: 'Envía una cotización con enlace para aceptar, rechazar o pedir cambios.' },
  marketing: { name: 'Marketing', text: 'Correos, campañas y segmentos de clientes.' },
  whatsapp: { name: 'WhatsApp empresarial', text: 'Todas las conversaciones de la empresa en una bandeja, con respuestas rápidas.' },
  alerts: { name: 'Alertas', text: 'Avisos de vencimientos, solicitudes sin responder y documentos faltantes.' },
  automations: { name: 'Automatizaciones', text: 'Si pasa algo, la plataforma hace lo siguiente por ti.' },
  ai_assistant: { name: 'Asistente con IA', text: 'Responde preguntas con los manuales y documentos de tu empresa.' },
  ai_content: { name: 'Textos con IA', text: 'Textos para tu página, productos, publicaciones y correos.' },
};
