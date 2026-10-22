'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { matchPhotosAction, saveProductPhotoAction } from '@/app/actions';
import { productForFile } from '@/lib/photo-match';
import { shrink } from './background-forms';
import { Alert, card, primaryButton, quietButton } from './ui';
import { useT } from './i18n';

type Product = { id: string; name: string; category: string; hasPhoto: boolean };
type Item = { key: string; file: string; blob: Blob; small: Blob; url: string; productId: string };

const MAX_ITEMS = 100;
// Fotos chiquitas para que la IA reconozca el plato (de 20 en 20, bajo el límite de envío).
const MATCH_BATCH = 20;

/**
 * Carta → «Subir fotos de los platos»: se escogen muchas fotos a la vez. Cada una busca su producto por el nombre del
 * archivo, la IA reconoce las demás y la persona revisa o cambia el plato de cada foto antes de guardarlas todas.
 */
export function BulkPhotos({ products }: { products: Product[] }) {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<'' | 'reading' | 'matching' | 'saving'>('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const byId = new Map(products.map((p) => [p.id, p]));
  const pending = items.filter((i) => !i.productId).length;
  const chosen = items.filter((i) => i.productId);
  const repeated = new Set(chosen.map((i) => i.productId)).size !== chosen.length;

  async function pick(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setError('');
    setDone('');
    if (items.length + files.length > MAX_ITEMS) {
      setError(t('Sube hasta {n} fotos por vez.', { n: MAX_ITEMS }));
      return;
    }
    setBusy('reading');
    const added: Item[] = [];
    let failed = 0;
    for (const [n, file] of files.entries()) {
      setProgress(t('Preparando foto {n} de {total}…', { n: n + 1, total: files.length }));
      try {
        const blob = await shrink(file, 900);
        const small = await shrink(file, 384);
        added.push({
          key: `${Date.now()}-${n}-${file.name}`,
          file: file.name,
          blob,
          small,
          url: URL.createObjectURL(blob),
          productId: productForFile(file.name, products)?.id ?? '',
        });
      } catch {
        failed++;
      }
    }
    setItems((current) => [...current, ...added]);
    setBusy('');
    setProgress('');
    if (failed) setError(t('{n} fotos no se pudieron leer (solo JPG, PNG o WebP).', { n: failed }));
  }

  async function matchWithAi() {
    const todo = items.filter((i) => !i.productId);
    if (!todo.length) return;
    setError('');
    setBusy('matching');
    const found = new Map<string, string>();
    let failed = false;
    try {
      for (let start = 0; start < todo.length; start += MATCH_BATCH) {
        const batch = todo.slice(start, start + MATCH_BATCH);
        setProgress(t('Reconociendo fotos {from} a {to} de {total}…', { from: start + 1, to: start + batch.length, total: todo.length }));
        const data = new FormData();
        batch.forEach((i) => data.append('photos', new File([i.small], 'foto.jpg', { type: 'image/jpeg' })));
        const result = await matchPhotosAction(undefined, data);
        if (result?.error) {
          setError(result.error);
          failed = true;
          break;
        }
        const ids = JSON.parse(result?.values?.matches ?? '[]') as (string | null)[];
        batch.forEach((i, n) => ids[n] && found.set(i.key, ids[n]!));
      }
    } catch {
      setError(t('Algo salió mal. Intenta otra vez.'));
      failed = true;
    }
    setItems((current) => current.map((i) => (found.has(i.key) ? { ...i, productId: found.get(i.key)! } : i)));
    setBusy('');
    setProgress('');
    if (!failed && found.size < todo.length) setDone(t('La IA reconoció {n} de {total}. Escoge el plato de las demás a mano.', { n: found.size, total: todo.length }));
  }

  async function saveAll() {
    const toSave = items.filter((i) => i.productId);
    if (!toSave.length) return;
    setError('');
    setDone('');
    setBusy('saving');
    const saved = new Set<string>();
    const errors: string[] = [];
    for (const [n, item] of toSave.entries()) {
      setProgress(t('Guardando foto {n} de {total}…', { n: n + 1, total: toSave.length }));
      const data = new FormData();
      data.set('productId', item.productId);
      data.set('foto', new File([item.blob], 'foto.jpg', { type: 'image/jpeg' }));
      try {
        const result = await saveProductPhotoAction(undefined, data);
        if (result?.error) errors.push(`${byId.get(item.productId)?.name ?? item.file}: ${result.error}`);
        else saved.add(item.key);
      } catch {
        errors.push(byId.get(item.productId)?.name ?? item.file);
      }
    }
    setItems((current) => {
      current.filter((i) => saved.has(i.key)).forEach((i) => URL.revokeObjectURL(i.url));
      return current.filter((i) => !saved.has(i.key));
    });
    setBusy('');
    setProgress('');
    setDone(t('Listo: {n} fotos guardadas.', { n: saved.size }));
    if (errors.length) setError(errors.slice(0, 5).join(' · '));
    router.refresh();
  }

  function remove(key: string) {
    setItems((current) => {
      current.filter((i) => i.key === key).forEach((i) => URL.revokeObjectURL(i.url));
      return current.filter((i) => i.key !== key);
    });
  }

  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <details className={card}>
      <summary className="cursor-pointer font-display text-[18px] font-bold">{t('Subir fotos de los platos')}</summary>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {t('Escoge todas las fotos de una vez. Si el archivo se llama como el plato («Mojito.jpg») queda asignado solo; las demás las reconoce la IA o las escoges tú. Revisa cada una antes de guardar: la foto nueva reemplaza la que ya tenga el plato.')}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className={`${quietButton} inline-flex cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {items.length ? t('Agregar más fotos') : t('Escoger fotos')}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={!!busy}
            onChange={(e) => {
              const list = e.target.files;
              void pick(list).finally(() => (e.target.value = ''));
            }}
          />
        </label>
        {pending ? (
          <button type="button" className={quietButton} disabled={!!busy} onClick={matchWithAi}>
            {t('Reconocer {n} con IA', { n: pending })}
          </button>
        ) : null}
        {chosen.length ? (
          <button type="button" className={primaryButton} disabled={!!busy} onClick={saveAll}>
            {t('Guardar {n} fotos', { n: chosen.length })}
          </button>
        ) : null}
      </div>
      {progress ? (
        <p className="mt-3 text-[14px] text-muted-foreground" role="status">
          {progress}
        </p>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {done ? (
        <div className="mt-3">
          <Alert tone="ok">{done}</Alert>
        </div>
      ) : null}
      {repeated ? <p className="mt-3 text-[13px] text-warning">{t('Hay dos fotos para el mismo plato: queda la última que se guarde.')}</p> : null}
      {items.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const product = byId.get(item.productId);
            return (
              <li key={item.key} className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="size-20 shrink-0 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${item.url}")` }} role="img" aria-label={item.file} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate text-[12px] text-muted-foreground">{item.file}</p>
                  <select
                    aria-label={t('Plato')}
                    className={`w-full rounded-xl border bg-white/[0.03] px-2 py-1.5 text-[14px] ${item.productId ? 'border-white/[0.1]' : 'border-warning/60'}`}
                    value={item.productId}
                    disabled={!!busy}
                    onChange={(e) => setItems((current) => current.map((i) => (i.key === item.key ? { ...i, productId: e.target.value } : i)))}
                  >
                    <option value="">{t('¿Qué plato es?')}</option>
                    {categories.map((c) => (
                      <optgroup key={c} label={c}>
                        {products
                          .filter((p) => p.category === c)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.hasPhoto ? ` · ${t('ya tiene foto')}` : ''}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-muted-foreground">{product?.hasPhoto ? t('Reemplaza la foto actual') : ''}</span>
                    <button type="button" className="text-[12.5px] text-muted-foreground underline hover:text-foreground" disabled={!!busy} onClick={() => remove(item.key)}>
                      {t('Quitar')}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </details>
  );
}
