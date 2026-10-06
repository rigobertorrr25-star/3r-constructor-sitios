import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { APPOINTMENT_STATUS, commissions, listAgenda, listProfessionals, listServices } from '@/lib/appointments';
import { addDays, todayIn } from '@/lib/finance';
import { formatCop, formatTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { AppointmentActions, AppointmentForm, ServiceForm } from '@/components/agenda-forms';
import { Empty, PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const staff = await requireStaff('agenda.view');
  const today = todayIn(staff.timezone);
  const { dia } = await searchParams;
  const date = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : today;
  const manage = can(staff.role, 'agenda.manage');
  const editServices = can(staff.role, 'menu.edit');
  const canCharge = can(staff.role, 'cash.operate');
  const [day, services, pros, month] = await Promise.all([
    listAgenda(staff, date),
    listServices(staff.businessId),
    listProfessionals(staff),
    commissions(staff, { from: `${today.slice(0, 7)}-01`, to: today }, staff.timezone),
  ]);
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const columns = manage ? pros : pros.filter((p) => p.id === staff.id);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Agenda"
        text={manage ? 'Citas por profesional. Una cita atendida se cobra aquí mismo y entra a la caja.' : 'Tus citas y tus comisiones.'}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/app/agenda?dia=${addDays(date, -1)}`} className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[14px] text-muted-foreground" aria-label="Día anterior">
          ←
        </Link>
        <p className="font-display text-[18px] font-bold first-letter:uppercase">{label}</p>
        <Link href={`/app/agenda?dia=${addDays(date, 1)}`} className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[14px] text-muted-foreground" aria-label="Día siguiente">
          →
        </Link>
        {date !== today ? (
          <Link href="/app/agenda" className="text-[14px] text-primary hover:underline">
            Hoy
          </Link>
        ) : null}
      </div>

      {pros.length === 0 ? (
        <Empty>
          Todavía no hay profesionales. {can(staff.role, 'staff.manage') ? 'Agrégalos en Equipo con el rol «Profesional».' : ''}
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {columns.map((p) => {
            const list = day.filter((a) => a.staffId === p.id);
            return (
              <section key={p.id} className={card}>
                <h2 className="font-display text-[18px] font-bold">{p.name}</h2>
                {list.length === 0 ? <p className="mt-2 text-[14px] text-muted-foreground">Sin citas.</p> : null}
                <ul className="mt-3 space-y-3">
                  {list.map((a) => (
                    <li key={a.id} className={`rounded-2xl border border-white/[0.08] p-3 ${a.status === 'cancelled' || a.status === 'no_show' ? 'opacity-55' : ''}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-[16px] font-semibold">
                          {formatTime(a.startsAt, staff.timezone)}–{formatTime(a.endsAt, staff.timezone)}
                        </span>
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[12px]">{APPOINTMENT_STATUS[a.status]}</span>
                      </div>
                      <p className="mt-1 text-[14.5px]">
                        {a.customerName} · {a.serviceName} · {formatCop(a.price)}
                      </p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {a.phone}
                        {a.notes ? ` · ${a.notes}` : ''}
                      </p>
                      <AppointmentActions id={a.id} status={a.status} price={a.price - a.paid} manage={manage} mine={a.staffId === staff.id} canCharge={canCharge} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {manage && pros.length && services.some((s) => s.isActive) ? (
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">Nueva cita</h2>
          <div className="mt-4">
            <AppointmentForm date={date} services={services.filter((s) => s.isActive)} pros={pros} />
          </div>
        </section>
      ) : null}

      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">Comisiones del mes</h2>
        {month.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted-foreground">Todavía no hay citas pagadas este mes.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06] text-[14.5px]">
            {month.map((m) => (
              <li key={m.staffId} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {m.name} · {m.services} {m.services === 1 ? 'servicio' : 'servicios'} · vendió {formatCop(m.sales)}
                </span>
                <span>
                  Comisión <strong>{formatCop(m.commission)}</strong>
                  {m.tips ? ` · propinas ${formatCop(m.tips)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editServices ? (
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">Servicios</h2>
          <ul className="mt-3 space-y-3">
            {services.map((s) => (
              <li key={s.id} className={s.isActive ? '' : 'opacity-60'}>
                <ServiceForm service={s} />
              </li>
            ))}
          </ul>
          <h3 className="mt-6 font-display text-[16px] font-bold">Nuevo servicio</h3>
          <div className="mt-3">
            <ServiceForm />
          </div>
        </section>
      ) : null}
    </div>
  );
}
