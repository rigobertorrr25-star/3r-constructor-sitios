'use client';

import { useEffect, useRef, useState } from 'react';

// Qué tanto se desplaza la mirada con el mouse (píxeles). Más que el avatar chico porque aquí es grande.
const GAZE_RANGE = 14;
// Distancia (px) a partir de la cual el efecto ya está al máximo — no hace falta que el mouse esté encima.
const GAZE_FALLOFF = 420;

/**
 * El león del hero: saluda una vez (el video), y al terminar se queda quieto
 * y su mirada sigue el mouse por toda la página — un gesto sutil, no un juego de ojos.
 */
export function HeroMascot() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [greeted, setGreeted] = useState(false);

  useEffect(() => {
    if (!greeted) return;
    const onMove = (event: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const strength = Math.min(dist / GAZE_FALLOFF, 1);
      setGaze({ x: (dx / dist) * GAZE_RANGE * strength, y: (dy / dist) * GAZE_RANGE * strength });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [greeted]);

  return (
    <div ref={wrapRef} className="rise relative mx-auto w-full max-w-[340px] sm:max-w-[400px] lg:max-w-none" style={{ animationDelay: '120ms' }}>
      <div aria-hidden="true" className="orb orb-a absolute inset-0 -z-10 opacity-70 mix-blend-screen" style={{ background: 'radial-gradient(closest-side, var(--primary), transparent 70%)' }} />
      <video
        aria-label="Mascota de 3R: un león con sudadera negra y lentes de sol, saludando"
        autoPlay
        muted
        playsInline
        poster="/hero-lion.png"
        onEnded={() => setGreeted(true)}
        className="w-full"
        style={{
          transform: `translate(${gaze.x}px, ${gaze.y}px)`,
          transition: 'transform 200ms ease-out',
          maskImage: 'radial-gradient(closest-side, black 72%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(closest-side, black 72%, transparent 100%)',
        }}
      >
        <source src="/hero-lion.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
