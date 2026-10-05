'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { sendOrderAction, setBillAction, voidItemAction } from '@/app/actions';
import { elapsedMinutes, formatCop, formatElapsed, formatTime } from '@/lib/format';
import type { MenuCategory, MenuProduct, OrderItemView } from '@/lib/orders';
import { STATION_LABEL } from '@/lib/stations';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { useNow } from './table-board';
import { Alert, Empty, Field, card, inputClass, primaryButton, quietButton } from './ui';

type Item = Omit<OrderItemView, 'voidedAt'> & { voidedAt: string | null };
type Round = { id: string; number: number; sentAt: string; sentBy: string; items: Item[] };
type Session = { id: string; tableNumber: string; zone: string; status: string; guests: number; openedAt: string; openedBy: string };
type Line = { key: string; productId: string; name: string; price: number; quantity: number; notes: string };

const TICKET_LABEL: Record<string, string> = { sent: 'Enviado', preparing: 'Preparando', ready: 'Listo', delivered: 'Entregado' };
const TICKET_STYLE: Record<string, string> = {
  sent: 'bg-white/[0.06] text-muted-foreground',
  preparing: 'bg-primary/15 text-primary',
  ready: 'bg-success/15 text-success',
  delivered: 'bg-white/[0.04] text-muted-foreground',
};

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** El carrito queda guardado en el aparato: si el mesero cambia de pantalla, no lo pierde. */
function useCart(sessionId: string) {
  const storageKey = `rc-carrito-${sessionId}`;
  const [lines, setLines] = useState<Line[]>([]);
  const [clientKey, setClientKey] = useState('');
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as { lines: Line[]; clientKey: string } | null;
      if (saved?.lines?.length) {
        setLines(saved.lines);
        setClientKey(saved.clientKey);
      } else setClientKey(newKey());
    } catch {
      setClientKey(newKey());
    }
    loaded.current = true;
  }, [storageKey]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (lines.length) localStorage.setItem(storageKey, JSON.stringify({ lines, clientKey }));
      else localStorage.removeItem(storageKey);
    } catch {
      // Sin almacenamiento (modo privado): el carrito vive solo en esta pantalla.
    }
  }, [lines, clientKey, storageKey]);
  return { lines, setLines, clientKey, reset: () => (setLines([]), setClientKey(newKey())) };
}

export function PosScreen({
  session,
  rounds,
  total,
  categories,
  products,
  canVoid,
  timeZone,
}: {
  session: Session;
  rounds: Round[];
  total: number;
  categories: MenuCategory[];
  products: MenuProduct[];
  canVoid: boolean;
  timeZone: string;
}) {
  const now = useNow();
  const { lines, setLines, clientKey, reset } = useCart(session.id);
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const closed = session.status === 'closed';

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return products.filter((p) => p.name.toLowerCase().includes(q));
    const current = category || categories[0]?.id;
    return products.filter((p) => p.categoryId === current);
  }, [products, categories, category, search]);

  const add = (p: MenuProduct) => {
    setSent(null);
    setLines((prev) => {
      const plain = prev.find((l) => l.productId === p.id && !l.notes);
      if (plain) return prev.map((l) => (l === plain ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l));
      return [...prev, { key: newKey(), productId: p.id, name: p.name, price: p.price, quantity: 1, notes: '' }];
    });
  };
  const change = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)).filter((l) => l.quantity > 0));
  const cartTotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const send = () =>
    start(async () => {
      setError(null);
      const result = await sendOrderAction(
        session.id,
        lines.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.notes })),
        clientKey,
      );
      if (result.error) setError(result.error);
      else {
        reset();
        setSent(result.number ?? null);
      }
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app" className="text-[14px] text-muted-foreground hover:text-foreground">
            ← Mesas
          </Link>
          <h1 className="mt-1 font-display text-[26px] font-bold">
            Mesa {session.tableNumber} <span className="text-[16px] font-normal text-muted-foreground">· {session.zone}</span>
          </h1>
          <p className="text-[14px] text-muted-foreground">
            {session.guests} {session.guests === 1 ? 'persona' : 'personas'} · {formatElapsed(elapsedMinutes(session.openedAt, now))} · abrió {session.openedBy} a las{' '}
            {formatTime(session.openedAt, timeZone)}
            {session.status === 'bill' ? ' · pidió la cuenta' : ''}
          </p>
        </div>
        <p className="text-right">
          <span className="block text-[13px] text-muted-foreground">Cuenta</span>
          <span className="font-display text-[28px] font-bold">{formatCop(total)}</span>
        </p>
      </div>

      {closed ? <Alert>Esta mesa ya se cerró.</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <input
            type="search"
            className={inputClass}
            placeholder="Buscar en la carta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar en la carta"
          />
          {!search ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Categorías">
              {categories.map((c) => {
                const active = (category || categories[0]?.id) === c.id;
                return (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(c.id)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-[14px] transition ${active ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          ) : null}
          {categories.length === 0 ? (
            <Empty>
              La carta está vacía. {' '}
              <Link href="/app/carta" className="text-primary hover:underline">
                Ir a la carta
              </Link>
            </Empty>
          ) : (
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!p.isAvailable || closed}
                    onClick={() => add(p)}
                    className="flex h-full min-h-[92px] w-full flex-col justify-between rounded-2xl border border-white/[0.08] bg-card p-3.5 text-left transition hover:border-primary/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="text-[15px] font-medium leading-snug">{p.name}</span>
                    <span className="mt-2 flex items-center justify-between text-[13.5px]">
                      <span className="text-muted-foreground">{p.isAvailable ? formatCop(p.price) : 'Agotado'}</span>
                      <span className="text-[11.5px] text-muted-foreground/70">{STATION_LABEL[p.station]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-[132px] lg:self-start">
          <div className={card}>
            <h2 className="font-display text-[18px] font-bold">Pedido nuevo</h2>
            {lines.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted-foreground">{sent ? `Ronda ${sent} enviada. Toca productos para pedir más.` : 'Toca los productos para agregarlos.'}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {lines.map((l) => (
                  <CartRow key={l.key} line={l} onChange={(patch) => change(l.key, patch)} />
                ))}
              </ul>
            )}
            {error ? (
              <div className="mt-3">
                <Alert>{error}</Alert>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="text-[14px] text-muted-foreground">Total del pedido</span>
              <span className="font-display text-[20px] font-bold">{formatCop(cartTotal)}</span>
            </div>
            <button type="button" className={`${primaryButton} mt-4 w-full py-3 text-[15.5px]`} disabled={lines.length === 0 || pending || closed || !clientKey} onClick={send}>
              {pending ? 'Enviando…' : 'Enviar a cocina y barra'}
            </button>
          </div>

          {!closed ? (
            <ActionForm action={setBillAction} showOk={false} className="flex">
              {() => (
                <>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="bill" value={session.status === 'bill' ? '0' : '1'} />
                  <SubmitButton tone="quiet" className="w-full">
                    {session.status === 'bill' ? 'Volver a abrir la mesa' : 'Pedir la cuenta'}
                  </SubmitButton>
                </>
              )}
            </ActionForm>
          ) : null}
        </aside>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">Ya enviado</h2>
        {rounds.length === 0 ? <p className="text-[14px] text-muted-foreground">Nada todavía.</p> : null}
        {rounds.map((round) => (
          <div key={round.id} className={card}>
            <p className="text-[13.5px] text-muted-foreground">
              Ronda {round.number} · {formatTime(round.sentAt, timeZone)} · {round.sentBy}
            </p>
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {round.items.map((item) => (
                <SentRow key={item.id} item={item} sessionId={session.id} canVoid={canVoid && !closed} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function CartRow({ line, onChange }: { line: Line; onChange: (patch: Partial<Line>) => void }) {
  const [noting, setNoting] = useState(Boolean(line.notes));
  return (
    <li className="rounded-2xl border border-white/[0.06] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14.5px] font-medium">{line.name}</span>
        <span className="text-[14px]">{formatCop(line.price * line.quantity)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className={`${quietButton} size-9 p-0 text-[18px]`} onClick={() => onChange({ quantity: line.quantity - 1 })} aria-label={`Quitar un ${line.name}`}>
          −
        </button>
        <span className="w-7 text-center font-display text-[17px] font-bold" aria-label="Cantidad">
          {line.quantity}
        </span>
        <button type="button" className={`${quietButton} size-9 p-0 text-[18px]`} onClick={() => onChange({ quantity: Math.min(99, line.quantity + 1) })} aria-label={`Otro ${line.name}`}>
          +
        </button>
        {!noting ? (
          <button type="button" className="ml-auto text-[13px] text-primary hover:underline" onClick={() => setNoting(true)}>
            + Nota
          </button>
        ) : null}
      </div>
      {noting ? (
        <input
          className={`${inputClass} mt-2 py-2 text-[14px]`}
          placeholder="Sin cebolla, término medio…"
          maxLength={140}
          value={line.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          aria-label={`Nota para ${line.name}`}
        />
      ) : null}
    </li>
  );
}

function SentRow({ item, sessionId, canVoid }: { item: Item; sessionId: string; canVoid: boolean }) {
  const [voiding, setVoiding] = useState(false);
  const voided = Boolean(item.voidedAt);
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={voided ? 'line-through opacity-50' : ''}>
          <span className="text-[15px]">
            {item.quantity} × {item.name}
          </span>
          {item.notes ? <span className="block text-[13px] text-warning">{item.notes}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {voided ? (
            <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[12px] text-[#ffb4b5]">Anulado</span>
          ) : (
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${TICKET_STYLE[item.ticketStatus] ?? ''}`}>
              {STATION_LABEL[item.station]} · {TICKET_LABEL[item.ticketStatus] ?? item.ticketStatus}
            </span>
          )}
          <span className={`text-[14px] ${voided ? 'opacity-50' : ''}`}>{formatCop(item.unitPrice * item.quantity)}</span>
          {canVoid && !voided ? (
            <button type="button" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]" onClick={() => setVoiding(!voiding)}>
              Anular
            </button>
          ) : null}
        </div>
      </div>
      {voided && item.voidReason ? <p className="mt-1 text-[13px] text-muted-foreground">Motivo: {item.voidReason}</p> : null}
      {voiding ? (
        <ActionForm action={voidItemAction} onOk={() => setVoiding(false)} className="mt-2 flex flex-wrap items-end gap-2">
          {() => (
            <>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="sessionId" value={sessionId} />
              <div className="min-w-[220px] flex-1">
                <Field label="Motivo de la anulación" name="reason" required minLength={3} maxLength={300} placeholder="Se equivocó el mesero, cliente cambió…" />
              </div>
              <SubmitButton tone="danger" pendingText="Anulando…">
                Anular
              </SubmitButton>
            </>
          )}
        </ActionForm>
      ) : null}
    </li>
  );
}
