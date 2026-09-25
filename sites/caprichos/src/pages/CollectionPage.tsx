import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import Layout from '@/components/Layout';
import ProductGrid from '@/components/ProductGrid';
import { CATEGORIES, getProductsByCategory } from '@/data/products';

export default function CollectionPage() {
  const { category: categoryParam } = useParams<{ category: string }>();
  const category = CATEGORIES.find((c) => c.toLowerCase() === categoryParam?.toLowerCase());

  if (!category) {
    return (
      <Layout>
        <div className="page-padding py-20 text-center">
          <p className="text-sm text-muted-foreground mb-4">No encontramos esta categoría</p>
          <Link to="/categorias" className="text-sm text-primary underline underline-offset-4">
            Ver todas las categorías
          </Link>
        </div>
      </Layout>
    );
  }

  const products = getProductsByCategory(category);

  return (
    <Layout>
      <Helmet>
        <title>{category} — Caprichos</title>
        <meta name="description" content={`Explora ${category.toLowerCase()} en Caprichos, moda femenina en tendencia desde Cartagena.`} />
      </Helmet>

      <div className="page-padding py-12">
        <Link
          to="/categorias"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Categorías
        </Link>
      </div>

      <section className="page-padding pb-12">
        <h1 className="font-display text-2xl mb-8">{category}</h1>
        <ProductGrid products={products} />
      </section>
    </Layout>
  );
}
