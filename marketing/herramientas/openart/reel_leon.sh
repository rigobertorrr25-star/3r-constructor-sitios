#!/bin/bash
# Reel «Hola, somos 3R» con el video del león saludando (apps/web/public/hero-lion.mp4).
# Uso: reel_leon.sh <carpeta con hero-lion.mp4, cara.png y letras .woff> salida.mp4 [champeta|dembow]
set -e
W="$1"; OUT="$2"; DIR=$(dirname "$0"); TMP=$(mktemp -d)
S="$W/sora-latin-800-normal.woff"; M="$W/manrope-latin-400-normal.woff"; B="$W/bebas-neue-latin-400-normal.woff"
python3 "$DIR/musica2.py" "$TMP/m.wav" "${3:-champeta}" 10.5
fade() { echo "alpha='if(lt(t,$1),0,min(1,(t-$1)/0.4))'"; }
row() { # texto precio y t0
  echo "drawtext=fontfile=$M:text='$1':fontsize=50:fontcolor=white:x=120:y=$3:$(fade $4),drawtext=fontfile=$S:text='$2':fontsize=54:fontcolor=white:x=w-120-text_w:y=$(( $3 - 2 )):$(fade $4)"
}
ffmpeg -loglevel error -y -i "$W/hero-lion.mp4" -loop 1 -i "$W/cara.png" -i "$TMP/m.wav" -filter_complex "\
[0:v]scale=1080:1920:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=4,setsar=1,split[a][bb];\
[bb]boxblur=28:2,eq=brightness=-0.35,format=rgba,fade=t=in:st=6:d=0.5:alpha=1[bl];[a][bl]overlay,\
drawtext=fontfile=$S:text='Hola, somos 3R':fontsize=104:fontcolor=white:x=(w-text_w)/2:y=200:$(fade 0.4):enable='lt(t,6)',\
drawtext=fontfile=$M:text='Ponemos tu negocio':fontsize=56:fontcolor=0xd6dcff:x=(w-text_w)/2:y=340:$(fade 1.6):enable='lt(t,6)',\
drawtext=fontfile=$M:text='en el celular de tus clientes':fontsize=56:fontcolor=0xd6dcff:x=(w-text_w)/2:y=410:$(fade 1.6):enable='lt(t,6)',\
$(row 'Página web' '\$550.000' 640 6.4),\
$(row 'Menú con QR' '\$350.000' 760 6.7),\
$(row 'Perfil de Google' '\$150.000' 880 7.0),\
$(row 'Tarjeta de sellos' '\$69.000/mes' 1000 7.3),\
drawtext=fontfile=$B:text='3R':fontsize=150:fontcolor=white:x=520:y=1560:$(fade 8.0),\
drawtext=fontfile=$M:text='WhatsApp 310 790 7194':fontsize=50:fontcolor=white:x=(w-text_w)/2:y=1760:$(fade 8.3)[v0];\
[1:v]scale=150:150,format=rgba,fade=t=in:st=8.0:d=0.4:alpha=1[lg];\
[v0][lg]overlay=x=350:y=1558:enable='gte(t,8)':shortest=0[v]" \
-map "[v]" -map 2:a -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 160k -t 10 -movflags +faststart "$OUT"
rm -rf "$TMP"
