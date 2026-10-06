'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { closeTableAction, moveSessionAction, moveTicketAction, openTableAction, setBillAction, updateSessionAction } from '@/app/actions';
import { orOffline } from '@/lib/offline';
import Link from 'next/link';
import { LONG_TABLE_MINUTES, elapsedMinutes, formatCop, formatElapsed, formatTime } from '@/lib/format';
import type { FloorTable } from '@/lib/store';
import type { ReadyTicket } from '@/lib/kds';
import { STATION_LABEL } from '@/lib/stations';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select, TextArea, primaryButton, quietButton } from './ui';
import { useLang, useT, useTr } from './i18n';

export type BoardTable = Omit<FloorTable, 'session'> & {
  session: (Omit<NonNullable<FloorTable['session']>, 'openedAt' | 'billAt'> & { openedAt: string; billAt: string | null; total?: number }) | null;
  reservedFor?: { customerName: string; startsAt: string; guests: number } | null;
};

/** La hora actual, que avanza sola (los cronómetros salen de la hora de apertura guardada, no de un contador). */
export function useNow(everyMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

const STATUS_LABEL: Record<BoardTable['status'], string> = { free: 'Libre', open: 'Ocupada', bill: 'Pidió la cuenta', blocked: 'Bloqueada', reserved: 'Reservada' };

const STATUS_STYLE: Record<BoardTable['status'], string> = {
  free: 'border-success/40 bg-success/[0.07] text-foreground hover:bg-success/[0.14]',
  open: 'border-primary/60 bg-primary/[0.16] text-foreground hover:bg-primary/[0.24]',
  bill: 'border-warning/70 bg-warning/[0.16] text-foreground hover:bg-warning/[0.24]',
  blocked: 'border-white/10 bg-white/[0.03] text-muted-foreground [background-image:repeating-linear-gradient(135deg,transparent_0_8px,#ffffff08_8px_16px)]',
  reserved: 'border-accent/70 border-dashed bg-accent/[0.1] text-foreground hover:bg-accent/[0.18]',
};

export function TableShape({ table, now, onClick, selected, hasReady }: { table: BoardTable; now: number; onClick?: () => void; selected?: boolean; hasReady?: boolean }) {
  const minutes = table.session ? elapsedMinutes(table.session.openedAt, now) : 0;
  const late = table.session && minutes >= LONG_TABLE_MINUTES;
  const t = useT();
  const status = t(STATUS_LABEL[table.status]);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={table.session ? t('Mesa {n}, {status}, {time}', { n: table.number, status, time: formatElapsed(minutes) }) : t('Mesa {n}, {status}', { n: table.number, status })}
      className={`absolute flex flex-col items-center justify-center border-2 text-center transition ${STATUS_STYLE[table.status]} ${
        table.shape === 'round' ? 'rounded-full' : 'rounded-[14px]'
      } ${selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''}`}
      style={{ left: `${(table.x / 1000) * 100}%`, top: `${(table.y / 640) * 100}%`, width: `${(table.w / 1000) * 100}%`, height: `${(table.h / 640) * 100}%` }}
    >
      {hasReady ? <span className="absolute -right-1.5 -top-1.5 size-3.5 animate-pulse rounded-full border-2 border-background bg-success" aria-label={t('Hay algo listo para llevar')} /> : null}
      <span className="font-display text-[clamp(13px,2.2vw,22px)] font-bold leading-none">{table.number}</span>
      {table.session ? (
        <span className={`mt-1 text-[clamp(10px,1.2vw,13px)] font-medium leading-none ${late ? 'text-[#ffb4b5]' : 'text-foreground/80'}`}>{formatElapsed(minutes)}</span>
      ) : (
        <span className="mt-1 text-[clamp(10px,1.1vw,12px)] leading-none text-muted-foreground">{t('{n} p.', { n: table.capacity })}</span>
      )}
    </button>
  );
}

export function Legend() {
  const t = useT();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
      {(['free', 'open', 'bill', 'reserved', 'blocked'] as const).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-[4px] border-2 ${STATUS_STYLE[s]}`} aria-hidden="true" />
          {t(STATUS_LABEL[s])}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="text-[#ffb4b5]">●</span> {t('Más de {n} min', { n: LONG_TABLE_MINUTES })}
      </li>
    </ul>
  );
}

export function ZoneTabs({ zones, zone, onChange }: { zones: string[]; zone: string; onChange: (zone: string) => void }) {
  const t = useT();
  if (zones.length < 2) return null;
  return (
    <div role="tablist" aria-label={t('Zonas')} className="flex flex-wrap gap-1.5">
      {zones.map((z) => (
        <button
          key={z}
          role="tab"
          aria-selected={z === zone}
          onClick={() => onChange(z)}
          className={`rounded-full px-4 py-1.5 text-[14px] transition ${z === zone ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
        >
          {z}
        </button>
      ))}
    </div>
  );
}

type Ready = Omit<ReadyTicket, 'readyAt'> & { readyAt: string };

export function TableBoard({
  tables,
  ready = [],
  canOpen,
  canClose,
  timeZone,
}: {
  tables: BoardTable[];
  ready?: Ready[];
  canOpen: boolean;
  canClose: boolean;
  timeZone: string;
}) {
  const now = useNow();
  const t = useT();
  const zones = useMemo(() => [...new Set(tables.map((t) => t.zone))], [tables]);
  const [zone, setZone] = useState(zones[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentZone = zones.includes(zone) ? zone : zones[0];
  const selected = tables.find((t) => t.id === selectedId) ?? null;
  const openTables = tables.filter((t) => t.session).sort((a, b) => a.session!.openedAt.localeCompare(b.session!.openedAt));
  const readySessions = new Set(ready.map((r) => r.sessionId));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ZoneTabs zones={zones} zone={currentZone} onChange={setZone} />
          <Legend />
        </div>
        <div className="relative w-full overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#04080d]" style={{ aspectRatio: '1000 / 640' }}>
          <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:4%_6.25%]" />
          {tables
            .filter((t) => t.zone === currentZone)
            .map((t) => (
              <TableShape
                key={t.id}
                table={t}
                now={now}
                selected={t.id === selectedId}
                hasReady={readySessions.has(t.session?.id ?? '')}
                onClick={() => setSelectedId(t.id)}
              />
            ))}
        </div>
        {/* En el celular el plano queda pequeño para el dedo: las mismas mesas en botones grandes. */}
        <ul className="grid grid-cols-4 gap-2 sm:hidden" aria-label={t('Mesas de la zona')}>
          {tables
            .filter((t) => t.zone === currentZone)
            .map((tb) => (
              <li key={tb.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(tb.id)}
                  className={`flex h-16 w-full flex-col items-center justify-center rounded-2xl border-2 ${STATUS_STYLE[tb.status]}`}
                >
                  <span className="font-display text-[18px] font-bold leading-none">{tb.number}</span>
                  <span className="mt-1 text-[11.5px] leading-none text-muted-foreground">
                    {tb.session ? formatElapsed(elapsedMinutes(tb.session.openedAt, now)) : t('{n} p.', { n: tb.capacity })}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </div>

      <aside className="space-y-3">
        {ready.length > 0 ? <ReadyList ready={ready} now={now} /> : null}
        <h2 className="font-display text-[17px] font-bold">{t('Mesas abiertas')}</h2>
        {openTables.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{t('Ninguna por ahora.')}</p>
        ) : (
          <ul className="space-y-2">
            {openTables.map((ot) => {
              const minutes = elapsedMinutes(ot.session!.openedAt, now);
              return (
                <li key={ot.id}>
                  <button
                    type="button"
                    onClick={() => (setZone(ot.zone), setSelectedId(ot.id))}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-card px-4 py-3 text-left transition hover:border-white/[0.18]"
                  >
                    <span>
                      <span className="font-display text-[16px] font-semibold">{t('Mesa {n}', { n: ot.number })}</span>
                      <span className="block text-[13px] text-muted-foreground">
                        {t('{n} p.', { n: ot.session!.guests })} · {formatCop(ot.session!.total ?? 0)}
                        {ot.status === 'bill' ? ` · ${t('pidió la cuenta')}` : ''}
                      </span>
                    </span>
                    <span className={`text-[14px] font-medium ${minutes >= LONG_TABLE_MINUTES ? 'text-[#ffb4b5]' : 'text-foreground'}`}>{formatElapsed(minutes)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {selected ? (
        <TableSheet
          key={selected.id}
          table={selected}
          freeTables={tables.filter((ft) => ft.status === 'free')}
          canOpen={canOpen}
          canClose={canClose}
          now={now}
          timeZone={timeZone}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

/** Panel de una mesa: abrir, cambiar personas o nota, pedir la cuenta, moverla o cerrarla. */
function TableSheet({
  table,
  freeTables,
  canOpen,
  canClose,
  now,
  timeZone,
  onClose,
}: {
  table: BoardTable;
  freeTables: BoardTable[];
  canOpen: boolean;
  canClose: boolean;
  now: number;
  timeZone: string;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const session = table.session;
  const [closing, setClosing] = useState(false);
  // Si la mesa se abre, se cierra o su cuenta pasa a otra mesa (aquí o desde otro aparato), el panel ya cumplió.
  const [sessionId] = useState(session?.id ?? null);
  useEffect(() => {
    if ((session?.id ?? null) !== sessionId) onClose();
  }, [session?.id, sessionId, onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/[0.1] bg-[#070c12] p-6 shadow-[var(--shadow-glass)] sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="sheet-title" className="font-display text-[24px] font-bold">
              {t('Mesa {n}', { n: table.number })}
            </h2>
            <p className="text-[14px] text-muted-foreground">
              {table.zone} · {t('{n} puestos', { n: table.capacity })} · {t(STATUS_LABEL[table.status])}
            </p>
          </div>
          <button type="button" onClick={onClose} className={quietButton} aria-label={t('Cerrar')}>
            ✕
          </button>
        </div>

        {table.reservedFor && !session ? (
          <p className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-[14.5px]">
            {t('Reservada para {name} ({guests} p.) a las {time}. Si llegó, ábrela desde {link}.', {
              guests: table.reservedFor.guests,
              time: formatTime(table.reservedFor.startsAt, timeZone, lang),
            })
              .split(/(\{name\}|\{link\})/)
              .map((part, i) =>
                part === '{name}' ? (
                  <strong key={i}>{table.reservedFor!.customerName}</strong>
                ) : part === '{link}' ? (
                  <Link key={i} href="/app/reservas" className="text-primary underline">
                    {t('Reservas')}
                  </Link>
                ) : (
                  part
                ),
              )}
          </p>
        ) : null}

        {table.status === 'blocked' ? (
          <p className="mt-6 text-[15px] text-muted-foreground">{t('Esta mesa está bloqueada. El administrador la desbloquea en Plano.')}</p>
        ) : null}

        {(table.status === 'free' || table.status === 'reserved') && canOpen ? (
          <ActionForm action={openTableAction} onOk={onClose} className="mt-6 space-y-4">
            {(state) => (
              <>
                <input type="hidden" name="tableId" value={table.id} />
                <GuestStepper defaultValue={Number(state?.values?.guests) || Math.min(table.capacity, 2)} />
                <Field label={t('Nota (opcional)')} name="notes" placeholder={t('Cumpleaños, alergia…')} maxLength={300} defaultValue={state?.values?.notes} />
                <SubmitButton className="w-full py-3" pendingText={t('Abriendo…')}>
                  {t('Abrir mesa')}
                </SubmitButton>
              </>
            )}
          </ActionForm>
        ) : null}

        {session ? (
          <div className="mt-5 space-y-5">
            <div className="flex gap-2">
              <Link href={`/app/mesa/${session.id}`} className={`${primaryButton} flex-1 py-3 text-[15.5px]`}>
                {t('Pedido · {total}', { total: formatCop(session.total ?? 0) })}
              </Link>
              {canClose ? (
                <Link href={`/app/caja/mesa/${session.id}`} className={`${quietButton} py-3`}>
                  {t('Cobrar')}
                </Link>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-[14px]">
              <p>
                <span className="block text-muted-foreground">{t('Tiempo')}</span>
                <span className={`font-display text-[20px] font-bold ${elapsedMinutes(session.openedAt, now) >= LONG_TABLE_MINUTES ? 'text-[#ffb4b5]' : ''}`}>
                  {formatElapsed(elapsedMinutes(session.openedAt, now))}
                </span>
              </p>
              <p>
                <span className="block text-muted-foreground">{t('Abierta')}</span>
                <span className="font-medium">
                  {formatTime(session.openedAt, timeZone, lang)} · {session.openedBy}
                </span>
              </p>
            </div>

            {canOpen ? (
              <ActionForm action={updateSessionAction} className="space-y-3">
                {() => (
                  <>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <GuestStepper defaultValue={session.guests} />
                    <Field label={t('Nota')} name="notes" maxLength={300} defaultValue={session.notes ?? ''} />
                    <SubmitButton tone="quiet" pendingText={t('Guardando…')}>
                      {t('Guardar cambios')}
                    </SubmitButton>
                  </>
                )}
              </ActionForm>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
              <ActionForm action={setBillAction} className="contents" showOk={false}>
                {() => (
                  <>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="bill" value={table.status === 'bill' ? '0' : '1'} />
                    <SubmitButton tone="quiet">{table.status === 'bill' ? t('Volver a abrir') : t('Pedir la cuenta')}</SubmitButton>
                  </>
                )}
              </ActionForm>
              {canClose && !closing ? (
                <button type="button" className={quietButton} onClick={() => setClosing(true)}>
                  {t('Cerrar mesa')}
                </button>
              ) : null}
            </div>

            {canClose && closing ? (
              <ActionForm action={closeTableAction} onOk={onClose} className="space-y-3 rounded-2xl border border-white/[0.08] p-4">
                {(state) => (
                  <>
                    <input type="hidden" name="sessionId" value={session.id} />
                    {table.status === 'bill' ? (
                      <p className="text-[14px] text-muted-foreground">{t('La mesa queda libre y su tiempo queda guardado. Si tiene consumo, se cierra cobrando en Caja.')}</p>
                    ) : (
                      <TextArea label={t('¿Por qué se cierra sin pedir la cuenta?')} name="reason" required minLength={3} maxLength={300} defaultValue={state?.values?.reason} />
                    )}
                    <div className="flex gap-2">
                      <SubmitButton pendingText={t('Cerrando…')}>{t('Confirmar cierre')}</SubmitButton>
                      <button type="button" className={quietButton} onClick={() => setClosing(false)}>
                        {t('Cancelar')}
                      </button>
                    </div>
                  </>
                )}
              </ActionForm>
            ) : null}

            {canOpen && freeTables.length > 0 ? (
              <ActionForm action={moveSessionAction} onOk={onClose} className="space-y-3 border-t border-white/[0.06] pt-5">
                {() => (
                  <>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <Select label={t('Pasar a otra mesa')} name="toTableId" required defaultValue="">
                      <option value="" disabled>
                        {t('Elige una mesa libre')}
                      </option>
                      {freeTables.map((ft) => (
                        <option key={ft.id} value={ft.id}>
                          {t('Mesa {n}', { n: ft.number })} · {ft.zone} · {t('{n} p.', { n: ft.capacity })}
                        </option>
                      ))}
                    </Select>
                    <SubmitButton tone="quiet" pendingText={t('Moviendo…')}>
                      {t('Mover')}
                    </SubmitButton>
                  </>
                )}
              </ActionForm>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GuestStepper({ defaultValue }: { defaultValue: number }) {
  const [guests, setGuests] = useState(defaultValue);
  const set = (n: number) => setGuests(Math.min(60, Math.max(1, n)));
  const t = useT();
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{t('Personas')}</p>
      <div className="flex items-center gap-3">
        <button type="button" className={`${quietButton} size-12 text-[22px]`} onClick={() => set(guests - 1)} aria-label={t('Una persona menos')}>
          −
        </button>
        <input
          name="guests"
          value={guests}
          onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 1)}
          inputMode="numeric"
          aria-label={t('Personas')}
          className="w-16 rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-center font-display text-[22px] font-bold"
        />
        <button type="button" className={`${quietButton} size-12 text-[22px]`} onClick={() => set(guests + 1)} aria-label={t('Una persona más')}>
          +
        </button>
      </div>
    </div>
  );
}

/** Lo que cocina o barra ya dejó listo: el mesero lo lleva y toca "Entregado". */
function ReadyList({ ready, now }: { ready: Ready[]; now: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const trx = useTr();
  return (
    <section className="rounded-[22px] border-2 border-success/40 bg-success/[0.06] p-4">
      <h2 className="font-display text-[17px] font-bold">{t('Listo para llevar')}</h2>
      <ul className="mt-3 space-y-2.5">
        {ready.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3">
            <span className="text-[14px]">
              <span className="font-semibold">
                {t('Mesa {n}', { n: r.tableNumber })} · {t(STATION_LABEL[r.station])}
              </span>
              <span className="block text-muted-foreground">{r.items.join(', ')}</span>
              <span className="block text-[12.5px] text-muted-foreground">{t('hace {time}', { time: formatElapsed(elapsedMinutes(r.readyAt, now)) })}</span>
            </span>
            <button
              type="button"
              disabled={pending}
              className={quietButton}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const result = await orOffline(moveTicketAction(r.id, 'delivered'));
                  if (result) setError(result);
                })
              }
            >
              {t('Entregado')}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-[13px] text-[#ffb4b5]">{trx(error)}</p> : null}
    </section>
  );
}
