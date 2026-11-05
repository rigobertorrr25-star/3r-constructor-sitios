"""Música con ritmos del Caribe colombiano para los reels de 3R.
Uso: python3 musica2.py salida.wav estilo duracion   (estilo: champeta | dembow)"""
import wave, struct, math, random, sys

SR = 44100
out, estilo, DUR = sys.argv[1], sys.argv[2], float(sys.argv[3])
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N
random.seed(11)


def add(t0, samples, pan=0.0, gain=1.0):
    s = int(t0 * SR)
    gl, gr = gain * (1 - max(0, pan)), gain * (1 + min(0, pan))
    for i, v in enumerate(samples):
        j = s + i
        if 0 <= j < N:
            L[j] += v * gl
            R[j] += v * gr


def env(n, a, d):
    """ataque y caída exponencial (en segundos)"""
    na = max(1, int(a * SR))
    return [(i / na) if i < na else math.exp(-(i - na) / (d * SR)) for i in range(n)]


def kick(amp=1.0):
    n = int(0.35 * SR); e = env(n, 0.002, 0.09)
    ph = 0.0; res = []
    for i in range(n):
        f = 45 + 110 * math.exp(-i / (0.03 * SR))
        ph += 2 * math.pi * f / SR
        res.append(math.sin(ph) * e[i] * amp)
    return res


def snare(amp=0.5, bright=1.0):
    n = int(0.22 * SR); e = env(n, 0.001, 0.05); prev = 0.0; res = []
    for i in range(n):
        w = random.uniform(-1, 1)
        hp = w - prev * (0.6 * bright); prev = w
        res.append((0.7 * hp + 0.35 * math.sin(2 * math.pi * 190 * i / SR)) * e[i] * amp)
    return res


def hat(amp=0.15, d=0.025):
    n = int(0.08 * SR); e = env(n, 0.0005, d); prev = 0.0; res = []
    for i in range(n):
        w = random.uniform(-1, 1); hp = w - prev; prev = w
        res.append(hp * e[i] * amp)
    return res


def bass(f, length, amp=0.45, slide=0.0):
    n = int(length * SR); e = env(n, 0.004, length * 0.8); ph = 0.0; res = []
    for i in range(n):
        ff = f * (1 + slide * math.exp(-i / (0.05 * SR)))
        ph += 2 * math.pi * ff / SR
        v = math.sin(ph) + 0.25 * math.sin(2 * ph)
        res.append(math.tanh(1.6 * v) * e[i] * amp)
    return res


def pluck(f, length=0.5, amp=0.22, bright=0.5):
    p = max(2, int(SR / f)); ring = [random.uniform(-1, 1) for _ in range(p)]; res = []
    for i in range(int(length * SR)):
        v = ring[i % p]
        ring[i % p] = 0.995 * (bright * v + (1 - bright) * ring[(i + 1) % p])
        res.append(v * amp)
    return res


def pad(freqs, length, amp=0.07):
    n = int(length * SR); e = env(n, 0.25, length); res = []
    for i in range(n):
        t = i / SR
        v = sum(math.sin(2 * math.pi * f * t + 0.3 * math.sin(2 * math.pi * 0.4 * t)) +
                0.5 * math.sin(2 * math.pi * f * 1.004 * t) for f in freqs)
        res.append(v * e[i] * amp / len(freqs))
    return res


if estilo == 'champeta':
    bpm = 116; beat = 60 / bpm; bar = 4 * beat
    # progresión mayor alegre (I–V–vi–IV en Do)
    prog = [(130.81, [261.6, 329.6, 392.0]), (98.0, [196.0, 246.9, 293.7]),
            (110.0, [220.0, 261.6, 329.6]), (87.31, [174.6, 220.0, 261.6])]
    riff = [0, 2, 1, 2, 0, 2, 1, 3]  # índices de la triada, en semicorcheas alternas
    t = 0.0; b = 0
    while t < DUR:
        root, tri = prog[b % 4]
        for k in range(4):
            bt = t + k * beat
            add(bt, kick(0.95))
            if k % 2 == 1:
                add(bt, snare(0.45))
            add(bt + beat / 2, hat(0.13), pan=0.3)
            add(bt + beat * 0.75, hat(0.08), pan=-0.3)
        # bajo sincopado
        for off, mul in [(0, 1), (0.75, 1), (1.5, 2), (2, 1), (2.75, 1.5), (3.5, 1)]:
            add(t + off * beat, bass(root * mul / 2 if mul != 1.5 else root * 0.75, beat * 0.6, 0.4))
        # guitarra champetera aguda (dos guitarras en estéreo)
        for s in range(16):
            n = tri[riff[s % 8] % 3] * (2 if s % 4 in (1, 3) else 4) / 2
            add(t + s * beat / 4, pluck(n * 2, 0.35, 0.16, 0.55), pan=-0.4 if s % 2 else 0.4)
        add(t, pad(tri, bar, 0.05))
        t += bar; b += 1
else:  # dembow
    bpm = 96; beat = 60 / bpm; bar = 4 * beat
    prog = [(110.0, [220.0, 261.6, 329.6]), (87.31, [174.6, 220.0, 261.6]),
            (130.81, [261.6, 329.6, 392.0]), (98.0, [196.0, 246.9, 293.7])]  # Am F C G
    t = 0.0; b = 0
    while t < DUR:
        root, tri = prog[b % 4]
        for k in range(4):
            add(t + k * beat, kick(1.0))
        for pos in (0.75, 1.5, 2.75, 3.5):  # patrón dembow
            add(t + pos * beat, snare(0.5, 0.8))
        for e8 in range(8):
            add(t + e8 * beat / 2, hat(0.12 if e8 % 2 else 0.07, 0.02), pan=0.25)
        add(t, bass(root / 2, beat * 1.8, 0.55, slide=0.4))
        add(t + 2 * beat, bass(root / 2, beat * 1.4, 0.5))
        add(t + 3.5 * beat, bass(root, beat * 0.45, 0.4))
        add(t, pad(tri, bar, 0.08))
        # campanita melódica
        for pos, idx in [(0, 2), (1.5, 1), (2, 0), (3, 1)]:
            add(t + pos * beat, pluck(tri[idx] * 4, 0.6, 0.1, 0.7), pan=-0.2)
        t += bar; b += 1

fade = int(0.5 * SR)
for i in range(fade):
    g = i / fade
    L[i] *= g; R[i] *= g; L[N - 1 - i] *= g; R[N - 1 - i] *= g
m = max(max(abs(x) for x in L), max(abs(x) for x in R)) or 1
with wave.open(out, 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b''.join(struct.pack('<hh', int(30000 * math.tanh(1.2 * l / m)), int(30000 * math.tanh(1.2 * r / m)))
                           for l, r in zip(L, R)))
