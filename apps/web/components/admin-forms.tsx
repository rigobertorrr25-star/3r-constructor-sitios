'use client';

import { useActionState } from 'react';
import {
  createOrderSiteAction,
  publishSiteAction,
  savePackageAction,
  savePortfolioAction,
  setDeliveryUrlAction,
  unpublishSiteAction,
  updateOrderAction,
} from '@/app/actions';
import { STATUS_LABEL, fromCents } from '@/lib/orders';
import type { AdminOrderDetail, OrderStatus, Package, PortfolioItem, PublicationStatus, Template } from '@/lib/types';
import { CheckField, Field, SelectField, TextAreaField } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';
import { ThumbnailField } from './thumbnail-field';

const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as OrderStatus[]).map((value) => ({ value, label: STATUS_LABEL[value] }));

/** Estado, dinero recibido y enlace de entrega. Al cambiar algo, el cliente ve el aviso en su pedido. */
export function OrderUpdateForm({ order }: { order: AdminOrderDetail }) {
  const [state, action] = useActionState(updateOrderAction, undefined);
  const v = state?.values;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="orderId" value={order.id} />
      <SelectField key={v?.status ?? order.status} label="Estado del pedido" name="status" defaultValue={v?.status ?? order.status} options={STATUS_OPTIONS} />
      <Field
        label={`Monto recibido (${order.currency})`}
        name="amountPaid"
        inputMode="decimal"
        defaultValue={v?.amountPaid ?? fromCents(order.amountPaidCents)}
        hint="El estado de pago se calcula solo: sin pagar, parcial o pagado."
      />
      <Field
        label="Enlace de la página entregada"
        name="deliveryUrl"
        type="url"
        defaultValue={v?.deliveryUrl ?? order.deliveryUrl ?? ''}
        placeholder="https://tunegocio.com"
        hint="Obligatorio para marcar el pedido como entregado."
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Cambios guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Guardar cambios</SubmitButton>
    </form>
  );
}

export function CreateSiteForm({ orderId, templates }: { orderId: string; templates: Template[] }) {
  const [state, action] = useActionState(createOrderSiteAction, undefined);
  const chosen = state?.values?.templateSlug ?? 'blank';
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <SelectField
        label="Empezar desde"
        key={chosen}
        name="templateSlug"
        defaultValue={chosen}
        options={templates.map((t) => ({ value: t.slug, label: t.name }))}
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Creando…">Crear sitio y abrir el editor</SubmitButton>
    </form>
  );
}

const publishedDate = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

/** Publicar el sitio del cliente en su dirección propia y dejarla como enlace de entrega del pedido. */
export function PublishPanel({
  orderId,
  siteId,
  publication,
  deliveryUrl,
}: {
  orderId: string;
  siteId: string;
  publication: PublicationStatus;
  deliveryUrl: string | null;
}) {
  const [publishState, publishAction] = useActionState(publishSiteAction, undefined);
  const [linkState, linkAction] = useActionState(setDeliveryUrlAction, undefined);
  const live = publication.published && publication.url;

  return (
    <div className="space-y-4 border-t border-white/[0.06] pt-5">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Publicación</h3>
      {live ? (
        <div className="space-y-1.5 text-[14px]">
          <p className="flex items-center gap-2 text-foreground">
            <span className="size-2 rounded-full bg-[#5ee0a0]" aria-hidden="true" />
            En línea
            {publication.hasUnpublishedChanges ? (
              <span className="rounded-full bg-[#f7cb58]/15 px-2.5 py-0.5 text-[12px] text-[#f7cb58]">Hay cambios sin publicar</span>
            ) : null}
          </p>
          <a href={publication.url!} target="_blank" rel="noopener noreferrer" className="block break-all text-primary hover:underline">
            {publication.url}
          </a>
          {publication.publishedAt ? <p className="text-[13px] text-muted-foreground">Publicado {publishedDate.format(new Date(publication.publishedAt))}</p> : null}
        </div>
      ) : (
        <p className="text-[14px] text-muted-foreground">Todavía no está en internet.</p>
      )}

      <form action={publishAction}>
        <input type="hidden" name="siteId" value={siteId} />
        {publishState?.error ? (
          <div className="mb-3">
            <Alert>{publishState.error}</Alert>
          </div>
        ) : null}
        <SubmitButton pendingText="Publicando…">{live ? 'Publicar cambios' : 'Publicar en internet'}</SubmitButton>
      </form>

      {live && deliveryUrl !== publication.url ? (
        <form action={linkAction} className="space-y-2">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="url" value={publication.url!} />
          {linkState?.error ? <Alert>{linkState.error}</Alert> : null}
          <button
            type="submit"
            className="w-full rounded-full border border-white/[0.1] px-5 py-2.5 text-[14px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Usar como enlace de entrega
          </button>
        </form>
      ) : null}
      {live && deliveryUrl === publication.url ? <p className="text-[13px] text-[#9df0c6]">Ya es el enlace de entrega del pedido.</p> : null}

      {live ? (
        <form
          action={unpublishSiteAction}
          onSubmit={(event) => {
            if (!window.confirm('¿Quitar este sitio de internet? Puedes volver a publicarlo cuando quieras.')) event.preventDefault();
          }}
        >
          <input type="hidden" name="siteId" value={siteId} />
          <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
            Despublicar
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Crea un paquete (sin `pkg`) o edita uno existente. */
export function PackageForm({ pkg }: { pkg?: Package }) {
  const [state, action] = useActionState(savePackageAction, undefined);
  const v = state?.values;
  const isNew = !pkg;
  return (
    <form action={action} className="space-y-5">
      {pkg ? <input type="hidden" name="packageId" value={pkg.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" name="name" required minLength={2} maxLength={100} defaultValue={v?.name ?? pkg?.name} />
        {isNew ? (
          <Field label="Identificador (URL)" name="slug" required maxLength={100} placeholder="mi-paquete" defaultValue={v?.slug} hint="Solo minúsculas, números y guiones. No se puede cambiar después." />
        ) : (
          <Field label="Identificador (URL)" name="slugView" value={pkg.slug} readOnly disabled />
        )}
      </div>
      <Field label="Frase corta" name="tagline" maxLength={200} defaultValue={v?.tagline ?? pkg?.tagline ?? ''} />
      <TextAreaField label="Descripción" name="description" rows={2} maxLength={1000} defaultValue={v?.description ?? pkg?.description ?? ''} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={`Precio (${pkg?.currency ?? 'USD'})`} name="price" required inputMode="decimal" defaultValue={v?.price ?? fromCents(pkg?.priceCents)} />
        <Field label="Mensualidad" name="monthly" inputMode="decimal" defaultValue={v?.monthly ?? fromCents(pkg?.monthlyPriceCents)} hint="Vacío = no ofrece." />
        <Field label="Páginas incluidas" name="pagesIncluded" type="number" min={1} max={200} defaultValue={v?.pagesIncluded ?? pkg?.pagesIncluded ?? 1} />
        <Field label="Días de entrega" name="deliveryDays" type="number" min={1} max={365} defaultValue={v?.deliveryDays ?? pkg?.deliveryDays ?? ''} />
      </div>
      <TextAreaField label="Qué incluye (una línea por punto)" name="features" rows={5} maxLength={2000} defaultValue={v?.features ?? (pkg?.features ?? []).join('\n')} />
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Orden" name="sortOrder" type="number" min={0} max={1000} defaultValue={v?.sortOrder ?? pkg?.sortOrder ?? 0} />
        <CheckField name="isFeatured" label="Destacado" hint="Muestra “Más elegido”." defaultChecked={v ? v.isFeatured === 'on' : (pkg?.isFeatured ?? false)} />
        <CheckField name="isActive" label="Visible" hint="Si lo apagas, no se puede pedir." defaultChecked={v ? v.isActive === 'on' : (pkg?.isActive ?? true)} />
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Guardado.</Alert> : null}
      <div className="sm:w-[220px]">
        <SubmitButton pendingText="Guardando…">{isNew ? 'Crear paquete' : 'Guardar paquete'}</SubmitButton>
      </div>
    </form>
  );
}

/** Crea un ejemplo del portafolio (sin `item`) o edita uno existente. */
export function PortfolioForm({ item }: { item?: PortfolioItem }) {
  const [state, action] = useActionState(savePortfolioAction, undefined);
  const v = state?.values;
  const isNew = !item;
  return (
    <form action={action} className="space-y-5">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre del negocio" name="title" required minLength={2} maxLength={120} defaultValue={v?.title ?? item?.title} placeholder="Café Azul" />
        <Field label="Enlace de la página" name="url" type="url" required maxLength={500} defaultValue={v?.url ?? item?.url} placeholder="https://cafeazul.com" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Rubro" name="category" maxLength={80} defaultValue={v?.category ?? item?.category ?? ''} placeholder="Restaurante" />
        <Field label="Orden" name="sortOrder" type="number" min={0} max={1000} defaultValue={v?.sortOrder ?? item?.sortOrder ?? 0} />
      </div>
      <Field label="Frase corta (opcional)" name="description" maxLength={300} defaultValue={v?.description ?? item?.description ?? ''} />
      <ThumbnailField
        label="Captura de la página (opcional)"
        name="thumbnailUrl"
        defaultValue={v?.thumbnailUrl ?? item?.thumbnailUrl ?? ''}
        hint="Sin captura se muestra un cuadro con el nombre de la página."
      />
      <CheckField name="isActive" label="Visible en la portada" defaultChecked={v ? v.isActive === 'on' : (item?.isActive ?? true)} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Guardado.</Alert> : null}
      <div className="sm:w-[220px]">
        <SubmitButton pendingText="Guardando…">{isNew ? 'Agregar ejemplo' : 'Guardar cambios'}</SubmitButton>
      </div>
    </form>
  );
}
