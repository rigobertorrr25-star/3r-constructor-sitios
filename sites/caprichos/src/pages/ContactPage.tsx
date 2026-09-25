import { Helmet } from 'react-helmet-async';
import { Instagram, MapPin, MessageCircle, Music2 } from 'lucide-react';
import Layout from '@/components/Layout';
import { greetingWhatsAppUrl } from '@/lib/whatsapp';

export default function ContactPage() {
  return (
    <Layout>
      <Helmet>
        <title>Contacto — Caprichos</title>
        <meta name="description" content="Escríbenos a Caprichos por WhatsApp, Instagram o TikTok. Estamos en Cartagena, Colombia." />
      </Helmet>

      <section className="page-padding py-20">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="font-display text-2xl mb-2">Contacto</h1>
          <p className="text-sm text-muted-foreground mb-10">
            ¿Tienes una pregunta o quieres hacer un pedido? Escríbenos, con gusto te ayudamos.
          </p>

          <div className="space-y-4">
            <a
              href={greetingWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-14 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-5 h-5" />
              Escríbenos por WhatsApp
            </a>

            <a
              href="https://www.instagram.com/ccaprichos"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-14 rounded-full border border-border text-sm hover:bg-secondary transition-colors"
            >
              <Instagram className="w-5 h-5" />
              @ccaprichos en Instagram
            </a>

            <a
              href="https://www.tiktok.com/@ccaprichos0"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-14 rounded-full border border-border text-sm hover:bg-secondary transition-colors"
            >
              <Music2 className="w-5 h-5" />
              @ccaprichos0 en TikTok
            </a>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            Cartagena, Colombia
          </div>
        </div>
      </section>
    </Layout>
  );
}
