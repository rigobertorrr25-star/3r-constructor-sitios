import { requireStaff } from '@/lib/auth';
import { listTables } from '@/lib/store';
import { FloorEditor } from '@/components/floor-editor';
import { PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function FloorPage() {
  const staff = await requireStaff('floor.edit');
  const tables = await listTables(staff);
  return (
    <div className="space-y-6">
      <PageTitle title="Plano de mesas" text={`Sede ${staff.locationName}. Arrastra las mesas para acomodarlas como están en el local y toca Guardar plano.`} />
      <FloorEditor
        tables={tables.map(({ session: _s, ...t }) => ({ ...t, session: null }))}
      />
    </div>
  );
}
