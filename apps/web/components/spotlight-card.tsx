'use client';

import type { MouseEvent, ReactNode } from 'react';

/**
 * Tarjeta con un brillo suave que sigue al cursor (clase .spotlight en globals.css).
 * En pantallas táctiles simplemente no hay hover, así que no hace falta código aparte.
 */
type BaseProps = { children: ReactNode; className?: string };
type DivProps = BaseProps & { as?: 'div' };
type AnchorProps = BaseProps & { as: 'a'; href: string; target?: string; rel?: string };

export function SpotlightCard(props: DivProps | AnchorProps) {
  const onMouseMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  if (props.as === 'a') {
    const { children, className = '', href, target, rel } = props;
    return (
      <a href={href} target={target} rel={rel} className={`spotlight ${className}`} onMouseMove={onMouseMove}>
        {children}
      </a>
    );
  }

  const { children, className = '' } = props;
  return (
    <div className={`spotlight ${className}`} onMouseMove={onMouseMove}>
      {children}
    </div>
  );
}
