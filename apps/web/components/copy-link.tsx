'use client';

import { useState } from 'react';

/** Enlace para compartir, con botones de copiar y WhatsApp. */
export function CopyLink({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <p className="break-all rounded-xl bg-black/30 px-3 py-2 text-[13px] text-foreground">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
          className="rounded-full border border-white/[0.12] px-4 py-2 text-[13px] text-foreground hover:bg-white/[0.06]"
        >
          {copied ? 'Copiado' : 'Copiar enlace'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/[0.12] px-4 py-2 text-[13px] text-foreground hover:bg-white/[0.06]"
        >
          Enviar por WhatsApp
        </a>
      </div>
    </div>
  );
}
