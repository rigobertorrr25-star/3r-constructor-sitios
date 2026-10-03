// Portal del empleado: tipos y textos visibles.
import type { CompanyRole } from './companies';

export const DOCUMENT_LABEL: Record<string, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  PPT: 'Permiso por protección temporal',
  PA: 'Pasaporte',
  TI: 'Tarjeta de identidad',
};

export const CONTRACT_LABEL: Record<string, string> = {
  indefinite: 'Término indefinido',
  fixed: 'Término fijo',
  project: 'Obra o labor',
  services: 'Prestación de servicios',
  apprentice: 'Aprendizaje (SENA)',
};

type Person = { id: string; email: string; firstName: string | null; lastName: string | null };

export type DirectoryEntry = {
  id: string;
  role: CompanyRole;
  jobTitle: string | null;
  area: string | null;
  hiredAt: string | null;
  user: Person;
  /** "MM-DD" */
  birthday: string | null;
  phone: string | null;
  canView: boolean;
};

export type EmployeeProfile = {
  id: string;
  role: CompanyRole;
  status: 'active' | 'disabled';
  jobTitle: string | null;
  area: string | null;
  hiredAt: string | null;
  user: Person;
  personal: {
    documentType: string | null;
    documentNumber: string | null;
    phone: string | null;
    showPhone: boolean;
    birthDate: string | null;
    address: string | null;
    city: string | null;
    emergencyName: string | null;
    emergencyPhone: string | null;
    emergencyRelation: string | null;
    eps: string | null;
    pensionFund: string | null;
  };
  work: { contractType: string | null; contractEnd: string | null; salary: number | null; schedule: string | null; hrNotes?: string | null };
  updatedAt: string | null;
  can: { personal: boolean; work: boolean };
};

export type EmployeesSummary = { people: number; birthdaysThisMonth: number; incompleteProfiles?: number; contractsEnding?: number };

export const personName = (u: Person) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "10-20" → "20 de octubre". */
export const birthdayText = (mmdd: string) => `${Number(mmdd.slice(3))} de ${MONTHS[Number(mmdd.slice(0, 2)) - 1]}`;
/** "2026-10-20" → "20 de octubre de 2026". */
export const dateText = (iso: string) => `${birthdayText(iso.slice(5))} de ${iso.slice(0, 4)}`;
export const monthName = (month: number) => MONTHS[month - 1];

/** Mes y día de hoy en Colombia. */
export const todayBogota = () => {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  return { iso, month: Number(iso.slice(5, 7)), mmdd: iso.slice(5) };
};
