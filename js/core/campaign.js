// Lógica de campaña: intendencia, reclutamiento, mejoras, lanzar y cerrar expediciones
import { S, save, addMessage } from './state.js';
import { ironOver, challengeDayTick } from './modes.js';
import { fireEvents, dialogView, dialogChoose } from './events.js';
import { ITEMS } from '../data/items.js';
import { MAPS, MODULES, MODULE_MAX, moduleCost, rosterSize, stashSize, squadSize, zoneOpen, openCount, EVENT_ZONES, eventDef, mapIndex } from '../data/world.js';
import { createItem, itemValue, itemName, itemStats, mergeInto, rollRarity } from './items.js';
import { createAgent, starterKit, agentStats, recruitCost, agentName, bagCapacity, giveXp, agentHooks, talentFlag } from './agents.js';
import { ACQUIRED, MEDALS, woundCost, RETIRE_LEVEL, MAX_INSTRUCTORS, INSTRUCTOR_XP, ROOKIE_LEVEL } from '../data/honors.js';
import { SPECS } from '../data/specs.js';
import { rollZoneMods } from '../data/modifiers.js';
import { recordExpedition, worldDayTick } from './ecosys.js';
import { statExpedition, checkAchievements } from './achievements.js';
import { FACTIONS, repOf, addRep, foreignTrade as foreignTradeS } from '../data/factions.js';
import { addStress, addAff, trust, chronicle, comedorScene, completeContracts, checkActs, familyLetter, expireSpecials, CONTRACTS } from './story.js';
import { baseDayTick, placeBuilding, demandK, noteSale, attackResult, defenseDef } from './basecore.js';
import * as basecoreNS from './basecore.js';
import { narrDay, narrOnExpedition, narrHooks, narrPriceK, sickDays } from './narrator.js';

// modificadores de cada zona para hoy (fase 16.4)
export const zoneMods = (mapIdx) => (S.forceMods ? [...S.forceMods] : rollZoneMods(S.created >>> 0, S.day, mapIdx));
import { bgName } from '../data/backgrounds.js';

// los instructores retirados aceleran a los novatos
agentHooks.xpMult = (a) => (S && S.instructors && a.lvl <= ROOKIE_LEVEL ? 1 + (S.instructors.length * INSTRUCTOR_XP) / 100 : 1);
export const partyDiscount = () => (S ? Math.max(0, ...S.agents.map((a) => talentFlag(a, 'partyDiscount'))) : 0);
import { RNG, rng } from '../util/rng.js';
import { Expedition } from '../exp/expedition.js';

// ---------------- Intendencia ----------------
function tierFor(cat, d) {
  const m = S.modules;
  if (cat === 'weapon' || cat === 'mod') return m.armeria;
  if (cat === 'armor' || cat === 'helmet') return m.blindaje;
  if (cat === 'gadget' || cat === 'backpack') return m.taller;
  if (cat === 'case') return m.almacen;
  if (cat === 'consumable') return ['throw', 'beacon', 'deploy', 'cage', 'photo', 'whitenoise', 'recorder', 'seismic', 'cloak'].includes(d.use) ? m.taller : m.enfermeria;
  if (cat === 'companion' || cat === 'dogmod') return m.garaje || 0;
  if (cat === 'ammo') return d.b === 'a_cell' ? (m.laboratorio >= 3 ? 5 : -1) : Math.max(m.armeria, 1);
  return -1;
}
export function shopAvailable(b) {
  const d = ITEMS[b];
  return d.tier <= tierFor(d.cat, { ...d, b });
}
export function buyPrice(it) {
  const d = ITEMS[it.b];
  const disc = 1 - partyDiscount() / 100;
  if (d.price) return Math.round(d.price * disc * narrPriceK());
  let p = itemValue(it, true) * 1.15 * disc * narrPriceK(); // fase 25: escasez
  if (d.cat === 'ammo') p *= 1 - S.modules.polvorin * 0.15;
  if (d.cat === 'consumable' && d.use !== 'throw') p *= 1 - S.modules.enfermeria * 0.06;
  return Math.max(1, Math.round(p));
}
export function sellPrice(it) {
  const d = ITEMS[it.b];
  const f = d.cat === 'valuable' ? 1 : d.cat === 'ammo' ? 0.5 : 0.4;
  return Math.max(1, Math.floor(itemValue(it) * f * demandK(it.b))); // vender mucho de lo mismo baja el precio
}

export function ensureShop() {
  if (S.shop && S.shop.day === S.day) return S.shop;
  const g = new RNG((S.created + S.day * 7919) >>> 0);
  const pool = Object.keys(ITEMS).filter((b) => ITEMS[b].cat !== 'valuable' && ITEMS[b].cat !== 'ammo' && ITEMS[b].cat !== 'case' && !ITEMS[b].west && !ITEMS[b].garage && ITEMS[b].cat !== 'companion' && ITEMS[b].cat !== 'dogmod' && !ITEMS[b].noLoot && shopAvailable(b) && !['bandage', 'ai2', 'antirad', 'molotov', 'flare'].includes(b));
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
  const list = ['bandage', 'ai2', 'antirad', 'molotov', 'flare', 'rope', 'a_9x18', 'a_12', 'a_762x39', 'a_545', 'a_762', 'a_9x39', 'a_40', 'a_127', 'a_rpg', 'a_fuel', 'a_cell'];
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
  noteSale(it.b);
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
  const g = new RNG(((S.challenge ? S.challenge.seed : S.created) + S.day * 104729) >>> 0); // desafío: mismos reclutas para todos
  const list = [];
  const maxL = Math.min(7, 1 + Math.floor(S.day / 4) + Math.floor(openCount(S) / 3));
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
  if (S.iron) return null; // fase 24.7: en Hierro no hay voluntarios del Comité
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

// retiro de veteranos como instructores
export function canRetire(a) {
  if (a.lvl < RETIRE_LEVEL) return `Hace falta nivel ${RETIRE_LEVEL}.`;
  if ((S.instructors || []).length >= MAX_INSTRUCTORS) return `Ya hay ${MAX_INSTRUCTORS} instructores.`;
  return '';
}
export function retire(a) {
  const why = canRetire(a);
  if (why) return { ok: false, msg: why };
  for (const it of [...Object.values(a.equip).filter(Boolean), ...a.bag]) addToStash(it);
  S.instructors.push({ name: agentName(a), lvl: a.lvl, spec: a.spec, bg: bgName(a), day: S.day, color: a.color, medals: [...(a.medals || [])] });
  S.agents.splice(S.agents.indexOf(a), 1);
  addMessage(`${agentName(a)} se retira como instructor. Los novatos (nivel ${ROOKIE_LEVEL} o menos) aprenderán un ${INSTRUCTOR_XP}% más rápido.`);
  save();
  return { ok: true };
}

// ---------------- Enfermería ----------------
export const treatWoundCost = () => woundCost(S.modules.enfermeria);
export function treatWound(a, i) {
  const w = a.wounds && a.wounds[i];
  if (!w) return { ok: false, msg: 'No hay herida.' };
  const c = treatWoundCost();
  if (S.rub < c) return { ok: false, msg: 'Rublos insuficientes.' };
  S.rub -= c;
  a.wounds.splice(i, 1);
  save();
  return { ok: true, cost: c, name: w.name };
}
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
  // fase 21: construir por primera vez ocupa una parcela del plano
  if (lvl === 0) { const pl = placeBuilding(id); if (!pl.ok) return pl; }
  S.ess -= c.ess; S.rub -= c.rub;
  S.modules[id]++;
  if (S.shop) S.shop.day = -1; // refrescar la intendencia con las nuevas existencias
  const m = MODULES.find((x) => x.id === id);
  addMessage(`${m.name} mejorada a nivel ${S.modules[id]}. ${m.eff(S.modules[id])}.`);
  save();
  return { ok: true };
}

// ---------------- Expediciones ----------------
export function launchExpedition(mapIdx, agents, evId = null) {
  agents = agents.filter((a) => !sickDays(a)); // fase 25: los enfermos no salen
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
  // zona de evento: se genera sobre su zona base y se consume al entrar
  // fase 21.6: defensa de la base
  if (evId === 'defensa' && S.attack) return Expedition.create(0, agents, [], defenseDef());
  const ev = evId && (S.eventZones || []).find((z) => z.id === evId);
  if (ev) {
    S.eventZones = S.eventZones.filter((z) => z !== ev);
    return Expedition.create(mapIndex(EVENT_ZONES[ev.kind].base), agents, [], eventDef(ev));
  }
  const exp = Expedition.create(mapIdx, agents, zoneMods(mapIdx));
  return exp;
}

export function finalizeExpedition(exp) {
  const def = exp.def;
  // fase 19: lo que traen el perro y la Mula
  const compBack = exp.finishCompanions ? exp.finishCompanions() : [];
  const labBonus = 1 + S.modules.laboratorio * 0.1 + ((S.trust ?? 50) >= 75 ? 0.05 : 0); // confianza plena de Topolev: +5%
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
      if ((def.lvl[0] + def.lvl[1]) / 2 >= 5) a.deepRuns = (a.deepRuns || 0) + 1;
      awardHonors(exp, sq, a);
      row.news = sq.news || [];
      const bonusXp = 15 * def.lvl[1];
      const ups = giveXp(a, bonusXp);
      row.lvl = a.lvl; row.lvlUp = a.lvl - sq.lvl0;
      row.items = [...Object.values(a.equip).filter(Boolean), ...a.bag].map((it) => ({ name: itemName(it), r: it.r, q: it.q, it: JSON.parse(JSON.stringify(it)) })); // it: copia para el tooltip del informe
      for (const it of [...Object.values(a.equip).filter(Boolean), ...a.bag]) {
        if (!S.stats.bestItem || it.r > S.stats.bestItem.r) S.stats.bestItem = { name: itemName(it), r: it.r };
      }
    } else {
      row.lost = sq.snap ? true : false;
      rep.lostItems += sq.startItems || 0;
      row.news = [];
      if (sq.recovered) { row.recovered = sq.recovered; rep.lostItems = Math.max(0, rep.lostItems - 1); }
      if (sq.essKept) { row.essKept = sq.essKept; rep.essRaw += sq.essKept; }
    }
    // al volver a la base, descontaminación automática (después de los rasgos: «Irradiado» sigue contando lo que traían)
    if (sq.out && a) {
      const r = Math.round(a.rad || 0);
      if (r > 0) row.news.push(`☢ Descontaminado al volver: −${r} de radiación`);
      a.rad = 0;
    }
    rep.agents.push(row);
  }
  rep.ess = Math.round(rep.essRaw * labBonus);
  S.ess += rep.ess;
  S.stats.essTotal += rep.ess;
  if (def.id === 'defensa') { attackResult(!!exp.defenseWon); anyOut = anyOut && !!exp.defenseWon; }
  if (anyOut && def.id !== 'defensa') {
    S.stats.extractions++;
    var wasOpen = MAPS.map((m, i) => zoneOpen(S, i));
    S.cleared[def.id] = (S.cleared[def.id] || 0) + 1;
    // zonas que se abren por primera vez gracias a esta extracción
    const opened = MAPS.filter((m, i) => !wasOpen[i] && zoneOpen(S, i));
    if (opened.length) {
      rep.unlocked = opened.map((m) => m.name).join(', ');
      for (const m of opened) addMessage(`Acceso concedido a ${m.name}. Nivel medio ${m.lvl.join('–')}. Preparad mejor equipo.`);
    }
    S.unlocked = openCount(S);
    // fase 18: prisioneros para el KGB y reclutas (desertores, merodeadores)
    const fs = exp.fac;
    if (fs && fs.prisoners) {
      const pay = 150 * fs.prisoners;
      S.rub += pay; addRep(S, 'kgb', 5 * fs.prisoners);
      rep.prisoners = fs.prisoners;
      addMessage(`El KGB ha recogido ${fs.prisoners} prisionero(s) en el punto de extracción. Pago: ${pay} ₽. «El Estado sabe ser agradecido.»`);
    }
    rep.recruits = [];
    for (const rc of (fs && fs.recruits) || []) {
      if (S.agents.length >= rosterCap()) { addMessage('Un recluta de la zona se ha quedado fuera: los barracones están llenos.'); continue; }
      const a = createAgent(rng, { lvl: Math.max(1, Math.min(10, rc.lvl)), bg: 'afgano' });
      a.origin = rc.from;
      starterKit(a);
      S.agents.push(a);
      rep.recruits.push(agentName(a));
      addMessage(`${agentName(a)}, antiguo ${rc.from === 'desertores' ? 'desertor' : 'merodeador'}, se presenta en el puesto. Habrá quien no se fíe.`);
    }
  }
  if (compBack.length) {
    rep.compItems = [];
    for (const it of compBack) { if (addToStash(it)) rep.compItems.push(itemName(it)); }
    if (rep.compItems.length) addMessage(`Llegan a la base ${rep.compItems.length} objeto(s) traídos por los compañeros mecánicos: ${rep.compItems.join(', ')}.`);
  }
  rep.result = !anyOut ? 'fail' : rep.agents.every((r) => r.status === 'extraído') ? 'success' : 'partial';
  const msgs = {
    success: `Expedición a ${def.name} completada. ${rep.ess} ✦ de esencia recuperados. Buen trabajo, camaradas.`,
    partial: `Expedición a ${def.name}: hemos perdido gente. ${rep.ess} ✦ recuperados. Que su sacrificio no sea en vano.`,
    fail: `Expedición a ${def.name}: ningún agente ha regresado. El reactor se ha cobrado su precio.`,
  };
  addMessage(msgs[rep.result]);
  // ---- fase 20: moral, afinidad, encargos, Topolev, crónica y comedor
  const outs = exp.squad.filter((q) => q.out && q.a && S.agents.includes(q.a));
  for (const q of outs) { addStress(q.a, rep.result === 'success' ? -10 : -4); for (const o of outs) if (o !== q && q.id < o.id) addAff(q.a, o.a, 5 + (S.modules.comedor || 0)); }
  const deaths = rep.agents.filter((r) => r.status !== 'extraído').length;
  if (anyOut) trust(rep.result === 'success' ? 3 : 1);
  if (deaths) trust(-4 * deaths, `${deaths} agente(s) muertos en ${def.name}`);
  const fc = (exp.fac && exp.fac.contracts) || {};
  for (const c of S.contracts.active) if (fc[c.id] && anyOut) c.done = true;
  // bolsa de trabajo que se juzga al volver: sin bajas, y salir a tiempo
  for (const c of S.contracts.active) {
    const d = CONTRACTS[c.id];
    if (!d || !d.job || d.zone !== def.id || !anyOut) continue;
    if (d.kind === 'noloss' && deaths === 0) c.done = true;
    if (d.kind === 'speedrun' && exp.turn <= d.n) c.done = true;
  }
  if (exp.fac && exp.fac.rescued && anyOut && S.agents.length < rosterCap()) {
    const [first, last] = exp.fac.rescued.name.split(' ');
    const a = createAgent(rng, { lvl: exp.fac.rescued.lvl });
    a.first = first; a.last = last || a.last; a.female = /a$/.test(first);
    starterKit(a); a.stress = 60;
    S.agents.push(a);
    addMessage(`${exp.fac.rescued.name} vuelve al Puesto tras días perdido en la Zona. Necesitará descanso.`);
    chronicle(`${exp.fac.rescued.name}, rescatado con vida.`);
  }
  rep.contracts = completeContracts();
  // fase 25: el Narrador ajusta la adaptación y guarda la curva de tensión
  rep.tension = (exp.dir && exp.dir.curve) || [];
  if (def.id !== 'defensa') narrOnExpedition({ success: rep.result === 'success', deaths, ess: rep.ess, curve: rep.tension });
  // fase 22: mundo persistente (nidos limpios que tardan en volver, jefes abatidos)
  const calm = recordExpedition(exp);
  if (calm && anyOut) addMessage(calm);
  chronicle(`Expedición a ${def.name}: ${{ success: 'éxito', partial: 'éxito parcial', fail: 'fracaso' }[rep.result]}. ${rep.ess} ✦, ${rep.kills} bajas.${deaths ? ` Caídos: ${rep.agents.filter((r) => r.status !== 'extraído').map((r) => r.name).join(', ')}.` : ''}`);
  if (rep.unlocked) chronicle(`Nueva zona accesible: ${rep.unlocked}.`);
  comedorScene(rep);
  // fase 24.6: estadísticas por zona, esencia del día y racha sin bajas
  statExpedition(MAPS.some((m) => m.id === def.id) ? def.id : null, { extracted: anyOut, deaths, ess: rep.ess });
  S.lastReport = rep;
  S.exp = null;
  nextDay();
  checkActs();
  ensureVolunteer();
  rep.achievements = checkAchievements().map((a) => a.id); // fase 24.6
  rep.ironOver = ironOver(); // fase 24.7: Hierro sin agentes ni dinero → fin
  save();
  return rep;
}

export function nextDay() {
  S.day++;
  baseDayEvents();
  tickEventZones();
  const enf = S.modules.enfermeria;
  worldDayTick(); // fase 22: alerta del reactor
  expireSpecials(); // fase 16.4: los encargos especiales solo valen un día
  baseDayTick(); // fase 21: investigación, celdas, edificios, cuotas, estaciones, historia, operaciones, ataques
  narrDay(); // fase 25: el Narrador del Reactor elige amenazas y alivios
  // fase 20: descanso (y banya), cartas de casa, adicciones
  if (Math.random() < 0.15) familyLetter();
  for (const a of S.agents) {
    addStress(a, -(6 + ((S.modules.banya || 0) * 5)));
    if ((a.acquired || []).includes('adicto')) addStress(a, 2);
  }
  checkActs();
  for (const a of S.agents) {
    const st = agentStats(a);
    a.hp = Math.min(st.hpMaxEff, a.hp + Math.round(st.hpMax * (0.3 + enf * 0.14)));
    a.rad = Math.max(0, a.rad - (8 + enf * 5));
    const st2 = agentStats(a);
    a.hp = Math.min(a.hp, st2.hpMaxEff);
  }
  checkAchievements(); // fase 24.6: día 30, alerta crítica…
  challengeDayTick(); // fase 24.7: fin del desafío semanal
}

// zonas de evento temporales (fase 17.3): caducan y aparecen nuevas
export function tickEventZones(g = rng) {
  S.eventZones = (S.eventZones || []).filter((ev) => --ev.left > 0);
  if (S.day < 3 || S.eventZones.length >= 2 || !g.chance(0.4)) return null;
  const pool = Object.keys(EVENT_ZONES).filter((k) => zoneOpen(S, mapIndex(EVENT_ZONES[k].base)) && !S.eventZones.some((ev) => ev.kind === k));
  if (!pool.length) return null;
  const kind = g.weighted(pool, (k) => EVENT_ZONES[k].w);
  return spawnEventZone(kind, g);
}
export function spawnEventZone(kind, g = rng) {
  const Z = EVENT_ZONES[kind];
  const taken = new Set([...MAPS.map((m) => m.pos.join(',')), ...(S.eventZones || []).map((ev) => ev.pos.join(','))]);
  const pos = Z.pos.find((p) => !taken.has(p.join(','))) || Z.pos[0];
  const ev = { id: `ev${S.day}_${kind}`, kind, pos, left: g.int(Z.days[0], Z.days[1]) + 1 };
  (S.eventZones = S.eventZones || []).push(ev);
  addMessage(`Radio de la Zona: ${Z.name}. ${Z.desc} Disponible ${ev.left - 1} día(s).`);
  return ev;
}
export function eventZoneView(ev) {
  const Z = EVENT_ZONES[ev.kind];
  return { id: ev.id, name: Z.name, glyph: Z.glyph, desc: Z.desc, left: Math.max(1, ev.left - 1), pos: ev.pos };
}

// ---- KGB, Directorio 9 (fase 18): informes a cambio de rublos; vigila el trato con extranjeros
export const KGB_WANTS = { intel: 1.3, docs: 1.1, blackbox: 1.2, foreigndiary: 1.6, relic: 0.8 };
export function kgbStash() { return S.stash.filter((it) => KGB_WANTS[it.b]); }
export function kgbPrice(it) { return Math.round(ITEMS[it.b].value * KGB_WANTS[it.b] * (it.q || 1) * (repOf(S, 'kgb') >= 50 ? 1.2 : 1) * (1 + (S.modules.sala_radio || 0) * 0.05 + (S.research && S.research.r_comunicaciones ? 0.2 : 0))); }
export function kgbDeliver(it) {
  const i = S.stash.indexOf(it);
  if (i < 0) return 0;
  const p = kgbPrice(it);
  S.stash.splice(i, 1);
  S.rub += p; S.stats.rubTotal = (S.stats.rubTotal || 0) + p;
  addRep(S, 'kgb', 3);
  S.kgbReports = (S.kgbReports || 0) + 1;
  return p;
}
export function foreignTrade(f) { return foreignTradeS(S, f); }

// ---- Garaje (fase 19): compañeros mecánicos
export const garageLvl = () => S.modules.garaje || 0;
export function garageStock() { return Object.keys(ITEMS).filter((b) => (ITEMS[b].cat === 'companion' || ITEMS[b].cat === 'dogmod' || (ITEMS[b].garage && ITEMS[b].cat === 'gadget')) && ITEMS[b].garage <= garageLvl()); }
export function garageBuy(b) {
  const d = ITEMS[b];
  if (!d || !d.garage || d.garage > garageLvl()) return { ok: false, msg: 'El garaje no tiene nivel suficiente.' };
  if (S.rub < d.value) return { ok: false, msg: 'Rublos insuficientes.' };
  const it = createItem(b, 0, rng);
  if (!addToStash(it)) return { ok: false, msg: 'El almacén está lleno.' };
  S.rub -= d.value;
  save();
  return { ok: true, it };
}
// salud máxima de un compañero (módulos y talento Mecánico del dueño)
export function compMaxHp(it, owner = null) {
  const d = ITEMS[it.b];
  let hp = d.hp || 0;
  for (const m of it.dmods || []) hp += ITEMS[m.b].hp || 0;
  if (owner && talentFlag(owner, 'mechanic')) hp = Math.round(hp * 1.3);
  return hp;
}
export function compHp(it, owner = null) { return it.broken ? 0 : it.hp == null ? compMaxHp(it, owner) : Math.min(it.hp, compMaxHp(it, owner)); }
export function repairCost(it, owner = null) {
  const lvl = garageLvl();
  const k = (lvl >= 5 ? 0.5 : lvl >= 4 ? 0.75 : 1) * (owner && talentFlag(owner, 'mechanic') ? 0.6 : 1);
  if (it.broken) return { rub: Math.round((200 + ITEMS[it.b].tier * 80) * k), parts: 2 };
  const miss = compMaxHp(it, owner) - compHp(it, owner);
  return miss > 0 ? { rub: Math.round(miss * 3 * k), parts: 0 } : null;
}
export function repairComp(it, owner = null) {
  if (!garageLvl()) return { ok: false, msg: 'Hace falta un Garaje.' };
  const c = repairCost(it, owner);
  if (!c) return { ok: false, msg: 'No necesita reparación.' };
  const parts = S.stash.filter((x) => x.b === 'parts').reduce((n, x) => n + (x.q || 1), 0);
  if (S.rub < c.rub) return { ok: false, msg: 'Rublos insuficientes.' };
  if (parts < c.parts) return { ok: false, msg: `Faltan piezas de recambio (${c.parts}).` };
  S.rub -= c.rub;
  let need = c.parts;
  for (const x of S.stash) { if (need <= 0) break; if (x.b !== 'parts') continue; const mv = Math.min(x.q || 1, need); x.q = (x.q || 1) - mv; need -= mv; }
  S.stash = S.stash.filter((x) => !(x.b === 'parts' && x.q <= 0));
  it.broken = 0; it.hp = compMaxHp(it, owner);
  save();
  return { ok: true, cost: c };
}
export function installDogMod(dog, mod) {
  const d = ITEMS[dog.b];
  dog.dmods = dog.dmods || [];
  if (dog.dmods.length >= (d.modSlots || 0)) return { ok: false, msg: 'No quedan ranuras de módulo.' };
  if (dog.dmods.some((m) => m.b === mod.b)) return { ok: false, msg: 'Ya lleva ese módulo.' };
  const i = S.stash.indexOf(mod);
  if (i < 0) return { ok: false, msg: 'El módulo tiene que estar en el almacén.' };
  S.stash.splice(i, 1);
  dog.dmods.push(mod);
  save();
  return { ok: true };
}
export function removeDogMod(dog, mod) {
  if (stashFull()) return { ok: false, msg: 'El almacén está lleno.' };
  dog.dmods = (dog.dmods || []).filter((m) => m !== mod);
  S.stash.push(mod);
  save();
  return { ok: true };
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

// condecoraciones y rasgos adquiridos al volver de una expedición
function awardHonors(exp, sq, a) {
  const news = (sq.news = sq.news || []);
  const gain = (list, id, tbl, icon) => {
    if (!a[list]) a[list] = [];
    if (a[list].includes(id)) return;
    a[list].push(id);
    news.push(`${icon} ${tbl[id].name}`);
  };
  const others = exp.squad.filter((o) => o !== sq);
  // rasgos adquiridos
  if (sq.minPct != null && sq.minPct < 0.05) gain('acquired', 'superviviente', ACQUIRED, '✚');
  if (a.rad >= 100) gain('acquired', 'irradiado', ACQUIRED, '✚');
  if (repOf(S, 'rda') >= 60 && exp.facSeen && exp.facSeen.rda) gain('acquired', 'rda', ACQUIRED, '✚');
  if ((a.kills || 0) >= 50) gain('acquired', 'carnicero', ACQUIRED, '✚');
  if ((a.extractions || 0) >= 10) gain('acquired', 'veterano', ACQUIRED, '✚');
  if (others.length && others.every((o) => !o.out)) gain('acquired', 'solitario', ACQUIRED, '✚');
  // condecoraciones
  if (sq.bossKills > 0) gain('medals', 'estrella', MEDALS, '🎖');
  if (sq.kills >= 8) gain('medals', 'valor', MEDALS, '🎖');
  if ((a.extractions || 0) >= 5) gain('medals', 'servicio', MEDALS, '🎖');
  if ((a.essTotal || 0) >= 1000) gain('medals', 'lenin', MEDALS, '🎖');
  if ((a.deepRuns || 0) >= 3) gain('medals', 'liquidador', MEDALS, '🎖');
  if ((a.saves || 0) >= 1 || (a.healedOthers || 0) >= 100) gain('medals', 'camarada', MEDALS, '🎖');
  for (const n of news) if (n.startsWith('🎖')) addMessage(`${agentName(a)} recibe la ${n.slice(2)}.`);
}

// fase 25: el Narrador necesita crear voluntarios y saber el límite de la plantilla
export function createAgentFor(opts = {}) { const a = createAgent(rng, { day: S.day, avoid: new Set(S.agents.map((x) => x.nick)), ...opts }); starterKit(a, rng); return a; }
narrHooks({ basecore: basecoreNS, campaign: { rosterCap: () => rosterCap(), createAgentFor } });
