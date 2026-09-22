import type { InputHTMLAttributes } from 'react';

export const inputClass =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

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

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string };

export function TextAreaField({ label, hint, id, ...input }: TextAreaProps) {
  const inputId = id ?? input.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea id={inputId} rows={4} className={`${inputClass} resize-y`} {...input} />
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
};

export function SelectField({ label, options, id, ...input }: SelectProps) {
  const inputId = id ?? input.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <select id={inputId} className={inputClass} {...input}>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#0a131a]">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckField({ label, hint, ...input }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
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
