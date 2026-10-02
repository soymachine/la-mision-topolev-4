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
  for (let i = 0; i < 2; i++) { const rows = await p.$$('#screen-base .grid3 > .panel:nth-child(3) .agent-row'); await rows[i].click(); }
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
  const fac = await ev(() => { const e = window.__topolev.exp; return { usa: e.enemies.filter((x) => x.type === 'usa_operator').length, rda: e.enemies.filter((x) => x.type === 'rda_rifle').length, flags: window.__topolev.S.flags }; });
  ok(fac.usa === 0, 'el operador americano muere (escuadrón + aliados)');
  ok(fac.rda >= 1, 'los aliados de la RDA sobreviven');
  const swe = await ev(() => { const e = window.__topolev.exp; const s = e.enemies.find((x) => x.type === 'swe_scientist'); if (!s) return 'sin sueco'; e.attack(e.cur, s); return e.attitude('squad', 'suecia') + ' ' + window.__topolev.S.rep.suecia; });
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
  for (let i = 0; i < 2; i++) { const rows = await q.$$('#screen-base .grid3 > .panel:nth-child(3) .agent-row'); await rows[i].click(); }
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
    e.damageAgent(sq, 9999, 'prueba');
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
  for (let i = 0; i < 3; i++) { const rows = await R.$$('#screen-base .grid3 > .panel:nth-child(3) .agent-row'); if (rows[i]) await rows[i].click(); }
  await R.click('text=LANZAR EXPEDICIÓN'); await R.waitForTimeout(300);
  if (await R.$('.modal-back')) await R.click('.modal-back >> text=LANZAR');
  await R.waitForTimeout(600);
  const squad = await R.evaluate(() => window.__topolev.exp.squad.map((s) => s.a.spec));
  ok(squad.length === 3, `escuadrón especializado: ${squad.join(', ')}`);
  await rd('god');
  await rd('spawn lobo 2 2');
  await R.evaluate(() => { const e = window.__topolev.exp; e.active = e.squad.findIndex((s) => s.a.spec === 'tirador'); e.emit('switch'); });
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
    return { alive: e.inMap(vic), hp: vic.a.hp, saves: med.a.saves || 0 };
  });
  ok(resc.alive && resc.hp === 1 && resc.saves === 1, 'Rescate: el sanitario salva a un compañero adyacente');
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
  ok(await F.$('.mods-box .mod-row:has-text("Apagón")'), 'los modificadores del día se ven al elegir destino');
  for (let i = 0; i < 2; i++) { const rows = await F.$$('#screen-base .grid3 > .panel:nth-child(3) .agent-row'); await rows[i].click(); }
  await F.click('text=LANZAR EXPEDICIÓN'); await F.waitForTimeout(300);
  if (await F.$('.modal-back')) await F.click('.modal-back >> text=LANZAR');
  await F.waitForTimeout(700);
  await fd('god');
  const m1 = await F.evaluate(() => { const e = window.__topolev.exp; const c = e.cur; return { mods: e.mods, lit: e.lightMap.reduce((a, b) => a + b, 0), dark: e.darkRadius(c, e.ast(c).vision), vis: e.ast(c).vision, humans: e.enemies.filter((x) => x.w).length, floors: e.nFloors }; });
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
    for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, -3]]) if (free(dx, dy) && e.walkTile(c.x + Math.sign(dx) * 3, c.y + Math.sign(dy) * 3)) { spot = [c.x + dx, c.y + dy, c.x + Math.sign(dx) * 3, c.y + Math.sign(dy) * 3]; break; }
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
  ok(tr.cover && tr.cover[1] === tr.cover[0] - 25, `cobertura: ${tr.cover && tr.cover.join('% → ')}%`);
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
  ok(fl.floor === 1 && fl.exits === 0 && fl.store && fl.onLift, 'el montacargas baja al escuadrón al piso −1 (sin extracciones permanentes)');
  await F.evaluate(async () => { (await import('./js/core/state.js')).save(); });
  await F.reload(); await F.waitForTimeout(800); await F.click('text=CONTINUAR'); await F.waitForTimeout(900);
  const fl2 = await F.evaluate(() => { const e = window.__topolev.exp; return { floor: e.floor, store: !!e.floorStore[0], view: !!e.floorView(0) }; });
  ok(fl2.floor === 1 && fl2.store && fl2.view, 'el piso y los pisos visitados sobreviven a recargar');
  await F.keyboard.press('m'); await F.waitForTimeout(250);
  ok((await F.$$('.floor-tabs .filter')).length === 2, 'el mapa grande tiene selector de pisos');
  await F.keyboard.press('Escape');
  const up = await F.evaluate(() => { const e = window.__topolev.exp; window.__topolev.debug.run('god'); e.moveEntity(e.cur, ...e.start); for (const s of e.team) if (s !== e.cur) e.moveEntity(s, e.cur.x + 1, e.cur.y); e.interact(); return { floor: e.floor, exits: e.exits.length }; });
  ok(up.floor === 0 && up.exits >= 2, 'el montacargas de subida vuelve al piso superior');
  await ctx4.close();

  console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : '  ✓ sin errores en consola');
  await b.close();
  if (fails || errs.length) { console.log(`FALLOS: ${fails}`); process.exit(1); }
  console.log('OK');
})();
