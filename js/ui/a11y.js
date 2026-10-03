// Accesibilidad (fase 24.1): modo daltónico y alto contraste (y, desde la 24.3, los controles táctiles). Se aplican al arrancar y al cambiarlos en cualquier menú.
import { settings, saveSettings } from '../core/state.js';
import { applyColorblind } from '../data/rarity.js';
import { applyTouch, touchButton } from './touch.js';
import { t, LANGS, lang, cycleLang } from '../i18n/index.js';
import { music, setBusVolume, busVolume } from '../audio.js';

export function applyA11y() {
  applyColorblind(settings.colorblind);
  document.body.classList.toggle('cb', !!settings.colorblind);
  document.body.classList.toggle('hc', !!settings.contrast);
  applyTouch(); // fase 24.3
}
// botones para los menús: [etiqueta, acción]; after() vuelve a dibujar el menú (idioma, 24.4; daltónico y contraste, 24.1; táctil, 24.3)
const VOLS = [0, 0.2, 0.4, 0.6, 0.8, 1];
const nextVol = (v) => VOLS[(VOLS.findIndex((x) => Math.abs(x - v) < 0.05) + 1) % VOLS.length];
export function a11yButtons(after) {
  return [
    [t('menu.lang', { v: LANGS[lang()] }), () => { cycleLang(); after(); }],
    // fase 24.5.3: música aparte de los efectos, con volúmenes separados
    [t('menu.music', { v: t(settings.music !== false ? 'yes' : 'no') }), () => { settings.music = settings.music === false; saveSettings(); music.sync(); after(); }],
    [t('menu.musicVol', { v: Math.round(busVolume('music') * 100) }), () => { setBusVolume('music', nextVol(busVolume('music'))); after(); }],
    [t('menu.sfxVol', { v: Math.round(busVolume('sfx') * 100) }), () => { setBusVolume('sfx', nextVol(busVolume('sfx'))); after(); }],
    [t('menu.colorblind', { v: t(settings.colorblind ? 'yes' : 'no') }), () => { settings.colorblind = !settings.colorblind; saveSettings(); applyA11y(); after(); }],
    [t('menu.contrast', { v: t(settings.contrast ? 'yes' : 'no') }), () => { settings.contrast = !settings.contrast; saveSettings(); applyA11y(); after(); }],
    touchButton(after),
  ];
}
