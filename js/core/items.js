// Instancias de objetos: generación, estadísticas, nombres, valor, tooltips
import { ITEMS, CAT_INFO, AFFIXES, MYTHIC_NAMES, EPITHETS, UNCOMMON_SUFFIX, RARE_SUFFIX, AMMO_NAMES } from '../data/items.js';
import { RARITIES, rarityWeights } from '../data/rarity.js';
import { rng as grng, uid } from '../util/rng.js';
import { esc } from '../util/dom.js';

export const base = (it) => ITEMS[it.b];
export const isStack = (it) => (ITEMS[it.b].stack || 1) > 1;
export const rarityColor = (r) => RARITIES[r].color;

export function createItem(b, r = 0, g = grng, q) {
  const def = ITEMS[b];
  if (!def) throw new Error('Objeto desconocido ' + b);
  const it = { uid: uid('i'), b, r };
  if ((def.stack || 1) > 1) {
    it.q = q != null ? q : def.pack || 1;
    // los consumibles y munición no tienen afijos (su rareza afecta poco)
    if (def.cat === 'ammo') it.r = 0;
  } else {
    // afijos
    const pool = AFFIXES.filter((a) => a.cats.includes(def.cat) && !(a.ranged && def.wtype === 'melee'));
    const n = Math.min(RARITIES[r].affixes, pool.length);
    const chosen = g.shuffle([...pool]).slice(0, n);
    if (chosen.length) it.aff = chosen.map((a) => [a.id, a.roll(r, g)]);
    if (r === 5) it.nm = def.name + ' ' + g.pick(MYTHIC_NAMES);
    else if (r >= 3) it.nm = def.name + ' ' + g.pick(EPITHETS);
    else if (r === 2) it.nm = def.name + ' ' + g.pick(RARE_SUFFIX);
    else if (r === 1) it.nm = def.name + ' ' + g.pick(UNCOMMON_SUFFIX);
    if (def.cat === 'weapon' && def.mag) it.ld = itemStats(it).mag;
  }
  return it;
}

// Forja de esencia: sube la rareza de un objeto y añade una propiedad
export const FORGE_CATS = ['weapon', 'armor', 'helmet', 'gadget', 'backpack'];
export function forgeCost(it) {
  const d = ITEMS[it.b];
  return { ess: Math.round(25 * Math.pow(it.r + 1, 2) * (1 + d.tier * 0.5)), rub: Math.round(itemValue(it) * 0.4) };
}
export function infuse(it, g = grng) {
  const d = ITEMS[it.b];
  if (it.r >= 5) return false;
  const oldMag = d.cat === 'weapon' && d.mag ? itemStats(it).mag : 0;
  it.r++;
  const pool = AFFIXES.filter((a) => a.cats.includes(d.cat) && !(a.ranged && d.wtype === 'melee'));
  const have = new Set((it.aff || []).map(([k]) => k));
  const fresh = pool.filter((a) => !have.has(a.id));
  it.aff = it.aff || [];
  if (fresh.length) { const a = g.pick(fresh); it.aff.push([a.id, a.roll(it.r, g)]); }
  else if (it.aff.length) { const i = g.int(0, it.aff.length - 1); const a = AFFIXES.find((x) => x.id === it.aff[i][0]); it.aff[i][1] += Math.max(1, Math.round(a.roll(it.r, g) / 2)); }
  // re-roll suave: las propiedades existentes mejoran un poco
  for (const af of it.aff) af[1] = Math.round(af[1] * 1.1) || af[1];
  const base = d.name;
  if (it.r === 5) it.nm = base + ' ' + g.pick(MYTHIC_NAMES);
  else if (it.r >= 3) it.nm = it.nm && it.r > 3 && /«/.test(it.nm) ? it.nm : base + ' ' + g.pick(EPITHETS);
  else if (it.r === 2) it.nm = base + ' ' + g.pick(RARE_SUFFIX);
  else it.nm = base + ' ' + g.pick(UNCOMMON_SUFFIX);
  statCache.delete(it);
  if (oldMag) it.ld = Math.min(it.ld ?? 0, itemStats(it).mag);
  return true;
}

export function itemName(it) { return it.nm || ITEMS[it.b].name; }
export function itemGlyph(it) { return ITEMS[it.b].glyph || CAT_INFO[ITEMS[it.b].cat].glyph; }

function affSum(it, stat) {
  let s = 0;
  if (it.aff) for (const [k, v] of it.aff) if (k === stat) s += v;
  return s;
}

const statCache = new WeakMap();
export function itemStats(it) {
  const c = statCache.get(it);
  if (c && c.r === it.r) return c.s;
  const d = ITEMS[it.b];
  const m = RARITIES[it.r].mult;
  const s = { cat: d.cat };
  if (d.cat === 'weapon') {
    const dp = 1 + affSum(it, 'dmgPct') / 100;
    s.dmg = [Math.max(1, Math.round(d.dmg[0] * m * dp)), Math.max(1, Math.round(d.dmg[1] * m * dp))];
    s.acc = d.acc + affSum(it, 'acc') + (it.r >= 2 ? it.r : 0);
    s.range = d.range + affSum(it, 'range');
    s.crit = d.crit + affSum(it, 'crit');
    s.pierce = (d.pierce || 0) + affSum(it, 'pierce');
    s.burst = d.burst || 1;
    s.noise = d.noise;
    s.wtype = d.wtype;
    s.ammo = d.ammo;
    s.chain = d.chain || 0;
    if (d.mag) s.mag = Math.round(d.mag * (1 + affSum(it, 'magPct') / 100));
  } else {
    for (const k of ['prot', 'rad', 'ev', 'hp', 'vision', 'essence', 'acc', 'crit', 'regen', 'slots', 'gasImmune']) {
      let v = d[k] || 0;
      if (v > 0 && (k === 'prot' || k === 'rad' || k === 'hp' || k === 'essence' || k === 'acc')) v = Math.round(v * (k === 'prot' ? 1 + (m - 1) * 0.8 : m));
      v += affSum(it, k);
      if (v) s[k] = v;
    }
    if (s.rad) s.rad = Math.min(90, s.rad);
  }
  statCache.set(it, { r: it.r, s });
  return s;
}

export function itemValue(it, unit = false) {
  const d = ITEMS[it.b];
  let v = d.value * RARITIES[it.r].value * (1 + affSum(it, 'valuePct') / 100);
  if (!unit && it.q) v *= it.q;
  return Math.max(1, Math.round(v));
}

// ---------- Botín aleatorio ----------
const CAT_W = { weapon: 12, ammo: 20, armor: 6, helmet: 6, gadget: 7, backpack: 3, consumable: 24, valuable: 22 };
export function tierCap(level) { return Math.max(0, Math.min(5, Math.floor((level + 1) / 2))); }

export function rollRarity(level, g = grng, bonus = 0) {
  return g.weightedIndex(rarityWeights(level, bonus));
}

export function rollLoot(level, g = grng, opts = {}) {
  const catW = { ...CAT_W, ...(opts.catW || {}) };
  const cat = g.weighted(Object.keys(catW), (k) => catW[k]);
  const cap = Math.min(5, tierCap(level) + (opts.tierBonus || 0));
  let pool = Object.entries(ITEMS).filter(([, d]) => d.cat === cat && d.tier <= cap);
  if (!pool.length) pool = Object.entries(ITEMS).filter(([, d]) => d.cat === 'valuable');
  const [b, d] = g.weighted(pool, ([, dd]) => 1 + dd.tier * 0.6 + (dd.tier === cap ? 1 : 0));
  const r = rollRarity(level, g, opts.rarityBonus || 0);
  let q;
  if (d.cat === 'ammo') q = Math.max(1, Math.round((d.pack || 10) * g.float(0.5, 1.3)));
  else if (d.cat === 'consumable') q = d.use === 'beacon' ? 1 : g.int(1, d.heal > 30 ? 1 : 2);
  return createItem(b, r, g, q);
}

// ---------- Tooltip ----------
export function itemTooltip(it, compare = null, extra = '') {
  const d = ITEMS[it.b];
  const s = itemStats(it);
  const rr = RARITIES[it.r];
  const col = rr.color;
  let h = `<div class="tt-title" style="color:${col}">${esc(itemName(it))}${it.q > 1 ? ` <span class="dimt">×${it.q}</span>` : ''}</div>`;
  h += `<div class="tt-sub">${CAT_INFO[d.cat].name}${d.cat !== 'ammo' ? ` · <span style="color:${col}">${rr.name}</span>` : ''} · Nv ${d.tier}</div>`;
  h += `<div class="tt-sep">${'─'.repeat(60)}</div>`;
  const cs = compare ? itemStats(compare) : null;
  const cmp = (v, o, lowerBetter = false) => {
    if (o == null || v === o) return '';
    const better = lowerBetter ? v < o : v > o;
    return ` <span class="${better ? 'tt-better' : 'tt-worse'}">${better ? '▲' : '▼'}</span>`;
  };
  const row = (k, v) => `<div class="tt-row"><span class="dimt">${k}</span><span>${v}</span></div>`;
  if (d.cat === 'weapon') {
    const avg = ((s.dmg[0] + s.dmg[1]) / 2) * s.burst;
    const oavg = cs && cs.dmg ? ((cs.dmg[0] + cs.dmg[1]) / 2) * cs.burst : null;
    h += row('Daño', `${s.dmg[0]}–${s.dmg[1]}${s.burst > 1 ? ` ×${s.burst}` : ''}${cmp(avg, oavg)}`);
    h += row('Precisión', `${s.acc}%${cmp(s.acc, cs && cs.acc)}`);
    h += row('Alcance', `${s.range}${cmp(s.range, cs && cs.range)}`);
    if (s.mag) h += row('Cargador', `${it.ld ?? s.mag}/${s.mag}`);
    if (s.ammo) h += row('Munición', AMMO_NAMES[s.ammo]);
    h += row('Crítico', `${s.crit}%`);
    if (s.pierce) h += row('Perforación', s.pierce >= 99 ? 'total' : s.pierce);
    h += row('Ruido', s.noise >= 14 ? 'muy alto' : s.noise >= 10 ? 'alto' : s.noise >= 5 ? 'medio' : 'bajo');
  } else if (d.cat === 'consumable') {
    if (d.heal) h += row('Cura', d.heal >= 999 ? 'total' : d.heal);
    if (d.radHeal) h += row('Radiación', '−' + d.radHeal);
    if (d.dmg) h += row('Daño', `${d.dmg[0]}–${d.dmg[1]} (radio ${d.blast})`);
    if (d.range) h += row('Alcance', d.range);
  } else if (d.cat !== 'ammo' && d.cat !== 'valuable') {
    const lab = { prot: 'Protección', rad: 'Resist. radiación', ev: 'Agilidad', hp: 'Salud máx.', vision: 'Visión', essence: 'Esencia', acc: 'Puntería', crit: 'Crítico', regen: 'Regeneración', slots: 'Huecos', gasImmune: 'Inmune al gas' };
    for (const k of Object.keys(lab)) {
      if (s[k] == null) continue;
      const suf = k === 'rad' || k === 'essence' || k === 'crit' ? '%' : '';
      h += row(lab[k], k === 'gasImmune' ? 'sí' : `${s[k] > 0 && k !== 'prot' ? '+' : ''}${s[k]}${suf}${cmp(s[k], cs ? cs[k] || 0 : null)}`);
    }
  }
  if (d.essenceValue) h += row('Esencia', `${d.essenceValue} ✦`);
  if (it.aff && it.aff.length) {
    h += `<div class="tt-sep">${'─'.repeat(60)}</div>`;
    for (const [k, v] of it.aff) {
      const a = AFFIXES.find((x) => x.id === k);
      if (a) h += `<div class="tt-aff">◆ ${a.label(v)}</div>`;
    }
  }
  h += `<div class="tt-sep">${'─'.repeat(60)}</div>`;
  h += `<div class="tt-lore">${esc(d.desc || '')}</div>`;
  h += row('Valor', `${itemValue(it)} ₽`);
  if (extra) h += extra;
  return h;
}

export function itemHTML(it, opts = {}) {
  const col = rarityColor(it.r);
  return `<span class="ig" style="color:${col}">${itemGlyph(it)}</span><span class="in" style="color:${col}">${esc(itemName(it))}</span>${it.q > 1 ? `<span class="iq">×${it.q}</span>` : ''}${opts.extra || ''}`;
}

// Fusiona pilas: añade it a la lista respetando el máximo de la pila. Devuelve el resto (o null)
export function mergeInto(list, it, maxSlots = Infinity) {
  const d = ITEMS[it.b];
  if ((d.stack || 1) > 1) {
    for (const o of list) {
      if (o.b === it.b && o.r === it.r && o.q < d.stack) {
        const mv = Math.min(d.stack - o.q, it.q);
        o.q += mv; it.q -= mv;
        if (it.q <= 0) return null;
      }
    }
  }
  if (list.length < maxSlots) { list.push(it); return null; }
  return it;
}

export function sortItems(list) {
  const order = ['weapon', 'armor', 'helmet', 'gadget', 'backpack', 'consumable', 'ammo', 'valuable'];
  return list.sort((a, b) => order.indexOf(ITEMS[a.b].cat) - order.indexOf(ITEMS[b.b].cat) || b.r - a.r || itemName(a).localeCompare(itemName(b)));
}
