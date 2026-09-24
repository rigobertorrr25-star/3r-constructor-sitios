'use client';

import { useEffect, useRef, useState } from 'react';

// Cuánto se mueve el brillo dentro del lente (en % del ancho del contenedor, convertido a píxeles al medir). El león no se mueve, solo esto.
const GAZE_RANGE_PERCENT = 1.1;
// Distancia (px) a partir de la cual el efecto ya está al máximo — no hace falta que el mouse esté encima.
const GAZE_FALLOFF = 420;

// Centro de cada lente de las gafas, en % de la imagen (calibrado a ojo sobre hero-lion.png, 1000×1000).
const LENSES = [
  { left: 49.5, top: 24.5 },
  { left: 64.5, top: 25.5 },
];

/**
 * El león del hero: saluda una vez (el video), y al terminar se queda completamente quieto.
 * Lo único que se mueve después es un brillo pequeño dentro de cada lente de sus gafas,
 * siguiendo el mouse — como si mirara hacia allá — sin mover el personaje ni la imagen.
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
      const maxPx = (rect.width * GAZE_RANGE_PERCENT) / 100;
      setGaze({ x: (dx / dist) * maxPx * strength, y: (dy / dist) * maxPx * strength });
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
        style={{ maskImage: 'radial-gradient(closest-side, black 72%, transparent 100%)', WebkitMaskImage: 'radial-gradient(closest-side, black 72%, transparent 100%)' }}
      >
        <source src="/hero-lion.mp4" type="video/mp4" />
      </video>
      {greeted
        ? LENSES.map((lens, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute size-[3.4%] rounded-full bg-white/70 opacity-70 blur-[2px] transition-transform duration-200 ease-out"
              style={{
                left: `${lens.left}%`,
                top: `${lens.top}%`,
                transform: `translate(-50%, -50%) translate(${gaze.x}px, ${gaze.y}px)`,
              }}
            />
          ))
        : null}
    </div>
  );
}
