import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/password-forms';

export const metadata: Metadata = { title: 'Recuperar contraseña — 3R' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Te mandamos un enlace a tu correo para elegir una nueva."
      footer={
        <>
          ¿Ya la recordaste?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
