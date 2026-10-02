// Lógica de campaña: intendencia, reclutamiento, mejoras, lanzar y cerrar expediciones
import { S, save, addMessage } from './state.js';
import { fireEvents, dialogView, dialogChoose } from './events.js';
import { ITEMS } from '../data/items.js';
import { MAPS, MODULES, MODULE_MAX, moduleCost, rosterSize, stashSize, squadSize } from '../data/world.js';
import { createItem, itemValue, itemName, itemStats, mergeInto, rollRarity } from './items.js';
import { createAgent, starterKit, agentStats, recruitCost, agentName, bagCapacity, giveXp } from './agents.js';
import { RNG, rng } from '../util/rng.js';
import { Expedition } from '../exp/expedition.js';

// ---------------- Intendencia ----------------
function tierFor(cat, d) {
  const m = S.modules;
  if (cat === 'weapon' || cat === 'mod') return m.armeria;
  if (cat === 'armor' || cat === 'helmet') return m.blindaje;
  if (cat === 'gadget' || cat === 'backpack') return m.taller;
  if (cat === 'case') return m.almacen;
  if (cat === 'consumable') return d.use === 'throw' || d.use === 'beacon' ? m.taller : m.enfermeria;
  if (cat === 'ammo') return d.b === 'a_cell' ? (m.laboratorio >= 3 ? 5 : -1) : Math.max(m.armeria, 1);
  return -1;
}
export function shopAvailable(b) {
  const d = ITEMS[b];
  return d.tier <= tierFor(d.cat, { ...d, b });
}
export function buyPrice(it) {
  const d = ITEMS[it.b];
  if (d.price) return d.price;
  let p = itemValue(it, true) * 1.15;
  if (d.cat === 'ammo') p *= 1 - S.modules.polvorin * 0.15;
  if (d.cat === 'consumable' && d.use !== 'throw') p *= 1 - S.modules.enfermeria * 0.06;
  return Math.max(1, Math.round(p));
}
export function sellPrice(it) {
  const d = ITEMS[it.b];
  const f = d.cat === 'valuable' ? 1 : d.cat === 'ammo' ? 0.5 : 0.4;
  return Math.max(1, Math.floor(itemValue(it) * f));
}

export function ensureShop() {
  if (S.shop && S.shop.day === S.day) return S.shop;
  const g = new RNG((S.created + S.day * 7919) >>> 0);
  const pool = Object.keys(ITEMS).filter((b) => ITEMS[b].cat !== 'valuable' && ITEMS[b].cat !== 'ammo' && ITEMS[b].cat !== 'case' && shopAvailable(b) && !['bandage', 'ai2', 'antirad', 'molotov', 'flare'].includes(b));
  const stock = [];
  const level = 1 + Math.floor(Object.values(S.modules).reduce((a, b) => a + b, 0) / 3);
  const n = 10 + Math.min(6, Math.floor(S.day / 3));
  for (let i = 0; i < n && pool.length; i++) {
    const b = g.weighted(pool, (x) => 1 + ITEMS[x].tier);
    const d = ITEMS[b];
    let r = Math.min(3, rollRarity(level, g, 0.1));
    const q = d.stack > 1 ? (d.use === 'beacon' ? 1 : g.int(1, 3)) : undefined;
    stock.push(createItem(b, r, g, q));
  }
  S.shop = { day: S.day, stock };
  return S.shop;
}
// suministros permanentes (cantidad ilimitada)
export function shopSupplies() {
  const list = ['bandage', 'ai2', 'antirad', 'molotov', 'flare', 'a_9x18', 'a_12', 'a_762x39', 'a_545', 'a_762', 'a_9x39', 'a_40', 'a_127', 'a_rpg', 'a_fuel', 'a_cell'];
  const cases = Object.keys(ITEMS).filter((b) => ITEMS[b].cat === 'case' && shopAvailable(b));
  return [...list, ...cases].filter((b) => shopAvailable(b)).map((b) => createItem(b, 0, rng, ITEMS[b].pack || 1));
}

export const stashCap = () => stashSize(S.modules.almacen);
export function stashFull() { return S.stash.length >= stashCap(); }
export function addToStash(it) {
  const rest = mergeInto(S.stash, it, stashCap());
  return !rest;
}

export function buy(it, supply = false) {
  const price = buyPrice(it) * (it.q || 1);
  const essCost = ITEMS[it.b].essCost || 0;
  if (S.rub < price) return { ok: false, msg: 'Rublos insuficientes.' };
  if (S.ess < essCost) return { ok: false, msg: `Hacen falta ${essCost} ✦ de esencia.` };
  const copy = supply ? createItem(it.b, 0, rng, it.q) : it;
  if (!addToStash(copy)) return { ok: false, msg: 'El almacén está lleno.' };
  S.rub -= price;
  S.ess -= essCost;
  if (!supply) S.shop.stock.splice(S.shop.stock.indexOf(it), 1);
  save();
  return { ok: true, price };
}
export function sell(it, fromList) {
  const p = sellPrice(it);
  const i = fromList.indexOf(it);
  if (i < 0) return 0;
  fromList.splice(i, 1);
  S.rub += p;
  S.stats.rubTotal += p;
  save();
  return p;
}
export function convertCrystal(it, fromList) {
  const d = ITEMS[it.b];
  if (!d.essenceValue) return 0;
  const gain = Math.round(d.essenceValue * (1 + it.r * 0.5) * (it.q || 1));
  fromList.splice(fromList.indexOf(it), 1);
  S.ess += gain;
  S.stats.essTotal += gain;
  save();
  return gain;
}

// ---------------- Reclutamiento ----------------
export function ensureRecruits() {
  if (S.recruits && S.recruits.day === S.day) return S.recruits;
  const g = new RNG((S.created + S.day * 104729) >>> 0);
  const list = [];
  const maxL = Math.min(6, 1 + Math.floor(S.day / 4) + Math.floor(S.unlocked / 2));
  const avoid = new Set(S.agents.map((x) => x.nick));
  for (let i = 0; i < 3; i++) {
    const a = createAgent(g, { lvl: g.int(1, maxL), day: S.day, avoid });
    avoid.add(a.nick);
    starterKit(a, g);
    list.push({ a, cost: recruitCost(a) });
  }
  S.recruits = { day: S.day, list };
  return S.recruits;
}
export const rosterCap = () => rosterSize(S.modules.barracones);
export const squadCap = () => squadSize(S.modules.barracones);
export function hire(entry) {
  if (S.agents.length >= rosterCap()) return { ok: false, msg: 'Los barracones están llenos.' };
  if (S.rub < entry.cost) return { ok: false, msg: 'Rublos insuficientes.' };
  S.rub -= entry.cost;
  S.agents.push(entry.a);
  S.recruits.list.splice(S.recruits.list.indexOf(entry), 1);
  save();
  return { ok: true };
}
// voluntario gratuito si no queda nadie
export function ensureVolunteer() {
  if (S.agents.length > 0) return null;
  const a = createAgent(rng, { day: S.day, avoid: new Set() });
  starterKit(a, rng);
  S.agents.push(a);
  addMessage(`Sin agentes en plantilla, el Comité envía a un voluntario: ${agentName(a)}. No lo desperdiciéis.`);
  save();
  return a;
}
export function dismiss(a) {
  // el equipo vuelve al almacén si cabe
  for (const it of [...Object.values(a.equip).filter(Boolean), ...a.bag]) addToStash(it);
  S.agents.splice(S.agents.indexOf(a), 1);
  save();
}

// ---------------- Enfermería ----------------
export function treatCost(a) {
  const st = agentStats(a);
  const missing = Math.max(0, st.hpMaxEff - a.hp);
  const base = missing * 2 + a.rad * 3;
  return Math.round(base * (1 - S.modules.enfermeria * 0.12));
}
export function treat(a) {
  const c = treatCost(a);
  if (c <= 0) return { ok: false, msg: 'No necesita tratamiento.' };
  if (S.rub < c) return { ok: false, msg: 'Rublos insuficientes.' };
  S.rub -= c;
  a.rad = 0;
  a.hp = agentStats(a).hpMaxEff;
  save();
  return { ok: true, cost: c };
}

// ---------------- Laboratorio ----------------
export function upgradeModule(id) {
  const lvl = S.modules[id];
  if (lvl >= MODULE_MAX) return { ok: false, msg: 'Nivel máximo.' };
  const c = moduleCost(id, lvl);
  if (S.ess < c.ess) return { ok: false, msg: 'Esencia insuficiente.' };
  if (S.rub < c.rub) return { ok: false, msg: 'Rublos insuficientes.' };
  S.ess -= c.ess; S.rub -= c.rub;
  S.modules[id]++;
  if (S.shop) S.shop.day = -1; // refrescar la intendencia con las nuevas existencias
  const m = MODULES.find((x) => x.id === id);
  addMessage(`${m.name} mejorada a nivel ${S.modules[id]}. ${m.eff(S.modules[id])}.`);
  save();
  return { ok: true };
}

// ---------------- Expediciones ----------------
export function launchExpedition(mapIdx, agents) {
  // munición gratis del polvorín
  const pv = S.modules.polvorin;
  for (const a of agents) {
    a.missions = (a.missions || 0) + 1;
    if (pv > 0) {
      for (const slot of ['w1', 'w2']) {
        const w = a.equip[slot];
        if (!w || !ITEMS[w.b].ammo) continue;
        const d = ITEMS[w.b];
        const q = d.mag * pv;
        mergeInto(a.bag, createItem(d.ammo, 0, rng, q), bagCapacity(a));
      }
    }
  }
  // la armería recarga los cargadores con la munición de la mochila
  for (const a of agents) {
    for (const slot of ['w1', 'w2']) {
      const w = a.equip[slot];
      if (!w || !ITEMS[w.b].ammo) continue;
      const st = itemStats(w);
      let need = st.mag - (w.ld || 0);
      for (const it of a.bag) {
        if (need <= 0) break;
        if (it.b !== st.ammo) continue;
        const mv = Math.min(it.q, need);
        it.q -= mv; need -= mv; w.ld = (w.ld || 0) + mv;
      }
      a.bag = a.bag.filter((it) => !(it.q !== undefined && it.q <= 0));
    }
  }
  S.stats.expeditions++;
  const exp = Expedition.create(mapIdx, agents);
  return exp;
}

export function finalizeExpedition(exp) {
  const def = MAPS[exp.mapIdx];
  const labBonus = 1 + S.modules.laboratorio * 0.1;
  const rep = { map: def.name, mapIdx: exp.mapIdx, turns: exp.turn, day: S.day, agents: [], ess: 0, essRaw: 0, kills: exp.tally.kills, unlocked: null, lostItems: 0 };
  let anyOut = false;
  for (const sq of exp.squad) {
    const a = sq.a;
    const row = { name: a ? agentName(a) : '¿?', color: a ? a.color : '#fff', lvl: a ? a.lvl : 1, lvlUp: a ? a.lvl - sq.lvl0 : 0, kills: sq.kills, ess: sq.ess, status: sq.out ? 'extraído' : 'muerto', items: [] };
    if (sq.out) {
      anyOut = true;
      rep.essRaw += sq.ess;
      a.extractions = (a.extractions || 0) + 1;
      a.essTotal = (a.essTotal || 0) + sq.ess;
      const bonusXp = 15 * def.lvl[1];
      const ups = giveXp(a, bonusXp);
      row.lvl = a.lvl; row.lvlUp = a.lvl - sq.lvl0;
      row.items = [...Object.values(a.equip).filter(Boolean), ...a.bag].map((it) => ({ name: itemName(it), r: it.r, q: it.q }));
      for (const it of [...Object.values(a.equip).filter(Boolean), ...a.bag]) {
        if (!S.stats.bestItem || it.r > S.stats.bestItem.r) S.stats.bestItem = { name: itemName(it), r: it.r };
      }
    } else {
      row.lost = sq.snap ? true : false;
      rep.lostItems += sq.startItems || 0;
      if (sq.recovered) { row.recovered = sq.recovered; rep.lostItems = Math.max(0, rep.lostItems - 1); }
      if (sq.essKept) { row.essKept = sq.essKept; rep.essRaw += sq.essKept; }
    }
    rep.agents.push(row);
  }
  rep.ess = Math.round(rep.essRaw * labBonus);
  S.ess += rep.ess;
  S.stats.essTotal += rep.ess;
  if (anyOut) {
    S.stats.extractions++;
    S.cleared[def.id] = (S.cleared[def.id] || 0) + 1;
    if (exp.mapIdx + 1 >= S.unlocked && exp.mapIdx + 1 < MAPS.length) {
      S.unlocked = exp.mapIdx + 2;
      rep.unlocked = MAPS[exp.mapIdx + 1].name;
      addMessage(`Acceso concedido a ${MAPS[exp.mapIdx + 1].name}. Nivel medio ${MAPS[exp.mapIdx + 1].lvl.join('–')}. Preparad mejor equipo.`);
    }
  }
  rep.result = !anyOut ? 'fail' : rep.agents.every((r) => r.status === 'extraído') ? 'success' : 'partial';
  const msgs = {
    success: `Expedición a ${def.name} completada. ${rep.ess} ✦ de esencia recuperados. Buen trabajo, camaradas.`,
    partial: `Expedición a ${def.name}: hemos perdido gente. ${rep.ess} ✦ recuperados. Que su sacrificio no sea en vano.`,
    fail: `Expedición a ${def.name}: ningún agente ha regresado. El reactor se ha cobrado su precio.`,
  };
  addMessage(msgs[rep.result]);
  S.lastReport = rep;
  S.exp = null;
  nextDay();
  ensureVolunteer();
  save();
  return rep;
}

export function nextDay() {
  S.day++;
  baseDayEvents();
  const enf = S.modules.enfermeria;
  for (const a of S.agents) {
    const st = agentStats(a);
    a.hp = Math.min(st.hpMaxEff, a.hp + Math.round(st.hpMax * (0.3 + enf * 0.14)));
    a.rad = Math.max(0, a.rad - (8 + enf * 5));
    const st2 = agentStats(a);
    a.hp = Math.min(a.hp, st2.hpMaxEff);
  }
}

export function totalCarried(a) { return Object.values(a.equip).filter(Boolean).length + a.bag.length; }

// eventos de la base al empezar un nuevo día (data/events.js, disparador «baseDay»)
export function baseDayEvents() {
  const ctx = { base: true, data: {}, S };
  fireEvents('baseDay', ctx);
  for (const m of ctx.out || []) addMessage(m.text.replace(/<[^>]+>/g, ''));
  if (ctx.nextDialog) (S.pendingDialogs = S.pendingDialogs || []).push(ctx.nextDialog);
}

// diálogo pendiente en la base: { view, choose(i) → seguir?, dismiss() }
export function baseDialog() {
  const id = S.pendingDialogs && S.pendingDialogs[0];
  if (!id) return null;
  const dlg = { id, node: 'start' };
  const ctx = () => ({ base: true, data: {}, S });
  return {
    view: () => dialogView(dlg, ctx()),
    choose: (i) => {
      const c = ctx();
      const r = dialogChoose(dlg, i, c);
      for (const m of c.out || []) addMessage(m.text.replace(/<[^>]+>/g, ''));
      if (r && r.end) { S.pendingDialogs.shift(); save(); return false; }
      return !!r;
    },
    dismiss: () => { S.pendingDialogs.shift(); save(); },
  };
}
