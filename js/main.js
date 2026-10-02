// Arranque y navegación entre pantallas
import { initDom, $, $$, toast, hideTooltip, modalOpen, measureFont, refreshFrames, applyUiScale } from './util/dom.js';
import { S, newGame, load, save, settings, setExpSerializer, wipe } from './core/state.js';
import { launchExpedition, finalizeExpedition, ensureVolunteer } from './core/campaign.js';
import { Expedition } from './exp/expedition.js';
import { ExpeditionUI } from './ui/expui.js';
import { BaseUI } from './ui/base.js';
import { TitleScreen, IntroScreen, ReportScreen, HelpScreen } from './ui/screens.js';
import { installDebug } from './ui/debug.js';

let current = null;
let prevScreen = 'title';
let exp = null;

function show(id) {
  hideTooltip();
  for (const s of $$('.screen')) s.classList.toggle('active', s.id === 'screen-' + id);
  current = id;
}

async function boot() {
  initDom();
  applyUiScale(settings);
  document.body.classList.toggle('no-crt', !settings.crt);
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
    onNew: (n) => { wipe(n); newGame(n); title.close(); show('intro'); intro.open(); },
    onHelp: () => openHelp(),
  });
  const intro = new IntroScreen($('#screen-intro'), {
    onDone: () => { S.introSeen = true; save(); goBase(); },
  });
  const report = new ReportScreen($('#screen-report'), { onDone: () => goBase('cuartel') });
  const help = new HelpScreen($('#screen-help'), {
    onBack: () => { show(prevScreen); if (prevScreen === 'title') title.open(); },
  });
  const base = new BaseUI($('#screen-base'), {
    onHelp: () => openHelp(),
    onQuit: () => { show('title'); title.open(); },
    onLaunch: (mapIdx, agents) => {
      base.close();
      exp = launchExpedition(mapIdx, agents);
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
  window.__topolev = { get S() { return S; }, get exp() { return exp; }, show, debug };
}

boot();
