'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Envuelve contenido y le agrega la clase `reveal is-visible` cuando entra en pantalla
 * (ver la animación en app/globals.css). Sin JavaScript o con "menos movimiento" activado,
 * el contenido simplemente se ve — `.reveal` sin `.is-visible` no debe depender de JS para
 * mostrarse en ese caso (globals.css ya lo cubre con prefers-reduced-motion).
 */
export function Reveal({
  children,
  delayMs = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode;
  delayMs?: number;
  as?: 'div' | 'li' | 'section';
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}
