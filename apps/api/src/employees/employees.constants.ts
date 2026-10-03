export const DOCUMENT_TYPES = ['CC', 'CE', 'PPT', 'PA', 'TI'] as const;
export const CONTRACT_TYPES = ['indefinite', 'fixed', 'project', 'services', 'apprentice'] as const;

/** Datos que llena el empleado (o RR. HH.). */
export const PERSONAL_FIELDS = [
  'documentType',
  'documentNumber',
  'phone',
  'showPhone',
  'birthDate',
  'address',
  'city',
  'emergencyName',
  'emergencyPhone',
  'emergencyRelation',
  'eps',
  'pensionFund',
] as const;
/** Datos del contrato: solo RR. HH. en adelante, y nunca los propios (salvo el dueño). */
export const WORK_FIELDS = ['contractType', 'contractEnd', 'salary', 'schedule', 'hrNotes'] as const;

/** Clave del módulo en el catálogo de la plataforma. */
export const EMPLOYEES_MODULE = 'employees';
