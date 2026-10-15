import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminSetCompanyStatusAction } from '@/app/empresa/actions';
import { linkCompanySiteAction } from '@/app/empresa/web-actions';
import { disconnectWhatsappAction } from '@/app/empresa/whatsapp-actions';
import { WhatsappConnectForm } from '@/components/whatsapp-forms';
import { markInvoicePaidAction, voidInvoiceAction } from '@/app/admin/billing-actions';
import { GenerateInvoiceButton, SubscriptionForm } from '@/components/billing-forms';
import { AdminModulesForm } from '@/components/company-forms';
import { InvoiceList } from '@/components/invoice-list';
import { SUBSCRIPTION_LABEL, pesos, type BillingOverview } from '@/lib/billing';
import { API_URL, authedApi } from '@/lib/api';
import type { AdminCompany } from '@/lib/companies';
import type { SiteOptions } from '@/lib/company-web';
import type { WaAdmin } from '@/lib/whatsapp';

export const metadata: Metadata = { title: 'Empresa — Administración 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [res, billingRes, siteRes, waRes] = await Promise.all([
    authedApi<AdminCompany>(`/admin/companies/${id}`),
    authedApi<BillingOverview>(`/admin/companies/${id}/billing`),
    authedApi<SiteOptions>(`/admin/companies/${id}/site`),
    authedApi<WaAdmin>(`/admin/companies/${id}/whatsapp`),
  ]);
  if (!res.ok) notFound();
  const billing = billingRes.data;
  const c = res.data;
  const suspended = c.status === 'suspended';
  return (
    <>
      <Link href="/admin/empresas" className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Empresas
      </Link>
      <h1 className="mt-3 font-display text-[30px] font-bold tracking-tight text-foreground">{c.name}</h1>
      <p className="mt-1 text-[14.5px] text-muted-foreground">
        Dueño: {c.owner?.email ?? '—'} · {c.memberCount} personas
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <section className={card}>
          <h2 className="font-display text-[20px] font-semibold text-foreground">Módulos</h2>
          <p className="mt-1 mb-5 text-[14px] text-muted-foreground">
            Marca los que contrató. Los que están en construcción se habilitan cuando estén listos.
          </p>
          <AdminModulesForm companyId={c.id} catalog={c.catalog ?? []} enabled={c.modules} />
        </section>
        <section className={card}>
          <h2 className="font-display text-[17px] font-semibold text-foreground">Estado</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {suspended ? 'Suspendida: nadie de la empresa puede entrar. Los datos se conservan.' : 'Activa.'}
          </p>
          <form action={adminSetCompanyStatusAction} className="mt-4">
            <input type="hidden" name="companyId" value={c.id} />
            <input type="hidden" name="status" value={suspended ? 'active' : 'suspended'} />
            <button type="submit" className="w-full rounded-full border border-white/[0.12] px-5 py-2.5 text-[14px] transition hover:bg-white/[0.06]">
              {suspended ? 'Reactivar empresa' : 'Suspender empresa'}
            </button>
          </form>
        </section>
      </div>
      <section className={`${card} mt-6`} aria-labelledby="h-web">
        <h2 id="h-web" className="font-display text-[20px] font-semibold text-foreground">
          Página web de la empresa
        </h2>
        <p className="mt-1 mb-4 text-[14px] text-muted-foreground">
          Con el módulo Página web, sus administradores cambian textos, fotos y botones de esta página y la publican. El diseño solo lo cambia 3R.
        </p>
        <form action={linkCompanySiteAction} className="flex flex-wrap items-center gap-3" key={siteRes.data?.siteId ?? 'none'}>
          <input type="hidden" name="companyId" value={c.id} />
          <select
            name="siteId"
            defaultValue={siteRes.data?.siteId ?? ''}
            aria-label="Página de la empresa"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[14.5px] text-foreground"
          >
            <option value="" className="bg-[#0a131a]">
              Sin página
            </option>
            {(siteRes.data?.options ?? []).map((o) => (
              <option key={o.id} value={o.id} disabled={!!o.linkedTo} className="bg-[#0a131a]">
                {o.name}
                {o.order ? ` · pedido #${o.order.number} (${o.order.client})` : ''}
                {o.linkedTo ? ` · ya es de ${o.linkedTo}` : ''}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full border border-white/[0.12] px-5 py-2.5 text-[14px] transition hover:bg-white/[0.06]">
            Guardar
          </button>
        </form>
      </section>
      <section className={`${card} mt-6`} aria-labelledby="h-wa">
        <h2 id="h-wa" className="font-display text-[20px] font-semibold text-foreground">
          WhatsApp de la empresa
        </h2>
        <p className="mt-1 mb-4 max-w-[75ch] text-[14px] text-muted-foreground">
          Con el módulo WhatsApp, los mensajes de este número llegan a la bandeja de la empresa. Los datos salen de Meta (WhatsApp Manager → API). En
          la app de Meta, la dirección de avisos es <span className="break-all text-foreground">{API_URL.replace(/\/$/, '')}/webhooks/whatsapp</span>{' '}
          con la clave de verificación que está en Render (WHATSAPP_VERIFY_TOKEN), suscrita a «messages».
        </p>
        {waRes.ok ? <WhatsappConnectForm companyId={c.id} data={waRes.data} /> : null}
        {waRes.ok && waRes.data.account ? (
          <form action={disconnectWhatsappAction} className="mt-4">
            <input type="hidden" name="companyId" value={c.id} />
            <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
              Desconectar el número
            </button>
          </form>
        ) : null}
      </section>
      <section className={`${card} mt-6`} aria-labelledby="h-plan">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="h-plan" className="font-display text-[20px] font-semibold text-foreground">
              Plan y facturación
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {billing.subscription ? SUBSCRIPTION_LABEL[billing.subscription.status] : 'Sin plan configurado'} · {pesos(billing.plan.total)} al mes
              {billing.plan.items.length ? ` (${billing.plan.items.map((i) => `${i.name} ${pesos(i.price)}`).join(', ')})` : ''}
            </p>
            {billing.plan.unpriced.length ? (
              <p className="mt-1 text-[13px] text-[#ffd27a]">
                Sin precio: {billing.plan.unpriced.join(', ')}. Ponlo en{' '}
                <Link href="/admin/modulos" className="underline underline-offset-2">
                  Precios
                </Link>
                .
              </p>
            ) : null}
          </div>
          <GenerateInvoiceButton companyId={c.id} />
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <SubscriptionForm companyId={c.id} subscription={billing.subscription} />
          <InvoiceList
            invoices={billing.invoices}
            actions={(i) =>
              i.status === 'pending' ? (
                <div className="flex flex-col items-end gap-2">
                  <form action={markInvoicePaidAction} className="flex items-center gap-2">
                    <input type="hidden" name="companyId" value={c.id} />
                    <input type="hidden" name="invoiceId" value={i.id} />
                    <input type="hidden" name="method" value="transfer" />
                    <input
                      name="note"
                      placeholder="Referencia"
                      aria-label={`Referencia del pago de ${i.code}`}
                      className="w-28 rounded-full border border-white/[0.1] bg-transparent px-3 py-1.5 text-[12.5px]"
                    />
                    <button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground">
                      Pagada
                    </button>
                  </form>
                  <form action={voidInvoiceAction}>
                    <input type="hidden" name="companyId" value={c.id} />
                    <input type="hidden" name="invoiceId" value={i.id} />
                    <button type="submit" className="text-[12px] text-muted-foreground hover:text-[#ffb4b5]">
                      Anular
                    </button>
                  </form>
                </div>
              ) : null
            }
          />
        </div>
      </section>
    </>
  );
}
