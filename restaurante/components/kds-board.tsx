'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { moveTicketAction } from '@/app/actions';
import { orOffline } from '@/lib/offline';
import { elapsedMinutes, formatElapsed, formatTime } from '@/lib/format';
import type { KdsTicket, TicketStatus } from '@/lib/kds';
import { useNow } from './table-board';
import { Alert, quietButton } from './ui';
import { useLang, useT, useTr } from './i18n';

type Ticket = Omit<KdsTicket, 'sentAt' | 'startedAt' | 'readyAt'> & { sentAt: string; startedAt: string | null; readyAt: string | null };

/** Minutos desde que llegó la comanda: amarillo a los 15, rojo a los 25. */
const WARN_MINUTES = 15;
const LATE_MINUTES = 25;

const COLUMNS: { status: TicketStatus; title: string; next: TicketStatus; action: string }[] = [
  { status: 'sent', title: 'Nuevas', next: 'preparing', action: 'Empezar' },
  { status: 'preparing', title: 'Preparando', next: 'ready', action: 'Lista' },
  { status: 'ready', title: 'Listas para llevar', next: 'delivered', action: 'Entregada' },
];
const PREVIOUS: Record<TicketStatus, TicketStatus | null> = { sent: null, preparing: 'sent', ready: 'preparing', delivered: 'ready' };

/** Un pitido corto con el navegador (sin archivos de sonido). */
function beep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    // Sin sonido disponible: la pantalla igual muestra la comanda.
  }
}

export function KdsBoard({ title, tickets, timeZone }: { title: string; tickets: Ticket[]; timeZone: string }) {
  const now = useNow(10_000);
  const t = useT();
  const lang = useLang();
  const trx = useTr();
  const [sound, setSound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seen = useRef<Set<string> | null>(null);

  // Suena cuando llega una comanda que esta pantalla no había visto.
  useEffect(() => {
    const ids = new Set(tickets.filter((t) => t.status === 'sent').map((t) => t.id));
    if (seen.current && sound && [...ids].some((id) => !seen.current!.has(id))) beep();
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [tickets, sound]);

  const move = (id: string, to: TicketStatus) =>
    start(async () => {
      setError(null);
      const result = await orOffline(moveTicketAction(id, to));
      if (result) setError(result);
    });

  const delivered = tickets.filter((t) => t.status === 'delivered');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-bold">{title}</h1>
        <button
          type="button"
          className={quietButton}
          aria-pressed={sound}
          onClick={() => {
            if (!sound) beep();
            setSound(!sound);
          }}
        >
          {sound ? `🔔 ${t('Sonido activado')}` : `🔕 ${t('Activar sonido')}`}
        </button>
      </div>
      {error ? <Alert>{trx(error)}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = tickets.filter((t) => t.status === col.status);
          return (
            <section key={col.status} aria-label={t(col.title)} className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-muted-foreground">
                {t(col.title)}
                <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[13px] text-foreground">{list.length}</span>
              </h2>
              {list.length === 0 ? <p className="rounded-[20px] border border-dashed border-white/[0.1] px-4 py-6 text-center text-[14px] text-muted-foreground">{t('Nada aquí.')}</p> : null}
              {list.map((tk) => {
                const minutes = elapsedMinutes(tk.sentAt, now);
                const tone = tk.status === 'ready' ? 'border-success/50' : minutes >= LATE_MINUTES ? 'border-destructive/70' : minutes >= WARN_MINUTES ? 'border-warning/70' : 'border-white/[0.1]';
                const allVoided = tk.items.every((i) => i.voided);
                const previous = PREVIOUS[tk.status];
                return (
                  <article key={tk.id} className={`rounded-[22px] border-2 bg-card p-4 shadow-[var(--shadow-glass)] ${tone}`}>
                    <header className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-[24px] font-bold leading-none">{t('Mesa {n}', { n: tk.tableNumber })}</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {t('Ronda {n}', { n: tk.roundNumber })} · {tk.sentBy} · {formatTime(tk.sentAt, timeZone, lang)}
                        </p>
                      </div>
                      <span className={`font-display text-[18px] font-bold ${minutes >= LATE_MINUTES && tk.status !== 'ready' ? 'text-[#ffb4b5]' : ''}`}>{formatElapsed(minutes)}</span>
                    </header>
                    <ul className="mt-3 space-y-1.5">
                      {tk.items.map((i) => (
                        <li key={i.id} className={i.voided ? 'text-muted-foreground line-through' : ''}>
                          <span className="text-[18px] font-semibold">
                            {i.quantity} × {i.name}
                          </span>
                          {i.voided ? <span className="ml-2 text-[12px] font-semibold uppercase text-[#ffb4b5] no-underline">{t('Anulado')}</span> : null}
                          {i.notes ? <span className="block text-[15px] font-medium text-warning">→ {i.notes}</span> : null}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => move(tk.id, allVoided ? 'delivered' : col.next)}
                        className="flex-1 rounded-full bg-primary px-4 py-3 text-[16px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
                      >
                        {allVoided ? t('Entendido (anulada)') : t(col.action)}
                      </button>
                      {previous ? (
                        <button type="button" disabled={pending} onClick={() => move(tk.id, previous)} className={quietButton} aria-label={t('Deshacer: devolver un paso')}>
                          ↶
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      {delivered.length > 0 ? (
        <details className="rounded-[20px] border border-white/[0.08] bg-card px-5 py-3">
          <summary className="cursor-pointer text-[14px] text-muted-foreground">{t('Entregadas en la última hora ({n})', { n: delivered.length })}</summary>
          <ul className="mt-3 space-y-2">
            {delivered.map((tk) => (
              <li key={tk.id} className="flex items-center justify-between gap-3 text-[14px]">
                <span>
                  {t('Mesa {n} · ronda {round}', { n: tk.tableNumber, round: tk.roundNumber })} · {tk.items.filter((i) => !i.voided).map((i) => `${i.quantity} × ${i.name}`).join(', ')}
                </span>
                <button type="button" disabled={pending} onClick={() => move(tk.id, 'ready')} className={quietButton}>
                  ↶ {t('No se entregó')}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
