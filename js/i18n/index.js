// Localización (fase 24.4). t('clave', { x: 1 }) devuelve el texto en el idioma elegido (settings.lang).
// - Interpolación: «Día {d}» con { d: 3 } → «Día 3».
// - Plural sencillo: el valor puede ser { one: '…', other: '…' } y se elige con vars.n.
// - Si falta la clave en el idioma elegido, cae al español; si tampoco está, devuelve la propia clave.
//   Las que faltan quedan en missingKeys() (la consola de depuración las lista con «i18n»).
// Los datos del juego (objetos, enemigos, zonas…) no se duplican: cada idioma sobrescribe nombre y
// descripción por id (i18n/en/data.js) y applyDataLang() los cambia en los propios datos (guardando el
// español en _es para poder volver), así que todo lo que lee ITEMS[x].name sale ya traducido.
import { settings, saveSettings } from '../core/state.js';
import ES from './es.js';
import EN from './en.js';
import EN_DATA from './en/data.js';
import { ITEMS } from '../data/items.js';
import { ENEMIES } from '../data/enemies.js';
import { MAPS } from '../data/world.js';

export const LANGS = { es: 'Español', en: 'English' };
const DICT = { es: ES, en: EN };
const DATA = { en: EN_DATA };
const missing = new Set();

export const lang = () => (DICT[settings.lang] ? settings.lang : 'es');
export function setLang(l) {
  settings.lang = DICT[l] ? l : 'es';
  saveSettings();
  applyLang();
}
export function applyLang() {
  document.documentElement.lang = lang();
  applyDataLang();
}
export function cycleLang() {
  const ls = Object.keys(LANGS);
  setLang(ls[(ls.indexOf(lang()) + 1) % ls.length]);
}

function pick(v, vars) {
  if (v && typeof v === 'object') return vars && vars.n === 1 ? v.one : v.other;
  return v;
}
export function t(key, vars) {
  const L = lang();
  let v = DICT[L][key];
  if (v == null) {
    if (L !== 'es') missing.add(key);
    v = ES[key];
    if (v == null) { missing.add(key); return key; }
  }
  v = pick(v, vars);
  return vars ? String(v).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : v;
}
export const missingKeys = () => [...missing];
// claves del español que aún no tiene un idioma (para completar traducciones)
export const untranslated = (l = 'en') => Object.keys(ES).filter((k) => DICT[l] && DICT[l][k] == null);

// datos del juego en el idioma elegido (se llama al arrancar y al cambiar de idioma)
const SOURCES = { items: () => Object.entries(ITEMS), enemies: () => Object.entries(ENEMIES), zones: () => MAPS.map((m) => [m.id, m]) };
const FIELDS = ['name', 'desc'];
export function applyDataLang() {
  const over = DATA[lang()] || {};
  for (const [kind, list] of Object.entries(SOURCES)) {
    for (const [id, d] of list()) {
      const o = over[kind] && over[kind][id];
      if (!o && !d._es) continue;
      if (!d._es) Object.defineProperty(d, '_es', { value: Object.fromEntries(FIELDS.map((f) => [f, d[f]])), enumerable: false });
      for (const f of FIELDS) if (d._es[f] != null) d[f] = (o && o[f]) || d._es[f];
    }
  }
}
// un dato suelto sin tocar los objetos: loc('items', 'makarov', 'name', textoEnEspañol)
export function loc(kind, id, field, fallback) {
  const L = lang();
  if (L === 'es') return fallback;
  const d = DATA[L] && DATA[L][kind] && DATA[L][kind][id];
  return (d && d[field]) || fallback;
}
