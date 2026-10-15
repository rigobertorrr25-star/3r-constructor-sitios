// Generador de documentos: tipos y textos visibles.

export type GeneratorTemplate = 'employment_certificate' | 'vacation_record' | 'custom_letter';

export const TEMPLATES: { key: GeneratorTemplate; name: string; text: string }[] = [
  {
    key: 'employment_certificate',
    name: 'Certificado laboral',
    text: 'Cargo, fecha de ingreso, tipo de contrato y, si quieres, el salario en letras y números.',
  },
  { key: 'vacation_record', name: 'Constancia de vacaciones', text: 'Fechas y días de unas vacaciones ya aprobadas en Permisos y vacaciones.' },
  { key: 'custom_letter', name: 'Carta', text: 'Escribe tu propio texto y usa campos que se llenan solos.' },
];

export const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'documento', label: 'Documento' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'area', label: 'Área' },
  { key: 'fecha_ingreso', label: 'Fecha de ingreso' },
  { key: 'salario', label: 'Salario' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'nit', label: 'NIT' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'fecha', label: 'Fecha de hoy' },
];

export type GeneratorPerson = {
  id: string;
  name: string;
  jobTitle: string | null;
  missing: string[];
  hasSalary: boolean;
  vacations: { id: string; startDate: string | null; endDate: string | null; days: number }[];
};

export type GeneratorPeople = { company: { missing: string[] }; signer: { name: string; title: string }; people: GeneratorPerson[] };
