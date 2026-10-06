import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { AdminLoginForm } from '@/components/login-forms';
import { Lion, card } from '@/components/ui';
import { LangSwitch } from '@/components/i18n';
import { getT } from '@/lib/i18n/server';

export default async function AdminLogin() {
  if (await isAdmin()) redirect('/admin');
  const t = await getT();
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <LangSwitch className="absolute right-4 top-4" />
      <div className={`${card} w-full max-w-sm`}>
        <div className="flex items-center gap-3">
          <Lion size={40} />
          <h1 className="font-display text-[20px] font-bold text-foreground">{t('Administración 3R')}</h1>
        </div>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
