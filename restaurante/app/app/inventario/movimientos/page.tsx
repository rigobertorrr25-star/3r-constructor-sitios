import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { MOVEMENT_LABEL, listMovements, movementPeople } from '@/lib/inventory';
import { todayIn } from '@/lib/finance';
import { PERIODS, periodRange } from '@/lib/periods';
import { formatDateTime } from '@/lib/format';
import { formatQuantity } from '@/lib/units';
import { Empty, PageTitle } from '@/components/ui';
import { makeT, tr } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const KINDS = ['', 'count', 'purchase', 'sale', 'void', 'waste'] as const;

const chip = (active: boolean) =>
  `rounded-full px-4 py-1.5 text-[14px] transition ${active ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`;

/**
 * Historial del inventario para el dueño y el administrador: cada movimiento (conteos del bartender, ventas, mermas,
 * compras) con quién lo hizo y a qué hora. Se filtra por persona, tipo y período.
 */
export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ quien?: string; tipo?: string; periodo?: string }> }) {
  const staff = await requireStaff('inventory.manage');
  const lang = await getLang();
  const t = makeT(lang);
  const qty = (...args: Parameters<typeof formatQuantity>) => tr(lang, formatQuantity(...args));
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.key === sp.periodo) ? sp.periodo! : 'hoy';
  const kind = (KINDS as readonly string[]).includes(sp.tipo ?? '') ? (sp.tipo ?? '') : '';
  const people = await movementPeople(staff);
  const who = people.some((p) => p.id === sp.quien) ? sp.quien! : '';
  const range = periodRange(period, todayIn(staff.timezone));
  const moves = await listMovements(staff, { kind: kind || undefined, staffId: who || undefined, days: { ...range, timeZone: staff.timezone }, limit: 500 });
  const href = (change: Record<string, string>) => {
    const q = new URLSearchParams({ quien: who, tipo: kind, periodo: period, ...change });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    const s = q.toString();
    return `/app/inventario/movimientos${s ? `?${s}` : ''}`;
  };
  return (
    <div className="space-y-6">
      <Link href="/app/inventario" className="text-[14px] text-muted-foreground hover:text-foreground">
        ← {t('Inventario')}
      </Link>
      <PageTitle
        title={t('Movimientos del inventario')}
        text={t('Todo lo que entra y sale del inventario de {location}, con quién lo hizo y a qué hora. No se puede borrar ni cambiar.', { location: staff.locationName })}
      />
      <div className="space-y-3">
        <nav aria-label={t('Período')} className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <Link key={p.key} href={href({ periodo: p.key })} className={chip(p.key === period)}>
              {t(p.label)}
            </Link>
          ))}
        </nav>
        <nav aria-label={t('Tipo')} className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <Link key={k || 'todo'} href={href({ tipo: k })} className={chip(k === kind)}>
              {k ? t(MOVEMENT_LABEL[k]) : t('Todo')}
            </Link>
          ))}
        </nav>
        {people.length ? (
          <nav aria-label={t('Persona')} className="flex flex-wrap gap-1.5">
            <Link href={href({ quien: '' })} className={chip(!who)}>
              {t('Todos')}
            </Link>
            {people.map((p) => (
              <Link key={p.id} href={href({ quien: p.id })} className={chip(p.id === who)}>
                {p.name}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      {moves.length === 0 ? (
        <Empty>{t('No hay movimientos con esos filtros.')}</Empty>
      ) : (
        <>
          <p className="text-[14px] text-muted-foreground">{moves.length === 500 ? t('Los últimos 500 movimientos.') : t('{n} movimientos.', { n: moves.length })}</p>
          <ol className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-5">
                <span className="shrink-0 text-[13px] text-muted-foreground sm:w-[130px]">{formatDateTime(m.createdAt, staff.timezone, lang)}</span>
                <span className="flex-1 text-[14.5px]">
                  <Link href={`/app/inventario/${m.itemId}`} className="font-medium hover:text-primary">
                    {m.itemName}
                  </Link>{' '}
                  · {MOVEMENT_LABEL[m.kind] ? t(MOVEMENT_LABEL[m.kind]) : m.kind}
                  {m.kind === 'count' && m.expected !== null && m.counted !== null ? (
                    <span className="block text-[13px] text-muted-foreground">
                      {t('Debía haber {expected} y contó {counted}', { expected: qty(m.expected, m.unit), counted: qty(m.counted, m.unit) })}
                    </span>
                  ) : null}
                  {m.reason ? <span className="block text-[13px] text-muted-foreground">{tr(lang, m.reason)}</span> : null}
                </span>
                <span className={`shrink-0 font-medium ${m.quantity < 0 ? 'text-[#ffb4b5]' : m.quantity > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                  {m.quantity > 0 ? '+' : ''}
                  {qty(m.quantity, m.unit)}
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground sm:w-[120px] sm:text-right">{m.createdBy ?? '—'}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
