import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddRecordForm, ChangeAvatarButton, DeleteManagerButton, EmployeeForm, KioskLink, ManagerForm, RecordEditor, ResetPinButton, ShiftsForm } from '@/components/panel-forms';
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
  bogotaDay,
  workedMinutes,
} from '@/lib/report';
import { getBusiness, listManagers, listRecords, type AttendanceRecord } from '@/lib/store';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, 'reportTitle')} — ${t(lang, 'appName')}` };
}

const sectionTitle = 'font-display text-[22px] font-semibold text-foreground';
const subCard = 'rounded-3xl border border-black/[0.08] bg-black/[0.02] p-4 sm:p-5';
const navButton = 'rounded-full border border-black/[0.12] px-4 py-2 transition hover:bg-black/[0.06]';

const TABS = ['reporte', 'empleados', 'turnos', 'tablet', 'jefes'] as const;
type Tab = (typeof TABS)[number];

/** Iniciales para el circulito de cada persona. */
const initials = (name: string) =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

function Avatar({ name, src, live = false, size = 'size-9' }: { name: string; src?: string; live?: boolean; size?: string }) {
  const ring = live ? 'ring-2 ring-success/70' : 'ring-1 ring-black/[0.06]';
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- dibujo SVG propio, ya en caché
    return <img src={src} alt="" width={36} height={36} loading="lazy" className={`${size} shrink-0 rounded-full ${ring}`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`relative flex ${size} shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-semibold text-primary ${live ? 'ring-2 ring-success/60' : ''}`}
    >
      {initials(name)}
    </span>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const color = tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-3xl border border-black/[0.08] bg-black/[0.02] px-5 py-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-[20px] font-semibold tabular-nums sm:text-[26px] ${color}`}>{value}</p>
    </div>
  );
}
const th = 'px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-muted-foreground';
const td = 'px-4 py-3 text-[14px] text-foreground';
const dateInput =
  'rounded-2xl border border-black/[0.12] bg-black/[0.04] px-3 py-2 text-[14px] text-foreground [color-scheme:light] focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

export default async function AttendanceBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; vista?: string }>;
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
  // Hasta 62 días (lo que permite el reporte); un rango más largo se recorta.
  const asked = isDay(query.hasta) && query.hasta >= from ? query.hasta : addDays(from, 6);
  const to = asked > addDays(from, 61) ? addDays(from, 61) : asked;
  const records = await listRecords(business.id, from, to);
  const now = Date.now();
  const totals = totalsByEmployee(records, business.shifts, now);
  const days = groupByDay(records).reverse();

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3100';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const kioskUrl = `${proto}://${host}/tablet/${business.kioskSecret}`;

  const tab: Tab = isAdmin && TABS.includes(query.vista as Tab) ? (query.vista as Tab) : 'reporte';
  const keepRange = isDay(query.desde) ? `&desde=${from}&hasta=${to}` : '';
  const tabHref = (next: Tab) => `/panel/${id}?vista=${next}${keepRange}`;
  const range = (start: string) => `/panel/${id}?desde=${start}&hasta=${addDays(start, 6)}`;
  const active = business.employees.filter((e) => e.isActive);
  const inactive = business.employees.filter((e) => !e.isActive);

  // Quién está trabajando en este momento (jornadas abiertas de hoy o de anoche), aparte del rango del reporte.
  const today = bogotaDay(new Date(now));
  const openNow: AttendanceRecord[] = (await listRecords(business.id, addDays(today, -1), today)).filter(
    (record) => ongoingMinutes(record, now) !== null,
  );

  const sum = totals.reduce(
    (acc, row) => ({
      minutes: acc.minutes + row.minutes,
      late: acc.late + row.lateCount,
      early: acc.early + row.earlyExitCount,
      missing: acc.missing + row.missingExit,
    }),
    { minutes: 0, late: 0, early: 0, missing: 0 },
  );

  const tabLabels: Record<Tab, string> = {
    reporte: t(lang, 'reportTitle'),
    empleados: `${t(lang, 'employees')} · ${active.length}`,
    turnos: t(lang, 'shifts'),
    tablet: t(lang, 'tabTablet'),
    jefes: t(lang, 'managers'),
  };

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

      {/* En turno ahora */}
      <section className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border border-success/20 bg-success/[0.05] px-5 py-4">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <span className="size-2 rounded-full bg-success shadow-[0_0_10px_#12855b80]" aria-hidden="true" />
          {t(lang, 'workingNowTitle')} · {openNow.length}
        </h2>
        {openNow.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{t(lang, 'nobodyWorking')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {openNow.map((record) => (
              <li key={record.id} className="flex items-center gap-2 rounded-full bg-black/[0.04] py-1 pr-3 pl-1 text-[13.5px]">
                <Avatar name={record.employee.name} src={record.employee.avatar} live />
                <span className="text-foreground">{record.employee.name}</span>
                <span className="text-muted-foreground">{t(lang, 'workingNowSince', { time: formatClock(new Date(record.clockIn), lang) })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <nav aria-label={business.name} className="mt-6 flex flex-wrap gap-1 rounded-3xl border border-black/[0.08] bg-black/[0.02] p-1">
          {TABS.map((key) => (
            <Link
              key={key}
              href={tabHref(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`rounded-full px-3 py-2 text-[14px] font-medium transition sm:px-4 ${
                tab === key ? 'bg-black/[0.06] text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tabLabels[key]}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mt-6">
        {tab === 'reporte' ? (
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={sectionTitle}>
                {formatShortDay(from, lang)} – {formatShortDay(to, lang)}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-[14px]">
                <Link href={range(addDays(from, -7))} className={navButton}>
                  {t(lang, 'previousWeek')}
                </Link>
                {from !== thisWeek.from ? (
                  <Link href={range(thisWeek.from)} className={navButton}>
                    {t(lang, 'thisWeek')}
                  </Link>
                ) : null}
                <Link href={range(addDays(from, 7))} className={navButton}>
                  {t(lang, 'nextWeek')}
                </Link>
                <a
                  href={`/panel/${id}/excel?from=${from}&to=${to}&lang=${lang}`}
                  download
                  className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
                >
                  {t(lang, 'downloadExcel')}
                </a>
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-[14px] text-primary hover:underline">{t(lang, 'chooseDates')}</summary>
              <form method="get" className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl bg-black/[0.03] p-4">
                <label className="space-y-1.5">
                  <span className="block text-[13px] font-medium text-foreground">{t(lang, 'rangeFrom')}</span>
                  <input type="date" name="desde" defaultValue={from} required className={dateInput} />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[13px] font-medium text-foreground">{t(lang, 'rangeTo')}</span>
                  <input type="date" name="hasta" defaultValue={to} min={from} required className={dateInput} />
                </label>
                <button type="submit" className="rounded-full border border-black/[0.14] px-5 py-2.5 text-[14px] transition hover:bg-black/[0.06]">
                  {t(lang, 'showRange')}
                </button>
                <p className="w-full text-[12.5px] text-muted-foreground">{t(lang, 'rangeHint')}</p>
              </form>
            </details>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={t(lang, 'statHours')} value={formatMinutes(sum.minutes)} />
              <Stat label={t(lang, 'statWorkdays')} value={String(records.length)} />
              <Stat label={t(lang, 'statLate')} value={String(sum.late)} tone={sum.late ? 'warning' : 'default'} />
              <Stat label={t(lang, 'statMissingExit')} value={String(sum.missing)} tone={sum.missing ? 'danger' : 'default'} />
            </div>

            {isAdmin && business.employees.length ? (
              <AddRecordForm businessId={business.id} employees={[...active, ...inactive]} lang={lang} />
            ) : null}

            {records.length === 0 ? (
              <p className="mt-5 text-[15px] text-muted-foreground">{t(lang, 'noRecords')}</p>
            ) : (
              <>
                <h3 className="mt-8 font-display text-[18px] font-semibold text-foreground">{t(lang, 'totals')}</h3>
                <div className="mt-3 overflow-x-auto rounded-3xl border border-black/[0.08]">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead className="bg-black/[0.03]">
                      <tr>
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
                        <tr key={row.employeeId} className="border-t border-black/[0.08]">
                          <td className={td}>
                            <span className="flex items-center gap-3">
                              <Avatar name={row.name} src={row.avatar} />
                              {row.name}
                            </span>
                          </td>
                          <td className={`${td} tabular-nums`}>{row.days}</td>
                          <td className={`${td} tabular-nums`}>
                            {formatMinutes(row.minutes)}
                            {row.ongoingMinutes ? (
                              <span className="block text-[12.5px] text-success">{t(lang, 'ongoingTotal', { time: formatMinutes(row.ongoingMinutes) })}</span>
                            ) : null}
                          </td>
                          <td className={`${td} ${row.lateCount ? 'text-warning' : 'text-muted-foreground'}`}>
                            {row.lateCount ? t(lang, 'lateTotal', { count: row.lateCount, time: formatMinutes(row.lateMinutes) }) : '—'}
                          </td>
                          <td className={`${td} ${row.earlyExitCount ? 'text-warning' : 'text-muted-foreground'}`}>{row.earlyExitCount || '—'}</td>
                          <td className={`${td} ${row.missingExit ? 'text-destructive' : 'text-muted-foreground'}`}>{row.missingExit || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[13px] text-muted-foreground">
                  {t(lang, 'reportNote', { grace: LATE_GRACE_MIN })} {t(lang, 'autoRefresh')}
                  {business.shifts.length ? ` ${t(lang, 'shiftsReadOnly')}: ${business.shifts.map(shiftLabel).join(' · ')}.` : ''}
                </p>

                <div className="mt-8 space-y-4">
                  {days.map(({ day, records: dayRecords }) => (
                    <div key={day} className={subCard}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-[17px] font-semibold first-letter:uppercase text-foreground">{formatDay(day, lang)}</h3>
                        <span className="text-[13px] text-muted-foreground">
                          {dayRecords.length === 1 ? t(lang, 'dayWorkdaysOne') : t(lang, 'dayWorkdays', { n: dayRecords.length })}
                        </span>
                      </div>
                      <ul className="mt-3 divide-y divide-black/[0.08]">
                        {dayRecords.map((record) => {
                          const worked = workedMinutes(record);
                          const ongoing = ongoingMinutes(record, now);
                          const shift = inferShift(record, business.shifts);
                          const late = minutesLate(record, business.shifts);
                          const early = minutesEarlyExit(record, business.shifts);
                          return (
                            <li key={record.id} className="flex gap-3 py-3">
                              <Avatar name={record.employee.name} src={record.employee.avatar} live={ongoing !== null} size="size-10" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                  <span className="text-[15px] font-medium text-foreground">{record.employee.name}</span>
                                  <span className="text-[14px] tabular-nums text-muted-foreground">
                                    {formatClock(new Date(record.clockIn), lang)} →{' '}
                                    {record.clockOut ? (
                                      formatClock(new Date(record.clockOut), lang)
                                    ) : ongoing !== null ? (
                                      <span className="text-success">{t(lang, 'workingNow', { time: formatMinutes(ongoing) })}</span>
                                    ) : (
                                      <span className="text-destructive">{t(lang, 'noExit')}</span>
                                    )}
                                    {worked !== null ? <span className="font-medium text-foreground"> · {formatMinutes(worked)}</span> : null}
                                  </span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[12.5px]">
                                  {shift ? (
                                    <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-muted-foreground">{t(lang, 'shiftLabel', { shift: shiftLabel(shift) })}</span>
                                  ) : null}
                                  {late ? (
                                    <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-warning">{t(lang, 'arrivedLate', { time: formatMinutes(late) })}</span>
                                  ) : null}
                                  {early ? (
                                    <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-warning">{t(lang, 'leftEarly', { time: formatMinutes(early) })}</span>
                                  ) : null}
                                </div>
                                {isAdmin ? <RecordEditor businessId={business.id} record={record} lang={lang} /> : null}
                              </div>
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
        ) : null}

        {tab === 'empleados' ? (
          <section className={card}>
            <h2 className={sectionTitle}>{t(lang, 'employees')}</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {active.length === 1 ? t(lang, 'employeesIntroOne') : t(lang, 'employeesIntro', { n: active.length })}
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <ul className="space-y-2 lg:order-1">
                {[...active, ...inactive].map((employee) => (
                  <li key={employee.id}>
                    <details className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-3">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-3">
                          <Avatar name={employee.name} src={employee.avatar} size="size-11" />
                          <span className={`text-[15px] font-medium ${employee.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                            {employee.name}
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[12.5px] ${employee.hasPin ? 'bg-black/[0.05] text-muted-foreground' : 'bg-warning/10 text-warning'}`}
                        >
                          {employee.hasPin ? t(lang, 'pinCreated') : t(lang, 'pinMissing')}
                        </span>
                      </summary>
                      <div className="mt-4 space-y-4 px-1 pb-1">
                        <EmployeeForm businessId={business.id} employee={employee} lang={lang} />
                        <div className="flex flex-wrap gap-2">
                          <ChangeAvatarButton businessId={business.id} employee={employee} lang={lang} />
                          {employee.hasPin ? <ResetPinButton businessId={business.id} employee={employee} lang={lang} /> : null}
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              <div className={`${subCard} h-fit lg:order-2`}>
                <h3 className="mb-4 text-[15px] font-medium text-foreground">{t(lang, 'addEmployee')}</h3>
                <EmployeeForm businessId={business.id} lang={lang} />
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'turnos' ? (
          <section className={card}>
            <h2 className={sectionTitle}>{t(lang, 'shifts')}</h2>
            <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
              {t(lang, 'shiftsIntro')}
              {business.shifts.length === 0 ? ` ${t(lang, 'shiftsEmpty')}` : ''}
            </p>
            <div className="mt-5 max-w-md">
              <ShiftsForm businessId={business.id} shifts={business.shifts} lang={lang} />
            </div>
          </section>
        ) : null}

        {tab === 'tablet' ? (
          <section className={card}>
            <h2 className={sectionTitle}>{t(lang, 'tabletSection')}</h2>
            <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">{t(lang, 'tabletSectionIntro')}</p>
            <div className="mt-5">
              <KioskLink url={kioskUrl} businessId={business.id} lang={lang} />
            </div>
          </section>
        ) : null}

        {tab === 'jefes' ? (
          <section className={card}>
            <h2 className={sectionTitle}>{t(lang, 'managers')}</h2>
            <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">{t(lang, 'managersIntro')}</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <ul className="space-y-2">
                {managers.length === 0 ? <li className="text-[14px] text-muted-foreground">{t(lang, 'noManagers')}</li> : null}
                {managers.map((manager) => (
                  <li key={manager.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/[0.08] bg-black/[0.02] px-3 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar name={manager.name} />
                      <span className="text-[15px] font-medium text-foreground">{manager.name}</span>
                    </span>
                    <DeleteManagerButton businessId={business.id} manager={manager} lang={lang} />
                  </li>
                ))}
              </ul>
              <div className={`${subCard} h-fit`}>
                <h3 className="mb-4 text-[15px] font-medium text-foreground">{t(lang, 'addManager')}</h3>
                <ManagerForm businessId={business.id} lang={lang} signInUrl={`${proto}://${host}/entrar`} />
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
