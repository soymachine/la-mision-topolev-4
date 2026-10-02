// Agentes: generación, estadísticas derivadas, experiencia
import { FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, NICKNAMES, TRAITS } from '../data/world.js';
import { ITEMS, GADGET_SETS } from '../data/items.js';
import { itemStats, createItem } from './items.js';
import { rng as grng, uid } from '../util/rng.js';
import { ATTRS, ATTR_MAX, TALENTS, TALENT_EVERY } from '../data/talents.js';
import { SPECS, SPEC_TALENTS, SPEC_LEVEL } from '../data/specs.js';
import { BACKGROUNDS } from '../data/backgrounds.js';
import { ACQUIRED, MEDALS } from '../data/honors.js';

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

export const MAX_LEVEL = 20;
export const ALL_TALENTS = { ...TALENTS, ...SPEC_TALENTS };
export const talentDef = (id) => ALL_TALENTS[id];
// ganchos que rellena la campaña (evita dependencias circulares con el estado)
export const agentHooks = { xpMult: () => 1 };

export function createAgent(g = grng, opts = {}) {
  const female = g.chance(0.4);
  const first = g.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
  let last = g.pick(LAST_NAMES);
  if (female) last = femaleSurname(last);
  const bg = opts.bg || g.pick(Object.keys(BACKGROUNDS));
  const B = BACKGROUNDS[bg];
  const trait = g.chance(0.8) ? g.pick(B.traits) : g.pick(TRAITS).id;
  const lvl = opts.lvl || 1;
  const a = {
    id: uid('a'), first, last, nick: pickNick(g, opts.avoid), female, bg,
    lvl, xp: lvl > 1 ? xpForLevel(lvl - 1) : 0, baseHp: g.int(27, 33), trait,
    hp: 0, rad: 0, color: g.pick(AGENT_COLORS), flags: {},
    av: 2, attr: startAttrs(B, g), pts: 0, talents: [], offers: [], spec: null,
    wounds: [], medals: [], acquired: [],
    equip: { w1: null, w2: null, armor: null, helmet: null, g1: null, g2: null, pack: null, case: null },
    bag: [], missions: 0, kills: 0, extractions: 0, essTotal: 0, hired: opts.day || 1,
  };
  for (let l = 2; l <= lvl; l++) { a.lvl = l; levelUp(a, g); }
  autoAssign(a, g); // los reclutas veteranos llegan con sus puntos, especialización y talentos ya elegidos
  a.hp = agentStats(a).hpMax;
  return a;
}
// atributos iniciales: 2 en todo + trasfondo + 4 puntos al azar (máx. 7 al empezar)
function startAttrs(B, g) {
  const at = Object.fromEntries(ATTRS.map((x) => [x.id, 2]));
  for (const [k, v] of Object.entries(B.attrs)) at[k] += v;
  for (let i = 0; i < 4; i++) { const free = ATTRS.filter((x) => at[x.id] < 7); if (free.length) at[g.pick(free).id]++; }
  return at;
}

function pickNick(g, avoid) {
  const free = avoid ? NICKNAMES.filter((n) => !avoid.has(n)) : NICKNAMES;
  return g.pick(free.length ? free : NICKNAMES);
}

export function agentName(a, short = false) {
  return short ? `${a.first[0]}. ${a.last}` : `${a.first} «${a.nick}» ${a.last}`;
}
export function traitOf(a) { return TRAITS.find((t) => t.id === a.trait); }
export const specOf = (a) => (a.spec ? SPECS[a.spec] : null);

// todo lo que da efectos además del equipo: talentos, rasgos adquiridos y condecoraciones
export function effectSources(a) {
  const out = [];
  for (const id of a.talents || []) if (ALL_TALENTS[id]) out.push(ALL_TALENTS[id]);
  for (const id of a.acquired || []) if (ACQUIRED[id]) out.push(ACQUIRED[id]);
  for (const id of a.medals || []) if (MEDALS[id]) out.push(MEDALS[id]);
  return out;
}
// ¿se cumple una sinergia (gadget equipado o mod montado en un arma)?
export function synOk(a, sy) {
  if (sy.gadget) return [a.equip.g1, a.equip.g2].some((it) => it && it.b === sy.gadget);
  if (sy.mod) return [a.equip.w1, a.equip.w2].some((w) => w && w.mods && Object.values(w.mods).some((m) => m && m.b === sy.mod));
  return false;
}
// atributo efectivo: base + talentos − heridas
export function effAttrs(a) {
  const E = {};
  for (const x of ATTRS) E[x.id] = (a.attr && a.attr[x.id]) || 1;
  for (const src of effectSources(a)) if (src.attr) for (const [k, v] of Object.entries(src.attr)) E[k] += v;
  for (const w of a.wounds || []) E[w.attr] -= 1;
  for (const k in E) E[k] = Math.max(1, Math.min(13, E[k]));
  return E;
}

export function agentStats(a) {
  const t = traitOf(a);
  const tm = (t && t.mod) || {};
  const E = effAttrs(a);
  const s = {
    hpMax: a.baseHp + (a.lvl - 1) * 4 + (E.fue - 3) * 3 + (E.agu - 3) + (tm.hp || 0),
    acc: E.pun - 1 + (tm.acc || 0), ev: E.agi - 1 + (tm.ev || 0),
    prot: 0, rad: (E.agu - 1) * 3 + (tm.rad || 0), vision: 7 + (E.per >= 5 ? 1 : 0) + (E.per >= 8 ? 1 : 0) + (tm.vision || 0),
    essence: (E.tec - 1) * 2 + (tm.essence || 0), crit: E.per - 1 + (tm.crit || 0), regen: 0,
    slots: BASE_SLOTS + (E.fue >= 7 ? 1 : 0) + (E.fue >= 10 ? 1 : 0) + (tm.slots || 0), gasImmune: 0,
    healPct: (E.tec - 1) * 4 + (tm.healPct || 0), mining: tm.mining || (E.tec >= 7 ? 1 : 0), meleePct: (E.fue - 3) * 5 + (tm.meleePct || 0),
    dmgPct: 0, range: 0, sets: [], attrs: E,
  };
  const addM = (m) => { for (const [k, v] of Object.entries(m)) { if (k === 'hp') s.hpMax += v; else if (k === 'mining') s.mining = Math.max(s.mining, v); else s[k] = (s[k] || 0) + v; } };
  for (const src of effectSources(a)) {
    if (src.mods) addM(src.mods);
    for (const sy of src.syn || []) if (sy.mods && synOk(a, sy)) addM(sy.mods);
  }
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
  s.hpMax = Math.max(10, s.hpMax);
  // la radiación acumulada reduce la salud máxima
  s.hpMaxEff = Math.max(5, Math.round(s.hpMax * (1 - Math.min(100, a.rad) / 250)));
  return s;
}

// curva de experiencia: suave hasta el 10 y más empinada hasta el 20
export function xpForLevel(l) { return 25 * l * (l + 1) + (l > 10 ? 25 * (l - 10) ** 3 : 0); }
export const blankAttrs = () => Object.fromEntries(ATTRS.map((x) => [x.id, 2]));
// subida de nivel: salud automática + 1 punto de atributo + elección de talento cada 3 niveles
function levelUp(a, g) {
  a.baseHp += g.int(2, 4);
  a.pts = (a.pts || 0) + 1;
  if (a.lvl % TALENT_EVERY === 0) a.offers.push(null); // la oferta se tira al abrir el ascenso
}
// talentos elegibles: los del árbol de su especialización (los avanzados exigen uno de la rama) y, si faltan, generales
export function eligibleTalents(a) {
  const owned = new Set(a.talents || []);
  if (!a.spec) return Object.keys(TALENTS).filter((t) => !owned.has(t));
  const S = SPECS[a.spec];
  const out = [];
  S.branches.forEach((br, bi) => {
    const has = br.talents.some((t) => owned.has(t));
    for (const t of br.talents) if (!owned.has(t) && (SPEC_TALENTS[t].tier === 1 || has)) out.push(t);
  });
  return out;
}
export function rollOffer(a, g = grng, n = 3, avoid = []) {
  const pool = eligibleTalents(a);
  const out = [];
  if (a.spec) {
    // una opción por rama si se puede, luego el resto
    const byBranch = [0, 1, 2].map((b) => g.shuffle(pool.filter((t) => SPEC_TALENTS[t].branch === b && !avoid.includes(t))));
    for (const list of g.shuffle(byBranch)) if (list.length && out.length < n) out.push(list[0]);
    const rest = g.shuffle(pool.filter((t) => !out.includes(t)));
    while (out.length < n && rest.length) out.push(rest.shift());
    if (out.length < n) {
      const gen = g.shuffle(Object.keys(TALENTS).filter((t) => !(a.talents || []).includes(t) && !out.includes(t)));
      while (out.length < n && gen.length) out.push(gen.shift());
    }
    return out;
  }
  const p = g.shuffle(pool.filter((t) => !avoid.includes(t)));
  while (out.length < n && p.length) out.push(p.shift());
  if (out.length < n) for (const t of avoid) if (out.length < n && pool.includes(t)) out.push(t);
  return out;
}
// oferta actual (se tira la primera vez que se consulta y queda guardada)
export function currentOffer(a, g = grng) {
  if (!a.offers || !a.offers.length) return null;
  if (!a.offers[0] || !a.offers[0].length) a.offers[0] = rollOffer(a, g);
  return a.offers[0];
}
export function rerollOffer(a, g = grng) {
  const cur = currentOffer(a, g);
  if (!cur) return false;
  a.offers[0] = rollOffer(a, g, 3, cur);
  return true;
}
export const needsSpec = (a) => a.lvl >= SPEC_LEVEL && !a.spec;
export const pendingAscent = (a) => (a.pts || 0) > 0 || (a.offers && a.offers.length > 0) || needsSpec(a);
export function chooseSpec(a, id) {
  if (!needsSpec(a) || !SPECS[id]) return false;
  a.spec = id;
  a.offers = a.offers.map(() => null); // las ofertas pendientes pasan a ser de su árbol
  return true;
}
export function spendPoint(a, attr) {
  if (!(a.pts > 0) || !ATTRS.find((x) => x.id === attr) || (a.attr[attr] || 0) >= ATTR_MAX) return false;
  a.attr[attr] = (a.attr[attr] || 0) + 1;
  a.pts--;
  return true;
}
export function pickTalent(a, id) {
  const offer = currentOffer(a);
  if (!offer || !offer.includes(id)) return false;
  a.talents.push(id);
  a.offers.shift();
  return true;
}
// reparto automático (reclutas veteranos)
export function autoAssign(a, g = grng) {
  while (a.pts > 0) { const free = ATTRS.filter((x) => (a.attr[x.id] || 0) < ATTR_MAX); if (!free.length) break; spendPoint(a, g.pick(free).id); }
  if (needsSpec(a)) chooseSpec(a, g.pick(Object.keys(SPECS)));
  while (a.offers.length) { const o = currentOffer(a, g); if (!o || !o.length) { a.offers.shift(); continue; } pickTalent(a, g.pick(o)); }
}
// valor de un efecto especial que no viene del equipo (talentos, rasgos adquiridos, medallas y sus sinergias)
export function talentFlag(a, f) {
  let v = 0;
  if (!a) return 0;
  for (const src of effectSources(a)) {
    const fl = src.flags;
    if (fl && fl[f] != null && Math.abs(fl[f]) > Math.abs(v)) v = fl[f];
    for (const sy of src.syn || []) if (sy.flags && sy.flags[f] && synOk(a, sy) && sy.flags[f] > v) v = sy.flags[f];
  }
  return v;
}
// devuelve nº de niveles subidos
export function giveXp(a, xp, g = grng) {
  a.xp += Math.round(xp * agentHooks.xpMult(a));
  let ups = 0;
  while (a.lvl < MAX_LEVEL && a.xp >= xpForLevel(a.lvl)) {
    a.lvl++; ups++;
    levelUp(a, g);
  }
  return ups;
}

export function bagCapacity(a) { return agentStats(a).slots; }

export function recruitCost(a) {
  const sum = ATTRS.reduce((n, x) => n + ((a.attr && a.attr[x.id]) || 0), 0);
  return Math.max(80, 30 + (a.lvl - 1) * 110 + sum * 4);
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
