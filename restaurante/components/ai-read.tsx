'use client';

import { useState, useTransition } from 'react';
import type { FormState } from '@/app/actions';
import { shrink } from './background-forms';
import { Alert, quietButton } from './ui';
import { useT } from './i18n';

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * «Leer un PDF o fotos»: la persona escoge el PDF o las fotos de la carta (o de las recetas), la IA lo pasa a texto y ese
 * texto cae en la caja de abajo para revisarlo antes de importar. Las fotos se achican en el teléfono para que suban rápido.
 */
export function AiFileReader({
  action,
  onText,
  hint,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  onText: (text: string) => void;
  hint: string;
}) {
  const t = useT();
  const [state, setState] = useState<FormState>(undefined);
  const [pending, startTransition] = useTransition();

  async function read(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setState(undefined);
    const formData = new FormData();
    let total = 0;
    for (const file of files) {
      let blob: Blob = file;
      if (file.type.startsWith('image/')) {
        try {
          // Se deja grande para que se lean bien las letras pequeñas de la carta.
          blob = await shrink(file, 2000);
        } catch {
          setState({ error: t('No pudimos leer esa foto. Prueba con otra (JPG, PNG o WebP).') });
          return;
        }
      }
      total += blob.size;
      formData.append('files', blob, file.name);
    }
    if (total > MAX_BYTES) {
      setState({ error: t('Los archivos pesan más de 4 MB. Sube el PDF por partes o fotos más livianas.') });
      return;
    }
    startTransition(async () => {
      const result = await action(undefined, formData);
      setState(result);
      if (result?.values?.text) onText(result.values.text);
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-white/15 p-4">
      <p className="text-[14px] text-muted-foreground">
        {hint}
      </p>
      <label className={`${quietButton} inline-flex cursor-pointer ${pending ? 'pointer-events-none opacity-60' : ''}`}>
        {pending ? t('Leyendo… (puede tardar un minuto)') : t('Subir PDF o fotos')}
        <input
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            const list = e.target.files;
            void read(list).finally(() => (e.target.value = ''));
          }}
        />
      </label>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
    </div>
  );
}
