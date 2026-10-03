// Expedición · fase 25: el Narrador del Reactor dentro de la expedición.
// Mide la tensión turno a turno (daño recibido, enemigos en alerta, abatidos, pulso) y guarda su curva. Tras mucha
// calma mete un «golpe» (patrulla que viene hacia vosotros, pulso adelantado, una salida que se cierra antes); con el
// escuadrón en las últimas, un «respiro» (salida cerca, caja de suministros, los chebylitas se retiran, aliados).
// La personalidad (core/narrator.js) decide cuánta calma aguanta y cuántas ganas tiene de ayudar.
// (métodos mezclados en Expedition: ver expedition.js)
import { rng, cheb } from '../util/rng.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { ACTORS } from '../data/actors.js';
import { createItem } from '../core/items.js';
import { agentStats } from '../core/agents.js';
import { S } from '../core/state.js';
import { persona } from '../core/narrator.js';

export class DirectorPart {
  dirState() { return (this.dir = this.dir || { T: 8, calm: 0, lastBeat: 0, lastRelief: 0, curve: [], hp: null, beats: [] }); }

  // cada turno (desde endTurn)
  directorTick() {
    const D = this.dirState();
    const team = this.team;
    if (!team.length) return;
    // daño recibido este turno (diferencia de salud del escuadrón)
    let hp = 0, hpMax = 0;
    for (const q of team) { hp += Math.max(0, q.a.hp); hpMax += agentStats(q.a).hpMaxEff; }
    const hurt = D.hp == null ? 0 : Math.max(0, D.hp - hp);
    D.hp = hp;
    // chebylitas y hostiles en alerta cerca del escuadrón
    let alert = 0;
    for (const e of this.enemies) {
      if (e.state !== 'alerta' || this.isComp(e) || e.hp <= 0) continue;
      if (team.some((q) => cheb(q.x, q.y, e.x, e.y) <= 12 && this.hostile(q, e))) alert++;
    }
    const downed = team.filter((q) => q.downed).length;
    const surge = this.turn >= this.surgeAt ? 15 : 0;
    const target = Math.min(100, 8 + alert * 9 + downed * 25 + hurt * 3 + surge);
    D.T += (target - D.T) * (target > D.T ? 0.5 : 0.12);
    D.calm = D.T < 22 ? D.calm + 1 : 0;
    if (this.turn % 5 === 0) { D.curve.push(Math.round(D.T)); if (D.curve.length > 240) D.curve.shift(); }
    // ni en la defensa de la base ni en el campamento: solo se mide
    if (this.def.special === 'defensa' || this.def.social) return;
    const P = persona();
    const frac = hpMax ? hp / hpMax : 1;
    // respiro: alguien abatido, poca salud o mucho tiempo al límite
    const trouble = downed > 0 || frac < 0.35 || D.T > 85;
    if (trouble && this.turn - D.lastRelief > P.reliefGap && rng.chance(Math.min(0.5, P.relief * 0.1))) { this.directorRelief(); return; }
    // golpe: después de mucha calma
    if (this.turn > 25 && D.calm >= P.calm && this.turn - D.lastBeat > 40 && rng.chance(0.12)) { this.directorBeat(); return; }
    // Chernóbil: cualquier cosa, cualquier turno
    if (S.narr && S.narr.persona === 'chernobil' && this.turn > 15 && rng.chance(0.004)) { if (rng.chance(0.5)) this.directorBeat(); else this.directorRelief(); }
  }

  // ---------------------------------------------------------------- golpes
  directorBeat(force = null) {
    const D = this.dirState();
    const opts = [];
    opts.push(['patrulla', 3]);
    if (this.surgeAt - this.turn > 45) opts.push(['pulso', 1.2]);
    if (this.exits.some((x) => !x.perm && x.expires - this.turn > 15)) opts.push(['cierre', 1]);
    const id = force || rng.weighted(opts.map((o) => o[0]), (k) => opts.find((o) => o[0] === k)[1]);
    let ok = false;
    if (id === 'patrulla') ok = this.beatPatrol();
    else if (id === 'pulso') {
      this.surgeAt = this.turn + 30;
      this.say('☢ Los dosímetros se disparan sin aviso: <b>el pulso del reactor llega antes de lo previsto</b> (30 turnos).', 'bad');
      ok = true;
    } else if (id === 'cierre') {
      const ex = this.exits.filter((x) => !x.perm && x.expires - this.turn > 15).sort((a, b) => a.expires - b.expires)[0];
      if (ex) { ex.expires = this.turn + 10; this.say(`📻 RADIO: «¡La extracción «${ex.name}» se está derrumbando! Os quedan <b>10 turnos</b> para usarla.»`, 'warn'); ok = true; }
    }
    if (ok) { D.lastBeat = this.turn; D.calm = 0; D.beats.push({ t: this.turn, id }); this.interrupt = true; }
    return ok;
  }
  // una patrulla de chebylitas aparece lejos, fuera de la vista, y viene hacia vosotros
  beatPatrol() {
    const c = this.cur || this.team[0];
    if (!c) return false;
    let spot = null;
    for (let i = 0; i < 400 && !spot; i++) {
      const x = c.x + rng.int(-28, 28), y = c.y + rng.int(-20, 20);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < 16 || d > 30 || !this.inb(x, y) || !this.passable(x, y) || this.entityAt(x, y) || this.visible[this.key(x, y)]) continue;
      spot = [x, y];
    }
    if (!spot) return false;
    const lvl = Math.min(10, this.def.lvl[1] + (this.floor || 0));
    const pool = (this.def.enemies || []).filter((t) => ENEMIES[t] && !ENEMIES[t].boss && !ENEMIES[t].abil.includes('aquatic') && !ENEMIES[t].abil.includes('stationary') && ENEMIES[t].minL <= lvl);
    if (!pool.length) return false;
    const type = rng.pick(pool);
    const n = rng.int(2, 3) + (lvl >= 6 ? 1 : 0);
    let made = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      if (made >= n) break;
      const x = spot[0] + dx, y = spot[1] + dy;
      if (!this.passable(x, y) || this.entityAt(x, y)) continue;
      const e = this.spawnEnemy(type, lvl, x, y, 'alerta', null);
      e.mem = 60; e.patrol = 1; made++;
    }
    if (!made) return false;
    this.dmap = null;
    const s = this.sectorAt ? this.sectorAt(spot[0], spot[1]) : null;
    this.say(`📻 Topolev: «Los sensores captan una manada de ${ENEMIES[type].name.toLowerCase()} que se mueve hacia vosotros${s ? ` desde el sector ${s.code}` : ''}. <b>Preparaos.</b>»`, 'warn');
    return true;
  }

  // ---------------------------------------------------------------- respiros
  directorRelief(force = null) {
    const D = this.dirState();
    const opts = [['suministros', 2], ['retirada', 1.5]];
    if (!this.floor) opts.push(['salida', 2]);
    const f = this.facState();
    if (!f.allies && !f.alliesUsed) opts.push(['aliados', 1]);
    const id = force || rng.weighted(opts.map((o) => o[0]), (k) => opts.find((o) => o[0] === k)[1] * (k === 'suministros' && S.narr && S.narr.persona === 'babushka' ? 1.5 : 1));
    let ok = false;
    const c = this.cur || this.team[0];
    if (id === 'salida') {
      const spot = this.reliefSpot(c, 8, 18, 3);
      if (spot) { this.spawnTempExit(spot[0], spot[1], 60, 'Grieta providencial'); this.say('📻 RADIO: «Un derrumbe ha abierto una grieta al exterior muy cerca de vosotros. <span class="cyan">Extracción temporal</span> durante 60 turnos.»', 'cyan'); ok = true; }
    } else if (id === 'suministros') {
      const spot = this.reliefSpot(c, 2, 6, 1);
      if (spot) {
        const items = [createItem('ai2', 0, rng, 1), createItem('bandage', 0, rng, 2)];
        const w = c && c.a.equip[c.cur];
        if (w && ITEMS[w.b] && ITEMS[w.b].ammo && ITEMS[ITEMS[w.b].ammo]) items.push(createItem(ITEMS[w.b].ammo, 0, rng, ITEMS[ITEMS[w.b].ammo].pack || 20));
        const o = { kind: 'crate', x: spot[0], y: spot[1], items, opened: false, lvl: this.def.lvl[0], drop: 1 };
        this.objects.push(o); this.objMap.set(this.key(o.x, o.y), o);
        this.say('📻 Kravets: «Os lanzamos una caja por el conducto de ventilación más cercano. Medicinas y munición. <b>Buscadla a vuestro lado.</b>»', 'good');
        this.dirty = true; ok = true;
      }
    } else if (id === 'retirada') {
      let n = 0;
      for (const e of this.enemies) {
        if (e.state !== 'alerta' || this.isComp(e) || (ACTORS[e.type] && ACTORS[e.type].boss) || !ENEMIES[e.type]) continue;
        if (!this.team.some((q) => this.hostile(q, e) && cheb(q.x, q.y, e.x, e.y) <= 14)) continue;
        e.fear = 8; e.fearX = c.x; e.fearY = c.y; e.mem = 0; n++;
      }
      if (n) { this.say(`Un temblor recorre la roca: algo más grande ronda cerca. <b>${n} chebylita(s) se retiran</b> asustados.`, 'good'); ok = true; }
    } else if (id === 'aliados') {
      const fac = ['rda', 'cuba', 'checos'].sort((a, b) => ((S.rep && S.rep[b]) || 0) - ((S.rep && S.rep[a]) || 0))[0];
      f.allies = { fac, at: this.turn + 6, x: c.x, y: c.y }; f.alliesUsed = 1;
      this.say('📻 Una voz con acento extranjero en vuestra frecuencia: «Os oímos, camaradas. Aguantad seis minutos, vamos para allá.»', 'good');
      ok = true;
    }
    if (ok) { D.lastRelief = this.turn; D.beats.push({ t: this.turn, id, relief: 1 }); this.interrupt = true; }
    return ok;
  }
  // una casilla libre a cierta distancia del agente (con hueco alrededor si open = 3)
  reliefSpot(c, dMin, dMax, open) {
    if (!c) return null;
    for (let i = 0; i < 500; i++) {
      const x = c.x + rng.int(-dMax, dMax), y = c.y + rng.int(-dMax, dMax);
      const d = Math.max(Math.abs(x - c.x), Math.abs(y - c.y));
      if (d < dMin || d > dMax || !this.inb(x, y)) continue;
      let ok = true;
      const r = open >= 3 ? 1 : 0;
      for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r && ok; dx++) if (!this.passable(x + dx, y + dy) || this.entityAt(x + dx, y + dy) || this.objAt(x + dx, y + dy)) ok = false;
      if (ok) return [x, y];
    }
    return null;
  }
}
