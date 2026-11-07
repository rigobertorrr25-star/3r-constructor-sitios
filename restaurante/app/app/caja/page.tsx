import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS, drawerLeftByLastShift, getOpenShift, listShifts, openAccounts, openShiftCashPayments, shiftSummary, workMode } from '@/lib/cash';
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
    const { noBase } = await workMode(staff.businessId);
    return (
      <div className="space-y-6">
        <PageTitle
          title={t('Caja')}
          text={
            noBase
              ? t('Sede {location}. La caja está cerrada: ábrela para empezar a cobrar.', { location: staff.locationName })
              : t('Sede {location}. La caja está cerrada: ábrela con la base en efectivo para empezar a cobrar.', { location: staff.locationName })
          }
        />
        <section className={`${card} max-w-md`}>
          <OpenShiftForm
            noBase={noBase}
            suggested={left?.amount}
            hint={
              left && !noBase
                ? t('Al cerrar el turno anterior ({name}, {date}) quedaron {amount} en la caja.', { name: left.closedBy, date: formatDateTime(left.closedAt, staff.timezone, lang), amount: formatCop(left.amount) })
                : undefined
            }
          />
        </section>
        <ShiftHistory shifts={closed} timeZone={staff.timezone} lang={lang} />
      </div>
    );
  }

  const [summary, accounts, losses, cashPayments, { cashOnly }] = await Promise.all([
    shiftSummary(staff, shift.id),
    openAccounts(staff),
    listLosses(staff, shift.openedAt, null),
    openShiftCashPayments(staff),
    workMode(staff.businessId),
  ]);
  const s = summary!;
  const now = Date.now();
  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={15_000} />
      <PageTitle
        title={`${t('Caja')} · ${t('Turno {n}', { n: shift.dayNumber })}`}
        text={shift.openingAmount ? t('Abierta por {name} · {date} · base {amount}', { name: shift.openedBy, date: formatDateTime(shift.openedAt, staff.timezone, lang), amount: formatCop(shift.openingAmount) }) : t('Abierta por {name} · {date}', { name: shift.openedBy, date: formatDateTime(shift.openedAt, staff.timezone, lang) })}
      >
        <Link href={`/app/caja/dia?fecha=${shift.day}`} className={quietButton}>
          {t('Cuadre del día')}
        </Link>
      </PageTitle>

      {/* Para el cierre, en cuadros separados (6 nov 2026, Rigoberto: «pon en un cuadro la base, en otro la venta; arma la
          propina y di de dónde sale; la transferencia con el total y la propina descontada»). Cada peso aparece una vez. */}
      <section className="space-y-3" aria-label={t('Para el cierre')}>
        <div className={`grid gap-3 sm:grid-cols-2 ${cashOnly ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {s.shift.openingAmount ? <Box tone="amber" title={t('Base')} value={formatCop(s.shift.openingAmount)} lines={[t('Con lo que se abrió la caja.')]} /> : null}
          <Box
            tone="sky"
            title={t('Venta')}
            value={formatCop(s.sales)}
            lines={
              cashOnly
                ? [t('Todo en efectivo.'), t('Sin propina.')]
                : [
                    `${t('Efectivo')}: ${formatCop(s.byMethod.cash.amount)}`,
                    `${t('Datáfono')}: ${formatCop(s.byMethod.card.amount)}`,
                    `${t('Transferencia')}: ${formatCop(s.byMethod.transfer.amount)}`,
                    t('Sin propina.'),
                  ]
            }
          />
          <Box
            tone="green"
            title={t('Propina')}
            value={formatCop(s.tips)}
            lines={
              cashOnly
                ? [t('La pagaron los clientes en efectivo: está en la caja.'), t('Se entrega toda a los meseros.')]
                : [
                    `${t('Efectivo')}: ${formatCop(s.byMethod.cash.tip)} · ${t('ya está en la caja')}`,
                    `${t('Datáfono')}: ${formatCop(s.byMethod.card.tip)} · ${t('se saca de la caja')}`,
                    `${t('Transferencia')}: ${formatCop(s.byMethod.transfer.tip)} · ${t('se saca de la caja')}`,
                    t('Se entrega toda a los meseros.'),
                  ]
            }
          />
          {cashOnly ? null : (
            <Box
              tone="red"
              title={t('Transferencia')}
              value={formatCop(s.byMethod.transfer.amount)}
              lines={[
                `${t('Total que llegó')}: ${formatCop(s.byMethod.transfer.amount + s.byMethod.transfer.tip)}`,
                `− ${t('propina')}: ${formatCop(s.byMethod.transfer.tip)}`,
                `= ${t('venta')}: ${formatCop(s.byMethod.transfer.amount)}`,
                t('Revisa que haya llegado a la cuenta.'),
              ]}
            />
          )}
        </div>
        {/* La base va totalmente aparte del efectivo de la venta (8 nov 2026, Rigoberto: «no metas la base en la venta,
            déjala aparte, para que el efectivo de la venta quede libre y no se enrede»). */}
        <div className="rounded-[22px] border-2 border-primary/60 bg-primary/10 p-5">
          <p className="text-[14px] font-semibold uppercase tracking-wide text-primary">{t('Efectivo de la venta')}</p>
          <p className="mt-1 font-display text-[44px] font-bold leading-none">{formatCop(s.expectedCash - s.shift.openingAmount)}</p>
          <p className="mt-3 text-[15px] font-medium">
            {[
              `${t('Venta en efectivo')} ${formatCop(s.byMethod.cash.amount)}`,
              s.movementsIn ? `+ ${t('entradas')} ${formatCop(s.movementsIn)}` : '',
              s.movementsOut ? `− ${t('salidas')} ${formatCop(s.movementsOut)}` : '',
              s.usd.pesos ? `− ${t('pagado en dólares')} ${formatCop(s.usd.pesos)}` : '',
              s.byMethod.card.tip + s.byMethod.transfer.tip ? `− ${t('propina de datáfono y transferencia')} ${formatCop(s.byMethod.card.tip + s.byMethod.transfer.tip)}` : '',
            ]
              .filter(Boolean)
              .join(' ')}{' '}
            = {formatCop(s.expectedCash - s.shift.openingAmount)}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('Sin la base y ya con toda la propina entregada a los meseros.')}</p>
          {s.shift.openingAmount ? (
            <p className="mt-3 rounded-2xl border border-[#f4b740]/50 bg-[#f4b740]/10 px-4 py-2.5 text-[15px] font-medium">
              {t('Aparte, la base: {base}. Al contar la caja completa (venta + base) deben ser {total}.', { base: formatCop(s.shift.openingAmount), total: formatCop(s.expectedCash) })}
            </p>
          ) : null}
          {s.usd.dollars ? (
            // Dólares recibidos (8 nov 2026): se cuentan aparte de los pesos.
            <p className="mt-3 rounded-2xl border border-[#4cc9f0]/50 bg-[#4cc9f0]/10 px-4 py-2.5 text-[16px] font-semibold">
              {t('Además, en dólares: US$ {usd} (recibidos por {cop})', { usd: s.usd.dollars, cop: formatCop(s.usd.pesos) })}
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Mesas cerradas')} value={String(s.tablesClosed)} />
        <Stat label={t('Descuentos')} value={formatCop(s.discounts)} hint={s.reversed ? t('Pagos reversados: {amount}', { amount: formatCop(s.reversed) }) : undefined} />
      </div>


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
            {s.shift.openingAmount ? t('Cuenta el efectivo que hay en la caja (con la base) y escríbelo. Debería haber') : t('Cuenta el efectivo que hay en la caja y escríbelo. Debería haber')} <strong className="text-foreground">{formatCop(s.expectedCash)}</strong>.
            {accounts.length ? t(' Ojo: quedan {n} mesas abiertas; se podrán cobrar en la siguiente caja.', { n: accounts.length }) : ''}
          </p>
          <div className="mt-4">
            <CloseShiftForm expected={s.expectedCash} expectedUsd={s.usd.dollars} cashPayments={cashPayments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} timeZone={staff.timezone} />
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

function Box({ tone, title, value, lines }: { tone: 'amber' | 'sky' | 'green' | 'red'; title: string; value: string; lines: string[] }) {
  // Un color por cuadro (6 nov 2026, pedido de Rigoberto): base ámbar, venta azul claro, propina verde, transferencia roja.
  const style = {
    amber: 'border-[#f5b942]/70 bg-[#f5b942]/10',
    sky: 'border-[#4cc9f0]/70 bg-[#4cc9f0]/10',
    green: 'border-success/60 bg-success/10',
    red: 'border-[#ff6b6b] bg-[#ff6b6b]/12',
  }[tone];
  const head = { amber: 'text-[#f5b942]', sky: 'text-[#4cc9f0]', green: 'text-success', red: 'text-[#ff8a8a]' }[tone];
  return (
    <div className={`rounded-[22px] border-2 p-5 ${style}`}>
      <p className={`text-[14px] font-semibold uppercase tracking-wide ${head}`}>{title}</p>
      <p className={`mt-1 font-display text-[34px] font-bold leading-none ${tone === 'red' ? 'text-[#ff8a8a]' : ''}`}>{value}</p>
      <ul className="mt-3 space-y-0.5 text-[13.5px]">
        {lines.map((l, i) => (
          <li key={i} className={i === lines.length - 1 ? 'pt-1 text-[12.5px] text-muted-foreground' : ''}>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
