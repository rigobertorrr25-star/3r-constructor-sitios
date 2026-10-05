import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS, getOpenShift, listShifts, openAccounts, shiftSummary } from '@/lib/cash';
import { elapsedMinutes, formatCop, formatDateTime, formatElapsed } from '@/lib/format';
import { AutoRefresh } from '@/components/auto-refresh';
import { CloseShiftForm, MovementForm, OpenShiftForm } from '@/components/cash-forms';
import { Empty, PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function CashPage() {
  const staff = await requireStaff('cash.operate');
  const [shift, history] = await Promise.all([getOpenShift(staff), listShifts(staff)]);
  const closed = history.filter((h) => h.closedAt);

  if (!shift) {
    return (
      <div className="space-y-6">
        <PageTitle title="Caja" text={`Sede ${staff.locationName}. La caja está cerrada: ábrela con la base en efectivo para empezar a cobrar.`} />
        <section className={`${card} max-w-md`}>
          <OpenShiftForm />
        </section>
        <ShiftHistory shifts={closed} timeZone={staff.timezone} />
      </div>
    );
  }

  const [summary, accounts] = await Promise.all([shiftSummary(staff, shift.id), openAccounts(staff)]);
  const s = summary!;
  const now = Date.now();
  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={15_000} />
      <PageTitle title="Caja" text={`Abierta por ${shift.openedBy} · ${formatDateTime(shift.openedAt, staff.timezone)} · base ${formatCop(shift.openingAmount)}`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Ventas del turno" value={formatCop(s.sales)} hint={`${s.tablesClosed} ${s.tablesClosed === 1 ? 'mesa cerrada' : 'mesas cerradas'}`} />
        <Stat label="Efectivo esperado en caja" value={formatCop(s.expectedCash)} hint="Base + efectivo + entradas − salidas" strong />
        <Stat label="Propinas" value={formatCop(s.tips)} />
        <Stat label="Descuentos" value={formatCop(s.discounts)} hint={s.reversed ? `Pagos reversados: ${formatCop(s.reversed)}` : undefined} />
        {METHODS.map((m) => (
          <Stat key={m} label={METHOD_LABEL[m]} value={formatCop(s.byMethod[m].amount)} hint={`${s.byMethod[m].count} ${s.byMethod[m].count === 1 ? 'pago' : 'pagos'}${s.byMethod[m].tip ? ` · propina ${formatCop(s.byMethod[m].tip)}` : ''}`} />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">Cuentas por cobrar</h2>
        {accounts.length === 0 ? (
          <Empty>No hay mesas abiertas.</Empty>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/app/caja/mesa/${a.id}`}
                  className={`flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3.5 transition hover:border-white/[0.2] ${a.status === 'bill' ? 'border-warning/60' : 'border-white/[0.08]'}`}
                >
                  <span>
                    <span className="font-display text-[17px] font-semibold">Mesa {a.tableNumber}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {a.status === 'bill' ? 'Pidió la cuenta · ' : ''}
                      {formatElapsed(elapsedMinutes(a.openedAt, now))}
                      {a.paid ? ` · abonado ${formatCop(a.paid)}` : ''}
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
          <h2 className="font-display text-[18px] font-bold">Entradas y salidas de efectivo</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">Plata que entra o sale de la caja y no es una venta: cambio, pago a un proveedor, retiro del dueño.</p>
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
                      {m.createdBy} · {formatDateTime(m.createdAt, staff.timezone)}
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
          <h2 className="font-display text-[18px] font-bold">Cerrar caja</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Cuenta el efectivo que hay en la caja (con la base) y escríbelo. Debería haber <strong className="text-foreground">{formatCop(s.expectedCash)}</strong>.
            {accounts.length ? ` Ojo: quedan ${accounts.length} mesas abiertas; se podrán cobrar en la siguiente caja.` : ''}
          </p>
          <div className="mt-4">
            <CloseShiftForm />
          </div>
        </section>
      </div>
      <ShiftHistory shifts={closed} timeZone={staff.timezone} />
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

function ShiftHistory({ shifts, timeZone }: { shifts: Awaited<ReturnType<typeof listShifts>>; timeZone: string }) {
  if (shifts.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-[19px] font-bold">Cajas anteriores</h2>
      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card">
        {shifts.map((h) => {
          const diff = (h.countedCash ?? 0) - (h.expectedCash ?? 0);
          return (
            <li key={h.id}>
              <Link href={`/app/caja/turno/${h.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px] transition hover:bg-white/[0.03]">
                <span>
                  {formatDateTime(h.openedAt, timeZone)} → {h.closedAt ? formatDateTime(h.closedAt, timeZone) : ''}
                  <span className="block text-[12.5px] text-muted-foreground">
                    {h.openedBy} → {h.closedBy}
                  </span>
                </span>
                <span className={diff === 0 ? 'text-success' : 'text-warning'}>{diff === 0 ? 'Cuadró' : diff > 0 ? `Sobraron ${formatCop(diff)}` : `Faltaron ${formatCop(-diff)}`}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
