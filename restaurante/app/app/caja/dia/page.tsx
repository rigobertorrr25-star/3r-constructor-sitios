import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS, dayShifts, workMode } from '@/lib/cash';
import { dayTotals, shiftDifference } from '@/lib/cash-day';
import { tipOfSales } from '@/lib/closing-report';
import { todayIn } from '@/lib/finance';
import { formatCop, formatDateTime, formatTime } from '@/lib/format';
import { addDays } from '@/lib/periods';
import { PrintDayButton } from '@/components/printer-forms';
import { Empty, PageTitle, card, inputClass, quietButton } from '@/components/ui';
import { getLang } from '@/lib/i18n/server';
import { makeT, type T } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Cuadre del día (30 oct 2026, pedido de Rigoberto: «como las cajeras tienen dos horarios, quiero dos cuadres de caja en
// el día»): cada turno con su cuadre y el total del día.
export default async function DayClosingPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const staff = await requireStaff('cash.operate');
  const lang = await getLang();
  const t = makeT(lang);
  const sp = await searchParams;
  const today = todayIn(staff.timezone);
  const day = sp.fecha && DATE.test(sp.fecha) && sp.fecha <= today ? sp.fecha : today;
  const [shifts, { suggestedTip }] = await Promise.all([dayShifts(staff, day), workMode(staff.businessId)]);
  const totals = dayTotals(shifts);
  const longDate = new Date(`${day}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const dateLabel = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const result = (diff: number) => (diff === 0 ? t('Cuadra') : diff > 0 ? t('Sobran {amount}', { amount: formatCop(diff) }) : t('Faltan {amount}', { amount: formatCop(-diff) }));
  const rows: [string, string, boolean?][] = [
    ...METHODS.map((m): [string, string] => [`${t(METHOD_LABEL[m])} (${totals.byMethod[m].count})`, formatCop(totals.byMethod[m].amount)]),
    [t('Ventas'), formatCop(totals.sales), true],
    ...(suggestedTip > 0 ? [[t('Propina ({pct} % de ventas)', { pct: suggestedTip }), formatCop(tipOfSales(totals.sales, suggestedTip)), true] as [string, string, boolean]] : []),
    [suggestedTip > 0 ? t('Propinas cobradas') : t('Propinas'), formatCop(totals.tips)],
    [t('Descuentos'), formatCop(totals.discounts)],
    [t('Entradas de efectivo'), formatCop(totals.movementsIn)],
    [t('Salidas de efectivo'), formatCop(totals.movementsOut)],
    [t('Sobre para la cocina'), formatCop(totals.envelopeKitchen)],
    [t('Sobre para el bar'), formatCop(totals.envelopeBar)],
    [t('Caja fuerte'), formatCop(totals.safeAmount)],
  ];

  return (
    <div className="space-y-6">
      <Link href="/app/caja" className="text-[14px] text-muted-foreground hover:text-foreground">
        ← {t('Caja')}
      </Link>
      <PageTitle title={t('Cuadre del día')} text={t('Cada cajera cierra su turno con su cuadre; aquí se suman los turnos del día.')}>
        {shifts.length ? <PrintDayButton date={day} /> : null}
      </PageTitle>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/app/caja/dia?fecha=${addDays(day, -1)}`} className={quietButton}>
          ← {t('Día anterior')}
        </Link>
        {day < today ? (
          <Link href={`/app/caja/dia?fecha=${addDays(day, 1)}`} className={quietButton}>
            {t('Día siguiente')} →
          </Link>
        ) : null}
        <form action="/app/caja/dia" className="flex items-center gap-1.5">
          <label htmlFor="dia-fecha" className="sr-only">
            {t('Otro día')}
          </label>
          <input id="dia-fecha" type="date" name="fecha" defaultValue={day} max={today} className={`${inputClass} !w-auto py-1.5`} />
          <button type="submit" className={quietButton}>
            {t('Ver')}
          </button>
        </form>
        <span className="text-[14px] text-muted-foreground">{dateLabel}</span>
      </div>

      {shifts.length === 0 ? (
        <Empty>{t('Ese día no hubo caja.')}</Empty>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {shifts.map((s) => {
              const diff = shiftDifference(s);
              return (
                <li key={s.shift.id}>
                  <Link href={`/app/caja/turno/${s.shift.id}`} className={`${card} block !p-5 transition hover:border-white/[0.2]`}>
                    <TurnHeader t={t} n={s.shift.dayNumber} who={s.shift.closedBy && s.shift.closedBy !== s.shift.openedBy ? `${s.shift.openedBy} → ${s.shift.closedBy}` : s.shift.openedBy} />
                    <p className="text-[13px] text-muted-foreground">
                      {formatTime(s.shift.openedAt, staff.timezone, lang)} –{' '}
                      {s.shift.closedAt
                        ? // Si cerró al día siguiente, con la fecha.
                          todayIn(staff.timezone, s.shift.closedAt) === s.shift.day
                          ? formatTime(s.shift.closedAt, staff.timezone, lang)
                          : formatDateTime(s.shift.closedAt, staff.timezone, lang)
                        : t('Sigue abierta')}
                    </p>
                    <dl className="mt-3 space-y-1 text-[14px]">
                      <Row label={t('Base')} value={formatCop(s.shift.openingAmount)} />
                      <Row label={t('Ventas')} value={formatCop(s.sales)} />
                      <Row label={t('Efectivo esperado')} value={formatCop(s.shift.expectedCash ?? s.expectedCash)} />
                      <Row label={t('Efectivo contado')} value={s.shift.countedCash === null ? '—' : formatCop(s.shift.countedCash)} />
                    </dl>
                    <p className={`mt-2 text-[15px] font-semibold ${diff === null ? 'text-muted-foreground' : diff === 0 ? 'text-success' : 'text-warning'}`}>
                      {diff === null ? t('Sigue abierta') : result(diff)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>

          <section className={`${card} max-w-xl`}>
            <h2 className="font-display text-[19px] font-bold">{t('Total del día')}</h2>
            <dl className="mt-3 space-y-1 text-[14.5px]">
              {rows.map(([label, value, strong]) => (
                <Row key={label} label={label} value={value} strong={strong} />
              ))}
            </dl>
            {/* Mientras ningún turno se ha cerrado no hay nada que cuadrar todavía. */}
            <p
              className={`mt-3 border-t border-white/[0.06] pt-3 text-[17px] font-bold ${totals.open === totals.turns ? 'text-muted-foreground' : totals.difference === 0 ? 'text-success' : 'text-warning'}`}
            >
              {totals.open === totals.turns ? t('Sigue abierta') : result(totals.difference)}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {totals.tablesClosed === 1 ? t('1 mesa cerrada') : t('{n} mesas cerradas', { n: totals.tablesClosed })}
              {totals.open ? ` · ${totals.open === 1 ? t('Ojo: 1 turno sigue abierto.') : t('Ojo: {n} turnos siguen abiertos.', { n: totals.open })}` : ''}
            </p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">{t('La base y el efectivo esperado no se suman: la base de un turno es lo que dejó el anterior en la caja.')}</p>
          </section>
        </>
      )}
    </div>
  );
}

function TurnHeader({ t, n, who }: { t: T; n: number; who: string }) {
  return (
    <p className="font-display text-[18px] font-bold">
      {t('Turno {n}', { n })} <span className="text-[15px] font-medium text-muted-foreground">· {who}</span>
    </p>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-semibold' : ''}`}>
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
