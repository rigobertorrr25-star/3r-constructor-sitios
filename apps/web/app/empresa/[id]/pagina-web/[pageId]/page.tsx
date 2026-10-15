import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteContentEditor } from '@/components/site-content-editor';
import { authedApi } from '@/lib/api';
import type { PageFields } from '@/lib/company-web';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Cambiar la página — 3R' };

export default async function EditSiteContentPage({ params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(pageId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<PageFields>(`/companies/${id}/web/pages/${pageId}`);
  if (!res.ok) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/pagina-web`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Página web
      </Link>
      <div>
        <h2 className="font-display text-[24px] font-bold tracking-tight text-foreground">{res.data.page.title}</h2>
        <p className="mt-1 text-[14.5px] text-muted-foreground">Cambia lo que necesites, guarda y publica. El diseño de la página no cambia.</p>
      </div>
      <SiteContentEditor companyId={id} data={res.data} />
    </div>
  );
}
