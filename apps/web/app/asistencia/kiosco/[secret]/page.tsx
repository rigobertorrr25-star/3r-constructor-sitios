import type { Metadata } from 'next';
import { AttendanceKiosk } from '@/components/attendance-kiosk';

export const metadata: Metadata = { title: 'Asistencia — tablet de la entrada', robots: { index: false, follow: false } };

export default async function KioskPage({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <AttendanceKiosk secret={secret} />
    </main>
  );
}
