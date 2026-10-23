'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { addExpenseAction, readReceiptAction, type FormState } from '@/app/actions';
import { formatCop } from '@/lib/format';
import { shrink } from './background-forms';
import { PurchaseLines, blankLine, linesFromReading, linesToSave, type Line, type StockItem } from './purchase-lines';
import { Alert, CheckField, Field, Select, TextArea, card, primaryButton, quietButton } from './ui';
import { useT } from './i18n';

const CATEGORIES: [string, string][] = [
  ['suppliers', 'Proveedores'],
  ['packaging', 'Bolsas y empaques'],
  ['payroll', 'Nómina'],
  ['rent', 'Arriendo'],
  ['utilities', 'Servicios públicos'],
  ['maintenance', 'Mantenimiento'],
  ['marketing', 'Publicidad'],
  ['taxes', 'Impuestos'],
  ['other', 'Otros'],
];

type Draft = { category: string; amount: string; spentOn: string; supplier: string; description: string; bags: string };
type Kind = 'supplies' | 'expense';

const KINDS: [Kind, string, string][] = [
  ['supplies', 'Insumos', 'Lo que entra a la bodega: comida, bebidas, licor, desechables. Suma al inventario.'],
  ['expense', 'Gasto', 'Arriendo, servicios, mantenimiento, publicidad… No toca el inventario.'],
];

/**
 * Facturas → «Facturas de compra»: la cajera toma la foto de la factura, la IA la lee y redacta el gasto (proveedor,
 * total, fecha, tipo y qué se compró), ella lo revisa y lo guarda con la foto.
 */
export function ReceiptExpense({ today, items }: { today: string; items: StockItem[] }) {
  const t = useT();
  const router = useRouter();
  const empty: Draft = { category: 'suppliers', amount: '', spentOn: today, supplier: '', description: '', bags: '' };
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [version, setVersion] = useState(0);
  const [reading, startReading] = useTransition();
  const [readState, setReadState] = useState<FormState>(undefined);
  const [photoError, setPhotoError] = useState('');
  const [kind, setKind] = useState<Kind>('supplies');
  const [lines, setLines] = useState<Line[]>([]);
  const [linesError, setLinesError] = useState('');
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
      setLines([]);
      setKind('supplies');
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
          bags: v.bags || '',
        }));
        setVersion((n) => n + 1);
        let read: Line[] = [];
        try {
          read = v.lines ? linesFromReading(JSON.parse(v.lines), items) : [];
        } catch {
          read = [];
        }
        setLines(read);
        // Si la IA encontró productos o es de un proveedor, es de insumos; si no (luz, arriendo…), es un gasto.
        setKind(read.length || (v.category || 'suppliers') === 'suppliers' ? 'supplies' : 'expense');
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
          setLinesError('');
          const data = new FormData(e.currentTarget);
          const toSave = kind === 'supplies' ? linesToSave(lines, items) : { lines: [], missing: undefined };
          if (toSave.missing) {
            setLinesError(t('Falta la cantidad o el valor de «{name}». Escríbelo o márcalo «No va al inventario».', { name: toSave.missing }));
            return;
          }
          data.set('kind', kind);
          if (kind !== 'supplies') data.delete('bags');
          data.set('lines', JSON.stringify(toSave.lines));
          if (photo) data.set('foto', new File([photo.blob], 'factura.jpg', { type: 'image/jpeg' }));
          startTransition(() => save(data));
        }}
      >
        <fieldset className="md:col-span-3">
          <legend className="text-sm font-medium">{t('¿Qué es esta factura?')}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {KINDS.map(([k, label, hint]) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-2xl border p-3 text-left transition ${kind === k ? 'border-primary bg-primary/10' : 'border-white/[0.1] bg-white/[0.03] hover:border-white/25'}`}
              >
                <span className="block font-semibold">{t(label)}</span>
                <span className="block text-[12.5px] text-muted-foreground">{t(hint)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Select label={t('Categoría')} name="category" defaultValue={values.category}>
          {CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {t(l)}
            </option>
          ))}
        </Select>
        <Field label={t('Valor total de la factura')} name="amount" inputMode="numeric" required defaultValue={values.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^\d]/g, '') }))} />
        <Field label={t('Fecha')} name="spentOn" type="date" required defaultValue={values.spentOn} />
        <div className="md:col-span-2">
          <TextArea label={t('¿Qué se compró?')} name="description" rows={2} required minLength={3} maxLength={200} placeholder={t('Compra de 10 kg de limón y 2 bultos de hielo')} defaultValue={values.description} />
        </div>
        <Field label={t('Proveedor (opcional)')} name="supplier" maxLength={120} defaultValue={values.supplier} />
        {kind === 'supplies' ? (
          <div className="md:col-span-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
            <Field
              label={t('¿Cuánto fue de bolsas? (opcional)')}
              name="bags"
              inputMode="numeric"
              placeholder="0"
              defaultValue={values.bags}
              onChange={(e) => setDraft((d) => ({ ...d, bags: e.target.value.replace(/[^\d]/g, '') }))}
            />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {Number(values.bags) > 0 && Number(values.amount) > Number(values.bags)
                ? t('Se guardan aparte: {bags} en «Bolsas y empaques» y {rest} de insumos.', { bags: formatCop(Number(values.bags)), rest: formatCop(Number(values.amount) - Number(values.bags)) })
                : t('Si la factura cobra bolsas, escribe aquí cuánto: se separan del total como gasto «Bolsas y empaques» y no entran al inventario.')}
            </p>
          </div>
        ) : null}
        {kind !== 'supplies' ? null : lines.length ? (
          <PurchaseLines lines={lines} items={items} onChange={setLines} amount={Math.max(0, (Number(values.amount) || 0) - (Number(values.bags) || 0))} />
        ) : (
          <div className="md:col-span-3">
            <button type="button" className="text-[13.5px] text-primary underline" onClick={() => setLines([blankLine()])}>
              {t('+ Agregar productos al inventario')}
            </button>
          </div>
        )}
        {linesError ? (
          <div className="md:col-span-3">
            <Alert>{linesError}</Alert>
          </div>
        ) : null}
        <div className="md:col-span-3">
          <CheckField name="paidFromCash" label={t('Lo pagué con la plata de la caja')} hint={t('Sale de la caja abierta como una salida de efectivo.')} defaultChecked />
        </div>
        <div className="md:col-span-3 flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButton} disabled={saving || reading}>
            {saving ? t('Guardando…') : kind === 'supplies' ? t('Guardar factura de insumos') : t('Guardar gasto')}
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
