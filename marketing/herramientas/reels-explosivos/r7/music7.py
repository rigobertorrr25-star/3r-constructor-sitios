import wave,struct,math,random,sys
SR=44100; DUR=float(sys.argv[2]); BPM=100; beat=60/BPM
N=int(SR*DUR); buf=[0.0]*N; random.seed(31)
def add(t0,fn,length):
    s=int(t0*SR)
    for i in range(int(length*SR)):
        if 0<=s+i<N: buf[s+i]+=fn(i/SR)
tick=lambda t: math.sin(2*math.pi*2400*t)*math.exp(-t*300)*0.35
for k in range(int(1.3/0.25)): add(k*0.25,tick,0.03)
add(0,lambda t: (math.sin(2*math.pi*55*t)+0.5*math.sin(2*math.pi*82.4*t))*0.12*min(1,t/0.4),DUR)
kick=lambda t: math.sin(2*math.pi*(42+70*math.exp(-t*24))*t)*math.exp(-t*7)*0.85
mel=[220.0,261.63,246.94,207.65]
t=2.0;b=0
while t<DUR:
    add(t,kick,0.4)
    if b%2==1: add(t,lambda x:(random.random()*2-1)*math.exp(-x*30)*0.28,0.15)
    add(t+beat/2,lambda x:(random.random()*2-1)*math.exp(-x*120)*0.07,0.04)
    f=mel[b%4]; add(t,lambda x,f=f: math.sin(2*math.pi*f*x)*math.exp(-x*4)*0.16,beat)
    b+=1;t+=beat
for w in [float(x) for x in sys.argv[3].split(',')]:
    add(w,lambda x:(math.sin(2*math.pi*(38+110*math.exp(-x*18))*x)*1.0+(random.random()*2-1)*0.45*math.exp(-x*10))*math.exp(-x*5),0.6)
fade=int(0.5*SR)
for i in range(fade): buf[N-1-i]*=i/fade
m=max(abs(x) for x in buf) or 1
with wave.open(sys.argv[1],'w') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
    f.writeframes(b''.join(struct.pack('<h',int(32000*0.88*x/m)) for x in buf))
