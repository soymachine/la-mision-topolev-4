// Accesibilidad (fase 24.1): modo daltónico y alto contraste (y, desde la 24.3, los controles táctiles). Se aplican al arrancar y al cambiarlos en cualquier menú.
import { settings, saveSettings } from '../core/state.js';
import { applyColorblind } from '../data/rarity.js';
import { applyTouch, touchButton } from './touch.js';
import { t, LANGS, lang, cycleLang } from '../i18n/index.js';

export function applyA11y() {
  applyColorblind(settings.colorblind);
  document.body.classList.toggle('cb', !!settings.colorblind);
  document.body.classList.toggle('hc', !!settings.contrast);
  applyTouch(); // fase 24.3
}
// botones para los menús: [etiqueta, acción]; after() vuelve a dibujar el menú (idioma, 24.4; daltónico y contraste, 24.1; táctil, 24.3)
export function a11yButtons(after) {
  return [
    [t('menu.lang', { v: LANGS[lang()] }), () => { cycleLang(); after(); }],
    [t('menu.colorblind', { v: t(settings.colorblind ? 'yes' : 'no') }), () => { settings.colorblind = !settings.colorblind; saveSettings(); applyA11y(); after(); }],
    [t('menu.contrast', { v: t(settings.contrast ? 'yes' : 'no') }), () => { settings.contrast = !settings.contrast; saveSettings(); applyA11y(); after(); }],
    touchButton(after),
  ];
}
