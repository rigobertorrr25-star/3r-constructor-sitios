import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteSiteButton } from '@/components/delete-site-button';
import { authedApi } from '@/lib/api';
import type { Site } from '@/lib/types';

export const metadata: Metadata = { title: 'Sitios — Administración 3R' };

const statusLabel: Record<string, { text: string; dot: string }> = {
  draft: { text: 'Borrador', dot: 'bg-[#f7cb58]' },
  published: { text: 'Publicado', dot: 'bg-[#5ee0a0]' },
  archived: { text: 'Archivado', dot: 'bg-muted-foreground' },
};

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });

const primaryLink =
  'inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition duration-300 ease-[var(--ease-emphasized)] hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

export default async function AdminSitesPage() {
  const { data: sites } = await authedApi<Site[]>('/sites');

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Sitios</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Las páginas que construyes con el editor. Los de pedidos se crean desde cada pedido; aquí también puedes hacer los tuyos.
          </p>
        </div>
        <Link href="/admin/sitios/nuevo" className={primaryLink}>
          + Crear sitio
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="mt-10 rounded-[32px] border border-dashed border-white/[0.12] px-6 py-14 text-center text-muted-foreground">
          Aún no hay sitios. Crea uno desde un pedido o con “Crear sitio”.
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-[17px] sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => {
            const status = statusLabel[site.status] ?? statusLabel.draft;
            return (
              <li key={site.id} className="flex flex-col rounded-[32px] border border-white/[0.08] bg-card p-[22px] shadow-[var(--shadow-glass)]">
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span className={`size-2 rounded-full ${status.dot}`} aria-hidden="true" />
                  {status.text}
                </div>
                <h2 className="mt-3 truncate font-display text-[20px] font-semibold text-foreground" title={site.name}>
                  {site.name}
                </h2>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">/{site.slug}</p>
                <p className="mt-4 text-[13px] text-muted-foreground">
                  {site._count.pages} {site._count.pages === 1 ? 'página' : 'páginas'} · Editado {dateFormat.format(new Date(site.updatedAt))}
                </p>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <Link
                    href={`/editor/${site.id}`}
                    className="rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  >
                    Editar
                  </Link>
                  <DeleteSiteButton siteId={site.id} name={site.name} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
