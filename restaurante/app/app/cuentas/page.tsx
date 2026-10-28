import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL } from '@/lib/cash';
import { todayIn } from '@/lib/finance';
import { elapsedMinutes, formatCop, formatElapsed, formatTime } from '@/lib/format';
import { addDays } from '@/lib/periods';
import { tableAccounts, type TableAccount } from '@/lib/table-accounts';
import { AutoRefresh } from '@/components/auto-refresh';
import { Empty, PageTitle, inputClass, quietButton } from '@/components/ui';
import { getLang } from '@/lib/i18n/server';
import { makeT, type T } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Mesas del día: todas las por cobrar y las cobradas del día, con quién las atendió (28 oct 2026, pedido de Rigoberto).
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ dia?: string; mesero?: string }> }) {
  const staff = await requireStaff('cash.operate');
  const lang = await getLang();
  const t = makeT(lang);
  const sp = await searchParams;
  const today = todayIn(staff.timezone);
  const day = sp.dia && DATE.test(sp.dia) && sp.dia <= today ? sp.dia : today;
  const data = await tableAccounts(staff, day, staff.timezone);
  const waiter = data.waiters.find((w) => w.id === sp.mesero) ?? null;
  const mine = (a: TableAccount) => !waiter || a.waiters.some((w) => w.id === waiter.id);
  const pending = data.pending.filter(mine);
  const collected = data.collected.filter(mine);
  const link = (patch: { dia?: string; mesero?: string | null }) => {
    const p = new URLSearchParams();
    const d = patch.dia ?? day;
    if (d !== today) p.set('dia', d);
    const m = patch.mesero === undefined ? waiter?.id : patch.mesero;
    if (m) p.set('mesero', m);
    const q = p.toString();
    return q ? `/app/cuentas?${q}` : '/app/cuentas';
  };
  const yesterday = addDays(today, -1);
  const longDate = new Date(`${day}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const dateLabel = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const pendingTotal = pending.reduce((s, a) => s + a.balance, 0);
  const collectedTotal = collected.reduce((s, a) => s + a.paid, 0);
  const now = Date.now();
  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-[14px] ${active ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="space-y-6">
      {day === today ? <AutoRefresh everyMs={20_000} /> : null}
      <PageTitle title={t('Mesas del día')} text={t('Sede {location}. Las mesas por cobrar y las cobradas, con quién las atendió.', { location: staff.locationName })} />

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={link({ dia: today })} className={chip(day === today)}>
          {t('Hoy')}
        </Link>
        <Link href={link({ dia: yesterday })} className={chip(day === yesterday)}>
          {t('Ayer')}
        </Link>
        <form action="/app/cuentas" className="flex items-center gap-1.5">
          {waiter ? <input type="hidden" name="mesero" value={waiter.id} /> : null}
          <label htmlFor="cuentas-dia" className="sr-only">
            {t('Otro día')}
          </label>
          <input id="cuentas-dia" type="date" name="dia" defaultValue={day} max={today} className={`${inputClass} !w-auto py-1.5`} />
          <button type="submit" className={quietButton}>
            {t('Ver')}
          </button>
        </form>
        <span className="text-[14px] text-muted-foreground">{dateLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Por cobrar')} value={formatCop(pendingTotal)} hint={pending.length === 1 ? t('1 mesa') : t('{n} mesas', { n: pending.length })} strong={pending.length > 0} />
        <Stat label={t('Cobradas')} value={formatCop(collectedTotal)} hint={collected.length === 1 ? t('1 mesa') : t('{n} mesas', { n: collected.length })} />
      </div>

      {data.waiters.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-[19px] font-bold">{t('Por mesero')}</h2>
          <p className="text-[13px] text-muted-foreground">{t('Cada mesa cuenta para quien la abrió. Toca un nombre para ver solo sus mesas.')}</p>
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {data.waiters.map((w) => (
              <li key={w.id}>
                <Link
                  href={link({ mesero: waiter?.id === w.id ? null : w.id })}
                  className={`block rounded-2xl border bg-card px-4 py-3.5 transition hover:border-white/[0.2] ${waiter?.id === w.id ? 'border-primary/70' : 'border-white/[0.08]'}`}
                >
                  <span className="font-display text-[17px] font-semibold">{w.name}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {t('Cobradas: {n} · {amount}', { n: w.collected, amount: formatCop(w.collectedTotal) })}
                  </span>
                  <span className={`block text-[13px] ${w.pending ? 'text-warning' : 'text-muted-foreground'}`}>
                    {t('Por cobrar: {n} · {amount}', { n: w.pending, amount: formatCop(w.pendingTotal) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {waiter ? (
            <Link href={link({ mesero: null })} className="inline-block text-[14px] underline">
              {t('Ver las mesas de todos')}
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">{waiter ? t('Por cobrar de {name}', { name: waiter.name }) : t('Por cobrar')}</h2>
        {pending.length === 0 ? (
          <Empty>{t('No hay mesas por cobrar.')}</Empty>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {pending.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/app/caja/mesa/${a.id}`}
                  className={`flex items-start justify-between gap-3 rounded-2xl border bg-card px-4 py-3.5 transition hover:border-white/[0.2] ${a.status === 'bill' ? 'border-warning/60' : 'border-white/[0.08]'}`}
                >
                  <span className="min-w-0">
                    <span className="font-display text-[17px] font-semibold">{t('Mesa {n}', { n: a.tableNumber })}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {a.status === 'bill' ? t('Pidió la cuenta · ') : ''}
                      {formatElapsed(elapsedMinutes(a.openedAt, now))}
                      {a.paid ? t(' · abonado {amount}', { amount: formatCop(a.paid) }) : ''}
                    </span>
                    <Attended t={t} account={a} />
                  </span>
                  <span className="shrink-0 font-display text-[18px] font-bold">{formatCop(a.balance)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">{waiter ? t('Cobradas de {name}', { name: waiter.name }) : t('Cobradas')}</h2>
        {collected.length === 0 ? (
          <Empty>{t('Ninguna mesa cobrada este día.')}</Empty>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-card">
            {collected.map((a) => (
              <li key={a.id}>
                <Link href={`/app/caja/mesa/${a.id}`} className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                  <span className="min-w-0">
                    <span className="font-display text-[16px] font-semibold">{t('Mesa {n}', { n: a.tableNumber })}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {t('{from} a {to}', { from: formatTime(a.openedAt, staff.timezone, lang), to: formatTime(a.closedAt!, staff.timezone, lang) })}
                      {a.methods.length ? ` · ${a.methods.map((m) => t(METHOD_LABEL[m])).join(', ')}` : ''}
                      {a.tip ? t(' · propina {amount}', { amount: formatCop(a.tip) }) : ''}
                    </span>
                    <Attended t={t} account={a} />
                    {a.collectedBy.length ? <span className="block text-[13px] text-muted-foreground">{t('Cobró: {names}', { names: a.collectedBy.join(', ') })}</span> : null}
                  </span>
                  <span className="shrink-0 text-right">
                    {a.paid ? (
                      <span className="font-display text-[17px] font-bold">{formatCop(a.paid)}</span>
                    ) : (
                      <span className="text-[13.5px] font-semibold text-warning">{t('Cerrada sin cobrar')}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Attended({ t, account }: { t: T; account: TableAccount }) {
  return <span className="block text-[13.5px]">{t('Atendió: {names}', { names: account.waiters.map((w) => w.name).join(', ') })}</span>;
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`rounded-[22px] border bg-card p-4 ${strong ? 'border-warning/60' : 'border-white/[0.08]'}`}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[22px] font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
