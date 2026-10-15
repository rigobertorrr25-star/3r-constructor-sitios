'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { closeTableAction, moveSessionAction, moveTicketAction, openTableAction, setBillAction, updateSessionAction } from '@/app/actions';
import { orOffline } from '@/lib/offline';
import Link from 'next/link';
import { LONG_TABLE_MINUTES, elapsedMinutes, formatCop, formatElapsed, formatTime } from '@/lib/format';
import type { FloorTable } from '@/lib/store';
import type { Fixture } from '@/lib/floor';
import type { ReadyTicket } from '@/lib/kds';
import { STATION_LABEL } from '@/lib/stations';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select, TextArea, primaryButton, quietButton } from './ui';
import { useLang, useT, useTr } from './i18n';

export type BoardTable = Omit<FloorTable, 'session'> & {
  session:
    | (Omit<NonNullable<FloorTable['session']>, 'openedAt' | 'billAt' | 'openedById' | 'openedByRole'> & {
        openedAt: string;
        billAt: string | null;
        total?: number;
        /** Si quien mira la puede cobrar (en un bar sin cajero, el mesero cobra sus mesas). */
        canCharge?: boolean;
      })
    | null;
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

/** El piso del local visto desde arriba: foto de cemento pulido cálido, con luz tenue de bar de noche. */
/** El piso del plano: la foto de fondo del restaurante si el dueño la escogió (Sedes), o el piso de madera de 3R. */
export function floorStyle(photo?: string | null): React.CSSProperties {
  if (!photo) return FLOOR_STYLE;
  return {
    aspectRatio: '1000 / 640',
    backgroundColor: '#14110e',
    // Un poco oscurecida para que las mesas y sus números se sigan viendo.
    backgroundImage: `linear-gradient(rgba(8,6,4,0.35), rgba(8,6,4,0.35)), url("${photo}")`,
    backgroundSize: '100% 100%, cover',
    backgroundPosition: 'center',
    boxShadow: 'inset 0 0 0 6px rgba(255,255,255,0.06), inset 0 0 90px rgba(0,0,0,0.6)',
  };
}

export const FLOOR_STYLE: React.CSSProperties = {
  aspectRatio: '1000 / 640',
  backgroundColor: '#211b15',
  backgroundImage: [
    'radial-gradient(circle at 18% 20%, rgba(255,196,120,0.10), transparent 38%)',
    'radial-gradient(circle at 78% 30%, rgba(255,196,120,0.08), transparent 40%)',
    'linear-gradient(rgba(18,12,6,0.45), rgba(18,12,6,0.45))',
    "url('/plano/piso.webp')",
  ].join(', '),
  backgroundSize: '100% 100%, 100% 100%, 100% 100%, cover',
  backgroundPosition: 'center',
  boxShadow: 'inset 0 0 0 6px #2c241c, inset 0 0 90px rgba(0,0,0,0.7)',
};

/** El aro de color alrededor de cada mesa dice cómo está: libre, ocupada, pidió la cuenta… */
const RING: Record<BoardTable['status'], { ring: string; glow: string }> = {
  free: { ring: 'color-mix(in oklab, var(--color-success) 70%, transparent)', glow: 'transparent' },
  open: { ring: 'var(--color-primary)', glow: 'color-mix(in oklab, var(--color-primary) 45%, transparent)' },
  bill: { ring: 'var(--color-warning)', glow: 'color-mix(in oklab, var(--color-warning) 50%, transparent)' },
  blocked: { ring: '#ffffff26', glow: 'transparent' },
  reserved: { ring: 'var(--color-accent)', glow: 'color-mix(in oklab, var(--color-accent) 35%, transparent)' },
};

/** Fotos de los muebles vistos desde arriba (en public/plano, creadas con IA para que el plano se vea como el local). */
const PHOTO = {
  chair: '/plano/silla.webp',
  round: '/plano/mesa-redonda.webp',
  square: '/plano/mesa-cuadrada.webp',
  long: '/plano/mesa-larga.webp',
  stool: '/plano/banco.webp',
  bar: '/plano/barra.webp',
} as const;

/**
 * Una foto que llena su caja aunque haya que girarla 90°: girada, su ancho es el alto de la caja y al revés.
 * `turn` en grados (0, 90, 180, -90); w y h son las medidas de la caja en unidades del lienzo.
 */
function TurnedPhoto({ src, turn, w, h, style }: { src: string; turn: number; w: number; h: number; style?: React.CSSProperties }) {
  const sideways = turn === 90 || turn === -90;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
      style={{
        width: sideways ? `${(h / w) * 100}%` : '100%',
        height: sideways ? `${(w / h) * 100}%` : '100%',
        transform: `translate(-50%, -50%) rotate(${turn}deg)`,
        ...style,
      }}
    />
  );
}

type Chair = { x: number; y: number; w: number; h: number; r: number };

/**
 * Dónde van las sillas alrededor de la mesa (en % de la caja de la mesa) y hacia dónde mira el respaldo. Una por puesto.
 * Las medidas salen en unidades del lienzo (1000 × 640, cuadradas en pantalla) para que las sillas no se deformen.
 */
export function chairsFor(shape: BoardTable['shape'], capacity: number, w: number, h: number): Chair[] {
  const n = Math.max(1, Math.min(capacity, 16));
  const chair = (cx: number, cy: number, size: number, r: number): Chair => ({ x: (cx / w) * 100, y: (cy / h) * 100, w: (size / w) * 100, h: ((size * 1.1) / h) * 100, r });
  if (shape === 'round') {
    // Mesa redonda: la mitad de las sillas a la izquierda y la otra mitad a la derecha, pegadas entre sí (no en cruz).
    const perSide = Math.ceil(n / 2);
    const spread = 2.6; // lo más que ocupa cada lado del círculo (unos 150°)
    let size = 38;
    if ((perSide * size) / (w / 2 + size * 0.55) > spread) size = Math.max(16, (spread * (w / 2)) / (perSide - spread * 0.55));
    const radius = w / 2 + size * 0.55;
    const step = (size / radius) * 1.04;
    const side = (count: number, center: number) =>
      Array.from({ length: count }, (_, i) => {
        const a = center + (i - (count - 1) / 2) * step;
        return chair(w / 2 + Math.cos(a) * radius, h / 2 + Math.sin(a) * (h / 2 + size * 0.55), size, (a * 180) / Math.PI + 90);
      });
    return [...side(perSide, Math.PI), ...side(n - perSide, 0)];
  }
  // Mesa rectangular: sillas por los lados largos y, si sobra una o son muchas, en las cabeceras.
  const wide = w >= h;
  const long = wide ? w : h;
  const ends = n % 2 === 1 ? 1 : n >= 6 ? 2 : 0;
  const sides = n - ends;
  const first = Math.ceil(sides / 2);
  const second = sides - first;
  const size = Math.min(38, long / Math.max(first, 1) - 8);
  const out = size * 0.55;
  const chairs: Chair[] = [];
  const row = (count: number, side: 'a' | 'b') => {
    for (let i = 0; i < count; i++) {
      const along = ((i + 1) / (count + 1)) * long;
      if (wide) chairs.push(chair(along, side === 'a' ? -out : h + out, size, side === 'a' ? 0 : 180));
      else chairs.push(chair(side === 'a' ? -out : w + out, along, size, side === 'a' ? -90 : 90));
    }
  };
  row(first, 'a');
  row(second, 'b');
  const endSize = Math.min(38, (wide ? h : w) - 8);
  if (ends >= 1) chairs.push(wide ? chair(-endSize * 0.55, h / 2, endSize, -90) : chair(w / 2, -endSize * 0.55, endSize, 0));
  if (ends === 2) chairs.push(wide ? chair(w + endSize * 0.55, h / 2, endSize, 90) : chair(w / 2, h + endSize * 0.55, endSize, 180));
  return chairs;
}

/** Silla tapizada (foto vista desde arriba): el respaldo va hacia afuera. Si hay alguien sentado, se ilumina. */
function ChairTop({ c, seated }: { c: Chair; seated: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PHOTO.chair}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none absolute max-w-none select-none"
      style={{
        left: `${c.x}%`,
        top: `${c.y}%`,
        width: `${c.w}%`,
        height: `${c.h}%`,
        transform: `translate(-50%, -50%) rotate(${c.r}deg)`,
        filter: seated
          ? 'brightness(1.35) saturate(1.15) drop-shadow(0 0 5px rgba(255,236,190,0.75))'
          : 'drop-shadow(0 5px 6px rgba(0,0,0,0.65))',
      }}
    />
  );
}

export function TableShape({ table, now, onClick, selected, hasReady }: { table: BoardTable; now: number; onClick?: () => void; selected?: boolean; hasReady?: boolean }) {
  const minutes = table.session ? elapsedMinutes(table.session.openedAt, now) : 0;
  const late = table.session && minutes >= LONG_TABLE_MINUTES;
  const t = useT();
  const status = t(STATUS_LABEL[table.status]);
  const look = RING[table.status];
  const round = table.shape === 'round';
  const chairs = chairsFor(table.shape, table.capacity, table.w, table.h);
  const seated = table.session?.guests ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={table.session ? t('Mesa {n}, {status}, {time}', { n: table.number, status, time: formatElapsed(minutes) }) : t('Mesa {n}, {status}', { n: table.number, status })}
      className={`group absolute text-center ${table.status === 'blocked' ? 'opacity-60 grayscale' : ''}`}
      style={{ left: `${(table.x / 1000) * 100}%`, top: `${(table.y / 640) * 100}%`, width: `${(table.w / 1000) * 100}%`, height: `${(table.h / 640) * 100}%` }}
    >
      {chairs.map((c, i) => (
        <ChairTop key={i} c={c} seated={i < seated} />
      ))}
      {/* La tapa de la mesa: foto de madera. Las mesas largas usan la tabla larga, girada si la mesa está de pie. */}
      <span className="absolute inset-0 transition group-hover:brightness-110" style={{ filter: 'drop-shadow(0 12px 14px rgba(0,0,0,0.6))' }}>
        <TurnedPhoto
          src={round ? PHOTO.round : Math.max(table.w, table.h) / Math.min(table.w, table.h) >= 1.4 ? PHOTO.long : PHOTO.square}
          turn={!round && table.h > table.w * 1.4 ? 90 : 0}
          w={table.w}
          h={table.h}
        />
      </span>
      <span
        className={`absolute inset-0 flex flex-col items-center justify-center ${round ? 'rounded-full' : 'rounded-[8px]'} ${
          table.status === 'reserved' ? 'outline-dashed outline-2 outline-offset-4 outline-accent' : ''
        } ${selected ? 'outline outline-2 outline-offset-[6px] outline-foreground' : ''}`}
        style={{ boxShadow: `0 0 0 ${table.status === 'free' ? 2 : 3}px ${look.ring}, 0 0 22px 4px ${look.glow}` }}
      >
        {/* La velita del centro: da la luz cálida de la foto. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,214,140,0.55) 0%, rgba(255,190,110,0.18) 35%, transparent 70%)' }}
        />
        {hasReady ? <span className="absolute -right-1.5 -top-1.5 size-3.5 animate-pulse rounded-full border-2 border-background bg-success" aria-label={t('Hay algo listo para llevar')} /> : null}
        <span className="relative font-display text-[clamp(14px,2.2vw,24px)] font-bold leading-none text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">{table.number}</span>
        {table.session ? (
          <span className={`relative mt-1 text-[clamp(10px,1.2vw,13px)] font-semibold leading-none [text-shadow:0_1px_2px_rgba(0,0,0,0.9)] ${late ? 'text-[#ffb4b5]' : 'text-white/90'}`}>
            {formatElapsed(minutes)}
          </span>
        ) : (
          <span className="relative mt-1 text-[clamp(10px,1.1vw,12px)] leading-none text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">{t('{n} p.', { n: table.capacity })}</span>
        )}
      </span>
    </button>
  );
}

export type BoardFixture = Fixture;

/** La barra vista desde arriba: mostrador de madera del lado de los clientes, el fondo oscuro del bartender detrás y las sillas altas. */
export function BarShape({ fixture, selected }: { fixture: BoardFixture; selected?: boolean }) {
  const f = fixture;
  const vertical = f.seatSide === 'left' || f.seatSide === 'right';
  const long = vertical ? f.h : f.w;
  const stool = Math.min(34, long / Math.max(f.seats, 1) - 8);
  const stools = Array.from({ length: f.seats }, (_, i) => {
    const along = ((i + 1) / (f.seats + 1)) * long;
    const off = stool / 2 + 10;
    const [cx, cy] =
      f.seatSide === 'bottom' ? [along, f.h + off] : f.seatSide === 'top' ? [along, -off] : f.seatSide === 'left' ? [-off, along] : [f.w + off, along];
    return { x: (cx / f.w) * 100, y: (cy / f.h) * 100, w: (stool / f.w) * 100, h: (stool / f.h) * 100 };
  });
  // La foto de la barra tiene la madera (lado de los clientes) abajo: se gira para que quede del lado de las sillas.
  const turn = { bottom: 0, top: 180, left: 90, right: -90 }[f.seatSide];
  return (
    <div
      className="absolute"
      style={{ left: `${(f.x / 1000) * 100}%`, top: `${(f.y / 640) * 100}%`, width: `${(f.w / 1000) * 100}%`, height: `${(f.h / 640) * 100}%` }}
      aria-label={f.label}
    >
      {stools.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={PHOTO.stool}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.w}%`,
            height: `${s.h}%`,
            transform: 'translate(-50%, -50%)',
            filter: 'drop-shadow(0 6px 6px rgba(0,0,0,0.6))',
          }}
        />
      ))}
      <div
        className={`absolute inset-0 overflow-hidden rounded-[6px] ${selected ? 'outline outline-2 outline-offset-[6px] outline-foreground' : ''}`}
        style={{ boxShadow: '0 14px 24px rgba(0,0,0,0.65)' }}
      >
        <TurnedPhoto src={PHOTO.bar} turn={turn} w={f.w} h={f.h} />
      </div>
    </div>
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
  fixtures = [],
  ready = [],
  canOpen,
  canClose,
  waitersCollect = false,
  timeZone,
  floorPhoto = null,
}: {
  tables: BoardTable[];
  fixtures?: BoardFixture[];
  ready?: Ready[];
  canOpen: boolean;
  canClose: boolean;
  waitersCollect?: boolean;
  timeZone: string;
  /** Foto de fondo del restaurante para el piso del plano (null = piso de madera). */
  floorPhoto?: string | null;
}) {
  const now = useNow();
  const t = useT();
  const zones = useMemo(() => [...new Set([...tables.map((t) => t.zone), ...fixtures.map((f) => f.zone)])], [tables, fixtures]);
  const [zone, setZone] = useState(zones[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentZone = zones.includes(zone) ? zone : zones[0];
  const selected = tables.find((t) => t.id === selectedId) ?? null;
  const openTables = tables.filter((t) => t.session).sort((a, b) => a.session!.openedAt.localeCompare(b.session!.openedAt));
  const readySessions = new Set(ready.map((r) => r.sessionId));

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ZoneTabs zones={zones} zone={currentZone} onChange={setZone} />
          <Legend />
        </div>
        {/* El plano visto desde arriba, como el local de noche: barras, mesas de madera y sus sillas. En el celular se desliza de lado. */}
        <div className="overflow-x-auto rounded-[24px] border border-white/[0.08]">
          <div className="relative min-w-[760px]" style={floorStyle(floorPhoto)}>
            {fixtures
              .filter((f) => f.zone === currentZone)
              .map((f) => (
                <BarShape key={f.id} fixture={f} />
              ))}
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
          waitersCollect={waitersCollect}
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
  waitersCollect = false,
  now,
  timeZone,
  onClose,
}: {
  table: BoardTable;
  freeTables: BoardTable[];
  canOpen: boolean;
  canClose: boolean;
  waitersCollect?: boolean;
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
              {canClose || session.canCharge ? (
                <Link href={`/app/caja/mesa/${session.id}`} className={`${quietButton} py-3`}>
                  {t('Cobrar cuenta')}
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
              {/* En un bar sin cajero el mesero cobra: no hay a quién pedirle la cuenta. */}
              {!waitersCollect || table.status === 'bill' ? (
                <ActionForm action={setBillAction} className="contents" showOk={false}>
                  {() => (
                    <>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="bill" value={table.status === 'bill' ? '0' : '1'} />
                      <SubmitButton tone="quiet">{table.status === 'bill' ? t('Volver a abrir') : t('Pedir la cuenta')}</SubmitButton>
                    </>
                  )}
                </ActionForm>
              ) : null}
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
