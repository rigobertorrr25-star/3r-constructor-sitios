import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { CopyLink } from '@/components/copy-link';
import { StoreSettingsForm } from '@/components/store-forms';
import { StoreTabs } from '@/components/store-tabs';
import { authedApi } from '@/lib/api';
import type { SettingsResponse } from '@/lib/store';
import { loadCompany } from '../../company';
import { storeGate } from '../store-gate';

export const metadata: Metadata = { title: 'Ajustes de la tienda — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

export default async function StoreSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const gate = storeGate(company);
  if (gate) return gate;
  const { data } = await authedApi<SettingsResponse>(`/companies/${id}/store/settings`);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const s = data.settings;

  return (
    <div className="space-y-6">
      <StoreTabs companyId={id} active="/ajustes" />
      <div className={`grid gap-6 ${s ? 'lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start' : ''}`}>
        <section className={card} aria-label="Ajustes">
          {data.canEdit ? (
            <StoreSettingsForm companyId={id} settings={s} suggestedSlug={data.suggestedSlug} origin={origin} />
          ) : (
            <p className="text-[15px] text-muted-foreground">Los ajustes de la tienda los cambian los administradores de la empresa.</p>
          )}
        </section>
        {s ? (
          <aside className={card} aria-labelledby="h-enlace">
            <h2 id="h-enlace" className="mb-3 font-display text-[18px] font-semibold text-foreground">
              Tu tienda
            </h2>
            <CopyLink url={`${origin}/tienda/${s.slug}`} message={`Haz tu pedido en ${s.name}:`} />
            <a
              href={`/tienda/${s.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[13.5px] text-foreground underline-offset-2 hover:underline"
            >
              Abrir la tienda →
            </a>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
