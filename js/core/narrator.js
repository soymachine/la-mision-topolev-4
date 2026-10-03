// Fase 25: el Narrador del Reactor. Un director (al estilo de los narradores de RimWorld) que mide cómo os va
// (adaptación) y, cada día, gasta un presupuesto de amenaza en eventos de un catálogo; si las cosas van mal, manda
// alivios. Las amenazas grandes se anuncian el día antes con un presagio. La parte de la expedición (tensión turno a
// turno, golpes y respiros) está en exp/director.js y usa la misma personalidad.
import { S, addMessage } from './state.js';
import { MAPS, zoneOpen } from '../data/world.js';
import { createItem } from './items.js';
import { chronicle, addStress, trust } from './story.js';
import { addRep } from '../data/factions.js';
import { rng } from '../util/rng.js';

// personalidades: rate = ritmo del presupuesto de amenaza · relief = ganas de ayudar · chaos = azar · minGap = días
// mínimos entre amenazas · calm/reliefGap = turnos de calma antes de un golpe y entre respiros (en la expedición)
export const PERSONAS = {
  comisario: { name: 'El Comisario', glyph: '☭', color: '#ff5050', rate: 1, relief: 0.7, chaos: 0.12, minGap: 3, calm: 55, reliefGap: 70,
    desc: 'La curva clásica: la presión crece con los días y con vuestro éxito, con golpes bien espaciados y algún respiro cuando lo necesitáis.' },
  babushka: { name: 'Babushka', glyph: '♨', color: '#3ddc6b', rate: 0.55, relief: 1.5, chaos: 0.08, minGap: 5, calm: 90, reliefGap: 45,
    desc: 'Calma: pocas amenazas y muchos alivios. Deja tiempo para construir, investigar y encariñarse con los agentes.' },
  chernobil: { name: 'Chernóbil', glyph: '☢', color: '#b8f53d', rate: 1, relief: 0.9, chaos: 0.85, minGap: 1, calm: 35, reliefGap: 60,
    desc: 'Azar puro. Puede pasar cualquier cosa cualquier día: tres desgracias seguidas o una semana de paz.' },
};
export const persona = () => PERSONAS[(S && S.narr && S.narr.persona) || 'comisario'] || PERSONAS.comisario;

export function narrDefaults(d) {
  d.narr = d.narr || {};
  const N = d.narr;
  if (!PERSONAS[N.persona]) N.persona = 'comisario';
  if (N.adapt == null) N.adapt = 50;
  if (N.budget == null) N.budget = 0;
  if (N.lastThreat == null) N.lastThreat = 0;
  if (N.lastRelief == null) N.lastRelief = 0;
  N.log = N.log || [];
  if (N.pending === undefined) N.pending = null;
  if (N.crisis === undefined) N.crisis = null;
  N.curves = N.curves || [];
  return N;
}
export function setPersona(id) {
  if (!PERSONAS[id]) return false;
  narrDefaults(S).persona = id;
  addMessage(`El Reactor cambia de humor: ahora narra ${PERSONAS[id].name}.`);
  return true;
}
// estado de ánimo del Reactor para la cabecera de la base
export function narrMood() {
  const N = narrDefaults(S);
  const a = N.adapt;
  const txt = N.pending ? 'Algo se acerca…' : N.crisis ? CRISIS_NAMES[N.crisis.kind] || 'Crisis' : a >= 75 ? 'El Reactor os pone a prueba' : a >= 55 ? 'El Reactor está inquieto' : a >= 35 ? 'El Reactor observa' : 'El Reactor os da un respiro';
  return { ...persona(), id: N.persona, adapt: Math.round(a), budget: Math.round(N.budget * 10) / 10, text: txt };
}

// ---------------------------------------------------------------- crisis activas (efectos en la base)
const CRISIS_NAMES = { apagon: 'Apagón en el Puesto', escasez: 'Escasez de suministros' };
export const crisisOn = (kind) => !!(S && S.narr && S.narr.crisis && S.narr.crisis.kind === kind && S.narr.crisis.until > S.day);
export const narrPriceK = () => (crisisOn('escasez') ? 1.3 : 1);
// agentes enfermos (epidemia): no pueden salir de expedición
export const sickDays = (a) => Math.max(0, (a.sickUntil || 0) - ((S && S.day) || 0));

// ---------------------------------------------------------------- catálogo
// cost: puntos de presupuesto · w: peso · cond(): si se puede ahora · omen: texto del día antes · fire(): efectos
const pickZone = () => { const open = MAPS.filter((m, i) => zoneOpen(S, i) && !m.social); return open.length ? open[Math.floor(Math.random() * open.length)] : null; };
const recruitFree = (why) => {
  const C = campaignMod;
  if (!C || S.agents.length >= C.rosterCap()) return false;
  const a = C.createAgentFor ? C.createAgentFor({ lvl: Math.max(1, Math.min(6, Math.round(S.day / 8))) }) : null;
  if (!a) return false;
  S.agents.push(a);
  addMessage(`${why} ${a.first} «${a.nick}» ${a.last} se une al Puesto (Nv ${a.lvl}).`);
  return true;
};
export const THREATS = {
  ataque: { name: 'Ataque al Puesto', cost: 8, w: 3, cond: () => S.mode !== 'libre' && S.day >= 8 && !S.attack && S.day - (S.lastAttack || 0) >= 8,
    omen: 'Kravets: «Los perros de la verja no han dormido en toda la noche. Algo viene hacia el Puesto.»',
    fire: () => { const k = ['usa', 'merodeadores', 'nido'][Math.floor(Math.random() * 3)]; return basecoreMod && basecoreMod.startAttack(k); } },
  apagon: { name: 'Apagón', cost: 4, w: 2, cond: () => !S.narr.crisis,
    fire: () => { (S.pendingDialogs = S.pendingDialogs || []).push('narr_apagon'); return true; } },
  epidemia: { name: 'Fiebre en los barracones', cost: 5, w: 2, cond: () => S.agents.filter((a) => !a.sickUntil || a.sickUntil <= S.day).length >= 3,
    omen: 'La Dra. Orlova: «Dos tosen desde anoche. Que nadie comparta la cantimplora.»',
    fire: () => {
      const pool = S.agents.filter((a) => !(a.sickUntil > S.day));
      const n = Math.min(pool.length - 1, 1 + (Math.random() < 0.5 ? 1 : 0));
      const sick = [];
      for (let i = 0; i < n; i++) { const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; a.sickUntil = S.day + 3; sick.push(a); addStress(a, 8); }
      S.narr.sickNow = sick.map((a) => a.id);
      (S.pendingDialogs = S.pendingDialogs || []).push('narr_epidemia');
      return sick.length > 0;
    } },
  inspeccion: { name: 'Inspección del KGB', cost: 6, w: 2, cond: () => S.day >= 6,
    omen: 'Zhdánov, muy serio: «Mañana llega un coche negro de Kiev. Ordenad los papeles. Y la trastienda.»',
    fire: () => { (S.pendingDialogs = S.pendingDialogs || []).push('narr_inspeccion'); return true; } },
  escasez: { name: 'Escasez de suministros', cost: 3, w: 2, cond: () => !S.narr.crisis,
    fire: () => { S.narr.crisis = { kind: 'escasez', until: S.day + 3 }; addMessage('Kravets: «El convoy de Kiev no ha llegado. Tres días con lo que tengamos: en la Intendencia todo cuesta un 30% más.»'); return true; } },
  crecen: { name: 'Los nidos crecen', cost: 5, w: 2, cond: () => !!pickZone(),
    omen: 'Topolev: «Los sismógrafos registran algo enorme moviéndose bajo una de las zonas. No me gusta.»',
    fire: () => {
      const m = pickZone(); if (!m) return false;
      S.world = S.world || { zones: {} }; S.world.zones = S.world.zones || {};
      const z = (S.world.zones[m.id] = S.world.zones[m.id] || {});
      z.calmDay = null; z.lastVisit = Math.min(z.lastVisit == null ? S.day : z.lastVisit, S.day) - 13; // +1 nivel de golpe
      addMessage(`☢ Los nidos de ${m.name} han crecido de golpe: los chebylitas son más fuertes allí.`);
      return true;
    } },
};
export const RELIEFS = {
  suministros: { name: 'Suministros lanzados', w: 3, fire: () => {
    const pool = ['bandage', 'bandage', 'ai2', 'antirad', 'ration', 'a_9x18', 'a_545', 'stim'];
    const got = [];
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) { const b = pool[Math.floor(Math.random() * pool.length)]; S.stash.push(createItem(b, 0, rng, b.startsWith('a_') ? 24 : 1)); got.push(b); }
    addMessage(`Un Mi-8 deja caer un contenedor junto a la verja: ${got.length} lotes de suministros (vendas, medicinas, munición). Alguien en Moscú se acuerda de vosotros.`);
    return true;
  } },
  subvencion: { name: 'Subvención del Comité', w: 2, fire: () => { const n = Math.round((150 + S.day * 6) / 10) * 10; S.rub += n; addMessage(`Telegrama del Comité: partida extraordinaria de ${n} ₽ «para el heroico trabajo del Puesto».`); return true; } },
  voluntario: { name: 'Voluntario', w: 2, cond: () => campaignMod && S.agents.length < campaignMod.rosterCap(), fire: () => recruitFree('Un liquidador de Kiev se presenta voluntario:') },
  desertor: { name: 'Desertor con información', w: 2, fire: () => {
    S.stash.push(createItem('intel', 0, rng)); addRep(S, 'kgb', -1);
    addMessage('Un desertor del Ejército Rojo llega de noche, hambriento. A cambio de comida os deja documentos de inteligencia (en el almacén).');
    return true;
  } },
  calma: { name: 'Calma en la Zona', w: 2, fire: () => { S.narr.calmNext = 1; addMessage('Topolev: «Los contadores llevan horas en silencio. La próxima bajada encontrará menos nidos. Aprovechadlo.»'); return true; } },
};

// ---------------------------------------------------------------- cada día
let basecoreMod = null, campaignMod = null;
export function narrHooks(mods) { basecoreMod = mods.basecore || basecoreMod; campaignMod = mods.campaign || campaignMod; }
const weighted = (list) => { const tot = list.reduce((a, [, d]) => a + d.w, 0); let r = Math.random() * tot; for (const it of list) { r -= it[1].w; if (r <= 0) return it; } return list[list.length - 1]; };
function logIt(N, id, kind) { N.log.push({ day: S.day, id, kind }); if (N.log.length > 40) N.log.shift(); }
export function fireNarr(id) {
  const N = narrDefaults(S);
  const T = THREATS[id], R = RELIEFS[id];
  const d = T || R;
  if (!d) return false;
  const ok = d.fire();
  if (ok) { logIt(N, id, T ? 'amenaza' : 'alivio'); chronicle(`${T ? '⚠' : '✚'} ${d.name}.`); }
  return ok;
}
export function narrDay() {
  const N = narrDefaults(S);
  const P = persona();
  // crisis que terminan
  if (N.crisis && N.crisis.until <= S.day) { addMessage(N.crisis.kind === 'apagon' ? 'Vuelve la luz al Puesto: los edificios funcionan otra vez.' : 'Llega el convoy: los precios de la Intendencia vuelven a la normalidad.'); N.crisis = null; }
  // lo que se anunció ayer
  if (N.pending && N.pending.day <= S.day) { const id = N.pending.id; N.pending = null; fireNarr(id); return id; }
  // adaptación: sobrevivir un día cuenta un poco; el presupuesto crece con ella y con los días
  N.adapt = Math.max(0, Math.min(100, N.adapt + 0.6));
  N.budget += P.rate * (0.5 + N.adapt / 100) * (1 + S.day / 50);
  // alivio si las cosas van mal (Babushka, también a veces sin motivo)
  const low = Math.max(0, 40 - N.adapt) / 40;
  if (S.day - N.lastRelief >= 3 && Math.random() < P.relief * (low * 0.6 + (N.persona === 'babushka' ? 0.08 : 0.02))) {
    const list = Object.entries(RELIEFS).filter(([, d]) => !d.cond || d.cond());
    if (list.length) { const [id] = weighted(list); N.lastRelief = S.day; fireNarr(id); return id; }
  }
  // amenaza
  if (S.day < 3 || S.day - N.lastThreat < P.minGap) return null;
  const avail = Object.entries(THREATS).filter(([, d]) => d.cond());
  let pick = null;
  if (avail.length && Math.random() < P.chaos * 0.25) pick = avail[Math.floor(Math.random() * avail.length)]; // azar
  else {
    const fit = avail.filter(([, d]) => d.cost <= N.budget);
    if (fit.length && Math.random() < 0.55) pick = weighted(fit.map(([id, d]) => [id, { ...d, w: d.w * (1 + d.cost / 8) }]));
  }
  if (!pick) return null;
  const [id, d] = pick;
  N.budget = Math.max(0, N.budget - d.cost);
  N.lastThreat = S.day;
  if (d.omen) { N.pending = { id, day: S.day + 1 }; addMessage(`Presagio · ${d.omen}`); return 'omen:' + id; }
  fireNarr(id);
  return id;
}
// al volver de una expedición: la adaptación sube con el éxito y baja con las bajas
export function narrOnExpedition({ success, deaths, ess, curve }) {
  const N = narrDefaults(S);
  N.adapt += success ? 4 + Math.min(6, (ess || 0) / 40) : -6;
  N.adapt -= (deaths || 0) * 10;
  N.adapt = Math.max(0, Math.min(100, N.adapt));
  if (curve && curve.length) { N.curves.push({ day: S.day, c: curve }); if (N.curves.length > 10) N.curves.shift(); }
  N.calmNext = 0;
}
// curva de tensión en ASCII: ▁▂▃▄▅▆▇█
export function sparkline(c, w = 40) {
  if (!c || !c.length) return '';
  const bars = '▁▂▃▄▅▆▇█';
  const step = Math.max(1, c.length / w);
  let out = '';
  for (let i = 0; i < c.length; i += step) {
    const sl = c.slice(Math.floor(i), Math.floor(i + step));
    const v = Math.max(...sl);
    out += bars[Math.max(0, Math.min(7, Math.floor((v / 100) * 8)))];
  }
  return out;
}

// diálogos de las crisis (se añaden a DIALOGS en data/dialogs.js)
export const NARR_DIALOGS = {
  narr_apagon: {
    title: 'APAGÓN', speaker: 'Mecánico «Babai»', color: '#ffb02e',
    nodes: { start: {
      text: () => 'Se va la luz en todo el Puesto. Babai sale del cuarto de máquinas negro de hollín: «El transformador ha reventado. Puedo arrancar el diésel de reserva, pero el gasoil vale su peso en oro. Sin él, dos días a oscuras: ni investigación, ni invernadero, ni refugio.»',
      opts: [
        { label: 'ARRANCAR EL DIÉSEL (150 ₽)', cls: 'good', cond: { rub: ['>=', 150] }, hint: 'no hay 150 ₽', effects: [{ rub: -150 }, { run: () => { addMessage('El diésel ruge toda la noche. El Puesto sigue en marcha.'); } }] },
        { label: 'AGUANTAR A OSCURAS (2 DÍAS SIN PRODUCCIÓN)', cls: 'bad', effects: [{ run: () => { S.narr.crisis = { kind: 'apagon', until: S.day + 2 }; addMessage('Dos días a la luz de las velas: la investigación, el invernadero y el refugio se detienen.'); } }] },
      ] } },
  },
  narr_epidemia: {
    title: 'FIEBRE EN LOS BARRACONES', speaker: 'Dra. Lyudmila Orlova', color: '#ff6a6a',
    nodes: { start: {
      text: () => { const names = (S.narr.sickNow || []).map((id) => S.agents.find((a) => a.id === id)).filter(Boolean).map((a) => `«${a.nick}»`); return `Orlova se quita la mascarilla: «${names.join(' y ') || 'Varios'} tienen fiebre alta. Nada grave si guardan cama tres días. Con dos botiquines AI-2 podría tenerlos en pie mañana.»`; },
      opts: [
        { label: 'USAR DOS BOTIQUINES AI-2 DEL ALMACÉN', cls: 'good', cond: { test: () => S.stash.filter((it) => it.b === 'ai2').reduce((n, it) => n + (it.q || 1), 0) >= 2 }, hint: 'no hay dos AI-2 en el almacén', effects: [{ run: () => { let need = 2; for (const it of [...S.stash]) { if (need <= 0) break; if (it.b !== 'ai2') continue; const k = Math.min(need, it.q || 1); need -= k; if ((it.q || 1) > k) it.q -= k; else S.stash.splice(S.stash.indexOf(it), 1); } for (const a of S.agents) a.sickUntil = 0; addMessage('Los enfermos se recuperan en una noche.'); } }] },
        { label: 'QUE GUARDEN CAMA (3 DÍAS SIN PODER SALIR)', effects: [{ run: () => addMessage('Los enfermos guardan cama: no podrán bajar a la Zona en tres días.') }] },
      ] } },
  },
  narr_inspeccion: {
    title: 'INSPECCIÓN DEL KGB', speaker: 'Inspector Sémenov (KGB)', color: '#e05050',
    nodes: { start: {
      text: () => `Un Volga negro aparca junto a la verja. El inspector Sémenov hojea los libros sin quitarse los guantes: «Esencia, rublos, contactos con extranjeros… Todo muy interesante, camarada director. ¿Hay algo que quiera contarme antes de que lo encuentre yo?»<br><br><span class="dimt">(Reputación con el KGB: ${(S.rep && S.rep.kgb) || 0})</span>`,
      opts: [
        { label: 'ENTREGAR DOCUMENTOS DE INTELIGENCIA', cls: 'good', cond: { test: () => S.stash.some((it) => it.b === 'intel' || it.b === 'docs') }, hint: 'no hay documentos en el almacén', effects: [{ run: () => { const i = S.stash.findIndex((it) => it.b === 'intel' || it.b === 'docs'); if (i >= 0) S.stash.splice(i, 1); addRep(S, 'kgb', 8); addMessage('Sémenov guarda los documentos en el maletín y sonríe por primera vez. KGB +8.'); } }] },
        { label: 'UN SOBRE CON 200 ₽ «PARA EL VIAJE»', cond: { rub: ['>=', 200] }, hint: 'no hay 200 ₽', effects: [{ rub: -200 }, { run: () => addMessage('El sobre desaparece en el abrigo del inspector. La inspección termina sin incidencias.') }] },
        { label: 'ENSEÑARLE LOS LIBROS Y NADA MÁS', cls: 'bad', effects: [{ run: () => { const bad = Math.random() < 0.5; if (bad) { addRep(S, 'kgb', -10); trust(-2, 'la inspección'); S.rub = Math.max(0, S.rub - 100); addMessage('Sémenov encuentra «irregularidades»: multa de 100 ₽ y KGB −10.'); } else addMessage('Sémenov no encuentra nada. Se va de mal humor.'); } }] },
      ] } },
  },
};
