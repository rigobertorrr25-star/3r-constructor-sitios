import { Helmet } from "react-helmet-async";
import Layout from "@/components/Layout";

const ShippingPage = () => {
  return (
    <Layout>
      <Helmet>
        <title>Envíos y devoluciones — Caprichos</title>
        <meta name="description" content="Información de envíos y devoluciones de Caprichos." />
      </Helmet>

      <main className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-2xl mb-8">Envíos y devoluciones</h1>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-foreground font-display text-lg mb-3">Envíos</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-foreground mb-2">Tiempo de alistamiento</h3>
                  <p>
                    Alistamos tu pedido en 1-2 días hábiles después de confirmarlo por WhatsApp.
                  </p>
                </div>

                <div>
                  <h3 className="text-foreground mb-2">Cartagena</h3>
                  <p>Entregas locales coordinadas directamente contigo, con costo según la zona.</p>
                </div>

                <div>
                  <h3 className="text-foreground mb-2">Resto de Colombia</h3>
                  <p>
                    Enviamos a nivel nacional con transportadora. El costo y tiempo de entrega se confirman
                    según tu ciudad al momento de hacer el pedido.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">Devoluciones y cambios</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-foreground mb-2">Política de cambios</h3>
                  <p>
                    Aceptamos cambios dentro de los 5 días siguientes a la entrega, siempre que la prenda no
                    haya sido usada ni lavada y conserve sus etiquetas originales.
                  </p>
                </div>

                <div>
                  <h3 className="text-foreground mb-2">¿Cómo solicitar un cambio?</h3>
                  <p>Escríbenos por WhatsApp con tu número de pedido y te indicamos cómo proceder.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">Productos con algún defecto</h2>
              <p>
                Si tu pedido llega con algún defecto, escríbenos por WhatsApp dentro de las 48 horas
                siguientes a la entrega, con fotos del producto, y coordinamos el cambio.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">Contacto</h2>
              <p>Para cualquier pregunta sobre tu envío, escríbenos por WhatsApp.</p>
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default ShippingPage;
