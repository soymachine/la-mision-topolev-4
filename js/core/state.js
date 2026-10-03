// Estado global de la partida + guardado en localStorage
import { MODULES, openCount } from '../data/world.js';
import { createAgent, starterKit } from './agents.js';
import { ATTRS, ATTR_MAX } from '../data/talents.js';
import { BACKGROUNDS } from '../data/backgrounds.js';
import { createItem } from './items.js';
import { ITEMS } from '../data/items.js';
import { RNG } from '../util/rng.js';
import { FACTIONS } from '../data/factions.js';
import { storyDefaults } from './story.js';
import { baseDefaults } from './basecore.js';
import { worldDefaults } from './ecosys.js';
import { statsDefaults } from './achievements.js';
import { applyMode, weekSeed, isoWeek } from './modes.js';
import { compressToUTF16, decompressFromUTF16 } from '../util/lz.js';

// Guardado v2: 3 ranuras comprimidas (LZ/UTF-16) + ficha resumen por ranura
const OLD_KEY = 'topolev_save_v1';
const SLOT_KEY = (n) => `topolev_v2_slot${n}`;
const INFO_KEY = (n) => `topolev_v2_slot${n}_info`;
const META_KEY = 'topolev_v2_meta';
const SETTINGS_KEY = 'topolev_settings_v1';
export const SAVE_VERSION = 2;
export const SLOTS = [1, 2, 3];
export let slot = 1;

export let S = null; // estado de la partida
export const settings = loadSettings();

// gancho para serializar la expedición en curso (lo registra expedition.js)
let expSerializer = null;
export function setExpSerializer(fn) { expSerializer = fn; }

export function newGame(n = slot, opts = {}) {
  setSlot(n);
  // fase 24.7: el desafío semanal usa la semilla de la semana (agentes y botín inicial iguales para todos)
  const g = opts.mode === 'desafio' ? new RNG(weekSeed(opts.week || isoWeek())) : new RNG();
  const modules = {};
  for (const m of MODULES) modules[m.id] = 0;
  S = {
    v: SAVE_VERSION, created: Date.now(), day: 1, ess: 0, rub: 450, modules,
    agents: [], stash: [], fallen: [], unlocked: 1, cleared: {}, bestiary: {},
    stats: { expeditions: 0, extractions: 0, deaths: 0, kills: 0, essTotal: 0, rubTotal: 0, turns: 0, bestItem: null },
    shop: null, recruits: null, messages: [], lastReport: null, exp: null, introSeen: false,
    flags: {}, rep: {}, repV: 1, eventsDone: {}, pendingDialogs: [], instructors: [],
  };
  for (let i = 0; i < 3; i++) {
    const a = createAgent(g, { day: 1, avoid: new Set(S.agents.map((x) => x.nick)) });
    starterKit(a, g);
    S.agents.push(a);
  }
  S.stash.push(createItem('toz', 0, g));
  S.stash.push(createItem('a_12', 0, g, 16));
  S.stash.push(createItem('ozk', 0, g));
  S.stash.push(createItem('gp5', 0, g));
  S.stash.push(createItem('ai2', 0, g, 2));
  S.stash.push(createItem('antirad', 0, g, 2));
  S.stash.push(createItem('molotov', 0, g, 2));
  S.stash.push(createItem('torch', 1, g));
  storyDefaults(S);
  baseDefaults(S);
  worldDefaults(S);
  S.act = 1; S.pendingScenes = ['act1']; S.chronicle.push({ day: 1, text: 'Comienza el Acto I: «El Bloque». Llegada al Puesto Pripyat-7.' });
  S.messages.push({ day: 1, text: 'Camarada director: el equipo está listo. El Bloque Administrativo es nuestro primer objetivo. Traed esencia. Volved vivos. — Dr. A. Topolev' });
  applyMode(S, opts); // fase 24.7
  save();
  return S;
}

// ---------- ranuras ----------
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { localStorage.setItem(k, v); },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
function readMeta() { try { return JSON.parse(ls.get(META_KEY)) || {}; } catch { return {}; } }
function writeMeta(m) { try { ls.set(META_KEY, JSON.stringify(m)); } catch {} }
export function setSlot(n) { slot = n; const m = readMeta(); m.last = n; writeMeta(m); }
export function lastSlot() { return readMeta().last || 1; }
export function slotInfo(n) {
  if (!ls.get(SLOT_KEY(n))) return null;
  try { return JSON.parse(ls.get(INFO_KEY(n))) || {}; } catch { return {}; }
}
export function listSlots() { return SLOTS.map((n) => ({ n, info: slotInfo(n) })); }
export function hasSave() { migrateLegacy(); return SLOTS.some((n) => !!ls.get(SLOT_KEY(n))); }

// partida antigua (v1, sin comprimir) → ranura 1
function migrateLegacy() {
  const raw = ls.get(OLD_KEY);
  if (!raw) return;
  try {
    if (!SLOTS.some((n) => ls.get(SLOT_KEY(n)))) {
      const d = JSON.parse(raw);
      if (d && d.v === 1) { upgrade(d); writeSlot(1, d); }
    }
    ls.set(OLD_KEY + '_backup', raw);
    ls.del(OLD_KEY);
  } catch (e) { console.error('Migración v1', e); }
}

function parseSave(raw) {
  if (!raw) return null;
  const json = raw[0] === '{' ? raw : decompressFromUTF16(raw);
  if (!json) return null;
  return JSON.parse(json);
}

export function load(n = lastSlot()) {
  migrateLegacy();
  try {
    const d = parseSave(ls.get(SLOT_KEY(n)));
    if (!d || !d.v) return null;
    upgrade(d);
    S = d;
    setSlot(n);
    migrate(S);
    return S;
  } catch (e) {
    console.error('Error al cargar', e);
    return null;
  }
}

// actualiza estructuras de versiones anteriores
function upgrade(d) {
  if (d.v < 2) { d.flags = d.flags || {}; d.rep = d.rep || {}; d.eventsDone = d.eventsDone || {}; d.v = 2; }
  d.flags = d.flags || {}; d.rep = d.rep || {}; d.eventsDone = d.eventsDone || {}; d.pendingDialogs = d.pendingDialogs || []; d.instructors = d.instructors || []; d.eventZones = d.eventZones || [];
  if (d.modules) for (const m of MODULES) if (d.modules[m.id] == null) d.modules[m.id] = 0;
  storyDefaults(d);
  baseDefaults(d);
  worldDefaults(d);
  statsDefaults(d); // fase 24.6: estadísticas ampliadas
  // fase 18: la reputación pasa a ser absoluta (−100…+100) partiendo de la postura inicial de cada facción
  if (!d.repV) { for (const [f, F] of Object.entries(FACTIONS)) if (F.rep0 != null) d.rep[f] = Math.max(-100, Math.min(100, F.rep0 + (d.rep[f] || 0))); d.repV = 1; }
  for (const a of d.agents || []) upgradeAgent(a);
}
// fases 14 y 15: atributos 1–10, trasfondo, talentos (ofertas retroactivas), contenedor y honores
function upgradeAgent(a) {
  a.flags = a.flags || {};
  if (a.equip && !('comp' in a.equip)) a.equip.comp = null;
  if (a.pts == null) a.pts = 0;
  if (!a.talents) a.talents = [];
  if (!a.offers) { a.offers = []; for (let l = 3; l <= a.lvl; l += 3) a.offers.push(null); }
  if (!('case' in a.equip)) a.equip.case = null;
  if (a.av !== 2 || !a.attr) {
    // de precisión/agilidad base (+ puntos extra de la fase 14) al modelo de 6 atributos de 1 a 10
    const bonus = a.attr || {};
    const at = {
      pun: 1 + (a.acc || 0) + (bonus.pun || 0), agi: 1 + (a.ev || 0) + (bonus.agi || 0),
      fue: 3 + (bonus.fue || 0), agu: 3 + (bonus.agu || 0), per: 3 + (bonus.per || 0), tec: 3 + (bonus.tec || 0),
    };
    for (const x of ATTRS) if (at[x.id] > ATTR_MAX) { a.pts += at[x.id] - ATTR_MAX; at[x.id] = ATTR_MAX; }
    a.baseHp = (a.baseHp || 30) + (bonus.fue || 0) + (bonus.agu || 0);
    a.attr = at;
    delete a.acc; delete a.ev;
    if (!a.bg) {
      const fit = Object.keys(BACKGROUNDS).filter((k) => BACKGROUNDS[k].traits.includes(a.trait));
      const pool = fit.length ? fit : Object.keys(BACKGROUNDS);
      a.bg = pool[(a.id || '').length % pool.length];
    }
    a.av = 2;
  }
  if (a.spec === undefined) a.spec = null;
  a.wounds = a.wounds || []; a.medals = a.medals || []; a.acquired = a.acquired || [];
}

// Ajustes de compatibilidad con contenido retirado
function migrate(st) {
  const all = [...st.agents];
  for (const a of all) {
    for (const k of ['g1', 'g2']) {
      const it = a.equip[k];
      if (it && (!ITEMS[it.b] || ITEMS[it.b].cat !== 'gadget')) { a.equip[k] = null; if (ITEMS[it.b]) a.bag.push(it); }
    }
    a.bag = a.bag.filter((it) => ITEMS[it.b]);
    for (const k of Object.keys(a.equip)) if (a.equip[k] && !ITEMS[a.equip[k].b]) a.equip[k] = null;
    if (a.equip.case && a.equip.case.vault) a.equip.case.vault = a.equip.case.vault.filter((x) => ITEMS[x.b]);
  }
  st.stash = st.stash.filter((it) => ITEMS[it.b]);
  if (st.shop) st.shop.stock = st.shop.stock.filter((it) => ITEMS[it.b]);
}

function writeSlot(n, data) {
  const json = JSON.stringify(data);
  ls.set(SLOT_KEY(n), compressToUTF16(json));
  const info = { day: data.day, agents: data.agents.length, ess: data.ess, rub: data.rub, unlocked: openCount(data), exp: !!data.exp, mode: data.mode || 'historia', iron: !!data.iron, saved: Date.now(), kb: Math.round(json.length / 1024) };
  ls.set(INFO_KEY(n), JSON.stringify(info));
}

let saveTimer = null;
export let lastSaveError = null;
export function save() {
  if (!S) return false;
  try {
    if (expSerializer) S.exp = expSerializer();
    S.v = SAVE_VERSION;
    writeSlot(slot, S);
    lastSaveError = null;
    return true;
  } catch (e) {
    console.error('Error al guardar', e);
    lastSaveError = e;
    return false;
  }
}
export function saveSoon(ms = 400) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, ms);
}
export function wipe(n = slot) {
  ls.del(SLOT_KEY(n)); ls.del(INFO_KEY(n));
  if (n === slot) S = null;
}

// ---------- exportar / importar ----------
export function exportSlot(n) {
  const d = parseSave(ls.get(SLOT_KEY(n)));
  return d ? JSON.stringify(d) : null;
}
export function importToSlot(n, text) {
  const d = JSON.parse(text);
  if (!d || typeof d !== 'object' || !Array.isArray(d.agents) || d.day == null) throw new Error('El archivo no es una partida de La Misión Topolev.');
  upgrade(d);
  migrate(d);
  writeSlot(n, d);
  return true;
}

function loadSettings() {
  const def = { sound: true, crt: true, zoom: null, volume: 0.5, colorblind: false, contrast: false, touch: 'auto', lang: 'es', music: true, musicVol: 0.4, sfxVol: 1 };
  try { return { ...def, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }; } catch { return def; }
}
export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

export function addMessage(text) {
  S.messages.unshift({ day: S.day, text });
  if (S.messages.length > 30) S.messages.length = 30;
}

export function seeEnemy(id) {
  if (!S.bestiary[id]) S.bestiary[id] = { seen: 1, kills: 0 };
}
export function killEnemy(id) {
  seeEnemy(id);
  S.bestiary[id].kills++;
}
