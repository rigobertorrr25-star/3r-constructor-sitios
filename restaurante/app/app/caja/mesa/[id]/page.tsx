import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getCheckout, getOpenShift } from '@/lib/cash';
import { formatCop } from '@/lib/format';
import { invoiceForSession } from '@/lib/invoices';
import { InvoiceCustomer } from '@/components/invoice-forms';
import { can } from '@/lib/permissions';
import { hasPrinter } from '@/lib/printing';
import { CheckoutScreen } from '@/components/checkout-screen';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('cash.operate');
  const t = await getT();
  const { id } = await params;
  const [checkout, shift, invoice, printBill] = await Promise.all([getCheckout(staff, id), getOpenShift(staff), invoiceForSession(staff, id), hasPrinter(staff, 'cashier')]);
  if (!checkout) notFound();
  return (
    <>
    {invoice ? (
      <section className="mb-5 rounded-[22px] border border-white/[0.08] bg-card p-4 text-[14.5px]">
        <p>
          <strong>{t('Factura venta #{n}', { n: invoice.sequence })}</strong> · {invoice.customerName} ·{' '}
          {t('{total} (base {base} + impuesto {tax})', { total: formatCop(invoice.total), base: formatCop(invoice.base), tax: formatCop(invoice.tax) })}
        </p>
        {invoice.status === 'pending' ? <InvoiceCustomer invoiceId={invoice.id} sessionId={id} /> : null}
      </section>
    ) : null}
    <CheckoutScreen
      checkout={{
        ...checkout,
        session: { ...checkout.session, openedAt: checkout.session.openedAt.toISOString(), closedAt: checkout.session.closedAt?.toISOString() ?? null },
        payments: checkout.payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
      }}
      shiftOpen={Boolean(shift)}
      canReverse={can(staff.role, 'payments.reverse')}
      canUnlimited={can(staff.role, 'discounts.unlimited')}
      timeZone={staff.timezone}
      printBill={printBill}
    />
    </>
  );
}
