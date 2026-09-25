import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import FeaturedCarousel from '@/components/FeaturedCarousel';
import { CATEGORIES, PRODUCTS, getProductsByCategory } from '@/data/products';
import { greetingWhatsAppUrl } from '@/lib/whatsapp';
import { withBase } from '@/lib/assets';

const featured = CATEGORIES.map((category) => getProductsByCategory(category)[0]).filter(Boolean);

export default function Index() {
  return (
    <Layout showHero>
      <Helmet>
        <title>Caprichos — Moda femenina en tendencia | Cartagena</title>
        <meta
          name="description"
          content="Tienda virtual de moda femenina en Cartagena: vestidos, bodys, corsets, jeans y más. El lujo de ser tú."
        />
      </Helmet>

      {/* Hero */}
      <section className="relative h-[calc(100vh-4rem)] w-full overflow-hidden">
        <img
          src={PRODUCTS[0].images[0]}
          alt="Caprichos"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-primary/10" />

        <div className="relative z-10 flex h-full flex-col items-center justify-end pb-16 text-center page-padding">
          <img src={withBase('/brand/logo.jpg')} alt="Caprichos" className="mb-4 h-24 w-24 rounded-full object-cover shadow-lg md:h-28 md:w-28" />
          <h1 className="font-display text-3xl text-foreground md:text-4xl">El lujo de ser tú.</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Moda femenina en tendencia desde Cartagena
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/productos"
              className="rounded-full bg-primary px-8 py-3 text-sm text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ver catálogo
            </Link>
            <a
              href={greetingWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-primary px-8 py-3 text-sm text-primary transition-colors hover:bg-secondary"
            >
              <MessageCircle className="h-4 w-4" />
              Pedir por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Featured carousel */}
      <section className="relative h-[70vh] w-full bg-secondary/40">
        <p className="page-padding pt-10 text-center font-display text-2xl text-foreground">Destacados</p>
        <div className="relative h-[calc(100%-4rem)] w-full">
          <FeaturedCarousel products={featured} />
        </div>
      </section>

      {/* Brand blurb */}
      <section className="page-padding py-20 text-center">
        <p className="mx-auto max-w-xl font-display text-xl italic text-foreground md:text-2xl">
          "El lujo no siempre está en el precio. A veces está en sentirte increíble siendo tú."
        </p>
        <Link
          to="/nosotros"
          className="mt-6 inline-block text-sm text-primary underline underline-offset-4 hover:opacity-70"
        >
          Conoce nuestra historia
        </Link>
      </section>
    </Layout>
  );
}
