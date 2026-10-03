// Sonido sintetizado con WebAudio (sin archivos externos)
// Fase 24.5: dos buses bajo el maestro (efectos y música, con volumen propio) y música generativa de drones.
import { settings, saveSettings } from './core/state.js';

let ac = null, master = null, noiseBuf = null, fxBus = null, musBus = null, ambB = null, verb = null, verbIn = null;
// el navegador no deja crear el audio antes de un gesto del usuario (clic o tecla): hasta entonces, silencio
let gesture = false;
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { gesture = true; setTimeout(() => { music.sync(); for (const f of gestureHooks) f(); }, 0); }, { capture: true, once: true });
const gestureHooks = [];
export const onAudioReady = (f) => { gestureHooks.push(f); if (gesture && ac) f(); };
function ctx(force = false) {
  if ((!settings.sound && !force) || !gesture) return null;
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = settings.volume ?? 0.5;
      master.connect(ac.destination);
      fxBus = ac.createGain(); fxBus.gain.value = settings.sfxVol ?? 1; fxBus.connect(master);
      musBus = ac.createGain(); musBus.gain.value = settings.musicVol ?? 0.4; musBus.connect(master);
      ambB = ac.createGain(); ambB.gain.value = settings.ambVol ?? 0.6; ambB.connect(master); // ambiente grabado (samples.js)
      // reverberación por convolución para la cola de los disparos (respuesta al impulso sintética: ruido que decae)
      verb = ac.createConvolver();
      const len = Math.floor(ac.sampleRate * 1.6), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      verb.buffer = ir; verbIn = ac.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb); verb.connect(fxBus);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function setVolume(v) { settings.volume = v; if (master) master.gain.value = v; }
// volúmenes separados (24.5.3): 'music' | 'sfx', de 0 a 1
const VOL_KEY = { music: 'musicVol', sfx: 'sfxVol', amb: 'ambVol' };
export function setBusVolume(which, v) {
  settings[VOL_KEY[which]] = Math.max(0, Math.min(1, v)); saveSettings();
  const bus = which === 'music' ? musBus : which === 'amb' ? ambB : fxBus;
  if (bus && ac) bus.gain.setTargetAtTime(settings[VOL_KEY[which]], ac.currentTime, 0.05);
}
export const busVolume = (which) => settings[VOL_KEY[which]] ?? (which === 'music' ? 0.4 : which === 'amb' ? 0.6 : 1);
// para samples.js
export const audioCtx = () => ctx();
export const ambBus = () => ambB;
export const fxOut = () => fxBus;

function tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(fxBus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, filter = 1200, type = 'lowpass', delay = 0, q = 1, wet = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const s = a.createBufferSource(); s.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = filter; f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(fxBus);
  if (wet && verbIn) { const w = a.createGain(); w.gain.value = wet; g.connect(w); w.connect(verbIn); }
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
// golpe grave con caída de tono (el «cuerpo» del disparo)
function thump(freq, dur, vol, drop = 0.5, delay = 0, wet = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(25, freq * drop), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(fxBus);
  if (wet && verbIn) { const w = a.createGain(); w.gain.value = wet; g.connect(w); w.connect(verbIn); }
  o.start(t); o.stop(t + dur + 0.02);
}
// disparos sintetizados por tipo de arma: chasquido (transitorio agudo) + estallido (ruido filtrado) + cuerpo grave + cola con reverberación
const GUNS = {
  pistol: { crack: 5200, body: 2200, bodyDur: 0.12, low: 150, lowDur: 0.12, vol: 0.32, tail: 0.5, wet: 0.5 },
  smg: { crack: 5600, body: 2600, bodyDur: 0.09, low: 170, lowDur: 0.09, vol: 0.28, tail: 0.35, wet: 0.35 },
  rifle: { crack: 6200, body: 1800, bodyDur: 0.16, low: 110, lowDur: 0.16, vol: 0.38, tail: 0.8, wet: 0.6 },
  sniper: { crack: 7200, body: 1500, bodyDur: 0.22, low: 85, lowDur: 0.25, vol: 0.45, tail: 1.3, wet: 0.8 },
  shotgun: { crack: 3800, body: 1200, bodyDur: 0.28, low: 90, lowDur: 0.26, vol: 0.48, tail: 1.0, wet: 0.7 },
  mg: { crack: 5800, body: 2000, bodyDur: 0.11, low: 120, lowDur: 0.12, vol: 0.34, tail: 0.5, wet: 0.45 },
  launcher: { crack: 2500, body: 700, bodyDur: 0.35, low: 70, lowDur: 0.4, vol: 0.45, tail: 1.1, wet: 0.7 },
};
function gunshot(w) {
  const G = GUNS[w] || GUNS.pistol;
  const v = G.vol * (0.9 + Math.random() * 0.2);
  noise(0.012, v * 0.9, G.crack, 'highpass', 0, 0.7);             // chasquido
  noise(G.bodyDur, v, G.body * (0.9 + Math.random() * 0.2), 'lowpass', 0.003, 0.9, G.wet * 0.6); // estallido
  thump(G.low, G.lowDur, v * 1.1, 0.45, 0, G.wet * 0.4);          // cuerpo
  noise(G.tail, v * 0.18, 700, 'lowpass', 0.02, 0.7, G.wet);      // cola de la sala
  if (w === 'shotgun') noise(0.06, v * 0.5, 3000, 'bandpass', 0.01, 2);
  if (w === 'smg' || w === 'mg') noise(0.02, v * 0.25, 4000, 'bandpass', 0.05, 4); // mecanismo
}

// samples.js registra aquí las grabaciones de disparos (evita importar en círculo)
let shotSampleHook = null;
export const setShotSampleHook = (f) => { shotSampleHook = f; };
export const sfx = {
  hover() { tone(1800, 0.025, 'square', 0.025); },
  click() { tone(900, 0.04, 'square', 0.06); tone(1400, 0.03, 'square', 0.04, 0, 0.03); },
  step() { noise(0.04, 0.03, 600); },
  shot(w) {
    if (w === 'energy') { tone(1200, 0.25, 'sawtooth', 0.12, -900); noise(0.15, 0.1, 4000, 'highpass'); return; }
    if (w === 'melee') { noise(0.08, 0.12, 900); return; }
    if (w === 'flame') { noise(0.5, 0.18, 700); return; }
    if (shotSampleHook && shotSampleHook(w)) return; // grabación, si la hay (samples.js)
    gunshot(w);
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
  // fase 24.5.4: lo añadido en las fases 19–23
  tick() { tone(2200, 0.02, 'square', 0.05); tone(1700, 0.02, 'square', 0.04, 0, 0.18); },
  heartbeat() { tone(62, 0.12, 'sine', 0.3, -10); tone(58, 0.14, 'sine', 0.22, -10, 0.2); },
  revive() { [330, 440, 660].forEach((f, i) => tone(f, 0.16, 'sine', 0.09, 0, i * 0.07)); },
  suppress() { for (let i = 0; i < 4; i++) noise(0.07, 0.16, 1700, 'lowpass', i * 0.07); },
  jam() { tone(240, 0.05, 'square', 0.1); noise(0.03, 0.12, 3500, 'highpass', 0.04); tone(150, 0.08, 'square', 0.06, 0, 0.08); },
  crouch() { noise(0.09, 0.05, 500); },
  howl() { tone(380, 0.9, 'sawtooth', 0.06, 260); tone(392, 0.9, 'triangle', 0.05, 240, 0.05); },
  phase() { tone(70, 1.1, 'sawtooth', 0.22, -25); [880, 830, 784].forEach((f, i) => tone(f, 0.25, 'square', 0.05, 0, 0.2 + i * 0.18)); noise(0.8, 0.12, 400); },
  elite() { [1046, 1318, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, 0, i * 0.1)); },
};

// ---------------------------------------------------------------- música generativa (24.5.1–24.5.2)
// Drones: 3 osciladores desafinados → filtro paso bajo (con LFO) → bus de música. Una paleta por tema;
// la intensidad (0–1) abre el filtro, añade una voz disonante y un trémolo. En la base, campanas suaves.
const PALETTES = {
  base: { root: 98, iv: [1, 1.5, 2], wave: 'triangle', cut: 700, lfo: 0.05, bells: [392, 440, 523, 587, 659, 784], bellEvery: 3.2 },
  superficie: { root: 55, iv: [1, 1.5, 2.01], wave: 'sawtooth', cut: 380, lfo: 0.07, bells: [220, 247, 294, 330], bellEvery: 9 },
  subsuelo: { root: 46.25, iv: [1, 1.06, 1.5], wave: 'sawtooth', cut: 300, lfo: 0.04, bells: [185, 196, 277], bellEvery: 12 },
  laboratorio: { root: 82.4, iv: [1, 1.414, 2.83], wave: 'square', cut: 520, lfo: 0.11, bells: [1318, 1397, 1975], bellEvery: 7 },
  corium: { root: 36.7, iv: [1, 1.03, 1.48], wave: 'sawtooth', cut: 240, lfo: 0.03, bells: [110, 117], bellEvery: 14 },
};
export const themeForZone = (def) => {
  const id = def && def.id;
  if (['corium', 'sarcofago'].includes(id)) return 'corium';
  if (['objeto7', 'fenix', 'wismut'].includes(id)) return 'laboratorio';
  return def && def.stratum === 'sup' ? 'superficie' : 'subsuelo';
};
let cur = null; // { theme, nodes, gain, filter, extra, trem, bellT }
const want = { theme: null, intensity: 0 };
export const music = {
  get theme() { return cur ? cur.theme : null; },
  get wanted() { return want.theme; },
  get intensity() { return want.intensity; },
  // tema que debe sonar (null = silencio); con fundido de ~2 s
  play(theme) { want.theme = theme; this.sync(); },
  stop() { want.theme = null; this.sync(); },
  setIntensity(x) {
    want.intensity = Math.max(0, Math.min(1, x || 0));
    if (!cur || !ac) return;
    const P = PALETTES[cur.theme], t = ac.currentTime, k = want.intensity;
    cur.filter.frequency.setTargetAtTime(P.cut * (1 + k * 2.2), t, 0.8);
    cur.extra.gain.setTargetAtTime(0.05 * k, t, 0.8);
    cur.tremDepth.gain.setTargetAtTime(0.35 * k, t, 0.5);
    cur.trem.frequency.setTargetAtTime(2 + k * 5, t, 0.5);
  },
  // aplica lo que se quiere al estado real (al cambiar de ajustes, tras el primer gesto…)
  sync() {
    const on = settings.sound && settings.music !== false && want.theme;
    if (!on) { fadeOut(); return; }
    if (cur && cur.theme === want.theme) return;
    const a = ctx(); if (!a) return;
    fadeOut();
    cur = startTheme(want.theme);
    this.setIntensity(want.intensity);
  },
};
function fadeOut() {
  if (!cur || !ac) { cur = null; return; }
  const old = cur; cur = null;
  const t = ac.currentTime;
  old.gain.gain.cancelScheduledValues(t);
  old.gain.gain.setValueAtTime(old.gain.gain.value, t);
  old.gain.gain.linearRampToValueAtTime(0.0001, t + 2);
  clearInterval(old.bellT);
  setTimeout(() => { for (const n of old.nodes) try { n.stop(); } catch {} try { old.gain.disconnect(); } catch {} }, 2300);
}
function startTheme(theme) {
  const P = PALETTES[theme] || PALETTES.subsuelo;
  const a = ac, t = a.currentTime;
  const gain = a.createGain(); gain.gain.setValueAtTime(0.0001, t); gain.gain.linearRampToValueAtTime(0.16, t + 2.5);
  const filter = a.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = P.cut; filter.Q.value = 4;
  // trémolo (sube con la intensidad)
  const tremGain = a.createGain(); tremGain.gain.value = 1;
  const trem = a.createOscillator(); trem.frequency.value = 2; const tremDepth = a.createGain(); tremDepth.gain.value = 0;
  trem.connect(tremDepth); tremDepth.connect(tremGain.gain);
  filter.connect(tremGain); tremGain.connect(gain); gain.connect(musBus);
  const nodes = [trem];
  P.iv.forEach((m, i) => {
    const o = a.createOscillator(); o.type = P.wave; o.frequency.value = P.root * m; o.detune.value = (i - 1) * 7;
    const g = a.createGain(); g.gain.value = i ? 0.22 : 0.3;
    o.connect(g); g.connect(filter); nodes.push(o);
  });
  // LFO lento sobre el filtro: el drone «respira»
  const lfo = a.createOscillator(); lfo.frequency.value = P.lfo; const lg = a.createGain(); lg.gain.value = P.cut * 0.45;
  lfo.connect(lg); lg.connect(filter.frequency); nodes.push(lfo);
  // voz disonante (tritono) que entra con el peligro
  const xo = a.createOscillator(); xo.type = 'sawtooth'; xo.frequency.value = P.root * 1.414 * 2; const extra = a.createGain(); extra.gain.value = 0;
  xo.connect(extra); extra.connect(filter); nodes.push(xo);
  for (const n of nodes) n.start(t);
  // campanas: notas sueltas de la paleta
  const bellT = setInterval(() => {
    if (!cur || cur.theme !== theme || Math.random() < 0.35) return;
    const f = P.bells[Math.floor(Math.random() * P.bells.length)];
    const o = a.createOscillator(), g = a.createGain(), tt = a.currentTime;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(theme === 'base' ? 0.05 : 0.025, tt + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, tt + 2.6);
    o.connect(g); g.connect(gain); o.start(tt); o.stop(tt + 2.7);
  }, P.bellEvery * 1000);
  return { theme, nodes, gain, filter, extra, trem, tremDepth, bellT };
}

