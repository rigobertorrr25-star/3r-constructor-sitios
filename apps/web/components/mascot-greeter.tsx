'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const WHATSAPP_HREF = `https://wa.me/573107907194?text=${encodeURIComponent('Hola, quiero una página web para mi negocio')}`;
const SEEN_KEY = '3r-greeter-seen';
// Qué tanto se desplaza la mirada hacia el clic (píxeles). Sutil: es un guiño, no un juego de ojos.
const GAZE_RANGE = 6;

/**
 * Mascota flotante que saluda al visitante y lo lleva a cotizar o a WhatsApp.
 * No es un chat con IA: es un mensaje fijo con botones, para no prometer algo que no hace.
 * Se abre sola una vez por navegador (localStorage); después queda como botón para reabrirla.
 * El avatar "mira" hacia donde el visitante hace clic, en toda la página.
 */
export function MascotGreeter() {
  const [open, setOpen] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const avatarRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = avatarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      setGaze({ x: (dx / dist) * GAZE_RANGE, y: (dy / dist) * GAZE_RANGE });
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
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
        ref={avatarRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar el mensaje' : 'Abrir el mensaje de bienvenida'}
        className="relative flex size-14 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-card shadow-[var(--shadow-glass)] transition hover:scale-105"
      >
        <Image
          src="/avatar-lion.jpg"
          alt=""
          width={112}
          height={112}
          className="h-[130%] w-[130%] max-w-none object-cover transition-transform duration-300 ease-out"
          style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)` }}
          priority
        />
      </button>
    </div>
  );
}
