// Expedición · Combate táctico (fase 23): sigilo real (agacharse, detección), ataques por la espalda y emboscadas.
// (métodos mezclados en Expedition: ver expedition.js)
import { cheb } from '../util/rng.js';
import { ACTORS } from '../data/actors.js';
import { ITEMS } from '../data/items.js';
import { addStress, addAff } from '../core/story.js';

export class TacticsPart {
  // ---------------------------------------------------------------- sigilo (23.2)
  // agacharse (tecla C): cuesta más que te vean, pero cada dos pasos se pierde un turno
  toggleCrouch(sq = this.cur) {
    if (!sq || !this.inMap(sq)) return false;
    sq.crouch = !sq.crouch; sq.crouchStep = false;
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
    for (const sq of [...this.team]) {
      if (!sq.downed) continue;
      if (sq.a.hp > 0) { sq.downed = 0; this.say(`${this.nm(sq)} se levanta.`, 'good'); continue; }
      sq.downed--;
      if (sq.downed <= 0) this.agentDies(sq, `se desangró (${sq.downCause || 'herido'})`);
      else this.say(`✚ ${this.nm(sq)} se desangra: ${sq.downed} turno(s).`, 'warn');
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
    this.fx.push({ type: 'heal', x: t.x, y: t.y });
    this.say(`✚ ${this.nm(sq)} levanta a ${this.nm(t)} con ${how} (${t.a.hp} de salud).`, 'good');
    this.emit('update');
    return true;
  }
  downedNear(sq) { return this.team.find((o) => this.canRescue(sq, o)) || null; }
}
export const nearCheb = cheb;
