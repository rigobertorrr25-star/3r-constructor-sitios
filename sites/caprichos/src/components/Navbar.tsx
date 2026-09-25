import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search, ShoppingBag } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

import { useCartStore } from '@/stores/cartStore';
import OffCanvasMenu from './OffCanvasMenu';
import SearchPanel from './SearchPanel';
import CartDrawer from './CartDrawer';
import Logo from './Logo';

export default function Navbar() {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const totalItems = useCartStore((state) => state.getTotalItems());
  const setCartOpen = useCartStore((state) => state.setOpen);
  const cartOpen = useCartStore((state) => state.isOpen);

  useEffect(() => {
    setScrolled(true);
  }, []);

  const navStyles = scrolled
    ? 'bg-background/95 backdrop-blur-sm border-b border-border text-foreground'
    : 'bg-transparent border-transparent text-white';

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navStyles}`}>
        <nav className="nav-height flex items-center justify-between page-padding">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 text-xs uppercase tracking-wide hover:opacity-60 transition-opacity"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Menú</span>
          </button>

          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <Logo />
          </Link>

          <div className="flex items-center gap-4">
            {!isMobile && (
              <button
                onClick={() => setSearchOpen(true)}
                className="hover:opacity-60 transition-opacity"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" strokeWidth={1.5} />
              </button>
            )}

            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center hover:opacity-60 transition-opacity"
              aria-label="Carrito"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {totalItems > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </nav>
      </header>

      <OffCanvasMenu open={menuOpen} onClose={() => setMenuOpen(false)} onOpenSearch={() => setSearchOpen(true)} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
