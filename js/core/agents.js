// Agentes: generación, estadísticas derivadas, experiencia
import { FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, NICKNAMES, TRAITS } from '../data/world.js';
import { ITEMS } from '../data/items.js';
import { itemStats, createItem } from './items.js';
import { rng as grng, uid } from '../util/rng.js';

export const AGENT_COLORS = ['#ffffff', '#7fe8ff', '#fff07a', '#b8ff8a', '#ffa8e8', '#a8b8ff', '#ffd0a0', '#d0fff0'];
export const EQUIP_SLOTS = [
  { id: 'w1', label: 'ARMA 1', cats: ['weapon'] },
  { id: 'w2', label: 'ARMA 2', cats: ['weapon'] },
  { id: 'armor', label: 'ARMADURA', cats: ['armor'] },
  { id: 'helmet', label: 'CASCO', cats: ['helmet'] },
  { id: 'g1', label: 'GADGET', cats: ['gadget'] },
  { id: 'g2', label: 'GADGET', cats: ['gadget'] },
  { id: 'pack', label: 'MOCHILA', cats: ['backpack'] },
];
export const BASE_SLOTS = 6;

function femaleSurname(s) {
  if (/ov$|ev$|in$/.test(s)) return s + 'a';
  if (/ski$/.test(s)) return s.replace(/ski$/, 'skaya');
  return s;
}

export function createAgent(g = grng, opts = {}) {
  const female = g.chance(0.4);
  const first = g.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
  let last = g.pick(LAST_NAMES);
  if (female) last = femaleSurname(last);
  const trait = g.pick(TRAITS).id;
  const lvl = opts.lvl || 1;
  const a = {
    id: uid('a'), first, last, nick: pickNick(g, opts.avoid), female,
    lvl, xp: 0, baseHp: g.int(28, 36), acc: g.int(0, 5), ev: g.int(0, 4), trait,
    hp: 0, rad: 0, color: g.pick(AGENT_COLORS),
    equip: { w1: null, w2: null, armor: null, helmet: null, g1: null, g2: null, pack: null },
    bag: [], missions: 0, kills: 0, extractions: 0, essTotal: 0, hired: opts.day || 1,
  };
  for (let i = 1; i < lvl; i++) levelUpStats(a, g);
  a.hp = agentStats(a).hpMax;
  return a;
}

function pickNick(g, avoid) {
  const free = avoid ? NICKNAMES.filter((n) => !avoid.has(n)) : NICKNAMES;
  return g.pick(free.length ? free : NICKNAMES);
}

export function agentName(a, short = false) {
  return short ? `${a.first[0]}. ${a.last}` : `${a.first} «${a.nick}» ${a.last}`;
}
export function traitOf(a) { return TRAITS.find((t) => t.id === a.trait); }

export function agentStats(a) {
  const t = traitOf(a);
  const tm = (t && t.mod) || {};
  const s = {
    hpMax: a.baseHp + (a.lvl - 1) * 4 + (tm.hp || 0), acc: a.acc + (tm.acc || 0), ev: a.ev + (tm.ev || 0),
    prot: 0, rad: tm.rad || 0, vision: 7 + (tm.vision || 0), essence: tm.essence || 0, crit: tm.crit || 0, regen: 0,
    slots: BASE_SLOTS + (tm.slots || 0), gasImmune: 0, healPct: tm.healPct || 0, mining: tm.mining || 0, meleePct: tm.meleePct || 0,
  };
  for (const k of ['armor', 'helmet', 'g1', 'g2', 'pack']) {
    const it = a.equip[k];
    if (!it) continue;
    const st = itemStats(it);
    for (const key of ['prot', 'rad', 'ev', 'vision', 'essence', 'acc', 'crit', 'regen', 'slots', 'gasImmune']) if (st[key]) s[key] += st[key];
    if (st.hp) s.hpMax += st.hp;
  }
  s.rad = Math.min(90, s.rad);
  s.vision = Math.min(13, s.vision);
  // la radiación acumulada reduce la salud máxima
  s.hpMaxEff = Math.max(5, Math.round(s.hpMax * (1 - Math.min(100, a.rad) / 250)));
  return s;
}

export function xpForLevel(l) { return 50 * l * (l + 1) / 2; }
function levelUpStats(a, g) {
  a.baseHp += g.int(2, 4);
  if (g.chance(0.6)) a.acc += 1;
  if (g.chance(0.4)) a.ev += 1;
}
// devuelve nº de niveles subidos
export function giveXp(a, xp, g = grng) {
  a.xp += xp;
  let ups = 0;
  while (a.lvl < 15 && a.xp >= xpForLevel(a.lvl)) {
    a.lvl++; ups++;
    levelUpStats(a, g);
  }
  return ups;
}

export function bagCapacity(a) { return agentStats(a).slots; }

export function recruitCost(a) {
  return 120 + (a.lvl - 1) * 110 + (a.acc + a.ev) * 6;
}

// Equipo inicial para nuevos agentes
export function starterKit(a, g = grng) {
  a.equip.w1 = createItem(g.chance(0.5) ? 'makarov' : 'makarov', 0, g);
  a.equip.w2 = createItem(g.chance(0.5) ? 'knife' : 'shovel', 0, g);
  a.equip.armor = createItem('overall', 0, g);
  a.bag.push(createItem('a_9x18', 0, g, 32));
  a.bag.push(createItem('bandage', 0, g, 2));
}

export function equipCats(slotId) { return EQUIP_SLOTS.find((s) => s.id === slotId).cats; }
export function canEquip(it, slotId) { return equipCats(slotId).includes(ITEMS[it.b].cat); }
