import type { Metadata } from 'next';
import { whatsappLink } from '@/components/whatsapp-button';
import { AREA_LABEL, MODULE_INFO, atLeast, type ModuleArea } from '@/lib/companies';
import { loadCompany } from './company';

export const metadata: Metadata = { title: 'Mi empresa — 3R' };

const AREAS: ModuleArea[] = ['clientes', 'empresa', 'web', 'automatizacion', 'ia'];

export default async function CompanyHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const active = company.modules.filter((m) => m.enabled).length;
  const canAsk = atLeast(company.me.role, 'admin');

  return (
    <div className="space-y-12">
      <dl className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-[24px] border border-white/[0.08] bg-card p-5">
          <dt className="text-[13px] text-muted-foreground">Personas</dt>
          <dd className="mt-1 font-display text-[30px] font-bold text-foreground">{company.memberCount}</dd>
        </div>
        <div className="rounded-[24px] border border-white/[0.08] bg-card p-5">
          <dt className="text-[13px] text-muted-foreground">Módulos activos</dt>
          <dd className="mt-1 font-display text-[30px] font-bold text-foreground">{active}</dd>
        </div>
      </dl>

      {AREAS.map((area) => {
        const modules = company.modules.filter((m) => m.area === area);
        return (
          <section key={area} aria-labelledby={`area-${area}`}>
            <h2 id={`area-${area}`} className="font-display text-[22px] font-semibold tracking-tight text-foreground">
              {AREA_LABEL[area]}
            </h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m) => {
                const info = MODULE_INFO[m.key] ?? { name: m.key, text: '' };
                return (
                  <li key={m.key} className="flex h-full flex-col rounded-[24px] border border-white/[0.08] bg-card p-5 shadow-[var(--shadow-glass)]">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-[17.5px] font-semibold text-foreground">{info.name}</h3>
                      {m.enabled ? (
                        <span className="shrink-0 rounded-full bg-[#5ee0a0]/15 px-2.5 py-1 text-[12px] text-[#9df0c6]">Activo</span>
                      ) : !m.ready ? (
                        <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-[12px] text-muted-foreground">Muy pronto</span>
                      ) : null}
                    </div>
                    <p className="mt-2 flex-1 text-[14px] leading-snug text-muted-foreground">{info.text}</p>
                    {m.ready && !m.enabled && canAsk ? (
                      <a
                        href={whatsappLink(`Hola, quiero activar el módulo ${info.name} para ${company.name}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex w-fit rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
                      >
                        Activarlo
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
