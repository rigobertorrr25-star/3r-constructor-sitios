import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getBill } from '@/lib/cash';
import { formatCop, formatDateTime } from '@/lib/format';
import { PrintButton } from '@/components/print-button';
import { LangSwitch } from '@/components/i18n';
import { getLang } from '@/lib/i18n/server';
import { makeT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** Precuenta para imprimir (impresora de tirilla o carta). No es factura. */
export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('orders.take');
  const { id } = await params;
  const bill = await getBill(staff, id);
  if (!bill) notFound();
  const lang = await getLang();
  const t = makeT(lang);
  // Propina sugerida sobre el consumo; si ya abonaron una parte, se sugiere sobre lo que falta.
  const tip = Math.round((bill.balance * bill.suggestedTipPercent) / 100 / 100) * 100;
  return (
    <div className="relative min-h-screen bg-white">
      <div className="absolute right-4 top-4 rounded-full bg-neutral-900 print:hidden">
        <LangSwitch />
      </div>
    <main className="mx-auto max-w-[360px] bg-white px-5 py-6 font-sans text-[13px] leading-snug text-black print:max-w-none print:p-0">
      <div className="text-center">
        <p className="text-[16px] font-bold">{staff.businessName}</p>
        {staff.locationCount > 1 ? <p>{staff.locationName}</p> : null}
        <p className="mt-2 font-semibold">{t('PRECUENTA · Mesa {n}', { n: bill.session.tableNumber })}</p>
        <p>
          {formatDateTime(new Date(), staff.timezone, lang)} · {bill.session.guests === 1 ? t('1 persona') : t('{n} personas', { n: bill.session.guests })}
        </p>
        <p>{t('Atendió: {name}', { name: bill.session.openedBy })}</p>
      </div>
      <hr className="my-3 border-dashed border-black" />
      <table className="w-full">
        <tbody>
          {bill.lines.map((l) => (
            <tr key={`${l.name}-${l.unitPrice}`}>
              <td className="py-0.5 pr-2 align-top">{l.quantity}</td>
              <td className="py-0.5 pr-2">{l.name}</td>
              <td className="py-0.5 text-right align-top">{formatCop(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-3 border-dashed border-black" />
      <dl className="space-y-0.5">
        <div className="flex justify-between">
          <dt>{t('Subtotal')}</dt>
          <dd>{formatCop(bill.subtotal)}</dd>
        </div>
        {bill.discountTotal ? (
          <div className="flex justify-between">
            <dt>{t('Descuentos')}</dt>
            <dd>−{formatCop(bill.discountTotal)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between text-[15px] font-bold">
          <dt>{t('Total')}</dt>
          <dd>{formatCop(bill.total)}</dd>
        </div>
        {bill.paid ? (
          <div className="flex justify-between">
            <dt>{t('Abonado')}</dt>
            <dd>{formatCop(bill.paid)}</dd>
          </div>
        ) : null}
        {bill.balance > 0 ? (
          <>
            {bill.paid ? (
              <div className="flex justify-between font-semibold">
                <dt>{t('Falta por pagar')}</dt>
                <dd>{formatCop(bill.balance)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between pt-1">
              <dt>{t('Propina sugerida ({n} %)', { n: bill.suggestedTipPercent })}</dt>
              <dd>{formatCop(tip)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>{t('Total con propina')}</dt>
              <dd>{formatCop(bill.balance + tip)}</dd>
            </div>
          </>
        ) : (
          <p className="pt-1 text-center font-semibold">{bill.tips ? t('Cuenta pagada · propina {amount}', { amount: formatCop(bill.tips) }) : t('Cuenta pagada')}</p>
        )}
      </dl>
      <p className="mt-3 text-center text-[11.5px]">{t('La propina es voluntaria. Puedes pedir que se quite o se cambie.')}</p>
      <p className="mt-1 text-center text-[11.5px]">{t('Este documento no es una factura.')}</p>
      <div className="mt-5 text-center print:hidden">
        <PrintButton />
      </div>
    </main>
    </div>
  );
}
