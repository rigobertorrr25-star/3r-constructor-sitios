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
  const visible = canEdit ? categories : categories.filter((c) => c.isActive);

  return (
    <div className="space-y-5">
      {visible.length === 0 ? <Empty>{canEdit ? 'Empieza creando una categoría (Platos fuertes, Cócteles, Cervezas…).' : 'La carta está vacía.'}</Empty> : null}
      {visible.map((category) => {
        const list = products.filter((p) => p.categoryId === category.id && (canEdit || p.isActive));
        return (
          <section key={category.id} className={`${card} ${category.isActive ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[19px] font-bold">{category.name}</h2>
                <p className="text-[13.5px] text-muted-foreground">
                  Va a {STATION_LABEL[category.station].toLowerCase()} · {list.length} {list.length === 1 ? 'producto' : 'productos'}
                  {category.isActive ? '' : ' · Fuera de la carta'}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <button type="button" className={quietButton} onClick={() => setEditing(editing === category.id ? null : category.id)}>
                    Editar categoría
                  </button>
                  <button type="button" className={quietButton} onClick={() => setAdding(adding === category.id ? null : category.id)}>
                    + Producto
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
          <h2 className="font-display text-[18px] font-bold">Nueva categoría</h2>
          <CategoryForm />
        </section>
      ) : null}
    </div>
  );
}

function CategoryForm({ category, onDone }: { category?: MenuCategory; onDone?: () => void }) {
  return (
    <ActionForm action={saveCategoryAction} resetOnOk={!category} onOk={onDone} className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
      {(state) => (
        <>
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <Field label="Nombre" name="name" required maxLength={60} defaultValue={state?.values?.name ?? category?.name} />
          <Select label="Va a" name="station" defaultValue={state?.values?.station ?? category?.station ?? 'kitchen'}>
            <option value="kitchen">Cocina</option>
            <option value="bar">Barra</option>
          </Select>
          <Field label="Orden" name="sort" type="number" min={0} max={9999} defaultValue={category?.sort ?? ''} hint="Menor sale primero" />
          {category ? (
            <div className="sm:col-span-3">
              <CheckField name="isActive" label="En la carta" hint="Si la quitas, sus productos no se pueden pedir." defaultChecked={category.isActive} />
            </div>
          ) : null}
          <div className="sm:col-span-3">
            <SubmitButton pendingText="Guardando…">{category ? 'Guardar' : 'Crear categoría'}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

function ProductForm({ categories, categoryId, product, onDone }: { categories: MenuCategory[]; categoryId: string; product?: MenuProduct; onDone?: () => void }) {
  return (
    <ActionForm action={saveProductAction} resetOnOk={!product} onOk={onDone} className="mt-4 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-2">
      {(state) => (
        <>
          {product ? <input type="hidden" name="id" value={product.id} /> : null}
          <Field label="Nombre" name="name" required maxLength={80} defaultValue={state?.values?.name ?? product?.name} />
          <Field label="Precio (pesos)" name="price" inputMode="numeric" required defaultValue={state?.values?.price ?? product?.price} placeholder="18000" />
          <Field label="Descripción (opcional)" name="description" maxLength={200} defaultValue={state?.values?.description ?? product?.description ?? ''} />
          <Select label="Categoría" name="categoryId" defaultValue={state?.values?.categoryId ?? categoryId}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Va a" name="station" defaultValue={state?.values?.station ?? product?.station ?? ''}>
            <option value="">La de su categoría</option>
            <option value="kitchen">Cocina</option>
            <option value="bar">Barra</option>
          </Select>
          {product ? <CheckField name="isActive" label="En la carta" defaultChecked={product.isActive} /> : null}
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Guardando…">{product ? 'Guardar producto' : 'Agregar producto'}</SubmitButton>
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
              {!product.isAvailable ? <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[12px] text-warning">Agotado</span> : null}
              {!product.isActive ? <span className="ml-2 text-[12.5px] text-muted-foreground">Fuera de la carta</span> : null}
            </p>
            <p className="text-[13.5px] text-muted-foreground">
              {formatCop(product.price)} · {STATION_LABEL[product.station]}
              {canRecipe ? (cost !== undefined ? ` · costo ${formatCop(cost)} (margen ${product.price ? Math.round(((product.price - cost) / product.price) * 100) : 0} %)` : ' · sin receta') : ''}
              {product.description ? ` · ${product.description}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {product.isActive ? (
            <button type="button" className={quietButton} disabled={pending} onClick={toggle}>
              {product.isAvailable ? 'Se acabó' : 'Volvió a haber'}
            </button>
          ) : null}
          {canRecipe ? (
            <Link href={`/app/carta/receta/${product.id}`} className={quietButton}>
              Receta
            </Link>
          ) : null}
          {canEdit ? (
            <button type="button" className={quietButton} onClick={() => setEditing(!editing)}>
              Editar
            </button>
          ) : null}
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
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
