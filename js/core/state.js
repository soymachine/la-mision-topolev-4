// Estado global de la partida + guardado en localStorage
import { MODULES } from '../data/world.js';
import { createAgent, starterKit } from './agents.js';
import { createItem } from './items.js';
import { RNG } from '../util/rng.js';

const KEY = 'topolev_save_v1';
const SETTINGS_KEY = 'topolev_settings_v1';
export const SAVE_VERSION = 1;

export let S = null; // estado de la partida
export const settings = loadSettings();

// gancho para serializar la expedición en curso (lo registra expedition.js)
let expSerializer = null;
export function setExpSerializer(fn) { expSerializer = fn; }

export function newGame() {
  const g = new RNG();
  const modules = {};
  for (const m of MODULES) modules[m.id] = 0;
  S = {
    v: SAVE_VERSION, created: Date.now(), day: 1, ess: 0, rub: 450, modules,
    agents: [], stash: [], fallen: [], unlocked: 1, cleared: {}, bestiary: {},
    stats: { expeditions: 0, extractions: 0, deaths: 0, kills: 0, essTotal: 0, rubTotal: 0, turns: 0, bestItem: null },
    shop: null, recruits: null, messages: [], lastReport: null, exp: null, introSeen: false,
  };
  for (let i = 0; i < 3; i++) {
    const a = createAgent(g, { day: 1 });
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
  S.messages.push({ day: 1, text: 'Camarada director: el equipo está listo. El Bloque Administrativo es nuestro primer objetivo. Traed esencia. Volved vivos. — Dr. A. Topolev' });
  save();
  return S;
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== SAVE_VERSION) return null;
    S = d;
    return S;
  } catch (e) {
    console.error('Error al cargar', e);
    return null;
  }
}

let saveTimer = null;
export function save() {
  if (!S) return false;
  try {
    if (expSerializer) S.exp = expSerializer();
    localStorage.setItem(KEY, JSON.stringify(S));
    return true;
  } catch (e) {
    console.error('Error al guardar', e);
    return false;
  }
}
export function saveSoon(ms = 400) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, ms);
}
export function wipe() {
  try { localStorage.removeItem(KEY); } catch {}
  S = null;
}

function loadSettings() {
  const def = { sound: true, crt: true, zoom: 15, volume: 0.5 };
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
