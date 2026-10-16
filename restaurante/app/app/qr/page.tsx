import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { requireStaff } from '@/lib/auth';
import { listTables } from '@/lib/store';
import { query } from '@/lib/db';
import { PublicSettingsForm } from '@/components/public-settings';
import { PrintButton } from '@/components/print-button';
import { PageTitle, card, quietButton } from '@/components/ui';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const qr = (url: string) => QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#000000', light: '#ffffff' } });

export default async function QrPage() {
  const staff = await requireStaff('locations.manage');
  const h = await headers();
  const t = await getT();
  const base = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const [settings] = await query<{ phone: string | null; reservations: boolean }>(`SELECT public_phone AS phone, reservations_enabled AS reservations FROM businesses WHERE id = $1`, [staff.businessId]);
  const tables = await listTables(staff);
  const menuUrl = `${base}/m/${staff.businessSlug}`;
  const bookUrl = `${base}/r/${staff.businessSlug}`;
  const [menuQr, bookQr] = await Promise.all([qr(menuUrl), qr(bookUrl)]);
  const tableQrs = await Promise.all(tables.map(async (tb) => ({ number: tb.number, src: await qr(`${menuUrl}?mesa=${encodeURIComponent(tb.number)}`) })));
  return (
    <div className="space-y-6">
      <PageTitle title={t('QR y enlaces')} text={t('La carta pública (para el QR de las mesas) y el enlace para que los clientes pidan reserva. Imprime esta página o comparte los enlaces por WhatsApp e Instagram.')} />
      <section className={`${card} print:hidden`}>
        <h2 className="font-display text-[18px] font-bold">{t('Datos públicos')}</h2>
        <div className="mt-4">
          <PublicSettingsForm phone={settings.phone ?? ''} reservationsEnabled={settings.reservations} />
        </div>
      </section>
      <div className="print:hidden">
        <PrintButton className={quietButton} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          { title: t('Carta'), alt: t('Código QR de la carta'), url: menuUrl, src: menuQr },
          { title: t('Reservas'), alt: t('Código QR de reservas'), url: bookUrl, src: bookQr },
        ].map((x) => (
          <section key={x.title} className="rounded-[22px] bg-white p-5 text-center text-black">
            <h2 className="font-display text-[20px] font-bold">{x.title}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.src} alt={x.alt} className="mx-auto mt-3 w-full max-w-[240px]" />
            <p className="mt-2 break-all text-[12.5px]">{x.url}</p>
          </section>
        ))}
      </div>
      {tableQrs.length ? (
        <section>
          <h2 className="font-display text-[19px] font-bold print:text-black">{t('Un QR por mesa')}</h2>
          <p className="text-[13.5px] text-muted-foreground print:hidden">{t('Abren la carta mostrando el número de la mesa.')}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tableQrs.map((tq) => (
              <div key={tq.number} className="break-inside-avoid rounded-[18px] bg-white p-3 text-center text-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tq.src} alt={t('QR de la mesa {n}', { n: tq.number })} className="mx-auto w-full max-w-[150px]" />
                <p className="mt-1 font-display text-[16px] font-bold">{t('Mesa {n}', { n: tq.number })}</p>
                <p className="text-[11px]">{staff.businessName}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
