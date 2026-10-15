import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { AcceptInviteForm } from '@/components/company-forms';
import { Alert } from '@/components/shop';
import { currentUserOrNull, rawApi } from '@/lib/api';
import { ROLE_LABEL, type InvitePreview } from '@/lib/companies';
import type { CurrentUser } from '@/lib/types';

export const metadata: Metadata = { title: 'Invitación — 3R', robots: { index: false } };

const pill =
  'inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-[14.875px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const [preview, user] = await Promise.all([
    token ? rawApi<InvitePreview>(`/company-invites/${encodeURIComponent(token)}`).catch(() => null) : Promise.resolve(null),
    currentUserOrNull<CurrentUser>(),
  ]);
  const invite = preview?.ok ? preview.data : null;
  const next = `/invitacion?token=${encodeURIComponent(token)}`;

  let body;
  if (!invite) {
    body = <Alert>Esta invitación no existe o fue reemplazada por otra. Pide que te la envíen de nuevo.</Alert>;
  } else if (invite.accepted) {
    body = (
      <div className="space-y-4">
        <Alert tone="ok">Esta invitación ya se usó.</Alert>
        <Link href="/empresa" className={`${pill} bg-primary text-primary-foreground`}>
          Ir a mis empresas
        </Link>
      </div>
    );
  } else if (invite.expired) {
    body = <Alert>Esta invitación venció. Pide que te envíen otra.</Alert>;
  } else if (!user) {
    body = (
      <div className="space-y-3">
        <p className="text-[14.5px] text-muted-foreground">
          Entra o crea tu cuenta con <strong className="text-foreground">{invite.email}</strong> para unirte.
        </p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${pill} bg-primary text-primary-foreground`}>
          Iniciar sesión
        </Link>
        <Link href={`/registro?next=${encodeURIComponent(next)}`} className={`${pill} border border-white/[0.12] hover:bg-white/[0.06]`}>
          Crear mi cuenta
        </Link>
      </div>
    );
  } else if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    body = (
      <Alert>
        Esta invitación es para {invite.email} y entraste como {user.email}. Sal de tu cuenta y entra con el correo de la invitación.
      </Alert>
    );
  } else {
    body = <AcceptInviteForm token={token} />;
  }

  return (
    <AuthShell
      title={invite ? `Te invitaron a ${invite.companyName}` : 'Invitación'}
      subtitle={invite ? `Te unes como ${ROLE_LABEL[invite.role].toLowerCase()}.` : 'Plataforma 3R'}
      footer={
        <Link href="/" className="text-primary hover:underline">
          Ir a 3rpaginas.com
        </Link>
      }
    >
      {body}
    </AuthShell>
  );
}
