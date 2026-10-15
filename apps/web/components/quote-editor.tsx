'use client';

import { useState, useTransition } from 'react';
import { saveQuoteAction } from '@/app/empresa/quotes-actions';
import { parsePesos } from '@/lib/crm';
import { computeTotals, pesos, type QuoteDetail } from '@/lib/quotes';
import { Field, SelectField, TextAreaField, inputClass } from './field';
import { Alert } from './shop';

type Contact = { id: string; name: string; organization: string | null; email: string | null; phone: string | null };
type Row = { description: string; quantity: string; unitPrice: string };

const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(n);
const emptyRow: Row = { description: '', quantity: '1', unitPrice: '' };

export function QuoteEditor({
  companyId,
  quote,
  contacts,
  initialContact,
}: {
  companyId: string;
  quote?: QuoteDetail;
  contacts: Contact[];
  initialContact?: string;
}) {
  const start = contacts.find((c) => c.id === (quote?.contactId ?? initialContact));
  const [contactId, setContactId] = useState(start?.id ?? '');
  const [client, setClient] = useState({
    clientName: quote?.clientName ?? start?.name ?? '',
    clientCompany: quote?.clientCompany ?? start?.organization ?? '',
    clientEmail: quote?.clientEmail ?? start?.email ?? '',
    clientPhone: quote?.clientPhone ?? start?.phone ?? '',
  });
  const [rows, setRows] = useState<Row[]>(
    quote?.items.length
      ? quote.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: fmt(i.unitPrice) }))
      : [{ ...emptyRow }],
  );
  const [discount, setDiscount] = useState(quote?.discount ? fmt(quote.discount) : '');
  const [taxRate, setTaxRate] = useState(String(quote?.taxRate ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const items = rows.map((r) => ({ description: r.description.trim(), quantity: Number(r.quantity) || 0, unitPrice: parsePesos(r.unitPrice) ?? 0 }));
  const totals = computeTotals(items, parsePesos(discount) ?? 0, Number(taxRate));
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const pickContact = (id: string) => {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    if (c) setClient({ clientName: c.name, clientCompany: c.organization ?? '', clientEmail: c.email ?? '', clientPhone: c.phone ?? '' });
  };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    const filled = items.filter((i) => i.description);
    if (!filled.length) return setError('Agrega al menos un ítem con descripción.');
    startTransition(async () => {
      const res = await saveQuoteAction(companyId, quote?.id ?? null, {
        contactId: contactId || null,
        ...client,
        title: String(form.get('title') ?? ''),
        notes: String(form.get('notes') ?? ''),
        validUntil: String(form.get('validUntil') ?? ''),
        items: filled,
        discount: parsePesos(discount) ?? 0,
        taxRate: Number(taxRate),
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  const cell = `${inputClass} !rounded-xl !px-3 !py-2 text-[14px]`;
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-5">
        <h3 className="font-display text-[17px] font-semibold text-foreground">Cliente</h3>
        {contacts.length ? (
          <SelectField
            label="Del CRM (opcional)"
            name="contactId"
            value={contactId}
            onChange={(e) => pickContact(e.target.value)}
            options={[
              { value: '', label: 'No está en el CRM' },
              ...contacts.map((c) => ({ value: c.id, label: c.organization ? `${c.name} · ${c.organization}` : c.name })),
            ]}
          />
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Nombre"
            name="clientName"
            required
            minLength={2}
            maxLength={150}
            value={client.clientName}
            onChange={(e) => setClient({ ...client, clientName: e.target.value })}
          />
          <Field
            label="Empresa"
            name="clientCompany"
            maxLength={150}
            value={client.clientCompany}
            onChange={(e) => setClient({ ...client, clientCompany: e.target.value })}
          />
          <Field
            label="Correo"
            name="clientEmail"
            type="email"
            maxLength={255}
            value={client.clientEmail}
            onChange={(e) => setClient({ ...client, clientEmail: e.target.value })}
            hint="Para mandarle la cotización."
          />
          <Field
            label="Teléfono"
            name="clientPhone"
            maxLength={50}
            value={client.clientPhone}
            onChange={(e) => setClient({ ...client, clientPhone: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-5">
        <h3 className="font-display text-[17px] font-semibold text-foreground">Cotización</h3>
        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <Field
            label="Título"
            name="title"
            required
            minLength={2}
            maxLength={150}
            defaultValue={quote?.title}
            placeholder="Café para el desayuno del hotel"
          />
          <Field label="Válida hasta" name="validUntil" type="date" defaultValue={quote?.validUntil ?? ''} />
        </div>

        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_90px_150px_130px_32px] gap-2 px-1 text-[12.5px] text-muted-foreground sm:grid">
            <span>Descripción</span>
            <span>Cantidad</span>
            <span>Valor unitario</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.06] p-3 sm:grid-cols-[1fr_90px_150px_130px_32px] sm:items-center sm:border-0 sm:p-0"
            >
              <input
                aria-label={`Descripción del ítem ${i + 1}`}
                value={r.description}
                onChange={(e) => setRow(i, { description: e.target.value })}
                maxLength={300}
                placeholder="Producto o servicio"
                className={`${cell} col-span-2 sm:col-span-1`}
              />
              <input
                aria-label={`Cantidad del ítem ${i + 1}`}
                value={r.quantity}
                onChange={(e) => setRow(i, { quantity: e.target.value.replace(/\D/g, '') })}
                inputMode="numeric"
                className={cell}
              />
              <input
                aria-label={`Valor unitario del ítem ${i + 1}`}
                value={r.unitPrice}
                onChange={(e) => {
                  const n = parsePesos(e.target.value);
                  setRow(i, { unitPrice: n === null ? '' : fmt(n) });
                }}
                inputMode="numeric"
                placeholder="0"
                className={cell}
              />
              <span className="self-center text-right text-[14px] text-foreground sm:pr-1">{pesos(items[i].quantity * items[i].unitPrice)}</span>
              <button
                type="button"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ ...emptyRow }]))}
                aria-label={`Quitar el ítem ${i + 1}`}
                className="justify-self-end text-[18px] leading-none text-muted-foreground transition hover:text-[#ffb4b5]"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { ...emptyRow }])}
            disabled={rows.length >= 50}
            className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
          >
            + Agregar ítem
          </button>
        </div>

        <div className="ml-auto max-w-sm space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between gap-3 text-[14px]">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">{pesos(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[14px]">
            <label htmlFor="discount" className="text-muted-foreground">
              Descuento
            </label>
            <input
              id="discount"
              value={discount}
              onChange={(e) => {
                const n = parsePesos(e.target.value);
                setDiscount(n === null ? '' : fmt(n));
              }}
              inputMode="numeric"
              placeholder="0"
              className={`${cell} !w-36 text-right`}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-[14px]">
            <label htmlFor="taxRate" className="text-muted-foreground">
              IVA
            </label>
            <select id="taxRate" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className={`${cell} !w-36`}>
              {[0, 5, 19].map((r) => (
                <option key={r} value={r} className="bg-[#0a131a]">
                  {r === 0 ? 'Sin IVA' : `${r} %`}
                </option>
              ))}
            </select>
          </div>
          {totals.tax ? (
            <div className="flex items-center justify-between gap-3 text-[14px]">
              <span className="text-muted-foreground">IVA {taxRate} %</span>
              <span className="text-foreground">{pesos(totals.tax)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
            <span className="font-medium text-foreground">Total</span>
            <span className="font-display text-[20px] font-bold text-foreground">{pesos(totals.total)}</span>
          </div>
        </div>

        <TextAreaField
          label="Condiciones y notas (opcional)"
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={quote?.notes ?? ''}
          placeholder="Forma de pago, tiempos de entrega, garantía…"
        />
      </section>

      {error ? <Alert>{error}</Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Guardando…' : quote ? 'Guardar cambios' : 'Guardar cotización'}
      </button>
    </form>
  );
}
