import { ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import Navbar from './Navbar';
import { greetingWhatsAppUrl } from '@/lib/whatsapp';

interface LayoutProps {
  children: ReactNode;
  showHero?: boolean;
}

export default function Layout({ children, showHero = false }: LayoutProps) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className={showHero ? '' : 'pt-16'}>{children}</main>

      <a
        href={greetingWhatsAppUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-7 w-7" strokeWidth={1.75} />
      </a>
    </div>
  );
}
