/** Intentos seguidos con un código equivocado antes de bloquear la tarjeta un rato. */
export const PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 10;
/** Cuánto dura la sesión del dueño en su panel. */
export const OWNER_SESSION_TTL = '12h';
/** Colombia no tiene horario de verano: "hoy" para el panel es UTC-5 todo el año. */
export const BUSINESS_UTC_OFFSET_HOURS = -5;

export interface Reward {
  at: number;
  label: string;
}

/** Deja el celular solo en dígitos y con indicativo de Colombia si no lo trae. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const withCountry = digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
  return /^\d{10,15}$/.test(withCountry) ? withCountry : null;
}

/** Para mostrarle al cliente su propio número sin exponerlo entero en pantalla. */
export const maskPhone = (phone: string) => `••• ${phone.slice(-4)}`;
