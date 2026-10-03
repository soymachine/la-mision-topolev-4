// Instancias de objetos: generación, estadísticas, nombres, valor, tooltips
import { ITEMS, CAT_INFO, AFFIXES, MYTHIC_NAMES, EPITHETS, UNCOMMON_SUFFIX, RARE_SUFFIX, AMMO_NAMES, GADGET_SETS } from '../data/items.js';
import { MOD_SLOTS, weaponSlots } from '../data/mods.js';
import { RARITIES, rarityWeights, rarSym } from '../data/rarity.js';
import { rng as grng, uid } from '../util/rng.js';
import { esc } from '../util/dom.js';
import { ENEMIES } from '../data/enemies.js';

export const base = (it) => ITEMS[it.b];
export const isStack = (it) => (ITEMS[it.b].stack || 1) > 1;
export const rarityColor = (r) => RARITIES[r].color;

export function createItem(b, r = 0, g = grng, q) {
  const def = ITEMS[b];
  if (!def) throw new Error('Objeto desconocido ' + b);
  const it = { uid: uid('i'), b, r };
  if (def.cat === 'case') { it.r = def.rar || 0; it.vault = []; return it; }
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

export const WTYPE_NAMES = { melee: 'cuerpo a cuerpo', pistol: 'pistola', smg: 'subfusil', shotgun: 'escopeta', rifle: 'fusil', sniper: 'fusil de tirador', mg: 'ametralladora', flame: 'lanzallamas', launcher: 'lanzador', energy: 'arma de esencia' };

// ---------- Mods de armas ----------
const MOD_KEYS = ['acc', 'range', 'crit', 'noise', 'magPct', 'dmgPct', 'pierce', 'scope', 'still', 'vision', 'bayonet'];
const MOD_SCALED = ['acc', 'crit', 'dmgPct', 'magPct', 'still'];
export function modEffects(mod) {
  const d = ITEMS[mod.b];
  const m = RARITIES[mod.r].mult;
  const e = {};
  for (const k of MOD_KEYS) {
    let v = d[k];
    if (!v) continue;
    if (MOD_SCALED.includes(k) && v > 0) v = Math.round(v * m);
    e[k] = v;
  }
  return e;
}
export function slotsOf(it) { const d = ITEMS[it.b]; return d.cat === 'weapon' ? weaponSlots(it.b, d.wtype) : []; }
export function modFits(mod, weapon, slot = null) {
  const md = ITEMS[mod.b], wd = ITEMS[weapon.b];
  if (md.cat !== 'mod' || wd.cat !== 'weapon') return false;
  if (slot && md.slot !== slot) return false;
  return md.fits.includes(wd.wtype) && slotsOf(weapon).includes(md.slot);
}
// instala un mod: devuelve el mod que había antes en esa ranura (o null)
export function installMod(weapon, mod) {
  const slot = ITEMS[mod.b].slot;
  weapon.mods = weapon.mods || {};
  const prev = weapon.mods[slot] || null;
  weapon.mods[slot] = mod;
  clampLoaded(weapon);
  return prev;
}
export function removeMod(weapon, slot) {
  const m = weapon.mods && weapon.mods[slot];
  if (!m) return null;
  weapon.mods[slot] = null;
  clampLoaded(weapon);
  return m;
}
function clampLoaded(w) { const st = itemStats(w); if (st.mag && w.ld > st.mag) w.ld = st.mag; }
const modSig = (it) => (it.mods ? Object.entries(it.mods).map(([k, v]) => (v ? k + v.uid + v.r : '')).join('|') : '');

const statCache = new WeakMap();
export function itemStats(it) {
  const sig = modSig(it);
  const c = statCache.get(it);
  if (c && c.r === it.r && c.sig === sig) return c.s;
  const d = ITEMS[it.b];
  const m = RARITIES[it.r].mult;
  const s = { cat: d.cat };
  if (d.cat === 'weapon') {
    const md = { acc: 0, range: 0, crit: 0, noise: 0, magPct: 0, dmgPct: 0, pierce: 0, still: 0, vision: 0, scope: 0, bayonet: 0 };
    if (it.mods) for (const mo of Object.values(it.mods)) if (mo) { const e = modEffects(mo); for (const k in e) md[k] += e[k]; }
    const dp = 1 + (affSum(it, 'dmgPct') + md.dmgPct) / 100;
    s.dmg = [Math.max(1, Math.round(d.dmg[0] * m * dp)), Math.max(1, Math.round(d.dmg[1] * m * dp))];
    s.acc = d.acc + affSum(it, 'acc') + (it.r >= 2 ? it.r : 0) + md.acc;
    s.range = Math.max(1, d.range + affSum(it, 'range') + (d.wtype === 'melee' ? 0 : md.range));
    s.crit = d.crit + affSum(it, 'crit') + md.crit;
    s.pierce = (d.pierce || 0) + affSum(it, 'pierce') + md.pierce;
    s.burst = d.burst || 1;
    s.noise = Math.max(1, d.noise + md.noise);
    s.wtype = d.wtype;
    s.ammo = d.ammo;
    s.chain = d.chain || 0;
    s.blast = d.blast || 0;
    s.fire = d.fire || 0;
    s.scope = d.wtype === 'sniper' || md.scope > 0;
    s.stillAcc = md.still;
    s.vision = md.vision;
    s.bayonet = md.bayonet > 0;
    if (d.mag) s.mag = Math.max(1, Math.round(d.mag * (1 + (affSum(it, 'magPct') + md.magPct) / 100)));
  } else if (d.cat === 'mod') {
    Object.assign(s, modEffects(it));
  } else {
    for (const k of ['prot', 'rad', 'ev', 'hp', 'vision', 'essence', 'acc', 'crit', 'regen', 'slots', 'gasImmune', 'range', 'dmgPct']) {
      let v = d[k] || 0;
      if (v > 0 && (k === 'prot' || k === 'rad' || k === 'hp' || k === 'essence' || k === 'acc')) v = Math.round(v * (k === 'prot' ? 1 + (m - 1) * 0.8 : m));
      v += affSum(it, k);
      if (v) s[k] = v;
    }
    if (s.rad) s.rad = Math.min(90, s.rad);
  }
  statCache.set(it, { r: it.r, sig, s });
  return s;
}

// efectos condicionales / de aura / de equipo de un gadget, escalados por rareza
export function gadgetExtras(it) {
  const d = ITEMS[it.b];
  const m = RARITIES[it.r].mult;
  const sc = (mods) => { const o = {}; for (const [k, v] of Object.entries(mods || {})) o[k] = v > 1 && k !== 'gasImmune' ? Math.round(v * m) : v; return o; };
  const out = {};
  if (d.cond) out.cond = { when: d.cond.when, mods: sc(d.cond.mods) };
  if (d.aura) out.aura = { r: d.aura.r, mods: sc(d.aura.mods) };
  if (d.team) out.team = { min: d.team.min, mods: sc(d.team.mods) };
  if (d.flags) { out.flags = { ...d.flags }; for (const k of ['killHeal', 'killFrenzy', 'thorns', 'autoInject', 'essHeal']) if (out.flags[k] && k !== 'essHeal') out.flags[k] = Math.round(out.flags[k] * m); }
  return out;
}
const MOD_LABEL = { acc: (v) => `${v > 0 ? '+' : ''}${v} puntería`, prot: (v) => `+${v} protección`, ev: (v) => `${v > 0 ? '+' : ''}${v} agilidad`, crit: (v) => `+${v}% crítico`, dmgPct: (v) => `+${v}% daño`, vision: (v) => `+${v} visión`, rad: (v) => `+${v}% resist. radiación`, regen: (v) => `regeneración +${v}`, essence: (v) => `+${v}% esencia`, gasImmune: () => 'inmune al gas', range: (v) => `+${v} alcance` };
export const modsText = (mods) => Object.entries(mods || {}).map(([k, v]) => (MOD_LABEL[k] ? MOD_LABEL[k](v) : `${k} ${v}`)).join(', ');
export const COND_TEXT = { near: 'Juntos (aliado a ≤3 casillas)', alone: 'Separado (ningún aliado a ≤6)', still: 'Quieto (no te moviste el turno anterior)', hurt: 'Herido (<50% salud)', lowhp: 'Último aliento (<30% salud)' };
export function gadgetEffectLines(it) {
  const d = ITEMS[it.b];
  const x = gadgetExtras(it);
  const L = [];
  if (x.cond) L.push(`<b>${COND_TEXT[x.cond.when]}:</b> ${modsText(x.cond.mods)}`);
  if (x.aura) L.push(`<b>Aura ${x.aura.r} casillas</b> (tú y aliados): ${modsText(x.aura.mods)}`);
  if (x.team) L.push(`<b>Equipo</b> (${x.team.min}+ agentes lo llevan): ${modsText(x.team.mods)}`);
  const f = x.flags || {};
  if (f.radarLoot || f.radarCheb || f.radarFac) L.push(`<b>Radar:</b> ${[f.radarLoot ? `botín a ${f.radarLoot}` : '', f.radarCheb ? `chebylitas a ${f.radarCheb}` : '', f.radarFac ? `otras facciones a ${f.radarFac}` : ''].filter(Boolean).join(' · ')} casillas`);
  if (f.killHeal) L.push(`<b>Al matar:</b> cura ${f.killHeal}`);
  if (f.killFrenzy) L.push(`<b>Al matar:</b> +${f.killFrenzy}% daño 3 turnos`);
  if (f.thorns) L.push(`<b>Espinas:</b> ${f.thorns} de daño a quien te ataque cuerpo a cuerpo`);
  if (f.essMagnet) L.push(`<b>Imán:</b> recoge esencia a ${f.essMagnet} casillas`);
  if (f.essHeal) L.push(`<b>Condensador:</b> 1 de salud por cada ${f.essHeal} de esencia`);
  if (f.quickReload) L.push('<b>Recarga rápida:</b> recargar no gasta turno');
  if (f.stealth) L.push(`<b>Sigilo:</b> los nidos te detectan a ${f.stealth} casillas menos`);
  if (f.antiAnomaly) L.push('<b>Aislante:</b> inmune a anomalías eléctricas');
  if (f.waterproof) L.push('<b>Estanco:</b> el agua no te irradia');
  if (f.autoInject) L.push(`<b>Autoinyección:</b> cura ${f.autoInject} al bajar del 25% (una vez)`);
  if (d.set) { const st = GADGET_SETS[d.set]; L.push(`<b>Conjunto ${st.name}</b> (${st.pieces.map((p) => ITEMS[p].name).join(' + ')}): ${st.desc}`); }
  return L;
}

export function itemValue(it, unit = false) {
  const d = ITEMS[it.b];
  if (d.cat === 'case') return d.value + (it.vault || []).reduce((n, x) => n + itemValue(x), 0);
  let v = d.value * RARITIES[it.r].value * (1 + affSum(it, 'valuePct') / 100);
  if (!unit && it.q) v *= it.q;
  if (it.mods) for (const m of Object.values(it.mods)) if (m) v += itemValue(m);
  return Math.max(1, Math.round(v));
}

// ---------- Contenedores de seguridad ----------
export const CASE_HEAVY = ['mg', 'launcher', 'flame'];
export const caseSize = (it) => (ITEMS[it.b].cat === 'weapon' ? 2 : 1);
export const caseUsed = (c) => (c.vault || []).reduce((n, x) => n + caseSize(x), 0);
// ¿cabe `it` en el contenedor `c`? → '' si cabe, o el motivo
export function caseRefusal(c, it) {
  const d = ITEMS[it.b], cd = ITEMS[c.b];
  if (d.cat === 'case') return 'un contenedor no cabe en otro';
  if (d.cat === 'weapon' && CASE_HEAVY.includes(d.wtype)) return 'las armas pesadas no caben';
  if ((d.stack || 1) > 1 && !cd.stacks) return 'este contenedor no admite munición ni consumibles';
  if (caseUsed(c) + caseSize(it) > cd.caseSlots + (c.caseBonus || 0)) return 'no queda sitio en el contenedor';
  return '';
}

// ---------- Botín aleatorio ----------
const CAT_W = { weapon: 12, mod: 6, ammo: 20, armor: 6, helmet: 6, gadget: 8, backpack: 3, consumable: 26, valuable: 20 };
export function tierCap(level) { return Math.max(0, Math.min(5, Math.floor((level + 1) / 2))); }

export function rollRarity(level, g = grng, bonus = 0) {
  return g.weightedIndex(rarityWeights(level, bonus));
}

export function rollLoot(level, g = grng, opts = {}) {
  const catW = { ...CAT_W, ...(opts.catW || {}) };
  const cat = g.weighted(Object.keys(catW), (k) => catW[k]);
  const cap = Math.min(5, tierCap(level) + (opts.tierBonus || 0));
  let pool = Object.entries(ITEMS).filter(([, d]) => d.cat === cat && d.tier <= cap && (opts.west || !d.west) && !d.noLoot);
  if (!pool.length) pool = Object.entries(ITEMS).filter(([, d]) => d.cat === 'valuable' && !d.noLoot);
  const [b, d] = g.weighted(pool, ([, dd]) => 1 + dd.tier * 0.6 + (dd.tier === cap ? 1 : 0));
  const r = rollRarity(level, g, opts.rarityBonus || 0);
  let q;
  if (d.cat === 'ammo') q = Math.max(1, Math.round((d.pack || 10) * g.float(0.5, 1.3)));
  else if (d.cat === 'consumable') q = ['beacon', 'signal', 'trap'].includes(d.use) ? 1 : g.int(1, d.heal > 30 ? 1 : 2);
  return createItem(b, r, g, q);
}

// ---------- Tooltip ----------
export function itemTooltip(it, compare = null, extra = '') {
  const d = ITEMS[it.b];
  const s = itemStats(it);
  const rr = RARITIES[it.r];
  const col = rr.color;
  let h = `<div class="tt-title" style="color:${col}">${rarSym(it.r)}${esc(itemName(it))}${it.q > 1 ? ` <span class="dimt">×${it.q}</span>` : ''}</div>`;
  h += `<div class="tt-sub">${CAT_INFO[d.cat].name}${d.cat === 'weapon' ? ' · ' + WTYPE_NAMES[d.wtype] : ''}${d.cat !== 'ammo' ? ` · <span style="color:${col}">${rr.name}</span>` : ''} · Nv ${d.tier}</div>`;
  if (d.art) h += `<pre class="tt-art" style="color:${col}">${esc(d.art)}</pre>`;
  // estado propio del objeto (fase 19): compañeros, cargas, grabaciones, capturas
  const st19 = [];
  if (it.broken) st19.push('<span class="bad">DESTROZADO: se repara en el Garaje</span>');
  else if (d.cat === 'companion' && d.hp) st19.push(`Salud ${it.hp == null ? d.hp : it.hp}/${d.hp}+`);
  if (it.dmods && it.dmods.length) st19.push(`Módulos: ${it.dmods.map((m) => esc(ITEMS[m.b].name.replace('Módulo: ', ''))).join(', ')}`);
  if (d.charges) st19.push(`Fotos: ${it.ch == null ? d.charges : it.ch}/${d.charges}`);
  if (d.use === 'recorder') st19.push(it.rec ? `Grabado: <b>${esc(ENEMIES[it.rec] ? ENEMIES[it.rec].name : it.rec)}</b> (clic: reproducir en un punto)` : 'Cinta vacía (clic: grabar)');
  if (d.use === 'deploy') st19.push(`Munición: ${it.ammo == null ? d.ammoMax : it.ammo}`);
  if (it.species) st19.push(`Dentro: <b>${esc(ENEMIES[it.species] ? ENEMIES[it.species].name : it.species)}</b> (Nv ${it.lvl || 1})`);
  if (st19.length) h += `<div class="cyan">${st19.join(' · ')}</div>`;
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
    if (s.mag) h += row('Cargador', `${it.ld ?? s.mag}/${s.mag}${it.ammoKind && ITEMS[it.ammoKind] ? ` (${{ ap: 'perforante', inc: 'incendiaria', hp: 'expansiva', ess: 'de esencia' }[ITEMS[it.ammoKind].kind]})` : ''}`);
    if (it.dur != null && it.dur < 100) h += row('Estado', `<span class="${it.dur >= 60 ? 'good' : it.dur >= 30 ? 'warn' : 'bad'}">${Math.round(it.dur)}%</span>${it.dur < 60 ? ' <span class="dimt">(puede encasquillarse)</span>' : ''}${it.jammed ? ' <span class="bad">ENCASQUILLADA</span>' : ''}`); // fase 23.5
    if (s.ammo) h += row('Munición', AMMO_NAMES[s.ammo]);
    h += row('Crítico', `${s.crit}%`);
    if (s.pierce) h += row('Perforación', s.pierce >= 99 ? 'total' : s.pierce);
    h += row('Ruido', s.noise >= 14 ? 'muy alto' : s.noise >= 10 ? 'alto' : s.noise >= 5 ? 'medio' : 'bajo');
    if (s.blast) h += row('Explosión', `radio ${s.blast}${s.fire ? ' · incendia' : ''}`);
    if (s.chain) h += row('Encadena', `${s.chain} objetivos`);
    const tags = [];
    if (s.scope) tags.push('mira: −20% a quemarropa');
    if (s.stillAcc) tags.push(`+${s.stillAcc}% quieto`);
    if (s.bayonet) tags.push('bayoneta');
    if (s.vision) tags.push(`+${s.vision} visión`);
    if (d.wtype === 'shotgun') tags.push('pierde daño lejos');
    if (s.blast) tags.push('¡cuidado con tus aliados!');
    if (tags.length) h += `<div class="dimt">${tags.join(' · ')}</div>`;
    const slots = slotsOf(it);
    if (slots.length) {
      h += `<div class="tt-sep">${'─'.repeat(60)}</div>`;
      for (const sl of slots) {
        const mo = it.mods && it.mods[sl];
        h += `<div class="tt-row"><span class="dimt">${MOD_SLOTS[sl].glyph} ${MOD_SLOTS[sl].name}</span><span>${mo ? `<span style="color:${rarityColor(mo.r)}">${esc(itemName(mo))}</span>` : '<span class="dimt">— libre —</span>'}</span></div>`;
      }
    } else if (d.wtype !== 'melee') h += '<div class="dimt">No admite mods.</div>';
  } else if (d.cat === 'mod') {
    h += row('Ranura', `${MOD_SLOTS[d.slot].glyph} ${MOD_SLOTS[d.slot].name}`);
    h += row('Para', d.fits.map((w) => WTYPE_NAMES[w]).join(', '));
    const L = { acc: (v) => `${v > 0 ? '+' : ''}${v}% precisión`, range: (v) => `${v > 0 ? '+' : ''}${v} alcance`, crit: (v) => `+${v}% crítico`, noise: (v) => `${v} ruido`, magPct: (v) => `${v > 0 ? '+' : ''}${v}% cargador`, dmgPct: (v) => `${v > 0 ? '+' : ''}${v}% daño`, pierce: (v) => `+${v} perforación`, scope: () => 'mira de tirador (−20% a quemarropa)', still: (v) => `+${v}% precisión si estás quieto`, vision: (v) => `+${v} visión del agente`, bayonet: () => 'puñalada extra a enemigos adyacentes' };
    for (const [k, v] of Object.entries(s)) if (L[k]) h += `<div class="tt-aff">◆ ${L[k](v)}</div>`;
    h += '<div class="dimt">Se instala en la base: arrástralo a una ranura de mod en EQUIPO.</div>';
  } else if (d.cat === 'consumable') {
    if (d.heal) h += row('Cura', d.heal >= 999 ? 'total' : d.heal);
    if (d.radHeal) h += row('Radiación', '−' + d.radHeal);
    if (d.buff) h += row('Efecto', `${modsText(d.buff.mods)}${d.buff.flags && d.buff.flags.poisonImmune ? 'inmune al veneno' : ''} · ${d.buff.turns} turnos`);
    if (d.dmg) h += row('Daño', `${d.dmg[0]}–${d.dmg[1]} (radio ${d.blast || (d.trap && d.trap.blast) || 0})`);
    if (d.trap) h += row('Trampa', `${d.trap.dmg[0]}–${d.trap.dmg[1]} daño${d.trap.blast ? ` · radio ${d.trap.blast}` : ''}${d.trap.stun ? ` · inmoviliza ${d.trap.stun}t` : ''}`);
    if (d.range) h += row('Alcance', d.use === 'trap' ? 'adyacente' : d.range);
  } else if (d.cat !== 'ammo' && d.cat !== 'valuable') {
    const lab = { prot: 'Protección', rad: 'Resist. radiación', ev: 'Agilidad', hp: 'Salud máx.', vision: 'Visión', essence: 'Esencia', acc: 'Puntería', crit: 'Crítico', regen: 'Regeneración', slots: 'Huecos', gasImmune: 'Inmune al gas', range: 'Alcance de armas', dmgPct: 'Daño' };
    for (const k of Object.keys(lab)) {
      if (s[k] == null) continue;
      const suf = k === 'rad' || k === 'essence' || k === 'crit' || k === 'dmgPct' ? '%' : '';
      h += row(lab[k], k === 'gasImmune' ? 'sí' : `${s[k] > 0 && k !== 'prot' ? '+' : ''}${s[k]}${suf}${cmp(s[k], cs ? cs[k] || 0 : null)}`);
    }
    if (d.cat === 'gadget') for (const ln of gadgetEffectLines(it)) h += `<div class="tt-aff" style="color:var(--cyan)">◈ ${ln}</div>`;
  }
  if (d.cat === 'case') {
    const v = it.vault || [];
    h += row('Huecos', `${caseUsed(it)}/${d.caseSlots + (it.caseBonus || 0)} <span class="dimt">(armas: 2)</span>`);
    h += row('Pilas', d.stacks ? 'munición y consumibles' : '<span class="dimt">no admite</span>');
    if (d.keepEss) h += row('Esencia', `conserva el ${d.keepEss}% si el agente muere`);
    h += `<div class="tt-sep">${'─'.repeat(60)}</div>`;
    h += v.length ? v.map((x) => `<div><span class="dimt">[▣]</span> <span style="color:${rarityColor(x.r)}">${esc(itemName(x))}${x.q > 1 ? ' ×' + x.q : ''}</span></div>`).join('') : '<div class="dimt">— vacío —</div>';
    h += '<div class="dimt" style="margin-top:.3em">Guardar dentro cuesta 1 turno. Queda <b>sellado</b> hasta volver a la base. Si el agente muere, la radiobaliza devuelve el contenedor y su contenido al almacén. Sin armas pesadas.</div>';
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
  return `<span class="ig" style="color:${col}">${itemGlyph(it)}</span><span class="in" style="color:${col}">${rarSym(it.r)}${esc(itemName(it))}</span>${it.q > 1 ? `<span class="iq">×${it.q}</span>` : ''}${opts.extra || ''}`;
}

// Dividir una pila (revisión fase 24): saca n unidades de it a una pila nueva justo detrás, en la misma lista
export function splitStack(list, it, n) {
  n = Math.floor(n);
  if (!it || !(it.q > 1) || n < 1 || n >= it.q) return null;
  const piece = { ...JSON.parse(JSON.stringify(it)), uid: uid('i'), q: n };
  it.q -= n;
  list.splice(list.indexOf(it) + 1, 0, piece);
  return piece;
}
// juntar src sobre dst (mismo objeto y rareza): pasa lo que quepa; devuelve cuántas unidades se han movido
export function stackOnto(dst, src) {
  const d = ITEMS[dst.b];
  if (!src || src === dst || src.b !== dst.b || src.r !== dst.r || (d.stack || 1) <= 1) return 0;
  const mv = Math.min((d.stack || 1) - dst.q, src.q);
  if (mv <= 0) return 0;
  dst.q += mv; src.q -= mv;
  return mv;
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
  const order = ['weapon', 'mod', 'armor', 'helmet', 'gadget', 'backpack', 'consumable', 'ammo', 'valuable'];
  return list.sort((a, b) => order.indexOf(ITEMS[a.b].cat) - order.indexOf(ITEMS[b.b].cat) || b.r - a.r || itemName(a).localeCompare(itemName(b)));
}
