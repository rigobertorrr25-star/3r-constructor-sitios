import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Music2, Search } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { CATEGORIES } from '@/data/products';

interface OffCanvasMenuProps {
  open: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
}

const menuLinks = [
  { label: 'Inicio', href: '/' },
  { label: 'Todos los productos', href: '/productos' },
  { label: 'Categorías', href: '/categorias' },
  { label: 'Nosotros', href: '/nosotros' },
  { label: 'Contacto', href: '/contacto' },
];

const legalLinks = [
  { label: 'Términos y condiciones', href: '/terminos' },
  { label: 'Política de privacidad', href: '/privacidad' },
  { label: 'Política de cookies', href: '/cookies' },
  { label: 'Envíos y devoluciones', href: '/envios' },
  { label: 'Mapa del sitio', href: '/mapa-del-sitio' },
];

export default function OffCanvasMenu({ open, onClose, onOpenSearch }: OffCanvasMenuProps) {
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
      closeButtonRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else if (isVisible) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
        document.body.style.overflow = '';
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className={`absolute inset-0 bg-foreground/20 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={`absolute top-0 left-0 h-full w-[300px] max-w-[85vw] bg-background ${isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        <div className="flex flex-col h-full">
          <div className="nav-height flex items-center justify-between page-padding border-b border-border">
            <span className="font-display text-lg text-primary">Caprichos</span>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="text-xs uppercase tracking-wide hover:opacity-60 transition-opacity"
              aria-label="Cerrar menú"
            >
              Cerrar
            </button>
          </div>

          <nav className="flex-1 py-6 page-padding overflow-y-auto">
            <ul className="space-y-4">
              {menuLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    onClick={onClose}
                    className="text-sm hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {isMobile && (
                <li>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSearch?.();
                    }}
                    className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                  >
                    <Search className="h-4 w-4" strokeWidth={1.5} />
                    Buscar
                  </button>
                </li>
              )}
            </ul>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Categorías</p>
              <ul className="space-y-2">
                {CATEGORIES.map((category) => (
                  <li key={category}>
                    <Link
                      to={`/categoria/${category.toLowerCase()}`}
                      onClick={onClose}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {category}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="page-padding py-4 border-t border-border flex items-center gap-4">
            <a
              href="https://www.instagram.com/ccaprichos"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram de Caprichos"
              className="hover:text-primary transition-colors"
            >
              <Instagram className="h-5 w-5" strokeWidth={1.5} />
            </a>
            <a
              href="https://www.tiktok.com/@ccaprichos0"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok de Caprichos"
              className="hover:text-primary transition-colors"
            >
              <Music2 className="h-5 w-5" strokeWidth={1.5} />
            </a>
          </div>

          <div className="page-padding py-4 border-t border-border">
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    onClick={onClose}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="page-padding py-4">
            <p className="text-xs text-muted-foreground">© 2026 Caprichos by Yendry ZG</p>
          </div>
        </div>
      </div>
    </div>
  );
}
