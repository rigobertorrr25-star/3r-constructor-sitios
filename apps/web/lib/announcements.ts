// Comunicados: tipos y textos visibles.

export type AnnouncementKind = 'news' | 'notice' | 'event';
export const KIND_LABEL: Record<AnnouncementKind, string> = { news: 'Noticia', notice: 'Aviso', event: 'Evento' };
export const KIND_HUE: Record<AnnouncementKind, number> = { news: 275, notice: 60, event: 150 };

export type Announcement = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  excerpt: string;
  eventAt: string | null;
  eventPlace: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: string | null;
  read: boolean;
  readCount: number;
};

export type AnnouncementDetail = Omit<Announcement, 'excerpt' | 'read' | 'readCount'> & {
  body: string;
  can: { manage: boolean };
  readers?: { name: string; readAt: string }[];
  pending?: string[];
};

export type AnnouncementsSummary = {
  unread: number;
  latest: { id: string; title: string; kind: AnnouncementKind; createdAt: string } | null;
  upcoming: { id: string; title: string; eventAt: string; eventPlace: string | null }[];
};

export const eventDate = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});

/** ISO → valor de un <input type="datetime-local"> en hora de Colombia. */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'America/Bogota',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
