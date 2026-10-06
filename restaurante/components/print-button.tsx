'use client';

export function PrintButton({ className = 'rounded-full bg-black px-5 py-2 text-[14px] text-white' }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Imprimir
    </button>
  );
}
