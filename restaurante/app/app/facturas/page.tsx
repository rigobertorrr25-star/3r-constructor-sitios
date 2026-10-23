import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { EXPENSE_KIND_LABEL, EXPENSE_LABEL, listPurchaseInvoices, todayIn, type ExpenseKind } from '@/lib/finance';
import { formatCop, formatDateTime } from '@/lib/format';
import { DOC_TYPES, INVOICE_STATUS, TAX_KINDS, getFiscal, listInvoices } from '@/lib/invoices';
import { can } from '@/lib/permissions';
import { PERIODS, periodRange } from '@/lib/periods';
import { FiscalForm, InvoiceCustomer } from '@/components/invoice-forms';
import { ReceiptExpense } from '@/components/receipt-expense';
import { itemsForPurchase } from '@/lib/inventory';
import { Empty, PageTitle, card, quietButton } from '@/components/ui';
import { getLang } from '@/lib/i18n/server';
import { makeT, tr } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ periodo?: string; compras?: string }> }) {
  const staff = await requireStaff('invoices.manage');
  const { periodo, compras } = await searchParams;
  const lang = await getLang();
  const t = makeT(lang);
  const period = PERIODS.some((p) => p.key === periodo) ? periodo! : 'hoy';
  const today = todayIn(staff.timezone);
  const range = periodRange(period, today);
  const addsExpenses = can(staff.role, 'expenses.add');
  const [fiscal, invoices, purchases, stockItems] = await Promise.all([
    getFiscal(staff.businessId),
    listInvoices(staff, range, staff.timezone),
    addsExpenses ? listPurchaseInvoices(staff, range) : Promise.resolve([]),
    addsExpenses ? itemsForPurchase(staff) : Promise.resolve([]),
  ]);
  const live = invoices.filter((i) => i.status !== 'void');
  const totals = live.reduce((s, i) => ({ total: s.total + i.total, base: s.base + i.base, tax: s.tax + i.tax }), { total: 0, base: 0, tax: 0 });
  const pending = live.filter((i) => i.status === 'pending').length;
  // Facturas de compra separadas: insumos (entran a la bodega) y gastos (arriendo, servicios…).
  const shownKind: ExpenseKind | 'all' = compras === 'insumos' ? 'supplies' : compras === 'gastos' ? 'expense' : 'all';
  const kindTotal = (k: ExpenseKind) => purchases.filter((e) => e.kind === k && !e.voided).reduce((sum, e) => sum + e.amount, 0);
  const shownPurchases = shownKind === 'all' ? purchases : purchases.filter((e) => e.kind === shownKind);
  const purchaseTabs: [string, ExpenseKind | 'all', string][] = [
    ['', 'all', t('Todas')],
    ['insumos', 'supplies', t('Insumos · {total}', { total: formatCop(kindTotal('supplies')) })],
    ['gastos', 'expense', t('Gastos · {total}', { total: formatCop(kindTotal('expense')) })],
  ];
  return (
    <div className="space-y-6">
      <PageTitle title={t('Facturas')} text={t('Cada venta cobrada (mesa o cita) genera su factura, a nombre de consumidor final o del cliente que la pida.')} />
      {addsExpenses ? <ReceiptExpense today={today} items={stockItems} /> : null}

      <h2 className="font-display text-[19px] font-bold">{t('Facturas de venta')}</h2>
      <div className="rounded-[22px] border border-warning/40 bg-warning/[0.07] p-4 text-[14.5px]">
        <strong>{t('Todavía no se envían a la DIAN.')}</strong>{' '}
        {t('Para eso hay que conectar un proveedor de facturación electrónica (Alegra, Siigo u otro). Mientras tanto quedan como «pendientes» y puedes descargarlas para tu contador o para subirlas al proveedor.')}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/app/facturas?periodo=${p.key}${compras === 'insumos' || compras === 'gastos' ? `&compras=${compras}` : ''}`} className={`rounded-full px-4 py-1.5 text-[14px] ${period === p.key ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}>
            {t(p.label)}
          </Link>
        ))}
        <a href={`/app/facturas/csv?desde=${range.from}&hasta=${range.to}`} className={`${quietButton} ml-auto`}>
          {t('Descargar para Excel')}
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [t('Facturas'), String(live.length)],
          [t('Base'), formatCop(totals.base)],
          [TAX_KINDS[fiscal.taxKind].rate ? t('Impuesto ({rate} %)', { rate: TAX_KINDS[fiscal.taxKind].rate }) : t('Impuesto'), formatCop(totals.tax)],
          [t('Pendientes de enviar'), String(pending)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[22px] border border-white/[0.08] bg-card p-4">
            <p className="text-[13px] text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-[22px] font-bold">{v}</p>
          </div>
        ))}
      </div>

      {invoices.length === 0 ? (
        <Empty>{t('No hay facturas en este periodo.')}</Empty>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card">
          {invoices.map((i) => (
            <li key={i.id} className={`px-4 py-3 text-[14px] ${i.status === 'void' ? 'opacity-50' : ''}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="font-semibold">{t('Venta #{n}', { n: i.sequence })}</span> · {tr(lang, i.concept)} · {formatDateTime(i.createdAt, staff.timezone, lang)}
                  <span className="block text-[13px] text-muted-foreground">
                    {tr(lang, i.customerName)} · {DOC_TYPES[i.docType as keyof typeof DOC_TYPES] ? t(DOC_TYPES[i.docType as keyof typeof DOC_TYPES]) : i.docType} {i.docNumber}
                    {i.customerEmail ? ` · ${i.customerEmail}` : ''}
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-semibold">{formatCop(i.total)}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {t('base {base} + {tax}', { base: formatCop(i.base), tax: formatCop(i.tax) })} · {t(INVOICE_STATUS[i.status])}
                  </span>
                </span>
              </div>
              {i.status === 'pending' || i.status === 'rejected' ? <InvoiceCustomer invoiceId={i.id} sessionId={i.sessionId ?? ''} /> : null}
            </li>
          ))}
        </ul>
      )}

      {addsExpenses ? (
        <section className="space-y-3">
          <h2 className="font-display text-[19px] font-bold">{t('Facturas de compra')}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {purchaseTabs.map(([param, k, label]) => (
              <Link
                key={k}
                href={`/app/facturas?periodo=${period}${param ? `&compras=${param}` : ''}`}
                className={`rounded-full px-4 py-1.5 text-[14px] ${shownKind === k ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </Link>
            ))}
          </div>
          {shownPurchases.length === 0 ? (
            <Empty>{shownKind === 'supplies' ? t('No hay facturas de insumos en este periodo.') : shownKind === 'expense' ? t('No hay gastos en este periodo.') : t('No hay gastos registrados en este periodo.')}</Empty>
          ) : (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card">
              {shownPurchases.map((e) => (
                <li key={e.id} className={`flex items-center gap-3 px-4 py-3 text-[14px] ${e.voided ? 'opacity-50' : ''}`}>
                  {e.hasPhoto ? (
                    <a href={`/app/facturas/compra/${e.id}`} target="_blank" rel="noreferrer" className="size-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]" aria-label={t('Ver la foto de la factura')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/app/facturas/compra/${e.id}`} alt="" className="size-full object-cover" loading="lazy" />
                    </a>
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-[11px] text-muted-foreground">{t('Sin foto')}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block font-medium ${e.voided ? 'line-through' : ''}`}>
                      <span className={`mr-2 inline-block rounded-full px-2 py-0.5 align-middle text-[11.5px] font-semibold ${e.kind === 'supplies' ? 'bg-primary/15 text-primary' : 'bg-white/[0.08] text-muted-foreground'}`}>
                        {t(EXPENSE_KIND_LABEL[e.kind])}
                      </span>
                      {e.description}
                    </span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {[e.spentOn, t(EXPENSE_LABEL[e.category]), e.supplier, e.createdBy, e.paidFromCash ? t('de la caja') : null, e.voided ? t('Anulado') : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="font-semibold">{formatCop(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {can(staff.role, 'locations.manage') ? (
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Datos de facturación del negocio')}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{t('Los precios de la carta se toman con el impuesto incluido.')}</p>
          <div className="mt-4">
            <FiscalForm fiscal={fiscal} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
