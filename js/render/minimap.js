// Minimapa / radar y mapa completo
import { TILES, T } from '../data/tiles.js';
import { ENEMIES, enemyColor } from '../data/enemies.js';
import { actorColor } from '../data/actors.js';
import { rarityColor } from '../core/items.js';
import { FONT } from './ascii.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrain = document.createElement('canvas');
    this.tctx = this.terrain.getContext('2d');
    this.lastTurn = -1;
    this.markers = [];
  }

  attach(exp) {
    this.exp = exp;
    this.terrain.width = exp.w; this.terrain.height = exp.h;
    this.img = this.tctx.createImageData(exp.w, exp.h);
    this.lastTurn = -1;
  }

  updateTerrain() {
    const e = this.exp;
    const d = this.img.data;
    for (let k = 0; k < e.w * e.h; k++) {
      const i = k * 4;
      if (!e.explored[k]) { d[i + 3] = 0; continue; }
      const t = e.t[k];
      const v = e.visible[k] > 0;
      let r, g, b;
      if (t === T.WATER || t === T.DEEP) { r = 30; g = v ? 120 : 60; b = v ? 120 : 60; }
      else if (TILES[t].walk) { r = v ? 140 : 70; g = v ? 66 : 32; b = v ? 18 : 8; }
      else if (t === T.MACHINE) { r = v ? 120 : 60; g = v ? 70 : 34; b = 14; }
      else if (t === T.CHASM) { r = 0; g = 0; b = 0; }
      else if (t === T.ARMORDOOR || t === T.TERMINAL) { r = 220; g = 180; b = 80; }
      else { r = v ? 210 : 110; g = v ? 100 : 48; b = v ? 26 : 12; }
      if (e.rad[k] > 1.2) { g = Math.min(255, g + 30); }
      if (e.gas[k]) { r = 120; g = 40; b = 160; }
      if (e.fire[k]) { r = 255; g = 90; b = 20; }
      if (t === T.LIFT || t === T.LIFT_UP) { r = 95; g = 247; b = 255; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    this.tctx.putImageData(this.img, 0, 0);
  }

  // dibuja el minimapa al tamaño del canvas destino
  draw(now, opts = {}) {
    const e = this.exp;
    if (!e) return;
    if (e.turn !== this.lastTurn || opts.force) { this.updateTerrain(); this.lastTurn = e.turn; }
    const c = this.canvas, ctx = this.ctx;
    const W = c.width, H = c.height;
    const s = Math.min(W / e.w, H / e.h);
    const ox = (W - e.w * s) / 2, oy = (H - e.h * s) / 2;
    this.s = s; this.ox = ox; this.oy = oy;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // rejilla tenue
    ctx.strokeStyle = 'rgba(255,138,31,.06)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= e.w; gx += 10) { ctx.beginPath(); ctx.moveTo(ox + gx * s, oy); ctx.lineTo(ox + gx * s, oy + e.h * s); ctx.stroke(); }
    for (let gy = 0; gy <= e.h; gy += 10) { ctx.beginPath(); ctx.moveTo(ox, oy + gy * s); ctx.lineTo(ox + e.w * s, oy + gy * s); ctx.stroke(); }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, ox, oy, e.w * s, e.h * s);
    const T_ = now / 1000;
    const P = (x, y) => [ox + (x + 0.5) * s, oy + (y + 0.5) * s];
    const big = !!opts.big;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fz = big ? Math.max(12 * dpr, Math.round(s * 1.3)) : Math.max(11 * dpr, Math.round(W / 24));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this.markers = [];

    // sectores (solo en el mapa grande)
    if (big) {
      ctx.font = `${Math.round(fz * 0.85)}px ${FONT}`;
      for (const sec of e.sectors) {
        ctx.strokeStyle = 'rgba(255,138,31,.12)';
        ctx.strokeRect(ox + sec.x * s, oy + sec.y * s, sec.w * s, sec.h * s);
        ctx.fillStyle = 'rgba(255,138,31,.35)';
        ctx.textAlign = 'left';
        ctx.fillText(`${sec.code} ${sec.name}`, ox + sec.x * s + 4, oy + sec.y * s + fz * 0.7);
        ctx.textAlign = 'center';
      }
    }
    // cámara
    if (opts.view) {
      const v = opts.view;
      ctx.strokeStyle = 'rgba(255,179,92,.5)';
      ctx.strokeRect(ox + v.x * s, oy + v.y * s, v.w * s, v.h * s);
    }
    // POIs
    ctx.font = `700 ${fz}px ${FONT}`;
    const storm = !!opts.storm;
    for (const p of e.pois) {
      if (storm && !e.explored[p.y * e.w + p.x]) continue; // tormenta: sin radar, solo lo ya visto
      const [x, y] = P(p.x, p.y);
      let g, col, label = null;
      if (p.type === 'nest') {
        const def = ENEMIES[p.boss || p.enemy];
        col = p.cleared ? '#5a4a3a' : enemyColor(def.hue, p.lvl);
        g = p.cleared ? '✓' : p.boss ? '☠' : '▲';
        label = p.cleared ? null : String(p.lvl);
        if (!p.cleared) {
          const pulse = 0.5 + 0.5 * Math.sin(T_ * 2 + p.x);
          ctx.fillStyle = col; ctx.globalAlpha = 0.12 + 0.1 * pulse;
          ctx.beginPath(); ctx.arc(x, y, s * 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        }
      } else if (p.type === 'vein') { g = '✦'; col = p.cleared ? '#2a5a5a' : '#5ff7ff'; }
      else if (p.type === 'cache') { g = '■'; col = p.cleared ? '#5a4a3a' : (opts.radar >= 2 ? rarityColor(p.best) : '#ffb02e'); }
      else if (p.type === 'hazard') {
        g = p.kind === 'rad' ? '☢' : p.kind === 'gas' ? '≋' : 'ϟ';
        col = p.kind === 'rad' ? '#b8f53d' : p.kind === 'gas' ? '#c06cff' : '#7fb8ff';
        ctx.strokeStyle = col; ctx.globalAlpha = 0.35;
        ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(x, y, (p.r || 3) * s, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#000'; ctx.fillRect(x - fz * 0.55, y - fz * 0.6, fz * 1.1, fz * 1.2);
      ctx.fillStyle = col;
      ctx.fillText(g, x, y + 1);
      if (label) {
        ctx.font = `800 ${Math.round(fz * 0.8)}px ${FONT}`;
        ctx.fillStyle = '#000'; ctx.fillRect(x + fz * 0.45, y - fz * 0.95, fz * 0.75 * label.length + 2, fz * 0.85);
        ctx.fillStyle = col; ctx.textAlign = 'left';
        ctx.fillText(label, x + fz * 0.5, y - fz * 0.5);
        ctx.textAlign = 'center';
        ctx.font = `700 ${fz}px ${FONT}`;
      }
      if (big && p.type === 'nest' && !p.cleared) {
        ctx.font = `${Math.round(fz * 0.75)}px ${FONT}`;
        ctx.fillStyle = col; ctx.fillText(`${ENEMIES[p.boss || p.enemy].name} Nv ${p.lvl}`, x, y + fz * 1.1);
        ctx.font = `700 ${fz}px ${FONT}`;
      }
      this.markers.push({ x, y, r: fz * 0.8, poi: p });
    }
    // enemigos visibles y errantes detectados por el radar
    for (const en of e.enemies) {
      const vis = e.visible[en.y * e.w + en.x] > 0;
      const sensed = e.sensed(en);
      if (!vis && (storm || (!sensed && !(opts.radar >= 3 && en.state === 'errante')))) continue;
      const [x, y] = P(en.x, en.y);
      ctx.fillStyle = actorColor(en);
      ctx.globalAlpha = vis ? 1 : 0.45 + 0.2 * Math.sin(T_ * 4);
      const r = Math.max(1.5, s * 0.6);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
    // extracciones
    for (const ex of e.exits) {
      const [x, y] = P(ex.x, ex.y);
      const pulse = (T_ * 0.8) % 1;
      ctx.strokeStyle = `rgba(95,247,255,${1 - pulse})`;
      ctx.beginPath(); ctx.arc(x, y, fz * 0.6 + pulse * fz * 1.4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#001416'; ctx.fillRect(x - fz * 0.6, y - fz * 0.65, fz * 1.2, fz * 1.3);
      ctx.fillStyle = '#5ff7ff';
      ctx.fillText('⌂', x, y + 1);
      if (!ex.perm || big) {
        ctx.font = `700 ${Math.round(fz * 0.75)}px ${FONT}`;
        ctx.fillText(ex.perm ? ex.name : `${ex.expires - e.turn}t`, x, y + fz * 1.05);
        ctx.font = `700 ${fz}px ${FONT}`;
      }
      this.markers.push({ x, y, r: fz * 0.8, exit: ex });
    }
    for (const p of e.pending) { const [x, y] = P(p.x, p.y); ctx.fillStyle = '#5ff7ff'; ctx.fillText('◊', x, y); }
    // montacargas y simas (fase 16.2)
    const conn = (cx, cy, g, col, label) => {
      if (!e.explored[cy * e.w + cx] && !big) return;
      const [x, y] = P(cx, cy);
      ctx.fillStyle = '#000'; ctx.fillRect(x - fz * 0.55, y - fz * 0.6, fz * 1.1, fz * 1.2);
      ctx.fillStyle = col; ctx.fillText(g, x, y + 1);
      if (big) { ctx.font = `700 ${Math.round(fz * 0.7)}px ${FONT}`; ctx.fillText(label, x, y + fz * 1.05); ctx.font = `700 ${fz}px ${FONT}`; }
      this.markers.push({ x, y, r: fz * 0.8, conn: label });
    };
    if (e.lift) conn(e.lift[0], e.lift[1], '↓', '#5ff7ff', 'montacargas ↓');
    if (e.floor > 0 && e.start) conn(e.start[0], e.start[1], '↑', '#9fe8a0', 'montacargas ↑');
    for (const c of e.chasms || []) conn(c[0], c[1], '◌', '#c08040', 'sima');
    for (const f of e.flares) { const [x, y] = P(f.x, f.y); ctx.fillStyle = '#ff6ad5'; ctx.fillText('*', x, y); }
    // interferencias de la tormenta electromagnética
    if (storm) {
      ctx.fillStyle = 'rgba(127,184,255,.25)';
      for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1);
      ctx.font = `700 ${Math.round(fz * 0.8)}px ${FONT}`;
      ctx.fillStyle = `rgba(127,184,255,${0.5 + 0.3 * Math.sin(T_ * 6)})`;
      ctx.fillText('ϟ SIN SEÑAL', W / 2, fz);
      ctx.font = `700 ${fz}px ${FONT}`;
    }
    // agentes
    for (const sq of e.squad) {
      if (!e.inMap(sq)) continue;
      const [x, y] = P(sq.x, sq.y);
      const act = sq === e.cur;
      const r = Math.max(2, s * (act ? 1.1 : 0.8));
      ctx.fillStyle = sq.a.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (act) {
        ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(T_ * 5)})`;
        ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // casilla del mapa bajo un punto del canvas
  cellAt(px, py) {
    const e = this.exp;
    if (!this.s) return null;
    const x = Math.floor((px - this.ox) / this.s), y = Math.floor((py - this.oy) / this.s);
    if (x < 0 || y < 0 || x >= e.w || y >= e.h) return null;
    return [x, y];
  }
  markerAt(px, py) {
    let best = null, bd = 1e9;
    for (const m of this.markers) {
      const d = Math.hypot(m.x - px, m.y - py);
      if (d < m.r + 4 && d < bd) { bd = d; best = m; }
    }
    return best;
  }
}
