// Controles de interfaz en ASCII. asciiSlider: barra deslizadora «[██████░░░░] 60» que se arrastra con el ratón o el dedo
// y se mueve con las flechas (Mayús: de 10 en 10), Inicio y Fin.
import { el } from '../util/dom.js';

export function asciiSlider({ value = 0, min = 0, max = 100, step = 1, width = 24, fmt = (v) => `${v}`, onInput, onChange, label = '' } = {}) {
  let v = clamp(value);
  const track = el('span', { class: 'as-track' });
  const out = el('span', { class: 'as-val' });
  const root = el('div', { class: 'aslider', tabindex: 0, role: 'slider', 'aria-valuemin': min, 'aria-valuemax': max, 'aria-label': label },
    el('span', { class: 'as-b', text: '[' }), track, el('span', { class: 'as-b', text: ']' }), out);
  function clamp(x) { return Math.max(min, Math.min(max, Math.round(x / step) * step)); }
  function draw() {
    const n = Math.round(((v - min) / (max - min || 1)) * width);
    track.innerHTML = `<span class="as-on">${'█'.repeat(n)}</span><span class="as-off">${'░'.repeat(width - n)}</span>`;
    out.textContent = ' ' + fmt(v);
    root.setAttribute('aria-valuenow', v);
  }
  function set(x, final) {
    const nv = clamp(x);
    if (nv !== v) { v = nv; draw(); onInput && onInput(v); }
    if (final) onChange && onChange(v);
  }
  const fromX = (cx) => { const r = track.getBoundingClientRect(); return min + ((cx - r.left) / (r.width || 1)) * (max - min); };
  root.addEventListener('pointerdown', (ev) => {
    ev.preventDefault(); root.focus();
    set(fromX(ev.clientX));
    const move = (e) => set(fromX(e.clientX));
    const up = (e) => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); set(fromX(e.clientX), true); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
  root.addEventListener('keydown', (ev) => {
    const big = ev.shiftKey ? 10 : 1;
    const k = ev.key;
    if (k === 'ArrowLeft' || k === 'ArrowDown') set(v - step * big, true);
    else if (k === 'ArrowRight' || k === 'ArrowUp') set(v + step * big, true);
    else if (k === 'Home') set(min, true);
    else if (k === 'End') set(max, true);
    else return;
    ev.preventDefault(); ev.stopPropagation();
  });
  root.setValue = (x) => { v = clamp(x); draw(); };
  root.getValue = () => v;
  draw();
  return root;
}
