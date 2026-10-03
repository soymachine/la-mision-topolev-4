// Audio grabado (revisión tras la fase 24): bucles de ambiente por pantalla y zona, sonidos de botín por rareza
// y, si se añaden, grabaciones de disparos. Todo CC0 (ver sounds/CREDITS.md). Se carga bajo demanda y, mientras
// no esté cargado (o si falla), el juego sigue con la síntesis de audio.js.
import { settings } from './core/state.js';
import { audioCtx, ambBus, fxOut, sfx, setShotSampleHook, onAudioReady, themeForZone } from './audio.js';

const BASE = 'sounds/';
// ambientes: archivo, volumen relativo y velocidad (la velocidad baja lo hace más grave y opresivo)
export const AMBIENCES = {
  title: { f: 'amb/wind.mp3', v: 0.55 },
  intro: { f: 'amb/thunder.mp3', v: 0.45 },
  base: { f: 'amb/fan.mp3', v: 0.5 },
  report: { f: 'amb/fireplace.mp3', v: 0.55 },
  help: { f: 'amb/night.mp3', v: 0.25 },
  subsuelo: { f: 'amb/underwater.mp3', v: 0.7, rate: 0.85 },
  laboratorio: { f: 'amb/fan.mp3', v: 0.6, rate: 0.75 },
  corium: { f: 'amb/underwater.mp3', v: 0.8, rate: 0.6 },
  superficie: { f: 'amb/forest.mp3', v: 0.5 },
  noche: { f: 'amb/night.mp3', v: 0.5 },
  lluvia: { f: 'amb/rain-heavy.mp3', v: 0.55 },
  tormenta: { f: 'amb/thunder.mp3', v: 0.6 },
  viento: { f: 'amb/wind.mp3', v: 0.5 },
};
// botín: un sonido por rareza (0 común … 5 mítico) y uno al abrir
export const LOOT_FILES = ['loot/r0.ogg', 'loot/r1.ogg', 'loot/r2.ogg', 'loot/r3.ogg', 'loot/r4.ogg', 'loot/r5.ogg'];
export const LOOT_OPEN = 'loot/open.ogg';
// disparos grabados (opcional): pon archivos en sounds/shots/ y añádelos aquí, p. ej. { pistol: 'shots/pistol.ogg' }.
// Los tipos son los de las armas: pistol, smg, rifle, shotgun, sniper, mg. Si no hay archivo, se sintetiza.
export const SHOT_FILES = {};

const buffers = new Map(); // ruta → AudioBuffer | Promise | null (falló)
function load(path) {
  const a = audioCtx();
  if (!a) return null;
  if (buffers.has(path)) { const b = buffers.get(path); return b instanceof AudioBuffer ? b : null; }
  const p = fetch(BASE + path).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((ab) => a.decodeAudioData(ab)).then((buf) => { buffers.set(path, buf); return buf; })
    .catch(() => { buffers.set(path, null); return null; });
  buffers.set(path, p);
  return null;
}
export const sampleReady = (path) => buffers.get(path) instanceof AudioBuffer;
export function preload(paths) { for (const p of paths) load(p); }

// un sonido suelto (bus de efectos). Devuelve false si aún no está cargado (para usar la síntesis)
export function playSample(path, { vol = 1, rate = 1, delay = 0 } = {}) {
  const a = audioCtx();
  if (!a || !settings.sound) return false;
  const buf = load(path);
  if (!buf) return false;
  const s = a.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = a.createGain(); g.gain.value = vol;
  s.connect(g); g.connect(fxOut());
  s.start(a.currentTime + delay);
  return true;
}
export const shotSample = (wtype) => (SHOT_FILES[wtype] ? playSample(SHOT_FILES[wtype], { vol: 0.9, rate: 0.94 + Math.random() * 0.12 }) : false);
setShotSampleHook(shotSample);
// al primer gesto: precargar el botín y lo que pida la pantalla actual
onAudioReady(() => { preload([...LOOT_FILES, LOOT_OPEN, ...Object.values(SHOT_FILES)]); ambience.sync(); });

// sonido de un objeto de botín al aparecer, según su rareza (con síntesis de reserva)
export function lootSound(r = 0, delay = 0) {
  const k = Math.max(0, Math.min(5, r | 0));
  if (playSample(LOOT_FILES[k], { vol: 0.5 + k * 0.1, delay })) return;
  if (k >= 3) sfx.upgrade(); else sfx.pickup();
}
export const lootOpenSound = () => playSample(LOOT_OPEN, { vol: 0.6 }) || sfx.door();

// ambiente de una expedición: superficie según clima y hora; subsuelo según la zona
export function expAmbience(e) {
  if (!e || !e.def) return 'subsuelo';
  if (e.surface) {
    if (e.weather === 'lluvia') return 'lluvia';
    if (e.isNight && e.isNight()) return 'noche';
    if (e.weather === 'viento') return 'viento';
    return e.def.id === 'bosque' ? 'superficie' : 'viento';
  }
  return themeForZone(e.def);
}

// ---------------------------------------------------------------- ambiente en bucle con fundido
let curAmb = null; // { key, src, gain }
let wantAmb = null;
export const ambience = {
  get current() { return curAmb ? curAmb.key : null; },
  get wanted() { return wantAmb; },
  play(key) { wantAmb = AMBIENCES[key] ? key : null; this.sync(); },
  stop() { wantAmb = null; this.sync(); },
  sync() {
    const a = audioCtx();
    if (!a) return;
    const on = settings.sound && settings.ambience !== false && wantAmb;
    if (!on) { fade(); return; }
    if (curAmb && curAmb.key === wantAmb) return;
    const A = AMBIENCES[wantAmb];
    const buf = load(A.f);
    if (!buf) { // todavía cargando: reintentar en cuanto llegue
      const p = buffers.get(A.f);
      if (p && p.then) p.then(() => this.sync());
      return;
    }
    fade();
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = A.rate || 1;
    // el MP3 lleva un poco de silencio de relleno al principio y al final: el bucle salta esos bordes
    src.loopStart = 0.06; src.loopEnd = Math.max(0.5, buf.duration - 0.06);
    const g = a.createGain(); const t = a.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(A.v, t + 2.5);
    src.connect(g); g.connect(ambBus());
    src.start(t, Math.random() * Math.max(0, buf.duration - 1));
    curAmb = { key: wantAmb, src, gain: g };
  },
};
function fade() {
  const a = audioCtx();
  if (!curAmb || !a) { curAmb = null; return; }
  const old = curAmb; curAmb = null;
  const t = a.currentTime;
  old.gain.gain.cancelScheduledValues(t); old.gain.gain.setValueAtTime(old.gain.gain.value, t); old.gain.gain.linearRampToValueAtTime(0.0001, t + 2);
  setTimeout(() => { try { old.src.stop(); } catch {} try { old.gain.disconnect(); } catch {} }, 2200);
}
