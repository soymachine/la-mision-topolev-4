// Mapa ASCII de la región de Chernóbil (fase 17): selector de destinos con las zonas como puntos.
import { el, esc, tip } from '../util/dom.js';
import { MAPS, STRATA, zoneOpen } from '../data/world.js';
import { cloudAt, zoneWar, cloudEnabled } from '../core/war.js';
import { FACTIONS } from '../data/factions.js';

export const RW = 64, RH = 22;
// coordenadas aproximadas (no a escala) de los elementos del paisaje
const PLANT = [31, 11, 8, 4]; // x, y, w, h de la central
let BG = null;
function hash(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// capa de fondo: [char, clase]
function background() {
  if (BG) return BG;
  const g = Array.from({ length: RH }, () => Array.from({ length: RW }, () => [' ', '']));
  const put = (x, y, c, cls) => { if (x >= 0 && y >= 0 && x < RW && y < RH) g[y][x] = [c, cls]; };
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const h = hash(x, y);
    // bosques al oeste y al norte (el Bosque Rojo junto a la central)
    const forest = (x < 30 && h < 0.34 - Math.abs(y - 10) * 0.008) || (x < 28 && y > 6 && y < 15 && h < 0.5);
    if (forest) put(x, y, h < 0.12 ? '♠' : '♣', x > 20 && x < 30 && y > 8 && y < 14 ? 'rg-red' : 'rg-for');
    else if (h < 0.05) put(x, y, '·', 'rg-dim');
  }
  // río Prípiat (de norte a sur por el este)
  for (let y = 0; y < RH; y++) { const x = Math.round(52 + Math.sin(y * 0.45) * 2.5 + y * 0.25); put(x, y, '≈', 'rg-water'); put(x + 1, y, '≈', 'rg-water'); }
  // estanque de refrigeración
  for (let y = 14; y <= 20; y++) for (let x = 38; x <= 51; x++) { const dx = (x - 44.5) / 6.5, dy = (y - 17) / 3; if (dx * dx + dy * dy < 1) put(x, y, '≈', 'rg-water'); }
  // carreteras: Prípiat – central – Chernóbil, y la vía de Yanov
  for (let y = 4; y <= 11; y++) put(40 - Math.round((y - 4) * 0.6), y, '·', 'rg-road');
  for (let x = 12; x <= 31; x++) put(x, 13 + Math.round(Math.sin(x * 0.3)), '·', 'rg-road');
  for (let x = 30; x <= 50; x++) put(x, 9, '═', 'rg-rail');
  // la central
  const [px, py, pw, ph] = PLANT;
  for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) put(x, y, y === py + 1 && x === px + 4 ? '☢' : '▓', 'rg-plant');
  // Prípiat
  for (let y = 3; y <= 7; y++) for (let x = 40; x <= 47; x++) if (hash(x * 3, y) < 0.55) put(x, y, '▪', 'rg-city');
  // Duga-3
  for (let x = 5; x <= 14; x++) put(x, 3, '╫', 'rg-duga');
  // rótulos
  const label = (x, y, txt) => { for (let i = 0; i < txt.length; i++) put(x + i, y, txt[i], 'rg-label'); };
  label(43, 1, 'PRÍPIAT');
  label(27, 16, 'CENTRAL');
  label(1, 1, 'CHERNÓBIL-2');
  label(55, 20, 'r. Prípiat');
  label(1, 20, '→ Chernóbil');
  BG = g;
  return g;
}

// marcadores: zonas fijas y zonas de evento temporales
export function regionMap(S, sel, onSelect, extra = []) {
  const g = background().map((row) => row.map((c) => c.slice()));
  const marks = [];
  MAPS.forEach((m, i) => marks.push({ i, m, x: m.pos[0], y: m.pos[1], open: zoneOpen(S, i), cleared: (S.cleared[m.id] || 0) > 0 }));
  for (const ev of extra) marks.push({ ev, x: ev.pos[0], y: ev.pos[1], open: true });
  const pre = el('pre', { class: 'region-map' });
  const byPos = new Map(marks.map((mk) => [mk.y * RW + mk.x, mk]));
  for (let y = 0; y < RH; y++) {
    for (let x = 0; x < RW; x++) {
      const mk = byPos.get(y * RW + x);
      if (!mk) {
        // fase 27: la nube radiactiva, sombreada sobre el paisaje
        const cl = S.war ? cloudAt(x, y) : 0;
        if (cl >= 0.2) { pre.append(el('span', { class: 'rg-cloud', text: cl >= 0.55 ? '▒' : '░' })); continue; }
        const [c, cls] = g[y][x]; pre.append(cls ? el('span', { class: cls, text: c }) : document.createTextNode(c)); continue;
      }
      let glyph, cls;
      if (mk.ev) { glyph = mk.ev.glyph || '!'; cls = 'rg-mk rg-event'; }
      else {
        glyph = !mk.open ? '?' : mk.m.stratum === 'sup' ? '◆' : mk.m.social ? '☭' : '▼';
        cls = `rg-mk ${!mk.open ? 'rg-locked' : mk.m.stratum === 'sup' ? 'rg-sup' : 'rg-sub'} ${mk.cleared ? 'rg-cleared' : ''}`;
      }
      if ((mk.ev && sel === mk.ev.id) || (!mk.ev && sel === mk.i)) cls += ' rg-sel';
      // fase 27: dueño de la zona (color), ofensiva en curso e incendio
      const wz = !mk.ev && mk.open && S.war ? zoneWar(mk.m.id) : null;
      if (wz && wz.offensive) cls += ' rg-attack';
      if (wz && wz.fire) cls += ' rg-fire';
      const span = el('span', { class: cls, text: glyph });
      if (wz && wz.owner !== 'cheb') span.style.color = wz.info.color;
      tip(span, () => {
        if (mk.ev) return `<div class="tt-title" style="color:#ff6ad5">${esc(mk.ev.glyph)} ${esc(mk.ev.name)}</div><div class="dimt">Zona de evento · desaparece en ${mk.ev.left} día(s)</div><div>${esc(mk.ev.desc)}</div>`;
        const m = mk.m;
        if (!mk.open) return `<div class="tt-title">??? <span class="dimt">· ${STRATA[m.stratum]}</span></div><div class="dimt">Se abre al extraer con éxito de: ${m.req.map((r) => esc(MAPS.find((z) => z.id === r).name)).join(' o ')}.</div>`;
        const w = S.war ? zoneWar(m.id) : null;
        const warTxt = w && !m.social ? `<div class="tt-sep">${'─'.repeat(30)}</div><div><span style="color:${w.info.color}">${w.info.glyph} ${esc(w.info.name)}</span>${w.owner === 'cheb' ? ` · presión <b>${Math.round(w.pressure)}</b>/100${w.pressure >= 80 ? ' <span class="bad">(se extiende a las vecinas)</span>' : ''}` : ''}</div>${w.offensive ? `<div class="bad">⚔ Ofensiva de ${esc(FACTIONS[w.offensive.fac] ? FACTIONS[w.offensive.fac].name : w.offensive.fac)}: ${w.offensive.until - S.day} día(s) para frenarla</div>` : ''}${w.cloud >= 0.15 ? `<div class="warn">☁ Bajo la nube radiactiva (${Math.round(w.cloud * 100)}%)</div>` : ''}${w.fire ? `<div class="bad">🔥 Incendio forestal (${w.fire} día/s)</div>` : ''}` : '';
        return `<div class="tt-title">${esc(m.name)}</div><div class="dimt">${STRATA[m.stratum]} · nivel ${m.lvl[0]}–${m.lvl[1]} · ${m.floors} piso(s)${mk.cleared ? ` · <span class="good">${S.cleared[m.id]} extracción(es)</span>` : ''}</div><div>${esc(m.desc)}</div>${warTxt}`;
      });
      if (mk.open) span.addEventListener('click', () => onSelect(mk.ev ? mk.ev : mk.i));
      pre.append(span);
    }
    pre.append(document.createTextNode('\n'));
  }
  const legend = el('div', { class: 'region-legend', html: `<span class="rg-sup">◆</span> superficie · <span class="rg-sub">▼</span> subsuelo · <span class="rg-sub">☭</span> campamento · <span class="rg-event">!</span> evento · <span class="rg-locked">?</span> cerrada · <span class="rg-cleared">subrayada</span>: ya extraída · <span style="color:#5ff7ff">color</span>: liberada / de una facción · <span class="rg-attack">▼</span> ofensiva · <span class="rg-fire">◆</span> incendio${cloudEnabled() ? ' · <span class="rg-cloud">░▒</span> nube' : ''}` });
  return el('div', { class: 'region-wrap' }, pre, legend);
}
