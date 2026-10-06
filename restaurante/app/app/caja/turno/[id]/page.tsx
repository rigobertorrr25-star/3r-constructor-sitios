import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { METHOD_LABEL, METHODS, shiftSummary } from '@/lib/cash';
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
    [t('Propinas'), formatCop(s.tips)],
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
