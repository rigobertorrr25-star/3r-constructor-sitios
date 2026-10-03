import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { disableNewsletterAction, enableNewsletterAction } from '@/app/empresa/marketing-actions';
import { CopyLink } from '@/components/copy-link';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import { STATUS_CLASS, STATUS_LABEL, people, type MarketingOverview } from '@/lib/marketing';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Marketing — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export default async function MarketingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'marketing')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Marketing"
        text="Correos con promociones y novedades para tus clientes del CRM, por grupos, solo a quien aceptó recibirlos y con enlace para darse de baja."
      />
    );
  }
  if (!atLeast(company.me.role, 'supervisor')) {
    return <p className={`${card} text-[15px] text-muted-foreground`}>Las campañas las preparan los supervisores y administradores de la empresa.</p>;
  }
  const { data } = await authedApi<MarketingOverview>(`/companies/${id}/marketing`);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const base = `/empresa/${id}/marketing`;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Tu lista">
        {[
          { n: data.audience.eligible, label: 'aceptaron recibir promociones' },
          { n: data.audience.withEmail, label: 'contactos del CRM con correo' },
          { n: data.remainingToday, label: `correos que puedes mandar hoy (máximo ${data.dailyCap} al día)` },
        ].map((x) => (
          <div key={x.label} className={card}>
            <p className="font-display text-[28px] font-bold text-foreground">{x.n}</p>
            <p className="text-[13.5px] text-muted-foreground">{x.label}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`${base}/nueva`}
          className="inline-flex rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
        >
          + Nueva campaña
        </Link>
      </div>

      {data.campaigns.length === 0 ? (
        <section className={card}>
          <h2 className="font-display text-[19px] font-semibold text-foreground">Tu primera campaña</h2>
          <p className="mt-2 max-w-[65ch] text-[14.5px] text-muted-foreground">
            Escribe un correo con tu promoción o novedad, escoge a quién le llega (por ejemplo, solo clientes ganados o los marcados «vip» en el CRM),
            mándate una prueba y envíalo. Solo les llega a los contactos que aceptaron recibir promociones; cada correo trae un enlace para darse de
            baja.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {data.campaigns.map((c) => (
            <li key={c.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`${base}/${c.id}`} className="font-display text-[17px] font-semibold text-foreground hover:underline">
                    {c.name}
                  </Link>
                  <p className="mt-1 truncate text-[14px] text-foreground/85">{c.subject}</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {c.status === 'draft'
                      ? `Borrador · editado el ${when.format(new Date(c.updatedAt))}`
                      : `${c.sentAt ? `Enviada el ${when.format(new Date(c.sentAt))}` : 'Saliendo'} · ${c.stats.sent} de ${people(c.recipientCount)}${c.stats.unsubscribed ? ` · ${c.stats.unsubscribed} se dieron de baja` : ''}`}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.canSend ? (
        <aside className={card} aria-labelledby="h-suscribirse">
          <h2 id="h-suscribirse" className="font-display text-[18px] font-semibold text-foreground">
            Enlace para que se suscriban
          </h2>
          <p className="mt-2 max-w-[65ch] text-[14px] text-muted-foreground">
            Una página donde tus clientes dejan su nombre y correo y aceptan recibir tus promociones. Quedan en el CRM, listos para tus campañas.
            Ponla en Instagram, en tu página web o mándala por WhatsApp.
          </p>
          <div className="mt-4">
            {data.newsletterToken ? (
              <div className="space-y-4">
                <CopyLink url={`${origin}/suscribirse/${data.newsletterToken}`} message={`Recibe las promociones de ${company.name}:`} />
                <form action={disableNewsletterAction}>
                  <input type="hidden" name="companyId" value={id} />
                  <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                    Apagar el enlace
                  </button>
                </form>
              </div>
            ) : (
              <form action={enableNewsletterAction}>
                <input type="hidden" name="companyId" value={id} />
                <button type="submit" className="rounded-full border border-primary/50 px-4 py-2 text-[13.5px] text-foreground hover:bg-primary/10">
                  Crear el enlace
                </button>
              </form>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
