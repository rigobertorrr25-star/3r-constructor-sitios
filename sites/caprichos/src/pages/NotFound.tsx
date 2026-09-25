import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";

export default function NotFound() {
  return (
    <Layout>
      <Helmet>
        <title>Página no encontrada — Caprichos</title>
      </Helmet>

      <section className="min-h-[calc(100vh-4rem)] flex items-center justify-center page-padding">
        <div className="text-center">
          <h1 className="font-display text-3xl mb-4">404</h1>
          <p className="text-sm text-muted-foreground mb-8">
            No encontramos la página que buscas.
          </p>
          <Link
            to="/"
            className="text-sm text-primary underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </Layout>
  );
}
