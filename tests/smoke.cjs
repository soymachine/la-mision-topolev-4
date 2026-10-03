// Prueba de humo: nueva partida → expedición → bot jugando hasta extraer o morir.
// Uso: python3 -m http.server 8000 &  →  node tests/smoke.cjs [mapIdx]
// Requiere Playwright (npm i -D playwright). URL configurable con TOPOLEV_URL.
// TOPOLEV_A11Y=1: con el modo daltónico y el alto contraste activados (fase 24.9).
let pw;
try { pw = require('playwright'); } catch { pw = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright'); }
const URL = process.env.TOPOLEV_URL || 'http://localhost:8000/index.html';
const mapIdx = +(process.argv[2] || 0);

(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { window.__noScenes = true; });
  if (process.env.TOPOLEV_A11Y) await p.addInitScript(() => { try { const k = 'topolev_settings_v1'; const st = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...st, colorblind: true, contrast: true })); } catch {} });
  await p.goto(URL);
  await p.waitForTimeout(800);
  await p.click('text=NUEVA PARTIDA');
  await p.click('.modal >> text=EMPEZAR AQUÍ >> nth=0');
  await p.click('#screen-intro');
  await p.click('text=COMENZAR');
  await p.evaluate(() => { window.__topolev.S.unlockAll = true; });
  await p.click('.tab:has-text("EXPEDICIÓN")');
  await p.click(`.mapcard:not(.event) >> nth=${mapIdx}`);
  for (let i = 0; i < 2; i++) { const rows = await p.$$('#screen-base .grid3 > .panel:nth-child(3) .agent-row'); await rows[i].click(); }
  await p.click('text=LANZAR EXPEDICIÓN');
  await p.waitForTimeout(300);
  if (await p.$('.modal-back >> text=LANZAR')) await p.click('.modal-back >> text=LANZAR');
  await p.waitForTimeout(500);
  const out = await p.evaluate(async () => {
    const e = window.__topolev.exp;
    const { astar } = await import('./js/exp/path.js');
    let steps = 0;
    while (!e.ended && steps++ < 600) {
      const c = e.cur;
      const vis = e.enemies.filter((en) => e.isVisible(en.x, en.y)).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
      let acted = false;
      if (vis.length) {
        const r = e.canShoot(c, vis[0]);
        if (r === 'ok') acted = e.act((sq) => e.attack(sq, vis[0]));
        else if (r === 'empty') acted = e.act((sq) => e.reload(sq));
      }
      if (!acted) {
        const goal = e.turn > 200 ? e.exits[0] : e.pois.find((q) => q.type === 'nest' && !q.cleared) || e.exits[0];
        if (goal === e.exits[0] && e.exitAt(c.x, c.y)) { e.interact(); for (let i = 0; i < 4 && !e.ended; i++) e.wait(); continue; }
        const path = astar(e.w, e.h, c.x, c.y, goal.x, goal.y, (x, y) => (e.passable(x, y) && !e.entityAt(x, y) ? 1 : Infinity), 20000);
        if (path && path.length) acted = e.moveDir(path[0][0] - c.x, path[0][1] - c.y);
        if (!acted) e.wait();
      }
      if (steps % 25 === 0) await new Promise((r) => setTimeout(r, 5));
    }
    return { turn: e.turn, ended: e.ended, kills: e.tally.kills };
  });
  await p.waitForTimeout(2500);
  const screen = await p.evaluate(() => document.querySelector('.screen.active').id);
  console.log(JSON.stringify({ ...out, screen }));
  if (errs.length) { console.error('ERRORES:\n' + errs.join('\n')); process.exitCode = 1; }
  else console.log('OK: sin errores');
  await b.close();
})();
