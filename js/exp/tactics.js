// Expedición · Combate táctico (fase 23): sigilo real (agacharse, detección), ataques por la espalda y emboscadas.
// (métodos mezclados en Expedition: ver expedition.js)
import { cheb, rng, line } from '../util/rng.js';
import { itemStats } from '../core/items.js';
import { AMMO_KINDS } from '../data/ammo.js';
import { T } from '../data/tiles.js';
const T_WATER = T.WATER, T_DEEP = T.DEEP;
import { ACTORS } from '../data/actors.js';
import { ITEMS } from '../data/items.js';
import { addStress, addAff } from '../core/story.js';
import { statBump } from '../core/achievements.js';

export class TacticsPart {
  // ---------------------------------------------------------------- sigilo (23.2)
  // agacharse (tecla K por defecto): cuesta más que te vean, pero cada dos pasos se pierde un turno
  toggleCrouch(sq = this.cur) {
    if (!sq || !this.inMap(sq)) return false;
    sq.crouch = !sq.crouch; sq.crouchStep = false;
    this.fx.push({ type: 'snd', s: 'crouch' }); // fase 24.5.4
    this.say(sq.crouch ? `${this.nm(sq)} se agacha: más difícil de ver, pero más lento.` : `${this.nm(sq)} se pone de pie.`, 'dimt');
    this.emit('update');
    return true;
  }
  // a qué distancia menos detectan a un agente (para los que aún no están en alerta)
  stealthBonus(sq) {
    let b = 0;
    if (sq.crouch) b += 3;
    if (this.turn - (sq.lastMove ?? -9) > 1) b += 2; // quieto
    return b;
  }
  // ¿qué saben de él los enemigos? 'visto' | 'oido' | 'oculto'
  detectionOf(sq) {
    let st = 'oculto';
    for (const o of this.enemies) {
      if (o.state !== 'alerta' || !this.hostile(o, sq) || ACTORS[o.type].companion) continue;
      const d = Math.hypot(o.x - sq.x, o.y - sq.y);
      if (d <= 11 && this.los(o.x, o.y, sq.x, sq.y)) return 'visto';
      if (d <= 16) st = 'oido';
    }
    return st;
  }
  // ataque por la espalda: el enemigo no sabe que estás ahí
  unaware(e) { return e.state === 'dormido' || (e.state === 'errante' && !(e.mem > 0)); }
  // emboscada de un compañero (orden EMBOSCADA): quieto hasta que algo entra a tiro; primer disparo +20%
  ambushFire(sq, target) {
    this.addBuff(sq, { name: 'Emboscada', turns: 1, mods: { acc: 10 } });
    this.say(`🎯 ¡${this.nm(sq)} abre fuego desde la emboscada!`, 'o1');
    this.attack(sq, target);
    sq.order = 'mantener';
  }

  // ---------------------------------------------------------------- abatidos (23.3)
  // a 0 de salud el agente cae abatido: 3 turnos (4 si alguien del grupo tiene «Rescate») para levantarlo
  knockDown(sq, cause) {
    sq.downed = 3 + (this.team.some((o) => this.flag(o, 'rescue')) ? 1 : 0);
    sq.downCause = cause; sq.a.hp = 0; sq.crouch = false;
    this.fx.push({ type: 'snd', s: 'heartbeat' });
    sq.poison = 0; sq.burn = 0; // (si no, el veneno lo remataría sin margen para levantarlo)
    this.fx.push({ type: 'hurt', x: sq.x, y: sq.y });
    this.say(`✚ ¡${this.nm(sq)} cae abatido! Se desangra: ${sq.downed} turnos para levantarlo (<b>F</b> a su lado; mejor con un botiquín).`, 'bad');
    for (const o of this.team) if (o !== sq) addStress(o.a, 5);
    this.interrupt = true;
    this.emit('update');
    this.checkActive();
  }
  // cada turno: se desangran (o se levantan si alguien les ha curado por otra vía)
  downedTick() {
    for (const sq of this.team) if (sq.suppressed > 0) sq.suppressed--; // fase 23.4
    for (const sq of [...this.team]) {
      if (!sq.downed) continue;
      if (sq.a.hp > 0) { sq.downed = 0; this.say(`${this.nm(sq)} se levanta.`, 'good'); continue; }
      sq.downed--;
      if (sq.downed <= 0) this.agentDies(sq, `se desangró (${sq.downCause || 'herido'})`);
      else { this.say(`✚ ${this.nm(sq)} se desangra: ${sq.downed} turno(s).`, 'warn'); this.fx.push({ type: 'snd', s: 'heartbeat' }); }
    }
  }
  // ¿puede sq levantar a t? (a su lado, o a 2 casillas con el desfibrilador, una vez por expedición)
  canRescue(sq, t) {
    if (!t || t === sq || !t.downed || !this.inMap(t) || sq.downed) return false;
    const d = cheb(sq.x, sq.y, t.x, t.y);
    return d <= 1 || (d <= 2 && this.flag(sq, 'defib') && !this.defibUsed);
  }
  rescue(sq, t) {
    if (!this.canRescue(sq, t)) return false;
    const st = this.ast(t);
    let hp = 1, how;
    if (cheb(sq.x, sq.y, t.x, t.y) > 1 || (this.flag(sq, 'defib') && !this.defibUsed && !sq.a.bag.some((it) => ITEMS[it.b].use === 'heal'))) {
      this.defibUsed = 1; hp = Math.round(st.hpMaxEff * 0.25); how = 'el desfibrilador';
      this.fx.push({ type: 'zap', x: t.x, y: t.y });
    } else {
      const heal = sq.a.bag.filter((it) => ITEMS[it.b].use === 'heal').sort((a, b) => ITEMS[a.b].heal - ITEMS[b.b].heal)[0];
      if (heal) { hp = ITEMS[heal.b].heal; how = ITEMS[heal.b].name.toLowerCase(); this.consume(sq, heal); }
      else { hp = 1; how = 'sus propias manos'; this.extraTurn = 1; } // sin botiquín: cuesta un turno más
    }
    if (this.flag(sq, 'rescue')) hp = Math.max(hp, Math.round(st.hpMaxEff * 0.25)); // talento Rescate (Sanitario)
    t.downed = 0; t.a.hp = Math.max(1, Math.min(st.hpMaxEff, hp));
    addAff(sq.a, t.a, 15); addStress(t.a, -10);
    sq.a.saves = (sq.a.saves || 0) + 1;
    statBump('rescues'); // fase 24.6
    this.fx.push({ type: 'heal', x: t.x, y: t.y }, { type: 'snd', s: 'revive' });
    this.say(`✚ ${this.nm(sq)} levanta a ${this.nm(t)} con ${how} (${t.a.hp} de salud).`, 'good');
    this.emit('update');
    return true;
  }
  downedNear(sq) { return this.team.find((o) => this.canRescue(sq, o)) || null; }

  // ---------------------------------------------------------------- munición especial (23.4)
  ammoKindOf(sq) { const w = this.weapon(sq); return w && w.ammoKind && ITEMS[w.ammoKind] ? ITEMS[w.ammoKind].kind : null; }
  // tecla N: elegir el tipo de munición de la siguiente recarga (entre los que lleva en la mochila)
  cycleAmmo(sq = this.cur) {
    const w = this.weapon(sq);
    if (!w) return false;
    const cal = itemStats(w).ammo;
    if (!cal) { this.say('Esta arma no usa munición.', 'dimt'); return false; }
    const opts = [cal, ...new Set(sq.a.bag.filter((it) => it.q > 0 && ITEMS[it.b].cat === 'ammo' && ITEMS[it.b].base === cal).map((it) => it.b))];
    if (opts.length < 2) { this.say('No llevas munición especial de este calibre.', 'dimt'); return false; }
    const cur = opts.indexOf(w.ammoSel || cal);
    w.ammoSel = opts[(cur + 1) % opts.length];
    if (w.ammoSel === cal) w.ammoSel = null;
    const K = w.ammoSel ? AMMO_KINDS[ITEMS[w.ammoSel].kind] : null;
    this.say(`${this.nm(sq)} preparará munición ${K ? `<span style="color:${K.color}">${K.name}</span>` : 'normal'} en la siguiente recarga (R).`, 'dimt');
    this.emit('update');
    return true;
  }

  // ---------------------------------------------------------------- fuego de supresión (23.4)
  canSuppress(sq) { const ws = this.weaponStats(sq); return ['smg', 'rifle', 'mg'].includes(ws.wtype) && (ws.mag || 0) >= 15 && !ws.scope; }
  // tecla P por defecto: ráfaga larga sobre el objetivo; poco daño, pero quien esté a 1 casilla queda suprimido 2 turnos
  suppress(sq, tgt) {
    if (!tgt || !this.canSuppress(sq)) { if (sq === this.cur) this.say('Hace falta un arma automática (subfusil, fusil o ametralladora) para el fuego de supresión.', 'dimt'); return false; }
    const w = this.weapon(sq); const ws = this.weaponStats(sq);
    const rounds = Math.min(w.ld, Math.max(6, (ws.burst || 3) * 3));
    if (rounds < 5) { if (sq === this.cur) this.say('Pocas balas en el cargador para suprimir (5 como mínimo).', 'dimt'); return false; }
    if (this.canShoot(sq, tgt) !== 'ok') { this.attack(sq, tgt); return false; }
    this.fx.push({ type: 'snd', s: 'suppress' });
    w.ld -= rounds;
    for (let i = 0; i < 4; i++) this.fx.push({ type: 'shot', x0: sq.x, y0: sq.y, x1: tgt.x + rng.int(-1, 1), y1: tgt.y + rng.int(-1, 1), hit: false, delay: i * 60, wtype: ws.wtype });
    let n = 0;
    for (const o of this.enemies) if (o.hp > 0 && cheb(o.x, o.y, tgt.x, tgt.y) <= 1 && this.hostile(sq, o)) { o.suppressed = 2; n++; if (o.state !== 'alerta') { o.state = 'alerta'; o.mem = 15; } }
    // algo de daño: un impacto con la mitad del daño
    this.resolveHit(sq, tgt, { ...ws, dmg: [Math.max(1, Math.round(ws.dmg[0] / 2)), Math.max(1, Math.round(ws.dmg[1] / 2))] }, this.ast(sq), false);
    this.noise(sq.x, sq.y, (ws.noise || 10) + 4);
    this.say(`🔫 ${this.nm(sq)} abre fuego de supresión (${rounds} balas): ${n} enemigo(s) suprimidos 2 turnos.`, 'o1');
    return true;
  }
  // ---------------------------------------------------------------- durabilidad y encasquillamientos (23.5)
  // cada disparo desgasta el arma (más con munición incendiaria o expansiva y con el arma mojada);
  // por debajo del 60% puede encasquillarse. Devuelve true si se ha encasquillado (el turno se pierde).
  wearWeapon(sq, w) {
    if (w.dur == null) w.dur = 100;
    const k = this.ammoKindOf(sq);
    const wet = (this.surface && this.weather === 'lluvia') || [T_WATER, T_DEEP].includes(this.tile(sq.x, sq.y));
    w.dur = Math.max(0, w.dur - 0.5 * (k === 'inc' || k === 'hp' ? 1.6 : 1) * (wet ? 1.5 : 1));
    if (rng.chance(Math.max(0, (60 - w.dur) / 400))) {
      w.jammed = 1;
      this.fx.push({ type: 'miss', x: sq.x, y: sq.y }, { type: 'snd', s: 'jam' });
      this.say(`🔧 ¡A ${this.nm(sq)} se le encasquilla el arma! (estado ${Math.round(w.dur)}%) Pulsa <b>R</b> para desencasquillarla.`, 'bad');
      return true;
    }
    return false;
  }
  unjam(sq, w) {
    w.jammed = 0;
    const quick = this.flag(sq, 'quickReload');
    this.say(`${this.nm(sq)} desencasquilla el arma${quick ? ' al instante' : ''}.`, 'dimt');
    this.emit('update');
    return !quick;
  }

  // ---------------------------------------------------------------- granadas (23.6)
  // las paredes (casillas opacas) detienen la granada; por encima de sacos y consolas pasa
  nadeBlocked(x, y) { return !this.inb(x, y) || this.opaque(x, y); }
  // trayectoria hasta el destino; si choca con una pared, rebota una vez y cae 1–2 casillas más allá
  grenadePath(x0, y0, tx, ty) {
    const pts = line(x0, y0, tx, ty);
    let px = x0, py = y0;
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i];
      if (!this.nadeBlocked(x, y)) { px = x; py = y; continue; }
      let dx = Math.sign(x - px), dy = Math.sign(y - py);
      if (dx && dy) {
        const hx = this.nadeBlocked(px + dx, py), hy = this.nadeBlocked(px, py + dy);
        if (hx && !hy) dx = -dx; else if (hy && !hx) dy = -dy; else { dx = -dx; dy = -dy; }
      } else { dx = -dx; dy = -dy; }
      const steps = Math.max(1, Math.min(2, pts.length - i));
      for (let s = 0; s < steps && !this.nadeBlocked(px + dx, py + dy); s++) { px += dx; py += dy; }
      return { x: px, y: py, bounced: true };
    }
    return { x: px, y: py, bounced: false };
  }
  // granada con mecha: queda en el suelo y explota al final del turno indicado (lista `pending`, se guarda)
  armNade(n) { this.pending.push({ kind: 'nade', ...n }); }
  nadeTick() {
    if (this.pending.some((p) => p.kind === 'nade' && p.at > this.turn)) this.fx.push({ type: 'snd', s: 'tick' }); // mecha encendida
    for (const p of [...this.pending]) {
      if (p.kind !== 'nade' || p.at > this.turn) continue;
      this.pending.splice(this.pending.indexOf(p), 1);
      const src = this.squad.find((q) => q.id === p.src && this.inMap(q)) || this.enemies.find((o) => o.uid === p.src) || null;
      this.explode(p.x, p.y, p.blast, p.dmg, src, p.fire || 0, 0, { pierce: p.pierce || 0, essBoost: p.essBoost || 0, noise: p.noise || 14 });
      if (this.ended) return;
    }
  }
  // patada (talento Devolución): una granada enemiga a tu lado sale despedida 3 casillas lejos de ti
  nadeNear(sq) { return this.pending.find((p) => p.kind === 'nade' && p.enemy && cheb(p.x, p.y, sq.x, sq.y) <= 1) || null; }
  kickNade(sq, p) {
    if (!this.flag(sq, 'kickNade')) { this.say(`¡Granada! ${this.nm(sq)} no sabe devolverla: ¡apartaos!`, 'warn'); return false; }
    let dx = Math.sign(p.x - sq.x), dy = Math.sign(p.y - sq.y);
    if (!dx && !dy) { const t = this.enemies.find((o) => o.uid === p.src); dx = t ? Math.sign(t.x - sq.x) : 1; dy = t ? Math.sign(t.y - sq.y) : 0; }
    const land = this.grenadePath(p.x, p.y, p.x + dx * 3, p.y + dy * 3);
    p.x = land.x; p.y = land.y; p.enemy = 0;
    this.fx.push({ type: 'throw', x0: sq.x, y0: sq.y, x1: p.x, y1: p.y, glyph: '•' });
    this.say(`🦶 ¡${this.nm(sq)} devuelve la granada de una patada!`, 'o1');
    statBump('nadesKicked');
    return true;
  }
  // humanos con arma automática: a veces suprimen a los agentes (−30% de impacto 2 turnos)
  humanSuppress(e, tgt, ws) {
    if (!this.isSquad(tgt) || !['smg', 'rifle', 'mg'].includes(ws.wtype) || (e.ld || 0) < 6 || !rng.chance(0.15)) return false;
    e.ld -= 3;
    let n = 0;
    for (const q of this.team) if (cheb(q.x, q.y, tgt.x, tgt.y) <= 1) { q.suppressed = 2; n++; }
    if (n) this.say(`🔫 ${this.enm(e)} os barre con fuego de supresión: ${n} agente(s) agachan la cabeza (−30% de impacto).`, 'warn');
    return n > 0;
  }
}
export const nearCheb = cheb;
