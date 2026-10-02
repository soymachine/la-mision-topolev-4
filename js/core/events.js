// Motor de eventos y diálogos (fase 13.3)
// Los eventos (data/events.js) y los diálogos (data/dialogs.js) son datos declarativos:
//   condición  → objeto (todas sus claves deben cumplirse) o lista de objetos (todas)
//   efecto     → lista de objetos { clave: valor }
// Cualquier valor puede ser una función (ctx) => valor para casos dinámicos.
// El contexto `ctx` lleva { exp?, sq?, a?, obj?, data, base? } según dónde se dispare.
import { S, addMessage } from './state.js';
import { ITEMS } from '../data/items.js';
import { EVENTS } from '../data/events.js';
import { DIALOGS } from '../data/dialogs.js';
import { FACTIONS, repOf, addRep } from '../data/factions.js';
import { MAPS } from '../data/world.js';
import { createItem, rollLoot, mergeInto, itemName, rarityColor } from './items.js';
import { giveXp, bagCapacity, agentStats, talentFlag } from './agents.js';
import { BACKGROUNDS } from '../data/backgrounds.js';
import { rng } from '../util/rng.js';
import { esc } from '../util/dom.js';
import { T, TILES } from '../data/tiles.js';

const val = (v, ctx) => (typeof v === 'function' ? v(ctx) : v);
const cmp = (a, op, b) => ({ '>=': a >= b, '>': a > b, '<=': a <= b, '<': a < b, '==': a === b, '!=': a !== b }[op] ?? false);
const flagVal = (o, f) => (o ? o[f] : undefined);

// ---------------------------------------------------------------- texto
// {agent} apodo del agente · {first} nombre · {map} mapa · {sector} sector · {faction} facción del dato
export function fmt(text, ctx) {
  const s = String(val(text, ctx) ?? '');
  return s.replace(/\{(\w+)\}/g, (m, k) => {
    if (k === 'agent') return ctx.a ? `<span style="color:${ctx.a.color}">${esc(ctx.a.nick)}</span>` : 'el equipo';
    if (k === 'first') return ctx.a ? esc(ctx.a.first) : 'camarada';
    if (k === 'map') return ctx.exp ? esc(ctx.exp.def.name) : '';
    if (k === 'sector') return ctx.data && ctx.data.sector ? esc(ctx.data.sector.name) : '';
    if (k === 'faction') return ctx.data && ctx.data.faction && FACTIONS[ctx.data.faction] ? `<span style="color:${FACTIONS[ctx.data.faction].color}">${esc(FACTIONS[ctx.data.faction].name)}</span>` : '';
    if (k === 'day') return String(S.day);
    return m;
  });
}

// ---------------------------------------------------------------- condiciones
const COND = {
  flag: (v, c) => (Array.isArray(v) ? flagVal(S.flags, v[0]) === v[1] : !!flagVal(S.flags, v)),
  notFlag: (v) => !flagVal(S.flags, v),
  flagAtLeast: ([f, n]) => (S.flags[f] || 0) >= n,
  agentFlag: (v, c) => !!(c.a && c.a.flags && c.a.flags[v]),
  notAgentFlag: (v, c) => !(c.a && c.a.flags && c.a.flags[v]),
  rep: ([f, op, n]) => cmp(repOf(S, f), op, n),
  relation: ([f, att], c) => !!c.exp && c.exp.attitude('squad', f) === att,
  chance: (p) => rng.chance(p),
  day: ([op, n]) => cmp(S.day, op, n),
  ess: ([op, n]) => cmp(S.ess, op, n),
  rub: ([op, n]) => cmp(S.rub, op, n),
  map: (v, c) => !!c.exp && (Array.isArray(v) ? c.exp.mapIdx >= v[0] && c.exp.mapIdx <= v[1] : c.exp.mapIdx === v),
  // dificultad de la zona (0–9) y estrato
  tier: ([op, n], c) => !!c.exp && cmp(c.exp.def.tier || 0, op, n),
  zoneId: (v, c) => !!c.exp && (Array.isArray(v) ? v.includes(c.exp.def.id) : c.exp.def.id === v),
  stratum: (v, c) => !!c.exp && (c.exp.def.stratum || 'sub') === v,
  turn: ([op, n], c) => !!c.exp && cmp(c.exp.turn, op, n),
  zone: (v, c) => !!(c.data && c.data.sector && (Array.isArray(v) ? v.includes(c.data.sector.type) : c.data.sector.type === v)),
  faction: (v, c) => !!c.data && (Array.isArray(v) ? v.includes(c.data.faction) : c.data.faction === v),
  item: (v, c) => !!c.data && (Array.isArray(v) ? v.includes(c.data.item) : c.data.item === v),
  minRarity: (n, c) => !!c.data && (c.data.rarity || 0) >= n,
  actor: (v, c) => !!c.data && (Array.isArray(v) ? v.includes(c.data.type) : c.data.type === v),
  hasUse: (v, c) => !!c.a && c.a.bag.some((it) => ITEMS[it.b].use === v),
  hasItem: (v, c) => !!c.a && (c.a.bag.some((it) => it.b === v) || Object.values(c.a.equip).some((it) => it && it.b === v)),
  agentLvl: ([op, n], c) => !!c.a && cmp(c.a.lvl, op, n),
  hpPct: ([op, n], c) => !!c.a && cmp(c.a.hp / Math.max(1, agentStats(c.a).hpMax), op, n),
  squadSize: ([op, n], c) => !!c.exp && cmp(c.exp.team.length, op, n),
  alone: (v, c) => !!c.exp && (c.exp.team.length === 1) === !!v,
  // fase 15: especialización, trasfondo y talentos (flags) del agente o de cualquiera del escuadrón
  spec: (v, c) => !!c.a && (Array.isArray(v) ? v.includes(c.a.spec) : c.a.spec === v),
  bg: (v, c) => !!c.a && (Array.isArray(v) ? v.includes(c.a.bg) : c.a.bg === v),
  squadFlag: (v, c) => (c.exp ? c.exp.team.map((q) => q.a) : S.agents).some((a) => talentFlag(a, v)),
  any: (list, c) => list.some((x) => checkCond(x, c)),
  not: (x, c) => !checkCond(x, c),
  test: (fn, c) => !!fn(c),
};
export const COND_KEYS = Object.keys(COND);

export function checkCond(cond, ctx) {
  if (!cond) return true;
  if (Array.isArray(cond)) return cond.every((x) => checkCond(x, ctx));
  for (const [k, v] of Object.entries(cond)) {
    const f = COND[k];
    if (!f) { console.warn('Condición desconocida', k); return false; }
    if (!f(k === 'test' ? v : val(v, ctx), ctx)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- efectos
function say(ctx, text, cls) {
  if (ctx.exp) ctx.exp.say(text, cls);
  else (ctx.out || (ctx.out = [])).push({ text, cls });
}
function giveToAgent(ctx, it) {
  const { exp, sq, a } = ctx;
  if (exp && sq) {
    if (!a || mergeInto(a.bag, it, bagCapacity(a))) exp.addFloor(sq.x, sq.y, it);
    return;
  }
  S.stash.push(it); // en la base: al almacén
}
const EFF = {
  log: (v, c, e) => say(c, fmt(v, c), e.cls || ''),
  radio: (v, c) => say(c, '📻 ' + fmt(v, c), 'cyan'),
  setFlag: (v) => { if (Array.isArray(v)) S.flags[v[0]] = v[1]; else S.flags[v] = true; },
  clearFlag: (v) => { delete S.flags[v]; },
  incFlag: (v) => { S.flags[v] = (S.flags[v] || 0) + 1; },
  agentFlag: (v, c) => { if (c.a) { c.a.flags = c.a.flags || {}; c.a.flags[v] = true; } },
  rep: ([f, n], c) => {
    // Políglota (Comisario): las mejoras de reputación son mayores
    const poly = n > 0 ? Math.max(0, ...(c.exp ? c.exp.team.map((q) => q.a) : S.agents).map((a) => talentFlag(a, 'polyglot'))) : 0;
    n = Math.round(n * (1 + poly / 100));
    addRep(S, f, n);
    const F = FACTIONS[f];
    if (F) say(c, `Reputación con <span style="color:${F.color}">${esc(F.short || F.name)}</span>: ${n > 0 ? '+' : ''}${n} (${S.rep[f]}).`, n > 0 ? 'good' : 'warn');
  },
  relation: ([f, att], c) => {
    if (!c.exp) return;
    const key = ['squad', f].sort().join('|');
    c.exp.relations = c.exp.relations || {};
    c.exp.relations[key] = att;
  },
  give: (v, c) => {
    const n = val(v.n ?? 1, c);
    for (let i = 0; i < n; i++) {
      const it = createItem(v.item, v.rar || 0, rng, v.q);
      giveToAgent(c, it);
      say(c, `Recibís <span style="color:${rarityColor(it.r)}">${esc(itemName(it))}${it.q > 1 ? ' ×' + it.q : ''}</span>.`, 'good');
    }
  },
  loot: (v, c) => {
    const lvl = Math.min(10, (c.obj && c.obj.lvl) || (c.exp ? c.exp.def.lvl[1] : 1)) + (v.lvlBonus || 0);
    const n = Array.isArray(v.n) ? rng.int(v.n[0], v.n[1]) : v.n || 1;
    for (let i = 0; i < n; i++) {
      const it = rollLoot(Math.max(1, Math.min(10, lvl)), rng, { rarityBonus: v.rarityBonus || 0, catW: v.catW });
      if (c.exp && c.sq && v.floor !== false) c.exp.addFloor(c.sq.x, c.sq.y, it);
      else giveToAgent(c, it);
    }
    if (c.exp && c.sq) c.exp.emit('loot', { floor: true, x: c.sq.x, y: c.sq.y });
  },
  essence: (v, c) => {
    const n = Math.round(val(v, c));
    if (c.exp && c.sq) {
      const k = c.exp.key(c.sq.x, c.sq.y);
      c.exp.essence.set(k, (c.exp.essence.get(k) || 0) + n);
    } else { S.ess += n; say(c, `+${n} ✦ esencia.`, 'cyan'); }
  },
  ess: (v, c) => { S.ess = Math.max(0, S.ess + val(v, c)); },
  rub: (v, c) => { S.rub = Math.max(0, S.rub + val(v, c)); },
  xp: (v, c) => {
    if (!c.a) return;
    const ups = giveXp(c.a, Math.round(val(v, c)));
    if (ups) say(c, `★ ${fmt('{agent}', c)} sube a nivel ${c.a.lvl}. <span class="dimt">(▲ ascenso pendiente en la base)</span>`, 'good');
  },
  heal: (v, c) => { if (c.a) c.a.hp = Math.min(agentStats(c.a).hpMaxEff, c.a.hp + val(v, c)); },
  rad: (v, c) => { if (c.a) c.a.rad = Math.max(0, Math.min(150, c.a.rad + val(v, c))); },
  hurt: (v, c) => { if (c.exp && c.sq) c.exp.damageAgent(c.sq, val(v, c), 'un suceso'); },
  consumeUse: (v, c) => {
    if (!c.a || !c.exp || !c.sq) return;
    const h = c.a.bag.filter((it) => ITEMS[it.b].use === v).sort((x, y) => (ITEMS[x.b].heal || 0) - (ITEMS[y.b].heal || 0))[0];
    if (h) c.exp.consume(c.sq, h);
  },
  consumeItem: (v, c) => {
    if (!c.a) return;
    const it = c.a.bag.find((x) => x.b === v);
    if (!it) return;
    if (it.q > 1) it.q--; else c.a.bag.splice(c.a.bag.indexOf(it), 1);
  },
  reveal: (v, c) => {
    const exp = c.exp;
    if (!exp) return;
    const R = val(v, c), o = c.obj || c.sq;
    let n = 0;
    for (let y = o.y - R; y <= o.y + R; y++) for (let x = o.x - R; x <= o.x + R; x++) {
      if (!exp.inb(x, y) || Math.hypot(x - o.x, (y - o.y) * 1.3) > R) continue;
      const k = exp.key(x, y);
      if (TILES[exp.t[k]].walk || exp.t[k] === T.WALL || exp.t[k] === T.MACHINE) { if (!exp.explored[k]) n++; exp.explored[k] = 1; }
    }
    c.revealed = n;
    exp.dirty = true;
  },
  spawn: (v, c) => {
    const exp = c.exp;
    if (!exp || !c.sq) return;
    const n = val(v.n ?? 1, c);
    const lvl = val(v.lvl ?? exp.def.lvl[0], c);
    const [d0, d1] = v.dist || [5, 9];
    let made = 0;
    for (let tries = 0; tries < 200 && made < n; tries++) {
      const ang = rng.next() * Math.PI * 2, d = d0 + rng.next() * (d1 - d0);
      const x = Math.round(c.sq.x + Math.cos(ang) * d), y = Math.round(c.sq.y + Math.sin(ang) * d);
      if (!exp.passable(x, y) || exp.entityAt(x, y)) continue;
      exp.spawnEnemy(Array.isArray(v.type) ? rng.pick(v.type) : v.type, lvl, x, y, v.state || 'alerta', null, v.faction);
      made++;
    }
    exp.computeVisibility();
  },
  removeObj: (v, c) => {
    const { exp, obj: o } = c;
    if (!exp || !o || o.gone) return;
    o.gone = true;
    const i = exp.objects.indexOf(o);
    if (i >= 0) exp.objects.splice(i, 1);
    exp.objMap.delete(exp.key(o.x, o.y));
    exp.fx.push({ type: 'extract', x: o.x, y: o.y, color: v.color || '#9fe8a0' });
    exp.dirty = true;
  },
  baseMsg: (v, c) => addMessage(fmt(v, c).replace(/<[^>]+>/g, '')),
  // frase propia del trasfondo del agente (o de uno al azar del escuadrón con 'random:<tipo>')
  bgLine: (v, c) => {
    let a = c.a, kind = v;
    if (String(v).startsWith('random:') && c.exp) { kind = v.slice(7); const q = rng.pick(c.exp.team); a = q && q.a; }
    const B = a && BACKGROUNDS[a.bg];
    const list = B && B.lines[kind];
    if (!list || !list.length) return;
    say(c, `<span style="color:${a.color}">${esc(a.nick)}</span>: <i>${esc(rng.pick(list))}</i>`, 'o1');
  },
  dialog: (v, c) => { c.nextDialog = val(v, c); },
  interrupt: (v, c) => { if (c.exp) c.exp.interrupt = true; },
  fx: (v, c) => { if (c.exp && c.sq) c.exp.fx.push({ ...v, x: c.sq.x, y: c.sq.y }); },
  run: (fn, c) => fn(c),
};
export const EFFECT_KEYS = Object.keys(EFF);

export function runEffects(list, ctx) {
  for (const e of list || []) {
    if (e.if && !checkCond(e.if, ctx)) continue;
    for (const [k, v] of Object.entries(e)) {
      if (k === 'cls' || k === 'if') continue;
      const f = EFF[k];
      if (!f) { console.warn('Efecto desconocido', k); continue; }
      f(k === 'run' ? v : (k === 'give' || k === 'loot' || k === 'spawn' || k === 'fx' ? v : val(v, ctx)), ctx, e);
    }
  }
}

// ---------------------------------------------------------------- eventos
// once: true → una vez por partida (S.eventsDone) · 'exp' → una vez por expedición (exp.eventsDone)
export function fireEvents(trigger, ctx) {
  const fired = [];
  for (const ev of EVENTS) {
    if (ev.on !== trigger) continue;
    if (ev.once === true && S.eventsDone[ev.id]) continue;
    if (ev.once === 'exp' && ctx.exp && ctx.exp.eventsDone && ctx.exp.eventsDone[ev.id]) continue;
    if (ev.once === 'agent' && ctx.a && ctx.a.flags && ctx.a.flags['ev_' + ev.id]) continue;
    if (!checkCond(ev.cond, ctx)) continue;
    if (ev.chance != null && !rng.chance(ev.chance)) continue;
    if (ev.once === true) S.eventsDone[ev.id] = S.day;
    if (ev.once === 'exp' && ctx.exp) (ctx.exp.eventsDone = ctx.exp.eventsDone || {})[ev.id] = 1;
    if (ev.once === 'agent' && ctx.a) (ctx.a.flags = ctx.a.flags || {})['ev_' + ev.id] = 1;
    runEffects(ev.effects, ctx);
    fired.push(ev.id);
    if (ctx.nextDialog) break; // un diálogo por disparo
  }
  return fired;
}

// ---------------------------------------------------------------- diálogos
// estado de diálogo: { id, node }
export function dialogView(dlg, ctx) {
  const D = DIALOGS[dlg.id];
  if (!D) return null;
  const N = D.nodes[dlg.node];
  if (!N) return null;
  const opts = [];
  (val(N.opts, ctx) || []).forEach((o, i) => {
    if (o.show && !checkCond(o.show, ctx)) return; // oculta
    const ok = checkCond(o.cond, ctx);
    opts.push({ i, label: fmt(o.label, ctx), ok, hint: !ok && o.hint ? fmt(o.hint, ctx) : '', cls: o.cls || '' });
  });
  return {
    title: fmt(N.title || D.title, ctx),
    speaker: fmt(N.speaker || D.speaker || '', ctx),
    color: val(N.color || D.color, ctx) || '#ff9a3c',
    art: N.art || D.art || '',
    text: fmt(N.text, ctx),
    opts,
  };
}

// aplica la opción i; devuelve { end, turn } y deja dlg.node actualizado si continúa
export function dialogChoose(dlg, i, ctx) {
  const D = DIALOGS[dlg.id];
  const o = D && D.nodes[dlg.node] && (val(D.nodes[dlg.node].opts, ctx) || [])[i];
  if (!o || !checkCond(o.cond, ctx) || (o.show && !checkCond(o.show, ctx))) return null;
  ctx.nextDialog = null;
  runEffects(o.effects, ctx);
  if (ctx.nextDialog) { dlg.id = ctx.nextDialog; dlg.node = 'start'; return { end: false, turn: !!o.turn }; }
  const go = val(o.goto, ctx);
  if (go) { dlg.node = go; return { end: false, turn: !!o.turn }; }
  return { end: true, turn: !!o.turn };
}


