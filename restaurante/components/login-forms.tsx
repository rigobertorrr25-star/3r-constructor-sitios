'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { adminLoginAction, goToBusinessAction, loginPeopleAction, staffLoginAction } from '@/app/actions';
import { ROLE_LABEL, type Role } from '@/lib/permissions';
import { backgroundUrl } from '@/lib/background-url';
import { BackgroundLayer } from './background-forms';
import { useT } from './i18n';
import { SubmitButton } from './submit-button';
import { Alert, Field, inputClass } from './ui';

export function FindBusinessForm() {
  const [state, action] = useActionState(goToBusinessAction, undefined);
  const t = useT();
  return (
    <form action={action} className="space-y-4">
      <Field label={t('Tu negocio')} name="slug" placeholder={t('por ejemplo: azul-caribe')} autoCapitalize="none" required defaultValue={state?.values?.slug} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full" pendingText={t('Un momento…')}>{t('Continuar')}</SubmitButton>
    </form>
  );
}

type Person = { code: string; name: string; role: Role };

/** Portada: se escoge el restaurante, luego la persona toca su nombre y pone su PIN. */
export function RestaurantLogin({ businesses, initialSlug, initialPeople }: { businesses: { name: string; slug: string; background: number | null }[]; initialSlug: string; initialPeople: Person[] | null }) {
  const [slug, setSlug] = useState(initialSlug);
  const [people, setPeople] = useState<Person[] | null>(initialPeople);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(initialSlug);
  const t = useT();

  const choose = async (next: string) => {
    latest.current = next;
    setSlug(next);
    setPeople(null);
    setFailed(false);
    if (!next) return;
    setLoading(true);
    const list = await loginPeopleAction(next).catch(() => null);
    // Si mientras tanto escogieron otro restaurante, se ignora esta respuesta.
    if (latest.current !== next) return;
    setLoading(false);
    setPeople(list);
    setFailed(list === null);
  };

  const chosen = businesses.find((b) => b.slug === slug);

  return (
    <div className="space-y-5">
      <BackgroundLayer url={chosen ? backgroundUrl(chosen.slug, chosen.background) : null} />
      <div>
        <label htmlFor="restaurante" className="text-sm font-medium text-foreground">
          {t('Restaurante')}
        </label>
        <select id="restaurante" value={slug} onChange={(e) => choose(e.target.value)} className={`${inputClass} mt-1.5 text-[16px]`}>
          <option value="" disabled>
            {t('Escoge tu restaurante')}
          </option>
          {businesses.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      {loading ? <p className="text-[14.5px] text-muted-foreground">{t('Cargando el equipo…')}</p> : null}
      {failed ? <Alert>{t('No pudimos cargar el equipo. Revisa la conexión y vuelve a escoger el restaurante.')}</Alert> : null}
      {slug && people ? <StaffLoginForm key={slug} slug={slug} people={people} /> : null}
    </div>
  );
}

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLoginAction, undefined);
  const t = useT();
  return (
    <form action={action} className="space-y-4">
      <Field label={t('Clave de 3R')} name="password" type="password" autoComplete="current-password" required />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full" pendingText={t('Entrando…')}>{t('Entrar')}</SubmitButton>
    </form>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Ingreso del equipo: la persona toca su nombre y pone su PIN con teclado grande (sirve en tablet y celular). */
export function StaffLoginForm({ slug, people }: { slug: string; people: Person[] }) {
  const [state, action] = useActionState(staffLoginAction, undefined);
  const [person, setPerson] = useState<Person | null>(null);
  const [pin, setPin] = useState('');
  const [lastState, setLastState] = useState(state);
  const t = useT();

  // Si hubo error, se vuelve a pedir el PIN de la misma persona.
  if (state !== lastState) {
    setLastState(state);
    if (state?.error) {
      setPin('');
      const again = people.find((p) => p.code === state.values?.code);
      if (again) setPerson(again);
    }
  }

  const press = (key: string) => {
    if (key === '⌫') setPin((v) => v.slice(0, -1));
    else if (key) setPin((v) => (v.length < 6 ? v + key : v));
  };

  // También con el teclado del computador: números, borrar, Enter y Escape (volver a la lista).
  const formRef = useRef<HTMLFormElement>(null);
  const pressRef = useRef(press);
  pressRef.current = press;
  const choosing = !person;
  useEffect(() => {
    if (choosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === 'Backspace') pressRef.current('⌫');
      else if (e.key === 'Enter') formRef.current?.requestSubmit();
      else if (e.key === 'Escape') (setPerson(null), setPin(''));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choosing]);

  if (state?.locations && person) {
    return (
      <form action={action} className="space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="code" value={person.code} />
        <input type="hidden" name="pin" value={pin} />
        <p className="text-[15px] text-muted-foreground">{t('{name}, ¿en qué sede vas a trabajar hoy?', { name: person.name })}</p>
        {state.locations.map((l) => (
          <button
            key={l.id}
            name="locationId"
            value={l.id}
            className="w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-5 py-4 text-left font-display text-[17px] font-semibold text-foreground transition hover:border-primary/60 hover:bg-primary/10"
          >
            {l.name}
          </button>
        ))}
      </form>
    );
  }

  if (!person) {
    if (people.length === 0) return <p className="text-[15px] text-muted-foreground">{t('Este restaurante todavía no tiene personas activas. El dueño las crea en Equipo.')}</p>;
    return (
      <div>
        <p className="text-sm font-medium text-foreground">{t('¿Quién eres?')}</p>
        <div className="mt-2 grid max-h-[420px] grid-cols-2 gap-2.5 overflow-y-auto">
          {people.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => (setPerson(p), setPin(''))}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3.5 text-left transition hover:border-primary/60 hover:bg-primary/10 active:scale-[0.98]"
            >
              <span className="block break-words font-display text-[16px] font-semibold leading-snug text-foreground">{p.name}</span>
              <span className="block text-[12.5px] text-muted-foreground">{t(ROLE_LABEL[p.role])}</span>
            </button>
          ))}
        </div>
        {state?.error ? <div className="mt-3"><Alert>{state.error}</Alert></div> : null}
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="code" value={person.code} />
      <input type="hidden" name="pin" value={pin} />
      <div>
        <p className="text-sm font-medium text-foreground">{t('PIN de {name}', { name: person.name })}</p>
        <div
          aria-live="polite"
          aria-label={t('PIN: {n} números', { n: pin.length })}
          className="mt-1.5 flex h-[60px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] font-display text-[28px] tracking-[0.4em] text-foreground"
        >
          {'•'.repeat(pin.length) || <span className="text-[15px] tracking-normal text-muted-foreground/70">{t('4 a 6 números')}</span>}
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {t('¿No eres {name}?', { name: person.name })}{' '}
          <button type="button" className="text-primary hover:underline" onClick={() => (setPerson(null), setPin(''))}>
            {t('Escoger otro nombre')}
          </button>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((key, i) =>
          key ? (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              aria-label={key === '⌫' ? t('Borrar') : key}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] py-4 font-display text-[22px] font-semibold text-foreground transition active:scale-95 active:bg-white/[0.08]"
            >
              {key}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full py-3.5 text-[16px]" pendingText={t('Entrando…')}>
        {t('Entrar')}
      </SubmitButton>
    </form>
  );
}
