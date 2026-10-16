// La cuenta de un mesero y sus cierres (componentes del servidor: reciben el traductor ya armado).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { METHOD_LABEL, METHODS } from '@/lib/cash';
import { formatCop, formatDateTime, formatTime } from '@/lib/format';
import type { Lang, T } from '@/lib/i18n';
import type { WaiterAccount, WaiterClosing, WaiterTable } from '@/lib/waiters';
import { card } from './ui';

const METHOD_TONE = { cash: 'text-[#9df0c6]', card: 'text-[#b9c4ff]', transfer: 'text-[#ffc6ec]' } as const;

function MethodTiles({ byMethod, t }: { byMethod: WaiterAccount['byMethod']; t: T }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {METHODS.map((m) => (
        <div key={m} className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
          <p className="truncate text-[12.5px] text-muted-foreground">{t(METHOD_LABEL[m])}</p>
          <p className={`font-display text-[17px] font-bold tabular-nums ${METHOD_TONE[m]}`}>{formatCop(byMethod[m].amount)}</p>
          <p className="text-[12px] text-muted-foreground">
            {byMethod[m].count === 1 ? t('1 pago') : t('{n} pagos', { n: byMethod[m].count })}
            {byMethod[m].tip ? ` · ${t('propina {amount}', { amount: formatCop(byMethod[m].tip) })}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

function TableList({ tables, t, lang, timeZone }: { tables: WaiterTable[]; t: T; lang: Lang; timeZone: string }) {
  if (!tables.length) return <p className="text-[14px] text-muted-foreground">{t('Todavía no hay mesas cobradas.')}</p>;
  return (
    <ul className="divide-y divide-white/[0.06]">
      {tables.map((m) => (
        <li key={m.sessionId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-[14.5px]">
          <span className="font-medium">
            {t('Mesa {n}', { n: m.tableNumber })}
            {m.closedAt ? <span className="ml-2 text-[13px] font-normal text-muted-foreground">{formatTime(m.closedAt, timeZone, lang)}</span> : null}
          </span>
          <span className="text-right text-[13.5px]">
            {m.payments.map((p, i) => (
              <span key={i} className="ml-3 whitespace-nowrap">
                <span className={METHOD_TONE[p.method]}>{t(METHOD_LABEL[p.method])}</span> <span className="tabular-nums">{formatCop(p.amount)}</span>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Lo que lleva un mesero en el turno: vendido, por forma de pago, mesas cobradas y las que siguen abiertas. */
export function AccountSummary({
  account,
  t,
  lang,
  timeZone,
  showName = false,
  collectLinks = false,
  footer,
}: {
  account: WaiterAccount;
  t: T;
  lang: Lang;
  timeZone: string;
  showName?: boolean;
  collectLinks?: boolean;
  footer?: ReactNode;
}) {
  return (
    <section className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {showName ? <h2 className="font-display text-[20px] font-bold">{account.staff.name}</h2> : null}
          <p className="text-[13.5px] text-muted-foreground">
            {account.shift ? t('Cuenta abierta desde {time}', { time: formatTime(account.shift.openedAt, timeZone, lang) }) : t('Sin cobros en este turno')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12.5px] text-muted-foreground">{t('Lleva vendido')}</p>
          <p className="font-display text-[26px] font-bold tabular-nums">{formatCop(account.sales)}</p>
          {account.tips ? <p className="text-[12.5px] text-muted-foreground">{t('+ {amount} de propinas', { amount: formatCop(account.tips) })}</p> : null}
        </div>
      </div>
      <MethodTiles byMethod={account.byMethod} t={t} />
      <p className="rounded-2xl bg-white/[0.03] px-4 py-2.5 text-[14.5px]">
        {t('Efectivo que debe entregar:')} <strong className="tabular-nums">{formatCop(account.cash)}</strong>
      </p>
      {account.openTables.length ? (
        <div>
          <h3 className="text-[14px] font-semibold">{t('Mesas abiertas')}</h3>
          <ul className="mt-1 divide-y divide-white/[0.06]">
            {account.openTables.map((m) => (
              <li key={m.sessionId} className="flex items-center justify-between gap-3 py-2 text-[14.5px]">
                <span>
                  {t('Mesa {n}', { n: m.tableNumber })}
                  {m.status === 'bill' ? <span className="ml-2 text-[12.5px] text-warning">{t('pidió la cuenta')}</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-muted-foreground">{t('falta {amount}', { amount: formatCop(m.balance) })}</span>
                  {collectLinks && m.balance > 0 ? (
                    <Link href={`/app/caja/mesa/${m.sessionId}`} className="text-[13.5px] text-primary hover:underline">
                      {t('Cobrar')}
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <h3 className="text-[14px] font-semibold">{t('Mesas cobradas')}</h3>
        <TableList tables={account.tables} t={t} lang={lang} timeZone={timeZone} />
      </div>
      {footer}
    </section>
  );
}

/** Un cierre entregado: lo cobrado, el efectivo entregado contra el esperado y si ya lo verificaron. */
export function ClosingCard({ closing, t, lang, timeZone, action }: { closing: WaiterClosing; t: T; lang: Lang; timeZone: string; action?: ReactNode }) {
  const diff = closing.difference;
  return (
    <li className={`${card} space-y-3 !p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-[18px] font-bold">{closing.staffName}</p>
          <p className="text-[13px] text-muted-foreground">
            {t('{from} a {to}', { from: formatDateTime(closing.openedAt, timeZone, lang), to: formatTime(closing.closedAt, timeZone, lang) })} ·{' '}
            {t('cerró {name}', { name: closing.closedBy })}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[13px] ${closing.verifiedAt ? 'bg-success/15 text-[#9df0c6]' : 'bg-warning/15 text-warning'}`}
        >
          {closing.verifiedAt
            ? t('Verificado por {name}', { name: closing.verifiedBy ?? '' })
            : t('Por verificar')}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[14.5px]">
        <span>
          {t('Vendido')} <strong className="tabular-nums">{formatCop(closing.sales)}</strong>
        </span>
        {closing.tips ? (
          <span>
            {t('Propinas')} <strong className="tabular-nums">{formatCop(closing.tips)}</strong>
          </span>
        ) : null}
      </div>
      <MethodTiles byMethod={closing.byMethod} t={t} />
      <p className="text-[14.5px]">
        {t('Efectivo: entregó {counted} de {expected}', { counted: formatCop(closing.counted), expected: formatCop(closing.expected) })}{' '}
        <strong className={diff === 0 ? 'text-[#9df0c6]' : diff > 0 ? 'text-[#ffd479]' : 'text-[#ffb4b5]'}>
          {diff === 0 ? t('· cuadra') : diff > 0 ? t('· sobran {amount}', { amount: formatCop(diff) }) : t('· faltan {amount}', { amount: formatCop(-diff) })}
        </strong>
      </p>
      {closing.notes ? <p className="text-[13.5px] text-muted-foreground">{t('Nota del cierre: {note}', { note: closing.notes })}</p> : null}
      {closing.verifyNote ? <p className="text-[13.5px] text-muted-foreground">{t('Nota de la verificación: {note}', { note: closing.verifyNote })}</p> : null}
      <details>
        <summary className="cursor-pointer text-[13.5px] text-muted-foreground hover:text-foreground">
          {closing.tables.length === 1 ? t('Ver la mesa cobrada') : t('Ver las {n} mesas cobradas', { n: closing.tables.length })}
        </summary>
        <div className="mt-2">
          <TableList tables={closing.tables} t={t} lang={lang} timeZone={timeZone} />
        </div>
      </details>
      {action}
    </li>
  );
}
