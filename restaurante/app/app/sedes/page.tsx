import { requireStaff } from '@/lib/auth';
import { listLocations } from '@/lib/store';
import { CreateLocationForm, LocationRow } from '@/components/location-forms';
import { PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const staff = await requireStaff('locations.manage');
  const locations = await listLocations(staff.businessId);
  return (
    <div className="space-y-6">
      <PageTitle title="Sedes" text="Cada sede tiene su propio plano de mesas. Para trabajar en otra sede, sal y vuelve a entrar eligiéndola." />
      <ul className="space-y-3">
        {locations.map((l) => (
          <LocationRow key={l.id} location={l} current={l.id === staff.locationId} />
        ))}
      </ul>
      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">Nueva sede</h2>
        <div className="mt-4">
          <CreateLocationForm />
        </div>
      </section>
    </div>
  );
}
