import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import Layout from '@/components/Layout';
import ProductGrid from '@/components/ProductGrid';
import FilterPanel from '@/components/FilterPanel';
import { PRODUCTS, Product } from '@/data/products';
import { SlidersHorizontal } from 'lucide-react';

export default function ProductsPage() {
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(PRODUCTS);
  const [filterOpen, setFilterOpen] = useState(false);

  const handleFilterChange = useCallback((filtered: Product[]) => {
    setFilteredProducts(filtered);
  }, []);

  return (
    <Layout>
      <Helmet>
        <title>Todos los productos — Caprichos</title>
        <meta name="description" content="Explora todo el catálogo de Caprichos: vestidos, bodys, corsets, jeans, camisetas y más." />
      </Helmet>

      <section className="page-padding py-16 min-h-screen">
        <div className="mb-12">
          <h1 className="font-display text-2xl">Todos los productos</h1>
        </div>

        <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2 text-sm hover:opacity-60 transition-opacity"
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
            Filtros
            {filteredProducts.length !== PRODUCTS.length && (
              <span className="text-muted-foreground">({filteredProducts.length})</span>
            )}
          </button>
          <span className="text-sm text-muted-foreground">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        <ProductGrid products={filteredProducts} />
      </section>

      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        products={PRODUCTS}
        onFilterChange={handleFilterChange}
      />
    </Layout>
  );
}
