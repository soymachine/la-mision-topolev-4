// La base viva (fase 21): parcelas, investigación, celda de contención, fabricación, cuotas, mercado negro,
// precios que fluctúan, calendario, defensa de la base y operaciones simultáneas.
import { S, addMessage } from './state.js';
import { ITEMS } from '../data/items.js';
import { MAPS, MODULES, zoneOpen, mapIndex } from '../data/world.js';
import { PLOTS, RESEARCH, RECIPES, HISTORY, ATTACKS, seasonOf, SEASONS, dateOf } from '../data/basedata.js';
import { ENEMIES } from '../data/enemies.js';
import { createItem, rollLoot, itemValue, itemName } from './items.js';
import { agentStats, agentName, giveXp, agentHooks } from './agents.js';
import { addRep } from '../data/factions.js';
import { chronicle, addStress, trust } from './story.js';
import { rng } from '../util/rng.js';
import { crisisOn } from './narrator.js';

export function baseDefaults(d) {
  if (!d.plots) {
    d.plots = Array(PLOTS).fill(null);
    let i = 0;
    for (const m of MODULES) if ((d.modules[m.id] || 0) > 0 && i < PLOTS) d.plots[i++] = m.id;
  }
  d.research = d.research || {};
  d.resQueue = d.resQueue || null; // { id, left }
  d.specimens = d.specimens || [];
  d.quota = d.quota || { due: 30, ess: 60, n: 1 };
  d.demand = d.demand || {};
  // la operación simultánea se quitó: los agentes que estaban fuera vuelven
  if (d.sideOps && d.sideOps.length) for (const a of d.agents || []) a.awayUntil = 0;
  d.sideOps = [];
  d.histDone = d.histDone || {};
  d.bmarket = d.bmarket || null;
}
export const hasRes = (id) => !!(S.research && S.research[id]);

// ---------------------------------------------------------------- parcelas (fase 21.1)
export const plotOf = (id) => S.plots.indexOf(id);
export function freePlot() { return S.plots.indexOf(null); }
// construir un edificio por primera vez necesita parcela libre
export function placeBuilding(id, plot = null) {
  if (plotOf(id) >= 0) return { ok: true, plot: plotOf(id) };
  const p = plot != null && S.plots[plot] == null ? plot : freePlot();
  if (p < 0) return { ok: false, msg: 'No queda ninguna parcela libre: derriba otro edificio para hacer sitio.' };
  S.plots[p] = id;
  return { ok: true, plot: p };
}
export function demolish(id) {
  const p = plotOf(id);
  if (p < 0) return { ok: false, msg: 'Ese edificio no está construido.' };
  if (id === 'contencion' && S.specimens.length) return { ok: false, msg: 'Hay especímenes en las celdas: sácalos antes de derribarla.' };
  S.plots[p] = null;
  S.modules[id] = 0;
  chronicle(`Derribado: ${MODULES.find((m) => m.id === id).name}.`);
  return { ok: true };
}

// ---------------------------------------------------------------- investigación (fase 21.2)
const stashCount = (b, sp = null) => S.stash.filter((it) => it.b === b && (!sp || it.species === sp)).reduce((n, it) => n + (it.q || 1), 0);
function takeStash(b, n) {
  for (const it of [...S.stash]) {
    if (n <= 0) break;
    if (it.b !== b) continue;
    const mv = Math.min(it.q || 1, n); n -= mv;
    if ((it.q || 1) > mv) it.q -= mv; else S.stash.splice(S.stash.indexOf(it), 1);
  }
}
export function researchState(id) {
  const R = RESEARCH[id];
  if (hasRes(id)) return 'done';
  if (S.resQueue && S.resQueue.id === id) return 'running';
  if (!R.req.every(hasRes)) return 'locked';
  return 'available';
}
export function researchMissing(id) {
  const c = RESEARCH[id].cost, miss = [];
  if (!(S.modules.laboratorio > 0)) miss.push('un Laboratorio');
  if (c.ess && S.ess < c.ess) miss.push(`${c.ess} ✦`);
  if (c.rub && S.rub < c.rub) miss.push(`${c.rub} ₽`);
  for (const [b, n] of Object.entries(c.items || {})) if (stashCount(b) < n) miss.push(`${n}× ${ITEMS[b].name}`);
  if (c.specimen && S.specimens.length < c.specimen) miss.push(`${c.specimen} espécimen(es) vivo(s) en la celda`);
  return miss;
}
export function startResearch(id) {
  if (S.resQueue) return { ok: false, msg: 'El laboratorio ya está investigando otra cosa.' };
  if (researchState(id) !== 'available') return { ok: false, msg: 'No disponible todavía.' };
  const miss = researchMissing(id);
  if (miss.length) return { ok: false, msg: 'Falta: ' + miss.join(', ') };
  const c = RESEARCH[id].cost;
  S.ess -= c.ess || 0; S.rub -= c.rub || 0;
  for (const [b, n] of Object.entries(c.items || {})) takeStash(b, n);
  // los especímenes se estudian, no se consumen
  const days = Math.max(1, RESEARCH[id].days - Math.floor((S.modules.laboratorio || 0) / 2));
  S.resQueue = { id, left: days };
  return { ok: true, days };
}
function tickResearch() {
  const q = S.resQueue;
  if (!q || crisisOn('apagon')) return; // fase 25: sin luz no se investiga
  q.left--;
  if (q.left > 0) return;
  S.research[q.id] = S.day;
  S.resQueue = null;
  addMessage(`Laboratorio: investigación terminada — «${RESEARCH[q.id].name}». ${RESEARCH[q.id].desc}`);
  chronicle(`Investigación completada: ${RESEARCH[q.id].name}.`);
}
// bonificaciones de investigación para las estadísticas de los agentes (las usa ast en la expedición)
export function researchMods() {
  const m = {};
  if (hasRes('r_dosimetria')) m.rad = (m.rad || 0) + 10;
  if (hasRes('r_blindaje')) m.rad = (m.rad || 0) + 5;
  if (hasRes('r_muestras')) m.essence = (m.essence || 0) + 5;
  if (hasRes('r_genetica')) m.hpMax = 8;
  return m;
}

// ---------------------------------------------------------------- celda de contención (fase 21.2)
export const cellCap = () => (S.modules.contencion || 0) * 2;
export function storeSpecimen(it) {
  if (S.specimens.length >= cellCap()) return { ok: false, msg: cellCap() ? 'Las celdas están llenas.' : 'Hace falta construir la celda de contención.' };
  const i = S.stash.indexOf(it);
  if (i < 0 || it.b !== 'cagefull') return { ok: false, msg: 'Tiene que ser una jaula con un chebylita vivo del almacén.' };
  S.stash.splice(i, 1);
  S.specimens.push({ species: it.species, lvl: it.lvl || 1, since: S.day });
  return { ok: true };
}
export function releaseSpecimen(i) {
  const sp = S.specimens[i];
  if (!sp) return;
  S.specimens.splice(i, 1);
  addMessage(`Se sacrifica el espécimen de ${ENEMIES[sp.species] ? ENEMIES[sp.species].name : sp.species}. Babai se lleva lo que queda para el taller.`);
  S.stash.push(createItem('tejido', 0, rng, 3 + sp.lvl));
}
function tickContainment() {
  if (!S.specimens.length) return null;
  let ess = 0;
  for (const sp of S.specimens) ess += 1 + Math.floor(sp.lvl / 2) + (hasRes('r_contencion') ? 1 : 0);
  S.ess += ess;
  // fugas
  const p = Math.max(0.01, (5 - (S.modules.contencion || 0)) / 100) * (hasRes('r_contencion') ? 0.5 : 1);
  const esc = S.specimens.filter(() => Math.random() < p);
  if (esc.length) {
    for (const sp of esc) S.specimens.splice(S.specimens.indexOf(sp), 1);
    return { kind: 'fuga', species: esc.map((s) => s.species) };
  }
  return null;
}

// ---------------------------------------------------------------- fabricación y desmontaje (fase 21.3)
export const fabLvl = () => Math.min(3, S.modules.taller_fab || 0);
export function recipeState(r) {
  if (!fabLvl()) return { ok: false, why: 'Hace falta el Taller de fabricación.' };
  if (r.lvl > fabLvl()) return { ok: false, why: `Taller de fabricación nivel ${r.lvl}.` };
  if (r.research && !hasRes(r.research)) return { ok: false, why: `Investigación: ${RESEARCH[r.research].name}.` };
  const miss = Object.entries(r.cost).filter(([b, n]) => stashCount(b) < n).map(([b, n]) => `${n}× ${ITEMS[b].name}`);
  if (r.ess && S.ess < r.ess) miss.push(`${r.ess} ✦`);
  return miss.length ? { ok: false, why: 'Falta: ' + miss.join(', ') } : { ok: true };
}
export function craft(id) {
  const r = RECIPES.find((x) => x.id === id);
  const st = recipeState(r);
  if (!st.ok) return { ok: false, msg: st.why };
  for (const [b, n] of Object.entries(r.cost)) takeStash(b, n);
  if (r.ess) S.ess -= r.ess;
  const [b, q] = r.out;
  const it = createItem(b, 0, rng, ITEMS[b].stack > 1 ? q : undefined);
  S.stash.push(it);
  if (ITEMS[b].stack <= 1) for (let i = 1; i < q; i++) S.stash.push(createItem(b, 0, rng));
  return { ok: true, it };
}
// mejoras que se instalan sobre un objeto del almacén (batería de dron, placa de contenedor)
export function installUpgrade(kind, target) {
  const b = kind === 'battery' ? 'dronebat' : 'caseplate';
  if (stashCount(b) < 1) return { ok: false, msg: `No hay ${ITEMS[b].name} en el almacén.` };
  if (kind === 'battery' && !(ITEMS[target.b].drone === 'strizh' || ITEMS[target.b].drone === 'eco')) return { ok: false, msg: 'Solo el Strizh y el Eco llevan batería.' };
  if (kind === 'plate' && ITEMS[target.b].cat !== 'case') return { ok: false, msg: 'Solo sirve para contenedores de seguridad.' };
  takeStash(b, 1);
  if (kind === 'battery') target.batBonus = (target.batBonus || 0) + 20;
  else target.caseBonus = (target.caseBonus || 0) + 1;
  return { ok: true };
}
// desmontar un objeto en materiales
export function scrapYield(it) {
  const d = ITEMS[it.b];
  const k = (S.modules.taller_fab || 0) >= 4 ? 1.5 : 1;
  const out = {};
  const add = (b, n) => { n = Math.round(n * k); if (n > 0) out[b] = (out[b] || 0) + n; };
  if (d.cat === 'weapon') { add('chatarra', 1 + d.tier); if (d.tier >= 2) add('electronica', d.tier >= 4 ? 2 : 1); }
  else if (d.cat === 'mod') { add('chatarra', 1); add('electronica', 1); }
  else if (d.cat === 'armor' || d.cat === 'helmet') { add('plomo', 1 + Math.floor(d.tier / 2)); add('chatarra', 1); }
  else if (d.cat === 'gadget' || d.cat === 'dogmod') { add('electronica', 1 + Math.floor(d.tier / 2)); add('chatarra', 1); }
  else if (d.cat === 'backpack') add('plomo', 1);
  else if (d.cat === 'valuable') add('chatarra', 1);
  else if (d.cat === 'companion' && it.broken) { add('chatarra', 4); add('electronica', 3); add('parts', 2); }
  return out;
}
// fase 23.5: reparar armas gastadas en el Taller de fabricación (chatarra según el tier)
export const repairCost = (it) => Math.max(1, Math.ceil(((100 - (it.dur ?? 100)) / 25) * (1 + (ITEMS[it.b].tier || 0) / 2)));
export function repairWeapon(it) {
  if (!fabLvl()) return { ok: false, msg: 'Hace falta el Taller de fabricación.' };
  if (it.dur == null || it.dur >= 100) return { ok: false, msg: 'Está como nueva.' };
  const n = repairCost(it);
  const have = S.stash.filter((x) => x.b === 'chatarra').reduce((k, x) => k + (x.q || 1), 0);
  if (have < n) return { ok: false, msg: `Faltan ${n - have} de chatarra.` };
  let need = n;
  for (const x of [...S.stash]) { if (x.b !== 'chatarra' || need <= 0) continue; const mv = Math.min(x.q || 1, need); need -= mv; if ((x.q || 1) > mv) x.q -= mv; else S.stash.splice(S.stash.indexOf(x), 1); }
  it.dur = 100; it.jammed = 0;
  return { ok: true, cost: n };
}
export function scrapItem(it) {
  const d = ITEMS[it.b];
  if (!fabLvl()) return { ok: false, msg: 'Hace falta el Taller de fabricación.' };
  if (['ammo', 'material', 'case'].includes(d.cat) || (d.cat === 'companion' && !it.broken)) return { ok: false, msg: 'Esto no se desmonta.' };
  const y = scrapYield(it);
  if (!Object.keys(y).length) return { ok: false, msg: 'No sale nada útil de ahí.' };
  const i = S.stash.indexOf(it);
  if (i < 0) return { ok: false, msg: 'Tiene que estar en el almacén.' };
  if ((it.q || 1) > 1 && d.cat !== 'consumable') it.q--; else S.stash.splice(i, 1);
  for (const [b, n] of Object.entries(y)) S.stash.push(createItem(b, 0, rng, n));
  return { ok: true, y };
}

// ---------------------------------------------------------------- economía (fase 21.4)
// precios que bajan si se vende mucho de lo mismo (se recuperan un 20% al día)
export const demandK = (b) => Math.max(0.5, 1 - 0.08 * ((S.demand && S.demand[b]) || 0));
export function noteSale(b) { S.demand[b] = (S.demand[b] || 0) + 1; }
function tickDemand() { for (const b of Object.keys(S.demand)) { S.demand[b] *= 0.8; if (S.demand[b] < 0.2) delete S.demand[b]; } }
// cuota mensual del Comité (cada 30 días)
function tickQuota() {
  if (S.mode === 'libre') return null; // fase 24.7: sin cuota en el modo libre
  const q = S.quota;
  if (S.day < q.due) { if (q.due - S.day === 5) addMessage(`Comisario Zhdánov: «Faltan 5 días para la cuota del Comité: ${q.ess} ✦. No me haga quedar mal, doctor».`); return null; }
  let txt;
  if (S.ess >= q.ess) {
    S.ess -= q.ess;
    const pay = 300 + q.n * 150;
    S.rub += pay;
    addRep(S, 'kgb', 5);
    txt = `Cuota n.º ${q.n} entregada al Comité: ${q.ess} ✦. Presupuesto del mes: +${pay} ₽.`;
  } else {
    const cut = Math.round(S.rub * 0.2);
    S.rub -= cut;
    addRep(S, 'kgb', -12);
    trust(-3);
    txt = `Cuota n.º ${q.n} INCUMPLIDA (${S.ess}/${q.ess} ✦). Inspección del Comité: −${cut} ₽ de presupuesto y el KGB toma nota.`;
  }
  addMessage(txt); chronicle(txt);
  q.n++; q.due = S.day + 30; q.ess = Math.round(60 * Math.pow(1.35, q.n - 1));
  return txt;
}
// mercado negro del sargento Kravets: mejores precios… y el KGB acechando
export function blackMarket() {
  if (S.bmarket && S.bmarket.day === S.day) return S.bmarket;
  const lvl = Math.max(2, Math.min(9, 2 + (S.modules.armeria || 0) + (S.modules.blindaje || 0)));
  const items = [];
  for (let i = 0; i < 5; i++) { const it = rollLoot(lvl, rng, { rarityBonus: 0.8, west: true }); items.push(it); }
  S.bmarket = { day: S.day, items };
  return S.bmarket;
}
export const bmBuyPrice = (it) => Math.round(itemValue(it) * 1.6);
export const bmSellPrice = (it) => Math.round(itemValue(it) * 0.75 * demandK(it.b));
function bmRisk() {
  if (Math.random() >= 0.08) return null;
  const fine = Math.round(S.rub * 0.15);
  S.rub -= fine;
  addRep(S, 'kgb', -10);
  const txt = `¡El KGB ha descubierto la trastienda de Kravets! Multa de ${fine} ₽ y una anotación en vuestro expediente.`;
  addMessage(txt); chronicle(txt);
  return txt;
}
export function bmBuy(it) {
  const p = bmBuyPrice(it);
  if (S.rub < p) return { ok: false, msg: 'Rublos insuficientes.' };
  S.rub -= p;
  S.bmarket.items = S.bmarket.items.filter((x) => x !== it);
  S.stash.push(it);
  return { ok: true, price: p, caught: bmRisk() };
}
export function bmSell(it) {
  const i = S.stash.indexOf(it);
  if (i < 0) return { ok: false, msg: 'Tiene que estar en el almacén.' };
  const p = bmSellPrice(it);
  S.stash.splice(i, 1);
  S.rub += p;
  noteSale(it.b);
  return { ok: true, price: p, caught: bmRisk() };
}

// ---------------------------------------------------------------- calendario (fase 21.5)
export const season = () => seasonOf(S.day);
export const seasonInfo = () => SEASONS[season()];
export const dateStr = (day = S.day) => dateOf(day).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
function tickHistory() {
  for (const h of HISTORY) {
    if (S.day < h.day || S.histDone[h.day]) continue;
    S.histDone[h.day] = 1;
    addMessage(h.text);
    chronicle(h.text);
    if (h.flag) S.flags[h.flag] = 1;
  }
}
function tickSeason() {
  const s = season();
  if (S.flags.season !== s) {
    if (S.flags.season) { addMessage(`Cambia la estación: ${SEASONS[s].name}. ${SEASONS[s].desc}`); chronicle(`Llega el ${SEASONS[s].name.toLowerCase()}.`); }
    S.flags.season = s;
  }
}

// ---------------------------------------------------------------- edificios con producción diaria
function tickBuildings() {
  if (crisisOn('apagon')) return; // fase 25: apagón
  const g = S.modules.invernadero || 0;
  if (g) {
    const n = g * (hasRes('r_invernadero') ? 2 : 1);
    const pool = ['ration', 'iodine', 'bandage', 'tea', 'ipp'];
    for (let i = 0; i < n; i++) S.stash.push(createItem(pool[Math.floor(Math.random() * pool.length)], 0, rng, 1));
  }
  const ref = S.modules.refugio || 0;
  if (ref) for (const a of S.agents) a.rad = Math.max(0, a.rad - ref * 6);
}

// ---------------------------------------------------------------- defensa de la base (fase 21.6)
// ataque pendiente: se resuelve en la base con un diálogo (defender o ceder)
export function rollAttack(fuga) {
  if (S.attack) return S.attack;
  if (S.mode === 'libre') return null; // fase 24.7: sin ataques en el modo libre
  let kind = null, extra = null;
  if (fuga) { kind = 'fuga'; extra = fuga.species; }
  // fase 25: los demás ataques los decide el Narrador del Reactor (startAttack)
  if (!kind) return null;
  S.attack = { kind, species: extra, day: S.day };
  (S.pendingDialogs = S.pendingDialogs || []).push('base_attack');
  chronicle(`¡Ataque a la base! ${ATTACKS[kind].name}.`);
  return S.attack;
}
// fase 25: ataque decidido por el Narrador
export function startAttack(kind) {
  if (S.attack || S.mode === 'libre' || !ATTACKS[kind]) return null;
  S.attack = { kind, species: null, day: S.day };
  (S.pendingDialogs = S.pendingDialogs || []).push('base_attack');
  chronicle(`¡Ataque a la base! ${ATTACKS[kind].name}.`);
  return S.attack;
}
// zona sintética para la misión de defensa
export function defenseDef() {
  const A = ATTACKS[S.attack.kind];
  const base = MAPS[0];
  const list = A.enemies || [...(S.attack.species || ['rata']), ...(S.attack.species || ['rata']), 'rata', 'lobo'];
  return { ...base, id: 'defensa', name: 'Defensa del Puesto Pripyat-7', short: 'BASE', desc: A.desc, w: 64, h: 44, sx: 2, sy: 2, lvl: [Math.max(1, Math.min(8, Math.round(S.day / 12))), Math.max(2, Math.min(9, Math.round(S.day / 10) + 1))], zones: { industrial: 1 }, nests: [0, 0], veins: [0, 0], caches: [1, 1], hazards: [0, 1], floors: 1, req: [], special: 'defensa', attackers: list, attackFaction: A.faction, fpool: [], tier: 2 };
}
// ceder: el ataque se lleva parte de lo que hay
export function yieldAttack() {
  const lost = Math.round(S.rub * 0.25), ess = Math.round(S.ess * 0.2);
  S.rub -= lost; S.ess -= ess;
  const items = [];
  for (let i = 0; i < Math.min(3, S.stash.length); i++) items.push(S.stash.splice(Math.floor(Math.random() * S.stash.length), 1)[0]);
  for (const a of S.agents) addStress(a, 15);
  const txt = `Os atrincheráis en el refugio mientras ${ATTACKS[S.attack.kind].name.toLowerCase()} arrasa el Puesto: −${lost} ₽, −${ess} ✦ y ${items.length} objeto(s) perdidos.`;
  addMessage(txt); chronicle(txt);
  S.attack = null; S.lastAttack = S.day;
  return txt;
}
export function attackResult(won) {
  const A = S.attack ? ATTACKS[S.attack.kind] : null;
  if (!A) return;
  if (won) { S.rub += 200; trust(5); addMessage(`Ataque rechazado: ${A.name}. Topolev os abraza a todos, uno por uno.`); chronicle(`Ataque rechazado: ${A.name}.`); }
  else { yieldAttack(); return; }
  S.attack = null; S.lastAttack = S.day;
}

// ---------------------------------------------------------------- operaciones simultáneas (fase 21.7)
export const isAway = (a) => !!(a.awayUntil && a.awayUntil > S.day);
// defensores: los agentes en condiciones que estén en la base
export function defenders(cap) { return S.agents.filter((a) => !isAway(a) && a.hp > 10).sort((x, y) => y.hp - x.hp).slice(0, cap); }
// (la operación simultánea del segundo escuadrón se quitó del juego)

// ---------------------------------------------------------------- tick diario
export function baseDayTick() {
  baseDefaults(S);
  tickResearch();
  const fuga = tickContainment();
  tickBuildings();
  tickDemand();
  tickQuota();
  tickSeason();
  tickHistory();
  rollAttack(fuga);
}

// la investigación modifica las estadísticas de todos los agentes
agentHooks.statMods = () => (S && S.research ? researchMods() : null);
