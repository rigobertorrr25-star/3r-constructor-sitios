import { redirect } from 'next/navigation';
import { KdsPage } from '@/components/kds-page';
import { requireStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
  const staff = await requireStaff('kds.view');
  // En un bar solo de licores no hay cocina (quien tenga el rol Cocina de antes la sigue viendo).
  if (staff.barOnly && staff.role !== 'kitchen') redirect('/app');
  return <KdsPage station="kitchen" />;
}
