import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '@/data/products';
import { formatCOP } from '@/lib/format';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const hasMultipleImages = product.images.length > 1;

  return (
    <Link
      to={`/producto/${product.slug}`}
      className="group block"
      onMouseEnter={() => hasMultipleImages && setImageIndex(1)}
      onMouseLeave={() => setImageIndex(0)}
    >
      <div className="aspect-[3/4] bg-secondary mb-3 overflow-hidden relative rounded-xl">
        <img
          src={product.images[imageIndex] ?? product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{product.category}</p>
      <p className="text-sm mb-1 line-clamp-1">{product.name}</p>
      <p className="text-sm text-primary font-medium">{formatCOP(product.price)}</p>
    </Link>
  );
}
