import { Lion, card } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className={`${card} w-full max-w-[400px] space-y-4 text-center`}>
        <Lion size={72} className="mx-auto" />
        <h1 className="font-display text-[22px] font-bold text-foreground">Esta página no existe</h1>
        <p className="text-[15px] text-muted-foreground">Revisa el enlace o vuelve a escanear el código QR de la entrada.</p>
      </div>
    </main>
  );
}
