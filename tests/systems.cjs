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

  console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : '  ✓ sin errores en consola');
  await b.close();
  if (fails || errs.length) { console.log(`FALLOS: ${fails}`); process.exit(1); }
  console.log('OK');
})();
