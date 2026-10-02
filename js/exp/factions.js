// Expedición · Facciones (fase 18): encuentros, prisioneros, robos, bengala roja y refuerzos aliados
// (métodos mezclados en Expedition: ver expedition.js)
import { rng, cheb } from '../util/rng.js';
import { ITEMS } from '../data/items.js';
import { createItem } from '../core/items.js';
import { S } from '../core/state.js';
import { FACTIONS, addRep, repOf } from '../data/factions.js';
import { HUMANS, SQUADS } from '../data/humans.js';
import { ACTORS, actorFaction } from '../data/actors.js';
import { D8 } from './shared.js';

const RADIO_CHATTER = {
  usa: ['«Nightingale Two to Nest, package not secured, repeat, not secured…» (traducido: «el paquete no está asegurado»).', '«…Langley insists. No Soviet witnesses…»'],
  uk: ['«Saxon actual, claymores set on the north approach. Tea at eighteen hundred.» (traducido: «minas puestas en el acceso norte»).'],
  rda: ['«Wismut-Zentrale an alle: Funkdisziplin!» (traducido: «¡Disciplina de radio!»).', '«…la patrulla tres no responde desde hace dos horas…»'],
  suecia: ['«Forsmark bas, mätvärdena stiger…» (traducido: «las lecturas suben»).'],
  finlandia: ['Solo un silbido. Luego, en finés: «Seguimos aquí. Sisu.»'],
  checos: ['«Tatra volá základnu… výbuch v pět nula nula.» (traducido: «voladura a las cinco»).'],
  yugo: ['Música de acordeón de Radio Belgrado y, debajo, alguien que regatea precios.'],
  cuba: ['«…Radio Rebelde para los compañeros en la Zona…» Luego, estática y un bolero.'],
};

export class FactionPart {
  // estado de facciones de la expedición (se guarda con ella)
  facState() { return (this.fac = this.fac || { prisoners: 0, recruits: [], allies: null, talked: {}, flareT: 0 }); }

  // persona con la que se puede hablar junto al agente: primero los rendidos
  talkableAt(x, y) {
    const e = this.enemyAt(x, y);
    if (!e || !HUMANS[e.type] || e.hp <= 0) return null;
    if (e.surrendered) return e;
    const F = FACTIONS[actorFaction(e)];
    if (!F || !F.talk || this.hostile(this.cur, e)) return null;
    return e;
  }
  interactActor(sq, e) {
    if (sq !== this.cur) return false;
    this.openDialog(e.surrendered ? 'prisoner' : 'encounter', sq, null, e);
    return false;
  }
  // retira a una persona del mapa (se va, se la llevan prisionera…)
  dismissActor(e) {
    const i = this.enemies.indexOf(e);
    if (i < 0) return;
    this.enemies.splice(i, 1);
    if (this.occ && this.occ.get(this.key(e.x, e.y)) === e) this.occ.delete(this.key(e.x, e.y));
    this.dirty = true; this.dmap = null;
  }
  // suelta el equipo de una persona en su casilla
  stripActor(e) {
    const def = ACTORS[e.type];
    if (e.w && !def.noDrop) { this.addFloor(e.x, e.y, e.w); e.w = null; }
    for (const b of def.loot || []) if (rng.chance(0.6)) this.addFloor(e.x, e.y, createItem(b, 0, rng, ITEMS[b].stack > 1 ? (ITEMS[b].cat === 'ammo' ? ITEMS[b].pack : 1) : undefined));
  }

  // ---------------------------------------------------------------- bengala roja: llama a los aliados
  redFlare(sq) {
    const f = this.facState();
    this.flares.push({ x: sq.x, y: sq.y, t: 12 });
    this.lightDirty = true;
    this.fx.push({ type: 'flare', x: sq.x, y: sq.y });
    let n = 0;
    for (const e of this.enemies) {
      if (!HUMANS[e.type] || e.surrendered || this.attitudeToSquad(e) !== 'allied' || ACTORS[e.type].stationary) continue;
      e.escort = 40; e.state = 'errante'; e.lx = sq.x; e.ly = sq.y; n++;
    }
    // si la RDA o Cuba os aprecian, mandan una patrulla
    const fac = ['rda', 'cuba', 'checos'].filter((x) => repOf(S, x) >= 25).sort((a, b) => repOf(S, b) - repOf(S, a))[0];
    if (fac && !f.allies && !f.alliesUsed) { f.allies = { fac, at: this.turn + 8, x: sq.x, y: sq.y }; f.alliesUsed = 1; }
    this.noise(sq.x, sq.y, 10);
    this.say(`🔴 ${this.nm(sq)} dispara una bengala roja. ${n ? `${n} aliado(s) acuden a vuestra posición.` : 'Nadie responde… de momento.'}${f.allies && f.allies.at > this.turn ? ` <span class="good">Radio: «${FACTIONS[f.allies.fac].short} en camino, llegamos en 8 minutos».</span>` : ''}`, n || f.allies ? 'good' : 'dimt');
    return true;
  }
  // cada turno: llegan los refuerzos pedidos con la bengala
  factionTick() {
    const f = this.fac;
    if (!f || !f.allies || this.turn < f.allies.at) return;
    const { fac, x, y } = f.allies;
    f.allies = null;
    // aparecen a 10–18 casillas, fuera de la vista si es posible
    let spot = null;
    for (let i = 0; i < 300 && !spot; i++) {
      const xx = x + rng.int(-18, 18), yy = y + rng.int(-18, 18);
      const d = Math.hypot(xx - x, yy - y);
      if (d < 10 || d > 20 || !this.passable(xx, yy) || this.entityAt(xx, yy)) continue;
      spot = [xx, yy];
    }
    if (!spot) return;
    let n = 0;
    const lvl = Math.max(this.def.lvl[0], Math.min(10, this.def.lvl[1] + (this.floor || 0)));
    for (const [type, a0, a1] of SQUADS[fac]) {
      for (let i = 0; i < Math.max(1, a0 + (a1 > a0 ? 1 : 0)); i++) {
        const c = [[0, 0], ...D8, ...D8.map(([dx, dy]) => [dx * 2, dy * 2])].map(([dx, dy]) => [spot[0] + dx, spot[1] + dy]).find(([xx, yy]) => this.passable(xx, yy) && !this.entityAt(xx, yy));
        if (!c) break;
        const e = this.spawnEnemy(type, lvl, c[0], c[1], 'errante', null, fac);
        e.escort = 50; n++;
      }
    }
    this.computeVisibility(true);
    this.say(`🔴 Llega una patrulla de ${FACTIONS[fac].name}: ${n} hombres. Os escoltarán un tiempo.`, 'good');
    this.interrupt = true;
  }

  // ---------------------------------------------------------------- robar en alijos ajenos
  // devuelve true si el robo provoca a la facción dueña
  checkTheft(sq, o) {
    const owner = o.owner;
    if (!owner || this.attitude('squad', owner) === 'hostile') return false;
    const witness = this.enemies.find((e) => !e.surrendered && actorFaction(e) === owner && Math.hypot(e.x - sq.x, e.y - sq.y) <= 10 && this.los(e.x, e.y, sq.x, sq.y));
    if (witness) {
      this.say(`${this.enm(witness)}: «¡Eh! ¡Eso es nuestro!»`, 'bad');
      this.provoke(owner);
      return true;
    }
    addRep(S, owner, -6);
    this.say(`Registráis un alijo de ${FACTIONS[owner].name}. Nadie os ha visto… esta vez (−6 de reputación cuando lo echen en falta).`, 'warn');
    return false;
  }

  // ---------------------------------------------------------------- radios de campaña abandonadas
  listenRadio(sq, o) {
    o.opened = true; this.dirty = true;
    const f = o.fac && FACTIONS[o.fac] ? o.fac : 'usa';
    const lines = RADIO_CHATTER[f] || RADIO_CHATTER.usa;
    let n = 0;
    for (const e of this.enemies) if (HUMANS[e.type] && !e.seen) { e.seen = 1; this.explored[this.key(e.x, e.y)] = 1; n++; }
    this.noise(o.x, o.y, 4);
    this.say(`☏ ${this.nm(sq)} sintoniza la radio de ${FACTIONS[f].name}: <i>${lines[rng.int(0, lines.length - 1)]}</i>${n ? ` <span class="cyan">Triangulando las emisiones: ${n} persona(s) localizadas en el radar.</span>` : ''}`, 'o1');
    this.gainXp(sq, 4, true);
    return true;
  }

  // ---------------------------------------------------------------- prisioneros y reclutas
  takePrisoner(e) { this.facState().prisoners++; this.dismissActor(e); }
  recruitActor(e) { this.facState().recruits.push({ lvl: e.lvl, from: actorFaction(e) }); this.dismissActor(e); }
}
