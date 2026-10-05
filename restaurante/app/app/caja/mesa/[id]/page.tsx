import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getCheckout, getOpenShift } from '@/lib/cash';
import { can } from '@/lib/permissions';
import { CheckoutScreen } from '@/components/checkout-screen';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('cash.operate');
  const { id } = await params;
  const [checkout, shift] = await Promise.all([getCheckout(staff, id), getOpenShift(staff)]);
  if (!checkout) notFound();
  return (
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
    />
  );
}
