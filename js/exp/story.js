// Expedición · Narrativa: disparo de eventos y diálogos en curso
// (métodos mezclados en Expedition: ver expedition.js)
import { S } from '../core/state.js';
import { fireEvents, dialogView, dialogChoose } from '../core/events.js';
import { actorFaction } from '../data/actors.js';

let dlgTok = 0;

export class StoryPart {
  storyCtx(sq, data = {}, obj = null, actor = null) { return { exp: this, sq: sq || null, a: sq ? sq.a : null, obj, actor, data, S }; }

  // dispara los eventos de `on`; si alguno abre un diálogo, se encola
  trigger(on, data = {}, sq = this.cur) {
    if (this.ended) return [];
    this.eventsDone = this.eventsDone || {};
    const ctx = this.storyCtx(sq, data);
    const fired = fireEvents(on, ctx);
    if (ctx.nextDialog) this.openDialog(ctx.nextDialog, sq);
    return fired;
  }

  openDialog(id, sq = this.cur, obj = null, actor = null) {
    const d = { id, node: 'start', sq: sq ? this.squad.indexOf(sq) : -1, obj: obj ? this.key(obj.x, obj.y) : null, actor: actor ? actor.uid : null, tok: ++dlgTok };
    if (this.dlg) { (this.dlgQueue = this.dlgQueue || []).push(d); return; }
    this.dlg = d;
    this.interrupt = true;
    this.emit('dialog', d);
  }

  dialogCtx() {
    const d = this.dlg;
    const sq = this.squad[d.sq] && this.inMap(this.squad[d.sq]) ? this.squad[d.sq] : this.cur;
    const obj = d.obj != null ? this.objMap.get(d.obj) || null : null;
    const actor = d.actor ? this.enemies.find((e) => e.uid === d.actor) || null : null;
    return this.storyCtx(sq, actor ? { faction: actorFaction(actor), type: actor.type } : {}, obj, actor);
  }

  dialogView() { return this.dlg ? dialogView(this.dlg, this.dialogCtx()) : null; }

  // elige la opción i del diálogo abierto; devuelve true si gasta el turno
  dialogChoose(i) {
    const d = this.dlg;
    if (!d) return false;
    const ctx = this.dialogCtx();
    const r = dialogChoose(d, i, ctx);
    if (!r) return false;
    if (r.end) this.closeDialog();
    else this.emit('dialog', d);
    this.dirty = true;
    return r.turn;
  }

  closeDialog() {
    this.dlg = null;
    const next = this.dlgQueue && this.dlgQueue.shift();
    if (next) { this.dlg = next; this.emit('dialog', next); }
    else this.emit('update');
  }
}
