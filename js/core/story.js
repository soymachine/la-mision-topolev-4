// Narrativa y moral de la campaña (fase 20): actos, confianza de Topolev, crónica, comedor, cartas,
// epitafios, afinidad entre agentes, estrés y encargos.
import { S, addMessage } from './state.js';
import { saveLegacy } from './modes.js';
import { checkAchievements } from './achievements.js';
import { ITEMS } from '../data/items.js';
import { MAPS, mapIndex, zoneOpen, openCount } from '../data/world.js';
import { SCENES, ENDINGS, STAFF, COMEDOR, LETTERS_FROM, EPITAPHS, LAST_LETTERS, ACTS } from '../data/story.js';
import { FACTIONS, addRep, repOf } from '../data/factions.js';
import { createItem } from './items.js';
import { NOTES, COLLECTIONS } from '../data/lore.js';
import { rng } from '../util/rng.js';
import { MODIFIERS, rollZoneMods } from '../data/modifiers.js';
import { JOB_TYPES } from '../data/jobs.js';
import { plotEpilogue, staffGone } from './plot.js';
import { ENEMIES } from '../data/enemies.js';

const pick = (l) => l[Math.floor(Math.random() * l.length)];

// ---------------------------------------------------------------- estado
export function storyDefaults(d) {
  if (d.act == null) d.act = 0;
  if (d.trust == null) d.trust = 50;
  d.chronicle = d.chronicle || [];
  d.affinity = d.affinity || {};
  d.pendingScenes = d.pendingScenes || [];
  d.contracts = d.contracts || { active: [], done: [], offers: null, offersDay: 0 };
  d.contracts.jobDefs = d.contracts.jobDefs || {};
  registerJobs(d);
  d.notesRead = d.notesRead || {};
  d.colsDone = d.colsDone || {};
  d.comedor = d.comedor || [];
  for (const a of d.agents || []) if (a.stress == null) a.stress = 0;
}

// ---------------------------------------------------------------- crónica del director (exportable)
export function chronicle(text) {
  S.chronicle = S.chronicle || [];
  S.chronicle.push({ day: S.day, text });
  if (S.chronicle.length > 400) S.chronicle.splice(0, S.chronicle.length - 400);
}
export function chronicleText() {
  const date = (d) => new Date(1986, 4, 1 + d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const head = `CRÓNICA DEL DIRECTOR · PUESTO PRIPYAT-7\n${'═'.repeat(48)}\n${ACTS[S.act] ? ACTS[S.act].name : ''}\nDía ${S.day}. Agentes: ${S.agents.length}. Caídos: ${S.fallen.length}. Esencia total: ${S.stats.essTotal}.\n\n`;
  return head + S.chronicle.map((c) => `[Día ${c.day} · ${date(c.day)}] ${c.text}`).join('\n') + (S.ending ? `\n\nFINAL: ${ENDINGS[S.ending].name}.\n` : '\n');
}

// ---------------------------------------------------------------- confianza del Dr. Topolev (0–100)
export function trust(n, why) {
  const before = S.trust ?? 50;
  S.trust = Math.max(0, Math.min(100, Math.round(before + n)));
  if (why && Math.abs(n) >= 4) addMessage(`${n > 0 ? 'Topolev confía más en vosotros' : 'Topolev confía menos en vosotros'}: ${why} (${S.trust}/100).`);
  return S.trust;
}
export const trustLevel = (v = S.trust) => (v >= 75 ? 'Plena confianza' : v >= 55 ? 'Confía' : v >= 35 ? 'Recelo' : 'Desconfianza');

// ---------------------------------------------------------------- actos y escenas
export function queueScene(id) { (S.pendingScenes = S.pendingScenes || []).push(id); }
export function sceneDef(id) {
  if (id.startsWith('end:')) {
    const E = ENDINGS[id.slice(4)];
    return { title: `FINAL · ${E.name.toUpperCase()}`, art: E.art, color: E.color, lines: [...E.lines, ...(S.endingLines || [])] };
  }
  return SCENES[id] || null;
}
const totalCleared = () => Object.values(S.cleared || {}).reduce((a, b) => a + (b > 0 ? 1 : 0), 0);
export function checkActs() {
  if (S.flags && S.flags.noStory) return; // fase 24.7: modo libre, sin actos ni finales
  if (!S.act) { S.act = 1; queueScene('act1'); chronicle('Comienza el Acto I: «El Bloque». Llegada al Puesto Pripyat-7.'); }
  const foreign = Object.keys(S.met || {}).some((f) => f !== 'rda');
  if (S.act === 1 && ((foreign && totalCleared() >= 2) || openCount(S) >= 8 || (S.cleared.metro2 || 0) > 0)) {
    S.act = 2; queueScene('act2'); chronicle('Comienza el Acto II: «Los otros». La Zona se llena de expediciones extranjeras.');
  }
  if (S.act === 2 && (S.flags.topolevPast || (S.cleared.objeto7 || 0) > 0 || (S.cleared.raices || 0) > 0)) {
    S.act = 3; queueScene('act3'); chronicle('Comienza el Acto III: «El corazón». El pasado del doctor sale a la luz.');
  }
  if (S.flags.topolevPast && !S.flags.pastScene) { S.flags.pastScene = 1; queueScene('past'); trust(-10, 'sabéis lo del Objeto 7'); }
  // final: al volver con vida del Útero de Corium
  // (si se aplaza, se vuelve a preguntar tras la siguiente extracción del Útero)
  if (!S.ending && (S.cleared.corium || 0) > (S.flags.finaleAsked || 0)) {
    S.flags.finaleAsked = S.cleared.corium;
    (S.pendingDialogs = S.pendingDialogs || []).push('finale');
  }
}
// epílogo según lo vivido
export function endGame(id) {
  S.ending = id;
  const L = [];
  if (S.flags.komitetSold) L.push('El Comité recordará que le vendisteis esencia en efectivo. Siempre lo recuerda todo.');
  if ((S.flags.survivorsSaved || 0) > 0) L.push(`${S.flags.survivorsSaved} superviviente(s) rescatados cuentan vuestra historia en voz baja.`);
  if ((S.flags.executions || 0) > 0) L.push('Algunos prisioneros nunca volvieron a casa. Eso tampoco se olvida.');
  if (S.fallen.length) L.push(`En el memorial de Pripyat-7 hay ${S.fallen.length} nombre(s). ${S.fallen.slice(0, 3).map((f) => f.name).join(', ')}${S.fallen.length > 3 ? '…' : ''}`);
  if (repOf(S, 'rda') >= 50) L.push('En Leipzig, un antiguo soldado de la NVA brinda cada 26 de abril por los soviéticos que le salvaron.');
  if (repOf(S, 'kgb') <= -25) L.push('Vuestro expediente en la Lubianka ocupa tres cajas. Nadie lo ha cerrado.');
  L.push(...plotEpilogue()); // fase 28: el caso del topo
  L.push(`Confianza final del Dr. Topolev: ${S.trust}/100.`);
  S.endingLines = L;
  queueScene('end:' + id);
  chronicle(`FINAL: ${ENDINGS[id].name}.`);
  saveLegacy(id); // fase 24.7: el legado para «1987»
  checkAchievements(); // fase 24.6: logros de los finales
}

// ---------------------------------------------------------------- personal de la base
export function staffLine(id) {
  const st = STAFF[id];
  if (!st || !st.lines) return null;
  const i = (S.day * 7 + id.length * 3) % st.lines.length;
  // fase 28: el personal descubierto y apartado tiene sustituto
  if (staffGone(id)) return { name: `Sustituto de ${st.name}`, role: st.role, color: '#9a9a9a', text: '«Mi predecesor ya no está. No pregunte, camarada.»' };
  return { name: st.name, role: st.role, color: st.color, text: st.lines[i] };
}

// ---------------------------------------------------------------- afinidad entre agentes (−100…+100)
const pairKey = (a, b) => (a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id);
export const affOf = (a, b) => (S.affinity && S.affinity[pairKey(a, b)]) || 0;
export function addAff(a, b, n) {
  if (!a || !b || a === b) return 0;
  S.affinity = S.affinity || {};
  const k = pairKey(a, b);
  S.affinity[k] = Math.max(-100, Math.min(100, (S.affinity[k] || 0) + n));
  return S.affinity[k];
}
export const affState = (v) => (v >= 70 ? 'inseparables' : v >= 30 ? 'camaradas' : v <= -30 ? 'rivales' : null);
export const AFF_TEXT = { inseparables: 'Inseparables', camaradas: 'Camaradas', rivales: 'Rivales' };
export function relationsOf(a) {
  const out = [];
  for (const b of S.agents) { if (b === a) continue; const v = affOf(a, b); const st = affState(v); if (st) out.push({ b, v, st }); }
  return out.sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
}

// ---------------------------------------------------------------- estrés (0–100)
export function addStress(a, n) { if (!a) return 0; if (n > 0 && S.research && S.research.r_psico) n *= 0.75; a.stress = Math.max(0, Math.min(100, Math.round(((a.stress || 0) + n) * 10) / 10)); return a.stress; }
export const stressLevel = (v) => (v >= 85 ? 'Al límite' : v >= 70 ? 'Muy alto' : v >= 45 ? 'Tenso' : v >= 20 ? 'Inquieto' : 'Sereno');

// ---------------------------------------------------------------- comedor, cartas y epitafios
const nameOf = (a) => (a ? a.nick : '');
function fill(t, v) { return t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)); }
// escena del comedor tras una expedición
export function comedorScene(rep) {
  const alive = S.agents.slice();
  if (!alive.length) return;
  const A = pick(alive), B = alive.length > 1 ? pick(alive.filter((x) => x !== A)) : null;
  const dead = (rep.agents || []).filter((r) => r.status !== 'extraído');
  let pool, vars = { a: nameOf(A), b: B ? nameOf(B) : 'Babai', z: rep.map };
  if (dead.length) { pool = COMEDOR.dead; vars.d = dead[0].name; }
  else {
    const rel = B ? affState(affOf(A, B)) : null;
    const stressed = alive.find((x) => (x.stress || 0) >= 60);
    if (stressed) { pool = COMEDOR.stressed; vars.a = nameOf(stressed); }
    else if (rel === 'rivales') pool = COMEDOR.rivals;
    else if (rel) pool = COMEDOR.friends;
    else pool = rep.result === 'success' ? COMEDOR.success : COMEDOR.quiet;
  }
  const text = fill(pick(pool), vars);
  S.comedor = [{ day: S.day, text }, ...(S.comedor || [])].slice(0, 6);
  // el comedor alivia un poco el estrés (más con el edificio)
  const k = 4 + ((S.modules && S.modules.comedor) || 0) * 3;
  for (const a of alive) addStress(a, -k);
}
export function familyLetter() {
  if (!S.agents.length) return null;
  const a = pick(S.agents);
  const L = pick(LETTERS_FROM);
  const text = fill(L.text, { Hijo: a.female ? 'Hija mía' : 'Hijo mío', PAPA: a.female ? 'MAMÁ' : 'PAPÁ' });
  addStress(a, -12);
  addMessage(`Correo para ${a.nick}, de ${L.from}: ${text}`);
  chronicle(`${a.nick} recibe una carta de ${L.from}.`);
  return a;
}
export function memorialEntry(f, a, zone) {
  const friends = S.agents.filter((b) => b !== a && affOf(a, b) >= 30);
  f.epitaph = fill(pick(EPITAPHS), { nick: a.nick, z: zone });
  f.letter = fill(pick(LAST_LETTERS), { friend: friends[0] ? friends[0].nick : 'quien la necesite' });
  return f;
}

// ---------------------------------------------------------------- colecciones de notas (fase 20.6)
export function collectionProgress(col) {
  const idx = NOTES.map((n, i) => (n.col === col ? i : -1)).filter((i) => i >= 0);
  return { read: idx.filter((i) => S.notesRead[i]).length, total: idx.length, idx };
}
// marca una nota como leída; si completa su colección, entrega la recompensa y devuelve el texto
export function markNoteRead(i) {
  S.notesRead = S.notesRead || {};
  if (S.notesRead[i]) return null;
  S.notesRead[i] = S.day;
  const col = NOTES[i] && NOTES[i].col;
  if (!col || S.colsDone[col]) return null;
  const p = collectionProgress(col);
  if (p.read < p.total) return null;
  S.colsDone[col] = S.day;
  const C = COLLECTIONS[col], r = C.reward, got = [];
  if (r.rub) { S.rub += r.rub; got.push(`${r.rub} ₽`); }
  if (r.ess) { S.ess += r.ess; got.push(`${r.ess} ✦`); }
  if (r.rep) { addRep(S, r.rep[0], r.rep[1]); got.push(`reputación ${FACTIONS[r.rep[0]].short} +${r.rep[1]}`); }
  if (r.trust) { trust(r.trust); got.push(`confianza de Topolev ${r.trust > 0 ? '+' : ''}${r.trust}`); }
  if (r.stress) { for (const a of S.agents) addStress(a, r.stress); got.push('el equipo respira más tranquilo'); }
  if (r.item) { const it = createItem(r.item, 4, rng); it.nm = r.nm; S.stash.push(it); got.push(`«${r.nm}» (al almacén)`); }
  const txt = `Colección completa: «${C.name}». ${got.join(', ')}.`;
  addMessage(txt);
  chronicle(txt);
  return txt;
}
// elige una nota no leída (para que las colecciones se puedan completar)
export function unreadNote(g = rng) {
  const un = NOTES.map((n, i) => i).filter((i) => !S.notesRead || !S.notesRead[i]);
  return un.length ? un[Math.floor(g.float(0, 1) * un.length)] : null;
}

// ---------------------------------------------------------------- encargos (fase 20.5)
// tipo: deliver (entregar un objeto del almacén), photo, capture, escort / sabotage / missing (en una zona)
export const CONTRACTS = {
  blackbox: { giver: 'zhdanov', name: 'La caja negra', desc: 'El Comité quiere la caja negra de un helicóptero estrellado. Traedla al almacén.', kind: 'deliver', item: 'blackbox', reward: { rub: 700, rep: ['kgb', 10], trust: 2 } },
  escort: { giver: 'suecia', name: 'Escolta a Forsmark', desc: 'Un dosimetrista sueco se ha perdido en Prípiat. Encontradlo y llevadlo vivo hasta una extracción.', kind: 'escort', zone: 'pripyat', reward: { rub: 450, rep: ['suecia', 18], item: ['rados', 'Dosímetro «Forsmark»'] } },
  photo_pastor: { giver: 'topolev', name: 'Retrato de un pastor', desc: 'Topolev necesita una fotografía del Pastor de Ceniza para su catálogo. Usad la cámara Zenit-E.', kind: 'photo', target: 'pastor', reward: { rub: 500, trust: 8, item: ['zenit', 'Zenit-E «del doctor»'] } },
  capture_wolf: { giver: 'topolev', name: 'Un lobo vivo', desc: 'Capturad vivo un Lobo de grafito (jaula de captura) y traedlo a la base.', kind: 'capture', target: 'lobo', reward: { rub: 400, trust: 6, ess: 40 } },
  sabotage: { giver: 'zhdanov', name: 'Sabotaje en «Fénix»', desc: 'Colocad una carga en el centro de mando de la estación «Fénix» (F junto a la consola marcada) y salid con vida.', kind: 'sabotage', zone: 'fenix', reward: { rub: 1500, rep: ['kgb', 15], item: ['svd', 'SVD «Zhdánov»'] } },
  missing: { giver: 'orlova', name: 'El agente desaparecido', desc: 'Un cabo del Puesto lleva días desaparecido, pero su radiobaliza sigue emitiendo. Encontradlo y traedlo de vuelta.', kind: 'missing', reward: { rub: 200, trust: 5 } },
  wismut_samples: { giver: 'rda', name: 'Muestras para Wismut', desc: 'La RDA paga bien por 3 muestras de grafito.', kind: 'deliver', item: 'graphsample', n: 3, reward: { rub: 450, rep: ['rda', 12] } },
  cuba_meds: { giver: 'cuba', name: 'Medicinas para Kiev', desc: 'La Brigada «Playa Girón» necesita 2 botiquines AI-2 para el hospital de Kiev.', kind: 'deliver', item: 'ai2', n: 2, reward: { rub: 200, rep: ['cuba', 15], item: ['gironkit', 'Botiquín de la doctora Pérez'] } },
  kravets_intel: { giver: 'kravets', name: 'Papeles para la trastienda', desc: 'El sargento Kravets tiene un comprador para 2 informes de inteligencia occidental. Sin preguntas.', kind: 'deliver', item: 'intel', n: 2, reward: { rub: 1100, rep: ['kgb', -8] } },
};
// encargos especiales (fase 16.4): uno al día, ligado a un modificador de zona de ese día y válido solo hoy.
// activate: rearmar/usar el objeto marcado · retrieve: coger el objeto marcado y sacarlo de la zona
// kills / essence: abatir o recoger tanto en una sola salida · pulse: aguantar el pulso del reactor y salir vivos
export const SPECIALS = {
  apagon: { giver: 'zhdanov', name: 'Luz en el apagón', kind: 'activate', label: 'Cuadro eléctrico de emergencia', act: 'rearma el cuadro eléctrico: las luces de emergencia parpadean y vuelven', desc: 'Con la zona a oscuras, el Comité quiere rearmado el cuadro eléctrico de emergencia (marcado en el radar). Buscadlo a tientas.', reward: { rub: 320, rep: ['kgb', 4] } },
  inundacion: { giver: 'topolev', name: 'Agua de la crecida', kind: 'activate', label: 'Punto de muestreo', act: 'llena tres frascos de agua de la crecida', desc: 'Topolev quiere muestras del agua de la crecida antes de que baje. El punto de muestreo está marcado en el radar.', reward: { rub: 220, ess: 25, trust: 3 } },
  tormenta: { giver: 'topolev', name: 'Ojos en la tormenta', kind: 'retrieve', label: 'Registrador de campo', item: 'Registrador «Tormenta»', desc: 'Un registrador de campo lleva días grabando la tormenta electromagnética. Recuperadlo y sacadlo de la zona. Sin radar: habrá que encontrarlo a ojo.', reward: { rub: 380, ess: 20, trust: 3 } },
  esporas: { giver: 'orlova', name: 'Un esporangio intacto', kind: 'retrieve', label: 'Esporangio intacto', item: 'Esporangio en un frasco', desc: 'La Dra. Orlova necesita un esporangio intacto para preparar un antídoto. Hay uno marcado en el radar; traedlo sin romperlo.', reward: { rub: 300, ess: 20 } },
  inquietos: { giver: 'zhdanov', name: 'Escarmiento', kind: 'kills', n: 12, desc: 'Con los nidos despiertos, el Comisario quiere un escarmiento: abatid 12 chebylitas en una sola salida y volved para contarlo.', reward: { rub: 420, rep: ['kgb', 5] } },
  vetamadre: { giver: 'topolev', name: 'La veta madre', kind: 'essence', n: 120, desc: 'Hoy la veta madre aflora. Recoged al menos 120 ✦ en una sola salida y volved con ellos.', reward: { rub: 200, ess: 40, trust: 4 } },
  extranjeros: { giver: 'kgb', name: 'El buzón muerto', kind: 'retrieve', label: 'Buzón muerto', item: 'Microfilm de un buzón muerto', desc: 'El KGB sabe que una expedición extranjera usa un buzón muerto en esta zona. Traed el microfilm antes de que lo recojan ellos.', reward: { rub: 600, rep: ['kgb', 8] } },
  lluvia: { giver: 'topolev', name: 'Lluvia negra', kind: 'activate', label: 'Pluviómetro', act: 'vacía el pluviómetro en un frasco de plomo: el agua está tibia y brilla', desc: 'Topolev quiere medir la lluvia radiactiva de hoy. El pluviómetro está marcado en el radar.', reward: { rub: 260, ess: 30 } },
  niebla: { giver: 'orlova', name: 'Perdidos en la niebla', kind: 'retrieve', label: 'Mochila de la patrulla', item: 'Mochila con los registros de dosis', desc: 'Una patrulla de liquidadores se perdió en la niebla y dejó atrás su mochila con los registros de dosis. Orlova la necesita.', reward: { rub: 280, ess: 15 } },
  pulso: { giver: 'topolev', name: 'Lecturas del pulso', kind: 'pulse', wait: 15, desc: 'Quedaos en la zona hasta que llegue el pulso del reactor (y 15 turnos más) para que los dosímetros lo registren. Después, salid vivos.', reward: { rub: 500, ess: 50, trust: 5 } },
  helada: { giver: 'babai', name: 'Bajo el hielo', kind: 'retrieve', label: 'Camión atrapado en el hielo', item: 'Caja de repuestos congelada', desc: 'Babai sabe de un camión de repuestos atrapado por la helada. Romped el hielo y traed la caja.', reward: { rub: 300, ess: 15 } },
};
for (const [m, d] of Object.entries(SPECIALS)) CONTRACTS['sp_' + m] = { ...d, special: m };
export const GIVER_NAME = (g) => (STAFF[g] ? STAFF[g].name : FACTIONS[g] ? FACTIONS[g].name : g);
// ofertas del día (3 al azar entre las disponibles)
export function contractOffers() {
  const C = S.contracts;
  if (C.offers && C.offersDay === S.day) return C.offers;
  const busy = new Set([...C.active.map((c) => c.id), ...C.done]);
  const pool = Object.keys(CONTRACTS).filter((id) => !CONTRACTS[id].special && !CONTRACTS[id].job && !busy.has(id) && contractAvailable(id));
  const offers = [];
  while (offers.length < 3 && pool.length) offers.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  C.offers = offers; C.offersDay = S.day;
  return offers;
}
function contractAvailable(id) {
  const c = CONTRACTS[id];
  if (c.zone && !zoneOpen(S, mapIndex(c.zone))) return false;
  if (FACTIONS[c.giver] && repOf(S, c.giver) < 0) return false;
  return true;
}
export function acceptContract(id) {
  const C = S.contracts;
  if (CONTRACTS[id].special) return acceptSpecial();
  if (C.active.filter((c) => !c.special && !c.job).length >= 3) return { ok: false, msg: 'Ya tenéis 3 encargos en marcha.' };
  const c = { id, day: S.day };
  if (CONTRACTS[id].kind === 'missing') {
    const open = MAPS.filter((m, i) => zoneOpen(S, i) && m.id !== 'wismut');
    c.zone = (open[Math.floor(Math.random() * open.length)] || MAPS[0]).id;
    c.who = pick(['Pável Sidorenko', 'Yelena Morózova', 'Bogdán Karpenko', 'Zoya Lébedeva']);
  }
  C.active.push(c);
  C.offers = (C.offers || []).filter((x) => x !== id);
  chronicle(`Encargo aceptado: «${CONTRACTS[id].name}» (${GIVER_NAME(CONTRACTS[id].giver)}).`);
  return { ok: true };
}
// ---------------------------------------------------------------- bolsa de trabajo (revisión tras la fase 24)
// encargos repetibles generados cada día (data/jobs.js). Sus definiciones se guardan en S.contracts.jobDefs y se
// registran en CONTRACTS para que el resto del código (expedición, base) los trate como cualquier otro encargo.
export const JOB_MAX = 3;
function registerJobs(d) { for (const [id, def] of Object.entries((d.contracts && d.contracts.jobDefs) || {})) CONTRACTS[id] = def; }
export function jobOffers() {
  const C = S.contracts;
  if (C.jobOffers && C.jobOffersDay === S.day) return C.jobOffers;
  const zones = MAPS.filter((m, i) => zoneOpen(S, i) && !m.social);
  const seen = Object.keys(S.bestiary || {}).filter((id) => ENEMIES[id]);
  const ctx = { zones, seen };
  const types = Object.entries(JOB_TYPES).filter(([, T]) => zones.length && (!T.needs || T.needs(ctx)));
  const offers = [];
  const g = () => Math.random();
  for (let n = 0; n < 4 && types.length; n++) {
    const tot = types.reduce((a, [, T]) => a + T.weight, 0);
    let r = g() * tot, k = 0;
    while (r > types[k][1].weight) { r -= types[k][1].weight; k++; }
    const [type, T] = types.splice(k, 1)[0];
    const def = T.make(g, ctx);
    offers.push({ ...def, job: type, id: `job_${type}_${S.day}_${Math.floor(Math.random() * 1e6)}` });
  }
  C.jobOffers = offers; C.jobOffersDay = S.day;
  return offers;
}
export function acceptJob(id) {
  const C = S.contracts;
  const def = (C.jobOffers || []).find((o) => o.id === id);
  if (!def) return { ok: false, msg: 'Esa oferta ya no está.' };
  if (C.active.filter((c) => c.job).length >= JOB_MAX) return { ok: false, msg: `Ya tenéis ${JOB_MAX} trabajos de la bolsa en marcha.` };
  C.jobDefs[id] = def; CONTRACTS[id] = def;
  const c = { id, day: S.day, job: 1 };
  if (def.kind === 'killglobal') c.base = ((S.stats || {}).killsBy || {})[def.target] || 0;
  if (def.kind === 'photos') c.base = Object.keys(S.photos || {}).length;
  if (def.kind === 'courier') { const it = createItem('objcase', 0, rng); it.nm = def.item; it.contract = id; S.stash.push(it); }
  C.active.push(c);
  C.jobOffers = C.jobOffers.filter((o) => o.id !== id);
  chronicle(`Trabajo aceptado: «${def.name}» (${GIVER_NAME(def.giver)}).`);
  return { ok: true };
}
// progreso legible de un encargo (para la base)
export function contractProgress(c) {
  const d = CONTRACTS[c.id];
  if (!d) return '';
  if (d.kind === 'killglobal') return `${Math.min(d.n, (((S.stats || {}).killsBy || {})[d.target] || 0) - (c.base || 0))}/${d.n} abatidos`;
  if (d.kind === 'essdeliver') return `${Math.min(S.ess, d.n)}/${d.n} ✦ en reserva`;
  if (d.kind === 'deliver') return `${Math.min(d.n || 1, S.stash.filter((it) => it.b === d.item).reduce((k, it) => k + (it.q || 1), 0))}/${d.n || 1} en el almacén`;
  if (d.kind === 'photos') return `${Math.min(d.n, Object.keys(S.photos || {}).length - (c.base || 0))}/${d.n} fotos`;
  return '';
}
export function contractZone(c) { return c.zone || CONTRACTS[c.id].zone || null; }
// ¿se ha cumplido? (en la base, tras cada expedición)
export function contractMet(c) {
  const d = CONTRACTS[c.id];
  const has = (b, n = 1, sp = null) => S.stash.filter((it) => it.b === b && (!sp || it.species === sp)).reduce((k, it) => k + (it.q || 1), 0) >= n;
  if (d.kind === 'deliver') return has(d.item, d.n || 1);
  if (d.kind === 'photo') return !!(S.photos && S.photos[d.target]);
  if (d.kind === 'capture') return has('cagefull', 1, d.target);
  // bolsa de trabajo: los que se cumplen en la base
  if (d.kind === 'killglobal') return (((S.stats || {}).killsBy || {})[d.target] || 0) - (c.base || 0) >= d.n;
  if (d.kind === 'essdeliver') return S.ess >= d.n;
  if (d.kind === 'photos') return Object.keys(S.photos || {}).length - (c.base || 0) >= d.n;
  return !!c.done;
}
export function completeContracts() {
  const C = S.contracts;
  const done = [];
  for (const c of [...C.active]) {
    if (!contractMet(c)) continue;
    const d = CONTRACTS[c.id];
    // retirar lo entregado
    if (d.kind === 'deliver' || d.kind === 'capture') {
      let need = d.kind === 'capture' ? 1 : d.n || 1;
      for (const it of [...S.stash]) {
        if (need <= 0) break;
        if (it.b !== (d.kind === 'capture' ? 'cagefull' : d.item) || (d.kind === 'capture' && it.species !== d.target)) continue;
        const mv = Math.min(it.q || 1, need); need -= mv;
        if (it.q > mv) it.q -= mv; else S.stash.splice(S.stash.indexOf(it), 1);
      }
    }
    if (d.kind === 'essdeliver') S.ess -= d.n;
    if (d.job) { delete C.jobDefs[c.id]; C.jobsDone = (C.jobsDone || 0) + 1; }
    const r = c.reward || d.reward;
    const got = [];
    if (d.special) dropObjective(c.id);
    if (r.rub) { S.rub += r.rub; got.push(`${r.rub} ₽`); }
    if (r.ess) { S.ess += r.ess; got.push(`${r.ess} ✦`); }
    if (r.rep) { addRep(S, r.rep[0], r.rep[1]); got.push(`reputación ${FACTIONS[r.rep[0]].short} ${r.rep[1] > 0 ? '+' : ''}${r.rep[1]}`); }
    if (r.trust) { trust(r.trust); got.push(`confianza de Topolev +${r.trust}`); }
    if (r.item) { const it = createItem(r.item[0], 4, rng); it.nm = r.item[1]; S.stash.push(it); got.push(`«${r.item[1]}»`); }
    C.active.splice(C.active.indexOf(c), 1);
    if (d.special) C.specialsDone = (C.specialsDone || 0) + 1; else if (!d.job) C.done.push(c.id);
    addMessage(`Encargo cumplido: «${d.name}». ${GIVER_NAME(d.giver)} os entrega ${got.join(', ')}.`);
    chronicle(`Encargo cumplido: «${d.name}».`);
    done.push(d.name);
  }
  return done;
}
export function dropContract(id) {
  const C = S.contracts;
  const i = C.active.findIndex((c) => c.id === id);
  if (i < 0) return;
  C.active.splice(i, 1);
  const d = CONTRACTS[id];
  if (d.special) { dropObjective(id); return; } // sin penalización: era solo para hoy
  if (d.job) { delete C.jobDefs[id]; for (const it of [...S.stash]) if (it.contract === id) S.stash.splice(S.stash.indexOf(it), 1); return; } // bolsa de trabajo: sin penalización
  if (d.giver === 'topolev') trust(-4, 'abandonáis su encargo');
  if (FACTIONS[d.giver]) addRep(S, d.giver, -5);
}

// ---------------------------------------------------------------- encargos especiales (fase 16.4)
const todayMods = (i) => (S.forceMods ? [...S.forceMods] : rollZoneMods(S.created >>> 0, S.day, i));
export const specialZone = (c) => MAPS[mapIndex(c.zone)];
// la oferta especial del día: una zona abierta con un modificador que tenga encargo (se decide una vez al día)
export function specialOffer() {
  const C = S.contracts;
  if (C.special && C.special.day === S.day) return C.special.id ? C.special : null;
  const cands = [];
  MAPS.forEach((m, i) => {
    if (m.social || !zoneOpen(S, i)) return;
    for (const mod of todayMods(i)) if (SPECIALS[mod] && contractAvailable('sp_' + mod)) cands.push({ zone: m.id, mod });
  });
  const ch = cands.length ? pick(cands) : null;
  C.special = ch ? { day: S.day, id: 'sp_' + ch.mod, mod: ch.mod, zone: ch.zone, reward: specialReward(ch.mod, ch.zone) } : { day: S.day, id: null };
  return C.special.id ? C.special : null;
}
// la recompensa crece con el nivel de la zona
export function specialReward(mod, zone) {
  const r = { ...SPECIALS[mod].reward };
  const k = 1 + 0.1 * (MAPS[mapIndex(zone)].lvl[1] - 1);
  if (r.rub) r.rub = Math.round(r.rub * k / 10) * 10;
  if (r.ess) r.ess = Math.round(r.ess * k);
  return r;
}
function acceptSpecial() {
  const C = S.contracts;
  const sp = specialOffer();
  if (!sp) return { ok: false, msg: 'Hoy no hay encargo especial.' };
  if (C.active.some((c) => c.special)) return { ok: false, msg: 'Ya tenéis un encargo especial en marcha.' };
  C.active.push({ id: sp.id, day: S.day, special: sp.mod, zone: sp.zone, reward: sp.reward });
  C.special = { day: S.day, id: null }; // aceptado: ya no se ofrece
  chronicle(`Encargo especial aceptado: «${CONTRACTS[sp.id].name}» en ${specialZone(sp).name} (${MODIFIERS[sp.mod].name}).`);
  return { ok: true };
}
// al pasar el día, los especiales sin cumplir caducan
export function expireSpecials() {
  const C = S.contracts;
  for (const c of [...C.active]) {
    if (!c.special || c.day >= S.day) continue;
    C.active.splice(C.active.indexOf(c), 1);
    dropObjective(c.id);
    addMessage(`Encargo especial «${CONTRACTS[c.id].name}» caducado: ${specialZone(c).name} ya no está como ayer.`);
  }
}
// retira los objetos de encargo que queden en el almacén y las mochilas
function dropObjective(id) {
  const keep = (it) => !(it && it.contract === id);
  S.stash = S.stash.filter(keep);
  for (const a of S.agents) a.bag = a.bag.filter(keep);
}
