import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteManagerButton, EmployeeForm, KioskLink, ManagerForm, RecordEditor, ResetPinButton, ShiftsForm } from '@/components/panel-forms';
import { AutoRefresh } from '@/components/auto-refresh';
import { card } from '@/components/ui';
import { canView, requireViewer } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import {
  LATE_GRACE_MIN,
  addDays,
  formatClock,
  formatDay,
  formatMinutes,
  formatShortDay,
  groupByDay,
  inferShift,
  isDay,
  minutesEarlyExit,
  minutesLate,
  ongoingMinutes,
  shiftLabel,
  totalsByEmployee,
  weekOf,
  workedMinutes,
} from '@/lib/report';
import { getBusiness, listManagers, listRecords } from '@/lib/store';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, 'reportTitle')} — ${t(lang, 'appName')}` };
}

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
  const viewer = await requireViewer();
  const business = await getBusiness(id);
  // Un jefe solo abre su propio negocio; los demás, como si no existieran.
  if (!business || !canView(viewer, business.id)) notFound();
  const isAdmin = viewer.role === 'admin';
  const lang = await getLang();
  const managers = isAdmin ? await listManagers(business.id) : [];

  const thisWeek = weekOf(new Date());
  const from = isDay(query.desde) ? query.desde : thisWeek.from;
  const to = isDay(query.hasta) && query.hasta >= from ? query.hasta : addDays(from, 6);
  const records = await listRecords(business.id, from, to);
  const now = Date.now();
  const totals = totalsByEmployee(records, business.shifts, now);
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
      {isAdmin ? (
        <Link href="/panel" className="text-[14px] text-muted-foreground transition hover:text-foreground">
          {t(lang, 'backToBusinesses')}
        </Link>
      ) : (
        <p className="text-[14px] text-muted-foreground">{t(lang, 'managerGreeting', { name: viewer.name })}</p>
      )}
      <h1 className="mt-2 font-display text-[32px] font-bold tracking-tight text-foreground">{business.name}</h1>

      <AutoRefresh />
      <div className="mt-8 space-y-6">
        {/* Reporte */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={sectionTitle}>
              {formatShortDay(from, lang)} – {formatShortDay(to, lang)}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              <Link href={range(addDays(from, -7))} className="rounded-full border border-white/[0.1] px-4 py-2 transition hover:bg-white/[0.06]">
                {t(lang, 'previousWeek')}
              </Link>
              {from !== thisWeek.from ? (
                <Link href={range(thisWeek.from)} className="rounded-full border border-white/[0.1] px-4 py-2 transition hover:bg-white/[0.06]">
                  {t(lang, 'thisWeek')}
                </Link>
              ) : null}
              <Link href={range(addDays(from, 7))} className="rounded-full border border-white/[0.1] px-4 py-2 transition hover:bg-white/[0.06]">
                {t(lang, 'nextWeek')}
              </Link>
              <a
                href={`/panel/${id}/excel?from=${from}&to=${to}&lang=${lang}`}
                className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
              >
                {t(lang, 'downloadExcel')}
              </a>
            </div>
          </div>

          {records.length === 0 ? (
            <p className="mt-5 text-[15px] text-muted-foreground">{t(lang, 'noRecords')}</p>
          ) : (
            <>
              <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t(lang, 'totals')}</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className={th}>{t(lang, 'colEmployee')}</th>
                      <th className={th}>{t(lang, 'colDays')}</th>
                      <th className={th}>{t(lang, 'colHours')}</th>
                      <th className={th}>{t(lang, 'colLate')}</th>
                      <th className={th}>{t(lang, 'colEarly')}</th>
                      <th className={th}>{t(lang, 'colMissingExit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((row) => (
                      <tr key={row.employeeId} className="border-b border-white/[0.04]">
                        <td className={td}>{row.name}</td>
                        <td className={td}>{row.days}</td>
                        <td className={td}>
                          {formatMinutes(row.minutes)}
                          {row.ongoingMinutes ? (
                            <span className="block text-[12.5px] text-success">{t(lang, 'ongoingTotal', { time: formatMinutes(row.ongoingMinutes) })}</span>
                          ) : null}
                        </td>
                        <td className={`${td} ${row.lateCount ? 'text-warning' : ''}`}>
                          {row.lateCount ? t(lang, 'lateTotal', { count: row.lateCount, time: formatMinutes(row.lateMinutes) }) : '—'}
                        </td>
                        <td className={`${td} ${row.earlyExitCount ? 'text-warning' : ''}`}>{row.earlyExitCount || '—'}</td>
                        <td className={`${td} ${row.missingExit ? 'text-[#ffb4b5]' : ''}`}>{row.missingExit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {t(lang, 'reportNote', { grace: LATE_GRACE_MIN })} {t(lang, 'autoRefresh')}
                {business.shifts.length ? ` ${t(lang, 'shiftsReadOnly')}: ${business.shifts.map(shiftLabel).join(' · ')}.` : ''}
              </p>

              <div className="mt-8 space-y-8">
                {days.map(({ day, records: dayRecords }) => (
                  <div key={day}>
                    <h3 className="font-display text-[17px] font-semibold first-letter:uppercase text-foreground">{formatDay(day, lang)}</h3>
                    <ul className="mt-3 divide-y divide-white/[0.05]">
                      {dayRecords.map((record) => {
                        const worked = workedMinutes(record);
                        const ongoing = ongoingMinutes(record, now);
                        const shift = inferShift(record, business.shifts);
                        const late = minutesLate(record, business.shifts);
                        const early = minutesEarlyExit(record, business.shifts);
                        return (
                          <li key={record.id} className="py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                              <span className="text-[15px] font-medium text-foreground">{record.employee.name}</span>
                              <span className="text-[14px] tabular-nums text-muted-foreground">
                                {formatClock(new Date(record.clockIn), lang)} →{' '}
                                {record.clockOut ? (
                                  formatClock(new Date(record.clockOut), lang)
                                ) : ongoing !== null ? (
                                  <span className="text-success">{t(lang, 'workingNow', { time: formatMinutes(ongoing) })}</span>
                                ) : (
                                  <span className="text-[#ffb4b5]">{t(lang, 'noExit')}</span>
                                )}
                                {worked !== null ? <span className="text-foreground"> · {formatMinutes(worked)}</span> : null}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[13px]">
                              {shift ? <span className="text-muted-foreground">{t(lang, 'shiftLabel', { shift: shiftLabel(shift) })}</span> : null}
                              {late ? <span className="text-warning">{t(lang, 'arrivedLate', { time: formatMinutes(late) })}</span> : null}
                              {early ? <span className="text-warning">{t(lang, 'leftEarly', { time: formatMinutes(early) })}</span> : null}
                              {record.editedAt ? <span className="text-muted-foreground">{t(lang, 'editedByHand')}</span> : null}
                            </div>
                            {isAdmin ? <RecordEditor businessId={business.id} record={record} lang={lang} /> : null}
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

        {isAdmin ? (
          <>
        {/* Empleados */}
        <section className={card}>
          <h2 className={sectionTitle}>{t(lang, 'employees')}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {active.length === 1 ? t(lang, 'employeesIntroOne') : t(lang, 'employeesIntro', { n: active.length })}
          </p>
          <div className="mt-5 rounded-2xl border border-white/[0.08] p-4">
            <h3 className="mb-4 text-[15px] font-medium text-foreground">{t(lang, 'addEmployee')}</h3>
            <EmployeeForm businessId={business.id} lang={lang} />
          </div>
          <ul className="mt-4 space-y-2">
            {[...active, ...inactive].map((employee) => (
              <li key={employee.id}>
                <details className="rounded-2xl border border-white/[0.06] p-4">
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                    <span className={`text-[15px] font-medium ${employee.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                      {employee.name}
                    </span>
                    <span className={`text-[13px] ${employee.hasPin ? 'text-muted-foreground' : 'text-warning'}`}>
                      {employee.hasPin ? t(lang, 'pinCreated') : t(lang, 'pinMissing')}
                    </span>
                  </summary>
                  <div className="mt-4 space-y-4">
                    <EmployeeForm businessId={business.id} employee={employee} lang={lang} />
                    {employee.hasPin ? <ResetPinButton businessId={business.id} employee={employee} lang={lang} /> : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        {/* Turnos */}
        <section className={card}>
          <h2 className={sectionTitle}>{t(lang, 'shifts')}</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
            {t(lang, 'shiftsIntro')}
            {business.shifts.length === 0 ? ` ${t(lang, 'shiftsEmpty')}` : ''}
          </p>
          <div className="mt-4 max-w-md">
            <ShiftsForm businessId={business.id} shifts={business.shifts} lang={lang} />
          </div>
        </section>

        {/* Tablet */}
        <section className={card}>
          <h2 className={sectionTitle}>{t(lang, 'tabletSection')}</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
            {t(lang, 'tabletSectionIntro')}
          </p>
          <div className="mt-4">
            <KioskLink url={kioskUrl} businessId={business.id} lang={lang} />
          </div>
        </section>

        {/* Jefes */}
        <section className={card}>
          <h2 className={sectionTitle}>{t(lang, 'managers')}</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">{t(lang, 'managersIntro')}</p>
          <ul className="mt-4 space-y-2">
            {managers.length === 0 ? <li className="text-[14px] text-muted-foreground">{t(lang, 'noManagers')}</li> : null}
            {managers.map((manager) => (
              <li key={manager.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.06] px-4 py-3">
                <span className="text-[15px] font-medium text-foreground">{manager.name}</span>
                <DeleteManagerButton businessId={business.id} manager={manager} lang={lang} />
              </li>
            ))}
          </ul>
          <div className="mt-5 max-w-md rounded-2xl border border-white/[0.08] p-4">
            <h3 className="mb-4 text-[15px] font-medium text-foreground">{t(lang, 'addManager')}</h3>
            <ManagerForm businessId={business.id} lang={lang} signInUrl={`${proto}://${host}/entrar`} />
          </div>
        </section>
          </>
        ) : null}
      </div>
    </>
  );
}
