// Expedición · Combate: disparo, daño, explosiones, muertes
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
import { FACTIONS } from '../data/factions.js';
import { addAff } from '../core/story.js';
import { ACTORS, actorColor, actorFaction, isHuman } from '../data/actors.js';
import { HUMANS } from '../data/humans.js';

export class CombatPart {
  // ---------------------------------------------------------------- combate
  hitChance(sq, e, ws = this.weaponStats(sq)) {
    const st = this.ast(sq);
    const es = this.est(e);
    const d = Math.hypot(e.x - sq.x, e.y - sq.y);
    let h = ws.acc + st.acc * 2 - es.ev;
    if (e.stun > 0) h += 15;
    if (e.marked > 0 && this.isSquad(sq)) h += e.markPct || 25;
    if (sq.suppressed > 0 && ws.wtype !== 'melee') h -= 30; // fase 23.4: suprimido
    const cv = this.coverInfo(sq.x, sq.y, e.x, e.y); // fase 23.1: cobertura y flanqueo
    h -= cv.pct;
    if (cv.flank && ws.wtype !== 'melee') h += 15;
    if (sq.a) {
      if (isHuman(e)) h += this.flag(sq, 'vsHuman');
      if (e.type === 'lobo') h += this.flag(sq, 'vsLobo');
      if (this.condTrue(sq, 'still', st)) h += this.flag(sq, 'stillAcc');
    }
    if (ws.wtype !== 'melee') {
      const rg = ws.range + (st.range || 0);
      if (d > rg) h -= (d - rg) * 7;
      if (ws.scope && d < 2) h -= 20;
      if (ws.stillAcc && this.condTrue(sq, 'still', st)) h += ws.stillAcc;
    }
    return clamp(Math.round(h), 5, 97);
  }
  canShoot(sq, e) {
    const ws = this.weaponStats(sq);
    const d = Math.hypot(e.x - sq.x, e.y - sq.y);
    if (ws.wtype === 'melee') return cheb(sq.x, sq.y, e.x, e.y) <= 1 ? 'ok' : 'melee';
    const w = this.weapon(sq);
    if (!w || w.ld <= 0) return cheb(sq.x, sq.y, e.x, e.y) <= 1 ? 'ok' : 'empty';
    if (d > (ws.range + (this.ast(sq).range || 0)) * 2 + 0.5) return 'range';
    if (!this.los(sq.x, sq.y, e.x, e.y, true) && !this.fovSees(sq.x, sq.y, e.x, e.y)) return 'los';
    return 'ok';
  }

  attack(sq, e) {
    const reason = this.canShoot(sq, e);
    if (reason !== 'ok') {
      if (sq === this.cur) {
        const msg = { melee: 'Arma cuerpo a cuerpo: acércate al objetivo.', empty: 'Cargador vacío. Pulsa <b>R</b> para recargar.', range: 'Fuera de alcance.', los: 'No hay línea de tiro.' }[reason];
        this.say(msg, 'bad');
      }
      return false;
    }
    if (!this.hostile(sq, e)) this.provoke(actorFaction(e));
    const w = this.weapon(sq);
    let ws = this.weaponStats(sq);
    const real = ws;
    // sin munición a quemarropa: culatazo (o bayoneta)
    if (ws.wtype !== 'melee' && (!w || w.ld <= 0)) ws = { ...FISTS, dmg: real.bayonet ? [5, 9] : [2, 4] };
    const st = this.ast(sq);
    this.flash(sq);
    if (ws.wtype === 'flame') return this.flameAttack(sq, e, w, ws, st);
    if (ws.wtype === 'launcher') return this.launcherAttack(sq, e, w, ws, st);
    if (ws.wtype === 'melee') {
      for (let i = 0; i < (ws.burst || 1); i++) { if (e.hp <= 0) break; this.resolveHit(sq, e, ws, st, true, i); }
      this.noise(sq.x, sq.y, ws.noise);
      return true;
    }
    // fase 23.5: arma encasquillada (R para desencasquillar); el desgaste puede encasquillarla al disparar
    if (w.jammed) { if (sq === this.cur) this.say(`${this.nm(sq)}: ¡el arma está encasquillada! Pulsa <b>R</b> para desencasquillarla.`, 'bad'); return false; }
    if (this.wearWeapon(sq, w)) return true;
    const shots = Math.min(ws.burst, w.ld);
    for (let i = 0; i < shots; i++) {
      w.ld--;
      if (e.hp <= 0) break;
      if (ws.pierce >= 99) { this.pierceShot(sq, e, ws, st, i); continue; }
      this.resolveHit(sq, e, ws, st, false, i);
    }
    // bayoneta acoplada: puñalada extra a quemarropa
    if (ws.bayonet && e.hp > 0 && cheb(sq.x, sq.y, e.x, e.y) <= 1) {
      const dmg = Math.max(1, Math.round(rng.int(4, 8) * (1 + (st.dmgPct || 0) / 100)) - this.est(e).armor);
      this.fx.push({ type: 'slash', x0: sq.x, y0: sq.y, x1: e.x, y1: e.y, delay: 160 });
      this.damageEnemy(e, dmg, sq, false, 200);
    }
    this.noise(sq.x, sq.y, ws.noise);
    if (w.ld === 0 && sq === this.cur) this.say('Cargador vacío.', 'warn');
    return true;
  }

  launcherAttack(sq, e, w, ws, st) {
    w.ld--;
    let tx = e.x, ty = e.y;
    if (rng.int(1, 100) > this.hitChance(sq, e, ws)) {
      const opts = D8.map(([dx, dy]) => [e.x + dx * rng.int(1, 2), e.y + dy * rng.int(1, 2)]).filter(([x, y]) => this.walkTile(x, y));
      if (opts.length) [tx, ty] = rng.pick(opts);
      if (sq === this.cur) this.say('El proyectil se desvía.', 'dimt');
    }
    this.fx.push({ type: 'throw', x0: sq.x, y0: sq.y, x1: tx, y1: ty, glyph: '*' });
    const k = 1 + (st.dmgPct || 0) / 100;
    this.explode(tx, ty, ws.blast, [Math.round(ws.dmg[0] * k), Math.round(ws.dmg[1] * k)], sq, ws.fire ? 2 : 0, 220, { pierce: ws.pierce });
    this.noise(sq.x, sq.y, ws.noise);
    return true;
  }

  flash(sq) { this.fx.push({ type: 'muzzle', x: sq.x, y: sq.y }); }

  rollDmg(ws, st, sq, e, melee, d) {
    let dmg = rng.int(ws.dmg[0], ws.dmg[1]);
    if (melee) dmg *= 1 + (st.meleePct || 0) / 100;
    dmg *= 1 + (st.dmgPct || 0) / 100;
    if (ws.wtype === 'shotgun' && d > ws.range) dmg *= Math.max(0.35, 1 - 0.18 * (d - ws.range));
    const flank = !melee && this.coverInfo(sq.x, sq.y, e.x, e.y).flank ? 10 : 0; // flanqueo: +10% de crítico
    // fase 23.2: ataque por la espalda (cuerpo a cuerpo a un enemigo que no sabe que estás ahí) = crítico seguro
    const back = melee && sq.a && this.unaware(e) && !ACTORS[e.type].boss;
    if (back) this.say(`🗡 ¡Ataque por la espalda de ${this.nm(sq)}!`, 'o1');
    const crit = back || rng.chance((ws.crit + (st.crit || 0) + flank) / 100);
    if (crit) dmg *= 1.8 * (1 + (sq.a ? this.flag(sq, 'critDmg') : 0) / 100);
    const es = this.est(e);
    if (sq.a && S.photos && S.photos[e.type]) dmg *= 1.1; // ficha fotográfica (Zenit-E)
    if (sq.a && sq.a.vengeance && sq.a.vengeance.type === e.type) dmg *= 1.15; // Venganza
    if (sq.a && S.research && S.research.r_balistica && actorFaction(e) === 'chebylitas') dmg *= 1.06;
    if (sq.a) {
      // talentos y rasgos: Tiro de gracia, Emboscada, Cazador de jefes
      if (e.hp < e.hpMax * 0.3) dmg *= 1 + this.flag(sq, 'execute') / 100;
      if ((e.state === 'dormido' || e.state === 'errante') && !e.mem) dmg *= 1 + this.flag(sq, 'ambush') / 100;
      if (ACTORS[e.type].boss) dmg *= 1 + this.flag(sq, 'vsBoss') / 100;
    }
    // fase 23.4: munición especial
    const ak = !melee && sq.a ? this.ammoKindOf(sq) : null;
    if (ak === 'ap') dmg *= 0.9;
    else if (ak === 'hp') dmg *= es.armor <= 0 ? 1.3 : es.armor >= 3 ? 0.5 : 1;
    else if (ak === 'ess' && actorFaction(e) === 'chebylitas') dmg *= 1.2;
    const pierce = ws.pierce + (sq.a ? this.flag(sq, 'pierceAdd') : 0) + (ak === 'ap' ? 3 : 0);
    dmg = Math.max(1, Math.round(dmg - Math.max(0, es.armor - pierce)));
    return { dmg, crit };
  }

  resolveHit(sq, e, ws, st, melee, idx = 0) {
    const d = Math.hypot(e.x - sq.x, e.y - sq.y);
    const hc = this.hitChance(sq, e, ws);
    const hit = rng.int(1, 100) <= hc;
    this.fx.push({ type: melee ? 'slash' : 'shot', x0: sq.x, y0: sq.y, x1: e.x, y1: e.y, hit, delay: idx * 70, wtype: ws.wtype });
    if (!hit) {
      if (idx === 0 && sq === this.cur) this.say(`${this.nm(sq)} falla contra ${this.enm(e)}.`, 'dimt');
      this.fx.push({ type: 'miss', x: e.x, y: e.y, delay: idx * 70 + 90 });
      return;
    }
    const { dmg, crit } = this.rollDmg(ws, st, sq, e, melee, d);
    this.damageEnemy(e, dmg, sq, crit, idx * 70 + 90);
    if (!melee && e.hp > 0 && sq.a && this.ammoKindOf(sq) === 'inc' && !ACTORS[e.type].mech) e.burn = Math.max(e.burn || 0, 3); // incendiaria
    if (ws.chain) {
      let from = e, hits = 0;
      const done = new Set([e.uid]);
      while (hits < ws.chain) {
        const nxt = this.enemies.find((o) => !done.has(o.uid) && o.hp > 0 && cheb(o.x, o.y, from.x, from.y) <= 3 && this.isVisible(o.x, o.y));
        if (!nxt) break;
        done.add(nxt.uid); hits++;
        this.fx.push({ type: 'arc', x0: from.x, y0: from.y, x1: nxt.x, y1: nxt.y, delay: 120 + hits * 80 });
        this.damageEnemy(nxt, Math.round(dmg * 0.6), sq, false, 160 + hits * 80);
        from = nxt;
      }
    }
  }

  pierceShot(sq, e, ws, st, idx) {
    const dx = e.x - sq.x, dy = e.y - sq.y;
    const len = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const ex = Math.round(sq.x + (dx / len) * ws.range), ey = Math.round(sq.y + (dy / len) * ws.range);
    const pts = line(sq.x, sq.y, ex, ey).slice(1);
    let last = [sq.x, sq.y];
    for (const [x, y] of pts) {
      if (this.opaque(x, y)) break;
      last = [x, y];
      const t = this.enemyAt(x, y);
      if (t && t.hp > 0) {
        const { dmg, crit } = this.rollDmg(ws, st, sq, t, false, Math.hypot(x - sq.x, y - sq.y));
        this.damageEnemy(t, dmg, sq, crit, 120);
      }
    }
    this.fx.push({ type: 'beam', x0: sq.x, y0: sq.y, x1: last[0], y1: last[1] });
  }

  flameAttack(sq, e, w, ws, st) {
    w.ld--;
    const dx = e.x - sq.x, dy = e.y - sq.y;
    const len = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const ex = Math.round(sq.x + (dx / len) * ws.range), ey = Math.round(sq.y + (dy / len) * ws.range);
    const pts = line(sq.x, sq.y, ex, ey).slice(1);
    let i = 0;
    for (const [x, y] of pts) {
      if (this.opaque(x, y) || !this.walkTile(x, y)) break;
      i++;
      this.igniteCell(x, y, 5);
      const t = this.enemyAt(x, y);
      if (t && t.hp > 0) {
        const { dmg, crit } = this.rollDmg(ws, st, sq, t, false, 0);
        t.burn = Math.max(t.burn, 3);
        this.damageEnemy(t, dmg, sq, crit, i * 40);
      }
      this.fx.push({ type: 'flame', x, y, delay: i * 40 });
    }
    this.noise(sq.x, sq.y, ws.noise);
    return true;
  }

  igniteCell(x, y, n) {
    if (!this.walkTile(x, y)) return;
    const tt = this.tile(x, y);
    if (tt === T.WATER || tt === T.DEEP) return;
    const k = this.key(x, y);
    this.fire[k] = Math.max(this.fire[k], n);
  }

  enm(e) { return `<span style="color:${actorColor(e)}">${e.elite ? '★ ' : ''}${ACTORS[e.type].name}</span>${e.elite ? ` <span style="color:#ffd23f">«${this.eliteName(e)}»</span>` : ''}`; }

  damageEnemy(e, dmg, src, crit = false, delay = 0) {
    if (e.hp <= 0) return;
    dmg = this.ecoOnDamaged(e, dmg, src); // fase 22: escudero y púas
    if (src && this.isSquad(src) && !this.hostile(src, e)) this.provoke(actorFaction(e));
    if (src && src.type && src !== e) { e.lastAttacker = src.uid; }
    e.hp -= dmg;
    this.tally.dmgDealt += dmg;
    this.fx.push({ type: 'dmg', x: e.x, y: e.y, n: dmg, crit, delay, color: crit ? '#ffffff' : '#ffd23f' });
    if (e.state !== 'alerta') { e.state = 'alerta'; e.mem = 15; this.alertNest(e); }
    if (src && src.id && crit) this.say(`¡Crítico! ${this.nm(src)} inflige ${dmg} a ${this.enm(e)}.`, 'o1');
    if (e.hp <= 0) this.killEnemy(e, src, delay);
  }

  killEnemy(e, src, delay = 0) {
    const def = ACTORS[e.type];
    if (def.companion) { if (this.enemies.includes(e)) this.companionDown(e); return; }
    // lo abatido por un compañero cuenta para su dueño
    if (src && src.type && ACTORS[src.type] && ACTORS[src.type].companion) src = this.compOwner(src) || null;
    const human = !!HUMANS[e.type];
    const es = this.est(e);
    e.hp = 0;
    const ei = this.enemies.indexOf(e);
    if (ei < 0) return;
    this.enemies.splice(ei, 1);
    if (this.occ.get(this.key(e.x, e.y)) === e) this.occ.delete(this.key(e.x, e.y));
    this.fx.push({ type: 'kill', x: e.x, y: e.y, glyph: def.glyph, color: actorColor(e), delay, boss: !!def.boss });
    // personas: sueltan su arma, algo de munición y lo que llevaran
    if (human) {
      if (e.w && !def.noDrop) { e.w.ld = Math.max(0, Math.min(e.ld || 0, itemStats(e.w).mag || 0)); e.w.dur = rng.int(40, 80); this.addFloor(e.x, e.y, e.w); } // fase 23.5: gastada
      const ws = e.w ? itemStats(e.w) : null;
      if (ws && ws.ammo && rng.chance(0.7)) this.addFloor(e.x, e.y, createItem(ws.ammo, 0, rng, Math.max(4, Math.round((ITEMS[ws.ammo].pack || 10) * rng.float(0.3, 0.8)))));
      for (const b of def.loot || []) if (rng.chance(0.35)) this.addFloor(e.x, e.y, createItem(b, 0, rng, ITEMS[b].stack > 1 ? (ITEMS[b].cat === 'ammo' ? Math.round(ITEMS[b].pack * 0.6) : 1) : undefined));
      if (rng.chance(0.15 + e.lvl * 0.02)) this.addFloor(e.x, e.y, rollLoot(e.lvl, rng, { rarityBonus: 0.3, west: (FACTIONS[actorFaction(e)] || {}).bloc !== 'varsovia' }));
    }
    // máquinas y similares: material
    for (const b of (!human && def.drops) || []) if (rng.chance(0.75)) this.addFloor(e.x, e.y, createItem(b, 0, rng, ITEMS[b].stack > 1 ? rng.int(1, 3) : undefined));
    // fase 21.3: materiales de fabricación
    if (!human && !def.mech && rng.chance(0.22 + (def.boss ? 0.6 : 0))) this.addFloor(e.x, e.y, createItem('tejido', 0, rng, rng.int(1, def.boss ? 4 : 2)));
    if (def.mech && rng.chance(0.7)) { this.addFloor(e.x, e.y, createItem('electronica', 0, rng, rng.int(1, 2))); this.addFloor(e.x, e.y, createItem('chatarra', 0, rng, rng.int(1, 3))); }
    // esencia
    let ess = human ? 0 : rng.int(es.ess[0], es.ess[1]);
    if (e.spawned) ess = Math.ceil(ess * 0.3);
    if (this._essBoost) ess = Math.round(ess * (1 + this._essBoost / 100));
    const k = this.key(e.x, e.y);
    if (ess > 0) this.essence.set(k, (this.essence.get(k) || 0) + ess);
    // botín
    const dropChance = human ? 0 : def.boss ? 1 : 0.08 + e.lvl * 0.012;
    if (rng.chance(dropChance)) {
      const n = def.boss ? 2 + rng.int(0, 1) : 1;
      for (let i = 0; i < n; i++) this.addFloor(e.x, e.y, rollLoot(e.lvl, rng, { rarityBonus: def.boss ? 0.8 : 0 }));
    }
    if (def.boss) this.addFloor(e.x, e.y, createItem('crystal', rng.int(2, 4), rng));
    this.ecoOnDeath(e, src); // fase 22: se divide, explota, botín de élite, trofeo
    const bySquad = !src || this.isSquad(src);
    if (bySquad) { this.tally.kills++; S.stats.kills++; }
    if (src && src.id) { this.trigger('kill', { type: e.type, faction: actorFaction(e), lvl: e.lvl }, src); this.moraleOnKill(src, e); }
    if (src && src.id && def.boss) { src.bossKills = (src.bossKills || 0) + 1; this.acquire(src, 'jefes'); }
    if (!human && bySquad) bestiaryKill(e.type);
    if (src && src.id && this.inMap(src)) {
      const kh = this.flag(src, 'killHeal');
      if (kh) { const st = this.ast(src); src.a.hp = Math.min(st.hpMaxEff, src.a.hp + kh); this.fx.push({ type: 'heal', x: src.x, y: src.y }); }
      const kf = this.flag(src, 'killFrenzy');
      if (kf) this.addBuff(src, { name: 'Frenesí', turns: 3, mods: { dmgPct: kf } });
    }
    if (src && src.id) {
      src.kills++;
      src.a.kills = (src.a.kills || 0) + 1;
      this.gainXp(src, es.xp);
    }
    if (src && src.type) { if (this.isVisible(e.x, e.y)) this.say(`${this.enm(src)} abate a ${this.enm(e)} (Nv ${e.lvl}).`, 'dimt'); }
    else this.say(`${src && src.id ? this.nm(src) + ' elimina' : 'Muere'} ${this.enm(e)} (Nv ${e.lvl}).`, def.boss ? 'warn' : '');
    if (def.boss) this.say(`☠ ¡${def.name} ha caído! Su esencia brilla en el suelo.`, 'warn');
    // nido despejado
    if (e.poi != null && this.pois[e.poi] && this.pois[e.poi].type === 'nest') {
      const p = this.pois[e.poi];
      if (!p.cleared && !this.enemies.some((o) => o.poi === e.poi && !o.spawned)) {
        p.cleared = true;
        this.say(`✓ ${p.name} despejado.`, 'good');
      }
    }
  }

  alertNest(e) {
    if (e.poi == null) return;
    for (const o of this.enemies) if (o.poi === e.poi && o.state === 'dormido' && cheb(o.x, o.y, e.x, e.y) <= 12) { o.state = 'alerta'; o.mem = 15; }
  }

  noise(x, y, r) {
    if (r <= 0) return;
    // generador de ruido blanco: el ruido cerca del escuadrón queda en un susurro
    if (this.quietT > this.turn && this.team.some((q) => cheb(q.x, q.y, x, y) <= 3)) r = Math.min(r, 3);
    if (r >= 9) this.collapseNear(x, y, Math.min(4, Math.floor(r / 3)));
    for (const e of this.enemies) {
      if (e.state === 'alerta') { if (Math.hypot(e.x - x, e.y - y) <= r) e.mem = Math.max(e.mem, 12); continue; }
      if (Math.hypot(e.x - x, e.y - y) <= r) { e.state = 'alerta'; e.mem = 12; }
    }
  }

  damageAgent(sq, dmg, cause, srcE = null, delay = 0) {
    if (!this.inMap(sq)) return;
    if (this.god) return; // consola de depuración
    this.moraleOnAmbush(sq, srcE);
    sq.a.hp -= dmg;
    this.tally.dmgTaken += dmg;
    this.fx.push({ type: 'dmg', x: sq.x, y: sq.y, n: dmg, delay, color: '#ff3b30', agent: true });
    this.fx.push({ type: 'hurt', x: sq.x, y: sq.y, delay });
    this.interrupt = true;
    if (sq.a.hp > 0 && !sq.autoUsed) {
      const ai = this.flag(sq, 'autoInject');
      const st = this.ast(sq);
      if (ai && sq.a.hp < st.hpMaxEff * 0.25) {
        sq.autoUsed = true;
        sq.a.hp = Math.min(st.hpMaxEff, sq.a.hp + ai);
        this.say(`💉 El autoinyector de ${this.nm(sq)} se dispara (+${ai} salud).`, 'good');
        this.fx.push({ type: 'heal', x: sq.x, y: sq.y });
      }
    }
    // fase 23.3: a 0 de salud, abatido (3 turnos para levantarlo); si ya lo estaba, muere.
    // (Rescate y el desfibrilador ya no salvan solos: sirven para levantar al abatido, ver tactics.js)
    if (sq.a.hp <= 0) { if (sq.downed) this.agentDies(sq, cause, srcE); else this.knockDown(sq, cause); return; }
    this.markHurt(sq, srcE); this.trigger('agentHurt', { dmg }, sq);
  }

  agentDies(sq, cause, killer = null) {
    const a = sq.a;
    a.hp = 0;
    sq.alive = false;
    sq.snap = { id: a.id, first: a.first, last: a.last, nick: a.nick, lvl: a.lvl, color: a.color, hp: 0, rad: a.rad, equip: {}, bag: [], baseHp: a.baseHp, attr: { ...a.attr }, av: 2, bg: a.bg, female: a.female, trait: a.trait, spec: a.spec, talents: [...(a.talents || [])], wounds: [], medals: [...(a.medals || [])], acquired: [...(a.acquired || [])], offers: [], pts: 0, flags: {} };
    this.occ.delete(this.key(sq.x, sq.y));
    this.fx.push({ type: 'death', x: sq.x, y: sq.y, color: a.color });
    this.say(`✝ ${this.nm(sq)} ha muerto (${cause}). Todo su equipo se pierde en las profundidades.`, 'bad');
    // radiobaliza del contenedor de seguridad: vuelve al almacén con su contenido
    const c = a.equip.case;
    if (c) {
      const cd = ITEMS[c.b];
      sq.recovered = [itemName(c), ...c.vault.map((x) => itemName(x) + (x.q > 1 ? ' ×' + x.q : ''))];
      for (const x of c.vault) S.stash.push(x);
      c.vault = [];
      S.stash.push(c);
      a.equip.case = null;
      if (cd.keepEss && sq.ess > 0) { sq.essKept = Math.floor(sq.ess * cd.keepEss / 100); }
      this.say(`📡 La radiobaliza de su ${esc(cd.name)} transmite: el contenedor${sq.recovered.length > 1 ? ` y ${sq.recovered.length - 1} objeto(s)` : ''} volverán a la base${sq.essKept ? `, con ${sq.essKept} ✦` : ''}.`, 'cyan');
    }
    const i = S.agents.indexOf(a);
    if (i >= 0) S.agents.splice(i, 1);
    S.fallen.unshift({ name: agentName(a), lvl: a.lvl, day: S.day, map: this.def.name, cause, kills: a.kills || 0, missions: a.missions || 0 });
    this.moraleOnDeath(sq, a, killer);
    S.stats.deaths++;
    this.emit('death', sq);
    this.checkActive();
  }

  checkActive() {
    if (!this.team.length) { this.finish(); return; }
    // fase 23.3: si solo quedan abatidos, nadie puede levantarlos
    if (this.team.every((q) => q.downed)) {
      if (this._wiping) return;
      this._wiping = true;
      for (const q of [...this.team]) this.agentDies(q, `se desangró (${q.downCause || 'herido'}); no quedaba nadie en pie`);
      this._wiping = false;
      if (!this.team.length) this.finish();
      return;
    }
    if (!this.inMap(this.cur) || this.cur.downed) {
      this.active = this.squad.indexOf(this.team.find((q) => !q.downed));
      this.emit('switch');
    }
  }

  explode(x, y, r, dmgR, src, fire = 0, delay = 0, opts = {}) {
    this.fx.push({ type: 'explosion', x, y, r, delay, fire: !!fire });
    this._essBoost = opts.essBoost || 0;
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (!this.inb(xx, yy) || Math.hypot(xx - x, yy - y) > r + 0.5) continue;
      if (!hasLOS(x, y, xx, yy, (a, b) => this.opaque(a, b))) continue;
      if (fire) this.igniteCell(xx, yy, fire >= 2 ? 9 : 6);
      const ent = this.entityAt(xx, yy);
      if (!ent) continue;
      const dmg = rng.int(dmgR[0], dmgR[1]);
      if (ent.type) { this.damageEnemy(ent, Math.max(1, dmg - Math.max(0, this.est(ent).armor - (opts.pierce || 0))), src, false, delay + 60); if (fire && ent.hp > 0) ent.burn = 3; }
      else if (ent.id) { if (src && this.isSquad(src)) this.moraleOnFriendlyFire(src, ent); this.damageAgent(ent, Math.max(1, dmg - this.ast(ent).prot), 'explosión', null, delay + 60); }
    }
    this._essBoost = 0;
    this.blastTerrain(x, y, r, src);
    this.noise(x, y, opts.noise || 14);
    this.flushBreaks();
  }

  checkTrap(e) {
    const i = this.traps.findIndex((t) => t.x === e.x && t.y === e.y);
    if (i < 0) return;
    const t = this.traps.splice(i, 1)[0];
    if (this.isVisible(e.x, e.y)) this.say(`¡${this.enm(e)} pisa ${ITEMS[t.b].name}!`, 'o1');
    const k = 1 + (t.bonus || 0) / 100;
    const dmg = [Math.round(t.dmg[0] * k), Math.round(t.dmg[1] * k)];
    if (t.blast) this.explode(e.x, e.y, t.blast, dmg, null, 0, 0);
    else { this.fx.push({ type: 'slash', x0: e.x, y0: e.y, x1: e.x, y1: e.y }); this.damageEnemy(e, rng.int(dmg[0], dmg[1]), null); }
    const stun = t.stun ? t.stun + (t.stunPlus || 0) : 0;
    if (stun && e.hp > 0) e.stun = Math.max(e.stun || 0, ACTORS[e.type].boss ? 1 : stun);
  }
}
