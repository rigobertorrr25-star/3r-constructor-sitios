import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddRecordForm, AvatarControls, DeleteManagerButton, EmployeeForm, KioskLink, ManagerForm, RecordEditor, ResetPinButton, ShiftsForm } from '@/components/panel-forms';
import { AutoRefresh } from '@/components/auto-refresh';
import { card, darkButton, glassDark, quietButton } from '@/components/ui';
import { AlarmClock, BarChart3, CalendarCheck, Clock3, DoorOpen, Download, QrCode, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { canView, requireViewer } from '@/lib/auth';
import { locale, t } from '@/lib/i18n';
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
  greetingKey,
  workedMinutes,
} from '@/lib/report';
import { getBusiness, listManagers, listRecords, type AttendanceRecord } from '@/lib/store';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, 'reportTitle')} — ${t(lang, 'appName')}` };
}

const sectionTitle = 'font-display text-[22px] font-semibold text-foreground';
const subCard = 'rounded-3xl border border-white/70 bg-white/45 p-4 sm:p-5';

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

function Stat({ icon: Icon, label, value, tone = 'default' }: { icon: LucideIcon; label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const color = tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <div className={`${card} lift !p-5`}>
      <span className="flex size-9 items-center justify-center rounded-full bg-white/80 text-foreground shadow-sm">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <p className={`mt-4 font-display text-[22px] leading-none font-bold whitespace-nowrap tabular-nums sm:text-[26px] ${color}`}>{value}</p>
      <p className="mt-2 text-[13px] font-medium text-foreground/75">{label}</p>
    </div>
  );
}

const th = 'px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-muted-foreground';
const td = 'px-4 py-3 text-[14px] text-foreground';
const dateInput =
  'rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-[14px] text-foreground [color-scheme:light] focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

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


  const greeting = t(lang, greetingKey(new Date(now)));
  const todayLabel = formatDay(today, lang);

  // Horas por día (solo jornadas con salida) y puntualidad, para las dos gráficas del reporte.
  const dayList: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) dayList.push(day);
  const minutesByDay = new Map<string, number>();
  let withShift = 0;
  let lateArrivals = 0;
  for (const record of records) {
    const day = bogotaDay(new Date(record.clockIn));
    const worked = workedMinutes(record);
    if (worked !== null) minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + worked);
    if (inferShift(record, business.shifts)) {
      withShift += 1;
      if (minutesLate(record, business.shifts)) lateArrivals += 1;
    }
  }
  const barDay = new Intl.DateTimeFormat(locale(lang), { weekday: 'short', day: 'numeric', timeZone: 'America/Bogota' });
  const maxDayMinutes = Math.max(60, ...dayList.map((day) => minutesByDay.get(day) ?? 0));
  const onTimePct = withShift ? Math.round(((withShift - lateArrivals) / withShift) * 100) : null;

  const navIcons: Record<Tab, typeof BarChart3> = { reporte: BarChart3, empleados: Users, turnos: Clock3, tablet: QrCode, jefes: ShieldCheck };
  const navLabels: Record<Tab, string> = {
    reporte: t(lang, 'reportTitle'),
    empleados: t(lang, 'employees'),
    turnos: t(lang, 'shifts'),
    tablet: t(lang, 'tabTablet'),
    jefes: t(lang, 'managers'),
  };

  return (
    <>
      <AutoRefresh />
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Menú lateral (en computador) */}
        <aside className={`${glassDark} hidden h-fit flex-col gap-1 p-3 lg:sticky lg:top-4 lg:flex`}>
          {isAdmin ? (
            <Link href="/panel" className="mb-1 rounded-xl px-3 py-2 text-[13px] text-white/60 transition hover:bg-white/10 hover:text-white">
              {t(lang, 'backToBusinesses')}
            </Link>
          ) : null}
          <p className="px-3 pt-1 text-[11px] font-semibold tracking-[0.12em] text-white/45 uppercase">{t(lang, 'navBusiness')}</p>
          <div className="flex items-center gap-3 rounded-2xl px-3 py-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 font-display text-[15px] font-bold">{business.name.trim()[0]?.toUpperCase()}</span>
            <span className="min-w-0 truncate text-[14px] font-semibold">{business.name}</span>
          </div>
          <p className="mt-2 px-3 pt-1 text-[11px] font-semibold tracking-[0.12em] text-white/45 uppercase">{t(lang, 'navSection')}</p>
          <nav aria-label={business.name} className="flex flex-col gap-1">
            {(isAdmin ? TABS : (['reporte'] as const)).map((key) => {
              const Icon = navIcons[key];
              return (
                <Link
                  key={key}
                  href={tabHref(key)}
                  aria-current={tab === key ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${
                    tab === key ? 'bg-[#1aa3d9] font-medium text-white shadow-[0_8px_20px_-8px_#1aa3d9]' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  <span className="flex-1">{navLabels[key]}</span>
                  {key === 'empleados' ? (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] tabular-nums">{active.length}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <p className="flex items-center justify-between text-[12.5px] text-white/80">
              <span>{t(lang, 'workingNowTitle')}</span>
              <span className="tabular-nums text-white/60">{t(lang, 'activeNowOf', { n: openNow.length, total: active.length })}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#5ee0c0]" style={{ width: `${active.length ? Math.round((openNow.length / active.length) * 100) : 0}%` }} />
            </div>
          </div>
        </aside>

        {/* Panel principal de vidrio */}
        <div className="min-w-0 rounded-[32px] border border-white/40 bg-white/25 p-3 shadow-[var(--shadow-glass)] backdrop-blur-2xl sm:p-7">
          {isAdmin ? (
            <Link href="/panel" className="text-[13px] text-foreground/70 transition hover:text-foreground lg:hidden">
              {t(lang, 'backToBusinesses')}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[30px] leading-tight font-bold tracking-tight text-foreground sm:text-[34px]">
                {viewer.role === 'manager' ? t(lang, 'greetingName', { greeting, name: viewer.name }) : greeting}
              </h1>
              <p className="mt-1 text-[14px] text-foreground/70 first-letter:uppercase">
                {business.name} · {t(lang, 'greetingSub', { date: todayLabel, n: openNow.length })}
              </p>
            </div>
            {tab === 'reporte' ? (
              <a href={`/panel/${id}/excel?from=${from}&to=${to}&lang=${lang}`} download className={darkButton}>
                <Download className="size-4" aria-hidden="true" />
                {t(lang, 'downloadExcel')}
              </a>
            ) : null}
          </div>

          {/* Pestañas (en celular y tablet) */}
          {isAdmin ? (
            <nav aria-label={business.name} className="mt-5 flex gap-1 overflow-x-auto rounded-full border border-white/60 bg-white/40 p-1 lg:hidden">
              {TABS.map((key) => (
                <Link
                  key={key}
                  href={tabHref(key)}
                  aria-current={tab === key ? 'page' : undefined}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition ${
                    tab === key ? 'bg-[var(--ink)] text-white' : 'text-foreground/70 hover:text-foreground'
                  }`}
                >
                  {navLabels[key]}
                </Link>
              ))}
            </nav>
          ) : null}

          {/* En turno ahora */}
          <section className={`${card} mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 !p-4`}>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
              <span className="size-2 rounded-full bg-success shadow-[0_0_10px_#0f7a5580]" aria-hidden="true" />
              {t(lang, 'workingNowTitle')} · {openNow.length}
            </h2>
            {openNow.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">{t(lang, 'nobodyWorking')}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {openNow.map((record) => (
                  <li key={record.id} className="flex items-center gap-2 rounded-full bg-white/60 py-1 pr-3 pl-1 text-[13.5px]">
                    <Avatar name={record.employee.name} src={record.employee.avatar} live />
                    <span className="text-foreground">{record.employee.name}</span>
                    <span className="text-muted-foreground">{t(lang, 'workingNowSince', { time: formatClock(new Date(record.clockIn), lang) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

      <div className="mt-5">
        {tab === 'reporte' ? (
          <section className="space-y-5">
            <div className={`${card} flex flex-wrap items-center justify-between gap-3 !p-4`}>
              <h2 className="font-display text-[19px] font-semibold text-foreground">
                {formatShortDay(from, lang)} – {formatShortDay(to, lang)}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-[14px]">
                <Link href={range(addDays(from, -7))} className={quietButton}>
                  {t(lang, 'previousWeek')}
                </Link>
                {from !== thisWeek.from ? (
                  <Link href={range(thisWeek.from)} className={quietButton}>
                    {t(lang, 'thisWeek')}
                  </Link>
                ) : null}
                <Link href={range(addDays(from, 7))} className={quietButton}>
                  {t(lang, 'nextWeek')}
                </Link>
              </div>
              <details className="w-full">
                <summary className="cursor-pointer text-[14px] text-primary hover:underline">{t(lang, 'chooseDates')}</summary>
                <form method="get" className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl bg-white/50 p-4">
                  <label className="space-y-1.5">
                    <span className="block text-[13px] font-medium text-foreground">{t(lang, 'rangeFrom')}</span>
                    <input type="date" name="desde" defaultValue={from} required className={dateInput} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-[13px] font-medium text-foreground">{t(lang, 'rangeTo')}</span>
                    <input type="date" name="hasta" defaultValue={to} min={from} required className={dateInput} />
                  </label>
                  <button type="submit" className={darkButton}>
                    {t(lang, 'showRange')}
                  </button>
                  <p className="w-full text-[12.5px] text-muted-foreground">{t(lang, 'rangeHint')}</p>
                </form>
              </details>
            </div>

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat icon={Clock3} label={t(lang, 'statHours')} value={formatMinutes(sum.minutes)} />
              <Stat icon={CalendarCheck} label={t(lang, 'statWorkdays')} value={String(records.length)} />
              <Stat icon={AlarmClock} label={t(lang, 'statLate')} value={String(sum.late)} tone={sum.late ? 'warning' : 'default'} />
              <Stat icon={DoorOpen} label={t(lang, 'statMissingExit')} value={String(sum.missing)} tone={sum.missing ? 'danger' : 'default'} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className={`${card} lift`}>
                <h3 className="text-[15px] font-semibold text-foreground">{t(lang, 'hoursByDay')}</h3>
                <p className="text-[12.5px] text-muted-foreground">{t(lang, 'hoursByDaySub')}</p>
                <div className="mt-5 flex h-48 items-end gap-1.5 sm:gap-3" role="img" aria-label={t(lang, 'hoursByDay')}>
                  {dayList.map((day) => {
                    const minutes = minutesByDay.get(day) ?? 0;
                    const isToday = day === today;
                    return (
                      <div key={day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                        {minutes && dayList.length <= 14 ? (
                          <span className="text-[11px] font-semibold whitespace-nowrap tabular-nums text-foreground/80">{Math.round(minutes / 60)} h</span>
                        ) : null}
                        <div
                          title={`${formatShortDay(day, lang)}: ${formatMinutes(minutes)}`}
                          className={`w-full max-w-[44px] rounded-t-xl rounded-b-md ${isToday ? 'bg-[#1aa3d9]' : 'bg-[#1aa3d9]/45'}`}
                          style={{ height: `${Math.max(3, (minutes / maxDayMinutes) * 100)}%` }}
                        />
                        <span className="text-[11px] whitespace-nowrap text-muted-foreground">{dayList.length <= 14 ? barDay.format(new Date(`${day}T12:00:00-05:00`)) : day.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`${card} lift`}>
                <h3 className="text-[15px] font-semibold text-foreground">{t(lang, 'punctuality')}</h3>
                <p className="text-[12.5px] text-muted-foreground">{t(lang, 'punctualitySub')}</p>
                <div className="mt-5 flex flex-col items-center">
                  <div
                    className="relative flex size-40 items-center justify-center rounded-full"
                    style={{ background: `conic-gradient(#1aa3d9 ${(onTimePct ?? 0) * 3.6}deg, #ffffff99 0deg)` }}
                    role="img"
                    aria-label={`${t(lang, 'punctuality')}: ${onTimePct ?? 0}%`}
                  >
                    <div className="flex size-[124px] flex-col items-center justify-center rounded-full bg-white/85">
                      <span className="font-display text-[30px] font-bold tabular-nums text-foreground">{onTimePct === null ? '—' : `${onTimePct}%`}</span>
                      <span className="text-[12px] text-muted-foreground">{t(lang, 'onTime')}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid w-full grid-cols-2 gap-2 text-center text-[13px]">
                    <span className="rounded-2xl bg-white/60 px-2 py-2 text-foreground">{t(lang, 'onTimeCount', { n: withShift - lateArrivals })}</span>
                    <span className="rounded-2xl bg-white/60 px-2 py-2 text-warning">{t(lang, 'lateCount', { n: lateArrivals })}</span>
                  </div>
                </div>
              </div>
            </div>

            {isAdmin && business.employees.length ? (
              <AddRecordForm businessId={business.id} employees={[...active, ...inactive]} lang={lang} />
            ) : null}

            {records.length === 0 ? (
              <p className={`${card} text-[15px] text-muted-foreground`}>{t(lang, 'noRecords')}</p>
            ) : (
              <>
                <div className={card}>
                <h3 className="font-display text-[18px] font-semibold text-foreground">{t(lang, 'totals')}</h3>
                <div className="mt-3 overflow-x-auto rounded-3xl border border-white/70 bg-white/40">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead className="bg-white/50">
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
                        <tr key={row.employeeId} className="border-t border-white/70">
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
                </div>

                <div className="space-y-4">
                  {days.map(({ day, records: dayRecords }) => (
                    <div key={day} className={card}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-[17px] font-semibold first-letter:uppercase text-foreground">{formatDay(day, lang)}</h3>
                        <span className="text-[13px] text-muted-foreground">
                          {dayRecords.length === 1 ? t(lang, 'dayWorkdaysOne') : t(lang, 'dayWorkdays', { n: dayRecords.length })}
                        </span>
                      </div>
                      <ul className="mt-3 divide-y divide-white/70">
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
                                    <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-muted-foreground">{t(lang, 'shiftLabel', { shift: shiftLabel(shift) })}</span>
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
                    <details className="rounded-2xl border border-white/70 bg-white/45 p-3">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-3">
                          <Avatar name={employee.name} src={employee.avatar} size="size-11" />
                          <span className={`text-[15px] font-medium ${employee.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                            {employee.name}
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[12.5px] ${employee.hasPin ? 'bg-white/70 text-muted-foreground' : 'bg-warning/10 text-warning'}`}
                        >
                          {employee.hasPin ? t(lang, 'pinCreated') : t(lang, 'pinMissing')}
                        </span>
                      </summary>
                      <div className="mt-4 space-y-4 px-1 pb-1">
                        <AvatarControls businessId={business.id} employee={employee} lang={lang} />
                        <EmployeeForm businessId={business.id} employee={employee} lang={lang} />
                        {employee.hasPin ? <ResetPinButton businessId={business.id} employee={employee} lang={lang} /> : null}
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
                  <li key={manager.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/70 bg-white/45 px-3 py-3">
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
        </div>
      </div>
    </>
  );
}
