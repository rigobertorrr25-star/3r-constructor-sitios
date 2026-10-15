// Permisos y vacaciones: tipos y textos visibles.
import type { CompanyRole } from './companies';

export type RequestType = 'vacation' | 'permission' | 'sick_leave' | 'certificate' | 'other';
export type RequestStatus = 'pending' | 'supervisor_ok' | 'approved' | 'rejected' | 'cancelled';

export const TYPE_LABEL: Record<RequestType, string> = {
  vacation: 'Vacaciones',
  permission: 'Permiso',
  sick_leave: 'Incapacidad',
  certificate: 'Certificado laboral',
  other: 'Otra solicitud',
};
export const TYPE_HINT: Record<RequestType, string> = {
  vacation: 'Los días se cuentan sin domingos.',
  permission: 'Para una cita, una diligencia o un asunto personal. Si es por horas, cuéntalo en el motivo.',
  sick_leave: 'Pon las fechas de la incapacidad y entrega el soporte médico a RR. HH.',
  certificate: 'Va directo a RR. HH. Cuenta para qué lo necesitas (banco, arriendo, visa…).',
  other: 'Cambio de turno, trabajo en casa o cualquier otra cosa.',
};
/** Tono de cada tipo (oklch hue). */
export const TYPE_HUE: Record<RequestType, number> = { vacation: 150, permission: 200, sick_leave: 20, certificate: 275, other: 88 };

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Espera al supervisor',
  supervisor_ok: 'Espera a RR. HH.',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

export type LeaveRequest = {
  id: string;
  type: RequestType;
  startDate: string | null;
  endDate: string | null;
  days: number;
  reason: string;
  status: RequestStatus;
  supervisorAt: string | null;
  supervisorNote: string | null;
  hrAt: string | null;
  hrNote: string | null;
  createdAt: string;
  updatedAt: string;
  member: { id: string; role: CompanyRole; jobTitle: string | null; name: string };
  can: { decide: boolean; cancel: boolean };
};
export type LeaveRequestDetail = LeaveRequest & { supervisorBy: string | null; hrBy: string | null };

export type RequestsSummary = {
  toDecide: number;
  myOpen: number;
  myVacationDaysThisYear: number;
  absentToday: { name: string; type: RequestType; until: string | null }[];
};

const fmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const short = (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));
/** "2 nov" o "2 nov al 15 nov · 12 días". */
export const rangeText = (r: Pick<LeaveRequest, 'startDate' | 'endDate' | 'days'>) => {
  if (!r.startDate) return '';
  const range = r.endDate && r.endDate !== r.startDate ? `${short(r.startDate)} al ${short(r.endDate)}` : short(r.startDate);
  return r.days > 1 ? `${range} · ${r.days} días` : range;
};
