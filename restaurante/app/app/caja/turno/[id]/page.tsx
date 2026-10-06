import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS, shiftSummary } from '@/lib/cash';
import { formatCop, formatDateTime } from '@/lib/format';
import { PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('cash.operate');
  const { id } = await params;
  const s = await shiftSummary(staff, id);
  if (!s) notFound();
  const diff = s.shift.countedCash === null ? null : s.shift.countedCash - (s.shift.expectedCash ?? s.expectedCash);
  const rows: [string, string][] = [
    ['Abrió', `${s.shift.openedBy} · ${formatDateTime(s.shift.openedAt, staff.timezone)}`],
    ['Cerró', s.shift.closedAt ? `${s.shift.closedBy} · ${formatDateTime(s.shift.closedAt, staff.timezone)}` : 'Sigue abierta'],
    ['Base', formatCop(s.shift.openingAmount)],
    ...METHODS.map((m): [string, string] => [METHOD_LABEL[m], `${formatCop(s.byMethod[m].amount)} (${s.byMethod[m].count} pagos)${s.byMethod[m].tip ? ` + propina ${formatCop(s.byMethod[m].tip)}` : ''}`]),
    ['Ventas', formatCop(s.sales)],
    ['Propinas', formatCop(s.tips)],
    ['Descuentos', formatCop(s.discounts)],
    ['Anulado en cuentas cobradas', formatCop(s.voids)],
    ['Pagos reversados', formatCop(s.reversed)],
    ['Entradas de efectivo', formatCop(s.movementsIn)],
    ['Salidas de efectivo', formatCop(s.movementsOut)],
    ['Efectivo esperado', formatCop(s.shift.expectedCash ?? s.expectedCash)],
    ['Efectivo contado', s.shift.countedCash === null ? '—' : formatCop(s.shift.countedCash)],
    ['Diferencia', diff === null ? '—' : diff === 0 ? 'Cuadra' : diff > 0 ? `Sobran ${formatCop(diff)}` : `Faltan ${formatCop(-diff)}`],
  ];
  return (
    <div className="space-y-6">
      <Link href="/app/caja" className="text-[14px] text-muted-foreground hover:text-foreground">
        ← Caja
      </Link>
      <PageTitle title="Cuadre de caja" text={s.shift.notes ? `Nota: ${s.shift.notes}` : undefined} />
      <dl className={`${card} max-w-xl divide-y divide-white/[0.06] p-0`}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-5 py-2.5 text-[14.5px]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
