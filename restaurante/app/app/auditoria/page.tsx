import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { listAudit } from '@/lib/store';
import { Empty, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

const FILTERS: { action: string; label: string }[] = [
  { action: '', label: 'Todo' },
  { action: 'table.close', label: 'Cierres de mesa' },
  { action: 'order.void', label: 'Anulaciones' },
  { action: 'discount.apply', label: 'Descuentos' },
  { action: 'payment.reverse', label: 'Pagos reversados' },
  { action: 'cash.close', label: 'Cierres de caja' },
  { action: 'inventory.count', label: 'Conteos' },
  { action: 'menu.price', label: 'Cambios de precio' },
  { action: 'table.move', label: 'Cambios de mesa' },
  { action: 'auth.failed', label: 'PIN equivocados' },
  { action: 'auth.locked', label: 'Bloqueos' },
  { action: 'staff.update', label: 'Cambios en el equipo' },
];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ accion?: string }> }) {
  const staff = await requireStaff('audit.view');
  const { accion = '' } = await searchParams;
  const action = FILTERS.some((f) => f.action === accion) ? accion : '';
  const events = await listAudit(staff, { limit: 200, action: action || undefined });
  return (
    <div className="space-y-6">
      <PageTitle
        title="Auditoría"
        text={`Todo lo importante queda aquí y no se puede borrar ni cambiar. ${staff.role === 'owner' ? 'Ves todas las sedes.' : `Sede ${staff.locationName}.`}`}
      />
      <nav aria-label="Filtrar" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.action}
            href={f.action ? `/app/auditoria?accion=${f.action}` : '/app/auditoria'}
            className={`rounded-full px-4 py-1.5 text-[14px] transition ${f.action === action ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {events.length === 0 ? (
        <Empty>No hay nada todavía.</Empty>
      ) : (
        <ol className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-5">
              <span className="shrink-0 text-[13px] text-muted-foreground sm:w-[130px]">{formatDateTime(e.createdAt, staff.timezone)}</span>
              <span className="flex-1 text-[14.5px]">
                <span className="text-foreground">{e.summary}</span>
                {e.reason ? <span className="block text-[13.5px] text-warning">Motivo: {e.reason}</span> : null}
              </span>
              <span className="shrink-0 text-[13px] text-muted-foreground">
                {e.actorName ?? '—'}
                {staff.role === 'owner' && e.locationName ? ` · ${e.locationName}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
