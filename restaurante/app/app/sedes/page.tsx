import { requireStaff } from '@/lib/auth';
import { listLocations } from '@/lib/store';
import { CreateLocationForm, LocationRow } from '@/components/location-forms';
import { PageTitle, card } from '@/components/ui';
import { BackgroundForm } from '@/components/background-forms';
import { backgroundUrl } from '@/lib/background-url';
import { getT } from '@/lib/i18n/server';
import { WorkModeForm } from '@/components/waiter-forms';
import { workMode } from '@/lib/cash';
import { aiStatus } from '@/lib/brief';
import { locationNetworks, networkKey } from '@/lib/local-network';
import { clientIp } from '@/lib/rate-limit';
import { NetworkForms } from '@/components/network-forms';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const staff = await requireStaff('locations.manage');
  const [locations, mode, ai, networks, ip] = await Promise.all([listLocations(staff.businessId), workMode(staff.businessId), aiStatus(), locationNetworks(staff.locationId), clientIp()]);
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
        <h2 className="font-display text-[18px] font-bold">{t('Forma de trabajo')}</h2>
        <p className="mt-1 text-[14.5px] text-muted-foreground">{t('Cómo se cobra y qué se prepara en tu negocio. Vale para todas las sedes.')}</p>
        <div className="mt-4">
          <WorkModeForm waitersCollect={staff.waitersCollect} barOnly={staff.barOnly} suggestedTip={mode.suggestedTip} trackPrep={mode.trackPrep} cashOnly={mode.cashOnly} usdRate={mode.usdRate} />
        </div>
      </section>
      {/* Entrar solo desde el wifi del local (6 nov 2026). */}
      <section className={`${card} ${networks.length ? 'border-success/40' : ''}`}>
        <h2 className="font-display text-[18px] font-bold">{t('Entrar solo desde el wifi del local')}</h2>
        <p className="mt-1 text-[14.5px] text-muted-foreground">
          {t('Meseros, cajeras, cocina y barra solo podrán usar el sistema conectados al wifi de esta sede. Tú y el administrador entran desde cualquier parte. Hazlo estando en el local, conectado a su wifi.')}
        </p>
        <p className={`mt-2 text-[15px] font-semibold ${networks.length ? 'text-success' : 'text-muted-foreground'}`}>
          {networks.length ? t('Prendido: el equipo solo entra desde estas conexiones.') : t('Apagado: el equipo entra desde cualquier parte.')}
        </p>
        <div className="mt-3">
          <NetworkForms networks={networks} current={networkKey(ip)} />
        </div>
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          {t('Si el proveedor de internet cambia la dirección del local, el equipo no podrá entrar: agrega la conexión otra vez desde el local. Con los datos del celular tampoco se puede entrar.')}
        </p>
      </section>
      {/* ¿Funciona la IA? Facturas con foto, inventario con foto, carta desde PDF y el resumen del Tablero la usan. */}
      <section className={`${card} ${ai === 'ok' ? 'border-success/40' : 'border-warning/50'}`}>
        <h2 className="font-display text-[18px] font-bold">{t('Lectura con IA')}</h2>
        <p className={`mt-1 text-[15px] font-semibold ${ai === 'ok' ? 'text-success' : 'text-warning'}`}>
          {ai === 'ok'
            ? t('Funciona: la llave de la IA está bien puesta.')
            : ai === 'invalid'
              ? t('La llave de la IA no sirve (vencida o mal copiada). Pon una nueva en Vercel.')
              : ai === 'missing'
                ? t('No hay llave de la IA en este sistema.')
                : t('No se pudo revisar ahora. Vuelve a abrir esta página en un rato.')}
        </p>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{t('La usan las facturas con foto, el inventario con foto, la carta desde PDF y el resumen del Tablero. Sin ella, todo lo demás funciona igual.')}</p>
      </section>
      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">{t('Fondo del restaurante')}</h2>
        <p className="mt-1 text-[14.5px] text-muted-foreground">
          {t('Una foto de tu local o de tu marca. Se ve en la pantalla de ingreso cuando escogen tu restaurante, de piso en el mapa de mesas y, más oscura, detrás de la app. Mejor una foto horizontal y sin letras.')}
        </p>
        <div className="mt-4">
          <BackgroundForm current={backgroundUrl(staff.businessSlug, staff.background)} onFloor={staff.floorBackground} />
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
