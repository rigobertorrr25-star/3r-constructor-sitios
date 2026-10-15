import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assetStatusAction, deleteAssetAction } from '@/app/empresa/inventory-actions';
import { AssetForm, AssignForm } from '@/components/inventory-forms';
import { authedApi } from '@/lib/api';
import type { CompanyMember } from '@/lib/companies';
import { formatMoney } from '@/lib/orders';
import { ASSET_STATUS_LABEL, EVENT_LABEL, type AssetDetail } from '@/lib/inventory';
import { loadCompany } from '../../../company';

export const metadata: Metadata = { title: 'Equipo — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
const ghost = 'rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]';
const memberName = (m: CompanyMember) => [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email;

export default async function AssetPage({ params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<AssetDetail>(`/companies/${id}/inventory/assets/${assetId}`);
  if (!res.ok) notFound();
  const a = res.data;
  const members = a.manage ? ((await authedApi<CompanyMember[]>(`/companies/${id}/members`)).data ?? []) : [];
  const options = members.filter((m) => m.status === 'active').map((m) => ({ id: m.id, name: memberName(m) }));
  const status = (value: string, label: string) => (
    <form action={assetStatusAction}>
      <input type="hidden" name="companyId" value={id} />
      <input type="hidden" name="assetId" value={a.id} />
      <input type="hidden" name="status" value={value} />
      <button type="submit" className={ghost}>
        {label}
      </button>
    </form>
  );

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/inventario/activos`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Equipos
      </Link>
      <div>
        <p className="text-[14px] text-muted-foreground">
          {[a.category, a.code, a.serial ? `serial ${a.serial}` : null].filter(Boolean).join(' · ') || 'Equipo'} · {ASSET_STATUS_LABEL[a.status]}
        </p>
        <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{a.name}</h2>
        {a.assignedTo ? (
          <p className="mt-1 text-[15px] text-foreground/90">
            Lo tiene {a.assignedTo}
            {a.assignedAt ? <span className="text-muted-foreground"> desde el {when.format(new Date(a.assignedAt))}</span> : null}
          </p>
        ) : null}
        {a.value != null || a.purchasedAt ? (
          <p className="mt-1 text-[13px] text-muted-foreground">
            {[
              a.value != null ? `Valor ${formatMoney(a.value * 100, 'COP')}` : null,
              a.purchasedAt ? `comprado el ${when.format(new Date(`${a.purchasedAt.slice(0, 10)}T12:00:00Z`))}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
        {a.notes ? <p className="mt-3 max-w-2xl whitespace-pre-wrap text-[14.5px] text-foreground/85">{a.notes}</p> : null}
      </div>

      <div className={`grid gap-6 ${a.manage ? 'lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start' : ''}`}>
        <section className={card} aria-labelledby="h-historial">
          <h3 id="h-historial" className="mb-3 font-display text-[18px] font-semibold text-foreground">
            Historial
          </h3>
          <ul className="divide-y divide-white/[0.06]">
            {a.events.map((e) => (
              <li key={e.id} className="py-3">
                <span className="block text-[14.5px] text-foreground">
                  {EVENT_LABEL[e.kind]}
                  {e.person ? ` ${e.person}` : ''}
                  {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                </span>
                <span className="block text-[12.5px] text-muted-foreground">
                  {[when.format(new Date(e.createdAt)), e.by ? `registró ${e.by}` : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {a.manage ? (
          <aside className="space-y-6">
            {a.status !== 'retired' ? (
              <section className={card} aria-labelledby="h-entregar">
                <h3 id="h-entregar" className="mb-4 font-display text-[18px] font-semibold text-foreground">
                  Entregar
                </h3>
                <AssignForm companyId={id} asset={a} members={options} />
              </section>
            ) : null}
            <section className={card} aria-labelledby="h-estado">
              <h3 id="h-estado" className="mb-4 font-display text-[18px] font-semibold text-foreground">
                Cambiar estado
              </h3>
              <div className="flex flex-wrap gap-2">
                {a.status === 'assigned' ? status('available', 'Lo devolvió') : null}
                {a.status !== 'available' && a.status !== 'assigned' ? status('available', 'Disponible de nuevo') : null}
                {a.status !== 'repair' ? status('repair', 'A reparación') : null}
                {a.status !== 'retired' ? status('retired', 'Dar de baja') : null}
              </div>
            </section>
          </aside>
        ) : null}
      </div>

      {a.manage ? (
        <details className={card}>
          <summary className="cursor-pointer font-display text-[17px] font-semibold text-foreground">Editar los datos</summary>
          <div className="mt-5">
            <AssetForm companyId={id} asset={a} />
          </div>
          <form action={deleteAssetAction} className="mt-5">
            <input type="hidden" name="companyId" value={id} />
            <input type="hidden" name="assetId" value={a.id} />
            <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
              Borrar el equipo y su historial
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
