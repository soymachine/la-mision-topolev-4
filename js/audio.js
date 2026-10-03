// Sonido sintetizado con WebAudio (sin archivos externos)
import { settings } from './core/state.js';

let ac = null, master = null, noiseBuf = null;
// el navegador no deja crear el audio antes de un gesto del usuario (clic o tecla): hasta entonces, silencio
let gesture = false;
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { gesture = true; }, { capture: true, once: true });
function ctx() {
  if (!settings.sound || !gesture) return null;
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = settings.volume ?? 0.5;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function setVolume(v) { settings.volume = v; if (master) master.gain.value = v; }

function tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, filter = 1200, type = 'lowpass', delay = 0, q = 1) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const s = a.createBufferSource(); s.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = filter; f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

export const sfx = {
  hover() { tone(1800, 0.025, 'square', 0.025); },
  click() { tone(900, 0.04, 'square', 0.06); tone(1400, 0.03, 'square', 0.04, 0, 0.03); },
  step() { noise(0.04, 0.03, 600); },
  shot(w) {
    if (w === 'energy') { tone(1200, 0.25, 'sawtooth', 0.12, -900); noise(0.15, 0.1, 4000, 'highpass'); return; }
    if (w === 'melee') { noise(0.08, 0.12, 900); return; }
    if (w === 'flame') { noise(0.5, 0.18, 700); return; }
    noise(w === 'shotgun' ? 0.3 : w === 'sniper' ? 0.35 : 0.14, w === 'shotgun' ? 0.35 : 0.22, w === 'sniper' ? 2600 : 1800);
    tone(w === 'sniper' ? 90 : 140, 0.12, 'triangle', 0.18, -60);
  },
  hit() { noise(0.06, 0.12, 2500, 'bandpass', 0, 3); },
  hurt() { tone(220, 0.18, 'sawtooth', 0.12, -120); noise(0.1, 0.1, 800); },
  kill() { tone(330, 0.12, 'square', 0.08, -200); noise(0.15, 0.1, 1500); },
  explosion() { noise(0.9, 0.45, 500); tone(60, 0.6, 'sine', 0.35, -30); },
  essence() { tone(1320, 0.12, 'sine', 0.08); tone(1760, 0.16, 'sine', 0.07, 0, 0.06); tone(2640, 0.2, 'sine', 0.05, 0, 0.12); },
  pickup() { tone(700, 0.06, 'square', 0.06); tone(1050, 0.08, 'square', 0.05, 0, 0.05); },
  geiger(n = 1) { for (let i = 0; i < n; i++) noise(0.006, 0.25, 3000, 'highpass', Math.random() * 0.25); },
  alert() { tone(880, 0.1, 'square', 0.08); tone(660, 0.14, 'square', 0.08, 0, 0.1); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.07, 0, i * 0.08)); },
  death() { tone(300, 1.2, 'sawtooth', 0.15, -260); noise(0.8, 0.15, 400); },
  door() { tone(180, 0.08, 'square', 0.05, -40); },
  reload() { noise(0.03, 0.1, 3000, 'highpass'); noise(0.04, 0.1, 2000, 'highpass', 0.12); },
  evac() { [440, 554, 659].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, 0, i * 0.15)); },
  radio() { noise(0.4, 0.06, 2500, 'bandpass', 0, 5); tone(1000, 0.05, 'sine', 0.05, 0, 0.4); },
  buy() { tone(980, 0.06, 'square', 0.06); tone(1470, 0.12, 'square', 0.05, 0, 0.06); },
  upgrade() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, 0, i * 0.06)); noise(0.3, 0.05, 5000, 'highpass', 0.3); },
  error() { tone(160, 0.15, 'square', 0.08); },
  type() { tone(2000 + Math.random() * 400, 0.015, 'square', 0.02); },
  zap() { tone(2400, 0.1, 'sawtooth', 0.06, -1800); },
  surge() { tone(55, 2, 'sawtooth', 0.2, 30); noise(2, 0.12, 300); },
};
