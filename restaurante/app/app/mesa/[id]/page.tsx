import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getMenu, getSessionOrder } from '@/lib/orders';
import { can } from '@/lib/permissions';
import { AutoRefresh } from '@/components/auto-refresh';
import { PosScreen } from '@/components/pos-screen';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('orders.take');
  const { id } = await params;
  const [order, menu] = await Promise.all([getSessionOrder(staff, id), getMenu(staff.businessId, { activeOnly: true })]);
  if (!order) notFound();
  return (
    <>
      <AutoRefresh everyMs={15_000} />
      <PosScreen
        session={{ ...order.session, openedAt: order.session.openedAt.toISOString() }}
        rounds={order.rounds.map((r) => ({
          ...r,
          sentAt: r.sentAt.toISOString(),
          items: r.items.map((i) => ({ ...i, voidedAt: i.voidedAt?.toISOString() ?? null })),
        }))}
        total={order.total}
        categories={menu.categories}
        products={menu.products}
        canVoid={can(staff.role, 'orders.void')}
        timeZone={staff.timezone}
      />
    </>
  );
}
