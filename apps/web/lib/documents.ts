// Documentos: tipos y textos visibles.

export const COMPANY_CATEGORIES = ['policy', 'manual', 'contract', 'certificate', 'other'] as const;
export const EMPLOYEE_CATEGORIES = ['contract', 'id', 'certificate', 'payroll', 'medical', 'resume', 'other'] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  policy: 'Política o reglamento',
  manual: 'Manual o proceso',
  contract: 'Contrato',
  certificate: 'Certificado',
  id: 'Documento de identidad',
  payroll: 'Nómina o desprendible',
  medical: 'Incapacidad o soporte médico',
  resume: 'Hoja de vida',
  other: 'Otro',
};

/** Tipos de archivo admitidos (iguales a los de la API). */
export const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'Imagen',
  'image/jpeg': 'Imagen',
  'image/webp': 'Imagen',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
};
export const ACCEPT = Object.keys(ACCEPTED_TYPES).join(',');
export const MAX_BYTES = 20 * 1024 * 1024;

export type CompanyDocument = {
  id: string;
  memberId: string | null;
  category: string;
  title: string;
  fileName: string;
  contentType: string;
  size: number;
  audience: 'all' | 'hr';
  expiresOn: string | null;
  uploadedBy: string | null;
  createdAt: string;
  can: { manage: boolean };
};

export type DocumentList = { owner: { id: string; name: string } | null; canUpload: boolean; documents: CompanyDocument[] };
export type DocumentFolder = { id: string; name: string; jobTitle: string | null; count: number; self: boolean };
export type DocumentsSummary = {
  company: number;
  mine: number;
  expiring: { id: string; title: string; expiresOn: string; expired: boolean; memberId: string | null; person: string | null }[];
};

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
