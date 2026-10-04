// Expedición · Moral (fase 20): estrés, aflicciones y virtudes, afinidad entre agentes, duelo y encargos en zona
// (métodos mezclados en Expedition: ver expedition.js)
import { rng, cheb } from '../util/rng.js';
import { S } from '../core/state.js';
import { ACTORS } from '../data/actors.js';
import { addStress, addAff, affOf, affState, memorialEntry, CONTRACTS, contractZone } from '../core/story.js';
import { esc } from '../util/dom.js';
import { INTERCEPTS } from '../data/lore.js';
import { plotFind, clueText } from '../core/plot.js';
import { FACTIONS } from '../data/factions.js';
import { createItem, mergeInto } from '../core/items.js';
import { bagCapacity } from '../core/agents.js';
import { ENEMIES } from '../data/enemies.js';
import { TILES } from '../data/tiles.js';

const AFFLICTIONS = {
  panico: { name: 'Pánico', turns: 2, desc: 'huye del enemigo más cercano' },
  paranoia: { name: 'Paranoia', turns: 4, desc: 'dispara a cualquiera que se mueva', flags: { paranoia: 1 } },
  temblor: { name: 'Temblor', turns: 5, desc: '−8 de puntería', mods: { acc: -8 } },
};

export class MoralePart {
  // ---------------------------------------------------------------- estrés por turno
  moraleTick() {
    for (const sq of this.team) {
      const a = sq.a;
      let d = 0;
      if (!this.isLit(sq.x, sq.y) && !this.agentLight(sq)) d += 0.12;      // oscuridad
      if (this.rad[this.key(sq.x, sq.y)] > 1) d += 0.15;                    // radiación
      if (this.flag(sq, 'music') || this.team.some((o) => o !== sq && cheb(o.x, o.y, sq.x, sq.y) <= 3 && this.flag(o, 'music'))) d -= 0.3; // la radio VEF
      for (const o of this.team) if (o !== sq && cheb(o.x, o.y, sq.x, sq.y) <= 3 && affState(affOf(a, o.a)) === 'inseparables') d -= 0.1;
      if (d) addStress(a, d);
      // virtud: al cruzar el umbral, a veces alguien se crece
      if (a.stress >= 70 && !sq.virtueRolled) {
        sq.virtueRolled = 1;
        if (rng.chance(0.18)) {
          this.addBuff(sq, { name: 'Heroísmo', turns: 12, mods: { dmgPct: 30, acc: 4 } });
          addStress(a, -25);
          this.say(`★ ${this.nm(sq)} aprieta los dientes: «¡No me vais a ver temblar!» (Heroísmo: +30% daño, +4 puntería).`, 'good');
          continue;
        }
      }
      // aflicciones con estrés alto
      if (a.stress >= 70 && !(sq.buffs || []).some((b) => b.aff) && rng.chance((a.stress - 60) / 600)) {
        const id = rng.pick(Object.keys(AFFLICTIONS));
        const A = AFFLICTIONS[id];
        this.addBuff(sq, { name: A.name, turns: A.turns, mods: A.mods || {}, flags: A.flags || {}, aff: id });
        this.say(`⚠ ${this.nm(sq)} sufre un ataque de ${A.name.toLowerCase()}: ${A.desc}.`, 'bad');
        this.interrupt = true;
      }
    }
  }
  hasAffliction(sq, id) { return (sq.buffs || []).some((b) => b.aff === id); }
  // pánico: el agente huye del hostil más cercano en lugar de actuar
  panicStep(sq) {
    const foe = this.enemies.filter((e) => this.hostile(sq, e) && this.seen(e)).sort((p, q) => Math.hypot(p.x - sq.x, p.y - sq.y) - Math.hypot(q.x - sq.x, q.y - sq.y))[0];
    if (!foe) return false;
    let best = null, bd = Math.hypot(foe.x - sq.x, foe.y - sq.y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = sq.x + dx, ny = sq.y + dy;
      if (!this.passable(nx, ny) || this.entityAt(nx, ny)) continue;
      const d = Math.hypot(foe.x - nx, foe.y - ny);
      if (d > bd) { bd = d; best = [nx, ny]; }
    }
    this.say(`${this.nm(sq)} huye presa del pánico.`, 'warn');
    if (best) { this.moveEntity(sq, best[0], best[1]); this.onAgentEnter(sq); }
    return true;
  }
  // modificadores de moral para las estadísticas del agente (los usa ast)
  moraleMods(sq, st) {
    const a = sq.a;
    const s = a.stress || 0;
    if (s >= 70) { st.acc -= 3; st.vision = Math.max(3, st.vision - 1); } else if (s >= 45) st.acc -= 1;
    for (const o of this.team) {
      if (o === sq || cheb(o.x, o.y, sq.x, sq.y) > 3) continue;
      const rel = affState(affOf(a, o.a));
      if (rel === 'inseparables') { st.acc += 3; st.ev += 2; }
      else if (rel === 'camaradas') st.acc += 1;
      else if (rel === 'rivales') { st.acc -= 2; st.dmgPct = (st.dmgPct || 0) + 10; }
    }
  }

  // ---------------------------------------------------------------- sucesos que tocan la moral
  // un agente muere: duelo, venganza y la entrada del memorial
  moraleOnDeath(sq, a, killer) {
    const f = S.fallen[0];
    if (f) memorialEntry(f, a, this.def.name);
    for (const o of this.team) {
      if (o === sq) continue;
      const v = affOf(a, o.a);
      addStress(o.a, 22 + (v >= 30 ? 18 : 0));
      if (v >= 30) {
        this.say(`${this.nm(o)} grita el nombre de ${esc(a.nick)}. (Duelo: +estrés.)`, 'bad');
        if (killer && ACTORS[killer.type] && !o.a.vengeance && rng.chance(0.5)) {
          o.a.vengeance = { type: killer.type, name: ACTORS[killer.type].name };
          this.acquire(o, 'venganza');
          this.say(`🔥 ${this.nm(o)} jura venganza contra ${ACTORS[killer.type].name}: +15% de daño contra su especie.`, 'warn');
        }
      }
    }
  }
  // al ver a un jefe por primera vez
  moraleOnBoss(e) {
    if (e.bossSeen) return;
    e.bossSeen = 1;
    for (const o of this.team) addStress(o.a, 8);
  }
  // emboscada: daño de alguien que no estaba a la vista
  moraleOnAmbush(sq, srcE) {
    if (srcE && !srcE.seen) addStress(sq.a, 4);
  }
  // fuego amigo
  moraleOnFriendlyFire(src, victim) {
    if (!src || !victim || src === victim || !src.a || !victim.a) return;
    addAff(src.a, victim.a, -8);
    addStress(victim.a, 3);
  }
  // compartir trinchera: abatir algo con un compañero cerca
  moraleOnKill(src, e) {
    if (!src || !src.a) return;
    for (const o of this.team) if (o !== src && cheb(o.x, o.y, src.x, src.y) <= 3) { sq_trench(this, src, o); }
    if (ACTORS[e.type] && ACTORS[e.type].boss) addStress(src.a, -15);
    if (src.a.vengeance && src.a.vengeance.type === e.type) this.say(`${this.nm(src)} se cobra su venganza.`, 'good');
  }

  // ---------------------------------------------------------------- mensajes interceptados (fase 20.6)
  // a veces la radio capta a otra facción hablando de un alijo: se marca en el radar
  interceptRadio() {
    if (!rng.chance(0.35 + ((S.modules.sala_radio || 0) * 0.1) + (S.research && S.research.r_comunicaciones ? 0.2 : 0))) return false;
    const targets = this.objects.filter((o) => !o.opened && (o.owner || o.kind === 'cache' || o.kind === 'crate') && !this.explored[this.key(o.x, o.y)]);
    if (!targets.length) return false;
    const owned = targets.filter((o) => o.owner);
    const o = owned.length ? rng.pick(owned) : rng.pick(targets);
    const pool = INTERCEPTS.filter((m) => !o.owner || m.f === o.owner);
    const m = rng.pick(pool.length ? pool : INTERCEPTS);
    const s = this.sectorAt(o.x, o.y);
    for (let y = o.y - 1; y <= o.y + 1; y++) for (let x = o.x - 1; x <= o.x + 1; x++) if (this.inb(x, y)) this.explored[this.key(x, y)] = 1;
    if (!this.pois.some((p) => p.x === o.x && p.y === o.y)) this.pois.push({ type: 'cache', x: o.x, y: o.y, lvl: o.lvl || 1, name: 'Alijo (radio interceptada)', best: 1, found: 1 });
    this.dirty = true;
    this.say(`📻 <span style="color:${(FACTIONS[m.f] || {}).color || ''}">Interceptado (${(FACTIONS[m.f] || {}).short || '?'})</span>: ${m.t.replace(/\{s\}/g, s ? s.code : '?')} <span class="cyan">(marcado en el radar)</span>`, 'o1');
    // fase 28: a veces se cuela algo del caso del topo
    if (rng.chance(0.3)) { const c = plotFind('radio', { fac: m.f, quiet: true }); if (c) this.say(`📌 Entre la estática, algo más: «${clueText(c)}» (pista para el tablero de corcho).`, 'good'); }
    return true;
  }

  // ---------------------------------------------------------------- encargos con lugar (fase 20.5)
  spawnContractStuff() {
    const list = (S.contracts && S.contracts.active) || [];
    for (const c of list) {
      if (contractZone(c) !== this.def.id || this.floor) continue;
      const d = CONTRACTS[c.id];
      if (d.special) { if (c.day === S.day) this.spawnSpecial(c, d); continue; }
      if (d.job) { this.spawnJob(c, d); continue; }
      const spot = this.farSpot(20);
      if (!spot) continue;
      if (d.kind === 'escort') {
        const e = this.spawnEnemy('swe_scientist', Math.max(1, this.def.lvl[0]), spot[0], spot[1], 'errante', null, 'suecia');
        e.vip = c.id; e.home = [spot[0], spot[1]];
        this.say(`📻 Encargo «${d.name}»: el dosimetrista sueco emite desde algún punto del mapa. Encontradlo y llevadlo a una extracción.`, 'cyan');
      } else if (d.kind === 'sabotage') {
        const o = { kind: 'sabotage', x: spot[0], y: spot[1], opened: false, items: [], contract: c.id };
        this.objects.push(o); this.objMap.set(this.key(o.x, o.y), o);
        this.pois.push({ type: 'cache', x: o.x, y: o.y, lvl: this.def.lvl[1], name: 'Centro de mando (sabotaje)', best: 3, found: 1 });
        this.say(`📻 Encargo «${d.name}»: el centro de mando está marcado en el radar.`, 'cyan');
      } else if (d.kind === 'missing') {
        const o = { kind: 'survivor', x: spot[0], y: spot[1], opened: true, items: [], line: 0, lvl: this.def.lvl[0], missing: c.who, contract: c.id };
        this.objects.push(o); this.objMap.set(this.key(o.x, o.y), o);
        this.pois.push({ type: 'cache', x: o.x, y: o.y, lvl: this.def.lvl[0], name: `Radiobaliza de ${c.who}`, best: 2, found: 1 });
        this.say(`📻 Encargo «${d.name}»: la radiobaliza de ${esc(c.who)} se capta en este mapa.`, 'cyan');
      }
    }
  }
  // encargo especial del día (fase 16.4): objeto marcado o un objetivo que se vigila cada turno
  spawnSpecial(c, d) {
    if (d.kind === 'activate' || d.kind === 'retrieve') {
      const spot = this.farSpot(18) || this.farSpot(10);
      if (!spot) return;
      const o = { kind: 'objective', x: spot[0], y: spot[1], opened: false, items: [], contract: c.id, label: d.label, goal: d.kind };
      this.objects.push(o); this.objMap.set(this.key(o.x, o.y), o);
      this.pois.push({ type: 'cache', x: o.x, y: o.y, lvl: this.def.lvl[1], name: `${d.label} (encargo)`, best: 3, found: 1 });
    }
    const where = (this.mods || []).includes('tormenta') ? 'en algún punto del mapa (sin radar: a ojo)' : 'marcado en el radar';
    const goal = d.kind === 'activate' ? `${d.label.toLowerCase()} ${where}` : d.kind === 'retrieve' ? `${d.label.toLowerCase()} ${where}; sacad lo que guarda` : d.kind === 'kills' ? `abatid ${d.n} chebylitas` : d.kind === 'essence' ? `recoged ${d.n} ✦` : `aguantad el pulso del reactor ${d.wait} turnos`;
    this.say(`★ Encargo especial «${d.name}»: ${goal}. Solo hoy.`, 'o1');
  }
  // bolsa de trabajo (revisión): lo que cada trabajo pone en el mapa
  spawnJob(c, d) {
    const mark = (goal, label, spot) => {
      const o = { kind: 'objective', x: spot[0], y: spot[1], opened: false, items: [], contract: c.id, label, goal };
      this.objects.push(o); this.objMap.set(this.key(o.x, o.y), o);
      this.pois.push({ type: 'cache', x: o.x, y: o.y, lvl: this.def.lvl[0], name: `${label} (trabajo)`, best: 1, found: 1 });
    };
    if (d.kind === 'beacons') for (let i = 0; i < d.n; i++) { const sp = this.farSpot(14 + i * 4) || this.farSpot(8); if (sp) mark('beacon', `${d.label} ${i + 1}`, sp); }
    else if (d.kind === 'measure') {
      // en los focos de radiación del mapa (o en puntos al azar si no hay)
      const hot = this.pois.filter((p) => p.type === 'hazard' && p.kind === 'rad');
      for (let i = 0; i < d.n; i++) {
        const h = hot[i];
        let sp = null;
        if (h) for (let r = 0; r <= 3 && !sp; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (!sp && this.passable(h.x + dx, h.y + dy) && !this.entityAt(h.x + dx, h.y + dy) && !this.objAt(h.x + dx, h.y + dy)) sp = [h.x + dx, h.y + dy];
        sp = sp || this.farSpot(12);
        if (sp) mark('measure', `${d.label} ${i + 1}`, sp);
      }
    } else if (d.kind === 'retrieve') { const sp = this.farSpot(18) || this.farSpot(10); if (sp) mark('retrieve', d.label, sp); }
    else if (d.kind === 'courier') { const sp = this.farSpot(18) || this.farSpot(10); if (sp) mark('drop', d.label, sp); }
    else if (d.kind === 'bounty') {
      const sp = this.farSpot(20) || this.farSpot(12);
      const types = this.def.enemies.filter((t) => ENEMIES[t] && !ENEMIES[t].boss);
      if (sp && types.length) {
        const e = this.spawnEnemy(types[Math.floor(Math.random() * types.length)], Math.min(10, this.def.lvl[1] + 1), sp[0], sp[1], 'errante');
        this.makeElite(e, [['blindado', 'veloz', 'vampirico', 'escudero'][Math.floor(Math.random() * 4)]]);
        e.bounty = c.id; e.nick = d.label;
      }
    }
    const goal = { beacons: `colocad ${d.n} balizas en los puntos marcados`, measure: `medid en ${d.n} puntos de dosimetría marcados`, killzone: `abatid ${d.n} chebylitas`, survey: `explorad el ${d.n}% del piso superior`, nests: `acabad con ${d.n} nidos`, bounty: `abatid a «${d.label}» (la radio lo sigue en el mapa)`, deep: `bajad al piso −${d.n}`, retrieve: `recuperad ${String(d.item).toLowerCase()} (marcado) y sacadlo`, courier: `dejad el paquete en el buzón muerto (marcado); llevadlo en la mochila`, noloss: 'volved todos con vida', speedrun: `salid antes del turno ${d.n}` }[d.kind];
    if (goal) this.say(`⚑ Trabajo «${d.name}»: ${goal}.`, 'o1');
  }
  // objeto de un encargo especial: se usa (F) o se coge
  useObjective(sq, o) {
    const d = CONTRACTS[o.contract];
    // bolsa de trabajo: balizas, dosimetría y buzón muerto
    if (o.goal === 'beacon' || o.goal === 'measure' || o.goal === 'drop') {
      if (o.goal === 'drop') {
        const pk = sq.a.bag.find((it) => it && it.contract === o.contract);
        if (!pk) { this.say(`${this.nm(sq)} no lleva el paquete sellado en la mochila.`, 'warn'); return false; }
        sq.a.bag.splice(sq.a.bag.indexOf(pk), 1);
      }
      o.opened = true; this.dirty = true;
      this.pois = this.pois.filter((p) => !(p.x === o.x && p.y === o.y));
      const f = this.facState();
      f.jobProg = { ...(f.jobProg || {}), [o.contract]: ((f.jobProg || {})[o.contract] || 0) + 1 };
      const done = f.jobProg[o.contract], need = o.goal === 'drop' ? 1 : d.n;
      this.fx.push({ type: 'snd', s: 'revive' });
      if (o.goal === 'measure') sq.a.rad = Math.min(140, (sq.a.rad || 0) + 6); // la lectura se cobra algo de dosis
      if (done >= need) this.specialMet(o.contract, o.goal === 'beacon' ? `${need} balizas colocadas` : o.goal === 'measure' ? `${need} lecturas tomadas` : 'El paquete está en el buzón');
      else this.say(`⚑ ${o.goal === 'beacon' ? 'Baliza colocada' : 'Lectura tomada'} (${done}/${need}).`, 'cyan');
      return true;
    }
    o.opened = true; this.dirty = true;
    this.pois = this.pois.filter((p) => !(p.x === o.x && p.y === o.y));
    if (o.goal === 'retrieve') {
      const it = createItem('objcase', 0, rng); it.nm = d.item; it.contract = o.contract;
      if (mergeInto(sq.a.bag, it, bagCapacity(sq.a))) { this.addFloor(sq.x, sq.y, it); this.say(`La mochila de ${this.nm(sq)} está llena: «${esc(d.item)}» queda en el suelo.`, 'warn'); }
      else this.say(`★ ${this.nm(sq)} recoge «${esc(d.item)}». Ahora, a una extracción con ello.`, 'good');
    } else {
      this.specialMet(o.contract, `${this.nm(sq)} ${d.act}`);
    }
    return true;
  }
  specialMet(id, why) {
    const f = this.facState();
    if (f.contracts && f.contracts[id]) return;
    f.contracts = { ...(f.contracts || {}), [id]: 1 };
    this.say(`★ ${why}. Encargo «${CONTRACTS[id].name}» cumplido: volved vivos para cobrarlo.`, 'good');
  }
  farSpot(minD) {
    for (let i = 0; i < 400; i++) {
      const x = rng.int(2, this.w - 3), y = rng.int(2, this.h - 3);
      if (!this.passable(x, y) || this.entityAt(x, y) || this.objAt(x, y)) continue;
      if (Math.hypot(x - this.start[0], y - this.start[1]) < minD) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => this.passable(x + dx, y + dy))) continue;
      return [x, y];
    }
    return null;
  }
  // cada turno: el sueco se une al escuadrón cuando alguien llega a su lado
  contractTick() {
    // objetivos de los encargos especiales que se cumplen solos (bajas, esencia, pulso)
    for (const c of (S.contracts && S.contracts.active) || []) {
      const dj = CONTRACTS[c.id];
      if (dj && dj.job && dj.zone === this.def.id) { this.jobTick(c, dj); continue; }
      if (!c.special || c.zone !== this.def.id || c.day !== S.day) continue;
      const d = CONTRACTS[c.id];
      if (d.kind === 'kills' && this.tally.kills >= d.n) this.specialMet(c.id, `${d.n} chebylitas abatidos`);
      else if (d.kind === 'essence' && this.tally.essence >= d.n) this.specialMet(c.id, `${d.n} ✦ recogidos`);
      else if (d.kind === 'pulse' && this.turn >= this.surgeAt + d.wait) this.specialMet(c.id, 'Los dosímetros han registrado el pulso');
    }
    for (const e of this.enemies) {
      if (!e.vip || e.escort > 0) continue;
      if (this.team.some((q) => cheb(q.x, q.y, e.x, e.y) <= 1)) {
        e.escort = 999;
        this.say(`${this.enm(e)}: «Tack! ¡Gracias! Os sigo hasta la extracción».`, 'good');
      }
    }
  }
  // objetivos de la bolsa de trabajo que se vigilan cada turno
  jobTick(c, d) {
    const f = this.facState();
    if (f.contracts && f.contracts[c.id]) return;
    if (d.kind === 'killzone' && this.tally.kills >= d.n) this.specialMet(c.id, `${d.n} chebylitas abatidos`);
    else if (d.kind === 'deep' && (this.floor || 0) >= d.n) this.specialMet(c.id, `Piso −${d.n} alcanzado: los sensores registran el fondo`);
    else if (d.kind === 'nests') {
      const pois = [...(this.pois || []), ...(this.floorStore || []).flatMap((st) => (st && st.pois) || [])];
      if (pois.filter((p) => p.type === 'nest' && p.cleared).length >= d.n) this.specialMet(c.id, `${d.n} nidos despejados`);
    } else if (d.kind === 'survey' && !this.floor && this.turn % 3 === 0) {
      let walk = 0, seen = 0;
      for (let k = 0; k < this.t.length; k++) if (TILES[this.t[k]].walk) { walk++; if (this.explored[k]) seen++; }
      if (walk && (seen / walk) * 100 >= d.n) this.specialMet(c.id, `${d.n}% de la zona cartografiada`);
    }
  }
  // al extraer a un agente: el sueco escoltado sale con él
  contractOnExtract(sq) {
    // lo que pide un encargo especial sale de la zona con este agente
    for (const it of sq.a.bag) if (it && it.contract && CONTRACTS[it.contract] && CONTRACTS[it.contract].kind === 'retrieve') this.specialMet(it.contract, `«${esc(it.nm)}» sale de la zona`);
    for (const e of [...this.enemies]) {
      if (!e.vip || !(e.escort > 0) || cheb(e.x, e.y, sq.x, sq.y) > 3) continue;
      this.dismissActor(e);
      this.facState().contracts = { ...(this.facState().contracts || {}), [e.vip]: 1 };
      this.say('⇑ El dosimetrista sueco sube con vosotros. Encargo cumplido.', 'good');
    }
  }
  sabotage(sq, o) {
    o.opened = true; this.dirty = true;
    this.facState().contracts = { ...(this.facState().contracts || {}), [o.contract]: 1 };
    this.noise(o.x, o.y, 20);
    for (const e of this.enemies) if (e.faction === 'usa') { e.state = 'alerta'; e.mem = 25; e.lx = sq.x; e.ly = sq.y; }
    this.fx.push({ type: 'explosion', x: o.x, y: o.y, r: 1 });
    this.say('💥 La carga destroza el centro de mando. Suenan todas las alarmas de «Fénix»: ¡salid de aquí!', 'warn');
    this.pois = this.pois.filter((p) => !(p.x === o.x && p.y === o.y));
    return true;
  }
  rescueMissing(sq, o) {
    this.facState().contracts = { ...(this.facState().contracts || {}), [o.contract]: 1 };
    this.facState().rescued = { name: o.missing, lvl: Math.max(2, this.def.lvl[0]) };
    this.objects.splice(this.objects.indexOf(o), 1); this.objMap.delete(this.key(o.x, o.y));
    this.pois = this.pois.filter((p) => !(p.x === o.x && p.y === o.y));
    this.say(`✚ ${esc(o.missing)} está vivo. Herido, sediento, pero vivo. «Sabía que vendríais». Se dirige a la extracción por su cuenta.`, 'good');
    this.dirty = true;
    return true;
  }
}
function sq_trench(exp, a, b) {
  exp.trench = exp.trench || {};
  const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
  if ((exp.trench[k] || 0) >= 10) return;
  exp.trench[k] = (exp.trench[k] || 0) + 1;
  addAff(a.a, b.a, 1);
}
