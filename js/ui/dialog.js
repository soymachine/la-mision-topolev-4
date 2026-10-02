// Ventana de diálogo (motor en core/events.js). La usan la expedición y la base.
import { el, esc, modal } from '../util/dom.js';
import { sfx } from '../audio.js';

// view: { title, speaker, color, art, text, opts:[{ i, label, ok, hint, cls }] }
// onChoose(i) se llama tras cerrar la ventana; onDismiss() si se cierra con Esc o clic fuera.
export function showDialog(view, onChoose, onDismiss) {
  let close;
  let chosen = false;
  const body = el('div', { class: 'dlg' });
  if (view.art) body.append(el('pre', { class: 'dlg-art', style: { color: view.color }, text: view.art }));
  if (view.speaker && view.speaker.toUpperCase() !== view.title.toUpperCase()) body.append(el('div', { class: 'dlg-speaker', style: { color: view.color }, text: view.speaker }));
  body.append(el('div', { class: 'dlg-text msg-topolev', html: view.text }));
  const list = el('div', { class: 'dlg-opts' });
  view.opts.forEach((o, n) => {
    const b = el('button', {
      class: `btn dlg-opt ${o.ok ? o.cls : 'disabled'}`,
      html: `<span class="dimt">${n + 1}.</span> ${o.label}${o.hint ? ` <span class="dimt">(${esc(o.hint)})</span>` : ''}`,
      onclick: () => {
        if (!o.ok) { sfx.error(); return; }
        sfx.click();
        chosen = true;
        close('chosen');
        onChoose(o.i);
      },
    });
    list.append(b);
  });
  body.append(list);
  // atajos numéricos 1-9
  const key = (ev) => {
    if (ev.target && /^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
    const n = parseInt(ev.key, 10);
    if (!(n >= 1 && n <= view.opts.length)) return;
    ev.preventDefault(); ev.stopPropagation();
    list.children[n - 1].click();
  };
  document.addEventListener('keydown', key, true);
  sfx.radio();
  close = modal({
    title: view.title, width: 'min(76ch, 94vw)', body,
    onClose: (v) => { document.removeEventListener('keydown', key, true); if (!chosen && v !== 'replaced' && onDismiss) onDismiss(); },
  });
  return close;
}
