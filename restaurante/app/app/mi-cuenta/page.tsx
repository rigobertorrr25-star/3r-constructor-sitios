import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { listWaiterClosings, waiterAccount } from '@/lib/waiters';
import { getLang, getT } from '@/lib/i18n/server';
import { AutoRefresh } from '@/components/auto-refresh';
import { AccountSummary, ClosingCard } from '@/components/waiter-account';
import { CloseAccountForm } from '@/components/waiter-forms';
import { PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** La cuenta del mesero en un bar sin cajero: lo que lleva cobrado y su cierre del turno. */
export default async function MyAccountPage() {
  const staff = await requireStaff('tables.open');
  if (!staff.waitersCollect) redirect('/app');
  const [t, lang, account, closings] = await Promise.all([getT(), getLang(), waiterAccount(staff), listWaiterClosings(staff, { staffId: staff.id })]);
  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={15_000} />
      <PageTitle title={t('Mi cuenta')} text={t('Lo que llevas cobrado en este turno. Cuando termines, entrega tu cierre y el administrador lo revisa.')} />
      <AccountSummary
        account={account}
        t={t}
        lang={lang}
        timeZone={staff.timezone}
        collectLinks
        footer={
          account.shift ? (
            <div className="border-t border-white/[0.06] pt-4">
              <h3 className="mb-3 font-display text-[17px] font-bold">{t('Cerrar mi cuenta')}</h3>
              <CloseAccountForm cash={account.cash} label={t('Entregar mi cierre')} />
            </div>
          ) : null
        }
      />
      {closings.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-[18px] font-bold">{t('Mis cierres recientes')}</h2>
          <ul className="space-y-3">
            {closings.map((c) => (
              <ClosingCard key={c.id} closing={c} t={t} lang={lang} timeZone={staff.timezone} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
