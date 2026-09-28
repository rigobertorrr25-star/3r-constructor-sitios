import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { card } from '@/components/ui';
import { isLoggedIn } from '@/lib/auth';

export const metadata: Metadata = { title: 'Entrar — Asistencia 3R' };

export default async function LoginPage() {
  if (await isLoggedIn()) redirect('/panel');
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className="w-full max-w-[400px]">
        <Image
          src="/hero-lion.png"
          alt="León de 3R saludando"
          width={220}
          height={220}
          priority
          className="mx-auto -mb-6 rounded-full shadow-[var(--shadow-glow)]"
        />
        <div className={`${card} pt-10`}>
          <h1 className="text-center font-display text-[26px] font-bold tracking-tight text-foreground">Asistencia 3R</h1>
          <p className="mt-1 mb-6 text-center text-[15px] text-muted-foreground">Entrada y salida de empleados con QR.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
