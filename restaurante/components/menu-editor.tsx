'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveCategoryAction, saveProductAction, setAvailableAction } from '@/app/actions';
import { orOffline } from '@/lib/offline';
import { formatCop } from '@/lib/format';
import type { MenuCategory, MenuProduct } from '@/lib/orders';
import { STATION_LABEL } from '@/lib/stations';
import { productPhotoUrl } from '@/lib/product-photo-url';
import { ProductPhotoForm } from './product-photo-form';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Alert, CheckField, Empty, Field, Select, card, quietButton } from './ui';
import { useT, useTr } from './i18n';

export function MenuEditor({
  categories,
  products,
  canEdit,
  canRecipe = false,
  costs = {},
}: {
  categories: MenuCategory[];
  products: MenuProduct[];
  canEdit: boolean;
  canRecipe?: boolean;
  costs?: Record<string, number>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const t = useT();
  const visible = canEdit ? categories : categories.filter((c) => c.isActive);

  return (
    <div className="space-y-5">
      {visible.length === 0 ? <Empty>{canEdit ? t('Empieza creando una categoría (Platos fuertes, Cócteles, Cervezas…).') : t('La carta está vacía.')}</Empty> : null}
      {visible.map((category) => {
        const list = products.filter((p) => p.categoryId === category.id && (canEdit || p.isActive));
        return (
          <section key={category.id} className={`${card} ${category.isActive ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[19px] font-bold">{category.name}</h2>
                <p className="text-[13.5px] text-muted-foreground">
                  {t('Va a {station}', { station: t(STATION_LABEL[category.station]).toLowerCase() })} ·{' '}
                  {list.length === 1 ? t('1 producto') : t('{n} productos', { n: list.length })}
                  {category.isActive ? '' : ` · ${t('Fuera de la carta')}`}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <button type="button" className={quietButton} onClick={() => setEditing(editing === category.id ? null : category.id)}>
                    {t('Editar categoría')}
                  </button>
                  <button type="button" className={quietButton} onClick={() => setAdding(adding === category.id ? null : category.id)}>
                    {t('+ Producto')}
                  </button>
                </div>
              ) : null}
            </div>
            {editing === category.id ? <CategoryForm category={category} onDone={() => setEditing(null)} /> : null}
            {adding === category.id ? <ProductForm categories={categories} categoryId={category.id} onDone={() => setAdding(null)} /> : null}
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {list.map((p) => (
                <ProductRow key={p.id} product={p} categories={categories} canEdit={canEdit} canRecipe={canRecipe} cost={costs[p.id]} />
              ))}
            </ul>
          </section>
        );
      })}
      {canEdit ? (
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Nueva categoría')}</h2>
          <CategoryForm />
        </section>
      ) : null}
    </div>
  );
}

function CategoryForm({ category, onDone }: { category?: MenuCategory; onDone?: () => void }) {
  const t = useT();
  return (
    <ActionForm action={saveCategoryAction} resetOnOk={!category} onOk={onDone} className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
      {(state) => (
        <>
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <Field label={t('Nombre')} name="name" required maxLength={60} defaultValue={state?.values?.name ?? category?.name} />
          <Select label={t('Va a')} name="station" defaultValue={state?.values?.station ?? category?.station ?? 'kitchen'}>
            <option value="kitchen">{t('Cocina')}</option>
            <option value="bar">{t('Barra')}</option>
          </Select>
          <Field label={t('Orden')} name="sort" type="number" min={0} max={9999} defaultValue={category?.sort ?? ''} hint={t('Menor sale primero')} />
          <Field
            label={t('Nombre en inglés (opcional)')}
            name="nameEn"
            maxLength={60}
            defaultValue={state?.values?.nameEn ?? category?.nameEn ?? ''}
            hint={t('Para la carta QR en inglés')}
          />
          {category ? (
            <div className="sm:col-span-3">
              <CheckField name="isActive" label={t('En la carta')} hint={t('Si la quitas, sus productos no se pueden pedir.')} defaultChecked={category.isActive} />
            </div>
          ) : null}
          <div className="sm:col-span-3">
            <SubmitButton pendingText={t('Guardando…')}>{category ? t('Guardar') : t('Crear categoría')}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

function ProductForm({ categories, categoryId, product, onDone }: { categories: MenuCategory[]; categoryId: string; product?: MenuProduct; onDone?: () => void }) {
  const t = useT();
  return (
    <ActionForm action={saveProductAction} resetOnOk={!product} onOk={onDone} className="mt-4 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-2">
      {(state) => (
        <>
          {product ? <input type="hidden" name="id" value={product.id} /> : null}
          <Field label={t('Nombre')} name="name" required maxLength={80} defaultValue={state?.values?.name ?? product?.name} />
          <Field label={t('Precio (pesos)')} name="price" inputMode="numeric" required defaultValue={state?.values?.price ?? product?.price} placeholder="18000" />
          <Field label={t('Descripción (opcional)')} name="description" maxLength={200} defaultValue={state?.values?.description ?? product?.description ?? ''} />
          <Field
            label={t('Nombre en inglés (opcional)')}
            name="nameEn"
            maxLength={80}
            defaultValue={state?.values?.nameEn ?? product?.nameEn ?? ''}
            hint={t('Para la carta QR en inglés')}
          />
          <Field label={t('Descripción en inglés (opcional)')} name="descriptionEn" maxLength={200} defaultValue={state?.values?.descriptionEn ?? product?.descriptionEn ?? ''} />
          <Select label={t('Categoría')} name="categoryId" defaultValue={state?.values?.categoryId ?? categoryId}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label={t('Va a')} name="station" defaultValue={state?.values?.station ?? product?.station ?? ''}>
            <option value="">{t('La de su categoría')}</option>
            <option value="kitchen">{t('Cocina')}</option>
            <option value="bar">{t('Barra')}</option>
          </Select>
          {product ? <CheckField name="isActive" label={t('En la carta')} defaultChecked={product.isActive} /> : null}
          <div className="sm:col-span-2">
            <SubmitButton pendingText={t('Guardando…')}>{product ? t('Guardar producto') : t('Agregar producto')}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

function ProductRow({
  product,
  categories,
  canEdit,
  canRecipe,
  cost,
}: {
  product: MenuProduct;
  categories: MenuCategory[];
  canEdit: boolean;
  canRecipe: boolean;
  cost?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const t = useT();
  const trx = useTr();
  const photo = productPhotoUrl(product.id, product.photo);
  const [error, setError] = useState<string | null>(null);
  const toggle = () =>
    start(async () => {
      setError(null);
      const result = await orOffline(setAvailableAction(product.id, !product.isAvailable));
      if (result) setError(result);
    });
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`flex min-w-0 items-center gap-3 ${product.isActive ? '' : 'opacity-60'}`}>
          {photo ? <img src={photo} alt="" className="size-12 shrink-0 rounded-xl object-cover" loading="lazy" /> : null}
          <div className="min-w-0">
            <p className="text-[15.5px] font-medium">
              {product.name}
              {!product.isAvailable ? <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[12px] text-warning">{t('Agotado')}</span> : null}
              {!product.isActive ? <span className="ml-2 text-[12.5px] text-muted-foreground">{t('Fuera de la carta')}</span> : null}
            </p>
            <p className="text-[13.5px] text-muted-foreground">
              {formatCop(product.price)} · {t(STATION_LABEL[product.station])}
              {canRecipe
                ? cost !== undefined
                  ? ` · ${t('costo {cost} (margen {margin} %)', { cost: formatCop(cost), margin: product.price ? Math.round(((product.price - cost) / product.price) * 100) : 0 })}`
                  : ` · ${t('sin receta')}`
                : ''}
              {product.description ? ` · ${product.description}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {product.isActive ? (
            <button type="button" className={quietButton} disabled={pending} onClick={toggle}>
              {product.isAvailable ? t('Se acabó') : t('Volvió a haber')}
            </button>
          ) : null}
          {canRecipe ? (
            <Link href={`/app/carta/receta/${product.id}`} className={quietButton}>
              {t('Receta')}
            </Link>
          ) : null}
          {canEdit ? (
            <button type="button" className={quietButton} onClick={() => setEditing(!editing)}>
              {t('Editar')}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <Alert>{trx(error)}</Alert> : null}
      {editing ? (
        <>
          <ProductForm categories={categories} categoryId={product.categoryId} product={product} onDone={() => setEditing(false)} />
          <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <ProductPhotoForm productId={product.id} current={photo} />
          </div>
        </>
      ) : null}
    </li>
  );
}
