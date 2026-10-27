import subprocess
B='bebas.woff'
def slam(text,size,y,color,ts=0.0,shake=30):
    return (f"drawtext=fontfile={B}:text='{text}':fontsize='{size}*(1+1.3*exp(-max(0,t-{ts})*16))':fontcolor={color}"
            f":x='(w-text_w)/2+{shake}*sin(t*95)*exp(-max(0,t-{ts})*9)':y='{y}-text_h/2+{shake*0.8}*cos(t*80)*exp(-max(0,t-{ts})*9)':enable='gte(t,{ts})'")
flash=lambda ts=0: f"drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(t,{ts},{ts+0.05})'"
def card(name,dur,bg,parts,extra=''):
    vf=",".join([flash()]+[slam(*p) for p in parts]+([extra] if extra else []))
    subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i',f'color=c={bg}:s=1080x1920:d={dur}:r=30','-vf',vf+',format=yuv420p','-c:v','libx264','-crf','16',name],check=True)
def clip(name,start,dur,band,bandtxt,txtcolor,by=230,fs=170):
    vf=(f"fps=30,scale=1080:1920,zoompan=z='1+0.14*exp(-on/5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"
        f"drawbox=x='-iw+iw*min(1,t/0.14)':y={by}:w=iw:h=210:color={band}:t=fill,"
        + slam(bandtxt,fs,by+105,txtcolor,0.1,14) + ",format=yuv420p")
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-t',str(dur),'-i','raw.mp4','-vf',vf,'-an','-c:v','libx264','-crf','16','-preset','fast',name],check=True)
card('k1.mp4',0.6,'black',[('SIN',300,'780','white'),('APPS',520,'1130','0xffc21a',0.12)])
clip('k2.mp4',0.45,1.3,'0xe3121b','ASÍ SE PIDE','white',by=1480)
card('k3.mp4',0.55,'0xe3121b',[('ESCOGE',400,'960','white')])
clip('k4.mp4',5.0,1.7,'0xffc21a','BOWL + PASTA','black')
card('k5.mp4',0.55,'0xffc21a',[('AL',300,'760','black'),('CARRITO',380,'1090','black',0.1)])
clip('k6.mp4',7.35,1.5,'white','OTRO MÁS','black')
card('k7.mp4',0.55,'black',[('$56.000',380,'960','0xffc21a')])
clip('k8.mp4',9.3,1.9,'0x25d366','LLEGA AL WHATSAPP','black',by=1050,fs=150)
subprocess.run(['ffmpeg','-v','error','-y','-i','end.png','-vf','crop=1080:700:0:610,scale=540:-1','logo-s.png'],check=True)
endvf=",".join([flash(),slam('COMENTA',260,'640','white'),slam('PRECIOS',340,'930','0xffc21a',0.35,40),flash(0.35)])
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=0x000103:s=1080x1920:d=1.7:r=30','-i','logo-s.png','-filter_complex',
  f"[0:v]{endvf}[a];[a][1:v]overlay=x=(W-w)/2:y=1360:enable='gte(t,0.7)',format=yuv420p",'-c:v','libx264','-crf','16','k9.mp4'],check=True)
open('k.txt','w').write(''.join(f"file 'k{i}.mp4'\n" for i in range(1,10)))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','k.txt','-c','copy','kv.mp4'],check=True)
d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0','kv.mp4'],capture_output=True,text=True).stdout)
print('dur',d)
