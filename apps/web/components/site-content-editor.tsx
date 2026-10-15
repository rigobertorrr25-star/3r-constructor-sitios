'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { presignWebImageAction, publishWebAction, savePageFieldsAction } from '@/app/empresa/web-actions';
import { FIELD_LABEL, type Field, type PageFields } from '@/lib/company-web';
import { inputClass } from './field';
import { Alert } from './shop';

type Draft = Record<string, Partial<Field>>;

async function uploadPhoto(companyId: string, file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Usa una foto PNG, JPG o WEBP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('La foto pesa más de 8 MB.');
  const res = await presignWebImageAction(companyId, file.type);
  if (!res.ok) throw new Error(res.error);
  const up = await fetch(res.presign.uploadUrl, { method: res.presign.method, headers: res.presign.headers, body: file });
  if (!up.ok) throw new Error('La subida falló. Inténtalo otra vez.');
  return res.presign.publicUrl;
}

function PhotoField({
  companyId,
  value,
  alt,
  onChange,
}: {
  companyId: string;
  value: string;
  alt: string;
  onChange: (patch: Partial<Field>) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
      <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-[13px] text-muted-foreground">Sin foto</span>
        )}
      </div>
      <div className="space-y-2">
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-label="Subir foto"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              onChange({ src: await uploadPhoto(companyId, file) });
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06] disabled:opacity-60"
        >
          {busy ? 'Subiendo…' : 'Cambiar foto'}
        </button>
        <input
          aria-label="Descripción de la foto"
          value={alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          maxLength={300}
          placeholder="Qué se ve en la foto (ayuda a Google y a personas ciegas)"
          className={inputClass}
        />
        {error ? <p className="text-[13px] text-[#ffb4b5]">{error}</p> : null}
      </div>
    </div>
  );
}

export function SiteContentEditor({ companyId, data }: { companyId: string; data: PageFields }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({});
  const [base, setBase] = useState(data.versionId);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = Object.keys(draft).length;
  const val = (f: Field, k: keyof Field) => (draft[f.nodeId]?.[k] ?? f[k] ?? '') as string;
  const set = (f: Field, patch: Partial<Field>) => {
    setMsg(null);
    setDraft((d) => ({ ...d, [f.nodeId]: { ...d[f.nodeId], ...patch } }));
  };

  const save = (thenPublish: boolean) =>
    start(async () => {
      setMsg(null);
      if (dirty) {
        const res = await savePageFieldsAction(
          companyId,
          data.page.id,
          base,
          Object.entries(draft).map(([nodeId, c]) => ({ nodeId, ...c })),
        );
        if (!res.ok) return setMsg({ tone: 'error', text: res.error });
        setBase(res.versionId);
        setDraft({});
      }
      if (thenPublish) {
        const pub = await publishWebAction(companyId);
        if (!pub.ok) return setMsg({ tone: 'error', text: pub.error });
        setMsg({ tone: 'ok', text: 'Listo: tu página ya muestra los cambios.' });
      } else setMsg({ tone: 'ok', text: 'Cambios guardados. Publica para que se vean en tu página.' });
      router.refresh();
    });

  return (
    <div className="space-y-6 pb-24">
      {data.sections.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          Esta página no tiene textos ni fotos para cambiar.
        </p>
      ) : null}
      {data.sections.map((s) => (
        <section key={s.id} className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]" aria-label={s.label}>
          <h3 className="mb-4 font-display text-[17px] font-semibold text-foreground">{s.label}</h3>
          <div className="space-y-5">
            {s.fields.map((f) => (
              <div key={f.nodeId} className="space-y-1.5">
                <span className="text-[13px] text-muted-foreground">
                  {FIELD_LABEL[f.kind]}
                  {draft[f.nodeId] ? <span className="ml-2 text-primary">cambiado</span> : null}
                </span>
                {f.kind === 'heading' ? (
                  <input
                    aria-label="Título"
                    value={val(f, 'content')}
                    onChange={(e) => set(f, { content: e.target.value })}
                    maxLength={300}
                    className={`${inputClass} font-display text-[17px] font-semibold`}
                  />
                ) : f.kind === 'text' ? (
                  <textarea
                    aria-label="Texto"
                    value={val(f, 'content')}
                    onChange={(e) => set(f, { content: e.target.value })}
                    maxLength={5000}
                    rows={Math.min(8, Math.max(2, Math.ceil(val(f, 'content').length / 70)))}
                    className={`${inputClass} resize-y`}
                  />
                ) : f.kind === 'button' ? (
                  <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
                    <input
                      aria-label="Texto del botón"
                      value={val(f, 'content')}
                      onChange={(e) => set(f, { content: e.target.value })}
                      maxLength={80}
                      className={inputClass}
                    />
                    <input
                      aria-label="A dónde lleva el botón"
                      value={val(f, 'href')}
                      onChange={(e) => set(f, { href: e.target.value })}
                      maxLength={2000}
                      placeholder="https://wa.me/57300…"
                      className={inputClass}
                    />
                  </div>
                ) : f.kind === 'image' ? (
                  <PhotoField companyId={companyId} value={val(f, 'src')} alt={val(f, 'alt')} onChange={(p) => set(f, p)} />
                ) : (
                  <input
                    aria-label="Dirección del mapa"
                    value={val(f, 'address')}
                    onChange={(e) => set(f, { address: e.target.value })}
                    maxLength={300}
                    className={inputClass}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-background/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-end gap-3">
          {msg ? (
            <span
              className={`mr-auto text-[14px] ${msg.tone === 'ok' ? 'text-[#9df0c6]' : 'text-[#ffb4b5]'}`}
              role={msg.tone === 'error' ? 'alert' : 'status'}
            >
              {msg.text}
            </span>
          ) : (
            <span className="mr-auto text-[14px] text-muted-foreground">
              {dirty ? `${dirty} ${dirty === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}` : 'Sin cambios pendientes'}
            </span>
          )}
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={() => save(false)}
            className="rounded-full border border-white/[0.12] px-5 py-2.5 text-[14px] text-foreground hover:bg-white/[0.06] disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            {pending ? 'Un momento…' : dirty ? 'Guardar y publicar' : 'Publicar'}
          </button>
        </div>
      </div>
      {msg?.tone === 'error' && msg.text.includes('Recarga') ? (
        <Alert>
          Otra persona cambió la página.{' '}
          <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2">
            Recargar
          </button>
        </Alert>
      ) : null}
    </div>
  );
}
