import type { ReactNode } from 'react';
import {
  PAYMENT_DOT,
  PAYMENT_LABEL,
  PROGRESS_STEPS,
  STATUS_DOT,
  STATUS_LABEL,
  formatDateTime,
} from '@/lib/orders';
import type { OrderEvent, OrderStatus, PaymentStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[13px] text-foreground">
      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[13px] text-foreground">
      <span className={`size-2 rounded-full ${PAYMENT_DOT[status]}`} aria-hidden="true" />
      {PAYMENT_LABEL[status]}
    </span>
  );
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'ok' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[#ffb4b5]'
          : 'rounded-2xl border border-[#5ee0a0]/30 bg-[#5ee0a0]/10 px-4 py-3 text-sm text-[#9df0c6]'
      }
    >
      {children}
    </p>
  );
}

export const card = 'rounded-[32px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

/** Avance del pedido en 5 pasos. Un pedido cancelado no muestra avance. */
export function Progress({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null;
  const current = PROGRESS_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Avance del pedido">
      {PROGRESS_STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step} aria-current={i === current ? 'step' : undefined} className="min-w-0">
            <div className={`h-1.5 rounded-full ${done ? 'bg-primary' : 'bg-white/[0.08]'}`} />
            <p className={`mt-2 text-[12px] leading-tight ${i === current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
              {STATUS_LABEL[step]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Historial del pedido. Los mensajes se ven como chat; el resto, como avisos del sistema. */
export function Timeline({ events, viewer }: { events: OrderEvent[]; viewer: 'client' | 'admin' }) {
  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const isChat = event.kind === 'message' || event.kind === 'note';
        if (!isChat) {
          return (
            <li key={event.id} className="flex items-start gap-3 text-[13.5px] text-muted-foreground">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-white/30" aria-hidden="true" />
              <div>
                <span className="text-foreground">{event.body}</span>
                <span className="ml-2 text-[12px]">{formatDateTime(event.createdAt)}</span>
              </div>
            </li>
          );
        }
        const mine = viewer === 'admin' ? event.fromTeam : !event.fromTeam;
        const internal = event.kind === 'note';
        return (
          <li key={event.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-[20px] px-4 py-3 text-[14.5px] leading-relaxed ${
                internal
                  ? 'border border-dashed border-[#f7cb58]/40 bg-[#f7cb58]/10 text-foreground'
                  : mine
                    ? 'bg-primary/90 text-primary-foreground'
                    : 'border border-white/[0.08] bg-white/[0.04] text-foreground'
              }`}
            >
              <p className={`mb-1 text-[11.5px] font-semibold uppercase tracking-wide ${mine && !internal ? 'opacity-70' : 'text-muted-foreground'}`}>
                {internal ? 'Nota interna' : event.fromTeam ? (viewer === 'admin' ? 'Tú (equipo)' : 'Equipo 3R') : viewer === 'admin' ? 'Cliente' : 'Tú'}
                <span className="ml-2 font-normal normal-case tracking-normal">{formatDateTime(event.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words">{event.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
