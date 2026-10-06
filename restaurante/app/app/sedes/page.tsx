import { requireStaff } from '@/lib/auth';
import { listLocations } from '@/lib/store';
import { CreateLocationForm, LocationRow } from '@/components/location-forms';
import { PageTitle, card } from '@/components/ui';
import { BackgroundForm } from '@/components/background-forms';
import { backgroundUrl } from '@/lib/background-url';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const staff = await requireStaff('locations.manage');
  const locations = await listLocations(staff.businessId);
  const t = await getT();
  return (
    <div className="space-y-6">
      <PageTitle title={t('Sedes')} text={t('Cada sede tiene su propio plano de mesas. Para trabajar en otra sede, sal y vuelve a entrar eligiéndola.')} />
      <ul className="space-y-3">
        {locations.map((l) => (
          <LocationRow key={l.id} location={l} current={l.id === staff.locationId} />
        ))}
      </ul>
      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">{t('Fondo del restaurante')}</h2>
        <p className="mt-1 text-[14.5px] text-muted-foreground">
          {t('Una foto de tu local o de tu marca. Se ve en la pantalla de ingreso cuando escogen tu restaurante y, más oscura, detrás de la app. Mejor una foto horizontal y sin letras.')}
        </p>
        <div className="mt-4">
          <BackgroundForm current={backgroundUrl(staff.businessSlug, staff.background)} />
        </div>
      </section>
      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">{t('Nueva sede')}</h2>
        <div className="mt-4">
          <CreateLocationForm />
        </div>
      </section>
    </div>
  );
}
