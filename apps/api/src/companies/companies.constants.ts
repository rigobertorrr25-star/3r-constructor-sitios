// Plataforma empresarial: roles dentro de una empresa y catálogo de módulos que cada empresa puede activar.

/** De mayor a menor. Cada rol puede todo lo del rol de abajo. */
export const COMPANY_ROLES = ['owner', 'admin', 'hr', 'supervisor', 'employee'] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

const RANK: Record<CompanyRole, number> = { owner: 50, admin: 40, hr: 30, supervisor: 20, employee: 10 };

export const roleRank = (role: string) => RANK[role as CompanyRole] ?? 0;
export const atLeast = (role: string, min: CompanyRole) => roleRank(role) >= RANK[min];

/** Roles que se pueden dar al invitar o editar a alguien (el dueño solo existe al crear la empresa). */
export const ASSIGNABLE_ROLES = ['admin', 'hr', 'supervisor', 'employee'] as const;

export const MEMBER_STATUSES = ['active', 'disabled'] as const;
export const COMPANY_STATUSES = ['active', 'suspended'] as const;

/** Empresas que una misma persona puede crear (evita abusos). */
export const MAX_OWNED_COMPANIES = 5;
/** Una invitación sirve 7 días. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ModuleArea = 'web' | 'empresa' | 'clientes' | 'automatizacion' | 'ia';

export interface ModuleInfo {
  key: string;
  area: ModuleArea;
  /** false = todavía no está construido: se muestra como "muy pronto" y no se puede activar. */
  ready: boolean;
}

/**
 * Catálogo de módulos. Los nombres y descripciones visibles viven en la web (lib/modules.ts); aquí solo la clave,
 * el área y si ya está construido. Para lanzar un módulo: construirlo y poner `ready: true`.
 */
export const MODULES: ModuleInfo[] = [
  { key: 'web', area: 'web', ready: true },
  { key: 'store', area: 'web', ready: true },
  { key: 'analytics', area: 'web', ready: true },
  { key: 'seo', area: 'web', ready: true },
  { key: 'employees', area: 'empresa', ready: true },
  { key: 'requests', area: 'empresa', ready: true },
  { key: 'announcements', area: 'empresa', ready: true },
  { key: 'documents', area: 'empresa', ready: true },
  { key: 'doc_generator', area: 'empresa', ready: true },
  { key: 'tickets', area: 'empresa', ready: true },
  { key: 'calendar', area: 'empresa', ready: true },
  { key: 'surveys', area: 'empresa', ready: true },
  { key: 'training', area: 'empresa', ready: true },
  { key: 'knowledge', area: 'empresa', ready: true },
  { key: 'inventory', area: 'empresa', ready: true },
  { key: 'crm', area: 'clientes', ready: true },
  { key: 'quotes', area: 'clientes', ready: true },
  { key: 'marketing', area: 'clientes', ready: true },
  { key: 'whatsapp', area: 'clientes', ready: false },
  { key: 'alerts', area: 'automatizacion', ready: true },
  { key: 'automations', area: 'automatizacion', ready: true },
  { key: 'ai_assistant', area: 'ia', ready: true },
  { key: 'ai_content', area: 'ia', ready: false },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
export const isReadyModule = (key: string) => MODULES.some((m) => m.key === key && m.ready);
