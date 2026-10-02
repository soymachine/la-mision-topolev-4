// Consola de depuración oculta (fase 13.5): tecla º (o `) · ?debug en la URL la abre al arrancar
import { el, esc } from '../util/dom.js';
import { S, save } from '../core/state.js';
import { ITEMS } from '../data/items.js';
import { ACTORS, actorFaction } from '../data/actors.js';
import { FACTIONS, addRep } from '../data/factions.js';
import { EVENTS } from '../data/events.js';
import { DIALOGS } from '../data/dialogs.js';
import { createItem, itemName, mergeInto, rarityColor } from '../core/items.js';
import { agentStats, bagCapacity, giveXp, chooseSpec, talentDef, ALL_TALENTS } from '../core/agents.js';
import { SPECS } from '../data/specs.js';
import { MODIFIERS, WEATHER } from '../data/modifiers.js';
import { EVENT_ZONES } from '../data/world.js';
import { runEffects } from '../core/events.js';
import * as C from '../core/campaign.js';

export function installDebug(app) {
  // app: { exp(), base, expUI, current() }
  const box = el('div', { class: 'dbg hidden' });
  const out = el('div', { class: 'dbg-out' });
  const inp = el('input', { class: 'dbg-in', spellcheck: 'false', autocomplete: 'off', placeholder: 'help · Tab completa · ↑↓ historial · Esc cierra' });
  box.append(el('div', { class: 'dbg-title', text: '░ CONSOLA DE DEPURACIÓN ░' }), out, inp);
  document.body.append(box);
  const hist = [];
  let hi = 0;
  const print = (html, cls = '') => { out.append(el('div', { class: cls, html })); while (out.children.length > 200) out.firstChild.remove(); out.scrollTop = out.scrollHeight; };
  const open = () => { box.classList.remove('hidden'); setTimeout(() => inp.focus(), 0); };
  const close = () => { box.classList.add('hidden'); inp.blur(); };
  const isOpen = () => !box.classList.contains('hidden');

  const exp = () => app.exp();
  const needExp = () => { const e = exp(); if (!e || e.ended) throw new Error('solo durante una expedición'); return e; };
  const refresh = () => {
    const e = exp();
    if (e && !e.ended) { e.computeVisibility(true); e.dirty = true; e.emit('update'); }
    else if (app.current() === 'base') app.base.render();
  };
  const freeNear = (e, cx, cy, rmin = 1, rmax = 6) => {
    const outp = [];
    for (let y = cy - rmax; y <= cy + rmax; y++) for (let x = cx - rmax; x <= cx + rmax; x++) {
      const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
      if (d >= rmin && d <= rmax && e.passable(x, y) && !e.entityAt(x, y)) outp.push([x, y, Math.hypot(x - cx, y - cy)]);
    }
    return outp.sort((a, b) => a[2] - b[2]);
  };
  const findId = (table, q) => {
    if (table[q]) return q;
    const l = q.toLowerCase();
    const m = Object.keys(table).filter((k) => k.toLowerCase().includes(l) || (table[k].name || '').toLowerCase().includes(l));
    if (m.length === 1) return m[0];
    throw new Error(m.length ? `ambiguo: ${m.slice(0, 12).join(', ')}${m.length > 12 ? '…' : ''}` : `no existe «${q}»`);
  };
  const num = (v, d) => (v == null || v === '' ? d : Number(v));
  const who = () => { const e = exp(); if (e && !e.ended) return e.cur.a; const a = (app.base && app.base.selAgent) || S.agents[0]; if (!a) throw new Error('no hay agentes'); return a; };

  const CMDS = {
    help: { a: '', d: 'esta ayuda', f: () => { for (const [k, c] of Object.entries(CMDS)) print(`<b>${k}</b> <span class="dimt">${esc(c.a)}</span> — ${esc(c.d)}`); } },
    clear: { a: '', d: 'limpia la consola', f: () => { out.innerHTML = ''; } },
    items: { a: '[filtro]', d: 'lista ids de objetos', f: ([q = '']) => { const l = Object.keys(ITEMS).filter((k) => !q || k.includes(q) || ITEMS[k].name.toLowerCase().includes(q.toLowerCase())); print(l.slice(0, 80).map((k) => `${k} <span class="dimt">${esc(ITEMS[k].name)}</span>`).join(' · ') + (l.length > 80 ? ` … (+${l.length - 80})` : '')); } },
    actors: { a: '[filtro]', d: 'lista ids de actores (chebylitas y personas)', f: ([q = '']) => { const l = Object.keys(ACTORS).filter((k) => !q || k.includes(q) || ACTORS[k].name.toLowerCase().includes(q.toLowerCase())); print(l.map((k) => { const f = FACTIONS[ACTORS[k].faction || 'chebylitas']; return `${k} <span style="color:${f ? f.color : ''}">${esc(ACTORS[k].name)}</span>`; }).join(' · ')); } },
    give: { a: '<id> [rareza 0-5] [cantidad]', d: 'da un objeto (al agente activo o al almacén)', f: ([q, r, n]) => {
      const id = findId(ITEMS, q);
      const it = createItem(id, Math.max(0, Math.min(5, num(r, 0))), undefined, n ? Number(n) : undefined);
      const e = exp();
      if (e && !e.ended) { const a = e.cur.a; if (mergeInto(a.bag, it, bagCapacity(a))) { e.addFloor(e.cur.x, e.cur.y, it); print('mochila llena: al suelo'); } }
      else S.stash.push(it);
      print(`+ <span style="color:${rarityColor(it.r)}">${esc(itemName(it))}${it.q > 1 ? ' ×' + it.q : ''}</span>`, 'good');
    } },
    spawn: { a: '<actor> [nivel] [n] [estado]', d: 'genera actores junto al agente activo', f: ([q, l, n, st]) => {
      const e = needExp(); const id = findId(ACTORS, q); const c = e.cur;
      const spots = freeNear(e, c.x, c.y, 2, 8);
      const k = Math.min(num(n, 1), spots.length);
      for (let i = 0; i < k; i++) { const s = spots[Math.floor((i * spots.length) / Math.max(1, k)) % spots.length]; e.spawnEnemy(id, num(l, e.def.lvl[0]), s[0], s[1], st || 'errante'); }
      e.computeVisibility();
      print(`${k}× ${esc(ACTORS[id].name)} (${actorFaction({ type: id })})`, 'good');
    } },
    kill: { a: '[all]', d: 'elimina actores hostiles visibles (o todos)', f: ([w]) => {
      const e = needExp(); let n = 0;
      for (const x of [...e.enemies]) if (w === 'all' || (e.isVisible(x.x, x.y) && e.attitudeToSquad(x) === 'hostile')) { e.killEnemy(x, e.cur); n++; }
      print(`${n} eliminados`);
    } },
    tp: { a: '<x y | sector A-2 | exit | lift>', d: 'teletransporta al agente activo', f: ([a, b]) => {
      const e = needExp(); const c = e.cur; let x, y;
      if (a === 'exit') { const ex = e.exits.find((q) => q.perm) || e.exits[0]; if (!ex) throw new Error('no hay extracciones en este piso'); [x, y] = [ex.x, ex.y]; }
      else if (a === 'lift') { if (!e.lift) throw new Error('no hay montacargas de bajada'); [x, y] = e.lift; }
      else if (/^[a-z]-\d+$/i.test(a)) { const s = e.sectors.find((q) => q.code.toLowerCase() === a.toLowerCase()); if (!s) throw new Error('sector desconocido'); [x, y] = [s.x + (s.w >> 1), s.y + (s.h >> 1)]; }
      else [x, y] = [Number(a), Number(b)];
      const f = freeNear(e, x, y, 0, 12)[0];
      if (!f) throw new Error('sin casilla libre');
      e.moveEntity(c, f[0], f[1]); e.onAgentEnter(c);
      app.expUI.r.centerOn(c.x, c.y, true);
      print(`→ ${f[0]},${f[1]}`);
    } },
    mods: { a: '<id,id… | off>', d: 'fuerza los modificadores de zona de las próximas expediciones', f: ([v]) => {
      if (!v || v === 'off') { delete S.forceMods; print('modificadores: los del día'); return; }
      const list = v.split(',').filter(Boolean);
      for (const m of list) if (!MODIFIERS[m]) throw new Error('modificadores: ' + Object.keys(MODIFIERS).join(', '));
      S.forceMods = list; print('forzados: ' + list.join(', '));
      if (app.current() === 'base') app.base.render();
    } },
    unlock: { a: '', d: 'abre/cierra todas las zonas de la región', f: () => { S.unlockAll = !S.unlockAll; print('todas las zonas: ' + (S.unlockAll ? 'abiertas' : 'según el progreso')); if (app.current() === 'base') app.base.render(); } },
    evzone: { a: '<tipo>', d: 'hace aparecer una zona de evento en la región', f: ([k]) => {
      if (!EVENT_ZONES[k]) throw new Error('tipos: ' + Object.keys(EVENT_ZONES).join(', '));
      const ev = C.spawnEventZone(k); print(`+ ${esc(EVENT_ZONES[k].name)} (${ev.left - 1} días)`, 'good');
      if (app.current() === 'base') app.base.render();
    } },
    clock: { a: '<hh> [clima]', d: 'cambia la hora (y el clima) de la expedición de superficie', f: ([h, w]) => {
      const e = needExp(); if (e.clock == null) throw new Error('solo en superficie');
      e.clock = ((num(h, 12) * 60 - e.turn * 2) % 1440 + 1440) % 1440;
      if (w) { if (!WEATHER[w]) throw new Error('clima: ' + Object.keys(WEATHER).join(', ')); e.weather = w; }
      e.computeVisibility(); e.dirty = true; e.emit('update'); print(`${e.timeStr()} · ${WEATHER[e.weather].name}`);
    } },
    floor: { a: '<n>', d: 'lleva al escuadrón al piso n (0 = superior)', f: ([n]) => { const e = needExp(); const to = num(n, e.floor + 1); if (!e.changeFloor(to, to > e.floor ? 'lift' : 'liftup')) throw new Error(`pisos: 0–${e.nFloors - 1}`); print(`piso ${to}`); } },
    reveal: { a: '', d: 'revela todo el mapa', f: () => { const e = needExp(); e.explored.fill(1); for (const x of e.enemies) x.seen = 1; print('mapa revelado'); } },
    heal: { a: '', d: 'cura a todos los agentes (salud y radiación)', f: () => { for (const a of S.agents) { a.hp = agentStats(a).hpMaxEff; a.rad = 0; } const e = exp(); if (e) for (const sq of e.squad) { sq.poison = 0; sq.burn = 0; } print('curados'); } },
    god: { a: '', d: 'activa/desactiva la invulnerabilidad del escuadrón', f: () => { const e = needExp(); e.god = !e.god; print('invulnerable: ' + (e.god ? 'SÍ' : 'NO')); } },
    wait: { a: '[n]', d: 'pasa n turnos', f: ([n]) => { const e = needExp(); const k = num(n, 10); for (let i = 0; i < k && !e.ended; i++) e.wait(); print(`turno ${e.turn}`); } },
    extract: { a: '', d: 'extrae a todo el escuadrón', f: () => { const e = needExp(); for (const sq of e.team) e.extract(sq); e.checkActive(); print('extraídos'); } },
    day: { a: '[n]', d: 'avanza n días en la base (dispara eventos «baseDay»)', f: ([n]) => {
      if (exp() && !exp().ended) throw new Error('solo en la base');
      const k = num(n, 1); for (let i = 0; i < k; i++) C.nextDay(); C.ensureVolunteer(); save();
      print(`día ${S.day}`);
      if (app.current() === 'base') app.base.open();
    } },
    xp: { a: '<n>', d: 'da experiencia al agente activo (o a todos en la base)', f: ([n]) => {
      const e = exp(); const k = num(n, 500);
      const list = e && !e.ended ? [e.cur.a] : S.agents;
      for (const a of list) { const ups = giveXp(a, k); print(`${esc(a.nick)}: Nv ${a.lvl}${ups ? ` (+${ups})` : ''} · ${a.pts || 0} puntos · ${a.offers.length} talentos pendientes`); }
    } },
    spec: { a: '<especialización>', d: 'especializa al agente activo/seleccionado (sube a nivel 5 si hace falta)', f: ([id]) => {
      if (!SPECS[id]) throw new Error('especializaciones: ' + Object.keys(SPECS).join(', '));
      const a = who(); if (a.lvl < 5) giveXp(a, Math.max(0, 750 - a.xp)); a.spec = null; chooseSpec(a, id);
      print(`${esc(a.nick)} → ${esc(SPECS[id].name)} (Nv ${a.lvl})`);
    } },
    talent: { a: '<id>', d: 'enseña un talento al agente activo/seleccionado', f: ([id]) => {
      if (!talentDef(id)) throw new Error('talento desconocido');
      const a = who(); if (!a.talents.includes(id)) a.talents.push(id);
      print(`${esc(a.nick)} aprende ${esc(talentDef(id).name)}`);
    } },
    cd: { a: '', d: 'recarga al instante la habilidad del agente activo', f: () => { const e = needExp(); e.cur.abcd = 0; print('habilidad lista'); } },
    ess: { a: '<n>', d: 'suma esencia', f: ([n]) => { S.ess += num(n, 100); print(`esencia ${S.ess}`); } },
    rub: { a: '<n>', d: 'suma rublos', f: ([n]) => { S.rub += num(n, 500); print(`rublos ${S.rub}`); } },
    rel: { a: '[facción actitud]', d: 'muestra o cambia la actitud del escuadrón hacia una facción', f: ([f, att]) => {
      const e = needExp();
      if (f) { if (!FACTIONS[f]) throw new Error('facción desconocida'); if (!['hostile', 'neutral', 'allied'].includes(att)) throw new Error('actitud: hostile | neutral | allied'); e.relations = e.relations || {}; e.relations[['squad', f].sort().join('|')] = att; }
      print(Object.keys(FACTIONS).filter((k) => k !== 'squad').map((k) => `${k}: ${e.attitude('squad', k)}`).join(' · '));
    } },
    rep: { a: '[facción n]', d: 'muestra o suma reputación', f: ([f, n]) => { if (f) addRep(S, f, num(n, 10)); print(esc(JSON.stringify(S.rep))); } },
    flag: { a: '[nombre [valor]]', d: 'muestra o cambia flags narrativos', f: ([f, v]) => {
      if (f) { if (v === 'del') delete S.flags[f]; else S.flags[f] = v == null ? true : isNaN(+v) ? v : +v; }
      print(esc(JSON.stringify(S.flags)));
    } },
    events: { a: '', d: 'lista los eventos y si ya se dispararon', f: () => { print(EVENTS.map((ev) => `${S.eventsDone[ev.id] ? '<span class="good">✓</span>' : '·'} ${ev.id} <span class="dimt">${ev.on}${ev.once ? ' once:' + ev.once : ''}</span>`).join('<br>')); } },
    event: { a: '<id>', d: 'ejecuta los efectos de un evento sin comprobar condiciones', f: ([id]) => {
      const ev = EVENTS.find((x) => x.id === id); if (!ev) throw new Error('evento desconocido');
      const e = exp();
      if (e && !e.ended) { const ctx = e.storyCtx(e.cur, {}); runEffects(ev.effects, ctx); if (ctx.nextDialog) e.openDialog(ctx.nextDialog); }
      else { const ctx = { base: true, data: {}, S }; runEffects(ev.effects, ctx); if (ctx.nextDialog) { S.pendingDialogs.push(ctx.nextDialog); app.base.runDialogs(); } }
      print('ejecutado ' + id);
    } },
    dialog: { a: '<id>', d: 'abre un diálogo', f: ([id]) => {
      if (!DIALOGS[id]) throw new Error('diálogos: ' + Object.keys(DIALOGS).join(', '));
      const e = exp();
      close();
      if (e && !e.ended) e.openDialog(id);
      else { S.pendingDialogs.push(id); app.base.runDialogs(); }
    } },
  };

  const run = (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts.shift();
    if (!cmd) return;
    print(`<span class="dimt">&gt; ${esc(line)}</span>`);
    const c = CMDS[cmd];
    if (!c) { print(`orden desconocida «${esc(cmd)}» · escribe <b>help</b>`, 'bad'); return; }
    try { c.f(parts); refresh(); } catch (err) { print(esc(err.message), 'bad'); if (!(err instanceof Error) || !/^[a-zñ]/i.test(err.message)) console.error(err); }
  };

  const complete = () => {
    const v = inp.value;
    const parts = v.split(/\s+/);
    let pool;
    if (parts.length <= 1) pool = Object.keys(CMDS);
    else if (parts[0] === 'give' && parts.length === 2) pool = Object.keys(ITEMS);
    else if (parts[0] === 'spawn' && parts.length === 2) pool = Object.keys(ACTORS);
    else if ((parts[0] === 'rel' || parts[0] === 'rep') && parts.length === 2) pool = Object.keys(FACTIONS);
    else if (parts[0] === 'rel' && parts.length === 3) pool = ['hostile', 'neutral', 'allied'];
    else if (parts[0] === 'event' && parts.length === 2) pool = EVENTS.map((x) => x.id);
    else if (parts[0] === 'dialog' && parts.length === 2) pool = Object.keys(DIALOGS);
    else if (parts[0] === 'spec' && parts.length === 2) pool = Object.keys(SPECS);
    else if (parts[0] === 'talent' && parts.length === 2) pool = Object.keys(ALL_TALENTS);
    else return;
    const last = parts[parts.length - 1];
    const m = pool.filter((k) => k.startsWith(last));
    if (m.length === 1) { parts[parts.length - 1] = m[0]; inp.value = parts.join(' ') + ' '; }
    else if (m.length > 1) {
      let pre = m[0];
      for (const k of m) while (!k.startsWith(pre)) pre = pre.slice(0, -1);
      parts[parts.length - 1] = pre; inp.value = parts.join(' ');
      print(m.slice(0, 40).join(' · '), 'dimt');
    }
  };

  inp.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') { const v = inp.value; inp.value = ''; if (v.trim()) { hist.push(v); hi = hist.length; run(v); } }
    else if (ev.key === 'Escape' || ev.key === 'º' || ev.code === 'Backquote') { ev.preventDefault(); close(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
    else if (ev.key === 'Tab') { ev.preventDefault(); complete(); }
  });
  inp.addEventListener('keyup', (ev) => ev.stopPropagation());
  window.addEventListener('keydown', (ev) => {
    if (isOpen() || !S) return;
    if (ev.key === 'º' || ev.code === 'Backquote') { ev.preventDefault(); ev.stopImmediatePropagation(); open(); }
  }, true);

  print('Escribe <b>help</b> para ver las órdenes.', 'dimt');
  if (/[?&]debug\b/.test(location.search)) { print('Modo depuración activo (?debug).', 'good'); open(); }
  return { open, close, run, isOpen };
}
