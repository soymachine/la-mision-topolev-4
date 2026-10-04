// CONFIGURACIÓN (revisión tras la fase 24): todos los ajustes en una sola pantalla, desde el título, la base y la pausa.
// Audio (sonido, música y volúmenes con deslizador ASCII 0–100), pantalla (CRT, pantalla completa, texto, idioma),
// controles (teclas y táctiles), accesibilidad (daltónico, contraste) y partida (exportar copia).
import { el, modal, toast, UI_SCALES, cycleUiScale } from '../util/dom.js';
import { S, settings, saveSettings, save, exportSlot, lastSlot } from '../core/state.js';
import { sfx, music, setVolume, setBusVolume, busVolume } from '../audio.js';
import { ambience } from '../samples.js';
import { asciiSlider } from './widgets.js';
import { applyA11y } from './a11y.js';
import { touchButton } from './touch.js';
import { controlsModal } from './keys.js';
import { toggleFullscreen } from './expui.js';
import { t, LANGS, lang, cycleLang } from '../i18n/index.js';

// opts.after(): se llama al cerrar (para redibujar la pantalla de debajo: idioma, tamaño de texto…)
export function settingsModal(opts = {}) {
  const body = el('div', { class: 'settings', style: { minWidth: 'min(66ch, 92vw)' } });
  let close;
  const yn = (b) => t(b ? 'yes' : 'no');
  const row = (label, ctrl) => el('div', { class: 'set-row' }, el('span', { class: 'set-l', text: label }), ctrl);
  const toggle = (txt, fn, id) => el('button', { class: 'btn small', 'data-set': id, onclick: () => { sfx.click(); fn(); draw(); } }, txt);
  const slider = (id, val, fn) => { const s = asciiSlider({ value: Math.round(val * 100), width: 20, fmt: (v) => `${String(v).padStart(3, ' ')}%`, label: id, onInput: (v) => fn(v / 100), onChange: () => sfx.click() }); s.dataset.set = id; return s; };
  const draw = () => {
    body.innerHTML = '';
    body.append(el('div', { class: 'h', text: t('set.audio') }),
      row(t('set.sound'), toggle(yn(settings.sound), () => { settings.sound = !settings.sound; saveSettings(); music.sync(); ambience.sync(); }, 'sound')),
      row(t('set.music'), toggle(yn(settings.music !== false), () => { settings.music = settings.music === false; saveSettings(); music.sync(); }, 'music')),
      row(t('set.volMaster'), slider('volMaster', settings.volume ?? 0.5, (v) => { setVolume(v); saveSettings(); })),
      row(t('set.volMusic'), slider('volMusic', busVolume('music'), (v) => setBusVolume('music', v))),
      row(t('set.volSfx'), slider('volSfx', busVolume('sfx'), (v) => setBusVolume('sfx', v))),
      row(t('set.ambience'), toggle(yn(settings.ambience !== false), () => { settings.ambience = settings.ambience === false; saveSettings(); ambience.sync(); }, 'ambience')),
      row(t('set.volAmb'), slider('volAmb', busVolume('amb'), (v) => setBusVolume('amb', v))),
      el('div', { class: 'h', text: t('set.screen') }),
      row(t('set.crt'), toggle(yn(settings.crt), () => { settings.crt = !settings.crt; document.body.classList.toggle('no-crt', !settings.crt); saveSettings(); }, 'crt')),
      row(t('set.fullscreen'), toggle(t('set.toggle'), () => toggleFullscreen(), 'fullscreen')),
      row(t('set.text'), toggle(t('scale.' + (settings.uiScale || 0)), () => cycleUiScale(), 'text')),
      row(t('set.cloud'), toggle(yn(settings.cloud !== false), () => { settings.cloud = settings.cloud === false; saveSettings(); }, 'cloud')), // fase 27 (a prueba)
      row(t('set.airView'), toggle(t(settings.airView === false ? 'set.airOld' : 'set.airNew'), () => { settings.airView = settings.airView === false; saveSettings(); }, 'airview')), // fase 26 (a prueba)
      row(t('set.lang'), toggle(LANGS[lang()], () => cycleLang(), 'lang')),
      el('div', { class: 'h', text: t('set.controls') }),
      row(t('set.keys'), el('button', { class: 'btn small', 'data-set': 'keys', onclick: () => { sfx.click(); controlsModal(); } }, t('set.edit'))),
      row(t('set.touch'), (() => { const [lab, fn] = touchButton(() => {}); return toggle(lab.replace(/^[^:]*:\s*/, ''), fn, 'touch'); })()),
      el('div', { class: 'h', text: t('set.access') }),
      row(t('set.colorblind'), toggle(yn(settings.colorblind), () => { settings.colorblind = !settings.colorblind; saveSettings(); applyA11y(); }, 'colorblind')),
      row(t('set.contrast'), toggle(yn(settings.contrast), () => { settings.contrast = !settings.contrast; saveSettings(); applyA11y(); }, 'contrast')),
    );
    if (S && !S.iron) {
      body.append(el('div', { class: 'h', text: t('set.game') }),
        row(t('set.export'), el('button', { class: 'btn small', 'data-set': 'export', onclick: () => { sfx.click(); exportCopy(); } }, t('set.download'))));
    }
  };
  draw();
  close = modal({ title: t('set.title'), body, width: 'min(74ch, 96vw)', actions: [{ label: t('ctl.close') }], onClose: () => opts.after && opts.after() });
  return close;
}

export function exportCopy() {
  if (!S) return;
  save();
  const n = lastSlot();
  const txt = exportSlot(n);
  if (!txt) { toast(t('menu.saveFail'), 'bad'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
  a.download = `topolev-ranura${n}-dia${S.day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
