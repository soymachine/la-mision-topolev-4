// Logros y estadísticas ampliadas (fase 24.6).
// Los logros se guardan fuera de la partida, en su propia clave de localStorage: { id: { day, t } }.
// Así sobreviven a borrar o sobrescribir una ranura y se comparten entre partidas.
import { S } from './state.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { ITEMS } from '../data/items.js';
import { MAPS, zoneOpen } from '../data/world.js';

const KEY = 'topolev_achievements_v1';
let cache = null;
function store() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { cache = {}; }
  return cache;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(store())); } catch {} }
export const unlockedAchievements = () => ({ ...store() });
export const hasAchievement = (id) => !!store()[id];
export function resetAchievements() { cache = {}; persist(); }

// quién avisa al desbloquear (lo pone main.js: toast + sonido)
let notifier = null;
export function setAchievementNotifier(fn) { notifier = fn; }

// ---------------------------------------------------------------- estadísticas ampliadas (24.6.3)
export function statsDefaults(d) {
  d.stats = d.stats || {};
  const s = d.stats;
  for (const k of ['expeditions', 'extractions', 'deaths', 'kills', 'essTotal', 'rubTotal', 'turns']) if (s[k] == null) s[k] = 0;
  for (const k of ['zones', 'killsBy', 'killsWeapon', 'essByDay']) s[k] = s[k] || {};
  for (const k of ['rescues', 'nadesKicked', 'backstabs', 'bossKills', 'eliteKills', 'noLoss', 'bestNoLoss']) if (s[k] == null) s[k] = 0;
  if (s.bestDay === undefined) s.bestDay = null;
}
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
export function statKill(e, weaponBase, { boss, elite, back } = {}) {
  if (!S || !S.stats) return;
  statsDefaults(S);
  bump(S.stats.killsBy, e.type);
  if (weaponBase) bump(S.stats.killsWeapon, weaponBase);
  if (boss) S.stats.bossKills++;
  if (elite) S.stats.eliteKills++;
  if (back) S.stats.backstabs++;
}
export function statBump(k, n = 1) { if (!S || !S.stats) return; statsDefaults(S); S.stats[k] = (S.stats[k] || 0) + n; }
// al acabar una expedición: por zona, esencia del día y racha sin bajas
export function statExpedition(zoneId, { extracted, deaths, ess }) {
  if (!S) return;
  statsDefaults(S);
  const s = S.stats;
  if (zoneId) {
    const z = (s.zones[zoneId] = s.zones[zoneId] || { exp: 0, ext: 0, deaths: 0 });
    z.exp++; if (extracted) z.ext++; z.deaths += deaths;
  }
  bump(s.essByDay, S.day, ess || 0);
  if (!s.bestDay || s.essByDay[S.day] > s.bestDay.ess) s.bestDay = { day: S.day, ess: s.essByDay[S.day] };
  s.noLoss = deaths ? 0 : s.noLoss + 1;
  s.bestNoLoss = Math.max(s.bestNoLoss, s.noLoss);
}

// ---------------------------------------------------------------- comprobación (24.6.2)
function derived() {
  const owned = new Set();
  const add = (l) => { for (const it of l || []) if (it && ITEMS[it.b] && ITEMS[it.b].trophy) owned.add(it.b); };
  add(S.stash);
  for (const a of S.agents || []) { add(a.bag); add(Object.values(a.equip || {})); }
  return {
    trophies: owned.size,
    trophiesTotal: Object.values(ITEMS).filter((d) => d.trophy).length,
    surface: MAPS.filter((m) => m.stratum === 'sup').map((m) => m.id),
    allOpen: MAPS.every((m, i) => zoneOpen(S, i)),
    maxLvl: Math.max(0, ...(S.agents || []).map((a) => a.lvl || 1)),
  };
}
// devuelve los logros recién desbloqueados (y avisa de cada uno)
export function checkAchievements() {
  if (!S) return [];
  statsDefaults(S);
  const got = store(), X = derived(), fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.id]) continue;
    let ok = false;
    try { ok = !!a.test(S, X); } catch { ok = false; }
    if (ok) { got[a.id] = { day: S.day, t: Date.now() }; fresh.push(a); }
  }
  if (fresh.length) { persist(); if (notifier) for (const a of fresh) notifier(a); }
  return fresh;
}
