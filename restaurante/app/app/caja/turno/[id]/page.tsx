import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS, shiftSummary, workMode } from '@/lib/cash';
import { closingInventory, dailyForm, shiftIncidents, shiftSalesByCategory, shortQuantity, sumAmounts, tipOfSales, type StockLine } from '@/lib/closing-report';
import { AREA_LABEL } from '@/lib/inventory';
import { cashCountLines } from '@/lib/cash-count';
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
  const [{ suggestedTip }, inv, byCategory, incidents, form] = await Promise.all([
    workMode(staff.businessId),
    closingInventory(staff),
    shiftSalesByCategory(staff, s.shift.id),
    shiftIncidents(staff, s.shift.openedAt, s.shift.closedAt),
    dailyForm(staff, s.shift.id, s.shift.openedAt, s.shift.closedAt),
  ]);
  // Totales del formulario diario: lo que queda en caja es lo contado menos los sobres y la caja fuerte.
  const sh = s.shift;
  const inCash = sh.countedCash === null ? null : Math.max(0, sh.countedCash - sh.envelopeKitchen - sh.envelopeBar - sh.safeAmount);
  const formSections: { title: string; rows: { left: string; detail: string; amount: number }[]; empty: string }[] = [
    {
      title: t('Salidas de dinero con factura'),
      rows: form.withInvoice.map((x) => ({ left: x.description, detail: `${t('Factura {n}', { n: x.invoiceNumber })} · ${t('de: {from}', { from: t(x.from) })}`, amount: x.amount })),
      empty: t('Ninguna.'),
    },
    {
      title: t('Salidas de dinero sin factura'),
      rows: form.withoutInvoice.map((x) => ({ left: x.description, detail: `${t(x.reason)} · ${t('de: {from}', { from: t(x.from) })}`, amount: x.amount })),
      empty: t('Ninguna.'),
    },
    {
      title: t('Facturas por pagar'),
      rows: form.toPay.map((x) => ({ left: x.supplier || x.description, detail: `${x.supplier ? `${x.description} · ` : ''}${x.dueOn ? t('vence {date}', { date: x.dueOn }) : t('sin fecha de vencimiento')}`, amount: x.amount })),
      empty: t('Ninguna.'),
    },
    { title: t('Pérdidas del día'), rows: form.losses.map((x) => ({ left: x.description, detail: '', amount: x.amount })), empty: t('Ninguna.') },
  ];
  const hasIncidents = incidents.voids.length + incidents.discounts.length + incidents.closedUnpaid.length > 0;
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
      <PageTitle title={t('Cuadre de caja')} />
      {s.shift.closedAt ? (
        <div className="max-w-xl">
          <PrintClosingButton shiftId={s.shift.id} />
          <p className="mt-1.5 text-[13px] text-muted-foreground">{t('Salen dos papeles en la impresora de caja: el cierre (cuadre, propina e inventario) y el formulario diario (ventas, salidas, facturas por pagar, pérdidas, totales y comentarios).')}</p>
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

      {cashCountLines(sh.cashCount).length ? (
        <section className={`${card} max-w-xl`}>
          <h2 className="font-display text-[18px] font-bold">{t('Arqueo de billetes y monedas')}</h2>
          <ul className="mt-3 space-y-1 text-[14px]">
            {cashCountLines(sh.cashCount).map((x) => (
              <li key={`${x.kind}${x.value}`} className="flex justify-between gap-3">
                <span>
                  {x.kind === 'bill' ? t('Billetes de {amount}', { amount: formatCop(x.value) }) : t('Monedas de {amount}', { amount: formatCop(x.value) })} × {x.quantity}
                </span>
                <span>{formatCop(x.total)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between gap-3 border-t border-white/[0.06] pt-2 text-[14.5px] font-semibold">
            <span>{t('Total del arqueo')}</span>
            <span>{formatCop(cashCountLines(sh.cashCount).reduce((a, x) => a + x.total, 0))}</span>
          </p>
        </section>
      ) : null}

      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Ventas por categoría')}</h2>
          {byCategory.length ? (
            <div className="mt-3 space-y-4">
              {byCategory.map((c) => (
                <div key={c.category}>
                  <h3 className="flex justify-between gap-3 text-[14.5px] font-semibold">
                    <span>{c.category}</span>
                    <span>{formatCop(c.total)}</span>
                  </h3>
                  <ul className="mt-1 space-y-0.5 text-[14px]">
                    {c.products.map((p) => (
                      <li key={p.name} className="flex justify-between gap-3 text-muted-foreground">
                        <span>
                          {p.quantity} × {p.name}
                        </span>
                        <span>{formatCop(p.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="flex justify-between gap-3 border-t border-white/[0.06] pt-2 text-[14.5px] font-semibold">
                <span>{t('Total vendido (antes de descuentos)')}</span>
                <span>{formatCop(byCategory.reduce((sum, c) => sum + c.total, 0))}</span>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">{t('No hubo ventas en este turno.')}</p>
          )}
        </section>
        {formSections.map((sec) => (
          <section key={sec.title} className={card}>
            <h2 className="font-display text-[18px] font-bold">{sec.title}</h2>
            {sec.rows.length ? (
              <>
                <ul className="mt-3 space-y-1.5 text-[14px]">
                  {sec.rows.map((r, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>
                        {r.left}
                        {r.detail ? <span className="block text-[12.5px] text-muted-foreground">{r.detail}</span> : null}
                      </span>
                      <span className="shrink-0">{formatCop(r.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between gap-3 border-t border-white/[0.06] pt-2 text-[14.5px] font-semibold">
                  <span>{t('Subtotal')}</span>
                  <span>{formatCop(sumAmounts(sec.rows))}</span>
                </p>
              </>
            ) : (
              <p className="mt-3 text-[14px] text-muted-foreground">{sec.empty}</p>
            )}
          </section>
        ))}
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Totales del día')}</h2>
          <dl className="mt-3 space-y-1.5 text-[14.5px]">
            {(
              [
                [t('Total ventas'), formatCop(s.sales)],
                [t('Total salidas de dinero'), formatCop(sumAmounts(form.withInvoice) + sumAmounts(form.withoutInvoice))],
                [t('Total pérdidas'), formatCop(sumAmounts(form.losses))],
                [t('Total en caja'), inCash === null ? '—' : formatCop(inCash)],
                [t('Sobre para la cocina'), formatCop(sh.envelopeKitchen)],
                [t('Sobre para el bar'), formatCop(sh.envelopeBar)],
                [t('Caja fuerte'), formatCop(sh.safeAmount)],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Comentarios')}</h2>
          {s.shift.notes ? <p className="mt-3 whitespace-pre-line text-[14.5px]">{s.shift.notes}</p> : null}
          {hasIncidents ? (
            <div className="mt-3 space-y-3 text-[14px]">
              {(
                [
                  [t('Anulaciones y devoluciones'), incidents.voids.map((v) => `${v.quantity} × ${v.name} · ${t('Mesa {n}', { n: v.table })}${v.reason ? `: ${v.reason}` : ''}${v.by ? ` (${v.by})` : ''}`)],
                  [t('Descuentos'), incidents.discounts.map((d) => `${t('Mesa {n}', { n: d.table })} · ${formatCop(d.amount)}: ${d.reason}${d.by ? ` (${d.by})` : ''}`)],
                  [t('Mesas cerradas sin cobrar'), incidents.closedUnpaid.map((c) => `${c.summary}: ${c.reason}${c.by ? ` (${c.by})` : ''}`)],
                ] as [string, string[]][]
              ).map(([title, items]) =>
                items.length ? (
                  <div key={title}>
                    <h3 className="font-semibold">{title}</h3>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                      {items.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          ) : null}
          {!s.shift.notes && !hasIncidents ? <p className="mt-3 text-[14px] text-muted-foreground">{t('Nada registrado en el sistema.')}</p> : null}
        </section>
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
