"""Música corta para los videos de OpenArt. Uso: python3 musica.py salida.wav estilo duracion
estilo: cine (guitarra pulsada cálida), plastilina (marimba juguetona), dibujo (cajita musical)."""
import wave, struct, math, random, sys

SR = 44100
out, estilo, DUR = sys.argv[1], sys.argv[2], float(sys.argv[3])
N = int(SR * DUR)
buf = [0.0] * N
random.seed(3)


def add(t0, samples):
    s = int(t0 * SR)
    for i, v in enumerate(samples):
        if 0 <= s + i < N:
            buf[s + i] += v


def pluck(f, length=1.2, amp=0.3):
    # Karplus-Strong: cuerda pulsada
    p = max(2, int(SR / f))
    ring = [random.uniform(-1, 1) for _ in range(p)]
    res = []
    for i in range(int(length * SR)):
        v = ring[i % p]
        ring[i % p] = 0.996 * 0.5 * (v + ring[(i + 1) % p])
        res.append(v * amp)
    return res


def tone(f, length, decay, amp, partials=((1, 1.0),)):
    return [amp * math.exp(-decay * i / SR) * sum(a * math.sin(2 * math.pi * f * k * i / SR) for k, a in partials)
            for i in range(int(length * SR))]


def noise(length, decay, amp):
    return [amp * random.uniform(-1, 1) * math.exp(-decay * i / SR) for i in range(int(length * SR))]


if estilo == 'cine':
    beat = 60 / 92
    chords = [[196.0, 246.9, 293.7], [164.8, 196.0, 246.9], [130.8, 164.8, 196.0], [146.8, 185.0, 220.0]]
    t, b = 0.0, 0
    while t < DUR:
        ch = chords[(b // 4) % 4]
        if b % 2 == 0:
            for j, f in enumerate(ch):
                add(t + j * 0.025, pluck(f, 1.6, 0.28))
        else:
            add(t, pluck(ch[-1] * 2, 0.8, 0.16))
        add(t + beat / 2, noise(0.08, 60, 0.05))
        b += 1
        t += beat
elif estilo == 'plastilina':
    beat = 60 / 118
    mel = [523.3, 659.3, 784.0, 659.3, 587.3, 698.5, 880.0, 698.5]
    t, b = 0.0, 0
    while t < DUR:
        f = mel[b % len(mel)]
        add(t, tone(f, 0.35, 14, 0.32, ((1, 1.0), (4, 0.25))))
        add(t + beat / 2, tone(f * 0.5, 0.25, 18, 0.2, ((1, 1.0), (4, 0.2))))
        add(t, tone(110 if b % 2 == 0 else 147, 0.3, 10, 0.3))
        if b % 2 == 1:
            add(t, tone(1800, 0.05, 80, 0.15))  # bloque de madera
        b += 1
        t += beat
elif estilo == 'carnaval':
    # tambora y llamador al estilo cumbia, con una flauta de millo sencilla
    beat = 60 / 100
    mel = [784.0, 880.0, 784.0, 659.3, 698.5, 784.0, 659.3, 587.3]
    t, b = 0.0, 0
    while t < DUR:
        add(t, tone(70, 0.3, 12, 0.5))                       # tambora
        add(t + beat / 2, noise(0.12, 25, 0.25))             # llamador
        add(t + beat * 0.75, noise(0.05, 70, 0.12))          # guache
        add(t + beat * 0.25, noise(0.05, 70, 0.10))
        add(t, tone(mel[b % len(mel)], beat * 0.9, 4, 0.16, ((1, 1.0), (2, 0.3), (3, 0.1))))
        b += 1
        t += beat
elif estilo == 'navidad':
    beat = 60 / 96
    mel = [659.3, 659.3, 659.3, 0, 659.3, 659.3, 659.3, 0, 659.3, 784.0, 523.3, 587.3, 659.3, 0, 0, 0]
    t, b = 0.0, 0
    while t < DUR:
        f = mel[b % len(mel)]
        if f:
            add(t, tone(f, 1.2, 3.0, 0.22, ((1, 1.0), (2.76, 0.25), (5.4, 0.08))))
        if b % 2 == 0:
            add(t, noise(0.15, 30, 0.06))                    # cascabeles
            add(t, tone(130.8 if (b // 8) % 2 == 0 else 98.0, 0.6, 4, 0.18))
        b += 1
        t += beat / 2
else:  # dibujo: cajita musical
    beat = 60 / 100
    mel = [1046.5, 1318.5, 1568.0, 1318.5, 1174.7, 1396.9, 1760.0, 1568.0]
    t, b = 0.0, 0
    while t < DUR:
        f = mel[b % len(mel)]
        add(t, tone(f, 1.4, 3.5, 0.22, ((1, 1.0), (2.76, 0.18), (5.4, 0.06))))
        if b % 2 == 0:
            add(t, tone(f / 4, 1.4, 2.5, 0.16))
        b += 1
        t += beat

# entrada y salida suaves
fade = int(0.4 * SR)
for i in range(fade):
    buf[i] *= i / fade
    buf[N - 1 - i] *= i / fade
m = max(abs(x) for x in buf) or 1
with wave.open(out, 'w') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(b''.join(struct.pack('<h', int(30000 * 0.85 * x / m)) for x in buf))
