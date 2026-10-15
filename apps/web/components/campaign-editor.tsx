'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { audienceAction, saveCampaignAction, sendCampaignAction, testCampaignAction, type MarketingResult } from '@/app/empresa/marketing-actions';
import { CRM_STAGES, SOURCE_LABEL, STAGE_LABEL } from '@/lib/crm';
import { splitSubject } from '@/lib/ai-content';
import { people, type CampaignDetail, type Segment } from '@/lib/marketing';
import { AiSuggest } from './ai-writer';
import { ArticleBody } from './article-body';
import { Field, TextAreaField } from './field';
import { Alert } from './shop';

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Chips({
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <p className="mb-2 text-[13px] text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value.includes(o.value)}
            onClick={() => onChange(toggle(value, o.value))}
            className={chip(value.includes(o.value))}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Crear o editar una campaña (borrador), ver cómo queda, probarla y enviarla. */
export function CampaignEditor({
  companyId,
  companyName,
  tags,
  campaign,
  canSend = false,
  remainingToday = 0,
  ai = false,
}: {
  companyId: string;
  companyName: string;
  tags: string[];
  campaign?: CampaignDetail;
  canSend?: boolean;
  remainingToday?: number;
  /** La empresa tiene Textos con IA. */
  ai?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign?.name ?? '');
  const [subject, setSubject] = useState(campaign?.subject ?? '');
  const [body, setBody] = useState(campaign?.body ?? '');
  const [segment, setSegment] = useState<Segment>(campaign?.segment ?? { stages: [], sources: [], tags: [] });
  const [count, setCount] = useState<number | null>(campaign?.audience ?? null);
  const [result, setResult] = useState<MarketingResult>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const saved =
    campaign &&
    name === campaign.name &&
    subject === campaign.subject &&
    body === campaign.body &&
    JSON.stringify(segment) === JSON.stringify(campaign.segment);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => audienceAction(companyId, segment).then((n) => live && setCount(n)), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [companyId, segment]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setResult(undefined);
    start(async () => {
      const r = await saveCampaignAction(companyId, campaign?.id ?? null, { name, subject, body, segment });
      setResult(r);
      if (r?.ok) router.refresh();
    });
  }
  const run = (fn: () => Promise<MarketingResult>, after?: () => void) => {
    setResult(undefined);
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r?.ok) after?.();
    });
  };

  const overCap = count !== null && count > remainingToday;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={save} className="space-y-6">
        <Field
          label="Nombre (solo lo ve tu equipo)"
          name="name"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Promoción de octubre"
        />
        <Field
          label="Asunto del correo"
          name="subject"
          required
          minLength={3}
          maxLength={150}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Este fin de semana: 2x1 en café"
        />
        {ai ? (
          <AiSuggest
            companyId={companyId}
            kind="email"
            label="Escribir el correo con IA"
            onPick={(text) => {
              const r = splitSubject(text);
              if (r.subject) setSubject(r.subject.slice(0, 150));
              setBody(r.body);
            }}
          />
        ) : null}
        <TextAreaField
          label="Mensaje"
          name="body"
          required
          minLength={10}
          maxLength={20000}
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          hint="Deja una línea en blanco entre párrafos. Empieza una línea con «## » para un título y con «- » para una lista."
          placeholder={'## ¡Llegó el menú de octubre!\n\nVen a probar nuestras nuevas tortas.\n\n- Torta de zanahoria\n- Torta de chocolate'}
        />

        <div className="space-y-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="font-display text-[16px] font-semibold text-foreground">¿A quién le llega?</p>
          <Chips
            legend="Etapa en el CRM"
            hint="Sin marcar ninguna: todas."
            options={CRM_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
            value={segment.stages}
            onChange={(stages) => setSegment((s) => ({ ...s, stages }))}
          />
          <Chips
            legend="De dónde llegó"
            hint="Sin marcar ninguno: todos."
            options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
            value={segment.sources}
            onChange={(sources) => setSegment((s) => ({ ...s, sources }))}
          />
          {tags.length ? (
            <Chips
              legend="Etiquetas"
              hint="Le llega a quien tenga al menos una de las marcadas."
              options={tags.map((t) => ({ value: t, label: t }))}
              value={segment.tags}
              onChange={(t) => setSegment((s) => ({ ...s, tags: t }))}
            />
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Para armar grupos más finos, ponle etiquetas a tus contactos en el CRM (por ejemplo «vip» o «mayorista»).
            </p>
          )}
          <p className="text-[14.5px] text-foreground" aria-live="polite">
            {count === null ? 'Contando…' : count === 0 ? 'Nadie en este grupo ha aceptado recibir promociones.' : `Le llegaría a ${people(count)}.`}
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            Solo reciben los contactos que aceptaron recibir promociones y no se han dado de baja.
          </p>
        </div>

        {result && !result.ok ? <Alert>{result.error}</Alert> : null}
        {result?.ok && result.message ? <Alert tone="ok">{result.message}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || !!saved}
            className="rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-50"
          >
            {campaign ? (saved ? 'Guardado' : 'Guardar cambios') : 'Guardar borrador'}
          </button>
          {campaign ? (
            <button
              type="button"
              disabled={pending || !saved}
              onClick={() => run(() => testCampaignAction(companyId, campaign.id))}
              className="rounded-full border border-white/[0.12] px-5 py-3 text-[14px] text-foreground hover:bg-white/[0.06] disabled:opacity-50"
            >
              Enviarme una prueba
            </button>
          ) : null}
        </div>

        {campaign ? (
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/[0.05] p-4">
            <p className="font-display text-[16px] font-semibold text-foreground">Enviar</p>
            {!canSend ? (
              <p className="text-[14px] text-muted-foreground">Un administrador de la empresa es quien envía la campaña. Déjala lista y avísale.</p>
            ) : !saved ? (
              <p className="text-[14px] text-muted-foreground">Guarda los cambios antes de enviar.</p>
            ) : overCap ? (
              <p className="text-[14px] text-[#ffd27a]">
                Hoy puedes mandar {remainingToday} correos más y este grupo tiene {count}. Elige un grupo más pequeño o envíala mañana.
              </p>
            ) : !count ? (
              <p className="text-[14px] text-muted-foreground">Elige un grupo con al menos una persona.</p>
            ) : confirming ? (
              <div className="space-y-3">
                <p className="text-[14.5px] text-foreground">
                  ¿Mandar «{subject}» a {people(count)}? Ya no se podrá cambiar ni detener.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => sendCampaignAction(companyId, campaign.id),
                        () => router.refresh(),
                      )
                    }
                    className="rounded-full bg-primary px-5 py-3 text-[14px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {pending ? 'Enviando…' : 'Sí, enviar ahora'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-full border border-white/[0.12] px-5 py-3 text-[14px] text-foreground hover:bg-white/[0.06]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[14px] text-muted-foreground">
                  Te recomendamos mandarte una prueba primero. Los correos salen de a poco, en unos minutos.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="rounded-full bg-primary px-5 py-3 text-[14px] font-medium text-primary-foreground"
                >
                  Enviar a {people(count)}
                </button>
              </>
            )}
          </div>
        ) : null}
      </form>

      <section aria-label="Vista previa del correo" className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-[13px] text-muted-foreground">Así se verá el correo</p>
        <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-[13px] text-muted-foreground">De: {companyName}</p>
          <p className="mt-1 font-display text-[17px] font-semibold text-foreground">{subject || 'Asunto del correo'}</p>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            {body.trim() ? <ArticleBody body={body} /> : <p className="text-[14px] text-muted-foreground">Escribe el mensaje para verlo aquí.</p>}
          </div>
          <p className="mt-6 border-t border-white/[0.06] pt-3 text-center text-[12px] text-muted-foreground">
            Recibes este correo porque aceptaste recibir novedades de {companyName}.
            <br />
            <span className="underline">No quiero recibir más correos</span>
          </p>
        </div>
      </section>
    </div>
  );
}
