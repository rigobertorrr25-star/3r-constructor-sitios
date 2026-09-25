import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORIES, Category, Product } from '@/data/products';

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onFilterChange: (filtered: Product[]) => void;
}

type SortOption = 'default' | 'price-low' | 'price-high';

export default function FilterPanel({ open, onClose, products, onFilterChange }: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('default');

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
      closeButtonRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else if (isVisible) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
        document.body.style.overflow = '';
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    let filtered = [...products];

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((p) => selectedCategories.includes(p.category));
    }

    if (sortBy === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    }

    onFilterChange(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, selectedCategories, sortBy]);

  const toggleCategory = (category: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSortBy('default');
  };

  const hasActiveFilters = selectedCategories.length > 0 || sortBy !== 'default';

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className={`absolute inset-0 bg-foreground/20 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={`absolute top-0 left-0 h-full w-[320px] max-w-[85vw] bg-background ${isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
      >
        <div className="flex flex-col h-full">
          <div className="nav-height flex items-center justify-between page-padding border-b border-border">
            <span className="text-sm font-medium">Filtros</span>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 -mr-2 hover:opacity-60 transition-opacity"
              aria-label="Cerrar filtros"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 page-padding">
            <div className="mb-8">
              <h3 className="text-xs uppercase text-muted-foreground mb-4">Ordenar por</h3>
              <div className="space-y-3">
                {[
                  { value: 'default', label: 'Recomendado' },
                  { value: 'price-low', label: 'Precio: menor a mayor' },
                  { value: 'price-high', label: 'Precio: mayor a menor' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 text-sm cursor-pointer hover:opacity-60 transition-opacity"
                  >
                    <input
                      type="radio"
                      name="sort"
                      checked={sortBy === option.value}
                      onChange={() => setSortBy(option.value as SortOption)}
                      className="w-3 h-3 accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs uppercase text-muted-foreground mb-4">Categoría</h3>
              <div className="space-y-3">
                {CATEGORIES.map((category) => (
                  <label
                    key={category}
                    className="flex items-center gap-3 text-sm cursor-pointer hover:opacity-60 transition-opacity"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      className="w-3 h-3 accent-primary"
                    />
                    {category}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="page-padding py-4 border-t border-border flex gap-4">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex-1 py-3 rounded-full text-sm border border-border hover:border-primary transition-colors"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-full text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
