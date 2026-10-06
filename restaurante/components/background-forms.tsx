'use client';

import { startTransition, useActionState, useState } from 'react';
import { removeBackgroundAction, saveBackgroundAction } from '@/app/actions';
import { Alert, dangerButton, primaryButton, quietButton } from './ui';
import { useT } from './i18n';

const MAX_SIDE = 1920;

/** Achica la foto en el teléfono antes de subirla (más rápida y liviana); siempre sale en JPG. */
export async function shrink(file: File, maxSide = MAX_SIDE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.82));
}

/** El dueño escoge la foto de fondo de su restaurante, la ve antes de guardarla y puede quitarla. */
export function BackgroundForm({ current }: { current: string | null }) {
  const [saveState, save, saving] = useActionState(saveBackgroundAction, undefined);
  const [removeState, remove, removing] = useActionState(removeBackgroundAction, undefined);
  const [picked, setPicked] = useState<{ blob: Blob; url: string } | null>(null);
  const [readError, setReadError] = useState('');
  const [lastOk, setLastOk] = useState<number | undefined>(undefined);
  const t = useT();

  // Al guardar bien, se suelta la vista previa: la página ya trae el fondo nuevo.
  if (saveState?.ok && saveState.ok !== lastOk) {
    setLastOk(saveState.ok);
    setPicked(null);
  }

  const preview = picked?.url ?? current;
  const state = removeState?.ok && (!saveState?.ok || removeState.ok > saveState.ok) ? removeState : (saveState ?? removeState);

  return (
    <div className="space-y-4">
      <div
        className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] bg-cover bg-center"
        style={preview ? { backgroundImage: `url("${preview}")` } : undefined}
      >
        {preview ? <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/75" /> : null}
        <p className="relative text-[14px] text-muted-foreground">{preview ? (picked ? t('Así se verá (todavía sin guardar)') : '') : t('Sin fondo: se usa el de 3R')}</p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <label className={`${quietButton} cursor-pointer`}>
          {preview ? t('Escoger otra foto') : t('Escoger foto')}
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
                const blob = await shrink(file);
                if (picked) URL.revokeObjectURL(picked.url);
                setPicked({ blob, url: URL.createObjectURL(blob) });
              } catch {
                setReadError(t('No pudimos leer esa foto. Prueba con otra (JPG, PNG o WebP).'));
              }
            }}
          />
        </label>
        {picked ? (
          <button
            type="button"
            className={primaryButton}
            disabled={saving}
            onClick={() => {
              const data = new FormData();
              data.set('foto', new File([picked.blob], 'fondo.jpg', { type: 'image/jpeg' }));
              startTransition(() => save(data));
            }}
          >
            {saving ? t('Guardando…') : t('Guardar fondo')}
          </button>
        ) : null}
        {current && !picked ? (
          <button type="button" className={dangerButton} disabled={removing} onClick={() => startTransition(() => remove(new FormData()))}>
            {removing ? t('Quitando…') : t('Quitar fondo')}
          </button>
        ) : null}
      </div>
      {readError ? <Alert>{readError}</Alert> : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
    </div>
  );
}

/** Foto del restaurante detrás de todo, oscurecida para que los textos se sigan leyendo. */
export function BackgroundLayer({ url, strength = 'soft' }: { url: string | null; strength?: 'soft' | 'strong' }) {
  if (!url) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} />
      <div
        className={`absolute inset-0 ${strength === 'strong' ? 'bg-[rgba(5,9,13,0.86)]' : 'bg-gradient-to-b from-[rgba(5,9,13,0.55)] via-[rgba(5,9,13,0.7)] to-[rgba(5,9,13,0.9)]'}`}
      />
    </div>
  );
}
