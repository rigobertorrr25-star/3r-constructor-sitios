import type { Metadata } from 'next';
import Link from 'next/link';
import { toggleDocumentAction } from '@/app/empresa/assistant-actions';
import { AssistantChat } from '@/components/assistant-chat';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { AI_STATUS_TEXT, type AssistantOverview } from '@/lib/assistant';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Asistente — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });

export default async function AssistantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'ai_assistant')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Asistente con IA"
        text="Tu equipo le pregunta al asistente y él responde con tus manuales, reglamentos y artículos del Centro de conocimiento, diciendo de dónde sacó la respuesta."
      />
    );
  }
  const { data } = await authedApi<AssistantOverview>(`/companies/${id}/assistant`);
  const disabled = !data.enabled
    ? 'El asistente todavía no está activado. El equipo de 3R te avisa cuando esté listo.'
    : data.usage.today >= data.usage.companyCap
      ? 'La empresa ya hizo el máximo de preguntas de hoy. Mañana puedes seguir preguntando.'
      : data.usage.mine >= data.usage.memberCap
        ? 'Ya hiciste el máximo de preguntas de hoy. Mañana puedes seguir preguntando.'
        : null;
  const nothing = data.articles === 0 && !(data.documents ?? []).some((d) => d.aiEnabled && d.aiStatus === 'ready');

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby="h-asistente">
        <h2 id="h-asistente" className="font-display text-[20px] font-semibold text-foreground">
          Pregúntale al asistente
        </h2>
        <p className="mt-1 mb-5 text-[13.5px] text-muted-foreground">
          Responde solo con los documentos y artículos de {company.name}. Si algo no está escrito, te lo dice. Revisa siempre lo importante con tu
          jefe. Los administradores ven las preguntas que no supo responder, sin tu nombre.
        </p>
        <AssistantChat companyId={id} history={data.history} disabled={disabled} />
      </section>

      {data.canManage && data.documents ? (
        <>
          <section className={card} aria-labelledby="h-fuentes">
            <h2 id="h-fuentes" className="font-display text-[18px] font-semibold text-foreground">
              Qué puede leer
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Siempre lee los {data.articles} {data.articles === 1 ? 'artículo publicado' : 'artículos publicados'} del{' '}
              <Link href={`/empresa/${id}/conocimiento`} className="text-primary hover:underline">
                Centro de conocimiento
              </Link>
              . Además, marca los documentos de la empresa que quieres que use (PDF o Word). Los marcados «solo RR. HH.» solo los usa cuando pregunta
              alguien de recursos humanos en adelante. Los documentos personales de cada empleado nunca los lee.
            </p>
            {nothing ? (
              <p className="mt-3 rounded-2xl border border-[#ffd27a]/25 bg-[#ffd27a]/[0.05] px-4 py-3 text-[14px] text-[#ffe2a6]">
                Todavía no tiene nada que leer: publica artículos o marca documentos para que pueda responder.
              </p>
            ) : null}
            {data.documents.length === 0 ? (
              <p className="mt-4 text-[14px] text-muted-foreground">
                No hay documentos de la empresa.{' '}
                <Link href={`/empresa/${id}/documentos`} className="text-primary hover:underline">
                  Sube el reglamento o los manuales
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-white/[0.06]">
                {data.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-foreground">{d.title}</span>
                      <span className="block text-[12.5px] text-muted-foreground">
                        {d.fileName}
                        {d.audience === 'hr' ? ' · solo RR. HH.' : ''}
                        {!d.readable ? ' · no se puede leer (solo PDF o Word)' : d.aiEnabled ? ` · ${AI_STATUS_TEXT[d.aiStatus]}` : ''}
                      </span>
                    </span>
                    {d.readable ? (
                      <form action={toggleDocumentAction}>
                        <input type="hidden" name="companyId" value={id} />
                        <input type="hidden" name="documentId" value={d.id} />
                        <input type="hidden" name="enabled" value={d.aiEnabled ? 'false' : 'true'} />
                        <button
                          type="submit"
                          aria-pressed={d.aiEnabled}
                          className={`rounded-full border px-4 py-2 text-[13.5px] transition ${d.aiEnabled ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.12] text-muted-foreground hover:text-foreground'}`}
                        >
                          {d.aiEnabled ? 'Lo usa ✓' : 'Usar este'}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={card} aria-labelledby="h-falta">
            <h2 id="h-falta" className="font-display text-[18px] font-semibold text-foreground">
              Lo que no supo responder
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              En los últimos 30 días: {data.month?.questions ?? 0} preguntas · {data.month?.helpful ?? 0} dijeron que les sirvió ·{' '}
              {data.month?.notHelpful ?? 0} que no. Escribir un artículo con lo que falta hace que la próxima vez sí sepa.
            </p>
            {data.unanswered?.length ? (
              <ul className="mt-4 divide-y divide-white/[0.06]">
                {data.unanswered.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0 flex-1 text-[14.5px] text-foreground">
                      {q.question}
                      <span className="block text-[12.5px] text-muted-foreground">
                        {when.format(new Date(q.createdAt))} · {q.answered ? 'dijeron que no les sirvió' : 'no lo encontró'}
                      </span>
                    </span>
                    <Link href={`/empresa/${id}/conocimiento/nuevo`} className="text-[13.5px] text-primary hover:underline">
                      Escribir un artículo
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[14px] text-muted-foreground">Nada por ahora.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
