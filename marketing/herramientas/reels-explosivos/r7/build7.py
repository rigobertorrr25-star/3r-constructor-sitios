import subprocess
B='bebas.woff'; OR='0xff7a00'; PU='0x1a0b2e'
def run(a): subprocess.run(['ffmpeg','-v','error','-y']+a,check=True)
def flick(ts=0.0):
    return ",".join(f"drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,{ts+a},{ts+b})'" for a,b in [(0.0,0.05),(0.1,0.16),(0.22,0.25)])
def neon(text,size,y,ts=0.0,color='white'):
    on=f"gte(t,{ts})*not(between(t,{ts+0.08},{ts+0.12}))*not(between(t,{ts+0.2},{ts+0.23}))"
    return (f"drawtext=fontfile={B}:text='{text}':fontsize={size}:fontcolor={color}:borderw=10:bordercolor={OR}@0.85"
            f":shadowcolor={OR}@0.5:shadowx=0:shadowy=0:x=(w-text_w)/2:y={y}-text_h/2:enable='{on}'")
def clip(name,start,dur,parts):
    vf=(f"fps=30,scale=1080:1920,zoompan=z='1.0+0.0018*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"
        "vignette=PI/3.2,eq=brightness=-0.03:saturation=1.1,drawbox=x=0:y=1360:w=iw:h=560:color=black@0.66:t=fill,"+flick())
    for q in parts: vf+=","+neon(*q)
    run(['-ss',str(start),'-t',str(dur),'-i','raw.mp4','-vf',vf+',format=yuv420p','-an','-c:v','libx264','-crf','16','-preset','fast',name])
# b1: clock ticking up while waiting
clock="drawtext=fontfile=%s:text='%%{eif\\:8+floor(t*12)/60\\:d\\:2}\\:%%{eif\\:mod(41+floor(t*12)\\,60)\\:d\\:2}':fontsize=300:fontcolor=white:borderw=10:bordercolor=%s@0.85:x=(w-text_w)/2:y=760" % (B,OR)
run(['-f','lavfi','-i',f'color=c={PU}:s=1080x1920:d=1.3:r=30','-vf',",".join(["vignette=PI/3",clock,neon('MINUTOS ESPERANDO',110,'1180',0.15)])+',format=yuv420p','-c:v','libx264','-crf','16','b1.mp4'])
run(['-f','lavfi','-i','color=c=black:s=1080x1920:d=0.7:r=30','-vf',neon('¿Y EL MESERO?',190,'960',0.0)+',format=yuv420p','-c:v','libx264','-crf','16','b2.mp4'])
clip('b3.mp4',0.4,1.4,[('NOCHE DE',190,'1520',0.12),('HALLOWEEN',250,'1730',0.22)])
clip('b4.mp4',4.7,1.3,[('ABRE',200,'1520',0.12),('LA CARTA',250,'1730',0.22)])
clip('b5.mp4',7.2,1.6,[('AGREGA LO',200,'1520',0.12),('QUE QUIERAS',230,'1730',0.22)])
run(['-f','lavfi','-i',f'color=c={OR}:s=1080x1920:d=0.65:r=30','-vf',"drawtext=fontfile=%s:text='$100.000':fontsize='360*(1+1.2*exp(-t*16))':fontcolor=0x1a0b2e:x=(w-text_w)/2:y=(h-text_h)/2,%s" % (B,flick())+',format=yuv420p','-c:v','libx264','-crf','16','b6.mp4'])
clip('b7.mp4',9.4,1.8,[('Y LO MANDA',200,'1520',0.12),('POR WHATSAPP',210,'1730',0.22,'0x25d366')])
open('b.txt','w').write(''.join(f"file '{n}'\n" for n in ['b1.mp4','b2.mp4','b3.mp4','b4.mp4','b5.mp4','b6.mp4','b7.mp4','end.mp4']))
run(['-f','concat','-safe','0','-i','b.txt','-c','copy','bv.mp4'])
print(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0','bv.mp4'],capture_output=True,text=True).stdout)
