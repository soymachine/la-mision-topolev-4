// Expedición · IA: compañeros y actores no jugadores
// (métodos mezclados en Expedition: ver expedition.js)
/* eslint-disable no-unused-vars */
import { RNG, rng, clamp, cheb, line, uid } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { MAPS } from '../data/world.js';
import { ENEMIES, scaleEnemy, enemyColor } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { computeFOV, hasLOS } from './fov.js';
import { astar, dijkstra } from './path.js';
import { itemStats, itemName, createItem, rollLoot, mergeInto, rarityColor, gadgetExtras } from '../core/items.js';
import { agentStats, agentName, giveXp, bagCapacity } from '../core/agents.js';
import { S, seeEnemy, killEnemy as bestiaryKill } from '../core/state.js';
import { esc } from '../util/dom.js';
import { RADIO } from '../data/lore.js';
import { D8, FISTS, BLOCKING_OBJ, ESSENCE_COLOR } from './shared.js';
import { ACTORS, actorColor, actorFaction } from '../data/actors.js';
import { HUMANS } from '../data/humans.js';

export class AIPart {
  // ---------------------------------------------------------------- IA de compañeros
  companionAct(sq) {
    const a = sq.a;
    const st = this.ast(sq);
    // curarse si está mal
    if (a.hp < st.hpMaxEff * 0.35) {
      const heal = a.bag.filter((it) => ITEMS[it.b].use === 'heal').sort((x, y) => ITEMS[x.b].heal - ITEMS[y.b].heal)[0];
      if (heal) { this.useItem(sq, heal); return; }
    }
    const ws = this.weaponStats(sq);
    const w = this.weapon(sq);
    // disparar
    if (sq.order !== 'pasivo') {
      let best = null, bd = 1e9;
      for (const e of this.enemies) {
        if (!this.isVisible(e.x, e.y) || !this.hostile(sq, e)) continue;
        const d = Math.hypot(e.x - sq.x, e.y - sq.y);
        if (d < bd && this.canShoot(sq, e) === 'ok' && (ws.wtype !== 'melee' ? d <= ws.range * 1.5 : true)) { best = e; bd = d; }
      }
      if (best) { this.attack(sq, best); return; }
      // recargar si está vacío y hay enemigos cerca
      if (w && ws.mag && w.ld < ws.mag * 0.3 && this.ammoFor(sq) > 0) { this.reload(sq, true); return; }
      // cambiar a la otra arma si esta está seca
      if (w && ws.mag && w.ld === 0 && this.ammoFor(sq) === 0) {
        const other = sq.cur === 'w1' ? 'w2' : 'w1';
        if (a.equip[other]) { sq.cur = other; return; }
      }
    }
    if (sq.order === 'mantener') return;
    // seguir al líder (o acudir a la evacuación)
    let lead = this.cur;
    let near = 2;
    if (this.evac) {
      if (cheb(sq.x, sq.y, this.evac.x, this.evac.y) <= 1) return;
      lead = { x: this.evac.x, y: this.evac.y };
      near = 0;
    }
    const d = cheb(sq.x, sq.y, lead.x, lead.y);
    if (d <= near) return;
    const path = astar(this.w, this.h, sq.x, sq.y, lead.x, lead.y, (x, y) => (this.passable(x, y) && !this.enemyAt(x, y) ? (this.agentAt(x, y) ? 4 : this.hazardCost(x, y)) : Infinity), 2500);
    if (path && (path.length > 1 || (this.evac && path.length))) {
      const [nx, ny] = path[0];
      if (!this.entityAt(nx, ny)) {
        if (this.tile(nx, ny) === T.DOOR) this.t[this.key(nx, ny)] = T.DOOR_OPEN;
        this.moveEntity(sq, nx, ny); this.onAgentEnter(sq);
      }
    }
  }
  hazardCost(x, y) {
    const k = this.key(x, y);
    return 1 + (this.fire[k] ? 8 : 0) + (this.gas[k] ? 4 : 0) + (this.anomaly[k] ? 5 : 0) + (this.rad[k] > 1 ? 2 : 0);
  }

  // ---------------------------------------------------------------- IA enemiga
  getDmap() {
    if (!this.dmap) {
      const goals = this.team.map((s) => [s.x, s.y]);
      this.dmap = dijkstra(this.w, this.h, goals, (x, y) => this.walkTile(x, y) && !this.blockedObj(x, y), 60);
    }
    return this.dmap;
  }
  canEnemyStep(e, x, y) {
    if (!this.inb(x, y)) return false;
    const tt = this.tile(x, y);
    const def = ACTORS[e.type];
    if (!TILES[tt].walk && !(tt === T.DEEP && def.abil.includes('flying'))) return false;
    if (this.blockedObj(x, y)) return false;
    if (this.entityAt(x, y)) return false;
    return true;
  }
  enemyStepTo(e, x, y) {
    if (this.tile(x, y) === T.DOOR) { this.t[this.key(x, y)] = T.DOOR_OPEN; this.dirty = true; }
    this.moveEntity(e, x, y);
    if (this.traps.length && this.attitudeToSquad(e) === 'hostile') this.checkTrap(e);
  }
  enemyLOS(e, sq) { return this.los(e.x, e.y, sq.x, sq.y); }

  // objetivo hostil visible más cercano (agentes u otros actores)
  pickTarget(e, sight, dormant = false) {
    let tgt = null, td = 1e9;
    for (const c of this.combatants()) {
      if (c === e) continue;
      const d = Math.hypot(c.x - e.x, c.y - e.y);
      if (d > sight || d >= td) continue;
      if (!this.hostile(e, c)) continue;
      if (c.a && d > 1.5 && this.flag(c, 'vanish')) continue; // Desaparecer (Explorador)
      const sg = dormant && this.isSquad(c) ? Math.max(1, sight - this.flag(c, 'stealth')) : sight;
      if (d <= sg && this.los(e.x, e.y, c.x, c.y)) { tgt = c; td = d; }
    }
    return [tgt, td];
  }
  moveToward(e, tgt) {
    if (this.isSquad(tgt)) this.followDmap(e);
    else if (!this.greedyStep(e, tgt.x, tgt.y)) this.randomStep(e);
  }

  enemyAct(e) {
    if (HUMANS[e.type]) { this.humanAct(e); return; }
    const def = ACTORS[e.type];
    const abil = def.abil;
    const st = this.est(e);
    const sight = e.state === 'dormido' ? 4 + Math.floor(e.lvl / 3) : 11;
    const [tgt, td] = this.pickTarget(e, sight, e.state === 'dormido');
    if (e.state === 'dormido') {
      if (tgt) { e.state = 'alerta'; e.mem = 15; this.alertNest(e); this.fx.push({ type: 'wake', x: e.x, y: e.y }); }
      return;
    }
    if (tgt) { e.state = 'alerta'; e.mem = 15; e.lure = null; }
    // señuelo
    if (e.lure && e.lure.t > 0 && !tgt) {
      e.lure.t--;
      this.greedyStep(e, e.lure.x, e.lure.y);
      return;
    }
    if (e.state === 'errante' && !tgt) { this.wander(e); return; }
    if (!tgt) {
      e.mem--;
      if (e.mem <= 0) { e.state = 'errante'; return; }
      if (!abil.includes('stationary')) this.followDmap(e);
      return;
    }
    // habilidades
    const adj = cheb(e.x, e.y, tgt.x, tgt.y) <= 1;
    if (abil.includes('explode') && adj) { this.sporeBurst(e); return; }
    if (abil.includes('spawn')) {
      e.cd = (e.cd || 0) - 1;
      if (e.cd <= 0 && e.kids < 4) {
        e.cd = 6;
        const spot = D8.map(([dx, dy]) => [e.x + dx, e.y + dy]).find(([x, y]) => this.canEnemyStep(e, x, y));
        if (spot) {
          const c = this.spawnEnemy('musgo', e.lvl, spot[0], spot[1], 'alerta', e.poi);
          c.spawned = 1; e.kids++;
          this.fx.push({ type: 'spawn', x: spot[0], y: spot[1] });
          if (this.isVisible(e.x, e.y)) this.say(`${this.enm(e)} engendra un ${this.enm(c)}.`, 'warn');
          return;
        }
      }
    }
    if (abil.includes('summon')) {
      e.cd = (e.cd || 0) - 1;
      if (e.cd <= 0) {
        e.cd = 8;
        let n = 0;
        for (const [dx, dy] of rng.shuffle([...D8])) {
          if (n >= 2) break;
          const x = e.x + dx * 2, y = e.y + dy * 2;
          if (this.canEnemyStep(e, x, y)) { const c = this.spawnEnemy('lobo', Math.max(1, e.lvl - 2), x, y, 'alerta', e.poi); c.spawned = 1; n++; this.fx.push({ type: 'spawn', x, y }); }
        }
        if (n) { this.say(`${this.enm(e)} aúlla: ¡acuden lobos de grafito!`, 'warn'); return; }
      }
    }
    if (abil.includes('charge') && !adj) {
      e.cd2 = (e.cd2 || 0) - 1;
      const dx = tgt.x - e.x, dy = tgt.y - e.y;
      const straight = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
      if (straight && td <= 5 && e.cd2 <= 0) {
        e.cd2 = 4;
        const sx = Math.sign(dx), sy = Math.sign(dy);
        let moved = 0;
        while (e.hp > 0 && cheb(e.x, e.y, tgt.x, tgt.y) > 1 && this.canEnemyStep(e, e.x + sx, e.y + sy)) { this.enemyStepTo(e, e.x + sx, e.y + sy); moved++; }
        if (e.hp <= 0) return;
        this.fx.push({ type: 'charge', x: e.x, y: e.y });
        if (cheb(e.x, e.y, tgt.x, tgt.y) <= 1) { this.enemyMelee(e, tgt, 1.6, 'embestida'); return; }
        if (moved) return;
      }
    }
    const reach = def.range;
    if (abil.includes('ranged') && td <= reach && !(adj && reach <= 1)) { this.enemyRanged(e, tgt); return; }
    if (td <= (reach >= 2 && !abil.includes('ranged') ? reach + 0.5 : 1.5)) { this.enemyMelee(e, tgt); return; }
    if (abil.includes('stationary')) return;
    if (abil.includes('erratic') && rng.chance(0.3)) { this.randomStep(e); return; }
    this.moveToward(e, tgt);
  }

  followDmap(e) {
    const dm = this.getDmap();
    const cur = dm[this.key(e.x, e.y)];
    let best = null, bv = cur;
    for (const [dx, dy] of rng.shuffle([...D8])) {
      const nx = e.x + dx, ny = e.y + dy;
      if (!this.canEnemyStep(e, nx, ny)) continue;
      const v = dm[this.key(nx, ny)];
      if (v < bv) { bv = v; best = [nx, ny]; }
    }
    if (best) this.enemyStepTo(e, best[0], best[1]);
    else if (cur === 32767) this.wander(e);
  }
  greedyStep(e, tx, ty) {
    let best = null, bd = Math.hypot(tx - e.x, ty - e.y);
    for (const [dx, dy] of D8) {
      const nx = e.x + dx, ny = e.y + dy;
      if (!this.canEnemyStep(e, nx, ny)) continue;
      const d = Math.hypot(tx - nx, ty - ny);
      if (d < bd - 0.01) { bd = d; best = [nx, ny]; }
    }
    if (best) { this.enemyStepTo(e, best[0], best[1]); return true; }
    return false;
  }
  randomStep(e) {
    const opts = D8.map(([dx, dy]) => [e.x + dx, e.y + dy]).filter(([x, y]) => this.canEnemyStep(e, x, y));
    if (opts.length) { const [x, y] = rng.pick(opts); this.enemyStepTo(e, x, y); }
  }
  wander(e) {
    if (ACTORS[e.type].abil.includes('stationary')) return;
    if (ACTORS[e.type].abil.includes('erratic') && rng.chance(0.5)) { this.randomStep(e); return; }
    if (!e.wt || (e.x === e.wt[0] && e.y === e.wt[1]) || rng.chance(0.04)) {
      for (let i = 0; i < 20; i++) {
        const x = e.x + rng.int(-12, 12), y = e.y + rng.int(-12, 12);
        if (this.passable(x, y)) { e.wt = [x, y]; break; }
      }
    }
    if (rng.chance(0.5)) return; // los errantes se mueven despacio
    if (e.wt && !this.greedyStep(e, e.wt[0], e.wt[1])) { e.wt = null; this.randomStep(e); }
  }

  // defensa de un objetivo (agente o actor): esquiva en % y protección
  defenseOf(t) {
    if (this.isSquad(t)) { const st = this.ast(t); return { ev: st.ev * 2, prot: st.prot }; }
    const es = this.est(t);
    return { ev: es.ev, prot: es.armor };
  }
  enemyMelee(e, t, mult = 1, verb = null) {
    const def = ACTORS[e.type];
    const st = this.est(e);
    const dfn = this.defenseOf(t);
    const hc = clamp(st.acc - dfn.ev, 5, 95);
    this.fx.push({ type: 'bite', x0: e.x, y0: e.y, x1: t.x, y1: t.y, color: actorColor(e) });
    if (rng.int(1, 100) > hc) { this.fx.push({ type: 'miss', x: t.x, y: t.y, delay: 80 }); return; }
    let dmg = Math.round(rng.int(st.dmg[0], st.dmg[1]) * mult);
    dmg = Math.max(1, dmg - dfn.prot);
    if (!this.isSquad(t)) { this.damageEnemy(t, dmg, e, false, 80); return; }
    const sq = t;
    const ast = this.ast(sq);
    if (sq === this.cur || def.boss) this.say(`${this.enm(e)} ${verb ? 'te golpea con una ' + verb : 'ataca a'} ${this.nm(sq)}: <span class="bad">−${dmg}</span>.`);
    this.damageAgent(sq, dmg, `${def.name} Nv ${e.lvl}`, e, 80);
    if (!this.inMap(sq)) return;
    const th = this.flag(sq, 'thorns');
    if (th && e.hp > 0) this.damageEnemy(e, th, sq, false, 120);
    if (def.abil.includes('poison')) this.addPoison(sq, 2 + Math.floor(e.lvl / 3));
    if (def.abil.includes('radbite')) sq.a.rad += (2 + e.lvl) * (1 - ast.rad / 100);
  }
  enemyRanged(e, t) {
    const def = ACTORS[e.type];
    const st = this.est(e);
    const dfn = this.defenseOf(t);
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    const hc = clamp(st.acc - dfn.ev - Math.max(0, d - 4) * 3, 5, 95);
    const hit = rng.int(1, 100) <= hc;
    this.fx.push({ type: 'ebolt', x0: e.x, y0: e.y, x1: t.x, y1: t.y, hit, color: actorColor(e, Math.max(6, e.lvl)) });
    if (!hit) { this.fx.push({ type: 'miss', x: t.x, y: t.y, delay: 140 }); return; }
    const dmg = Math.max(1, rng.int(st.dmg[0], st.dmg[1]) - dfn.prot);
    if (!this.isSquad(t)) { this.damageEnemy(t, dmg, e, false, 140); return; }
    const sq = t;
    this.say(`${this.enm(e)} alcanza a ${this.nm(sq)}: <span class="bad">−${dmg}</span>.`);
    this.damageAgent(sq, dmg, `${def.name} Nv ${e.lvl}`, e, 140);
    if (this.inMap(sq) && def.abil.includes('radbite')) sq.a.rad += (2 + e.lvl * 0.8) * (1 - this.ast(sq).rad / 100);
  }

  // ---------------------------------------------------------------- IA humana (otras expediciones)
  humanAct(e) {
    const def = ACTORS[e.type];
    const ws = e.w ? itemStats(e.w) : FISTS;
    const [tgt, td] = this.pickTarget(e, 12);
    if (tgt) { e.state = 'alerta'; e.mem = 12; e.lx = tgt.x; e.ly = tgt.y; }
    if (tgt) {
      // retirada con poca salud
      if (e.hp < e.hpMax * 0.3 && rng.chance(def.flee)) { if (this.stepAway(e, tgt)) return; }
      // recargar
      if (ws.mag && e.ld <= 0) {
        e.ld = ws.mag;
        if (this.isVisible(e.x, e.y)) this.fx.push({ type: 'reload', x: e.x, y: e.y });
        return;
      }
      const adj = cheb(e.x, e.y, tgt.x, tgt.y) <= 1;
      if (ws.wtype === 'melee') { if (adj) this.humanShoot(e, tgt, ws); else this.moveToward(e, tgt); return; }
      if (td <= ws.range * 1.6) {
        // los tiradores prefieren mantener la distancia
        if (ws.scope && td < 3 && rng.chance(0.6) && this.stepAway(e, tgt)) return;
        this.humanShoot(e, tgt, ws);
        return;
      }
      this.moveToward(e, tgt);
      return;
    }
    // sin objetivo: recuerda la última posición
    if (e.state === 'alerta' && e.mem > 0 && e.lx != null) {
      e.mem--;
      if (!this.greedyStep(e, e.lx, e.ly)) e.mem = 0;
      return;
    }
    e.state = 'errante';
    if (ws.mag && e.ld < ws.mag) { e.ld = ws.mag; return; }
    // vuelve cerca de su campamento y patrulla
    if (e.home && Math.hypot(e.home[0] - e.x, e.home[1] - e.y) > 10) { this.greedyStep(e, e.home[0], e.home[1]); return; }
    this.wander(e);
  }
  stepAway(e, t) {
    let best = null, bd = Math.hypot(t.x - e.x, t.y - e.y);
    for (const [dx, dy] of D8) {
      const nx = e.x + dx, ny = e.y + dy;
      if (!this.canEnemyStep(e, nx, ny)) continue;
      const d = Math.hypot(t.x - nx, t.y - ny);
      if (d > bd + 0.01) { bd = d; best = [nx, ny]; }
    }
    if (best) { this.enemyStepTo(e, best[0], best[1]); return true; }
    return false;
  }
  humanShoot(e, t, ws) {
    const st = this.est(e);
    const dfn = this.defenseOf(t);
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    const melee = ws.wtype === 'melee';
    const shots = melee ? 1 : Math.max(1, Math.min(ws.burst || 1, e.ld || 0));
    if (!melee && !this.los(e.x, e.y, t.x, t.y)) { this.moveToward(e, t); return; }
    this.fx.push({ type: 'muzzle', x: e.x, y: e.y });
    for (let i = 0; i < shots; i++) {
      if (!melee) e.ld--;
      let hc = ws.acc + st.acc * 2 - dfn.ev;
      if (!melee && d > ws.range) hc -= (d - ws.range) * 7;
      if (ws.scope && d < 2) hc -= 20;
      hc = clamp(Math.round(hc), 5, 95);
      const hit = rng.int(1, 100) <= hc;
      this.fx.push({ type: melee ? 'slash' : 'shot', x0: e.x, y0: e.y, x1: t.x, y1: t.y, hit, delay: i * 70, wtype: ws.wtype });
      if (!hit) { if (i === 0) this.fx.push({ type: 'miss', x: t.x, y: t.y, delay: 90 }); continue; }
      let dmg = rng.int(ws.dmg[0], ws.dmg[1]);
      if (ws.wtype === 'shotgun' && d > ws.range) dmg *= Math.max(0.35, 1 - 0.18 * (d - ws.range));
      if (rng.chance(ws.crit / 100)) dmg *= 1.6;
      dmg = Math.max(1, Math.round(dmg - Math.max(0, dfn.prot - ws.pierce)));
      if (this.isSquad(t)) {
        if (!this.inMap(t)) break;
        this.say(`${this.enm(e)} dispara a ${this.nm(t)}: <span class="bad">−${dmg}</span>.`);
        this.damageAgent(t, dmg, `${ACTORS[e.type].name}`, e, 90 + i * 70);
        if (!this.inMap(t)) break;
      } else {
        this.damageEnemy(t, dmg, e, false, 90 + i * 70);
        if (t.hp <= 0) break;
      }
    }
    this.noise(e.x, e.y, ws.noise);
  }

  sporeBurst(e) {
    const r = 2;
    for (let y = e.y - r; y <= e.y + r; y++) for (let x = e.x - r; x <= e.x + r; x++) {
      if (this.walkTile(x, y) && Math.hypot(x - e.x, y - e.y) <= r + 0.5) this.gas[this.key(x, y)] = Math.max(this.gas[this.key(x, y)], 7);
    }
    this.fx.push({ type: 'spores', x: e.x, y: e.y });
    if (this.isVisible(e.x, e.y)) this.say(`¡${this.enm(e)} revienta en una nube de esporas!`, 'warn');
    for (const sq of this.team) if (cheb(sq.x, sq.y, e.x, e.y) <= 1) this.damageAgent(sq, Math.max(1, rng.int(2, 4) + e.lvl - this.ast(sq).prot), 'esporas');
    for (const o of [...this.enemies]) if (o !== e && o.hp > 0 && HUMANS[o.type] && cheb(o.x, o.y, e.x, e.y) <= 1) this.damageEnemy(o, Math.max(1, rng.int(2, 4) + e.lvl - this.est(o).armor), e);
    this.killEnemy(e, null);
  }
}
