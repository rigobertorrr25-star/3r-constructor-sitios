type LogoProps = {
  size?: number;
  className?: string;
};

/** Logo de 3R: la cara del león (la mascota) y «3R» en Bebas Neue al lado. `size` es el alto del león; el texto toma el color del texto. */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-leon.jpg" alt="" width={size} height={size} className="shrink-0 rounded-[28%] object-cover" style={{ width: size, height: size }} />
      <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: Math.round(size * 0.96), lineHeight: 1, letterSpacing: '0.02em' }}>3R</span>
    </span>
  );
}
