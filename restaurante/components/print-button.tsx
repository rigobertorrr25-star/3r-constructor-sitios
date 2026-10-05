'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-full bg-black px-5 py-2 text-[14px] text-white">
      Imprimir
    </button>
  );
}
