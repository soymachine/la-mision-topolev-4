// Helpers DOM: elementos, marcos ASCII, tooltip, modales, toasts, drag & drop
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Métricas de fuente ----------
export const metrics = { charW: 7.8, lh: 17 };
export function measureFont() {
  const cs = getComputedStyle(document.documentElement);
  const lh = parseFloat(cs.getPropertyValue('--lh')) || 17;
  // medir en el DOM con el mismo estilo que los marcos (el canvas puede elegir otra fuente de respaldo)
  const probe = document.createElement('pre');
  probe.className = 'frame-bg';
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;letter-spacing:0';
  probe.textContent = '─'.repeat(100);
  document.body.append(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  metrics.charW = w > 0 ? w / 100 : 7.8;
  metrics.lh = lh;
}

// ---------- Marcos ASCII ----------
const FRAMES = {
  single: ['┌', '─', '┐', '│', '└', '┘'],
  double: ['╔', '═', '╗', '║', '╚', '╝'],
  heavy: ['┏', '━', '┓', '┃', '┗', '┛'],
  dash: ['┌', '╌', '┐', '╎', '└', '┘'],
};
export function frameText(cols, rows, style = 'single') {
  const f = FRAMES[style] || FRAMES.single;
  cols = Math.max(2, cols); rows = Math.max(2, rows);
  const lines = [];
  lines.push(f[0] + f[1].repeat(cols - 2) + f[2]);
  const mid = f[3] + ' '.repeat(cols - 2) + f[3];
  for (let i = 0; i < rows - 2; i++) lines.push(mid);
  lines.push(f[4] + f[1].repeat(cols - 2) + f[5]);
  return lines.join('\n');
}
function drawFrame(bg, w, h, style) {
  if (w < 4 || h < 4) return;
  const cw = metrics.charW, lh = metrics.lh;
  const cols = Math.max(2, Math.floor(w / cw));
  const rows = Math.max(2, Math.floor(h / lh));
  const key = cols + 'x' + rows + style;
  const ls = (w - cols * cw) / cols;
  bg.style.letterSpacing = ls + 'px';
  bg.style.lineHeight = h / rows + 'px';
  if (bg._key === key) return;
  bg._key = key;
  bg.textContent = frameText(cols, rows, style);
}
const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
  for (const en of entries) {
    const t = en.target;
    const bg = t._frameBg;
    if (!bg) continue;
    // tamaño de layout (no afectado por transformaciones como la animación de entrada)
    drawFrame(bg, t.offsetWidth, t.offsetHeight, t._frameStyle);
  }
}) : null;
export function framify(elm, style = 'single') {
  let bg = elm.querySelector(':scope > .frame-bg');
  if (!bg) { bg = el('pre', { class: 'frame-bg' }); elm.prepend(bg); }
  elm._frameBg = bg; elm._frameStyle = style;
  if (ro) ro.observe(elm);
  return elm;
}
export function refreshFrames() {
  for (const p of $$('.panel, .tooltip')) {
    if (p._frameBg) { p._frameBg._key = null; drawFrame(p._frameBg, p.offsetWidth, p.offsetHeight, p._frameStyle); }
  }
}

// panel({title, right, cls, style, frame}, ...children) → {root, body}
export function panel(opts = {}, ...children) {
  const body = el('div', { class: 'panel-body ' + (opts.bodyCls || '') }, ...children);
  const root = el('div', { class: 'panel ' + (opts.cls || ''), style: opts.style }, body);
  if (opts.title) root.append(el('div', { class: 'frame-title', html: opts.title }));
  if (opts.right) root.append(el('div', { class: 'frame-title right', html: opts.right }));
  framify(root, opts.frame || 'single');
  root.body = body;
  return root;
}

// ---------- Tooltip ----------
const tipFns = new WeakMap();
let tipEl, tipBg, tipBody, tipTarget = null, tipStatic = false;
export function tip(elm, fn) { tipFns.set(elm, fn); elm.dataset.hasTip = '1'; return elm; }
export function showTooltip(html, x, y) {
  if (!tipEl) return;
  tipBody.innerHTML = html;
  tipEl.classList.remove('hidden');
  drawFrame(tipBg, tipEl.offsetWidth, tipEl.offsetHeight, 'single');
  positionTooltip(x, y);
}
export function positionTooltip(x, y) {
  const r = tipEl.getBoundingClientRect();
  let tx = x + 18, ty = y + 14;
  if (tx + r.width > innerWidth - 4) tx = x - r.width - 12;
  if (ty + r.height > innerHeight - 4) ty = innerHeight - r.height - 4;
  if (tx < 4) tx = 4; if (ty < 4) ty = 4;
  tipEl.style.left = tx + 'px'; tipEl.style.top = ty + 'px';
}
export function hideTooltip() { if (tipEl) tipEl.classList.add('hidden'); tipTarget = null; tipStatic = false; }
export function setStaticTip(on) { tipStatic = on; }
function initTooltips() {
  tipEl = $('#tooltip');
  tipBg = el('pre', { class: 'frame-bg' });
  tipBody = el('div', { class: 'tt-body' });
  tipEl.append(tipBg, tipBody);
  document.addEventListener('pointermove', (e) => {
    if (dragState) return;
    let t = e.target;
    while (t && t !== document.body && !(t.dataset && t.dataset.hasTip)) t = t.parentElement;
    if (t && t !== document.body && tipFns.has(t)) {
      if (t !== tipTarget) {
        tipTarget = t;
        const html = tipFns.get(t)();
        if (html) showTooltip(html, e.clientX, e.clientY); else hideTooltip();
      } else if (!tipEl.classList.contains('hidden')) positionTooltip(e.clientX, e.clientY);
    } else if (tipTarget && !tipStatic) hideTooltip();
  });
  document.addEventListener('pointerdown', () => { if (tipTarget) hideTooltip(); });
}

// ---------- Modales ----------
const modalStack = [];
export function modal({ title = '', body, actions = [], width, onClose, frame = 'double', dismiss = true } = {}) {
  const root = $('#modal-root');
  const back = el('div', { class: 'modal-back' });
  const content = typeof body === 'string' ? el('div', { html: body }) : body;
  const acts = el('div', { class: 'actions' });
  const p = panel({ title, cls: 'modal', frame, style: width ? { width } : null }, el('div', { class: 'scroll', style: { maxHeight: 'calc(88vh - 6em)' } }, content), actions.length ? acts : null);
  const close = (v) => {
    const i = modalStack.indexOf(close);
    if (i >= 0) modalStack.splice(i, 1);
    back.remove();
    document.body.classList.toggle('modal-open', modalStack.length > 0);
    onClose && onClose(v);
  };
  for (const a of actions) {
    acts.append(el('button', { class: 'btn ' + (a.cls || ''), onclick: () => { const r = a.fn ? a.fn() : undefined; if (r !== false) close(a.value); } }, a.label));
  }
  back.append(p);
  if (dismiss) back.addEventListener('pointerdown', (e) => { if (e.target === back) close(null); });
  root.append(back);
  modalStack.push(close);
  // con un modal abierto, el resto de la interfaz queda debajo, oscurecido y difuminado, y sin tooltips encima
  document.body.classList.add('modal-open');
  hideTooltip();
  return close;
}
// menú contextual (clic derecho): opts = [{ label, fn, disabled, hint }]. Se cierra al elegir, al hacer clic fuera o con Esc.
let ctxMenu = null;
export function contextMenu(x, y, opts, title = '') {
  closeContextMenu();
  hideTooltip();
  const m = el('div', { class: 'ctx-menu', role: 'menu' });
  if (title) m.append(el('div', { class: 'ctx-title', html: title }));
  for (const o of opts) {
    const b = el('button', { class: 'ctx-item' + (o.disabled ? ' disabled' : ''), role: 'menuitem', html: o.label + (o.hint ? ` <span class="dimt">${o.hint}</span>` : '') });
    b.addEventListener('click', (ev) => { ev.stopPropagation(); if (o.disabled) return; closeContextMenu(); o.fn(ev); });
    m.append(b);
  }
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
  m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  const away = (ev) => { if (!m.contains(ev.target)) closeContextMenu(); };
  const key = (ev) => { if (ev.key === 'Escape') { ev.stopImmediatePropagation(); closeContextMenu(); } };
  setTimeout(() => { document.addEventListener('pointerdown', away, true); window.addEventListener('keydown', key, true); }, 0);
  ctxMenu = { m, away, key };
  return m;
}
export function closeContextMenu() {
  if (!ctxMenu) return;
  ctxMenu.m.remove();
  document.removeEventListener('pointerdown', ctxMenu.away, true);
  window.removeEventListener('keydown', ctxMenu.key, true);
  ctxMenu = null;
}
export function modalOpen() { return modalStack.length > 0; }
export function closeTopModal() { const c = modalStack[modalStack.length - 1]; if (c) { c(null); return true; } return false; }
export function confirmBox(title, html, yes = 'ACEPTAR', no = 'CANCELAR', danger = false) {
  return new Promise((res) => {
    modal({ title, body: html, actions: [
      { label: no, fn: () => res(false) },
      { label: yes, cls: danger ? 'danger' : 'primary', fn: () => res(true) },
    ], onClose: (v) => { if (v === null) res(false); } });
  });
}

// ---------- Toasts ----------
export function toast(text, cls = '', ms = 2600) {
  const t = el('div', { class: 'toast ' + cls, html: text });
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms);
}

// ---------- Drag & drop ----------
const zones = new Set();
let dragState = null;
export function draggable(elm, opts) {
  // opts: { data: () => any, ghost: () => html, onStart, onEnd }
  elm.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    const move = (ev) => {
      if (!dragState) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        startDrag(elm, opts, ev);
      }
      updateDrag(ev);
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (dragState) endDrag(ev);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
  return elm;
}
export function dropzone(elm, opts) {
  // opts: { accepts: (data) => bool, onDrop: (data, ev) => void }
  elm._dz = opts; zones.add(elm);
  return elm;
}
function startDrag(src, opts, ev) {
  hideTooltip();
  const data = opts.data();
  const ghost = el('div', { class: 'drag-ghost', html: opts.ghost ? opts.ghost() : src.innerHTML });
  document.body.append(ghost);
  src.classList.add('dragging-src');
  dragState = { src, opts, data, ghost, over: null };
  for (const z of [...zones]) {
    if (!z.isConnected) { zones.delete(z); continue; }
    if (z._dz.accepts(data)) z.classList.add('drop-ok');
  }
  opts.onStart && opts.onStart(data);
  document.body.style.cursor = 'grabbing';
}
// la zona más interior que acepta lo arrastrado (así un objeto dentro de una mochila puede ser zona de «juntar pilas»
// sin tapar a la mochila cuando se arrastra otra cosa)
function zoneAt(x, y, data) {
  for (const e of document.elementsFromPoint(x, y)) {
    let t = e;
    while (t) { if (t._dz && zones.has(t) && t._dz.accepts(data)) return t; t = t.parentElement; }
  }
  return null;
}
function updateDrag(ev) {
  const d = dragState;
  d.ghost.style.left = ev.clientX + 'px'; d.ghost.style.top = ev.clientY + 'px';
  const ok = zoneAt(ev.clientX, ev.clientY, d.data);
  if (ok !== d.over) {
    if (d.over) d.over.classList.remove('drop-hover');
    if (ok) ok.classList.add('drop-hover');
    d.over = ok;
  }
}
function endDrag(ev) {
  const d = dragState; dragState = null;
  d.ghost.remove();
  d.src.classList.remove('dragging-src');
  document.body.style.cursor = '';
  for (const z of zones) z.classList.remove('drop-ok', 'drop-hover');
  // evitar que el click posterior dispare acciones
  const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
  if (d.over) d.over._dz.onDrop(d.data, ev);
  d.opts.onEnd && d.opts.onEnd(d.data, !!d.over);
}
export const isDragging = () => !!dragState;

// ---------- Tamaño de texto (accesibilidad) ----------
export const UI_SCALES = [{ name: 'NORMAL', fs: 13, lh: 17 }, { name: 'GRANDE', fs: 15, lh: 19 }, { name: 'MUY GRANDE', fs: 17, lh: 22 }];
let settingsRef = null;
export function applyUiScale(settings) {
  if (settings) settingsRef = settings;
  const sc = UI_SCALES[(settingsRef && settingsRef.uiScale) || 0];
  const root = document.documentElement.style;
  if (innerWidth <= 1100 && sc.fs === 13) { root.removeProperty('--fs'); root.removeProperty('--lh'); }
  else { root.setProperty('--fs', sc.fs + 'px'); root.setProperty('--lh', sc.lh + 'px'); }
  measureFont();
  refreshFrames();
}
export function cycleUiScale() {
  if (!settingsRef) return;
  settingsRef.uiScale = ((settingsRef.uiScale || 0) + 1) % UI_SCALES.length;
  try { localStorage.setItem('topolev_settings_v1', JSON.stringify(settingsRef)); } catch {}
  applyUiScale();
}

export function initDom() {
  measureFont();
  initTooltips();
  // Esc cierra el modal superior en cualquier pantalla
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && modalStack.length) { ev.preventDefault(); ev.stopImmediatePropagation(); closeTopModal(); }
  }, true);
  window.addEventListener('resize', () => { measureFont(); refreshFrames(); });
}

// Barras ASCII
export function bar(v, max, len = 12, cls = '') {
  const f = Math.max(0, Math.min(len, Math.round((v / Math.max(1, max)) * len)));
  return `<span class="bar ${cls}"><span class="f">${'█'.repeat(f)}</span><span class="e">${'░'.repeat(len - f)}</span></span>`;
}
export function hpBar(v, max, len = 12) {
  const p = v / Math.max(1, max);
  return bar(v, max, len, 'hp ' + (p < 0.3 ? 'low' : p < 0.6 ? 'mid' : ''));
}
export function levelPips(lv, max) {
  let s = '';
  for (let i = 0; i < max; i++) s += i < lv ? '<span class="on">■</span>' : '<span class="off">□</span>';
  return s;
}
