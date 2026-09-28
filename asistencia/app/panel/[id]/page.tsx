import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmployeeForm, KioskLink, RecordEditor } from '@/components/panel-forms';
import { card } from '@/components/ui';
import {
  LATE_GRACE_MIN,
  addDays,
  formatClock,
  formatDay,
  formatMinutes,
  formatShortDay,
  groupByDay,
  isDay,
  minutesLate,
  totalsByEmployee,
  weekOf,
  workedMinutes,
} from '@/lib/report';
import { getBusiness, listRecords } from '@/lib/store';

export const metadata: Metadata = { title: 'Reporte — Asistencia 3R' };

const sectionTitle = 'font-display text-[22px] font-semibold text-foreground';
const th = 'px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-muted-foreground';
const td = 'px-3 py-2.5 text-[14px] text-foreground';

export default async function AttendanceBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const business = await getBusiness(id);
  if (!business) notFound();

  const thisWeek = weekOf(new Date());
  const from = isDay(query.desde) ? query.desde : thisWeek.from;
  const to = isDay(query.hasta) && query.hasta >= from ? query.hasta : addDays(from, 6);
  const records = await listRecords(business.id, from, to);
  const totals = totalsByEmployee(records);
  const days = groupByDay(records).reverse();

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3100';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const kioskUrl = `${proto}://${host}/tablet/${business.kioskSecret}`;

  const range = (start: string) => `/panel/${id}?desde=${start}&hasta=${addDays(start, 6)}`;
  const active = business.employees.filter((e) => e.isActive);
  const inactive = business.employees.filter((e) => !e.isActive);

  return (
    <>
      <Link href="/panel" className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Negocios
      </Link>
      <h1 className="mt-2 font-display text-[32px] font-bold tracking-tight text-foreground">{business.name}</h1>

      <div className="mt-8 space-y-6">
        {/* Reporte */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={sectionTitle}>
              {formatShortDay(from)} – {formatShortDay(to)}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              <Link href={range(addDays(from, -7))} className="rounded-full border border-white/[0.1] px-4 py-2 transition hover:bg-white/[0.06]">
                ← Semana anterior
              </Link>
              {from !== thisWeek.from ? (
                <Link href={range(thisWeek.from)} className="rounded-full border border-white/[0.1] px-4 py-2 transition hover:bg-white/[0.06]">
                  Esta semana
                </Link>
              ) : null}
              <Link href={range(addDays(from, 7))} className="rounded-full border border-white/[0.1] px-4 py-2 transition hover:bg-white/[0.06]">
                Semana siguiente →
              </Link>
              <a
                href={`/panel/${id}/excel?from=${from}&to=${to}`}
                className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
              >
                Descargar para Excel
              </a>
            </div>
          </div>

          {records.length === 0 ? (
            <p className="mt-5 text-[15px] text-muted-foreground">Nadie marcó en estas fechas.</p>
          ) : (
            <>
              <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Totales</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className={th}>Empleado</th>
                      <th className={th}>Días</th>
                      <th className={th}>Horas</th>
                      <th className={th}>Llegadas tarde</th>
                      <th className={th}>Sin salida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((row) => (
                      <tr key={row.employeeId} className="border-b border-white/[0.04]">
                        <td className={td}>{row.name}</td>
                        <td className={td}>{row.days}</td>
                        <td className={td}>{formatMinutes(row.minutes)}</td>
                        <td className={`${td} ${row.lateCount ? 'text-warning' : ''}`}>
                          {row.lateCount ? `${row.lateCount} (${formatMinutes(row.lateMinutes)} en total)` : '—'}
                        </td>
                        <td className={`${td} ${row.missingExit ? 'text-[#ffb4b5]' : ''}`}>{row.missingExit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Llegar hasta {LATE_GRACE_MIN} minutos después del turno no cuenta como tarde. Las horas solo suman jornadas con salida.
              </p>

              <div className="mt-8 space-y-8">
                {days.map(({ day, records: dayRecords }) => (
                  <div key={day}>
                    <h3 className="font-display text-[17px] font-semibold first-letter:uppercase text-foreground">{formatDay(day)}</h3>
                    <ul className="mt-3 divide-y divide-white/[0.05]">
                      {dayRecords.map((record) => {
                        const worked = workedMinutes(record);
                        const late = minutesLate(record);
                        return (
                          <li key={record.id} className="py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                              <span className="text-[15px] font-medium text-foreground">{record.employee.name}</span>
                              <span className="text-[14px] tabular-nums text-muted-foreground">
                                {formatClock(new Date(record.clockIn))} →{' '}
                                {record.clockOut ? formatClock(new Date(record.clockOut)) : <span className="text-[#ffb4b5]">sin salida</span>}
                                {worked !== null ? <span className="text-foreground"> · {formatMinutes(worked)}</span> : null}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[13px]">
                              {record.employee.shiftStart ? (
                                <span className={late ? 'text-warning' : 'text-muted-foreground'}>
                                  Turno {record.employee.shiftStart}–{record.employee.shiftEnd}
                                  {late ? ` · llegó ${formatMinutes(late)} tarde` : ''}
                                </span>
                              ) : null}
                              {record.editedAt ? <span className="text-muted-foreground">corregido a mano</span> : null}
                            </div>
                            <RecordEditor businessId={business.id} record={record} />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Empleados */}
        <section className={card}>
          <h2 className={sectionTitle}>Empleados</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {active.length} {active.length === 1 ? 'activo' : 'activos'}. Cada uno marca con su propio PIN de 4 números.
          </p>
          <div className="mt-5 rounded-2xl border border-white/[0.08] p-4">
            <h3 className="mb-4 text-[15px] font-medium text-foreground">Agregar empleado</h3>
            <EmployeeForm businessId={business.id} />
          </div>
          <ul className="mt-4 space-y-2">
            {[...active, ...inactive].map((employee) => (
              <li key={employee.id}>
                <details className="rounded-2xl border border-white/[0.06] p-4">
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                    <span className={`text-[15px] font-medium ${employee.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                      {employee.name}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {employee.shiftStart ? `Turno ${employee.shiftStart}–${employee.shiftEnd}` : 'Sin turno fijo'}
                    </span>
                  </summary>
                  <div className="mt-4">
                    <EmployeeForm businessId={business.id} employee={employee} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        {/* Tablet */}
        <section className={card}>
          <h2 className={sectionTitle}>Tablet de la entrada</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
            Abre este enlace en la tablet (o un celular) que queda en la entrada, conectada a la corriente y al wifi. Muestra el QR que
            cambia cada 30 segundos. No lo compartas con los empleados: con este enlace se podría marcar desde otro lugar. Si se filtra,
            usa “Cambiar enlace”.
          </p>
          <div className="mt-4">
            <KioskLink url={kioskUrl} businessId={business.id} />
          </div>
        </section>
      </div>
    </>
  );
}
