import wave,struct,math,random,sys
SR=44100; DUR=float(sys.argv[2]); BPM=128; beat=60/BPM
N=int(SR*DUR); buf=[0.0]*N; random.seed(7)
def add(t0,fn,length):
    s=int(t0*SR)
    for i in range(int(length*SR)):
        if s+i<N: buf[s+i]+=fn(i/SR)
kick=lambda t: math.sin(2*math.pi*(50+90*math.exp(-t*30))*t)*math.exp(-t*9)*0.9
clap=lambda t: (random.random()*2-1)*math.exp(-t*28)*0.35
hat=lambda t: (random.random()*2-1)*math.exp(-t*90)*0.18
notes=[55.0,55.0,65.41,49.0]
b=0;t=0.0
while t<DUR:
    add(t,kick,0.4)
    if b%2==1: add(t,clap,0.2)
    add(t+beat/2,hat,0.06); add(t,hat,0.05)
    f=notes[(b//4)%4]
    add(t+beat/2,lambda x,f=f:(math.sin(2*math.pi*f*x)+0.3*math.sin(2*math.pi*2*f*x))*math.exp(-x*5)*0.35,beat/2)
    b+=1;t+=beat
# whoosh on transitions
for w in [float(x) for x in sys.argv[3].split(',')]:
    add(w-0.05,lambda x:(random.random()*2-1)*math.sin(math.pi*min(1,x/0.3))*0.22,0.3)
m=max(abs(x) for x in buf) or 1
with wave.open(sys.argv[1],'w') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
    f.writeframes(b''.join(struct.pack('<h',int(32000*0.9*x/m)) for x in buf))
