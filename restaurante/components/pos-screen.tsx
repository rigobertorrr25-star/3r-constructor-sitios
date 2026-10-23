'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { sendOrderAction, setBillAction, voidItemAction } from '@/app/actions';
import { elapsedMinutes, formatCop, formatElapsed, formatTime } from '@/lib/format';
import { isNetworkError, retryDelay } from '@/lib/offline';
import type { MenuCategory, MenuProduct, OrderItemView } from '@/lib/orders';
import { productPhotoUrl } from '@/lib/product-photo-url';
import { STATION_LABEL } from '@/lib/stations';
import { describeChoices, isFixed, type OptionGroup } from '@/lib/product-options';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { useNow } from './table-board';
import { Alert, CheckField, Empty, Field, card, inputClass, primaryButton, quietButton } from './ui';
import { PrintBillButton } from './printer-forms';
import { useLang, useT, useTr } from './i18n';

type Item = Omit<OrderItemView, 'voidedAt'> & { voidedAt: string | null };
type Round = { id: string; number: number; sentAt: string; sentBy: string; items: Item[] };
type Session = { id: string; tableNumber: string; zone: string; status: string; guests: number; openedAt: string; openedBy: string };
/** `choices`: lo escogido de cada grupo de opciones del plato (PROMO ALMUERZO), si las tiene. */
type Line = { key: string; productId: string; name: string; price: number; quantity: number; notes: string; choices?: string[][] };

const TICKET_LABEL: Record<string, string> = { sent: 'Enviado', preparing: 'Preparando', ready: 'Listo', delivered: 'Entregado' };
const TICKET_STYLE: Record<string, string> = {
  sent: 'bg-white/[0.06] text-muted-foreground',
  preparing: 'bg-primary/15 text-primary',
  ready: 'bg-success/15 text-success',
  delivered: 'bg-white/[0.04] text-muted-foreground',
};

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/**
 * El carrito queda guardado en el aparato: si el mesero cambia de pantalla, no lo pierde. Si se envió sin conexión,
 * queda marcado como pendiente con su identificador, y se reintenta con el mismo (el servidor no lo duplica).
 */
function useCart(sessionId: string) {
  const storageKey = `rc-carrito-${sessionId}`;
  const [lines, setLines] = useState<Line[]>([]);
  const [clientKey, setClientKey] = useState('');
  const [pending, setPending] = useState(false);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as { lines: Line[]; clientKey: string; pending?: boolean } | null;
      if (saved?.lines?.length) {
        setLines(saved.lines);
        setClientKey(saved.clientKey);
        setPending(Boolean(saved.pending));
      } else setClientKey(newKey());
    } catch {
      setClientKey(newKey());
    }
    loaded.current = true;
  }, [storageKey]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (lines.length) localStorage.setItem(storageKey, JSON.stringify({ lines, clientKey, pending }));
      else localStorage.removeItem(storageKey);
    } catch {
      // Sin almacenamiento (modo privado): el carrito vive solo en esta pantalla.
    }
  }, [lines, clientKey, pending, storageKey]);
  return { lines, setLines, clientKey, pending, setPending, reset: () => (setLines([]), setClientKey(newKey()), setPending(false)) };
}

export function PosScreen({
  session,
  rounds,
  total,
  categories,
  products,
  canVoid,
  canCharge,
  waitersCollect = false,
  timeZone,
  printBill = false,
}: {
  session: Session;
  rounds: Round[];
  total: number;
  categories: MenuCategory[];
  products: MenuProduct[];
  canVoid: boolean;
  canCharge: boolean;
  /** Bar sin cajero: el mesero cobra; no hay a quién «pedirle la cuenta». */
  waitersCollect?: boolean;
  timeZone: string;
  /** La sede tiene impresora de caja: la precuenta se imprime allá. */
  printBill?: boolean;
}) {
  const now = useNow();
  const t = useT();
  const lang = useLang();
  const trx = useTr();
  const { lines, setLines, clientKey, pending: queued, setPending: setQueued, reset } = useCart(session.id);
  // A dónde va el pedido: si todo es de barra (un bar de licores), no se habla de cocina.
  const stations = new Set(lines.map((l) => products.find((p) => p.id === l.productId)?.station));
  const sendLabel = !stations.has('kitchen') && lines.length ? t('Enviar a barra') : !stations.has('bar') && lines.length ? t('Enviar a cocina') : t('Enviar a cocina y barra');
  const attempt = useRef(0);
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const closed = session.status === 'closed';

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return products.filter((p) => p.name.toLowerCase().includes(q) || !!p.nameEn?.toLowerCase().includes(q));
    const current = category || categories[0]?.id;
    return products.filter((p) => p.categoryId === current);
  }, [products, categories, category, search]);

  const [picking, setPicking] = useState<MenuProduct | null>(null);
  const add = (p: MenuProduct, choices?: string[][]) => {
    // Con un pedido pendiente de enviar, el carrito no cambia (se reintenta tal cual, sin duplicar).
    if (queued) return;
    // Un plato que se arma (PROMO ALMUERZO) primero pide escoger sus opciones.
    if (p.optionGroups?.some((g) => !isFixed(g)) && !choices) {
      setPicking(p);
      return;
    }
    const picked = p.optionGroups?.length ? (choices ?? p.optionGroups.map((g) => [g.options[0]])) : undefined;
    const sameChoices = (l: Line) => JSON.stringify(l.choices ?? null) === JSON.stringify(picked ?? null);
    setSent(null);
    setLines((prev) => {
      const plain = prev.find((l) => l.productId === p.id && !l.notes && sameChoices(l));
      if (plain) return prev.map((l) => (l === plain ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l));
      return [...prev, { key: newKey(), productId: p.id, name: p.name, price: p.price, quantity: 1, notes: '', choices: picked }];
    });
  };
  const change = (key: string, patch: Partial<Line>) =>
    !queued &&
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l;
          return { ...l, ...patch, quantity: Math.min(patch.quantity ?? l.quantity, 99) };
        })
        .filter((l) => l.quantity > 0),
    );
  const cartTotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const submit = async () => {
    setError(null);
    try {
      const result = await sendOrderAction(
        session.id,
        lines.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.notes, choices: l.choices })),
        clientKey,
      );
      if (result.error) {
        setQueued(false);
        setError(result.error);
      } else {
        attempt.current = 0;
        reset();
        setSent(result.number ?? null);
      }
    } catch (e) {
      // Sin conexión: queda pendiente en el aparato y se reintenta solo con el mismo identificador.
      if (isNetworkError(e)) setQueued(true);
      else setError(t('Algo salió mal. Intenta otra vez.'));
    }
  };
  const send = () => start(submit);

  // Reintento automático del pedido pendiente (y en cuanto vuelve la conexión).
  useEffect(() => {
    if (!queued || lines.length === 0 || !clientKey) return;
    const timer = setTimeout(() => {
      attempt.current += 1;
      start(submit);
    }, retryDelay(attempt.current));
    const onOnline = () => start(submit);
    window.addEventListener('online', onOnline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, lines, clientKey, pending]);

  return (
    <div className="space-y-5">
      {picking ? (
        <OptionPicker
          product={picking}
          onCancel={() => setPicking(null)}
          onDone={(choices) => {
            add(picking, choices);
            setPicking(null);
          }}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app" className="text-[14px] text-muted-foreground hover:text-foreground">
            ← {t('Mesas')}
          </Link>
          <h1 className="mt-1 font-display text-[26px] font-bold">
            {t('Mesa {n}', { n: session.tableNumber })} <span className="text-[16px] font-normal text-muted-foreground">· {session.zone}</span>
          </h1>
          <p className="text-[14px] text-muted-foreground">
            {session.guests === 1 ? t('1 persona') : t('{n} personas', { n: session.guests })} · {formatElapsed(elapsedMinutes(session.openedAt, now))} ·{' '}
            {t('abrió {name} a las {time}', { name: session.openedBy, time: formatTime(session.openedAt, timeZone, lang) })}
            {session.status === 'bill' ? ` · ${t('pidió la cuenta')}` : ''}
          </p>
        </div>
        <p className="text-right">
          <span className="block text-[13px] text-muted-foreground">{t('Cuenta')}</span>
          <span className="font-display text-[28px] font-bold">{formatCop(total)}</span>
        </p>
      </div>

      {closed ? <Alert>{t('Esta mesa ya se cerró.')}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="min-w-0 space-y-4">
          <input
            type="search"
            className={inputClass}
            placeholder={t('Buscar en la carta…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('Buscar en la carta')}
          />
          {!search ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={t('Categorías')}>
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
                    {(lang === 'en' && c.nameEn) || c.name}
                  </button>
                );
              })}
            </div>
          ) : null}
          {categories.length === 0 ? (
            <Empty>
              {t('La carta está vacía.')}{' '}
              <Link href="/app/carta" className="text-primary hover:underline">
                {t('Ir a la carta')}
              </Link>
            </Empty>
          ) : (
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => {
                return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!p.isAvailable || closed}
                    onClick={() => add(p)}
                    className="flex h-full min-h-[92px] w-full flex-col justify-between rounded-2xl border border-white/[0.08] bg-card p-3.5 text-left transition hover:border-primary/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="flex items-start gap-2.5">
                      {p.photo ? <img src={productPhotoUrl(p.id, p.photo)!} alt="" className="size-11 shrink-0 rounded-xl object-cover" loading="lazy" /> : null}
                      <span className="text-[15px] font-medium leading-snug">{(lang === 'en' && p.nameEn) || p.name}</span>
                    </span>
                    <span className="mt-2 flex items-center justify-between text-[13.5px]">
                      <span className="text-muted-foreground">{p.isAvailable ? formatCop(p.price) : t('Agotado')}</span>
                      <span className="text-[11.5px] text-muted-foreground/70">{t(STATION_LABEL[p.station])}</span>
                    </span>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-[132px] lg:self-start">
          <div className={card}>
            <h2 className="font-display text-[18px] font-bold">{t('Pedido nuevo')}</h2>
            {lines.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted-foreground">{sent ? t('Ronda {n} enviada. Toca productos para pedir más.', { n: sent }) : t('Toca los productos para agregarlos.')}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {lines.map((l) => (
                  <CartRow key={l.key} line={l} groups={products.find((p) => p.id === l.productId)?.optionGroups ?? null} onChange={(patch) => change(l.key, patch)} />
                ))}
              </ul>
            )}
            {queued ? (
              <p role="status" className="mt-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-[14px] text-warning">
                {t('Sin conexión: este pedido quedó guardado en el aparato y se enviará solo cuando vuelva el internet. No lo vuelvas a pedir.')}
              </p>
            ) : null}
            {error ? (
              <div className="mt-3">
                <Alert>{trx(error)}</Alert>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="text-[14px] text-muted-foreground">{t('Total del pedido')}</span>
              <span className="font-display text-[20px] font-bold">{formatCop(cartTotal)}</span>
            </div>
            <button type="button" className={`${primaryButton} mt-4 w-full py-3 text-[15.5px]`} disabled={lines.length === 0 || pending || queued || closed || !clientKey} onClick={send}>
              {queued ? t('Esperando conexión…') : pending ? t('Enviando…') : sendLabel}
            </button>
          </div>

          {canCharge && !closed ? (
            <Link href={`/app/caja/mesa/${session.id}`} className={`${primaryButton} w-full py-3 text-center text-[15.5px]`}>
              {t('Cobrar cuenta')}
            </Link>
          ) : null}
          <div className="flex gap-2">
            {printBill ? (
              <PrintBillButton sessionId={session.id} className="flex flex-1" />
            ) : (
              <Link href={`/cuenta/${session.id}`} target="_blank" className={`${quietButton} flex-1`}>
                {t('Precuenta')}
              </Link>
            )}
          </div>
          {!closed && !waitersCollect ? (
            <ActionForm action={setBillAction} showOk={false} className="flex">
              {() => (
                <>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="bill" value={session.status === 'bill' ? '0' : '1'} />
                  <SubmitButton tone="quiet" className="w-full">
                    {session.status === 'bill' ? t('Volver a abrir la mesa') : t('Pedir la cuenta')}
                  </SubmitButton>
                </>
              )}
            </ActionForm>
          ) : null}
        </aside>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">{t('Ya enviado')}</h2>
        {rounds.length === 0 ? <p className="text-[14px] text-muted-foreground">{t('Nada todavía.')}</p> : null}
        {rounds.map((round) => (
          <div key={round.id} className={card}>
            <p className="text-[13.5px] text-muted-foreground">
              {t('Ronda {n}', { n: round.number })} · {formatTime(round.sentAt, timeZone, lang)} · {round.sentBy}
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

/** Para armar un plato (PROMO ALMUERZO): el mesero escoge de cada grupo; lo que va siempre solo se muestra. */
function OptionPicker({ product, onCancel, onDone }: { product: MenuProduct; onCancel: () => void; onDone: (choices: string[][]) => void }) {
  const t = useT();
  const groups = product.optionGroups ?? [];
  const [picks, setPicks] = useState<string[][]>(() => groups.map((g) => (isFixed(g) ? [g.options[0]] : [])));
  const ready = groups.every((g, i) => picks[i].length === g.choose);
  const toggle = (i: number, option: string) =>
    setPicks((prev) =>
      prev.map((list, j) => {
        if (j !== i) return list;
        if (list.includes(option)) return list.filter((o) => o !== option);
        // Si se escoge una sola, tocar otra la cambia; si son varias, no deja pasar del número.
        if (groups[i].choose === 1) return [option];
        return list.length < groups[i].choose ? [...list, option] : list;
      }),
    );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={product.name}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-white/[0.1] bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[19px] font-bold">{product.name}</h2>
          <span className="text-[15px]">{formatCop(product.price)}</span>
        </div>
        <div className="mt-4 space-y-4">
          {groups.map((g, i) =>
            isFixed(g) ? (
              <p key={g.name} className="text-[14px] text-muted-foreground">
                {t('Incluye: {name}', { name: g.options[0] })}
              </p>
            ) : (
              <fieldset key={g.name}>
                <legend className="text-[14.5px] font-semibold">
                  {g.name}{' '}
                  <span className="font-normal text-muted-foreground">{g.choose === 1 ? t('(escoge 1)') : t('(escoge {n})', { n: g.choose })}</span>
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {g.options.map((o) => {
                    const on = picks[i].includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(i, o)}
                        className={`min-h-[48px] rounded-2xl border px-3 py-2 text-left text-[14.5px] transition ${on ? 'border-primary bg-primary/15 font-semibold' : 'border-white/[0.1] hover:border-white/25'}`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ),
          )}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" className={quietButton} onClick={onCancel}>
            {t('Cancelar')}
          </button>
          <button type="button" className={`${primaryButton} flex-1`} disabled={!ready} onClick={() => onDone(picks)}>
            {ready ? t('Agregar al pedido') : t('Escoge las opciones')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartRow({ line, groups, onChange }: { line: Line; groups: OptionGroup[] | null; onChange: (patch: Partial<Line>) => void }) {
  const [noting, setNoting] = useState(Boolean(line.notes));
  const t = useT();
  return (
    <li className="rounded-2xl border border-white/[0.06] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14.5px] font-medium">{line.name}</span>
        <span className="text-[14px]">{formatCop(line.price * line.quantity)}</span>
      </div>
      {groups?.length && line.choices ? <p className="mt-1 text-[13px] text-muted-foreground">{describeChoices(groups, line.choices)}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className={`${quietButton} size-9 p-0 text-[18px]`} onClick={() => onChange({ quantity: line.quantity - 1 })} aria-label={t('Quitar un {name}', { name: line.name })}>
          −
        </button>
        <span className="w-7 text-center font-display text-[17px] font-bold" aria-label={t('Cantidad')}>
          {line.quantity}
        </span>
        <button type="button" className={`${quietButton} size-9 p-0 text-[18px]`} onClick={() => onChange({ quantity: Math.min(99, line.quantity + 1) })} aria-label={t('Otro {name}', { name: line.name })}>
          +
        </button>
        {!noting ? (
          <button type="button" className="ml-auto text-[13px] text-primary hover:underline" onClick={() => setNoting(true)}>
            + {t('Nota')}
          </button>
        ) : null}
      </div>
      {noting ? (
        <input
          className={`${inputClass} mt-2 py-2 text-[14px]`}
          placeholder={t('Sin cebolla, término medio…')}
          maxLength={140}
          value={line.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          aria-label={t('Nota para {name}', { name: line.name })}
        />
      ) : null}
    </li>
  );
}

function SentRow({ item, sessionId, canVoid }: { item: Item; sessionId: string; canVoid: boolean }) {
  const [voiding, setVoiding] = useState(false);
  const voided = Boolean(item.voidedAt);
  const t = useT();
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
            <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[12px] text-[#ffb4b5]">{t('Anulado')}</span>
          ) : (
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${TICKET_STYLE[item.ticketStatus] ?? ''}`}>
              {t(STATION_LABEL[item.station])} · {t(TICKET_LABEL[item.ticketStatus] ?? item.ticketStatus)}
            </span>
          )}
          <span className={`text-[14px] ${voided ? 'opacity-50' : ''}`}>{formatCop(item.unitPrice * item.quantity)}</span>
          {canVoid && !voided ? (
            <button type="button" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]" onClick={() => setVoiding(!voiding)}>
              {t('Anular')}
            </button>
          ) : null}
        </div>
      </div>
      {voided && item.voidReason ? <p className="mt-1 text-[13px] text-muted-foreground">{t('Motivo: {reason}', { reason: item.voidReason })}</p> : null}
      {voiding ? (
        <ActionForm action={voidItemAction} onOk={() => setVoiding(false)} className="mt-2 flex flex-wrap items-end gap-2">
          {() => (
            <>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="sessionId" value={sessionId} />
              <div className="min-w-[220px] flex-1">
                <Field label={t('Motivo de la anulación')} name="reason" required minLength={3} maxLength={300} placeholder={t('Se equivocó el mesero, cliente cambió…')} />
              </div>
              <input type="hidden" name="preparedChoice" value="1" />
              <div className="w-full">
                <CheckField
                  name="prepared"
                  label={t('Ya se había preparado')}
                  hint={t('Si no se alcanzó a hacer, déjalo sin marcar: sus insumos vuelven al inventario.')}
                  defaultChecked={false}
                />
              </div>
              <SubmitButton tone="danger" pendingText={t('Anulando…')}>
                {t('Anular')}
              </SubmitButton>
            </>
          )}
        </ActionForm>
      ) : null}
    </li>
  );
}
