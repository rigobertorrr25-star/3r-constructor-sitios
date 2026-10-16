'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createFixtureAction, createTableAction, createTablesAction, removeFixtureAction, removeTableAction, removeTablesAction, saveLayoutAction, updateFixtureAction, updateTableAction } from '@/app/actions';
import { orOffline } from '@/lib/offline';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { BarShape, TableShape, floorStyle, ZoneTabs, type BoardFixture, type BoardTable } from './table-board';
import { Alert, CheckField, Field, Select, card, primaryButton, quietButton } from './ui';
import { useT, useTr } from './i18n';

const W = 1000;
const H = 640;
const SNAP = 10;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

type Box = { x: number; y: number; w: number; h: number };

/** Cuadro flotante del plano: más pequeño que una tarjeta para no tapar las mesas. */
const panel = 'rounded-[22px] border border-white/[0.1] bg-[#070c12] p-3.5';
const smallButton = 'rounded-full border border-white/[0.12] px-3 py-1.5 text-[12.5px] text-foreground transition hover:bg-white/[0.06] disabled:opacity-40';

function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-8 shrink-0 place-items-center rounded-full border border-white/[0.12] text-[16px] text-muted-foreground hover:text-foreground">
      ×
    </button>
  );
}

const SHAPE_LABEL = { square: 'Cuadrada', round: 'Redonda', long: 'Larga' } as const;

const SIDE_LABEL = { bottom: 'Abajo', top: 'Arriba', left: 'A la izquierda', right: 'A la derecha' } as const;

export function FloorEditor({ tables, fixtures = [], floorPhoto = null }: { tables: BoardTable[]; fixtures?: BoardFixture[]; floorPhoto?: string | null }) {
  const t = useT();
  const trx = useTr();
  // Pisos o zonas nuevos (por ejemplo «Segundo piso»): existen aquí mientras no tengan mesas; con la primera mesa quedan guardados.
  const [extraZones, setExtraZones] = useState<string[]>([]);
  const [addingZone, setAddingZone] = useState(false);
  const zones = useMemo(() => {
    const list = [...new Set([...tables.map((t) => t.zone), ...fixtures.map((f) => f.zone), ...extraZones])];
    return list.length ? list : ['Salón'];
  }, [tables, fixtures, extraZones]);
  // Mesas y barras se arrastran igual; cada una guarda su caja (x, y, ancho, alto).
  const items = useMemo(() => [...tables, ...fixtures].map((i) => ({ id: i.id, x: i.x, y: i.y, w: i.w, h: i.h })), [tables, fixtures]);
  const [zone, setZone] = useState(zones[0]);
  const [boxes, setBoxes] = useState<Record<string, Box>>(() => Object.fromEntries(items.map((t) => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h }])));
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // «Seleccionar varias»: se tocan las mesas una por una y se quitan juntas.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const canvas = useRef<HTMLDivElement>(null);
  // Zona escrita en "Agregar mesa": al crearla, el plano salta a esa zona.
  const newZone = useRef('');

  // Cuando llegan datos nuevos del servidor (otra mesa, otro número…), se toman sus posiciones si no hay arrastres sin guardar.
  const signature = items.map((t) => `${t.id}:${t.x},${t.y},${t.w},${t.h}`).join('|');
  useEffect(() => {
    if (dirty) return;
    setBoxes(Object.fromEntries(items.map((t) => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; box: Box } | null>(null);

  const currentZone = zones.includes(zone) ? zone : zones[0];
  const selected = tables.find((t) => t.id === selectedId) ?? null;
  const selectedBar = fixtures.find((f) => f.id === selectedId) ?? null;
  const isBar = (id: string) => fixtures.some((f) => f.id === id);

  const toUnits = (dx: number, dy: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { dx: (dx / rect.width) * W, dy: (dy / rect.height) * H };
  };

  const onPointerDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    if (picking) {
      if (!isBar(id)) setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
      return;
    }
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
      // Las barras pueden ser largas (todo el ancho del local); las mesas, hasta 400.
      const [min, max] = isBar(d.id) ? [40, 1000] : [60, 400];
      next = { ...d.box, w: Math.min(Math.max(snap(d.box.w + dx), min), Math.min(max, W - d.box.x)), h: Math.min(Math.max(snap(d.box.h + dy), min), Math.min(max, H - d.box.y)) };
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
      const moved = <T extends Box & { id: string }>(list: T[]) =>
        list
          .filter((t) => {
            const b = boxes[t.id];
            return b && (b.x !== t.x || b.y !== t.y || b.w !== t.w || b.h !== t.h);
          })
          .map((t) => ({ id: t.id, ...boxes[t.id] }));
      const changed = moved(tables);
      const changedBars = moved(fixtures);
      if (changed.length === 0 && changedBars.length === 0) return setDirty(false);
      const result = await orOffline(saveLayoutAction(changed, changedBars));
      if (result) setError(result);
      else {
        setDirty(false);
        setSaved(true);
      }
    });

  return (
    <div className="grid gap-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ZoneTabs zones={zones} zone={currentZone} onChange={setZone} />
            {addingZone ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = String(new FormData(e.currentTarget).get('zoneName') ?? '').trim().slice(0, 40);
                  if (!name) return;
                  setExtraZones((list) => (list.includes(name) ? list : [...list, name]));
                  setZone(name);
                  setAddingZone(false);
                  setSelectedId(null);
                }}
              >
                <input
                  name="zoneName"
                  autoFocus
                  maxLength={40}
                  placeholder={t('Segundo piso')}
                  aria-label={t('Nombre del piso o zona')}
                  className="h-9 w-40 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground"
                />
                <button type="submit" className="h-9 rounded-full bg-primary px-3.5 text-[13.5px] font-semibold text-primary-foreground">
                  {t('Crear')}
                </button>
                <button type="button" aria-label={t('Cerrar')} onClick={() => setAddingZone(false)} className="grid size-9 place-items-center rounded-full border border-white/[0.12] text-muted-foreground">
                  ×
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setAddingZone(true)} className="rounded-full border border-dashed border-white/[0.2] px-3.5 py-1.5 text-[13.5px] text-muted-foreground hover:text-foreground">
                {t('+ Agregar piso o zona')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={quietButton}
              onClick={() => {
                setPicking(!picking);
                setPicked([]);
                setSelectedId(null);
              }}
            >
              {picking ? t('Terminar selección') : t('Seleccionar varias')}
            </button>
            {dirty ? <span className="text-[13px] text-warning">{t('Cambios sin guardar')}</span> : saved ? <span className="text-[13px] text-success">{t('Plano guardado')}</span> : null}
            <button type="button" className={primaryButton} disabled={!dirty || pending} onClick={save}>
              {pending ? t('Guardando…') : t('Guardar plano')}
            </button>
          </div>
        </div>
        {error ? <Alert>{trx(error)}</Alert> : null}
        {/* Lo que se toca se edita en un cuadro pequeño que flota abajo a la derecha: no tapa el plano.
            Los datos de la mesa van plegados en «Editar»; a la vista solo quedan el nombre, quitar y cerrar. */}
        <div className="fixed bottom-3 right-3 z-30 max-h-[50vh] w-[min(320px,calc(100vw-1.5rem))] overflow-y-auto rounded-[22px] shadow-[0_16px_40px_rgba(0,0,0,0.6)] empty:hidden">
        {picking ? (
          <section className={panel}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-[15px] font-bold">{t('{n} mesas seleccionadas', { n: picked.length })}</h2>
              <CloseButton
                label={t('Cerrar')}
                onClick={() => {
                  setPicking(false);
                  setPicked([]);
                }}
              />
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{t('Toca las mesas que quieres quitar; si tocas una marcada, se desmarca.')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" className={smallButton} onClick={() => setPicked(tables.filter((x) => x.zone === currentZone).map((x) => x.id))}>
                {t('Marcar todas las de esta zona')}
              </button>
              <button type="button" className={smallButton} disabled={!picked.length} onClick={() => setPicked([])}>
                {t('Desmarcar todas')}
              </button>
            </div>
            <ActionForm action={removeTablesAction} onOk={() => setPicked([])} className="mt-3">
              {() => (
                <>
                  {picked.map((id) => (
                    <input key={id} type="hidden" name="tableId" value={id} />
                  ))}
                  <SubmitButton tone="danger" className="w-full" disabled={!picked.length} pendingText={t('Quitando…')}>
                    {t('Quitar {n} mesas', { n: picked.length })}
                  </SubmitButton>
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">{t('Las mesas abiertas no se quitan. El historial se conserva.')}</p>
                </>
              )}
            </ActionForm>
          </section>
        ) : null}
        {selectedBar ? (
          <section className={panel}>
            {/* El error (por ejemplo, «la mesa está abierta») baja a su propia línea. */}
            <ActionForm key={selectedBar.id} action={removeFixtureAction} onOk={() => setSelectedId(null)} className="flex flex-wrap items-center gap-1.5 [&>[role=alert]]:basis-full" showOk={false}>
              {() => (
                <>
                  <h2 className="mr-auto font-display text-[15px] font-bold">{selectedBar.label}</h2>
                  <input type="hidden" name="fixtureId" value={selectedBar.id} />
                  <SubmitButton tone="danger" className="!min-h-0 !px-3 !py-1.5 !text-[13px]" pendingText={t('Quitando…')}>
                    {t('Quitar')}
                  </SubmitButton>
                  <CloseButton label={t('Cerrar')} onClick={() => setSelectedId(null)} />
                </>
              )}
            </ActionForm>
            <details className="group mt-2">
              <summary className="cursor-pointer text-[13px] text-primary">{t('Editar')}</summary>
              <ActionForm key={selectedBar.id} action={updateFixtureAction} className="mt-3 space-y-3">
                {() => (
                  <>
                    <input type="hidden" name="fixtureId" value={selectedBar.id} />
                    <BarFields defaults={selectedBar} />
                    <SubmitButton pendingText={t('Guardando…')}>{t('Guardar barra')}</SubmitButton>
                  </>
                )}
              </ActionForm>
            </details>
          </section>
        ) : null}
        {selected ? (
          <section className={panel}>
            {/* El error (por ejemplo, «la mesa está abierta») baja a su propia línea. */}
            <ActionForm key={selected.id} action={removeTableAction} onOk={() => setSelectedId(null)} className="flex flex-wrap items-center gap-1.5 [&>[role=alert]]:basis-full" showOk={false}>
              {() => (
                <>
                  <h2 className="mr-auto font-display text-[15px] font-bold">{t('Mesa {n}', { n: selected.number })}</h2>
                  <input type="hidden" name="tableId" value={selected.id} />
                  <SubmitButton tone="danger" className="!min-h-0 !px-3 !py-1.5 !text-[13px]" pendingText={t('Quitando…')}>
                    {t('Quitar')}
                  </SubmitButton>
                  <CloseButton label={t('Cerrar')} onClick={() => setSelectedId(null)} />
                </>
              )}
            </ActionForm>
            <details key={selected.id} className="group mt-2">
              <summary className="cursor-pointer text-[13px] text-primary">{t('Editar número, puestos y forma')}</summary>
              <ActionForm action={updateTableAction} className="mt-3 space-y-3">
                {() => (
                  <>
                    <input type="hidden" name="tableId" value={selected.id} />
                    <TableFields defaults={selected} />
                    <CheckField name="isBlocked" label={t('Bloqueada')} hint={t('No se puede abrir (dañada, reservada para un evento…).')} defaultChecked={selected.isBlocked} />
                    <SubmitButton pendingText={t('Guardando…')}>{t('Guardar mesa')}</SubmitButton>
                  </>
                )}
              </ActionForm>
            </details>
          </section>
        ) : null}
        </div>
        <div
          ref={canvas}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerDown={() => setSelectedId(null)}
          className="relative w-full touch-none select-none overflow-hidden rounded-[24px] border border-white/[0.08]"
          style={floorStyle(floorPhoto)}
        >
          <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:4%_6.25%]" />
          {!tables.some((x) => x.zone === currentZone) && !fixtures.some((f) => f.zone === currentZone) ? (
            <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-[14.5px] text-foreground/80">
              {t('{zone} no tiene mesas todavía. Agrégalas abajo, en «Agregar varias mesas».', { zone: currentZone })}
            </p>
          ) : null}
          {fixtures
            .filter((f) => f.zone === currentZone)
            .map((f) => {
              const box = boxes[f.id] ?? { x: f.x, y: f.y, w: f.w, h: f.h };
              return (
                <div key={f.id} onPointerDown={(e) => onPointerDown(e, f.id, 'move')} className="cursor-grab active:cursor-grabbing">
                  <BarShape fixture={{ ...f, ...box }} selected={f.id === selectedId} />
                  {f.id === selectedId ? <ResizeHandle box={box} onPointerDown={(e) => onPointerDown(e, f.id, 'resize')} /> : null}
                </div>
              );
            })}
          {tables
            .filter((t) => t.zone === currentZone)
            .map((t) => {
              const box = boxes[t.id] ?? { x: t.x, y: t.y, w: t.w, h: t.h };
              return (
                <div key={t.id} onPointerDown={(e) => onPointerDown(e, t.id, 'move')} className="cursor-grab active:cursor-grabbing">
                  <TableShape table={{ ...t, ...box }} now={0} selected={t.id === selectedId || picked.includes(t.id)} />
                  {picked.includes(t.id) ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute grid size-6 place-items-center rounded-full bg-destructive text-[14px] font-bold text-white shadow"
                      style={{ left: `${(box.x / W) * 100}%`, top: `${(box.y / H) * 100}%`, transform: 'translate(-30%, -30%)' }}
                    >
                      ✓
                    </span>
                  ) : null}
                  {t.id === selectedId ? <ResizeHandle box={box} onPointerDown={(e) => onPointerDown(e, t.id, 'resize')} /> : null}
                </div>
              );
            })}
        </div>
        <p className="text-[13px] text-muted-foreground">{t('Toca una mesa o la barra para editarla. El punto blanco de la esquina cambia su tamaño.')}</p>
      </div>

      <aside className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Agregar varias mesas')}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('Se numeran solas desde la siguiente libre y quedan acomodadas en filas. Después las arrastras a su sitio.')}</p>
          <ActionForm action={createTablesAction} className="mt-4 space-y-3">
            {() => (
              <>
                <input type="hidden" name="zone" value={currentZone} />
                <div className="grid grid-cols-3 gap-3">
                  <Field label={t('Cuántas')} name="count" type="number" min={1} max={60} required defaultValue={10} />
                  <Field label={t('Puestos')} name="capacity" type="number" min={1} max={40} required defaultValue={4} />
                  <Select label={t('Forma')} name="shape" defaultValue="square">
                    {Object.entries(SHAPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </Select>
                </div>
                <SubmitButton pendingText={t('Agregando…')}>{t('Agregar mesas')}</SubmitButton>
              </>
            )}
          </ActionForm>
        </section>
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Agregar mesa')}</h2>
          <div onInput={(e) => (e.target as HTMLInputElement).name === 'zone' && (newZone.current = (e.target as HTMLInputElement).value.trim())}>
          <ActionForm key={currentZone} action={createTableAction} className="mt-4 space-y-3" resetOnOk onOk={() => newZone.current && setZone(newZone.current)}>
            {(state) => (
              <>
                <TableFields defaults={{ zone: state?.values?.zone ?? currentZone, number: state?.values?.number ?? '', capacity: Number(state?.values?.capacity) || 4, shape: (state?.values?.shape as BoardTable['shape']) ?? 'square' }} />
                <SubmitButton pendingText={t('Agregando…')}>{t('Agregar')}</SubmitButton>
              </>
            )}
          </ActionForm>
          </div>
          <p className="mt-3 text-[12.5px] text-muted-foreground">{t('Para una zona nueva (Terraza, Segundo piso…), escribe su nombre en Zona.')}</p>
        </section>
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Agregar barra')}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('Aparece en el plano para que se parezca al local. Arrástrala a su sitio y estírala con el punto blanco.')}</p>
          <ActionForm action={createFixtureAction} className="mt-4 space-y-3" resetOnOk>
            {() => (
              <>
                <input type="hidden" name="zone" value={currentZone} />
                <BarFields defaults={{ label: t('Barra'), seats: 6, seatSide: 'bottom' }} />
                <SubmitButton pendingText={t('Agregando…')}>{t('Agregar barra')}</SubmitButton>
              </>
            )}
          </ActionForm>
        </section>
        <button type="button" className={`${quietButton} w-full`} onClick={() => setSelectedId(null)} hidden={!selected && !selectedBar}>
          {t('Deseleccionar')}
        </button>
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Quitar todas las mesas')}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('Para volver a armar el plano desde cero. Las mesas abiertas se quedan y el historial se conserva.')}</p>
          <ActionForm action={removeTablesAction} resetOnOk className="mt-4 space-y-3">
            {() => (
              <>
                <input type="hidden" name="scope" value="all" />
                <CheckField name="confirm" label={t('Sí, quiero quitar todas las mesas')} />
                <SubmitButton tone="danger" pendingText={t('Quitando…')}>
                  {t('Quitar todas las mesas')}
                </SubmitButton>
              </>
            )}
          </ActionForm>
        </section>
      </aside>
    </div>
  );
}

function TableFields({ defaults }: { defaults: Pick<BoardTable, 'zone' | 'number' | 'capacity' | 'shape'> }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t('Número')} name="number" required maxLength={12} defaultValue={defaults.number} />
      <Field label={t('Puestos')} name="capacity" type="number" min={1} max={40} required defaultValue={defaults.capacity} />
      <Field label={t('Zona')} name="zone" required maxLength={40} defaultValue={defaults.zone} />
      <Select label={t('Forma')} name="shape" defaultValue={defaults.shape}>
        {Object.entries(SHAPE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {t(label)}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** El punto blanco de la esquina: se arrastra para cambiar el tamaño. */
function ResizeHandle({ box, onPointerDown }: { box: Box; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <span
      role="presentation"
      onPointerDown={onPointerDown}
      className="absolute z-10 size-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-background bg-foreground"
      style={{ left: `${((box.x + box.w) / W) * 100}%`, top: `${((box.y + box.h) / H) * 100}%` }}
    />
  );
}

function BarFields({ defaults }: { defaults: Pick<BoardFixture, 'label' | 'seats' | 'seatSide'> }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t('Nombre')} name="label" maxLength={30} defaultValue={defaults.label} />
      <Field label={t('Sillas altas')} name="seats" type="number" min={0} max={30} required defaultValue={defaults.seats} />
      <div className="col-span-2">
        <Select label={t('Lado de las sillas')} name="seatSide" defaultValue={defaults.seatSide}>
          {(Object.keys(SIDE_LABEL) as (keyof typeof SIDE_LABEL)[]).map((side) => (
            <option key={side} value={side}>
              {t(SIDE_LABEL[side])}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
