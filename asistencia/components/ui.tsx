import Image from 'next/image';
import type { InputHTMLAttributes, ReactNode } from 'react';

/** Tarjeta de vidrio claro (letras oscuras). */
export const card = 'rounded-[28px] border border-white/60 bg-white/55 p-4 shadow-[var(--shadow-glass)] backdrop-blur-xl sm:p-6';

/** Vidrio oscuro para lo que va directo sobre el fondo azul (menú lateral, barra de arriba). */
export const glassDark = 'rounded-[24px] border border-white/15 bg-white/[0.08] text-white backdrop-blur-xl';

/** Botón oscuro, el principal de cada pantalla. */
export const darkButton =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[var(--ink)] px-4 py-2 text-[14px] font-medium text-white transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

/** Botón de vidrio sobre el fondo azul. */
export const onDarkButton =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[14px] text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60';

export const quietButton =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/70 bg-white/50 px-4 py-2 text-[14px] text-foreground transition hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

export const inputClass =
  'w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

/** El león de 3R, en círculo. */
export function Lion({ size = 44, className = '', alt = 'León de 3R' }: { size?: number; className?: string; alt?: string }) {
  return (
    <Image
      src="/avatar-lion.jpg"
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ring-1 ring-black/10 ${className}`}
      priority
    />
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string };

export function Field({ label, hint, id, ...input }: FieldProps) {
  const inputId = id ?? input.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input id={inputId} className={inputClass} {...input} />
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CheckField({ label, hint, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/70 bg-white/50 p-4 transition hover:bg-white/70">
      <input type="checkbox" className="mt-1 size-4 accent-[#4f5ee8]" {...input} />
      <span>
        <span className="block text-[14.5px] font-medium text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-[13px] text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'ok' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'
          : 'rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success'
      }
    >
      {children}
    </p>
  );
}
