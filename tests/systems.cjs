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
  await q.click('.ascend-btn'); await q.waitForTimeout(200);
  await q.click('.attr-row >> nth=0 >> button:has-text("+")'); await q.click('.attr-row >> nth=0 >> button:has-text("+")');
  await q.click('button:has-text("CONFIRMAR ATRIBUTOS")'); await q.waitForTimeout(150);
  await q.click('.talent-card >> nth=0'); await q.waitForTimeout(150);
  await q.click('.modal >> button:has-text("APRENDER")'); await q.waitForTimeout(250);
  const asc2 = await q.evaluate(async () => { const { agentStats } = await import('./js/core/agents.js'); const a = window.__topolev.S.agents[0]; return { pun: a.attr.pun, pts: a.pts, tal: a.talents.length, acc: agentStats(a).acc }; });
  ok(asc2.pun === 2 && asc2.pts === asc.pts - 2 && asc2.tal === 1, 'repartir puntos y aprender un talento');
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
    const a = S.agents[0]; delete a.attr; delete a.offers; delete a.talents; delete a.pts; delete a.equip.case; a.lvl = 7;
    st.save();
    st.load(st.slot);
    const b2 = window.__topolev.S.agents[0];
    return { offers: b2.offers.length, attr: !!b2.attr, hasCase: 'case' in b2.equip };
  });
  ok(mig.offers === 2 && mig.attr && mig.hasCase, 'migración: un veterano Nv 7 recibe 2 talentos pendientes');
  await ctx2.close();

  console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : '  ✓ sin errores en consola');
  await b.close();
  if (fails || errs.length) { console.log(`FALLOS: ${fails}`); process.exit(1); }
  console.log('OK');
})();
