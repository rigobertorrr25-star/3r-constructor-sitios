'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { createCouponAction, presignStoreImageAction, saveProductAction, saveStoreSettingsAction } from '@/app/empresa/store-actions';
import type { Product, StoreSettings } from '@/lib/store';
import { AiSuggest } from './ai-writer';
import { CheckField, Field, SelectField, TextAreaField, inputClass } from './field';
import { formKey } from './form-key';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

const pesos = (n: number | null | undefined) => (n == null ? '' : new Intl.NumberFormat('es-CO').format(n));
const digits = (s: string) => {
  const d = s.replace(/[^\d]/g, '');
  return d ? Number(d) : null;
};

export function StoreSettingsForm({
  companyId,
  settings,
  suggestedSlug,
  origin,
}: {
  companyId: string;
  settings: StoreSettings | null;
  suggestedSlug: string;
  origin: string;
}) {
  const [state, action] = useActionState(saveStoreSettingsAction, undefined);
  const v = state?.error ? state.values : undefined;
  const [slug, setSlug] = useState(v?.slug ?? settings?.slug ?? suggestedSlug);
  const [delivery, setDelivery] = useState(v ? v.deliveryEnabled === 'on' : (settings?.deliveryEnabled ?? false));
  return (
    <form action={action} className="space-y-6" key={formKey(settings?.updatedAt ?? null, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre de la tienda" name="name" required minLength={2} maxLength={120} defaultValue={v?.name ?? settings?.name} />
        <Field
          label="WhatsApp para los pedidos"
          name="whatsapp"
          maxLength={30}
          defaultValue={v?.whatsapp ?? settings?.whatsapp ?? ''}
          placeholder="300 555 1234"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-foreground">
          Dirección de la tienda
        </label>
        <div className="flex items-center gap-1 rounded-2xl border border-white/[0.1] bg-white/[0.03] pl-4 focus-within:border-primary/60">
          <span className="shrink-0 text-[14px] text-muted-foreground">{origin.replace(/^https?:\/\//, '')}/tienda/</span>
          <input
            id="slug"
            name="slug"
            required
            maxLength={60}
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-[15px] text-foreground outline-none"
          />
        </div>
        <p className="text-[13px] text-muted-foreground">Minúsculas, sin tildes ni espacios. Si la cambias, el enlace anterior deja de servir.</p>
      </div>
      <TextAreaField
        label="Frase corta (opcional)"
        name="tagline"
        rows={2}
        maxLength={300}
        defaultValue={v?.tagline ?? settings?.tagline ?? ''}
        placeholder="Café de origen y postres caseros en el Centro."
      />

      <fieldset className="space-y-4">
        <legend className="mb-1 font-display text-[17px] font-semibold text-foreground">Entregas</legend>
        <CheckField
          name="pickupEnabled"
          label="Recoger en el local"
          defaultChecked={v ? v.pickupEnabled === 'on' : (settings?.pickupEnabled ?? true)}
        />
        <Field
          label="Dirección del local (opcional)"
          name="pickupNote"
          maxLength={200}
          defaultValue={v?.pickupNote ?? settings?.pickupNote ?? ''}
          placeholder="Calle de la Iglesia # 3-12, Centro"
        />
        <CheckField name="deliveryEnabled" label="Domicilios" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
        {delivery ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Valor del domicilio (pesos)"
              name="deliveryFee"
              inputMode="numeric"
              defaultValue={v?.deliveryFee ?? pesos(settings?.deliveryFee ?? 0)}
            />
            <Field
              label="Gratis desde (opcional)"
              name="freeFrom"
              inputMode="numeric"
              defaultValue={v?.freeFrom ?? pesos(settings?.freeFrom)}
              placeholder="60.000"
            />
            <div className="sm:col-span-2">
              <Field
                label="Zonas y horario (opcional)"
                name="deliveryNote"
                maxLength={200}
                defaultValue={v?.deliveryNote ?? settings?.deliveryNote ?? ''}
                placeholder="Centro, Getsemaní y Bocagrande, de 11 a.m. a 9 p.m."
              />
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="deliveryFee" value={pesos(settings?.deliveryFee ?? 0)} />
            <input type="hidden" name="freeFrom" value={pesos(settings?.freeFrom)} />
            <input type="hidden" name="deliveryNote" value={settings?.deliveryNote ?? ''} />
          </>
        )}
      </fieldset>
      <TextAreaField
        label="Cómo te pagan (opcional)"
        name="paymentNote"
        rows={2}
        maxLength={500}
        defaultValue={v?.paymentNote ?? settings?.paymentNote ?? ''}
        placeholder="Nequi o Daviplata al 300 555 1234, o en efectivo al recibir."
      />
      <CheckField
        name="open"
        label="Recibiendo pedidos"
        hint="Si la quitas, la tienda se sigue viendo pero no deja pedir (por ejemplo, en vacaciones)."
        defaultChecked={v ? v.open === 'on' : (settings?.open ?? true)}
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Ajustes guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">{settings ? 'Guardar cambios' : 'Crear la tienda'}</SubmitButton>
    </form>
  );
}

type V = { id?: string; name: string; price: string; stock: string; active: boolean };

/** Sube la foto de un producto: la API da el permiso y el navegador la manda directo. */
async function uploadPhoto(companyId: string, file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Usa una foto PNG, JPG o WEBP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('La foto pesa más de 5 MB.');
  const res = await presignStoreImageAction(companyId, file.type);
  if (!res.ok) throw new Error(res.error);
  const up = await fetch(res.presign.uploadUrl, { method: res.presign.method, headers: res.presign.headers, body: file });
  if (!up.ok) throw new Error('La subida falló. Inténtalo otra vez.');
  return res.presign.publicUrl;
}

export function ProductEditor({
  companyId,
  product,
  categories,
  ai = false,
}: {
  companyId: string;
  product?: Product;
  categories: string[];
  /** La empresa tiene Textos con IA. */
  ai?: boolean;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(pesos(product?.price));
  const [compareAt, setCompareAt] = useState(pesos(product?.compareAt));
  const [category, setCategory] = useState(product?.category ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? false);
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : '');
  const [active, setActive] = useState(product?.active ?? true);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [variants, setVariants] = useState<V[]>(
    product?.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: pesos(v.price),
      stock: v.stock != null ? String(v.stock) : '',
      active: v.active,
    })) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const setV = (i: number, patch: Partial<V>) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setImageUrl(await uploadPhoto(companyId, file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = digits(price);
    if (p == null) return setError('Escribe el precio.');
    start(async () => {
      const res = await saveProductAction(companyId, product?.id ?? null, {
        name,
        description,
        price: p,
        compareAt: digits(compareAt),
        category,
        imageUrl: imageUrl || null,
        trackStock,
        stock: trackStock && !variants.length ? (digits(stock) ?? 0) : null,
        active,
        featured,
        variants: variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          name: v.name,
          price: digits(v.price),
          stock: trackStock ? (digits(v.stock) ?? 0) : null,
          active: v.active,
        })),
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="px-4 text-center text-[13px] text-muted-foreground">Sin foto</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onPick}
            aria-label="Foto del producto"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-full border border-white/[0.12] px-3 py-2 text-[13px] text-foreground hover:bg-white/[0.06] disabled:opacity-60"
          >
            {uploading ? 'Subiendo…' : imageUrl ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {imageUrl ? (
            <button type="button" onClick={() => setImageUrl('')} className="w-full text-[12.5px] text-muted-foreground hover:text-[#ffb4b5]">
              Quitar la foto
            </button>
          ) : null}
        </div>
        <div className="space-y-5">
          <Field label="Nombre" name="name" required minLength={2} maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Precio (pesos)"
              name="price"
              inputMode="numeric"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="12.000"
            />
            <Field
              label="Precio antes (opcional)"
              name="compareAt"
              inputMode="numeric"
              value={compareAt}
              onChange={(e) => setCompareAt(e.target.value)}
              hint="Para mostrar el descuento."
            />
            <div className="space-y-1.5">
              <label htmlFor="category" className="text-sm font-medium text-foreground">
                Categoría
              </label>
              <input
                id="category"
                list="store-categories"
                maxLength={60}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Bebidas"
                className={inputClass}
              />
              <datalist id="store-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <TextAreaField
            label="Descripción (opcional)"
            name="description"
            rows={3}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {ai ? (
            <AiSuggest
              companyId={companyId}
              kind="product"
              label="Escribir la descripción con IA"
              context={name ? `Producto: ${name}` : undefined}
              onPick={setDescription}
            />
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-display text-[17px] font-semibold text-foreground">Opciones (opcional)</h3>
          <p className="text-[13.5px] text-muted-foreground">
            Tamaños, sabores o tallas. Si tienen otro precio, escríbelo; si no, se usa el del producto.
          </p>
        </div>
        {variants.map((v, i) => (
          <div
            key={v.id ?? `n${i}`}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 sm:grid-cols-[1fr_140px_110px_auto_auto] sm:items-center"
          >
            <input
              aria-label={`Nombre de la opción ${i + 1}`}
              value={v.name}
              onChange={(e) => setV(i, { name: e.target.value })}
              required
              maxLength={80}
              placeholder="Grande"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}
              aria-label={`Quitar la opción ${i + 1}`}
              className="rounded-lg px-2 py-1 text-muted-foreground hover:text-[#ffb4b5] sm:order-last"
            >
              ×
            </button>
            <input
              aria-label={`Precio de la opción ${i + 1}`}
              value={v.price}
              onChange={(e) => setV(i, { price: e.target.value })}
              inputMode="numeric"
              placeholder={price || 'Precio'}
              className={inputClass}
            />
            {trackStock ? (
              <input
                aria-label={`Existencias de la opción ${i + 1}`}
                value={v.stock}
                onChange={(e) => setV(i, { stock: e.target.value })}
                inputMode="numeric"
                placeholder="Hay"
                className={inputClass}
              />
            ) : (
              <span className="hidden sm:block" />
            )}
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <input type="checkbox" checked={v.active} onChange={(e) => setV(i, { active: e.target.checked })} className="size-4 accent-[#8a9bff]" />
              Visible
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setVariants((vs) => [...vs, { name: '', price: '', stock: '', active: true }])}
          disabled={variants.length >= 30}
          className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
        >
          + Agregar opción
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckField
          name="trackStock"
          label="Llevar existencias"
          hint="Se descuentan con cada pedido y se agota en cero."
          checked={trackStock}
          onChange={(e) => setTrackStock(e.target.checked)}
        />
        {trackStock && !variants.length ? (
          <Field label="¿Cuántos hay?" name="stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
        ) : null}
        <CheckField
          name="featured"
          label="Destacado"
          hint="Sale de primero en la tienda."
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
        />
        <CheckField name="active" label="Visible en la tienda" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>

      {error ? <Alert>{error}</Alert> : null}
      <button
        type="submit"
        disabled={pending || uploading}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {pending ? 'Guardando…' : product ? 'Guardar cambios' : 'Guardar producto'}
      </button>
    </form>
  );
}

export function CouponForm({ companyId }: { companyId: string }) {
  const [state, action] = useActionState(createCouponAction, undefined);
  const v = state?.error ? state.values : undefined;
  const [kind, setKind] = useState(v?.kind ?? 'percent');
  return (
    <form action={action} className="space-y-5" key={state?.ok}>
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Código"
          name="code"
          required
          maxLength={30}
          defaultValue={v?.code ?? ''}
          placeholder="BIENVENIDA"
          className={`${inputClass} uppercase`}
        />
        <SelectField
          label="Descuento"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            { value: 'percent', label: 'Porcentaje (%)' },
            { value: 'amount', label: 'Valor fijo (pesos)' },
          ]}
        />
        <Field
          label={kind === 'percent' ? 'Porcentaje' : 'Valor (pesos)'}
          name="value"
          inputMode="numeric"
          required
          defaultValue={v?.value ?? ''}
          placeholder={kind === 'percent' ? '10' : '5.000'}
        />
        <Field label="Compra mínima (opcional)" name="minOrder" inputMode="numeric" defaultValue={v?.minOrder ?? ''} placeholder="30.000" />
        <Field label="Usos máximos (opcional)" name="maxUses" inputMode="numeric" defaultValue={v?.maxUses ?? ''} placeholder="100" />
        <Field label="Vence (opcional)" name="expiresAt" type="date" defaultValue={v?.expiresAt ?? ''} />
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Cupón creado.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Crear cupón</SubmitButton>
    </form>
  );
}
