import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { Product } from "@/data/products";
import { formatCOP } from "@/lib/format";

interface FeaturedCarouselProps {
  products: Product[];
}

export default function FeaturedCarousel({ products }: FeaturedCarouselProps) {
  const navigate = useNavigate();
  const [appeared, setAppeared] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const wheelTargetRef = useRef<HTMLDivElement>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    slidesToScroll: 1,
    skipSnaps: false,
    containScroll: false,
    duration: 28,
  });

  const slides = useMemo(() => {
    if (products.length === 0) return [] as Product[];
    const min = 7;
    const times = products.length >= min ? 1 : Math.ceil(min / products.length);
    return Array.from({ length: times }).flatMap(() => products);
  }, [products]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    setTimeout(() => setAppeared(true), 50);
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
  }, [emblaApi, slides.length]);

  useEffect(() => {
    const target = wheelTargetRef.current;
    if (!target || !emblaApi) return;

    let locked = false;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (locked) return;
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 6) return;

      locked = true;
      if (delta > 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();

      window.setTimeout(() => {
        locked = false;
      }, 260);
    };

    target.addEventListener("wheel", onWheel, { passive: false });
    return () => target.removeEventListener("wheel", onWheel);
  }, [emblaApi]);

  useEffect(() => {
    const el = wheelTargetRef.current;
    if (!el || !appeared) return;

    const active = document.activeElement;
    if (active === document.body) el.focus({ preventScroll: true });
  }, [appeared]);

  if (products.length === 0) return null;

  const activeProductId = slides[selectedIndex]?.id;

  return (
    <div
      ref={wheelTargetRef}
      tabIndex={0}
      role="region"
      aria-label="Carrusel de destacados"
      onKeyDown={(e) => {
        if (!emblaApi) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          emblaApi.scrollPrev();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          emblaApi.scrollNext();
        } else if (e.key === "Enter") {
          e.preventDefault();
          const activeProduct = slides[selectedIndex];
          if (activeProduct) {
            navigate(`/producto/${activeProduct.slug}`);
          }
        }
      }}
      className="absolute inset-0 flex items-center overflow-hidden border-none outline-none focus:outline-none focus:ring-0"
    >
      <div
        className={`w-full transition-all duration-700 ease-out ${
          appeared ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <div className="w-full" ref={emblaRef}>
          <div className="flex items-center cursor-grab active:cursor-grabbing">
            {slides.map((product, index) => {
              const isActive = product.id === activeProductId;

              const handleClick = (e: React.MouseEvent) => {
                if (!isActive && emblaApi) {
                  e.preventDefault();
                  emblaApi.scrollTo(index);
                }
              };

              return (
                <div key={`${product.id}-${index}`} className="flex-none px-8 md:px-16 lg:px-24">
                  <div
                    className={`relative transition-[transform,opacity] duration-500 ease-out ${
                      isActive ? "opacity-100 scale-100" : "opacity-40 scale-[0.5]"
                    }`}
                  >
                    <Link
                      to={`/producto/${product.slug}`}
                      className={`block relative group ${isActive ? "cursor-pointer" : "cursor-default"}`}
                      onClick={handleClick}
                    >
                      <div className="w-64 md:w-80 lg:w-96 aspect-[3/4] relative rounded-2xl overflow-hidden bg-secondary">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          draggable={false}
                          loading="lazy"
                        />
                      </div>

                      <div
                        className={`absolute -bottom-9 left-0 right-0 text-center transition-all duration-300 ${
                          isActive ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                        }`}
                      >
                        <p className="text-sm text-foreground">{product.name}</p>
                        <p className="text-sm text-primary mt-0.5">{formatCOP(product.price)}</p>
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
