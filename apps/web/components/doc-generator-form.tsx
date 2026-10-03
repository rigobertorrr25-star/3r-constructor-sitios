'use client';

import { useRef, useState } from 'react';
import { PLACEHOLDERS, TEMPLATES, type GeneratorPeople, type GeneratorTemplate } from '@/lib/doc-generator';
import { CheckField, Field, SelectField, TextAreaField } from './field';
import { Alert } from './shop';

const short = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const d = (iso: string | null) => (iso ? short.format(new Date(`${iso}T00:00:00Z`)) : '');

export function DocGeneratorForm({
  companyId,
  data,
  documentsEnabled,
  initialMember,
  initialTemplate,
}: {
  companyId: string;
  data: GeneratorPeople;
  documentsEnabled: boolean;
  initialMember?: string;
  initialTemplate?: GeneratorTemplate;
}) {
  const [template, setTemplate] = useState<GeneratorTemplate>(initialTemplate ?? 'employment_certificate');
  const [memberId, setMemberId] = useState(data.people.some((p) => p.id === initialMember) ? initialMember! : (data.people[0]?.id ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const person = data.people.find((p) => p.id === memberId);

  if (data.people.length === 0) {
    return <p className="text-[15px] text-muted-foreground">No hay personas a las que puedas generarles documentos. Invita a tu equipo en Equipo.</p>;
  }

  const insert = (key: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const at = el.selectionStart ?? el.value.length;
    el.value = `${el.value.slice(0, at)}{${key}}${el.value.slice(el.selectionEnd ?? at)}`;
    el.focus();
    el.selectionStart = el.selectionEnd = at + key.length + 2;
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const res = await fetch(`/empresa/${companyId}/generador/pdf`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          template,
          memberId,
          addressee: String(form.get('addressee') ?? ''),
          includeSalary: form.get('includeSalary') === 'on',
          requestId: String(form.get('requestId') ?? '') || undefined,
          subject: String(form.get('subject') ?? '') || undefined,
          body: String(form.get('body') ?? '') || undefined,
          signerName: String(form.get('signerName') ?? ''),
          signerTitle: String(form.get('signerTitle') ?? ''),
          saveToFolder: form.get('saveToFolder') === 'on',
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
        return setError(message ?? 'No se pudo generar el documento.');
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'documento.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(
        res.headers.get('x-saved-document')
          ? 'Listo. Se descargó el PDF y quedó una copia en la carpeta del empleado.'
          : 'Listo. Se descargó el PDF.',
      );
    } catch {
      setError('No se pudo generar el documento. Revisa tu conexión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium text-foreground">¿Qué documento?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <label
              key={t.key}
              className={`cursor-pointer rounded-2xl border p-4 transition ${template === t.key ? 'border-primary/60 bg-primary/10' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]'}`}
            >
              <input
                type="radio"
                name="template"
                value={t.key}
                checked={template === t.key}
                onChange={() => setTemplate(t.key)}
                className="sr-only"
              />
              <span className="block text-[15px] font-medium text-foreground">{t.name}</span>
              <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{t.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <SelectField
        label="¿Para quién?"
        name="memberId"
        value={memberId}
        onChange={(e) => setMemberId(e.target.value)}
        options={data.people.map((p) => ({ value: p.id, label: p.jobTitle ? `${p.name} · ${p.jobTitle}` : p.name }))}
      />
      {person && person.missing.length > 0 && template === 'employment_certificate' ? (
        <Alert>
          A la ficha de {person.name} le falta: {person.missing.join(', ')}. Complétala en el Portal del empleado (documento) o en Equipo (cargo y
          fecha de ingreso).
        </Alert>
      ) : null}

      {template === 'employment_certificate' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Dirigido a" name="addressee" maxLength={150} placeholder="A quien pueda interesar" />
          <div className="sm:pt-7">
            <CheckField
              name="includeSalary"
              label="Incluir el salario"
              hint={person?.hasSalary ? 'En letras y en números.' : 'La ficha no tiene salario: ponlo en el Portal del empleado.'}
              disabled={!person?.hasSalary}
            />
          </div>
        </div>
      ) : null}

      {template === 'vacation_record' ? (
        person && person.vacations.length > 0 ? (
          <SelectField
            label="Vacaciones aprobadas"
            name="requestId"
            options={person.vacations.map((v) => ({ value: v.id, label: `${d(v.startDate)} al ${d(v.endDate)} · ${v.days} días` }))}
          />
        ) : (
          <Alert>{person?.name ?? 'Esta persona'} no tiene vacaciones aprobadas en Permisos y vacaciones.</Alert>
        )
      ) : null}

      {template === 'custom_letter' ? (
        <div className="space-y-4">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Asunto" name="subject" required maxLength={150} placeholder="Carta de felicitación" />
            <Field label="Dirigido a (opcional)" name="addressee" maxLength={150} placeholder="Señores Banco de Bogotá" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Campos que se llenan solos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insert(p.key)}
                  className="rounded-full border border-white/[0.12] px-3 py-1 text-[12.5px] text-foreground transition hover:bg-white/[0.06]"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <TextAreaField
            ref={bodyRef}
            label="Texto"
            name="body"
            rows={8}
            required
            maxLength={6000}
            hint="Deja una línea en blanco entre párrafos."
            defaultValue={'Nos permitimos informar que {nombre}, con {documento}, trabaja en {empresa} como {cargo} desde el {fecha_ingreso}.\n\n'}
          />
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Firma" name="signerName" required minLength={2} maxLength={120} defaultValue={data.signer.name} />
        <Field
          label="Cargo de quien firma"
          name="signerTitle"
          required
          minLength={2}
          maxLength={120}
          defaultValue={data.signer.title}
          placeholder="Gerente"
        />
      </div>
      {documentsEnabled ? (
        <CheckField
          name="saveToFolder"
          label="Guardar una copia en la carpeta del empleado"
          hint="La ve en Documentos → Mis documentos."
          defaultChecked
        />
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
      {done ? <Alert tone="ok">{done}</Alert> : null}
      <button
        type="submit"
        disabled={busy || (template === 'vacation_record' && !person?.vacations.length)}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Generando…' : 'Generar PDF'}
      </button>
    </form>
  );
}
