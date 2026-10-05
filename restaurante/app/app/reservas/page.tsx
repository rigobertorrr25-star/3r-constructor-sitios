import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { addDays, todayIn } from '@/lib/finance';
import { formatCop, formatTime } from '@/lib/format';
import { listReservations, STATUS_LABEL } from '@/lib/reservations';
import { listTables } from '@/lib/store';
import { ReservationActions, ReservationForm } from '@/components/reservation-forms';
import { Empty, PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const staff = await requireStaff('reservations.manage');
  const today = todayIn(staff.timezone);
  const { dia } = await searchParams;
  const date = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : today;
  const [{ day, requested }, tables] = await Promise.all([listReservations(staff, date), listTables(staff)]);
  const options = tables.map((t) => ({ id: t.id, label: `Mesa ${t.number} · ${t.zone} · ${t.capacity} p.`, free: t.status === 'free' }));
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const people = day.filter((r) => r.status === 'confirmed' || r.status === 'arrived').reduce((s, r) => s + r.guests, 0);
  return (
    <div className="space-y-6">
      <PageTitle title="Reservas" text={`Sede ${staff.locationName}. Las mesas reservadas se ven en el plano desde 30 minutos antes.`} />

      {requested.length ? (
        <section className={`${card} border-warning/50`}>
          <h2 className="font-display text-[18px] font-bold">Pedidas en línea, por confirmar ({requested.length})</h2>
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {requested.map((r) => (
              <li key={r.id} className="py-3">
                <Row r={r} timeZone={staff.timezone} withDate />
                <ReservationActions id={r.id} status={r.status} tableId={r.tableId} tables={options} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/app/reservas?dia=${addDays(date, -1)}`} className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[14px] text-muted-foreground hover:text-foreground" aria-label="Día anterior">
          ←
        </Link>
        <p className="font-display text-[18px] font-bold first-letter:uppercase">{label}</p>
        <Link href={`/app/reservas?dia=${addDays(date, 1)}`} className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[14px] text-muted-foreground hover:text-foreground" aria-label="Día siguiente">
          →
        </Link>
        {date !== today ? (
          <Link href="/app/reservas" className="text-[14px] text-primary hover:underline">
            Hoy
          </Link>
        ) : null}
        <span className="text-[14px] text-muted-foreground">
          · {day.length} {day.length === 1 ? 'reserva' : 'reservas'} · {people} personas
        </span>
      </div>

      {day.length === 0 ? (
        <Empty>No hay reservas este día.</Empty>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card">
          {day.map((r) => (
            <li key={r.id} className={`px-4 py-3 ${r.status === 'cancelled' || r.status === 'no_show' ? 'opacity-55' : ''}`}>
              <Row r={r} timeZone={staff.timezone} />
              {r.status === 'confirmed' || r.status === 'requested' ? <ReservationActions id={r.id} status={r.status} tableId={r.tableId} tables={options} /> : null}
              {r.status === 'arrived' && r.sessionId ? (
                <Link href={`/app/mesa/${r.sessionId}`} className="mt-1 inline-block text-[13.5px] text-primary hover:underline">
                  Ver su pedido
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">Nueva reserva</h2>
        <div className="mt-4">
          <ReservationForm date={date} tables={options} />
        </div>
      </section>
    </div>
  );

  function Row({ r, timeZone, withDate }: { r: (typeof day)[number]; timeZone: string; withDate?: boolean }) {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <span className="font-display text-[17px] font-semibold">{formatTime(r.startsAt, timeZone)}</span>
          {withDate ? <span className="text-[13.5px] text-muted-foreground"> · {new Date(r.startsAt).toLocaleDateString('es-CO', { timeZone, day: 'numeric', month: 'short' })}</span> : null}
          <span className="ml-2 text-[15px]">
            {r.customerName} · {r.guests} p.
          </span>
          <span className="block text-[13px] text-muted-foreground">
            <a href={`https://wa.me/${r.phone.length === 10 ? `57${r.phone}` : r.phone}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              {r.phone}
            </a>
            {r.tableNumber ? ` · Mesa ${r.tableNumber}` : ' · Sin mesa'}
            {r.deposit ? ` · abonó ${formatCop(r.deposit)}` : ''}
            {r.source === 'online' ? ' · pedida en línea' : ''}
            {r.notes ? ` · ${r.notes}` : ''}
          </span>
        </span>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[12.5px]">{STATUS_LABEL[r.status]}</span>
      </div>
    );
  }
}
