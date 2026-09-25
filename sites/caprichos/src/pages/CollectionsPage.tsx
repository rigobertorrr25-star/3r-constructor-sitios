import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronRight } from 'lucide-react';
import Layout from '@/components/Layout';
import { CATEGORIES, COMING_SOON_CATEGORIES, getProductsByCategory } from '@/data/products';

export default function CollectionsPage() {
  return (
    <Layout>
      <Helmet>
        <title>Categorías — Caprichos</title>
        <meta name="description" content="Explora las categorías de Caprichos: vestidos, bodys, corsets, jeans, camisetas, tops, faldas y shorts." />
      </Helmet>

      <section className="page-padding pb-16">
        <div className="py-12">
          <h1 className="font-display text-2xl">Categorías</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {CATEGORIES.map((category) => {
            const products = getProductsByCategory(category);
            const cover = products[0];

            return (
              <Link
                key={category}
                to={`/categoria/${category.toLowerCase()}`}
                className="group block"
              >
                <div className="aspect-[3/4] bg-secondary mb-3 overflow-hidden rounded-xl relative">
                  {cover && (
                    <img
                      src={cover.images[0]}
                      alt={category}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-background">
                    <span className="font-display text-lg">{category}</span>
                    <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{products.length} productos</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Muy pronto: {COMING_SOON_CATEGORIES.join(' · ')} 👀
          </p>
        </div>
      </section>
    </Layout>
  );
}
