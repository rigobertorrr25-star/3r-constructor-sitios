import type { Metadata } from 'next';
import Link from 'next/link';
import { ModuleOff } from '@/components/module-off';
import { whatsappLink } from '@/components/whatsapp-button';
import { authedApi } from '@/lib/api';
import type { WebOverview } from '@/lib/company-web';
import { loadCompany } from '../company';
import { PublishButton } from './publish-button';

export const metadata: Metadata = { title: 'Página web — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

export default async function CompanyWebPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'web')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Página web"
        text="Cambia tú mismo los textos, las fotos y los botones de tu página de 3R, y publícala con un botón."
      />
    );
  }
  const { data } = await authedApi<WebOverview>(`/companies/${id}/web`);
  if (!data.site) {
    return (
      <div className={`${card} max-w-xl`}>
        <h2 className="font-display text-[20px] font-semibold text-foreground">Tu página todavía no está conectada</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">Cuando el equipo de 3R la conecte, aquí podrás cambiar sus textos y fotos.</p>
        <a
          href={whatsappLink(`Hola, quiero conectar la página de ${company.name} a mi empresa en 3R`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground"
        >
          Pedirlo por WhatsApp
        </a>
      </div>
    );
  }
  const { site } = data;
  const p = site.publication;
  const live = p.customUrl ?? p.url;

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby="h-pagina">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="h-pagina" className="font-display text-[22px] font-semibold text-foreground">
              {site.name}
            </h2>
            {live && p.published ? (
              <a
                href={live}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block break-all text-[14.5px] text-foreground/90 underline-offset-2 hover:underline"
              >
                {live.replace(/^https?:\/\//, '')} ↗
              </a>
            ) : null}
            <p className={`mt-2 text-[14px] ${p.hasUnpublishedChanges ? 'text-[#ffd27a]' : 'text-muted-foreground'}`}>
              {!p.published
                ? 'Todavía no está publicada.'
                : p.hasUnpublishedChanges
                  ? 'Tienes cambios guardados que todavía no se ven en la página.'
                  : `Al día${p.publishedAt ? ` · publicada el ${when.format(new Date(p.publishedAt))}` : '.'}`}
            </p>
          </div>
          {data.canEdit && (p.hasUnpublishedChanges || !p.published) ? <PublishButton companyId={id} /> : null}
        </div>
      </section>

      <section aria-labelledby="h-paginas">
        <h2 id="h-paginas" className="mb-3 font-display text-[18px] font-semibold text-foreground">
          {data.canEdit ? '¿Qué quieres cambiar?' : 'Páginas'}
        </h2>
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {site.pages.map((pg) => (
            <li key={pg.id}>
              {data.canEdit ? (
                <Link
                  href={`/empresa/${id}/pagina-web/${pg.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.03]"
                >
                  <span className="text-[15px] text-foreground">
                    {pg.title}
                    {pg.isHomepage && pg.title.toLowerCase() !== 'inicio' ? (
                      <span className="ml-2 text-[12.5px] text-muted-foreground">Inicio</span>
                    ) : null}
                  </span>
                  <span className="text-[13.5px] text-muted-foreground">Cambiar textos y fotos →</span>
                </Link>
              ) : (
                <span className="block px-5 py-4 text-[15px] text-foreground">{pg.title}</span>
              )}
            </li>
          ))}
        </ul>
        {data.canEdit ? (
          <p className="mt-3 text-[13.5px] text-muted-foreground">
            Aquí cambias textos, fotos y botones. Para cambiar el diseño o agregar secciones, escríbele al equipo de 3R.
          </p>
        ) : (
          <p className="mt-3 text-[13.5px] text-muted-foreground">Los administradores de la empresa pueden cambiar los textos y las fotos.</p>
        )}
      </section>
    </div>
  );
}
