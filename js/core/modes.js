// Modos de juego (fase 24.7): Historia, Libre, Hierro, Desafío semanal y Nueva partida+ «1987».
// S.mode guarda el modo; cada modo deja sus datos en S (unlockAll, iron, challenge, ng).
// Lo que pasa de una partida a otra (el legado para «1987» y la tabla del desafío) vive fuera de las ranuras.
import { S, addMessage } from './state.js';
import { uid } from '../util/rng.js';
import { createItem } from './items.js';
import { ITEMS } from '../data/items.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { hasAchievement } from './achievements.js';

export const MODES = {
  historia: { name: 'HISTORIA', short: '', desc: 'La campaña: actos, cuota del Comité, ataques a la base y finales.' },
  libre: { name: 'LIBRE', short: 'LIBRE', desc: 'Todas las zonas abiertas, 2000 ₽ al empezar, sin cuota ni ataques a la base, sin actos ni finales.' },
  hierro: { name: 'HIERRO', short: '⚒ HIERRO', desc: 'Una sola vida: guardado continuo, sin exportar copias, y si os quedáis sin agentes ni dinero para reclutar, la partida se borra.' },
  desafio: { name: 'DESAFÍO SEMANAL', short: '⚑ DESAFÍO', desc: 'Misma semilla para todos esta semana (agentes, botín inicial y mapas de las 3 primeras zonas). 15 días para hacer la mejor puntuación.' },
  ng: { name: 'NUEVA PARTIDA+ «1987»', short: '✪ 1987', desc: 'Un año después. Se desbloquea al ver un final: empezáis con un veterano o un trofeo de la partida anterior y modificadores a elegir.' },
};
// modificadores acumulables de «1987»
export const NG_MODS = {
  lvl: { name: '+1 nivel a los chebylitas', desc: 'Todas las zonas, un nivel más.' },
  alert: { name: 'Alerta del reactor +1', desc: 'Empieza en «Inquieto»: más élites y el pulso antes.' },
  poor: { name: 'Presupuesto recortado', desc: 'Empezáis con 200 ₽ en vez de 450.' },
};
export const CHALLENGE_DAYS = 15;

// ---------------------------------------------------------------- semana ISO y semilla del desafío
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export const weekSeed = (week = isoWeek()) => hashSeed('topolev-' + week);
// semilla de los mapas: en el desafío, fija para las 3 primeras zonas (cada visita a la misma zona, el mismo mapa)
export function mapSeed(mapIdx) {
  if (S && S.challenge && mapIdx >= 0 && mapIdx < 3) return hashSeed(`${S.challenge.week}-map-${mapIdx}`);
  return null;
}

// ---------------------------------------------------------------- almacenes fuera de la partida
const LEGACY_KEY = 'topolev_legacy_v1';
const TABLE_KEY = 'topolev_challenge_v1';
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const legacy = () => get(LEGACY_KEY, null);
// «1987» se desbloquea con cualquier final (logro) o con un legado guardado
export const ngUnlocked = () => !!legacy() || ACHIEVEMENTS.some((a) => a.id.startsWith('end_') && hasAchievement(a.id));
// al ver un final: el mejor agente vivo y un trofeo pasan al legado
export function saveLegacy(ending) {
  if (!S) return;
  const best = [...(S.agents || [])].sort((a, b) => (b.lvl || 1) - (a.lvl || 1))[0] || null;
  let trophy = null;
  const scan = (l) => { for (const it of l || []) if (!trophy && it && ITEMS[it.b] && ITEMS[it.b].trophy) trophy = it; };
  scan(S.stash); for (const a of S.agents || []) { scan(a.bag); scan(Object.values(a.equip || {})); }
  put(LEGACY_KEY, { ending, day: S.day, agent: best ? JSON.parse(JSON.stringify(best)) : null, trophy: trophy ? JSON.parse(JSON.stringify(trophy)) : null });
}
export const challengeTable = (week = isoWeek()) => (get(TABLE_KEY, {})[week] || []);
function recordScore(week, entry) {
  const all = get(TABLE_KEY, {});
  const l = (all[week] = all[week] || []);
  l.push(entry); l.sort((a, b) => b.score - a.score); l.length = Math.min(l.length, 10);
  put(TABLE_KEY, all);
}
export function challengeScore(st = S) {
  const s = st.stats || {};
  return Math.max(0, Math.round((s.essTotal || 0) + (s.kills || 0) * 2 + (s.extractions || 0) * 25 - (s.deaths || 0) * 40));
}

// ---------------------------------------------------------------- crear la partida en un modo
// opts: { mode, ngMods: { lvl, alert, poor }, carry: 'agent' | 'trophy' }. g: RNG de la creación.
export function applyMode(st, opts = {}) {
  const mode = MODES[opts.mode] ? opts.mode : 'historia';
  st.mode = mode;
  if (mode === 'libre') {
    st.unlockAll = true; st.rub = 2000;
    st.act = 0; st.pendingScenes = []; st.flags.noStory = 1;
    st.messages.push({ day: 1, text: 'Modo LIBRE: todas las zonas están abiertas. Sin cuota del Comité ni ataques a la base.' });
  } else if (mode === 'hierro') {
    st.iron = 1;
    st.messages.push({ day: 1, text: 'Modo HIERRO: una sola vida. Cada paso queda guardado.' });
  } else if (mode === 'desafio') {
    const week = opts.week || isoWeek();
    st.challenge = { week, seed: weekSeed(week), days: CHALLENGE_DAYS, done: null };
    st.messages.push({ day: 1, text: `DESAFÍO SEMANAL ${week}: ${CHALLENGE_DAYS} días. Puntuación = esencia + 2 por baja + 25 por extracción − 40 por caído.` });
  } else if (mode === 'ng') {
    const m = opts.ngMods || {};
    st.ng = { lvl: m.lvl ? 1 : 0, alert: m.alert ? 1 : 0, poor: m.poor ? 1 : 0 };
    if (st.ng.poor) st.rub = 200;
    const L = legacy();
    if (L && opts.carry === 'agent' && L.agent) {
      const a = L.agent; a.id = uid('a'); a.stress = 0; a.wounds = []; a.mission = null;
      st.agents.push(a);
      st.messages.push({ day: 1, text: `1987: ${a.first} ${a.last} vuelve a Prípiat. No ha olvidado nada.` });
    } else if (L && opts.carry === 'trophy' && L.trophy) {
      st.stash.push({ ...L.trophy });
      st.messages.push({ day: 1, text: `1987: del año pasado solo queda ${ITEMS[L.trophy.b] ? ITEMS[L.trophy.b].name : 'un trofeo'}.` });
    } else st.stash.push(createItem('ai2', 0, undefined, 2));
    st.chronicle.push({ day: 1, text: 'Abril de 1987. Un año después, el Puesto Pripyat-7 vuelve a abrir.' });
  }
  return st;
}

// ---------------------------------------------------------------- reglas durante la partida
export const isLibre = () => !!(S && S.mode === 'libre');
export const isIron = () => !!(S && S.iron);
export const ngLvl = () => (S && S.ng ? S.ng.lvl : 0);
export const ngAlert = () => (S && S.ng ? S.ng.alert : 0);
export const modeTag = (st = S) => (st && MODES[st.mode] ? MODES[st.mode].short : '');
// desafío: al pasar el día límite, se apunta la puntuación en la tabla local
export function challengeDayTick() {
  const c = S && S.challenge;
  if (!c || c.done || S.day <= c.days) return null;
  const score = challengeScore();
  c.done = { score, day: S.day };
  recordScore(c.week, { score, date: Date.now(), ess: S.stats.essTotal, kills: S.stats.kills, deaths: S.stats.deaths });
  const txt = `⚑ DESAFÍO ${c.week} TERMINADO: ${score} puntos. La partida sigue, pero la marca ya está en la tabla.`;
  addMessage(txt);
  return txt;
}
// hierro: ¿se acabó? (sin agentes y sin dinero para reclutar al más barato)
export function ironOver() {
  if (!isIron() || S.agents.length) return false;
  const cheapest = Math.min(80, ...((S.recruits && S.recruits.list) || []).map((r) => r.cost || 80));
  return S.rub < cheapest;
}
