import Image from 'next/image';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

export const quietButton =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/[0.1] px-4 py-2 text-[14px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:opacity-50';

export const primaryButton =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 py-2.5 text-[14.5px] font-medium text-primary-foreground transition duration-300 ease-[var(--ease-emphasized)] hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-wait disabled:opacity-60';

export const dangerButton =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-destructive/40 px-4 py-2 text-[14px] text-[#ffb4b5] transition hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:opacity-50';

export const inputClass =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

/** El león de 3R, en círculo. Quien lo usa le pasa `alt` ya traducido: t('León de 3R'). */
export function Lion({ size = 44, className = '', alt = 'León de 3R' }: { size?: number; className?: string; alt?: string }) {
  return <Image src="/avatar-lion.jpg" alt={alt} width={size} height={size} className={`rounded-full ring-1 ring-white/10 ${className}`} priority />;
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

export function TextArea({ label, hint, id, ...input }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const inputId = id ?? input.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea id={inputId} className={`${inputClass} min-h-20`} {...input} />
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Select({ label, hint, id, children, ...input }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  const inputId = id ?? input.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <select id={inputId} className={`${inputClass} appearance-none`} {...input}>
        {children}
      </select>
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CheckField({ label, hint, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-white/[0.16]">
      <input type="checkbox" className="mt-1 size-4 accent-[#8a9bff]" {...input} />
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
          ? 'rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[#ffb4b5]'
          : 'rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-[#9df0c6]'
      }
    >
      {children}
    </p>
  );
}

export function PageTitle({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-foreground sm:text-[30px]">{title}</h1>
        {text ? <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">{text}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[24px] border border-dashed border-white/[0.12] px-6 py-10 text-center text-[15px] text-muted-foreground">{children}</p>;
}
