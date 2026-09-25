import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { formatCOP } from '@/lib/format';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, checkout, getTotalPrice, setOpen } = useCartStore();
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

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  if (!isVisible) return null;

  const totalPrice = getTotalPrice();

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className={`absolute inset-0 bg-foreground/20 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className={`absolute top-0 right-0 h-full w-full max-w-[400px] bg-background flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
      >
        <div className="nav-height flex items-center justify-between page-padding border-b border-border flex-shrink-0">
          <span className="text-sm">Tu pedido ({items.length})</span>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="text-xs uppercase tracking-wide hover:opacity-60 transition-opacity"
            aria-label="Cerrar carrito"
          >
            Cerrar
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">Todavía no has agregado nada</p>
              <Link
                to="/productos"
                onClick={handleClose}
                className="text-sm text-primary underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                Ver catálogo
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.product.id} className="p-4 flex gap-4">
                    <div className="w-20 h-20 bg-secondary flex-shrink-0 rounded-lg overflow-hidden">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm mb-1 line-clamp-1">{item.product.name}</p>
                      <p className="text-sm text-primary">{formatCOP(item.product.price)}</p>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-border rounded-full overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors text-xs"
                            aria-label="Disminuir cantidad"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-xs">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors text-xs"
                            aria-label="Aumentar cantidad"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Subtotal</span>
                <span className="text-sm font-medium">{formatCOP(totalPrice)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Confirmamos tu pedido y el envío directamente por WhatsApp.
              </p>
              <button
                onClick={checkout}
                className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Pedir por WhatsApp
              </button>
              <Link
                to="/carrito"
                onClick={handleClose}
                className="block w-full h-12 rounded-full border border-border text-sm hover:bg-secondary transition-colors flex items-center justify-center mt-2"
              >
                Ver pedido completo
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
