'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createTableAction, removeTableAction, saveLayoutAction, updateTableAction } from '@/app/actions';
import { orOffline } from '@/lib/offline';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { TableShape, ZoneTabs, type BoardTable } from './table-board';
import { Alert, CheckField, Field, Select, card, primaryButton, quietButton } from './ui';

const W = 1000;
const H = 640;
const SNAP = 10;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

type Box = { x: number; y: number; w: number; h: number };

const SHAPE_LABEL = { square: 'Cuadrada', round: 'Redonda', long: 'Larga' } as const;

export function FloorEditor({ tables }: { tables: BoardTable[] }) {
  const zones = useMemo(() => {
    const list = [...new Set(tables.map((t) => t.zone))];
    return list.length ? list : ['Salón'];
  }, [tables]);
  const [zone, setZone] = useState(zones[0]);
  const [boxes, setBoxes] = useState<Record<string, Box>>(() => Object.fromEntries(tables.map((t) => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h }])));
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const canvas = useRef<HTMLDivElement>(null);
  // Zona escrita en "Agregar mesa": al crearla, el plano salta a esa zona.
  const newZone = useRef('');

  // Cuando llegan datos nuevos del servidor (otra mesa, otro número…), se toman sus posiciones si no hay arrastres sin guardar.
  const signature = tables.map((t) => `${t.id}:${t.x},${t.y},${t.w},${t.h}`).join('|');
  useEffect(() => {
    if (dirty) return;
    setBoxes(Object.fromEntries(tables.map((t) => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; box: Box } | null>(null);

  const currentZone = zones.includes(zone) ? zone : zones[0];
  const selected = tables.find((t) => t.id === selectedId) ?? null;

  const toUnits = (dx: number, dy: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { dx: (dx / rect.width) * W, dy: (dy / rect.height) * H };
  };

  const onPointerDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, mode, startX: e.clientX, startY: e.clientY, box: boxes[id] };
    setSelectedId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { dx, dy } = toUnits(e.clientX - d.startX, e.clientY - d.startY);
    let next: Box;
    if (d.mode === 'move') {
      next = { ...d.box, x: Math.min(Math.max(snap(d.box.x + dx), 0), W - d.box.w), y: Math.min(Math.max(snap(d.box.y + dy), 0), H - d.box.h) };
    } else {
      next = { ...d.box, w: Math.min(Math.max(snap(d.box.w + dx), 60), Math.min(400, W - d.box.x)), h: Math.min(Math.max(snap(d.box.h + dy), 60), Math.min(400, H - d.box.y)) };
    }
    setBoxes((prev) => ({ ...prev, [d.id]: next }));
    setDirty(true);
    setSaved(false);
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const save = () =>
    start(async () => {
      setError(null);
      const changed = tables
        .filter((t) => {
          const b = boxes[t.id];
          return b && (b.x !== t.x || b.y !== t.y || b.w !== t.w || b.h !== t.h);
        })
        .map((t) => ({ id: t.id, ...boxes[t.id] }));
      if (changed.length === 0) return setDirty(false);
      const result = await orOffline(saveLayoutAction(changed));
      if (result) setError(result);
      else {
        setDirty(false);
        setSaved(true);
      }
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ZoneTabs zones={zones} zone={currentZone} onChange={setZone} />
          <div className="flex items-center gap-2">
            {dirty ? <span className="text-[13px] text-warning">Cambios sin guardar</span> : saved ? <span className="text-[13px] text-success">Plano guardado</span> : null}
            <button type="button" className={primaryButton} disabled={!dirty || pending} onClick={save}>
              {pending ? 'Guardando…' : 'Guardar plano'}
            </button>
          </div>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <div
          ref={canvas}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerDown={() => setSelectedId(null)}
          className="relative w-full touch-none select-none overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#04080d]"
          style={{ aspectRatio: `${W} / ${H}` }}
        >
          <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(#ffffff14_1px,transparent_1px)] [background-size:4%_6.25%]" />
          {tables
            .filter((t) => t.zone === currentZone)
            .map((t) => {
              const box = boxes[t.id] ?? { x: t.x, y: t.y, w: t.w, h: t.h };
              return (
                <div key={t.id} onPointerDown={(e) => onPointerDown(e, t.id, 'move')} className="cursor-grab active:cursor-grabbing">
                  <TableShape table={{ ...t, ...box }} now={0} selected={t.id === selectedId} />
                  {t.id === selectedId ? (
                    <span
                      role="presentation"
                      onPointerDown={(e) => onPointerDown(e, t.id, 'resize')}
                      className="absolute z-10 size-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-background bg-foreground"
                      style={{ left: `${((box.x + box.w) / W) * 100}%`, top: `${((box.y + box.h) / H) * 100}%` }}
                    />
                  ) : null}
                </div>
              );
            })}
        </div>
        <p className="text-[13px] text-muted-foreground">Toca una mesa para editarla. El punto blanco de la esquina cambia su tamaño.</p>
      </div>

      <aside className="space-y-4">
        {selected ? (
          <section className={card}>
            <h2 className="font-display text-[18px] font-bold">Mesa {selected.number}</h2>
            <ActionForm action={updateTableAction} className="mt-4 space-y-3">
              {() => (
                <>
                  <input type="hidden" name="tableId" value={selected.id} />
                  <TableFields defaults={selected} />
                  <CheckField name="isBlocked" label="Bloqueada" hint="No se puede abrir (dañada, reservada para un evento…)." defaultChecked={selected.isBlocked} />
                  <SubmitButton pendingText="Guardando…">Guardar mesa</SubmitButton>
                </>
              )}
            </ActionForm>
            <ActionForm action={removeTableAction} onOk={() => setSelectedId(null)} className="mt-4 border-t border-white/[0.06] pt-4">
              {() => (
                <>
                  <input type="hidden" name="tableId" value={selected.id} />
                  <SubmitButton tone="danger" pendingText="Quitando…">
                    Quitar del plano
                  </SubmitButton>
                  <p className="mt-2 text-[12.5px] text-muted-foreground">Su historial se conserva. Si vuelves a crear una mesa con el mismo número, se recupera.</p>
                </>
              )}
            </ActionForm>
          </section>
        ) : null}
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">Agregar mesa</h2>
          <div onInput={(e) => (e.target as HTMLInputElement).name === 'zone' && (newZone.current = (e.target as HTMLInputElement).value.trim())}>
          <ActionForm action={createTableAction} className="mt-4 space-y-3" resetOnOk onOk={() => newZone.current && setZone(newZone.current)}>
            {(state) => (
              <>
                <TableFields defaults={{ zone: state?.values?.zone ?? currentZone, number: state?.values?.number ?? '', capacity: Number(state?.values?.capacity) || 4, shape: (state?.values?.shape as BoardTable['shape']) ?? 'square' }} />
                <SubmitButton pendingText="Agregando…">Agregar</SubmitButton>
              </>
            )}
          </ActionForm>
          </div>
          <p className="mt-3 text-[12.5px] text-muted-foreground">Para una zona nueva (Terraza, Segundo piso…), escribe su nombre en Zona.</p>
        </section>
        <button type="button" className={`${quietButton} w-full`} onClick={() => setSelectedId(null)} hidden={!selected}>
          Deseleccionar
        </button>
      </aside>
    </div>
  );
}

function TableFields({ defaults }: { defaults: Pick<BoardTable, 'zone' | 'number' | 'capacity' | 'shape'> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Número" name="number" required maxLength={12} defaultValue={defaults.number} />
      <Field label="Puestos" name="capacity" type="number" min={1} max={40} required defaultValue={defaults.capacity} />
      <Field label="Zona" name="zone" required maxLength={40} defaultValue={defaults.zone} />
      <Select label="Forma" name="shape" defaultValue={defaults.shape}>
        {Object.entries(SHAPE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
