import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS, drawerLeftByLastShift, getOpenShift, listShifts, openAccounts, openShiftCashPayments, shiftSummary } from '@/lib/cash';
import { elapsedMinutes, formatCop, formatDateTime, formatElapsed } from '@/lib/format';
import { AutoRefresh } from '@/components/auto-refresh';
import { CloseShiftForm, LossForm, MovementForm, OpenShiftForm, VoidLossButton } from '@/components/cash-forms';
import { listLosses } from '@/lib/losses';
import { Empty, PageTitle, card, quietButton } from '@/components/ui';
import { getLang } from '@/lib/i18n/server';
import { makeT, type T, type Lang } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function CashPage() {
  const staff = await requireStaff('cash.operate');
  const lang = await getLang();
  const t = makeT(lang);
  const [shift, history, left] = await Promise.all([getOpenShift(staff), listShifts(staff), drawerLeftByLastShift(staff)]);
  const closed = history.filter((h) => h.closedAt);

  if (!shift) {
    return (
      <div className="space-y-6">
        <PageTitle title={t('Caja')} text={t('Sede {location}. La caja está cerrada: ábrela con la base en efectivo para empezar a cobrar.', { location: staff.locationName })} />
        <section className={`${card} max-w-md`}>
          <OpenShiftForm
            suggested={left?.amount}
            hint={
              left
                ? t('Al cerrar el turno anterior ({name}, {date}) quedaron {amount} en la caja.', { name: left.closedBy, date: formatDateTime(left.closedAt, staff.timezone, lang), amount: formatCop(left.amount) })
                : undefined
            }
          />
        </section>
        <ShiftHistory shifts={closed} timeZone={staff.timezone} lang={lang} />
      </div>
    );
  }

  const [summary, accounts, losses, cashPayments] = await Promise.all([shiftSummary(staff, shift.id), openAccounts(staff), listLosses(staff, shift.openedAt, null), openShiftCashPayments(staff)]);
  const s = summary!;
  const now = Date.now();
  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={15_000} />
      <PageTitle
        title={`${t('Caja')} · ${t('Turno {n}', { n: shift.dayNumber })}`}
        text={t('Abierta por {name} · {date} · base {amount}', { name: shift.openedBy, date: formatDateTime(shift.openedAt, staff.timezone, lang), amount: formatCop(shift.openingAmount) })}
      >
        <Link href={`/app/caja/dia?fecha=${shift.day}`} className={quietButton}>
          {t('Cuadre del día')}
        </Link>
      </PageTitle>

      {/* Aviso para el cierre (6 nov 2026, Rigoberto: «las cajeras son muy lentas al cierre: avísales cuánto va para la
          caja y cuánto va de propina»). Las dos cifras grandes, sin cuentas. */}
      <section className="grid gap-3 sm:grid-cols-2" aria-label={t('Para el cierre')}>
        <div className="rounded-[22px] border-2 border-primary/60 bg-primary/10 p-5">
          <p className="text-[14px] font-semibold uppercase tracking-wide text-primary">{t('Debe haber en la caja')}</p>
          <p className="mt-1 font-display text-[40px] font-bold leading-none">{formatCop(s.expectedCash)}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{t('Es lo que queda en la caja después de entregar la propina.')}</p>
        </div>
        <div className="rounded-[22px] border-2 border-success/60 bg-success/10 p-5">
          <p className="text-[14px] font-semibold uppercase tracking-wide text-success">{t('Propina para entregar')}</p>
          <p className="mt-1 font-display text-[40px] font-bold leading-none">{formatCop(s.tips)}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {s.tips
              ? t('{cash} en efectivo + {other} de datáfono y transferencia (sale de la caja).', {
                  cash: formatCop(s.byMethod.cash.tip),
                  other: formatCop(s.byMethod.card.tip + s.byMethod.transfer.tip),
                })
              : t('Todavía no se ha cobrado propina.')}
          </p>
        </div>
        {/* Con números: antes de entregar la propina hay las dos cosas sumadas (6 nov 2026, pregunta de Rigoberto). */}
        {s.tips ? (
          <p className="rounded-[18px] border border-white/[0.1] bg-white/[0.03] px-5 py-3 text-[15px] sm:col-span-2">
            {t('Antes de entregar la propina, en la caja debe haber {before} ({cash} + {tips} de propina). Al sacar la propina quedan {cash}.', {
              before: formatCop(s.expectedCash + s.tips),
              cash: formatCop(s.expectedCash),
              tips: formatCop(s.tips),
            })}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Ventas del turno')} value={formatCop(s.sales)} hint={s.tablesClosed === 1 ? t('1 mesa cerrada') : t('{n} mesas cerradas', { n: s.tablesClosed })} />
        <Stat label={t('Descuentos')} value={formatCop(s.discounts)} hint={s.reversed ? t('Pagos reversados: {amount}', { amount: formatCop(s.reversed) }) : undefined} />
        {METHODS.map((m) => (
          <Stat
            key={m}
            label={t(METHOD_LABEL[m])}
            value={formatCop(s.byMethod[m].amount)}
            hint={`${s.byMethod[m].count === 1 ? t('1 pago') : t('{n} pagos', { n: s.byMethod[m].count })}${s.byMethod[m].tip ? t(' · propina {amount}', { amount: formatCop(s.byMethod[m].tip) }) : ''}`}
          />
        ))}
      </div>

      {/* Renglón por renglón (5 nov 2026, Rigoberto: «en efectivo esperado siento que está muy enredado»). */}
      <section className={`${card} max-w-md`}>
        <h2 className="font-display text-[16px] font-bold">{t('¿De dónde sale el efectivo esperado?')}</h2>
        <dl className="mt-2 space-y-1 text-[14.5px]">
          {(
            [
              [t('Base con que se abrió'), s.shift.openingAmount, ''],
              // La propina se entrega a los meseros: la de efectivo no entra y la de datáfono/transferencia sale de la caja.
              [t('Cobrado en efectivo (sin propina)'), s.byMethod.cash.amount, '+'],
              [t('Propina de datáfono y transferencia (se entrega de la caja)'), s.byMethod.card.tip + s.byMethod.transfer.tip, '−'],
              [t('Entró a la caja'), s.movementsIn, '+'],
              [t('Salió de la caja (pagos y facturas)'), s.movementsOut, '−'],
            ] as [string, number, string][]
          )
            .filter(([, v, sign]) => v > 0 || sign !== '+' && sign !== '−')
            .map(([label, v, sign]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={sign === '−' ? 'text-warning' : ''}>{sign ? `${sign} ` : ''}{formatCop(v)}</dd>
              </div>
            ))}
          <div className="flex justify-between gap-3 border-t border-white/[0.08] pt-1.5 font-bold">
            <dt>{t('Debe haber en la caja')}</dt>
            <dd>{formatCop(s.expectedCash)}</dd>
          </div>
        </dl>
        {s.tips ? <p className="mt-2 text-[12.5px] text-muted-foreground">{t('La propina cobrada ({amount}) se entrega a los meseros: no queda en la caja.', { amount: formatCop(s.tips) })}</p> : null}
        {s.movementsIn || s.movementsOut ? <p className="mt-2 text-[12.5px] text-muted-foreground">{t('El detalle de cada entrada y salida está abajo, en «Entradas y salidas de efectivo».')}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">{t('Cuentas por cobrar')}</h2>
        {accounts.length === 0 ? (
          <Empty>{t('No hay mesas abiertas.')}</Empty>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/app/caja/mesa/${a.id}`}
                  className={`flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3.5 transition hover:border-white/[0.2] ${a.status === 'bill' ? 'border-warning/60' : 'border-white/[0.08]'}`}
                >
                  <span>
                    <span className="font-display text-[17px] font-semibold">{t('Mesa {n}', { n: a.tableNumber })}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {a.status === 'bill' ? t('Pidió la cuenta · ') : ''}
                      {formatElapsed(elapsedMinutes(a.openedAt, now))}
                      {a.paid ? t(' · abonado {amount}', { amount: formatCop(a.paid) }) : ''}
                    </span>
                  </span>
                  <span className="font-display text-[18px] font-bold">{formatCop(a.balance)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Entradas y salidas de efectivo')}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{t('Plata que entra o sale de la caja y no es una venta: cambio, pago a un proveedor, retiro del dueño.')}</p>
          <div className="mt-4">
            <MovementForm />
          </div>
          {s.movements.length ? (
            <ul className="mt-4 divide-y divide-white/[0.06] text-[14px]">
              {s.movements.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {m.reason}
                    <span className="block text-[12.5px] text-muted-foreground">
                      {m.createdBy} · {formatDateTime(m.createdAt, staff.timezone, lang)}
                    </span>
                  </span>
                  <span className={m.kind === 'in' ? 'text-success' : 'text-[#ffb4b5]'}>
                    {m.kind === 'in' ? '+' : '−'}
                    {formatCop(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Pérdidas del día')}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{t('Lo que se rompió o se dañó y no está en el inventario, con lo que costaba. Sale en el informe del cierre.')}</p>
          <div className="mt-4">
            <LossForm />
          </div>
          {losses.length ? (
            <ul className="mt-4 divide-y divide-white/[0.06] text-[14px]">
              {losses.map((l) => (
                <li key={l.id} className={`flex justify-between gap-3 py-2 ${l.voided ? 'opacity-50' : ''}`}>
                  <span className={l.voided ? 'line-through' : ''}>
                    {l.description}
                    <span className="block text-[12.5px] text-muted-foreground">
                      {l.createdBy} · {formatDateTime(l.createdAt, staff.timezone, lang)}
                    </span>
                  </span>
                  <span className="flex items-start gap-3">
                    <span>{formatCop(l.amount)}</span>
                    {l.voided ? null : <VoidLossButton lossId={l.id} />}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Cerrar caja')}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {t('Cuenta el efectivo que hay en la caja (con la base) y escríbelo. Debería haber')} <strong className="text-foreground">{formatCop(s.expectedCash)}</strong>.
            {accounts.length ? t(' Ojo: quedan {n} mesas abiertas; se podrán cobrar en la siguiente caja.', { n: accounts.length }) : ''}
          </p>
          <div className="mt-4">
            <CloseShiftForm expected={s.expectedCash} cashPayments={cashPayments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} timeZone={staff.timezone} />
          </div>
        </section>
      </div>
      <ShiftHistory shifts={closed} timeZone={staff.timezone} lang={lang} />
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`rounded-[22px] border bg-card p-4 ${strong ? 'border-primary/50' : 'border-white/[0.08]'}`}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[22px] font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ShiftHistory({ shifts, timeZone, lang }: { shifts: Awaited<ReturnType<typeof listShifts>>; timeZone: string; lang: Lang }) {
  if (shifts.length === 0) return null;
  const t: T = makeT(lang);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[19px] font-bold">{t('Cajas anteriores')}</h2>
        <Link href={`/app/caja/dia?fecha=${shifts[0].day}`} className={quietButton}>
          {t('Cuadre del día')}
        </Link>
      </div>
      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card">
        {shifts.map((h) => {
          const diff = (h.countedCash ?? 0) - (h.expectedCash ?? 0);
          return (
            <li key={h.id}>
              <Link href={`/app/caja/turno/${h.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px] transition hover:bg-white/[0.03]">
                <span>
                  <strong>{t('Turno {n}', { n: h.dayNumber })}</strong> · {formatDateTime(h.openedAt, timeZone, lang)} → {h.closedAt ? formatDateTime(h.closedAt, timeZone, lang) : ''}
                  <span className="block text-[12.5px] text-muted-foreground">
                    {h.openedBy} → {h.closedBy}
                  </span>
                </span>
                <span className={diff === 0 ? 'text-success' : 'text-warning'}>{diff === 0 ? t('Cuadró') : diff > 0 ? t('Sobraron {amount}', { amount: formatCop(diff) }) : t('Faltaron {amount}', { amount: formatCop(-diff) })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
