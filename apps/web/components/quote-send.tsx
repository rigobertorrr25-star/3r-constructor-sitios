'use client';

import { useActionState, useState } from 'react';
import { sendQuoteAction } from '@/app/empresa/quotes-actions';
import { Alert } from './shop';

/** Enviar por correo o sacar el enlace para mandarlo por WhatsApp. */
export function QuoteSendPanel({ companyId, quoteId, hasEmail, resend }: { companyId: string; quoteId: string; hasEmail: boolean; resend: boolean }) {
  const [state, action, pending] = useActionState(sendQuoteAction, undefined);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="quoteId" value={quoteId} />
        {hasEmail ? (
          <button
            type="submit"
            name="mode"
            value="email"
            disabled={pending}
            className="rounded-full bg-primary px-5 py-3 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            {resend ? 'Reenviar por correo' : 'Enviar por correo'}
          </button>
        ) : null}
        <button
          type="submit"
          name="mode"
          value="link"
          disabled={pending}
          className="rounded-full border border-white/[0.12] px-5 py-3 text-[14px] text-foreground transition hover:bg-white/[0.06] disabled:opacity-60"
        >
          {hasEmail ? 'Solo sacar el enlace' : 'Sacar el enlace para enviarlo'}
        </button>
      </form>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.url ? (
        <div className="space-y-2 rounded-2xl border border-[#5ee0a0]/25 bg-[#5ee0a0]/[0.06] p-4">
          <p className="text-[14px] text-foreground">
            {state.emailed ? 'Listo, le llegó el correo. También puedes compartir este enlace:' : 'Comparte este enlace con tu cliente:'}
          </p>
          <p className="break-all rounded-xl bg-black/30 px-3 py-2 text-[13px] text-foreground">{state.url}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(state.url!).then(() => setCopied(true))}
              className="rounded-full border border-white/[0.12] px-4 py-2 text-[13px] text-foreground hover:bg-white/[0.06]"
            >
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola, te comparto la cotización: ${state.url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/[0.12] px-4 py-2 text-[13px] text-foreground hover:bg-white/[0.06]"
            >
              Enviar por WhatsApp
            </a>
          </div>
          <p className="text-[12.5px] text-muted-foreground">Cada vez que sacas un enlace nuevo, el anterior deja de servir.</p>
        </div>
      ) : null}
    </div>
  );
}
