#!/bin/bash
# Video normal: clip + cierre simple (la escena se oscurece y aparece el precio). Uso: armar_normal.sh entrada.mp4 salida.mp4
set -e
IN="$1"; OUT="$2"; DIR=$(dirname "$0"); TMP=$(mktemp -d)
B=/usr/share/fonts/opentype/inter/Inter-Bold.otf
L=/usr/share/fonts/opentype/inter/Inter-Regular.otf
python3 "$DIR/musica.py" "$TMP/m.wav" cine 7.6
ffmpeg -loglevel error -y -i "$IN" -i "$TMP/m.wav" -filter_complex "\
[0:v]scale=1080:1920:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=2.6,setsar=1,\
eq=brightness='if(gte(t,5),-0.25*min(1,(t-5)/0.5),0)':eval=frame,\
drawtext=fontfile=$B:text='Menú con QR':fontsize=96:fontcolor=white:x=(w-text_w)/2:y=780:alpha='if(lt(t,5.3),0,min(1,(t-5.3)/0.4))',\
drawtext=fontfile=$B:text='\$350.000':fontsize=130:fontcolor=white:x=(w-text_w)/2:y=900:alpha='if(lt(t,5.5),0,min(1,(t-5.5)/0.4))',\
drawtext=fontfile=$L:text='3R · WhatsApp 310 790 7194':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=1080:alpha='if(lt(t,5.8),0,min(1,(t-5.8)/0.4))'[v]" \
-map "[v]" -map 1:a -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 160k -t 7.6 -movflags +faststart "$OUT"
rm -rf "$TMP"
