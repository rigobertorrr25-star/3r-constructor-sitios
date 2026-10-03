import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteAnnouncementAction } from '@/app/empresa/announcements-actions';
import { AnnouncementForm } from '@/components/announcement-forms';
import { KIND_LABEL, eventDate, type AnnouncementDetail } from '@/lib/announcements';
import { authedApi } from '@/lib/api';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Comunicado — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string; announcementId: string }> }) {
  const { id, announcementId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(announcementId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<AnnouncementDetail>(`/companies/${id}/announcements/${announcementId}`);
  if (res.status === 404 || res.status === 403) notFound();
  const a = res.data;

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/comunicados`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Comunicados
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <article className={card}>
          <p className="text-[13px] text-muted-foreground">
            {KIND_LABEL[a.kind]} · {[a.author, when.format(new Date(a.createdAt))].filter(Boolean).join(' · ')}
          </p>
          <h2 className="mt-2 font-display text-[26px] font-bold tracking-tight text-foreground">{a.title}</h2>
          {a.kind === 'event' && a.eventAt ? (
            <div className="mt-4 rounded-2xl border border-[#5ee0a0]/25 bg-[#5ee0a0]/[0.06] p-4">
              <p className="text-[15px] font-medium text-foreground first-letter:uppercase">{eventDate.format(new Date(a.eventAt))}</p>
              {a.eventPlace ? <p className="text-[14px] text-muted-foreground">{a.eventPlace}</p> : null}
            </div>
          ) : null}
          <div className="mt-5 whitespace-pre-wrap text-[15.5px] leading-relaxed text-foreground/90">{a.body}</div>
        </article>

        {a.can.manage ? (
          <aside className="space-y-6">
            <section className={card} aria-labelledby="h-lecturas">
              <h3 id="h-lecturas" className="font-display text-[18px] font-semibold text-foreground">
                Lo leyeron {a.readers?.length ?? 0} de {(a.readers?.length ?? 0) + (a.pending?.length ?? 0)}
              </h3>
              {a.pending && a.pending.length > 0 ? (
                <>
                  <p className="mt-4 text-[13px] text-muted-foreground">Todavía no lo abren</p>
                  <ul className="mt-2 space-y-1.5 text-[14px] text-foreground">
                    {a.pending.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-[14px] text-muted-foreground">Todo el equipo ya lo leyó.</p>
              )}
            </section>
            <details className={card}>
              <summary className="cursor-pointer font-display text-[17px] font-semibold text-foreground">Editar</summary>
              <div className="mt-5">
                <AnnouncementForm companyId={id} announcement={a} />
              </div>
            </details>
            <form action={deleteAnnouncementAction}>
              <input type="hidden" name="companyId" value={id} />
              <input type="hidden" name="announcementId" value={a.id} />
              <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                Borrar este comunicado
              </button>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
