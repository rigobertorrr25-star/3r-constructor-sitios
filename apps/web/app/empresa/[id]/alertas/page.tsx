import type { Metadata } from 'next';
import { readAllAlertsAction } from '@/app/empresa/alerts-actions';
import { ModuleOff } from '@/components/module-off';
import { KIND_LABEL, type AlertList } from '@/lib/alerts';
import { authedApi } from '@/lib/api';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Alertas — 3R' };

const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export default async function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'alerts')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Alertas"
        text="Avisos de lo que te toca: tickets asignados, solicitudes por decidir, documentos y contratos por vencer, cumpleaños y un resumen diario por correo."
      />
    );
  }
  const { data } = await authedApi<AlertList>(`/companies/${id}/alerts`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Alertas</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {data.unread ? `${data.unread} sin leer.` : 'Estás al día.'} Cada mañana te llega por correo un resumen de lo nuevo.
          </p>
        </div>
        {data.unread ? (
          <form action={readAllAlertsAction}>
            <input type="hidden" name="companyId" value={id} />
            <button
              type="submit"
              className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
            >
              Marcar todo como leído
            </button>
          </form>
        ) : null}
      </div>
      {data.items.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          Todavía no tienes avisos.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {data.items.map((a) => (
            <li key={a.id}>
              <a
                href={`/empresa/${id}/alertas/abrir/${a.id}`}
                className={`flex items-start gap-3 px-5 py-4 transition hover:bg-white/[0.03] ${a.readAt ? '' : 'bg-primary/[0.05]'}`}
              >
                <span className={`mt-2 size-2 shrink-0 rounded-full ${a.readAt ? 'bg-white/15' : 'bg-primary'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] ${a.readAt ? 'text-foreground/80' : 'font-medium text-foreground'}`}>{a.title}</span>
                  {a.body ? <span className="block truncate text-[13.5px] text-muted-foreground">{a.body}</span> : null}
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    {KIND_LABEL[a.kind] ?? a.kind} · {when.format(new Date(a.createdAt))}
                  </span>
                </span>
                {a.readAt ? null : <span className="sr-only">Sin leer</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
