import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";

const SitemapPage = () => {
  const sections = [
    {
      title: "Tienda",
      links: [
        { label: "Todos los productos", href: "/productos" },
        { label: "Categorías", href: "/categorias" },
        { label: "Tu pedido", href: "/carrito" },
      ],
    },
    {
      title: "Empresa",
      links: [
        { label: "Nosotros", href: "/nosotros" },
        { label: "Contacto", href: "/contacto" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Términos y condiciones", href: "/terminos" },
        { label: "Política de privacidad", href: "/privacidad" },
        { label: "Política de cookies", href: "/cookies" },
        { label: "Envíos y devoluciones", href: "/envios" },
      ],
    },
  ];

  return (
    <Layout>
      <Helmet>
        <title>Mapa del sitio — Caprichos</title>
        <meta name="description" content="Mapa del sitio de Caprichos. Encuentra todas las páginas y secciones." />
      </Helmet>

      <main className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-2xl mb-8">Mapa del sitio</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-medium mb-4">{section.title}</h2>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default SitemapPage;
