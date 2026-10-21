import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// La imagen que sale al compartir el enlace (WhatsApp, redes): el león de 3R y «3R» en Bebas Neue, como el logo.
export default async function OpengraphImage() {
  const asset = (file: string) => readFile(join(process.cwd(), 'assets', file));
  const [lion, bebas, sora, manrope] = await Promise.all([
    readFile(join(process.cwd(), 'assets/og-leon.jpg'), 'base64'),
    asset('bebas-neue-latin-400-normal.woff'),
    asset('sora-latin-800-normal.woff'),
    asset('manrope-latin-400-normal.woff'),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000103',
          backgroundImage: 'radial-gradient(circle at 18% 20%, rgba(138,155,255,0.35), transparent 55%), radial-gradient(circle at 85% 75%, rgba(255,134,219,0.25), transparent 50%)',
          fontFamily: 'Manrope',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            color: '#f2f6f8',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/jpeg;base64,${lion}`} alt="" width={96} height={96} style={{ borderRadius: 27 }} />
          <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: 92, fontWeight: 400, letterSpacing: 2, lineHeight: 1 }}>3R</div>
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontFamily: 'Sora', fontSize: 64, fontWeight: 800, color: '#f2f6f8', letterSpacing: -2, textAlign: 'center' }}>
          Tu página web profesional
        </div>
        <div style={{ display: 'flex', marginTop: 16, fontSize: 30, color: '#a5abb5' }}>hecha por nosotros, de principio a fin</div>
      </div>
    ),
    { ...size, fonts: [
        { name: 'Bebas Neue', data: bebas, weight: 400, style: 'normal' },
        { name: 'Sora', data: sora, weight: 800, style: 'normal' },
        { name: 'Manrope', data: manrope, weight: 400, style: 'normal' },
      ], },
  );
}
