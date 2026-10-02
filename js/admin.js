// Archivo Topolev: catálogo de todo el contenido del juego (lee los datos reales del juego)
import { ITEMS, CAT_INFO, AMMO_NAMES, AFFIXES, MYTHIC_NAMES, EPITHETS, UNCOMMON_SUFFIX, RARE_SUFFIX } from './data/items.js';
import { RARITIES, rarityWeights } from './data/rarity.js';
import { ENEMIES, ABIL_TEXT, enemyColor, scaleEnemy } from './data/enemies.js';
import { MAPS, MODULES, MODULE_MAX, moduleCost, squadSize, rosterSize, stashSize, TRAITS, SECTOR_NAMES, FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, NICKNAMES } from './data/world.js';
import { TILES } from './data/tiles.js';
import { MOD_SLOTS, weaponSlots } from './data/mods.js';
import { gadgetExtras, gadgetEffectLines, WTYPE_NAMES } from './core/items.js';
import { NOTES, RADIO, SURVIVOR_LINES } from './data/lore.js';
import { FACTIONS, baseAttitude, ATTITUDE_TEXT } from './data/factions.js';
import { HUMANS, scaleHuman } from './data/humans.js';
import { EVENTS } from './data/events.js';
import { DIALOGS } from './data/dialogs.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byCat = (c) => Object.entries(ITEMS).filter(([, d]) => d.cat === c).map(([id, d]) => ({ id, ...d })).sort((a, b) => a.tier - b.tier || a.value - b.value);
const tag = (t, cls = '') => `<span class="tag ${cls}">${esc(t)}</span>`;
const R = RARITIES;
const ESS = '#5ff7ff';

const WTYPE = { melee: 'Cuerpo a cuerpo', pistol: 'Pistola', smg: 'Subfusil', shotgun: 'Escopeta', rifle: 'Fusil', sniper: 'Tirador', mg: 'Ametralladora', flame: 'Lanzallamas', launcher: 'Lanzador', energy: 'Esencia' };
const ZONE_TYPE = { industrial: 'Industrial', ruinas: 'Ruinas', caverna: 'Caverna', inundado: 'Inundado' };
const SHOP_MODULE = { weapon: 'Armería', mod: 'Armería', armor: 'Blindaje', helmet: 'Blindaje', gadget: 'Taller', backpack: 'Taller' };
const minZone = (tier) => Math.max(1, tier * 2 - 1);
function shopText(d, id) {
  if (d.cat === 'valuable') return '<span class="desc">solo botín</span>';
  if (d.cat === 'ammo') return id === 'a_cell' ? 'Laboratorio ≥ 3' : d.tier <= 1 ? 'siempre' : `Armería ≥ ${d.tier}`;
  if (d.cat === 'consumable') return `${d.use === 'throw' || d.use === 'beacon' ? 'Taller' : 'Enfermería'} ≥ ${d.tier}`;
  return `${SHOP_MODULE[d.cat]} ≥ ${d.tier}`;
}
const rarityRow = (fn) => R.map((r) => `<span style="color:${r.color}" title="${r.name}">${fn(r)}</span>`).join(' ');

// ------------------------------------------------------------ secciones
const SECTIONS = [];
const sec = (grp, id, label, count, render, intro = '') => SECTIONS.push({ grp, id, label, count, render, intro });

sec('General', 'resumen', 'Resumen', null, renderSummary);

// ----- OBJETOS -----
sec('Objetos', 'armas', 'Armas', byCat('weapon').length, () => table(byCat('weapon'), [
  { h: '', g: true, v: (d) => `<span style="color:${R[Math.min(5, d.tier)].color}">${esc(d.glyph)}</span>` },
  { h: 'Nombre', v: (d) => `<div class="nm">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>${d.art ? `<pre class="art" style="color:${R[Math.min(5, d.tier)].color}">${esc(d.art)}</pre>` : ''}`, s: (d) => d.name },
  { h: 'Tipo', v: (d) => WTYPE[d.wtype], s: (d) => d.wtype },
  { h: 'Mods', v: (d) => weaponSlots(d.id, d.wtype).map((sl) => `<span title="${MOD_SLOTS[sl].name}">${MOD_SLOTS[sl].glyph}</span>`).join(' ') || '—', s: (d) => weaponSlots(d.id, d.wtype).length },
  { h: 'Nv', num: true, v: (d) => d.tier, s: (d) => d.tier },
  { h: 'Daño', num: true, v: (d) => `${d.dmg[0]}–${d.dmg[1]}${d.burst > 1 ? ` ×${d.burst}` : ''}`, s: (d) => (d.dmg[0] + d.dmg[1]) / 2 * d.burst },
  { h: 'Daño/turno', num: true, v: (d) => ((d.dmg[0] + d.dmg[1]) / 2 * d.burst).toFixed(1), s: (d) => (d.dmg[0] + d.dmg[1]) / 2 * d.burst },
  { h: 'Por rareza', nw: true, v: (d) => rarityRow((r) => Math.round((d.dmg[0] + d.dmg[1]) / 2 * d.burst * r.mult)), s: (d) => (d.dmg[0] + d.dmg[1]) * d.burst },
  { h: 'Prec.', num: true, v: (d) => d.acc + '%', s: (d) => d.acc },
  { h: 'Alc.', num: true, v: (d) => d.range, s: (d) => d.range },
  { h: 'Carg.', num: true, v: (d) => d.mag || '—', s: (d) => d.mag || 0 },
  { h: 'Munición', v: (d) => (d.ammo ? AMMO_NAMES[d.ammo] : '—'), s: (d) => d.ammo || '' },
  { h: 'Crít.', num: true, v: (d) => d.crit + '%', s: (d) => d.crit },
  { h: 'Ruido', num: true, v: (d) => d.noise, s: (d) => d.noise },
  { h: 'Especial', v: (d) => [d.blast ? tag(`explosión radio ${d.blast}`, 'b') : '', d.fire ? tag('incendia', 'b') : '', d.pierce >= 99 ? tag('perfora todo', 'c') : d.pierce ? tag(`perfora ${d.pierce}`, 'c') : '', d.chain ? tag(`salta a ${d.chain}`, 'c') : '', d.wtype === 'flame' ? tag('incendia', 'b') : '', d.wtype === 'shotgun' ? tag('pierde daño lejos') : '', d.wtype === 'sniper' ? tag('−20% adyacente') : '', d.noise <= 3 ? tag('silenciosa', 'g') : ''].join('') },
  { h: 'Intendencia', v: (d) => shopText(d), s: (d) => d.tier },
  { h: 'Valor ₽', num: true, v: (d) => d.value, s: (d) => d.value },
]), 'Cada arma muestra su dibujo ASCII, el mismo que aparece en su ficha dentro del juego. Columna Mods: ranuras disponibles (⌖ óptica · » boca · ╤ empuñadura · ▮ cargador · ◣ culata · ┬ bajo cañón). Daño/turno = daño medio × ráfaga. «Por rareza» muestra ese daño con el multiplicador de cada rareza (sin contar propiedades extra). La precisión final suma la puntería del agente ×2 y resta la esquiva del enemigo y 7 puntos por casilla más allá del alcance.');

sec('Objetos', 'mods', 'Mods de armas', byCat('mod').length, () => table(byCat('mod'), [
  { h: '', g: true, v: (d) => `<span title="${MOD_SLOTS[d.slot].name}">${MOD_SLOTS[d.slot].glyph}</span>` },
  { h: 'Nombre', v: (d) => `<div class="nm">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>`, s: (d) => d.name },
  { h: 'Ranura', v: (d) => MOD_SLOTS[d.slot].name, s: (d) => d.slot },
  { h: 'Nv', num: true, v: (d) => d.tier, s: (d) => d.tier },
  { h: 'Efectos', v: (d) => [d.acc ? tag(`${d.acc > 0 ? '+' : ''}${d.acc}% precisión`, d.acc > 0 ? 'g' : 'b') : '', d.range ? tag(`${d.range > 0 ? '+' : ''}${d.range} alcance`, d.range > 0 ? 'g' : 'b') : '', d.crit ? tag(`+${d.crit}% crítico`, 'g') : '', d.noise ? tag(`${d.noise} ruido`, 'g') : '', d.magPct ? tag(`${d.magPct > 0 ? '+' : ''}${d.magPct}% cargador`, d.magPct > 0 ? 'g' : 'b') : '', d.dmgPct ? tag(`${d.dmgPct > 0 ? '+' : ''}${d.dmgPct}% daño`, d.dmgPct > 0 ? 'g' : 'b') : '', d.pierce ? tag(`+${d.pierce} perforación`, 'g') : '', d.scope ? tag('mira de tirador', 'c') : '', d.still ? tag(`+${d.still}% quieto`, 'c') : '', d.vision ? tag(`+${d.vision} visión`, 'c') : '', d.bayonet ? tag('bayoneta', 'b') : ''].join('') },
  { h: 'Compatible con', v: (d) => d.fits.map((w) => tag(WTYPE[w])).join('') },
  { h: 'Armas concretas', v: (d) => { const ws = byCat('weapon').filter((w) => d.fits.includes(w.wtype) && weaponSlots(w.id, w.wtype).includes(d.slot)); return `<span class="desc">${ws.length} armas</span>`; }, s: (d) => byCat('weapon').filter((w) => d.fits.includes(w.wtype) && weaponSlots(w.id, w.wtype).includes(d.slot)).length },
  { h: 'Intendencia', v: (d) => shopText(d), s: (d) => d.tier },
  { h: 'Valor ₽', num: true, v: (d) => d.value, s: (d) => d.value },
]), 'Los mods se montan en la base (EQUIPO): arrastra el mod a la ranura que aparece bajo el arma del agente. Cada tipo de arma tiene sus ranuras, y algunas armas concretas no tienen todas (silenciador integrado, revólveres, tambores fijos…). Las miras de tirador dan alcance y crítico pero penalizan a quemarropa. Los valores positivos crecen con la rareza del mod.');

sec('Objetos', 'municion', 'Munición', byCat('ammo').length, () => table(byCat('ammo'), [
  { h: '', g: true, v: (d) => esc(d.glyph) },
  { h: 'Nombre', v: (d) => `<div class="nm">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>`, s: (d) => d.name },
  { h: 'Nv', num: true, v: (d) => d.tier, s: (d) => d.tier },
  { h: 'Paquete', num: true, v: (d) => d.pack, s: (d) => d.pack },
  { h: 'Pila máx.', num: true, v: (d) => d.stack, s: (d) => d.stack },
  { h: '₽/unidad', num: true, v: (d) => d.value, s: (d) => d.value },
  { h: 'Armas que la usan', v: (d) => byCat('weapon').filter((w) => w.ammo === d.id).map((w) => tag(w.name)).join('') },
  { h: 'Intendencia', v: (d) => shopText(d, d.id) },
]), 'Las armas se recargan automáticamente en la base con la munición de la mochila. El Polvorín da cargadores gratis y descuentos.');

const protCols = (extra = []) => [
  { h: '', g: true, v: (d) => esc(d.glyph) },
  { h: 'Nombre', v: (d) => `<div class="nm">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>`, s: (d) => d.name },
  { h: 'Nv', num: true, v: (d) => d.tier, s: (d) => d.tier },
  { h: 'Protección', num: true, v: (d) => d.prot ?? 0, s: (d) => d.prot ?? 0 },
  { h: 'Resist. rad.', num: true, v: (d) => (d.rad ?? 0) + '%', s: (d) => d.rad ?? 0 },
  ...extra,
  { h: 'Por rareza (prot.)', nw: true, v: (d) => rarityRow((r) => (d.prot > 0 ? Math.round(d.prot * (1 + (r.mult - 1) * 0.8)) : 0)) },
  { h: 'Intendencia', v: (d) => shopText(d), s: (d) => d.tier },
  { h: 'Valor ₽', num: true, v: (d) => d.value, s: (d) => d.value },
];
sec('Objetos', 'armaduras', 'Armaduras', byCat('armor').length, () => table(byCat('armor'), protCols([
  { h: 'Agilidad', num: true, v: (d) => d.ev ?? 0, s: (d) => d.ev ?? 0 },
  { h: 'Salud', num: true, v: (d) => (d.hp ? '+' + d.hp : '—'), s: (d) => d.hp ?? 0 },
])), 'La protección resta daño a cada golpe recibido. La resistencia reduce la radiación absorbida (máximo 90% combinando piezas).');
sec('Objetos', 'cascos', 'Cascos', byCat('helmet').length, () => table(byCat('helmet'), protCols([
  { h: 'Visión', num: true, v: (d) => (d.vision ? '+' + d.vision : '—'), s: (d) => d.vision ?? 0 },
  { h: 'Gas', v: (d) => (d.gasImmune ? tag('inmune', 'g') : '—') },
])));

const EFF = { vision: (v) => `+${v} visión`, rad: (v) => `+${v}% resist. rad.`, essence: (v) => `+${v}% esencia`, acc: (v) => `+${v} puntería`, regen: (v) => `regenera ${v}`, ev: (v) => `${v > 0 ? '+' : ''}${v} agilidad`, crit: (v) => `+${v}% crítico`, hp: (v) => `+${v} salud máx.`, slots: (v) => `+${v} huecos`, gasImmune: () => 'inmune al gas' };
const effTags = (d) => Object.keys(EFF).filter((k) => d[k]).map((k) => tag(EFF[k](d[k]), 'g')).join('');
sec('Objetos', 'gadgets', 'Gadgets', byCat('gadget').length, () => table(byCat('gadget'), [
  { h: '', g: true, v: (d) => esc(d.glyph) },
  { h: 'Nombre', v: (d) => `<div class="nm">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>`, s: (d) => d.name },
  { h: 'Nv', num: true, v: (d) => d.tier, s: (d) => d.tier },
  { h: 'Efectos', v: effTags },
  { h: 'Sinergias y especiales', v: (d) => gadgetEffectLines({ b: d.id, r: 0 }).map((l) => `<div class="desc" style="color:var(--cyan)">◈ ${l}</div>`).join('') || '—' },
  { h: 'Tipo', v: (d) => { const x = gadgetExtras({ b: d.id, r: 0 }); return [x.cond ? tag({ near: 'juntos', alone: 'separado', still: 'quieto', hurt: 'herido', lowhp: 'último aliento' }[x.cond.when], 'c') : '', x.aura ? tag('aura', 'g') : '', x.team ? tag('equipo', 'g') : '', d.set ? tag('conjunto', 'b') : '', x.flags ? tag('especial') : ''].join('') || tag('pasivo'); } },
  { h: 'Intendencia', v: (d) => shopText(d), s: (d) => d.tier },
  { h: 'Valor ₽', num: true, v: (d) => d.value, s: (d) => d.value },
]), 'Cada agente lleva 2 gadgets. Muchos tienen sinergias: se activan juntos o separados del grupo, quieto, herido, como aura para los aliados cercanos, si varios agentes llevan el mismo, en conjunto con otra pieza, o al matar.');
sec('Objetos', 'mochilas', 'Mochilas', byCat('backpack').length, () => table(byCat('backpack'), [
  { h: '', g: true, v: (d) => esc(d.glyph) },
  { h: 'Nombre', v: (d) => `<div class="nm">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>`, s: (d) => d.name },
  { h: 'Nv', num: true, v: (d) => d.tier, s: (d) => d.tier },
  { h: 'Huecos extra', num: true, v: (d) => '+' + d.slots, s: (d) => d.slots },
  { h: 'Intendencia', v: (d) => shopText(d), s: (d) => d.tier },
  { h: 'Valor ₽', num: true, v: (d) => d.value, s: (d) => d.value },
]), 'Un agente tiene 6 huecos de mochila de base (más si tiene el rasgo Carroñero). Cada pila de objetos ocupa un hueco.');

const BUFFTXT = { acc: (v) => `${v > 0 ? '+' : ''}${v} puntería`, ev: (v) => `+${v} agilidad`, crit: (v) => `+${v}% crítico`, dmgPct: (v) => `+${v}% daño`, prot: (v) => `+${v} protección`, rad: (v) => `+${v}% resist. rad.`, vision: (v) => `+${v} visión`, regen: (v) => `regenera ${v}`, gasImmune: () => 'inmune al gas' };
function consEffect(d) {
  const t = [];
  if (d.heal) t.push(tag(d.heal >= 999 ? 'cura toda la salud' : `cura ${d.heal}`, 'g'));
  if (d.cure) t.push(tag('quita veneno', 'g'));
  if (d.cureBurn) t.push(tag('apaga quemaduras', 'g'));
  if (d.radHeal) t.push(tag(`−${d.radHeal} radiación`, 'g'));
  if (d.buff) {
    const m = Object.entries(d.buff.mods || {}).map(([k, v]) => BUFFTXT[k] ? BUFFTXT[k](v) : k).join(', ');
    t.push(tag(`${m}${d.buff.flags && d.buff.flags.poisonImmune ? 'inmune al veneno' : ''} · ${d.buff.turns}t`, 'c'));
    if (d.buff.after) t.push(tag('después: veneno', 'b'));
  }
  if (d.use === 'throw') {
    if (d.dmg) t.push(tag(`${d.dmg[0]}–${d.dmg[1]} daño · radio ${d.blast}`, 'b'));
    if (d.pierce) t.push(tag('ignora blindaje', 'b'));
    if (d.fire) t.push(tag('incendia', 'b'));
    if (d.essBoost) t.push(tag(`+${d.essBoost}% esencia`, 'c'));
    if (d.lure) t.push(tag(`atrae a ${d.lure} casillas${d.light ? ' e ilumina' : ''}`, 'c'));
    if (d.smoke) t.push(tag(`humo radio ${d.smoke} · bloquea visión`, 'c'));
    if (d.gas) t.push(tag(`nube tóxica radio ${d.gas}`, 'b'));
    if (d.stun) t.push(tag(`aturde ${d.stun}t · radio ${d.blast}`, 'c'));
    t.push(tag(`alcance ${d.range}`));
  }
  if (d.use === 'trap') t.push(tag(`trampa: ${d.trap.dmg[0]}–${d.trap.dmg[1]}${d.trap.blast ? ` radio ${d.trap.blast}` : ''}${d.trap.stun ? ` · inmoviliza ${d.trap.stun}t` : ''}`, 'b'));
  if (d.use === 'beacon') t.push(tag('abre extracción en 6 turnos', 'c'));
  if (d.use === 'signal') t.push(tag('extracción temporal inmediata', 'c'));
  if (d.use === 'reveal') t.push(tag(`cartografía radio ${d.radius}`, 'c'));
  if (d.use === 'sense') t.push(tag(`detecta enemigos a ${d.radius} · ${d.turns}t`, 'c'));
  if (d.use === 'ammo') t.push(tag(`${d.mags} cargadores por arma`, 'g'));
  return t.join('');
}
const USE = { heal: 'Curación', antirad: 'Antirradiación', buff: 'Potenciador', throw: 'Arrojadizo', trap: 'Trampa', beacon: 'Baliza', signal: 'Señal', reveal: 'Cartografía', sense: 'Detección', ammo: 'Munición' };
sec('Objetos', 'consumibles', 'Consumibles', byCat('consumable').length, () => table(byCat('consumable'), [
  { h: '', g: true, v: (d) => esc(d.glyph) },
  { h: 'Nombre', v: (d) => `<div class="nm">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>`, s: (d) => d.name },
  { h: 'Uso', v: (d) => USE[d.use], s: (d) => d.use },
  { h: 'Nv', num: true, v: (d) => d.tier, s: (d) => d.tier },
  { h: 'Efecto', v: consEffect },
  { h: 'Pila', num: true, v: (d) => d.stack, s: (d) => d.stack },
  { h: 'Intendencia', v: (d) => shopText(d), s: (d) => d.tier },
  { h: 'Valor ₽', num: true, v: (d) => d.value, s: (d) => d.value },
]), 'Usar un consumible gasta un turno. Las curaciones mejoran un 50% con el rasgo Sanitario. Los potenciadores aplican un efecto temporal (se ve en la tarjeta del agente). Las trampas se colocan en una casilla adyacente y saltan cuando un chebylita las pisa.');
sec('Objetos', 'botin', 'Botín', byCat('valuable').length, () => table(byCat('valuable'), [
  { h: '', g: true, v: (d) => esc(d.glyph) },
  { h: 'Nombre', v: (d) => `<div class="nm">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>`, s: (d) => d.name },
  { h: 'Nv', num: true, v: (d) => d.tier, s: (d) => d.tier },
  { h: 'Aparece desde zona Nv', num: true, v: (d) => minZone(d.tier), s: (d) => d.tier },
  { h: 'Valor ₽', num: true, v: (d) => d.value, s: (d) => d.value },
  { h: 'Valor por rareza', nw: true, v: (d) => rarityRow((r) => Math.round(d.value * r.value)), s: (d) => d.value },
  { h: 'Especial', v: (d) => [d.essenceValue ? tag(`convertible en ${d.essenceValue} ✦`, 'c') : '', d.radioactive ? tag('radiactivo: +0,6 rad/turno', 'b') : ''].join('') },
]), 'El botín se vende a precio completo en la intendencia (el equipo, al 40%).');

// ----- SISTEMAS -----
sec('Sistemas', 'rarezas', 'Rarezas', R.length, renderRarities);
sec('Sistemas', 'afijos', 'Propiedades (afijos)', AFFIXES.length, renderAffixes);
sec('Sistemas', 'nombres', 'Nombres de objetos', MYTHIC_NAMES.length + EPITHETS.length + UNCOMMON_SUFFIX.length + RARE_SUFFIX.length, renderItemNames);

// ----- MUNDO -----
sec('Mundo', 'enemigos', 'Chebylitas', Object.keys(ENEMIES).length, renderEnemies);
sec('Mundo', 'facciones', 'Facciones', Object.keys(FACTIONS).length, renderFactions, 'Actitud inicial de cada facción hacia las demás. Durante la expedición cambia: atacar a un neutral o a un aliado vuelve hostil a toda su facción (−25 de reputación).');
sec('Mundo', 'personas', 'Personas', Object.keys(HUMANS).length, renderHumans, 'Miembros de otras expediciones. Usan armas reales del catálogo, recargan, huyen heridos y sueltan su equipo al morir. Todavía no aparecen en los mapas: llegarán con las zonas nuevas (fase 18). Se pueden generar con la consola de depuración (tecla º → spawn).');
sec('Mundo', 'zonas', 'Zonas', MAPS.length, renderMaps);
sec('Mundo', 'casillas', 'Casillas del mapa', TILES.length, () => table(TILES.map((t, i) => ({ i, ...t })), [
  { h: 'Glifos', v: (t) => t.glyphs.map((g, k) => `<b style="color:${t.fg[k % t.fg.length]};${t.bg ? `background:${t.bg};` : ''}padding:0 .3ch">${esc(g)}</b>`).join(' ') },
  { h: 'Nombre', v: (t) => `<span class="nm">${esc(t.name)}</span>`, s: (t) => t.name },
  { h: 'Transitable', v: (t) => (t.walk ? tag('sí', 'g') : t.fly ? tag('solo voladores', 'c') : tag('no', 'b')) },
  { h: 'Bloquea visión', v: (t) => (t.opaque ? 'sí' : 'no') },
  { h: 'Animada', v: (t) => (t.anim ? tag(t.anim, 'c') : '—') },
]), 'El agua (y sus variantes) está contaminada y añade radiación. Los peligros (gas, fuego, anomalías, focos de radiación) son capas encima de las casillas.');

// ----- BASE -----
sec('Base', 'modulos', 'Módulos', MODULES.length, renderModules);
sec('Base', 'rasgos', 'Rasgos de agentes', TRAITS.length, () => table(TRAITS, [
  { h: 'Rasgo', v: (t) => `<span class="nm">${esc(t.name)}</span>`, s: (t) => t.name },
  { h: 'Efecto', v: (t) => esc(t.desc) },
  { h: 'Tipo', v: (t) => (Object.values(t.mod).some((v) => v < 0) ? tag('mixto', 'b') : tag('ventaja', 'g')) },
]), 'Cada agente tiene un rasgo aleatorio. Al subir de nivel ganan salud y, a veces, puntería y agilidad.');
sec('Base', 'agentes', 'Nombres de agentes', FIRST_NAMES_M.length + FIRST_NAMES_F.length + LAST_NAMES.length + NICKNAMES.length, renderAgentNames);

// ----- NARRATIVA -----
sec('Narrativa', 'notas', 'Notas', NOTES.length, () => `<div class="list">${NOTES.map((n) => `<div class="note row-f"><div>${esc(n.t)}</div><div class="a">— ${esc(n.a)}</div></div>`).join('')}</div>`, 'Se encuentran en el suelo (glifo ?) durante las expediciones: de 1 a 3 por mapa.');
sec('Narrativa', 'radio', 'Mensajes de radio', RADIO.length, () => `<div class="list">${RADIO.map((n) => `<div class="note row-f">📻 ${esc(n)}</div>`).join('')}</div>`, 'Aparecen en el registro cada 60–110 turnos. Las extracciones temporales también se anuncian por radio.');
sec('Narrativa', 'supervivientes', 'Supervivientes', SURVIVOR_LINES.length, () => `<div class="list">${SURVIVOR_LINES.map((n) => `<div class="note row-f">☺ ${esc(n)}</div>`).join('')}</div><p class="desc">Hablar con un superviviente abre el diálogo <b>survivor</b> (ver «Diálogos»).</p>`, 'Hay un 50% de probabilidad de encontrar uno por expedición.');
sec('Narrativa', 'eventos', 'Eventos', EVENTS.length, renderEvents, 'Sucesos narrativos de data/events.js: un disparador, condiciones y efectos. «Una vez» puede ser por partida, por expedición o por agente.');
sec('Narrativa', 'dialogos', 'Diálogos', Object.keys(DIALOGS).length, renderDialogs, 'Árboles de diálogo de data/dialogs.js. Las opciones con condición aparecen desactivadas si no se cumple; las marcadas con ⌛ gastan el turno.');

// ------------------------------------------------------------ vistas especiales
function renderSummary() {
  const items = Object.values(ITEMS);
  const equipBases = items.filter((d) => ['weapon', 'armor', 'helmet', 'gadget', 'backpack'].includes(d.cat)).length;
  const cards = SECTIONS.filter((s) => s.count != null).map((s) => `<a class="card" href="#${s.id}"><div class="big">${s.count}</div><div class="lb">${esc(s.label)}</div><div class="dd">${esc(s.grp)}</div></a>`).join('');
  const bosses = Object.values(ENEMIES).filter((e) => e.boss).length;
  return `<p class="intro">Catálogo generado directamente a partir de los datos del juego: si se añade contenido, aparece aquí automáticamente. Pulsa en una categoría para ver la lista; las columnas de las tablas se pueden ordenar y el buscador filtra filas.</p>
  <div class="cards">${cards}</div>
  <div class="block"><h3>Profundidad del juego</h3>
    <div>${byCat('weapon').length} armas · ${byCat('mod').length} mods de arma en ${Object.keys(MOD_SLOTS).length} ranuras · ${byCat('gadget').length} gadgets · ${byCat('consumable').length} consumibles</div>
    <div>${items.length} objetos base (${equipBases} de equipo) × ${R.length} rarezas · ${AFFIXES.length} propiedades aleatorias · ${MYTHIC_NAMES.length} nombres míticos</div>
    <div>${Object.keys(ENEMIES).length} especies de chebylita (${bosses} jefes) con 10 niveles de poder · ${new Set(Object.values(ENEMIES).flatMap((e) => e.abil)).size} habilidades distintas</div>
    <div>${MAPS.length} zonas generadas proceduralmente · ${Object.values(SECTOR_NAMES).flat().length} nombres de sector · ${Object.keys(SECTOR_NAMES).length} tipos de terreno</div>
    <div>${MODULES.length} módulos de base × ${MODULE_MAX} niveles · ${TRAITS.length} rasgos · ${NOTES.length} notas, ${RADIO.length} mensajes de radio y ${SURVIVOR_LINES.length} supervivientes</div>
  </div>
  <div class="block"><h3>Objetos por nivel (tier)</h3>${[0, 1, 2, 3, 4, 5].map((t) => { const n = items.filter((d) => d.tier === t).length; return `<div>Nv ${t} <span class="bar" style="width:${n * 1.2}ch"></span> ${n} · zona Nv ≥ ${minZone(t)}</div>`; }).join('')}</div>`;
}

function renderRarities() {
  const head = `<tr><th>Zona Nv</th>${R.map((r) => `<th style="color:${r.color}">${r.name}</th>`).join('')}</tr>`;
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => {
    const w = rarityWeights(l); const tot = w.reduce((a, b) => a + b, 0);
    return `<tr><td class="num">${l}</td>${w.map((x, i) => `<td class="num" style="color:${R[i].color}">${((x / tot) * 100).toFixed(x / tot < 0.01 ? 2 : 1)}%</td>`).join('')}</tr>`;
  }).join('');
  return table(R, [
    { h: '', g: true, v: (r) => `<span style="color:${r.color}">■</span>` },
    { h: 'Rareza', v: (r) => `<span style="color:${r.color};font-weight:700">${r.name}</span>`, s: (r) => r.id },
    { h: 'Color', v: (r) => r.color },
    { h: 'Multiplicador', num: true, v: (r) => '×' + r.mult, s: (r) => r.mult },
    { h: 'Propiedades', num: true, v: (r) => r.affixes, s: (r) => r.affixes },
    { h: 'Valor', num: true, v: (r) => '×' + r.value, s: (r) => r.value },
    { h: 'Nombre', v: (r) => ['nombre base', 'base + sufijo («mejorado»…)', 'base + sufijo («de élite»…)', 'base + epíteto «…»', 'base + epíteto «…»', 'base + nombre mítico «…»'][r.id] },
  ]) + `<div class="block"><h3>Probabilidad de rareza según el nivel de la zona</h3><table>${head}${rows}</table><p class="desc">Los alijos tienen +30% de bonificación de rareza; los jefes, +80%. La Forja de esencia sube una rareza a cambio de esencia (máximo según el nivel del Laboratorio).</p></div>`;
}

function renderAffixes() {
  const lo = { int: (a) => a, chance: () => false, pick: (x) => x[0], float: (a) => a };
  const hi = { int: (a, b) => b, chance: () => true, pick: (x) => x[0], float: (a, b) => b };
  return table(AFFIXES, [
    { h: 'Propiedad', v: (a) => `<span class="nm">${esc(a.label('X'))}</span>`, s: (a) => a.id },
    { h: 'Aparece en', v: (a) => a.cats.map((c) => tag(CAT_INFO[c].name)).join('') + (a.ranged ? tag('solo a distancia', 'b') : '') },
    { h: 'Rango de valores por rareza', v: (a) => R.slice(1).map((r) => `<span style="color:${r.color}">${a.roll(r.id, lo)}–${a.roll(r.id, hi)}</span>`).join(' · ') },
  ]) + '<p class="desc">Un objeto recibe tantas propiedades como indica su rareza (no común 1 … mítico 5), elegidas al azar entre las de su categoría y sin repetir.</p>';
}

function renderItemNames() {
  const list = (t, arr, color) => `<div class="block"><h3 style="color:${color}">${t} (${arr.length})</h3>${arr.map((x) => tag(x)).join('')}</div>`;
  return list('Sufijos de no común', UNCOMMON_SUFFIX, R[1].color) + list('Sufijos de raro', RARE_SUFFIX, R[2].color) + list('Epítetos de épico y legendario', EPITHETS, R[3].color) + list('Nombres míticos', MYTHIC_NAMES, R[5].color);
}

function renderEnemies() {
  const rows = Object.entries(ENEMIES).map(([id, d]) => ({ id, ...d })).sort((a, b) => (a.boss || 0) - (b.boss || 0) || a.minL - b.minL);
  const cards = rows.map((d) => {
    const mid = Math.round((d.minL + d.maxL) / 2);
    const lv = [...new Set([d.minL, mid, d.maxL])];
    const S = lv.map((l) => scaleEnemy(d, l));
    const line = (lab, f) => `<tr><td class="desc">${lab}</td>${S.map((x) => `<td class="num">${f(x)}</td>`).join('')}</tr>`;
    const strip = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => `<span style="color:${enemyColor(d.hue, l)};opacity:${l < d.minL || l > d.maxL ? 0.2 : 1}" title="Nv ${l}">${esc(d.glyph)}</span>`).join('');
    const extra = d.abil.includes('explode') ? '<div class="desc">Al reventar: 2–4 + nivel de daño y nube de gas (radio 2).</div>' : d.abil.includes('aura') ? '<div class="desc">Aura: 3 + 0,4×nivel de radiación por turno a 2 casillas.</div>' : d.abil.includes('spawn') ? '<div class="desc">Cada 6 turnos engendra un Musgo errante (máx. 4).</div>' : d.abil.includes('summon') ? '<div class="desc">Cada 8 turnos invoca 2 Lobos de grafito (nivel −2).</div>' : d.abil.includes('charge') ? '<div class="desc">Embiste en línea recta hasta 5 casillas: daño ×1,6 (cada 4 turnos).</div>' : '';
    return `<div class="block row-f">
      <h3><span style="color:${enemyColor(d.hue, mid)};font-size:22px;margin-right:1ch">${esc(d.glyph)}</span>${esc(d.name)}${d.boss ? ' <span style="color:var(--bad)">☠ JEFE</span>' : ''}</h3>
      <div class="desc">${esc(d.origin)} · niveles ${d.minL}–${d.maxL} · velocidad ${d.speed} · alcance ${d.range} · grupos de ${d.group[0]}–${d.group[1]} · zonas ${MAPS.filter((m) => m.enemies.includes(d.id)).map((m) => tag(m.short)).join('')}</div>
      <div class="lvls" style="white-space:nowrap;margin:.4em 0">color por nivel: ${strip}</div>
      <table style="width:auto;margin:.3em 0"><tr><th style="position:static">Nivel</th>${lv.map((l) => `<th style="position:static;color:${enemyColor(d.hue, l)};text-align:right">${l}</th>`).join('')}</tr>
        ${line('Salud', (x) => x.hp)}${line('Daño', (x) => (d.dmg[1] ? `${x.dmg[0]}–${x.dmg[1]}` : '—'))}${line('Precisión', (x) => x.acc)}${line('Blindaje', (x) => x.armor)}${line('Esquiva', (x) => x.ev)}${line('Esencia', (x) => `<span style="color:${ESS}">${x.ess[0]}–${x.ess[1]} ✦</span>`)}${line('XP', (x) => x.xp)}</table>
      <div>${d.abil.map((a) => tag(ABIL_TEXT[a], a === 'stationary' ? '' : 'b')).join('') || '<span class="desc">sin habilidades especiales</span>'}</div>${extra}
      <div class="desc" style="margin-top:.4em;font-style:italic">${esc(d.lore)}</div>
    </div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(52ch,1fr));gap:0 2ch">${cards}</div><p class="desc">Por nivel: +32% salud, +20–22% daño, +2 precisión, +1 esquiva, +1 blindaje cada 3 niveles y +45% esencia. Velocidad 100 = un movimiento por turno (150 = tres cada dos turnos).</p>`;
}

function renderMaps() {
  return MAPS.map((m, i) => {
    const zones = Object.entries(m.zones).map(([k, v]) => tag(`${ZONE_TYPE[k]} ${Math.round(v * 100)}%`)).join('');
    const enemies = m.enemies.map((id) => { const d = ENEMIES[id]; return `<span title="${esc(d.name)}" style="color:${enemyColor(d.hue, m.lvl[1])};font-weight:800;margin-right:1ch">${esc(d.glyph)} <span style="font-weight:400">${esc(d.name)}</span></span>`; }).join('<br>');
    const sectors = Object.keys(m.zones).map((k) => `<div><b>${ZONE_TYPE[k]}:</b> <span class="desc">${SECTOR_NAMES[k].join(' · ')}</span></div>`).join('');
    return `<div class="block row-f"><h3>${i + 1}. ${esc(m.name)} <span style="color:var(--dim);font-weight:400">· nivel ${m.lvl[0]}–${m.lvl[1]}</span></h3>
      <div class="desc" style="margin-bottom:.6em">${esc(m.desc)}</div>
      <table><tr><td style="width:50%">
        <div>Tamaño: <b>${m.w}×${m.h}</b> · ${m.sx}×${m.sy} = ${m.sx * m.sy} sectores</div>
        <div>Terreno: ${zones}</div>
        <div>Radiación ambiente: <b>${m.ambientRad}</b></div>
        <div>Nidos ${m.nests.join('–')} · Vetas ${m.veins.join('–')} · Alijos ${m.caches.join('–')} · Peligros ${m.hazards.join('–')}</div>
        <div>Errantes: ${3 + i}–${5 + i} grupos · Jefe: ${i >= 4 ? 'siempre (hasta 2)' : i >= 3 ? '75%' : m.enemies.some((e) => ENEMIES[e].boss) ? '50%' : 'no'}</div>
        <div>Desbloqueo: ${i === 0 ? 'desde el inicio' : `extraer con éxito de ${esc(MAPS[i - 1].name)}`}</div>
        <div style="margin-top:.5em">${sectors}</div>
      </td><td>${enemies}</td></tr></table></div>`;
  }).join('') + '<p class="desc">Todas las zonas tienen 2 extracciones permanentes en los extremos (3 con Radar 5) y extracciones temporales cada 70–120 turnos. Tras 300–420 turnos el reactor emite un pulso que sube la radiación ambiente.</p>';
}

function renderModules() {
  return MODULES.map((m) => {
    const rows = [0, 1, 2, 3, 4, 5].map((l) => {
      const c = l > 0 ? moduleCost(m.id, l - 1) : null;
      return `<tr><td class="num">${l}</td><td>${esc(m.eff(l))}</td><td class="num">${c ? `<span style="color:${ESS}">${c.ess} ✦</span>` : '—'}</td><td class="num">${c ? c.rub + ' ₽' : '—'}</td></tr>`;
    }).join('');
    const tot = [0, 1, 2, 3, 4].reduce((a, l) => { const c = moduleCost(m.id, l); return { ess: a.ess + c.ess, rub: a.rub + c.rub }; }, { ess: 0, rub: 0 });
    return `<div class="block row-f"><h3><span style="color:var(--o2)">${esc(m.glyph)}</span> ${esc(m.name)}</h3><div class="desc">${esc(m.desc)}</div>
      <table><tr><th>Nivel</th><th>Efecto</th><th>Esencia</th><th>Rublos</th></tr>${rows}</table>
      <div class="desc">Coste total hasta nivel ${MODULE_MAX}: <span style="color:${ESS}">${tot.ess} ✦</span> y ${tot.rub} ₽</div></div>`;
  }).join('') + `<div class="block"><h3>Capacidades derivadas</h3><table><tr><th>Nivel</th><th>Escuadrón (Barracones)</th><th>Plantilla (Barracones)</th><th>Almacén</th></tr>${[0, 1, 2, 3, 4, 5].map((l) => `<tr><td class="num">${l}</td><td class="num">${squadSize(l)}</td><td class="num">${rosterSize(l)}</td><td class="num">${stashSize(l)}</td></tr>`).join('')}</table></div>`;
}

function renderAgentNames() {
  const list = (t, arr) => `<div class="block"><h3>${t} (${arr.length})</h3>${arr.map((x) => tag(x)).join('')}</div>`;
  return list('Nombres masculinos', FIRST_NAMES_M) + list('Nombres femeninos', FIRST_NAMES_F) + list('Apellidos', LAST_NAMES) + list('Apodos', NICKNAMES) + '<p class="desc">Los apellidos en -ov/-ev/-in se feminizan (-ova, -eva, -ina). Los apodos no se repiten dentro de la plantilla.</p>';
}

// ------------------------------------------------------------ tabla genérica
// ------------------------------------------------------------ facciones, personas, eventos y diálogos
const ATT_COLOR = { hostile: '#ff5050', neutral: '#e6c85a', allied: '#8fe870' };
function renderFactions() {
  const ids = Object.keys(FACTIONS);
  const cards = ids.map((id) => { const f = FACTIONS[id]; return `<div class="block row-f"><h3 style="color:${f.color}">${esc(f.name)} ${tag(f.short)}</h3><div class="desc">${esc(f.country)} · id <code>${id}</code></div><div>${esc(f.desc)}</div></div>`; }).join('');
  const head = `<tr><th></th>${ids.map((b) => `<th style="color:${FACTIONS[b].color}">${esc(FACTIONS[b].short)}</th>`).join('')}</tr>`;
  const rows = ids.map((a) => `<tr><td style="color:${FACTIONS[a].color}"><b>${esc(FACTIONS[a].short)}</b></td>${ids.map((b) => { const t = a === b ? 'allied' : baseAttitude(a, b); return `<td style="color:${a === b ? 'var(--dim)' : ATT_COLOR[t]}">${a === b ? '—' : ATTITUDE_TEXT[t]}</td>`; }).join('')}</tr>`).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(46ch,1fr));gap:0 2ch">${cards}</div><h3>Actitudes iniciales</h3><table style="width:auto">${head}${rows}</table>`;
}
function renderHumans() {
  const cards = Object.entries(HUMANS).map(([id, d]) => {
    const f = FACTIONS[d.faction];
    const w = ITEMS[d.weapon];
    const lv = [1, 5, 10], S = lv.map((l) => scaleHuman(d, l));
    const line = (lab, fn) => `<tr><td class="desc">${lab}</td>${S.map((x) => `<td class="num">${fn(x)}</td>`).join('')}</tr>`;
    return `<div class="block row-f"><h3><span style="color:${f.color};background:${f.bg || 'transparent'};font-size:22px;margin-right:1ch;padding:0 .3ch">${esc(d.glyph)}</span>${esc(d.name)} <span style="color:${f.color};font-weight:400">· ${esc(f.short)}</span></h3>
      <div class="desc">id <code>${id}</code> · arma ${w ? `<b>${esc(w.name)}</b>` : '—'} · velocidad ${d.speed} · huye por debajo del ${Math.round(d.flee * 100)}% de salud${d.gasImmune ? ' · inmune al gas' : ''}</div>
      <table style="width:auto;margin:.3em 0"><tr><th style="position:static">Nivel</th>${lv.map((l) => `<th style="position:static;text-align:right">${l}</th>`).join('')}</tr>
        ${line('Salud', (x) => x.hp)}${line('Precisión', (x) => x.acc)}${line('Esquiva %', (x) => Math.round(x.ev))}${line('Blindaje', (x) => x.armor)}${line('XP', (x) => x.xp)}</table>
      <div class="desc">Puede soltar: ${d.loot.map((b) => (ITEMS[b] ? esc(ITEMS[b].name) : b)).join(', ') || '—'} (además de su arma y munición)</div>
      <div class="desc" style="margin-top:.4em;font-style:italic">${esc(d.lore)}</div></div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(52ch,1fr));gap:0 2ch">${cards}</div>`;
}
const TRIGGER_TEXT = { expStart: 'Inicio de expedición', enterSector: 'Entrar en un sector', turn: 'Cada turno', seeFaction: 'Avistar una facción', pickup: 'Recoger un objeto', agentHurt: 'Agente herido', kill: 'Abatir a un actor', baseDay: 'Nuevo día en la base' };
const ONCE_TEXT = { true: 'una vez por partida', exp: 'una vez por expedición', agent: 'una vez por agente' };
function descObj(o) {
  if (o == null) return '—';
  if (Array.isArray(o)) return o.map(descObj).join(' <b>y</b> ');
  return Object.entries(o).map(([k, v]) => {
    if (typeof v === 'function') return `<code>${k}</code>: <i>dinámico</i>`;
    if (k === 'any') return `(${v.map(descObj).join(' <b>o</b> ')})`;
    if (k === 'not') return `<b>no</b> (${descObj(v)})`;
    if (k === 'if') return `<i>si</i> ${descObj(v)} →`;
    if (k === 'dialog') return `abre diálogo <b>${esc(v)}</b>`;
    if (k === 'cls') return '';
    const txt = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `<code>${k}</code>: ${esc(txt.length > 110 ? txt.slice(0, 110) + '…' : txt)}`;
  }).filter(Boolean).join(' · ');
}
function renderEvents() {
  return table(EVENTS.map((e) => ({ ...e })), [
    { h: 'Id', v: (e) => `<b>${esc(e.id)}</b>`, s: (e) => e.id },
    { h: 'Disparador', v: (e) => TRIGGER_TEXT[e.on] || e.on, s: (e) => e.on },
    { h: 'Frecuencia', v: (e) => `${ONCE_TEXT[e.once] || 'siempre'}${e.chance != null ? ` · ${Math.round(e.chance * 100)}%` : ''}` },
    { h: 'Condiciones', v: (e) => descObj(e.cond) },
    { h: 'Efectos', v: (e) => e.effects.map((x) => `<div>${descObj(x)}</div>`).join('') },
  ]);
}
function renderDialogs() {
  const txt = (t) => (typeof t === 'function' ? '<i>(texto dinámico según el contexto)</i>' : esc(t));
  return Object.entries(DIALOGS).map(([id, D]) => {
    const nodes = Object.entries(D.nodes).map(([nid, N]) => `<div style="margin:.4em 0 .6em 2ch"><div><code>${nid}</code> ${N.title ? `<b>${esc(N.title)}</b>` : ''}</div>
      <div class="desc" style="margin:.2em 0 .3em 2ch">${txt(N.text)}</div>
      ${(N.opts || []).map((o) => `<div style="margin-left:4ch">▸ <b>${txt(o.label)}</b>${o.turn ? ' ⌛' : ''}${o.cond ? ` <span class="desc">[requiere ${descObj(o.cond)}]</span>` : ''}${o.goto ? ` → <code>${esc(o.goto)}</code>` : ''}${o.effects ? `<div class="desc" style="margin-left:2ch">${o.effects.map(descObj).join(' · ')}</div>` : ''}</div>`).join('')}</div>`).join('');
    return `<div class="block row-f"><h3 style="color:${D.color || 'inherit'}">${esc(D.title)} <span class="desc">· <code>${id}</code> · ${esc(D.speaker || '')}</span></h3>${nodes}</div>`;
  }).join('');
}

let current = null;
function table(rows, cols) {
  current = { rows, cols, sort: null, asc: true };
  return `<table class="data">${thead(cols)}<tbody>${tbody(rows, cols)}</tbody></table>`;
}
const thead = (cols) => `<thead><tr>${cols.map((c, i) => `<th data-i="${i}">${esc(c.h)}</th>`).join('')}</tr></thead>`;
const tbody = (rows, cols) => rows.map((r) => `<tr class="row-f">${cols.map((c) => `<td class="${c.num ? 'num' : ''} ${c.g ? 'g' : ''} ${c.nw ? 'nw' : ''}">${c.v(r)}</td>`).join('')}</tr>`).join('');

function wireTable(root) {
  const t = root.querySelector('table.data');
  if (!t || !current) return;
  const st = current;
  t.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
    const i = +th.dataset.i;
    const c = st.cols[i];
    if (!c.h) return;
    st.asc = st.sort === i ? !st.asc : true;
    st.sort = i;
    const key = c.s || ((r) => c.v(r).replace(/<[^>]+>/g, ''));
    const sorted = [...st.rows].sort((a, b) => { const x = key(a), y = key(b); const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es'); return st.asc ? r : -r; });
    t.querySelector('tbody').innerHTML = tbody(sorted, st.cols);
    t.querySelectorAll('th').forEach((h) => h.classList.remove('sorted', 'asc'));
    th.classList.add('sorted'); if (st.asc) th.classList.add('asc');
    applyFilter();
  }));
}

// ------------------------------------------------------------ navegación
const nav = document.getElementById('nav');
const main = document.getElementById('main');
function buildNav(active) {
  let h = '<h1>☰ ARCHIVO TOPOLEV<small>catálogo del juego</small></h1>';
  let grp = null;
  for (const s of SECTIONS) {
    if (s.grp !== grp) { grp = s.grp; h += `<div class="grp">${esc(grp.toUpperCase())}</div>`; }
    h += `<a href="#${s.id}" class="${s.id === active ? 'on' : ''}"><span>${esc(s.label)}</span>${s.count != null ? `<span class="n">${s.count}</span>` : ''}</a>`;
  }
  h += '<a class="back" href="index.html">← volver al juego</a>';
  nav.innerHTML = h;
}
function applyFilter() {
  const q = (document.getElementById('q')?.value || '').trim().toLowerCase();
  for (const r of main.querySelectorAll('.row-f')) r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none';
}
function route() {
  const id = location.hash.slice(1) || 'resumen';
  const s = SECTIONS.find((x) => x.id === id) || SECTIONS[0];
  buildNav(s.id);
  current = null;
  const body = s.render();
  main.innerHTML = `<header class="top"><h2>${esc(s.label.toUpperCase())}</h2>${s.count != null ? `<span class="sub">${s.count} elementos</span>` : ''}${s.id !== 'resumen' ? '<input id="q" class="search" placeholder="buscar…" autocomplete="off">' : ''}</header>${s.intro ? `<p class="intro">${esc(s.intro)}</p>` : ''}${body}`;
  main.scrollTop = 0;
  wireTable(main);
  const q = document.getElementById('q');
  if (q) q.addEventListener('input', applyFilter);
  document.title = `${s.label} · Archivo Topolev`;
}
addEventListener('hashchange', route);
route();

