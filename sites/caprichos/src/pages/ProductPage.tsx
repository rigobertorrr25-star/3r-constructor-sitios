import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, MessageCircle, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { getProductBySlug, getRelatedProducts } from '@/data/products';
import { useCartStore } from '@/stores/cartStore';
import ImageLightbox from '@/components/ImageLightbox';
import { formatCOP } from '@/lib/format';
import { orderWhatsAppUrl } from '@/lib/whatsapp';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const addItem = useCartStore((state) => state.addItem);
  const setCartOpen = useCartStore((state) => state.setOpen);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const product = slug ? getProductBySlug(slug) : undefined;

  if (!product) {
    return (
      <Layout>
        <div className="page-padding py-20 text-center">
          <p className="text-sm text-muted-foreground mb-4">No encontramos este producto</p>
          <Link to="/productos" className="text-sm text-primary underline underline-offset-4">
            Volver al catálogo
          </Link>
        </div>
      </Layout>
    );
  }

  const relatedProducts = getRelatedProducts(product);

  const handleAddToCart = () => {
    addItem(product, quantity);
    toast.success('Añadido a tu pedido', { position: 'top-center' });
    setCartOpen(true);
  };

  const handleWhatsAppOrder = () => {
    window.open(orderWhatsAppUrl([{ product, quantity }]), '_blank');
  };

  return (
    <Layout>
      <Helmet>
        <title>{product.name} — Caprichos</title>
        <meta name="description" content={product.description} />
      </Helmet>

      <div className="page-padding py-12">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver
        </button>
      </div>

      <div className={`page-padding ${isMobile ? 'pb-32' : 'pb-12'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-8 lg:gap-12">
          {/* Left - Info */}
          <div className="order-2 lg:order-1 lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16">
            <div className="h-full flex flex-col justify-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{product.category}</p>
              <h1 className="font-display text-2xl mb-2">{product.name}</h1>
              <p className="text-lg text-primary mb-8">{formatCOP(product.price)}</p>

              <Accordion type="single" collapsible defaultValue="details" className="w-full">
                <AccordionItem value="details" className="border-t border-border">
                  <AccordionTrigger className="text-sm py-4 hover:no-underline">
                    Detalles del producto
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {product.description}
                  </AccordionContent>
                </AccordionItem>

                {relatedProducts.length > 0 && (
                  <AccordionItem value="related" className="border-border">
                    <AccordionTrigger className="text-sm py-4 hover:no-underline">
                      También te puede gustar
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        {relatedProducts.map((p) => (
                          <Link key={p.id} to={`/producto/${p.slug}`} className="group">
                            <div className="aspect-square bg-secondary mb-2 overflow-hidden rounded-lg">
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                              />
                            </div>
                            <p className="text-xs truncate">{p.name}</p>
                            <p className="text-xs text-primary">{formatCOP(p.price)}</p>
                          </Link>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="delivery" className="border-border">
                  <AccordionTrigger className="text-sm py-4 hover:no-underline">
                    Entrega y pedidos
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    Confirmamos disponibilidad, talla y envío directamente por WhatsApp. Hacemos envíos a toda Cartagena y el resto de Colombia.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          {/* Center - Images */}
          <div className="order-1 lg:order-2 space-y-2">
            {product.images.map((img, index) => (
              <div
                key={index}
                className="aspect-[3/4] bg-secondary cursor-zoom-in rounded-xl overflow-hidden"
                onClick={() => {
                  setLightboxIndex(index);
                  setLightboxOpen(true);
                }}
              >
                <img src={img} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <ImageLightbox
            images={product.images}
            alt={product.name}
            currentIndex={lightboxIndex}
            isOpen={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
            onNavigate={setLightboxIndex}
          />

          {/* Right - Quantity & actions */}
          <div className="order-3 lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16">
            <div className="h-full flex flex-col justify-center space-y-6">
              <div>
                <p className="text-xs text-muted-foreground mb-3">Cantidad</p>
                <div className="flex items-center border border-border rounded-full w-fit overflow-hidden">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors"
                    aria-label="Disminuir cantidad"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors"
                    aria-label="Aumentar cantidad"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {!isMobile && (
                <div className="space-y-3">
                  <button
                    onClick={handleAddToCart}
                    className="w-full h-12 rounded-full bg-foreground text-background text-sm hover:opacity-90 transition-opacity"
                  >
                    Añadir al pedido — {formatCOP(product.price * quantity)}
                  </button>
                  <button
                    onClick={handleWhatsAppOrder}
                    className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Pedir por WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border page-padding py-3 space-y-2">
          <button
            onClick={handleAddToCart}
            className="w-full h-11 rounded-full bg-foreground text-background text-sm hover:opacity-90 transition-opacity"
          >
            Añadir — {formatCOP(product.price * quantity)}
          </button>
          <button
            onClick={handleWhatsAppOrder}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Pedir por WhatsApp
          </button>
        </div>
      )}
    </Layout>
  );
}
