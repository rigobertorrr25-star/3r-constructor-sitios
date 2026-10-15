import { pesos, type QuoteItem } from '@/lib/quotes';

/** Tabla de ítems y totales de una cotización (la usan el detalle interno y la página del cliente). */
export function QuoteSheet({
  items,
  subtotal,
  discount,
  taxRate,
  tax,
  total,
}: {
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-[12.5px] text-muted-foreground">
              <th className="py-2 pr-3 font-normal">Descripción</th>
              <th className="py-2 pr-3 text-right font-normal">Cant.</th>
              <th className="py-2 pr-3 text-right font-normal">Valor unitario</th>
              <th className="py-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={n} className="border-b border-white/[0.05] align-top">
                <td className="py-3 pr-3 text-foreground">{i.description}</td>
                <td className="py-3 pr-3 text-right text-foreground">{i.quantity}</td>
                <td className="py-3 pr-3 text-right text-foreground">{pesos(i.unitPrice)}</td>
                <td className="py-3 text-right text-foreground">{pesos(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto mt-4 max-w-xs space-y-2 text-[14px]">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-foreground">{pesos(subtotal)}</dd>
        </div>
        {discount ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Descuento</dt>
            <dd className="text-foreground">- {pesos(discount)}</dd>
          </div>
        ) : null}
        {taxRate ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">IVA {taxRate} %</dt>
            <dd className="text-foreground">{pesos(tax)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-white/[0.08] pt-2">
          <dt className="font-medium text-foreground">Total</dt>
          <dd className="font-display text-[20px] font-bold text-foreground">{pesos(total)}</dd>
        </div>
      </dl>
    </div>
  );
}
