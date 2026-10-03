// Arranque y navegación entre pantallas
import { initDom, $, $$, toast, hideTooltip, modalOpen, modal, measureFont, refreshFrames, applyUiScale } from './util/dom.js';
import { S, newGame, load, save, settings, setExpSerializer, wipe } from './core/state.js';
import { launchExpedition, finalizeExpedition, ensureVolunteer } from './core/campaign.js';
import { Expedition } from './exp/expedition.js';
import { ExpeditionUI } from './ui/expui.js';
import { BaseUI } from './ui/base.js';
import { TitleScreen, IntroScreen, ReportScreen, HelpScreen } from './ui/screens.js';
import { installDebug } from './ui/debug.js';
import { applyA11y } from './ui/a11y.js';
import { applyLang, t } from './i18n/index.js';
import { music, sfx } from './audio.js';
import { setAchievementNotifier } from './core/achievements.js';

let current = null;
let prevScreen = 'title';
let exp = null;

function show(id) {
  hideTooltip();
  for (const s of $$('.screen')) s.classList.toggle('active', s.id === 'screen-' + id);
  current = id;
  // fase 24.5.2: música tranquila en la base y el informe; silencio en el título (la expedición pone su drone)
  if (id === 'base' || id === 'report') music.play('base'); else if (id === 'title' || id === 'intro') music.stop();
}

async function boot() {
  initDom();
  applyUiScale(settings);
  document.body.classList.toggle('no-crt', !settings.crt);
  applyLang(); // fase 24.4: idioma de la interfaz y de los datos
  setAchievementNotifier((a) => { toast(t('ach.unlocked', { n: a.name }), 'good', 5000); sfx.upgrade(); }); // fase 24.6
  applyA11y(); // fase 24.1: modo daltónico y alto contraste
  try {
    await Promise.race([
      Promise.all([document.fonts.load('15px "JetBrains Mono"'), document.fonts.load('700 15px "JetBrains Mono"'), document.fonts.load('800 15px "JetBrains Mono"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {}
  initDom.done = true;
  measureFont(); refreshFrames();
  document.fonts.ready.then(() => { measureFont(); refreshFrames(); });

  setExpSerializer(() => (exp && !exp.ended ? exp.serialize() : null));

  const title = new TitleScreen($('#screen-title'), {
    onContinue: (n) => continueGame(n),
    onNew: (n, opts) => { wipe(n); newGame(n, opts); title.close(); show('intro'); intro.open(); },
    onHelp: () => openHelp(),
  });
  const intro = new IntroScreen($('#screen-intro'), {
    onDone: () => { S.introSeen = true; save(); goBase(); },
  });
  const report = new ReportScreen($('#screen-report'), { onDone: () => {
    // fase 24.7: Hierro sin agentes ni dinero para reclutar → la partida se borra
    if (S && S.iron && S.lastReport && S.lastReport.ironOver) {
      wipe(); show('title'); title.open();
      modal({ title: 'FIN · MODO HIERRO', body: '<div>No queda nadie en el Puesto Pripyat-7 y no hay rublos para reclutar a nadie más.</div><div class="dimt" style="margin-top:.6em">La partida se ha borrado. Los logros siguen ahí.</div>', actions: [{ label: 'ACEPTAR' }] });
      return;
    }
    goBase('cuartel');
  } });
  const help = new HelpScreen($('#screen-help'), {
    onBack: () => { show(prevScreen); if (prevScreen === 'title') title.open(); },
  });
  const base = new BaseUI($('#screen-base'), {
    onHelp: () => openHelp(),
    onQuit: () => { show('title'); title.open(); },
    onLaunch: (mapIdx, agents, evId) => {
      base.close();
      exp = launchExpedition(mapIdx, agents, evId);
      save();
      show('exp');
      expUI.start(exp);
    },
  });
  const expUI = new ExpeditionUI($('#screen-exp'), {
    onEnd: (e) => {
      const rep = finalizeExpedition(e);
      exp = null;
      save();
      return rep;
    },
    onReport: (rep) => { show('report'); report.open(rep); },
    onHelp: () => openHelp(),
    onQuit: () => { save(); exp = null; show('title'); title.open(); },
  });

  function openHelp() {
    prevScreen = current;
    title.close();
    show('help');
    help.open();
  }
  function goBase(tab) {
    ensureVolunteer();
    show('base');
    base.open(tab);
  }
  function continueGame(n) {
    if (!load(n)) { toast('No se pudo cargar la partida.', 'bad'); return; }
    title.close();
    if (S.exp) {
      try {
        exp = Expedition.load(S.exp);
        show('exp');
        expUI.start(exp);
        return;
      } catch (e) {
        console.error(e);
        toast('La expedición guardada estaba dañada. Se ha descartado.', 'bad', 5000);
        S.exp = null;
      }
    }
    if (!S.introSeen) { show('intro'); intro.open(); return; }
    goBase();
  }

  // guardar al salir
  window.addEventListener('beforeunload', () => { if (S) save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S) save(); });

  show('title');
  title.open();
  const debug = installDebug({ exp: () => exp, base, expUI, current: () => current });
  window.__topolev = { get S() { return S; }, get exp() { return exp; }, get expUI() { return expUI; }, show, debug };
}

boot();
