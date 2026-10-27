import wave,struct,math,random,sys
SR=44100; DUR=float(sys.argv[2]); BPM=124; beat=60/BPM
N=int(SR*DUR); buf=[0.0]*N; random.seed(5)
def add(t0,fn,length):
    s=int(t0*SR)
    for i in range(int(length*SR)):
        if 0<=s+i<N: buf[s+i]+=fn(i/SR)
kick=lambda t: math.sin(2*math.pi*(50+90*math.exp(-t*30))*t)*math.exp(-t*10)*0.8
clap=lambda t: (random.random()*2-1)*math.exp(-t*30)*0.3
click=lambda t: (math.sin(2*math.pi*1800*t)*0.6+(random.random()*2-1)*0.4)*math.exp(-t*220)*0.55
notes=[65.41,65.41,77.78,58.27]
t=0.0;b=0
while t<DUR:
    add(t,kick,0.3)
    if b%2==1: add(t,clap,0.15)
    for q in (0.25,0.5,0.75): add(t+beat*q,lambda x:(random.random()*2-1)*math.exp(-x*140)*0.06,0.03)
    f=notes[(b//2)%4]; add(t+beat/2,lambda x,f=f:(math.sin(2*math.pi*f*x)+0.5*math.sin(2*math.pi*2*f*x))*math.exp(-x*7)*0.4,beat/2)
    b+=1;t+=beat
for w in [float(x) for x in sys.argv[3].split(',')]: add(w,click,0.05)
add(DUR-1.8,lambda x:(math.sin(2*math.pi*(40+120*math.exp(-x*18))*x)+(random.random()*2-1)*0.4*math.exp(-x*10))*math.exp(-x*5),0.6)
fade=int(0.5*SR)
for i in range(fade): buf[N-1-i]*=i/fade
m=max(abs(x) for x in buf) or 1
with wave.open(sys.argv[1],'w') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
    f.writeframes(b''.join(struct.pack('<h',int(32000*0.88*x/m)) for x in buf))
