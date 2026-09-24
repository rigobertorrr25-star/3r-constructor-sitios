import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
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
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 40,
            fontWeight: 800,
            color: '#f2f6f8',
            letterSpacing: -1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 18,
              background: '#ffffff',
              color: '#000103',
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            3R
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 64, fontWeight: 800, color: '#f2f6f8', letterSpacing: -2, textAlign: 'center' }}>
          Tu página web profesional
        </div>
        <div style={{ display: 'flex', marginTop: 16, fontSize: 30, color: '#a5abb5' }}>hecha por nosotros, de principio a fin</div>
      </div>
    ),
    { ...size },
  );
}
