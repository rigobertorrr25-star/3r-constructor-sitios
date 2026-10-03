import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteCampaignAction } from '@/app/empresa/marketing-actions';
import { ArticleBody } from '@/components/article-body';
import { AutoRefresh } from '@/components/auto-refresh';
import { CampaignEditor } from '@/components/campaign-editor';
import { authedApi } from '@/lib/api';
import { canUseAiText } from '@/lib/companies';
import { STATUS_CLASS, STATUS_LABEL, people, type CampaignDetail, type MarketingOverview } from '@/lib/marketing';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Campaña — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export default async function CampaignPage({ params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) notFound();
  const res = await authedApi<CampaignDetail>(`/companies/${id}/marketing/campaigns/${campaignId}`);
  if (!res.ok) notFound();
  const c = res.data;
  const back = (
    <Link href={`/empresa/${id}/marketing`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
      ← Marketing
    </Link>
  );
  const remove = (
    <form action={deleteCampaignAction}>
      <input type="hidden" name="companyId" value={id} />
      <input type="hidden" name="campaignId" value={c.id} />
      <button type="submit" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]">
        Borrar campaña
      </button>
    </form>
  );

  if (c.status === 'draft') {
    const overview = await authedApi<MarketingOverview>(`/companies/${id}/marketing`);
    return (
      <div className="space-y-6">
        {back}
        <div className={card}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[22px] font-semibold text-foreground">{c.name}</h2>
            {remove}
          </div>
          <CampaignEditor
            companyId={id}
            companyName={company.name}
            tags={overview.ok ? overview.data.tags : []}
            campaign={c}
            canSend={c.canSend}
            remainingToday={c.remainingToday}
            ai={canUseAiText(company)}
          />
        </div>
      </div>
    );
  }

  const s = c.stats;
  const done = s.sent + s.failed + s.skipped;
  return (
    <div className="space-y-6">
      {back}
      {c.status === 'sending' ? <AutoRefresh /> : null}
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-semibold text-foreground">{c.name}</h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {c.sentAt ? `Enviada el ${when.format(new Date(c.sentAt))}` : `Saliendo: ${done} de ${people(c.recipientCount)}`}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
        </div>
        {c.status === 'sending' ? (
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={c.recipientCount}
            aria-valuenow={done}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${c.recipientCount ? Math.round((done / c.recipientCount) * 100) : 0}%` }}
            />
          </div>
        ) : null}
        <dl className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            { n: s.sent, label: 'Les llegó' },
            { n: s.failed, label: 'No se pudo mandar' },
            { n: s.skipped, label: 'Se dieron de baja antes' },
            { n: s.unsubscribed, label: 'Se dieron de baja con este correo' },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <dt className="text-[13px] text-muted-foreground">{x.label}</dt>
              <dd className="font-display text-[24px] font-bold text-foreground">{x.n}</dd>
            </div>
          ))}
        </dl>
      </div>
      <section className={card} aria-label="El correo que se mandó">
        <p className="text-[13px] text-muted-foreground">Asunto</p>
        <p className="font-display text-[18px] font-semibold text-foreground">{c.subject}</p>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <ArticleBody body={c.body} />
        </div>
      </section>
    </div>
  );
}
