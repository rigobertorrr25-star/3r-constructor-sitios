export const REQUEST_TYPES = ['vacation', 'permission', 'sick_leave', 'certificate', 'other'] as const;
export const REQUEST_STATUSES = ['pending', 'supervisor_ok', 'approved', 'rejected', 'cancelled'] as const;
/** Abiertas: todavía alguien tiene que decidir. */
export const OPEN_STATUSES = ['pending', 'supervisor_ok'];
/** Tipos que sacan a la persona del trabajo (cuentan como ausencia). */
export const ABSENCE_TYPES = ['vacation', 'permission', 'sick_leave'];
/** Un certificado no necesita al supervisor: va directo a RR. HH. */
export const HR_ONLY_TYPES = ['certificate'];
export const MAX_RANGE_DAYS = 180;

export const TYPE_LABEL: Record<string, string> = {
  vacation: 'Vacaciones',
  permission: 'Permiso',
  sick_leave: 'Incapacidad',
  certificate: 'Certificado laboral',
  other: 'Otra solicitud',
};
export const STATUS_LABEL: Record<string, string> = {
  pending: 'Espera al supervisor',
  supervisor_ok: 'Espera a RR. HH.',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

/** Clave del módulo en el catálogo de la plataforma. */
export const REQUESTS_MODULE = 'requests';
