import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS, shiftSummary, workMode } from '@/lib/cash';
import { closingInventory, shortQuantity, tipOfSales, type StockLine } from '@/lib/closing-report';
import { AREA_LABEL } from '@/lib/inventory';
import { PrintClosingButton } from '@/components/printer-forms';
import { formatCop, formatDateTime } from '@/lib/format';
import { PageTitle, card } from '@/components/ui';
import { getLang } from '@/lib/i18n/server';
import { makeT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('cash.operate');
  const { id } = await params;
  const lang = await getLang();
  const t = makeT(lang);
  const s = await shiftSummary(staff, id);
  if (!s) notFound();
  const [{ suggestedTip }, inv] = await Promise.all([workMode(staff.businessId), closingInventory(staff)]);
  const qty = (value: number, i: StockLine) => shortQuantity(value, i.unit, i.bottleSize);
  const diff = s.shift.countedCash === null ? null : s.shift.countedCash - (s.shift.expectedCash ?? s.expectedCash);
  const rows: [string, string][] = [
    [t('Abrió'), `${s.shift.openedBy} · ${formatDateTime(s.shift.openedAt, staff.timezone, lang)}`],
    [t('Cerró'), s.shift.closedAt ? `${s.shift.closedBy} · ${formatDateTime(s.shift.closedAt, staff.timezone, lang)}` : t('Sigue abierta')],
    [t('Base'), formatCop(s.shift.openingAmount)],
    ...METHODS.map((m): [string, string] => [
      t(METHOD_LABEL[m]),
      `${t('{amount} ({n} pagos)', { amount: formatCop(s.byMethod[m].amount), n: s.byMethod[m].count })}${s.byMethod[m].tip ? t(' + propina {amount}', { amount: formatCop(s.byMethod[m].tip) }) : ''}`,
    ]),
    [t('Ventas'), formatCop(s.sales)],
    ...(suggestedTip > 0
      ? [[t('Propina ({pct} % de ventas)', { pct: suggestedTip }), formatCop(tipOfSales(s.sales, suggestedTip))] as [string, string]]
      : []),
    [suggestedTip > 0 ? t('Propinas cobradas') : t('Propinas'), formatCop(s.tips)],
    [t('Descuentos'), formatCop(s.discounts)],
    [t('Anulado en cuentas cobradas'), formatCop(s.voids)],
    [t('Pagos reversados'), formatCop(s.reversed)],
    [t('Entradas de efectivo'), formatCop(s.movementsIn)],
    [t('Salidas de efectivo'), formatCop(s.movementsOut)],
    [t('Efectivo esperado'), formatCop(s.shift.expectedCash ?? s.expectedCash)],
    [t('Efectivo contado'), s.shift.countedCash === null ? '—' : formatCop(s.shift.countedCash)],
    [t('Diferencia'), diff === null ? '—' : diff === 0 ? t('Cuadra') : diff > 0 ? t('Sobran {amount}', { amount: formatCop(diff) }) : t('Faltan {amount}', { amount: formatCop(-diff) })],
  ];
  return (
    <div className="space-y-6">
      <Link href="/app/caja" className="text-[14px] text-muted-foreground hover:text-foreground">
        ← {t('Caja')}
      </Link>
      <PageTitle title={t('Cuadre de caja')} text={s.shift.notes ? t('Nota: {note}', { note: s.shift.notes }) : undefined} />
      {s.shift.closedAt ? (
        <div className="max-w-xl">
          <PrintClosingButton shiftId={s.shift.id} />
          <p className="mt-1.5 text-[13px] text-muted-foreground">{t('Sale en la impresora de caja: el cuadre, la propina y cómo queda el inventario.')}</p>
        </div>
      ) : null}
      <dl className={`${card} max-w-xl divide-y divide-white/[0.06] p-0`}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-5 py-2.5 text-[14.5px]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Por comprar para mañana')}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('Lo que quedó debajo del mínimo, hasta llegar a él.')}</p>
          {!inv.hasMinimums ? (
            <p className="mt-3 text-[14px] text-muted-foreground">{t('Pon el mínimo de cada insumo en Inventario y aquí sale cuánto comprar.')}</p>
          ) : inv.toBuy.length ? (
            <ul className="mt-3 space-y-1.5 text-[14px]">
              {inv.toBuy.map((i) => (
                <li key={i.name} className="flex justify-between gap-3">
                  <span>
                    {i.name} <span className="text-[12.5px] text-muted-foreground">· {t(AREA_LABEL[i.area])}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{t('hay {stock} · mínimo {min}', { stock: qty(i.stock, i), min: qty(i.minStock, i) })}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-warning">{qty(i.buy, i)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">{t('Nada: todo quedó sobre el mínimo.')}</p>
          )}
        </section>
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Se acabó')}</h2>
          {inv.out.length ? (
            <ul className="mt-3 space-y-1 text-[14px]">
              {inv.out.map((i) => (
                <li key={i.name} className="flex justify-between gap-3">
                  <span>{i.name}</span>
                  <span className="text-[12.5px] text-muted-foreground">{t(AREA_LABEL[i.area])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">{t('Nada: hay de todo.')}</p>
          )}
        </section>
      </div>

      <details className={`${card} max-w-4xl`}>
        <summary className="cursor-pointer font-display text-[18px] font-bold">{t('Inventario que queda ({n})', { n: inv.remaining.length })}</summary>
        {inv.remaining.length ? (
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            {(['bar', 'kitchen'] as const).map((area) => {
              const list = inv.remaining.filter((i) => i.area === area);
              return list.length ? (
                <div key={area}>
                  <h3 className="text-[13px] font-semibold text-muted-foreground">{t(AREA_LABEL[area])}</h3>
                  <ul className="mt-1.5 space-y-1 text-[14px]">
                    {list.map((i) => (
                      <li key={i.name} className="flex justify-between gap-3">
                        <span>{i.name}</span>
                        <span className="shrink-0">{qty(i.stock, i)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })}
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-muted-foreground">{t('No queda nada cargado en el inventario.')}</p>
        )}
      </details>
    </div>
  );
}
