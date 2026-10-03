// Controles táctiles (fase 24.3): detección, ajuste touch auto|on|off, barra de acciones en pantalla y gestos.
import { settings, saveSettings } from '../core/state.js';
import { el } from '../util/dom.js';

const MODES = ['auto', 'on', 'off'];
const MODE_NAME = { auto: 'AUTO', on: 'SÍ', off: 'NO' };
// ¿pantalla táctil? (puntero grueso o sin ratón con puntos de contacto)
export function touchDetected() {
  try {
    if (matchMedia('(pointer: coarse)').matches) return true;
    return (navigator.maxTouchPoints || 0) > 0 && matchMedia('(hover: none)').matches;
  } catch { return false; }
}
export function touchOn() {
  const m = settings.touch || 'auto';
  return m === 'on' || (m === 'auto' && touchDetected());
}
export function applyTouch() {
  document.body.classList.toggle('touch', touchOn());
}
// botón de los menús: AUTO → SÍ → NO
export function touchButton(after) {
  const m = settings.touch || 'auto';
  const lab = `CONTROLES TÁCTILES: ${MODE_NAME[m]}${m === 'auto' ? (touchDetected() ? ' (sí)' : ' (no)') : ''}`;
  return [lab, () => { settings.touch = MODES[(MODES.indexOf(m) + 1) % MODES.length]; saveSettings(); applyTouch(); after(); }];
}

// ---------------------------------------------------------------- barra de acciones (24.3.2)
// ui: ExpeditionUI. Cada botón llama a ui.touchAct(acción) o ui.touchMove([dx, dy]).
const DPAD = [
  ['↖', [-1, -1]], ['↑', [0, -1]], ['↗', [1, -1]],
  ['←', [-1, 0]], null, ['→', [1, 0]],
  ['↙', [-1, 1]], ['↓', [0, 1]], ['↘', [1, 1]],
];
export const TOUCH_ACTIONS = [
  ['interact', 'F', 'Interactuar'],
  ['aim', '⌖', 'Apuntar'],
  ['reload', 'R', 'Recargar'],
  ['heal', '✚', 'Curarse'],
  ['ability', '★', 'Habilidad'],
  ['grenade', '●', 'Granada'],
  ['crouch', '▾', 'Agacharse'],
  ['next', '⇄', 'Siguiente agente'],
  ['inventory', 'I', 'Inventario'],
  ['cancel', '✕', 'Cancelar / menú'],
];
export function buildTouchBar(ui) {
  const bar = el('div', { class: 'touch-bar' });
  const pad = el('div', { class: 'touch-pad' });
  // repetición mientras se mantiene pulsada una dirección
  const hold = (b, fn) => {
    let t = null;
    const stop = () => { clearTimeout(t); clearInterval(t); t = null; };
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); stop(); fn();
      t = setTimeout(() => { t = setInterval(fn, 140); }, 380);
    });
    for (const n of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(n, stop);
    b.addEventListener('contextmenu', (ev) => ev.preventDefault());
  };
  for (const d of DPAD) {
    if (!d) {
      const w = el('button', { class: 'tbtn wait', 'data-touch': 'wait', title: 'Esperar un turno', text: '·' });
      hold(w, () => ui.touchAct('wait'));
      pad.append(w);
      continue;
    }
    const b = el('button', { class: 'tbtn', 'data-dir': d[1].join(','), title: 'Moverse', text: d[0] });
    hold(b, () => ui.touchMove(d[1]));
    pad.append(b);
  }
  const acts = el('div', { class: 'touch-acts' });
  for (const [id, glyph, name] of TOUCH_ACTIONS) {
    const b = el('button', { class: 'tbtn', 'data-touch': id, title: name }, el('span', { class: 'g', text: glyph }), el('span', { class: 'l', text: name.split(' ')[0] }));
    b.addEventListener('click', (ev) => { ev.preventDefault(); ui.touchAct(id); });
    acts.append(b);
  }
  const side = el('button', { class: 'tbtn side-tog', 'data-touch': 'side', title: 'Panel del agente', text: '☰' });
  side.addEventListener('click', () => { document.body.classList.toggle('side-open'); requestAnimationFrame(() => ui.sizeMinimap()); });
  bar.append(pad, acts, side);
  return bar;
}

// ---------------------------------------------------------------- gestos (24.3.3)
// canvas del mapa: pulsación larga = tooltip (y anula el clic que viene detrás), pellizco = zoom
export function mapGestures(canvas, { onLong, onZoom }) {
  const pts = new Map();
  let longT = null, start = null, pinch = null, swallow = false;
  const clearLong = () => { clearTimeout(longT); longT = null; };
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    swallow = false;
    if (pts.size === 1) {
      start = [ev.clientX, ev.clientY];
      const e0 = { clientX: ev.clientX, clientY: ev.clientY };
      longT = setTimeout(() => { longT = null; swallow = true; onLong(e0); }, 500);
    } else { clearLong(); swallow = true; pinch = dist(); }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (start && Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) > 12) clearLong();
    if (pts.size >= 2 && pinch) {
      const d = dist();
      if (d / pinch > 1.18) { onZoom(1); pinch = d; } else if (d / pinch < 0.85) { onZoom(-1); pinch = d; }
    }
  });
  const up = (ev) => { pts.delete(ev.pointerId); clearLong(); if (pts.size < 2) pinch = null; if (!pts.size) start = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  // la pulsación larga o el pellizco no deben acabar en un clic (mover / disparar)
  canvas.addEventListener('click', (ev) => { if (swallow) { swallow = false; ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
  function dist() { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; }
}
// minimapa: arrastrar = desplazar la vista del mapa (vuelve al agente en el siguiente turno)
export function minimapDrag(canvas, cellOf, onPan) {
  let down = null, dragged = false;
  canvas.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; dragged = false; });
  canvas.addEventListener('pointermove', (ev) => {
    if (!down || !(ev.buttons & 1 || ev.pointerType === 'touch')) return;
    if (!dragged && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) < 8) return;
    dragged = true;
    const c = cellOf(ev);
    if (c) onPan(c[0], c[1]);
  });
  const up = () => { down = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('click', (ev) => { if (dragged) { dragged = false; ev.stopImmediatePropagation(); } }, true);
}
