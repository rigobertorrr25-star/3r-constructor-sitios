"""Arma los 3 videos de OpenArt con cierre y música, cada uno en su estilo.
Uso: python3 armar.py <carpeta con v1-cine.mp4, v2-plastilina.mp4, v3-dibujo.mp4> <carpeta de letras> <salida>"""
import subprocess, sys, os

SRC, FONTS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
INTER = '/usr/share/fonts/opentype/inter/Inter-Light.otf'
INTER_B = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
PLAY = f'{FONTS}/playfair-display-latin-400-normal.woff'
FRED = f'{FONTS}/fredoka-latin-700-normal.woff'
CAV = f'{FONTS}/caveat-latin-700-normal.woff'
END = 2.8
TOTAL = 5.04 + END
WA = '3R · WhatsApp 310 790 7194'


def fade_in(t0, d=0.5):
    return f"alpha='if(lt(t,{t0}),0,min(1,(t-{t0})/{d}))'"


def txt(font, text, size, color, y, t0, extra=''):
    text = text.replace(':', r'\:').replace("'", r"\'")
    return (f"drawtext=fontfile='{font}':text='{text}':fontsize={size}:fontcolor={color}:"
            f"x=(w-text_w)/2:y={y}:{fade_in(t0)}{extra}")


def base():
    return (f"[0:v]scale=1080:1920:flags=lanczos,fps=30,"
            f"tpad=stop_mode=clone:stop_duration={END},setsar=1")


def run(name, vf, estilo):
    wav = f'{OUT}/{name}.wav'
    subprocess.run(['python3', f'{HERE}/musica.py', wav, estilo, str(TOTAL)], check=True)
    cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-i', f'{SRC}/{name}.mp4', '-i', wav,
           '-filter_complex', vf, '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium',
           '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-t', str(TOTAL),
           '-movflags', '+faststart', f'{OUT}/{name}.mp4']
    subprocess.run(cmd, check=True)
    print('listo', name)


# V1 cine: franjas negras de película, grano, fundido a negro y título de cierre
vf1 = (base() + ",noise=alls=6:allf=t,drawbox=x=0:y=0:w=1080:h=170:color=black:t=fill,"
       "drawbox=x=0:y=1750:w=1080:h=170:color=black:t=fill,fade=t=out:st=5.0:d=0.5,"
       + txt(PLAY, 'Mientras cocinas,', 76, 'white', 760, 5.4) + ','
       + txt(PLAY, 'tu página recibe el pedido.', 64, 'white', 860, 5.6) + ','
       + txt(INTER, 'Página web desde $550.000', 54, '0xE8C27A', 1030, 6.1) + ','
       + txt(INTER, WA, 44, 'white@0.85', 1110, 6.4) + '[v]')

# V2 plastilina: frase arriba con sombra de color, luego panel rojo que sube con el precio
slide = "if(lt(t,5.0),1920,max(0,1920-(t-5.0)/0.35*1920))"
vf2 = (base() + "[b];color=c=0xE0352B:s=1080x1920:d=8[p];"
       f"[b][p]overlay=x=0:y='{slide}'[c];[c]"
       + f"drawtext=fontfile='{FRED}':text='Tu celular, lleno de pedidos':fontsize=70:fontcolor=0xFFD23F:"
         "shadowcolor=0x7A1410:shadowx=5:shadowy=6:x=(w-text_w)/2:y=230:"
         "enable='between(t,0.6,5.0)'" + ','
       + txt(FRED, 'Menú con QR', 110, 'white', 700, 5.35) + ','
       + txt(FRED, '$350.000', 190, '0xFFD23F', 850, 5.55, ':shadowcolor=0x7A1410:shadowx=6:shadowy=8') + ','
       + txt(FRED, 'Tus clientes piden solos, desde la mesa', 46, 'white', 1110, 5.9) + ','
       + txt(FRED, WA, 48, 'white', 1230, 6.2) + '[v]')

# V3 dibujo: papel que aparece y letras a mano que se "escriben" de izquierda a derecha
paper = '0xE9E8E4'
vf3 = (base() + f"[b];color=c={paper}:s=1080x1920:d=8,format=rgba,fade=t=in:st=4.7:d=0.5:alpha=1[pp];"
       "[b][pp]overlay[c];[c]"
       + f"drawtext=fontfile='{CAV}':text='Que te encuentren en Google':fontsize=96:fontcolor=0x2B2B2B:x=(w-text_w)/2:y=720:enable='gte(t,5.5)',"
       + f"drawtext=fontfile='{CAV}':text='Perfil de Google y reseñas\\: $150.000':fontsize=72:fontcolor=0xD9573B:x=(w-text_w)/2:y=880:enable='gte(t,5.5)',"
       + f"drawtext=fontfile='{CAV}':text='{WA}':fontsize=60:fontcolor=0x2B2B2B:x=(w-text_w)/2:y=1020:enable='gte(t,5.5)'"
       + "[t];"
       + f"color=c={paper}:s=1080x150:d=8[m1];color=c={paper}:s=1080x120:d=8[m2];color=c={paper}:s=1080x110:d=8[m3];"
       # antes del cierre las máscaras tapan todo el texto; después se corren a la derecha
       "[t][m1]overlay=x='if(lt(t,5.5),0,min(1080,(t-5.5)/0.9*1080))':enable='gte(t,5.5)':y=700[t1];"
       "[t1][m2]overlay=x='if(lt(t,6.2),0,min(1080,(t-6.2)/0.8*1080))':enable='gte(t,5.5)':y=870[t2];"
       "[t2][m3]overlay=x='if(lt(t,6.8),0,min(1080,(t-6.8)/0.6*1080))':enable='gte(t,5.5)':y=1005,"
       # fuera del cierre, el texto no debe verse sobre el video
       "format=yuv420p[v]")

run('v1-cine', vf1, 'cine')
run('v2-plastilina', vf2, 'plastilina')
run('v3-dibujo', vf3, 'dibujo')
