'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const WHATSAPP_HREF = `https://wa.me/573107907194?text=${encodeURIComponent('Hola, quiero una página web para mi negocio')}`;
const SEEN_KEY = '3r-greeter-seen';

/**
 * Mascota flotante que saluda al visitante y lo lleva a cotizar o a WhatsApp.
 * No es un chat con IA: es un mensaje fijo con botones, para no prometer algo que no hace.
 * Se abre sola una vez por navegador (localStorage); después queda como botón para reabrirla.
 */
export function MascotGreeter() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* almacenamiento bloqueado (privado, etc.): simplemente no se auto-abre */
    }
    if (seen) return;
    const timer = setTimeout(() => {
      setOpen(true);
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* nada que hacer */
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end gap-3">
      <div
        role="dialog"
        aria-label="Mensaje de bienvenida"
        className={`w-[260px] origin-bottom-right rounded-[20px] rounded-br-md border border-white/[0.08] bg-card p-4 shadow-[var(--shadow-glass)] transition-all duration-300 ease-[var(--ease-emphasized)] ${
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="float-right -mr-1 -mt-1 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
        >
          ✕
        </button>
        <p className="text-[14px] leading-relaxed text-foreground">¡Hola! 👋 ¿Buscas una página para tu negocio? Te ayudo a elegir.</p>
        <div className="mt-3 flex flex-col gap-2">
          <a
            href="#paquetes"
            onClick={() => setOpen(false)}
            className="rounded-full bg-primary px-4 py-2 text-center text-[13px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
          >
            Ver paquetes
          </a>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="rounded-full border border-white/[0.08] px-4 py-2 text-center text-[13px] font-medium text-foreground transition hover:bg-white/[0.04]"
          >
            Escríbeme por WhatsApp
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar el mensaje' : 'Abrir el mensaje de bienvenida'}
        className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-card p-1.5 shadow-[var(--shadow-glass)] transition hover:scale-105"
      >
        <Image src="/mascot.png" alt="" width={56} height={56} className="h-full w-full object-contain" priority />
      </button>
    </div>
  );
}
