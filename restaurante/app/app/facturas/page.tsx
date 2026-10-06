import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { todayIn } from '@/lib/finance';
import { formatCop, formatDateTime } from '@/lib/format';
import { DOC_TYPES, INVOICE_STATUS, TAX_KINDS, getFiscal, listInvoices } from '@/lib/invoices';
import { can } from '@/lib/permissions';
import { PERIODS, periodRange } from '@/lib/periods';
import { FiscalForm, InvoiceCustomer } from '@/components/invoice-forms';
import { Empty, PageTitle, card, quietButton } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const staff = await requireStaff('invoices.manage');
  const { periodo } = await searchParams;
  const period = PERIODS.some((p) => p.key === periodo) ? periodo! : 'hoy';
  const range = periodRange(period, todayIn(staff.timezone));
  const [fiscal, invoices] = await Promise.all([getFiscal(staff.businessId), listInvoices(staff, range, staff.timezone)]);
  const live = invoices.filter((i) => i.status !== 'void');
  const totals = live.reduce((s, i) => ({ total: s.total + i.total, base: s.base + i.base, tax: s.tax + i.tax }), { total: 0, base: 0, tax: 0 });
  const pending = live.filter((i) => i.status === 'pending').length;
  return (
    <div className="space-y-6">
      <PageTitle title="Facturas" text="Cada venta cobrada (mesa o cita) genera su factura, a nombre de consumidor final o del cliente que la pida." />
      <div className="rounded-[22px] border border-warning/40 bg-warning/[0.07] p-4 text-[14.5px]">
        <strong>Todavía no se envían a la DIAN.</strong> Para eso hay que conectar un proveedor de facturación electrónica (Alegra, Siigo u
        otro). Mientras tanto quedan como «pendientes» y puedes descargarlas para tu contador o para subirlas al proveedor.
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/app/facturas?periodo=${p.key}`} className={`rounded-full px-4 py-1.5 text-[14px] ${period === p.key ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </Link>
        ))}
        <a href={`/app/facturas/csv?desde=${range.from}&hasta=${range.to}`} className={`${quietButton} ml-auto`}>
          Descargar para Excel
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Facturas', String(live.length)],
          ['Base', formatCop(totals.base)],
          [`${TAX_KINDS[fiscal.taxKind].rate ? `Impuesto (${TAX_KINDS[fiscal.taxKind].rate} %)` : 'Impuesto'}`, formatCop(totals.tax)],
          ['Pendientes de enviar', String(pending)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[22px] border border-white/[0.08] bg-card p-4">
            <p className="text-[13px] text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-[22px] font-bold">{v}</p>
          </div>
        ))}
      </div>

      {invoices.length === 0 ? (
        <Empty>No hay facturas en este periodo.</Empty>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card">
          {invoices.map((i) => (
            <li key={i.id} className={`px-4 py-3 text-[14px] ${i.status === 'void' ? 'opacity-50' : ''}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="font-semibold">Venta #{i.sequence}</span> · {i.concept} · {formatDateTime(i.createdAt, staff.timezone)}
                  <span className="block text-[13px] text-muted-foreground">
                    {i.customerName} · {DOC_TYPES[i.docType as keyof typeof DOC_TYPES] ?? i.docType} {i.docNumber}
                    {i.customerEmail ? ` · ${i.customerEmail}` : ''}
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-semibold">{formatCop(i.total)}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    base {formatCop(i.base)} + {formatCop(i.tax)} · {INVOICE_STATUS[i.status]}
                  </span>
                </span>
              </div>
              {i.status === 'pending' || i.status === 'rejected' ? <InvoiceCustomer invoiceId={i.id} sessionId={i.sessionId ?? ''} /> : null}
            </li>
          ))}
        </ul>
      )}

      {can(staff.role, 'locations.manage') ? (
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">Datos de facturación del negocio</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">Los precios de la carta se toman con el impuesto incluido.</p>
          <div className="mt-4">
            <FiscalForm fiscal={fiscal} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
