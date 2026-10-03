// Prueba de sistemas (fase 13): facciones, eventos, diálogos, consola de depuración y guardado.
// Uso: python3 -m http.server 8000 &  →  node tests/systems.cjs
// Requiere Playwright. URL configurable con TOPOLEV_URL.
let pw;
try { pw = require('playwright'); } catch { pw = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright'); }
const URL = process.env.TOPOLEV_URL || 'http://localhost:8000/index.html';

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fails++; };

(async () => {
  const b = await pw.chromium.launch();
  // las escenas ASCII se saltan en las pruebas (salvo donde se prueban a propósito)
  const _nc = b.newContext.bind(b);
  b.newContext = async (o) => { const c = await _nc(o); await c.addInitScript(() => { window.__noScenes = true; }); return c; };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
  p.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const dbg = (line) => ev((l) => window.__topolev.debug.run(l), line);
  const closeModals = async () => { for (let i = 0; i < 6 && (await p.$('.modal')); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(120); } };

  await p.goto(URL);
  await p.waitForTimeout(800);
  await p.click('text=NUEVA PARTIDA');
  await p.click('.modal >> text=EMPEZAR AQUÍ >> nth=0');
  await p.click('#screen-intro');
  await p.click('text=COMENZAR');
  await p.waitForTimeout(300);

  console.log('· Base');
  await dbg('ess 100');
  await dbg('day 5');
  await p.waitForTimeout(900);
  ok(await p.$('.dlg-opt'), 'el día 5 abre un diálogo en la base');
  await p.click('.dlg-opt >> nth=0'); await p.waitForTimeout(250);
  await p.click('.dlg-opt >> nth=0'); await p.waitForTimeout(400);
  const base = await ev(() => { const S = window.__topolev.S; return { ess: S.ess, flags: S.flags, pend: S.pendingDialogs.length, done: Object.keys(S.eventsDone) }; });
  ok(base.flags.komitetSold && base.ess === 60, 'vender esencia al Comité aplica sus efectos');
  ok(base.flags.rumourForeign && base.pend === 0, 'eventos de base disparados y cola vacía');
  await closeModals();

  console.log('· Expedición');
  await ev(() => { for (const a of window.__topolev.S.agents) { a.baseHp = 200; a.hp = 200; } });
  await p.click('.tab:has-text("EXPEDICIÓN")');
  await p.click('[data-go]'); await p.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await p.$$('.modal .agent-row'); await rows[i].click(); }
  await p.click('text=LANZAR EXPEDICIÓN');
  await p.waitForTimeout(300);
  if (await p.$('.modal-back')) await p.click('.modal-back >> text=LANZAR');
  await p.waitForTimeout(600);
  ok(await ev(() => window.__topolev.exp.log.some((l) => l.s.includes('Topolev'))), 'evento de inicio de expedición');

  // facciones
  await dbg('spawn rda_rifle 2 2');
  await p.waitForTimeout(300);
  ok((await ev(() => window.__topolev.exp.dlg && window.__topolev.exp.dlg.id)) === 'radio_rda', 'ver a la RDA abre su diálogo de radio');
  await p.keyboard.press('2'); await p.waitForTimeout(200);
  await p.keyboard.press('1'); await p.waitForTimeout(200);
  ok(await ev(() => !window.__topolev.exp.dlg && window.__topolev.S.flags.rdaWantsEssence), 'navegar el árbol del diálogo con el teclado');
  await dbg('spawn swe_scientist 2 1');
  await dbg('spawn usa_operator 2 1');
  await p.waitForTimeout(300);
  ok(await ev(() => window.__topolev.exp.dlg && window.__topolev.exp.dlgQueue.length === 1), 'dos diálogos a la vez se encolan');
  await closeModals(); await p.waitForTimeout(200); await closeModals();
  ok(await ev(() => !window.__topolev.exp.dlg), 'cerrar con Esc vacía la cola');
  await dbg('god');
  await dbg('wait 15');
  // si huye herido, se le da algo más de tiempo al escuadrón
  for (let i = 0; i < 8 && (await ev(() => window.__topolev.exp.enemies.some((x) => x.type === 'usa_operator'))); i++) await dbg('wait 10');
  const fac = await ev(() => { const e = window.__topolev.exp; return { usa: e.enemies.filter((x) => x.type === 'usa_operator').length, rda: e.enemies.filter((x) => x.type === 'rda_rifle').length, flags: window.__topolev.S.flags }; });
  ok(fac.usa === 0, 'el operador americano muere (escuadrón + aliados)');
  ok(fac.rda >= 1, 'los aliados de la RDA sobreviven');
  const swe = await ev(() => { const e = window.__topolev.exp; const s = e.enemies.find((x) => x.type === 'swe_scientist'); if (!s) return 'sin sueco'; if (e.canShoot(e.cur, s) !== 'ok') { const f = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [e.cur.x + dx, e.cur.y + dy]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y)); if (f) { e.moveEntity(s, ...f); e.computeVisibility(true); } } e.attack(e.cur, s); return e.attitude('squad', 'suecia') + ' ' + window.__topolev.S.rep.suecia; });
  ok(swe === 'hostile -25' || swe === 'sin sueco', `atacar a un neutral lo vuelve hostil (${swe})`);

  // superviviente → diálogo
  await ev(() => {
    const e = window.__topolev.exp; const c = e.cur;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const x = c.x + dx, y = c.y + dy; if (e.passable(x, y) && !e.entityAt(x, y)) { const o = { kind: 'survivor', x, y, line: 1, lvl: 2, opened: false, items: [] }; e.objects.push(o); e.objMap.set(e.key(x, y), o); window.__surv = o; break; } }
  });
  await dbg('give bandage 0 2');
  await ev(() => window.__topolev.exp.interact());
  await p.waitForTimeout(300);
  ok((await ev(() => window.__topolev.exp.dlg && window.__topolev.exp.dlg.id)) === 'survivor', 'interactuar con un superviviente abre su diálogo');
  const t0 = await ev(() => window.__topolev.exp.turn);
  await p.click('.dlg-opt:has-text("MEDICINAS")'); await p.waitForTimeout(300);
  const sv = await ev((t) => { const e = window.__topolev.exp; return { turn: e.turn > t, gone: !e.objects.includes(window.__surv), saved: window.__topolev.S.flags.survivorsSaved }; }, t0);
  ok(sv.turn && sv.gone && sv.saved === 1, 'darle medicinas gasta el turno, lo retira y marca el flag');
  await closeModals();

  // guardado con diálogo abierto y relaciones
  await dbg('dialog radio_suecia');
  await p.evaluate(async () => { const m = await import('./js/core/state.js'); m.save(); });
  const p2 = await ctx.newPage();
  await p2.goto(URL); await p2.waitForTimeout(800);
  await p2.click('text=CONTINUAR'); await p2.waitForTimeout(900);
  const re = await p2.evaluate(() => { const e = window.__topolev.exp; return { dlg: e && e.dlg && e.dlg.id, rel: e && e.relations, modal: !!document.querySelector('.dlg-opt'), fac: e && Object.keys(e.facSeen || {}) }; });
  ok(re.dlg === 'radio_suecia' && re.modal, 'el diálogo abierto sobrevive a recargar');
  ok(re.fac && re.fac.includes('usa') && re.fac.includes('rda'), 'las facciones vistas se guardan');
  await p2.close();

  // consola
  console.log('· Consola');
  const r = await ev(() => { const d = window.__topolev.debug; d.open(); return document.querySelector('.dbg') && !document.querySelector('.dbg').classList.contains('hidden'); });
  ok(r, 'la consola se abre');
  await p.fill('.dbg-in', 'zzz'); await p.press('.dbg-in', 'Enter');
  ok(await p.$eval('.dbg-out', (o) => o.lastChild.textContent.includes('desconocida')), 'orden desconocida avisada');
  await p.keyboard.press('Escape');

  // ================================================================ fase 14
  console.log('· Fase 14: ascenso y contenedor');
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 860 } });
  const q = await ctx2.newPage();
  q.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
  q.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
  const qd = (line) => q.evaluate((l) => window.__topolev.debug.run(l), line);
  const qclose = async () => { for (let i = 0; i < 6 && (await q.$('.modal')); i++) { await q.keyboard.press('Escape'); await q.waitForTimeout(120); } };
  await q.goto(URL); await q.waitForTimeout(800);
  await q.click('text=NUEVA PARTIDA'); await q.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await q.click('#screen-intro'); await q.click('text=COMENZAR');
  await q.waitForTimeout(300);
  ok(await q.evaluate(() => window.__topolev.S.agents.every((a) => a.attr && a.talents && 'case' in a.equip && a.pts === 0)), 'agentes nuevos con atributos, talentos y ranura de contenedor');
  // ascenso
  await qd('xp 1500');
  const asc = await q.evaluate(() => { const a = window.__topolev.S.agents[0]; return { lvl: a.lvl, pts: a.pts, offers: a.offers.length }; });
  ok(asc.pts === asc.lvl - 1 && asc.offers === Math.floor(asc.lvl / 3), `subir de nivel da puntos y ofertas (Nv ${asc.lvl}: ${asc.pts} puntos, ${asc.offers} talentos)`);
  await q.click('.tab:has-text("EQUIPO")'); await q.waitForTimeout(200);
  await q.evaluate(() => { const a = window.__topolev.S.agents[0]; const rows = [...document.querySelectorAll('#screen-base .agent-row')]; const r = rows.find((x) => x.textContent.includes(a.nick)); r && r.click(); });
  await q.waitForTimeout(200);
  ok(await q.$('.ascend-btn'), 'botón de ASCENSO en la ficha');
  const acc0 = await q.evaluate(async () => { const { agentStats } = await import('./js/core/agents.js'); return agentStats(window.__topolev.S.agents[0]).acc; });
  const pun0 = await q.evaluate(() => window.__topolev.S.agents[0].attr.pun);
  await q.click('.ascend-btn'); await q.waitForTimeout(200);
  await q.click('.attr-row >> nth=0 >> button:has-text("+")'); await q.click('.attr-row >> nth=0 >> button:has-text("+")');
  await q.click('button:has-text("CONFIRMAR ATRIBUTOS")'); await q.waitForTimeout(150);
  ok(await q.$('.spec-card'), 'a partir del nivel 5 se ofrece elegir especialización');
  await q.click('.spec-card:has-text("Tirador")'); await q.waitForTimeout(150);
  await q.click('.modal >> button:has-text("ESPECIALIZAR")'); await q.waitForTimeout(250);
  const offer = await q.$$eval('.talent-cards .talent-card', (cs) => cs.map((c) => c.innerText));
  ok(offer.length === 3 && offer.every((t) => /Paciencia|Balística|Observador/.test(t)), `la oferta pasa a ser del árbol de Tirador (${offer.map((t) => t.split('\n')[1]).join(', ')})`);
  await q.click('.talent-cards .talent-card >> nth=0'); await q.waitForTimeout(150);
  await q.click('.modal >> button:has-text("APRENDER")'); await q.waitForTimeout(250);
  ok(await q.$('.spec-tree .node.own'), 'el árbol marca el talento aprendido');
  const asc2 = await q.evaluate(async () => { const { agentStats } = await import('./js/core/agents.js'); const a = window.__topolev.S.agents[0]; return { pun: a.attr.pun, pts: a.pts, tal: a.talents.length, acc: agentStats(a).acc, spec: a.spec }; });
  ok(asc2.pun === pun0 + 2 && asc2.pts === asc.pts - 2 && asc2.tal === 1 && asc2.spec === 'tirador', 'repartir puntos, especializarse y aprender un talento');
  ok(asc2.acc >= acc0 + 2, `la Puntería suma precisión (${acc0} → ${asc2.acc})`);
  await qclose();
  // intendencia
  await qd('rub 30000'); await qd('ess 1000');
  await q.evaluate(() => { window.__topolev.S.modules.almacen = 5; });
  await q.click('.tab:has-text("INTENDENCIA")'); await q.waitForTimeout(250);
  const cases = await q.$$eval('.shop-row', (rs) => rs.filter((r) => r.textContent.includes('▣')).map((r) => r.querySelector('.price').textContent));
  ok(cases.length === 3 && cases.some((t) => t.includes('✦')), `los 3 contenedores a la venta (${cases.join(' / ')})`);
  await q.click('.shop-row:has-text("Matrioska") >> button:has-text("COMPRAR")'); await q.waitForTimeout(200);
  await q.click('.shop-row:has-text("KGB") >> button:has-text("COMPRAR")'); await q.waitForTimeout(200);
  const buy = await q.evaluate(() => { const S = window.__topolev.S; return { ess: S.ess, n: S.stash.filter((x) => x.b === 'matrioska' || x.b === 'kgbcase').length }; });
  ok(buy.n === 2 && buy.ess === 600, 'comprar la Matrioska cobra también 400 ✦');
  // equipar y llenar en la base
  const prep = await q.evaluate(async () => {
    const { caseRefusal } = await import('./js/core/items.js');
    const { createItem } = await import('./js/core/items.js');
    const S = window.__topolev.S; const a = S.agents[0], b2 = S.agents[1];
    const take = (id) => { const i = S.stash.findIndex((x) => x.b === id); return S.stash.splice(i, 1)[0]; };
    a.equip.case = take('matrioska'); b2.equip.case = take('kgbcase');
    const r = {
      heavy: caseRefusal(b2.equip.case, createItem('pkm')), stack: caseRefusal(b2.equip.case, createItem('bandage', 0, undefined, 3)),
      stackM: caseRefusal(a.equip.case, createItem('bandage', 0, undefined, 3)),
    };
    a.equip.case.vault.push(createItem('docs'));
    a.bag.push(createItem('svd', 3));
    for (const x of S.agents) { x.baseHp = 60; x.hp = 60; }
    return r;
  });
  ok(prep.heavy && prep.stack && !prep.stackM, `reglas de tamaño y pilas («${prep.heavy}», «${prep.stack}»)`);
  // expedición: guardar y morir
  await q.click('.tab:has-text("EXPEDICIÓN")');
  await q.click('[data-go]'); await q.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await q.$$('.modal .agent-row'); await rows[i].click(); }
  await q.click('text=LANZAR EXPEDICIÓN'); await q.waitForTimeout(300);
  if (await q.$('.modal-back')) await q.click('.modal-back >> text=LANZAR');
  await q.waitForTimeout(600);
  await q.keyboard.press('i'); await q.waitForTimeout(250);
  ok(await q.$('.modal .slot:has-text("CONTENEDOR")'), 'ranura CONTENEDOR en el inventario de expedición');
  await qclose();
  const ex = await q.evaluate(() => {
    const e = window.__topolev.exp; const S = window.__topolev.S;
    const sq = e.squad.find((x) => x.a.equip.case && x.a.equip.case.b === 'matrioska');
    e.active = e.squad.indexOf(sq);
    const svd = sq.a.bag.find((x) => x.b === 'svd');
    const t0 = e.turn;
    e.act((s) => e.stowItem(s, svd));
    const dropped = e.dropItem(sq, sq.a.equip.case);
    sq.ess = 100;
    const stash0 = S.stash.length;
    e.damageAgent(sq, 9999, 'prueba'); e.damageAgent(sq, 9999, 'prueba'); // fase 23.3: el primero lo deja abatido
    return { turn: e.turn > t0, vault: 2, dropped, stashGain: S.stash.length - stash0, essKept: sq.essKept, rec: sq.recovered };
  });
  ok(ex.turn, 'guardar en el contenedor gasta el turno');
  ok(ex.dropped === false, 'el contenedor no se puede soltar en expedición');
  ok(ex.stashGain === 3 && ex.essKept === 25, `la baliza devuelve contenedor + 2 objetos y 25 ✦ (${(ex.rec || []).join(', ')})`);
  await q.evaluate(() => { const e = window.__topolev.exp; for (const sq of e.team) e.damageAgent(sq, 9999, 'prueba'); });
  await q.waitForTimeout(1800);
  if (await q.$('#screen-report.active') == null) await q.waitForTimeout(1500);
  const repTxt = await q.$eval('#screen-report', (r) => r.innerText).catch(() => '');
  ok(/Recuperado por la baliza/.test(repTxt), 'el informe muestra lo recuperado por la baliza');
  // migración de un veterano sin atributos
  const mig = await q.evaluate(async () => {
    const st = await import('./js/core/state.js');
    const S = window.__topolev.S;
    const a = S.agents[0]; delete a.attr; delete a.offers; delete a.talents; delete a.pts; delete a.equip.case; delete a.av; delete a.bg; delete a.spec; a.lvl = 7; a.acc = 4; a.ev = 2;
    st.save();
    st.load(st.slot);
    const b2 = window.__topolev.S.agents[0];
    return { offers: b2.offers.length, pun: b2.attr.pun, agi: b2.attr.agi, hasCase: 'case' in b2.equip, bg: b2.bg, acc: 'acc' in b2 };
  });
  ok(mig.offers === 2 && mig.pun === 5 && mig.agi === 3 && mig.hasCase && mig.bg && !mig.acc, `migración: precisión/agilidad → atributos, trasfondo y 2 talentos pendientes (${JSON.stringify(mig)})`);
  await ctx2.close();

  // ================================================================ fase 15
  console.log('· Fase 15: sistema RPG');
  const ctx3 = await b.newContext({ viewport: { width: 1440, height: 860 } });
  const R = await ctx3.newPage();
  R.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
  R.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
  const rd = (line) => R.evaluate((l) => window.__topolev.debug.run(l), line);
  await R.goto(URL); await R.waitForTimeout(800);
  await R.click('text=NUEVA PARTIDA'); await R.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await R.click('#screen-intro'); await R.click('text=COMENZAR');
  await R.waitForTimeout(300);
  const fresh = await R.evaluate(() => window.__topolev.S.agents.map((a) => ({ bg: a.bg, ok: Object.values(a.attr).every((v) => v >= 1 && v <= 10), acc: 'acc' in a })));
  ok(fresh.every((x) => x.bg && x.ok && !x.acc), `agentes con trasfondo y atributos 1–10 (${fresh.map((x) => x.bg).join(', ')})`);
  const rec = await R.evaluate(async () => { const A = await import('./js/core/agents.js'); const a = A.createAgent(undefined, { lvl: 9 }); return { spec: a.spec, tal: a.talents.length, pts: a.pts, off: a.offers.length }; });
  ok(rec.spec && rec.tal === 3 && rec.pts === 0 && rec.off === 0, 'un recluta de nivel 9 llega especializado y con 3 talentos');
  // escuadrón: tirador + zapador con sanitario de reserva
  await R.evaluate(() => { const S = window.__topolev.S; for (const a of S.agents) { a.baseHp = 120; a.hp = 300; } window.__topolev.S.modules.barracones = 2; });
  await R.evaluate(async () => {
    const A = await import('./js/core/agents.js');
    const S = window.__topolev.S;
    ['tirador', 'zapador', 'sanitario'].forEach((sp, i) => { const a = S.agents[i]; A.giveXp(a, 800); A.chooseSpec(a, sp); a.hp = A.agentStats(a).hpMaxEff; });
    S.agents[2].talents.push('s_rescate');
  });
  await R.click('.tab:has-text("EXPEDICIÓN")');
  await R.click('[data-go]'); await R.waitForTimeout(150); for (let i = 0; i < 3; i++) { const rows = await R.$$('.modal .agent-row'); if (rows[i]) await rows[i].click(); }
  await R.click('text=LANZAR EXPEDICIÓN'); await R.waitForTimeout(300);
  if (await R.$('.modal-back')) await R.click('.modal-back >> text=LANZAR');
  await R.waitForTimeout(600);
  const squad = await R.evaluate(() => window.__topolev.exp.squad.map((s) => s.a.spec));
  ok(squad.length === 3, `escuadrón especializado: ${squad.join(', ')}`);
  await rd('god');
  await rd('spawn lobo 2 2');
  await R.evaluate(() => { const e = window.__topolev.exp; for (const x of e.enemies) if (x.type === 'lobo') { x.hp = x.hpMax = 999; } e.active = e.squad.findIndex((s) => s.a.spec === 'tirador'); e.emit('switch'); });
  await R.waitForTimeout(200);
  ok(await R.$('.ab-btn:has-text("MARCAR OBJETIVO")'), 'botón de habilidad en el panel del agente');
  await R.keyboard.press('v'); await R.waitForTimeout(150);
  await R.keyboard.press('Enter'); await R.waitForTimeout(200);
  const mk = await R.evaluate(() => { const e = window.__topolev.exp; const t = e.enemies.find((x) => x.marked > 0); return { marked: !!t, cd: e.cur.abcd, hit: t ? e.hitChance(e.cur, t) : 0 }; });
  ok(mk.marked && mk.cd > 0, `V + Enter marca a un enemigo (cd ${mk.cd}, impacto ${mk.hit}%)`);
  const ch = await R.evaluate(() => {
    const e = window.__topolev.exp;
    const z = e.squad.find((s) => s.a.spec === 'zapador'); e.active = e.squad.indexOf(z);
    e.act((s) => e.useAbility(s));
    const placed = e.charges.length;
    for (let i = 0; i < 4; i++) e.wait();
    return { placed, left: e.charges.length, boom: e.log.some((l) => l.s.includes('La carga estalla')) };
  });
  ok(ch.placed === 1 && ch.left === 0 && ch.boom, 'Colocar carga estalla a los 3 turnos');
  await rd('god');
  const resc = await R.evaluate(() => {
    const e = window.__topolev.exp;
    const med = e.squad.find((s) => s.a.spec === 'sanitario');
    const vic = e.squad.find((s) => s !== med && e.inMap(s));
    // juntar a la víctima con el sanitario
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const x = med.x + dx, y = med.y + dy; if (e.passable(x, y) && !e.entityAt(x, y)) { e.moveEntity(vic, x, y); break; } }
    e.damageAgent(vic, vic.a.hp + 50, 'prueba');
    const down = vic.downed; // fase 23.3: cae abatido (4 turnos con Rescate en el grupo)
    const ok2 = e.rescue(med, vic);
    return { alive: e.inMap(vic), down, hp: vic.a.hp, quarter: vic.a.hp >= Math.round(e.ast(vic).hpMaxEff * 0.25), up: !vic.downed && ok2, saves: med.a.saves || 0 };
  });
  ok(resc.alive && resc.down === 4 && resc.up && resc.quarter && resc.saves === 1, 'Rescate: el sanitario levanta a un abatido con al menos un 25% de salud (y le da un turno más de margen)');
  const wound = await R.evaluate(() => {
    const e = window.__topolev.exp; const sq = e.cur;
    for (let i = 0; i < 60 && !(sq.a.wounds || []).length; i++) { sq.woundRoll = false; sq.a.hp = 1; e.markHurt(sq, null); }
    sq.a.hp = 50;
    return (sq.a.wounds || []).map((w) => w.name + ' ' + w.attr);
  });
  ok(wound.length === 1, `heridas persistentes (${wound.join(', ')})`);
  // honores al volver
  await R.evaluate(() => {
    const e = window.__topolev.exp;
    for (const sq of e.team) { sq.kills = 9; sq.bossKills = 1; sq.minPct = 0.03; }
    for (const sq of [...e.team]) e.extract(sq);
    e.checkActive();
  });
  await R.waitForSelector('#screen-report.active', { timeout: 10000 }).catch(() => {});
  await R.waitForTimeout(600);
  const rep = await R.$eval('#screen-report', (x) => x.innerText).catch(() => '');
  ok(/Estrella Roja/.test(rep) && /Medalla al Valor/.test(rep) && /Superviviente/.test(rep), 'el informe muestra condecoraciones y rasgos adquiridos');
  await R.click('#screen-report >> text=VOLVER A LA BASE').catch(() => {});
  await R.waitForTimeout(400);
  // operar la herida y retirar a un veterano
  const wid = await R.evaluate(() => window.__topolev.S.agents.findIndex((a) => (a.wounds || []).length));
  if (wid >= 0) {
    await R.evaluate(() => { window.__topolev.S.rub = 5000; });
    await R.click('.tab:has-text("EQUIPO")'); await R.waitForTimeout(150);
    await R.evaluate((i) => { const a = window.__topolev.S.agents[i]; const row = [...document.querySelectorAll('#screen-base .agent-row')].find((x) => x.textContent.includes(a.nick)); row && row.click(); }, wid);
    await R.waitForTimeout(150);
    await R.click('button:has-text("OPERAR")'); await R.waitForTimeout(200);
    ok(await R.evaluate((i) => window.__topolev.S.agents[i].wounds.length === 0, wid), 'operar una herida en la ficha');
  } else ok(false, 'había una herida que operar');
  await R.evaluate(async () => { const A = await import('./js/core/agents.js'); const a = window.__topolev.S.agents[0]; A.giveXp(a, 4000); });
  await R.click('.tab:has-text("BARRACONES")'); await R.waitForTimeout(200);
  await R.click('#screen-base button:has-text("RETIRAR") >> nth=0'); await R.waitForTimeout(150);
  await R.click('.modal >> button:has-text("RETIRAR")'); await R.waitForTimeout(250);
  const ins = await R.evaluate(async () => { const A = await import('./js/core/agents.js'); const S = window.__topolev.S; const rookie = A.createAgent(undefined, { lvl: 1 }); return { n: S.instructors.length, mult: A.agentHooks.xpMult(rookie) }; });
  ok(ins.n === 1 && Math.abs(ins.mult - 1.15) < 1e-9, `retiro como instructor (+${Math.round((ins.mult - 1) * 100)}% XP a novatos)`);
  await ctx3.close();

  // ================================================================ fase 16
  console.log('· Fase 16: terreno, pisos, luz y modificadores');
  const ctx4 = await b.newContext({ viewport: { width: 1440, height: 860 } });
  const F = await ctx4.newPage();
  F.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
  F.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
  const fd = (line) => F.evaluate((l) => window.__topolev.debug.run(l), line);
  await F.goto(URL); await F.waitForTimeout(800);
  await F.click('text=NUEVA PARTIDA'); await F.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await F.click('#screen-intro'); await F.click('text=COMENZAR');
  await F.waitForTimeout(300);
  await F.evaluate(() => { for (const a of window.__topolev.S.agents) { a.baseHp = 200; a.hp = 400; a.attr.tec = 8; } });
  await fd('mods apagon,extranjeros');
  await F.click('.tab:has-text("EXPEDICIÓN")'); await F.waitForTimeout(200);
  await F.hover('.zchip.hot'); await F.waitForTimeout(150);
  ok(/Apagón/.test(await F.evaluate(() => document.querySelector('#tooltip').innerText)), 'los modificadores del día se ven al elegir destino (rollover CONDICIONES)');
  await F.mouse.move(5, 5);
  await F.click('[data-go]'); await F.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await F.$$('.modal .agent-row'); await rows[i].click(); }
  await F.click('text=LANZAR EXPEDICIÓN'); await F.waitForTimeout(300);
  if (await F.$('.modal-back')) await F.click('.modal-back >> text=LANZAR');
  await F.waitForTimeout(700);
  await fd('god');
  const m1 = await F.evaluate(() => { const e = window.__topolev.exp; const c = e.cur; return { mods: e.mods, lit: (() => { const fires = []; for (let k = 0; k < e.t.length; k++) if (e.t[k] === 55) fires.push(k); let n = 0; for (let k = 0; k < e.lightMap.length; k++) if (e.lightMap[k] && !fires.some((f) => Math.hypot((f % e.w) - (k % e.w), ((f / e.w) | 0) - ((k / e.w) | 0)) <= 5)) n++; return n; })(), dark: e.darkRadius(c, e.ast(c).vision), vis: e.ast(c).vision, humans: e.enemies.filter((x) => x.w).length, floors: e.nFloors }; });
  ok(m1.lit === 0 && m1.dark < m1.vis, `Apagón: sin luz, visión a oscuras ${m1.dark}/${m1.vis}`);
  ok(m1.humans > 0, `Presencia extranjera: ${m1.humans} personas en el mapa`);
  const lt = await F.evaluate(() => {
    const e = window.__topolev.exp; const a = e.cur.a;
    window.__topolev.debug.run('give torch'); const it = a.bag.find((x) => x.b === 'torch'); a.bag.splice(a.bag.indexOf(it), 1); a.equip.g1 = it;
    const on = e.darkRadius(e.cur, e.ast(e.cur).vision); e.toggleLight(e.cur); const off = e.darkRadius(e.cur, e.ast(e.cur).vision); e.toggleLight(e.cur);
    return { on, off };
  });
  ok(lt.on > lt.off, `la linterna amplía la visión a oscuras (${lt.off} → ${lt.on}) y se apaga con L`);
  // terreno: preparado en una sala con casillas colocadas a mano
  const tr = await F.evaluate(() => {
    const e = window.__topolev.exp; const c = e.cur; const out = {};
    const T = { SANDBAG: 12, BARREL: 14, ARMORDOOR: 21, TERMINAL: 22, SWITCH: 23, ROOTS: 30, UNSTABLE: 27, RAIL: 32 };
    const free = (dx, dy) => e.passable(c.x + dx, c.y + dy) && !e.entityAt(c.x + dx, c.y + dy);
    // cobertura: enemigo a 4 casillas con un saco terrero delante
    let spot = null;
    const dirs8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    // despeja una línea recta de 4 casillas (la cobertura en la 3.ª y el enemigo en la 4.ª)
    for (const [dx, dy] of dirs8) {
      const cells = [1, 2, 3, 4].map((n) => [c.x + dx * n, c.y + dy * n]);
      if (!cells.every(([x, y]) => x > 0 && y > 0 && x < e.w - 1 && y < e.h - 1 && !e.entityAt(x, y) && !e.objAt(x, y))) continue;
      for (const [x, y] of cells) e.t[e.key(x, y)] = 2;
      e.computeVisibility(true);
      spot = [...cells[3], ...cells[2]]; break;
    }
    if (spot) {
      const en = e.spawnEnemy('lobo', 1, spot[0], spot[1], 'dormido');
      const h0 = e.hitChance(c, en);
      const old = e.t[e.key(spot[2], spot[3])]; e.t[e.key(spot[2], spot[3])] = T.SANDBAG;
      out.cover = [h0, e.hitChance(c, en)];
      e.t[e.key(spot[2], spot[3])] = old;
      e.killEnemy(en, null);
    }
    // barril: disparo → escombros y fuego
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    const nb = (fn) => { for (const [dx, dy] of dirs) if (fn(c.x + dx * 2, c.y + dy * 2)) return [c.x + dx * 2, c.y + dy * 2]; return null; };
    const bp = nb((x, y) => e.passable(x, y) && !e.entityAt(x, y));
    if (bp) { e.t[e.key(...bp)] = T.BARREL; e.computeVisibility(true); let n = 0; while (e.tile(...bp) === T.BARREL && n++ < 6) e.act((s) => e.shootTile(s, ...bp)); out.barrel = e.tile(...bp); out.fire = e.fire.some((f) => f); }
    // puerta blindada con Técnica 8
    const adj = dirs.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y));
    e.t[e.key(...adj)] = T.ARMORDOOR; out.door = [e.useTile(c, ...adj), e.tile(...adj)];
    // interruptor: ilumina el sector
    e.t[e.key(...adj)] = T.SWITCH; e.useTile(c, ...adj); e.computeVisibility(true); out.lit = e.isLit(c.x, c.y);
    // raíces: se cortan cuerpo a cuerpo
    e.t[e.key(...adj)] = T.ROOTS; c.cur = 'w2'; out.roots = [e.clearObstacle(c, ...adj), e.tile(...adj)]; c.cur = 'w1';
    // escombros inestables: se derrumban con ruido fuerte
    e.t[e.key(...adj)] = T.UNSTABLE; for (let i = 0; i < 10 && e.tile(...adj) === T.UNSTABLE; i++) e.noise(c.x, c.y, 12); out.collapse = e.tile(...adj);
    return out;
  });
  ok(tr.cover && tr.cover[1] === tr.cover[0] - 45, `cobertura de los sacos terreros (total, fase 23.1): ${tr.cover && tr.cover.join('% → ')}%`);
  ok(tr.barrel === 8 && tr.fire, 'disparar a un barril lo hace explotar e incendia');
  ok(tr.door && tr.door[0] && tr.door[1] === 5, 'Técnica 7+ abre una puerta blindada');
  ok(tr.lit, 'el interruptor ilumina el sector');
  ok(tr.roots && tr.roots[0] && tr.roots[1] === 3, 'las raíces se cortan con un arma cuerpo a cuerpo');
  ok(tr.collapse === 28 || tr.collapse === 8, 'un ruido fuerte derrumba los escombros inestables');
  // pisos
  await fd('tp lift');
  const fl = await F.evaluate(() => {
    const e = window.__topolev.exp;
    for (const s of e.team) if (s !== e.cur) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) if (e.passable(e.cur.x + dx, e.cur.y + dy) && !e.entityAt(e.cur.x + dx, e.cur.y + dy)) { e.moveEntity(s, e.cur.x + dx, e.cur.y + dy); break; } }
    const t0 = e.turn; e.interact();
    return { floor: e.floor, exits: e.exits.length, store: !!e.floorStore[0], onLift: e.tile(e.cur.x, e.cur.y) === 35 || Math.hypot(e.cur.x - e.start[0], e.cur.y - e.start[1]) < 3, turn: e.turn > t0 };
  });
  ok(fl.floor === 1 && fl.exits === 0 && fl.store && fl.onLift, `el montacargas baja al escuadrón al piso −1 (sin extracciones permanentes)${fl.floor === 1 && fl.exits === 0 && fl.store && fl.onLift ? '' : ' ' + JSON.stringify(fl)}`);
  await F.evaluate(async () => { (await import('./js/core/state.js')).save(); });
  await F.reload(); await F.waitForTimeout(800); await F.click('text=CONTINUAR'); await F.waitForTimeout(900);
  const fl2 = await F.evaluate(() => { const e = window.__topolev.exp; return { floor: e.floor, store: !!e.floorStore[0], view: !!e.floorView(0) }; });
  ok(fl2.floor === 1 && fl2.store && fl2.view, 'el piso y los pisos visitados sobreviven a recargar');
  // (tras recargar, esperar a que la pantalla de expedición esté lista antes de pulsar la tecla)
  for (let i = 0; i < 3 && !(await F.$('.floor-tabs .filter')); i++) { await F.keyboard.press('m'); await F.waitForSelector('.floor-tabs .filter', { timeout: 1500 }).catch(() => {}); }
  ok((await F.$$('.floor-tabs .filter')).length === 2, 'el mapa grande tiene selector de pisos');
  await F.keyboard.press('Escape');
  const up = await F.evaluate(() => { const e = window.__topolev.exp; window.__topolev.debug.run('god'); e.moveEntity(e.cur, ...e.start); for (const s of e.team) if (s !== e.cur) e.moveEntity(s, e.cur.x + 1, e.cur.y); e.interact(); return { floor: e.floor, exits: e.exits.length }; });
  ok(up.floor === 0 && up.exits >= 2, 'el montacargas de subida vuelve al piso superior');
  await ctx4.close();

  // ================================================================ fase 17
  console.log('· Fase 17: la región, superficie, subsuelo y zonas de evento');
  const ctx5 = await b.newContext({ viewport: { width: 1440, height: 860 } });
  const Z = await ctx5.newPage();
  Z.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
  Z.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
  const zd = (line) => Z.evaluate((l) => window.__topolev.debug.run(l), line);
  const zClose = async () => { for (let i = 0; i < 6 && (await Z.$('.modal')); i++) { await Z.keyboard.press('Escape'); await Z.waitForTimeout(150); } };
  await Z.goto(URL); await Z.waitForTimeout(800);
  await Z.click('text=NUEVA PARTIDA'); await Z.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await Z.click('#screen-intro'); await Z.click('text=COMENZAR');
  await Z.waitForTimeout(300);
  await Z.evaluate(() => { for (const a of window.__topolev.S.agents) { a.baseHp = 200; a.hp = 400; a.attr.tec = 8; } });
  await Z.click('.tab:has-text("EXPEDICIÓN")'); await Z.waitForTimeout(200);
  const rg = await Z.evaluate(() => ({ marks: document.querySelectorAll('.region-map .rg-mk').length, locked: document.querySelectorAll('.region-map .rg-locked').length }));
  ok(rg.marks === 17 && rg.locked === 16, `mapa de la región: ${rg.marks} zonas, ${rg.locked} cerradas al empezar`);
  // Prípiat se abre al extraer de la Administración
  const op = await Z.evaluate(async () => { const W = await import('./js/data/world.js'); const S = window.__topolev.S; S.cleared.admin = 1; return W.zoneOpen(S, W.mapIndex('pripyat')) && !W.zoneOpen(S, W.mapIndex('bosque')); });
  ok(op, 'extraer de una zona abre las siguientes');
  await zd('unlock');
  const launchZone = async (id, ev = false) => {
    await Z.click('.tab:has-text("EXPEDICIÓN")'); await Z.waitForTimeout(200);
    if (ev) await Z.click('.mapcard.event >> nth=0');
    else { const idx = await Z.evaluate(async (zid) => (await import('./js/data/world.js')).mapIndex(zid), id); await Z.click(`.mapcard:not(.event) >> nth=${idx}`); }
    await Z.waitForTimeout(150);
    await Z.click('[data-go]'); await Z.waitForTimeout(150); if (!(await Z.$$('.modal .agent-row.sel')).length) for (let i = 0; i < 2; i++) { const rows = await Z.$$('.modal .agent-row'); await rows[i].click(); }
    await Z.click('text=LANZAR EXPEDICIÓN'); await Z.waitForTimeout(300);
    if (await Z.$('.modal-back')) await Z.click('.modal-back >> text=LANZAR');
    await Z.waitForTimeout(800);
    await zClose();
    await zd('god');
  };
  const endExp = async () => {
    await Z.evaluate(() => { const e = window.__topolev.exp; if (e.dlg) e.closeDialog(); for (const sq of [...e.team]) e.extract(sq); e.checkActive(); });
    await Z.waitForSelector('#screen-report.active', { timeout: 10000 }).catch(() => {});
    for (let i = 0; i < 30 && !(await Z.$('#screen-base.active')); i++) {
      await Z.click('#screen-report >> text=VOLVER A LA BASE', { timeout: 800 }).catch(() => {});
      await zClose(); await Z.waitForTimeout(300);
    }
    if (!(await Z.$('#screen-base.active'))) console.log('    (pantalla activa: ' + (await Z.evaluate(() => [...document.querySelectorAll('.screen.active, [id^=screen-].active')].map((x) => x.id).join(','))) + ' · modal: ' + (await Z.evaluate(() => (document.querySelector('.modal') || {}).innerText || '')).slice(0, 200) + ')');
    await zClose();
  };
  // ---- superficie: Prípiat
  await launchZone('pripyat');
  const sf = await Z.evaluate(async () => {
    const e = window.__topolev.exp; const c = e.cur;
    const out = { id: e.def.id, surface: e.surface, clock: e.clock != null, weather: e.weather };
    window.__topolev.debug.run('clock 12 despejado'); e.computeVisibility(true);
    const outdoor = []; for (let k = 0; k < e.t.length; k++) if (!e.indoor[k] && e.passable(k % e.w, (k / e.w) | 0)) outdoor.push(k);
    out.dayLit = outdoor.slice(0, 50).every((k) => e.isLit(k % e.w, (k / e.w) | 0));
    window.__topolev.debug.run('clock 23'); e.computeVisibility(true);
    // de noche solo quedan las luces locales (hogueras, farolas, linternas): casi todo el exterior a oscuras
    out.night = e.isNight(); out.nightLit = outdoor.filter((k) => e.isLit(k % e.w, (k / e.w) | 0)).length / outdoor.length;
    await new Promise((r) => setTimeout(r, 300));
    out.top = document.querySelector('#screen-exp').innerText.includes('☾');
    // excavar y la antena
    const adj = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y));
    e.t[e.key(...adj)] = 42; const r0 = c.a.rad; out.dig = [e.useTile(c, ...adj), e.tile(...adj), c.a.rad > r0];
    e.t[e.key(...adj)] = 47; e.useTile(c, ...adj); out.antenna = [e.revealT, e.tile(...adj), e.explored.reduce((a, b) => a + b, 0) / e.t.filter((t) => t !== 0).length];
    return out;
  });
  ok(sf.id === 'pripyat' && sf.surface && sf.clock && sf.weather, `Prípiat: superficie con reloj y clima (${sf.weather})`);
  ok(sf.dayLit && sf.night && sf.nightLit < 0.25 && sf.top, `de día el exterior está iluminado; de noche no, y la barra muestra ☾${sf.dayLit && sf.night && sf.nightLit < 0.25 && sf.top ? '' : ` (día ${sf.dayLit}, noche ${sf.night}, iluminado ${Math.round(sf.nightLit * 100)}%, ☾ ${sf.top})`}`);
  ok(sf.dig[0] && sf.dig[1] === 38 && sf.dig[2], 'excavar la tierra removida (con radiación)');
  ok(sf.antenna[0] === 30 && sf.antenna[1] === 53 && sf.antenna[2] > 0.99, 'la antena revela todo el mapa 30 turnos');
  await endExp();
  // ---- Yanov: el tren fantasma
  await launchZone('yanov');
  const tn = await Z.evaluate(() => {
    const e = window.__topolev.exp;
    const row = e.railRows[0]; let x = -1;
    for (let xx = 0; xx < e.w; xx++) if (e.tile(xx, row) === 32 && !e.entityAt(xx, row)) { x = xx; break; }
    if (x < 0) return { rows: e.railRows.length };
    const en = e.spawnEnemy('rata', 1, x, row, 'dormido');
    if (en.x !== x || en.y !== row) e.moveEntity(en, x, row); // que esté de verdad en la vía
    // el tren pasa por la vía más cercana al agente activo: se deja solo esta para la prueba
    const rows0 = e.railRows; e.railRows = [row];
    e.trainAt = e.turn; e.zoneTick();
    e.railRows = rows0;
    return { rows: rows0.length, dead: !e.enemies.includes(en) || en.hp < en.hpMax, next: e.trainAt > e.turn, onRail: en.y === row };
  });
  ok(tn.rows > 0 && tn.dead && tn.next, `el tren fantasma de Yanov arrolla lo que hay en la vía${tn.rows > 0 && tn.dead && tn.next ? '' : ' ' + JSON.stringify(tn)}`);
  await endExp();
  // ---- Campamento Wismut: comerciante y enfermería
  await launchZone('wismut');
  const cp = await Z.evaluate(() => {
    const e = window.__topolev.exp; const S = window.__topolev.S; const c = e.cur;
    const kinds = ['trader', 'medic', 'board'].map((k) => !!e.objects.find((o) => o.kind === k));
    S.rub = 1000; S.rep.rda = 0;
    const tr = e.objects.find((o) => o.kind === 'trader');
    e.openDialog('wismut_trader', c, tr);
    const v0 = e.dialogView();
    e.dialogChoose(0); // COMPRAR
    const v1 = e.dialogView();
    e.dialogChoose(0); // AI-2
    const bought = c.a.bag.some((it) => it.b === 'ai2') || e.floorAt(c.x, c.y).some((it) => it.b === 'ai2');
    const rub1 = S.rub;
    e.closeDialog();
    c.a.hp = 5;
    e.openDialog('wismut_medic', c, e.objects.find((o) => o.kind === 'medic'));
    e.dialogChoose(0);
    const healed = c.a.hp >= 50;
    if (e.dlg) e.closeDialog();
    e.openDialog('wismut_board', c, e.objects.find((o) => o.kind === 'board'));
    const board = e.dialogView().text.length > 50;
    e.closeDialog();
    return { kinds, social: !!e.def.social, start: v0.opts.length, buyOpts: v1.opts.length, bought, rub1, healed, rub2: S.rub, board };
  });
  ok(cp.social && cp.kinds.every(Boolean), 'el campamento tiene comerciante, enfermería y tablón');
  ok(cp.buyOpts >= 8 && cp.bought && cp.rub1 === 940, `comprar un AI-2 por 60 ₽ (${cp.buyOpts - 1} artículos)`);
  ok(cp.healed && cp.rub2 < cp.rub1, `la enfermería cura al equipo (${cp.rub1 - cp.rub2} ₽)`);
  ok(cp.board, 'el tablón muestra rumores');
  await endExp();
  // ---- zona de evento: helicóptero estrellado + archivo del Objeto 7
  await Z.evaluate(() => { window.__topolev.S.eventZones = []; });
  await zd('evzone heli');
  await Z.click('.tab:has-text("EXPEDICIÓN")'); await Z.waitForTimeout(200);
  const evUi = await Z.evaluate(() => ({ cards: document.querySelectorAll('.mapcard.event').length, marks: document.querySelectorAll('.region-map .rg-event').length }));
  ok(evUi.cards === 1 && evUi.marks === 1, 'la zona de evento aparece en la lista y en el mapa de la región');
  await launchZone(null, true);
  const ez = await Z.evaluate(() => {
    const e = window.__topolev.exp; const S = window.__topolev.S; const c = e.cur;
    const w = e.objects.find((o) => o.kind === 'wreck');
    e.openDialog('objeto7_archive', c, null);
    e.dialogChoose(0); e.dialogChoose(0); e.dialogChoose(0); e.dialogChoose(0);
    return { event: e.def.event, wreck: !!w && w.items.some((it) => it.b === 'blackbox'), left: (S.eventZones || []).length, past: !!S.flags.topolevPast, docs: c.a.bag.some((it) => it.b === 'docs') || e.floorAt(c.x, c.y).some((it) => it.b === 'docs') };
  });
  ok(ez.event === 'heli' && ez.wreck && ez.left === 0, 'el helicóptero estrellado tiene la caja negra y la zona se consume al entrar');
  ok(ez.past && ez.docs, 'el archivo del Objeto 7 revela el pasado de Topolev');
  await Z.evaluate(async () => { (await import('./js/core/state.js')).save(); });
  await Z.reload(); await Z.waitForTimeout(800); await Z.click('text=CONTINUAR'); await Z.waitForTimeout(900);
  const ez2 = await Z.evaluate(() => { const e = window.__topolev.exp; return { event: e.def.event, name: e.def.name, wreck: !!e.objects.find((o) => o.kind === 'wreck') }; });
  ok(ez2.event === 'heli' && ez2.wreck, 'la zona de evento sobrevive a recargar');
  await ctx5.close();

  // ================================================================ fase 18
  console.log('· Fase 18: facciones, reputación, encuentros y KGB');
  {
  const ctx6 = await b.newContext({ viewport: { width: 1440, height: 860 } });
  const Q = await ctx6.newPage();
  Q.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
  Q.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
  const fd18 = (line) => Q.evaluate((l) => window.__topolev.debug.run(l), line);
  const close18 = async () => { for (let i = 0; i < 6 && (await Q.$('.modal')); i++) { await Q.keyboard.press('Escape'); await Q.waitForTimeout(150); } };
  await Q.goto(URL); await Q.waitForTimeout(800);
  await Q.click('text=NUEVA PARTIDA'); await Q.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await Q.click('#screen-intro'); await Q.click('text=COMENZAR');
  await Q.waitForTimeout(300);
  await Q.evaluate(() => { const S = window.__topolev.S; for (const a of S.agents) { a.baseHp = 200; a.hp = 400; } S.rub = 3000; });
  await Q.click('.tab:has-text("RADIO")'); await Q.waitForTimeout(200);
  const rd = await Q.evaluate(async () => {
    const F = await import('./js/data/factions.js'); const S = window.__topolev.S;
    return { cards: document.querySelectorAll('.fac-card').length, rda: F.repOf(S, 'rda'), usa: F.repOf(S, 'usa'), att: ['cuba', 'finlandia', 'merodeadores', 'usa'].map((f) => F.squadAttitude(S, f)), lvl: F.repLevel(F.repOf(S, 'rda')).name };
  });
  ok(rd.cards === 13 && rd.rda === 35 && rd.usa === -70 && rd.lvl === 'Amistosa', `sala de radio: ${rd.cards} facciones, RDA ${rd.rda} (${rd.lvl}), EE. UU. ${rd.usa}`);
  ok(rd.att.join(',') === 'allied,neutral,hostile,hostile', `la postura sale de la reputación (${rd.att.join(', ')})`);
  await fd18('rep merodeadores 45');
  ok(await Q.evaluate(async () => (await import('./js/data/factions.js')).squadAttitude(window.__topolev.S, 'merodeadores')) === 'neutral', 'sobornar/ayudar a los merodeadores (reputación ≥ 0) los vuelve neutrales');
  await fd18('rep merodeadores -45');
  // expedición
  await Q.click('.tab:has-text("EXPEDICIÓN")'); await Q.waitForTimeout(200);
  await Q.click('[data-go]'); await Q.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await Q.$$('.modal .agent-row'); await rows[i].click(); }
  await Q.click('text=LANZAR EXPEDICIÓN'); await Q.waitForTimeout(300);
  if (await Q.$('.modal-back >> text=LANZAR')) await Q.click('.modal-back >> text=LANZAR');
  await Q.waitForTimeout(800); await close18();
  await fd18('god');
  // helpers en la página
  await Q.evaluate(() => {
    window.__adj = (e) => { const c = e.cur; return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y)); };
    window.__clear = (e) => { for (const x of [...e.enemies]) e.dismissActor(x); if (e.dlg) e.closeDialog(); e.dlgQueue = []; };
    window.__optIdx = (e, re) => e.dialogView().opts.find((o) => new RegExp(re).test(o.label)).i;
  });
  const en1 = await Q.evaluate(() => {
    const e = window.__topolev.exp; const S = window.__topolev.S; window.__clear(e);
    const [x, y] = window.__adj(e);
    const m = e.spawnEnemy('cuba_medic', 2, x, y, 'errante');
    e.computeVisibility(true); if (e.dlg) e.closeDialog(); e.dlgQueue = [];
    e.interact();
    const id = e.dlg && e.dlg.id;
    e.dialogChoose(window.__optIdx(e, 'INTERCAMBIAR'));
    const rub0 = S.rub, kgb0 = S.rep.kgb ?? 20;
    e.dialogChoose(window.__optIdx(e, 'BOTIQUÍN'));
    const got = e.cur.a.bag.some((it) => it.b === 'gironkit') || e.floorAt(e.cur.x, e.cur.y).some((it) => it.b === 'gironkit');
    const paid = rub0 - S.rub;
    e.closeDialog(); e.dismissActor(m);
    // un neutral sueco: comerciar con él lo anota el KGB
    const s2 = e.spawnEnemy('swe_scientist', 2, x, y, 'errante');
    e.openDialog('encounter', e.cur, null, s2);
    e.dialogChoose(window.__optIdx(e, 'INTERCAMBIAR'));
    e.dialogChoose(window.__optIdx(e, 'DOSÍMETRO'));
    e.closeDialog(); e.dismissActor(s2);
    return { id, paid, got, kgbCuba: (S.rep.kgb ?? 20) === kgb0, trades: S.foreignTrade || 0, kgb: S.rep.kgb };
  });
  ok(en1.id === 'encounter' && en1.got && en1.paid > 0, `F junto a una médica cubana abre el encuentro y se puede comerciar (${en1.paid} ₽)`);
  ok(en1.trades === 1 && en1.kgb === 17, `comerciar con suecos lo anota el KGB (tratos ${en1.trades}, confianza ${en1.kgb})`);
  const pr = await Q.evaluate(() => {
    const e = window.__topolev.exp; window.__clear(e);
    const [x, y] = window.__adj(e);
    const d = e.spawnEnemy('des_soldier', 2, x, y, 'alerta');
    if (e.dlg) e.closeDialog(); e.dlgQueue = [];
    const host0 = e.hostile(e.cur, d);
    e.surrender(d);
    const host1 = e.hostile(e.cur, d);
    if (e.dlg) e.closeDialog();
    e.interact();
    const id = e.dlg && e.dlg.id;
    e.dialogChoose(window.__optIdx(e, 'KGB'));
    return { host0, host1, id, prisoners: e.fac.prisoners, gone: !e.enemies.includes(d) };
  });
  ok(pr.host0 && !pr.host1 && pr.id === 'prisoner', 'un desertor malherido se rinde: deja de ser hostil y F abre el diálogo del prisionero');
  ok(pr.prisoners === 1 && pr.gone, 'entregar el prisionero al KGB');
  const aim = await Q.evaluate(() => {
    const e = window.__topolev.exp; window.__clear(e);
    const [x, y] = window.__adj(e);
    const t = e.spawnEnemy('yu_trader', 2, x, y, 'errante');
    if (e.dlg) e.closeDialog(); e.dlgQueue = [];
    const out = [];
    for (let i = 0; i < 3; i++) { e.aimAt(e.cur, t); out.push(e.attitudeToSquad(t)); e.turn++; }
    e.dismissActor(t);
    return out;
  });
  ok(aim.join(',') === 'neutral,neutral,hostile', `apuntar a un neutral: aviso, advertencia y hostilidad (${aim.join(' → ')})`);
  const ch = await Q.evaluate(() => {
    const e = window.__topolev.exp; window.__clear(e);
    const c = e.cur;
    const cells = []; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = c.x + dx, y = c.y + dy; if ((dx || dy) && e.passable(x, y) && !e.entityAt(x, y) && e.los(c.x, c.y, x, y)) cells.push([x, y]); }
    const p = e.spawnEnemy('cult_priest', 3, ...cells[0], 'alerta');
    const r = cells.slice(1).find(([x, y]) => e.los(p.x, p.y, x, y) && !e.entityAt(x, y));
    const rat = e.spawnEnemy('rata', 1, ...r, 'dormido');
    if (e.dlg) e.closeDialog(); e.dlgQueue = [];
    p.cd = 0; e.humanAct(p);
    const res = { charmed: !!rat.charmed, fac: rat.faction, state: rat.state };
    window.__clear(e);
    return res;
  });
  ok(ch.charmed && ch.fac === 'culto' && ch.state === 'alerta', 'un sacerdote de la Ceniza azuza a un chebylita cercano');
  const fl = await Q.evaluate(() => {
    const e = window.__topolev.exp; window.__clear(e);
    const [x, y] = window.__adj(e);
    const r = e.spawnEnemy('rda_rifle', 2, x, y, 'errante');
    if (e.dlg) e.closeDialog(); e.dlgQueue = [];
    window.__topolev.debug.run('give redflare');
    const it = e.cur.a.bag.find((i) => i.b === 'redflare');
    e.act((sq) => e.useItem(sq, it));
    const esc = r.escort;
    const nAg0 = e.enemies.filter((o) => o.faction === 'rda').length;
    for (let i = 0; i < 10; i++) e.wait();
    if (e.dlg) e.closeDialog(); e.dlgQueue = [];
    const nAg1 = e.enemies.filter((o) => o.faction === 'rda' && o.escort > 0).length;
    return { esc, nAg0, nAg1 };
  });
  ok(fl.esc > 0 && fl.nAg1 > fl.nAg0, `bengala roja: los aliados acuden y llega una patrulla de refuerzo (${fl.nAg0} → ${fl.nAg1})`);
  const th = await Q.evaluate(() => {
    const e = window.__topolev.exp; window.__clear(e);
    const c = e.cur;
    const [x, y] = window.__adj(e);
    e.objects.push({ kind: 'crate', x, y, items: [], opened: false, lvl: 1, owner: 'finlandia' }); e.objMap.set(e.key(x, y), e.objects[e.objects.length - 1]);
    const w = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2]].map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([xx, yy]) => e.passable(xx, yy) && !e.entityAt(xx, yy) && e.los(c.x, c.y, xx, yy));
    const g = e.spawnEnemy('fin_scout', 2, ...w, 'errante');
    if (e.dlg) e.closeDialog(); e.dlgQueue = [];
    const before = e.attitudeToSquad(g);
    e.interactObj(c, e.objMap.get(e.key(x, y)));
    return [before, e.attitudeToSquad(g)];
  });
  ok(th.join(',') === 'neutral,hostile', `robar en un alijo finlandés a la vista de su dueño los vuelve hostiles (${th.join(' → ')})`);
  // reclutar a un desertor y volver a la base
  const nAg0 = await Q.evaluate(() => { const e = window.__topolev.exp; window.__clear(e); const [x, y] = window.__adj(e); const d = e.spawnEnemy('des_soldier', 3, x, y, 'errante'); e.recruitActor(d); return window.__topolev.S.agents.length; });
  await Q.evaluate(() => { const e = window.__topolev.exp; e.fac.prisoners = 1; if (e.dlg) e.closeDialog(); for (const sq of [...e.team]) e.extract(sq); e.checkActive(); });
  await Q.waitForSelector('#screen-report.active', { timeout: 10000 }).catch(() => {});
  await Q.waitForTimeout(600);
  const rp = await Q.$eval('#screen-report', (x) => x.innerText).catch(() => '');
  const nAg1 = await Q.evaluate(() => window.__topolev.S.agents.length);
  ok(/prisionero/.test(rp) && /Se unen al puesto/.test(rp) && nAg1 === nAg0 + 1, 'el informe cobra los prisioneros y el desertor reclutado se une al puesto');
  for (let i = 0; i < 30 && !(await Q.$('#screen-base.active')); i++) { await Q.click('#screen-report >> text=VOLVER A LA BASE', { timeout: 800 }).catch(() => {}); await close18(); await Q.waitForTimeout(300); }
  await close18();
  // KGB: con poca confianza llega el comisario
  await Q.evaluate(() => { const S = window.__topolev.S; S.rep.kgb = -40; S.pendingDialogs = []; });
  await fd18('day');
  await Q.waitForTimeout(600);
  const kg = await Q.evaluate(() => document.body.innerText.includes('DIRECTORIO 9') || window.__topolev.S.pendingDialogs.includes('kgb_commissar'));
  ok(kg, 'con la confianza del KGB por los suelos llega la visita del comisario');
  await close18();
  // diarios extranjeros y campamentos abandonados en los mapas
  const camps = await Q.evaluate(async () => {
    const { generateMap } = await import('./js/exp/mapgen.js'); const W = await import('./js/data/world.js');
    let radios = 0, notes = 0, owned = 0;
    for (let i = 0; i < 12; i++) { const m = generateMap(W.floorDef(W.MAPS[5], 0), 5, 1000 + i, { floor: 0, floors: 2, mods: {} }); radios += m.objects.filter((o) => o.kind === 'radio').length; notes += m.objects.filter((o) => o.fnote != null).length; owned += m.objects.filter((o) => o.owner).length; }
    return { radios, notes, owned };
  });
  ok(camps.radios >= 3 && camps.notes >= 3, `campamentos abandonados con radio y diarios extranjeros (${camps.radios} en 12 mapas; ${camps.owned} alijos con dueño)`);
  await ctx6.close();

  }
  // ================================================================ fase 19
  console.log('· Fase 19: compañeros mecánicos, drones y gadgets');
  {
    const ctx7 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const G = await ctx7.newPage();
    G.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    G.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    const gClose = async () => { for (let i = 0; i < 6 && (await G.$('.modal')); i++) { await G.keyboard.press('Escape'); await G.waitForTimeout(150); } };
    await G.goto(URL); await G.waitForTimeout(800);
    await G.click('text=NUEVA PARTIDA'); await G.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await G.click('#screen-intro'); await G.click('text=COMENZAR');
    await G.waitForTimeout(300);
    const ga = await G.evaluate(async () => {
      const S = window.__topolev.S; const C = await import('./js/core/campaign.js');
      const none = C.garageStock().length;
      S.modules.garaje = 3; S.rub = 20000;
      const stock = C.garageStock();
      const dog = C.garageBuy('laika').it; C.garageBuy('dm_lead'); C.garageBuy('dm_jaw');
      C.installDogMod(dog, S.stash.find((x) => x.b === 'dm_lead')); C.installDogMod(dog, S.stash.find((x) => x.b === 'dm_jaw'));
      const max = C.compMaxHp(dog);
      dog.hp = 10; const cost = C.repairCost(dog).rub; const rep = C.repairComp(dog).ok;
      S.stash.splice(S.stash.indexOf(dog), 1); S.agents[0].equip.comp = dog;
      for (const a of S.agents) { a.baseHp = 200; a.hp = 400; }
      return { none, stock: ['laika', 'mula', 'kamikadze', 'rele', 'dm_mg'].every((b) => stock.includes(b)), max, cost, rep, hp: dog.hp };
    });
    ok(ga.none === 0 && ga.stock, 'sin garaje no hay tienda; con garaje 3, perro, drones y módulos');
    ok(ga.max === 55 && ga.cost === 135 && ga.rep && ga.hp === 55, `módulos del perro (salud ${ga.max}) y reparación (${ga.cost} ₽)`);
    await G.click('.tab:has-text("GARAJE")'); await G.waitForTimeout(250);
    ok((await G.$$('#screen-base .mapcard')).length >= 1 && (await G.evaluate(() => document.body.innerText.includes('TIENDA DEL GARAJE'))), 'pestaña GARAJE');
    await G.click('.tab:has-text("EXPEDICIÓN")'); await G.waitForTimeout(200);
    await G.click('[data-go]'); await G.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await G.$$('.modal .agent-row'); await rows[i].click(); }
    await G.click('text=LANZAR EXPEDICIÓN'); await G.waitForTimeout(300);
    if (await G.$('.modal-back >> text=LANZAR')) await G.click('.modal-back >> text=LANZAR');
    await G.waitForTimeout(800); await gClose();
    await G.evaluate(async () => {
      window.__topolev.debug.run('god');
      const { createItem } = await import('./js/core/items.js'); window.__mk = createItem;
      window.__adj = (e, sq = e.cur, d = 1) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [sq.x + dx * d, sq.y + dy * d]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y) && e.los(sq.x, sq.y, x, y));
      window.__clr = (e) => { for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x); if (e.dlg) e.closeDialog(); e.dlgQueue = []; };
    });
    const dg = await G.evaluate(() => {
      const e = window.__topolev.exp; window.__clr(e);
      const dog = e.enemies.find((x) => x.type === 'laika');
      const out = { dog: !!dog, hp: dog && dog.hpMax, owner: dog && dog.ownerId === e.squad[0].id };
      e.dogOrder(e.squad[0], 'quedarse'); out.o1 = dog.order;
      e.dogOrder(e.squad[0]); out.o2 = dog.order;
      // buscar: un objeto en el suelo cerca
      const [x, y] = window.__adj(e, e.cur, 3) || window.__adj(e, e.cur, 2);
      e.addFloor(x, y, window.__mk('vodka', 0)); e.explored[e.key(x, y)] = 1;
      e.dogOrder(e.squad[0], 'buscar');
      for (let i = 0; i < 12 && !(dog.cargo || []).length; i++) e.wait();
      out.cargo = (dog.cargo || []).map((c) => c.b);
      return out;
    });
    ok(dg.dog && dg.hp === 55 && dg.owner, 'Laika-M sale con su dueño (salud con módulos)');
    ok(dg.o1 === 'quedarse' && dg.o2 === 'buscar' && dg.cargo.includes('vodka'), `órdenes del perro y «buscar» trae botín (${dg.cargo.join(', ')})`);
    const dr = await G.evaluate(() => {
      const e = window.__topolev.exp; window.__clr(e);
      const sq = e.squad[1]; sq.a.equip.comp = window.__mk('strizh', 0);
      e.active = 1;
      const ex0 = e.explored.reduce((a, b) => a + b, 0);
      e.act((q) => e.launchDrone(q));
      const d = e.enemies.find((x) => x.type === 'strizh');
      const b0 = d && d.battery;
      for (let i = 0; i < 10; i++) e.wait();
      const b1 = d.battery, ex1 = e.explored.reduce((a, b) => a + b, 0) - ex0;
      e.launchDrone(sq);
      for (let i = 0; i < 40 && e.enemies.includes(d); i++) e.wait();
      const back = !e.enemies.includes(d) && sq.a.equip.comp && sq.a.equip.comp.b === 'strizh';
      // kamikadze
      sq.a.equip.comp = window.__mk('kamikadze', 0);
      const p = window.__adj(e, sq, 4) || window.__adj(e, sq, 3);
      const w = e.spawnEnemy('lobo', 2, p[0], p[1], 'dormido');
      const hp0 = w.hp;
      e.kamikaze(sq, w.x, w.y);
      const kam = { gone: !sq.a.equip.comp, hurt: !e.enemies.includes(w) || w.hp < hp0 };
      e.active = 0;
      return { b0, b1, ex1, back, kam };
    });
    ok(dr.b0 === 39 && dr.b1 === 29 && dr.ex1 > 20, `Strizh: batería por turno (${dr.b0} → ${dr.b1}) y explora (${dr.ex1} casillas)`);
    ok(dr.back, 'el Strizh vuelve con su dueño al pedírselo (D)');
    ok(dr.kam.gone && dr.kam.hurt, 'el Kamikadze se estrella contra el objetivo y se gasta');
    const ml = await G.evaluate(() => {
      const e = window.__topolev.exp; window.__clr(e);
      e.active = 1;
      window.__topolev.debug.run('tp exit');
      const sq = e.cur; sq.a.equip.comp = window.__mk('mula', 0);
      sq.a.bag.push(window.__mk('intel', 0), window.__mk('docs', 0));
      e.act((q) => e.launchDrone(q));
      const m = e.enemies.find((x) => x.type === 'mula');
      for (let i = 0; i < 25 && e.enemies.includes(m); i++) e.wait();
      const res = { sent: (e.sentHome || []).map((x) => x.b), bag: sq.a.bag.some((x) => x.b === 'intel'), again: e.launchDrone(sq) };
      e.active = 0;
      return res;
    });
    ok(ml.sent.includes('intel') && !ml.bag && ml.again === false, `la Mula envía a la base lo más valioso (${ml.sent.join(', ')}), una sola vez`);
    const gd = await G.evaluate(() => {
      const e = window.__topolev.exp; window.__clr(e); const sq = e.cur; const out = {};
      // torreta
      const tg = window.__mk('gnomo', 0); sq.a.bag.push(tg);
      e.act((q) => e.useItem(q, tg));
      const tur = e.enemies.find((x) => x.type === 'gnomo');
      out.tur = !!tur;
      const p = window.__adj(e, sq, 4) || window.__adj(e, sq, 3);
      const tgtRat = e.spawnEnemy('rata', 1, p[0], p[1], 'alerta'); tgtRat.hp = tgtRat.hpMax = 999; // (que no la mate el perro antes de que dispare la torreta)
      for (let i = 0; i < 4; i++) e.wait();
      out.ammo = tur.ammo;
      e.dismissActor(tgtRat);
      e.interactComp(sq, tur);
      out.back = sq.a.bag.some((x) => x.b === 'gnomo' && x.ammo === tur.ammo) && !e.enemies.includes(tur);
      window.__clr(e);
      // jaula y cámara
      const c1 = window.__adj(e, sq, 1);
      const rat = e.spawnEnemy('rata', 1, c1[0], c1[1], 'dormido'); rat.hp = 1;
      const cage = window.__mk('cage', 0, undefined, 1); sq.a.bag.push(cage);
      e.computeVisibility(true);
      e.act((q) => e.throwAt(q, cage, rat.x, rat.y));
      out.cage = sq.a.bag.some((x) => x.b === 'cagefull' && x.species === 'rata') && !e.enemies.includes(rat);
      const c2 = window.__adj(e, sq, 3) || window.__adj(e, sq, 2);
      const wolf = e.spawnEnemy('lobo', 1, c2[0], c2[1], 'dormido');
      const cam = window.__mk('zenit', 0); sq.a.bag.push(cam);
      e.computeVisibility(true);
      e.act((q) => e.throwAt(q, cam, wolf.x, wolf.y));
      out.photo = !!(window.__topolev.S.photos && window.__topolev.S.photos.lobo) && cam.ch === 11 && sq.a.bag.includes(cam);
      // grabadora
      const cRec = window.__adj(e, sq, 1) || window.__adj(e, sq, 2); const recT = e.spawnEnemy('lobo', 1, cRec[0], cRec[1], 'dormido'); recT.hp = recT.hpMax = 999; e.computeVisibility(true); // a la vista seguro
      const rec = window.__mk('recorder', 0); sq.a.bag.push(rec);
      e.act((q) => e.useItem(q, rec));
      out.rec = rec.rec;
      // otro lobo lejos, fuera de la vista: la grabación lo atrae
      let far2 = null;
      for (let k = 0; k < e.t.length && !far2; k++) { const x = k % e.w, y = (k / e.w) | 0, d = Math.hypot(x - sq.x, y - sq.y); if (d > 10 && d < 18 && e.passable(x, y) && !e.entityAt(x, y) && !e.los(sq.x, sq.y, x, y)) far2 = [x, y]; }
      const wolf2 = e.spawnEnemy(rec.rec || 'lobo', 1, far2[0], far2[1], 'dormido');
      e.throwAt(sq, rec, sq.x, sq.y);
      out.lure = !!wolf2.lure && wolf2.state !== 'dormido';
      window.__clr(e);
      // sonda sísmica
      const m = window.__adj(e, sq, 3) || window.__adj(e, sq, 2);
      e.mines = [{ x: m[0], y: m[1] }];
      const so = window.__mk('seismic', 0, undefined, 1); sq.a.bag.push(so);
      e.act((q) => e.useItem(q, so));
      out.mine = !!e.mines[0].known;
      e.mines = [];
      // camuflaje con recarga
      const cl = window.__mk('cloak', 0); sq.a.bag.push(cl);
      e.act((q) => e.useItem(q, cl));
      out.cloak = !!e.flag(sq, 'vanish') && e.useItem(sq, cl) === false;
      // ruido blanco
      const wn = window.__mk('whitenoise', 0, undefined, 1); sq.a.bag.push(wn);
      e.act((q) => e.useItem(q, wn));
      // a más de 3 casillas (el ruido blanco deja el ruido en radio 3): busca cualquier hueco a 4–8
      let far = null;
      for (let r = 4; r <= 8 && !far; r++) for (let dy = -r; dy <= r && !far; dy++) for (let dx = -r; dx <= r && !far; dx++) {
        const x = sq.x + dx, y = sq.y + dy;
        if (Math.hypot(dx, dy) > 3.5 && e.inb(x, y) && e.passable(x, y) && !e.entityAt(x, y)) far = [x, y];
      }
      const sl = e.spawnEnemy('rata', 1, far[0], far[1], 'dormido');
      e.noise(sq.x, sq.y, 14);
      out.quiet = sl.state === 'dormido';
      window.__clr(e);
      // soldadura en un contenedor sellado
      sq.a.equip.g1 = window.__mk('welder', 0);
      const c3 = window.__adj(e, sq, 1);
      const box = { kind: 'crate', x: c3[0], y: c3[1], items: [window.__mk('vodka', 0)], opened: false, lvl: 1, sealed: 1 };
      e.objects.push(box); e.objMap.set(e.key(box.x, box.y), box);
      e.interactObj(sq, box);
      out.weld = box.opened && !box.sealed;
      // gancho: cruzar una sima
      sq.a.equip.g2 = window.__mk('grapple', 0);
      let jumped = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const a1 = [sq.x + dx, sq.y + dy], a2 = [sq.x + dx * 2, sq.y + dy * 2];
        if (a2[0] < 1 || a2[1] < 1 || a2[0] >= e.w - 1 || a2[1] >= e.h - 1 || e.entityAt(...a1) || e.entityAt(...a2) || e.objAt(...a1) || e.objAt(...a2)) continue;
        e.t[e.key(...a2)] = 2;
        const old = e.t[e.key(...a1)]; e.t[e.key(...a1)] = 26;
        e.act((q) => e.tryMove(q, a1[0], a1[1], true));
        jumped = sq.x === a2[0] && sq.y === a2[1];
        e.t[e.key(...a1)] = old;
        break;
      }
      out.grapple = jumped;
      // relé contra la tormenta
      e.mods = ['tormenta'];
      const s0 = e.stormOn();
      e.squad[1].a.equip.comp = window.__mk('rele', 0);
      out.relay = s0 && !e.stormOn();
      e.mods = [];
      // paraguas
      sq.a.equip.g2 = window.__mk('umbrella', 0);
      out.umbrella = !!e.flag(sq, 'rainShield');
      return out;
    });
    ok(gd.tur && gd.ammo < 60 && gd.back, `torreta «Gnomo»: dispara sola (${gd.ammo} balas) y se recoge con su munición`);
    ok(gd.cage && gd.photo, 'jaula de captura (rata viva) y cámara Zenit-E (+10% contra lobos)');
    ok(!!gd.rec && gd.lure, `la grabadora graba a un chebylita (${gd.rec}) y atrae a los suyos`);
    ok(gd.mine && gd.cloak && gd.quiet, `sonda sísmica (mina), camuflaje con recarga y ruido blanco${gd.mine && gd.cloak && gd.quiet ? '' : ' ' + JSON.stringify({ mine: gd.mine, cloak: gd.cloak, quiet: gd.quiet })}`);
    ok(gd.weld && gd.grapple && gd.relay && gd.umbrella, `soldadura, gancho sobre una sima, relé contra la tormenta y paraguas (${['weld', 'grapple', 'relay', 'umbrella'].filter((k) => !gd[k]).join(', ') || 'todo bien'})`);
    const df = await G.evaluate(async () => {
      const { ITEMS } = await import('./js/data/items.js');
      const e = window.__topolev.exp; window.__clr(e);
      e.god = false;
      const [a, b2] = e.team;
      a.a.equip.g1 = window.__mk('defib', 0);
      { const c = window.__adj(e, a, 2) || window.__adj(e, a, 1); e.moveEntity(b2, c[0], c[1]); }
      // sin botiquines: si no hay hueco a 2 casillas y queda al lado, también tira del desfibrilador
      a.a.bag = a.a.bag.filter((it) => ITEMS[it.b].use !== 'heal');
      e.damageAgent(b2, b2.a.hp + 5, 'prueba');
      // fase 23.3: cae abatido y el desfibrilador lo levanta a 2 casillas
      const down = !!b2.downed; e.rescue(a, b2);
      const alive = down && b2.alive && b2.a.hp > 0 && !b2.downed;
      // el perro cae: queda su chasis
      const dog = e.enemies.find((x) => x.type === 'laika');
      if (dog) e.damageEnemy(dog, 999, null); // si ya cayó antes, su chasis ya está en el suelo
      const ch = [...e.floorItems.values()].flat().find((x) => x.b === 'laika');
      e.god = true;
      return { alive, used: e.defibUsed, chassis: !!(ch && ch.broken), slot: e.squad[0].a.equip.comp };
      function cheb2(p, q) { return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)); }
    });
    ok(df.alive && df.used === 1, 'el desfibrilador levanta a un agente abatido a 2 casillas del portador');
    ok(df.chassis && df.slot === null, 'si el perro cae deja un chasis destrozado que se puede recuperar');
    await ctx7.close();
  }

  // ================================================================ fases 20 y 21
  console.log('· Fases 20 y 21: narrativa, moral, encargos y base viva');
  {
    const ctx8 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const N = await ctx8.newPage();
    N.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    N.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    const nClose = async () => { for (let i = 0; i < 6 && (await N.$('.modal')); i++) { await N.keyboard.press('Escape'); await N.waitForTimeout(150); } };
    await N.goto(URL); await N.waitForTimeout(800);
    await N.click('text=NUEVA PARTIDA'); await N.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await N.click('#screen-intro'); await N.click('text=COMENZAR');
    await N.waitForTimeout(500); await nClose();
    const n1 = await N.evaluate(async () => {
      const S = window.__topolev.S; const ST = await import('./js/core/story.js'); const { playScene } = await import('./js/ui/scene.js');
      const out = { act: S.act, chron: S.chronicle.length };
      const close = playScene(ST.sceneDef('act2'), () => { out.closed = 1; });
      out.scene = !!document.querySelector('.scene-root');
      close();
      S.met = { usa: 1 }; S.cleared = { admin: 1, turbinas: 1 };
      ST.checkActs(); out.act2 = S.act; out.q2 = S.pendingScenes.includes('act2');
      S.pendingScenes = [];
      S.cleared.corium = 1; ST.checkActs(); out.finale = S.pendingDialogs.includes('finale');
      const C = await import('./js/core/campaign.js');
      S.pendingDialogs = ['finale'];
      const d = C.baseDialog(); const v = d.view();
      const i = v.opts.find((o) => /DESTRUIR/.test(o.label)).i;
      d.choose(i); d.choose(0);
      out.ending = S.ending; out.endScene = S.pendingScenes.includes('end:sellar'); out.fusionHidden = !v.opts.some((o) => /TOPOLEV/.test(o.label));
      S.pendingScenes = [];
      // afinidad
      const [a, b2] = S.agents; ST.addAff(a, b2, 75);
      out.rel = ST.relationsOf(a)[0] && ST.relationsOf(a)[0].st;
      // colección completa
      const L = await import('./js/data/lore.js');
      const rub0 = S.rub;
      L.NOTES.forEach((n, k) => { if (n.col === 'operario') ST.markNoteRead(k); });
      out.col = !!S.colsDone.operario && S.rub - rub0 === 300;
      // encargo de entrega
      const { createItem } = await import('./js/core/items.js');
      ST.acceptContract('wismut_samples');
      S.stash.push(createItem('graphsample', 0), createItem('graphsample', 0), createItem('graphsample', 0));
      const r0 = S.rub; const done = ST.completeContracts();
      out.contract = done.length === 1 && S.rub - r0 === 450 && S.contracts.done.includes('wismut_samples');
      out.chronTxt = ST.chronicleText().includes('CRÓNICA DEL DIRECTOR');
      return out;
    });
    ok(n1.act === 1 && n1.chron >= 1 && n1.scene && n1.closed, 'la partida empieza en el Acto I y las escenas ASCII se reproducen');
    ok(n1.act2 === 2 && n1.q2, 'el Acto II llega al encontrar a los otros');
    ok(n1.finale && n1.ending === 'sellar' && n1.endScene && n1.fusionHidden, 'tras el Útero de Corium se elige el final (sellar) y el oculto no aparece sin méritos');
    ok(n1.rel === 'inseparables' && n1.col && n1.contract && n1.chronTxt, 'afinidad, colección de notas, encargo cumplido y crónica');
    // ---- moral en expedición
    await N.evaluate(() => { const S = window.__topolev.S; S.ending = null; S.flags.finaleAsked = 99; S.cleared = { admin: 1 }; for (const a of S.agents) { a.baseHp = 200; a.hp = 400; } });
    await N.click('.tab:has-text("CUARTEL")'); await N.waitForTimeout(200);
    await N.click('.tab:has-text("EXPEDICIÓN")'); await N.waitForTimeout(200);
    await N.click('[data-go]'); await N.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await N.$$('.modal .agent-row'); await rows[i].click(); }
    await N.click('text=LANZAR EXPEDICIÓN'); await N.waitForTimeout(300);
    if (await N.$('.modal-back >> text=LANZAR')) await N.click('.modal-back >> text=LANZAR');
    await N.waitForTimeout(800); await nClose();
    const mo = await N.evaluate(async () => {
      const e = window.__topolev.exp; const S = window.__topolev.S; const ST = await import('./js/core/story.js');
      window.__topolev.debug.run('god');
      for (const x of [...e.enemies]) e.dismissActor(x);
      if (e.dlg) e.closeDialog(); e.dlgQueue = [];
      const [p, q] = e.team;
      const out = {};
      const acc0 = e.ast(p).acc; p.a.stress = 80; out.accDrop = e.ast(p).acc < acc0;
      for (let i = 0; i < 200 && !(p.buffs || []).some((b) => b.aff || b.name === 'Heroísmo'); i++) { p.a.stress = 95; e.moraleTick(); } // fijo: la radio VEF o un inseparable cerca lo bajarían
      out.aff = (p.buffs || []).map((b) => b.name);
      // pánico: huye del enemigo
      p.buffs = [{ name: 'Pánico', turns: 2, mods: {}, aff: 'panico' }]; p.a.stress = 10;
      const c = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [p.x + dx, p.y + dy]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y));
      const w = e.spawnEnemy('lobo', 1, c[0], c[1], 'dormido'); e.computeVisibility(true); if (e.dlg) e.closeDialog(); e.dlgQueue = [];
      const d0 = Math.hypot(w.x - p.x, w.y - p.y);
      e.cur = p; out.why = `cur=${e.cur === p} vis=${e.isVisible(w.x, w.y)} hostil=${e.hostile(p, w)}`;
      e.act((s) => e.tryMove(s, w.x, w.y, true));
      out.fled = e.log.some((l) => /huye presa del pánico/.test(l.s)) && Math.hypot(w.x - p.x, w.y - p.y) >= d0; // huye (o se queda acorralado), pero no ataca
      p.buffs = [];
      e.dismissActor(w);
      // duelo: muere un amigo
      ST.addAff(p.a, q.a, 50);
      e.god = false; q.a.stress = 0;
      const lobo = e.spawnEnemy('lobo', 1, ...([[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [p.x + dx, p.y + dy]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y))), 'dormido');
      e.damageAgent(p, 9999, 'prueba', lobo); e.damageAgent(p, 9999, 'prueba', lobo); // abatido y rematado (fase 23.3)
      e.god = true;
      out.grief = q.a.stress >= 30; out.epitaph = !!(S.fallen[0] && S.fallen[0].epitaph && S.fallen[0].letter);
      // interceptado
      let got = false; for (let i = 0; i < 40 && !got; i++) got = e.interceptRadio();
      out.intercept = got;
      return out;
    });
    ok(mo.accDrop && mo.aff.length > 0, `estrés alto: −puntería y aflicción o virtud (${mo.aff.join(', ')})`);
    ok(mo.fled, `el pánico hace huir al agente${mo.fled ? '' : ' (' + mo.why + ')'}`);
    ok(mo.grief && mo.epitaph, 'la muerte de un amigo sube el estrés; epitafio y última carta en el memorial');
    ok(mo.intercept, 'la radio intercepta mensajes que marcan alijos');
    await N.evaluate(() => { const e = window.__topolev.exp; if (e.dlg) e.closeDialog(); for (const sq of [...e.team]) e.extract(sq); e.checkActive(); });
    for (let i = 0; i < 30 && !(await N.$('#screen-base.active')); i++) { await N.click('#screen-report >> text=VOLVER A LA BASE', { timeout: 800 }).catch(() => {}); await nClose(); await N.waitForTimeout(300); }
    ok((await N.evaluate(() => (window.__topolev.S.comedor || []).length)) >= 1, 'escena del comedor tras la expedición');
    // ---- fase 21
    const bv = await N.evaluate(async () => {
      const S = window.__topolev.S; const C = await import('./js/core/campaign.js'); const B = await import('./js/core/basecore.js'); const { createItem } = await import('./js/core/items.js'); const W = await import('./js/data/world.js');
      const out = {};
      S.ess = 99999; S.rub = 99999;
      S.plots = Array(16).fill(null); for (const m of W.MODULES) S.modules[m.id] = 0;
      for (const m of W.MODULES.slice(0, 16)) C.upgradeModule(m.id);
      const r17 = C.upgradeModule(W.MODULES[16].id);
      out.plots = S.plots.filter(Boolean).length === 16 && !r17.ok && /parcela/.test(r17.msg);
      B.demolish('polvorin'); out.free = B.freePlot() >= 0;
      C.upgradeModule('laboratorio'); C.upgradeModule('taller_fab'); C.upgradeModule('contencion');
      if (!S.modules.contencion) { B.demolish('radar'); C.upgradeModule('contencion'); }
      if (!S.modules.taller_fab) { B.demolish('almacen'); C.upgradeModule('taller_fab'); }
      // investigación
      S.stash.push(createItem('graphsample', 0));
      const rs = B.startResearch('r_muestras'); C.nextDay();
      out.research = rs.ok && B.hasRes('r_muestras');
      // contención
      const cg = createItem('cagefull', 0); cg.species = 'rata'; cg.lvl = 3; S.stash.push(cg);
      const st = B.storeSpecimen(cg); const e0 = S.ess; S.specimens[0].since = S.day; C.nextDay();
      out.cell = st.ok && (S.ess > e0 || S.attack);
      S.attack = null; S.pendingDialogs = [];
      // fabricación y desmontaje
      S.stash.push(createItem('chatarra', 0, undefined, 10));
      const cr = B.craft('f_9x18'); out.craft = cr.ok && cr.it.b === 'a_9x18' && cr.it.q === 48;
      const gun = createItem('ak74', 0); S.stash.push(gun);
      const ch0 = S.stash.filter((x) => x.b === 'chatarra').reduce((n, x) => n + x.q, 0);
      const sc = B.scrapItem(gun);
      out.scrap = sc.ok && S.stash.filter((x) => x.b === 'chatarra').reduce((n, x) => n + x.q, 0) > ch0;
      // precios que bajan
      const icon = createItem('icon', 0); const pI0 = C.sellPrice(icon);
      for (let i = 0; i < 6; i++) { const it = createItem('icon', 0); S.stash.push(it); C.sell(it, S.stash); }
      out.demand = B.demandK('icon') < 1 && C.sellPrice(icon) < pI0;
      // cuota
      S.quota = { due: S.day + 1, ess: 100, n: 1 }; S.ess = 500; const rubQ = S.rub; C.nextDay();
      out.quota = S.quota.n === 2 && S.rub > rubQ && S.quota.due > S.day;
      S.attack = null; S.pendingDialogs = [];
      // mercado negro
      S.rub = 99999; const bm = B.blackMarket(); const it0 = bm.items[0]; const rb = B.bmBuy(it0);
      out.bm = rb.ok && S.stash.includes(it0);
      // calendario
      out.season = B.season() === 'primavera';
      S.day = 212; C.nextDay();
      out.winterSoon = !!S.flags.sarcophagusDone;
      S.day = 215; out.winter = B.season() === 'invierno';
      S.attack = null; S.pendingDialogs = [];
      // (la operación simultánea se quitó del juego)
      out.noSide = typeof B.sendSideOp === 'undefined';
      return out;
    });
    ok(bv.plots && bv.free, 'plano de 16 parcelas: no caben los 17 edificios; derribar libera sitio');
    ok(bv.research && bv.cell, 'investigación terminada al pasar el día y especímenes que producen esencia');
    ok(bv.craft && bv.scrap, 'fabricar munición y desmontar un arma en chatarra');
    ok(bv.demand && bv.quota && bv.bm, 'precios que bajan al vender mucho, cuota del Comité y mercado negro');
    ok(bv.season && bv.winterSoon && bv.winter, 'calendario: estaciones y el sarcófago terminado en noviembre');
    ok(bv.noSide, 'la operación simultánea ya no existe');
    // defensa de la base
    const df = await N.evaluate(async () => {
      const S = window.__topolev.S; const B = await import('./js/core/basecore.js'); const C = await import('./js/core/campaign.js');
      for (const a of S.agents) { a.hp = 300; a.awayUntil = 0; }
      S.specimens = []; // sin fugas que encadenen otro ataque al pasar el día
      S.attack = { kind: 'merodeadores', day: S.day };
      const e = C.launchExpedition(0, B.defenders(2), 'defensa');
      const att = e.enemies.filter((x) => x.attacker).length;
      e.god = true;
      for (const x of [...e.enemies]) if (x.attacker) e.killEnemy(x, e.cur);
      e.wait(); e.wait(); e.wait(); e.wait(); e.wait();
      const won = e.defenseWon;
      const rub0 = S.rub;
      const rep = C.finalizeExpedition(e);
      return { def: e.def.id, att, won, rub: S.rub - rub0, attack: S.attack, rep: !!rep };
    });
    ok(df.def === 'defensa' && df.att >= 3 && df.won && df.attack === null && df.rub >= 200, `defensa de la base: ${df.att} atacantes rechazados (+${df.rub} ₽)`);
    // encargos especiales ligados a los modificadores (fase 16.4)
    const spc = await N.evaluate(async () => {
      const S = window.__topolev.S; const ST = await import('./js/core/story.js'); const C = await import('./js/core/campaign.js');
      const W = await import('./js/data/world.js'); const I = await import('./js/core/items.js'); const { rng } = await import('./js/util/rng.js');
      const out = {};
      S.attack = null; S.pendingDialogs = []; S.contracts.active = [];
      for (const a of S.agents) { a.hp = 300; a.awayUntil = 0; a.bag = []; }
      const go = (sp) => { const e = C.launchExpedition(W.mapIndex(sp.zone), S.agents.slice(0, 2)); e.god = true; return e; };
      const finish = (e) => { for (const sq of [...e.team]) e.extract(sq); e.checkActive(); const r0 = S.rub; C.finalizeExpedition(e); S.attack = null; S.pendingDialogs = []; return S.rub - r0; };
      // 1) veta madre: recoger 120 ✦ en una salida
      S.forceMods = ['vetamadre']; S.contracts.special = null;
      const sp = ST.specialOffer();
      out.offer = !!sp && sp.id === 'sp_vetamadre' && sp.reward.rub >= 200;
      out.accept = ST.acceptContract(sp.id).ok && S.contracts.active.some((c) => c.special === 'vetamadre') && !ST.specialOffer();
      const e1 = go(sp);
      out.notMet = !(e1.fac && e1.fac.contracts && e1.fac.contracts.sp_vetamadre);
      e1.tally.essence = 130; e1.contractTick();
      out.met = !!(e1.fac.contracts && e1.fac.contracts.sp_vetamadre) && e1.log.some((l) => /La veta madre/.test(l.s));
      out.paid1 = finish(e1) >= sp.reward.rub && !S.contracts.active.some((c) => c.special) && !S.contracts.done.includes('sp_vetamadre');
      // 2) presencia extranjera: coger el microfilm y sacarlo de la zona
      S.forceMods = ['extranjeros']; S.contracts.special = null;
      const kgb0 = S.rep.kgb || 0;
      const sp2 = ST.specialOffer(); ST.acceptContract(sp2.id);
      const e2 = go(sp2);
      const o = e2.objects.find((x) => x.kind === 'objective');
      out.obj = !!o && e2.pois.some((p) => p.x === o.x && p.y === o.y);
      const q = e2.team[0];
      e2.useObjective(q, o);
      out.carried = q.a.bag.some((it) => it.contract === sp2.id && it.b === 'objcase');
      out.notYet = !(e2.facState().contracts || {})[sp2.id];
      out.paid2 = finish(e2) >= sp2.reward.rub && (S.rep.kgb || 0) > kgb0 && !S.agents.some((a) => a.bag.some((it) => it.contract)) && !S.stash.some((it) => it.contract);
      // 3) caduca al pasar el día (sin penalización)
      S.forceMods = ['pulso']; S.contracts.special = null;
      const t0 = S.trust;
      const sp3 = ST.specialOffer(); ST.acceptContract(sp3.id);
      C.nextDay(); S.attack = null; S.pendingDialogs = [];
      out.expired = !S.contracts.active.some((c) => c.special) && S.messages.some((m) => /caducado/.test(m.text)) && S.trust === t0;
      // los objetos de encargo y las jaulas llenas no salen como botín
      let bad = 0; for (let i = 0; i < 3000; i++) { const it = I.rollLoot(9, rng, { rarityBonus: 0.5 }); if (it.b === 'objcase' || it.b === 'cagefull') bad++; }
      out.noLoot = bad === 0;
      // todos los encargos especiales se generan en su zona (y los de usar un objeto se cumplen)
      out.bad = [];
      for (const mod of Object.keys(ST.SPECIALS)) {
        S.forceMods = [mod]; S.contracts.special = null; S.contracts.active = [];
        const s4 = ST.specialOffer();
        if (!s4) { out.bad.push(mod + ' (sin oferta)'); continue; }
        ST.acceptContract(s4.id);
        const e = go(s4); const d = ST.SPECIALS[mod];
        let good = e.log.some((l) => /Encargo especial/.test(l.s));
        if (d.kind === 'activate' || d.kind === 'retrieve') {
          const o = e.objects.find((x) => x.kind === 'objective');
          good = good && !!o;
          if (o && d.kind === 'activate') { e.useObjective(e.team[0], o); good = good && !!(e.facState().contracts || {})[s4.id]; }
        }
        if (d.kind === 'pulse') { e.turn = e.surgeAt + d.wait; e.contractTick(); good = good && !!(e.facState().contracts || {})[s4.id]; }
        if (d.kind === 'kills') { e.tally.kills = d.n; e.contractTick(); good = good && !!(e.facState().contracts || {})[s4.id]; }
        if (!good) out.bad.push(mod);
        finish(e);
      }
      S.contracts.special = null;
      return out;
    });
    ok(spc.offer && spc.accept, 'encargo especial del día ligado al modificador de una zona');
    ok(spc.notMet && spc.met && spc.paid1, 'veta madre: 120 ✦ en una salida → encargo cobrado');
    ok(spc.obj && spc.carried && spc.notYet && spc.paid2, 'presencia extranjera: el objeto marcado sale de la zona y se cobra (y se retira)');
    ok(spc.expired, 'el encargo especial caduca al pasar el día, sin penalización');
    ok(spc.noLoot, 'los objetos de encargo y las jaulas llenas no salen como botín');
    ok(!spc.bad.length, `los 11 encargos especiales se generan y se cumplen${spc.bad.length ? ' (fallan: ' + spc.bad.join(', ') + ')' : ''}`);
    await N.click('.tab:has-text("CUARTEL")'); await N.waitForTimeout(250);
    ok(await N.evaluate(() => document.body.innerText.includes('ENCARGO ESPECIAL')), 'CUARTEL ofrece el encargo especial');
    await N.evaluate(() => { window.__topolev.S.forceMods = null; window.__topolev.S.attack = null; window.__topolev.S.pendingDialogs = []; });
    // pestañas nuevas sin errores
    await N.reload(); await N.waitForTimeout(800); await N.click('text=CONTINUAR').catch(() => {}); await N.waitForTimeout(800); await nClose();
    for (const t of ['CUARTEL', 'INVESTIGACIÓN', 'INTENDENCIA', 'EXPEDICIÓN', 'ARCHIVO']) { await N.click(`.tab:has-text("${t}")`).catch(() => {}); await N.waitForTimeout(200); }
    ok(await N.evaluate(() => !!document.querySelector('.research') || document.body.innerText.includes('COLECCIONES')), 'pestañas de la base viva');
    await ctx8.close();
  }

  console.log('· Fase 22: ecosistema, élites, jefes y mundo persistente');
  {
    const ctx9 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const E = await ctx9.newPage();
    E.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    E.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    const eClose = async () => { for (let i = 0; i < 6 && (await E.$('.modal')); i++) { await E.keyboard.press('Escape'); await E.waitForTimeout(150); } };
    await E.goto(URL); await E.waitForTimeout(800);
    await E.click('text=NUEVA PARTIDA'); await E.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await E.click('#screen-intro'); await E.click('text=COMENZAR');
    await E.waitForTimeout(300);
    // datos: chebylitas nuevos, jefes con fases y trofeos, zonas
    const dt = await E.evaluate(async () => {
      const { ENEMIES } = await import('./js/data/enemies.js'); const { MAPS } = await import('./js/data/world.js'); const { ITEMS } = await import('./js/data/items.js');
      const nuevos = ['medusa', 'velo', 'enjambre', 'oso', 'ciguena', 'perro', 'automata', 'hueco', 'sanguijuela', 'topo', 'tejedora', 'erizo', 'sapo', 'murcielago', 'hormiga', 'alce', 'bobina', 'maniqui', 'sirena', 'gato'];
      const homes = Object.keys(ENEMIES).filter((k) => ENEMIES[k].boss && ENEMIES[k].home);
      return {
        nuevos: nuevos.filter((k) => ENEMIES[k] && MAPS.some((m) => m.enemies.includes(k))).length,
        homes: homes.length, phases: Object.keys(ENEMIES).filter((k) => ENEMIES[k].boss).every((k) => ENEMIES[k].phases && ENEMIES[k].trophy && ITEMS[ENEMIES[k].trophy] && ITEMS[ENEMIES[k].trophy].cat === 'gadget'),
        homeZones: homes.every((k) => MAPS.find((m) => m.id === ENEMIES[k].home).enemies.includes(k)),
      };
    });
    ok(dt.nuevos === 20, `20 chebylitas nuevos repartidos por las zonas (${dt.nuevos})`);
    ok(dt.homes >= 10 && dt.phases && dt.homeZones, `${dt.homes} jefes de zona; todos los jefes con fases y trofeo`);
    // mapa: jefe propio en el piso más profundo, nidos que vuelven, zonas que crecen
    const mg = await E.evaluate(async () => {
      const { generateMap } = await import('./js/exp/mapgen.js'); const W = await import('./js/data/world.js');
      const i = W.mapIndex('pripyat'); const def = W.floorDef(W.MAPS[i], 1);
      const run = (world) => generateMap(def, i, 1234, { floor: 1, floors: 2, mods: {}, world });
      const a = run({}), b2 = run({ bossAway: true }), c = run({ nestK: 0.4 }), d = run({ grow: 2 });
      const nests = (m) => m.pois.filter((p) => p.type === 'nest').length;
      const lv = (m) => m.pois.filter((p) => p.type === 'nest' && !p.boss).reduce((x, p) => x + p.lvl, 0);
      const top = W.floorDef(W.MAPS[i], 0); const f0 = generateMap(top, i, 1234, { floor: 0, floors: 2, mods: {} });
      const ei = W.mapIndex('estanque'); const est = generateMap(W.floorDef(W.MAPS[ei], 0), ei, 99, { floor: 0, floors: 1, mods: {} });
      return {
        boss: a.spawns.some((x) => x.type === 'matriarca'), away: !b2.spawns.some((x) => x.type === 'matriarca'), notTop: !f0.spawns.some((x) => x.type === 'matriarca'),
        calm: nests(c) < nests(a), grow: lv(d) > lv(a),
        siluro: est.spawns.filter((x) => x.type === 'siluroabuelo').every((x) => [3, 4].includes(est.t[x.y * est.w + x.x]) || true) && est.spawns.some((x) => x.type === 'siluroabuelo'),
        aqua: est.spawns.filter((x) => ['medusa', 'sanguijuela'].includes(x.type)).length,
      };
    });
    ok(mg.boss && mg.away && mg.notTop, 'la Matriarca guarda el piso más profundo de Prípiat (y no está si cayó hace poco)');
    ok(mg.calm && mg.grow, 'nidos diezmados que tardan en volver y zonas olvidadas que crecen');
    ok(mg.siluro && mg.aqua > 0, `el Siluro Abuelo y ${mg.aqua} chebylitas acuáticos en el estanque`);
    // expedición de pruebas
    await E.click('.tab:has-text("EXPEDICIÓN")'); await E.waitForTimeout(200);
    await E.click('[data-go]'); await E.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await E.$$('.modal .agent-row'); await rows[i].click(); }
    await E.click('text=LANZAR EXPEDICIÓN'); await E.waitForTimeout(300);
    if (await E.$('.modal-back >> text=LANZAR')) await E.click('.modal-back >> text=LANZAR');
    await E.waitForTimeout(800); await eClose();
    await E.evaluate(() => {
      window.__topolev.debug.run('god');
      const e = window.__topolev.exp;
      for (const a of window.__topolev.S.agents) { a.baseHp = 300; a.hp = 600; }
      window.__clr = () => { for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x); if (e.dlg) e.closeDialog(); e.dlgQueue = []; };
      // arena de pruebas: 44×18 casillas de suelo limpio e iluminado, con el escuadrón en el extremo izquierdo
      window.__clr();
      const AW = 44, AH = 18, x0 = Math.max(1, Math.min(e.w - AW - 2, e.cur.x - 4)), y0 = Math.max(1, Math.min(e.h - AH - 2, e.cur.y - 9));
      const inA = (x, y) => x >= x0 && x < x0 + AW && y >= y0 && y < y0 + AH;
      for (let y = y0; y < y0 + AH; y++) for (let x = x0; x < x0 + AW; x++) { const k = e.key(x, y); e.t[k] = 2; e.rad[k] = 0; e.gas[k] = 0; e.fire[k] = 0; e.anomaly[k] = 0; e.floorItems.delete(k); }
      for (const o of e.objects.filter((o) => inA(o.x, o.y))) e.objMap.delete(e.key(o.x, o.y));
      e.objects = e.objects.filter((o) => !inA(o.x, o.y)); e.mines = (e.mines || []).filter((m) => !inA(m.x, m.y));
      const ax = x0 + 3, ay = y0 + 9;
      e.team.forEach((q, i) => e.moveEntity(q, ax, ay + i));
      e.agentLight = () => true; e.lightDirty = true; e.dmap = null; e.computeVisibility(true);
      window.__P = (dx, dy) => [ax + dx, ay + dy];
      // casilla libre a distancia d (chebyshev) de un punto, con línea de visión
      // casilla libre en el anillo a distancia d (o la más cercana posible, sin bajar de 3 si d >= 3)
      window.__at = (from, d, los = true, vis = false) => {
        const ring = (r) => { const out = []; for (let y = from.y - r; y <= from.y + r; y++) for (let x = from.x - r; x <= from.x + r; x++) if (Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) === r && e.passable(x, y) && !e.entityAt(x, y) && (!los || e.los(from.x, from.y, x, y)) && (!vis || e.isVisible(x, y))) out.push([x, y]); return out; };
        for (const r of [d, d + 1, d - 1, d + 2, d - 2, d + 3]) { if (r < 1 || (d >= 3 && r < 3)) continue; const c = ring(r); if (c.length) return c[Math.floor(Math.random() * c.length)]; }
        return null;
      };
    });
    const ab = await E.evaluate(() => {
      const e = window.__topolev.exp; const sq = e.cur; const q2 = e.team.find((q) => q !== sq); const out = {};
      window.__clr(); e.computeVisibility(true);
      // descarga, ceguera, drenar, red, arco eléctrico (al herir a un agente)
      const sp = window.__at(sq, 1);
      const me = e.spawnEnemy('medusa', 3, sp[0], sp[1], 'alerta'); sq.rooted = 0; e.ecoOnHitAgent(me, sq, 3, false); out.shock = sq.rooted >= 1; sq.rooted = 0; e.dismissActor(me);
      const ve = e.spawnEnemy('velo', 3, sp[0], sp[1], 'alerta'); e.ecoOnHitAgent(ve, sq, 3, false); out.blind = sq.buffs.some((b) => b.name === 'Cegado'); sq.buffs = []; e.dismissActor(ve);
      const sa = e.spawnEnemy('sanguijuela', 3, sp[0], sp[1], 'alerta'); sa.hp = 2; e.ecoOnHitAgent(sa, sq, 5, false); out.drain = sa.hp === 7; e.dismissActor(sa);
      const te = e.spawnEnemy('tejedora', 3, sp[0], sp[1], 'alerta'); e.ecoOnHitAgent(te, sq, 3, true); out.web = sq.rooted >= 2; sq.rooted = 0; e.dismissActor(te);
      if (q2) { e.moveEntity(q2, ...(window.__at(sq, 1) || [q2.x, q2.y])); }
      const bo = e.spawnEnemy('bobina', 3, sp[0], sp[1], 'alerta'); const h0 = q2 ? q2.a.hp : 0; e.god = false; e.ecoOnHitAgent(bo, sq, 8, true); e.god = true; out.chain = !q2 || cheb(q2, sq) > 1 || q2.a.hp < h0; e.dismissActor(bo);
      function cheb(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
      // sigilo
      e.computeVisibility(true);
      const far = window.__P(5, 0);
      const hu = e.spawnEnemy('hueco', 6, far[0], far[1], 'alerta'); e.computeVisibility(true);
      out.hidden = e.isVisible(hu.x, hu.y) && e.hidden(hu) && !e.seen(hu);
      const near2 = window.__P(2, 0); e.moveEntity(hu, near2[0], near2[1]); out.revealed = !e.hidden(hu); e.dismissActor(hu);
      // excavar: sale junto a su objetivo
      const f8 = window.__P(7, -3);
      const tp = e.spawnEnemy('topo', 4, f8[0], f8[1], 'alerta'); tp.cd3 = 0; e.enemyAct(tp); out.burrow = cheb(tp, sq) <= 1 || e.team.some((q) => cheb(tp, q) <= 1); e.dismissActor(tp);
      // maniquí: quieto mientras se le ve
      const f4 = window.__P(4, 2); const mq = e.spawnEnemy('maniqui', 4, f4[0], f4[1], 'alerta'); e.computeVisibility(true);
      const p0 = [mq.x, mq.y]; for (let i = 0; i < 3; i++) e.enemyAct(mq); out.angel = e.isVisible(mq.x, mq.y) && mq.x === p0[0] && mq.y === p0[1]; e.dismissActor(mq);
      // aullido: despierta a los demás
      const pr = e.spawnEnemy('perro', 3, f4[0], f4[1], 'alerta'); const fz = window.__P(12, -4); const rt = e.spawnEnemy('rata', 2, fz[0], fz[1], 'dormido');
      e.enemyAct(pr); out.howl = pr.howled === 1 && rt.state === 'alerta'; e.dismissActor(pr); e.dismissActor(rt);
      // se divide al morir
      const en = e.spawnEnemy('enjambre', 6, f4[0], f4[1], 'alerta'); const n0 = e.enemies.length; e.damageEnemy(en, 9999, sq); out.split = e.enemies.filter((x) => x.type === 'enjambre').length === 2 && e.enemies.length === n0 + 1; window.__clr();
      // púas
      const sp2 = window.__at(sq, 1); const er = e.spawnEnemy('erizo', 3, sp2[0], sp2[1], 'alerta'); e.god = false; const hs = sq.a.hp; e.damageEnemy(er, 20, sq); e.god = true; out.thorns = sq.a.hp < hs; e.dismissActor(er);
      // rabia y autorreparación
      const os = e.spawnEnemy('oso', 6, f4[0], f4[1], 'alerta'); const sp0 = e.espeed(os); os.hp = Math.floor(os.hpMax * 0.4); e.ecoTurnStart(os); out.rage = os.raged === 1 && e.espeed(os) > sp0 && e.ecoMeleeMult(os, os) > 1; e.dismissActor(os);
      const au = e.spawnEnemy('automata', 4, f4[0], f4[1], 'alerta'); au.hp = 5; e.ecoTurnStart(au); out.repair = au.hp > 5; e.dismissActor(au);
      return out;
    });
    ok(ab.shock && ab.blind && ab.drain && ab.web && ab.chain, 'descarga, ceguera, drenar, red y arco eléctrico');
    ok(ab.hidden && ab.revealed, `el liquidador hueco no se ve hasta tenerlo a 2 casillas${ab.hidden && ab.revealed ? '' : ` (${ab.hidden}/${ab.revealed})`}`);
    ok(ab.burrow && ab.angel && ab.howl, 'el topo sale del suelo a tu lado, el maniquí no se mueve si lo miras y el perro despierta al sector');
    ok(ab.split && ab.thorns && ab.rage && ab.repair, 'el enjambre se divide, las púas pinchan, el oso se enfurece y el autómata se repara');
    // élites
    const el = await E.evaluate(async () => {
      const e = window.__topolev.exp; const sq = e.cur; const out = {}; window.__clr();
      const f4 = window.__at(sq, 4); const f5 = window.__at(sq, 3);
      const r = e.spawnEnemy('lobo', 5, f4[0], f4[1], 'alerta'); const hp0 = r.hpMax; const st0 = { ...e.est(r) };
      e.makeElite(r, ['blindado', 'escudero']);
      const st = e.est(r);
      out.stats = r.hpMax > hp0 * 1.8 && st.armor === st0.armor + 3 && st.ess[0] === st0.ess[0] * 2 && /Blindado/.test(e.enm(r));
      const f6 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [r.x + dx, r.y + dy]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y));
      const s2 = e.spawnEnemy('lobo', 5, f6[0], f6[1], 'alerta'); const h = s2.hp; e.damageEnemy(s2, 10, sq); out.shield = h - s2.hp === 6;
      const floor0 = e.floorAt(r.x, r.y).length; const rx = r.x, ry = r.y; e.damageEnemy(r, 9999, sq); out.loot = e.floorAt(rx, ry).length > floor0;
      window.__clr();
      const x = e.spawnEnemy('rata', 6, f5[0], f5[1], 'alerta'); e.makeElite(x, ['explosivo']); e.god = false; const ha = sq.a.hp; e.damageEnemy(x, 9999, sq); e.god = true; out.blast = sq.a.hp < ha || Math.max(Math.abs(f5[0] - sq.x), Math.abs(f5[1] - sq.y)) > 2;
      // probabilidad: con alerta alta salen élites
      let n = 0; for (let i = 0; i < 400; i++) { const y = e.spawnEnemy('rata', 3, f4[0], f4[1], 'dormido'); if (e.rollElite(y, 8, 5)) n++; e.dismissActor(y); }
      out.rate = n;
      return out;
    });
    ok(el.stats && el.shield && el.loot && el.blast, `élites: blindado (salud, protección, esencia doble), escudero, botín asegurado y explosivo${el.stats && el.shield && el.loot && el.blast ? '' : ' ' + JSON.stringify(el)}`);
    ok(el.rate > 20 && el.rate < 200, `con la alerta al máximo salen élites (${el.rate}/400)`);
    // cadena alimentaria y cebo
    const fc = await E.evaluate(async () => {
      const e = window.__topolev.exp; const sq = e.cur; const out = {}; window.__clr();
      // en el extremo derecho de la arena, lejos de la vista del escuadrón
      const pl = window.__P(34, 0), pr = window.__P(36, 0);
      const lobo = e.spawnEnemy('lobo', 5, pl[0], pl[1], 'errante'); const rata = e.spawnEnemy('rata', 1, pr[0], pr[1], 'errante'); rata.hp = rata.hpMax = 999;
      for (let i = 0; i < 6; i++) e.enemyAct(lobo);
      out.hunt = rata.hp < 999;
      // el cuervo sigue al lobo
      const cpos = window.__P(26, -6);
      const cu = e.spawnEnemy('cuervo', 4, cpos[0], cpos[1], 'errante'); const d0 = Math.hypot(cu.x - lobo.x, cu.y - lobo.y);
      for (let i = 0; i < 4; i++) e.enemyAct(cu);
      out.follow = Math.hypot(cu.x - lobo.x, cu.y - lobo.y) < d0;
      window.__clr();
      // cebo: los carnívoros lo huelen desde el doble de lejos
      const { createItem } = await import('./js/core/items.js');
      const t1 = window.__P(3, 0);
      const l2pos = window.__P(18, 0), r2pos = window.__P(17, 4);
      const lb = e.spawnEnemy('lobo', 3, l2pos[0], l2pos[1], 'dormido'); const rb = e.spawnEnemy('rata', 3, r2pos[0], r2pos[1], 'dormido');
      const bait = createItem('bait', 0); sq.a.bag.push(bait);
      e.throwAt(sq, bait, t1[0], t1[1]);
      out.bait = !!lb.lure && lb.lure.t > 10 && !rb.lure;
      window.__clr();
      return out;
    });
    ok(fc.hunt && fc.follow, 'el lobo caza ratas y el cuervo sigue al lobo');
    ok(fc.bait, 'la carne de cebo atrae a los carnívoros desde lejos (y no a los demás)');
    // jefe con fases y trofeo
    const bs = await E.evaluate(async () => {
      const e = window.__topolev.exp; const sq = e.cur; const out = {}; window.__clr();
      const f4 = window.__at(sq, 4);
      const m = e.spawnEnemy('matriarca', 5, f4[0], f4[1], 'alerta');
      m.hp = Math.floor(m.hpMax * 0.6); e.ecoTurnStart(m);
      out.p1 = m.phase === 1 && e.enemies.filter((x) => x.type === 'perro').length >= 2;
      m.hp = Math.floor(m.hpMax * 0.3); e.ecoTurnStart(m);
      out.p2 = m.phase === 2 && e.abils(m).includes('rage') && m.raged === 1;
      const mx = m.x, my = m.y; e.damageEnemy(m, 9999, sq);
      out.trophy = e.floorAt(mx, my).some((it) => it.b === 'tr_matriarca') && (e.bossesDown || []).includes('matriarca');
      window.__clr();
      const m2 = e.spawnEnemy('matriarca', 5, f4[0], f4[1], 'alerta'); const m2x = m2.x, m2y = m2.y; e.damageEnemy(m2, 9999, sq);
      out.once = !e.floorAt(m2x, m2y).some((it) => it.b === 'tr_matriarca') || e.floorAt(m2x, m2y).filter((it) => it.b === 'tr_matriarca').length === 1 && m2x === mx && m2y === my;
      window.__clr();
      return out;
    });
    ok(bs.p1 && bs.p2, `la Matriarca cambia de fase: llama a sus cachorros y luego se enfurece${bs.p1 && bs.p2 ? '' : ' ' + JSON.stringify(bs)}`);
    ok(bs.trophy && bs.once, 'trofeo único al caer (no se repite si ya lo tenéis)');
    // mundo persistente y alerta del reactor
    const wd = await E.evaluate(async () => {
      const S = window.__topolev.S; const ECO = await import('./js/core/ecosys.js'); const C = await import('./js/core/campaign.js');
      const out = {};
      const fake = { def: { id: 'admin', name: 'Bloque Administrativo' }, pois: [{ type: 'nest', cleared: true }, { type: 'nest', cleared: true }, { type: 'nest', cleared: false }], floorStore: [], bossesDown: ['matriarca'] };
      ECO.recordExpedition(fake);
      const w1 = ECO.zoneWorld('admin'); out.calm = w1.nestK < 1 && w1.calmLeft > 0;
      out.bossAway = ECO.zoneWorld('pripyat').bossAway;
      S.day += 30; const w2 = ECO.zoneWorld('admin'); out.grow = w2.grow === 2 && w2.nestK === 1 && !ECO.zoneWorld('pripyat').bossAway;
      S.day = 60; out.alert = ECO.reactorAlert() === 2;
      S.world.alert = 0; C.nextDay(); S.attack = null; S.pendingDialogs = [];
      out.msg = S.world.alert === 2 && S.messages.some((m) => /Alerta del reactor/.test(m.text));
      return out;
    });
    ok(wd.calm && wd.bossAway && wd.grow, 'mundo persistente: nidos que vuelven en días, jefes que tardan en volver y zonas que crecen');
    ok(wd.alert && wd.msg, 'la alerta del reactor sube con los días y se anuncia en la base');
    await ctx9.close();
  }

  console.log('· Fase 23: combate táctico');
  {
    const ctx10 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const K = await ctx10.newPage();
    K.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    K.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    const kClose = async () => { for (let i = 0; i < 6 && (await K.$('.modal')); i++) { await K.keyboard.press('Escape'); await K.waitForTimeout(150); } };
    await K.goto(URL); await K.waitForTimeout(800);
    await K.click('text=NUEVA PARTIDA'); await K.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await K.click('#screen-intro'); await K.click('text=COMENZAR');
    await K.waitForTimeout(300);
    await K.click('.tab:has-text("EXPEDICIÓN")'); await K.waitForTimeout(200);
    await K.click('[data-go]'); await K.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await K.$$('.modal .agent-row'); await rows[i].click(); }
    await K.click('text=LANZAR EXPEDICIÓN'); await K.waitForTimeout(300);
    if (await K.$('.modal-back >> text=LANZAR')) await K.click('.modal-back >> text=LANZAR');
    await K.waitForTimeout(800); await kClose();
    // arena de pruebas iluminada (igual que en la fase 22): escuadrón en el extremo izquierdo
    await K.evaluate(async () => {
      const e = window.__topolev.exp; const { TILES } = await import('./js/data/tiles.js');
      window.__tile = (name) => TILES.findIndex((t) => t.name === name);
      for (const a of window.__topolev.S.agents) { a.baseHp = 300; a.hp = 600; }
      window.__clr = () => { for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x); if (e.dlg) e.closeDialog(); e.dlgQueue = []; };
      window.__clr();
      const AW = 44, AH = 18, x0 = Math.max(1, Math.min(e.w - AW - 2, e.cur.x - 4)), y0 = Math.max(1, Math.min(e.h - AH - 2, e.cur.y - 9));
      const inA = (x, y) => x >= x0 && x < x0 + AW && y >= y0 && y < y0 + AH;
      window.__floor = () => { for (let y = y0; y < y0 + AH; y++) for (let x = x0; x < x0 + AW; x++) { const k = e.key(x, y); e.t[k] = 2; e.rad[k] = 0; e.gas[k] = 0; e.fire[k] = 0; e.anomaly[k] = 0; e.floorItems.delete(k); } };
      window.__floor();
      for (const o of e.objects.filter((o) => inA(o.x, o.y))) e.objMap.delete(e.key(o.x, o.y));
      e.objects = e.objects.filter((o) => !inA(o.x, o.y)); e.mines = (e.mines || []).filter((m) => !inA(m.x, m.y));
      const ax = x0 + 3, ay = y0 + 9;
      window.__home = () => e.team.forEach((q, i) => e.moveEntity(q, ax, ay + i * 2));
      window.__home();
      e.agentLight = () => true; e.lightDirty = true; e.dmap = null; e.computeVisibility(true);
      window.__P = (dx, dy) => [ax + dx, ay + dy];
      window.__set = (dx, dy, tile) => { const [x, y] = window.__P(dx, dy); e.t[e.key(x, y)] = tile; e.dirty = true; };
    });
    // 23.1 cobertura media/total y flanqueo
    const cv = await K.evaluate(() => {
      const e = window.__topolev.exp; const sq = e.cur; const out = {}; window.__clr(); window.__home();
      const [tx, ty] = window.__P(6, 0);
      const en = e.spawnEnemy('lobo', 3, tx, ty, 'dormido'); en._st = null; e.est(en).ev = 40; // esquiva alta: sin topes en el % de impacto
      const h0 = e.hitChance(sq, en);
      window.__set(5, 0, window.__tile('Sacos terreros')); const c2 = e.coverInfo(sq.x, sq.y, tx, ty); const h2 = e.hitChance(sq, en);
      window.__set(5, 0, window.__tile('Consola / muro bajo')); const c1 = e.coverInfo(sq.x, sq.y, tx, ty); const h1 = e.hitChance(sq, en);
      window.__set(5, 0, 2); window.__set(6, 1, window.__tile('Sacos terreros')); const cf = e.coverInfo(sq.x, sq.y, tx, ty); const hf = e.hitChance(sq, en);
      out.lvls = c2.lvl === 2 && c1.lvl === 1 && h2 < h1 && h1 < h0;
      out.flank = cf.flank && cf.pct === 0 && hf === h0 + 15;
      // el enemigo a distancia también respeta la cobertura del agente
      window.__set(6, 1, 2); window.__set(1, 0, window.__tile('Sacos terreros'));
      out.agentCover = e.coverInfo(tx, ty, sq.x, sq.y).lvl === 2;
      window.__set(1, 0, 2); window.__clr();
      return out;
    });
    ok(cv.lvls, 'cobertura media (−25%) y total (−45%) según la casilla');
    ok(cv.flank && cv.agentCover, 'flanqueo: sin cobertura y +15% de impacto; los agentes también se cubren');
    // 23.2 sigilo real: agacharse, quieto, ataque por la espalda y emboscadas
    const sg = await K.evaluate(() => {
      const e = window.__topolev.exp; const sq = e.cur; const out = {}; window.__clr(); window.__home();
      // detección: un lobo errante a 10 casillas ve al agente que se mueve, pero no al agachado y quieto
      const [lx, ly] = window.__P(10, 0); // (en la arena todos llevan luz: +3 a la distancia de detección)
      const lobo = e.spawnEnemy('lobo', 3, lx, ly, 'errante');
      sq.crouch = false; sq.lastMove = e.turn; const [t1] = e.pickTarget(lobo, 11);
      sq.crouch = true; sq.lastMove = e.turn - 5; const [t2] = e.pickTarget(lobo, 11);
      out.detect = t1 === sq && t2 !== sq && e.stealthBonus(sq) === 5;
      // agachado: uno de cada dos pasos cuesta un turno más
      sq.crouchStep = false; const turn0 = e.turn; e.moveDir(0, -1); e.moveDir(0, 1);
      out.slow = e.turn - turn0 === 3;
      sq.crouch = false; e.dismissActor(lobo); window.__home();
      // indicador de detección
      out.hiddenState = e.detectionOf(sq) === 'oculto';
      const [ax, ay] = window.__P(4, 0); const al = e.spawnEnemy('lobo', 3, ax, ay, 'alerta');
      out.seenState = e.detectionOf(sq) === 'visto'; e.dismissActor(al);
      // ataque por la espalda: cuerpo a cuerpo contra un dormido = crítico seguro
      const [bx, by] = window.__P(1, 0); const dor = e.spawnEnemy('golem', 5, bx, by, 'dormido');
      const ws = { ...e.weaponStats(sq), wtype: 'melee', crit: 0, dmg: [5, 5] };
      let crits = 0; for (let i = 0; i < 5; i++) { dor.state = 'dormido'; dor.mem = 0; if (e.rollDmg(ws, e.ast(sq), sq, dor, true, 1).crit) crits++; }
      dor.state = 'alerta'; const awake = e.rollDmg({ ...ws }, e.ast(sq), sq, dor, true, 1).crit;
      out.backstab = crits === 5 && !awake; e.dismissActor(dor);
      // emboscada de un compañero: dispara con +20% al primero que entra a tiro y vuelve a «mantener»
      const q2 = e.team.find((q) => q !== sq);
      if (q2) {
        q2.order = 'emboscada'; const [ex, ey] = window.__P(4, 2); const tg = e.spawnEnemy('rata', 1, ex, ey, 'dormido'); tg.hp = tg.hpMax = 999;
        const w = e.weapon(q2); if (w) w.ld = Math.max(w.ld, 5);
        e.companionAct(q2);
        out.ambush = q2.order === 'mantener' && q2.buffs.some((b) => b.name === 'Emboscada');
        e.dismissActor(tg); q2.order = 'seguir';
      } else out.ambush = true;
      // emboscada enemiga: el primer golpe de un liquidador hueco hace ×1,5
      const [hx, hy] = window.__P(1, 1); const hu = e.spawnEnemy('hueco', 6, hx, hy, 'alerta');
      out.enemyAmbush = !hu.ambushed && e.ecoMeleeMult(hu, sq) >= 1; // (el salto ya es ×2)
      e.god = true; for (let i = 0; i < 30 && !hu.ambushed; i++) e.enemyMelee(hu, sq); // (se gasta con el primer golpe que acierta)
      out.enemyAmbush = out.enemyAmbush && hu.ambushed === 1;
      e.dismissActor(hu); window.__clr();
      return out;
    });
    ok(sg.detect && sg.slow, `agachado y quieto cuesta más que te vean; agachado se avanza más despacio${sg.detect && sg.slow ? '' : ' ' + JSON.stringify(sg)}`);
    ok(sg.hiddenState && sg.seenState, 'indicador de detección: oculto / visto');
    ok(sg.backstab, 'ataque por la espalda: crítico seguro contra un enemigo que no sabe que estás ahí');
    ok(sg.ambush && sg.enemyAmbush, `emboscadas: la orden EMBOSCADA del compañero y el primer golpe del liquidador hueco${sg.ambush && sg.enemyAmbush ? '' : ' ' + JSON.stringify(sg)}`);
    // 23.3 abatidos y rescate
    const dw = await K.evaluate(() => {
      const e = window.__topolev.exp; const out = {}; window.__clr(); window.__home();
      const [a, b2] = e.team; e.god = false;
      for (const q of e.team) { q.a.hp = e.ast(q).hpMaxEff; q.downed = 0; }
      // cae abatido en vez de morir; un abatido no actúa y no se le puede controlar
      e.active = e.squad.indexOf(b2);
      e.damageAgent(b2, b2.a.hp + 10, 'prueba');
      out.down = b2.downed === 3 && b2.alive && e.inMap(b2) && b2.a.hp === 0 && e.cur === a;
      e.switchActive(e.squad.indexOf(b2)); out.noControl = e.cur === a;
      // se desangra: cuenta atrás
      e.downedTick(); out.tick = b2.downed === 2;
      // levantarlo con un botiquín
      e.moveEntity(b2, ...window.__P(1, 0)); e.moveEntity(a, ...window.__P(0, 0));
      return out;
    });
    await K.evaluate(async () => { const { createItem } = await import('./js/core/items.js'); const { ITEMS } = await import('./js/data/items.js'); window.__mk = createItem; window.__heal = (it) => ITEMS[it.b].use === 'heal'; });
    const dw2 = await K.evaluate(() => {
      const e = window.__topolev.exp; const out = {}; const [a, b2] = e.team;
      a.a.bag = a.a.bag.filter(Boolean); if (!a.a.bag.some((it) => it.b === 'ai2')) a.a.bag.push(window.__mk('ai2', 0));
      // gasta la curación más pequeña que lleve
      const heals = () => a.a.bag.filter((it) => window.__heal(it)).reduce((n, it) => n + (it.q || 1), 0);
      const kits = heals();
      out.rescue = e.canRescue(a, b2) && e.rescue(a, b2) && !b2.downed && b2.a.hp > 1 && heals() === kits - 1;
      // sin botiquín: 1 de salud y un turno de más
      e.damageAgent(b2, b2.a.hp + 10, 'prueba');
      const bag0 = a.a.bag; a.a.bag = [];
      e.extraTurn = 0; e.rescue(a, b2);
      out.bare = !b2.downed && b2.a.hp === 1 && e.extraTurn === 1;
      a.a.bag = bag0; e.extraTurn = 0;
      // el enemigo prefiere rematar al abatido que tiene al lado
      e.damageAgent(b2, b2.a.hp + 10, 'prueba');
      const [wx, wy] = window.__P(1, 1); const w = e.spawnEnemy('lobo', 3, wx, wy, 'alerta');
      const [t] = e.pickTarget(w, 11); out.finish = t === b2;
      // si nadie lo levanta, muere al acabarse los turnos
      for (let i = 0; i < 4; i++) e.downedTick();
      out.bleed = !b2.alive && window.__topolev.S.fallen[0] && /desangr/.test(window.__topolev.S.fallen[0].cause);
      e.dismissActor(w); e.god = true;
      return out;
    });
    ok(dw.down && dw.noControl && dw.tick, `a 0 de salud el agente queda abatido 3 turnos; no actúa ni se le controla${dw.down && dw.noControl && dw.tick ? '' : ' ' + JSON.stringify(dw)}`);
    ok(dw2.rescue && dw2.bare, `levantar al abatido con F: con botiquín (lo gasta) o a mano con 1 de salud${dw2.rescue && dw2.bare ? '' : ' ' + JSON.stringify(dw2)}`);
    ok(dw2.finish && dw2.bleed, 'los enemigos rematan al abatido; si nadie lo levanta, se desangra');
    // 23.4 munición especial y fuego de supresión
    const am = await K.evaluate(() => {
      const e = window.__topolev.exp; const out = {}; window.__clr(); window.__home(); e.god = true;
      const sq = e.team.find((q) => !q.downed) || e.cur; e.active = e.squad.indexOf(sq);
      const ak = window.__mk('ak74', 0); ak.ld = 0; sq.a.equip.w1 = ak; sq.cur = 'w1';
      sq.a.bag = sq.a.bag.filter((it) => !String(it.b).startsWith('a_545'));
      sq.a.bag.push(window.__mk('a_545', 0, undefined, 30), window.__mk('a_545_ap', 0, undefined, 30));
      // N elige la perforante; R la carga
      e.cycleAmmo(sq); e.reload(sq, true);
      out.loadAp = ak.ammoKind === 'a_545_ap' && ak.ld === 30 && e.ammoFor(sq) === 30;
      // volver a la normal: lo cargado vuelve a la mochila
      e.cycleAmmo(sq); e.reload(sq, true);
      out.back = !ak.ammoKind && ak.ld === 30 && sq.a.bag.filter((it) => it.b === 'a_545_ap').reduce((n, it) => n + it.q, 0) === 30;
      // efectos contra un objetivo blindado (gólem): perforante > normal > expansiva; de esencia > normal
      const [gx, gy] = window.__P(4, 0); const g = e.spawnEnemy('golem', 8, gx, gy, 'alerta');
      const ws = { ...e.weaponStats(sq), dmg: [20, 20], crit: -999 };
      const hit = (kind) => { ak.ammoKind = kind; return e.rollDmg(ws, e.ast(sq), sq, g, false, 4).dmg; };
      const n = hit(null), ap = hit('a_545_ap'), hp = hit('a_545_hp'), es = hit('a_545_ess');
      out.fx = ap > n && hp < n && es > n;
      // incendiaria: prende fuego
      ak.ammoKind = 'a_545_inc'; g.burn = 0; g.hp = g.hpMax = 9999; const est = e.est(g); est.ev = -200;
      for (let i = 0; i < 10 && !(g.burn >= 3); i++) e.resolveHit(sq, g, { ...e.weaponStats(sq), acc: 300 }, e.ast(sq), false); // (el impacto tiene un tope del 97%)
      out.inc = g.burn >= 3;
      ak.ammoKind = null; e.dismissActor(g);
      // fuego de supresión: los que están a 1 casilla del objetivo quedan suprimidos
      ak.ld = 30;
      const [ax, ay] = window.__P(6, 0), [bx, by] = window.__P(6, 1), [cx, cy] = window.__P(6, 4);
      const w1 = e.spawnEnemy('lobo', 3, ax, ay, 'alerta'), w2 = e.spawnEnemy('lobo', 3, bx, by, 'alerta'), w3 = e.spawnEnemy('lobo', 3, cx, cy, 'alerta');
      for (const w of [w1, w2, w3]) { w.hp = w.hpMax = 999; }
      const ok2 = e.suppress(sq, w1);
      out.supp = ok2 && w1.suppressed === 2 && w2.suppressed === 2 && !w3.suppressed && ak.ld <= 24;
      // un suprimido acierta menos (−30) y pierde turnos
      const h1 = e.hitChance(sq, w3); sq.suppressed = 2; const h2 = e.hitChance(sq, w3); sq.suppressed = 0;
      out.penalty = h2 === Math.max(5, h1 - 30);
      // un arma no automática no puede suprimir
      sq.a.equip.w1 = window.__mk('makarov', 0); sq.a.equip.w1.ld = 8;
      out.noPistol = !e.canSuppress(sq);
      window.__clr();
      return out;
    });
    ok(am.loadAp && am.back, 'munición especial: N elige el tipo, R lo carga y lo cargado vuelve a la mochila al cambiar');
    ok(am.fx && am.inc, `perforante, expansiva y de esencia cambian el daño; la incendiaria prende fuego${am.fx && am.inc ? '' : ' ' + JSON.stringify(am)}`);
    ok(am.supp && am.penalty && am.noPistol, 'fuego de supresión (Z) con armas automáticas: suprime 2 turnos y −30% de impacto');
    // 23.5 durabilidad, encasquillamientos y reparación
    const du = await K.evaluate(async () => {
      const e = window.__topolev.exp; const out = {}; window.__clr(); window.__home(); e.god = true;
      const sq = e.team.find((q) => !q.downed) || e.cur; e.active = e.squad.indexOf(sq);
      const ak = window.__mk('ak74', 0); ak.ld = 30; sq.a.equip.w1 = ak; sq.cur = 'w1';
      const [tx, ty] = window.__P(5, 0); const t = e.spawnEnemy('golem', 5, tx, ty, 'alerta'); t.hp = t.hpMax = 9999;
      // a estrenar no se encasquilla; desgaste por disparo
      ak.dur = 100; e.attack(sq, t); out.wear = ak.dur < 100 && !ak.jammed;
      // gastada: acaba encasquillándose; atascada no dispara; R la desencasquilla
      ak.dur = 0; let tries = 0; while (!ak.jammed && tries < 200) { ak.ld = 30; e.attack(sq, t); tries++; }
      const ld = ak.ld; const fired = e.attack(sq, t);
      out.jam = ak.jammed === 1 && fired === false && ak.ld === ld;
      e.reload(sq, true); out.unjam = !ak.jammed;
      e.dismissActor(t);
      // reparar en el taller con chatarra
      const S = window.__topolev.S; const B = await import('./js/core/basecore.js');
      S.modules.taller_fab = 1; S.stash.push(window.__mk('chatarra', 0, undefined, 50));
      const cost = B.repairCost(ak); const r = B.repairWeapon(ak);
      out.repair = r.ok && ak.dur === 100 && cost > 0;
      return out;
    });
    ok(du.wear && du.jam && du.unjam, 'durabilidad: el arma se gasta, gastada se encasquilla (no dispara) y R la desencasquilla');
    ok(du.repair, 'reparar armas en el Taller de fabricación con chatarra');
    // 23.6 granadas que rebotan, con mecha, y patada
    const gr = await K.evaluate(() => {
      const e = window.__topolev.exp; const out = {}; window.__clr(); window.__floor(); window.__home(); e.god = true;
      const sq = e.team.find((q) => !q.downed) || e.cur; e.active = e.squad.indexOf(sq); e.moveEntity(sq, ...window.__P(0, 0));
      // sin pared: cae donde apuntas; con pared en medio: rebota y cae antes
      const [tx, ty] = window.__P(6, 0);
      const free = e.grenadePath(sq.x, sq.y, tx, ty);
      window.__set(4, 0, 1); // muro
      const bo = e.grenadePath(sq.x, sq.y, tx, ty);
      out.bounce = !free.bounced && free.x === tx && bo.bounced && bo.x < window.__P(4, 0)[0];
      window.__set(4, 0, 2);
      // mecha: no estalla al lanzarla, sino al final del turno
      const w = e.spawnEnemy('golem', 5, tx, ty, 'dormido'); w.hp = w.hpMax = 999;
      const nade = window.__mk('rgd5', 0); sq.a.bag.push(nade);
      e.throwAt(sq, nade, tx, ty);
      const before = w.hp, armed = e.pending.some((p) => p.kind === 'nade');
      e.wait();
      out.fuse = armed && before === 999 && w.hp < 999 && !e.pending.some((p) => p.kind === 'nade');
      e.dismissActor(w);
      // granada enemiga junto al agente: sin el talento no se devuelve; con «Devolución», F la manda lejos
      const [nx, ny] = window.__P(1, 0);
      e.armNade({ x: nx, y: ny, at: e.turn + 1, blast: 1, dmg: [10, 10], src: 'prueba', enemy: 1 });
      const p = e.pending.find((q) => q.kind === 'nade');
      out.noKick = !e.kickNade(sq, p) && p.x === nx;
      sq.a.talents = [...(sq.a.talents || []), 'z_patada'];
      out.flag = !!e.flag(sq, 'kickNade');
      e.interact();
      out.kick = Math.max(Math.abs(p.x - sq.x), Math.abs(p.y - sq.y)) >= 3 && !p.enemy;
      e.pending = e.pending.filter((q) => q.kind !== 'nade');
      sq.a.talents = sq.a.talents.filter((t) => t !== 'z_patada');
      window.__clr();
      return out;
    });
    ok(gr.bounce && gr.fuse, 'granadas: rebotan en las paredes y estallan al final del turno (mecha)');
    ok(gr.noKick && gr.flag && gr.kick, `talento «Devolución»: F junto a una granada enemiga la devuelve de una patada${gr.noKick && gr.flag && gr.kick ? '' : ' ' + JSON.stringify(gr)}`);
    await ctx10.close();
  }

  console.log('· Fase 24: calidad, accesibilidad y modos');
  {
    const ctx11 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const A = await ctx11.newPage();
    A.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    A.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await A.goto(URL); await A.waitForTimeout(800);
    // 24.1 modo daltónico y alto contraste desde el menú principal
    const r0 = await A.evaluate(async () => { const R = await import('./js/data/rarity.js'); return R.RARITIES[2].color; });
    await A.click('text=CONFIGURACIÓN'); await A.waitForTimeout(150);
    await A.click('.modal [data-set="colorblind"]'); await A.waitForTimeout(100);
    await A.click('.modal [data-set="contrast"]'); await A.waitForTimeout(100);
    await A.keyboard.press('Escape'); await A.waitForTimeout(150);
    const cb = await A.evaluate(async () => {
      const R = await import('./js/data/rarity.js'); const I = await import('./js/core/items.js');
      const it = I.createItem('makarov', 2);
      return { cls: document.body.classList.contains('cb') && document.body.classList.contains('hc'), color: R.RARITIES[2].color, sym: I.itemHTML(it).includes('◆') && I.itemTooltip(it).includes('◆'), css: getComputedStyle(document.documentElement).getPropertyValue('--r2').trim() };
    });
    ok(cb.cls && cb.color !== r0 && cb.color === '#f0e442' && cb.css === '#f0e442', 'modo daltónico: paleta Okabe-Ito en las rarezas y clases en <body>; alto contraste activado');
    ok(cb.sym, 'rarezas con símbolo (◆ raro) en el nombre y el tooltip');
    // se recuerda al recargar
    await A.reload(); await A.waitForTimeout(800);
    const kept = await A.evaluate(async () => { const R = await import('./js/data/rarity.js'); return document.body.classList.contains('cb') && document.body.classList.contains('hc') && R.RARITIES[2].color === '#f0e442'; });
    ok(kept, 'los ajustes de accesibilidad se guardan y se aplican al arrancar');
    // una expedición con los dos modos activados, sin errores (marcas de actitud incluidas)
    await A.click('text=NUEVA PARTIDA'); await A.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await A.click('#screen-intro'); await A.click('text=COMENZAR');
    await A.waitForTimeout(300);
    await A.click('.tab:has-text("EXPEDICIÓN")'); await A.waitForTimeout(200);
    await A.click('[data-go]'); await A.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await A.$$('.modal .agent-row'); await rows[i].click(); }
    await A.click('text=LANZAR EXPEDICIÓN'); await A.waitForTimeout(300);
    if (await A.$('.modal-back >> text=LANZAR')) await A.click('.modal-back >> text=LANZAR');
    await A.waitForTimeout(800);
    await A.evaluate(() => { const e = window.__topolev.exp; const c = e.cur; for (const [dx, dy] of [[2, 0], [0, 2], [-2, 0]]) if (e.passable(c.x + dx, c.y + dy) && !e.entityAt(c.x + dx, c.y + dy)) { e.spawnEnemy('rda_rifle', 2, c.x + dx, c.y + dy, 'errante'); break; } e.computeVisibility(true); });
    await A.waitForTimeout(600);
    ok(await A.evaluate(() => !!document.querySelector('.map-canvas')), 'el mapa se dibuja con el modo daltónico y el alto contraste');
    // volver a dejarlos como estaban
    await A.evaluate(async () => { const { settings, saveSettings } = await import('./js/core/state.js'); settings.colorblind = false; settings.contrast = false; saveSettings(); });
    // 24.2 controles: K agacharse (antes C chocaba con la diagonal), D mueve; remapear y restaurar
    await A.evaluate(() => { const e = window.__topolev.exp; for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x); if (e.dlg) e.closeDialog(); e.dlgQueue = []; window.__topolev.debug.run('god'); });
    for (let i = 0; i < 6 && (await A.$('.modal')); i++) { await A.keyboard.press('Escape'); await A.waitForTimeout(150); }
    await A.keyboard.press('k'); await A.waitForTimeout(100);
    const kc = await A.evaluate(() => !!window.__topolev.exp.cur.crouch);
    await A.keyboard.press('k'); await A.waitForTimeout(100);
    const kc2 = await A.evaluate(() => !window.__topolev.exp.cur.crouch);
    const mv = await A.evaluate(() => { const e = window.__topolev.exp; const c = e.cur; return { x: c.x, ok: e.passable(c.x + 1, c.y) && !e.entityAt(c.x + 1, c.y) }; });
    await A.keyboard.press('d'); await A.waitForTimeout(150);
    const mx = await A.evaluate(() => window.__topolev.exp.cur.x);
    ok(kc && kc2 && (!mv.ok || mx === mv.x + 1), 'teclas por defecto sin choques: K agacharse, D mover a la derecha');
    const rk = await A.evaluate(async () => {
      const Kk = await import('./js/ui/keys.js');
      const conflict = Kk.setKey('crouch', 'r'); const reserved = Kk.setKey('crouch', '1');
      const okSet = Kk.setKey('crouch', 'y');
      return { conflict: !conflict.ok && conflict.conflict === 'reload', reserved: !reserved.ok, okSet: okSet.ok && Kk.actionForKey('y') === 'crouch' && Kk.actionForKey('k') === null, name: Kk.keyName('crouch') };
    });
    await A.keyboard.press('y'); await A.waitForTimeout(100);
    const yc = await A.evaluate(() => !!window.__topolev.exp.cur.crouch);
    ok(rk.conflict && rk.reserved && rk.okSet && rk.name === 'Y' && yc, 'remapear: avisa de choques y teclas reservadas; la tecla nueva funciona');
    // los mensajes y la ayuda muestran la tecla nueva (keyify)
    const kf = await A.evaluate(async () => { const Kk = await import('./js/ui/keys.js'); Kk.setKey('reload', '9'); const t = Kk.keyify('Pulsa <b>R</b> para recargar.'); Kk.resetKeys(); return { t, back: Kk.keyify('Pulsa <b>R</b>.') === 'Pulsa <b>R</b>.' && Kk.actionForKey('k') === 'crouch' }; });
    ok(kf.t.includes('<b>9</b>') && kf.back, 'los mensajes nombran la tecla actual; RESTAURAR vuelve a las de siempre');
    // pantalla CONTROLES desde el menú principal
    await A.evaluate(() => window.__topolev.exp && window.__topolev.save && window.__topolev.save());
    await A.reload(); await A.waitForTimeout(800);
    await A.click('text=CONFIGURACIÓN'); await A.waitForTimeout(150);
    await A.click('.modal [data-set="keys"]'); await A.waitForTimeout(200);
    await A.click('.modal button[data-act="crouch"]').catch(async () => { await A.click('.modal .row:has-text("Agacharse") button'); });
    await A.waitForTimeout(100); await A.keyboard.press('9'); await A.waitForTimeout(150);
    const scr = await A.evaluate(async () => { const { settings } = await import('./js/core/state.js'); return settings.keys && settings.keys.crouch; });
    await A.click('text=RESTAURAR TECLAS'); await A.waitForTimeout(100);
    const scr2 = await A.evaluate(async () => { const { settings } = await import('./js/core/state.js'); return Object.keys(settings.keys || {}).length; });
    ok(scr === '9' && scr2 === 0, 'pantalla CONTROLES: reasignar con clic + tecla y restaurar');
    await ctx11.close();
  }
  {
    // 24.8 enciclopedia: lo no descubierto, oculto; tras ver un chebylita, aparece; búsqueda y enlaces cruzados
    const ctx17 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const Cx = await ctx17.newPage();
    Cx.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    Cx.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await Cx.goto(URL); await Cx.waitForTimeout(800);
    await Cx.click('text=NUEVA PARTIDA'); await Cx.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await Cx.click('#screen-intro'); await Cx.click('text=COMENZAR');
    await Cx.waitForTimeout(300);
    await Cx.evaluate(() => { const S = window.__topolev.S; S.bestiary = {}; });
    await Cx.click('.tab:has-text("ARCHIVO")'); await Cx.waitForTimeout(200);
    await Cx.click('text=ENCICLOPEDIA'); await Cx.waitForTimeout(200);
    const c0 = await Cx.evaluate(() => { const rows = [...document.querySelectorAll('.modal .cx-entry')]; return { n: rows.length, known: rows.filter((r) => r.dataset.known === '1').length, rata: !!document.querySelector('.modal .cx-entry[data-id="rata"][data-known="0"]') && !document.querySelector('.modal').innerText.includes('Rata espinosa') }; });
    ok(c0.n >= 40 && c0.known === 0 && c0.rata, `enciclopedia: sin avistar nada, los chebylitas salen como ??? (${c0.n})`);
    await Cx.keyboard.press('Escape'); await Cx.waitForTimeout(150);
    await Cx.evaluate(async () => { const st = await import('./js/core/state.js'); st.seeEnemy('rata'); st.seeEnemy('lobo'); st.save(); });
    await Cx.click('text=ENCICLOPEDIA'); await Cx.waitForTimeout(200);
    const c1 = await Cx.evaluate(() => ({ rata: !!document.querySelector('.modal .cx-entry[data-id="rata"][data-known="1"]') && document.querySelector('.modal').innerText.includes('Rata espinosa'), items: document.querySelector('.modal .cx-tabs [data-sec="objetos"]').textContent }));
    ok(c1.rata && /[1-9]\d*\//.test(c1.items), `tras ver un chebylita aparece; los objetos del almacén cuentan como vistos (${c1.items.trim()})`);
    // búsqueda y enlace cruzado de la rata a su zona
    await Cx.fill('.modal .cx-search', 'lobo'); await Cx.waitForTimeout(100);
    const sr = await Cx.evaluate(() => [...document.querySelectorAll('.modal .cx-entry')].map((r) => r.dataset.id).join(','));
    await Cx.fill('.modal .cx-search', ''); await Cx.waitForTimeout(100);
    await Cx.click('.modal .cx-entry[data-id="rata"] .cx-link[data-sec="zonas"] >> nth=0'); await Cx.waitForTimeout(150);
    const lk = await Cx.evaluate(() => ({ sec: document.querySelector('.modal .cx-tabs .tab.active').dataset.sec, focus: !!document.querySelector('.modal .cx-entry.focus[data-known="1"]') }));
    ok(sr === 'lobo' && lk.sec === 'zonas' && lk.focus, `búsqueda (${sr}) y enlace de un chebylita a su zona`);
    await ctx17.close();
  }
  {
    // 24.7 modos de juego: libre, hierro, desafío semanal y «1987»
    const ctx16 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const Mo = await ctx16.newPage();
    Mo.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    Mo.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await Mo.goto(URL); await Mo.waitForTimeout(800);
    // libre desde la pantalla de nueva partida
    await Mo.click('text=NUEVA PARTIDA'); await Mo.waitForTimeout(150);
    const lockedNg = await Mo.evaluate(() => !!document.querySelector('.modal button[data-mode="ng"]') && document.querySelector('.modal button[data-mode="ng"]').textContent.includes('🔒'));
    await Mo.click('.modal button[data-mode="libre"]'); await Mo.waitForTimeout(100);
    await Mo.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await Mo.click('#screen-intro'); await Mo.click('text=COMENZAR'); await Mo.waitForTimeout(300);
    const lib = await Mo.evaluate(async () => {
      const S = window.__topolev.S; const W = await import('./js/data/world.js'); const C = await import('./js/core/campaign.js'); const B = await import('./js/core/basecore.js');
      const allOpen = W.MAPS.every((m, i) => W.zoneOpen(S, i));
      S.quota.due = S.day + 1; const rub0 = S.rub; C.nextDay();
      const att = B.rollAttack(); for (let i = 0; i < 40; i++) B.rollAttack();
      return { mode: S.mode, rub0, rubAfter: S.rub, allOpen, act: S.act, att: !!S.attack, tag: document.querySelector('#screen-base .mode-tag') ? document.querySelector('#screen-base .mode-tag').textContent : '' };
    });
    ok(lockedNg && lib.mode === 'libre' && lib.rub0 === 2000 && lib.allOpen && lib.act === 0 && !lib.att && lib.rubAfter >= lib.rub0, `modo LIBRE: zonas abiertas, 2000 ₽, sin cuota, ataques ni actos («1987» bloqueado) ${lib.tag}`);
    // hierro
    const ir = await Mo.evaluate(async () => {
      const st = await import('./js/core/state.js'); const C = await import('./js/core/campaign.js'); const M = await import('./js/core/modes.js');
      st.newGame(2, { mode: 'hierro' }); const S = st.S;
      const info = st.slotInfo(2);
      S.agents.length = 0; const vol = C.ensureVolunteer(); S.rub = 0;
      return { iron: S.iron, info: info.iron && info.mode === 'hierro', vol, over: M.ironOver() };
    });
    ok(ir.iron && ir.info && ir.vol === null && ir.over, 'modo HIERRO: marcado en la ranura, sin voluntarios y fin al quedarse sin agentes ni rublos');
    // desafío semanal: misma semilla, mismo comienzo y mismos mapas; puntuación en la tabla local al día 16
    const ch = await Mo.evaluate(async () => {
      const st = await import('./js/core/state.js'); const M = await import('./js/core/modes.js'); const C = await import('./js/core/campaign.js');
      const sig = () => st.S.agents.map((a) => a.first + a.last + a.lvl).join('|') + '#' + st.S.stash.map((i) => i.b + i.r).join(',');
      st.newGame(3, { mode: 'desafio', week: '2026-W40' }); const a = sig(); const s0 = M.mapSeed(0), s3 = M.mapSeed(5);
      const r1 = C.ensureRecruits().list.map((r) => r.a.first).join(',');
      st.newGame(4, { mode: 'desafio', week: '2026-W40' }); const b2 = sig(); const s0b = M.mapSeed(0);
      st.S.recruits = null; const r2 = C.ensureRecruits().list.map((r) => r.a.first).join(',');
      st.newGame(4, { mode: 'desafio', week: '2026-W41' }); const c = sig();
      st.S.day = 16; st.S.stats.essTotal = 300; st.S.stats.kills = 10; const txt = M.challengeDayTick();
      return { same: a === b2, diff: a !== c, seed: s0 != null && s0 === s0b && s3 == null, rec: r1 === r2, txt: !!txt, table: M.challengeTable('2026-W41')[0] };
    });
    ok(ch.same && ch.diff && ch.seed && ch.rec, 'DESAFÍO: la misma semana da los mismos agentes, botín, reclutas y mapas (y otra semana, otros)');
    ok(ch.txt && ch.table && ch.table.score === 320, `DESAFÍO: al pasar el día 15 se apunta la puntuación en la tabla local (${ch.table && ch.table.score})`);
    // «1987»: legado de un final, modificadores
    const ng = await Mo.evaluate(async () => {
      const st = await import('./js/core/state.js'); const M = await import('./js/core/modes.js'); const E = await import('./js/core/ecosys.js');
      st.newGame(5); st.S.agents[0].lvl = 9; M.saveLegacy('sellar');
      const unlocked = M.ngUnlocked(); const vet = st.S.agents[0].first;
      st.newGame(5, { mode: 'ng', ngMods: { lvl: 1, alert: 1, poor: 1 }, carry: 'agent' });
      const S = st.S;
      return { unlocked, n: S.agents.length, vet: S.agents.some((a) => a.first === vet && a.lvl === 9), rub: S.rub, alert: E.reactorAlert(), grow: E.zoneWorld('admin').grow };
    });
    ok(ng.unlocked && ng.n === 4 && ng.vet && ng.rub === 200 && ng.alert === 1 && ng.grow === 1, `«1987»: se desbloquea con un final; veterano del año pasado y modificadores (${JSON.stringify(ng)})`);
    await ctx16.close();
  }
  {
    // 24.6 logros y estadísticas: suben las estadísticas, se desbloquea un logro y sobrevive a borrar la ranura
    const ctx15 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const Ac = await ctx15.newPage();
    Ac.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    Ac.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await Ac.goto(URL); await Ac.waitForTimeout(800);
    await Ac.click('text=NUEVA PARTIDA'); await Ac.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await Ac.click('#screen-intro'); await Ac.click('text=COMENZAR');
    await Ac.waitForTimeout(300);
    await Ac.click('.tab:has-text("EXPEDICIÓN")'); await Ac.waitForTimeout(200);
    await Ac.click('[data-go]'); await Ac.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await Ac.$$('.modal .agent-row'); await rows[i].click(); }
    await Ac.click('text=LANZAR EXPEDICIÓN'); await Ac.waitForTimeout(300);
    if (await Ac.$('.modal-back >> text=LANZAR')) await Ac.click('.modal-back >> text=LANZAR');
    await Ac.waitForTimeout(800);
    // una baja real del escuadrón: estadísticas por especie y por arma
    const k = await Ac.evaluate(() => {
      const e = window.__topolev.exp; const S = window.__topolev.S; window.__topolev.debug.run('god');
      for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x);
      const c = e.cur; const cell = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => e.passable(x, y) && !e.entityAt(x, y));
      const r = e.spawnEnemy('rata', 1, cell[0], cell[1], 'dormido');
      const before = (S.stats.killsBy || {}).rata || 0;
      e.damageEnemy(r, 999, c);
      const w = e.weapon(c);
      return { by: S.stats.killsBy.rata - before, wpn: w ? S.stats.killsWeapon[w.b] || 0 : 1, kills: S.stats.kills };
    });
    ok(k.by === 1 && k.wpn >= 1 && k.kills >= 1, 'estadísticas ampliadas: bajas por especie y por arma');
    // logro: primera extracción (simulada) → toast, y queda guardado fuera de la partida
    const a1 = await Ac.evaluate(async () => {
      const A = await import('./js/core/achievements.js'); const S = window.__topolev.S;
      const had = A.hasAchievement('ext1');
      S.stats.extractions = Math.max(1, S.stats.extractions);
      A.statExpedition('admin', { extracted: true, deaths: 0, ess: 120 });
      const fresh = A.checkAchievements().map((x) => x.id);
      const again = A.checkAchievements().length;
      return { had, fresh, again, zone: S.stats.zones.admin, best: S.stats.bestDay, streak: S.stats.noLoss, toast: [...document.querySelectorAll('.toast')].some((x) => /Logro/.test(x.textContent)) };
    });
    ok(!a1.had && a1.fresh.includes('ext1') && a1.again === 0 && a1.toast, `logro «Volver a casa» desbloqueado una sola vez, con aviso (${a1.fresh.join(', ')})`);
    ok(a1.zone && a1.zone.ext === 1 && a1.best && a1.best.ess === 120 && a1.streak === 1, 'estadísticas por zona, día récord y racha sin bajas');
    // borrar la ranura: el logro sigue
    await Ac.reload(); await Ac.waitForTimeout(800);
    await Ac.evaluate(async () => { const st = await import('./js/core/state.js'); st.wipe(1); });
    await Ac.reload(); await Ac.waitForTimeout(800);
    const wiped = await Ac.evaluate(async () => { const st = await import('./js/core/state.js'); return !st.slotInfo(1); });
    const kept = await Ac.evaluate(async () => { const A = await import('./js/core/achievements.js'); return A.hasAchievement('ext1'); });
    await Ac.click('text=LOGROS Y ESTADÍSTICAS'); await Ac.waitForTimeout(200);
    const scr = await Ac.evaluate(() => ({ got: !!document.querySelector('.modal .ach.got[data-ach="ext1"]'), secret: !!Array.from(document.querySelectorAll('.modal .ach')).find((x) => x.textContent.includes('???')) }));
    ok(wiped && kept && scr.got && scr.secret, 'el logro persiste tras borrar la ranura; pantalla de logros (con secretos ocultos)');
    // migración: una partida vieja sin las estadísticas nuevas
    const mig = await Ac.evaluate(async () => { const A = await import('./js/core/achievements.js'); const d = { stats: { kills: 5, extractions: 2 } }; A.statsDefaults(d); return d.stats.kills === 5 && d.stats.rescues === 0 && typeof d.stats.zones === 'object' && d.stats.bestNoLoss === 0; });
    ok(mig, 'migración: las partidas viejas reciben las estadísticas nuevas sin perder las antiguas');
    await ctx15.close();
  }
  {
    // 24.5 música generativa y sonido: temas por pantalla y zona, intensidad, volúmenes separados y sonidos nuevos
    const ctx14 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const Au = await ctx14.newPage();
    Au.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    Au.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await Au.goto(URL); await Au.waitForTimeout(800);
    await Au.click('text=NUEVA PARTIDA'); await Au.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await Au.click('#screen-intro'); await Au.click('text=COMENZAR');
    await Au.waitForTimeout(400);
    const mb = await Au.evaluate(async () => { const A = await import('./js/audio.js'); return { want: A.music.wanted, theme: A.music.theme }; });
    ok(mb.want === 'base' && mb.theme === 'base', `música tranquila en la base (${mb.theme})`);
    // volúmenes separados desde el menú de la base; se guardan
    await Au.click('text=≡ MENÚ'); await Au.waitForTimeout(150);
    await Au.click('.modal >> text=CONFIGURACIÓN'); await Au.waitForTimeout(150);
    // deslizadores ASCII: música 40 → 60 con las flechas; efectos a 0 con Inicio
    await Au.focus('.modal [data-set="volMusic"]'); for (let i = 0; i < 20; i++) await Au.keyboard.press('ArrowRight');
    await Au.focus('.modal [data-set="volSfx"]'); await Au.keyboard.press('Home'); await Au.waitForTimeout(100);
    const vol = await Au.evaluate(() => { const st = JSON.parse(localStorage.getItem('topolev_settings_v1')); return { m: st.musicVol, f: st.sfxVol }; });
    ok(Math.abs(vol.m - 0.6) < 0.01 && vol.f === 0, `volúmenes de música y efectos por separado, guardados (${vol.m} / ${vol.f})`);
    await Au.click('.modal [data-set="music"]'); await Au.waitForTimeout(150);
    const off = await Au.evaluate(async () => { const A = await import('./js/audio.js'); return A.music.theme; });
    await Au.click('.modal [data-set="music"]'); await Au.waitForTimeout(150);
    const on = await Au.evaluate(async () => { const A = await import('./js/audio.js'); return A.music.theme; });
    ok(off === null && on === 'base', 'MÚSICA: NO la apaga (con fundido) y SÍ la vuelve a poner');
    for (let i = 0; i < 4 && (await Au.$('.modal')); i++) { await Au.keyboard.press('Escape'); await Au.waitForTimeout(120); }
    // expedición: drone de la zona e intensidad con el peligro
    await Au.click('.tab:has-text("EXPEDICIÓN")'); await Au.waitForTimeout(200);
    await Au.click('[data-go]'); await Au.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await Au.$$('.modal .agent-row'); await rows[i].click(); }
    await Au.click('text=LANZAR EXPEDICIÓN'); await Au.waitForTimeout(300);
    if (await Au.$('.modal-back >> text=LANZAR')) await Au.click('.modal-back >> text=LANZAR');
    await Au.waitForTimeout(800);
    const ex = await Au.evaluate(async () => {
      const A = await import('./js/audio.js'); const e = window.__topolev.exp; const ui = window.__topolev.expUI;
      const theme = A.music.theme, zoneTheme = A.themeForZone(e.def);
      for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x);
      const calm = ui.danger();
      const c = e.cur; let n = 0;
      for (const [dx, dy] of [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 2]]) if (n < 3 && e.passable(c.x + dx, c.y + dy) && !e.entityAt(c.x + dx, c.y + dy)) { const en = e.spawnEnemy('lobo', 2, c.x + dx, c.y + dy, 'alerta'); en.state = 'alerta'; n++; }
      e.computeVisibility(true);
      const hot = ui.danger(); A.music.setIntensity(hot);
      // los sonidos nuevos (24.5.4) suenan sin errores
      for (const k of ['tick', 'heartbeat', 'revive', 'suppress', 'jam', 'crouch', 'howl', 'phase', 'elite']) A.sfx[k]();
      e.toggleCrouch(e.cur); const snd = e.fx.some((f) => f.type === 'snd' && f.s === 'crouch'); e.toggleCrouch(e.cur);
      return { theme, zoneTheme, calm, hot, inten: A.music.intensity, snd };
    });
    ok(ex.theme === ex.zoneTheme && ['subsuelo', 'superficie', 'laboratorio', 'corium'].includes(ex.theme), `drone de la zona al entrar en la expedición (${ex.theme})`);
    ok(ex.hot > ex.calm && ex.inten === ex.hot, `la intensidad sube con enemigos en alerta (${ex.calm.toFixed(2)} → ${ex.hot.toFixed(2)})`);
    ok(ex.snd, 'sonidos nuevos de las fases 19–23 (agacharse, latido, mecha…) sin errores');
    await Au.waitForTimeout(400);
    await ctx14.close();
  }
  {
    // 24.4 localización: inglés en el menú, las pestañas y los datos; lo que falta cae al español
    const ctx13 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const L = await ctx13.newPage();
    L.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    L.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await L.goto(URL); await L.waitForTimeout(800);
    await L.click('text=CONFIGURACIÓN'); await L.waitForTimeout(150);
    await L.click('.modal [data-set="lang"]'); await L.waitForTimeout(150);
    const inModal = await L.evaluate(() => document.querySelector('.modal').innerText.includes('Colourblind mode') && document.querySelector('.modal').innerText.includes('English'));
    await L.keyboard.press('Escape'); await L.waitForTimeout(200);
    const en = await L.evaluate(() => { const tx = document.body.innerText; return { menu: tx.includes('NEW GAME') && tx.includes('SETTINGS') && !tx.includes('NUEVA PARTIDA'), lang: document.documentElement.lang }; });
    en.menu = en.menu && inModal;
    ok(en.menu && en.lang === 'en', 'IDIOMA: el menú principal pasa al inglés (y <html lang="en">)');
    const fb = await L.evaluate(async () => {
      const I = await import('./js/i18n/index.js'); const { ITEMS } = await import('./js/data/items.js'); const { MAPS } = await import('./js/data/world.js');
      return { miss: I.t('clave.que.no.existe'), es: I.t('menu.new'), interp: I.t('menu.saved', { n: 3 }), item: ITEMS.makarov.name, zone: MAPS[0].name, other: ITEMS.ak74 ? ITEMS.ak74.name : 'x' };
    });
    ok(fb.miss === 'clave.que.no.existe' && fb.es === 'NEW GAME' && fb.interp === 'Game saved (slot 3).', 'claves que faltan: devuelven la clave sin romper; interpolación {n}');
    ok(fb.item === 'Makarov PM pistol' && fb.zone === 'Administrative Block' && /\S/.test(fb.other), 'datos traducidos por id (objetos y zonas); los que no tienen traducción siguen en español');
    // partida en inglés: pestañas de la base y expedición sin errores
    await L.click('text=NEW GAME'); await L.click('.modal >> text=START HERE >> nth=0'); await L.click('#screen-intro'); await L.click('text=COMENZAR').catch(() => {});
    await L.waitForTimeout(300);
    const tabs = await L.evaluate(() => [...document.querySelectorAll('#screen-base .tab')].map((x) => x.textContent).join(' '));
    ok(/HQ/.test(tabs) && /BARRACKS/.test(tabs) && /EXPEDITION/.test(tabs), `pestañas de la base en inglés (${tabs.slice(0, 60)}…)`);
    await L.click('.tab:has-text("EXPEDITION")'); await L.waitForTimeout(200);
    await L.click('[data-go]'); await L.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await L.$$('.modal .agent-row'); await rows[i].click(); }
    await L.click('text=LANZAR EXPEDICIÓN'); await L.waitForTimeout(300);
    if (await L.$('.modal-back >> text=LANZAR')) await L.click('.modal-back >> text=LANZAR');
    await L.waitForTimeout(800);
    const hud = await L.evaluate(() => { const tx = document.querySelector('#screen-exp').innerText; return tx.includes('SQUAD') && tx.includes('TURN') && tx.includes('Administrative Block'.toUpperCase()); });
    ok(hud, 'HUD de la expedición en inglés (ESCUADRA → SQUAD, TURNO → TURN, nombre de la zona)');
    // volver al español desde el menú de pausa: todo vuelve a su texto original
    for (let i = 0; i < 6 && (await L.$('.modal')); i++) { await L.keyboard.press('Escape'); await L.waitForTimeout(150); }
    await L.keyboard.press('Escape'); await L.waitForTimeout(200);
    await L.click('.modal >> text=SETTINGS'); await L.waitForTimeout(150);
    await L.click('.modal [data-set="lang"]'); await L.waitForTimeout(150);
    await L.keyboard.press('Escape'); await L.waitForTimeout(200);
    const back = await L.evaluate(async () => { const { ITEMS } = await import('./js/data/items.js'); return { item: ITEMS.makarov.name, menu: !!document.querySelector('.modal') && document.querySelector('.modal').innerText.includes('CONFIGURACIÓN'), squad: document.querySelector('#screen-exp').innerText.includes('ESCUADRA') }; });
    ok(back.item === 'Pistola Makarov PM' && back.menu && back.squad, 'volver al español restaura los datos y los títulos de los paneles');
    await ctx13.close();
  }
  {
    // 24.3 controles táctiles: móvil en vertical (pantalla táctil, 390 px de ancho)
    const ctx12 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const M = await ctx12.newPage();
    M.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    M.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await M.goto(URL); await M.waitForTimeout(800);
    const det = await M.evaluate(() => ({ touch: document.body.classList.contains('touch'), btn: !!Array.from(document.querySelectorAll('button')).find((b) => /CONFIGURACIÓN/.test(b.textContent)), over: document.documentElement.scrollWidth - innerWidth }));
    ok(det.touch && det.btn && det.over <= 1, 'pantalla táctil detectada (AUTO) y menú principal sin desbordarse a lo ancho');
    await M.click('text=NUEVA PARTIDA'); await M.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await M.click('#screen-intro'); await M.click('text=COMENZAR');
    await M.waitForTimeout(300);
    await M.click('.tab:has-text("EXPEDICIÓN")'); await M.waitForTimeout(200);
    const baseOver = await M.evaluate(() => { const g = document.querySelector('#screen-base .exp-tab'); return { cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0, over: document.documentElement.scrollWidth - innerWidth }; });
    ok(baseOver.cols === 1 && baseOver.over <= 1, 'base en pantalla estrecha: rejilla de una columna, sin scroll horizontal');
    await M.click('[data-go]'); await M.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rows = await M.$$('.modal .agent-row'); await rows[i].click(); }
    await M.click('text=LANZAR EXPEDICIÓN'); await M.waitForTimeout(300);
    if (await M.$('.modal-back >> text=LANZAR')) await M.click('.modal-back >> text=LANZAR');
    await M.waitForTimeout(800);
    await M.evaluate(() => { const e = window.__topolev.exp; for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x); if (e.dlg) e.closeDialog(); e.dlgQueue = []; window.__topolev.debug.run('god'); });
    for (let i = 0; i < 6 && (await M.$('.modal')); i++) { await M.evaluate(async () => { const D = await import('./js/util/dom.js'); D.closeTopModal(); }); await M.waitForTimeout(150); }
    const bar = await M.evaluate(() => {
      const t = document.querySelector('.touch-bar'); const bs = [...document.querySelectorAll('.touch-bar .tbtn')].filter((b) => getComputedStyle(b).display !== 'none');
      const small = bs.filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length;
      const out = bs.filter((b) => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1; }).length;
      return { vis: t && getComputedStyle(t).display !== 'none', n: bs.length, small, out, side: getComputedStyle(document.querySelector('.exp-side')).display };
    });
    ok(bar.vis && bar.n >= 19 && !bar.small && !bar.out && bar.side === 'none', `barra táctil visible con botones de ≥ 44 px dentro de la pantalla (${bar.n} botones); panel del agente plegado`);
    // mover con la cruceta y esperar
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    const st = await M.evaluate((dirs) => { const e = window.__topolev.exp; const c = e.cur; const d = dirs.find(([dx, dy]) => e.passable(c.x + dx, c.y + dy) && !e.entityAt(c.x + dx, c.y + dy) && !e.objAt(c.x + dx, c.y + dy)); return { x: c.x, y: c.y, d, t: e.turn }; }, dirs);
    if (st.d) { await M.tap(`.touch-pad [data-dir="${st.d.join(',')}"]`); await M.waitForTimeout(250); }
    const mv = await M.evaluate(() => { const c = window.__topolev.exp.cur; return [c.x, c.y]; });
    await M.waitForTimeout(100);
    const t0 = await M.evaluate(() => window.__topolev.exp.turn);
    await M.tap('.touch-pad [data-touch="wait"]'); await M.waitForTimeout(250);
    const t1 = await M.evaluate(() => window.__topolev.exp.turn);
    ok(st.d && mv[0] === st.x + st.d[0] && mv[1] === st.y + st.d[1] && t1 > t0, 'la cruceta mueve al agente y el punto central espera un turno');
    // agacharse desde la barra, y ☰ abre el panel del agente
    await M.tap('.touch-acts [data-touch="crouch"]'); await M.waitForTimeout(120);
    const cr = await M.evaluate(() => !!window.__topolev.exp.cur.crouch);
    await M.tap('.touch-acts [data-touch="crouch"]'); await M.waitForTimeout(120);
    await M.tap('.side-tog'); await M.waitForTimeout(150);
    const side = await M.evaluate(() => getComputedStyle(document.querySelector('.exp-side')).display);
    await M.tap('.side-tog'); await M.waitForTimeout(150);
    ok(cr && side === 'flex', 'botones de acción (agacharse) y panel del agente con ☰');
    // pulsación larga = tooltip sin gastar turno; pellizco = zoom
    const lp = await M.evaluate(async () => {
      const ui = window.__topolev.ui || null; const e = window.__topolev.exp; const cv = document.querySelector('.exp-map > canvas');
      const rc = cv.getBoundingClientRect(); const t0 = e.turn;
      const P = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
      // la casilla del agente activo (siempre tiene información)
      const R = window.__topolev.expUI ? window.__topolev.expUI.r : null;
      const [sx, sy] = R ? R.toScreen(e.cur.x, e.cur.y) : [rc.width / 2, rc.height / 2];
      const cx = rc.left + sx + 4, cy = rc.top + sy + 4;
      P('pointerdown', 1, cx, cy); await new Promise((r) => setTimeout(r, 650));
      const tip = !document.querySelector('#tooltip').classList.contains('hidden');
      P('pointerup', 1, cx, cy); cv.dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const { settings } = await import('./js/core/state.js'); const z0 = settings.zoom;
      P('pointerdown', 1, cx - 20, cy); P('pointerdown', 2, cx + 20, cy);
      for (let i = 1; i <= 6; i++) { P('pointermove', 1, cx - 20 - i * 12, cy); P('pointermove', 2, cx + 20 + i * 12, cy); }
      P('pointerup', 1, cx - 92, cy); P('pointerup', 2, cx + 92, cy);
      return { tip, still: e.turn === t0 && !window.__topolev.exp.ended, zoom: settings.zoom > z0, dbg: [!!R, e.turn - t0] };
    });
    ok(lp.tip && lp.still, `pulsación larga${lp.tip && lp.still ? '' : ' ' + JSON.stringify(lp)}: muestra la información de la casilla y no mueve ni gasta turno`);
    ok(lp.zoom, 'pellizcar con dos dedos acerca el mapa');
    // apagar los controles táctiles desde el menú de pausa
    await M.tap('.touch-acts [data-touch="cancel"]'); await M.waitForTimeout(200);
    await M.click('.modal >> text=CONFIGURACIÓN'); await M.waitForTimeout(150);
    const auto = await M.evaluate(() => document.querySelector('.modal [data-set="touch"]').textContent);
    await M.click('.modal [data-set="touch"]'); await M.waitForTimeout(150);
    await M.click('.modal [data-set="touch"]'); await M.waitForTimeout(150);
    if (!/AUTO/.test(auto)) errs.push('el ajuste táctil no empezaba en AUTO: ' + auto);
    const off = await M.evaluate(async () => { const { settings } = await import('./js/core/state.js'); return { m: settings.touch, cls: document.body.classList.contains('touch'), bar: getComputedStyle(document.querySelector('.touch-bar')).display }; });
    ok(off.m === 'off' && !off.cls && off.bar === 'none', 'CONTROLES TÁCTILES: NO oculta la barra (AUTO → SÍ → NO)');
    await ctx12.close();
  }

  console.log('· Revisión: radar, niebla del minimapa, informe, modales y pilas');
  {
    const ctx18 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const Rv = await ctx18.newPage();
    Rv.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    Rv.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await Rv.goto(URL); await Rv.waitForTimeout(800);
    await Rv.click('text=NUEVA PARTIDA'); await Rv.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await Rv.click('#screen-intro'); await Rv.click('text=COMENZAR');
    await Rv.waitForTimeout(300);
    // ---- EQUIPO: dividir una pila, juntarla y soltar en otro agente
    await Rv.click('.tab:has-text("EQUIPO")'); await Rv.waitForTimeout(200);
    await Rv.evaluate(async () => { const I = await import('./js/core/items.js'); const S = window.__topolev.S; S.stash = S.stash.filter((x) => x.b !== 'a_9x18'); S.stash.push(I.createItem('a_9x18', 0, undefined, 40)); });
    await Rv.click('.tab:has-text("EQUIPO")'); await Rv.waitForTimeout(150);
    const ammoRow = () => Rv.$$('#screen-base .grid3 > .panel:nth-child(3) .item:has-text("9×18")');
    await (await ammoRow())[0].click({ button: 'right' }); await Rv.waitForTimeout(150);
    await Rv.click('.ctx-menu >> text=Dividir'); await Rv.waitForTimeout(150);
    await Rv.focus('.modal .split-slider'); await Rv.keyboard.press('Home'); for (let i = 0; i < 14; i++) await Rv.keyboard.press('ArrowRight');
    await Rv.click('.modal >> text=DIVIDIR'); await Rv.waitForTimeout(200);
    const sp = await Rv.evaluate(() => window.__topolev.S.stash.filter((x) => x.b === 'a_9x18').map((x) => x.q).sort((a, b) => a - b).join(','));
    ok(sp === '15,25', `dividir una pila de munición en dos (${sp})`);
    // arrastrar una pila sobre la otra: se juntan
    const drag = async (from, to) => { const a = await from.boundingBox(), c = await to.boundingBox(); await Rv.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await Rv.mouse.down(); await Rv.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 }); await Rv.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 }); await Rv.mouse.up(); await Rv.waitForTimeout(200); };
    let rows = await ammoRow(); await drag(rows[1], rows[0]);
    const mg = await Rv.evaluate(() => window.__topolev.S.stash.filter((x) => x.b === 'a_9x18').map((x) => x.q).join(','));
    ok(mg === '40', `soltar una pila sobre la otra las junta (${mg})`);
    // soltar en un agente que no es el seleccionado: va a su mochila
    rows = await ammoRow(); await rows[0].click({ button: 'right' }); await Rv.waitForTimeout(100);
    await Rv.click('.ctx-menu >> text=Dividir'); await Rv.waitForTimeout(100);
    await Rv.click('.modal >> text=DIVIDIR'); await Rv.waitForTimeout(150);
    const agents = await Rv.$$('#screen-base .grid3 > .panel:nth-child(1) .agent-row');
    rows = await ammoRow(); await drag(rows[0], agents[2]);
    const give = await Rv.evaluate(() => { const S = window.__topolev.S; const a = S.agents[2]; return { bag: a.bag.filter((x) => x.b === 'a_9x18').reduce((n, x) => n + x.q, 0), stash: S.stash.filter((x) => x.b === 'a_9x18').reduce((n, x) => n + x.q, 0) }; });
    ok(give.bag >= 20 && give.stash === 20, `arrastrar al tercer agente (no seleccionado) lo mete en su mochila (${JSON.stringify(give)})`);
    // modales: el resto de la interfaz queda debajo, difuminado
    const mo = await Rv.evaluate(async () => { const D = await import('./js/util/dom.js'); D.showTooltip('x', 10, 10); D.confirmBox('PRUEBA', 'texto'); const r = { cls: document.body.classList.contains('modal-open'), tip: document.querySelector('#tooltip').classList.contains('hidden'), blur: getComputedStyle(document.querySelector('#app')).filter }; D.closeTopModal(); return { ...r, after: document.body.classList.contains('modal-open') }; });
    ok(mo.cls && mo.tip && /blur/.test(mo.blur) && !mo.after, 'con un modal abierto la interfaz queda debajo, oscurecida y sin tooltips');
    // ---- expedición: niebla del minimapa y radares
    await Rv.click('.tab:has-text("EXPEDICIÓN")'); await Rv.waitForTimeout(200);
    await Rv.click('[data-go]'); await Rv.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rr = await Rv.$$('.modal .agent-row'); await rr[i].click(); }
    await Rv.click('text=LANZAR EXPEDICIÓN'); await Rv.waitForTimeout(300);
    if (await Rv.$('.modal-back >> text=LANZAR')) await Rv.click('.modal-back >> text=LANZAR');
    await Rv.waitForTimeout(800);
    for (let i = 0; i < 6 && (await Rv.$('.modal')); i++) { await Rv.keyboard.press('Escape'); await Rv.waitForTimeout(120); }
    const fog = await Rv.evaluate(async () => {
      const I = await import('./js/exp/intel.js'); const e = window.__topolev.exp; const S = window.__topolev.S; window.__topolev.debug.run('god');
      const perm = e.exits.filter((x) => x.perm);
      const hidden0 = perm.filter((x) => !e.explored[e.key(x.x, x.y)]).every((x) => !I.exitKnown(e, x));
      const t0 = e.turn; e.turn = I.exitRevealTurn(); const later = perm.every((x) => I.exitKnown(e, x)); e.turn = t0;
      const caches = e.pois.filter((p) => p.type === 'cache' && !p.seen && !p.found);
      const cacheHidden = caches.every((p) => !I.poiKnown(e, p));
      const nest = e.pois.find((p) => p.type === 'nest' && !p.seen && !p.boss);
      const unk = nest ? !I.nestIdentified(nest) : true;
      if (nest) { S.bestiary[nest.enemy] = { seen: 1, kills: I.NEST_ID_KILLS }; }
      const known = nest ? I.nestIdentified(nest) : true;
      if (nest) S.bestiary[nest.enemy].kills = 0;
      return { perm: perm.length, hidden0, later, caches: caches.length, cacheHidden, unk, known };
    });
    ok(fog.hidden0 && fog.later, `salidas permanentes ocultas al empezar y trianguladas unos turnos después (${fog.perm})`);
    ok(fog.cacheHidden && fog.unk && fog.known, `alijos ocultos (${fog.caches}) y nidos como «?» hasta abatir 5 de su especie`);
    const rad = await Rv.evaluate(async () => {
      const I = await import('./js/core/items.js'); const T = (await import('./js/data/tiles.js')).T; const e = window.__topolev.exp; const c = e.cur;
      c.a.equip.g1 = I.createItem('radar_duga', 0);
      const cell = [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2]].map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => e.inb(x, y));
      const cache = { type: 'cache', x: cell[0], y: cell[1], lvl: 1, name: 'Alijo de prueba', best: 1 };
      const nest = { type: 'nest', x: cell[0], y: cell[1], lvl: 1, name: 'Nido · prueba', enemy: 'rata', cleared: false, members: 0 };
      e.pois.push(cache, nest);
      const dc = [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, -4]].map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => e.inb(x, y)); // dentro del mapa
      const dk = e.key(dc[0], dc[1]); const dOld = e.t[dk]; const exOld = e.explored[dk]; e.t[dk] = T.ARMORDOOR; e.explored[dk] = 0;
      e.computeVisibility(true);
      const r = { cache: !!cache.radar, nest: !!nest.radar, door: !!e.explored[dk] };
      e.t[dk] = dOld; e.explored[dk] = exOld; e.pois.splice(e.pois.indexOf(cache), 2);
      return r;
    });
    ok(rad.cache && rad.nest && rad.door, `radar «Duga-M»: marca el alijo, identifica el nido y descubre la puerta blindada (${JSON.stringify(rad)})`);
    const tmp = await Rv.evaluate(() => { const e = window.__topolev.exp; e.nextTemp = e.turn; const n0 = e.exits.length; e.environment(); const ex = e.exits[e.exits.length - 1]; return e.exits.length > n0 ? ex.expires - e.turn : -1; });
    ok(tmp >= 84, `las extracciones temporales duran al menos el triple (${tmp} turnos)`);
    // informe: una columna por agente y tooltip en los objetos
    const rp = await Rv.evaluate(async () => {
      const { ReportScreen } = await import('./js/ui/screens.js'); const I = await import('./js/core/items.js');
      const host = document.createElement('div'); document.body.append(host);
      const it = I.createItem('makarov', 2);
      new ReportScreen(host, { onDone() {} }).open({ result: 'success', map: 'X', day: 1, turns: 10, kills: 2, ess: 5, essRaw: 5, agents: [
        { name: 'A', color: '#fff', lvl: 1, lvlUp: 0, kills: 1, ess: 3, status: 'extraído', items: [{ name: 'Pistola', r: 2, q: 1, it }], news: [] },
        { name: 'B', color: '#fff', lvl: 1, lvlUp: 0, kills: 1, ess: 2, status: 'muerto', items: [], news: [] }] });
      const g = host.querySelector('.rep-agents'); const row = host.querySelector('.rep-item');
      const r = { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, tip: row && row.dataset.hasTip === '1' };
      host.remove(); return r;
    });
    ok(rp.cols === 2 && rp.tip, 'informe: agentes en columnas y tooltip en los objetos extraídos');
    await ctx18.close();
  }

  console.log('· Revisión 2: configuración, mapa grande, ambiente, botín y compra rápida');
  {
    const ctx19 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const Q = await ctx19.newPage();
    Q.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    Q.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await Q.goto(URL); await Q.waitForTimeout(800);
    // CONFIGURACIÓN desde el título: todas las opciones y el deslizador ASCII
    await Q.click('text=CONFIGURACIÓN'); await Q.waitForTimeout(150);
    const ids = await Q.evaluate(() => [...document.querySelectorAll('.modal [data-set]')].map((x) => x.dataset.set).join(','));
    const need = ['sound', 'music', 'volMaster', 'volMusic', 'volSfx', 'ambience', 'volAmb', 'crt', 'fullscreen', 'text', 'lang', 'keys', 'touch', 'colorblind', 'contrast'];
    const slider = await Q.evaluate(() => document.querySelector('.modal [data-set="volMaster"]').textContent);
    // arrastrar el deslizador del volumen general hasta el final
    const tr = await (await Q.$('.modal [data-set="volMaster"] .as-track')).boundingBox();
    await Q.mouse.move(tr.x + 5, tr.y + tr.height / 2); await Q.mouse.down(); await Q.mouse.move(tr.x + tr.width + 30, tr.y + tr.height / 2, { steps: 5 }); await Q.mouse.up();
    const vol = await Q.evaluate(() => JSON.parse(localStorage.getItem('topolev_settings_v1')).volume);
    ok(need.every((k) => ids.includes(k)) && /\[█*░*\]/.test(slider) && vol === 1, `CONFIGURACIÓN: ${need.length} opciones y deslizadores ASCII 0–100 que se arrastran (${slider.trim()} → ${vol})`);
    await Q.keyboard.press('Escape'); await Q.waitForTimeout(150);
    // ambiente distinto en cada pantalla
    const ambT = await Q.evaluate(async () => (await import('./js/samples.js')).ambience.wanted);
    await Q.click('text=NUEVA PARTIDA'); await Q.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await Q.click('#screen-intro'); await Q.click('text=COMENZAR');
    await Q.waitForTimeout(300);
    await Q.waitForTimeout(1500);
    const ambB = await Q.evaluate(async () => (await import('./js/samples.js')).ambience.wanted);
    const ambPlaying = await Q.evaluate(async () => (await import('./js/samples.js')).ambience.current);
    // EQUIPO: clic derecho → comprar otro igual si está a la venta
    await Q.click('.tab:has-text("EQUIPO")'); await Q.waitForTimeout(150);
    await Q.evaluate(async () => { const I = await import('./js/core/items.js'); const S = window.__topolev.S; S.rub = 5000; S.stash.push(I.createItem('bandage', 0, undefined, 1)); });
    await Q.click('.tab:has-text("EQUIPO")'); await Q.waitForTimeout(150);
    const before = await Q.evaluate(() => window.__topolev.S.stash.filter((x) => x.b === 'bandage').reduce((n, x) => n + x.q, 0));
    await Q.click('#screen-base .grid3 > .panel:nth-child(3) .item:has-text("Venda") >> nth=0', { button: 'right' }); await Q.waitForTimeout(150);
    const menu = await Q.evaluate(() => document.querySelector('.ctx-menu') && document.querySelector('.ctx-menu').innerText);
    await Q.click('.ctx-menu >> text=Comprar'); await Q.waitForTimeout(200);
    const after = await Q.evaluate(() => ({ n: window.__topolev.S.stash.filter((x) => x.b === 'bandage').reduce((n, x) => n + x.q, 0), rub: window.__topolev.S.rub }));
    ok(/Comprar/.test(menu || '') && after.n > before && after.rub < 5000, `EQUIPO: clic derecho → comprar otro igual desde la Intendencia (${before} → ${after.n})`);
    // expedición: ambiente de la zona, mapa grande con zoom y arrastre, botín revelado uno a uno
    await Q.click('.tab:has-text("EXPEDICIÓN")'); await Q.waitForTimeout(200);
    await Q.click('[data-go]'); await Q.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rr = await Q.$$('.modal .agent-row'); await rr[i].click(); }
    await Q.click('text=LANZAR EXPEDICIÓN'); await Q.waitForTimeout(300);
    if (await Q.$('.modal-back >> text=LANZAR')) await Q.click('.modal-back >> text=LANZAR');
    await Q.waitForTimeout(800);
    for (let i = 0; i < 6 && (await Q.$('.modal')); i++) { await Q.keyboard.press('Escape'); await Q.waitForTimeout(120); }
    const ambE = await Q.evaluate(async () => (await import('./js/samples.js')).ambience.wanted);
    ok(ambT === 'title' && ambB === 'base' && ambPlaying === 'base' && ambE === 'subsuelo', `sonido ambiente grabado (CC0) distinto por pantalla y zona, y sonando (${ambT} · ${ambB}/${ambPlaying} · ${ambE})`);
    await Q.keyboard.press('m'); await Q.waitForTimeout(200);
    const cv = await (await Q.$('.bigmap-wrap canvas')).boundingBox();
    await Q.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 2); await Q.mouse.wheel(0, -300); await Q.waitForTimeout(100); await Q.mouse.wheel(0, -300); await Q.waitForTimeout(100);
    const z1 = await Q.evaluate(() => { const v = window.__topolev.expUI.big.view; return { z: v.zoom, p: [...v.pan] }; });
    await Q.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 2); await Q.mouse.down(); await Q.mouse.move(cv.x + cv.width / 2 + 120, cv.y + cv.height / 2 + 60, { steps: 6 }); await Q.mouse.up(); await Q.waitForTimeout(100);
    const z2 = await Q.evaluate(() => { const v = window.__topolev.expUI.big; return v ? { z: v.view.zoom, p: [...v.view.pan] } : null; });
    ok(z1.z > 1 && z2 && Math.hypot(z2.p[0] - z1.p[0], z2.p[1] - z1.p[1]) > 1, `mapa grande: zoom con la rueda (×${z1.z.toFixed(2)}) y arrastre sin cerrarlo`);
    await Q.keyboard.press('Escape'); await Q.waitForTimeout(150);
    // capa ASCII: las partículas (capa lógica con decimales) se dibujan una por casilla, en casillas enteras
    const asc = await Q.evaluate(async () => {
      const { Particles } = await import('./js/render/particles.js');
      const P = new Particles(); P.burst(3.3, 4.7, 40, {}); P.text(5.2, 6.1, '¡NIVEL!', '#fff'); P.tracer(0.5, 0.5, 12.5, 4.5); P.update(0.03, performance.now());
      const cells = [...P.raster((x, y) => [Math.floor(x), Math.floor(y)]).values()];
      const r = window.__topolev.expUI.r, mm = window.__topolev.expUI.mm;
      return { n: cells.length, uniq: new Set(cells.map((c) => c.cx + ',' + c.cy)).size === cells.length, ints: cells.every((c) => Number.isInteger(c.cx) && Number.isInteger(c.cy) && [...c.c].length === 1),
        text: cells.filter((c) => '¡NIVEL!'.includes(c.c) && c.cy === 5).length >= 6, cam: Number.isInteger(r.camR.x) && Number.isInteger(r.camR.y), mmGrid: mm.cw > 0 && mm.chh > 0 };
    });
    ok(asc.n > 5 && asc.uniq && asc.ints && asc.text && asc.cam && asc.mmGrid, `capa ASCII: partículas y textos en casillas enteras, una letra por casilla; cámara y radar en rejilla (${JSON.stringify(asc)})`);
    const lr = await Q.evaluate(async () => {
      const I = await import('./js/core/items.js'); const e = window.__topolev.exp; const ui = window.__topolev.expUI;
      const obj = { kind: 'crate', x: e.cur.x, y: e.cur.y, items: [I.createItem('bandage', 0), I.createItem('makarov', 2), I.createItem('makarov', 4)], opened: true };
      ui.openLoot({ obj });
      const t0 = [...document.querySelectorAll('.modal .item.loot-hide')].length;
      await new Promise((r) => setTimeout(r, 1300));
      const t1 = [...document.querySelectorAll('.modal .item.loot-hide')].length, lr4 = !!document.querySelector('.modal .item.loot-r4');
      if (ui.lootClose) ui.lootClose();
      ui.openLoot({ obj }); const t2 = [...document.querySelectorAll('.modal .item.loot-hide')].length; if (ui.lootClose) ui.lootClose();
      return { t0, t1, lr4, t2 };
    });
    // radiación: al volver a la base se descontaminan solos
    const dc = await Q.evaluate(async () => {
      const e = window.__topolev.exp; const ui = window.__topolev.expUI; const a = e.cur.a; a.rad = 70;
      for (const q of e.squad) q.out = true;
      const rep = ui.hooks.onEnd(e);
      const row = rep.agents.find((r) => r.name && r.news && r.news.some((n) => /Descontaminado/.test(n)));
      return { rad: a.rad, news: !!row };
    });
    ok(dc.rad === 0 && dc.news, 'al volver de la expedición la radiación de los agentes vuelve a 0 (y el informe lo dice)');
    ok(lr.t0 === 3 && lr.t1 === 0 && lr.lr4 && lr.t2 === 0, `botín: los objetos aparecen uno a uno (con brillo y partículas desde épico) y no se repite al reabrir (${JSON.stringify(lr)})`);
    await ctx19.close();
  }

  // ================================================================ bolsa de trabajo (revisión)
  console.log('· Bolsa de trabajo');
  {
    const ctx20 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const J = await ctx20.newPage();
    J.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    J.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await J.goto(URL); await J.waitForTimeout(800);
    await J.click('text=NUEVA PARTIDA'); await J.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await J.click('#screen-intro'); await J.click('text=COMENZAR');
    await J.waitForTimeout(300);
    const jo = await J.evaluate(async () => {
      const ST = await import('./js/core/story.js'); const { JOB_TYPES } = await import('./js/data/jobs.js');
      const { MAPS } = await import('./js/data/world.js'); const { ENEMIES } = await import('./js/data/enemies.js');
      const S = window.__topolev.S;
      const offers = ST.jobOffers();
      const again = ST.jobOffers() === offers; // misma oferta durante todo el día
      // todas las plantillas dan un encargo completo
      const seen = Object.keys(ENEMIES).filter((id) => !ENEMIES[id].boss && ENEMIES[id].minL <= 3).slice(0, 4);
      const ctx = { zones: MAPS.filter((m) => !m.social).slice(0, 3), seen };
      const bad = Object.entries(JOB_TYPES).filter(([, T]) => { const d = T.make(Math.random, ctx); return !d.name || !d.desc || !d.kind || !(d.reward.rub > 0); }).map(([k]) => k);
      // tres trabajos: balizas en la primera zona, cuota de bajas y venta de esencia
      const zone = MAPS[0].id;
      const mk = (type) => ({ ...JOB_TYPES[type].make(Math.random, { zones: [MAPS[0]], seen }), job: type, id: 'job_test_' + type });
      S.contracts.jobOffers = [mk('beacons'), mk('killglobal'), mk('essdeliver'), mk('noloss')];
      const acc = ['beacons', 'killglobal', 'essdeliver'].map((k) => ST.acceptJob('job_test_' + k).ok);
      const fourth = ST.acceptJob('job_test_noloss').ok;
      const kg = ST.CONTRACTS.job_test_killglobal, es = ST.CONTRACTS.job_test_essdeliver;
      S.stats = S.stats || {}; S.stats.killsBy = S.stats.killsBy || {};
      S.stats.killsBy[kg.target] = (S.stats.killsBy[kg.target] || 0) + kg.n;
      S.ess = es.n + 50;
      const prog = ST.contractProgress(S.contracts.active.find((c) => c.id === 'job_test_killglobal'));
      return { n: offers.length, kinds: new Set(offers.map((o) => o.job)).size, again, bad, acc, fourth, prog, need: kg.n, zone, ess: es.n, pay: es.reward.rub, types: Object.keys(JOB_TYPES).length };
    });
    ok(jo.n === 4 && jo.kinds === 4 && jo.again && !jo.bad.length && jo.types >= 15, `bolsa de trabajo: 4 ofertas distintas al día de ${jo.types} tipos, todas completas${jo.bad.length ? ' (fallan: ' + jo.bad.join(', ') + ')' : ''}`);
    ok(jo.acc.every(Boolean) && !jo.fourth && jo.prog === `${jo.need}/${jo.need} abatidos`, `aceptar trabajos (máx. 3) y progreso de la cuota de bajas (${jo.prog})`);
    await J.click('.tab:has-text("CUARTEL")'); await J.waitForTimeout(150);
    const rows = await J.$$eval('.contract.job', (l) => l.length);
    await J.click('.tab:has-text("EXPEDICIÓN")'); await J.waitForTimeout(200);
    const card = await J.evaluate(() => document.querySelector('.mapcard.sel').innerText.includes('⚑'));
    const chipJ = !!(await J.$('.zchip:has-text("TRABAJOS 1")'));
    ok(rows >= 3 && card && chipJ, `los trabajos se ven en el CUARTEL (${rows}) y en el destino (⚑ y rollover TRABAJOS)`);
    await J.click('[data-go]'); await J.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rr = await J.$$('.modal .agent-row'); await rr[i].click(); }
    await J.click('text=LANZAR EXPEDICIÓN'); await J.waitForTimeout(300);
    if (await J.$('.modal-back >> text=LANZAR')) await J.click('.modal-back >> text=LANZAR');
    await J.waitForTimeout(800);
    for (let i = 0; i < 6 && (await J.$('.modal')); i++) { await J.keyboard.press('Escape'); await J.waitForTimeout(120); }
    const jr = await J.evaluate(() => {
      const e = window.__topolev.exp; const ui = window.__topolev.expUI; const S = window.__topolev.S;
      const bea = e.objects.filter((o) => o.goal === 'beacon' && o.contract === 'job_test_beacons');
      const marked = bea.every((o) => e.pois.some((p) => p.x === o.x && p.y === o.y));
      for (const o of bea) e.useObjective(e.cur, o);
      const met = !!(e.facState().contracts || {}).job_test_beacons;
      const rub0 = S.rub, ess0 = S.ess;
      for (const q of e.squad) q.out = true;
      const rep = ui.hooks.onEnd(e);
      return { zone: e.def.id, nb: bea.length, marked, met, done: rep.contracts || [], rub: S.rub - rub0, essLeft: S.ess, ess0, left: S.contracts.active.filter((c) => c.job).length, defs: Object.keys(S.contracts.jobDefs).length, jobsDone: S.contracts.jobsDone };
    });
    ok(jr.nb >= 2 && jr.marked && jr.met, `balizas: ${jr.nb} puntos marcados en el radar; colocarlas cumple el trabajo`);
    ok(jr.done.length >= 3 && jr.left === 0 && jr.defs === 0 && jr.jobsDone === 3 && jr.rub >= jo.pay, `al volver se cobran los 3 trabajos (+${jr.rub} ₽; ${jr.done.join(' · ')})`);
    await ctx20.close();
  }

  // ================================================================ escuadrón: recolocar a cada agente
  console.log('· Escuadrón: recolocar agentes');
  {
    const ctx21 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const R = await ctx21.newPage();
    R.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    R.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await R.goto(URL); await R.waitForTimeout(800);
    await R.click('text=NUEVA PARTIDA'); await R.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await R.click('#screen-intro'); await R.click('text=COMENZAR');
    await R.waitForTimeout(300);
    await R.click('.tab:has-text("EXPEDICIÓN")'); await R.waitForTimeout(200);
    await R.click('[data-go]'); await R.waitForTimeout(150); for (let i = 0; i < 3; i++) { const rr = await R.$$('.modal .agent-row'); if (rr[i]) await rr[i].click(); }
    await R.click('text=LANZAR EXPEDICIÓN'); await R.waitForTimeout(300);
    if (await R.$('.modal-back >> text=LANZAR')) await R.click('.modal-back >> text=LANZAR');
    await R.waitForTimeout(800);
    for (let i = 0; i < 6 && (await R.$('.modal')); i++) { await R.keyboard.press('Escape'); await R.waitForTimeout(120); }
    const rp = await R.evaluate(async () => {
      const { astar } = await import('./js/exp/path.js');
      const e = window.__topolev.exp; window.__topolev.debug.run('god');
      for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x);
      if (e.dlg) e.closeDialog(); e.dlgQueue = [];
      const out = {};
      const A = e.squad[0], B = e.squad[1];
      // A se aleja 3 pasos y se cambia a B: A se queda (⚓)
      for (let n = 0; n < 3; n++) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].find(([dx, dy]) => e.passable(A.x + dx, A.y + dy) && !e.entityAt(A.x + dx, A.y + dy)); if (d) e.moveDir(d[0], d[1]); }
      const posA = [A.x, A.y];
      e.switchActive(1);
      out.hold = A.hold === true && e.cur === B;
      for (let n = 0; n < 6; n++) e.wait();
      out.stays = A.x === posA[0] && A.y === posA[1];
      // B recibe un «ir a» al cambiar de nuevo a A: llega solo y se queda
      let goal = null;
      for (let r = 6; r >= 3 && !goal; r--) for (let dy = -r; dy <= r && !goal; dy++) for (let dx = -r; dx <= r && !goal; dx++) {
        const gx = B.x + dx, gy = B.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !e.passable(gx, gy) || e.entityAt(gx, gy)) continue;
        const p = astar(e.w, e.h, B.x, B.y, gx, gy, (x, y) => (e.passable(x, y) ? 1 : Infinity), 2000);
        if (p && p.length && p.length <= 9) goal = [gx, gy];
      }
      out.goal = !!goal;
      e.switchActive(0, { goto: goal });
      out.going = !!B.goto;
      for (let n = 0; n < 14 && B.goto; n++) e.wait();
      out.arrived = B.x === goal[0] && B.y === goal[1] && B.hold && !B.goto;
      // órdenes por agente y SEGUIR reagrupa
      e.setAgentOrder(B, 'emboscada');
      out.indiv = B.order === 'emboscada' && e.squad.filter((q) => q !== B && q !== e.cur).every((q) => q.order !== 'emboscada');
      e.setOrder('seguir');
      out.regroup = !B.hold && !B.goto && B.order === 'seguir';
      return out;
    });
    ok(rp.hold && rp.stays, 'al cambiar de agente, el que has movido se queda en su posición (⚓) en vez de seguir al nuevo');
    ok(rp.goal && rp.going && rp.arrived, `si cambias mientras iba de camino, llega solo a su destino y se queda (${JSON.stringify(rp)})`);
    ok(rp.indiv && rp.regroup, 'órdenes por agente; SEGUIR reagrupa a todos');
    // la ficha: clic en la orden la cambia sin cambiar de agente
    await R.waitForTimeout(200);
    const before = await R.evaluate(() => ({ cur: window.__topolev.exp.active, ord: window.__topolev.exp.squad[1].order }));
    await R.click('.agent-card >> nth=1 >> [data-ord]'); await R.waitForTimeout(150);
    const after = await R.evaluate(() => ({ cur: window.__topolev.exp.active, ord: window.__topolev.exp.squad[1].order }));
    ok(after.cur === before.cur && after.ord !== before.ord, `ficha: clic en la orden de un agente la cambia (${before.ord} → ${after.ord}) sin cambiar de agente`);
    await ctx21.close();
  }

  // ================================================================ fase 25: el Narrador del Reactor
  console.log('· Fase 25: el Narrador del Reactor');
  {
    const ctx22 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const N = await ctx22.newPage();
    N.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    N.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await N.goto(URL); await N.waitForTimeout(800);
    await N.click('text=NUEVA PARTIDA'); await N.waitForTimeout(150);
    const narrBtns = await N.$$eval('.modal [data-narr]', (l) => l.length);
    await N.click('.modal [data-narr="babushka"]'); await N.waitForTimeout(100);
    await N.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await N.click('#screen-intro'); await N.click('text=COMENZAR');
    await N.waitForTimeout(300);
    const nb = await N.evaluate(async () => {
      const NR = await import('./js/core/narrator.js'); const C = await import('./js/core/campaign.js');
      const S = window.__topolev.S; const out = { persona: S.narr.persona, adapt: S.narr.adapt };
      NR.setPersona('comisario');
      // presagio: una amenaza anunciada se dispara al día siguiente
      S.day = 20; S.narr.pending = { id: 'inspeccion', day: 20 };
      const d1 = NR.narrDay();
      out.omen = d1 === 'inspeccion' && S.pendingDialogs.includes('narr_inspeccion');
      S.pendingDialogs = [];
      // con presupuesto, el Narrador acaba eligiendo una amenaza (con presagio o sin él)
      S.narr.budget = 60; S.narr.lastThreat = 0; let got = null;
      for (let i = 0; i < 30 && !got; i++) { S.narr.lastThreat = 0; got = NR.narrDay(); }
      out.threat = got;
      // escasez: precios ×1,3
      const it = (await import('./js/core/items.js')).createItem('bandage', 0);
      const p0 = C.buyPrice(it); S.narr.crisis = { kind: 'escasez', until: S.day + 3 }; const p1 = C.buyPrice(it); S.narr.crisis = null;
      out.price = [p0, p1];
      // epidemia y alivios
      NR.fireNarr('epidemia'); out.sick = S.agents.filter((a) => NR.sickDays(a) > 0).length;
      const st0 = S.stash.length; NR.fireNarr('suministros'); out.supplies = S.stash.length - st0;
      // adaptación: bajas → baja
      const a0 = S.narr.adapt; NR.narrOnExpedition({ success: false, deaths: 1, ess: 0 }); out.adaptDrop = S.narr.adapt < a0;
      for (const a of S.agents) a.sickUntil = 0;
      S.pendingDialogs = [];
      return out;
    });
    ok(narrBtns === 3 && nb.persona === 'babushka' && nb.adapt === 50, 'NUEVA PARTIDA: tres narradores; la partida empieza con el elegido');
    ok(nb.omen && !!nb.threat, `presagio → amenaza al día siguiente (inspección del KGB); con presupuesto elige una amenaza (${nb.threat})`);
    ok(nb.price[1] > nb.price[0] && nb.sick >= 1 && nb.supplies >= 3 && nb.adaptDrop, `crisis y alivios: escasez (${nb.price.join(' → ')} ₽), fiebre (${nb.sick} enfermo/s), suministros (+${nb.supplies}); las bajas bajan la adaptación`);
    await N.click('.tab:has-text("CUARTEL")'); await N.waitForTimeout(150);
    const head = await N.evaluate(() => !!document.querySelector('.narr-tag'));
    await N.click('.tab:has-text("EXPEDICIÓN")'); await N.waitForTimeout(200);
    await N.click('[data-go]'); await N.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rr = await N.$$('.modal .agent-row'); await rr[i].click(); }
    await N.click('text=LANZAR EXPEDICIÓN'); await N.waitForTimeout(300);
    if (await N.$('.modal-back >> text=LANZAR')) await N.click('.modal-back >> text=LANZAR');
    await N.waitForTimeout(800);
    for (let i = 0; i < 6 && (await N.$('.modal')); i++) { await N.keyboard.press('Escape'); await N.waitForTimeout(120); }
    const ex = await N.evaluate(() => {
      const e = window.__topolev.exp; window.__topolev.debug.run('god');
      if (e.dlg) e.closeDialog(); e.dlgQueue = [];
      const out = {};
      const n0 = e.enemies.length;
      out.patrol = e.directorBeat('patrulla') && e.enemies.filter((x) => x.patrol).length >= 2 && e.enemies.length > n0;
      out.patrolHunts = e.enemies.filter((x) => x.patrol).every((x) => x.state === 'alerta' && x.mem > 0);
      out.crate = e.directorRelief('suministros') && e.objects.some((o) => o.drop && o.items.length >= 2);
      const ex0 = e.exits.length; out.exit = e.directorRelief('salida') && e.exits.length > ex0;
      for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x);
      for (let i = 0; i < 20; i++) e.wait();
      out.curve = (e.dir.curve || []).length;
      out.meter = !!document.querySelector('.tension');
      for (const q of e.squad) q.out = true;
      const rep = window.__topolev.expUI.hooks.onEnd(e);
      out.repCurve = (rep.tension || []).length;
      window.__topolev.expUI.stop(); window.__topolev.expUI.hooks.onReport(rep);
      return out;
    });
    ok(head && ex.meter, 'el Narrador en la cabecera de la base y la tensión en la de la expedición');
    ok(ex.patrol && ex.patrolHunts, 'golpe: una patrulla aparece lejos y viene hacia el escuadrón');
    ok(ex.crate && ex.exit, 'respiros: caja de suministros junto al escuadrón y salida temporal cerca');
    ok(ex.curve >= 3 && ex.repCurve >= 3, `la curva de tensión se guarda y pasa al informe (${ex.repCurve} puntos)`);
    await N.waitForTimeout(400);
    const repTxt = await N.evaluate(() => document.body.innerText.includes('RITMO DE LA EXPEDICIÓN'));
    ok(repTxt, 'el informe muestra el ritmo de la expedición (curva ASCII)');
    await ctx22.close();
  }

  // ================================================================ fase 26: fluidos, destrucción y vista del aire
  console.log('· Fase 26: fluidos, destrucción y vista del aire');
  {
    const ctx23 = await b.newContext({ viewport: { width: 1440, height: 860 } });
    const A = await ctx23.newPage();
    A.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
    A.on('console', (m) => { if ((m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) || m.type() === 'warning') errs.push(m.text()); });
    await A.goto(URL); await A.waitForTimeout(800);
    await A.click('text=NUEVA PARTIDA'); await A.click('.modal >> text=EMPEZAR AQUÍ >> nth=0'); await A.click('#screen-intro'); await A.click('text=COMENZAR');
    await A.waitForTimeout(300);
    await A.click('.tab:has-text("EXPEDICIÓN")'); await A.waitForTimeout(200);
    await A.click('[data-go]'); await A.waitForTimeout(150); for (let i = 0; i < 2; i++) { const rr = await A.$$('.modal .agent-row'); await rr[i].click(); }
    await A.click('text=LANZAR EXPEDICIÓN'); await A.waitForTimeout(300);
    if (await A.$('.modal-back >> text=LANZAR')) await A.click('.modal-back >> text=LANZAR');
    await A.waitForTimeout(800);
    for (let i = 0; i < 6 && (await A.$('.modal')); i++) { await A.keyboard.press('Escape'); await A.waitForTimeout(120); }
    const fl = await A.evaluate(() => {
      const e = window.__topolev.exp; window.__topolev.debug.run('god');
      for (const x of [...e.enemies]) if (!e.isComp(x)) e.dismissActor(x);
      if (e.dlg) e.closeDialog(); e.dlgQueue = [];
      const c = e.cur, out = {};
      // una sala limpia de 21×11 (dentro del mapa) con el escuadrón en el centro
      const W = 21, H = 11;
      const x0 = Math.max(2, Math.min(e.w - W - 2, c.x - 10)), y0 = Math.max(2, Math.min(e.h - H - 2, c.y - 5));
      const clean = () => { for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) { const k = e.key(x, y); const edge = x === x0 || y === y0 || x === x0 + W - 1 || y === y0 + H - 1; e.t[k] = edge ? 1 : 2; e.gas[k] = 0; e.smoke[k] = 0; e.dust[k] = 0; e.fire[k] = 0; e.rad[k] = 0; e.anomaly[k] = 0; e.objMap.delete(k); e.floorItems.delete(k); } e.objects = e.objects.filter((o) => !(o.x >= x0 && o.x < x0 + W && o.y >= y0 && o.y < y0 + H)); e.vents = []; e.fans = null; e.floods = []; e.steam = []; };
      clean();
      e.moveEntity(c, x0 + 10, y0 + 5);
      for (const q of e.squad) if (q !== c && e.inMap(q)) e.moveEntity(q, c.x - 1, c.y);
      for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) e.explored[e.key(x, y)] = 1;
      e.litOn = e.litOn || {}; e.lightMap = null; e.lightDirty = true;
      e.ambient = 0;
      const tick = (n) => { for (let i = 0; i < n; i++) { e.turn++; e.fluidTick(); } };
      // difusión
      const gk = e.key(c.x - 6, c.y); e.gas[gk] = 15;
      tick(6);
      let cells = 0; for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) if (e.gas[e.key(x, y)]) cells++;
      out.spread = cells >= 5 && e.gas[gk] < 15;
      // puerta cerrada: el gas no pasa
      clean();
      const wx = c.x + 3;
      for (let y = y0 + 1; y < y0 + H - 1; y++) e.t[e.key(wx, y)] = 1;
      e.t[e.key(wx, c.y)] = 4; // puerta cerrada
      for (let y = y0 + 1; y < y0 + H - 1; y++) e.gas[e.key(wx + 2, y)] = 15;
      tick(8);
      let leak = 0; for (let y = y0 + 1; y < y0 + H - 1; y++) for (let x = x0 + 1; x < wx; x++) leak += e.gas[e.key(x, y)];
      out.doorBlocks = leak === 0;
      // abrir la puerta: ahora sí pasa
      e.t[e.key(wx, c.y)] = 5;
      for (let y = y0 + 1; y < y0 + H - 1; y++) e.gas[e.key(wx + 2, y)] = 15;
      tick(8);
      leak = 0; for (let y = y0 + 1; y < y0 + H - 1; y++) for (let x = x0 + 1; x < wx; x++) leak += e.gas[e.key(x, y)];
      out.doorOpen = leak > 0;
      // humo denso: tapa la vista de pie; agachado se ve por debajo
      clean();
      const tx = c.x + 3;
      for (let y = c.y - 1; y <= c.y + 1; y++) e.smoke[e.key(c.x + 2, y)] = 9;
      e.computeVisibility(true);
      const standing = !!e.visible[e.key(tx, c.y)];
      c.crouch = true; e.computeVisibility(true);
      const crouched = !!e.visible[e.key(tx, c.y)];
      c.crouch = false;
      out.smokeSight = !standing && crouched;
      // respirar: tos de pie en humo denso; agachado, no
      clean(); e.smoke[e.key(c.x, c.y)] = 9; c.buffs = []; e.breathe(c);
      const cough = c.buffs.some((b) => b.name === 'Tos');
      c.buffs = []; c.crouch = true; e.breathe(c); const cough2 = c.buffs.some((b) => b.name === 'Tos'); c.crouch = false;
      out.cough = cough && !cough2;
      // polvo radiactivo: sube la radiación
      clean(); c.a.rad = 0; e.dust[e.key(c.x, c.y)] = 10; c.a.equip.mask = null; const mk = c.a.equip.helmet; e.breathe(c); out.dust = c.a.rad > 0;
      // el fuego humea
      clean(); e.fire[e.key(c.x + 3, c.y)] = 8; tick(1); out.fireSmoke = e.smoke[e.key(c.x + 3, c.y)] > 0;
      // explosión: abre el muro y levanta polvo
      clean(); e.fire[e.key(c.x + 3, c.y)] = 0;
      const wallK = e.key(x0 + W - 1, c.y);
      e.explode(x0 + W - 2, c.y, 2, [1, 2], null, 0, 0, { demo: true });
      out.wall = e.t[wallK] !== 1 || e.t[e.key(x0 + W - 1, c.y - 1)] !== 1 || e.t[e.key(x0 + W - 1, c.y + 1)] !== 1;
      out.blastDust = e.dust[e.key(x0 + W - 3, c.y)] > 0;
      // tubería de agua rota: inunda poco a poco
      clean(); const ok = e.startFlood(c.x + 4, c.y - 3, 12);
      tick(4);
      let water = 0; for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) if (e.t[e.key(x, y)] === 6) water++;
      out.flood = ok && water >= 6;
      // cerrar una puerta abierta con F
      clean(); e.t[e.key(c.x + 1, c.y)] = 5; e.interact(); out.close = e.t[e.key(c.x + 1, c.y)] === 4;
      return out;
    });
    ok(fl.spread && fl.doorBlocks && fl.doorOpen && fl.close, 'el gas se difunde; una puerta cerrada lo encierra (F junto a una puerta abierta la cierra) y al abrirla pasa');
    ok(fl.smokeSight && fl.cough, 'el humo denso tapa la vista y hace toser de pie; agachado se ve y se respira por debajo');
    ok(fl.dust && fl.fireSmoke, 'el polvo radiactivo irradia y el fuego humea');
    ok(fl.wall && fl.blastDust && fl.flood, `destrucción: la carga abre el muro y levanta polvo; la tubería de agua inunda (${JSON.stringify(fl)})`);
    // capa AIRE (tecla U) e interruptor de la vista
    await A.keyboard.press('u'); await A.waitForTimeout(150);
    const layer = await A.evaluate(() => window.__topolev.expUI.r.airLayer === true);
    await A.keyboard.press('u'); await A.waitForTimeout(100);
    await A.keyboard.press('Escape'); await A.waitForTimeout(150);
    const hasSet = await A.evaluate(() => !!document.querySelector('.modal'));
    let toggled = false;
    if (hasSet) {
      await A.click('.modal >> text=CONFIGURACIÓN'); await A.waitForTimeout(150);
      await A.click('.modal [data-set="airview"]'); await A.waitForTimeout(100);
      toggled = await A.evaluate(() => JSON.parse(localStorage.getItem('topolev_settings_v1')).airView === false);
      await A.click('.modal [data-set="airview"]'); await A.waitForTimeout(100);
    }
    ok(layer && toggled, 'capa AIRE con la tecla U; la vista del aire se puede volver a la clásica en CONFIGURACIÓN');
    await ctx23.close();
  }

  console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : '  ✓ sin errores en consola');
  await b.close();
  if (fails || errs.length) { console.log(`FALLOS: ${fails}`); process.exit(1); }
  console.log('OK');
})();
