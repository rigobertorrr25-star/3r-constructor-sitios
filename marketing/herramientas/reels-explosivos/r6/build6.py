import subprocess
P='pf.woff'; MAG='0xe6157f'
def stamp(text,size,y,color,ts=0.0):
    return (f"drawtext=fontfile={P}:text='{text}':fontsize='{size}*(1+1.2*exp(-max(0,t-{ts})*14))':fontcolor={color}"
            f":alpha='min(1,max(0,t-{ts})/0.08)':x='(w-text_w)/2':y='{y}-text_h/2':enable='gte(t,{ts})'")
flash=lambda ts=0,d=0.07: f"drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(t,{ts},{ts+d})'"
def run(args): subprocess.run(['ffmpeg','-v','error','-y']+args,check=True)
def card(name,dur,bg,parts):
    run(['-f','lavfi','-i',f'color=c={bg}:s=1080x1920:d={dur}:r=30','-vf',",".join([flash()]+[stamp(*q) for q in parts])+',format=yuv420p','-c:v','libx264','-crf','16',name])
def clip(name,start,dur,parts=(),top=False):
    vf=f"fps=30,scale=1080:1920,zoompan=z='1.08-0.0025*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"+flash(0,0.05)
    if top: vf+=",drawbox=x=0:y=0:w=iw:h=330:color=black@0.62:t=fill"
    for q in parts: vf+=","+stamp(*q)
    run(['-ss',str(start),'-t',str(dur),'-i','raw.mp4','-vf',vf+',format=yuv420p','-an','-c:v','libx264','-crf','16','-preset','fast',name])
card('a1.mp4',0.6,'black',[('Foto',300,'860','white'),('por foto',120,'1110','0xbbbbbb',0.1)])
card('a2.mp4',0.6,'white',[('Precio',300,'860',MAG),('por precio',120,'1110','0x555555',0.1)])
card('a3.mp4',0.6,'black',[('Cliente',290,'860','white'),('por cliente',120,'1110','0xbbbbbb',0.1)])
card('a4.mp4',0.6,MAG,[('Ahora',330,'960','white')])
clip('a5.mp4',0.4,1.4,[('Su propia tienda',110,'170','white',0.1)],top=True)
# runway: strip pans right->left over 2.6s, flash every 0.5s
dur=2.5
run(['-loop','1','-t',str(dur),'-i','strip.png','-filter_complex',
     f"color=c=0x0b0b0b:s=1080x1920:r=30:d={dur}[bg];[0:v]fps=30[s];[bg][s]overlay=x='-(4760-1080)*t/{dur}':y=0,"
     + ",".join(flash(0.25+0.5*k,0.05) for k in range(5))
     + ","+stamp('La pasarela',120,'150','white',0.0)+",format=yuv420p",'-c:v','libx264','-crf','16','a6.mp4'])
clip('a7.mp4',3.5,1.1)
clip('a8.mp4',6.0,1.1,[('Elige',200,'1440',MAG,0.1)])
clip('a9.mp4',9.4,1.4,[('Pedido a WhatsApp',82,'170','white',0.1)],top=True)
run(['-i','end.png','-vf','crop=1080:700:0:610,scale=540:-1','logo-s.png'])
run(['-f','lavfi','-i',f'color=c={MAG}:s=1080x1920:d=1.6:r=30','-i','logo-s.png','-filter_complex',
     "[0:v]"+",".join([flash(),stamp('Comenta',200,'700','white'),stamp('PRECIOS',196,'930','white',0.3),flash(0.3,0.05)])+"[a];[a][1:v]overlay=x=(W-w)/2:y=1330:enable='gte(t,0.6)',format=yuv420p",'-c:v','libx264','-crf','16','a10.mp4'])
open('a.txt','w').write(''.join(f"file 'a{i}.mp4'\n" for i in range(1,11)))
run(['-f','concat','-safe','0','-i','a.txt','-c','copy','av.mp4'])
d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0','av.mp4'],capture_output=True,text=True).stdout); print('dur',d)
