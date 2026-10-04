// Fase 28: la Conspiración. Cada partida monta un caso distinto con las piezas de data/plot.js:
// QUIÉN filtra (el personal o uno de vuestros agentes), POR QUÉ, PARA QUIÉN y DÓNDE está el buzón muerto.
// - Las pistas salen de papeles en la Zona, interrogatorios, la radio interceptada, los informes de inteligencia,
//   el archivo del KGB, las propias filtraciones y el buzón.
// - En el tablero de corcho (ARCHIVO) se unen con hilos a una hipótesis; con dos pistas unidas se puede concluir.
//   Acertar trae recompensas (el buzón aparece como zona de evento, el traidor se enfrenta…); fallar cuesta confianza.
// - Mientras nadie descubra al culpable, filtra: roba del almacén, cobra del presupuesto o vende vuestra ruta.
import { S, addMessage } from './state.js';
import { MAPS, mapIndex } from '../data/world.js';
import { FACTIONS, addRep } from '../data/factions.js';
import { chronicle, trust, addStress } from './story.js';
import { agentName } from './agents.js';
import { ITEMS } from '../data/items.js';
import { SUSPECTS, TRAITS, TRAIT_SHORT, MOTIVES, BENEFICIARIES, PLACE_CLUES, CENTRAL, SOURCES, QUESTIONS, CODENAMES, KGB_CLUE_PRICE } from '../data/plot.js';

const pick = (l) => l[Math.floor(Math.random() * l.length)];
export const plotHooks = {}; // los rellena campaign.js (evita el ciclo de importaciones): dismiss, spawnPlotZone

export function plotDefaults(d) {
  if (!d.plot) d.plot = { on: 0 };
  return d.plot;
}
export const BENEFICIARIES_OF = (k) => (BENEFICIARIES[k] ? BENEFICIARIES[k].fac : 'contrabandistas');
export const plotOn = () => !!(S && S.plot && S.plot.on);

// ---------------------------------------------------------------- zonas
const PLACE_KEYS = ['estrato', 'ew', 'ns', 'bioma'];
export function zoneTraits(m) {
  const top = Object.entries(m.zones || {}).sort((a, b) => b[1] - a[1])[0];
  return { estrato: m.stratum, ew: m.pos[0] < CENTRAL[0] ? 'oeste' : 'este', ns: m.pos[1] < CENTRAL[1] ? 'norte' : 'sur', bioma: top ? top[0] : '—' };
}
export const placeCandidates = () => MAPS.filter((m) => !m.social);
const sameZone = (a, b) => { const ta = zoneTraits(a), tb = zoneTraits(b); return PLACE_KEYS.every((k) => ta[k] === tb[k]); };
// zonas que sus cuatro rasgos identifican sin duda
export const uniquePlaces = () => placeCandidates().filter((m) => placeCandidates().filter((z) => sameZone(z, m)).length === 1);
export const zoneCardName = (m) => { const n = m.name.split(/ — |, |: | \(/)[0]; return n.length > 32 ? n.slice(0, 31) + '…' : n; };

// ---------------------------------------------------------------- generar el caso
export function plotGenerate() {
  const P = { on: 1, day: S.day, code: pick(CODENAMES), found: [], links: {}, crossed: {}, solved: {}, locked: {}, leaks: 0, lastLeak: S.day, fresh: 0, wrong: 0 };
  const ag = S.agents.length ? pick(S.agents) : null;
  P.agent = ag ? { id: ag.id, name: agentName(ag), nick: ag.nick } : null;
  const ids = Object.keys(SUSPECTS).filter((id) => id !== 'agent' || P.agent);
  const keys = Object.keys(TRAITS);
  // perfiles: cada inocente se diferencia del culpable en dos rasgos o más
  for (let tries = 0; tries < 500 && !P.prof; tries++) {
    const prof = {};
    for (const id of ids) { prof[id] = {}; for (const k of keys) prof[id][k] = pick(TRAITS[k].vals); }
    const culprit = pick(ids);
    if (ids.every((id) => id === culprit || keys.filter((k) => prof[id][k] !== prof[culprit][k]).length >= 2)) { P.prof = prof; P.truth = { quien: culprit }; }
  }
  P.truth.porque = pick(Object.keys(MOTIVES));
  P.truth.para = pick(Object.keys(BENEFICIARIES));
  const uniq = uniquePlaces(), easy = uniq.filter((m) => (m.tier || 0) <= 6);
  P.truth.donde = pick(easy.length ? easy : uniq).id;
  // las pistas posibles
  const tr = zoneTraits(MAPS[mapIndex(P.truth.donde)]);
  P.pool = [
    ...keys.map((k) => ({ id: 'quien:' + k, q: 'quien', k, v: P.prof[P.truth.quien][k] })),
    ...Object.keys(MOTIVES).map((k) => ({ id: 'porque:' + k, q: 'porque', k, yes: k === P.truth.porque })),
    ...Object.keys(BENEFICIARIES).map((k) => ({ id: 'para:' + k, q: 'para', k, yes: k === P.truth.para })),
    ...PLACE_KEYS.map((k) => ({ id: 'donde:' + k, q: 'donde', k, v: tr[k] })),
  ];
  S.plot = P;
  chronicle(`Se abre el caso «${P.code}»: alguien del Puesto filtra información.`);
  return P;
}

// ---------------------------------------------------------------- pistas
export function clueText(c) {
  if (c.q === 'quien') return TRAITS[c.k].clue(c.v);
  if (c.q === 'porque') return c.yes ? MOTIVES[c.k].yes : MOTIVES[c.k].no;
  if (c.q === 'para') return c.yes ? BENEFICIARIES[c.k].yes : BENEFICIARIES[c.k].no;
  if (c.q === 'donde') return PLACE_CLUES[c.k](c.v);
  return '';
}
export const clueById = (id) => S.plot && S.plot.pool && S.plot.pool.find((c) => c.id === id);
export const foundClues = (q = null) => (S.plot && S.plot.found ? S.plot.found.map((f) => ({ ...clueById(f.id), src: f.src, day: f.day })).filter((c) => c.id && (!q || c.q === q)) : []);
const isFound = (id) => S.plot.found.some((f) => f.id === id);
export const remaining = (q = null) => (plotOn() ? S.plot.pool.filter((c) => !isFound(c.id) && (!q || c.q === q) && !S.plot.solved[c.q]) : []);

// qué preguntas prefiere cada fuente
const SRC_Q = { mapa: { quien: 1, porque: 1, para: 1, donde: 1.4 }, fuga: { quien: 3, porque: 1 }, interrogatorio: { para: 3, donde: 1 }, radio: { para: 2, quien: 1 }, inteligencia: { para: 1, donde: 2 }, kgb: { quien: 2, porque: 2 }, buzon: { para: 1, porque: 1, donde: 1, quien: 1 }, inicio: { quien: 1 } };
// encuentra una pista (la apunta en el tablero y avisa); devuelve la pista o null si no queda ninguna
export function plotFind(src, opts = {}) {
  if (!plotOn()) return null;
  const P = S.plot;
  let cand = remaining();
  if (!cand.length) return null;
  let c = null;
  // interrogatorios y radio: la facción reconoce (o no) el nombre en clave
  if ((src === 'interrogatorio' || src === 'radio') && opts.fac && BENEFICIARIES[opts.fac]) c = cand.find((x) => x.id === 'para:' + opts.fac) || null;
  if (src === 'radio' && !c && Math.random() < 0.5) c = cand.find((x) => x.id === 'quien:turno' || x.id === 'quien:idioma') || null;
  if (!c) {
    const w = SRC_Q[src] || {};
    const pool = cand.filter((x) => w[x.q]);
    const list = pool.length ? pool : cand;
    let tot = list.reduce((n, x) => n + (w[x.q] || 1), 0), r = Math.random() * tot;
    for (const x of list) { r -= w[x.q] || 1; if (r <= 0) { c = x; break; } }
    c = c || list[list.length - 1];
  }
  P.found.push({ id: c.id, src, day: S.day });
  P.fresh = (P.fresh || 0) + 1;
  if (!opts.quiet) addMessage(`📌 Pista para el caso «${P.code}» (${QUESTIONS[c.q].name}): ${clueText(c)}`);
  return c;
}

// ---------------------------------------------------------------- hipótesis del tablero
export function suspectName(id) {
  if (id === 'agent') return S.plot && S.plot.agent ? S.plot.agent.name : 'un agente';
  return SUSPECTS[id] ? SUSPECTS[id].name : id;
}
export function hypotheses(q) {
  const P = S.plot;
  if (q === 'quien') return Object.keys(P.prof).map((id) => ({ id, name: suspectName(id), glyph: SUSPECTS[id].glyph, color: SUSPECTS[id].color, sub: Object.keys(TRAITS).map((k) => TRAIT_SHORT[P.prof[id][k]] || P.prof[id][k]).join(' · '), role: id === 'agent' ? 'Agente del Puesto' : SUSPECTS[id].role }));
  if (q === 'porque') return Object.entries(MOTIVES).map(([id, m]) => ({ id, name: m.name, glyph: m.glyph, color: '#e6c86a' }));
  if (q === 'para') return Object.entries(BENEFICIARIES).map(([id, b]) => ({ id, name: b.name, glyph: '⚑', color: (FACTIONS[b.fac] && FACTIONS[b.fac].color) || '#ccc' }));
  return placeCandidates().map((m) => { const t = zoneTraits(m); return { id: m.id, name: zoneCardName(m), glyph: m.stratum === 'sup' ? '◆' : '▼', color: m.stratum === 'sup' ? '#7fd07f' : '#ff8a1f', sub: `${t.estrato === 'sup' ? 'superficie' : 'subsuelo'} · ${t.ew} · ${t.ns} · ${t.bioma}` }; });
}
export const hypName = (q, id) => (hypotheses(q).find((h) => h.id === id) || { name: id }).name;

// hilo de una pista a una hipótesis (una sola por pista; volver a unirla la suelta)
export function plotLink(clueId, hypId) {
  const P = S.plot;
  if (!P || !isFound(clueId)) return false;
  const c = clueById(clueId);
  if (P.solved[c.q]) return false;
  if (P.links[clueId] === hypId) delete P.links[clueId];
  else P.links[clueId] = hypId;
  return true;
}
export function plotCross(q, id) { const P = S.plot; const k = q + ':' + id; if (P.crossed[k]) delete P.crossed[k]; else P.crossed[k] = 1; }
export const linkedTo = (q, id) => Object.entries(S.plot.links).filter(([cid, h]) => h === id && cid.startsWith(q + ':')).map(([cid]) => cid);

// ¿se puede concluir? (devuelve el motivo si no)
export function canConclude(q, id) {
  const P = S.plot;
  if (!P || !P.on) return 'No hay ningún caso abierto.';
  if (P.solved[q]) return 'Esta pregunta ya está resuelta.';
  if ((P.locked[q] || 0) > S.day) return `Tras una acusación fallida, el Comisario no admite otra hasta el día ${P.locked[q]}.`;
  const n = linkedTo(q, id).length;
  if (n < QUESTIONS[q].need) return `Unid con hilo al menos ${QUESTIONS[q].need} pistas a esta hipótesis (${n}).`;
  return '';
}
export function plotConclude(q, id) {
  const why = canConclude(q, id);
  if (why) return { ok: false, err: why };
  const P = S.plot;
  if (id !== P.truth[q]) {
    P.locked[q] = S.day + 4; P.wrong++;
    trust(-6, 'una conclusión sin fundamento');
    let txt = `✗ Caso «${P.code}»: «${hypName(q, id)}» no encaja. Hay que buscar más pistas.`;
    if (q === 'quien') {
      if (id === 'agent' && P.agent) { const a = S.agents.find((x) => x.id === P.agent.id); if (a) addStress(a, 35); txt += ` ${P.agent.name} se entera de que sospechabais de su lealtad.`; }
      else txt += ` ${suspectName(id)} pasa una noche en el calabozo del Comisario antes de que se aclare. No lo olvidará.`;
    }
    addMessage(txt); chronicle(txt);
    return { ok: false, wrong: true, txt };
  }
  P.solved[q] = S.day;
  const out = [];
  if (q === 'quien') { out.push(`★ El culpable es ${suspectName(id)}. Se acabaron las filtraciones.`); (S.pendingDialogs = S.pendingDialogs || []).push('plot_traitor'); }
  if (q === 'porque') { S.rub += 150; out.push(`★ El motivo: ${MOTIVES[id].name.toLowerCase()}. Zhdánov tramita el informe: +150 ₽.`); }
  if (q === 'para') { S.rub += 200; addRep(S, 'kgb', 5); out.push(`★ Trabaja para ${BENEFICIARIES[id].name}. El KGB paga el dato (+200 ₽) y sus ofensivas os pillarán con más tiempo.`); }
  if (q === 'donde') { out.push(`★ El buzón muerto está en ${MAPS[mapIndex(id)].name}. Aparece en el mapa de la región: id antes de que lo vacíen.`); if (plotHooks.spawnPlotZone) plotHooks.spawnPlotZone(id); }
  if (plotComplete()) { P.complete = S.day; out.push(`★ CASO «${P.code}» CERRADO. Todo encaja: quién, por qué, para quién y dónde. Con esto se puede ir muy lejos… hasta el Politburó.`); trust(8, 'habéis destapado la conspiración'); }
  for (const t of out) { addMessage(t); chronicle(t); }
  return { ok: true, txt: out.join(' ') };
}
export const plotComplete = () => !!(S.plot && S.plot.on && Object.keys(QUESTIONS).every((q) => S.plot.solved[q]));

// el archivo del KGB vende una pista
export const kgbCluePrice = () => Math.round(KGB_CLUE_PRICE * (((S.rep && S.rep.kgb) || 0) >= 25 ? 0.7 : 1));
export function plotBuyClue() {
  const p = kgbCluePrice();
  if (!plotOn() || S.rub < p || !remaining().length) return null;
  S.rub -= p;
  return plotFind('kgb');
}

// ---------------------------------------------------------------- cada día
export function plotDay() {
  const P = plotDefaults(S);
  if (S.flags && S.flags.noStory) return null;
  if (!P.on) {
    if ((S.act >= 2 || S.day >= 12) && S.agents.length) {
      plotGenerate();
      plotFind('inicio', { quiet: true });
      (S.pendingDialogs = S.pendingDialogs || []).push('plot_intro');
      return 'start';
    }
    return null;
  }
  if (P.solved.quien || P.culpritGone || P.fate) return null;
  // si el culpable era un agente que ya no está, las filtraciones cesan
  if (P.truth.quien === 'agent' && P.agent && !S.agents.some((a) => a.id === P.agent.id)) { P.culpritGone = S.day; addMessage(`Caso «${P.code}»: las filtraciones han cesado de golpe. Como si quien las hacía ya no estuviera entre vosotros…`); return 'gone'; }
  if (S.day - P.lastLeak < 3 || Math.random() > 0.3) return null;
  return plotLeak();
}
export function plotLeak(kind = null) {
  const P = S.plot;
  P.leaks++; P.lastLeak = S.day;
  const B = BENEFICIARIES[P.truth.para];
  kind = kind || pick(['robo', 'rublos', 'ruta']);
  let txt;
  if (kind === 'robo') {
    const list = S.stash.filter((it) => ITEMS[it.b] && ITEMS[it.b].value <= 600 && !ITEMS[it.b].noLoot);
    const it = list.length ? pick(list) : null;
    if (it) { S.stash.splice(S.stash.indexOf(it), 1); txt = `🕵 Filtración: falta del almacén ${ITEMS[it.b].name}${(it.q || 1) > 1 ? ` (×${it.q})` : ''}. Kravets jura que él no ha sido.`; }
    else kind = 'rublos';
  }
  if (kind === 'rublos') { const n = Math.min(300, Math.max(30, Math.round(S.rub * 0.08))); S.rub = Math.max(0, S.rub - n); txt = `🕵 Filtración: un informe del Puesto ha llegado a quien no debía. El Comité recorta el presupuesto (−${n} ₽).`; }
  if (kind === 'ruta') { P.ambush = 1; txt = `🕵 Filtración: alguien ha pasado vuestra próxima ruta. En la siguiente expedición os esperarán patrullas de ${B.short}.`; }
  addMessage(txt);
  if (Math.random() < 0.6) plotFind('fuga');
  return kind;
}

// ---------------------------------------------------------------- el traidor, ante vosotros
function removeCulprit() {
  const P = S.plot;
  if (P.truth.quien === 'agent') { const a = P.agent && S.agents.find((x) => x.id === P.agent.id); if (a && plotHooks.dismiss) plotHooks.dismiss(a); }
  else P.gone = P.truth.quien;
}
export function plotFate(f) {
  const P = S.plot;
  P.fate = f;
  const who = suspectName(P.truth.quien);
  let txt;
  if (f === 'kgb') { removeCulprit(); addRep(S, 'kgb', 15); S.rub += 400; txt = `${who} sale del Puesto esposado, en un Volga negro. El KGB paga 400 ₽ y os lo agradece.`; }
  if (f === 'doble') { P.double = 1; txt = `${who} seguirá enviando mensajes… los que vosotros escribáis. ${BENEFICIARIES[P.truth.para].name} recibirá información falsa y sus ofensivas no os encontrarán desprevenidos.`; for (const c of remaining('donde')) { P.found.push({ id: c.id, src: 'inicio', day: S.day }); P.fresh++; } }
  if (f === 'perdon') { removeCulprit(); trust(4); for (const a of S.agents) addStress(a, -5); txt = `${who} recoge sus cosas de madrugada y se va sin despedirse. Nadie fuera del Puesto sabrá nunca lo que pasó.`; }
  addMessage(txt); chronicle(`Caso «${P.code}»: ${txt}`);
  return txt;
}
// el sustituto del personal que se ha ido
export function staffGone(id) { return !!(S.plot && S.plot.gone === id); }

// líneas del epílogo según el caso
export function plotEpilogue() {
  const P = S.plot;
  if (!P || !P.on) return [];
  if (!P.solved.quien) return [`El caso «${P.code}» nunca se cerró. Alguien del Puesto siguió hablando con ${BENEFICIARIES[P.truth.para].short} hasta el final.`];
  const who = suspectName(P.truth.quien);
  return [P.fate === 'kgb' ? `${who} pasó diez años en un campo de Mordovia.` : P.fate === 'doble' ? `${who} siguió mandando mensajes falsos hasta el último día. Nadie sabe para quién trabajaba de verdad al final.` : P.fate === 'perdon' ? `${who} vive en un pueblo cerca de Gomel con otro nombre.` : `${who} desapareció sin dejar rastro.`];
}

// ---------------------------------------------------------------- diálogos (se fusionan con data/dialogs.js)
export const PLOT_DIALOGS = {
  plot_intro: {
    title: 'UN TOPO EN EL PUESTO', speaker: 'Comisario Zhdánov', color: '#e05050',
    nodes: { start: {
      text: () => `El Comisario cierra la puerta con llave y baja la voz: «Moscú ha interceptado un mensaje cifrado que sale de aquí, del Puesto. Alguien vende lo que hacemos. El caso se llama «${S.plot.code}». No me fío de nadie… ni siquiera de mí mismo, camarada director, así que investigue usted.»<br><br>Os entrega una carpeta con los expedientes de todo el personal${S.plot.agent ? ` y de ${S.plot.agent.name}` : ''}. Dentro hay una primera pista.<br><br><span class="dimt">Las pistas aparecerán en la Zona (papeles con el membrete del Puesto), en interrogatorios, en la radio, en los informes de inteligencia y en las propias filtraciones. Unidlas en el <b>TABLERO DE CORCHO</b> del ARCHIVO.</span>`,
      opts: [{ label: 'ABRIR EL CASO', cls: 'good' }],
    } },
  },
  plot_traitor: {
    title: 'CARA A CARA', speaker: 'El culpable', color: '#ff6a6a',
    nodes: { start: {
      text: () => {
        const P = S.plot; const who = suspectName(P.truth.quien);
        const gone = P.truth.quien === 'agent' && P.agent && !S.agents.some((a) => a.id === P.agent.id);
        if (gone) return `Era ${who}. Ya no está entre vosotros: el expediente se cierra con su nombre y nada más.`;
        const mot = P.solved.porque ? ` Sabéis por qué: ${MOTIVES[P.truth.porque].name.toLowerCase()}.` : '';
        return `${who} no lo niega. Se sienta, enciende un cigarrillo (o no) y os mira: «¿Y ahora qué?».${mot}<br><br><span class="dimt">Convertirlo en agente doble exige saber por qué lo hace.</span>`;
      },
      opts: [
        { label: 'ENTREGARLO AL KGB (+400 ₽, REPUTACIÓN CON EL KGB)', cls: 'bad', show: { test: () => !plotCulpritGone() }, effects: [{ run: () => plotFate('kgb') }] },
        { label: 'CONVERTIRLO EN AGENTE DOBLE', cls: 'cyan', show: { test: () => !plotCulpritGone() }, cond: { test: () => !!S.plot.solved.porque }, hint: 'necesitáis saber POR QUÉ lo hace', effects: [{ run: () => plotFate('doble') }] },
        { label: 'DEJARLO MARCHAR EN SILENCIO', cls: 'good', show: { test: () => !plotCulpritGone() }, effects: [{ run: () => plotFate('perdon') }] },
        { label: 'CERRAR EL EXPEDIENTE', show: { test: () => plotCulpritGone() }, effects: [{ run: () => { S.plot.fate = 'muerto'; } }] },
      ],
    } },
  },
};
export const plotCulpritGone = () => { const P = S.plot; return P.truth.quien === 'agent' && P.agent && !S.agents.some((a) => a.id === P.agent.id); };
export { SOURCES, QUESTIONS };
