import wave,struct,math,random,sys
SR=44100; DUR=float(sys.argv[2]); BPM=118; beat=60/BPM
N=int(SR*DUR); buf=[0.0]*N; random.seed(11)
def add(t0,fn,length):
    s=int(t0*SR)
    for i in range(int(length*SR)):
        if 0<=s+i<N: buf[s+i]+=fn(i/SR)
kick=lambda t: math.sin(2*math.pi*(45+80*math.exp(-t*28))*t)*math.exp(-t*8)*0.8
snap=lambda t: (random.random()*2-1)*math.exp(-t*35)*0.3
shutter=lambda t: (random.random()*2-1)*(math.exp(-t*160)+0.6*math.exp(-max(0,t-0.045)*160)*(t>0.045))*0.55
bass=[41.2,41.2,49.0,36.71]
b=0;t=0.0
while t<DUR:
    add(t,kick,0.35)
    if b%2==1: add(t,snap,0.15)
    f=bass[(b//4)%4]
    add(t+beat/2,lambda x,f=f:(math.sin(2*math.pi*f*x)+0.4*math.sin(2*math.pi*3*f*x))*math.exp(-x*6)*0.4,beat/2)
    add(t+beat/4,lambda x:(random.random()*2-1)*math.exp(-x*110)*0.08,0.04); add(t+3*beat/4,lambda x:(random.random()*2-1)*math.exp(-x*110)*0.08,0.04)
    b+=1;t+=beat
for w in [float(x) for x in sys.argv[3].split(',')]: add(w,shutter,0.12)
fade=int(0.5*SR)
for i in range(fade): buf[N-1-i]*=i/fade
m=max(abs(x) for x in buf) or 1
with wave.open(sys.argv[1],'w') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
    f.writeframes(b''.join(struct.pack('<h',int(32000*0.88*x/m)) for x in buf))
