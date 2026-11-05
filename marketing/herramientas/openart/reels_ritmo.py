"""Dos reels con cortes al ritmo y música caribeña (musica2.py).
Uso: python3 reels_ritmo.py <carpeta logo (fotos, cara.png, e1.png, letras)> <carpeta fotos normales> <salida>
  - cartagena.mp4: champeta, recorrido de fotos a pantalla completa con movimiento distinto en cada escena.
  - precios.mp4: dembow, el león saluda y luego cada precio llena la pantalla con un color de la marca."""
import subprocess, sys, os

LOGO, NORM, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
SORA = f'{LOGO}/sora-latin-800-normal.woff'
MAN = f'{LOGO}/manrope-latin-400-normal.woff'
FPS = 30


def ff(*args):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *args], check=True)


def esc(t):
    return t.replace(':', r'\:').replace("'", r"\'").replace('$', r'\$')


def band(text, d, y=1460):
    return (f"drawbox=x=0:y={y - 40}:w=1080:h=200:color=black@0.62:t=fill,"
            f"drawtext=fontfile='{SORA}':text='{esc(text)}':fontsize=58:fontcolor=white:x=(w-text_w)/2:y={y + 20}:"
            f"alpha='min(1,t/0.25)'")


def scene_photo(img, d, move, text, out, pre=''):
    n = int(round(d * FPS))
    # imagen a 1.2x de lo necesario para poder moverla
    base = "scale=w='if(gt(a,1080/1920),-2,1296)':h='if(gt(a,1080/1920),2304,-2)'"
    if move == 'zin':
        mv = f"zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s=1080x1920:fps={FPS}"
    elif move == 'zout':
        mv = f"zoompan=z='1.2-0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s=1080x1920:fps={FPS}"
    elif move == 'pr':
        mv = f"fps={FPS},crop=1080:1920:x='(iw-1080)*t/{d}':y='(ih-1920)/2'"
    else:  # pl
        mv = f"fps={FPS},crop=1080:1920:x='(iw-1080)*(1-t/{d})':y='(ih-1920)/2'"
    ff('-loop', '1', '-t', f'{d:.3f}', '-i', img, '-vf', f"{pre}{base},{mv},setsar=1,{band(text, d)},format=yuv420p",
       '-frames:v', str(n), '-r', str(FPS), '-c:v', 'libx264', '-crf', '18', out)


def scene_color(bg, fg, name, price, d, out, note=''):
    n = int(round(d * FPS))
    vf = (f"drawtext=fontfile='{MAN}':text='{esc(name)}':fontsize=84:fontcolor={fg}:x=(w-text_w)/2:y=700,"
          f"drawtext=fontfile='{SORA}':text='{esc(price)}':fontsize=200:fontcolor={fg}:x=(w-text_w)/2:y=820")
    if note:
        vf += f",drawtext=fontfile='{MAN}':text='{esc(note)}':fontsize=60:fontcolor={fg}:x=(w-text_w)/2:y=1080"
    ff('-f', 'lavfi', '-i', f'color=c={bg}:s=1080x1920:r={FPS}:d={d:.3f}', '-vf', vf + ',format=yuv420p',
       '-frames:v', str(n), '-c:v', 'libx264', '-crf', '18', out)


def scene_still(img, d, out):
    n = int(round(d * FPS))
    ff('-loop', '1', '-t', f'{d:.3f}', '-i', img, '-vf',
       f"scale=1080:1920,fps={FPS},fade=t=in:st=0:d=0.3,format=yuv420p", '-frames:v', str(n), '-c:v', 'libx264', '-crf', '18', out)


def join(parts, music, total, out):
    lst = f'{OUT}/lista.txt'
    with open(lst, 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    wav = f'{OUT}/{os.path.basename(out)}.wav'
    subprocess.run(['python3', f'{HERE}/musica2.py', wav, music, str(total + 0.5)], check=True)
    ff('-f', 'concat', '-safe', '0', '-i', lst, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '19',
       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-af', f'afade=t=out:st={total - 0.6}:d=0.6',
       '-t', f'{total:.3f}', '-movflags', '+faststart', out)


# --- Reel champeta (116 BPM: cada escena dura 4 tiempos) ---
beat = 60 / 116
D = 4 * beat
scenes = [
    (f'{LOGO}/leon-cartagena.png', 'zin', 'Cartagena te busca en el celular', ''),
    (f'{NORM}/n1-menu-qr.png', 'pr', 'Tu carta con QR por $350.000', 'crop=1856:1560:0:744,'),
    (f'{NORM}/n4-google.png', 'zout', 'Apareces en Google por $150.000', 'crop=1856:1560:0:744,'),
    (f'{NORM}/n2-tienda-navidad.png', 'pl', 'Y vendes también por internet', 'crop=1856:1560:0:744,'),
]
parts = []
for i, (img, mv, txt, pre) in enumerate(scenes):
    p = f'{OUT}/c{i}.mp4'; scene_photo(img, D, mv, txt, p, pre); parts.append(p)
p = f'{OUT}/c-end.mp4'; scene_still(f'{LOGO}/e1.png', 6 * beat, p); parts.append(p)
join(parts, 'champeta', 4 * D + 6 * beat, f'{OUT}/cartagena.mp4')

# --- Reel dembow (96 BPM: cada precio dura 2 tiempos) ---
beat = 60 / 96
parts = []
p = f'{OUT}/d0.mp4'
ff('-i', f'{LOGO}/hero-lion.mp4', '-t', f'{4 * beat:.3f}', '-vf',
   f"scale=1080:1920,fps={FPS},drawtext=fontfile='{SORA}':text='¿Cuánto cuesta?':fontsize=110:fontcolor=white:"
   f"x=(w-text_w)/2:y=230:alpha='min(1,t/0.3)',format=yuv420p", '-an', '-c:v', 'libx264', '-crf', '18', p)
parts.append(p)
prices = [('0x8a9bff', '0x060815', 'Página web', '$550.000', ''),
          ('0xff86db', '0x180613', 'Menú con QR', '$350.000', ''),
          ('0xf7cb58', '0x1a1405', 'Perfil de Google', '$150.000', ''),
          ('0xd6b0ff', '0x11081b', 'Tarjeta de sellos', '$69.000', 'al mes')]
for i, (bg, fg, name, price, note) in enumerate(prices):
    p = f'{OUT}/d{i + 1}.mp4'; scene_color(bg, fg, name, price, 2 * beat, p, note); parts.append(p)
p = f'{OUT}/d-end.mp4'; scene_still(f'{LOGO}/e1.png', 4 * beat, p); parts.append(p)
join(parts, 'dembow', 4 * beat + 8 * beat + 4 * beat, f'{OUT}/precios.mp4')
print('listo')
