// Pantalla de LOGROS Y ESTADÍSTICAS (fase 24.6.4): desde el menú principal y desde ARCHIVO.
// Los logros son de todas las partidas; las estadísticas, de la partida cargada (si hay una).
import { el, esc, modal } from '../util/dom.js';
import { S } from '../core/state.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { unlockedAchievements, statsDefaults } from '../core/achievements.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { MAPS } from '../data/world.js';

const fmt = (n) => Math.round(n || 0).toLocaleString('es-ES');
const top = (o, n = 6) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, n);

export function achievementsModal() {
  const got = unlockedAchievements();
  const n = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  const body = el('div', { class: 'ach-wrap', style: { minWidth: 'min(90ch, 92vw)' } });
  // logros
  const list = el('div', { class: 'ach-list' });
  for (const a of ACHIEVEMENTS) {
    const g = got[a.id];
    const hide = a.secret && !g;
    list.append(el('div', { class: 'ach' + (g ? ' got' : ''), 'data-ach': a.id, html: `<span class="ach-g">${g ? esc(a.glyph) : '·'}</span><div><b>${hide ? '???' : esc(a.name)}</b><div class="eff">${hide ? 'Logro secreto.' : esc(a.desc)}${g ? ` <span class="good">· día ${g.day}</span>` : ''}</div></div>` }));
  }
  body.append(el('div', { class: 'h', html: `LOGROS <span class="dimt">${n} / ${ACHIEVEMENTS.length} · de todas las partidas de este navegador</span>` }), list);
  // estadísticas de la partida cargada
  if (S && S.stats) {
    statsDefaults(S);
    const s = S.stats;
    const zones = MAPS.filter((m) => s.zones[m.id]).map((m) => { const z = s.zones[m.id]; return `<span>${esc(m.name)}</span><span>${z.exp} exp. · ${z.ext} extr. · ${z.deaths} caídos</span>`; }).join('');
    const species = top(s.killsBy).map(([k, v]) => `<span>${esc(ENEMIES[k] ? ENEMIES[k].name : k)}</span><span>${fmt(v)}</span>`).join('');
    const weapons = top(s.killsWeapon).map(([k, v]) => `<span>${esc(ITEMS[k] ? ITEMS[k].name : k)}</span><span>${fmt(v)}</span>`).join('');
    body.append(el('div', { class: 'sep', text: '─'.repeat(80) }),
      el('div', { class: 'h', html: `ESTADÍSTICAS <span class="dimt">· partida actual, día ${S.day}</span>` }),
      el('div', { class: 'ach-stats', html: `
        <div class="kv"><span>Expediciones</span><span>${fmt(s.expeditions)}</span><span>Extracciones</span><span>${fmt(s.extractions)}</span><span>Bajas</span><span>${fmt(s.kills)}</span>
        <span>Jefes abatidos</span><span>${fmt(s.bossKills)}</span><span>Élites abatidos</span><span>${fmt(s.eliteKills)}</span><span>Ataques por la espalda</span><span>${fmt(s.backstabs)}</span>
        <span>Abatidos levantados</span><span>${fmt(s.rescues)}</span><span>Granadas devueltas</span><span>${fmt(s.nadesKicked)}</span><span>Agentes caídos</span><span>${fmt(s.deaths)}</span>
        <span>Racha sin bajas</span><span>${s.noLoss} (mejor: ${s.bestNoLoss})</span><span>Esencia total</span><span>${fmt(s.essTotal)} ✦</span>
        <span>Día récord</span><span>${s.bestDay ? `día ${s.bestDay.day}: ${fmt(s.bestDay.ess)} ✦` : '—'}</span><span>Rublos ganados</span><span>${fmt(s.rubTotal)} ₽</span></div>
        <div><div class="h">Por zona</div><div class="kv">${zones || '<span class="dimt">—</span><span></span>'}</div>
        <div class="h">Bajas por especie</div><div class="kv">${species || '<span class="dimt">—</span><span></span>'}</div>
        <div class="h">Bajas por arma</div><div class="kv">${weapons || '<span class="dimt">—</span><span></span>'}</div></div>` }));
  }
  modal({ title: 'LOGROS Y ESTADÍSTICAS', body, width: 'min(100ch, 96vw)', actions: [{ label: 'CERRAR' }] });
}
