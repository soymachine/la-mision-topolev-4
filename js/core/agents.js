// Agentes: generación, estadísticas derivadas, experiencia
import { FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, NICKNAMES, TRAITS } from '../data/world.js';
import { ITEMS, GADGET_SETS } from '../data/items.js';
import { itemStats, createItem } from './items.js';
import { rng as grng, uid } from '../util/rng.js';
import { ATTRS, ATTR_MAX, TALENTS, TALENT_EVERY } from '../data/talents.js';

export const AGENT_COLORS = ['#ffffff', '#7fe8ff', '#fff07a', '#b8ff8a', '#ffa8e8', '#a8b8ff', '#ffd0a0', '#d0fff0'];
export const EQUIP_SLOTS = [
  { id: 'w1', label: 'ARMA 1', cats: ['weapon'] },
  { id: 'w2', label: 'ARMA 2', cats: ['weapon'] },
  { id: 'armor', label: 'ARMADURA', cats: ['armor'] },
  { id: 'helmet', label: 'CASCO', cats: ['helmet'] },
  { id: 'g1', label: 'GADGET', cats: ['gadget'] },
  { id: 'g2', label: 'GADGET', cats: ['gadget'] },
  { id: 'pack', label: 'MOCHILA', cats: ['backpack'] },
  { id: 'case', label: 'CONTENEDOR', cats: ['case'] },
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
    hp: 0, rad: 0, color: g.pick(AGENT_COLORS), flags: {},
    attr: blankAttrs(), pts: 0, talents: [], offers: [],
    equip: { w1: null, w2: null, armor: null, helmet: null, g1: null, g2: null, pack: null, case: null },
    bag: [], missions: 0, kills: 0, extractions: 0, essTotal: 0, hired: opts.day || 1,
  };
  for (let i = 1; i < lvl; i++) levelUp(a, g);
  autoAssign(a, g); // los reclutas veteranos llegan con sus puntos ya repartidos
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
    dmgPct: 0, range: 0, sets: [],
  };
  // atributos y talentos
  const addM = (m, n = 1) => { for (const [k, v] of Object.entries(m)) { if (k === 'hp') s.hpMax += v * n; else s[k] = (s[k] || 0) + v * n; } };
  if (a.attr) for (const at of ATTRS) {
    const n = a.attr[at.id] || 0;
    if (!n) continue;
    addM(at.per, n);
    if (at.every) addM(at.every[1], Math.floor(n / at.every[0]));
  }
  for (const id of a.talents || []) if (TALENTS[id] && TALENTS[id].mods) addM(TALENTS[id].mods);
  for (const k of ['armor', 'helmet', 'g1', 'g2', 'pack']) {
    const it = a.equip[k];
    if (!it || (k[0] === 'g' && ITEMS[it.b].cat !== 'gadget')) continue;
    const st = itemStats(it);
    for (const key of ['prot', 'rad', 'ev', 'vision', 'essence', 'acc', 'crit', 'regen', 'slots', 'gasImmune', 'dmgPct', 'range']) if (st[key]) s[key] += st[key];
    if (st.hp) s.hpMax += st.hp;
  }
  // conjuntos de gadgets
  const gids = [a.equip.g1, a.equip.g2].filter(Boolean).map((it) => it.b);
  for (const [id, set] of Object.entries(GADGET_SETS)) {
    if (set.pieces.every((p) => gids.includes(p))) {
      s.sets.push(id);
      for (const [k, v] of Object.entries(set.mods)) s[k] = (s[k] || 0) + v;
    }
  }
  // visión extra de mods (miras nocturnas, linternas tácticas)
  let mv = 0;
  for (const k of ['w1', 'w2']) if (a.equip[k]) mv = Math.max(mv, itemStats(a.equip[k]).vision || 0);
  s.vision += mv;
  s.rad = Math.min(90, s.rad);
  s.vision = Math.min(14, s.vision);
  // la radiación acumulada reduce la salud máxima
  s.hpMaxEff = Math.max(5, Math.round(s.hpMax * (1 - Math.min(100, a.rad) / 250)));
  return s;
}

export function xpForLevel(l) { return 50 * l * (l + 1) / 2; }
export const blankAttrs = () => Object.fromEntries(ATTRS.map((x) => [x.id, 0]));
// subida de nivel: salud automática + 1 punto de atributo + oferta de talentos cada 3 niveles
function levelUp(a, g) {
  a.baseHp += g.int(2, 4);
  a.pts = (a.pts || 0) + 1;
  if (a.lvl % TALENT_EVERY === 0) a.offers.push(rollOffer(a, g));
}
// 3 talentos al azar que el agente no tenga ni tenga ya ofrecidos
export function rollOffer(a, g = grng, n = 3) {
  const taken = new Set([...(a.talents || []), ...(a.offers || []).flat()]);
  const pool = Object.keys(TALENTS).filter((t) => !taken.has(t));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(g.next() * pool.length), 1)[0]);
  return out;
}
export const pendingAscent = (a) => (a.pts || 0) > 0 || (a.offers && a.offers.length > 0);
export function spendPoint(a, attr) {
  if (!(a.pts > 0) || !ATTRS.find((x) => x.id === attr) || (a.attr[attr] || 0) >= ATTR_MAX) return false;
  a.attr[attr] = (a.attr[attr] || 0) + 1;
  a.pts--;
  return true;
}
export function pickTalent(a, id) {
  const offer = a.offers && a.offers[0];
  if (!offer || !offer.includes(id)) return false;
  a.talents.push(id);
  a.offers.shift();
  return true;
}
// reparto automático (reclutas)
export function autoAssign(a, g = grng) {
  while (a.pts > 0) { const free = ATTRS.filter((x) => (a.attr[x.id] || 0) < ATTR_MAX); if (!free.length) break; spendPoint(a, g.pick(free).id); }
  while (a.offers.length) pickTalent(a, g.pick(a.offers[0]));
}
export function talentFlag(a, f) {
  let v = 0;
  for (const id of (a && a.talents) || []) { const fl = TALENTS[id] && TALENTS[id].flags; if (fl && fl[f]) v = Math.max(v, fl[f]); }
  return v;
}
// devuelve nº de niveles subidos
export function giveXp(a, xp, g = grng) {
  a.xp += xp;
  let ups = 0;
  while (a.lvl < 15 && a.xp >= xpForLevel(a.lvl)) {
    a.lvl++; ups++;
    levelUp(a, g);
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
