import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS } from '@/lib/cash';
import { formatCop } from '@/lib/format';
import { listWaiterAccounts, listWaiterClosings } from '@/lib/waiters';
import { getLang, getT } from '@/lib/i18n/server';
import { AutoRefresh } from '@/components/auto-refresh';
import { AccountSummary, ClosingCard } from '@/components/waiter-account';
import { CloseAccountForm, VerifyClosingForm } from '@/components/waiter-forms';
import { Empty, PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** Para el administrador de un bar sin cajero: lo que lleva cada mesero, en vivo, y los cierres por verificar. */
export default async function WaitersPage() {
  const staff = await requireStaff('waiters.verify');
  if (!staff.waitersCollect) redirect('/app');
  const [t, lang, accounts, closings] = await Promise.all([getT(), getLang(), listWaiterAccounts(staff), listWaiterClosings(staff)]);
  const total = accounts.reduce((s, a) => s + a.sales, 0);
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, accounts.reduce((s, a) => s + a.byMethod[m].amount, 0)])) as Record<(typeof METHODS)[number], number>;
  const pending = closings.filter((c) => !c.verifiedAt);
  const done = closings.filter((c) => c.verifiedAt);
  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={15_000} />
      <PageTitle title={t('Meseros')} text={t('Cuánto lleva cobrado cada mesero y cómo le pagaron en cada mesa. Cuando entreguen su cierre, cuenta la plata y márcalo como verificado.')} />

      <section className={`${card} flex flex-wrap items-end justify-between gap-4`}>
        <div>
          <p className="text-[13px] text-muted-foreground">{t('Vendido por todos en el turno')}</p>
          <p className="font-display text-[30px] font-bold tabular-nums">{formatCop(total)}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[14.5px]">
          {METHODS.map((m) => (
            <span key={m}>
              {t(METHOD_LABEL[m])} <strong className="tabular-nums">{formatCop(byMethod[m])}</strong>
            </span>
          ))}
        </div>
      </section>

      {pending.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-[19px] font-bold">{pending.length === 1 ? t('1 cierre por verificar') : t('{n} cierres por verificar', { n: pending.length })}</h2>
          <ul className="space-y-3">
            {pending.map((c) => (
              <ClosingCard key={c.id} closing={c} t={t} lang={lang} timeZone={staff.timezone} action={<VerifyClosingForm shiftId={c.id} />} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">{t('En el turno')}</h2>
        {accounts.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {accounts.map((a) => (
              <AccountSummary
                key={a.staff.id}
                account={a}
                t={t}
                lang={lang}
                timeZone={staff.timezone}
                showName
                collectLinks
                footer={
                  a.shift ? (
                    <details className="border-t border-white/[0.06] pt-3">
                      <summary className="cursor-pointer text-[14px] text-muted-foreground hover:text-foreground">
                        {t('Cerrar la cuenta de {name}', { name: a.staff.name })}
                      </summary>
                      <div className="mt-3">
                        <CloseAccountForm staffId={a.staff.id} cash={a.cash} label={t('Cerrar cuenta')} />
                      </div>
                    </details>
                  ) : null
                }
              />
            ))}
          </div>
        ) : (
          <Empty>{t('Todavía no hay meseros. Agrégalos en «Equipo» con el rol Mesero.')}</Empty>
        )}
      </section>

      {done.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-[19px] font-bold">{t('Verificados (últimos 3 días)')}</h2>
          <ul className="space-y-3">
            {done.map((c) => (
              <ClosingCard key={c.id} closing={c} t={t} lang={lang} timeZone={staff.timezone} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
