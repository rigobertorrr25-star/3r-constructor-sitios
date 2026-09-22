'use client';

import { useActionState, useState } from 'react';
import { createOrderAction } from '@/app/actions';
import { formatMoney } from '@/lib/orders';
import type { Package } from '@/lib/types';
import { CheckField, Field, TextAreaField } from './field';
import { ResendVerificationButton } from './resend-verification-button';
import { Alert, card } from './shop';
import { SubmitButton } from './submit-button';

const BUSINESS_TYPES = [
  'Restaurante o cafetería',
  'Tienda o comercio',
  'Salón de belleza o barbería',
  'Salud o consultorio',
  'Servicios profesionales',
  'Construcción u oficios',
  'Educación o cursos',
  'Turismo u hospedaje',
  'Otro',
];

const radio = 'flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14.5px] transition hover:border-white/[0.16] has-[:checked]:border-primary/70 has-[:checked]:bg-primary/10';

export function OrderForm({ pkg }: { pkg: Package }) {
  const [state, action] = useActionState(createOrderAction, undefined);
  const [maintenance, setMaintenance] = useState(false);
  const [hasDomain, setHasDomain] = useState<'yes' | 'no' | ''>('');
  // Si el servidor rechaza el envío, React vacía el formulario: se restauran los valores escritos.
  // Casilla y radios no son "controlados": React los volvería a dejar desmarcados tras el reset.
  const v = state?.values ?? {};

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="packageSlug" value={pkg.slug} />

      <section className={`${card} space-y-5`}>
        <h2 className="font-display text-[20px] font-semibold">Tu negocio</h2>
        <Field label="Nombre de tu negocio" name="businessName" required minLength={2} maxLength={150} placeholder="Café Azul" defaultValue={v.businessName} />
        <div className="space-y-1.5">
          <label htmlFor="businessType" className="text-sm font-medium text-foreground">
            ¿A qué se dedica?
          </label>
          <input
            id="businessType"
            name="businessType"
            list="business-types"
            required
            minLength={2}
            maxLength={100}
            placeholder="Elige o escribe tu rubro"
            defaultValue={v.businessType}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <datalist id="business-types">
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </div>
        <TextAreaField
          label="Cuéntanos sobre tu negocio"
          name="description"
          required
          minLength={10}
          maxLength={2000}
          placeholder="Qué ofreces, a quién le vendes, qué te hace especial…"
          defaultValue={v.description}
          hint="Con esto armamos los textos de tu página."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Teléfono o WhatsApp (opcional)" name="phone" type="tel" maxLength={50} autoComplete="tel" defaultValue={v.phone} />
          <Field label="Ciudad (opcional)" name="city" maxLength={100} defaultValue={v.city} />
        </div>
      </section>

      <section className={`${card} space-y-5`}>
        <h2 className="font-display text-[20px] font-semibold">Tu página</h2>
        <fieldset>
          <legend className="text-sm font-medium text-foreground">¿Ya tienes dominio (tunegocio.com)?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={radio}>
              <input type="radio" name="hasDomain" value="yes" defaultChecked={v.hasDomain === 'yes'} onChange={() => setHasDomain('yes')} className="accent-[#8a9bff]" />
              Sí, ya tengo uno
            </label>
            <label className={radio}>
              <input type="radio" name="hasDomain" value="no" defaultChecked={v.hasDomain === 'no'} onChange={() => setHasDomain('no')} className="accent-[#8a9bff]" />
              No, necesito ayuda con eso
            </label>
          </div>
        </fieldset>
        {hasDomain === 'yes' ? <Field label="¿Cuál es tu dominio?" name="domainWanted" maxLength={255} placeholder="tunegocio.com" defaultValue={v.domainWanted} /> : null}
        {hasDomain === 'no' ? <Field label="¿Qué nombre te gustaría? (opcional)" name="domainWanted" maxLength={255} placeholder="tunegocio.com" defaultValue={v.domainWanted} /> : null}
        <TextAreaField
          label="¿Qué secciones quieres? (opcional)"
          name="pagesWanted"
          maxLength={500}
          rows={3}
          placeholder="Inicio, menú, galería, ubicación, contacto…"
          defaultValue={v.pagesWanted}
          hint={`Tu paquete incluye hasta ${pkg.pagesIncluded} ${pkg.pagesIncluded === 1 ? 'página' : 'páginas'}.`}
        />
      </section>

      <section className={`${card} space-y-5`}>
        <h2 className="font-display text-[20px] font-semibold">Detalles opcionales</h2>
        <TextAreaField label="Estilo y colores" name="styleNotes" maxLength={1000} rows={3} placeholder="Colores de tu marca, si te gusta algo moderno, elegante, colorido…" defaultValue={v.styleNotes} />
        <TextAreaField label="Páginas que te gustan" name="references" maxLength={1000} rows={3} placeholder="Pega enlaces de páginas que te inspiren." defaultValue={v.references} />
        <TextAreaField label="¿Algo más que debamos saber?" name="extra" maxLength={2000} rows={3} defaultValue={v.extra} />
      </section>

      {pkg.monthlyPriceCents !== null ? (
        <CheckField
          name="maintenance"
          defaultChecked={v.maintenance === 'on'}
          onChange={(event) => setMaintenance(event.target.checked)}
          label={`Agregar hosting y mantenimiento: ${formatMoney(pkg.monthlyPriceCents, pkg.currency)}/mes`}
          hint="Tu página siempre en línea, con soporte y pequeños cambios. Opcional y puedes decidirlo después."
        />
      ) : null}

      <section className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[15px] text-muted-foreground">{pkg.name} · pago único</p>
          <p className="font-display text-[28px] font-bold">{formatMoney(pkg.priceCents, pkg.currency)}</p>
        </div>
        {maintenance && pkg.monthlyPriceCents !== null ? (
          <p className="text-[14px] text-muted-foreground">+ {formatMoney(pkg.monthlyPriceCents, pkg.currency)} al mes de hosting y mantenimiento.</p>
        ) : null}
        <p className="text-[13.5px] text-muted-foreground">
          No pagas ahora. Al enviar el pedido te decimos cómo pagar y empezamos a trabajar en cuanto se confirme.
        </p>
        {state?.error ? (
          <Alert>
            {state.error}
            {state.code === 'EMAIL_NOT_VERIFIED' ? (
              <span className="mt-2 block">
                <ResendVerificationButton className="text-[13px] font-semibold underline" />
              </span>
            ) : null}
          </Alert>
        ) : null}
        <SubmitButton pendingText="Enviando pedido…">Enviar mi pedido</SubmitButton>
      </section>
    </form>
  );
}
