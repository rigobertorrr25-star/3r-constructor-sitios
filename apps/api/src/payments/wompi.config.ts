import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Llaves de Wompi (panel de Wompi → Desarrolladores). Sin llave pública y secreto de integridad, el pago
 * en línea queda apagado y el cliente solo ve las instrucciones de pago manual.
 *
 * - WOMPI_PUBLIC_KEY: pub_test_… (pruebas) o pub_prod_… (cobros reales). Define también a qué API se consulta.
 * - WOMPI_INTEGRITY_SECRET: firma cada botón de pago para que nadie pueda cambiar el monto.
 * - WOMPI_EVENTS_SECRET: verifica que los avisos de pago (webhook) vienen de Wompi.
 * - WOMPI_API_URL: opcional, solo para pruebas automáticas.
 */
@Injectable()
export class WompiConfig {
  readonly publicKey: string;
  readonly integritySecret: string;
  readonly eventsSecret: string;
  readonly apiUrl: string;
  readonly checkoutUrl = 'https://checkout.wompi.co/p/';
  readonly webOrigin: string;

  constructor(config: ConfigService) {
    this.publicKey = config.get<string>('WOMPI_PUBLIC_KEY') ?? '';
    this.integritySecret = config.get<string>('WOMPI_INTEGRITY_SECRET') ?? '';
    this.eventsSecret = config.get<string>('WOMPI_EVENTS_SECRET') ?? '';
    const production = this.publicKey.startsWith('pub_prod_');
    this.apiUrl = (config.get<string>('WOMPI_API_URL') ?? (production ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1')).replace(/\/$/, '');
    this.webOrigin = (config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  /** El botón de pago solo aparece si hay con qué firmarlo. */
  get enabled() {
    return this.publicKey !== '' && this.integritySecret !== '';
  }
}
