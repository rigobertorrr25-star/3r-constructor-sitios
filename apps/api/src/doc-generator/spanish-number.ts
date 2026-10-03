const UNITS = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const TWENTIES = ['veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function upTo999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [HUNDREDS[h]];
  if (rest < 10) parts.push(UNITS[rest]);
  else if (rest < 20) parts.push(TEENS[rest - 10]);
  else if (rest < 30) parts.push(TWENTIES[rest - 20]);
  else parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? ` y ${UNITS[rest % 10]}` : ''));
  return parts.filter(Boolean).join(' ');
}

/** 1600000 → "un millón seiscientos mil". Hasta 999.999.999.999. */
export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'cero';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const units = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? 'un millón' : `${numberToWords(millions)} millones`);
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${upTo999(thousands)} mil`);
  if (units) parts.push(upTo999(units));
  return parts.join(' ');
}

/** 1600000 → "un millón seiscientos mil pesos ($1.600.000)". "de pesos" tras millones exactos, como se escribe. */
export function pesosText(value: number): string {
  const words = numberToWords(value);
  const exactMillions = value >= 1_000_000 && value % 1_000_000 === 0;
  return `${words}${exactMillions ? ' de' : ''} pesos ($${new Intl.NumberFormat('es-CO').format(value)})`;
}
