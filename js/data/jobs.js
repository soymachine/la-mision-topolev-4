// Bolsa de trabajo (revisión tras la fase 24): encargos repetibles que se generan cada día con zona, cantidad y paga
// según el nivel de la zona. Cada plantilla devuelve una definición de encargo (la misma forma que CONTRACTS):
// { kind, name, desc, giver, zone?, n?, target?, item?, label?, reward: { rub, ess?, rep?, trust? } }
// Tipos de cumplimiento:
// - en la zona (marca el encargo en la expedición y hay que salir vivos): beacons, measure, killzone, survey, nests,
//   bounty, deep, retrieve (cargamento), courier, noloss, speedrun
// - en la base, al volver: killglobal, essdeliver, deliver, photos, capture
import { ENEMIES } from './enemies.js';
import { ITEMS } from './items.js';

const pick = (g, l) => l[Math.floor(g() * l.length)];
const int = (g, a, b) => a + Math.floor(g() * (b - a + 1));
// paga base × nivel de la zona; redondeada a 10
const pay = (base, lvl) => Math.round((base * (1 + lvl * 0.35)) / 10) * 10;
const lvlOf = (m) => (m.lvl[0] + m.lvl[1]) / 2;
const zoneName = (m) => m.name;

// cada plantilla: weight (frecuencia), needs (zonas abiertas, especies vistas…) y make(g, ctx) → definición
// ctx: { zones: [MAPS abiertos], seen: [ids de chebylitas avistados], kills: S.stats.killsBy }
export const JOB_TYPES = {
  // --- propuestas del director ---
  beacons: { weight: 3, make(g, { zones }) {
    const m = pick(g, zones), n = int(g, 2, 4);
    return { kind: 'beacons', zone: m.id, n, giver: 'topolev', label: 'Punto topográfico', name: `Balizas topográficas (${n})`, desc: `Colocad ${n} balizas de radio en los puntos topográficos marcados de ${zoneName(m)} (F junto a cada uno) y volved vivos. Topolev quiere cartografiar la zona.`, reward: { rub: pay(150 + n * 60, lvlOf(m)), trust: 1 } };
  } },
  killzone: { weight: 3, make(g, { zones }) {
    const m = pick(g, zones), n = int(g, 8, 18);
    return { kind: 'killzone', zone: m.id, n, giver: 'zhdanov', name: `Limpieza en ${m.short || m.name}`, desc: `Abatid ${n} chebylitas en ${zoneName(m)} en una sola salida y volved para contarlo.`, reward: { rub: pay(120 + n * 18, lvlOf(m)), rep: ['kgb', 3] } };
  } },
  killglobal: { weight: 2, needs: ({ seen }) => seen.length > 0, make(g, { seen }) {
    const t = pick(g, seen.filter((id) => !ENEMIES[id].boss)), n = int(g, 10, 25);
    return { kind: 'killglobal', target: t, n, giver: 'zhdanov', name: `Plan de exterminio: ${ENEMIES[t].name}`, desc: `El Comité ha fijado una cuota: ${n} ${ENEMIES[t].name} abatidos, en las expediciones que hagan falta. Cuenta desde que aceptéis.`, reward: { rub: pay(200 + n * 22, ENEMIES[t].minL), rep: ['kgb', 4] } };
  } },
  // --- doce más ---
  measure: { weight: 2, make(g, { zones }) {
    const m = pick(g, zones), n = int(g, 2, 3);
    return { kind: 'measure', zone: m.id, n, giver: 'orlova', label: 'Punto de dosimetría', name: `Dosimetría de campo (${n})`, desc: `La Dra. Orlova necesita lecturas en ${n} puntos calientes de ${zoneName(m)} (marcados en el radar; F para medir). Cuidado con la dosis.`, reward: { rub: pay(160 + n * 70, lvlOf(m)), ess: 10 } };
  } },
  survey: { weight: 2, make(g, { zones }) {
    const m = pick(g, zones), n = pick(g, [40, 50, 60]);
    return { kind: 'survey', zone: m.id, n, giver: 'topolev', name: `Reconocimiento de ${m.short || m.name}`, desc: `Explorad al menos el ${n}% de ${zoneName(m)} (piso superior) en una salida. El Instituto pagará los planos.`, reward: { rub: pay(240 + n * 4, lvlOf(m)), trust: 2 } };
  } },
  nests: { weight: 2, make(g, { zones }) {
    const m = pick(g, zones), n = int(g, 2, 3);
    return { kind: 'nests', zone: m.id, n, giver: 'babai', name: `Desratización (${n} nidos)`, desc: `Babai quiere despejar el camino de sus camiones: acabad con ${n} nidos de ${zoneName(m)} en una salida.`, reward: { rub: pay(180 + n * 110, lvlOf(m)) } };
  } },
  bounty: { weight: 2, make(g, { zones }) {
    const m = pick(g, zones);
    const name = pick(g, ['Cicatriz', 'el Tuerto', 'Medianoche', 'la Viuda', 'Herrumbre', 'el Sargento']);
    return { kind: 'bounty', zone: m.id, giver: 'kravets', label: name, name: `Recompensa: «${name}»`, desc: `Un chebylita élite al que llaman «${name}» ronda ${zoneName(m)}. Kravets paga por su cabeza (la radio lo sitúa en el mapa).`, reward: { rub: pay(420, lvlOf(m)), ess: 20 } };
  } },
  deep: { weight: 1, needs: ({ zones }) => zones.some((m) => (m.floors || 1) > 1), make(g, { zones }) {
    const m = pick(g, zones.filter((z) => (z.floors || 1) > 1));
    return { kind: 'deep', zone: m.id, n: (m.floors || 2) - 1, giver: 'topolev', name: `Muestras del fondo de ${m.short || m.name}`, desc: `Bajad hasta el piso más profundo de ${zoneName(m)} (−${(m.floors || 2) - 1}) y volved con vida: los sensores del montacargas hacen el resto.`, reward: { rub: pay(380, lvlOf(m) + 1), ess: 25, trust: 2 } };
  } },
  retrieve: { weight: 2, make(g, { zones }) {
    const m = pick(g, zones);
    const what = pick(g, [['Caja de vodka de contrabando', 'babai'], ['Maletín del ingeniero jefe', 'topolev'], ['Archivador del Partido', 'zhdanov'], ['Nevera de muestras', 'orlova'], ['Caja fuerte de la cantina', 'kravets']]);
    return { kind: 'retrieve', zone: m.id, giver: what[1], label: what[0], item: what[0], name: `Recuperar: ${what[0].toLowerCase()}`, desc: `Hay ${what[0].toLowerCase()} en ${zoneName(m)} (marcado en el radar). Cogedlo y sacadlo de la zona.`, reward: { rub: pay(300, lvlOf(m)) } };
  } },
  courier: { weight: 2, make(g, { zones }) {
    const m = pick(g, zones);
    return { kind: 'courier', zone: m.id, giver: 'kgb', label: 'Buzón muerto', item: 'Paquete sellado del KGB', name: `Correo para el buzón muerto`, desc: `Llevad el paquete sellado (lo tenéis en el almacén) al buzón muerto de ${zoneName(m)} y dejadlo allí (F). Sin abrirlo. Sin preguntas.`, reward: { rub: pay(340, lvlOf(m)), rep: ['kgb', 6] } };
  } },
  noloss: { weight: 1, make(g, { zones }) {
    const m = pick(g, zones);
    return { kind: 'noloss', zone: m.id, giver: 'orlova', name: `Nadie se queda atrás`, desc: `Volved de ${zoneName(m)} con todo el escuadrón con vida. La enfermería paga una prima por cada expedición sin bajas.`, reward: { rub: pay(260, lvlOf(m)), trust: 2 } };
  } },
  speedrun: { weight: 1, make(g, { zones }) {
    const m = pick(g, zones), n = pick(g, [80, 100, 120]);
    return { kind: 'speedrun', zone: m.id, n, giver: 'zhdanov', name: `Relámpago en ${m.short || m.name}`, desc: `Una inspección de Moscú quiere ver «iniciativa». Entrad en ${zoneName(m)} y salid por una extracción antes de ${n} turnos.`, reward: { rub: pay(300, lvlOf(m)) } };
  } },
  essdeliver: { weight: 2, make(g, { zones }) {
    const n = pick(g, [40, 60, 80, 100, 150]);
    return { kind: 'essdeliver', n, giver: 'kravets', name: `Esencia para el Instituto Kurchátov`, desc: `Un comprador de Moscú paga en efectivo por ${n} ✦ de esencia de vuestras reservas. Mejor precio que la cuota… si os sobra.`, reward: { rub: Math.round(n * 6.5 / 10) * 10 } };
  } },
  deliver: { weight: 2, make(g) {
    const opts = [['chatarra', 6, 'babai', 'Chatarra para el koljós'], ['graphsample', 2, 'rda', 'Grafito para Wismut'], ['vodka', 3, 'kravets', 'Vodka para la cantina'], ['bandage', 6, 'cuba', 'Vendas para Kiev'], ['antirad', 4, 'orlova', 'Yoduro para la enfermería']].filter(([b]) => ITEMS[b]);
    const [b, n, giver, name] = pick(g, opts);
    const q = n + int(g, 0, 2);
    return { kind: 'deliver', item: b, n: q, giver, name, desc: `Entregad ${q} × ${ITEMS[b].name} del almacén.`, reward: { rub: Math.round((ITEMS[b].value * q * 2.2 + 60) / 10) * 10, ...(giver === 'rda' || giver === 'cuba' ? { rep: [giver, 5] } : {}) } };
  } },
  photos: { weight: 1, make(g) {
    const n = int(g, 1, 2);
    return { kind: 'photos', n, giver: 'topolev', name: `Reportaje para «Pravda»`, desc: `Fotografiad ${n} especie(s) de chebylita que aún no tengáis con la cámara Zenit-E (se compra en la Intendencia o el Garaje).`, reward: { rub: 250 * n, trust: 2 } };
  } },
  capture: { weight: 1, needs: ({ seen }) => seen.some((id) => !ENEMIES[id].boss && ENEMIES[id].minL <= 4), make(g, { seen }) {
    const t = pick(g, seen.filter((id) => !ENEMIES[id].boss && ENEMIES[id].minL <= 4));
    return { kind: 'capture', target: t, giver: 'topolev', name: `Un ejemplar vivo: ${ENEMIES[t].name}`, desc: `Capturad vivo un ${ENEMIES[t].name} (jaula de captura) y traedlo a la base.`, reward: { rub: pay(260, ENEMIES[t].minL), ess: 25 } };
  } },
};
// en qué tipos hay que salir vivos de una zona concreta (los marca la expedición)
export const ZONE_JOBS = new Set(['beacons', 'measure', 'killzone', 'survey', 'nests', 'bounty', 'deep', 'retrieve', 'courier', 'noloss', 'speedrun']);
