import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteDocumentAction } from '@/app/empresa/documents-actions';
import { DocumentUploadPanel } from '@/components/document-upload';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import { CATEGORY_LABEL, formatSize, type DocumentFolder, type DocumentList, type DocumentsSummary } from '@/lib/documents';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Documentos — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const short = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
const dateOnly = (iso: string) => short.format(new Date(`${iso}T12:00:00Z`));

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  const { id } = await params;
  const { member } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'documents')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Documentos"
        text="Reglamentos, manuales y la carpeta de cada empleado (contrato, cédula, soportes), privados y en un solo lugar, con aviso antes de que algo venza."
      />
    );
  }
  if (member && !/^[0-9a-f-]{36}$/i.test(member)) notFound();
  const isHr = atLeast(company.me.role, 'hr');
  const [listRes, { data: folders }, { data: summary }] = await Promise.all([
    authedApi<DocumentList>(`/companies/${id}/documents${member ? `?memberId=${member}` : ''}`),
    authedApi<DocumentFolder[]>(`/companies/${id}/documents/folders`),
    authedApi<DocumentsSummary>(`/companies/${id}/documents/summary`),
  ]);
  if (listRes.status === 404) notFound();
  const list = listRes.data;
  const others = folders.filter((f) => !f.self);
  const mineFolder = folders.find((f) => f.self);
  const folderLink = (memberId: string | null, label: string, count: number | null, active: boolean, sub?: string | null) => (
    <Link
      key={memberId ?? 'empresa'}
      href={`/empresa/${id}/documentos${memberId ? `?member=${memberId}` : ''}`}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-[14.5px] transition ${active ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'}`}
    >
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {sub ? <span className="block truncate text-[12px] text-muted-foreground">{sub}</span> : null}
      </span>
      {count !== null ? <span className="shrink-0 text-[12.5px] text-muted-foreground">{count}</span> : null}
    </Link>
  );

  return (
    <div className="space-y-8">
      {isHr && summary.expiring.length > 0 ? (
        <section className="rounded-[28px] border border-[#ffd27a]/25 bg-[#ffd27a]/[0.05] p-6" aria-labelledby="h-vencen">
          <h2 id="h-vencen" className="font-display text-[18px] font-semibold text-foreground">
            Vencen pronto
          </h2>
          <ul className="mt-3 space-y-2">
            {summary.expiring.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 text-[14.5px]">
                <Link href={`/empresa/${id}/documentos${e.memberId ? `?member=${e.memberId}` : ''}`} className="text-foreground hover:underline">
                  {e.title}
                  {e.person ? <span className="text-muted-foreground"> · {e.person}</span> : null}
                </Link>
                <span className={e.expired ? 'text-[#ffb4b5]' : 'text-muted-foreground'}>
                  {e.expired ? 'Venció el ' : 'Vence el '}
                  {dateOnly(e.expiresOn)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        <nav aria-label="Carpetas" className="rounded-[24px] border border-white/[0.08] bg-card p-2">
          {folderLink(null, 'De la empresa', summary.company, !member)}
          {mineFolder ? folderLink(mineFolder.id, 'Mis documentos', mineFolder.count, member === mineFolder.id) : null}
          {others.length > 0 ? (
            <>
              <p className="px-4 pb-1 pt-4 text-[12.5px] text-muted-foreground">Equipo</p>
              {others.map((f) => folderLink(f.id, f.name, f.count, member === f.id, f.jobTitle))}
            </>
          ) : null}
        </nav>

        <div className="min-w-0 space-y-6">
          <div>
            <h2 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
              {!list.owner
                ? 'Documentos de la empresa'
                : list.owner.id === company.me.memberId
                  ? 'Mis documentos'
                  : `Documentos de ${list.owner.name}`}
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {!list.owner
                ? 'Reglamentos, manuales y documentos para el equipo.'
                : 'Privados: solo los ven la persona, Recursos Humanos y la administración.'}
            </p>
          </div>

          {list.canUpload ? <DocumentUploadPanel companyId={id} memberId={list.owner?.id} isHr={isHr} /> : null}

          {list.documents.length === 0 ? (
            <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
              Esta carpeta está vacía.
            </p>
          ) : (
            <ul className={`${card} divide-y divide-white/[0.06] !p-0`}>
              {list.documents.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">{d.title}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {[
                        CATEGORY_LABEL[d.category] ?? d.category,
                        formatSize(d.size),
                        short.format(new Date(d.createdAt)),
                        d.uploadedBy ? `subió ${d.uploadedBy}` : null,
                        d.audience === 'hr' ? 'solo RR. HH.' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {d.expiresOn ? <p className="text-[12.5px] text-[#ffd27a]">Vence el {dateOnly(d.expiresOn)}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <a
                      href={`/empresa/${id}/documentos/descargar/${d.id}`}
                      className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
                    >
                      Descargar
                    </a>
                    {d.can.manage ? (
                      <form action={deleteDocumentAction}>
                        <input type="hidden" name="companyId" value={id} />
                        <input type="hidden" name="documentId" value={d.id} />
                        <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                          Borrar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
