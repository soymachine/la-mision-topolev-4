// Expedición · Combate táctico (fase 23): sigilo real (agacharse, detección), ataques por la espalda y emboscadas.
// (métodos mezclados en Expedition: ver expedition.js)
import { cheb } from '../util/rng.js';
import { ACTORS } from '../data/actors.js';

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
}
export const nearCheb = cheb;
