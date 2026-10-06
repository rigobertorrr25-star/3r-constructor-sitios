'use client';

import { startTransition, useActionState, useState } from 'react';
import { removeProductPhotoAction, saveProductPhotoAction } from '@/app/actions';
import { shrink } from './background-forms';
import { Alert, dangerButton, primaryButton, quietButton } from './ui';

/** Foto de un producto: se escoge, se ve antes de guardarla y se puede quitar. */
export function ProductPhotoForm({ productId, current }: { productId: string; current: string | null }) {
  const [saveState, save, saving] = useActionState(saveProductPhotoAction, undefined);
  const [removeState, remove, removing] = useActionState(removeProductPhotoAction, undefined);
  const [picked, setPicked] = useState<{ blob: Blob; url: string } | null>(null);
  const [readError, setReadError] = useState('');
  const [lastOk, setLastOk] = useState<number | undefined>(undefined);

  if (saveState?.ok && saveState.ok !== lastOk) {
    setLastOk(saveState.ok);
    setPicked(null);
  }

  const preview = picked?.url ?? current;
  const state = removeState?.ok && (!saveState?.ok || removeState.ok > saveState.ok) ? removeState : (saveState ?? removeState);
  const send = (action: (data: FormData) => void, blob?: Blob) => {
    const data = new FormData();
    data.set('productId', productId);
    if (blob) data.set('foto', new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
    startTransition(() => action(data));
  };

  return (
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
      <div
        className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] bg-cover bg-center text-center text-[12px] text-muted-foreground"
        style={preview ? { backgroundImage: `url("${preview}")` } : undefined}
      >
        {preview ? null : 'Sin foto'}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Foto del producto {picked ? <span className="font-normal text-muted-foreground">(todavía sin guardar)</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <label className={`${quietButton} cursor-pointer`}>
            {preview ? 'Escoger otra' : 'Escoger foto'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setReadError('');
                try {
                  const blob = await shrink(file, 900);
                  if (picked) URL.revokeObjectURL(picked.url);
                  setPicked({ blob, url: URL.createObjectURL(blob) });
                } catch {
                  setReadError('No pudimos leer esa foto. Prueba con otra (JPG, PNG o WebP).');
                }
              }}
            />
          </label>
          {picked ? (
            <button type="button" className={primaryButton} disabled={saving} onClick={() => send(save, picked.blob)}>
              {saving ? 'Guardando…' : 'Guardar foto'}
            </button>
          ) : null}
          {current && !picked ? (
            <button type="button" className={dangerButton} disabled={removing} onClick={() => send(remove)}>
              {removing ? 'Quitando…' : 'Quitar foto'}
            </button>
          ) : null}
        </div>
        {readError ? <Alert>{readError}</Alert> : null}
        {state?.error ? <Alert>{state.error}</Alert> : null}
        {state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      </div>
    </div>
  );
}
