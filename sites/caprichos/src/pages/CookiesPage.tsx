import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import CookiePreferences from "@/components/CookiePreferences";

const CookiesPage = () => {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  return (
    <Layout>
      <Helmet>
        <title>Política de cookies — Caprichos</title>
        <meta name="description" content="Política de cookies de la tienda virtual Caprichos." />
      </Helmet>

      <main className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-2xl mb-8">Política de cookies</h1>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-foreground font-display text-lg mb-3">1. ¿Qué son las cookies?</h2>
              <p>
                Las cookies son pequeños archivos de texto que se guardan en tu dispositivo cuando visitas
                nuestro sitio. Nos ayudan a recordar tus preferencias y a entender cómo usas la página.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">2. Tipos de cookies que usamos</h2>
              <p className="mb-3">Usamos los siguientes tipos de cookies:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>Esenciales:</strong> necesarias para que el sitio funcione, como recordar tu pedido.</li>
                <li><strong>Analíticas:</strong> nos ayudan a entender cómo interactúan las visitantes con el sitio.</li>
                <li><strong>Preferencias:</strong> recuerdan tus opciones dentro del sitio.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">3. Cookies esenciales</h2>
              <p>
                Son necesarias para el funcionamiento del sitio y no pueden desactivarse. Incluyen las que
                recuerdan los productos agregados a tu pedido.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">4. Cookies analíticas</h2>
              <p>
                Nos ayudan a entender qué páginas visitan más nuestras clientas, de forma anónima y agregada,
                para mejorar la experiencia de compra.
              </p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">5. Gestiona tus cookies</h2>
              <p className="mb-3">
                Puedes administrar tus preferencias de cookies desde nuestro panel o desde la configuración de
                tu navegador.
              </p>
              <Button variant="outline" size="sm" onClick={() => setPreferencesOpen(true)}>
                Gestionar preferencias de cookies
              </Button>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">6. Cambios a esta política</h2>
              <p>Podemos actualizar esta política ocasionalmente; los cambios se publicarán en esta página.</p>
            </section>

            <section>
              <h2 className="text-foreground font-display text-lg mb-3">7. Contacto</h2>
              <p>Para preguntas sobre el uso de cookies, escríbenos por WhatsApp o Instagram.</p>
            </section>
          </div>
        </div>

        <CookiePreferences open={preferencesOpen} onOpenChange={setPreferencesOpen} />
      </main>
    </Layout>
  );
};

export default CookiesPage;
