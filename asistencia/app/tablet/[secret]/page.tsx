import type { Metadata } from 'next';
import { Kiosk } from '@/components/kiosk';

export const metadata: Metadata = { title: 'Asistencia — tablet de la entrada' };

export default async function TabletPage({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <Kiosk secret={secret} />
    </main>
  );
}
