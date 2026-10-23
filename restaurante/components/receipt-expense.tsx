'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { addExpenseAction, readReceiptAction, type FormState } from '@/app/actions';
import { formatCop } from '@/lib/format';
import { shrink } from './background-forms';
import { Alert, CheckField, Field, Select, TextArea, card, primaryButton, quietButton } from './ui';
import { useT } from './i18n';

const CATEGORIES: [string, string][] = [
  ['suppliers', 'Proveedores'],
  ['payroll', 'Nómina'],
  ['rent', 'Arriendo'],
  ['utilities', 'Servicios públicos'],
  ['maintenance', 'Mantenimiento'],
  ['marketing', 'Publicidad'],
  ['taxes', 'Impuestos'],
  ['other', 'Otros'],
];

type Draft = { category: string; amount: string; spentOn: string; supplier: string; description: string };

/**
 * Facturas → «Facturas de compra»: la cajera toma la foto de la factura, la IA la lee y redacta el gasto (proveedor,
 * total, fecha, tipo y qué se compró), ella lo revisa y lo guarda con la foto.
 */
export function ReceiptExpense({ today }: { today: string }) {
  const t = useT();
  const router = useRouter();
  const empty: Draft = { category: 'suppliers', amount: '', spentOn: today, supplier: '', description: '' };
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [version, setVersion] = useState(0);
  const [reading, startReading] = useTransition();
  const [readState, setReadState] = useState<FormState>(undefined);
  const [photoError, setPhotoError] = useState('');
  const [saveState, save, saving] = useActionState(addExpenseAction, undefined);
  const lastOk = useRef<number | undefined>(undefined);

  // Al guardar bien se suelta la foto y el formulario queda listo para la siguiente factura.
  useEffect(() => {
    if (saveState?.ok && saveState.ok !== lastOk.current) {
      lastOk.current = saveState.ok;
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto(null);
      setDraft({ ...empty, spentOn: today });
      setVersion((v) => v + 1);
      setReadState(undefined);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoError('');
    setReadState(undefined);
    let blob: Blob;
    try {
      // Grande para que se lean bien los números; liviana para que suba rápido.
      blob = await shrink(file, 1600);
    } catch {
      setPhotoError(t('No pudimos leer esa foto. Prueba con otra (JPG, PNG o WebP).'));
      return;
    }
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ blob, url: URL.createObjectURL(blob) });
    const data = new FormData();
    data.set('foto', new File([blob], 'factura.jpg', { type: 'image/jpeg' }));
    startReading(async () => {
      const result = await readReceiptAction(undefined, data);
      setReadState(result);
      const v = result?.values;
      if (v) {
        setDraft((d) => ({
          category: v.category || d.category,
          amount: v.amount || d.amount,
          spentOn: v.spentOn || d.spentOn,
          supplier: v.supplier || d.supplier,
          description: v.description || d.description,
        }));
        setVersion((n) => n + 1);
      }
    });
  }

  const values = saveState?.error ? { ...draft, ...(saveState.values as Partial<Draft>) } : draft;

  return (
    <section className={card}>
      <h2 className="font-display text-[18px] font-bold">{t('Registrar una factura de compra')}</h2>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {t('Tómale una foto a la factura o al recibo: la IA lee el proveedor, el total y la fecha, y escribe qué se compró. Revisa y guarda; la foto queda con el gasto.')}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div
          className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] bg-cover bg-center text-center text-[12px] text-muted-foreground"
          style={photo ? { backgroundImage: `url("${photo.url}")` } : undefined}
        >
          {photo ? null : t('Sin foto')}
        </div>
        <div className="space-y-2">
          <label className={`${photo ? quietButton : primaryButton} inline-flex cursor-pointer ${reading || saving ? 'pointer-events-none opacity-60' : ''}`}>
            {reading ? t('Leyendo la factura…') : photo ? t('Tomar otra foto') : t('Tomar foto de la factura')}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={reading || saving}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void pick(file);
              }}
            />
          </label>
          <p className="text-[12.5px] text-muted-foreground">{t('Derecha, de cerca y con buena luz, que se vea el total.')}</p>
        </div>
      </div>
      {photoError ? (
        <div className="mt-3">
          <Alert>{photoError}</Alert>
        </div>
      ) : null}
      {readState?.error ? (
        <div className="mt-3">
          <Alert>{readState.error}</Alert>
        </div>
      ) : null}
      {readState?.ok && readState.message ? (
        <div className="mt-3">
          <Alert tone="ok">{readState.message}</Alert>
        </div>
      ) : null}

      <form
        key={version}
        className="mt-4 grid gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          if (photo) data.set('foto', new File([photo.blob], 'factura.jpg', { type: 'image/jpeg' }));
          startTransition(() => save(data));
        }}
      >
        <Select label={t('Tipo')} name="category" defaultValue={values.category}>
          {CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {t(l)}
            </option>
          ))}
        </Select>
        <Field label={t('Valor')} name="amount" inputMode="numeric" required defaultValue={values.amount} />
        <Field label={t('Fecha')} name="spentOn" type="date" required defaultValue={values.spentOn} />
        <div className="md:col-span-2">
          <TextArea label={t('¿Qué se compró?')} name="description" rows={2} required minLength={3} maxLength={200} placeholder={t('Compra de 10 kg de limón y 2 bultos de hielo')} defaultValue={values.description} />
        </div>
        <Field label={t('Proveedor (opcional)')} name="supplier" maxLength={120} defaultValue={values.supplier} />
        <div className="md:col-span-3">
          <CheckField name="paidFromCash" label={t('Lo pagué con la plata de la caja')} hint={t('Sale de la caja abierta como una salida de efectivo.')} defaultChecked />
        </div>
        <div className="md:col-span-3 flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButton} disabled={saving || reading}>
            {saving ? t('Guardando…') : t('Guardar gasto')}
          </button>
          {values.amount && Number(values.amount) > 0 ? <span className="text-[14px] text-muted-foreground">{formatCop(Number(values.amount))}</span> : null}
        </div>
        {saveState?.error ? (
          <div className="md:col-span-3">
            <Alert>{saveState.error}</Alert>
          </div>
        ) : null}
        {saveState?.ok && saveState.message ? (
          <div className="md:col-span-3">
            <Alert tone="ok">{saveState.message}</Alert>
          </div>
        ) : null}
      </form>
    </section>
  );
}
