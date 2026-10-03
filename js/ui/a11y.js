// Accesibilidad (fase 24.1): modo daltónico y alto contraste. Se aplican al arrancar y al cambiarlos en cualquier menú.
import { settings, saveSettings } from '../core/state.js';
import { applyColorblind } from '../data/rarity.js';

export function applyA11y() {
  applyColorblind(settings.colorblind);
  document.body.classList.toggle('cb', !!settings.colorblind);
  document.body.classList.toggle('hc', !!settings.contrast);
}
// botones para los menús: [etiqueta, acción]; after() vuelve a dibujar el menú
export function a11yButtons(after) {
  return [
    [`MODO DALTÓNICO: ${settings.colorblind ? 'SÍ' : 'NO'}`, () => { settings.colorblind = !settings.colorblind; saveSettings(); applyA11y(); after(); }],
    [`ALTO CONTRASTE: ${settings.contrast ? 'SÍ' : 'NO'}`, () => { settings.contrast = !settings.contrast; saveSettings(); applyA11y(); after(); }],
  ];
}
