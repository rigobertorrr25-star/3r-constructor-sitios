import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { listTickets } from '@/lib/kds';
import { homeOf, ownStation } from '@/lib/permissions';
import { STATION_LABEL, type Station } from '@/lib/stations';
import { AutoRefresh } from './auto-refresh';
import { KdsBoard } from './kds-board';
import { getLang } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n';

/** Página de una estación (cocina o barra). */
export async function KdsPage({ station }: { station: Station }) {
  const staff = await requireStaff('kds.view');
  const own = ownStation(staff.role);
  if (own && own !== station) redirect(homeOf(staff.role));
  const tickets = await listTickets(staff, station);
  const lang = await getLang();
  return (
    <>
      <AutoRefresh everyMs={5_000} />
      <KdsBoard
        title={translate(lang, STATION_LABEL[station])}
        timeZone={staff.timezone}
        tickets={tickets.map((t) => ({ ...t, sentAt: t.sentAt.toISOString(), startedAt: t.startedAt?.toISOString() ?? null, readyAt: t.readyAt?.toISOString() ?? null }))}
      />
    </>
  );
}
