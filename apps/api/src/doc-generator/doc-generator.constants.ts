export const TEMPLATES = ['employment_certificate', 'vacation_record', 'custom_letter'] as const;
export const TEMPLATE_LABEL: Record<string, string> = {
  employment_certificate: 'Certificado laboral',
  vacation_record: 'Constancia de vacaciones',
  custom_letter: 'Carta',
};
export const DOCUMENT_LABEL: Record<string, string> = {
  CC: 'cédula de ciudadanía',
  CE: 'cédula de extranjería',
  PPT: 'permiso por protección temporal',
  PA: 'pasaporte',
  TI: 'tarjeta de identidad',
};
export const CONTRACT_PHRASE: Record<string, string> = {
  indefinite: 'con contrato a término indefinido',
  fixed: 'con contrato a término fijo',
  project: 'con contrato por obra o labor',
  services: 'mediante contrato de prestación de servicios',
  apprentice: 'con contrato de aprendizaje',
};
/** Campos que se pueden usar en una carta libre: {nombre}, {cargo}… */
export const PLACEHOLDERS = ['nombre', 'documento', 'cargo', 'area', 'fecha_ingreso', 'empresa', 'nit', 'ciudad', 'salario', 'fecha'] as const;
/** Clave del módulo en el catálogo de la plataforma. */
export const DOC_GENERATOR_MODULE = 'doc_generator';
