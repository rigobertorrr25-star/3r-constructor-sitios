import { INVOICE_LABEL, METHOD_LABEL, dateText, pesos, type Invoice } from '@/lib/billing';

/** Lista de facturas; `actions` pinta los botones de cada una (pagar, marcar pagada…). */
export function InvoiceList({ invoices, actions }: { invoices: Invoice[]; actions?: (i: Invoice) => React.ReactNode }) {
  if (!invoices.length) return <p className="text-[14.5px] text-muted-foreground">Todavía no hay facturas.</p>;
  return (
    <ul className="divide-y divide-white/[0.06]">
      {invoices.map((i) => (
        <li key={i.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-foreground">
              {i.code} · {pesos(i.total)}
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              {dateText(i.periodStart)} al {dateText(i.periodEnd)} · {i.items.map((x) => x.name).join(', ') || 'Sin detalle'}
            </p>
            <p className={`text-[12.5px] ${i.overdue ? 'text-[#ffb4b5]' : 'text-muted-foreground'}`}>
              {i.status === 'paid'
                ? `Pagada el ${dateText(i.paidAt!)}${i.method ? ` · ${METHOD_LABEL[i.method] ?? i.method}` : ''}${i.paymentNote ? ` · ${i.paymentNote}` : ''}`
                : i.status === 'void'
                  ? 'Anulada'
                  : `${i.overdue ? 'Vencida' : 'Vence'} el ${dateText(i.dueDate)}`}
            </p>
          </div>
          <span
            className={`w-fit rounded-full px-2.5 py-1 text-[12.5px] ${i.status === 'paid' ? 'bg-[#5ee0a0]/15 text-[#9df0c6]' : i.overdue ? 'bg-[#ff8a8c]/15 text-[#ffb4b5]' : 'bg-white/[0.06] text-foreground'}`}
          >
            {i.overdue ? 'Vencida' : INVOICE_LABEL[i.status]}
          </span>
          {actions ? <div className="shrink-0">{actions(i)}</div> : null}
        </li>
      ))}
    </ul>
  );
}
