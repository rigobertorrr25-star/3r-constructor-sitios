'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { confirmDocumentAction, requestDocumentUploadAction } from '@/app/empresa/documents-actions';
import { ACCEPT, ACCEPTED_TYPES, CATEGORY_LABEL, COMPANY_CATEGORIES, EMPLOYEE_CATEGORIES, MAX_BYTES } from '@/lib/documents';
import { CheckField, Field, SelectField, inputClass } from './field';
import { Alert } from './shop';

/** Sube un documento: el archivo va directo del navegador al almacenamiento privado, nunca por el servidor de Next. */
export function DocumentUploadPanel({ companyId, memberId, isHr }: { companyId: string; memberId?: string; isHr: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [title, setTitle] = useState('');
  const categories = memberId ? EMPLOYEE_CATEGORIES : COMPANY_CATEGORIES;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    setError(null);
    setDone(false);
    if (!(file instanceof File) || file.size === 0) return setError('Elige el archivo.');
    if (!ACCEPTED_TYPES[file.type]) return setError('Ese tipo de archivo no se admite. Usa PDF, imagen (PNG, JPG, WEBP), Word o Excel.');
    if (file.size > MAX_BYTES) return setError('El archivo pesa más de 20 MB.');
    setBusy(true);
    try {
      const ticket = await requestDocumentUploadAction(companyId, {
        title: String(form.get('title') ?? '').trim(),
        category: String(form.get('category')),
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        ...(memberId ? { memberId } : { audience: form.get('hrOnly') === 'on' ? 'hr' : 'all' }),
        ...(form.get('expiresOn') ? { expiresOn: String(form.get('expiresOn')) } : {}),
      });
      if (!ticket.ok) return setError(ticket.error);
      const put = await fetch(ticket.upload.url, { method: ticket.upload.method, headers: ticket.upload.headers, body: file });
      if (!put.ok) return setError('La subida falló a mitad de camino. Inténtalo otra vez.');
      const confirmed = await confirmDocumentAction(companyId, ticket.documentId);
      if (!confirmed.ok) return setError(confirmed.error ?? 'No se pudo guardar.');
      setDone(true);
      setTitle('');
      (event.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      setError('No se pudo subir el archivo. Revisa tu conexión e inténtalo otra vez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {open ? 'Cerrar' : '+ Subir documento'}
      </button>
      {open ? (
        <form onSubmit={onSubmit} className="mt-5 space-y-5 rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
          <div className="space-y-1.5">
            <label htmlFor="file" className="text-sm font-medium text-foreground">
              Archivo
            </label>
            <input
              id="file"
              name="file"
              type="file"
              required
              accept={ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
              }}
              className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-foreground`}
            />
            <p className="text-[13px] text-muted-foreground">PDF, imagen, Word o Excel. Máximo 20 MB.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Nombre del documento"
              name="title"
              required
              minLength={2}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <SelectField
              label="Tipo"
              name="category"
              defaultValue={categories[0]}
              options={categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
            />
            <Field label="Vence (opcional)" name="expiresOn" type="date" hint="Contratos, licencias, certificados: te avisamos antes." />
          </div>
          {!memberId && isHr ? <CheckField name="hrOnly" label="Solo para RR. HH. y la administración" hint="El resto del equipo no lo ve." /> : null}
          {error ? <Alert>{error}</Alert> : null}
          {done ? <Alert tone="ok">Documento guardado.</Alert> : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Subiendo…' : 'Subir'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
