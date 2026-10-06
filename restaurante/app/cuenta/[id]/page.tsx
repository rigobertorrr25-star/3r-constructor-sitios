import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getBill } from '@/lib/cash';
import { formatCop, formatDateTime } from '@/lib/format';
import { PrintButton } from '@/components/print-button';

export const dynamic = 'force-dynamic';

/** Precuenta para imprimir (impresora de tirilla o carta). No es factura. */
export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('orders.take');
  const { id } = await params;
  const bill = await getBill(staff, id);
  if (!bill) notFound();
  // Propina sugerida sobre el consumo; si ya abonaron una parte, se sugiere sobre lo que falta.
  const tip = Math.round((bill.balance * bill.suggestedTipPercent) / 100 / 100) * 100;
  return (
    <div className="min-h-screen bg-white">
    <main className="mx-auto max-w-[360px] bg-white px-5 py-6 font-sans text-[13px] leading-snug text-black print:max-w-none print:p-0">
      <div className="text-center">
        <p className="text-[16px] font-bold">{staff.businessName}</p>
        {staff.locationCount > 1 ? <p>{staff.locationName}</p> : null}
        <p className="mt-2 font-semibold">PRECUENTA · Mesa {bill.session.tableNumber}</p>
        <p>{formatDateTime(new Date(), staff.timezone)} · {bill.session.guests} personas</p>
        <p>Atendió: {bill.session.openedBy}</p>
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
          <dt>Subtotal</dt>
          <dd>{formatCop(bill.subtotal)}</dd>
        </div>
        {bill.discountTotal ? (
          <div className="flex justify-between">
            <dt>Descuentos</dt>
            <dd>−{formatCop(bill.discountTotal)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between text-[15px] font-bold">
          <dt>Total</dt>
          <dd>{formatCop(bill.total)}</dd>
        </div>
        {bill.paid ? (
          <div className="flex justify-between">
            <dt>Abonado</dt>
            <dd>{formatCop(bill.paid)}</dd>
          </div>
        ) : null}
        {bill.balance > 0 ? (
          <>
            {bill.paid ? (
              <div className="flex justify-between font-semibold">
                <dt>Falta por pagar</dt>
                <dd>{formatCop(bill.balance)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between pt-1">
              <dt>Propina sugerida ({bill.suggestedTipPercent} %)</dt>
              <dd>{formatCop(tip)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total con propina</dt>
              <dd>{formatCop(bill.balance + tip)}</dd>
            </div>
          </>
        ) : (
          <p className="pt-1 text-center font-semibold">Cuenta pagada{bill.tips ? ` · propina ${formatCop(bill.tips)}` : ''}</p>
        )}
      </dl>
      <p className="mt-3 text-center text-[11.5px]">La propina es voluntaria. Puedes pedir que se quite o se cambie.</p>
      <p className="mt-1 text-center text-[11.5px]">Este documento no es una factura.</p>
      <div className="mt-5 text-center print:hidden">
        <PrintButton />
      </div>
    </main>
    </div>
  );
}
