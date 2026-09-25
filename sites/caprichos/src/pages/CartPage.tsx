import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MessageCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import { useCartStore } from '@/stores/cartStore';
import { formatCOP } from '@/lib/format';

export default function CartPage() {
  const { items, updateQuantity, removeItem, checkout, getTotalPrice } = useCartStore();

  const totalPrice = getTotalPrice();

  return (
    <Layout>
      <Helmet>
        <title>Tu pedido — Caprichos</title>
        <meta name="description" content="Revisa tu pedido y confírmalo por WhatsApp." />
      </Helmet>

      <div className="page-padding py-12">
        <h1 className="font-display text-2xl mb-8">Tu pedido</h1>

        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">Todavía no has agregado nada</p>
            <Link
              to="/productos"
              className="text-sm text-primary underline underline-offset-4 hover:opacity-60 transition-opacity"
            >
              Ver catálogo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <div className="border-t border-border">
                {items.map((item) => (
                  <div key={item.product.id} className="py-6 border-b border-border flex gap-6">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-secondary flex-shrink-0 rounded-xl overflow-hidden">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <Link to={`/producto/${item.product.slug}`} className="text-sm hover:text-primary transition-colors">
                          {item.product.name}
                        </Link>
                        <p className="text-sm text-primary mt-2">{formatCOP(item.product.price)}</p>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center border border-border rounded-full overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors text-sm"
                            aria-label="Disminuir cantidad"
                          >
                            −
                          </button>
                          <span className="w-10 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors text-sm"
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

            <div className="lg:col-span-1">
              <div className="border border-border rounded-xl p-6">
                <h2 className="text-sm font-medium mb-6">Resumen del pedido</h2>

                <div className="border-t border-border pt-4 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Total</span>
                    <span className="font-medium">{formatCOP(totalPrice)}</span>
                  </div>
                </div>

                <button
                  onClick={checkout}
                  className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Pedir por WhatsApp
                </button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Confirmamos disponibilidad, talla y envío por WhatsApp.
                </p>
              </div>

              <Link
                to="/productos"
                className="block text-sm text-center mt-6 underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                Seguir viendo el catálogo
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
