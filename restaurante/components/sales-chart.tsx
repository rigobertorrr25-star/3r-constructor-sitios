import { formatCop } from '@/lib/format';
import { addDays } from '@/lib/periods';

/**
 * Ventas por día: una sola serie en barras delgadas (sin leyenda: el título la nombra). Cada barra muestra su
 * valor al pasar el cursor o al enfocarla, y hay una vista de tabla para quien no ve la gráfica.
 */
export function SalesByDay({ days, from, to }: { days: { day: string; sales: number }[]; from: string; to: string }) {
  const all: { day: string; sales: number }[] = [];
  const by = new Map(days.map((d) => [d.day, d.sales]));
  for (let d = from; d <= to && all.length < 400; d = addDays(d, 1)) all.push({ day: d, sales: by.get(d) ?? 0 });
  const max = Math.max(...all.map((d) => d.sales), 1);
  const label = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (all.length === 1) return <p className="mt-2 font-display text-[24px] font-bold">{formatCop(all[0].sales)}</p>;
  const best = all.reduce((a, b) => (b.sales > a.sales ? b : a));
  return (
    <div className="mt-3">
      <div className="relative flex h-36 items-end gap-[2px] border-b border-white/[0.12]" role="img" aria-label={`Ventas por día del ${label(from)} al ${label(to)}. Mejor día: ${label(best.day)} con ${formatCop(best.sales)}.`}>
        {all.map((d) => (
          <div key={d.day} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none" aria-label={`${label(d.day)}: ${formatCop(d.sales)}`}>
            <div className="mx-auto w-full max-w-[40px] rounded-t-[4px] bg-primary/85 transition group-hover:bg-primary group-focus:bg-primary" style={{ height: `${(d.sales / max) * 100}%`, minHeight: d.sales ? 2 : 0 }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/[0.1] bg-[#0a131a] px-2 py-1 text-[12px] text-foreground shadow-lg group-hover:block group-focus:block">
              {label(d.day)} · {formatCop(d.sales)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-muted-foreground">
        <span>{label(from)}</span>
        <span>{label(to)}</span>
      </div>
      <details className="mt-2 text-[13px]">
        <summary className="cursor-pointer text-muted-foreground">Ver como tabla</summary>
        <table className="mt-2 w-full">
          <tbody>
            {all.map((d) => (
              <tr key={d.day} className="border-t border-white/[0.06]">
                <td className="py-1 text-muted-foreground">{label(d.day)}</td>
                <td className="py-1 text-right">{formatCop(d.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
