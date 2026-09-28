'use client';

import { useActionState, useEffect, useState } from 'react';
import { punchAction } from '@/app/actions';
import { t, type Lang } from '@/lib/i18n';
import { formatClock, formatMinutes } from '@/lib/report';
import { Alert, Lion } from './ui';
import { SubmitButton } from './submit-button';

type Employee = { id: string; name: string; hasPin: boolean };

const pinClass =
  'mx-auto block w-48 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center font-display text-[36px] tracking-[0.5em] text-foreground transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

function PinInput({ id, name, label, autoFocus }: { id: string; name: string; label: string; autoFocus?: boolean }) {
  return (
    <div className="space-y-2 text-center">
      <label htmlFor={id} className="block text-[16px] font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{4}"
        maxLength={4}
        required
        autoFocus={autoFocus}
        className={pinClass}
      />
    </div>
  );
}

/**
 * En el celular del empleado: toca su nombre y escribe su PIN (o lo crea, la primera vez). El celular
 * recuerda el nombre para la próxima.
 */
export function PunchForm({ slug, code, employees, lang }: { slug: string; code: string; employees: Employee[]; lang: Lang }) {
  const [state, action] = useActionState(punchAction, undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const storageKey = `asistencia:${slug}:empleado`;

  // El nombre elegido la última vez en este celular (solo es una comodidad: el PIN sigue haciendo falta).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && employees.some((e) => e.id === saved)) setSelectedId(saved);
    } catch {
      // Sin almacenamiento del navegador: se elige el nombre cada vez.
    }
  }, [storageKey, employees]);

  const choose = (id: string | null) => {
    setSelectedId(id);
    try {
      if (id) localStorage.setItem(storageKey, id);
      else localStorage.removeItem(storageKey);
    } catch {
      // Igual que arriba.
    }
  };

  const result = state?.result;
  if (result) {
    const isIn = result.type === 'in';
    return (
      <div className="rise space-y-4 text-center" role="status">
        <div className="relative mx-auto w-fit">
          <Lion size={96} alt={t(lang, 'lionAlt')} />
          <span
            className={`absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full text-[18px] font-bold ring-4 ring-card ${isIn ? 'bg-success text-primary-foreground' : 'bg-primary text-primary-foreground'}`}
            aria-hidden="true"
          >
            {isIn ? '→' : '←'}
          </span>
        </div>
        <p className="font-display text-[26px] font-bold text-foreground">{isIn ? t(lang, 'entryRecorded') : t(lang, 'exitRecorded')}</p>
        <p className="text-[17px] text-muted-foreground">
          {isIn ? t(lang, 'helloShift', { name: result.employeeName }) : t(lang, 'goodbye', { name: result.employeeName })}
        </p>
        <p className="font-display text-[44px] font-semibold tabular-nums text-foreground">{formatClock(new Date(result.at), lang)}</p>
        {result.workedMinutes !== null ? (
          <p className="text-[16px] text-muted-foreground">{t(lang, 'youWorked', { time: formatMinutes(result.workedMinutes) })}</p>
        ) : null}
        {result.pinCreated ? (
          <p className="rounded-2xl bg-success/10 px-4 py-3 text-[14px] text-[#9df0c6]">{t(lang, 'pinSavedNote')}</p>
        ) : null}
        <p className="pt-2 text-[14px] text-muted-foreground">{t(lang, 'closePage')}</p>
      </div>
    );
  }

  if (state?.code === 'CODE_EXPIRED') {
    return (
      <div className="space-y-4 text-center">
        <Alert>{state.error}</Alert>
      </div>
    );
  }

  const selected = employees.find((e) => e.id === selectedId);

  if (!selected) {
    if (employees.length === 0) {
      return <p className="text-center text-[15px] text-muted-foreground">{t(lang, 'noEmployeesYet')}</p>;
    }
    return (
      <div className="space-y-4">
        <p className="text-center text-[17px] font-medium text-foreground">{t(lang, 'tapYourName')}</p>
        <ul className="grid gap-2">
          {employees.map((employee) => (
            <li key={employee.id}>
              <button
                type="button"
                onClick={() => choose(employee.id)}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-left text-[16px] text-foreground transition hover:border-primary/50 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                {employee.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const creating = !selected.hasPin;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="employeeId" value={selected.id} />
      {creating ? <input type="hidden" name="creating" value="1" /> : null}

      <div className="text-center">
        <p className="font-display text-[20px] font-semibold text-foreground">{selected.name}</p>
        <button type="button" onClick={() => choose(null)} className="mt-1 text-[14px] text-primary hover:underline">
          {t(lang, 'notMe')}
        </button>
      </div>

      {creating ? (
        <>
          <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-center text-[14px] text-muted-foreground">
            {t(lang, 'firstTimeNote')}
          </p>
          <PinInput id="pin" name="pin" label={t(lang, 'createPin')} autoFocus />
          <PinInput id="pinConfirm" name="pinConfirm" label={t(lang, 'repeatPin')} />
        </>
      ) : (
        <PinInput id="pin" name="pin" label={t(lang, 'enterPin')} autoFocus />
      )}

      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText={t(lang, 'punching')}>{creating ? t(lang, 'savePinAndPunch') : t(lang, 'punch')}</SubmitButton>
      {creating ? null : <p className="text-center text-[13px] text-muted-foreground">{t(lang, 'forgotPin')}</p>}
    </form>
  );
}
