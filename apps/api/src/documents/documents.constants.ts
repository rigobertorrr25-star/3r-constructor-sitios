export const COMPANY_CATEGORIES = ['policy', 'manual', 'contract', 'certificate', 'other'] as const;
export const EMPLOYEE_CATEGORIES = ['contract', 'id', 'certificate', 'payroll', 'medical', 'resume', 'other'] as const;
export const DOCUMENT_CATEGORIES = [...new Set([...COMPANY_CATEGORIES, ...EMPLOYEE_CATEGORIES])];
export const AUDIENCES = ['all', 'hr'] as const;
/** Clave del módulo en el catálogo de la plataforma. */
export const DOCUMENTS_MODULE = 'documents';
