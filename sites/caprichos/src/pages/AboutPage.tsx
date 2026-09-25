import { Helmet } from 'react-helmet-async';
import Layout from '@/components/Layout';
import { PRODUCTS } from '@/data/products';
import { withBase } from '@/lib/assets';

const essence = ['Exclusividad', 'Feminidad', 'El placer de darse un gusto', 'Confianza', 'Felicidad', 'Moda y tendencias'];

export default function AboutPage() {
  return (
    <Layout>
      <Helmet>
        <title>Nosotros — Caprichos</title>
        <meta name="description" content="Conoce la historia de Caprichos, tienda virtual de moda femenina en Cartagena. El lujo de ser tú." />
      </Helmet>

      <section className="min-h-[calc(100vh-4rem)]">
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-4rem)]">
          <div className="h-72 md:h-auto">
            <img
              src={PRODUCTS[4].images[0]}
              alt="Caprichos"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex items-center page-padding py-16 md:py-0">
            <div className="max-w-md">
              <img src={withBase('/brand/logo.jpg')} alt="Caprichos" className="h-20 w-20 rounded-full object-cover mb-6" />
              <h1 className="font-display text-2xl mb-6">Nosotros</h1>

              <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                <div>
                  <h2 className="text-foreground font-display text-lg mb-2">¿Qué es Caprichos?</h2>
                  <p>
                    Caprichos es una tienda virtual de Cartagena especializada en moda femenina en tendencia.
                    Ofrecemos una selección versátil de prendas, calzado y accesorios pensados para mujeres
                    que disfrutan sentirse lindas, seguras y auténticas.
                  </p>
                  <p className="mt-3">
                    En Caprichos encontrarás un poquito de todo para complementar tu estilo: jeans, vestidos,
                    faldas, shorts, camisetas, conjuntos, bodys, tops, corsets, ropa de playa, bolsos y calzado.
                  </p>
                </div>

                <div>
                  <h2 className="text-foreground font-display text-lg mb-2">Nuestra historia</h2>
                  <p>
                    Caprichos nació de una situación muy sencilla: constantemente nos preguntaban dónde
                    comprábamos nuestra ropa y de dónde eran nuestras prendas. A partir de esas preguntas surgió
                    la idea de compartir nuestro gusto por la moda y comenzar a vender las prendas que tanto
                    llamaban la atención.
                  </p>
                  <p className="mt-3">
                    Así nació Caprichos: una tienda virtual creada desde el amor por la moda femenina y con el
                    propósito de ofrecer productos que hagan sentir especial a cada mujer.
                  </p>
                </div>

                <div>
                  <h2 className="text-foreground font-display text-lg mb-2">¿Por qué Caprichos?</h2>
                  <p>
                    El nombre nace de una idea muy femenina: las mujeres somos caprichosas y está bien darnos
                    nuestros gustos. Porque comprar algo que nos encanta, sentirnos bonitas y consentirnos
                    también es una forma de felicidad. Para nosotros, un capricho cumplido es una pequeña dosis
                    de felicidad.
                  </p>
                </div>

                <div>
                  <h2 className="text-foreground font-display text-lg mb-3">Nuestra esencia</h2>
                  <div className="flex flex-wrap gap-2">
                    {essence.map((word) => (
                      <span
                        key={word}
                        className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-foreground font-display text-lg mb-2">Nuestra promesa</h2>
                  <p className="italic">
                    "El lujo no siempre está en el precio. A veces está en sentirte increíble siendo tú."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
