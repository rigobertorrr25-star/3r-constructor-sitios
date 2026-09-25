import { Helmet } from "react-helmet-async";
import Layout from "@/components/Layout";

const TermsPage = () => {
  return (
    <Layout>
      <Helmet>
        <title>Términos y condiciones — Caprichos</title>
        <meta name="description" content="Términos y condiciones de la tienda virtual Caprichos." />
      </Helmet>

      <main className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-2xl mb-8">Términos y condiciones</h1>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-foreground font-display text-lg mb-3">1. General</h2>
              <p>
                Estos términos y condiciones rigen el uso del sitio web de Caprichos y la compra de
                productos a través de nuestros canales (sitio web, WhatsApp, Instagram y TikTok). Al usar
                este sitio o hacer un pedido, aceptas estos términos.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">2. Pedidos</h2>
              <p>
                Todos los pedidos están sujetos a disponibilidad. Una vez elijas tus productos, confirmamos
                el pedido, la talla y el valor final directamente por WhatsApp antes de proceder con el envío
                o la entrega.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">3. Precios</h2>
              <p>
                Todos los precios se muestran en pesos colombianos (COP). Nos reservamos el derecho de
                actualizar los precios en cualquier momento sin previo aviso; el precio aplicable a tu pedido
                será el confirmado por WhatsApp al momento de la compra.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">4. Pago</h2>
              <p>
                El pago se coordina directamente con nosotros por WhatsApp, según los medios de pago que
                tengamos disponibles en el momento de tu pedido.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">5. Propiedad intelectual</h2>
              <p>
                Todo el contenido de este sitio, incluyendo textos, imágenes, logotipos y fotografías, es
                propiedad de Caprichos y no puede reproducirse ni utilizarse sin nuestro consentimiento previo.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">6. Limitación de responsabilidad</h2>
              <p>
                Caprichos no será responsable por daños indirectos derivados del uso de este sitio o de
                nuestros productos. Nuestra responsabilidad total no excederá el valor pagado por el producto
                correspondiente.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">7. Ley aplicable</h2>
              <p>Estos términos se rigen por las leyes de la República de Colombia.</p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">8. Contacto</h2>
              <p>Para cualquier pregunta sobre estos términos, escríbenos por WhatsApp o Instagram.</p>
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default TermsPage;
