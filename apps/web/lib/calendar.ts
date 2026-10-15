// Calendario: tipos, colores y fechas.

export type CalendarItem = {
  id: string;
  source: 'event' | 'leave' | 'birthday' | 'announcement' | 'document' | 'contract';
  kind: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  href?: string;
  can?: { edit: boolean };
};

export const KIND_LABEL: Record<string, string> = {
  meeting: 'Reunión',
  event: 'Evento',
  reminder: 'Recordatorio',
  deadline: 'Fecha límite',
  vacation: 'Vacaciones',
  permission: 'Permiso',
  sick_leave: 'Incapacidad',
  birthday: 'Cumpleaños',
};
/** Tono de cada tipo (oklch hue). */
export const KIND_HUE: Record<string, number> = {
  meeting: 275,
  event: 150,
  reminder: 200,
  deadline: 60,
  vacation: 170,
  permission: 220,
  sick_leave: 20,
  birthday: 330,
};

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const monthTitle = (y: number, m: number) => `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} de ${y}`;

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Días que muestra la cuadrícula del mes: desde el lunes de la primera semana hasta el domingo de la última. */
export function monthGrid(y: number, m: number) {
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const last = new Date(Date.UTC(y, m, 0));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)));
  const days: string[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(iso(d));
  return { days, from: days[0], to: days[days.length - 1], first: iso(first), last: iso(last) };
}

/** Día (AAAA-MM-DD, hora de Colombia) de un inicio o fin. */
export const dayOf = (value: string, allDay: boolean) =>
  allDay ? value.slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(value));

export const timeOf = (value: string) =>
  new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(value));

/** ¿El ítem cae en ese día? (los de varios días, en cada uno). */
export const onDay = (item: CalendarItem, dayIso: string) => {
  const s = dayOf(item.start, item.allDay);
  const e = item.end ? dayOf(item.end, item.allDay) : s;
  return dayIso >= s && dayIso <= e;
};
