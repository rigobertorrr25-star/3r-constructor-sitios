'use client';

import { useRef, useState, type ReactNode } from 'react';
import { UploadIcon } from '@/components/icons';
import { inputClass } from '@/components/field';
import { UploadError, uploadMedia } from '@/lib/upload';

const label = 'text-[12px] font-medium text-muted-foreground';

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-white/[0.06] py-4 first:pt-0 last:border-b-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

const small = `${inputClass} !rounded-xl !px-3 !py-2 !text-[14px]`;

export function TextControl({
  name,
  value,
  onChange,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`ctl-${name}`} className={label}>
        {name}
      </label>
      <input id={`ctl-${name}`} className={small} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Botón para subir un archivo desde el computador; llena el campo de dirección (URL) al terminar. */
export function UploadControl({ accept, onUploaded }: { accept: string; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState('');

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState('uploading');
    setError('');
    try {
      onUploaded(await uploadMedia(file));
      setState('idle');
    } catch (err) {
      setState('error');
      setError(err instanceof UploadError ? err.message : 'No se pudo subir el archivo. Inténtalo otra vez.');
    }
  };

  return (
    <div className="space-y-1.5">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === 'uploading'}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[13px] text-foreground transition hover:bg-white/[0.06] disabled:opacity-60"
      >
        <UploadIcon size={14} />
        {state === 'uploading' ? 'Subiendo…' : 'Subir desde tu computador'}
      </button>
      {state === 'error' ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}

export function TextAreaControl({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`ctl-${name}`} className={label}>
        {name}
      </label>
      <textarea id={`ctl-${name}`} rows={4} className={`${small} resize-y`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function NumberControl({
  name,
  value,
  onChange,
  min = 0,
  max = 1000,
  unit,
  hint,
  onReset,
}: {
  name: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  unit?: string;
  hint?: string;
  onReset?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={`ctl-${name}`} className={label}>
          {name}
          {hint ? <span className="ml-1.5 text-white/40">{hint}</span> : null}
        </label>
        {onReset ? (
          <button type="button" onClick={onReset} className="text-[11px] text-primary hover:underline">
            Restablecer
          </button>
        ) : null}
      </div>
      <div className="relative">
        <input
          id={`ctl-${name}`}
          type="number"
          min={min}
          max={max}
          className={`${small} ${unit ? 'pr-10' : ''}`}
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(undefined);
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        {unit ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

export function ColorControl({ name, value, onChange, fallback = '#000000' }: { name: string; value: string | undefined; onChange: (value: string | undefined) => void; fallback?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`ctl-${name}`} className={label}>
        {name}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${name} (selector)`}
          className="size-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
          value={value && HEX.test(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={`ctl-${name}`}
          className={small}
          value={value ?? ''}
          placeholder="#000000"
          maxLength={9}
          onChange={(e) => onChange(e.target.value.trim() || undefined)}
        />
      </div>
    </div>
  );
}

export function SelectControl<T extends string | number>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`ctl-${name}`} className={label}>
        {name}
      </label>
      <select
        id={`ctl-${name}`}
        className={small}
        value={value ?? ''}
        onChange={(e) => {
          const chosen = options.find((o) => String(o.value) === e.target.value);
          if (chosen) onChange(chosen.value);
        }}
      >
        {value === undefined && <option value="">—</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={o.value} className="bg-[#0a131a]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AlignControl({ value, onChange }: { value: 'left' | 'center' | 'right' | undefined; onChange: (value: 'left' | 'center' | 'right') => void }) {
  const options = [
    { value: 'left', label: 'Izquierda' },
    { value: 'center', label: 'Centro' },
    { value: 'right', label: 'Derecha' },
  ] as const;
  return (
    <div className="space-y-1.5">
      <span className={label}>Alineación</span>
      <div role="group" aria-label="Alineación" className="grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={(value ?? 'left') === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-2 py-1.5 text-[12px] transition ${(value ?? 'left') === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
