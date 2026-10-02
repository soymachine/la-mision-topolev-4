// Expedición · Casillas con mecánica (fase 16.1): cobertura, objetos destructibles, puertas blindadas,
// terminales, interruptores, ventiladores, escombros inestables, raíces, grafito, vagonetas, ruido y resbalones.
// (métodos mezclados en Expedition: ver expedition.js)
import { rng, cheb, line } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { createItem, mergeInto, rollLoot } from '../core/items.js';
import { ACTORS } from '../data/actors.js';
import { agentStats, bagCapacity } from '../core/agents.js';
import { esc } from '../util/dom.js';
import { D8 } from './shared.js';

const SHOOT_NAME = { barrel: 'el barril', pipe: 'la tubería', lamp: 'la lámpara' };

const LIGHT_GADGETS = ['torch', 'arclamp', 'kerosene'];
const NV_MODS = ['nspu', 'topoleye'];

export class TerrainPart {
  // ---------------------------------------------------------------- luz y oscuridad (fase 16.3)
  // ¿lleva luz encendida? (linternas, lámpara de queroseno propia o de un compañero a 3 casillas, linterna táctica)
  hasLightSource(sq) {
    const a = sq.a;
    if ([a.equip.g1, a.equip.g2].some((it) => it && LIGHT_GADGETS.includes(it.b))) return true;
    return [a.equip.w1, a.equip.w2].some((w) => w && w.mods && Object.values(w.mods).some((m) => m && m.b === 'light'));
  }
  agentLight(sq) {
    if (this.hasLightSource(sq) && !sq.lightOff) return true;
    return this.team.some((o) => o !== sq && !o.lightOff && cheb(o.x, o.y, sq.x, sq.y) <= 3 && [o.a.equip.g1, o.a.equip.g2].some((it) => it && it.b === 'kerosene'));
  }
  nightVision(sq) {
    const a = sq.a;
    return [a.equip.w1, a.equip.w2].some((w) => w && w.mods && Object.values(w.mods).some((m) => m && NV_MODS.includes(m.b)));
  }
  // radio de visión fuera de las zonas iluminadas
  darkRadius(sq, R) {
    if (this.agentLight(sq)) return R;
    if (this.nightVision(sq)) return Math.max(2, R - 1);
    return Math.max(2, Math.ceil(R / 2));
  }
  toggleLight(sq) {
    if (!this.hasLightSource(sq)) { this.say('Este agente no lleva linterna.', 'dimt'); return false; }
    sq.lightOff = !sq.lightOff;
    this.say(sq.lightOff ? `${this.nm(sq)} apaga la linterna: ve menos, pero cuesta más verle.` : `${this.nm(sq)} enciende la linterna: ve más lejos, pero delata su posición.`, 'dimt');
    this.computeVisibility(true);
    this.emit('update');
    return false;
  }
  // mapa de luz: sectores iluminados, lámparas, fuego y bengalas
  computeLight() {
    const N = this.w * this.h;
    if (!this.lightMap || this.lightMap.length !== N) this.lightMap = new Uint8Array(N);
    const L = this.lightMap;
    L.fill(0);
    const apagon = (this.mods || []).includes('apagon');
    // superficie: de día, todo lo que está al raso tiene luz
    if (this.surface && !this.isNight()) for (let k = 0; k < N; k++) if (!(this.indoor && this.indoor[k])) L[k] = 1;
    for (const s of this.sectors) {
      if (!((s.lit && !apagon) || (this.litOn && this.litOn[s.id]))) continue;
      for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) L[y * this.w + x] = 1;
    }
    const glow = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inb(x, y) || Math.hypot(x - cx, y - cy) > r + 0.3) continue;
        if (this.los(cx, cy, x, y)) L[y * this.w + x] = 1;
      }
    };
    this.lamps = [];
    for (let k = 0; k < N; k++) {
      const tt = this.t[k];
      if (tt === T.LAMP) { this.lamps.push(k); glow(k % this.w, (k / this.w) | 0, TILES[tt].light); }
      else if (this.fire[k]) glow(k % this.w, (k / this.w) | 0, 2);
    }
    for (const f of this.flares || []) glow(f.x, f.y, 5);
    this.lightDirty = false;
  }
  isLit(x, y) { return !!(this.lightMap && this.lightMap[this.key(x, y)]); }

  // ---------------------------------------------------------------- cobertura
  // −% de impacto si el objetivo está detrás de una casilla de cobertura (vista desde el tirador)
  coverAgainst(fx, fy, tx, ty) {
    if (cheb(fx, fy, tx, ty) <= 1) return 0;
    const pts = line(tx, ty, fx, fy);
    const p = pts[1];
    if (!p) return 0;
    const td = TILES[this.tile(p[0], p[1])];
    return td.cover || 0;
  }

  // ---------------------------------------------------------------- destructibles
  shootable(x, y) { return this.inb(x, y) && TILES[this.tile(x, y)].shoot; }
  shootTargets(sq) {
    const out = [];
    const ws = this.weaponStats(sq);
    if (ws.wtype === 'melee') return out;
    const R = (ws.range + (this.ast(sq).range || 0)) * 2;
    for (let y = Math.max(0, sq.y - R); y <= Math.min(this.h - 1, sq.y + R); y++) for (let x = Math.max(0, sq.x - R); x <= Math.min(this.w - 1, sq.x + R); x++) {
      if (!this.shootable(x, y) || !this.isVisible(x, y) && !this.visibleStructure(x, y)) continue;
      if (Math.hypot(x - sq.x, y - sq.y) > R) continue;
      out.push({ x, y, tile: true });
    }
    return out;
  }
  // las tuberías son opacas: se «ven» si alguna casilla vecina es visible
  visibleStructure(x, y) { return D8.some(([dx, dy]) => this.isVisible(x + dx, y + dy)) && this.explored[this.key(x, y)]; }
  // disparar a una casilla (barril, tubería, lámpara): gasta una bala
  shootTile(sq, x, y) {
    const sh = this.shootable(x, y);
    if (!sh) return false;
    const w = this.weapon(sq);
    const ws = this.weaponStats(sq);
    if (ws.wtype === 'melee') { this.say('Hace falta un arma de fuego.', 'dimt'); return false; }
    if (!w || !(w.ld > 0)) { this.say('Cargador vacío. Pulsa <b>R</b> para recargar.', 'bad'); return false; }
    w.ld--;
    this.flash(sq);
    const hit = rng.chance(0.88);
    this.fx.push({ type: 'shot', x0: sq.x, y0: sq.y, x1: x, y1: y, hit, wtype: ws.wtype });
    this.noise(sq.x, sq.y, ws.noise);
    if (!hit) { this.say(`${this.nm(sq)} falla contra ${SHOOT_NAME[sh]}.`, 'dimt'); return true; }
    this.breakTile(x, y, sq, 120);
    return true;
  }
  breakTile(x, y, src = null, delay = 0) {
    const k = this.key(x, y);
    const sh = TILES[this.t[k]].shoot;
    if (sh === 'barrel') {
      this.t[k] = T.RUBBLE;
      this.dirty = true;
      this.say('💥 ¡El barril de combustible revienta!', 'warn');
      this.explode(x, y, 2, [8, 16], src, 2, delay, { noise: 15 });
      for (const [dx, dy] of D8) if (this.walkTile(x + dx, y + dy)) this.igniteCell(x + dx, y + dy, 8);
    } else if (sh === 'pipe') {
      this.t[k] = T.PIPE_BROKEN;
      this.steam = this.steam || [];
      this.steam.push({ x, y, t: 12 });
      this.fx.push({ type: 'smoke', x, y, r: 1, delay });
      this.say('La tubería revienta: ¡vapor ardiente!', 'warn');
      this.noise(x, y, 8);
      this.dirty = true;
    } else if (sh === 'lamp') {
      this.t[k] = T.LAMP_BROKEN;
      this.fx.push({ type: 'zap', x, y });
      this.say('La lámpara estalla en una lluvia de chispas. Oscuridad.', 'dimt');
      this.lightDirty = true;
      this.dirty = true;
    }
  }
  // las explosiones rompen lo frágil, despejan derrumbes y raíces
  blastTerrain(x, y, r, src) {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (!this.inb(xx, yy) || Math.hypot(xx - x, yy - y) > r + 0.5) continue;
      const k = this.key(xx, yy);
      const tt = this.t[k];
      if (TILES[tt].shoot && !(xx === x && yy === y)) { const d = Math.hypot(xx - x, yy - y); this.pendingBreaks = this.pendingBreaks || []; this.pendingBreaks.push({ x: xx, y: yy, src, d }); }
      else if (tt === T.DEBRIS) { this.t[k] = T.RUBBLE; this.dirty = true; }
      else if (tt === T.ROOTS) { this.t[k] = T.CAVE; this.dirty = true; }
    }
  }
  flushBreaks() {
    // reacción en cadena (barriles junto a barriles), sin recursión infinita
    for (let guard = 0; guard < 20 && this.pendingBreaks && this.pendingBreaks.length; guard++) {
      const list = this.pendingBreaks; this.pendingBreaks = [];
      for (const b of list) if (TILES[this.tile(b.x, b.y)].shoot) this.breakTile(b.x, b.y, b.src, 200);
    }
  }

  // ---------------------------------------------------------------- pisar casillas
  // devuelve true si el paso cuesta un turno extra (resbalón)
  onStep(ent, isAgent) {
    const tt = this.tile(ent.x, ent.y);
    const td = TILES[tt];
    if (isAgent) {
      if (td.noise) {
        const silent = tt === T.GLASS && (ent.a.spec === 'explorador' || this.flag(ent, 'stealth') >= 3);
        if (!silent) { this.noise(ent.x, ent.y, td.noise); if (ent === this.cur && rng.chance(0.25)) this.say(tt === T.GLASS ? 'Los cristales crujen bajo tus botas.' : 'La pasarela metálica resuena.', 'dimt'); }
      }
      if (td.slip === 1) { if (ent === this.cur) this.say('Resbalas en el aceite: avanzas despacio.', 'dimt'); return true; }
      if (td.slip === 2 && rng.chance(0.25 - Math.min(0.15, (agentStats(ent.a).attrs.agi - 1) * 0.02))) { if (ent === this.cur) this.say(`¡${this.nm(ent)} resbala en el hielo y cae!`, 'warn'); return true; }
    } else if (td.slip) ent.energy -= 60;
    return false;
  }

  // ---------------------------------------------------------------- casillas que se usan (F)
  useTile(sq, x, y) {
    const k = this.key(x, y);
    const tt = this.t[k];
    const u = TILES[tt].use;
    const a = sq.a;
    if (u === 'armordoor') {
      const card = a.bag.find((it) => it.b === 'keycard');
      const torch = a.bag.find((it) => it.b === 'soplete');
      const tec = agentStats(a).attrs.tec;
      let how = null;
      if (card) { this.consume(sq, card); how = 'pasa la tarjeta magnética'; }
      else if (tec >= 7) how = 'puentea el cierre electrónico';
      else if (torch) { this.consume(sq, torch); how = 'corta las bisagras con el soplete'; this.noise(x, y, 8); }
      if (!how) { this.say('Puerta blindada: hace falta una <b>tarjeta</b>, <b>Técnica 7</b>, un <b>soplete</b> o piratear un <b>terminal</b> cercano.', 'warn'); return false; }
      this.t[k] = T.DOOR_OPEN;
      this.dirty = true; this.lightDirty = true;
      this.fx.push({ type: 'door', x, y });
      this.say(`${this.nm(sq)} ${how}. La puerta blindada se abre.`, 'good');
      this.gainXp(sq, 5, true);
      return true;
    }
    if (u === 'terminal') {
      const tec = agentStats(a).attrs.tec;
      const chance = Math.min(95, 25 + tec * 8);
      this.termFails = this.termFails || {};
      if (!rng.chance(chance / 100)) {
        this.termFails[k] = (this.termFails[k] || 0) + 1;
        this.noise(x, y, 10);
        if (this.termFails[k] >= 3) { this.t[k] = T.TERMINAL_DONE; this.dirty = true; this.say('¡ALARMA! El terminal se bloquea para siempre.', 'bad'); }
        else this.say(`Acceso denegado (${chance}%). Suena una alarma… <span class="dimt">(${3 - this.termFails[k]} intento(s) más)</span>`, 'bad');
        return true;
      }
      this.t[k] = T.TERMINAL_DONE;
      const s = this.sectorAt(x, y);
      let doors = 0;
      let cells = 0;
      for (let kk = 0; kk < this.t.length; kk++) {
        if (this.t[kk] === T.CELL && this.sec[kk] === (s ? s.id : -1)) { this.t[kk] = T.FLOOR; cells++; continue; }
        if (this.t[kk] !== T.ARMORDOOR) continue;
        const ds = this.sec[kk];
        if (s && Math.abs(this.sectors[ds].i - s.i) + Math.abs(this.sectors[ds].j - s.j) > 1) continue;
        this.t[kk] = T.DOOR_OPEN; doors++;
      }
      if (s) {
        (this.litOn = this.litOn || {})[s.id] = 1;
        for (let yy = s.y; yy < s.y + s.h; yy++) for (let xx = s.x; xx < s.x + s.w; xx++) if (this.t[this.key(xx, yy)] !== T.ROCK) this.explored[this.key(xx, yy)] = 1;
      }
      this.dirty = true; this.lightDirty = true;
      this.fx.push({ type: 'zap', x, y });
      this.say(`▣ ${this.nm(sq)} piratea el terminal: ${doors ? `${doors} puerta(s) blindada(s) abiertas, ` : ''}${cells ? `<span class="bad">${cells} celda(s) de contención abiertas</span>, ` : ''}luces encendidas y plano del sector descargado.`, 'good');
      if (cells) for (const e of this.enemies) if (e.state === 'dormido' && this.sectorAt(e.x, e.y) === s) { e.state = 'alerta'; e.mem = 15; }
      this.gainXp(sq, 8, true);
      return true;
    }
    if (u === 'switch') {
      this.t[k] = T.SWITCH_ON;
      const s = this.sectorAt(x, y);
      if (s) (this.litOn = this.litOn || {})[s.id] = 1;
      this.lightDirty = true; this.dirty = true;
      this.noise(x, y, 6);
      this.say(`¥ ${this.nm(sq)} acciona el interruptor: las luces del sector ${s ? s.code : ''} parpadean y se encienden.`, 'o1');
      return true;
    }
    if (u === 'graphite') {
      this.sampled = this.sampled || {};
      if (this.sampled[k]) { this.say('Ya has tomado muestras de aquí.', 'dimt'); return false; }
      const it = createItem('graphsample', 0, rng);
      if (mergeInto(a.bag, it, bagCapacity(a))) { this.say('Mochila llena.', 'bad'); return false; }
      this.sampled[k] = 1;
      a.rad = Math.min(150, a.rad + 8);
      this.say(`${this.nm(sq)} arranca una muestra de grafito (+8 radiación). Material de investigación.`, 'o1');
      return true;
    }
    if (u === 'lift' || u === 'liftup' || u === 'chasm') return this.useConnector(sq, x, y, u);
    if (u === 'dig') return this.digTile(sq, x, y);
    if (u === 'antenna') return this.useAntenna(sq, x, y);
    return false;
  }

  // ---------------------------------------------------------------- fase 17: mecánicas de zona
  // excavar una fosa del Bosque Rojo
  digTile(sq, x, y) {
    const k = this.key(x, y);
    const a = sq.a;
    const st = this.ast(sq);
    a.rad = Math.min(150, a.rad + 6 * (1 - st.rad / 100));
    this.t[k] = T.GROUND;
    this.dirty = true;
    this.noise(x, y, 4);
    if (rng.chance(0.45)) {
      const it = rollLoot(Math.min(10, this.def.lvl[1] + 1), rng, { rarityBonus: 0.3, catW: { valuable: 30, weapon: 10, gadget: 8 } });
      this.addFloor(x, y, it);
      this.say(`${this.nm(sq)} excava en la fosa (+radiación) y desentierra algo.`, 'good');
      this.emit('loot', { floor: true, x, y });
    } else this.say(`${this.nm(sq)} excava en la fosa (+radiación). Solo tierra y huesos de pino.`, 'dimt');
    if (rng.chance(0.12)) {
      const spot = D8.map(([dx, dy]) => [x + dx, y + dy]).find(([xx, yy]) => this.passable(xx, yy) && !this.entityAt(xx, yy));
      if (spot) { this.spawnEnemy(rng.pick(['liana', 'musgo']), this.def.lvl[1], spot[0], spot[1], 'alerta'); this.say('¡Algo se retuerce bajo la tierra removida!', 'bad'); this.computeVisibility(); }
    }
    return true;
  }
  // la antena Duga-3: revela todo… y atrae a todo
  useAntenna(sq, x, y) {
    if (this.antennaUsed) { this.say('La antena ya está en marcha.', 'dimt'); return false; }
    this.antennaUsed = 1;
    this.t[this.key(x, y)] = T.ANTENNA_ON;
    for (let k = 0; k < this.t.length; k++) if (this.t[k] !== T.ROCK) this.explored[k] = 1;
    this.revealT = 30;
    for (const e of this.enemies) if (this.hostile(sq, e) && !ACTORS[e.type].abil.includes('stationary')) { e.state = 'alerta'; e.mem = 30; e.lx = sq.x; e.ly = sq.y; }
    this.dirty = true;
    this.fx.push({ type: 'surge' });
    this.say('Ψ ¡La antena Duga-3 vuelve a la vida! Un zumbido grave recorre la zona: todo el mapa aparece en vuestras pantallas durante 30 turnos… y todo lo que vive aquí sabe dónde estáis.', 'warn');
    this.gainXp(sq, 10, true);
    return true;
  }
  // ruido de los columpios de Prípiat
  creak(sq) {
    if (!D8.some(([dx, dy]) => this.tile(sq.x + dx, sq.y + dy) === T.SWING)) return;
    if (!rng.chance(this.weather === 'viento' ? 0.8 : 0.5)) return;
    this.noise(sq.x, sq.y, 7);
    if (sq === this.cur) this.say('El columpio chirría… y el eco llega lejos.', 'dimt');
  }
  // cada turno: tren fantasma, antena, paredes que respiran, incursiones, clima
  zoneTick() {
    if (this.revealT > 0) this.revealT--;
    // viento: el gas se va enseguida
    if (this.surface && this.weather === 'viento') for (let k = 0; k < this.gas.length; k++) if (this.gas[k]) this.gas[k] = Math.max(0, this.gas[k] - 2);
    // tren fantasma de Yanov
    if (this.trainAt && this.railRows && this.railRows.length && this.floor === 0) {
      if (this.turn === this.trainAt - 4) this.say('📻 Un silbato de locomotora resuena en el depósito. No hay ninguna locomotora en marcha… que se sepa. <b>Apartaos de las vías.</b>', 'warn');
      if (this.turn >= this.trainAt) {
        const c = this.cur;
        const row = this.railRows.reduce((b, y) => (Math.abs(y - c.y) < Math.abs(b - c.y) ? y : b), this.railRows[0]);
        let hit = 0;
        for (let x = 0; x < this.w; x++) {
          const ent = this.entityAt(x, row);
          if (!ent || this.tile(x, row) !== T.RAIL) continue;
          if (ent.type) { this.damageEnemy(ent, rng.int(25, 40), null); hit++; }
          else if (ent.id) { this.damageAgent(ent, rng.int(18, 30), 'el tren fantasma'); hit++; }
        }
        this.fx.push({ type: 'train', y: row });
        this.noise(c.x, row, 18);
        this.say(`🚂 ¡El tren fantasma pasa a toda velocidad por la vía ${row}!${hit ? ` Arrolla a ${hit}.` : ''} Nadie va a bordo.`, 'bad');
        this.trainAt = this.turn + rng.int(80, 140);
      }
    }
    // Las Raíces: las paredes se abren y se cierran
    if (this.def.special === 'raices' && this.turn % 8 === 0) {
      let opened = 0, closed = 0;
      for (let tries = 0; tries < 600 && (opened < 6 || closed < 5); tries++) {
        const k = rng.int(0, this.t.length - 1);
        const x = k % this.w, y = (k / this.w) | 0;
        if (x < 2 || y < 2 || x >= this.w - 2 || y >= this.h - 2) continue;
        if (this.team.some((q) => cheb(q.x, q.y, x, y) <= 3)) continue;
        if (this.t[k] === T.ORGWALL && opened < 6 && D8.some(([dx, dy]) => this.tile(x + dx, y + dy) === T.CAVE)) { this.t[k] = T.CAVE; opened++; }
        else if (this.t[k] === T.CAVE && closed < 5 && !this.entityAt(x, y) && !this.objAt(x, y) && !this.floorAt(x, y).length && !this.essence.has(k) && D8.every(([dx, dy]) => TILES[this.tile(x + dx, y + dy)].walk)) { this.t[k] = T.ORGWALL; closed++; }
      }
      if (opened || closed) { this.dirty = true; this.dmap = null; if (rng.chance(0.25)) this.say('Las paredes respiran: el túnel no es el mismo que hace un momento.', 'dimt'); }
    }
    // incursión nocturna en el campamento Wismut
    if (this.raidAt && this.def.social) {
      if (this.turn === this.raidAt - 6) this.say('📻 Puesto de radio de Wismut: «¡Movimiento en los pozos de ventilación! ¡Todos a sus puestos!»', 'warn');
      if (this.turn === this.raidAt) {
        this.raidAt = 0;
        let n = 0;
        for (let i = 0; i < 6; i++) {
          for (let tries = 0; tries < 80; tries++) {
            const x = rng.int(2, this.w - 3), y = rng.int(2, this.h - 3);
            if (!this.passable(x, y) || this.entityAt(x, y) || this.team.some((q) => cheb(q.x, q.y, x, y) < 10)) continue;
            this.spawnEnemy(rng.pick(this.def.enemies), rng.int(this.def.lvl[0], this.def.lvl[1]), x, y, 'alerta');
            n++;
            break;
          }
        }
        this.say(`⚠ ¡Incursión! ${n} chebylitas bajan por los pozos del campamento.`, 'bad');
        this.interrupt = true;
      }
    }
  }

  // ---------------------------------------------------------------- empujar la vagoneta
  pushCart(sq, o, dx, dy) {
    let x = o.x, y = o.y, n = 0, hits = 0;
    const lvl = sq.a.lvl;
    while (n < 8) {
      const nx = x + dx, ny = y + dy;
      if (!this.inb(nx, ny) || this.tile(nx, ny) !== T.RAIL || this.blockedObj(nx, ny)) break;
      const ent = this.entityAt(nx, ny);
      if (ent && ent.id) break;
      if (ent && ent.type) {
        this.damageEnemy(ent, rng.int(12, 20) + lvl * 2, sq, false, n * 60);
        hits++;
        if (ent.hp > 0) break;
      }
      x = nx; y = ny; n++;
    }
    if (!n) { this.say('La vagoneta no se mueve en esa dirección (solo va por los raíles).', 'dimt'); return false; }
    this.objMap.delete(this.key(o.x, o.y));
    o.x = x; o.y = y;
    this.objMap.set(this.key(x, y), o);
    this.noise(x, y, 9);
    this.dirty = true;
    this.say(`${this.nm(sq)} empuja la vagoneta: rueda ${n} casillas${hits ? ` y arrolla a ${hits} enemigo(s)` : ''} con estruendo.`, hits ? 'good' : 'o1');
    return true;
  }

  // ---------------------------------------------------------------- escombros inestables
  collapseNear(x, y, r) {
    let n = 0;
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (!this.inb(xx, yy) || this.tile(xx, yy) !== T.UNSTABLE || !rng.chance(0.55)) continue;
      const k = this.key(xx, yy);
      const ent = this.entityAt(xx, yy);
      this.t[k] = ent ? T.RUBBLE : T.DEBRIS;
      this.fx.push({ type: 'smoke', x: xx, y: yy, r: 0 });
      for (const [dx, dy] of [[0, 0], ...D8]) {
        const e2 = this.entityAt(xx + dx, yy + dy);
        if (!e2) continue;
        const dmg = rng.int(4, 9) + (dx || dy ? 0 : 4);
        if (e2.type) this.damageEnemy(e2, dmg, null);
        else if (e2.id) this.damageAgent(e2, dmg, 'derrumbe');
      }
      n++;
    }
    if (n) { this.say(`El techo cede: ${n} casilla(s) de escombros se derrumban.`, 'warn'); this.dirty = true; this.dmap = null; }
  }

  // ---------------------------------------------------------------- cortar raíces / apartar derrumbes
  clearObstacle(sq, x, y) {
    const k = this.key(x, y);
    const tt = this.t[k];
    if (tt === T.ROOTS) {
      const ws = this.weaponStats(sq);
      if (ws.wtype !== 'melee' && ws.wtype !== 'flame') { this.say('Las raíces se cortan con un arma cuerpo a cuerpo (o se queman).', 'dimt'); return false; }
      this.t[k] = T.CAVE;
      this.fx.push({ type: 'slash', x0: sq.x, y0: sq.y, x1: x, y1: y });
      this.say(`${this.nm(sq)} corta las raíces.`, 'dimt');
      this.dirty = true; this.dmap = null;
      return true;
    }
    if (tt === T.DEBRIS) {
      if (rng.chance(0.5)) { this.t[k] = T.RUBBLE; this.say(`${this.nm(sq)} aparta los escombros: hay paso.`, 'dimt'); this.dirty = true; this.dmap = null; }
      else this.say(`${this.nm(sq)} aparta escombros… todavía no hay paso.`, 'dimt');
      this.noise(sq.x, sq.y, 4);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- cada turno
  terrainTick() {
    // vapor de tuberías reventadas
    if (this.steam && this.steam.length) {
      for (const st of this.steam) {
        st.t--;
        for (const [dx, dy] of D8) {
          const x = st.x + dx, y = st.y + dy;
          if (!this.walkTile(x, y)) continue;
          this.smoke[this.key(x, y)] = Math.max(this.smoke[this.key(x, y)], 2);
          const ent = this.entityAt(x, y);
          if (!ent) continue;
          if (ent.type) this.damageEnemy(ent, rng.int(2, 4), null);
          else if (ent.id && !this.flag(ent, 'fireImmune')) this.damageAgent(ent, rng.int(2, 4), 'vapor ardiente');
        }
        if (st.t <= 0) { this.t[this.key(st.x, st.y)] = T.PIPE; this.dirty = true; }
      }
      this.steam = this.steam.filter((st) => st.t > 0);
    }
    // ventiladores: dispersan el gas
    if (this.fans == null) { this.fans = []; for (let k = 0; k < this.t.length; k++) if (this.t[k] === T.FAN) this.fans.push(k); }
    for (const k of this.fans) {
      const fx = k % this.w, fy = (k / this.w) | 0;
      for (let y = fy - 4; y <= fy + 4; y++) for (let x = fx - 4; x <= fx + 4; x++) if (this.inb(x, y)) { const kk = this.key(x, y); if (this.gas[kk]) this.gas[kk] = Math.max(0, this.gas[kk] - 3); }
    }
    // fuego: el aceite arde con fuerza y los barriles cercanos estallan; las raíces se queman
    for (let k = 0; k < this.fire.length; k++) {
      if (!this.fire[k]) continue;
      const x = k % this.w, y = (k / this.w) | 0;
      for (const [dx, dy] of D8) {
        if (!this.inb(x + dx, y + dy)) continue;
        const nk = this.key(x + dx, y + dy);
        const nt = this.t[nk];
        if (nt === T.OIL && this.fire[nk] < 4) this.fire[nk] = 10;
        else if (nt === T.BARREL && rng.chance(0.25)) { this.pendingBreaks = this.pendingBreaks || []; this.pendingBreaks.push({ x: x + dx, y: y + dy, src: null }); }
        else if (nt === T.ROOTS && rng.chance(0.3)) { this.t[nk] = T.CAVE; this.fire[nk] = 5; this.dirty = true; }
      }
      if (this.t[k] === T.OIL && this.fire[k] <= 1) this.t[k] = T.RUBBLE;
    }
    this.flushBreaks();
    // raíces de la Raíz-madre: crecen cada 15 turnos
    if (this.turn % 15 === 0) {
      if (this.roots == null) { this.roots = 0; for (let k = 0; k < this.t.length; k++) if (this.t[k] === T.ROOTS) this.roots++; }
      if (this.roots > 0) {
        let grown = 0;
        for (let tries = 0; tries < 400 && grown < 3; tries++) {
          const k = rng.int(0, this.t.length - 1);
          if (this.t[k] !== T.ROOTS) continue;
          const x = k % this.w, y = (k / this.w) | 0;
          const [dx, dy] = rng.pick(D8);
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny) || this.tile(nx, ny) !== T.CAVE || this.entityAt(nx, ny) || this.objAt(nx, ny) || this.floorAt(nx, ny).length) continue;
          if (this.team.some((q) => cheb(q.x, q.y, nx, ny) <= 1)) continue;
          this.t[this.key(nx, ny)] = T.ROOTS; grown++; this.roots++;
        }
        if (grown) { this.dirty = true; this.dmap = null; if (this.team.some((q) => this.isVisible(q.x, q.y) && rng.chance(0.3))) this.say('Algo cruje en la oscuridad: las raíces avanzan.', 'dimt'); }
      }
    }
  }
}

