// Fase 28: el tablero de corcho del caso del topo. Todo en ASCII: las pistas son fichas clavadas a la izquierda,
// las hipótesis a la derecha y los hilos rojos se dibujan con caracteres de línea entre unas y otras.
// Clic en una pista y luego en una hipótesis: hilo (otra vez, se suelta). Clic en una hipótesis: seleccionarla
// para descartarla (✗) o concluir. Con dos pistas unidas a una hipótesis se puede concluir.
import { S, save } from '../core/state.js';
import { el, esc, modal, toast } from '../util/dom.js';
import * as PL from '../core/plot.js';
import { QUESTIONS, SOURCES } from '../data/plot.js';
import { sfx } from '../audio.js';

const GW = 98; // ancho de la rejilla
const CLUE_X = 0, CLUE_W = 36; // fichas de pista
const HYP_X = 58, HYP_W = 40; // fichas de hipótesis

function wrap(text, w) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (!word) continue;
    if ((line + ' ' + word).trim().length > w) { if (line) out.push(line); line = word.length > w ? word.slice(0, w - 1) + '…' : word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out;
}
// rejilla de celdas { ch, c: clase, r: referencia clicable }
class Grid {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.cells = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) { const n = (x * 7919 + y * 104729) % 23; row.push({ ch: n === 0 ? '·' : n === 7 ? '∙' : n === 13 ? '˙' : ' ', c: 'cb-cork', r: '' }); }
      this.cells.push(row);
    }
  }
  set(x, y, ch, c, r = '') { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.cells[y][x] = { ch, c, r }; }
  text(x, y, s, c, r = '') { [...s].forEach((ch, i) => this.set(x + i, y, ch, c, r)); }
  box(x, y, w, h, c, r = '', fill = 'cb-paper') {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const top = yy === y, bot = yy === y + h - 1, left = xx === x, right = xx === x + w - 1;
      const ch = top ? (left ? '┌' : right ? '┐' : '─') : bot ? (left ? '└' : right ? '┘' : '─') : left || right ? '│' : ' ';
      this.set(xx, yy, ch, top || bot || left || right ? c : fill, r);
    }
  }
  // hilo de A a B (Bresenham); el carácter según la pendiente total
  thread(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    const s = dx ? (y1 - y0) / (x1 - x0) : 99;
    const ch = Math.abs(s) < 0.35 ? '─' : Math.abs(s) > 2.5 ? '│' : s > 0 ? '╲' : '╱';
    let err = dx - dy, x = x0, y = y0;
    for (let i = 0; i < 400; i++) {
      const cur = this.cells[y] && this.cells[y][x];
      if (cur && (cur.c === 'cb-cork' || cur.c.startsWith('cb-thread'))) this.set(x, y, cur.c.startsWith('cb-thread') && cur.ch !== ch ? '┼' : ch, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  html() {
    return this.cells.map((row) => {
      let out = '', cur = null, buf = '';
      const flush = () => { if (buf) out += `<span class="${cur.c}"${cur.r ? ` data-r="${cur.r}"` : ''}>${esc(buf)}</span>`; buf = ''; };
      for (const cell of row) {
        if (!cur || cur.c !== cell.c || cur.r !== cell.r) { flush(); cur = cell; }
        buf += cell.ch;
      }
      flush();
      return out;
    }).join('\n');
  }
}

// dibuja el tablero de una pregunta; devuelve la rejilla
export function drawBoard(q, ui) {
  const P = S.plot;
  const clues = PL.foundClues(q);
  const hyps = PL.hypotheses(q);
  const solved = P.solved[q] ? P.truth[q] : null;
  const compact = hyps.length > 8; // DÓNDE: fichas de dos líneas, sin marco
  // medidas
  const clueCards = clues.map((c, i) => ({ c, lines: wrap(PL.clueText(c), CLUE_W - 4).slice(0, 6), n: i + 1 }));
  let y = 1;
  for (const k of clueCards) { k.y = y; k.h = k.lines.length + 2; y += k.h + 1; }
  const hClues = y;
  y = 1;
  const hypCards = hyps.map((hy) => ({ hy, sub: hy.sub ? wrap(hy.sub, HYP_W - (compact ? 3 : 4)) : [] }));
  for (const k of hypCards) { k.y = y; k.h = compact ? 1 + k.sub.length : 2 + 1 + k.sub.length; y += k.h + (compact ? 1 : 1); }
  const H = Math.max(hClues, y, 8) + 1;
  const G = new Grid(GW, H);
  // pistas
  for (const k of clueCards) {
    const sel = ui.selClue === k.c.id;
    const ref = 'c:' + k.c.id;
    const cls = sel ? 'cb-clue cb-sel' : 'cb-clue';
    G.box(CLUE_X, k.y, CLUE_W, k.h, cls, ref);
    const head = ` ● ${k.n} · ${SOURCES[k.c.src] || k.c.src} `;
    G.text(CLUE_X + 2, k.y, head.length > CLUE_W - 4 ? head.slice(0, CLUE_W - 5) + '… ' : head, sel ? 'cb-pin cb-sel' : 'cb-pin', ref);
    k.lines.forEach((l, i) => G.text(CLUE_X + 2, k.y + 1 + i, l, 'cb-ink', ref));
    k.ax = CLUE_X + CLUE_W; k.ay = k.y + Math.floor(k.h / 2);
  }
  if (!clueCards.length) G.text(CLUE_X + 1, 2, 'Todavía no hay pistas para esta pregunta.', 'cb-note');
  // hipótesis
  for (const k of hypCards) {
    const id = k.hy.id, ref = 'h:' + id;
    const crossed = !!P.crossed[q + ':' + id], focus = ui.focus === id, isSol = solved === id;
    const bcls = isSol ? 'cb-hyp cb-ok' : focus ? 'cb-hyp cb-sel' : crossed ? 'cb-hyp cb-x' : 'cb-hyp';
    const n = PL.linkedTo(q, id).length;
    const name = `${isSol ? '✓' : crossed ? '✗' : k.hy.glyph} ${k.hy.name}${n ? `  ◄${n}` : ''}`;
    if (compact) {
      G.text(HYP_X, k.y, ' '.repeat(HYP_W), 'cb-paper', ref);
      G.text(HYP_X + 1, k.y, name.slice(0, HYP_W - 2), isSol ? 'cb-ok' : focus ? 'cb-sel' : crossed ? 'cb-x' : 'cb-name', ref);
      k.sub.forEach((l, i) => { G.text(HYP_X, k.y + 1 + i, ' '.repeat(HYP_W), 'cb-paper', ref); G.text(HYP_X + 2, k.y + 1 + i, l, crossed ? 'cb-x' : 'cb-sub', ref); });
      G.set(HYP_X - 1, k.y, '●', isSol ? 'cb-ok' : 'cb-pin', ref);
      k.ax = HYP_X - 2; k.ay = k.y;
    } else {
      G.box(HYP_X, k.y, HYP_W, k.h, bcls, ref);
      G.text(HYP_X + 2, k.y + 1, name.slice(0, HYP_W - 4), isSol ? 'cb-ok' : focus ? 'cb-sel' : crossed ? 'cb-x' : 'cb-name', ref);
      if (k.hy.role) G.text(HYP_X + 2, k.y, ` ${k.hy.role} `.slice(0, HYP_W - 4), 'cb-pin', ref);
      k.sub.forEach((l, i) => G.text(HYP_X + 2, k.y + 2 + i, l, crossed ? 'cb-x' : 'cb-sub', ref));
      G.set(HYP_X - 1, k.y + 1, '●', isSol ? 'cb-ok' : 'cb-pin', ref);
      k.ax = HYP_X - 2; k.ay = k.y + 1;
    }
  }
  // hilos rojos
  for (const k of clueCards) {
    const to = P.links[k.c.id];
    const hk = to && hypCards.find((x) => x.hy.id === to);
    if (!hk) continue;
    G.thread(k.ax, k.ay, hk.ax, hk.ay, ui.selClue === k.c.id ? 'cb-thread cb-tsel' : solved ? 'cb-thread cb-tok' : 'cb-thread');
    G.set(k.ax, k.ay, '●', 'cb-thread');
  }
  return G;
}

// modal del tablero
export function boardModal(after = null) {
  const P = S.plot;
  if (!P || !P.on) {
    modal({ title: 'TABLERO DE CORCHO', body: '<div class="dimt">Todavía no hay ningún caso abierto. Cuando el Comisario os encargue uno, las pistas se clavarán aquí.</div>', actions: [{ label: 'CERRAR' }] });
    return;
  }
  P.fresh = 0;
  const ui = { q: Object.keys(QUESTIONS).find((q) => !P.solved[q]) || 'quien', selClue: null, focus: null };
  const body = el('div', { class: 'corkboard' });
  let close;
  const render = () => {
    body.innerHTML = '';
    const total = P.pool.length, found = P.found.length;
    body.append(el('div', { class: 'cb-head', html: `<b class="warn">CASO «${esc(P.code)}»</b> <span class="dimt">· abierto el día ${P.day} · ${P.leaks} filtración(es) · ${found}/${total} pistas${P.solved.quien ? '' : ' · <span class="bad">el topo sigue filtrando</span>'}</span>` }));
    const tabs = el('div', { class: 'cb-tabs' });
    for (const [q, Q] of Object.entries(QUESTIONS)) {
      const n = PL.foundClues(q).length;
      const lab = P.solved[q] ? `✓ ${Q.name}: ${PL.hypName(q, P.truth[q])}` : `${Q.name} (${n})`;
      tabs.append(el('button', { class: 'btn small ' + (ui.q === q ? 'primary' : P.solved[q] ? 'good' : ''), 'data-q': q, onclick: () => { ui.q = q; ui.selClue = null; ui.focus = null; render(); } }, lab));
    }
    body.append(tabs);
    body.append(el('div', { class: 'dimt cb-help', html: `<b>${esc(QUESTIONS[ui.q].long)}</b> · Clic en una pista y después en una hipótesis para unirlas con hilo (otra vez, se suelta). Clic en una hipótesis para seleccionarla: descartarla o concluir (hacen falta ${QUESTIONS[ui.q].need} pistas unidas a ella).` }));
    const G = drawBoard(ui.q, ui);
    const pre = el('pre', { class: 'cb-grid', html: G.html() });
    pre.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-r]');
      if (!t) { ui.selClue = null; ui.focus = null; render(); return; }
      const [kind, id] = [t.dataset.r.slice(0, 1), t.dataset.r.slice(2)];
      if (kind === 'c') { ui.selClue = ui.selClue === id ? null : id; ui.focus = null; sfx.click(); }
      else if (ui.selClue) { if (PL.plotLink(ui.selClue, id)) { sfx.click(); save(); } ui.selClue = null; ui.focus = id; }
      else ui.focus = ui.focus === id ? null : id;
      render();
    });
    body.append(el('div', { class: 'cb-wrap' }, pre));
    // acciones
    const acts = el('div', { class: 'cb-acts' });
    if (ui.focus && !P.solved[ui.q]) {
      const why = PL.canConclude(ui.q, ui.focus);
      const nm = PL.hypName(ui.q, ui.focus);
      acts.append(
        el('button', { class: 'btn small', 'data-act': 'cross', onclick: () => { PL.plotCross(ui.q, ui.focus); save(); render(); } }, P.crossed[ui.q + ':' + ui.focus] ? '↺ RECUPERAR' : '✗ DESCARTAR'),
        el('button', { class: 'btn small ' + (why ? '' : 'primary'), 'data-act': 'conclude', disabled: why ? 'disabled' : null, onclick: () => {
          const r = PL.plotConclude(ui.q, ui.focus);
          save();
          if (r.ok) { toast(r.txt, 'good', 6000); sfx.upgrade(); }
          else toast(r.txt || r.err, 'bad', 6000);
          ui.focus = null;
          if (r.ok && ui.q === 'quien') { close(); if (after) after(); return; }
          render();
        } }, `⚑ CONCLUIR: ${nm.toUpperCase()}`),
        el('span', { class: why ? 'dimt' : 'good', text: why || 'Las pruebas sostienen la conclusión. ¿Seguro?' }),
      );
    }
    const price = PL.kgbCluePrice();
    const left = PL.remaining().length;
    acts.append(el('button', { class: 'btn small', 'data-act': 'kgb', disabled: S.rub < price || !left ? 'disabled' : null, title: 'El archivo del KGB: expedientes y escuchas', onclick: () => {
      const c = PL.plotBuyClue();
      if (c) { save(); toast(`Archivo del KGB (−${price} ₽): ${PL.clueText(c)}`, 'good', 7000); ui.q = c.q; ui.selClue = c.id; }
      render();
    } }, `☭ ARCHIVO DEL KGB: UNA PISTA (${price} ₽)${left ? '' : ' · no quedan'}`));
    body.append(acts);
  };
  render();
  close = modal({ title: 'TABLERO DE CORCHO', width: 'min(108ch, 97vw)', body, actions: [{ label: 'CERRAR' }], onClose: () => { if (after) after(); } });
}
