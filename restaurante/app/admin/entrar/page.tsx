import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { AdminLoginForm } from '@/components/login-forms';
import { Lion, card } from '@/components/ui';

export default async function AdminLogin() {
  if (await isAdmin()) redirect('/admin');
  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className={`${card} w-full max-w-sm`}>
        <div className="flex items-center gap-3">
          <Lion size={40} />
          <h1 className="font-display text-[20px] font-bold text-foreground">Administración 3R</h1>
        </div>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
