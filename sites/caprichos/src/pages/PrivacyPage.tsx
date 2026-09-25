import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";

const PrivacyPage = () => {
  return (
    <Layout>
      <Helmet>
        <title>Política de privacidad — Caprichos</title>
        <meta name="description" content="Política de privacidad de la tienda virtual Caprichos." />
      </Helmet>

      <main className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-2xl mb-8">Política de privacidad</h1>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-foreground font-display text-lg mb-3">1. Información que recopilamos</h2>
              <p>
                Recopilamos la información que nos compartes directamente, como cuando nos escribes por
                WhatsApp, Instagram o TikTok para hacer un pedido. Esto puede incluir tu nombre, número de
                teléfono y dirección de entrega.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">2. Uso de tu información</h2>
              <p>
                Usamos esta información únicamente para procesar tus pedidos, coordinar la entrega y
                responder tus preguntas. No usamos tus datos para fines distintos a estos.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">3. Compartir información</h2>
              <p>
                No vendemos tu información personal. Solo la compartimos con transportadoras cuando es
                necesario para hacer llegar tu pedido.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">4. Cookies</h2>
              <p>
                Usamos cookies básicas en nuestro sitio web para recordar tus preferencias y mejorar tu
                experiencia de navegación. Puedes gestionar las cookies desde nuestra{' '}
                <Link to="/cookies" className="underline hover:text-foreground">política de cookies</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">5. Seguridad</h2>
              <p>
                Tomamos medidas razonables para proteger tu información personal. Sin embargo, ningún medio
                de transmisión por internet es 100% seguro.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">6. Tus derechos</h2>
              <p>
                Puedes solicitarnos acceder, corregir o eliminar tu información personal en cualquier momento
                escribiéndonos por WhatsApp o Instagram.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">7. Cambios a esta política</h2>
              <p>
                Podemos actualizar esta política ocasionalmente. Cualquier cambio se publicará en esta misma
                página.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">8. Contacto</h2>
              <p>Para preguntas sobre esta política, escríbenos por WhatsApp o Instagram.</p>
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default PrivacyPage;
