type LogoProps = {
  size?: number;
  className?: string;
};

/** Logo "3R" dibujado con trazos; toma el color del texto (currentColor). */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="3R"
      className={className}
    >
      <g
        transform="translate(-1 0)"
        fill="none"
        stroke="currentColor"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 21 C13 16 29 16 29 24 C29 29 22 31 20 31 C22 31 30 33 30 39 C30 47 13 47 12 41" />
        <path d="M37 46 V18 H45 C53 18 53 33 45 33 H37 M45 33 L53 46" />
      </g>
    </svg>
  );
}
