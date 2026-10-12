import { requireStaff } from '@/lib/auth';
import { listTables } from '@/lib/store';
import { listFixtures } from '@/lib/floor';
import { FloorEditor } from '@/components/floor-editor';
import { PageTitle } from '@/components/ui';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function FloorPage() {
  const staff = await requireStaff('floor.edit');
  const [tables, fixtures] = await Promise.all([listTables(staff), listFixtures(staff)]);
  const t = await getT();
  return (
    <div className="space-y-6">
      <PageTitle title={t('Plano de mesas')} text={t('Sede {name}. Arrastra las mesas para acomodarlas como están en el local y toca Guardar plano.', { name: staff.locationName })} />
      <FloorEditor
        tables={tables.map(({ session: _s, ...t }) => ({ ...t, session: null }))}
        fixtures={fixtures}
      />
    </div>
  );
}
