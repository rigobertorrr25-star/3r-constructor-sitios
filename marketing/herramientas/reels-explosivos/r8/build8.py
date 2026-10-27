import subprocess,json
F='/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
taps=json.load(open('taps.json'))
def run(a): subprocess.run(['ffmpeg','-v','error','-y']+a,check=True)
def hl(text,size,y,ts,color='black',box='0xffd400'):
    return (f"drawtext=fontfile={F}:text='{text}':fontsize='{size}*(1+0.35*exp(-max(0,t-{ts})*20))':fontcolor={color}:box=1:boxcolor={box}:boxborderw=26"
            f":x=(w-text_w)/2:y={y}-text_h/2:enable='gte(t,{ts})'")
def watch(s,k):
    T=f"max(0,{s}+t*{k}-0.5)"
    return (f"drawtext=fontfile={F}:text='00\\:%{{eif\\:floor({T})\\:d\\:2}},%{{eif\\:mod(floor({T}*10)\\,10)\\:d}}':fontsize=64:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=18:x=w-text_w-40:y=150")
def clip(name,s,e,k,lines):
    d=(e-s)/k
    inputs=['-ss',str(s),'-t',str(e-s),'-i','raw.mp4','-i','ring1.png','-i','ring2.png']
    fc=f"[0:v]setpts=(PTS-STARTPTS)/{k},fps=30,{watch(s,k)}"
    for q in lines: fc+=","+hl(*q)
    fc+="[v0]"; last='v0'; i=0
    for tp in taps:
        if s<=tp['t']<e:
            ct=round((tp['t']-s)/k,3)
            x1,y1=tp['x']-110,tp['y']-110
            fc+=f";[{last}][1:v]overlay=x={x1}:y={y1}:enable='between(t,{ct},{ct+0.12})'[r{i}a];[r{i}a][2:v]overlay=x={x1}:y={y1}:enable='between(t,{ct+0.12},{ct+0.3})'[r{i}]"; last=f'r{i}'; i+=1
    fc+=f";[{last}]format=yuv420p[out]"
    run(inputs+['-filter_complex',fc,'-map','[out]','-t',str(d),'-an','-c:v','libx264','-crf','16','-preset','fast',name])
    return d
run(['-f','lavfi','-i','color=c=0x0b0b0b:s=1080x1920:d=0.9:r=30','-vf',",".join([
  f"drawtext=fontfile={F}:text='00\\:00,0':fontsize=150:fontcolor=white:x=(w-text_w)/2:y=700",
  hl('ASÍ TOMA',150,'1060',0.1), hl('UN PEDIDO',150,'1260',0.25)])+',format=yuv420p','-c:v','libx264','-crf','16','m0.mp4'])
d1=clip('m1.mp4',0.5,4.4,1.9,[('ENTRA CON SU PIN',96,'1780',0.1)])
d2=clip('m2.mp4',4.6,8.4,1.6,[('ABRE LA MESA',110,'1780',0.15)])
d3=clip('m3.mp4',8.45,12.4,1.5,[('TOCA LO QUE PIDEN',96,'300',0.1)])
d4=clip('m4.mp4',12.45,14.7,1.0,[('LLEGA SOLO',120,'1500',0.25),('A LA BARRA',120,'1700',0.4)])
print(d1,d2,d3,d4)
open('m.txt','w').write(''.join(f"file '{n}'\n" for n in ['m0.mp4','m1.mp4','m2.mp4','m3.mp4','m4.mp4','end.mp4']))
run(['-f','concat','-safe','0','-i','m.txt','-c','copy','mv.mp4'])
print(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0','mv.mp4'],capture_output=True,text=True).stdout)
