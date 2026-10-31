import subprocess
B='bebas.woff'
def slam(text,size,y,color,ts=0.0,shake=30):
    return (f"drawtext=fontfile={B}:text='{text}':fontsize='{size}*(1+1.3*exp(-max(0,t-{ts})*16))':fontcolor={color}:borderw=6:bordercolor=black@0.6"
            f":x='(w-text_w)/2+{shake}*sin(t*95)*exp(-max(0,t-{ts})*9)':y='{y}-text_h/2+{shake*0.8}*cos(t*80)*exp(-max(0,t-{ts})*9)':enable='gte(t,{ts})'")
def run(a): subprocess.run(['ffmpeg','-v','error','-y']+a,check=True)
vf=("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
    +slam('FELIZ',220,'260','white',1.6)+","+slam('HALLOWEEN',260,'470','0xff7a00',1.85)+",format=yuv420p")
run(['-ss','0.5','-t','4.0','-i','lion.mp4','-vf',vf,'-an','-c:v','libx264','-crf','16','a0.mp4'])
open('list.txt','w').write(''.join(f"file '{n}'\n" for n in ['a0.mp4','b1.mp4','b2.mp4','b3.mp4','b4.mp4','b5.mp4','b6.mp4','k9.mp4']))
run(['-f','concat','-safe','0','-i','list.txt','-c','copy','v.mp4'])
d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0','v.mp4'],capture_output=True,text=True).stdout)
cuts=[1.6,1.85,4.0,4.6,5.15,6.45,7.95,8.5,10.3,10.65]
subprocess.run(['python3','music3.py','m.wav',str(d),','.join(map(str,cuts))],check=True)
run(['-i','v.mp4','-i','m.wav','-map','0:v','-map','1:a','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart','r7-leon.mp4'])
print('dur',d)
