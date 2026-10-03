// Controles de la expedición (fase 24.2): tabla de acciones con su tecla por defecto, remapeables.
// settings.keys guarda solo lo que el jugador ha cambiado: { acción: tecla }.
// Fijas (no remapeables): flechas y teclado numérico para moverse, 1–4 (agente), Esc (menú/cancelar),
// Enter (confirmar objetivo) y Numpad5 (esperar).
import { settings, saveSettings } from '../core/state.js';
import { t } from '../i18n/index.js';

export const KEY_ACTIONS = [
  { id: 'up', name: 'Mover arriba', def: ['w'], dir: [0, -1] },
  { id: 'down', name: 'Mover abajo', def: ['s'], dir: [0, 1] },
  { id: 'left', name: 'Mover a la izquierda', def: ['a'], dir: [-1, 0] },
  { id: 'right', name: 'Mover a la derecha', def: ['d'], dir: [1, 0] },
  { id: 'upleft', name: 'Diagonal arriba-izquierda', def: ['q'], dir: [-1, -1] },
  { id: 'upright', name: 'Diagonal arriba-derecha', def: ['e'], dir: [1, -1] },
  { id: 'downleft', name: 'Diagonal abajo-izquierda', def: ['z'], dir: [-1, 1] },
  { id: 'downright', name: 'Diagonal abajo-derecha', def: ['c'], dir: [1, 1] },
  { id: 'wait', name: 'Esperar un turno', def: [' ', '.'] },
  { id: 'interact', name: 'Interactuar (abrir, extraer, levantar, patear granadas)', def: ['f'] },
  { id: 'pickup', name: 'Recoger del suelo', def: ['g'] },
  { id: 'reload', name: 'Recargar / desencasquillar', def: ['r'] },
  { id: 'swap', name: 'Cambiar de arma', def: ['x'] },
  { id: 'aim', name: 'Apuntar (en el modo apuntar: siguiente objetivo)', def: ['t'] },
  { id: 'heal', name: 'Curarse con el mejor botiquín', def: ['h'] },
  { id: 'ability', name: 'Habilidad de la especialización', def: ['v'] },
  { id: 'light', name: 'Encender / apagar la linterna', def: ['l'] },
  { id: 'crouch', name: 'Agacharse / ponerse de pie', def: ['k'] },
  { id: 'ammo', name: 'Tipo de munición para la siguiente recarga', def: ['n'] },
  { id: 'suppress', name: 'Fuego de supresión (enemigo más cercano)', def: ['p'] },
  { id: 'companion', name: 'Compañero mecánico (perro, drones)', def: ['j'] },
  { id: 'grenade', name: 'Lanzar granada / objeto arrojadizo', def: ['b'] },
  { id: 'inventory', name: 'Inventario', def: ['i'] },
  { id: 'map', name: 'Mapa del radar', def: ['m'] },
  { id: 'orders', name: 'Órdenes del escuadrón', def: ['o'] },
  { id: 'air', name: 'Capa AIRE (humo, esporas y polvo)', def: ['u'] },
  { id: 'next', name: 'Siguiente agente', def: ['Tab'] },
  { id: 'help', name: 'Ayuda', def: ['?', 'F1'] },
  { id: 'zoomIn', name: 'Acercar', def: ['+'] },
  { id: 'zoomOut', name: 'Alejar', def: ['-'] },
];
const BY_ID = Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a]));
// teclas reservadas que no se pueden asignar
export const RESERVED = new Set(['Escape', 'Enter', '1', '2', '3', '4', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', 'Alt', 'Meta', 'F11']);

const norm = (k) => (k && k.length === 1 ? k.toLowerCase() : k);
export function keysFor(id) {
  const o = settings.keys && settings.keys[id];
  return o ? [o] : BY_ID[id].def;
}
let cache = null;
function table() {
  if (cache) return cache;
  cache = new Map();
  for (const a of KEY_ACTIONS) for (const k of keysFor(a.id)) if (!cache.has(norm(k))) cache.set(norm(k), a.id);
  return cache;
}
export const actionForKey = (k) => table().get(norm(k)) || null;
export const dirOf = (id) => (BY_ID[id] && BY_ID[id].dir) || null;
const PRETTY = { Tab: 'Tab', '.': '.', '+': '+', '-': '−', '?': '?' };
export const prettyKey = (k) => (k === ' ' ? t('ctl.space') : PRETTY[k] || (k.length === 1 ? k.toUpperCase() : k));
// nombre de la tecla de una acción (para la ayuda y los mensajes)
export const keyName = (id) => prettyKey(keysFor(id)[0]);
// asignar: { ok } o { ok: false, conflict: id de la acción que ya la usa, msg }
export function setKey(id, key) {
  if (!BY_ID[id]) return { ok: false, msg: t('ctl.unknown') };
  if (RESERVED.has(key) || /^Numpad/.test(key)) return { ok: false, msg: t('ctl.reserved') };
  const other = actionForKey(key);
  if (other && other !== id) return { ok: false, conflict: other, msg: t('ctl.conflict', { k: prettyKey(key), a: actionName(other) }) };
  settings.keys = { ...(settings.keys || {}) };
  if (BY_ID[id].def.length === 1 && norm(BY_ID[id].def[0]) === norm(key)) delete settings.keys[id];
  else settings.keys[id] = norm(key);
  cache = null; saveSettings();
  return { ok: true };
}
export function resetKeys() { settings.keys = {}; cache = null; saveSettings(); }
// nombre en el idioma elegido (fase 24.4); el campo name de la tabla es el español de referencia
export const actionName = (id) => (BY_ID[id] ? t('key.' + id) : id);

// ---------------------------------------------------------------- pantalla CONTROLES (24.2.3)
import { el, modal, toast } from '../util/dom.js';
export function controlsModal(onClose) {
  const body = el('div', { style: { minWidth: 'min(76ch, 92vw)' } });
  let waiting = null;
  const draw = () => {
    body.innerHTML = '';
    body.append(el('div', { class: 'dimt', style: { marginBottom: '.6em' }, text: t('ctl.hint') }));
    for (const a of KEY_ACTIONS) {
      const custom = settings.keys && settings.keys[a.id];
      const b = el('button', { class: 'btn small' + (custom ? ' primary' : ''), 'data-act': a.id, onclick: () => capture(a, b) }, keysFor(a.id).map(prettyKey).join(' · '));
      body.append(el('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', margin: '.15em 0' } }, el('span', { text: actionName(a.id) }), b));
    }
    body.append(el('div', { style: { marginTop: '.8em', textAlign: 'center' } }, el('button', { class: 'btn', onclick: () => { resetKeys(); toast(t('ctl.resetDone'), 'good'); draw(); } }, t('ctl.reset'))));
  };
  const capture = (a, b) => {
    if (waiting) window.removeEventListener('keydown', waiting, true);
    b.textContent = t('ctl.press');
    waiting = (ev) => {
      ev.preventDefault(); ev.stopImmediatePropagation();
      window.removeEventListener('keydown', waiting, true); waiting = null;
      if (ev.key !== 'Escape') { const r = setKey(a.id, ev.key); if (!r.ok) toast(r.msg, 'bad'); }
      draw();
    };
    window.addEventListener('keydown', waiting, true);
  };
  draw();
  modal({ title: t('ctl.title'), body, actions: [{ label: t('ctl.close') }], onClose: () => { if (waiting) window.removeEventListener('keydown', waiting, true); onClose && onClose(); } });
}

// filas de la ayuda (24.2.4): siempre con las teclas actuales
export function helpKeysHTML() {
  const K = (id) => `<span>${keysFor(id).map(prettyKey).join(' · ')}</span>`;
  const rows = [
    `<span>${['up', 'left', 'down', 'right'].map(keyName).join(' ')} / ${t('keys.arrows')}</span><span>${t('keys.move')}</span>`,
    `<span>${['upleft', 'upright', 'downleft', 'downright'].map(keyName).join(' ')} · numpad</span><span>${t('keys.diag')}</span>`,
    `<span>${t('keys.clickFloor')}</span><span>${t('keys.clickFloorD')}</span>`,
    `<span>${t('keys.clickEnemy')}</span><span>${t('keys.clickEnemyD')}</span>`,
  ];
  for (const a of KEY_ACTIONS) if (!a.dir) rows.push(`${K(a.id)}<span>${actionName(a.id)}${a.id === 'aim' ? t('keys.enterFires') : ''}</span>`);
  rows.push(`<span>1-4</span><span>${t('keys.agent')}</span>`, `<span>Esc</span><span>${t('keys.esc')}</span>`, `<span>${t('keys.remap')}</span><span>${t('keys.remapD')}</span>`);
  return rows.join('\n');
}

// mensajes y ayuda: si el jugador ha cambiado una tecla, «<b>R</b>» pasa a mostrar la tecla nueva
export function keyify(html) {
  if (typeof html !== 'string' || !settings.keys || !Object.keys(settings.keys).length) return html;
  return html.replace(/<b>([A-Z])<\/b>/g, (m, L) => {
    const a = KEY_ACTIONS.find((x) => !x.dir && x.def.length === 1 && x.def[0] === L.toLowerCase());
    return a ? `<b>${keyName(a.id)}</b>` : m;
  });
}
