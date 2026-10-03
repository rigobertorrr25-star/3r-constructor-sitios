import type { Metadata } from 'next';
import { deleteCouponAction, toggleCouponAction } from '@/app/empresa/store-actions';
import { TogglePanel } from '@/components/inventory-forms';
import { CouponForm } from '@/components/store-forms';
import { StoreTabs } from '@/components/store-tabs';
import { authedApi } from '@/lib/api';
import { cop, type Coupon } from '@/lib/store';
import { loadCompany } from '../../company';
import { storeGate } from '../store-gate';

export const metadata: Metadata = { title: 'Cupones — 3R' };

const day = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default async function CouponsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const gate = storeGate(company);
  if (gate) return gate;
  const { data: coupons } = await authedApi<Coupon[]>(`/companies/${id}/store/coupons`);

  return (
    <div className="space-y-6">
      <StoreTabs companyId={id} active="/cupones" />
      <TogglePanel label="+ Nuevo cupón">
        <CouponForm companyId={id} />
      </TogglePanel>
      {coupons.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          Todavía no hay cupones. Crea uno para promociones: por ejemplo, BIENVENIDA con 10 % en la primera compra.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {coupons.map((c) => (
            <li key={c.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5 ${c.active ? '' : 'opacity-60'}`}>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[16px] font-semibold tracking-wide text-foreground">{c.code}</span>
                <span className="block text-[12.5px] text-muted-foreground">
                  {[
                    c.percent != null ? `${c.percent} % de descuento` : `${cop(c.amount ?? 0)} de descuento`,
                    c.minOrder ? `desde ${cop(c.minOrder)}` : null,
                    `${c.used}${c.maxUses ? ` de ${c.maxUses}` : ''} usos`,
                    c.expiresAt ? `vence ${day.format(new Date(c.expiresAt))}` : null,
                    c.active ? null : 'pausado',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <form action={toggleCouponAction}>
                  <input type="hidden" name="companyId" value={id} />
                  <input type="hidden" name="coupon" value={JSON.stringify(c)} />
                  <button
                    type="submit"
                    className="rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[13px] text-foreground hover:bg-white/[0.06]"
                  >
                    {c.active ? 'Pausar' : 'Activar'}
                  </button>
                </form>
                <form action={deleteCouponAction}>
                  <input type="hidden" name="companyId" value={id} />
                  <input type="hidden" name="couponId" value={c.id} />
                  <button type="submit" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]">
                    Borrar
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
