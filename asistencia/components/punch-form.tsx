'use client';

import { useActionState, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { punchAction } from '@/app/actions';
import { t, type Lang, type MessageKey } from '@/lib/i18n';
import { formatClock, formatMinutes, type PunchMood } from '@/lib/report';
import { Alert, Lion } from './ui';
import { SubmitButton } from './submit-button';

type Employee = { id: string; name: string; hasPin: boolean; avatar: string };


/** Mensajes chistosos según cómo llegó o salió; se elige uno al azar. */
const MOOD_KEYS: Record<PunchMood, MessageKey[]> = {
  late: ['moodLate1', 'moodLate2', 'moodLate3', 'moodLate4'],
  early: ['moodEarly1', 'moodEarly2', 'moodEarly3'],
  onTime: ['moodOnTime1', 'moodOnTime2', 'moodOnTime3'],
  leftEarly: ['moodLeftEarly1', 'moodLeftEarly2'],
  overtime: ['moodOvertime1', 'moodOvertime2'],
  onTimeOut: ['moodOnTimeOut1', 'moodOnTimeOut2'],
};

/**
 * Cuatro cuadritos para el PIN (como un código de verificación): el que sigue se ilumina y cada número queda
 * como un punto. Por debajo es un solo campo invisible, así el teclado numérico del celular funciona normal.
 */
function PinBoxes({
  id,
  name,
  label,
  value,
  onChange,
  inputRef,
  autoFocus,
  merging,
  shake,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  merging: boolean;
  shake: number;
}) {
  const [focused, setFocused] = useState(false);
  const done = value.length === 4;
  return (
    <div className="space-y-3 text-center">
      <label htmlFor={id} className="block text-[16px] font-medium text-foreground">
        {label}
      </label>
      <div key={shake} className={`relative mx-auto flex w-fit gap-3 ${shake ? 'pin-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => {
          const filled = i < value.length;
          const current = focused && !done && i === value.length;
          return (
            <div
              key={i}
              aria-hidden="true"
              style={{ '--i': i } as CSSProperties}
              className={`pin-box ${current ? 'pin-box-active' : ''} ${filled ? 'pin-box-filled' : ''} ${done ? 'pin-box-done' : ''} ${merging ? 'pin-box-merge' : ''}`}
            >
              {filled ? <span className="pin-dot" /> : current ? <span className="pin-caret" /> : null}
            </div>
          );
        })}
        {merging ? <span className="pin-spinner" aria-hidden="true" /> : null}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4}"
          maxLength={4}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>
    </div>
  );
}

/** Los cuadritos del PIN, el aviso de error y el botón; mientras verifica, los cuadros se juntan y giran. */
function PinArea({
  creating,
  lang,
  error,
  errorCount,
}: {
  creating: boolean;
  lang: Lang;
  error?: string;
  errorCount: number;
}) {
  const { pending } = useFormStatus();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  // Si el PIN no sirvió, se borran los cuadros y vuelve al primero (con una sacudida).
  useEffect(() => {
    if (!errorCount) return;
    setPin('');
    setConfirm('');
    pinRef.current?.focus();
  }, [errorCount]);

  // Con los 4 números listos se marca solo, tras un instante para que se vea el recorrido de los bordes.
  const submitSoon = (input: HTMLInputElement | null) => setTimeout(() => input?.form?.requestSubmit(), 350);

  return (
    <>
      {creating ? (
        <>
          <p className="rounded-2xl bg-white/50 px-4 py-3 text-center text-[14px] text-muted-foreground">{t(lang, 'firstTimeNote')}</p>
          <PinBoxes
            id="pin"
            name="pin"
            label={t(lang, 'createPin')}
            value={pin}
            inputRef={pinRef}
            autoFocus
            merging={pending}
            shake={errorCount}
            onChange={(value) => {
              setPin(value);
              if (value.length === 4) setTimeout(() => confirmRef.current?.focus(), 200);
            }}
          />
          <PinBoxes
            id="pinConfirm"
            name="pinConfirm"
            label={t(lang, 'repeatPin')}
            value={confirm}
            inputRef={confirmRef}
            merging={pending}
            shake={errorCount}
            onChange={(value) => {
              setConfirm(value);
              if (value.length === 4 && pin.length === 4) submitSoon(confirmRef.current);
            }}
          />
        </>
      ) : (
        <PinBoxes
          id="pin"
          name="pin"
          label={t(lang, 'enterPin')}
          value={pin}
          inputRef={pinRef}
          autoFocus
          merging={pending}
          shake={errorCount}
          onChange={(value) => {
            setPin(value);
            if (value.length === 4) submitSoon(pinRef.current);
          }}
        />
      )}
      {pending ? <p className="text-center text-[14px] text-muted-foreground">{t(lang, 'verifyingPin')}</p> : null}
      {error && !pending ? <Alert>{error}</Alert> : null}
      <SubmitButton pendingText={t(lang, 'punching')}>{creating ? t(lang, 'savePinAndPunch') : t(lang, 'punch')}</SubmitButton>
    </>
  );
}

/**
 * En el celular del empleado: toca su nombre y escribe su PIN (o lo crea, la primera vez). El celular
 * recuerda el nombre para la próxima.
 */
export function PunchForm({ slug, code, employees, lang }: { slug: string; code: string; employees: Employee[]; lang: Lang }) {
  const [state, action] = useActionState(punchAction, undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Cuántos errores van (para borrar y sacudir los cuadros) y cuál mensaje chistoso toca (al azar).
  const [errorCount, setErrorCount] = useState(0);
  const [moodPick] = useState(() => Math.floor(Math.random() * 12));
  useEffect(() => {
    if (state?.error) setErrorCount((n) => n + 1);
  }, [state]);
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
    const marked = employees.find((e) => e.id === selectedId);
    const moodKeys = result.mood ? MOOD_KEYS[result.mood.mood] : null;
    const moodKey = moodKeys ? moodKeys[moodPick % moodKeys.length] : null;
    const moodTone = result.mood?.mood === 'late' || result.mood?.mood === 'leftEarly' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success';
    return (
      <div className="relative text-center" role="status">
        <div aria-hidden="true" className="success-glow pointer-events-none absolute -inset-4 rounded-[28px] sm:-inset-6" />
        <div className="relative space-y-4">
          <div className="success-badge mx-auto">
            <svg viewBox="0 0 24 24" className="size-9" aria-hidden="true">
              <path d="M6 12.5l4 4 8-9" className="check-draw" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="rise font-display text-[26px] font-bold text-foreground">{isIn ? t(lang, 'entryRecorded') : t(lang, 'exitRecorded')}</p>
          <div className="rise flex items-center justify-center gap-3">
            {marked ? (
              // eslint-disable-next-line @next/next/no-img-element -- dibujo SVG propio
              <img src={marked.avatar} alt="" width={48} height={48} className="size-12 rounded-full ring-1 ring-black/[0.06]" />
            ) : (
              <Lion size={48} alt={t(lang, 'lionAlt')} />
            )}
            <p className="text-[17px] text-foreground/80">
              {isIn ? t(lang, 'helloShift', { name: result.employeeName }) : t(lang, 'goodbye', { name: result.employeeName })}
            </p>
          </div>
          <p className="rise font-display text-[44px] font-semibold tabular-nums text-foreground">{formatClock(new Date(result.at), lang)}</p>
          {moodKey ? (
            <p className={`mood-pop mx-auto max-w-[320px] rounded-2xl px-4 py-3 text-[16px] font-medium ${moodTone}`}>
              {t(lang, moodKey, { time: formatMinutes(result.mood?.minutes ?? 0) })}
            </p>
          ) : null}
          {result.workedMinutes !== null ? (
            <p className="text-[16px] text-muted-foreground">{t(lang, 'youWorked', { time: formatMinutes(result.workedMinutes) })}</p>
          ) : null}
          {result.pinCreated ? (
            <p className="rounded-2xl bg-success/10 px-4 py-3 text-[14px] text-success">{t(lang, 'pinSavedNote')}</p>
          ) : null}
          <p className="pt-2 text-[14px] text-muted-foreground">{t(lang, 'closePage')}</p>
        </div>
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
        <p className="text-[17px] font-medium text-foreground">{t(lang, 'tapYourName')}</p>
        <ul className="grid gap-2">
          {employees.map((employee) => (
            <li key={employee.id}>
              <button
                type="button"
                onClick={() => choose(employee.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/70 bg-white/50 px-3 py-3 text-left text-[16px] text-foreground transition hover:border-primary/50 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- dibujo SVG propio */}
                <img src={employee.avatar} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full ring-1 ring-black/[0.06]" />
                <span className="flex-1">{employee.name}</span>
                <span aria-hidden="true" className="text-muted-foreground">›</span>
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

      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- dibujo SVG propio */}
        <img src={selected.avatar} alt="" width={96} height={96} className="mb-3 size-24 rounded-full ring-1 ring-black/[0.06]" />
        <p className="font-display text-[20px] font-semibold text-foreground">{selected.name}</p>
        <button type="button" onClick={() => choose(null)} className="mt-1 text-[14px] text-primary hover:underline">
          {t(lang, 'notMe')}
        </button>
      </div>

      <PinArea creating={creating} lang={lang} error={state?.error} errorCount={errorCount} />
      {creating ? null : <p className="text-center text-[13px] text-muted-foreground">{t(lang, 'forgotPin')}</p>}
    </form>
  );
}
