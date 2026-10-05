import { aiConfigured, getBrief } from '@/lib/brief';
import { formatTime } from '@/lib/format';
import type { StaffSession } from '@/lib/store';
import { RefreshBriefButton } from './brief-refresh';

/** "¿Qué pasó hoy?": el resumen del día. Se carga aparte para no frenar el resto del tablero. */
export async function BriefCard({ staff, day, scope }: { staff: StaffSession; day: string; scope: string | null }) {
  const brief = await getBrief(staff, { day, locationId: scope, timeZone: staff.timezone });
  return (
    <section className="rounded-[24px] border border-primary/30 bg-primary/[0.06] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-bold">¿Qué pasó?</h2>
        <span className="text-[12.5px] text-muted-foreground">
          {brief.source === 'ia' ? 'Escrito con IA' : aiConfigured() ? 'Resumen automático (la IA no respondió)' : 'Resumen automático'} · {formatTime(brief.createdAt, staff.timezone)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-line text-[15.5px] leading-relaxed">{brief.text}</p>
      <RefreshBriefButton day={day} scope={scope ?? 'all'} />
    </section>
  );
}

export function BriefSkeleton() {
  return (
    <section className="rounded-[24px] border border-primary/30 bg-primary/[0.06] p-5" aria-busy="true">
      <h2 className="font-display text-[17px] font-bold">¿Qué pasó?</h2>
      <p className="mt-2 animate-pulse text-[15px] text-muted-foreground">Escribiendo el resumen del día…</p>
    </section>
  );
}
