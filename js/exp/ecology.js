// Expedición · Ecosistema (fase 22): habilidades nuevas de los chebylitas, élites con afijos,
// cadena alimentaria y jefes con fases y trofeo.
// (métodos mezclados en Expedition: ver expedition.js)
import { rng, cheb } from '../util/rng.js';
import { S } from '../core/state.js';
import { ITEMS } from '../data/items.js';
import { ACTORS } from '../data/actors.js';
import { HUMANS } from '../data/humans.js';
import { ELITES, ELITE_COLOR, eliteChance } from '../data/ecosystem.js';
import { createItem, rollLoot } from '../core/items.js';
import { D8 } from './shared.js';

export class EcologyPart {
  // ---------------------------------------------------------------- habilidades
  // las de la especie + las ganadas en una fase de jefe + las de sus afijos de élite
  abils(e) {
    const base = ACTORS[e.type].abil || [];
    if (!e.xab && !e.elite) return base;
    const out = [...base, ...(e.xab || [])];
    for (const id of e.elite || []) for (const a of ELITES[id].abil || []) out.push(a);
    return out;
  }
  has(e, id) { return this.abils(e).includes(id); }
  isCheb(e) { const d = ACTORS[e.type]; return !HUMANS[e.type] && !d.companion; }

  // ---------------------------------------------------------------- élites
  rollElite(e, tier, alert) {
    const d = ACTORS[e.type];
    if (!this.isCheb(e) || d.boss || e.spawned || e.caged || e.attacker || e.elite) return false;
    if (!rng.chance(eliteChance(tier, alert))) return false;
    const pool = Object.keys(ELITES).filter((id) => !(id === 'invisible' && this.has(e, 'stealth')));
    const n = tier >= 6 && rng.chance(0.5) ? 2 : 1;
    const picks = [];
    while (picks.length < n && pool.length) picks.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    this.makeElite(e, picks);
    return true;
  }
  makeElite(e, affixes) {
    e.elite = affixes;
    const k = affixes.reduce((m, id) => m * (ELITES[id].hp || 1), 1.5);
    e.hpMax = Math.round(e.hpMax * k); e.hp = e.hpMax;
    e._st = null;
  }
  // estadísticas de élite (las usa est): protección, esquiva, el doble de esencia y XP
  eliteStats(e, st) {
    if (!e.elite) return st;
    for (const id of e.elite) { st.armor += ELITES[id].armor || 0; st.ev += ELITES[id].ev || 0; }
    st.ess = [st.ess[0] * 2, st.ess[1] * 2]; st.xp *= 2;
    return st;
  }
  eliteName(e) { return (e.nick ? e.nick + ' · ' : '') + (e.elite || []).map((id) => ELITES[id].name).join(', '); }
  // velocidad efectiva (Veloz, rabia)
  espeed(e) {
    let sp = ACTORS[e.type].speed;
    if (e.elite && e.elite.includes('veloz')) sp *= 1.5;
    if (e.raged) sp *= 1.35;
    return sp;
  }

  // ---------------------------------------------------------------- sigilo
  // Liquidador hueco, gato, élite Invisible: no se ven hasta tenerlos a 2 casillas (o justo después de atacar)
  hidden(e) {
    if (!this.has(e, 'stealth') || (e.revealT || 0) > this.turn) return false;
    return !this.team.some((q) => cheb(q.x, q.y, e.x, e.y) <= 2);
  }
  seen(e) { return this.isVisible(e.x, e.y) && !this.hidden(e); }

  // ---------------------------------------------------------------- al empezar su turno
  ecoTurnStart(e) {
    const def = ACTORS[e.type];
    if (this.has(e, 'repair') && e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + Math.max(1, Math.round(e.hpMax * 0.04)));
    // fases de jefe: al bajar de cada umbral de salud
    if (def.phases) {
      for (let i = e.phase || 0; i < def.phases.length; i++) {
        if (e.hp / e.hpMax > def.phases[i].at) break;
        e.phase = i + 1;
        this.bossPhase(e, def.phases[i]);
      }
    }
    // rabia (después de las fases: una fase puede darla)
    if (this.has(e, 'rage') && !e.raged && e.hp < e.hpMax * 0.5) {
      e.raged = 1;
      if (this.seen(e)) this.say(`${this.enm(e)} se enfurece: ¡más fuerte y más rápido!`, 'warn');
    }
    // élite radiactivo: irradia a quien tenga cerca
    if (e.elite && e.elite.includes('radiactivo')) {
      for (const q of this.team) if (cheb(q.x, q.y, e.x, e.y) <= 2) q.a.rad += (1 + e.lvl * 0.3) * (1 - this.ast(q).rad / 100);
    }
  }
  bossPhase(e, ph) {
    this.say(`☠ ${ph.say}`, 'bad');
    this.fx.push({ type: 'spawn', x: e.x, y: e.y }, { type: 'snd', s: 'phase' });
    e.state = 'alerta'; e.mem = 30;
    if (ph.add) e.xab = [...new Set([...(e.xab || []), ...ph.add])];
    if (ph.heal) e.hp = Math.min(e.hpMax, e.hp + Math.round(e.hpMax * ph.heal));
    if (ph.summon) this.summonAround(e, ph.summon[0], ph.summon[1], Math.max(1, e.lvl - 1));
    this.interrupt = true;
  }
  summonAround(e, type, n, lvl) {
    let made = 0;
    const probe = { type };
    for (let r = 1; r <= 3 && made < n; r++) {
      for (const [dx, dy] of rng.shuffle([...D8])) {
        if (made >= n) break;
        const x = e.x + dx * r, y = e.y + dy * r;
        if (!this.canEnemyStep(probe, x, y)) continue;
        const c = this.spawnEnemy(type, lvl, x, y, 'alerta', e.poi);
        c.spawned = 1; made++;
        this.fx.push({ type: 'spawn', x, y });
      }
    }
    return made;
  }

  // ---------------------------------------------------------------- antes de actuar (con objetivo)
  // devuelve true si la habilidad gasta el turno
  ecoPreAct(e, tgt, td) {
    const adj = cheb(e.x, e.y, tgt.x, tgt.y) <= 1;
    // sirena: no ataca; aúlla cada pocos turnos y despierta a todo
    if (this.has(e, 'scream')) {
      e.cd3 = (e.cd3 || 0) - 1;
      if (e.cd3 <= 0) {
        e.cd3 = 6;
        const n = this.wakeAround(e, 22);
        this.noise(e.x, e.y, 22);
        this.fx.push({ type: 'wake', x: e.x, y: e.y }, { type: 'snd', s: 'howl' });
        if (this.isVisible(e.x, e.y) || this.isSquad(tgt)) this.say(`📢 ${this.enm(e)} aúlla con un gemido mecánico${n ? `: ${n} chebylita(s) despiertan` : ''}.`, 'warn');
      }
      if (!ACTORS[e.type].boss) return true;
    }
    // aullido de la jauría: una vez, al ver a su presa
    if (this.has(e, 'howl') && !e.howled) {
      e.howled = 1;
      this.fx.push({ type: 'snd', s: 'howl' });
      const n = this.wakeAround(e, 16);
      this.noise(e.x, e.y, 10);
      if (this.isVisible(e.x, e.y)) this.say(`${this.enm(e)} aúlla${n ? `: ${n} chebylita(s) responden` : ''}.`, 'warn');
      return true;
    }
    // élite engendrador: crías de su especie
    if (e.elite && e.elite.includes('engendrador') && (e.kids || 0) < 3) {
      e.cd4 = (e.cd4 || 0) - 1;
      if (e.cd4 <= 0) {
        e.cd4 = 7;
        if (this.summonAround(e, e.type, 1, Math.max(1, e.lvl - 2))) { e.kids = (e.kids || 0) + 1; if (this.seen(e)) this.say(`${this.enm(e)} engendra una cría.`, 'warn'); return true; }
      }
    }
    // excavar: sale del suelo junto a su objetivo
    if (this.has(e, 'burrow') && td > 2.5 && td <= 14) {
      e.cd3 = (e.cd3 || 0) - 1;
      if (e.cd3 <= 0) {
        const spot = rng.shuffle([...D8]).map(([dx, dy]) => [tgt.x + dx, tgt.y + dy]).find(([x, y]) => this.canEnemyStep(e, x, y));
        if (spot) {
          e.cd3 = 7;
          this.fx.push({ type: 'spawn', x: e.x, y: e.y });
          this.enemyStepTo(e, spot[0], spot[1]);
          this.fx.push({ type: 'spawn', x: spot[0], y: spot[1] });
          if (this.isSquad(tgt) || this.isVisible(spot[0], spot[1])) this.say(`¡${this.enm(e)} surge del suelo junto a ${this.isSquad(tgt) ? this.nm(tgt) : this.enm(tgt)}!`, 'warn');
          return true;
        }
      }
    }
    // maniquí: no se mueve mientras alguien lo mira (si ya está al lado, ataca)
    if (this.has(e, 'angel') && !adj && this.isVisible(e.x, e.y)) return true;
    return false;
  }
  wakeAround(e, r) {
    let n = 0;
    for (const o of this.enemies) {
      if (o === e || !this.isCheb(o) || o.state === 'alerta' || Math.hypot(o.x - e.x, o.y - e.y) > r) continue;
      o.state = 'alerta'; o.mem = 18; n++;
    }
    return n;
  }

  // ---------------------------------------------------------------- golpes
  // multiplicador de daño cuerpo a cuerpo (salto, rabia)
  ecoMeleeMult(e, t) {
    let m = 1;
    if (e.raged) m *= 1.5;
    if (this.has(e, 'pounce') && this.isSquad(t)) {
      e.pounced = e.pounced || {};
      if (!e.pounced[t.id]) { e.pounced[t.id] = 1; m *= 2; this.say(`¡${this.enm(e)} salta sobre ${this.nm(t)}!`, 'bad'); }
    }
    return m;
  }
  // después de herir a un agente
  ecoOnHitAgent(e, sq, dmg, ranged) {
    e.revealT = this.turn + 3;
    if (!this.inMap(sq)) return;
    const cur = sq === this.cur;
    if (!ranged && this.has(e, 'shock')) { sq.rooted = Math.max(sq.rooted || 0, 1); if (cur) this.say(`⚡ La descarga de ${this.enm(e)} paraliza las piernas de ${this.nm(sq)}.`, 'warn'); }
    if (!ranged && this.has(e, 'blind') && !(sq.buffs || []).some((b) => b.name === 'Cegado')) { this.addBuff(sq, { name: 'Cegado', turns: 3, mods: { vision: -3 } }); if (cur) this.say(`${this.enm(e)} se pega a la máscara de ${this.nm(sq)}: no ve casi nada.`, 'warn'); }
    if (this.has(e, 'drain') && e.hp > 0) { e.hp = Math.min(e.hpMax, e.hp + dmg); this.fx.push({ type: 'heal', x: e.x, y: e.y }); }
    if (ranged && this.has(e, 'web')) { sq.rooted = Math.max(sq.rooted || 0, 2); if (cur) this.say(`${this.enm(e)} atrapa a ${this.nm(sq)} en una red de cobre.`, 'warn'); }
    if (ranged && this.has(e, 'chain')) {
      for (const o of this.team) {
        if (o === sq || cheb(o.x, o.y, sq.x, sq.y) > 1) continue;
        const d2 = Math.max(1, Math.round(dmg * 0.5));
        this.fx.push({ type: 'ebolt', x0: sq.x, y0: sq.y, x1: o.x, y1: o.y, hit: true, color: '#ffe066' });
        this.say(`⚡ El arco salta a ${this.nm(o)}: <span class="bad">−${d2}</span>.`);
        this.damageAgent(o, d2, `${ACTORS[e.type].name} (arco eléctrico)`, e, 160);
      }
    }
  }
  // al recibir daño: escudero (−40%) y púas (devuelven parte del golpe cuerpo a cuerpo)
  ecoOnDamaged(e, dmg, src) {
    if (!this.isCheb(e)) return dmg;
    if (this.enemies.some((o) => o !== e && o.hp > 0 && o.elite && o.elite.includes('escudero') && cheb(o.x, o.y, e.x, e.y) <= 2)) dmg = Math.max(1, Math.ceil(dmg * 0.6));
    if (src && this.isSquad(src) && this.inMap(src) && cheb(src.x, src.y, e.x, e.y) <= 1 && this.has(e, 'thorns')) {
      const back = Math.max(1, Math.round(dmg * 0.25));
      this.damageAgent(src, back, `púas de ${ACTORS[e.type].name}`, e, 100);
      if (src === this.cur) this.say(`${this.nm(src)} se clava las púas de ${this.enm(e)}: <span class="bad">−${back}</span>.`, 'warn');
    }
    if (src) e.revealT = this.turn + 3;
    return dmg;
  }

  // ---------------------------------------------------------------- al morir
  ecoOnDeath(e, src) {
    const def = ACTORS[e.type];
    if (!this.isCheb(e)) return;
    // se divide (enjambre de cuarzo; la Muestra n.º 7 en su última fase)
    if (this.has(e, 'split') && !e.spawned) {
      const t = def.boss ? 'maniqui' : e.type;
      const n = this.summonAround(e, t, 2, Math.max(1, e.lvl - 2));
      if (n && this.isVisible(e.x, e.y)) this.say(`${this.enm(e)} se rompe en pedazos… que siguen moviéndose.`, 'warn');
    }
    if (e.elite) {
      // élite explosivo: revienta
      if (e.elite.includes('explosivo')) {
        const dmg = 6 + e.lvl * 3;
        this.fx.push({ type: 'explosion', x: e.x, y: e.y, r: 2 });
        this.say(`💥 ${this.enm(e)} revienta en una explosión de esencia.`, 'bad');
        for (const q of [...this.team]) if (cheb(q.x, q.y, e.x, e.y) <= 2) this.damageAgent(q, dmg, `explosión de ${def.name}`, null, 120);
        for (const o of [...this.enemies]) if (o.hp > 0 && cheb(o.x, o.y, e.x, e.y) <= 2) this.damageEnemy(o, dmg, null, false, 120);
      }
      // botín de élite
      this.addFloor(e.x, e.y, rollLoot(Math.min(10, e.lvl + 1), rng, { rarityBonus: 0.6 }));
      if (rng.chance(0.5)) this.addFloor(e.x, e.y, createItem('crystal', 0, rng));
    }
    if (def.boss) {
      this.bossesDown = [...(this.bossesDown || []), e.type];
      // trofeo único: solo si no lo tenéis ya
      if (def.trophy && ITEMS[def.trophy] && !this.ownsItem(def.trophy)) {
        this.addFloor(e.x, e.y, createItem(def.trophy, 4, rng));
        this.say(`🏆 Entre los restos de ${this.enm(e)} hay algo que merece un sitio en la base: <b>${ITEMS[def.trophy].name}</b>.`, 'good');
      }
    }
  }
  ownsItem(b) {
    const inList = (l) => (l || []).some((it) => it && it.b === b);
    if (inList(S.stash)) return true;
    for (const a of S.agents) if (inList(a.bag) || inList(Object.values(a.equip || {}))) return true;
    for (const k of this.floorItems.keys()) if (inList(this.floorItems.get(k))) return true;
    return this.team.some((q) => inList(q.a.bag));
  }

  // ---------------------------------------------------------------- cadena alimentaria
  // dormidos: un depredador con hambre se despierta si ve una presa cerca
  ecoDormant(e) {
    const def = ACTORS[e.type];
    if (!def.diet || !rng.chance(0.15)) return;
    if (this.preyNear(e, 4)) e.state = 'errante';
  }
  preyNear(e, r) {
    const def = ACTORS[e.type];
    let best = null, bd = r + 0.01;
    for (const o of this.enemies) {
      if (o === e || o.hp <= 0 || !def.diet.includes(o.type) || ACTORS[o.type].boss || o.charmed) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bd && this.los(e.x, e.y, o.x, o.y)) { best = o; bd = d; }
    }
    return best;
  }
  // sin nadie a quien atacar: cazar, seguir al depredador o huir de él. true si gasta el turno
  ecoIdle(e) {
    const def = ACTORS[e.type];
    if (!this.isCheb(e) || e.charmed) return false;
    // presa: huye del depredador que la acaba de morder
    if (e.lastAttacker) {
      const p = this.enemies.find((o) => o.uid === e.lastAttacker && o.hp > 0);
      if (p && ACTORS[p.type].diet && ACTORS[p.type].diet.includes(e.type) && cheb(p.x, p.y, e.x, e.y) <= 3) return this.stepAway(e, p);
    }
    if (def.diet) {
      const prey = this.preyNear(e, 8);
      if (prey) {
        if (cheb(e.x, e.y, prey.x, prey.y) <= 1) {
          if (!e.hunted && this.isVisible(e.x, e.y)) { e.hunted = 1; this.say(`${this.enm(e)} caza a ${this.enm(prey)}.`, 'dimt'); }
          this.enemyMelee(e, prey);
        } else this.greedyStep(e, prey.x, prey.y);
        return true;
      }
    }
    if (def.follows) {
      let lead = null, ld = 16;
      for (const o of this.enemies) if (o.type === def.follows && o.hp > 0) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < ld) { lead = o; ld = d; } }
      if (lead) {
        if (ld > 2.5) this.greedyStep(e, lead.x, lead.y);
        else if (rng.chance(0.3)) this.randomStep(e);
        return true;
      }
    }
    return false;
  }
}
export { ELITE_COLOR };
