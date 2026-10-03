import type { Metadata } from 'next';
import Link from 'next/link';
import { NewAnnouncementPanel } from '@/components/announcement-forms';
import { ModuleOff } from '@/components/module-off';
import { KIND_HUE, KIND_LABEL, eventDate, type Announcement, type AnnouncementsSummary } from '@/lib/announcements';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Comunicados — 3R' };

const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });

export default async function AnnouncementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'announcements')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Comunicados"
        text="Noticias, avisos y eventos para todo el equipo en un solo lugar, con aviso por correo y quién ya lo leyó."
      />
    );
  }
  const manage = atLeast(company.me.role, 'hr');
  const [{ data: items }, { data: summary }] = await Promise.all([
    authedApi<Announcement[]>(`/companies/${id}/announcements`),
    authedApi<AnnouncementsSummary>(`/companies/${id}/announcements/summary`),
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] border border-white/[0.08] bg-card p-5">
          <p className="text-[13px] text-muted-foreground">Sin leer</p>
          <p className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{summary.unread}</p>
        </div>
        <div className="rounded-[24px] border border-white/[0.08] bg-card p-5">
          <p className="text-[13px] text-muted-foreground">Próximo evento</p>
          {summary.upcoming[0] ? (
            <Link href={`/empresa/${id}/comunicados/${summary.upcoming[0].id}`} className="mt-1 block hover:underline">
              <span className="block font-display text-[18px] font-semibold text-foreground">{summary.upcoming[0].title}</span>
              <span className="block text-[13.5px] text-muted-foreground first-letter:uppercase">
                {eventDate.format(new Date(summary.upcoming[0].eventAt))}
              </span>
            </Link>
          ) : (
            <p className="mt-1 text-[15px] text-muted-foreground">No hay eventos próximos.</p>
          )}
        </div>
      </div>

      {manage ? <NewAnnouncementPanel companyId={id} /> : null}

      {items.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {manage ? 'Todavía no hay comunicados. Publica el primero con «Nuevo comunicado».' : 'Todavía no hay comunicados.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/empresa/${id}/comunicados/${a.id}`}
                className={`block rounded-[24px] border bg-card p-5 transition hover:border-white/[0.16] focus-visible:outline-2 focus-visible:outline-[var(--ring)] ${a.read ? 'border-white/[0.08]' : 'border-primary/40'}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `oklch(0.75 0.15 ${KIND_HUE[a.kind]} / 0.15)`, color: `oklch(0.85 0.1 ${KIND_HUE[a.kind]})` }}
                  >
                    {KIND_LABEL[a.kind]}
                  </span>
                  {a.pinned ? <span className="rounded-full border border-white/[0.12] px-2.5 py-1 text-foreground">Fijado</span> : null}
                  {!a.read ? <span className="rounded-full bg-primary px-2.5 py-1 font-medium text-primary-foreground">Nuevo</span> : null}
                  <span className="text-muted-foreground">
                    {[a.author, when.format(new Date(a.createdAt))].filter(Boolean).join(' · ')}
                    {manage ? ` · leído por ${a.readCount}` : ''}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-[19px] font-semibold text-foreground">{a.title}</h2>
                {a.kind === 'event' && a.eventAt ? (
                  <p className="mt-1 text-[14px] text-foreground/90 first-letter:uppercase">
                    {eventDate.format(new Date(a.eventAt))}
                    {a.eventPlace ? ` · ${a.eventPlace}` : ''}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-[14.5px] leading-relaxed text-muted-foreground">{a.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
