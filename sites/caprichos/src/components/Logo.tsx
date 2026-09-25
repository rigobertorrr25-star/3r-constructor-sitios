export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-2xl tracking-wide text-primary ${className}`}
    >
      Caprichos
    </span>
  );
}
