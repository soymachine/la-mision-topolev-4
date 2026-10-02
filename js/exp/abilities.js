// Expedición · Habilidades activas de especialización, cargas, rastreo y experiencia (fase 15)
// (métodos mezclados en Expedition: ver expedition.js)
import { rng, cheb } from '../util/rng.js';
import { ACTORS } from '../data/actors.js';
import { SPECS } from '../data/specs.js';
import { T } from '../data/tiles.js';
import { ACQUIRED, WOUNDS, WOUND_CHANCE } from '../data/honors.js';
import { giveXp, agentStats } from '../core/agents.js';
import { S } from '../core/state.js';
import { esc } from '../util/dom.js';

export class AbilityPart {
  // ---------------------------------------------------------------- experiencia
  // toda la XP de la expedición pasa por aquí (bonus de Veteranía del escuadrón)
  gainXp(sq, n, silent = false) {
    if (!sq || !sq.a || n <= 0) return 0;
    const bonus = Math.max(0, ...this.team.map((o) => this.flag(o, 'xpBonus')));
    const xp = Math.round(n * (1 + bonus / 100));
    sq.xp = (sq.xp || 0) + xp;
    const ups = giveXp(sq.a, xp);
    if (ups && !silent) {
      this.say(`★ ${this.nm(sq)} sube a nivel ${sq.a.lvl}. <span class="dimt">(▲ ascenso pendiente en la base)</span>`, 'good');
      this.fx.push({ type: 'levelup', x: sq.x, y: sq.y });
    }
    return ups;
  }

  // ---------------------------------------------------------------- habilidades
  abilityOf(sq) {
    const sp = sq && sq.a && sq.a.spec && SPECS[sq.a.spec];
    return sp ? sp.ability : null;
  }
  abilityCdMax(sq, ab) {
    let cd = ab.cd;
    if (ab.id === 'mark' && this.flag(sq, 'markPlus')) cd -= 5;
    if (ab.id === 'suppress' && this.flag(sq, 'suppressPlus')) cd -= 4;
    if (ab.id === 'aid' && this.flag(sq, 'aidPlus')) cd -= 6;
    if (ab.id === 'vanish' && this.flag(sq, 'vanishPlus')) cd -= 6;
    if (ab.id === 'patria' && this.flag(sq, 'patriaPlus')) cd -= 10;
    return cd;
  }
  abilityReady(sq) { return this.abilityOf(sq) && !(sq.abcd > 0); }
  // objetivos válidos para las habilidades con objetivo
  abilityTargets(sq) {
    const ab = this.abilityOf(sq);
    if (!ab || !ab.target) return [];
    return this.enemies.filter((e) => this.isVisible(e.x, e.y) && this.hostile(sq, e) && this.los(sq.x, sq.y, e.x, e.y));
  }

  // usar la habilidad del agente; devuelve true si gasta el turno
  useAbility(sq, tx, ty) {
    const ab = this.abilityOf(sq);
    if (!ab) { this.say('Este agente no tiene especialización (se elige al nivel 5, en la base).', 'dimt'); return false; }
    if (sq.abcd > 0) { this.say(`${ab.name}: disponible en ${sq.abcd} turnos.`, 'dimt'); return false; }
    const fn = this['ab_' + ab.id];
    const ok = fn.call(this, sq, ab, tx, ty);
    if (!ok) return false;
    sq.abcd = this.abilityCdMax(sq, ab);
    this.gainXp(sq, 3, true);
    this.dirty = true;
    return true;
  }

  ab_mark(sq, ab, tx, ty) {
    const e = this.enemyAt(tx, ty);
    if (!e || !this.isVisible(tx, ty)) { this.say('Elige un enemigo visible.', 'bad'); return false; }
    const plus = this.flag(sq, 'markPlus');
    e.marked = plus ? 8 : 5;
    e.markPct = plus ? 35 : 25;
    this.fx.push({ type: 'alert' });
    this.say(`◎ ${this.nm(sq)} marca a ${this.enm(e)}: +${e.markPct}% de impacto para el escuadrón durante ${e.marked} turnos.`, 'o1');
    return true;
  }

  ab_suppress(sq, ab, tx, ty) {
    const w = this.weapon(sq);
    const ws = this.weaponStats(sq);
    if (!w || ws.wtype === 'melee' || ws.wtype === 'launcher' || ws.wtype === 'flame') { this.say('Hace falta un arma de fuego.', 'bad'); return false; }
    if (!(w.ld > 0)) { this.say('Cargador vacío.', 'bad'); return false; }
    const dx = tx - sq.x, dy = ty - sq.y;
    if (!dx && !dy) return false;
    const ang = Math.atan2(dy, dx);
    const R = (ws.range + (this.ast(sq).range || 0)) * 1.5 + 1;
    const turns = this.flag(sq, 'suppressPlus') ? 2 : 1;
    w.ld = Math.max(0, w.ld - Math.max(2, ws.burst * 2));
    let n = 0;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - sq.x, e.y - sq.y);
      if (d > R || d < 0.5 || !this.hostile(sq, e)) continue;
      let da = Math.abs(Math.atan2(e.y - sq.y, e.x - sq.x) - ang);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da > 0.45 || !this.los(sq.x, sq.y, e.x, e.y)) continue;
      e.stun = Math.max(e.stun || 0, ACTORS[e.type].boss ? 1 : turns);
      if (e.state === 'dormido') e.state = 'alerta';
      e.mem = 15;
      n++;
      this.fx.push({ type: 'shot', x0: sq.x, y0: sq.y, x1: e.x, y1: e.y, hit: false, delay: n * 50, wtype: ws.wtype });
    }
    this.flash(sq);
    this.noise(sq.x, sq.y, ws.noise + 4);
    this.say(`≫ ${this.nm(sq)} abre fuego de supresión: ${n} enemigo(s) se cubren y pierden ${turns > 1 ? turns + ' turnos' : 'su turno'}.`, 'o1');
    return true;
  }

  ab_aid(sq) {
    const cand = this.team.filter((o) => cheb(o.x, o.y, sq.x, sq.y) <= 1);
    const pct = (o) => o.a.hp / Math.max(1, this.ast(o).hpMaxEff);
    const t = cand.sort((p, q) => pct(p) - pct(q))[0];
    if (!t) return false;
    const st = this.ast(t);
    const healPct = this.flag(sq, 'aidPlus') ? 0.6 : 0.35;
    const before = t.a.hp;
    t.a.hp = Math.min(st.hpMaxEff, t.a.hp + Math.round(st.hpMaxEff * healPct * (1 + this.ast(sq).healPct / 200)));
    t.poison = 0; t.burn = 0;
    const healed = t.a.hp - before;
    if (t !== sq) sq.a.healedOthers = (sq.a.healedOthers || 0) + healed;
    this.fx.push({ type: 'heal', x: t.x, y: t.y });
    this.say(`✚ ${this.nm(sq)} aplica primeros auxilios ${t === sq ? 'sobre sí mismo' : 'a ' + this.nm(t)}: +${healed} salud, sin veneno ni quemaduras.`, 'good');
    return true;
  }

  ab_charge(sq) {
    this.charges = this.charges || [];
    if (this.charges.some((c) => c.x === sq.x && c.y === sq.y)) { this.say('Ya hay una carga aquí.', 'dimt'); return false; }
    const plus = this.flag(sq, 'chargePlus');
    const lvl = sq.a.lvl;
    const k = (plus ? 1.5 : 1) * (1 + this.flag(sq, 'blastPct') / 100);
    this.charges.push({ x: sq.x, y: sq.y, t: 3, r: plus ? 3 : 2, dmg: [Math.round((14 + lvl) * k), Math.round((22 + lvl * 2) * k)], by: sq.id });
    this.say(`✱ ${this.nm(sq)} coloca una carga de demolición. <b>Estalla en 3 turnos.</b> ¡Apartaos!`, 'warn');
    this.fx.push({ type: 'open', x: sq.x, y: sq.y });
    return true;
  }
  tickCharges() {
    if (!this.charges || !this.charges.length) return;
    for (const c of [...this.charges]) {
      c.t--;
      if (c.t > 0) { if (this.isVisible(c.x, c.y)) this.say(`✱ Carga: ${c.t}…`, 'warn'); continue; }
      this.charges.splice(this.charges.indexOf(c), 1);
      const src = this.squad.find((s) => s.id === c.by && this.inMap(s)) || null;
      this.say('✱ ¡La carga estalla!', 'bad');
      this.explode(c.x, c.y, c.r, c.dmg, src, 0, 0, { pierce: 2, noise: 16 });
    }
  }

  ab_wash(sq) {
    const list = this.team.filter((o) => cheb(o.x, o.y, sq.x, sq.y) <= 1);
    for (const o of list) {
      o.a.rad = Math.max(0, o.a.rad - 25);
      this.addBuff(o, { name: 'Lavado de campo', turns: 4, mods: { gasImmune: 1 } });
      this.fx.push({ type: 'heal', x: o.x, y: o.y, color: '#b8f53d' });
    }
    this.say(`≋ ${this.nm(sq)} descontamina a ${list.length} agente(s): −25 radiación e inmunes al gas 4 turnos.`, 'good');
    return true;
  }

  ab_vanish(sq) {
    const turns = this.flag(sq, 'vanishPlus') ? 5 : 3;
    this.addBuff(sq, { name: 'Desaparecido', turns, flags: { vanish: 1, stealth: 5 } });
    this.fx.push({ type: 'smoke', x: sq.x, y: sq.y, r: 1 });
    this.say(`░ ${this.nm(sq)} se funde con la oscuridad durante ${turns} turnos.`, 'o1');
    return true;
  }

  ab_patria(sq) {
    this.patria = 1;
    for (const o of this.team) this.addBuff(o, { name: '¡Por la Patria!', turns: 3, mods: { acc: 2 } });
    this.fx.push({ type: 'alert' });
    this.say(`☭ ${this.nm(sq)}: «¡Por la Patria! ¡Adelante!» El escuadrón gana un turno.`, 'warn');
    return true;
  }

  tickAbilities() {
    for (const sq of this.squad) if (sq.abcd > 0) sq.abcd--;
    for (const e of this.enemies) if (e.marked > 0) e.marked--;
    this.tickCharges();
  }

  // ---------------------------------------------------------------- rastreo (talentos y Percepción)
  trackRadius(sq) {
    const per = agentStats(sq.a).attrs.per;
    return Math.max(this.flag(sq, 'tracker'), per >= 6 ? per - 2 : 0);
  }
  updateTrack() { for (const sq of this.squad) sq.trackR = this.inMap(sq) ? this.trackRadius(sq) : 0; }
  // ¿se percibe a este enemigo sin verlo? (detector de movimiento o rastreo)
  sensed(en) {
    for (const q of this.team) {
      const d = Math.hypot(q.x - en.x, q.y - en.y);
      if (this.sense > 0 && d <= this.senseR) return true;
      if (q.trackR && d <= q.trackR) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- huellas de la expedición en el agente
  // al recibir daño: salud mínima, heridas persistentes y traumas
  markHurt(sq, srcE) {
    const a = sq.a;
    const st = agentStats(a);
    const pct = a.hp / Math.max(1, st.hpMaxEff);
    sq.minPct = Math.min(sq.minPct ?? 1, pct);
    if (pct < 0.25 && srcE && srcE.type === 'lobo') this.acquire(sq, 'lobos');
    if (pct < 0.25) {
      const t = this.tile(sq.x, sq.y);
      if (t === T.WATER || t === T.DEEP) this.acquire(sq, 'agua');
    }
    if (pct < 0.15 && !sq.woundRoll) {
      sq.woundRoll = true;
      if (rng.chance(WOUND_CHANCE)) {
        const w = rng.pick(WOUNDS);
        a.wounds = a.wounds || [];
        a.wounds.push({ id: w.id, name: w.name, attr: w.attr, day: S.day });
        (sq.news = sq.news || []).push(`✖ ${w.name}`);
        this.say(`✖ ${this.nm(sq)} sufre una herida grave: <b>${esc(w.name)}</b> (−1 hasta tratarla en la Enfermería).`, 'bad');
      }
    }
  }
  acquire(sq, id) {
    const a = sq.a;
    a.acquired = a.acquired || [];
    if (a.acquired.includes(id)) return;
    a.acquired.push(id);
    (sq.news = sq.news || []).push(`✚ ${ACQUIRED[id].name}`);
    this.say(`✚ ${this.nm(sq)} adquiere el rasgo <b>${esc(ACQUIRED[id].name)}</b>: ${esc(ACQUIRED[id].desc)}`, 'o1');
  }
}

