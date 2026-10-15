import type { Metadata } from 'next';
import Link from 'next/link';
import { syncWaTemplatesAction } from '@/app/empresa/whatsapp-actions';
import { AutoRefresh } from '@/components/auto-refresh';
import { ModuleOff } from '@/components/module-off';
import { WaStartForm } from '@/components/whatsapp-forms';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import { prettyPhone, type WaOverview } from '@/lib/whatsapp';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'WhatsApp — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
const FILTERS = [
  { key: '', label: 'Abiertas' },
  { key: 'mine', label: 'Mías' },
  { key: 'closed', label: 'Cerradas' },
];

export default async function WhatsappPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { id } = await params;
  const { filtro = '' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'whatsapp')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="WhatsApp empresarial"
        text="Los mensajes de WhatsApp de tus clientes llegan aquí: todo el equipo responde desde la plataforma, cada cliente queda en el CRM y puedes mandar plantillas aprobadas."
      />
    );
  }
  if (!atLeast(company.me.role, 'supervisor')) {
    return <p className={`${card} text-[15px] text-muted-foreground`}>El WhatsApp de la empresa lo atienden los supervisores y administradores.</p>;
  }
  const filter = FILTERS.some((f) => f.key === filtro) ? filtro : '';
  const { data } = await authedApi<WaOverview>(`/companies/${id}/whatsapp${filter ? `?filter=${filter}` : ''}`);
  const base = `/empresa/${id}/whatsapp`;
  const name = (memberId: string | null) => data.members.find((m) => m.id === memberId)?.name;

  if (!data.connected) {
    return (
      <section className={card}>
        <h2 className="font-display text-[20px] font-semibold text-foreground">Falta conectar el WhatsApp</h2>
        <p className="mt-2 max-w-[65ch] text-[14.5px] text-muted-foreground">
          El equipo de 3R conecta el número de WhatsApp Business de {company.name} con Meta. Cuando esté listo, los mensajes de tus clientes llegan
          aquí.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={20} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Conversaciones" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key ? `${base}?filtro=${f.key}` : base}
              aria-current={filter === f.key ? 'page' : undefined}
              className={`rounded-full border px-4 py-2 text-[13.5px] transition ${filter === f.key ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <p className="text-[13.5px] text-muted-foreground">
          {data.account?.displayPhone}
          {data.account?.status === 'paused' ? ' · en pausa' : ''}
        </p>
      </div>

      <section className={card} aria-label="Conversaciones">
        {data.conversations.length === 0 ? (
          <p className="text-[14.5px] text-muted-foreground">
            {filter === 'closed'
              ? 'No hay conversaciones cerradas.'
              : filter === 'mine'
                ? 'No tienes conversaciones asignadas.'
                : 'Todavía no han llegado mensajes.'}
          </p>
        ) : (
          <ul className="-my-3 divide-y divide-white/[0.06]">
            {data.conversations.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/${c.id}`} className="flex items-center gap-3 py-3 transition hover:opacity-90">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-[#25d366]/15 font-display text-[15px] font-semibold text-[#8ff0b6]"
                    aria-hidden
                  >
                    {c.name.replace(/^\+/, '').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[15px] ${c.unread ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>{c.name}</span>
                      <span className="shrink-0 text-[12px] text-muted-foreground">{when.format(new Date(c.lastMessageAt))}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] text-muted-foreground">
                        {c.last ? `${c.last.direction === 'out' ? 'Tú: ' : ''}${c.last.body}` : prettyPhone(c.waId)}
                      </span>
                      {c.unread ? (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#25d366] px-1.5 text-[11.5px] font-bold text-black">
                          {c.unread}
                        </span>
                      ) : null}
                    </span>
                    {c.assignedMemberId ? (
                      <span className="block text-[12px] text-muted-foreground">La atiende {name(c.assignedMemberId) ?? 'alguien del equipo'}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby="h-nuevo">
        <h2 id="h-nuevo" className="font-display text-[18px] font-semibold text-foreground">
          Escribirle a un cliente
        </h2>
        <p className="mt-1 mb-4 text-[14px] text-muted-foreground">Para escribirle primero, WhatsApp pide usar una plantilla aprobada por Meta.</p>
        <WaStartForm companyId={id} templates={data.templates} />
        {data.canManage ? (
          <form action={syncWaTemplatesAction} className="mt-5 border-t border-white/[0.06] pt-4">
            <input type="hidden" name="companyId" value={id} />
            <p className="mb-2 text-[13px] text-muted-foreground">
              Las plantillas se crean en el administrador de WhatsApp de Meta y Meta las aprueba. Después, tráelas aquí.
            </p>
            <button type="submit" className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]">
              Traer plantillas de Meta ({data.templates.length} aprobadas)
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
