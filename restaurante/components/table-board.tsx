'use client';

import { useEffect, useMemo, useState } from 'react';
import { closeTableAction, moveSessionAction, openTableAction, setBillAction, updateSessionAction } from '@/app/actions';
import Link from 'next/link';
import { LONG_TABLE_MINUTES, elapsedMinutes, formatCop, formatElapsed, formatTime } from '@/lib/format';
import type { FloorTable } from '@/lib/store';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select, TextArea, primaryButton, quietButton } from './ui';

export type BoardTable = Omit<FloorTable, 'session'> & {
  session: (Omit<NonNullable<FloorTable['session']>, 'openedAt' | 'billAt'> & { openedAt: string; billAt: string | null; total?: number }) | null;
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

const STATUS_LABEL: Record<BoardTable['status'], string> = { free: 'Libre', open: 'Ocupada', bill: 'Pidió la cuenta', blocked: 'Bloqueada' };

const STATUS_STYLE: Record<BoardTable['status'], string> = {
  free: 'border-success/40 bg-success/[0.07] text-foreground hover:bg-success/[0.14]',
  open: 'border-primary/60 bg-primary/[0.16] text-foreground hover:bg-primary/[0.24]',
  bill: 'border-warning/70 bg-warning/[0.16] text-foreground hover:bg-warning/[0.24]',
  blocked: 'border-white/10 bg-white/[0.03] text-muted-foreground [background-image:repeating-linear-gradient(135deg,transparent_0_8px,#ffffff08_8px_16px)]',
};

export function TableShape({ table, now, onClick, selected }: { table: BoardTable; now: number; onClick?: () => void; selected?: boolean }) {
  const minutes = table.session ? elapsedMinutes(table.session.openedAt, now) : 0;
  const late = table.session && minutes >= LONG_TABLE_MINUTES;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Mesa ${table.number}, ${STATUS_LABEL[table.status]}${table.session ? `, ${formatElapsed(minutes)}` : ''}`}
      className={`absolute flex flex-col items-center justify-center border-2 text-center transition ${STATUS_STYLE[table.status]} ${
        table.shape === 'round' ? 'rounded-full' : 'rounded-[14px]'
      } ${selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''}`}
      style={{ left: `${(table.x / 1000) * 100}%`, top: `${(table.y / 640) * 100}%`, width: `${(table.w / 1000) * 100}%`, height: `${(table.h / 640) * 100}%` }}
    >
      <span className="font-display text-[clamp(13px,2.2vw,22px)] font-bold leading-none">{table.number}</span>
      {table.session ? (
        <span className={`mt-1 text-[clamp(10px,1.2vw,13px)] font-medium leading-none ${late ? 'text-[#ffb4b5]' : 'text-foreground/80'}`}>{formatElapsed(minutes)}</span>
      ) : (
        <span className="mt-1 text-[clamp(10px,1.1vw,12px)] leading-none text-muted-foreground">{table.capacity} p.</span>
      )}
    </button>
  );
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
      {(['free', 'open', 'bill', 'blocked'] as const).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-[4px] border-2 ${STATUS_STYLE[s]}`} aria-hidden="true" />
          {STATUS_LABEL[s]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="text-[#ffb4b5]">●</span> Más de {LONG_TABLE_MINUTES} min
      </li>
    </ul>
  );
}

export function ZoneTabs({ zones, zone, onChange }: { zones: string[]; zone: string; onChange: (zone: string) => void }) {
  if (zones.length < 2) return null;
  return (
    <div role="tablist" aria-label="Zonas" className="flex flex-wrap gap-1.5">
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

export function TableBoard({ tables, canOpen, canClose, timeZone }: { tables: BoardTable[]; canOpen: boolean; canClose: boolean; timeZone: string }) {
  const now = useNow();
  const zones = useMemo(() => [...new Set(tables.map((t) => t.zone))], [tables]);
  const [zone, setZone] = useState(zones[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentZone = zones.includes(zone) ? zone : zones[0];
  const selected = tables.find((t) => t.id === selectedId) ?? null;
  const openTables = tables.filter((t) => t.session).sort((a, b) => a.session!.openedAt.localeCompare(b.session!.openedAt));

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
              <TableShape key={t.id} table={t} now={now} selected={t.id === selectedId} onClick={() => setSelectedId(t.id)} />
            ))}
        </div>
        {/* En el celular el plano queda pequeño para el dedo: las mismas mesas en botones grandes. */}
        <ul className="grid grid-cols-4 gap-2 sm:hidden" aria-label="Mesas de la zona">
          {tables
            .filter((t) => t.zone === currentZone)
            .map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`flex h-16 w-full flex-col items-center justify-center rounded-2xl border-2 ${STATUS_STYLE[t.status]}`}
                >
                  <span className="font-display text-[18px] font-bold leading-none">{t.number}</span>
                  <span className="mt-1 text-[11.5px] leading-none text-muted-foreground">
                    {t.session ? formatElapsed(elapsedMinutes(t.session.openedAt, now)) : `${t.capacity} p.`}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </div>

      <aside className="space-y-3">
        <h2 className="font-display text-[17px] font-bold">Mesas abiertas</h2>
        {openTables.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Ninguna por ahora.</p>
        ) : (
          <ul className="space-y-2">
            {openTables.map((t) => {
              const minutes = elapsedMinutes(t.session!.openedAt, now);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => (setZone(t.zone), setSelectedId(t.id))}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-card px-4 py-3 text-left transition hover:border-white/[0.18]"
                  >
                    <span>
                      <span className="font-display text-[16px] font-semibold">Mesa {t.number}</span>
                      <span className="block text-[13px] text-muted-foreground">
                        {t.session!.guests} p. · {formatCop(t.session!.total ?? 0)}
                        {t.status === 'bill' ? ' · pidió la cuenta' : ''}
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
          freeTables={tables.filter((t) => t.status === 'free')}
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
              Mesa {table.number}
            </h2>
            <p className="text-[14px] text-muted-foreground">
              {table.zone} · {table.capacity} puestos · {STATUS_LABEL[table.status]}
            </p>
          </div>
          <button type="button" onClick={onClose} className={quietButton} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {table.status === 'blocked' ? (
          <p className="mt-6 text-[15px] text-muted-foreground">Esta mesa está bloqueada. El administrador la desbloquea en Plano.</p>
        ) : null}

        {table.status === 'free' && canOpen ? (
          <ActionForm action={openTableAction} onOk={onClose} className="mt-6 space-y-4">
            {(state) => (
              <>
                <input type="hidden" name="tableId" value={table.id} />
                <GuestStepper defaultValue={Number(state?.values?.guests) || Math.min(table.capacity, 2)} />
                <Field label="Nota (opcional)" name="notes" placeholder="Cumpleaños, alergia…" maxLength={300} defaultValue={state?.values?.notes} />
                <SubmitButton className="w-full py-3" pendingText="Abriendo…">
                  Abrir mesa
                </SubmitButton>
              </>
            )}
          </ActionForm>
        ) : null}

        {session ? (
          <div className="mt-5 space-y-5">
            <Link href={`/app/mesa/${session.id}`} className={`${primaryButton} w-full py-3 text-[15.5px]`}>
              Pedido · {formatCop(session.total ?? 0)}
            </Link>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-[14px]">
              <p>
                <span className="block text-muted-foreground">Tiempo</span>
                <span className={`font-display text-[20px] font-bold ${elapsedMinutes(session.openedAt, now) >= LONG_TABLE_MINUTES ? 'text-[#ffb4b5]' : ''}`}>
                  {formatElapsed(elapsedMinutes(session.openedAt, now))}
                </span>
              </p>
              <p>
                <span className="block text-muted-foreground">Abierta</span>
                <span className="font-medium">
                  {formatTime(session.openedAt, timeZone)} · {session.openedBy}
                </span>
              </p>
            </div>

            {canOpen ? (
              <ActionForm action={updateSessionAction} className="space-y-3">
                {() => (
                  <>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <GuestStepper defaultValue={session.guests} />
                    <Field label="Nota" name="notes" maxLength={300} defaultValue={session.notes ?? ''} />
                    <SubmitButton tone="quiet" pendingText="Guardando…">
                      Guardar cambios
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
                    <SubmitButton tone="quiet">{table.status === 'bill' ? 'Volver a abrir' : 'Pedir la cuenta'}</SubmitButton>
                  </>
                )}
              </ActionForm>
              {canClose && !closing ? (
                <button type="button" className={quietButton} onClick={() => setClosing(true)}>
                  Cerrar mesa
                </button>
              ) : null}
            </div>

            {canClose && closing ? (
              <ActionForm action={closeTableAction} onOk={onClose} className="space-y-3 rounded-2xl border border-white/[0.08] p-4">
                {(state) => (
                  <>
                    <input type="hidden" name="sessionId" value={session.id} />
                    {table.status === 'bill' ? (
                      <p className="text-[14px] text-muted-foreground">La mesa queda libre y su tiempo queda guardado. Si tiene consumo, se cierra cobrando en Caja.</p>
                    ) : (
                      <TextArea label="¿Por qué se cierra sin pedir la cuenta?" name="reason" required minLength={3} maxLength={300} defaultValue={state?.values?.reason} />
                    )}
                    <div className="flex gap-2">
                      <SubmitButton pendingText="Cerrando…">Confirmar cierre</SubmitButton>
                      <button type="button" className={quietButton} onClick={() => setClosing(false)}>
                        Cancelar
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
                    <Select label="Pasar a otra mesa" name="toTableId" required defaultValue="">
                      <option value="" disabled>
                        Elige una mesa libre
                      </option>
                      {freeTables.map((t) => (
                        <option key={t.id} value={t.id}>
                          Mesa {t.number} · {t.zone} · {t.capacity} p.
                        </option>
                      ))}
                    </Select>
                    <SubmitButton tone="quiet" pendingText="Moviendo…">
                      Mover
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
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">Personas</p>
      <div className="flex items-center gap-3">
        <button type="button" className={`${quietButton} size-12 text-[22px]`} onClick={() => set(guests - 1)} aria-label="Una persona menos">
          −
        </button>
        <input
          name="guests"
          value={guests}
          onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 1)}
          inputMode="numeric"
          aria-label="Personas"
          className="w-16 rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-center font-display text-[22px] font-bold"
        />
        <button type="button" className={`${quietButton} size-12 text-[22px]`} onClick={() => set(guests + 1)} aria-label="Una persona más">
          +
        </button>
      </div>
    </div>
  );
}
