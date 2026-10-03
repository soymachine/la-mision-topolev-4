// Archivo Topolev: catálogo de todo el contenido del juego (lee los datos reales del juego)
import { ITEMS, CAT_INFO, AMMO_NAMES, AFFIXES, MYTHIC_NAMES, EPITHETS, UNCOMMON_SUFFIX, RARE_SUFFIX } from './data/items.js';
import { RARITIES, rarityWeights } from './data/rarity.js';
import { ENEMIES, ABIL_TEXT, enemyColor, scaleEnemy } from './data/enemies.js';
import { MAPS, STRATA, EVENT_ZONES, mapIndex, MODULES, MODULE_MAX, moduleCost, squadSize, rosterSize, stashSize, TRAITS, SECTOR_NAMES, FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, NICKNAMES } from './data/world.js';
import { TILES } from './data/tiles.js';
import { MOD_SLOTS, weaponSlots } from './data/mods.js';
import { gadgetExtras, gadgetEffectLines, WTYPE_NAMES } from './core/items.js';
import { NOTES, RADIO, SURVIVOR_LINES } from './data/lore.js';
import { FACTIONS, baseAttitude, ATTITUDE_TEXT, REP_LEVELS, repLevel, squadAttitude } from './data/factions.js';
import { HUMANS, scaleHuman, SQUADS, SQUAD_MIN_TIER } from './data/humans.js';
import { EVENTS } from './data/events.js';
import { DIALOGS } from './data/dialogs.js';
import { ATTRS, ATTR_MAX, TALENTS, TALENT_EVERY } from './data/talents.js';
import { SPECS, SPEC_TALENTS, SPEC_LEVEL, rerollCost } from './data/specs.js';
import { BACKGROUNDS } from './data/backgrounds.js';
import { MODIFIERS, WEATHER } from './data/modifiers.js';
import { AMMO_KINDS, SPECIAL_AMMO } from './data/ammo.js';
import { ELITES, ALERT_LEVELS, ALERT_EVERY, CALM_DAYS, GROW_DAYS, BOSS_RETURN } from './data/ecosystem.js';
import { ACTS, SCENES, ENDINGS, STAFF, COMEDOR, LETTERS_FROM, EPITAPHS, LAST_LETTERS } from './data/story.js';
import { PLOTS, MATERIALS, RESEARCH, RECIPES, SEASONS, HISTORY, ATTACKS, dateOf } from './data/basedata.js';
import { CONTRACTS, GIVER_NAME } from './core/story.js';
import { COLLECTIONS, INTERCEPTS } from './data/lore.js';
import { ecoLines, ZONE_TYPE } from './util/codexlines.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { MODES, NG_MODS, CHALLENGE_DAYS } from './core/modes.js';
import { ACQUIRED, MEDALS, WOUNDS, WOUND_CHANCE, RETIRE_LEVEL, MAX_INSTRUCTORS, INSTRUCTOR_XP, ROOKIE_LEVEL } from './data/honors.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byCat = (c) => Object.entries(ITEMS).filter(([, d]) => d.cat === c).map(([id, d]) => ({ id, ...d })).sort((a, b) => a.tier - b.tier || a.value - b.value);
const tag = (t, cls = '') => `<span class="tag ${cls}">${esc(t)}</span>`;
const R = RARITIES;
const ESS = '#5ff7ff';

const WTYPE = { melee: 'Cuerpo a cuerpo', pistol: 'Pistola', smg: 'Subfusil', shotgun: 'Escopeta', rifle: 'Fusil', sniper: 'Tirador', mg: 'Ametralladora', flame: 'Lanzallamas', launcher: 'Lanzador', energy: 'Esencia' };
const SPECIAL_TEXT = {
  tren: 'Tren fantasma: cada 80–140 turnos cruza la vía más cercana; avisa 4 turnos antes y arrolla lo que haya encima.',
  lago: 'Siluros gigantes en el agua profunda; barcas como pasarelas; islotes con alijos.',
  antena: 'La consola del radar (Ψ) revela todo el mapa 30 turnos… y atrae a todo lo que hay en él.',
  fenix: 'Cámaras (dan la alarma), torretas, operadores de élite; botín occidental e informes de inteligencia.',
  objeto7: 'Celdas de contención (se abren desde un terminal del sector) con criaturas y cajas dentro; el archivo del KGB cuenta el pasado del Dr. Topolev.',
  raices: 'Las paredes respiran: cada 8 turnos se abren y cierran pasos lejos del equipo.',
  corium: 'Lagos de corium fundido. El jefe final llegará en la fase 22.',
};
const SHOP_MODULE = { weapon: 'Armería', mod: 'Armería', armor: 'Blindaje', helmet: 'Blindaje', gadget: 'Taller', backpack: 'Taller' };
const minZone = (tier) => Math.max(1, tier * 2 - 1);
function shopText(d, id) {
  if (d.trophy) return '<span style="color:#ffd23f">♛ trofeo de jefe</span>';
  if (d.noLoot) return '<span class="desc">no se encuentra</span>';
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
sec('Objetos', 'contenedores', 'Contenedores', byCat('case').length, () => table(byCat('case'), [
  { h: '', g: true, v: (d) => `<span style="color:${R[d.rar].color}">${esc(d.glyph)}</span>` },
  { h: 'Nombre', v: (d) => `<div class="nm" style="color:${R[d.rar].color}">${esc(d.name)}</div><div class="desc">${esc(d.desc)}</div>`, s: (d) => d.name },
  { h: 'Huecos', num: true, v: (d) => d.caseSlots, s: (d) => d.caseSlots },
  { h: 'Pilas', v: (d) => (d.stacks ? tag('munición y consumibles', 'g') : '—') },
  { h: 'Especial', v: (d) => (d.keepEss ? `conserva el ${d.keepEss}% de la esencia` : '—') },
  { h: 'Intendencia', v: (d) => `Almacén ≥ ${d.tier}`, s: (d) => d.tier },
  { h: 'Precio', num: true, v: (d) => `${d.price} ₽${d.essCost ? ` + <span style="color:${ESS}">${d.essCost} ✦</span>` : ''}`, s: (d) => d.price },
]), 'Ranura CONTENEDOR: lo que guardes dentro sobrevive aunque el agente muera (la radiobaliza lo devuelve al almacén). Guardar cuesta 1 turno y queda sellado hasta la base. Las armas ocupan 2 huecos; las pesadas (ametralladoras, lanzadores, lanzallamas) no caben.');

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
sec('Objetos', 'companeros', 'Compañeros mecánicos', byCat('companion').length + byCat('dogmod').length, () => table([...byCat('companion'), ...byCat('dogmod')], [
  { h: 'Nombre', v: (d) => `<span class="nm">${esc(d.glyph)} ${esc(d.name)}</span>`, s: (d) => d.name },
  { h: 'Tipo', v: (d) => (d.cat === 'dogmod' ? tag('módulo', 'c') : d.kind === 'dog' ? tag('perro', 'g') : tag('dron ' + d.drone, 'b')) },
  { h: 'Garaje', v: (d) => d.garage, s: (d) => d.garage, num: 1 },
  { h: 'Salud', v: (d) => d.hp || '—', num: 1 },
  { h: 'Precio', v: (d) => `${d.value} ₽`, s: (d) => d.value, num: 1 },
  { h: 'Descripción', v: (d) => `<span class="desc">${esc(d.desc)}</span>` },
]), 'Ranura COMPAÑERO de cada agente (fase 19). Se compran en el GARAJE (módulo de la base, niveles 1–5) y allí se instalan los módulos del perro y se reparan (rublos; un chasis destrozado pide además 2 piezas de recambio). Tecla J en expedición (por defecto; MENÚ → CONTROLES): órdenes del perro (seguir, quedarse, buscar, atacar), lanzar o recoger drones; clic en el radar para mandar el Strizh a un punto. Talento «Mecánico» (Zapador): +30% salud y daño, +50% batería, reparaciones −40%. Gadget «Mando a distancia»: más alcance y batería.');
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
sec('Sistemas', 'sigilo', 'Detección y sigilo', 6, () => table([
  { m: 'Agachado (tecla K)', v: '−3 casillas', n: 'Uno de cada dos pasos cuesta un turno más.' },
  { m: 'Quieto (no te moviste el turno anterior)', v: '−2 casillas', n: '' },
  { m: 'Linterna encendida', v: '+3 casillas', n: 'A oscuras sin linterna, ×0,65.' },
  { m: 'Arena / niebla', v: '−2 / −1', n: 'Ya existían (fases 16 y 17).' },
  { m: 'Ataque por la espalda', v: 'crítico seguro', n: 'Cuerpo a cuerpo a un enemigo dormido o errante sin memoria de ti (no jefes).' },
  { m: 'Emboscada (orden EMBOSCADA)', v: '+20% impacto', n: 'Una vez; luego el compañero pasa a MANTENER.' },
], [{ h: 'Situación', v: (r) => esc(r.m) }, { h: 'Efecto', v: (r) => esc(r.v) }, { h: 'Notas', v: (r) => `<span class="desc">${esc(r.n)}</span>` }]), 'Fase 23.2. Los modificadores de distancia de detección solo cuentan para los enemigos que aún no están en alerta (dormidos o errantes). Los chebylitas sigilosos (fase 22) emboscan: su primer golpe hace ×1,5.');
sec('Sistemas', 'abatidos', 'Abatidos y rescate', 5, () => table([
  { m: 'Caer abatido', v: 'A 0 de salud: 3 turnos en el suelo (4 si alguien del grupo tiene el talento Rescate). No actúa ni se le controla. Se le quitan veneno y quemaduras.' },
  { m: 'Levantar (F a su lado o clic)', v: 'Con la curación más pequeña de la mochila: se levanta con esa salud. Sin nada: 1 de salud y un turno más.' },
  { m: 'Desfibrilador', v: 'Levanta a 2 casillas con un 25% de salud, una vez por expedición.' },
  { m: 'Talento Rescate (Sanitario)', v: '+1 turno de margen y levanta con al menos un 25% de salud.' },
  { m: 'Muere si…', v: 'recibe otro golpe, se acaban los turnos, la radiación lo mata o todo el grupo está abatido. Los enemigos que lo tienen al lado lo prefieren como objetivo. No puede subir solo a la evacuación.' },
], [{ h: 'Situación', v: (r) => `<b>${esc(r.m)}</b>` }, { h: 'Regla', v: (r) => esc(r.v) }]), 'Fase 23.3. Levantar a alguien da +15 de afinidad entre los dos, −10 de estrés al levantado y cuenta como «salvar a un compañero» para las condecoraciones. Los compañeros con orden distinta de NO DISPARAR acuden solos a levantarlo.');
sec('Sistemas', 'municion', 'Munición especial', Object.keys(SPECIAL_AMMO).length, () => table(Object.entries(AMMO_KINDS).map(([id, k]) => ({ id, ...k, list: Object.entries(SPECIAL_AMMO).filter(([, d]) => d.kind === id) })), [
  { h: 'Tipo', v: (k) => `<b style="color:${k.color}">${esc(k.short)} · ${esc(k.name)}</b>`, s: (k) => k.name },
  { h: 'Efecto', v: (k) => esc(k.desc) },
  { h: 'Calibres', v: (k) => k.list.map(([id, d]) => tag(`${d.name.replace('Munición ', '').replace(' ' + k.name, '')} · Nv ${d.tier} · ${d.value} ₽`)).join('') },
]), 'Fase 23.4. Cualquier arma dispara cualquier munición de su calibre; el arma recuerda qué tipo lleva cargado. Tecla N: tipo para la siguiente recarga (lo cargado vuelve a la mochila). Aparecen en el botín (tier del calibre +1, +2 la de esencia) y se fabrican en el Taller de fabricación. Fuego de supresión (tecla P): subfusiles, fusiles y ametralladoras sin mira con cargador de 15 o más; gasta 6–9 balas, un impacto a mitad de daño y suprime 2 turnos a los enemigos a 1 casilla (−30% de impacto, 50% de perder el turno). Los humanos con armas automáticas suprimen a los agentes (15% por ráfaga). Durabilidad (fase 23.5): −0,5% por disparo (×1,6 con incendiaria o expansiva, ×1,5 mojado); por debajo del 60%, probabilidad de encasquillarse = (60 − estado) / 400 por disparo; R desencasquilla (gratis con recarga rápida); reparar en el Taller de fabricación cuesta ⌈(100 − estado) / 25 × (1 + tier / 2)⌉ de chatarra.');
sec('Sistemas', 'nombres', 'Nombres de objetos', MYTHIC_NAMES.length + EPITHETS.length + UNCOMMON_SUFFIX.length + RARE_SUFFIX.length, renderItemNames);

// ----- MUNDO -----
sec('Mundo', 'enemigos', 'Chebylitas', Object.keys(ENEMIES).length, renderEnemies, 'Fase 22: los acuáticos (medusa, sanguijuela, siluros) viven en el agua. Cadena alimentaria: los carnívoros cazan a sus presas cuando no tienen a nadie mejor (y la carne de cebo los atrae desde el doble de lejos); los carroñeros siguen a su depredador. Cada zona nueva tiene su jefe en el piso más profundo; al bajar de cada umbral de salud cambia de fase. Su trofeo (gadget único) cae solo si no lo tenéis.');
sec('Mundo', 'elites', 'Élites', Object.keys(ELITES).length, () => table(Object.entries(ELITES).map(([id, x]) => ({ id, ...x })), [
  { h: 'Afijo', v: (x) => `<span class="nm" style="color:${x.color}">★ ${esc(x.name)}</span> <span class="desc">${x.id}</span>`, s: (x) => x.name },
  { h: 'Efecto', v: (x) => esc(x.desc) },
]), 'Cualquier chebylita (no jefe) puede salir élite: 3% + 0,8% por nivel de la zona y piso + 1,2% por nivel de alerta del reactor. Uno o dos afijos (dos a partir del nivel 6). Un élite tiene +50% de salud, el doble de esencia y XP, botín asegurado y a veces un cristal. Se marcan con ★ dorada.');
sec('Mundo', 'alerta', 'Alerta del reactor y mundo persistente', ALERT_LEVELS.length, () => table(ALERT_LEVELS.map((x, i) => ({ i, ...x })), [
  { h: 'Nivel', v: (x) => x.i, s: (x) => x.i, num: 1 },
  { h: 'Alerta', v: (x) => `<b style="color:${x.color}">☢ ${esc(x.name)}</b>` },
  { h: 'Desde el día', v: (x) => 1 + x.i * ALERT_EVERY, s: (x) => x.i, num: 1 },
  { h: 'Efecto', v: (x) => esc(x.desc) },
]), `La alerta sube un nivel cada ${ALERT_EVERY} días (se ve en la cabecera de la base). Mundo persistente: si despejáis el 60% de los nidos de una zona, durante ${CALM_DAYS} días tendrá menos nidos (del 40% al 100% poco a poco). Una zona ya visitada y luego olvidada crece +1 nivel cada ${GROW_DAYS} días (máx. +2): nidos de más nivel y más grandes. Un jefe abatido tarda ${BOSS_RETURN} días en volver a su zona.`);
sec('Mundo', 'facciones', 'Facciones', Object.keys(FACTIONS).length, renderFactions, 'Actitud inicial de cada facción hacia las demás. Durante la expedición cambia: atacar a un neutral o a un aliado vuelve hostil a toda su facción (−25 de reputación).');
sec('Mundo', 'personas', 'Personas', Object.keys(HUMANS).length, renderHumans, 'Miembros de otras expediciones. Usan armas reales del catálogo, recargan, huyen heridos y sueltan su equipo al morir. Patrullan las zonas según su región y peligrosidad (ver «Zonas»): buscan cobertura, lanzan granadas, avisan por radio, se rinden malheridos (prisioneros) y se puede hablar con los no hostiles (F). También se pueden generar con la consola de depuración (tecla º → spawn).');
sec('Mundo', 'zonas', 'Zonas', MAPS.length, renderMaps);
sec('Mundo', 'casillas', 'Casillas del mapa', TILES.length, () => table(TILES.map((t, i) => ({ i, ...t })), [
  { h: 'Glifos', v: (t) => t.glyphs.map((g, k) => `<b style="color:${t.fg[k % t.fg.length]};${t.bg ? `background:${t.bg};` : ''}padding:0 .3ch">${esc(g)}</b>`).join(' ') },
  { h: 'Nombre', v: (t) => `<span class="nm">${esc(t.name)}</span>`, s: (t) => t.name },
  { h: 'Transitable', v: (t) => (t.walk ? tag('sí', 'g') : t.fly ? tag('solo voladores', 'c') : tag('no', 'b')) },
  { h: 'Bloquea visión', v: (t) => (t.opaque ? 'sí' : 'no') },
  { h: 'Mecánica', v: (t) => [t.cover ? tag(`cobertura ${(t.coverLvl || (t.cover >= 40 ? 2 : 1)) === 2 ? 'total' : 'media'} −${t.cover}%`, 'g') : '', t.shoot ? tag('se dispara', 'b') : '', t.use ? tag('se usa (F)', 'c') : '', t.noise ? tag(`ruido ${t.noise}`, 'b') : '', t.slip ? tag('resbala', 'b') : '', t.quiet ? tag('silencioso', 'g') : '', t.fuel ? tag('inflamable', 'b') : '', t.light ? tag(`luz r${t.light}`, 'g') : '', t.anim ? tag(t.anim, 'c') : ''].join('') + (t.desc ? `<div class="desc">${esc(t.desc)}</div>` : '') },
]), 'El agua (y sus variantes) está contaminada y añade radiación. Los peligros (gas, fuego, anomalías, focos de radiación) son capas encima de las casillas. Fase 16: cobertura (−% de impacto desde el otro lado), destructibles (barriles, tuberías, lámparas: apunta con T), puertas blindadas y terminales (Técnica), interruptores y lámparas (luz), montacargas y simas (pisos), escombros inestables (ruido fuerte), raíces que crecen, grafito (muestras), cristales de esencia y vagonetas sobre raíles.');
sec('Mundo', 'modificadores', 'Modificadores de zona', Object.keys(MODIFIERS).length, () => table(Object.entries(MODIFIERS).map(([id, m]) => ({ id, ...m })), [
  { h: '', g: true, v: (m) => `<span style="color:${m.color}">${esc(m.glyph)}</span>` },
  { h: 'Modificador', v: (m) => `<span class="nm" style="color:${m.color}">${esc(m.name)}</span> <span class="desc">${m.id}</span>`, s: (m) => m.name },
  { h: 'Riesgo', v: (m) => `<span style="color:var(--bad)">▼ ${esc(m.risk)}</span>` },
  { h: 'Recompensa', v: (m) => `<span style="color:var(--good)">▲ ${esc(m.reward)}</span>` },
]), 'Cada día, cada zona sale con 0–2 modificadores (los mismos para toda la jornada). Se ven en EXPEDICIÓN al elegir destino. El primer día la primera zona no tiene ninguno. Cada modificador tiene un encargo especial asociado (ver «Encargos»): CUARTEL ofrece uno al día.');

// ----- BASE -----
sec('Mundo', 'clima', 'Clima de superficie', Object.keys(WEATHER).length, () => table(Object.entries(WEATHER).map(([id, w]) => ({ id, ...w })), [
  { h: 'Clima', v: (w) => `<b>${esc(w.name)}</b>`, s: (w) => w.name }, { h: 'Peso', v: (w) => w.w, s: (w) => w.w, num: 1 }, { h: 'Efecto', v: (w) => `<span class="desc">${esc(w.desc)}</span>` },
]), 'Uno por expedición a una zona de superficie. La lluvia suma 0,25 de radiación por turno al raso; la niebla quita 3 de visión al raso; el viento disipa el gas.');
sec('Mundo', 'eventos-zona', 'Zonas de evento', Object.keys(EVENT_ZONES).length, () => table(Object.entries(EVENT_ZONES).map(([id, z]) => ({ id, ...z })), [
  { h: 'Zona', v: (z) => `<b style="color:#ff6ad5">${esc(z.glyph)} ${esc(z.name)}</b>`, s: (z) => z.name }, { h: 'Base', v: (z) => esc(MAPS[mapIndex(z.base)].name) }, { h: 'Días', v: (z) => z.days.join('–'), num: 1 }, { h: 'Peso', v: (z) => z.w, s: (z) => z.w, num: 1 },
  { h: 'Descripción', v: (z) => `<span class="desc">${esc(z.desc)}</span>` },
]), 'A partir del día 3, cada día hay un 40% de probabilidad de que aparezca una (máximo 2 a la vez) si su zona base está abierta. Son de un solo uso, sin modificadores, y no desbloquean nada. Helicóptero: caja negra y una manada. Convoy: 5–7 cajas con piezas y algo dormido cerca. Avión espía: equipo occidental, informes y dos equipos de recuperación americanos. Nido migratorio: muchos nidos y cristales. Mercado negro: el contrabandista vende armas americanas.');
sec('Base', 'modulos', 'Módulos', MODULES.length, renderModules);
sec('Base', 'rasgos', 'Rasgos de agentes', TRAITS.length, () => table(TRAITS, [
  { h: 'Rasgo', v: (t) => `<span class="nm">${esc(t.name)}</span>`, s: (t) => t.name },
  { h: 'Efecto', v: (t) => esc(t.desc) },
  { h: 'Tipo', v: (t) => (Object.values(t.mod).some((v) => v < 0) ? tag('mixto', 'b') : tag('ventaja', 'g')) },
]), 'Cada agente tiene un rasgo aleatorio. Al subir de nivel ganan salud y un punto de atributo.');
sec('Base', 'atributos', 'Atributos', ATTRS.length, () => table(ATTRS, [
  { h: '', g: true, v: (t) => esc(t.glyph) },
  { h: 'Atributo', v: (t) => `<span class="nm">${esc(t.name)}</span>`, s: (t) => t.name },
  { h: 'Por punto', v: (t) => esc(t.desc) },
]), `Cada nivel da 1 punto que se reparte en la base (ASCENSO). Máximo ${ATTR_MAX} puntos por atributo. Los reclutas veteranos llegan con los suyos ya repartidos.`);
sec('Base', 'talentos', 'Talentos generales', Object.keys(TALENTS).length, () => table(Object.entries(TALENTS).map(([id, t]) => ({ id, ...t })), [
  { h: '', g: true, v: (t) => esc(t.glyph) },
  { h: 'Talento', v: (t) => `<span class="nm">${esc(t.name)}</span> <span class="desc">${t.id}</span>`, s: (t) => t.name },
  { h: 'Efecto', v: (t) => esc(t.desc) },
  { h: 'Tipo', v: (t) => (t.flags ? tag('especial', 'c') : tag('estadística', 'g')), s: (t) => (t.flags ? 1 : 0) },
]), `Antes de especializarse (nivel ${SPEC_LEVEL}) se ofrecen estos; después, los de su árbol (y estos si el árbol se agota). Los efectos especiales son los mismos que los de los gadgets y no se acumulan con ellos: cuenta el mejor.`);
sec('Base', 'especializaciones', 'Especializaciones', Object.keys(SPECS).length, renderSpecs, `Al nivel ${SPEC_LEVEL} cada agente elige una. Cada ${TALENT_EVERY} niveles: 1 talento entre 3 (intentando uno por rama); volver a tirar cuesta 60 + 40 × nivel ₽. Los talentos avanzados (II) exigen tener uno de su rama. ◈ = sinergia con un gadget o mod.`);
sec('Base', 'trasfondos', 'Trasfondos', Object.keys(BACKGROUNDS).length, renderBackgrounds, 'Todos los atributos empiezan en 2; el trasfondo suma sus bonificaciones y luego se reparten 4 puntos al azar (máximo 7 al empezar). El rasgo sale de su lista el 80% de las veces.');
sec('Base', 'honores', 'Rasgos, medallas y heridas', Object.keys(ACQUIRED).length + Object.keys(MEDALS).length + WOUNDS.length, renderHonors, `Lo que viven los agentes deja huella. Retiro: nivel ${RETIRE_LEVEL}+, máximo ${MAX_INSTRUCTORS} instructores, +${INSTRUCTOR_XP}% de XP por instructor a los agentes de nivel ${ROOKIE_LEVEL} o menos.`);
sec('Base', 'agentes', 'Nombres de agentes', FIRST_NAMES_M.length + FIRST_NAMES_F.length + LAST_NAMES.length + NICKNAMES.length, renderAgentNames);

// ----- NARRATIVA -----
sec('Narrativa', 'notas', 'Notas', NOTES.length, () => `<div class="list">${NOTES.map((n) => `<div class="note row-f"><div>${esc(n.t)}</div><div class="a">— ${esc(n.a)}</div></div>`).join('')}</div>`, 'Se encuentran en el suelo (glifo ?) durante las expediciones: de 1 a 3 por mapa.');
sec('Narrativa', 'radio', 'Mensajes de radio', RADIO.length, () => `<div class="list">${RADIO.map((n) => `<div class="note row-f">📻 ${esc(n)}</div>`).join('')}</div>`, 'Aparecen en el registro cada 60–110 turnos. Las extracciones temporales también se anuncian por radio.');
sec('Narrativa', 'supervivientes', 'Supervivientes', SURVIVOR_LINES.length, () => `<div class="list">${SURVIVOR_LINES.map((n) => `<div class="note row-f">☺ ${esc(n)}</div>`).join('')}</div><p class="desc">Hablar con un superviviente abre el diálogo <b>survivor</b> (ver «Diálogos»).</p>`, 'Hay un 50% de probabilidad de encontrar uno por expedición.');
sec('Narrativa', 'eventos', 'Eventos', EVENTS.length, renderEvents, 'Sucesos narrativos de data/events.js: un disparador, condiciones y efectos. «Una vez» puede ser por partida, por expedición o por agente.');
sec('Narrativa', 'dialogos', 'Diálogos', Object.keys(DIALOGS).length, renderDialogs, 'Árboles de diálogo de data/dialogs.js. Las opciones con condición aparecen desactivadas si no se cumple; las marcadas con ⌛ gastan el turno.');

// ----- CAMPAÑA (fases 20 y 21) -----
const rewText = (r) => [r.rub ? tag(`+${r.rub} ₽`, 'g') : '', r.ess ? tag(`+${r.ess} ✦`, 'c') : '', r.trust ? tag(`confianza ${r.trust > 0 ? '+' : ''}${r.trust}`, r.trust > 0 ? 'g' : 'b') : '', r.rep ? tag(`${FACTIONS[r.rep[0]] ? FACTIONS[r.rep[0]].name : r.rep[0]} ${r.rep[1] > 0 ? '+' : ''}${r.rep[1]}`, r.rep[1] > 0 ? 'g' : 'b') : '', r.stress ? tag(`estrés ${r.stress}`, 'g') : '', r.item ? tag(Array.isArray(r.item) ? `«${r.item[1]}»` : `«${r.nm || (ITEMS[r.item] || {}).name}»`, 'c') : ''].join('');
const costText = (c) => [c.ess ? `<span style="color:${ESS}">${c.ess} ✦</span>` : '', c.rub ? `${c.rub} ₽` : '', ...Object.entries(c.items || {}).map(([b, n]) => `${n}× ${esc((ITEMS[b] || {}).name || b)}`), c.specimen ? `${c.specimen} espécimen${c.specimen > 1 ? 'es' : ''} vivo${c.specimen > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
const sceneBlock = (id, sc) => `<div class="block row-f"><h3 style="color:${sc.color}">${esc(sc.title || sc.name)} <span class="desc">· ${id}</span></h3><pre style="color:${sc.color};font-size:.85em;line-height:1.1">${esc(sc.art)}</pre>${sc.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
sec('Campaña', 'actos', 'Actos y escenas', Object.keys(ACTS).length + Object.keys(SCENES).length, () => `${Object.entries(ACTS).map(([n, a]) => `<div class="block row-f"><h3>${esc(a.name)}</h3><div class="desc">${esc(a.desc)}</div></div>`).join('')}${Object.entries(SCENES).map(([id, sc]) => sceneBlock(id, sc)).join('')}`, 'El Acto II llega al encontrar a una facción extranjera y llevar 2 zonas superadas (o 8 zonas abiertas, o superar Metro-2). El Acto III, al leer el expediente Topolev o superar el Objeto 7 o las Raíces (escena «past»: −10 de confianza). Las escenas se reproducen a pantalla completa (clic, espacio o intro avanza; Esc salta).');
sec('Campaña', 'finales', 'Finales', Object.keys(ENDINGS).length, () => Object.entries(ENDINGS).map(([id, e]) => sceneBlock(id, e)).join(''), 'Al volver del Útero de Corium se abre el diálogo «finale». Partido: entregar 500 ✦. Sellar: siempre disponible. Occidente: reputación con Suecia o Finlandia ≥ 40, o con los contrabandistas ≥ 30. Fusión (oculto): haber leído el expediente del Objeto 7 y confianza de Topolev ≥ 70. Se puede posponer y volver otro día. El epílogo se guarda en la crónica.');
sec('Campaña', 'personal', 'Personal de la base', Object.keys(STAFF).length, () => Object.entries(STAFF).map(([id, p]) => `<div class="block row-f"><h3 style="color:${p.color}">${esc(p.name)} <span class="desc">· ${esc(p.role)}${p.tab ? ' · pestaña ' + p.tab.toUpperCase() : ''}</span></h3>${(p.lines || []).map((l) => `<div>${esc(l)}</div>`).join('')}</div>`).join(''), 'Cada uno habla en su pestaña. La confianza de Topolev (0–100, empieza en 50) sube con sus encargos y extracciones y baja con las muertes y las cuotas incumplidas; con 75 o más el laboratorio rinde un 5% más.');
sec('Campaña', 'comedor', 'Comedor, cartas y epitafios', Object.values(COMEDOR).flat().length + LETTERS_FROM.length + EPITAPHS.length + LAST_LETTERS.length, () => `${Object.entries(COMEDOR).map(([k, l]) => `<div class="block row-f"><h3>Comedor · ${esc(k)}</h3>${l.map((x) => `<div>${esc(x)}</div>`).join('')}</div>`).join('')}<div class="block row-f"><h3>Cartas de la familia</h3>${LETTERS_FROM.map((x) => `<div>✉ <b>${esc(x.from)}</b>: ${esc(x.text)}</div>`).join('')}</div><div class="block row-f"><h3>Epitafios</h3>${EPITAPHS.map((x) => `<div>✝ ${esc(x)}</div>`).join('')}</div><div class="block row-f"><h3>Últimas cartas</h3>${LAST_LETTERS.map((x) => `<div>${esc(x)}</div>`).join('')}</div>`, 'Tras cada expedición, una escena breve del comedor según lo ocurrido (muertes, amistades, rivalidades, estrés, éxito). Cada pocos días llega una carta de la familia de un agente (−12 de estrés). En el memorial, cada caído tiene epitafio y última carta.');
sec('Campaña', 'encargos', 'Encargos', Object.keys(CONTRACTS).length, () => table(Object.entries(CONTRACTS).map(([id, c]) => ({ id, ...c })), [
  { h: 'Encargo', v: (c) => `<span class="nm">${esc(c.name)}</span><div class="desc">${esc(c.desc)}</div>`, s: (c) => c.name },
  { h: 'Quién', v: (c) => esc(GIVER_NAME(c.giver)), s: (c) => c.giver },
  { h: 'Tipo', v: (c) => tag(c.kind, 'c') + (c.special ? `<span style="color:${MODIFIERS[c.special].color}">${tag('especial · ' + MODIFIERS[c.special].glyph + ' ' + MODIFIERS[c.special].name)}</span>` : '') + (c.zone ? tag(MAPS[mapIndex(c.zone)] ? MAPS[mapIndex(c.zone)].name : c.zone) : ''), s: (c) => (c.special ? 'z' : '') + c.kind },
  { h: 'Recompensa', v: (c) => rewText(c.reward) },
]), 'CUARTEL ofrece 3 encargos al día (máximo 3 aceptados). Entregar: el objeto tiene que estar en el almacén al volver. Fotografía y captura: con la cámara Zenit-E o la jaula. Escolta, sabotaje y desaparecido: el objetivo aparece en su zona (el desaparecido, en cualquiera). Encargos especiales (fase 16.4): uno al día en una zona abierta que tenga ese modificador; solo valen ese día, no ocupan hueco de los 3, no se penaliza abandonarlos y la recompensa sube un 10% por nivel de zona. activate: usar el objeto marcado (◎); retrieve: cogerlo y sacarlo de la zona; kills / essence: en una sola salida; pulse: seguir en la zona hasta 15 turnos después del pulso. Siempre hay que volver vivos.');
sec('Campaña', 'colecciones', 'Colecciones de notas', Object.keys(COLLECTIONS).length, () => table(Object.entries(COLLECTIONS).map(([id, c]) => ({ id, ...c, n: NOTES.filter((x) => x.col === id).length })), [
  { h: 'Colección', v: (c) => `<span class="nm">${esc(c.name)}</span><div class="desc">${esc(c.desc)}</div>`, s: (c) => c.name },
  { h: 'Notas', v: (c) => c.n, s: (c) => c.n, num: 1 },
  { h: 'Al completarla', v: (c) => rewText(c.reward) },
]), 'Cada nota pertenece a una colección; al leerlas todas se cobra la recompensa. Las notas ya leídas salen menos. Se consultan en ARCHIVO.');
sec('Campaña', 'interceptadas', 'Radio interceptada', INTERCEPTS.length, () => `<div class="list">${INTERCEPTS.map((n) => `<div class="note row-f">📻 <b>${esc((FACTIONS[n.f] || {}).name || n.f)}</b>: ${esc(n.t)}</div>`).join('')}</div>`, 'En las zonas con humanos extranjeros, la radio capta a veces sus transmisiones: marcan un alijo en el mapa.');

// ----- BASE VIVA (fase 21) -----
sec('Base', 'investigacion', 'Investigación', Object.keys(RESEARCH).length, () => table(Object.entries(RESEARCH).map(([id, r]) => ({ id, ...r })), [
  { h: '', g: true, v: (r) => esc(r.glyph) },
  { h: 'Proyecto', v: (r) => `<span class="nm">${esc(r.name)}</span> <span class="desc">${r.id}</span>`, s: (r) => r.name },
  { h: 'Efecto', v: (r) => esc(r.desc) },
  { h: 'Coste', v: (r) => costText(r.cost) },
  { h: 'Días', v: (r) => r.days, s: (r) => r.days, num: 1 },
  { h: 'Requiere', v: (r) => r.req.map((q) => esc(RESEARCH[q].name)).join(', ') || '—' },
]), 'Pestaña INVESTIGACIÓN (tecla 0). Hace falta el Laboratorio; un proyecto a la vez y avanza al pasar el día (el nivel del laboratorio acorta los plazos). Los especímenes vivos salen de la Celda de contención.');
sec('Base', 'fabricacion', 'Fabricación y materiales', RECIPES.length + Object.keys(MATERIALS).length, () => table(RECIPES, [
  { h: 'Receta', v: (r) => `<span class="nm">${esc(r.name)}</span>`, s: (r) => r.name },
  { h: 'Taller', v: (r) => r.lvl, s: (r) => r.lvl, num: 1 },
  { h: 'Coste', v: (r) => Object.entries(r.cost).map(([b, n]) => `${n}× ${esc((ITEMS[b] || {}).name || b)}`).join(' · ') + (r.ess ? ` · <span style="color:${ESS}">${r.ess} ✦</span>` : '') },
  { h: 'Investigación', v: (r) => (r.research ? esc(RESEARCH[r.research].name) : '—') },
]) + `<h3>Materiales</h3><div class="list">${Object.entries(MATERIALS).map(([id, m]) => `<div class="note row-f"><b>${esc(m.glyph)} ${esc(m.name)}</b> <span class="desc">${id} · ${m.value} ₽</span> — ${esc(m.desc)}</div>`).join('')}</div>`, 'Taller de fabricación (edificio). Los materiales salen de contenedores (22%), máquinas destruidas (chatarra y electrónica) y chebylitas (tejido). Desmontar un objeto en el almacén devuelve chatarra y electrónica según su nivel. La batería de litio y la placa de contenedor se instalan en el propio taller.');
sec('Base', 'calendario', 'Calendario e historia', Object.keys(SEASONS).length + HISTORY.length, () => `${table(Object.entries(SEASONS).map(([id, s]) => ({ id, ...s })), [
  { h: '', g: true, v: (s) => esc(s.glyph) }, { h: 'Estación', v: (s) => `<span class="nm">${esc(s.name)}</span>` }, { h: 'Efecto', v: (s) => esc(s.desc) },
])}<h3>Televisión</h3><div class="list">${HISTORY.map((h) => `<div class="note row-f"><b>${dateOf(h.day).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</b> (día ${h.day}) — ${esc(h.text)}</div>`).join('')}</div>`, 'El día 1 es el 2 de mayo de 1986. En invierno, el agua de superficie se hiela y sin abrigo se sufre hipotermia; en otoño llueve más. Con el sarcófago terminado, la radiación de ambiente del Sarcófago baja un 40%. Cada 30 días, la cuota del Comité.');
sec('Base', 'ataques', 'Ataques a la base', Object.keys(ATTACKS).length, () => table(Object.entries(ATTACKS).map(([id, a]) => ({ id, ...a })), [
  { h: 'Ataque', v: (a) => `<span class="nm">${esc(a.name)}</span><div class="desc">${esc(a.desc)}</div>`, s: (a) => a.name },
  { h: 'Atacantes', v: (a) => (a.enemies ? a.enemies.map((e) => esc((HUMANS[e] || ENEMIES[e] || {}).name || e)).join(', ') : 'los especímenes fugados y chebylitas de la zona') },
]), `Desde el día 12, un 5% al día (y siempre que haya una fuga en la celda de contención). Defender: una expedición especial al Puesto con los agentes que estén en la base; rechazarlo da +200 ₽ y +5 de confianza. Ceder (o perder): −25% de rublos, −20% de esencia, hasta 3 objetos del almacén y +15 de estrés para todos. Parcelas: ${PLOTS}, así que no caben todos los edificios.`);

// ------------------------------------------------------------ vistas especiales
// fase 24: logros y modos de juego
sec('Calidad', 'logros', 'Logros', ACHIEVEMENTS.length, () => table(ACHIEVEMENTS, [
  { h: '', v: (a) => esc(a.glyph) }, { h: 'Logro', v: (a) => `<b>${esc(a.name)}</b>${a.secret ? ' ' + tag('secreto', 'b') : ''}`, s: (a) => a.name }, { h: 'Condición', v: (a) => `<span class="desc">${esc(a.desc)}</span>` }, { h: 'id', v: (a) => `<code>${a.id}</code>` },
]), 'Se guardan fuera de las partidas (localStorage <code>topolev_achievements_v1</code>) y se comprueban al acabar cada expedición, cada día, al abatir un jefe y al ver un final.');
sec('Calidad', 'modos', 'Modos de juego', Object.keys(MODES).length, () => table(Object.entries(MODES).map(([id, m]) => ({ id, ...m })), [
  { h: 'Modo', v: (m) => `<b>${esc(m.name)}</b>`, s: (m) => m.name }, { h: 'id', v: (m) => `<code>${m.id}</code>` }, { h: 'Reglas', v: (m) => `<span class="desc">${esc(m.desc)}</span>` },
]) + `<h3>Modificadores de «1987»</h3>${table(Object.entries(NG_MODS).map(([id, m]) => ({ id, ...m })), [{ h: 'Modificador', v: (m) => esc(m.name) }, { h: 'Efecto', v: (m) => `<span class="desc">${esc(m.desc)}</span>` }])}`, `Desafío semanal: ${CHALLENGE_DAYS} días; puntuación = esencia total + 2 × bajas + 25 × extracciones − 40 × caídos; tabla local <code>topolev_challenge_v1</code>. «1987» se desbloquea con un final (legado en <code>topolev_legacy_v1</code>).`);
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
    { h: 'Modo daltónico', v: (r) => `<b style="color:${r.cb}">${r.sym}</b> <span style="color:${r.cb}">${r.cb}</span>` },
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

// fase 22: cadena alimentaria, jefe de zona, fases y trofeo
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
      <div>${d.abil.map((a) => tag(ABIL_TEXT[a], a === 'stationary' ? '' : 'b')).join('') || '<span class="desc">sin habilidades especiales</span>'}</div>${extra}${ecoLines(d)}
      <div class="desc" style="margin-top:.4em;font-style:italic">${esc(d.lore)}</div>
    </div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(52ch,1fr));gap:0 2ch">${cards}</div><p class="desc">Por nivel: +32% salud, +20–22% daño, +2 precisión, +1 esquiva, +1 blindaje cada 3 niveles y +45% esencia. Velocidad 100 = un movimiento por turno (150 = tres cada dos turnos).</p>`;
}

function renderMaps() {
  return MAPS.map((m, i) => {
    const zones = Object.entries(m.zones).map(([k, v]) => tag(`${ZONE_TYPE[k] || k} ${Math.round(v * 100)}%`)).join('');
    const enemies = m.enemies.map((id) => { const d = ENEMIES[id]; return `<span title="${esc(d.name)}" style="color:${enemyColor(d.hue, m.lvl[1])};font-weight:800;margin-right:1ch">${esc(d.glyph)} <span style="font-weight:400">${esc(d.name)}</span></span>`; }).join('<br>');
    const sectors = Object.keys(m.zones).map((k) => `<div><b>${ZONE_TYPE[k] || k}:</b> <span class="desc">${SECTOR_NAMES[k].join(' · ')}</span></div>`).join('');
    return `<div class="block row-f"><h3>${i + 1}. ${esc(m.name)} <span style="color:var(--dim);font-weight:400">· nivel ${m.lvl[0]}–${m.lvl[1]}</span></h3>
      <div class="desc" style="margin-bottom:.6em">${esc(m.desc)}</div>
      <table><tr><td style="width:50%">
        <div>${tag(STRATA[m.stratum], m.stratum === 'sup' ? 'c' : '')}${m.social ? tag('social', 'b') : ''}${m.factions ? tag('facciones') : ''} Dificultad (tier) <b>${m.tier}</b></div>
        <div>Tamaño: <b>${m.w}×${m.h}</b> · ${m.sx}×${m.sy} = ${m.sx * m.sy} sectores · <b>${m.floors} piso(s)</b>${m.floors > 1 ? ' (cada piso inferior: +1 nivel, mejor botín, sin extracciones permanentes)' : ''}</div>
        ${m.special ? `<div>Mecánica: <span class="desc">${esc(SPECIAL_TEXT[m.special] || m.special)}</span></div>` : ''}
        ${m.social ? '<div>Campamento: comerciante (₽), enfermería, tablón de rumores y trabajos. Residentes de la RDA. Pero de noche… a veces llega una incursión desde los pozos.</div>' : ''}
        <div>Terreno: ${zones}</div>
        <div>Radiación ambiente: <b>${m.ambientRad}</b></div>
        <div>Nidos ${m.nests.join('–')} · Vetas ${m.veins.join('–')} · Alijos ${m.caches.join('–')} · Peligros ${m.hazards.join('–')}</div>
        <div>Errantes: ${3 + Math.round(m.tier / 2)} grupos · Jefe: ${m.tier >= 8 ? 'siempre (hasta 2)' : m.tier >= 6 ? '75%' : m.enemies.some((e) => ENEMIES[e].boss) ? '50%' : 'no'}</div>
        <div>Desbloqueo: ${!m.req.length ? 'desde el inicio' : `extraer con éxito de ${m.req.map((r) => esc(MAPS[mapIndex(r)].name)).join(' o ')}`}</div>
        <div style="margin-top:.5em">${sectors}</div>
      </td><td>${enemies}</td></tr></table></div>`;
  }).join('') + '<p class="desc">Todas las zonas tienen 2 extracciones permanentes en los extremos (3 con Radar 5) y extracciones temporales cada 70–120 turnos que duran 84–126 (+12 por nivel de Radar; la baliza, 45). El radar triangula las permanentes al cabo de 24 − 3×Radar turnos (mín. 6). Los nidos salen como «?» hasta verlos, detectarlos con un radar de chebylitas o abatir 5 de su especie; los alijos y las puertas blindadas, ocultos hasta verlos o detectarlos con un radar de botín. Tras 300–420 turnos (+20 por tier) el reactor emite un pulso que sube la radiación ambiente. En superficie hay reloj (2 min por turno; de 21:00 a 6:00 es de noche), luz natural de día y clima (ver «Clima»).</p>';
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
  const cards = ids.map((id) => { const f = FACTIONS[id]; const r = f.rep0 ?? null; return `<div class="block row-f"><h3 style="color:${f.color}">${esc(f.name)} ${tag(f.short)}${f.bloc ? tag(f.bloc === 'varsovia' ? 'Pacto de Varsovia' : f.bloc === 'otan' ? 'OTAN' : 'neutral') : ''}${f.negotiable ? tag('negociable', 'c') : ''}${f.combat === false ? tag('no combate', 'b') : ''}</h3><div class="desc">${esc(f.country)} · id <code>${id}</code>${r != null ? ` · reputación inicial <b>${r}</b> (${repLevel(r).name}) → postura <b>${ATTITUDE_TEXT[squadAttitude({ rep: {} }, id)]}</b>` : ''}</div><div>${esc(f.desc)}</div>${f.offers ? `<div class="desc">Ofrece: ${esc(f.offers)}</div>` : ''}${SQUADS[id] ? `<div class="desc">Patrulla: ${SQUADS[id].map(([t, a, b]) => `${esc(HUMANS[t].name)} ${a}–${b}`).join(', ')} · desde tier ${SQUAD_MIN_TIER[id] ?? 0}</div>` : ''}</div>`; }).join('');
  const head = `<tr><th></th>${ids.map((b) => `<th style="color:${FACTIONS[b].color}">${esc(FACTIONS[b].short)}</th>`).join('')}</tr>`;
  const rows = ids.map((a) => `<tr><td style="color:${FACTIONS[a].color}"><b>${esc(FACTIONS[a].short)}</b></td>${ids.map((b) => { const t = a === b ? 'allied' : baseAttitude(a, b); return `<td style="color:${a === b ? 'var(--dim)' : ATT_COLOR[t]}">${a === b ? '—' : ATTITUDE_TEXT[t]}</td>`; }).join('')}</tr>`).join('');
  const lv = `<h3>Reputación (−100…+100)</h3><p class="desc">${REP_LEVELS.map((l) => `<b>${l.name}</b> desde ${l.min}`).join(' · ')}. La postura del escuadrón sale de la reputación: Pacto de Varsovia aliados desde 15, neutrales por debajo y hostiles por debajo de −50; neutrales aliados desde 50 y hostiles por debajo de −50; negociables neutrales desde 0 y aliados desde 50; EE. UU., Reino Unido y el culto, hostiles salvo con 50 o más. Atacar a un no hostil: −25 y hostilidad toda la expedición. Robar en sus alijos: −6 (o hostilidad si os ven). Apuntarles tres veces seguidas: hostilidad. Comerciar con quien no es del Pacto: −3 con el KGB.</p>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(46ch,1fr));gap:0 2ch">${cards}</div>${lv}<h3>Actitudes iniciales entre facciones</h3><table style="width:auto">${head}${rows}</table>`;
}
function renderHumans() {
  const cards = Object.entries(HUMANS).map(([id, d]) => {
    const f = FACTIONS[d.faction];
    const w = ITEMS[d.weapon];
    const lv = [1, 5, 10], S = lv.map((l) => scaleHuman(d, l));
    const line = (lab, fn) => `<tr><td class="desc">${lab}</td>${S.map((x) => `<td class="num">${fn(x)}</td>`).join('')}</tr>`;
    return `<div class="block row-f"><h3><span style="color:${f.color};background:${f.bg || 'transparent'};font-size:22px;margin-right:1ch;padding:0 .3ch">${esc(d.glyph)}</span>${esc(d.name)} <span style="color:${f.color};font-weight:400">· ${esc(f.short)}</span></h3>
      <div class="desc">id <code>${id}</code> · arma ${w ? `<b>${esc(w.name)}</b>` : '—'} · velocidad ${d.speed} · huye con poca salud (${Math.round(d.flee * 100)}%) · se rinde (${Math.round((d.surrender || 0) * 100)}%)${d.gasImmune ? ' · inmune al gas' : ''}</div>
      <div class="desc">${[d.cover ? `busca cobertura (${Math.round(d.cover * 100)}%)` : '', d.nade ? `lanza ${esc(ITEMS[d.nade].name)}` : '', d.radio ? 'avisa por radio' : '', d.charm ? 'azuza chebylitas' : '', d.stealthy ? 'sigiloso' : '', d.stationary ? 'fijo' : '', d.alarm ? 'da la alarma' : ''].filter(Boolean).join(' · ')}</div>
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
      ${typeof N.opts === 'function' ? '<div style="margin-left:4ch" class="desc">▸ <i>(opciones dinámicas: comprar / vender / curar según el contexto)</i></div>' : ''}${(typeof N.opts === 'function' ? [] : N.opts || []).map((o) => `<div style="margin-left:4ch">▸ <b>${txt(o.label)}</b>${o.turn ? ' ⌛' : ''}${o.cond ? ` <span class="desc">[requiere ${descObj(o.cond)}]</span>` : ''}${o.goto ? ` → <code>${esc(o.goto)}</code>` : ''}${o.effects ? `<div class="desc" style="margin-left:2ch">${o.effects.map(descObj).join(' · ')}</div>` : ''}</div>`).join('')}</div>`).join('');
    return `<div class="block row-f"><h3 style="color:${D.color || 'inherit'}">${esc(D.title)} <span class="desc">· <code>${id}</code> · ${esc(D.speaker || '')}</span></h3>${nodes}</div>`;
  }).join('');
}

function effText(d) {
  const parts = [];
  if (d.mods) parts.push(Object.entries(d.mods).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', '));
  if (d.attr) parts.push(Object.entries(d.attr).map(([k, v]) => `${k} +${v}`).join(', '));
  if (d.flags) parts.push(Object.entries(d.flags).map(([k, v]) => `${k}: ${v}`).join(', '));
  if (d.cond) parts.push(`si ${d.cond.when}: ${Object.entries(d.cond.mods).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}`);
  if (d.aura) parts.push(`aura r${d.aura.r}: ${Object.entries(d.aura.mods).map(([k, v]) => `${k} +${v}`).join(', ')}`);
  if (d.syn) parts.push('◈ ' + d.syn.map((sy) => (sy.gadget ? ITEMS[sy.gadget].name : ITEMS[sy.mod].name)).join(' / '));
  return `<span class="desc">${esc(parts.join(' · '))}</span>`;
}
function renderSpecs() {
  return Object.entries(SPECS).map(([id, sp]) => `<div class="block row-f"><h3 style="color:${sp.color}">${esc(sp.glyph)} ${esc(sp.name)} <span class="desc">· ${id} · ${esc(sp.fantasy)}</span></h3>
    <div><b>${esc(sp.ability.glyph)} ${esc(sp.ability.name)}</b> ${tag(`recarga ${sp.ability.cd}`)}${sp.ability.target ? tag('con objetivo', 'c') : ''} <span class="desc">${esc(sp.ability.desc)}</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2ch;margin-top:.5em">${sp.branches.map((b) => `<div><div class="nm">${esc(b.name)}</div>${b.talents.map((t) => { const d = SPEC_TALENTS[t]; return `<div style="margin:.3em 0"><b>${esc(d.glyph)} ${esc(d.name)}</b>${d.tier > 1 ? ' ' + tag('II', 'b') : ''}${d.syn ? ' ' + tag('◈', 'c') : ''}<div>${esc(d.desc)}</div>${effText(d)}</div>`; }).join('')}</div>`).join('')}</div></div>`).join('');
}
function renderBackgrounds() {
  return table(Object.entries(BACKGROUNDS).map(([id, b]) => ({ id, ...b })), [
    { h: 'Trasfondo', v: (b) => `<span class="nm">${esc(b.name)}</span><div class="desc">${esc(b.nameF)} · ${b.id}</div>`, s: (b) => b.name },
    { h: 'Atributos', v: (b) => Object.entries(b.attrs).map(([k, v]) => tag(`${ATTRS.find((x) => x.id === k).name} +${v}`, 'g')).join('') },
    { h: 'Rasgos posibles', v: (b) => b.traits.map((t) => esc(TRAITS.find((x) => x.id === t).name)).join(', ') },
    { h: 'Frases', v: (b) => `<div class="desc">${Object.entries(b.lines).map(([k, l]) => `<b>${k}</b>: ${l.map(esc).join(' / ')}`).join('<br>')}</div>` },
  ]);
}
function renderHonors() {
  const acq = table(Object.entries(ACQUIRED).map(([id, d]) => ({ id, ...d })), [
    { h: '', g: true, v: (d) => esc(d.glyph) },
    { h: 'Rasgo adquirido', v: (d) => `<span class="nm">${esc(d.name)}</span>`, s: (d) => d.name },
    { h: 'Cómo se gana', v: (d) => esc(d.how) },
    { h: 'Efecto', v: (d) => `${esc(d.desc)}<div>${effText(d)}</div>` },
  ]);
  const med = table(Object.entries(MEDALS).map(([id, d]) => ({ id, ...d })), [
    { h: '', g: true, v: (d) => `<span style="color:${d.color}">${esc(d.glyph)}</span>` },
    { h: 'Condecoración', v: (d) => `<span class="nm" style="color:${d.color}">${esc(d.name)}</span>`, s: (d) => d.name },
    { h: 'Requisito', v: (d) => esc(d.how) },
    { h: 'Efecto', v: (d) => esc(d.desc) },
  ]);
  const wnd = `<div class="block"><h3>Heridas persistentes</h3><div class="desc">Al bajar del 15% de salud (una vez por expedición) hay un ${Math.round(WOUND_CHANCE * 100)}% de sufrir una. Restan 1 al atributo hasta operarla en la ficha del agente (220 ₽ − 30 por nivel de Enfermería, mínimo 60).</div>${WOUNDS.map((w) => `<div>✖ ${esc(w.name)} <span class="desc">(−1 ${esc(ATTRS.find((x) => x.id === w.attr).name)})</span></div>`).join('')}</div>`;
  return `<h3>Rasgos adquiridos</h3>${acq}<h3>Condecoraciones</h3>${med}${wnd}`;
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

