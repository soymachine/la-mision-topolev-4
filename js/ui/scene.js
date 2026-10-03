// Escenas ASCII a pantalla completa (fase 20.1): dibujo + texto mecanografiado. Clic / Espacio / Enter para avanzar.
import { el, esc } from '../util/dom.js';
import { sfx } from '../audio.js';

export function playScene(scene, onDone) {
  const root = el('div', { class: 'scene-root' });
  const art = el('pre', { class: 'scene-art', style: { color: scene.color || '#ff8a1f' }, text: (scene.art || '').replace(/^\n/, '') });
  const title = el('div', { class: 'scene-title', style: { color: scene.color || '#ff8a1f' }, text: scene.title || '' });
  const text = el('div', { class: 'scene-text' });
  const hint = el('div', { class: 'scene-hint dimt', text: 'clic / espacio para continuar · Esc para saltar' });
  root.append(title, art, text, hint);
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('on'));
  let li = 0, ci = 0, timer = null, done = false;
  const lines = scene.lines || [];
  let cur = null;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    document.removeEventListener('keydown', key, true);
    root.classList.remove('on');
    setTimeout(() => root.remove(), 350);
    if (onDone) onDone();
  };
  const startLine = () => {
    if (li >= lines.length) { hint.textContent = 'clic para cerrar'; return; }
    cur = el('p', { class: 'scene-line' });
    text.append(cur);
    ci = 0;
    clearInterval(timer);
    timer = setInterval(() => {
      const L = lines[li];
      ci++;
      cur.innerHTML = esc(L.slice(0, ci)) + '<span class="scene-caret">▌</span>';
      if (ci % 3 === 0 && sfx.type) sfx.type();
      if (ci >= L.length) { clearInterval(timer); cur.innerHTML = esc(L); li++; timer = null; }
    }, 22);
  };
  const advance = () => {
    if (timer) { clearInterval(timer); timer = null; cur.innerHTML = esc(lines[li]); li++; return; }
    if (li >= lines.length) { finish(); return; }
    startLine();
  };
  const key = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(); return; }
    if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); advance(); }
  };
  root.addEventListener('click', advance);
  document.addEventListener('keydown', key, true);
  startLine();
  return finish;
}
