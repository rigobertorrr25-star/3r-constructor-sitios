import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { EXPENSE_LABEL, getStatement, listExpenses, todayIn } from '@/lib/finance';
import { formatCop } from '@/lib/format';
import { PERIODS, periodRange } from '@/lib/periods';
import { listLocations } from '@/lib/store';
import { ExpenseForm, ExpenseRow } from '@/components/finance-forms';
import { SalesByDay } from '@/components/sales-chart';
import { Alert, PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

const METHOD: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string; sede?: string }> }) {
  const staff = await requireStaff('finance.view');
  const sp = await searchParams;
  const today = todayIn(staff.timezone);
  const custom = sp.desde && sp.hasta && DATE.test(sp.desde) && DATE.test(sp.hasta);
  const period = custom ? 'rango' : (sp.periodo ?? 'mes');
  const range = custom ? { from: sp.desde!, to: sp.hasta! } : periodRange(period, today);
  const isOwner = staff.role === 'owner';
  const locations = isOwner && staff.locationCount > 1 ? await listLocations(staff.businessId) : [];
  const sede = isOwner ? (sp.sede ?? (staff.locationCount > 1 ? 'all' : staff.locationId)) : staff.locationId;

  let error: string | null = null;
  let st: Awaited<ReturnType<typeof getStatement>> | null = null;
  let expenses: Awaited<ReturnType<typeof listExpenses>> = [];
  try {
    [st, expenses] = await Promise.all([getStatement(staff, { ...range, locationId: sede }, staff.timezone), listExpenses(staff, { ...range, locationId: sede })]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'No se pudo calcular.';
  }

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(sede && isOwner ? { sede } : {}), ...patch });
    return `/app/finanzas?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Finanzas" text="Lo que entró, lo que costó y lo que quedó. Las ventas no incluyen propinas (son del equipo)." />

      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={qs({ periodo: p.key })}
            className={`rounded-full px-4 py-1.5 text-[14px] ${period === p.key ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
          >
            {p.label}
          </Link>
        ))}
        <form action="/app/finanzas" className="flex flex-wrap items-center gap-1.5">
          {isOwner && sede ? <input type="hidden" name="sede" value={sede} /> : null}
          <input type="date" name="desde" defaultValue={range.from} aria-label="Desde" className="rounded-full border border-white/[0.1] bg-transparent px-3 py-1.5 text-[14px] [color-scheme:dark]" />
          <input type="date" name="hasta" defaultValue={range.to} aria-label="Hasta" className="rounded-full border border-white/[0.1] bg-transparent px-3 py-1.5 text-[14px] [color-scheme:dark]" />
          <button className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[14px] text-muted-foreground hover:text-foreground">Ver</button>
        </form>
      </div>
      {locations.length ? (
        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all', name: 'Todas las sedes' }, ...locations].map((l) => (
            <Link
              key={l.id}
              href={`/app/finanzas?${new URLSearchParams({ ...(custom ? { desde: range.from, hasta: range.to } : { periodo: period }), sede: l.id })}`}
              className={`rounded-full px-3.5 py-1 text-[13.5px] ${sede === l.id ? 'bg-white/[0.1] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {l.name}
            </Link>
          ))}
        </div>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}

      {st ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Ventas" value={formatCop(st.sales)} hint={`${st.tables} mesas · ${st.guests} personas`} />
            <Tile label="Utilidad operativa" value={formatCop(st.operatingProfit)} tone={st.operatingProfit < 0 ? 'bad' : 'good'} hint={st.sales ? `${Math.round((st.operatingProfit / st.sales) * 100)} % de las ventas` : undefined} />
            <Tile label="Ticket promedio por mesa" value={formatCop(st.averageTicket)} hint={st.guests ? `${formatCop(Math.round(st.sales / st.guests))} por persona` : undefined} />
            <Tile label="Propinas del equipo" value={formatCop(st.tips)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <section className={card}>
              <h2 className="font-display text-[18px] font-bold">Estado de resultados</h2>
              <p className="text-[13px] text-muted-foreground">
                {range.from === range.to ? range.from : `${range.from} a ${range.to}`}
              </p>
              <dl className="mt-4 space-y-1.5 text-[14.5px]">
                <Line label="Ventas (cobrado)" value={st.sales} strong />
                <Line label="Costo de lo vendido (recetas)" value={-st.costOfSales} />
                <Line label="Utilidad bruta" value={st.grossProfit} strong border />
                <Line label="Mermas" value={-st.waste} />
                <Line label="Faltantes en conteos" value={-st.inventoryShortage} />
                {st.inventorySurplus ? <Line label="Sobrantes en conteos" value={st.inventorySurplus} /> : null}
                {st.expenses.map((e) => (
                  <Line key={e.category} label={`Gasto: ${EXPENSE_LABEL[e.category]}`} value={-e.amount} />
                ))}
                <Line label="Utilidad operativa" value={st.operatingProfit} strong border />
              </dl>
              <p className="mt-4 text-[12.5px] text-muted-foreground">
                Para informar: descuentos dados {formatCop(st.discounts)} · anulado en cuentas cerradas {formatCop(st.voids)}. El costo solo cuenta productos con receta.
              </p>
            </section>
            <section className={`${card} space-y-5`}>
              <div>
                <h2 className="font-display text-[18px] font-bold">Ventas por día</h2>
                <SalesByDay days={st.byDay} from={range.from} to={range.to} />
              </div>
              <div>
                <h2 className="font-display text-[16px] font-bold">Cómo pagaron</h2>
                <ul className="mt-2 space-y-1 text-[14px]">
                  {st.byMethod.length === 0 ? <li className="text-muted-foreground">Sin pagos.</li> : null}
                  {st.byMethod.map((m) => (
                    <li key={m.method} className="flex justify-between">
                      <span className="text-muted-foreground">{METHOD[m.method] ?? m.method}</span>
                      {formatCop(m.amount)}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-[16px] font-bold">Lo más vendido</h2>
                <ol className="mt-2 space-y-1 text-[14px]">
                  {st.topProducts.length === 0 ? <li className="text-muted-foreground">Sin ventas.</li> : null}
                  {st.topProducts.map((p, i) => (
                    <li key={p.name} className="flex justify-between gap-3">
                      <span>
                        {i + 1}. {p.name}
                      </span>
                      <span className="text-muted-foreground">
                        {p.quantity} · {formatCop(p.total)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        </>
      ) : null}

      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">Registrar un gasto</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">Queda en la sede {staff.locationName}. Si lo pagas con la plata de la caja, sale de la caja abierta.</p>
        <div className="mt-4">
          <ExpenseForm today={today} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">Gastos del periodo</h2>
        {expenses.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">No hay gastos en este periodo.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card">
            {expenses.map((e) => (
              <ExpenseRow key={e.id} expense={{ ...e, categoryLabel: EXPENSE_LABEL[e.category] }} showLocation={isOwner && sede === 'all'} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`rounded-[22px] border bg-card p-4 ${tone === 'bad' ? 'border-destructive/50' : tone === 'good' ? 'border-success/40' : 'border-white/[0.08]'}`}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[22px] font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Line({ label, value, strong, border }: { label: string; value: number; strong?: boolean; border?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${border ? 'border-t border-white/[0.08] pt-1.5' : ''} ${strong ? 'font-semibold' : ''}`}>
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd className={value < 0 && strong ? 'text-[#ffb4b5]' : ''}>{formatCop(value)}</dd>
    </div>
  );
}
