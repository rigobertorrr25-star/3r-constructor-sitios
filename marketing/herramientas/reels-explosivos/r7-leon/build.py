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
OR='0xff7a00'
card('b1.mp4',0.6,'black',[('¿MIEDO',300,'780','white'),('A LA APP?',300,'1080',OR,0.12)])
card('b2.mp4',0.55,OR,[('SIN',260,'760','black'),('COMISIÓN',300,'1060','black',0.1)])
def clipa(name,start,dur,band,txt,tc,by=230,fs=170):
    vf=(f"fps=30,scale=1080:1920,zoompan=z='1+0.14*exp(-on/5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"
        f"drawbox=x='-iw+iw*min(1,t/0.14)':y={by}:w=iw:h=210:color={band}:t=fill,"+slam(txt,fs,by+105,tc,0.1,14)+",format=yuv420p")
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-t',str(dur),'-i','azul.mp4','-vf',vf,'-an','-c:v','libx264','-crf','16','-preset','fast',name],check=True)
clipa('b3.mp4',4.7,1.3,OR,'CARTA CON FOTOS','black',by=1450)
clipa('b4.mp4',7.2,1.5,'black','AGREGA LO QUE QUIERAS',OR,by=1450,fs=112)
card('b5.mp4',0.55,'black',[('$100.000',380,'960',OR)])
clipa('b6.mp4',9.4,1.8,'0x25d366','LLEGA AL WHATSAPP','black',by=1050,fs=150)
print('ok')
