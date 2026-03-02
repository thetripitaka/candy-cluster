




import { setLang, getLang, t } from "./i18n/i18n";
import type { Lang } from "./i18n/i18n";
import { ensureUiFontLoaded } from "./i18n/loadFonts";
import "./style.css";
import { localizeStyle, applyUiTextCase, splashSubtitleFontFamilyFor } from "./i18n/uiTextStyle";
import { micro5ForLatinUiFontFamily } from "./i18n/uiTextStyle";
import rgsClient from "./rgs/rgsClient";
import { createUIBottom } from "./ui/uiBottom";
import { createUiController } from "./ui/uiController";
import { installUiInputController } from "./ui/uiInputController";
import { makeLayoutAll } from "./layout/layoutAll";
import { makeLayoutUI } from "./layout/layoutUI";
import { makeLayoutBackground } from "./layout/layoutBackground";
import { makeStartupIntro } from "./layout/startupIntro";
import { getReelAnchor } from "./layout/reelAnchor";
function dollarsToMicro(amount: number): number {
  return Math.max(0, Math.round((Number(amount) || 0) * 1_000_000));
}
import { PIXELDOWN_STACK } from "./i18n/fonts"; // near your other imports
import { MICRO5_STACK } from "./i18n/fonts";
import { getResultProvider } from "./engine/resultProvider";
import { setRtpScale } from "./game/simulate";
import {
  Application,
  Container,
  Sprite,
  Texture,
  Assets,
  BlurFilter,
  ColorMatrixFilter, // ✅ ADD
  Graphics,
  Text,
  TextStyle,
  Rectangle,
  AnimatedSprite,
} from "pixi.js";

import {
  MOBILE_LANDSCAPE_REELHOUSE_MUL,
  MOBILE_LANDSCAPE_TUMBLE_BANNER_MUL,
  isMobileUILayout,
  isMobilePortraitUILayout,
  isMobileLandscapeUILayout,
  disableCustomCursorOnMobile,
  setCursorSafe,
  isTabletLandscape,
    isTabletPortrait,
isTabletLike,
  carsDisabled,
} from "./ui/layoutFlags";

  import {
    waitMs,
    animateMs,
    tween,
    easeOutBack,
    easeOutCubic,
    easeInCubic,
    softstep,
  } from "./core/timing";

  import { addSystem, ensureTickerRouter } from "./core/tickerRouter";


  import { buildSimConfig, LADDER, SYMBOL_FRAMES, WEIGHTS_BASE, } from "./game/simConfig";

  import { createSettingsMenu } from "./ui/settingsMenu";

  import { createBuyMenu } from "./ui/buyMenu";



  import { createAutoMenu } from "./ui/autoMenu";
  import { applyClickToContinueStyle } from "./ui/textStyles";
  import { safeInsetBottomPx, safeInsetTopPx } from "./ui/safeArea";
  import { makeTurboTiming } from "./core/turboTiming";
import { makeGrid } from "./game/gridGen";
  
import { idxToXY, xyToIdx } from "./game/gridMath";
import { fmtMoney } from "./ui/money";


import { AudioManager } from "./audio/audio.ts";
import { installLoaderMagicCursor } from "./ui/loaderMagicCursor";

import { uiFontFamilyFor } from "./i18n/fonts";

import type { SfxKey } from "./audio/audio";


  import type {
    Mode,
    SymbolId,
    Cell,
    Cluster,
    SpinStep,
    SpinResult
  } from "./game/simulate";


  let settingsApi: any = null;
  let buyMenuApi: any = null;
let autoMenuApi: any = null;
// --- DEV / REPLAY SUPPORT ---
type CellView = { sprite: any; eyes: any };
// =====================
// UI LAYER (TDZ-safe forward declarations)
// =====================
let uiLayer: Container;
let uiPanel: Container;
let uiController: ReturnType<typeof createUiController>;
 let cellViews: CellView[] = [];
let lastSettledGrid: Cell[] | null = null;
// ✅ TDZ-safe forward declarations (must be BEFORE any use)
let PANEL_HEIGHT_FRAC = 0.1;

let bgBase: Sprite | null = null;
let bgFree: Sprite | null = null;

let boostedText: Text | null = null;
let infusedText: Text | null = null;



async function main() {
  
    if ((window as any).__GAME_BOOTED__) return;
  (window as any).__GAME_BOOTED__ = true;

  // ------------------------------------------------
  // 🔒 SHIP-LOCKED RTP CALIBRATION (GLOBAL)
  // ------------------------------------------------
// Only set default RTP scales when running the actual game in the browser.
// Node scripts (generateBooks, RTP sims, etc.) must control scales themselves.
if (typeof window !== "undefined") {
  setRtpScale(0.97, 1.0);
}

  
 // 1) decide language first
  const detectedLang =
    new URLSearchParams(window.location.search).get("lang") ||
    localStorage.getItem("lang") ||
    "en";

  setLang(detectedLang as any);
console.log("fmtMoney RUB sample:", fmtMoney(12.34));
console.log(
  "currency code used:",
  new URLSearchParams(location.search).get("currency")
);

 // =====================
// RGS (Stake) boot handshake
// =====================
const isRgs = rgsClient.initFromUrl();
// ✅ Make rgsClient visible to UI modules like buyMenu.ts
(window as any).rgsClient = rgsClient;
const isDemo = isRgs ? rgsClient.isDemo() : false;
console.log("[RGS] demo?", isDemo);
const isLiveRgs = isRgs && !isDemo;

const DEV_FORCE_RGS_OK =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("rgs_dev_ok") === "1";


let rgsAuthed = false;
let rgsReady = !isRgs; // non-RGS builds are always "ready"
let rgsInitialBalance: number | null = null;
let __rgsBalanceSeededOnce = false;
let rgsAuthP: Promise<void> | null = null;
let __gameReady = false;
let __pendingResumeRound = false;
let __resumeInProgress = false;
// ✅ RGS round lock (prevents "player has active bet" spam)
let rgsRoundLock = false;
let pendingReplayRes: SpinResult | null = null;
let replayLoaded = false;
let rgsLastRoundId: string | null = null;

async function resumeInterruptedRound() {
  console.log("[RGS] auto-resume starting");
  if (__resumeInProgress) return;
  __resumeInProgress = true;

  // prevent any future resume prompts
  __pendingResumeRound = false;

  try {
    const auth = rgsClient.getLastAuth() as any;
    const round = auth?.round;

    const stateArr =
      round?.state ??
      round?.event?.state ??
      null;

    if (Array.isArray(stateArr) && stateArr.length && Array.isArray(stateArr[0]?.grid)) {
      console.log("[RGS] auto-resume: replaying round.state steps:", stateArr.length);

      const resumeSpin: any = {
        mode: "BASE",
        initialGrid: stateArr[0].grid,
        steps: stateArr.map((st: any) => ({
          grid: st.grid,
          nextGrid: st.nextGrid,
          clusters: st.clusters ?? [],
          explodePositions: st.explodePositions ?? [],
          multiplier: st.multiplier ?? 1,
          stepWinX: st.stepWinX ?? 0,
          infusedScatters: st.infusedScatters ?? 0,
          enchantedClusters: st.enchantedClusters ?? 0,
          aftershockWildSpawned: !!st.aftershockWildSpawned,
          aftershockWildIndex: st.aftershockWildIndex ?? -1,
        })),
        totalWinX: Number(round?.payoutMultiplier ?? 0),
        ladderIndexAfter: state.fs.ladderIndex,
        fsRemainingAfter: state.fs.remaining,
        fsAwarded: 0,
      };

      // minimal safe lock
      state.ui.spinning = true;
      try {
        (spinBtnPixi as any).eventMode = "none";
        (buyBtnPixi as any).eventMode = "none";
        (autoBtnPixi as any).eventMode = "none";
        (turboBtnPixi as any).eventMode = "none";
        if (betUpBtnPixi) (betUpBtnPixi as any).eventMode = "none";
        if (betDownBtnPixi) (betDownBtnPixi as any).eventMode = "none";
      } catch {}

      // wait until fully booted
      await new Promise<void>((resolve) => {
        const tick = () => (__gameReady ? resolve() : requestAnimationFrame(tick));
        tick();
      });

      await playSpin(resumeSpin);

      if (rgsClient.getLastRoundActive()) {
        try { await rgsClient.endRound(); } catch {}
      }

      try {
        const b = await rgsClient.balance();
        const amt = (b as any)?.balance?.amount;
        if (typeof amt === "number" && Number.isFinite(amt)) {
          state.bank.balance = amt / 1_000_000;
          balanceLabel.text = fmtMoney(state.bank.balance);
        }
      } catch (e) {
        console.warn("[RGS] balance sync after resume failed", e);
      }

      // restore UI interaction
      state.ui.spinning = false;
      try {
        (spinBtnPixi as any).eventMode = "static";
        (buyBtnPixi as any).eventMode = "static";
        (autoBtnPixi as any).eventMode = "static";
        (turboBtnPixi as any).eventMode = "static";
        if (betUpBtnPixi) (betUpBtnPixi as any).eventMode = "static";
        if (betDownBtnPixi) (betDownBtnPixi as any).eventMode = "static";
      } catch {}

      return;
    }

    // no state => restart behavior
    console.warn("[RGS] auto-resume: no round.state available -> endRound (restart)");
    await rgsClient.endRound();
  } catch (e) {
    console.warn("[RGS] auto-resume failed, ending round", e);
    try { await rgsClient.endRound(); } catch {}
  } finally {
    __resumeInProgress = false;

    // if overlay exists, remove it (prevents flash sticking around)
    document.getElementById("resume-overlay")?.remove();
  }
}


// ✅ DEV override: pretend we’re authed so you can test UI/spins locally.
// DO NOT return from main(); just flip flags.
if (DEV_FORCE_RGS_OK) {
  console.warn("[RGS] DEV OVERRIDE ENABLED (rgs_dev_ok=1)");
  rgsAuthed = true;
  rgsReady = true;
}


// Kick off font loads early, but DON'T block boot visuals
const fontWarmupP = (async () => {
  await ensureUiFontLoaded("en");
  await ensureUiFontLoaded(getLang());

  // load specific faces you actually use
await Promise.allSettled([
  document.fonts.load('16px "Micro5"'),
  document.fonts.load('16px "pixeldown"'),
  document.fonts.load('16px "Tiny5-Regular"'),
  document.fonts.load('16px "BigShoulders60pt-Black"'),
]);

})();


  // force browser to actually rasterize the font once
  const warmCanvas = document.createElement("canvas");
  warmCanvas.width = warmCanvas.height = 2;
  const ctx = warmCanvas.getContext("2d");
  if (ctx) {
    ctx.font = '16px "Micro5"';
    ctx.fillText(".", 0, 0);
    ctx.font = '16px "pixeldown"';
    ctx.fillText(".", 0, 0);
  }

// 3) apply DOM rotate blocker font immediately
document
  .getElementById("rotate-blocker-text")
  ?.style.setProperty("font-family", uiFontFamilyFor(getLang()));





      // =====================
// INPUT MODE DETECTION (declare ONCE)
// =====================
const IS_TOUCH =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.matchMedia?.("(pointer: coarse)")?.matches;
  

      



function forcePlaquepixeldown(txt: Text) {
  const s: any =
    (txt.style as any)?.clone ? (txt.style as any).clone() : { ...(txt.style as any) };

  // ✅ brand font + currency-safe fallback
  s.fontFamily = PIXELDOWN_STACK;

  txt.style = new TextStyle(s);
}



function forceMicro5(txt: Text) {
  const s: any =
    (txt.style as any)?.clone ? (txt.style as any).clone() : { ...(txt.style as any) };

  // ✅ UI font + currency-safe fallback
  s.fontFamily = MICRO5_STACK;

  txt.style = new TextStyle(s);
}


function loaderFontFamilyFor(lang: string) {
  // ✅ ONLY Latin-safe languages => Micro5
  if (isLatinUiLang(lang)) return '"Micro5"';

  // ✅ non-latin => glyph-safe per-language font
  return uiFontFamilyFor(lang as Lang);
}

function forceOverlayBrandFont(txt: Text) {
  if (!txt) return;

  // Use your existing overlay font chooser if you have it:
  // const ff = overlayBrandFontFamilyFor(getLang());

  // If you *don't* have overlayBrandFontFamilyFor, use this:
 const ff = isLatinUiLang(getLang()) ? PIXELDOWN_STACK : uiFontFamilyFor(getLang() as any);


  const s: any =
    (txt.style as any)?.clone ? (txt.style as any).clone() : { ...(txt.style as any) };

  s.fontFamily = ff;
  txt.style = new TextStyle(s);
}


function forceLoaderFont(txt: Text) {
  if (!txt) return;

  const s: any =
    (txt.style as any)?.clone ? (txt.style as any).clone() : { ...(txt.style as any) };

  s.fontFamily = loaderFontFamilyFor(getLang());
  txt.style = new TextStyle(s);
}

// -----------------------------
// BOTTOM UI FONT OVERRIDE (Latin langs -> Micro5)
// -----------------------------
function isLatinUiLang(lang: string) {
  // treat xx and xx-YY the same
  const base = (lang || "en").toLowerCase();

  // Latin-script UI languages you care about
  const latin = [
    "en", "es", "fr", "de", "it", "pt",
    "nl", "sv", "da", "no", "fi",
    "pl", "cs", "sk", "hu", "ro", "tr",
  ];

  return latin.some((k) => base === k || base.startsWith(k + "-"));
}

function bottomUiFontFamilyFor(lang: string) {
  return micro5ForLatinUiFontFamily(lang);
}
function forceBottomUiFont(txt: Text) {
  if (!txt) return;

  const s: any =
    (txt.style as any)?.clone ? (txt.style as any).clone() : { ...(txt.style as any) };

  s.fontFamily = bottomUiFontFamilyFor(getLang());
  txt.style = new TextStyle(s);
}


function refreshLocalizedText() {
// Boosted / Infused popups
if (boostedText) boostedText.text = applyUiTextCase(t("ui.popup.boosted"));
if (infusedText) infusedText.text = applyUiTextCase(t("ui.popup.infused"));

try {
  if (boostedText) forceOverlayBrandFont(boostedText);
  if (infusedText) forceOverlayBrandFont(infusedText);
} catch {}

  if (typeof splashShadowBlocky !== "undefined") {
  splashShadowBlocky.text = applyUiTextCase(t("blocky"));
}
if (typeof splashShadowFarm !== "undefined") {
  splashShadowFarm.text = applyUiTextCase(t("farm"));
}
  // ✅ FS OUTRO overlay fonts (non-latin -> language font)
try {
  // update the label text too (important for non-English)
  if (typeof fsOutroTotalLabel !== "undefined") {
    fsOutroTotalLabel.text = applyUiTextCase(t("ui.totalWin"));
  }

  if (typeof fsOutroTotalLabel !== "undefined") forceOverlayBrandFont(fsOutroTotalLabel);
  if (typeof fsOutroWinAmount !== "undefined") forceOverlayBrandFont(fsOutroWinAmount);
  if (typeof fsOutroContinue !== "undefined") forceOverlayBrandFont(fsOutroContinue);
} catch {}

  // =====================
// SPLASH LOCALISATION
// =====================
try {
  if (typeof splashInfoBoxes !== "undefined" && splashInfoBoxes?.length) {
    for (let i = 0; i < splashInfoBoxes.length; i++) {
      const box = splashInfoBoxes[i] as any;
      const title = box._splashTitle as Text | undefined;
      const subtitle = box._splashSubtitle as Text | undefined;

      const info = SPLASH_INFO[i];
      if (title && info?.titleKey) title.text = applyUiTextCase(t(info.titleKey));
      if (subtitle && info?.bodyKey) subtitle.text = applyUiTextCase(t(info.bodyKey));

      // re-apply localized styles so font changes apply too
      if (title) title.style = new TextStyle(localizeStyle({ ...(title.style as any) }) as any);
      if (subtitle) {
  const st: any = localizeStyle({ ...(subtitle.style as any) });
  st.fontFamily = splashSubtitleFontFamilyFor(getLang()); // ✅ Latin => Micro5
  subtitle.style = new TextStyle(st);
}

    }

  }

  if (typeof splashLayer !== "undefined" && splashLayer?.visible && typeof layoutSplash === "function") {
    layoutSplash(); // text width changes => layout changes
  }
} catch {}

  // Loader
if (typeof loadingTitle !== "undefined") loadingTitle.text = t("ui.loading");
if (typeof loadingPct !== "undefined") {
  // keep whatever % you’re currently showing
  const pct = parseInt(String(loadingPct.text).replace(/[^\d]/g, ""), 10) || 0;
  loadingPct.text = `${pct}%`;
}

// Also re-apply localized fonts to loader styles
if (typeof loadingTitle !== "undefined") loadingTitle.style = new TextStyle(localizeStyle({ ...(loadingTitle.style as any) }) as any);
if (typeof loadingPct !== "undefined") loadingPct.style = new TextStyle(localizeStyle({ ...(loadingPct.style as any) }) as any);

// ✅ Re-assert loader-only font choice after localizeStyle()
if (typeof loadingTitle !== "undefined") forceLoaderFont(loadingTitle);
if (typeof loadingPct !== "undefined") forceLoaderFont(loadingPct);


  // FS retrigger popup label
if (typeof fsAddedLabelText !== "undefined") {
  fsAddedLabelText.text = applyUiTextCase(t("ui.freeSpins"));
}
// ✅ FS retrigger popup fonts (non-latin -> language font)
try {
  const ff = overlayBrandFontFamilyFor(getLang());

  if (typeof fsAddedAmountText !== "undefined" && fsAddedAmountText) {
    const st: any = (fsAddedAmountText.style as any)?.clone ? (fsAddedAmountText.style as any).clone() : { ...(fsAddedAmountText.style as any) };
    st.fontFamily = ff;
    fsAddedAmountText.style = new TextStyle(st);
  }

  if (typeof fsAddedLabelText !== "undefined" && fsAddedLabelText) {
    const st: any = (fsAddedLabelText.style as any)?.clone ? (fsAddedLabelText.style as any).clone() : { ...(fsAddedLabelText.style as any) };
    st.fontFamily = ff;
    fsAddedLabelText.style = new TextStyle(st);
  }
} catch {}

  // Rotate overlays
  rotateText.text = t("ui.rotateBackPortrait");

  // Continue prompts
  const cta = t("ui.clickToContinue");

  if (typeof splashContinue !== "undefined") splashContinue.text = applyUiTextCase(cta);
  if (typeof fsContinueText !== "undefined") fsContinueText.text = applyUiTextCase(cta);
  if (typeof fsOutroContinue !== "undefined") fsOutroContinue.text = applyUiTextCase(cta);
  if (typeof bigWinContinue !== "undefined") bigWinContinue.text = applyUiTextCase(cta);
  // Big Win title (if overlay is showing, keep it in the correct language)
if (typeof bigWinTitle !== "undefined" && state?.overlay?.bigWin) {
  // use whatever tier is currently displayed (fallback to BIG)
  setBigWinTitleForTier((bigWinShownTier ?? "BIG") as any);
}
// ✅ Big Win overlay fonts (non-latin -> language font)
try {
  const ff = overlayBrandFontFamilyFor(getLang());

  if (typeof bigWinTitle !== "undefined" && bigWinTitle) {
    const st: any = (bigWinTitle.style as any)?.clone ? (bigWinTitle.style as any).clone() : { ...(bigWinTitle.style as any) };
    st.fontFamily = ff;
    bigWinTitle.style = new TextStyle(st);
  }

  if (typeof bigWinAmount !== "undefined" && bigWinAmount) {
    const st: any = (bigWinAmount.style as any)?.clone ? (bigWinAmount.style as any).clone() : { ...(bigWinAmount.style as any) };
    st.fontFamily = ff;
    bigWinAmount.style = new TextStyle(st);
  }

  if (typeof bigWinContinue !== "undefined" && bigWinContinue) {
    const st: any = (bigWinContinue.style as any)?.clone ? (bigWinContinue.style as any).clone() : { ...(bigWinContinue.style as any) };
    st.fontFamily = ff;
    bigWinContinue.style = new TextStyle(st);
  }
} catch {}


  // ✅ make sure their font swaps with language (keeps your styling)
  const ctaStyle = localizeStyle({ ...(splashContinue?.style as any) });
  if (typeof splashContinue !== "undefined") splashContinue.style = new TextStyle(ctaStyle as any);

  const fsStyle = localizeStyle({ ...(fsContinueText?.style as any) });
  if (typeof fsContinueText !== "undefined") fsContinueText.style = new TextStyle(fsStyle as any);

  const outroStyle = localizeStyle({ ...(fsOutroContinue?.style as any) });
  if (typeof fsOutroContinue !== "undefined") fsOutroContinue.style = new TextStyle(outroStyle as any);

  const bigStyle = localizeStyle({ ...(bigWinContinue?.style as any) });
  if (typeof bigWinContinue !== "undefined") bigWinContinue.style = new TextStyle(bigStyle as any);
 if (typeof studioTag !== "undefined") forceMicro5(studioTag);
  // ✅ Bottom UI: Latin languages use Micro5
  // (Balance / Win / Bet / Mult labels + values)
  try {
    if (typeof balanceTitleLabel !== "undefined") forceBottomUiFont(balanceTitleLabel);
    if (typeof balanceLabel !== "undefined") forceBottomUiFont(balanceLabel);

    if (typeof winTitleLabel !== "undefined") forceBottomUiFont(winTitleLabel);
    if (typeof winAmountLabel !== "undefined") forceBottomUiFont(winAmountLabel);

    if (typeof betTitleLabel !== "undefined") forceBottomUiFont(betTitleLabel);
    if (typeof betAmountText !== "undefined") forceBottomUiFont(betAmountText);

    if (typeof multTitleLabel !== "undefined") forceBottomUiFont(multTitleLabel);
    if (typeof multAmountLabel !== "undefined") forceBottomUiFont(multAmountLabel);

    // ✅ FIX: bet pill initial size (font swap changes text metrics)
    // Recompute pill bg using the *final* font measurements.
    try {
      updateBetUI();

      // ✅ portrait only: re-center pivots so layout doesn’t “remember” old bounds
      if (isMobilePortraitUILayout(__layoutDeps)) {
        centerPivot(betAmountUI);
        centerPivot(betGroup);
      }
    } catch {}
  } catch {}

// =====================
// SPLASH LOCALISATION
// =====================
try {


  // Logo words (BLOCKY / FARM)
  if (typeof splashLogoBlocky !== "undefined") {
    splashLogoBlocky.text = applyUiTextCase(t("splash.title.blocky"));

    const st = (splashLogoBlocky.style as any)?.clone ? (splashLogoBlocky.style as any).clone() : { ...(splashLogoBlocky.style as any) };
    st.fontFamily = splashTitleFontFamilyFor(getLang());
    splashLogoBlocky.style = new TextStyle(st);
  }

  if (typeof splashLogoFarm !== "undefined") {
    splashLogoFarm.text = applyUiTextCase(t("splash.title.farm"));

    const st = (splashLogoFarm.style as any)?.clone ? (splashLogoFarm.style as any).clone() : { ...(splashLogoFarm.style as any) };
    st.fontFamily = splashTitleFontFamilyFor(getLang());
    splashLogoFarm.style = new TextStyle(st);
  }

  // Card texts
  if (typeof splashInfoBoxes !== "undefined" && splashInfoBoxes?.length) {
    for (let i = 0; i < splashInfoBoxes.length; i++) {
      const box = splashInfoBoxes[i] as any;
      const title = box._splashTitle as Text | undefined;
      const subtitle = box._splashSubtitle as Text | undefined;

      const info = SPLASH_INFO[i];
      if (title && info?.titleKey) title.text = applyUiTextCase(t(info.titleKey));
      if (subtitle && info?.bodyKey) subtitle.text = applyUiTextCase(t(info.bodyKey));

      // re-apply localized styles so font changes work
      if (title) title.style = new TextStyle(localizeStyle({ ...(title.style as any) }) as any);
      if (subtitle) subtitle.style = new TextStyle(localizeStyle({ ...(subtitle.style as any) }) as any);
    }
  }

  // When text changes, bounds change → re-layout splash
  if (typeof splashLayer !== "undefined" && splashLayer?.visible && typeof layoutSplash === "function") {
  layoutSplash();
}
} catch {}

}



    

      // =====================
  // STATE (single source of truth for global flags)
  // =====================
  const state = {
    overlay: {
       boot: true,   
      splash: false,
      startup: false,
      studio: false,

      fsIntro: false,
      fsOutro: false,
      fsOutroPending: false,
      bigWin: false,
    },

    mult: {
      value: 1,
      index: 0,        // ladder / plaque index
      maxIndex: 0,
    },

  win: {
    spinWin: 0,
    totalWin: 0,
    totalWinX: 0,
  },


    ui: {
  settingsOpen: false,
  buyMenuOpen: false,

  spinning: false,
  auto: false,
  turbo: false,
buyChoice: null as null | "SUPER" | "ULTRA",
  // ✅ AUTO MENU “arm then spin”
  autoPendingRounds: -1,  // selected in menu (does NOT start auto)
  autoArmed: false,       // ✅ NEW: menu pick has armed auto, waiting for SPIN confirm

  autoRounds: -1,         // active setting once confirmed by SPIN
  autoLeft: 0,            // spins remaining when autoRounds != -1

},

    game: {
    mode: "BASE",
    returningFromFreeSpins: false,
  },

    fs: {
      remaining: 0,
      total: 0,
      ladderIndex: 1,
      sessionTotalWin: 0,
      totalCap: 20, // was state.fs.totalCap
    },

  bank: {
    betLevels: [
  0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.80, 1.00,
  1.20, 1.40, 1.60, 1.80, 2.00, 3.00, 4.00, 5.00,
  6.00, 7.00, 8.00, 9.00, 10.00, 12.00, 14.00, 16.00, 18.00, 20.00,
  30.00, 40.00, 50.00, 75.00, 100.00, 150.00, 200.00, 250.00,
  300.00, 350.00, 400.00, 450.00, 500.00, 750.00, 1000.00
],
   betIndex: 7, // $1.00 default
    balance: 1000,
    lastWin: 0,
  },

  };

  if (isRgs) {
  rgsAuthP = rgsClient
    .authenticate()
    .then((res) => {
      rgsAuthed = true;
      rgsReady = true;
      console.log("[RGS] authenticated", res);
      console.log("RGS BET CONFIG:", res.config);
      console.log("RGS BET LEVELS:", res.config.betLevels);
      // ✅ Use Stake-provided betLevels (required for review compliance)
const cfg = res.config;
const levels = Array.isArray(cfg?.betLevels) ? cfg.betLevels : null;

if (levels && levels.length) {
  // convert micro-units -> dollars for your UI (fmtMoney expects dollars)
  const dollars = levels.map((v) => v / 1_000_000);

  // overwrite your local list
  state.bank.betLevels = dollars;

  // set default index from Stake's defaultBetLevel (micro-units)
  const def = Number(cfg.defaultBetLevel);
  let idx = levels.indexOf(def);
  if (idx < 0) idx = 0;

  state.bank.betIndex = idx;

  console.log("[RGS] applied betLevels =>", state.bank.betLevels.length, "default idx:", idx);
  

  // refresh UI text + affordability if these exist already
  try { updateBetUI(); } catch {}
  try { uiController?.refreshSpinAffordability?.(); } catch {}
  try { if (state.ui.buyMenuOpen) buyMenuApi?.layoutBuy?.(); } catch {}
}

// ✅ Refresh bet-level rule (Stake review requirement):
// - If authenticate says a round is active: preserve bet level (from round amount)
// - Otherwise: revert to default bet level
try {
  const cfg = (res as any)?.config;
  const betLevels: number[] = Array.isArray(cfg?.betLevels) ? cfg.betLevels : [];

  // default index from Stake config
  const def = Number(cfg?.defaultBetLevel);
  let defaultIdx = betLevels.indexOf(def);
  if (defaultIdx < 0) defaultIdx = 0;

  const round = (res as any)?.round;
  const isActiveRound = !!round?.active;

  if (isActiveRound) {
    // Preserve bet ONLY when active
    const roundAmt = Number(round?.amount ?? round?.betAmount ?? NaN);
    const idx = betLevels.indexOf(roundAmt);

    if (idx >= 0) {
      state.bank.betIndex = idx;
      console.log("[RGS] refresh: active round -> preserved betIndex:", idx, "amount:", roundAmt);
    } else {
      // If amount not found, fall back to default (safe)
      state.bank.betIndex = defaultIdx;
      console.warn("[RGS] refresh: active round but amount not in betLevels -> defaultIdx:", defaultIdx, "amount:", roundAmt);
    }
  } else {
    // No active round -> MUST revert to default
    state.bank.betIndex = defaultIdx;
    console.log("[RGS] refresh: no active round -> default betIndex:", defaultIdx);
  }

  // reflect UI
  try { updateBetUI(); } catch {}
  try { uiController?.refreshSpinAffordability?.(); } catch {}
  try { if (state.ui.buyMenuOpen) buyMenuApi?.layoutBuy?.(); } catch {}
} catch (e) {
  console.warn("[RGS] refresh bet restore rule failed:", e);
}

try {
  const levels = res.config?.betLevels ?? [];
  const round = (res as any)?.round;
  const isActiveRound = !!round?.active;

  if (isActiveRound) {
    const roundAmt = Number(round?.amount ?? round?.betAmount ?? NaN);
    if (Number.isFinite(roundAmt) && roundAmt > 0 && Array.isArray(levels) && levels.length) {
      const idx = levels.indexOf(roundAmt);
      if (idx >= 0) state.bank.betIndex = idx;
    }
  }

  try { updateBetUI(); } catch {}
  try { uiController?.refreshSpinAffordability?.(); } catch {}
} catch {}
      // capture any round identifier Stake gives us (shape varies)
rgsLastRoundId =
  (res as any)?.round?.id ??
  (res as any)?.round?.roundId ??
  (res as any)?.roundId ??
  null;


    const balObj =
  (res as any)?.balance ??
  (res as any)?.wallet?.balance ??
  (res as any)?.player?.balance ??
  (res as any)?.data?.balance ??
  null;

const amt = (balObj && typeof balObj === "object") ? (balObj as any).amount : balObj;


      if (typeof amt === "number" && Number.isFinite(amt)) {
        // Stake balances are micro-units (1e6)
        rgsInitialBalance = amt / 1_000_000;
      }
      console.log("[RGS] round on authenticate:", (res as any)?.round);
      // ✅ If a round is active after refresh, show Resume/Restart overlay
const r = (res as any)?.round;
// ✅ DEBUG LOGS (paste here)
console.log("[RGS] auth round:", r ?? null);

// ✅ mark resume as pending if server says a round exists
__pendingResumeRound = !!(r && (r.active === true || r.betID != null || r.id != null));
if (__pendingResumeRound) {
  // ✅ no overlay: just auto-resume
  void resumeInterruptedRound();
}

console.log("[RGS] pendingResumeRound:", __pendingResumeRound, "gameReady:", __gameReady);


    })
    .catch((err) => {
      rgsAuthed = false;
      rgsReady = false;

      console.error("[RGS] authenticate failed", err);

      showFatalBootError(
        "Unable to start session.\n\nThis game link is invalid or has expired.\nPlease return to Stake and relaunch the game.",
        String((err as any)?.message ?? err)
      );
    });
}
function showResumeOverlay() {
  if (document.getElementById("resume-overlay")) return;

  const box = document.createElement("div");
  box.id = "resume-overlay";
  box.style.cssText =
    "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(0,0,0,0.85);z-index:2147483647;color:#fff;font-family:system-ui;padding:24px;text-align:center;";

  box.innerHTML = `
    <div style="max-width:680px;line-height:1.45">
      <div style="font-size:22px;font-weight:700;margin-bottom:10px">Session Resumed</div>
      <div style="font-size:15px;opacity:0.9;margin-bottom:18px">
        We found an active round from before the refresh. Would you like to resume it or restart it?
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button id="resume-btn" style="padding:10px 14px;border-radius:10px;border:0;background:#ffffff;color:#000;font-weight:700;cursor:pointer">Resume round</button>
        <button id="restart-btn" style="padding:10px 14px;border-radius:10px;border:0;background:#333;color:#fff;font-weight:700;cursor:pointer">Restart round</button>
      </div>
    </div>
  `;

  document.body.appendChild(box);

(document.getElementById("resume-btn") as HTMLButtonElement).onclick = async () => {
  console.log("[RGS] resume requested");
  if (__resumeInProgress) return;
__resumeInProgress = true;

// ✅ IMPORTANT: prevent overlay from reappearing later in boot
__pendingResumeRound = false;

  // disable buttons to prevent double-click
  (document.getElementById("resume-btn") as HTMLButtonElement).disabled = true;
  (document.getElementById("restart-btn") as HTMLButtonElement).disabled = true;

  try {
    const auth = rgsClient.getLastAuth() as any;
    const round = auth?.round;

    // Try to find state array on authenticate round
    const stateArr =
      round?.state ??
      round?.event?.state ??
      null;

    if (Array.isArray(stateArr) && stateArr.length && Array.isArray(stateArr[0]?.grid)) {
      console.log("[RGS] resume: replaying round.state steps:", stateArr.length);

      // Build a SpinResult compatible with your playSpin()
      const resumeSpin: any = {
        mode: "BASE",
        initialGrid: stateArr[0].grid,
        steps: stateArr.map((st: any) => ({
          grid: st.grid,
          nextGrid: st.nextGrid,
          clusters: st.clusters ?? [],
          explodePositions: st.explodePositions ?? [],
          multiplier: st.multiplier ?? 1,
          stepWinX: st.stepWinX ?? 0,
          infusedScatters: st.infusedScatters ?? 0,
          enchantedClusters: st.enchantedClusters ?? 0,
          aftershockWildSpawned: !!st.aftershockWildSpawned,
          aftershockWildIndex: st.aftershockWildIndex ?? -1,
        })),
        totalWinX: Number(round?.payoutMultiplier ?? 0),
        ladderIndexAfter: state.fs.ladderIndex,
        fsRemainingAfter: state.fs.remaining,
        fsAwarded: 0,
      };

      box.remove();

// ✅ minimal safe lock (don’t depend on uiController here)
state.ui.spinning = true;
try {
  // hide clickability while resuming (prevents extra input)
  (spinBtnPixi as any).eventMode = "none";
  (buyBtnPixi as any).eventMode = "none";
  (autoBtnPixi as any).eventMode = "none";
  (turboBtnPixi as any).eventMode = "none";
  if (betUpBtnPixi) (betUpBtnPixi as any).eventMode = "none";
  if (betDownBtnPixi) (betDownBtnPixi as any).eventMode = "none";
} catch {}

// ✅ wait until game is fully booted (prevents TDZ crash)
await new Promise<void>((resolve) => {
  const tick = () => (__gameReady ? resolve() : requestAnimationFrame(tick));
  tick();
});

await playSpin(resumeSpin);

      // when done, close the round if server says it's active
      if (rgsClient.getLastRoundActive()) {
        try { await rgsClient.endRound(); } catch {}
      }
      // ✅ sync wallet after resume/restart so UI matches server
try {
  const b = await rgsClient.balance();
  const amt = (b as any)?.balance?.amount;
  if (typeof amt === "number" && Number.isFinite(amt)) {
    state.bank.balance = amt / 1_000_000;
    balanceLabel.text = fmtMoney(state.bank.balance);
  }
} catch (e) {
  console.warn("[RGS] balance sync after resume failed", e);
}
      __pendingResumeRound = false;
      
// ✅ restore UI interaction after resume completes
state.ui.spinning = false;
try {
  (spinBtnPixi as any).eventMode = "static";
  (buyBtnPixi as any).eventMode = "static";
  (autoBtnPixi as any).eventMode = "static";
  (turboBtnPixi as any).eventMode = "static";
  if (betUpBtnPixi) (betUpBtnPixi as any).eventMode = "static";
  if (betDownBtnPixi) (betDownBtnPixi as any).eventMode = "static";
} catch {}
      return;
    }

    // Fallback: no state provided → restart instead
    console.warn("[RGS] resume: no round.state available, falling back to restart");
    await rgsClient.endRound();
__pendingResumeRound = false;
  } catch (e) {
    console.warn("[RGS] resume failed, falling back to restart", e);
    try { await rgsClient.endRound(); } catch {}
__pendingResumeRound = false;
} finally {
  __resumeInProgress = false;
  box.remove();
}
};

  (document.getElementById("restart-btn") as HTMLButtonElement).onclick = async () => {
  console.log("[RGS] restart requested");
  if (__resumeInProgress) return;
__resumeInProgress = true;

// ✅ IMPORTANT: prevent overlay from reappearing later in boot
__pendingResumeRound = false;
  // disable buttons to prevent double-click
  (document.getElementById("resume-btn") as HTMLButtonElement).disabled = true;
  (document.getElementById("restart-btn") as HTMLButtonElement).disabled = true;

  try {
    // ✅ close the active round (restart-from-beginning behaviour)
    await rgsClient.endRound();
    __pendingResumeRound = false; 
    console.log("[RGS] restart: endRound OK");
  } catch (e) {
    console.warn("[RGS] restart: endRound failed", e);
 } finally {
  __resumeInProgress = false;
  box.remove();
}
};
}
// ✅ If RGS provided an initial balance, use it
if (rgsInitialBalance != null) {
  state.bank.balance = rgsInitialBalance;
}

// =====================
// AUDIO
// =====================
const audio = new AudioManager({
  sfxMuted: false,
  musicMuted: false,
  sfxVolume01: 0.8,
  musicVolume01: 0.6,
});
// =====================
// AUDIO UNLOCK (first user gesture)
// =====================
let __audioUnlocked = false;
let __pendingMusic: { key: string; fadeMs?: number } | null = null;

function __unlockAudioOnce() {
  if (__audioUnlocked) return;
  __audioUnlocked = true;

  // this must be called from a real gesture to satisfy browser policies
  audio?.initFromUserGesture?.();

  // play any music we tried to start before unlock
  if (__pendingMusic) {
    playMusicWhenUnlocked(__pendingMusic.key as any, __pendingMusic.fadeMs ?? 400);
    __pendingMusic = null;
  }
}

// capture=true so we get the event early, once=true so it doesn’t stick around
window.addEventListener("pointerdown", __unlockAudioOnce, { capture: true, once: true });
window.addEventListener("keydown", __unlockAudioOnce, { capture: true, once: true });

// helper: safe music start (won't trigger autoplay warnings)
function playMusicWhenUnlocked(key: string, fadeMs = 400) {
  if (__audioUnlocked) {
    // actually start music here (NOT call itself)
    audio?.playMusic?.(key as any, fadeMs); // <-- use your AudioManager method name
    return;
  }
  __pendingMusic = { key, fadeMs };
}




// =====================
// CLUSTER POP PITCH LADDER
// =====================







    function enterFreeSpins(forcedCount = 10, startMult = 2) {

        // ✅ mark FS core transition starting
  const fsToken = markFsCoreNotReady();


      // ✅ set ladder based on the chosen start multiplier (buy feature)
      const idx = LADDER.indexOf(startMult);
      state.fs.ladderIndex = idx >= 0 ? idx : 0;

      const m = LADDER[state.fs.ladderIndex];
      updateMultiplierPlaque(m);
      setMult(m);

      state.game.mode = "FREE_SPINS";

      uiController.applyUiLocks();
    // 🚫 NO BASE CAR DURING FREE SPINS (kill immediately)
    if (bgCarLive) {
      bgCarLive.s.removeFromParent();
      bgCarLive = null;
    }
    clearCarExhaustNow();

    // prevent base car respawn while in FS
    bgCarCooldown = 9999;




      

      // =====================
    // DISABLE LEAF FX DURING FREE SPINS
    // =====================
    leafFxEnabled = false;

    // clear existing leaves immediately
    for (let i = leafLive.length - 1; i >= 0; i--) {
      const p = leafLive[i];
      p.c.removeFromParent();
      leafPool.push(p);
    }
    leafLive.length = 0;
    // =====================
    // DISABLE CLOUD FX DURING FREE SPINS
    // =====================
    cloudFxEnabled = false;

    // clear existing clouds immediately
    for (let i = cloudLive.length - 1; i >= 0; i--) {
      const p = cloudLive[i];
      p.c.removeFromParent();
      cloudPool.push(p);
    }
    cloudLive.length = 0;
    cloudSpawnAcc = 0;

    // =====================
    // DISABLE SMOKE FX DURING FREE SPINS
    // =====================
    smokeFxEnabled = false;
    clearSmokeNow();
    smokeSpawnAcc = 0; // optional safety reset


    // =====================
    // ENABLE SNOW FX DURING FREE SPINS
    // =====================
    snowFxEnabled = true;


      state.fs.remaining = Math.min(forcedCount, state.fs.totalCap);
      state.fs.total = state.fs.remaining; // ✅ initial total for the counter (will grow on retriggers)


      state.fs.sessionTotalWin = 0;

    setReelHouseForMode("FREE_SPINS");
    
      // ✅ turn ON dimmer + blur (blocks input via fsDimmer.eventMode = "static")
      setFsOverlay(true, 0.72, 8, FS_OVERLAY_FADE_IN_MS
        
        
      );
      
      
    // ✅ hard-kill old FS intro drop texts (we use tractor banner now)
    fsIntroAmount.visible = false;
    fsIntroLabel.visible = false;
    fsIntroAmount.alpha = 0;
    fsIntroLabel.alpha = 0;


   
    // ✅ Local/offline only: start the FIRST free spin automatically.
    // (RGS features are driven by server round.state; never start additional /wallet/play calls.)
    const hasRgsSession = !!rgsClient.getConfig()?.sessionID;
    if (!hasRgsSession && !(state.ui as any).isReplay) {
      setTimeout(() => {
        if (state.ui.spinning) return;
        if (state.fs.remaining <= 0) return;
        void doSpin();
      }, 250);
    }
      // ✅ mark FS core fully ready AFTER everything is switched
  markFsCoreReady(fsToken);
    }





  

    const backgroundLayer = new Container();
      
    
    
      
    



      const COLS = 6;
      const ROWS = 5;
      let cellSize = 130;
    const FRAME_GAP = 4.1;     // affects reel house sizing ONLY
    const SYMBOL_GAP = 0;    // affects symbol spacing ONLY
      // what the reel house should assume (usually keep 0)
      const CELL_COUNT = COLS * ROWS;
      const SYMBOL_VISUAL_SCALE = 1;   // overall size inside the cell
    const SYMBOL_INNER_PAD = 6;         // "padding" inside each cell (px)

    // =====================
    // SCATTER / BONUS SYMBOL TUNING (IN-GAME)
    // =====================
    const SCATTER_SCALE_MULT = 1.2; // try 1.15 – 1.35
    const SCATTER_LIFT_Y = 0;       // lift up slightly (px)
    const WILD_SCALE_MULT = 1.18; // 🔧 try 1.10 – 1.35



function fitSpriteToCell(sprite: Sprite) {
  const texW = sprite.texture.width || 1;
  const texH = sprite.texture.height || 1;

  const innerW = cellSize - SYMBOL_INNER_PAD * 2;
  const innerH = cellSize - SYMBOL_INNER_PAD * 2;

  let s = Math.min(innerW / texW, innerH / texH) * SYMBOL_VISUAL_SCALE;

  // ✅ TABLET LANDSCAPE ONLY: global symbol shrink to match reel window
  const TABLET_LAND_SYMBOL_MUL = 0.86;
  if (isTabletLandscape(__layoutDeps)) {
    s *= TABLET_LAND_SYMBOL_MUL;
  }

  // ✅ TINY VIEW ONLY: scale symbols UP individually (NOT the whole grid/gameCore)
  const TINY_SYMBOL_SCALE_MUL = 1.5; // 🔧 try 1.10 .. 1.30
  if ((__layoutDeps as any)?.IS_TINY_VIEW) {
    s *= TINY_SYMBOL_SCALE_MUL;
  }

  sprite.scale.set(s);
  return s; // ✅ return base scale
}



    function applySymbolScale(s: Sprite, id: SymbolId) {
  const base = fitSpriteToCell(s);

  if (id === "S1") {
    s.scale.set(base * SCATTER_SCALE_MULT);
  } else if (id === "W1") {
    s.scale.set(base * WILD_SCALE_MULT);
  } else {
    s.scale.set(base);
  }

  return base;
}


    

      // ---- PIXI ----
      const stageEl = document.getElementById("stage") as HTMLDivElement | null;
      if (!stageEl) throw new Error("Missing #stage div. Check index.html.");






     const app = new Application();
     let __layoutReady = false;

// TDZ-safe helpers
function canLayoutAll() {
  return __layoutReady && typeof layoutAll === "function";
}


const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const maxRes = isMobile ? 1.25 : 2;

await app.init({
  resizeTo: window,
  backgroundAlpha: 0,
  resolution: Math.min(maxRes, window.devicePixelRatio || 1),
  autoDensity: true,
});

ensureTickerRouter(app);
stageEl.appendChild(app.canvas);
function computeCellSize() {
  const W = app.screen.width;
  const H = app.screen.height;

  const safeT = safeInsetTopPx?.() ?? 0;
  const safeB = safeInsetBottomPx?.() ?? 0;

  // ✅ Prefer the *real* measured UI panel height once layoutUI has run.
  // Fallback to PANEL_HEIGHT_FRAC until uiPanelH is known.
  const uiApproxH = Math.round(H * PANEL_HEIGHT_FRAC);
  const uiH = (typeof uiPanelH === "number" && uiPanelH > 0) ? uiPanelH : uiApproxH;

  // ✅ breathing room so reelhouse never kisses edges or UI
  const MARGIN_X = 24;

  // ✅ bigger top breathing room (prevents reelhouse creeping upward too much)
  const MARGIN_TOP = 18;

  // ✅ hard gap between reelhouse bottom and UI panel
  const GAP_ABOVE_UI = 15; // 🔧 try 36..70 if needed

  // ✅ reserve space ABOVE the reelhouse for tumble banner
  // (bigger on portrait because banner tends to sit higher)
  const TUMBLE_RESERVE_TOP =
    isMobilePortraitUILayout(__layoutDeps) ? 140 :
    isMobileLandscapeUILayout(__layoutDeps) ? 110 :
    120; // 🔧 try 90..160

  const availW = Math.max(1, W - MARGIN_X * 2);

  // ✅ available height = screen minus safe areas minus UI panel minus reserved banner strip minus gaps
  const availH = Math.max(
    1,
    (H - safeT - safeB) - uiH - GAP_ABOVE_UI - TUMBLE_RESERVE_TOP - MARGIN_TOP
  );


  // raw fit cell based on available space
  const cellFromW = availW / COLS;
  const cellFromH = availH / ROWS;

  // ✅ choose the limiting dimension
  let s = Math.floor(Math.min(cellFromW, cellFromH));

  // ✅ clamp
  const MIN_CELL = 70;   // don’t go microscopic
  const MAX_CELL = 130;  // your current “full size”
  s = Math.max(MIN_CELL, Math.min(MAX_CELL, s));

  // ✅ mobile landscape: apply your reelhouse multiplier (if < 1 it shrinks)
  // this keeps landscape from colliding with the bottom UI
  if (isMobileLandscapeUILayout(__layoutDeps)) {
    s = Math.floor(s * MOBILE_LANDSCAPE_REELHOUSE_MUL);
  }

  return s;
}


      


  
// =====================
// PORTRAIT-ONLY LOCK (MOBILE)
// =====================
const LOCK_MOBILE_TO_PORTRAIT = false;

// ✅ Tiny view detection (CSS px, so DPR doesn’t lie)
function computeIsTinyView(): boolean {
  const r = (app.view as any)?.getBoundingClientRect?.();
  const cssW = r?.width ?? (app.view as any)?.clientWidth ?? window.innerWidth;
  const cssH = r?.height ?? (app.view as any)?.clientHeight ?? window.innerHeight;

  const longSide = Math.max(cssW, cssH);
  const shortSide = Math.min(cssW, cssH);

  // Stake pop-out S ≈ 400×225 (plus wiggle room)
  return longSide <= 420 && shortSide <= 260;
}

const __layoutDeps: any = { app, LOCK_MOBILE_TO_PORTRAIT, IS_TOUCH, IS_TINY_VIEW: false };

function applyCursorMode() {
  __layoutDeps.IS_TINY_VIEW = computeIsTinyView();

  const stageEl = document.getElementById("stage") as HTMLElement | null;
  const canvas = app.canvas as any;

  // ✅ Tiny view: keep normal system cursor (NO pixel cursor)
  if (__layoutDeps.IS_TINY_VIEW) {
    if (canvas?.style) canvas.style.cursor = "auto";
    document.body.style.cursor = "auto";
    if (stageEl?.style) stageEl.style.cursor = "auto";
    return;
  }

  // ✅ Non-tiny: keep your existing rule (desktop hides OS cursor; mobile does not)
  if (!disableCustomCursorOnMobile(__layoutDeps)) {
    if (canvas?.style) canvas.style.cursor = "none";
    document.body.style.cursor = "none";
    if (stageEl?.style) stageEl.style.cursor = "none";
  } else {
    if (canvas?.style) canvas.style.cursor = "auto";
    document.body.style.cursor = "auto";
    if (stageEl?.style) stageEl.style.cursor = "auto";
  }
}

// run once at boot
applyCursorMode();






      // ROOT + LAYERS
      const root = new Container();


// ✅ CREATE UI BOTTOM EARLY
const uiBottom = createUIBottom();
// =====================
// ✅ UI LAYER (build immediately once root + uiBottom exist)
// =====================
uiLayer = new Container();
uiLayer.zIndex = 8000;
uiLayer.alpha = 0;           // starts hidden (your splash/loader flow)
uiLayer.eventMode = "none";  // no clicks while hidden
root.addChild(uiLayer);

uiPanel = uiBottom.layer;
uiLayer.addChild(uiPanel);


      // =====================
// MOBILE LANDSCAPE BLOCKER (PORTRAIT-ONLY LOCK)
// =====================
const rotateBlocker = new Graphics();
rotateBlocker.zIndex = 10_000_000; // ✅ stronger than anything else
rotateBlocker.visible = false;


rotateBlocker.eventMode = "static";
rotateBlocker.cursor = "default";
root.addChild(rotateBlocker);

const rotateText = new Text(t("ui.rotateBackPortrait"), {
  ...localizeStyle({
    fontFamily: "Micro5",
    fontSize: 36,
    fill: 0xffffff,
    align: "center",
    letterSpacing: 2,
    stroke: { color: 0x000000, width: 4 },
  } as any),
} as any);
rotateText.anchor.set(0.5);
rotateBlocker.addChild(rotateText);

function layoutRotateBlocker() {
  rotateText.text = t("ui.rotateBackPortrait");

  const W = app.screen.width;
  const H = app.screen.height;
  
  rotateBlocker.clear();
  rotateBlocker
    .rect(0, 0, W, H)
    .fill({ color: 0x000000, alpha: 0.85 });

  rotateText.x = Math.round(W / 2);
  rotateText.y = Math.round(H / 2);
}

      root.sortableChildren = true;

      // ✅ Always render something behind everything (prevents 1-frame transparent flash)
    const solidUnderlay = new Graphics();
  solidUnderlay.clear();
  solidUnderlay.rect(0, 0, window.innerWidth, window.innerHeight).fill(0x000000);

    solidUnderlay.zIndex = -999999;
    root.addChild(solidUnderlay);

    window.addEventListener("resize", () => {
      solidUnderlay.clear();
  solidUnderlay.rect(0, 0, window.innerWidth, window.innerHeight).fill(0x000000);

    });
// ✅ TDZ-safe reel anchor getter (we assign this AFTER reelHouse is created)
let getFsReelAnchor: null | (() => ReturnType<typeof getReelAnchor>) = null;

    // =====================
    // FREE SPINS COUNTER (centered)
    // =====================
    const fsCounterWrap = new Container();
    // match multiplier-style skew
    fsCounterWrap.skew.set(0, 0.39);
    fsCounterWrap.zIndex = 5000;
    fsCounterWrap.visible = false;
    fsCounterWrap.eventMode = "none";
    fsCounterWrap.scale.set(1, 1.1); // your original

    const fsCounterTitle = new Text({
  text: t("ui.freeSpins"),
  style: localizeStyle({
    fontFamily: "pixeldown",
    fill: 0xffffff,
    fontSize: 40,
    fontWeight: "100",
    align: "center",
    dropShadow: true,
    dropShadowDistance: 7,
  } as any),
} as any);

const fsCounterValue = new Text({
  text: "0/0",
  style: localizeStyle({
    fontFamily: "pixeldown",
    fill: 0xffd36a,
    fontSize: 50,
    fontWeight: "100",
    align: "center",
    dropShadow: true,
    dropShadowDistance: 7,
  } as any),
} as any);

    fsCounterValue.anchor.set(0.5);
    // ✅ center both texts inside the counter wrap (prevents "label drift" when fonts/lang change)
fsCounterTitle.anchor.set(0.5);
fsCounterTitle.x = 0;
fsCounterValue.x = 0;



// (optional) makes pixel text feel more stable
fsCounterTitle.roundPixels = true;
fsCounterValue.roundPixels = true;


    fsCounterTitle.y = 0;
    fsCounterValue.y = 40;

    fsCounterWrap.addChild(fsCounterTitle, fsCounterValue);
    fsCounterWrap.scale.set(1, 1.1);
    root.addChild(fsCounterWrap);

function layoutFsCounter() {
  const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
  const W = app.screen.width;
  const H = app.screen.height;

  const safeT = safeInsetTopPx?.() ?? 0;

  // ---- SCALE (based on reel sizing / cellSize) ----
  const DESIGN_CELL = 130;
  const cs = Math.max(1, cellSize || 1);
  let responsive = cs / DESIGN_CELL;
  responsive = Math.max(0.60, Math.min(1.15, responsive));

  const base =
    IS_TINY_VIEW ? 0.6 : // 🔧 tiny only (landscape-only tiny)
  isMobilePortraitUILayout(__layoutDeps) ? 0.72 :
  isMobileLandscapeUILayout(__layoutDeps) ? 1 :
  1.0;
  const SY = 1.10;
  fsCounterWrap.scale.set(base * responsive, base * responsive * SY);

  // ✅ If reelhouse anchor isn't ready yet, do a safe fallback
  const A = getFsReelAnchor ? getFsReelAnchor() : null;

  if (!A) {
    fsCounterWrap.position.set(
      Math.round(W * 0.5),
      Math.max(Math.round(H * 0.06), Math.round(safeT + 18))
    );
    return;
  }


  // ---- POSITION ----
  // ✅ MOBILE PORTRAIT: centered + above reel house, always on-screen
  if (isMobilePortraitUILayout(__layoutDeps)) {
    const x = Math.round(A.cx);

    // 🔧 gap above reel house (positive = more gap)
    const GAP_ABOVE_REEL_PX = Math.round(cs * 0.22); // try 0.14..0.32

    // get FS counter height in world coords (after scaling)
    const b = fsCounterWrap.getBounds();
    const halfH = (b.height || 0) * 0.5;

    // place so bottom of counter sits above reel house top
    let y = Math.round(A.top - GAP_ABOVE_REEL_PX - halfH);

    // ✅ clamp to safe top so it never cuts off
    const minY = Math.round(safeT + halfH + 6);
    if (y < minY) y = minY;

    fsCounterWrap.position.set(x, y);
    return;
  }

  // ✅ NON-PORTRAIT: keep your existing behavior (top-right of reel house)
  const PAD_X = Math.round(cs * 0.7);   // 🔧 0.35..0.90
  const PAD_Y = Math.round(cs * 0.6);   // 🔧 -0.10..-0.55

  const x = Math.round(A.right + PAD_X);
  let y = Math.round(A.top + PAD_Y);

  y = Math.max(y, Math.round(safeT + 18));
  fsCounterWrap.position.set(x, y);

  // ✅ TABLET PORTRAIT: pin to TOP-CENTER of DEVICE (screen space), small scale
  if (isTabletPortrait?.(__layoutDeps)) {
    // --- SCALE ---
    const TABLET_PORT_BASE = 0.62; // 🔧 small (try 0.55..0.75)
    const SY = 1.10;

    fsCounterWrap.scale.set(
      TABLET_PORT_BASE * responsive,
      TABLET_PORT_BASE * responsive * SY
    );

    // --- POSITION ---
    const b = fsCounterWrap.getBounds();
    const halfH = (b.height || 0) * 0.5;

    const TOP_PAD = 2; // 🔧 distance from safe top
    const y = Math.round(safeT + TOP_PAD + halfH);

    fsCounterWrap.position.set(Math.round(W * 0.5), y);
    return;
  }


}







    function refreshFsCounter() {
      fsCounterTitle.text = t("ui.freeSpins");
      // ✅ show whenever we're in FREE_SPINS (even when remaining hits 0)
    const show = (state.game.mode === "FREE_SPINS") || state.overlay.fsOutroPending;

      fsCounterWrap.visible = show;
      if (!show) return;

      // total should stay as the session total, even when remaining is 0
      const total = state.fs.total > 0 ? state.fs.total : state.fs.remaining;

      // ✅ show 0/10, 0/12 etc
      fsCounterValue.text = `${Math.max(0, state.fs.remaining)}/${Math.max(0, total)}`;
    }


  

    // keep it positioned + updated
    layoutFsCounter();



  addSystem((dt) => {
    if (!state.overlay.splash) return;
    if (!splashLogoSettled) return;

    splashFloatT += dt;

    const t = splashFloatT;

    const oy = Math.sin(t * Math.PI * 2 * SPLASH_FLOAT_SPD) * SPLASH_FLOAT_AMP_Y;
    const ox = Math.cos(t * Math.PI * 2 * SPLASH_FLOAT_SPD * 0.9) * SPLASH_FLOAT_AMP_X;

    splashLogoBlocky.x = splashBlockyTargetX + ox * splashFloatBlend;
    splashLogoBlocky.y = splashBlockyTargetY + oy * splashFloatBlend;

    splashLogoFarm.x   = splashFarmTargetX   + ox * splashFloatBlend;
    splashLogoFarm.y   = splashFarmTargetY   + oy * splashFloatBlend;
  });


  addSystem(() => {
    layoutFsCounter();
    refreshFsCounter();
  });



    
  


      app.stage.addChild(root);
app.stage.eventMode = "static";
app.stage.hitArea = app.screen;
      // =====================
// ROTATION / RESIZE -> RELAYOUT (portrait <-> landscape)
// =====================
let __vpTimer: number | null = null;

function scheduleViewportRelayout() {
  if (__vpTimer != null) window.clearTimeout(__vpTimer);

  __vpTimer = window.setTimeout(() => {
    __vpTimer = null;

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (!__layoutReady) return; // ✅ prevents TDZ

    applyCursorMode(); // ✅ update tiny/non-tiny cursor behavior on resize

    layoutAll();
// ✅ Win frames must be re-fit whenever cellSize/layout changes
ensureWinFrameSprites();
rescaleWinFramesToCell();

layoutStudioTag();
// ✅ keep reel dimmer in sync with the reel window after every relayout
if (reelDimmer.visible) redrawReelDimmer();
redrawReelHouseGlow(); // ✅ keep glow aligned after relayout

root.sortChildren();
app.stage.hitArea = app.screen;
  });
});

  }, 120);
}

// remove old listeners if hot-reloading
window.removeEventListener("resize", scheduleViewportRelayout as any);
window.removeEventListener("orientationchange", scheduleViewportRelayout as any);

window.addEventListener("resize", scheduleViewportRelayout, { passive: true });
window.addEventListener("orientationchange", scheduleViewportRelayout, { passive: true });



if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", scheduleViewportRelayout, { passive: true });
  window.visualViewport.addEventListener("scroll", scheduleViewportRelayout, { passive: true });

}



// =====================
// FINAL: Build scene graph ONCE (prevents zIndex chaos)
// =====================
let __sceneGraphBuilt = false;
let __uiBuilt = false;



function __buildSceneGraphOnce() {
  if (__sceneGraphBuilt) return;
  __sceneGraphBuilt = true;

  // ✅ ONLY add what is guaranteed to exist at the moment we call this.
  // Do NOT reference late-declared layers here (winPopupLayer, etc.)

  // Root/container sorting
  root.sortableChildren = true;
  gameCore.sortableChildren = true;
  backgroundLayer.sortableChildren = true;

  // These three are safe because we will call this only after they exist:
  if (!backgroundLayer.parent) root.addChild(backgroundLayer);
  if (!gameCore.parent) root.addChild(gameCore);
 

  root.sortChildren();
}










 // =====================
// LOADING SCREEN (boot)
// =====================
const loadingLayer = new Container();
loadingLayer.zIndex = 999999;

// ✅ IMPORTANT: loader must NOT be visible before studio intro
loadingLayer.visible = false;
loadingLayer.alpha = 1;

// keep it blocking input ONLY when we show it later
loadingLayer.eventMode = "none";
loadingLayer.cursor = "default";

root.addChild(loadingLayer);
root.sortChildren();



// ✅ No pixel cursor in tiny view
if (!(__layoutDeps as any).IS_TINY_VIEW) {
  installLoaderMagicCursor({
    app,
    root,
    layoutDeps: __layoutDeps,
    isLoadingVisible: () => loadingLayer.visible,
    sparksInGame: false,
  });
}




    const loadingDim = new Graphics();
    loadingLayer.addChild(loadingDim);

const loadingTitle = new Text({
  text: t("ui.loading"),
  style: localizeStyle({
    fontFamily: "Micro5", // base (will be overridden per-language)
    fill: 0xffffff,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: 2,
    dropShadow: true,
    dropShadowAlpha: 0.6,
    dropShadowDistance: 3,
  } as any),
} as any);

    loadingTitle.anchor.set(0.5);
    loadingLayer.addChild(loadingTitle);

const loadingPct = new Text({
  text: "0%",
  style: localizeStyle({
    fontFamily: "Micro5", // base (will be overridden per-language)
    fill: 0xffd36a,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
    dropShadow: true,
    dropShadowAlpha: 0.5,
    dropShadowDistance: 2,
  } as any),
} as any);



loadingPct.anchor.set(0.5);
loadingLayer.addChild(loadingPct);

// ✅ Apply loader-only font rule (Latin => Micro5, else glyph-safe)
forceLoaderFont(loadingTitle);
forceLoaderFont(loadingPct);

    

    const loadingBarBg = new Graphics();
    const loadingBarFill = new Graphics();
    loadingLayer.addChild(loadingBarBg, loadingBarFill);

    function layoutLoadingScreen() {
      const W = app.screen.width;
      const H = app.screen.height;

    loadingDim.clear();
  loadingDim.rect(0, 0, W, H).fill(0x000000);
      loadingDim.alpha = 1;

      const cx = W / 2;
      const cy = H / 2;
// ✅ Loading title scale: ONLY mobile portrait + tiny view
const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;

// Guard: don't treat tablets as "mobile portrait"
const IS_TABLET = (isTabletLike?.(__layoutDeps) ?? false) || (isTabletPortrait?.(__layoutDeps) ?? false);

const titleScale =
  IS_TINY_VIEW ? 0.72 :                                // 🔧 tiny view only
  (isMobilePortraitUILayout(__layoutDeps) && !IS_TABLET) ? 0.7 : // 🔧 phone portrait only
  1;                                                   // ✅ untouched everywhere else

loadingTitle.scale.set(titleScale, titleScale);

      loadingTitle.position.set(cx, cy - 70);
      loadingPct.position.set(cx, cy - 20);

      // bar sizing
      const barW = Math.min(520, W * 0.7);
      const barH = 18;
      const x = cx - barW / 2;
      const y = cy + 30;



    // outer frame
  loadingBarBg.clear();

  loadingBarBg
    .rect(x, y, barW, barH)
    .fill({ color: 0x000000, alpha: 0.18 })
    .stroke({ width: 2, color: 0xffffff, alpha: 0.35 });


    // inner "well" (optional)
  loadingBarBg
    .rect(
      x + BAR_PAD,
      y + BAR_PAD,
      barW - BAR_PAD * 2,
      barH - BAR_PAD * 2
    )
    .fill({ color: 0x000000, alpha: 0.20 });


    // fill is drawn by updateLoadingProgress()
    loadingBarFill.clear();

    }

    function updateLoadingProgress(p01: number) {
      const p = Math.max(0, Math.min(1, p01));
      loadingPct.text = `${Math.round(p * 100)}%`;


      const W = app.screen.width;
      const barW = Math.min(520, W * 0.7);
      const barH = 18;

      const cx = W / 2;
      const x = Math.round(cx - barW / 2);
      const y = Math.round(app.screen.height / 2 + 30);

      // inner area
      const innerX = x + BAR_PAD;
      const innerY = y + BAR_PAD;
      const innerW = barW - BAR_PAD * 2;
      const innerH = barH - BAR_PAD * 2;

      // choose segment width based on available space
      const segW = Math.max(MIN_SEG_W, 16);
      const segH = Math.min(SEG_H, innerH);

      const maxSegs = Math.floor((innerW + SEG_GAP) / (segW + SEG_GAP));
      const filled = Math.round(p * maxSegs);

      loadingBarFill.clear();

      // draw filled blocks
      for (let i = 0; i < filled; i++) {
        const sx = innerX + i * (segW + SEG_GAP);
        const sy = innerY + Math.round((innerH - segH) / 2);
  // base segment
  loadingBarFill
    .rect(sx, sy, segW, segH)
    .fill({ color: 0xffd36a, alpha: 1 });

  // highlight strip (NES-style shine)
  loadingBarFill
    .rect(sx, sy, segW, 2)
    .fill({ color: 0xffffff, alpha: 0.18 });
      }
    }


    async function hideLoadingScreen() {


  // ✅ prevent any “under-layer” peek while loader fades out
  gameCore.visible = false;
  uiLayer.visible = false;

      // quick fade out
      const startA = loadingLayer.alpha;
      await animateMs(260, (t) => {
        const e = t * t * (3 - 2 * t);
        loadingLayer.alpha = startA * (1 - e);
      });


      loadingLayer.visible = false;
      loadingLayer.eventMode = "none";
      // ✅ safety: allow UI to be re-enabled by reveal pipeline
uiLayer.eventMode = "none"; // stays off until showGameCoreDelayed flips it to auto

    }
// =====================
// FINAL: single boot pipeline (loader -> splash -> startup)
// =====================
let __bootPipelineRan = false;

async function runFinalBootPipelineOnce() {
  if (__bootPipelineRan) return;
  __bootPipelineRan = true;

  try {
    updateLoadingProgress(1);

    // Consistent splash framing before hiding loader
    snapBackgroundToTop();
    setSplashBackgroundFraming(1, 0);

    await hideLoadingScreen();

    // Ensure board exists before splash
    bootInitialBoard();

    // Start splash (splash continue triggers startup intro)
    await startSplashSequence();
  } catch (err) {
    __bootPipelineRan = false; // allow retry if you refresh/hot reload
    throw err;
  }
}

    // =====================
    // NES SEGMENTED LOADING BAR TUNING
    // =====================
    const BAR_PAD = 3;        // padding inside the bar frame
    const SEG_GAP = 3;        // gap between blocks
    const SEG_H = 18;         // block height (usually = barH, but can be slightly smaller)
    const MIN_SEG_W = 14;     // minimum block width (controls how many blocks fit)


  
function removeBootCoverSoon() {
  // wait for at least 2 frames so the canvas actually painted
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById("boot-cover")?.remove();
    });
  });
}


    window.addEventListener("resize", () => {
      layoutLoadingScreen();
      // keep the bar consistent with whatever % we’re currently showing
      const pct = parseInt(loadingPct.text, 10);
      if (!Number.isNaN(pct)) updateLoadingProgress(pct / 100);
    });



    // =====================
    // SPLASH LOGO FLOAT (idle)
    // =====================
    let splashFloatT = 0;
    // tuning (very subtle)
    const SPLASH_FLOAT_AMP_Y = 10;   // px up/down
    const SPLASH_FLOAT_AMP_X = 4;    // px left/right
    const SPLASH_FLOAT_SPD   = 0.18; // cycles/sec
    const SPLASH_FLOAT_BLEND_IN_MS = 420;

    let splashFloatBlend = 0;
    let splashLogoSettled = false;


const SPLASH_CARD_LAND_SCALE = 1; // 🔧 try 0.68–0.85


  const studioIntroLayer = new Container();
  studioIntroLayer.zIndex = 1000002;     // above loading(999999) + splash(999998)
  studioIntroLayer.visible = false;
  studioIntroLayer.alpha = 0;
  studioIntroLayer.eventMode = "static"; // blocks input
  studioIntroLayer.cursor = "default";
  root.addChild(studioIntroLayer);
  root.sortChildren();

  const studioIntroDim = new Graphics();
  studioIntroLayer.addChild(studioIntroDim);

  const STUDIO_KICK_MS = 110;      // 70..140 = “instant kick”
  const STUDIO_KICK_OVERSHOOT = 2;

  const studioLogo = new Sprite(Texture.WHITE); // replaced after Assets.load
  studioLogo.anchor.set(0.5);
  studioLogo.alpha = 0;
  studioLogo.roundPixels = true;
  studioIntroLayer.addChild(studioLogo);

  const studioLogoHouse = new Sprite(Texture.WHITE);
  studioLogoHouse.anchor.set(0.5);
  studioLogoHouse.alpha = 0;
  studioLogoHouse.roundPixels = true;

  // IMPORTANT: above tiles + base logo
  studioLogoHouse.zIndex = 10;
  studioIntroLayer.addChild(studioLogoHouse);
  studioIntroLayer.sortableChildren = true;
// optional: cache direct textures to avoid Assets.get warnings
let studioLogoHouseTex: Texture | null = null;

  function layoutStudioIntro() {
  const W = app.screen.width;
  const H = app.screen.height;

  studioIntroDim.clear();
  studioIntroDim.rect(0, 0, W, H).fill(0x000000);
  studioIntroDim.alpha = 1;

  // ✅ shared center (rounded for pixel stability)
  const cx = Math.round(W * 0.5);
  const cy = Math.round(H * 0.5);

  // ✅ CENTER BOTH
  studioLogo.position.set(cx, cy);

  // --- scale base logo to fit nicely ---
  const tw = studioLogo.texture.width || 1;
  const th = studioLogo.texture.height || 1;

  const LOGO_W_N = 0.42;
  const LOGO_H_N = 0.28;

  const targetW = W * LOGO_W_N;
  const targetH = H * LOGO_H_N;

  const s = Math.min(targetW / tw, targetH / th);
  studioLogo.scale.set(s);

  // ✅ HOUSE: always same center, no nudges
  const houseTex = studioLogoHouseTex ?? null;
  if (houseTex) {
    studioLogoHouse.texture = houseTex;

    studioLogoHouse.position.set(cx, cy);

    // Pick ONE approach for scale:
    // Option A (simple): match base logo scale
    studioLogoHouse.scale.set(s);

    // Option B (if house art is meant to be larger/smaller than logo):
    const HOUSE_SCALE_MULT = 2 // tweak if needed
    studioLogoHouse.scale.set(s * HOUSE_SCALE_MULT);

  }
}

  window.addEventListener("resize", layoutStudioIntro);


    const splashLayer = new Container();
    splashLayer.zIndex = 999998; // below loading (999999), above everything else
    splashLayer.visible = false;
    splashLayer.eventMode = "static"; // blocks input
    splashLayer.cursor = "pointer";
    root.addChild(splashLayer);
    root.sortChildren();

    // optional dimmer (on top of blurred BG)
    const splashDim = new Graphics();
    splashLayer.addChild(splashDim);

    const splashPresents = new Text({
      text: "8-BIT WIZARDRY\nPRESENTS",
      style: {
        fontFamily: "Micro5",
        fill: 0xffffff,
        fontSize: 35, // base; real size is set in layoutSplash()
        align: "center",
        letterSpacing: 1,

        

        dropShadow:false,
        dropShadowColor: 0x000000,
        dropShadowAlpha: 0.6,
        dropShadowDistance: 3,
        dropShadowAngle: -Math.PI / 4,
      } as any,
    });
    splashPresents.anchor.set(0.5);
    splashLayer.addChild(splashPresents);


    

  // =====================
  // STUDIO INTRO — TILE REEL ANIMATION
  // =====================

  type StudioTile = {
    s: Sprite;
    homeX: number;
    homeY: number;
    col: number;
    row: number;
  };



  let studioTilesBuilt = false;
  let studioTiles: StudioTile[] = [];
  const studioTileLayer = new Container();
  studioTileLayer.eventMode = "none";
  studioTileLayer.sortableChildren = false;
  studioIntroLayer.addChild(studioTileLayer);



  // TUNING
  const STUDIO_TILE_PX = 60;          // square tile size IN LOGO TEXTURE PIXELS (try 32/48/64)
  const STUDIO_SPIN_RPS = 2.8;        // reel spin speed (rows per second feel)
  const STUDIO_SPIN_TIME_MS = 650;    // how long columns spin BEFORE stopping begins
  const STUDIO_STOP_STAGGER_MS = 90;  // stop columns one-by-one
  const STUDIO_STOP_SETTLE_MS = 220;  // snap settle per column

  function buildStudioLogoTiles() {
    if (studioTilesBuilt) return;

    const tex = Assets.get(STUDIO_LOGO_URL) as Texture | undefined;
    if (!tex) {
     
      return;
    }

    // use the base texture so all tiles share the same GPU resource
  const base = tex.source;


    // tile size in texture pixels
    const tile = Math.max(8, Math.floor(STUDIO_TILE_PX));

    // how many full tiles fit
    const cols = Math.floor((tex.width || 1) / tile);
    const rows = Math.floor((tex.height || 1) / tile);

    if (cols <= 0 || rows <= 0) {
      
      return;
    }

  

    // studioLogo.scale is already set to fit screen
    const s = studioLogo.scale.x;
    studioTileLayer.scale.set(s);

    // We place tiles in the tileLayer around (0,0), then position tileLayer at logo center.
    studioTileLayer.position.set(studioLogo.x, studioLogo.y);

    // hide the single-sprite logo (we’ll rebuild it from tiles)
    studioLogo.visible = false;

    studioTiles = [];

    // Build tiles centered at (0,0) with anchor 0.5
    const totalW = cols * tile;
    const totalH = rows * tile;
    const left = -totalW / 2;
    const top = -totalH / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rect = new Rectangle(c * tile, r * tile, tile, tile);
        const sub = new Texture({ source: base, frame: rect });

        const sp = new Sprite(sub);
        sp.anchor.set(0.5);
        sp.roundPixels = true;

        const homeX = left + c * tile + tile / 2;
        const homeY = top + r * tile + tile / 2;

        // start above + random tiny tilt
    
  sp.x = homeX;
  sp.y = homeY;
  sp.rotation = 0;



        studioTileLayer.addChild(sp);
        studioTiles.push({ s: sp, homeX, homeY, col: c, row: r });
      
      }
    }

    studioTilesBuilt = true;
  }

  async function playStudioIntroTilesReel() {
    const tex = Assets.get(STUDIO_LOGO_URL) as Texture | undefined;
  if (tex) studioLogo.texture = tex; // ✅ ensure correct size for layout
  layoutStudioIntro();
    studioLogo.visible = false;
  studioLogo.alpha = 0;


    buildStudioLogoTiles();
    if (!studioTilesBuilt) return;

    // Ensure layer is visible and blocks input
    studioIntroLayer.visible = true;
    studioIntroLayer.alpha = 1;
    studioIntroLayer.eventMode = "static";

  // ✅ NO FADE IN — tiles are visible immediately
  studioTileLayer.alpha = 1;

  



    // --- Phase B: REEL SPIN per column (true wrap), then stop columns sequentially ---
  const cols = Math.max(...studioTiles.map(t => t.col)) + 1;
  const rows = Math.max(...studioTiles.map(t => t.row)) + 1;

  // group tiles by column
  const byCol: StudioTile[][] = Array.from({ length: cols }, () => []);
  for (const t of studioTiles) byCol[t.col].push(t);

  // IMPORTANT: sort each column by row so min/max + wrapping is stable
  for (let c = 0; c < cols; c++) {
    byCol[c].sort((a, b) => a.row - b.row);
  }

  // tile height in tile-layer LOCAL units (centers are spaced by this)
  const tileH =
    byCol[0]?.[0]?.s.texture.frame.height ||
    STUDIO_TILE_PX;

  const span = rows * tileH;

  // Per-column reel state
  type ColState = {
    offsetPx: number;      // 0..span
    stopping: boolean;
    stopAt: number;        // time to begin stopping
    stopStart: number;     // time stop tween began
    stopFrom: number;
    stopTo: number;
  };

  const col: ColState[] = Array.from({ length: cols }, (_, c) => ({
    offsetPx: Math.random() * span, // start at random offset so it looks lively
    stopping: false,
    stopAt: performance.now() + STUDIO_SPIN_TIME_MS + c * STUDIO_STOP_STAGGER_MS,
    stopStart: 0,
    stopFrom: 0,
    stopTo: 0,
  }));

  // Helper: wrap a y center into [minCenter, minCenter+span)
  function wrapCenterY(y: number, minCenter: number) {
    while (y >= minCenter + span) y -= span;
    while (y <  minCenter)        y += span;
    return y;
  }


  const spinStart = performance.now();
  // We run this on ticker
  const fn = () => {
    const now = performance.now();
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000);

    // speed in pixels/sec (rows/sec feel * rows * tileH)
  // “Kick” ramp: 0 -> 1 quickly, with a tiny overshoot (slot motor feel)
  const kick01 = Math.min(1, (now - spinStart) / STUDIO_KICK_MS);
  const kick = kick01 < 1
    ? (kick01 * kick01 * (3 - 2 * kick01)) * STUDIO_KICK_OVERSHOOT
    : 1;

  const speedPx = (STUDIO_SPIN_RPS * span) * kick;


    for (let c = 0; c < cols; c++) {
      const tiles = byCol[c];
      if (!tiles.length) continue;

      const minCenter = tiles[0].homeY; // because sorted by row

      const st = col[c];

      // 1) spinning: advance offset
      if (!st.stopping) {
        st.offsetPx = (st.offsetPx + speedPx * dt) % span;

        // begin stopping?
        if (now >= st.stopAt) {
          st.stopping = true;
          st.stopStart = now;

          // choose a forward snap target so it "lands" cleanly on the grid
          const rem = st.offsetPx % tileH;
          const snapForward = rem > tileH * 0.5 ? (tileH - rem) : (-rem);
          let target = st.offsetPx + snapForward;

          // normalize target into 0..span
          target = ((target % span) + span) % span;

          st.stopFrom = st.offsetPx;
          st.stopTo = target;
        }
      } else {
        // 2) stopping: tween offset to nearest tile boundary (no jitter)
        const t01 = Math.min(1, (now - st.stopStart) / STUDIO_STOP_SETTLE_MS);
        const e = 1 - Math.pow(1 - t01, 3); // easeOutCubic

        // shortest path forward/back around the wrap
        let a = st.stopFrom;
        let b = st.stopTo;

        // choose shortest modular direction
        let d = b - a;
        if (d > span * 0.5) d -= span;
        if (d < -span * 0.5) d += span;

        st.offsetPx = ((a + d * e) % span + span) % span;

        // end stop: lock perfectly (offset 0)
        if (t01 >= 1) {
          st.offsetPx = 0;
        }
      }

      // Apply offset to every tile in the column
      for (const t of tiles) {
        let y = t.homeY + st.offsetPx;
        y = wrapCenterY(y, minCenter);
        t.s.y = y;
      }
    }
  };

  app.ticker.add(fn);

  // let it run until the last column has had time to stop + settle
  const totalStopTime =
    STUDIO_SPIN_TIME_MS +
    (cols - 1) * STUDIO_STOP_STAGGER_MS +
    STUDIO_STOP_SETTLE_MS +
    60;

  await waitMs(totalStopTime);

  // stop ticker
  app.ticker.remove(fn);


    // HARD snap to perfect grid (no drift)
    for (const t of studioTiles) {
      t.s.x = t.homeX;
      t.s.y = t.homeY;
      t.s.rotation = 0;
    }

  // reveal house overlay
  studioLogoHouse.alpha = 0;
  await animateMs(260, (t) => {
    const e = t * t * (3 - 2 * t);
    studioLogoHouse.alpha = e;
    
  });

  // hold with house visible
  await waitMs(1500);


  await animateMs(260, (t) => {
    const e = t * t * (3 - 2 * t);
    studioTileLayer.alpha = 1 - e;
    studioLogoHouse.alpha = 1 - e;
  });
  studioLogoHouse.alpha = 0;

    studioTileLayer.alpha = 0;
    studioIntroLayer.visible = false;
    studioIntroLayer.eventMode = "none";

    // optional: cleanup if you want
    // clearStudioTiles();
  }

    function splashTitleFontFamilyFor(lang: string) {

  // If you want the logo to stay "brand" in Latin languages, keep pixeldown.
  // If non-latin, switch to the language font so glyphs exist.
  return isLatinUiLang(lang) ? '"pixeldown"' : uiFontFamilyFor(lang as Lang);
}
// -----------------------------
// OVERLAY FONT OVERRIDES (Big Win + FS retrigger)
// -----------------------------
function overlayBrandFontFamilyFor(lang: string) {
  const base = (lang || "en").toLowerCase();
  const isTr = base === "tr" || base.startsWith("tr-");

  if (isTr) return uiFontFamilyFor(lang as any);
  if (isLatinUiLang(lang)) return PIXELDOWN_STACK; // ✅ stack, not "pixeldown"
  return uiFontFamilyFor(lang as any);
}



    // =====================
    // SPLASH LOGO: split into 2 parts (BLOCKY + FARM)
    // =====================
const splashLogoStyle = {
  fontFamily: splashTitleFontFamilyFor(getLang()),
  fill: 0xffffff,
  fontSize: 100,
  fontWeight: "200",
  letterSpacing: 0,
  align: "center",
  stroke: { color: 0x000000, width: 14 },
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowAngle: -Math.PI / 5,
  dropShadowAlpha: 0.9,
  dropShadowDistance: 20,
} as any;



 const splashLogoBlocky = new Text({
  text: applyUiTextCase(t("splash.titleBlocky")),
  style: splashLogoStyle,
} as any);
splashLogoBlocky.anchor.set(0.5);
splashLogoBlocky.skew.set(0, 0.45);

const splashLogoFarm = new Text({
  text: applyUiTextCase(t("splash.titleFarm")),
  style: splashLogoStyle,
} as any);
splashLogoFarm.anchor.set(0.5);
splashLogoFarm.skew.set(0, 0.45);


    // final (layout) targets for the logo pieces
    let splashBlockyTargetX = 0, splashBlockyTargetY = 0;
    let splashFarmTargetX  = 0, splashFarmTargetY  = 0;
    
    // base (layout) scales for the logo pieces (used by drop/settle)
let splashBlockyBaseSX = 1, splashBlockyBaseSY = 1;
let splashFarmBaseSX   = 1, splashFarmBaseSY   = 1;

    splashLogoFarm.anchor.set(0.5);
    splashLogoFarm.skew.set(0, 0.45);
    
// --- FLOATING "GROUND" SHADOW (clone texts) ---
    function makeGroundShadow(src: Text) {
      // ✅ clone style so we don't mutate the original text style
      const baseStyle = (src.style as any).clone
        ? (src.style as any).clone()
        : { ...(src.style as any) };

      // build shadow with its own independent style
      const sh = new Text({ text: src.text, style: baseStyle as any });

      // shadow look
      (sh.style as any).fill = 0x000000;
      (sh.style as any).strokeThickness = 0;
      (sh.style as any).dropShadow = false;

      sh.anchor.set(0.5);
      sh.skew.set(-.9, .37);
      sh.filters = [new BlurFilter({ strength: 25 })];
      sh.alpha = 0.35;

      sh.zIndex = 5;
      return sh;
    }
    


    const splashShadowBlocky = makeGroundShadow(splashLogoBlocky);
    const splashShadowFarm  = makeGroundShadow(splashLogoFarm);
    // ✅ start shadows hidden; we enable them exactly when each word starts dropping
    splashShadowBlocky.visible = false;
    splashShadowFarm.visible = false;


    // ensure ordering: shadows behind words
    splashLayer.sortableChildren = true;
// Title should be ABOVE cards in mobile portrait
const titleZ = isMobilePortraitUILayout(__layoutDeps) ? 120 : 20;

splashLogoBlocky.zIndex = titleZ;
splashLogoFarm.zIndex  = titleZ;

// keep shadows just under the title (still above cards if you want)
const shadowZ = isMobilePortraitUILayout(__layoutDeps) ? 110 : 5;
splashShadowBlocky.zIndex = shadowZ;
splashShadowFarm.zIndex  = shadowZ;


    splashLayer.addChild(splashShadowBlocky, splashShadowFarm, splashLogoBlocky, splashLogoFarm);

    // =====================
    // SPLASH INFO BOXES (BLACK TRANSPARENT RECT)
    // =====================

    // ---- BOX TUNING ----
    const SPLASH_BOX_ALPHA = 0.35;      // opacity (try 0.28–0.45)
    const SPLASH_BOX_RADIUS = 0;        // 0 = sharp corners, try 14 for rounded
    const SPLASH_BOX_H_MULT = 1.2;     // height relative to width (0.55–0.75)
    const SPLASH_BOX_TEXT_TOP_PAD = 22; // px from top inside the box


// ---- SPLASH INFO FRAME TUNING ----
const SPLASH_BOX_TARGET_W_N = 0.3;  // ✅ revert: each box ~24% of screen
const SPLASH_BOX_MAX_W = 350;        // ✅ revert: slightly tighter
const SPLASH_BOX_MIN_W = 190; // text size multiplier (tweak)

    // ---- POSITION TUNING ----
    const SPLASH_BOX_GAP_MULT = 1.35; // spacing relative to box width (1.0 = touching)
    const SPLASH_BOX_Y_N = 0.69;      // vertical position (0..1 of screen height)
    const SPLASH_BOX_Y_PX = 0;        // pixel nudge (+ down, - up)


    const splashInfoLayer = new Container();
   // Cards layer (below title in portrait)
splashInfoLayer.zIndex = isMobilePortraitUILayout(__layoutDeps) ? 40 : 40; // keep cards at 40

    splashLayer.addChild(splashInfoLayer);
    

const SPLASH_INFO = [
  { titleKey: "splash.card1.title", bodyKey: "splash.card1.body" },
  { titleKey: "splash.card2.title", bodyKey: "splash.card2.body" },
  { titleKey: "splash.card3.title", bodyKey: "splash.card3.body" },
];




    const splashInfoBoxes: Container[] = [];

    for (let i = 0; i < SPLASH_INFO.length; i++) {
      const box = new Container();

      const bg = new Graphics();
    box.addChild(bg);



      // --- TITLE ---
    const title = new Text({
      text: applyUiTextCase(t(SPLASH_INFO[i].titleKey)),
    style: localizeStyle({
  fontFamily: "pixeldown",
  fill: 0xffd36a,
  fontSize: 50,
  align: "center",
  letterSpacing: 1,
  stroke: { color: 0x000000, width: 6 },
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowAlpha: 0.9,
  dropShadowDistance: 4,
  dropShadowAngle: -Math.PI / 4,
} as any),

    });
    title.anchor.set(0.5, 0);
    box.addChild(title);


  // --- SUBTITLE ---
const subtitleStyleObj: any = localizeStyle({
  // keep all your styling the same
  fontFamily: "Micro5", // placeholder
  fill: 0xffffff,
  fontSize: 36,
  align: "center",
  letterSpacing: 1,
  stroke: { color: 0x000000, width: 4 },
  dropShadow: false,
  dropShadowColor: 0x000000,
  dropShadowAlpha: 0.6,
  dropShadowDistance: 3,
  dropShadowAngle: -Math.PI / 4,
} as any);

// ✅ override AFTER localizeStyle
subtitleStyleObj.fontFamily = splashSubtitleFontFamilyFor(getLang());


  const subtitle = new Text({
  text: applyUiTextCase(t(SPLASH_INFO[i].bodyKey)),
  style: subtitleStyleObj,
} as any);
subtitle.anchor.set(0.5, 0);
box.addChild(subtitle);

    // --- ART WRAP (below subtitle) ---
    const artWrap = new Container();
    artWrap.eventMode = "none";
    box.addChild(artWrap);

    // store refs so layout can access them later
    (box as any)._splashBg = bg;
    (box as any)._splashTitle = title;
    (box as any)._splashSubtitle = subtitle;
    (box as any)._splashArt = artWrap;



      box.alpha = 0;
      splashInfoLayer.addChild(box);
      splashInfoBoxes.push(box);
    }















    // =====================
    // SPLASH "CLICK TO CONTINUE" (slides up from below screen)
    // =====================
    const SPLASH_CONTINUE_TARGET_Y_N = 0.96;
    // ✅ PORTRAIT: keep a clean gap between the last card and "CLICK TO CONTINUE"
const SPLASH_PORTRAIT_CONTINUE_GAP_PX = 26; // 🔧 try 18..40
// ✅ PORTRAIT: keep a clean gap between title (BLOCKY/FARM) and the first card
const SPLASH_PORTRAIT_TITLE_TO_CARDS_GAP_PX = 26; // 🔧 try 18..44


    const SPLASH_CONTINUE_OFFSCREEN_PAD = 90;

    function splashContinueOffY() {
      return app.screen.height + SPLASH_CONTINUE_OFFSCREEN_PAD;
    }

function splashContinueTargetY() {
  const H = app.screen.height;

  // default (all modes)
  let y = H * SPLASH_CONTINUE_TARGET_Y_N;

  // ✅ MOBILE LANDSCAPE ONLY: clamp so it can never be cut off
  if (isMobileLandscapeUILayout(__layoutDeps)) {
    const safeB = safeInsetBottomPx?.() ?? 0;

    // padding above the bottom safe area
    const PAD = 0; // 🔧 try 8..18

    // bottom edge of the text (anchor=0.5 => y + h/2)
    const halfH = (splashContinue.getBounds().height || splashContinue.height || 0) * 0.5;

    const maxY = (H - safeB - PAD) - halfH;
    y = Math.min(y, maxY);
  }

  return y;
}


    function layoutSplashContinueX() {
      splashContinue.x = app.screen.width / 2;
    }

    function showSplashContinue(on: boolean, ms = 320) {
      layoutSplashContinueX();

      const offY = splashContinueOffY();
      const targetY = splashContinueTargetY();

      if (on) {
        splashContinue.visible = true;
        splashContinue.alpha = 0;
        splashContinue.y = offY;

        tween(ms, (k) => {
          const e = Math.max(0, Math.min(1, k));
          splashContinue.alpha = e;
          splashContinue.y = offY + (targetY - offY) * e;
        });
      } else {
        const startY = splashContinue.y;
        const startA = splashContinue.alpha;

        tween(
          ms,
          (k) => {
            const e = Math.max(0, Math.min(1, k));
            splashContinue.alpha = startA * (1 - e);
            splashContinue.y = startY + (offY - startY) * e;
          },
          () => {
            splashContinue.alpha = 0;
            splashContinue.y = offY;
            splashContinue.visible = false;
          }
        );
      }
    }

    // Click-to-continue (reuse your shared style)
    const splashContinue = new Text({ text: t("ui.clickToContinue"), style: {} as any });
    applyClickToContinueStyle(splashContinue);
    // 🔧 SPLASH-ONLY drop shadow direction
    (splashContinue.style as any).dropShadowAngle = -Math.PI / 4;


    splashContinue.zIndex = 999999;
    splashContinue.visible = false;          // ✅ start hidden
    splashContinue.alpha = 0;               // ✅ fully transparent
    splashContinue.y = splashContinueOffY(); // ✅ start offscreen (needs helper below)
    splashLayer.addChild(splashContinue);

// ✅ Disable desktop-only FARM X nudges (breaks consistent spacing)
const FARM_X_OFFSET_DESKTOP = -13;
const FARM_Y_OFFSET_DESKTOP = 38;
const FARM_X_OFFSET_DESKTOP_DROP = -20;

// ===============================
// Splash logo scaling (separate)
// ===============================
const SPLASH_FINAL_SCALE_DESKTOP   = 0.80;
const SPLASH_FINAL_SCALE_PORTRAIT  = 1.5;
const SPLASH_FINAL_SCALE_LANDSCAPE = .7;
// ✅ Tablet splash scale (only used when isTabletPortrait(__layoutDeps) === true)
const SPLASH_FINAL_SCALE_TABLET_PORTRAIT = 1.0; // 🔧 tweak 0.85..1.15


const SPLASH_DROP_SCALE_DESKTOP    = 1.00; // base multiplier for drop
const SPLASH_DROP_SCALE_PORTRAIT   = 0.92;
const SPLASH_DROP_SCALE_LANDSCAPE  = 1.1;




    // layout
    function layoutSplash() {

const portrait = isMobilePortraitUILayout(__layoutDeps);
const landscapeMobile = isMobileLandscapeUILayout(__layoutDeps);

const tabletPort = isTabletPortrait?.(__layoutDeps) ?? false;     // ✅ tablet portrait
const tabletLand = isTabletLandscape?.(__layoutDeps) ?? false;    // ✅ tablet landscape
const tabletAny = isTabletLike?.(__layoutDeps) ?? false;

      const W = app.screen.width;
      const H = app.screen.height;
      const IS_TINY_SPLASH = !!(__layoutDeps as any)?.IS_TINY_VIEW;
      const TINY_FINAL_GAP_PX = -5; // 🔧 try 6..30 (bigger = more gap)

      // ✅ Tiny splash detection (use CSS pixels so DevTools DPR doesn't lie)
const r = (app.view as any)?.getBoundingClientRect?.();
const cssW = r?.width ?? (app.view as any)?.clientWidth ?? window.innerWidth;
const cssH = r?.height ?? (app.view as any)?.clientHeight ?? window.innerHeight;

const longSide = Math.max(cssW, cssH);
const shortSide = Math.min(cssW, cssH);



    splashDim.clear();
  splashDim.rect(0, 0, W, H).fill(0x000000);
      splashDim.alpha = 0.18; // subtle dim on top of blur

      splashPresents.position.set(W * 0.5, H * 0.08);
      // ✅ make "PRESENTS" scale with the splash UI scale (same rule as title/cards)
const splashUiScale = (() => {
  const s = Math.min(W / 1920, H / 1080);
  return Math.max(0.55, Math.min(1.0, s));
})();
// ✅ SPLASH: slightly larger "8-BIT WIZARDRY PRESENTS"
const SPLASH_TAG_SCALE_MUL = 1.3; // 🔧 try 1.05–1.15
splashPresents.scale.set(splashUiScale * SPLASH_TAG_SCALE_MUL);

// ✅ HIDE on MOBILE LANDSCAPE + MOBILE PORTRAIT
splashPresents.visible =
  !(isMobileLandscapeUILayout(__layoutDeps) || isMobilePortraitUILayout(__layoutDeps));






 const SPLASH_TARGET_W = Math.min(W * 0.80, 1200);

// ✅ NEW: global splash UI scale based on viewport (desktop resizes won’t break the title)




const SPLASH_LOGO_SCALE =
  (landscapeMobile ? SPLASH_FINAL_SCALE_LANDSCAPE :
   portrait        ? SPLASH_FINAL_SCALE_PORTRAIT :
   tabletPort      ? SPLASH_FINAL_SCALE_TABLET_PORTRAIT :
                     SPLASH_FINAL_SCALE_DESKTOP
  ) * splashUiScale;



const SPLASH_FINAL_GAP_PX =
  IS_TINY_SPLASH ? TINY_FINAL_GAP_PX :
  portrait ? -20 :
  -15;

    const SPLASH_LOGO_SQUASH_X = 0.82;
   


    // measure UN-SCALED widths
    const blockyW0 = splashLogoBlocky.getLocalBounds().width;
    const farmW0 = splashLogoFarm.getLocalBounds().width;

    // scale to fit target width (based on unscaled widths)
    const combinedW0 = blockyW0 + SPLASH_FINAL_GAP_PX + farmW0;
    const baseS = SPLASH_TARGET_W / Math.max(1, combinedW0);

    const sx = baseS * SPLASH_LOGO_SCALE * SPLASH_LOGO_SQUASH_X;
    const sy = baseS * SPLASH_LOGO_SCALE;

    splashLogoBlocky.scale.set(sx, sy);
    splashLogoFarm.scale.set(sx, sy);
    // store base scales so animations can return to the "layout" scale
    splashBlockyBaseSX = sx; splashBlockyBaseSY = sy;
    splashFarmBaseSX  = sx; splashFarmBaseSY  = sy;


    // NOW use SCALED widths
const blockyW = splashLogoBlocky.width;
const farmW   = splashLogoFarm.width;

const pairW = blockyW + SPLASH_FINAL_GAP_PX + farmW;
const leftX = W * 0.5 - pairW / 2;

// position (single source of truth)
splashLogoBlocky.x = leftX + blockyW / 2;
splashLogoFarm.x   = splashLogoBlocky.x + blockyW / 2 + SPLASH_FINAL_GAP_PX + farmW / 2;



const isDesktop = !isMobilePortraitUILayout(__layoutDeps) && !isMobileLandscapeUILayout(__layoutDeps);
if (isDesktop) splashLogoFarm.x += FARM_X_OFFSET_DESKTOP;





// =====================
// SPLASH TITLE FINAL Y + CONSISTENT FARM GAP
// =====================

// ✅ FINAL RESTING Y (tablet portrait gets its own slot)
const LOGO_Y_N =
  isMobilePortraitUILayout(__layoutDeps) ? 0.075 :
  isMobileLandscapeUILayout(__layoutDeps) ? 0.150 :
  tabletPort ? 0.16 :   // 🔧 try 0.12..0.22
  0.25;



// ✅ One rule: FARM is always offset from BLOCKY by a gap that scales with the logo size
const baseY = Math.round(H * LOGO_Y_N);

splashLogoBlocky.y = baseY;




// ✅ portrait uses a slightly smaller vertical separation
const FARM_GAP_PX = Math.round(splashLogoBlocky.height * (portrait ? 0.30 : 0.38));
splashLogoFarm.y = baseY + FARM_GAP_PX;




  // --- shadow follow (layout) ---
const SHADOW_OFF_X = 46;  // right
const SHADOW_OFF_Y = 150; // down
const SHADOW_SQUASH_Y = 0.16; // was 0.10 (0.14..0.22 is a good range)

// ✅ Use UNIFORM scale for the shadow so it can’t stretch wide
// (Base it on logo Y scale, not logo X scale / text width)
const blockyShadowS = splashLogoBlocky.scale.y * 1.05;
const farmShadowS   = splashLogoFarm.scale.y   * 1.05;

// BLOCKY shadow
splashShadowBlocky.x = splashLogoBlocky.x + SHADOW_OFF_X;
splashShadowBlocky.y = splashLogoBlocky.y + SHADOW_OFF_Y;
splashShadowBlocky.scale.set(blockyShadowS, blockyShadowS * SHADOW_SQUASH_Y);

// FARM shadow
splashShadowFarm.x = splashLogoFarm.x + SHADOW_OFF_X;
splashShadowFarm.y = splashLogoFarm.y + SHADOW_OFF_Y;
splashShadowFarm.scale.set(farmShadowS, farmShadowS * SHADOW_SQUASH_Y);


    // ✅ store final layout targets for animation
    splashBlockyTargetX = splashLogoBlocky.x;
    splashFarmTargetX  = splashLogoFarm.x;
    splashBlockyTargetY = splashLogoBlocky.y;
    splashFarmTargetY  = splashLogoFarm.y;







    

      splashContinue.x = W * 0.5; // ✅ keep X centered; Y is animated by showSplashContinue()
      if (!splashContinue.visible) {
      splashContinue.y = splashContinueOffY(); // ✅ prevents cut-off on first layout
    }
// ✅ Tiny view ONLY: shrink "CLICK TO CONTINUE"
if (IS_TINY_SPLASH) splashContinue.scale.set(0.5);
else splashContinue.scale.set(1);

// base Y
// =====================
// ✅ CARDS: maximize space between TITLE and CLICK TO CONTINUE
// =====================

// “breathing room” above cards (below title) and below cards (above click)
const GAP_BELOW_TITLE_PX = portrait ? 18 : 22;      // 🔧
const GAP_ABOVE_CLICK_PX = portrait ? 18 : 22;      // 🔧

// 1) title bottom (use both words)
const b1 = splashLogoBlocky.getBounds();
const b2 = splashLogoFarm.getBounds();
const titleBottomY = Math.max(b1.y + b1.height, b2.y + b2.height);

// 2) click-to-continue top (at its TARGET position, even while animating)
const contY = Math.round(H * SPLASH_CONTINUE_TARGET_Y_N);
const contTopY = contY - Math.round(splashContinue.height * 0.5);

// 3) usable vertical band for cards
const bandTop = Math.round(titleBottomY + GAP_BELOW_TITLE_PX);
const bandBot = Math.round(contTopY - GAP_ABOVE_CLICK_PX);

// 4) center cards within that band
let infoY = Math.round((bandTop + bandBot) * 0.5);

// (optional) if band is tiny (very short screens), fall back to your old value
const minBandH = 160;
if (bandBot - bandTop < minBandH) {
  infoY = Math.round(H * (portrait ? 0.62 : SPLASH_BOX_Y_N)) + SPLASH_BOX_Y_PX;
}



    // desired box width based on screen


// desired box width based on screen
const isLandscapeMobile = isMobileLandscapeUILayout(__layoutDeps);

// 🔧 TUNING
const SPLASH_CARD_PORTRAIT_SCALE = 1.18;
const SPLASH_CARD_LAND_SCALE = 1;          // your current landscape-mobile value
const SPLASH_CARD_TABLET_LAND_SCALE = 1.25; // 🔧 try 1.10..1.45
const SPLASH_CARD_DESKTOP_SCALE  = 2.5;

const baseFrac = portrait ? 0.62 : SPLASH_BOX_TARGET_W_N;

const cardScale =
  portrait ? SPLASH_CARD_PORTRAIT_SCALE :
  isLandscapeMobile ? SPLASH_CARD_LAND_SCALE :
  tabletLand ? SPLASH_CARD_TABLET_LAND_SCALE :
  SPLASH_CARD_DESKTOP_SCALE;

// ✅ Tiny view ONLY: shrink splash cards further
const TINY_SPLASH_CARD_SHRINK = 0.78; // 🔧 try 0.70–0.85 (smaller = smaller)
const tinyMul = IS_TINY_SPLASH ? TINY_SPLASH_CARD_SHRINK : 1;

const finalFrac = baseFrac * cardScale * tinyMul;


const minW = isLandscapeMobile ? Math.round(SPLASH_BOX_MIN_W * 0.85) : SPLASH_BOX_MIN_W;

// ✅ compute "raw" target based on your old rules
let targetW = Math.max(
  minW,
  Math.min(SPLASH_BOX_MAX_W, W * finalFrac)
);


if (!portrait) {
  const SIDE_PAD = tabletLand ? 36 : 24; // ✅ a bit more breathing room on tablets

  // tablets: slightly tighter gaps so 3 cards fit cleanly
  const tabletGapMul = 1.05; // 🔧 try 0.95..1.15

  const gapMul =
    SPLASH_BOX_GAP_MULT *
    (isLandscapeMobile ? 0.92 : 1.0) *
    (tabletLand ? tabletGapMul : 1.0);

  // total span across screen = targetW + 2*gapX = targetW * (1 + 2*gapMul)
  const maxWByScreen = Math.floor(
    (W - SIDE_PAD * 2) / Math.max(1e-6, (1 + 2 * gapMul))
  );

  targetW = Math.max(minW, Math.min(targetW, maxWByScreen));
}


// ✅ PORTRAIT: card height scale knob
const SPLASH_CARD_H_PORTRAIT_MUL = 0.840; // 🔧 try 0.82..0.95 (smaller = shorter cards)

let boxH = Math.round(
  targetW * (portrait ? 0.7 * SPLASH_CARD_H_PORTRAIT_MUL : SPLASH_BOX_H_MULT)
);

// ✅ Optional safety: if height is tight on non-portrait, shrink width to keep cards inside screen
if (!portrait) {
  const MAX_CARD_H = Math.round(H * 0.42); // 🔧 tweak 0.36..0.50
  if (boxH > MAX_CARD_H) {
    const wFromH = Math.floor(MAX_CARD_H / Math.max(0.01, SPLASH_BOX_H_MULT));
    targetW = Math.max(minW, Math.min(targetW, wFromH));
    boxH = Math.round(targetW * SPLASH_BOX_H_MULT);
  }
}





  

const isDesktopCards = !portrait && !isLandscapeMobile && !tabletAny;
const DESKTOP_GAP_MUL = 1.18;

const gapMul =
  SPLASH_BOX_GAP_MULT *
  (isLandscapeMobile ? 0.92 : 1.0) *
  (isDesktopCards ? DESKTOP_GAP_MUL : 1.0);

const gapX = Math.round(targetW * gapMul);


const gapY = portrait ? Math.round(boxH * 0.05) : 0;   // portrait: tighter stack


for (let i = 0; i < splashInfoBoxes.length; i++) {
  const box = splashInfoBoxes[i];

  // children refs
  const bg = (box as any)._splashBg as Graphics;
  const title = (box as any)._splashTitle as Text;
  const subtitle = (box as any)._splashSubtitle as Text;
  const artWrap = (box as any)._splashArt as Container;

  // ---------- draw bg ----------
bg.clear();

// ✅ MOBILE PORTRAIT ONLY: hide the splash card backgrounds
if (portrait) {
  // do nothing (bg stays empty / invisible)
} else {
  if (SPLASH_BOX_RADIUS > 0) {
    bg
      .roundRect(-targetW / 2, -boxH / 2, targetW, boxH, SPLASH_BOX_RADIUS)
      .fill({ color: 0x000000, alpha: SPLASH_BOX_ALPHA })
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });
  } else {
    bg
      .rect(-targetW / 2, -boxH / 2, targetW, boxH)
      .fill({ color: 0x000000, alpha: SPLASH_BOX_ALPHA })
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });
  }
}

  // ---------- position ----------
  if (portrait) {
    box.x = Math.round(W * 0.5);
    const mid = (splashInfoBoxes.length - 1) / 2;
    box.y = Math.round(infoY + (i - mid) * (boxH + gapY));
  } else {
    box.x = Math.round(W / 2 + (i - 1) * gapX);
    box.y = Math.round(infoY);
  }

  // ---------- text ----------
  const topY = -boxH / 2 + SPLASH_BOX_TEXT_TOP_PAD;


  title.y = topY;






// =====================
// SPLASH CARD TEXT SCALE (CONSISTENT across cards)


// available text width inside the card (local space)
const TEXT_PAD_X = 16;
const maxTextW = Math.max(40, targetW - TEXT_PAD_X * 2);

const TITLE_MAX_H = Math.round(boxH * (portrait ? 0.30 : 0.280));
const SUB_MAX_H   = Math.round(boxH * (portrait ? 0.46 : 0.26));

// caps per mode (upper bound on how large text is allowed)
const titleCap =
  portrait ? 1.35 :
  isLandscapeMobile ? 0.78 :
  1.0;

const subCap =
  portrait ? 1.35 :
  isLandscapeMobile ? 0.82 :
  1.0;


// ✅ Compute shared scales ONCE per layout pass (cache on splashInfoLayer)
const cacheKey = "__splashTextFitCache";
let cache = (splashInfoLayer as any)[cacheKey] as any;

const cacheSig = `${targetW}|${boxH}|${portrait}|${isLandscapeMobile}|${getLang()}`;
if (!cache || cache.sig !== cacheSig) {
  const titles = splashInfoBoxes
    .map((b: any) => b?._splashTitle as Text)
    .filter(Boolean);

  const subs = splashInfoBoxes
    .map((b: any) => b?._splashSubtitle as Text)
    .filter(Boolean);

  // measure at scale=1
  for (const tt of titles) tt.scale.set(1);
  for (const ss of subs) ss.scale.set(1);

  const maxTitleW0 = Math.max(1, ...titles.map((tt) => tt.getLocalBounds().width || 1));
  const maxTitleH0 = Math.max(1, ...titles.map((tt) => tt.getLocalBounds().height || 1));

  const maxSubW0 = Math.max(1, ...subs.map((ss) => ss.getLocalBounds().width || 1));
  const maxSubH0 = Math.max(1, ...subs.map((ss) => ss.getLocalBounds().height || 1));

  const titleFitW = Math.min(1, maxTextW / maxTitleW0);
  const titleFitH = Math.min(1, TITLE_MAX_H / maxTitleH0);

  const subFitW = Math.min(1, maxTextW / maxSubW0);
  const subFitH = Math.min(1, SUB_MAX_H / maxSubH0);

  const titleScale = Math.min(titleCap, titleFitW, titleFitH);
  const subScale   = Math.min(subCap,   subFitW,   subFitH);

  cache = { sig: cacheSig, titleScale, subScale };
  (splashInfoLayer as any)[cacheKey] = cache;
}

// ✅ Apply the SAME scale to every card
title.scale.set(cache.titleScale);
subtitle.scale.set(cache.subScale);

const TITLE_SUB_GAP =
  (!portrait && !isLandscapeMobile)
    ? -3
    : (portrait ? 2 : 8);

subtitle.y = topY + title.height + TITLE_SUB_GAP;




// =====================
// SPLASH CARD ART — PER-CARD TUNING (DESKTOP)
// =====================
// ✅ let fitSprite do the maximizing; multipliers are “flavor”
const SPLASH_ART_SCALE = {
  bonus: 1.0,
  multiplier: 1.0,
  maxwin: 1.0,
};

// optional per-card nudges (px)
const SPLASH_ART_NUDGE = {
  bonus: { x: 0, y: 0 },
  multiplier: { x: 0, y: -5 },
  maxwin: { x: 0, y: 1 },
};

// =====================
// SPLASH CARD 1 (BONUS) — PER-SCATTER TUNING
// =====================
const SPLASH_SCATTER = [
  { scale: 0.95, x: 10, y: 0 }, // left scatter
  { scale: 1.5, x: 0,  y: 0 }, // middle scatter
  { scale: 0.95, x: -10,  y: 0 }, // right scatter
];

  // ---------- art ----------
  buildSplashCardArtOnce();

  if (artWrap) {
    // ✅ MOBILE PORTRAIT: remove art entirely
    if (portrait) {
      artWrap.visible = false;
      artWrap.removeChildren(); // safety: clears anything already created
    } else {
      artWrap.visible = true;

      // ✅ MAXIMIZE ART but NEVER overlap subtitle
const ART_TOP_GAP = 6;     // was 16 (more room for art)
artWrap.x = 0;
artWrap.y = subtitle.y + subtitle.height + ART_TOP_GAP;

// ✅ reduce wasted padding inside the card
const PAD_X = 8;           // was 18
const PAD_BOT = 10;        // was 18

const availW = Math.max(10, targetW - PAD_X * 2);
const bottomY = boxH / 2;
const availH = Math.max(10, bottomY - artWrap.y - PAD_BOT);

// ✅ “fill as much as possible” with a tiny safety margin
const fitSprite = (sp: Sprite, maxW: number, maxH: number, mul = 1) => {
  const tw = sp.texture.width || 1;
  const th = sp.texture.height || 1;

  // 0.98 keeps a tiny breathing room so you never clip on rounding
  const sFit = Math.min(maxW / tw, maxH / th) * 0.98;

  sp.scale.set(sFit * mul);
};


      // layout per-card
      const kids = artWrap.children as any[];

      // Card 0: 3 scatters
      if (i === 0) {
     const GAP = 12; // was 14 (a touch more room)
const eachW = Math.max(10, (availW - GAP * 2) / 3);

// ✅ give scatters basically the full height
const eachH = availH;

// center them in the available art area
const centerY = Math.round(eachH * 0.5);

       for (let k = 0; k < Math.min(3, kids.length); k++) {
  const sp = kids[k] as Sprite;
  const t = SPLASH_SCATTER[k] || { scale: 1, x: 0, y: 0 };

  sp.anchor.set(0.5);

  fitSprite(
    sp,
    eachW,
    eachH,
    SPLASH_ART_SCALE.bonus * (t.scale ?? 1)
  );

  sp.x =
    (-eachW - GAP) + k * (eachW + GAP) + (t.x ?? 0);

  sp.y =
    Math.round(eachH * 0.52) + (t.y ?? 0);
}

      }

      // Card 1 & 2: single PNG centered
      if (i === 1 || i === 2) {
        const sp = kids[0] as Sprite | undefined;
        if (sp) {
          sp.anchor.set(0.5);
      const key = (i === 1) ? "multiplier" : "maxwin";

fitSprite(
  sp,
  availW,
  availH,
  (SPLASH_ART_SCALE as any)[key]
);

sp.x = (SPLASH_ART_NUDGE as any)[key].x || 0;
sp.y = Math.round(availH * 0.55) + ((SPLASH_ART_NUDGE as any)[key].y || 0);

        }
      }
    }
  }


}

// =====================
// ✅ PORTRAIT: enforce gap between TITLE and the FIRST CARD
// =====================
if (portrait) {
  // Get title bottom (use both words; FARM may sit lower)
  const b1 = splashLogoBlocky.getBounds();
  const b2 = splashLogoFarm.getBounds();
  const titleBottomY = Math.max(b1.y + b1.height, b2.y + b2.height);

  // First card top edge (global bounds)
  const firstBox = splashInfoBoxes[0];
  if (firstBox) {
    const fb = firstBox.getBounds();
    const firstTopY = fb.y;

    // We want: firstTopY >= titleBottomY + GAP
    const wantTopY = Math.round(titleBottomY + SPLASH_PORTRAIT_TITLE_TO_CARDS_GAP_PX);

    const shiftDown = Math.max(0, Math.round(wantTopY - firstTopY));

    if (shiftDown > 0) {
      for (const box of splashInfoBoxes) {
        box.y = Math.round(box.y + shiftDown);
      }
    }
  }
}


  // =====================
// ✅ PORTRAIT: enforce gap between cards and "CLICK TO CONTINUE"
// =====================
if (portrait) {
  // where "CLICK TO CONTINUE" wants to land (same as your showSplashContinue target)
  const contY = Math.round(H * SPLASH_CONTINUE_TARGET_Y_N);

  // top edge of the continue text (anchor 0.5 => y - height/2)
  const contTopY = contY - Math.round(splashContinue.height * 0.5);

  // last card bottom edge in screen coords
  const lastBox = splashInfoBoxes[splashInfoBoxes.length - 1];
  const lb = lastBox.getBounds();
  const lastBottomY = lb.y + lb.height;

  // the maximum bottom Y allowed for the last card
  const maxBottomY = contTopY - SPLASH_PORTRAIT_CONTINUE_GAP_PX;

  // if the card stack is too low, push ALL cards up together
  const shiftUp = Math.max(0, Math.round(lastBottomY - maxBottomY));

  if (shiftUp > 0) {
    for (const box of splashInfoBoxes) {
      box.y = Math.round(box.y - shiftUp);
    }
  }
}
// =====================
// ✅ NON-PORTRAIT SAFETY: keep the card row fully on-screen
// (desktop + mobile landscape)
// =====================
if (!portrait) {
  // Measure the whole cards layer in screen coords
  const cardsB = splashInfoLayer.getBounds();

  const TOP_PAD = 12;
  const BOT_PAD = 12;

  const minY = TOP_PAD;
  const maxY = H - BOT_PAD;

  let shiftY = 0;

  // If top goes above the screen
  if (cardsB.y < minY) shiftY = Math.max(shiftY, Math.round(minY - cardsB.y));

  // If bottom goes below the screen
  if (cardsB.y + cardsB.height > maxY) shiftY = Math.min(shiftY, Math.round(maxY - (cardsB.y + cardsB.height)));

  // Apply shift to the whole cards layer (keeps spacing intact)
  if (shiftY !== 0) {
    splashInfoLayer.y = Math.round(splashInfoLayer.y + shiftY);
  }
}
// ✅ Tiny splash ONLY: scale the cards layer down
if (IS_TINY_SPLASH) {
  const TINY_CARDS_SCALE = 0.70; // 🔧 lower = smaller (try 0.62..0.75)
  splashInfoLayer.scale.set(TINY_CARDS_SCALE);
} else {
  splashInfoLayer.scale.set(1);
}
splashLayer.sortChildren();
if (IS_TINY_SPLASH) {
  const TINY_SPLASH_SCALE = 0.6; // 🔧 tune 0.62–0.75

  // Apply scale
  splashInfoLayer.scale.set(TINY_SPLASH_SCALE);

  // --- RECENTER AFTER SCALE ---
  const b = splashInfoLayer.getLocalBounds();

  // Move pivot to visual center
  splashInfoLayer.pivot.set(
    b.x + b.width * 0.5,
    b.y + b.height * 0.5
  );

  const TINY_SPLASH_Y_OFFSET_PX = 18; // 🔧 move cards DOWN (try 10..40)

  splashInfoLayer.position.set(
    Math.round(W * 0.5),
    Math.round(H * 0.5 + TINY_SPLASH_Y_OFFSET_PX)
  );
} else {
  // Reset for non-tiny layouts
  splashInfoLayer.scale.set(1);
  splashInfoLayer.pivot.set(0, 0);
}


    }


    window.addEventListener("resize", layoutSplash);

// =====================
// SPLASH TITLE LANDING TUNING (MOBILE LANDSCAPE ONLY)
// =====================
const SPLASH_LAND_DROP_Y_N = 0.42;
const SPLASH_LAND_FARM_DROP_PX = 18;
// ✅ TABLET PORTRAIT: landing Y for the drop phase
const SPLASH_TABLET_DROP_Y_N = 0.40; // 🔧 try 0.34..0.46

    // MAIN sequence
    async function startSplashSequence() {
      // ✅ Splash background starts at TOP of PNG
    snapBackgroundToTop();
      state.overlay.splash = true;
      layoutStudioTag(); // ✅ enforce portrait hide rule immediately
      // ✅ SPLASH: hide studio tag in MOBILE PORTRAIT
if (isMobilePortraitUILayout(__layoutDeps)) {
  studioTag.visible = false;
  studioTag.alpha = 0;
}


      lockBackgroundForSplash(); // ✅ Solution B lock
    // ✅ kill any live cars when splash begins
    if (bgCarLive) {
      bgCarLive.s.removeFromParent();
      bgCarLive = null;
    }
    if (fsCarLive) {
      fsCarLive.s.removeFromParent();
      fsCarLive = null;
    }
    clearCarExhaustNow();



    buildSplashCardArtOnce();
      // ✅ NO SMOKE during splash
    smokeFxEnabled = false;
    clearSmokeNow();
    smokeSpawnAcc = 0;

      splashLogoSettled = false;

    // ✅ ensure "CLICK TO CONTINUE" never flashes at y=0
    splashContinue.visible = false;
    splashContinue.alpha = 0;
    splashContinue.y = app.screen.height + 90; // ✅ safe: no TDZ

    // ✅ choose splash framing: top(0), center(0.5), bottom(1)
    setSplashBackgroundFraming(1, 0);

    splashLayer.visible = true;
    splashLayer.alpha = 1;
    splashLayer.eventMode = "static";



    layoutSplash();
    root.sortChildren();

    retargetAmbientForSplash(420);


// ✅ SPLASH: ENABLE CLOUDS
cloudFxEnabled = true;

// if any clouds already exist, retarget them into the splash band
retargetAmbientForSplash(420);

// ensure we have some clouds immediately
cloudSpawnAcc = 0;
if (cloudLive.length === 0) seedCloudFx(6);


// ✅ SPLASH: disable LEAVES
leafFxEnabled = false;
leafSpawnAcc = 0;

// clear any leaves that were already alive so none remain visible/frozen
for (let i = leafLive.length - 1; i >= 0; i--) {
  const p = leafLive[i];
  p.c.removeFromParent();
  leafPool.push(p);
}
leafLive.length = 0;



      // ✅ Force a known-good background state for splash
    await setBackgroundForMode("BASE", false, true);


      // blur the background (stronger at splash)
      const blurStart = bgBlur.strength;
  bgBlur.strength = Math.max(blurStart, 12);

      // keep game hidden until we finish splash
      gameCore.alpha = 0;
      (gameCore as any).eventMode = "none";
      fadeUiLayerTo(0, 0);

      // start positions
      const W = app.screen.width;
      const H = app.screen.height;

  const logoOffY   = -Math.max(splashLogoBlocky.height, splashLogoFarm.height) - 140;

const landscapeMobile = isMobileLandscapeUILayout(__layoutDeps);
const portraitMobile  = isMobilePortraitUILayout(__layoutDeps);
const tabletPort      = isTabletPortrait?.(__layoutDeps) ?? false; // ✅ tablet portrait


const logoDropY =
  landscapeMobile ? H * SPLASH_LAND_DROP_Y_N :
  tabletPort      ? H * SPLASH_TABLET_DROP_Y_N :
                    H * 0.48;



// ✅ FARM drop landing offset should match the FINAL gap rule (scale-aware)
const FARM_DROP_Y_OFFSET = Math.round(splashLogoBlocky.height * 0.38);                              // desktop fallback (keep same or tune)



    // stagger timing (separate feel for drop vs rise)
    const DROP_STAGGER_MS = 700; // heavier, more impact
    const RISE_STAGGER_MS = 60;  // tighter, snappier settle


 

// ✅ DROP-IN overscale (portrait only)
const DROP_OVERSCALE_BLOCKY = portraitMobile ? 1.7 : 1.25;
const DROP_OVERSCALE_FARM   = portraitMobile ? 1.7 : 1.28;

const DROP_BASE =
  landscapeMobile ? SPLASH_DROP_SCALE_LANDSCAPE :
  portraitMobile  ? SPLASH_DROP_SCALE_PORTRAIT :
                    SPLASH_DROP_SCALE_DESKTOP;

// ✅ DROP-IN horizontal gap between BLOCKY and FARM while dropping (portrait only)
// (more negative = closer / overlap, more positive = further apart)
const SPLASH_DROP_GAP_PX = portraitMobile ? -29 : -15;


    splashLogoBlocky.y = logoOffY;
    splashLogoFarm.y   = logoOffY;

  splashLogoBlocky.scale.set(
  splashBlockyBaseSX * DROP_BASE * DROP_OVERSCALE_BLOCKY,
  splashBlockyBaseSY * DROP_BASE * DROP_OVERSCALE_BLOCKY
);

splashLogoFarm.scale.set(
  splashFarmBaseSX * DROP_BASE * DROP_OVERSCALE_FARM,
  splashFarmBaseSY * DROP_BASE * DROP_OVERSCALE_FARM
);


    // ✅ compute DROP positions (use current oversized widths)
    const dropBlockyW = splashLogoBlocky.width;
    const dropFarmW   = splashLogoFarm.width;

    const dropPairW = dropBlockyW + SPLASH_DROP_GAP_PX + dropFarmW;
    const dropLeftX = W * 0.5 - dropPairW / 2;

// set DROP x positions (wider gap)
splashLogoBlocky.x = dropLeftX + dropBlockyW / 2;
splashLogoFarm.x   = splashLogoBlocky.x + dropBlockyW / 2 + SPLASH_DROP_GAP_PX + dropFarmW / 2;

// ✅ DESKTOP ONLY: tweak FARM initial drop X (does NOT affect final settle)
const isDesktopDrop = !isMobilePortraitUILayout(__layoutDeps) && !isMobileLandscapeUILayout(__layoutDeps);
if (isDesktopDrop) {
  splashLogoFarm.x += FARM_X_OFFSET_DESKTOP_DROP;
}







    

    
      // 1) drop BLOCKY then FARM (staggered)
    const dropMs = 820;

    const dropBlocky = animateMs(dropMs, (t) => {
      splashShadowBlocky.visible = true;

      const e = easeOutBack(t, 0.9);
      splashLogoBlocky.y = logoOffY + (logoDropY - logoOffY) * e;
      splashShadowBlocky.x = splashLogoBlocky.x + 46;
    splashShadowBlocky.y = splashLogoBlocky.y + 150;
   {
  const SHADOW_SQUASH_Y = 0.22; // keep same feel as before
  const s = splashLogoBlocky.scale.y * 1.05; // ✅ uniform base from Y scale
  splashShadowBlocky.scale.set(s, s * SHADOW_SQUASH_Y);
}

    });

    const dropFarm = (async () => {
      await waitMs(DROP_STAGGER_MS);
      // ✅ FARM shadow only appears when FARM begins its drop
    splashShadowFarm.visible = true;
    splashShadowFarm.alpha = 0;



      await animateMs(dropMs, (t) => {
      const e = easeOutBack(t, 0.9);
    splashShadowFarm.alpha = 0.22 * e; // fade shadow in with the drop

      splashLogoFarm.y =
        logoOffY +
        ((logoDropY + FARM_DROP_Y_OFFSET) - logoOffY) * e;
      splashShadowFarm.x = splashLogoFarm.x + 46;
    splashShadowFarm.y = splashLogoFarm.y + 150;
    {
  const SHADOW_SQUASH_Y = 0.22;
  const s = splashLogoFarm.scale.y * 1.05; // ✅ uniform base from Y scale
  splashShadowFarm.scale.set(s, s * SHADOW_SQUASH_Y);
}

      
    });

    })();

    await Promise.all([dropBlocky, dropFarm]);


      // small pause
      await waitMs(220);

      // 2) rise/settle BLOCKY then FARM (staggered)
    const riseMs = 520;


    const fromBlocky = splashLogoBlocky.y;
    const fromFarm   = splashLogoFarm.y;
    const fromBlockyX = splashLogoBlocky.x;
    const fromFarmX   = splashLogoFarm.x;


    // capture current (oversized) scales as animation start
    const b0x = splashLogoBlocky.scale.x, b0y = splashLogoBlocky.scale.y;
    const f0x = splashLogoFarm.scale.x,  f0y = splashLogoFarm.scale.y;

    const riseBlocky = animateMs(riseMs, (t) => {
      const e = easeOutBack(t, 1);


      // move
    splashLogoBlocky.y = fromBlocky + (splashBlockyTargetY - fromBlocky) * e;
    splashLogoBlocky.x = fromBlockyX + (splashBlockyTargetX - fromBlockyX) * e;
    splashShadowBlocky.x = splashLogoBlocky.x + 46;
    splashShadowBlocky.y = splashLogoBlocky.y + 150;
   {
  const SHADOW_SQUASH_Y = 0.22; // keep same feel as before
  const s = splashLogoBlocky.scale.y * 1.05; // ✅ uniform base from Y scale
  splashShadowBlocky.scale.set(s, s * SHADOW_SQUASH_Y);
}



      // scale down to base
      splashLogoBlocky.scale.set(
        b0x + (splashBlockyBaseSX - b0x) * e,
        b0y + (splashBlockyBaseSY - b0y) * e
      );
    // ✅ slide X from DROP -> FINAL target
    splashLogoBlocky.x = splashLogoBlocky.x + (splashBlockyTargetX - splashLogoBlocky.x) * e;


    });


    const riseFarm = (async () => {
      await waitMs(RISE_STAGGER_MS);
      await animateMs(riseMs, (t) => {
        const e = easeOutBack(t, 1);


        // move
    splashLogoFarm.y = fromFarm + (splashFarmTargetY - fromFarm) * e;
    splashLogoFarm.x = fromFarmX + (splashFarmTargetX - fromFarmX) * e;
    splashShadowFarm.x = splashLogoFarm.x + 46;
    splashShadowFarm.y = splashLogoFarm.y + 150;
   // ✅ fake height: shadow changes THICKNESS only (no wide stretch)
const height01 = Math.max(0, Math.min(1, (splashFarmTargetY - splashLogoFarm.y) / 200));

// tune these:
const SHADOW_WIDTH_MUL = 0.98;         // < 1 = narrower shadow (try 0.92..1.05)
const SHADOW_SQUASH_BASE = 0.28;       // bigger = less flat (try 0.26..0.40)
const SHADOW_SQUASH_ADD  = 0.10;       // how much it fattens while rising (try 0.06..0.14)

const squash = SHADOW_SQUASH_BASE + height01 * SHADOW_SQUASH_ADD;

// base size ONLY from logo Y scale (prevents wide stretch)
const base = splashLogoFarm.scale.y * SHADOW_WIDTH_MUL;
splashShadowFarm.scale.set(base, base * squash);






        // scale down to base
        splashLogoFarm.scale.set(
          f0x + (splashFarmBaseSX - f0x) * e,
          f0y + (splashFarmBaseSY - f0y) * e
        );
      });
    })();


    await Promise.all([riseBlocky, riseFarm]);

    // ---- SPLASH INFO BOXES FADE IN ----
    splashInfoBoxes.forEach((b) => {
      b.alpha = 0;
      const y0 = b.y;

      tween(320, (k) => {
        const e = k * k * (3 - 2 * k);
        b.alpha = e;
        b.y = y0 - 10 * (1 - e); // ✅ no drift
      });
    });



    // snap exact end state (prevents tiny float drift)
    splashLogoBlocky.x = splashBlockyTargetX;
    splashLogoBlocky.y = splashBlockyTargetY;

    splashLogoFarm.x   = splashFarmTargetX;
    splashLogoFarm.y   = splashFarmTargetY;
    splashLogoSettled = true;

    // ✅ start idle float after logo settles
    splashFloatT = 0;
    splashFloatBlend = 0;

    // blend the float in smoothly
    tween(
      SPLASH_FLOAT_BLEND_IN_MS,
      (k) => {
        splashFloatBlend = Math.max(0, Math.min(1, k));
      },
      () => {
        splashFloatBlend = 1;
      }
    );


    splashLogoBlocky.scale.set(splashBlockyBaseSX, splashBlockyBaseSY);
    splashLogoFarm.scale.set(splashFarmBaseSX, splashFarmBaseSY);





    // ✅ now that logo + info are in place, slide the continue prompt up ONCE
    showSplashContinue(true, 320);

      const onContinue = async () => {
        // stop splash logo float immediately
    splashFloatBlend = 0;
    splashLogoSettled = false;


        splashInfoBoxes.forEach((b) => (b.alpha = 0));

      if (!state.overlay.splash) return;
      splashLayer.off("pointertap", onContinue);
      
// ✅ HARD KILL tag immediately on continue (prevents 1-frame poke)
studioTag.visible = false;
studioTag.alpha = 0;

      // fade blur down (so the game starts crisp)
      const b0 = bgBlur.strength;
      await animateMs(320, (t) => {
        const e = t * t * (3 - 2 * t);
        bgBlur.strength = b0 * (1 - e);
        splashLayer.alpha = 1 - e;
      });

      splashLayer.visible = false;
      splashLayer.eventMode = "none";
      state.overlay.splash = false;
      // ✅ restore studio tag after splash (non-portrait only)
// ✅ restore studio tag after splash using the SAME rules as main game
layoutStudioTag();


gameTitle.visible = false;
    // ✅ Kick off the startup background pan + reveal sequence
    playStartupIntro();

    // ✅ re-enable clouds after splash
cloudFxEnabled = true;
cloudSpawnAcc = 0;
seedCloudFx(6);

// ✅ re-enable leaves after splash
leafFxEnabled = true;
leafSpawnAcc = 0;

    // ✅ draw the initial board so symbols exist when the game reveals
    bootInitialBoard();
await bootReplayIfNeeded();
    // ✅ title drop AFTER the reveal finishes (matches old feel)
  setTimeout(() => {
  allowGameTitle = true;      // ✅ NEW: only now the title is allowed to exist
  gameTitle.visible = false;  // keep it hidden until the drop sets it
showTitleAtRestAndFloat();
}, STARTUP_PAN_MS + STARTUP_REVEAL_DELAY + 80);


    };


      splashLayer.on("pointertap", onContinue);



    }

  const STUDIO_LOGO_URL = "./assets/ui/studio_logo.png";
  const STUDIO_LOGO_HOUSE_URL = "./assets/ui/studio_logo_house.webp";
  const BG_BASE_URL = "./assets/backgrounds/bg_candy_landscape.webp";
  const BG_FREE_URL = "./assets/backgrounds/bg_candy_landscape_free.webp";
  const FS_OUTRO_BG_URL = "./assets/ui/fs_outro_bg.webp";
  const INFINITY_ICON_URL = "./assets/ui/infinity.png";

    


// =====================
// GAME TITLE POSITION TWEAKS
// =====================

// mobile / shared defaults (keep what you already like)
// ✅ Title offsets now scale with reel sizing (cellSize)
let TITLE_OFFSET_X = 0;     // (we'll compute it per layout)
let TITLE_OFFSET_Y = -80;

let TITLE_OFFSET_X_DESKTOP = 0;
let TITLE_OFFSET_Y_DESKTOP = -80;


// =====================
// FINAL: atlas handles must be declared EARLY (prevents TDZ crashes)
// =====================
let uiSheet: any = null;
let uiExtraSheet: any = null;
let symbolsSheet: any = null;
let reelhouseSheet: any = null;
let vehiclesSheet: any = null;
let bigWinItemsSheet: any = null;



    // =====================
    // SPLASH CARD ART (icons under subtitle)
    // =====================
    let splashArtBuilt = false;

    function buildSplashCardArtOnce() {
      // ✅ wait until atlases are ready
    if (!uiExtraSheet || !uiExtraSheet.textures) return;
    if (typeof SYMBOL_TEX === "undefined" || !SYMBOL_TEX) return; // ✅ TDZ-safe
    if (!SYMBOL_TEX["S1"]) return;


      // ✅ MOBILE PORTRAIT: no splash art at all
  if (isMobilePortraitUILayout(__layoutDeps)) {
    // make sure any previously-created art is removed
    for (const box of splashInfoBoxes as any[]) {
      const art: Container | undefined = box?._splashArt;
      if (art) {
        art.removeChildren();
        art.visible = false;
      }
    }
    splashArtBuilt = true;
    return;
  }

    if (splashArtBuilt) return;
    splashArtBuilt = true;

      // Card 0: 3 scatters
      const card0 = splashInfoBoxes[0] as any;
      if (!card0?._splashArt) return;

    // Card 1 (index 1): single PNG
    const card1 = splashInfoBoxes[1] as any;
    if (card1?._splashArt) {
      const art: Container = card1._splashArt;
      art.removeChildren();

      // Card 2 (index 2): MAX WIN PNG
    const card2 = splashInfoBoxes[2] as any;
    if (card2?._splashArt) {
      const art: Container = card2._splashArt;
      art.removeChildren();

      const s = new Sprite(texExtra("splash_max_art.png"));
      s.anchor.set(0.5);
      s.eventMode = "none";
      s.roundPixels = true;

      art.addChild(s);
    }


      const s = new Sprite(texExtra("splash_multiplier_art.png"));
      s.anchor.set(0.5);
      s.eventMode = "none";
      s.roundPixels = true;

      art.addChild(s);
    }



      const art: Container = card0._splashArt;
      art.removeChildren();

      const t = texSymbol(SYMBOL_FRAMES["S1"]);// scatter texture (already loaded via SYMBOL_TEXTURES)
      for (let k = 0; k < 3; k++) {
        const s = new Sprite(t);
        s.anchor.set(0.5);
        s.eventMode = "none";
        s.roundPixels = true;
        art.addChild(s);
      }
    }








    

  const bgCarLayer = new Container();
  bgCarLayer.zIndex = 120;
  bgCarLayer.eventMode = "none";
  backgroundLayer.addChild(bgCarLayer);



    // =====================
    // VOXEL SMOKE FX (background-only)
    // =====================
    // Put smoke *inside* backgroundLayer so it follows background zoom/blur.
    const smokeFxLayer = new Container();
    smokeFxLayer.sortableChildren = true;
    smokeFxLayer.zIndex = 200; // still "background", but above bg sprites if those are zIndex ~0
    smokeFxLayer.eventMode = "none";
    backgroundLayer.addChild(smokeFxLayer);

    // toggle if you ever want
    let smokeFxEnabled = false; // start OFF; we'll enable after startup pan


    // emitter position (normalized screen coords) - tweak these
    let SMOKE_EMIT_X_N = .9; // 0..1
    let SMOKE_EMIT_Y_N = 0.3; // 0..1

    // =====================
    // FS OUTRO CHIMNEY SMOKE EMITTERS
    // =====================
    type SmokeEmitter = {
      xN: number;
      yN: number;
      rate: number; // particles per second
    };

    // 🔧 TUNE THESE to match your art
    const FS_OUTRO_CHIMNEY_EMITTERS: SmokeEmitter[] = [
      // 🏠 House chimney
      { xN: 0.655, yN: 0.265, rate: 6 },

    ];


    type SmokeParticle = {
      g: Graphics;
      vx: number;
      vy: number;
      life: number;     // seconds remaining
      life0: number;    // initial life (for fade)
      spin: number;
      grow: number;     // scale growth per second
    };

    const smokePool: SmokeParticle[] = [];
    const smokeLive: SmokeParticle[] = [];

    let smokeSpawnAcc = 0;
    let smokeTickerAdded = false;

    const SMOKE_MAX_LIVE = 70;

    // density / feel
    const SMOKE_SPAWN_PER_SEC = 15; // lower = less smoke
    const SMOKE_MIN_VOX = 3;
    const SMOKE_MAX_VOX = 6;

    function makeVoxelPuff(): Graphics {
      const g = new Graphics();

      const vox = (SMOKE_MIN_VOX + Math.random() * (SMOKE_MAX_VOX - SMOKE_MIN_VOX)) | 0;
      const blocks = 5 + ((Math.random() * 9) | 0); // 5..13

    
    const cols = [0xffffff, 0xf2f2f2, 0xd9d9d9, 0xc8c8c8];


      for (let i = 0; i < blocks; i++) {
        const x = ((-2 + Math.random() * 4) * vox) | 0;
        const y = ((-2 + Math.random() * 4) * vox) | 0;

        // small chance to skip to keep it airy
        if (Math.random() < 0.10) continue;

    g
    .rect(x, y, vox, vox)
    .fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });

      }

      // start fairly faint (will fade out)
      g.alpha = 0.22 + Math.random() * 0.18;
      g.scale.set(0.9 + Math.random() * 0.7);

      return g;
    }

    function spawnSmokeAt(xN: number, yN: number) {
      const W = app.renderer.width;
      const H = app.renderer.height;

      let p = smokePool.pop();
      if (!p) {
        const g = makeVoxelPuff();
        p = { g, vx: 0, vy: 0, life: 0, life0: 0, spin: 0, grow: 0 };
      }

      const g = p.g;

      g.x = W * xN + (-6 + Math.random() * 12);
      g.y = H * yN + (-6 + Math.random() * 12);

      // chimney feel: slow rise + gentle drift
      p.vx = -4 + Math.random() * 8;
      p.vy = -(12 + Math.random() * 18);
      p.spin = (-1 + Math.random() * 2) * 0.18;

    // lifetime
    p.life0 = 2.6 + Math.random() * 1.6;
    p.life  = p.life0;

    // rise speed
    p.vy = -(10 + Math.random() * 16);

    // fade
    const k = Math.max(0, p.life / p.life0);
    g.alpha = 0.02 + 0.45 * Math.pow(k, 2.6);

    p.grow = 0.18 + Math.random() * 0.22;

      g.rotation = Math.random() * Math.PI * 2;
      g.alpha = 0.14 + Math.random() * 0.10;
      g.scale.set(0.75 + Math.random() * 0.45);

    // ✅ during FS outro, render smoke on the outro layer so it's visible
    if (state.overlay.fsOutro) fsOutroSmokeLayer.addChild(g);
    else smokeFxLayer.addChild(g);

      smokeLive.push(p);
    }


    function spawnSmoke() {
      const W = app.renderer.width;
      const H = app.renderer.height;

      let p = smokePool.pop();
      if (!p) {
        const g = makeVoxelPuff();
        p = { g, vx: 0, vy: 0, life: 0, life0: 0, spin: 0, grow: 0 };
      }

      const g = p.g;

      // emitter point in screen coords (+ jitter)
      const ex = W * SMOKE_EMIT_X_N;
      const ey = H * SMOKE_EMIT_Y_N;

      g.x = ex + (-10 + Math.random() * 20);
      g.y = ey + (-8 + Math.random() * 16);

      // vehicle-ish exhaust: drift right + up
      p.vx = 18 + Math.random() * 26;      // right
      p.vy = -(22 + Math.random() * 36);   // up
      p.spin = (-1 + Math.random() * 2) * 0.35;

      // life + fade
      p.life0 = 1.05 + Math.random() * 0.75; // 1.05..1.8s
      p.life = p.life0;

      // grow as it rises (puff expands)
      p.grow = 0.22 + Math.random() * 0.26;

      g.rotation = Math.random() * Math.PI * 2;
      g.alpha = 0.22 + Math.random() * 0.18;
      g.scale.set(0.75 + Math.random() * 0.55);

      smokeFxLayer.addChild(g);
      smokeLive.push(p);
    }

    function tickSmokeFx() {
      const dt = app.ticker.deltaMS / 1000;
      const W = app.renderer.width;
      const H = app.renderer.height;

      // =====================
      // FS OUTRO CHIMNEY SMOKE (spawn only)
      // =====================
      if (state.overlay.fsOutro) {
        for (const e of FS_OUTRO_CHIMNEY_EMITTERS) {
          smokeSpawnAcc += e.rate * dt;
          let n = Math.floor(smokeSpawnAcc);
          if (n > 0) smokeSpawnAcc -= n;

          n = Math.min(n, 4); // hitch safety
          for (let i = 0; i < n; i++) {
            spawnSmokeAt(e.xN, e.yN);
          }
        }
      }

      // =====================
      // 🔥 ALWAYS UPDATE EXISTING SMOKE
      // =====================
      for (let i = smokeLive.length - 1; i >= 0; i--) {
        const p = smokeLive[i];
        const g = p.g;

        // drift + rise
      const sway = Math.sin((g.y + i * 17) * 0.02) * 8;

        g.x += (p.vx + sway) * dt;
        g.y += p.vy * dt;
        g.rotation += p.spin * dt;

        // expand + fade
        const s = g.scale.x + p.grow * dt;
        g.scale.set(s);

        p.life -= dt;
        const k = Math.max(0, p.life / p.life0);
        g.alpha = (0.02 + 0.40 * k * k);

        // recycle
        const off =
          p.life <= 0 ||
          g.x < -220 || g.x > W + 220 ||
          g.y < -220 || g.y > H + 220;

        if (off) {
          g.removeFromParent();
          smokeLive.splice(i, 1);
          smokePool.push(p);
        }
      }

      // =====================
      // BASE GAME SMOKE SPAWN
      // =====================
      if (!smokeFxEnabled) return;

      smokeSpawnAcc += SMOKE_SPAWN_PER_SEC * dt;
      let n = Math.floor(smokeSpawnAcc);
      if (n > 0) smokeSpawnAcc -= n;

      for (let i = 0; i < n; i++) {
        if (smokeLive.length >= SMOKE_MAX_LIVE) break;
        spawnSmoke();
      }
    }


  function startSmokeFx() {
    if (smokeTickerAdded) return;
    smokeTickerAdded = true;
    addSystem(() => tickSmokeFx());
  }
    function clearSmokeNow() {
      for (let i = smokeLive.length - 1; i >= 0; i--) {
        const p = smokeLive[i];
        p.g.removeFromParent();
        smokeLive.splice(i, 1);
        smokePool.push(p);
      }
      smokeSpawnAcc = 0;
    }

    startSmokeFx();


    // =====================
    // VOXEL LEAF FX (cheap foreground particles)
    // =====================
    const leafFxLayer = new Container();
    leafFxLayer.sortableChildren = true;
    leafFxLayer.zIndex = 400;           // inside backgroundLayer ordering
    leafFxLayer.eventMode = "none";

    // ✅ put leaves INSIDE backgroundLayer so bgBlur affects them
    backgroundLayer.sortableChildren = true;
    backgroundLayer.addChild(leafFxLayer);
    backgroundLayer.sortChildren();

    type LeafParticle = {
      c: Container;
      vx: number;
      vy: number;
      vr: number;
      life: number;
    };

    const leafPool: LeafParticle[] = [];
    const leafLive: LeafParticle[] = [];

    let leafSpawnAcc = 0;
    let leafTickerAdded = false;
    let leafFxEnabled = true;


    const LEAF_MAX_LIVE = 26;

    // tune these
    const LEAF_SPAWN_PER_SEC = 3;   // ~1 leaf every 2.2s
    const LEAF_MIN_VOX = 4;            // voxel size (px)
    const LEAF_MAX_VOX = 7;
    const LEAF_MIN_SCALE = 0.9;
    const LEAF_MAX_SCALE = 1.35;

    function makeVoxelLeaf(): Container {
      const leaf = new Container();

      // a few voxel "pixels" to imply a leaf clump
      const g = new Graphics();

      const vox = Math.floor(LEAF_MIN_VOX + Math.random() * (LEAF_MAX_VOX - LEAF_MIN_VOX + 1));
      const cols = 4 + Math.floor(Math.random() * 3); // 4..6
      const rows = 3 + Math.floor(Math.random() * 3); // 3..5

      // simple blobby mask in grid coordinates
      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;

      // greens (a few nearby shades)
      const greens = [0x6fd46a, 0x47c46a, 0x2fb36a, 0x8eea6a];

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = (x - cx) / cx;
          const dy = (y - cy) / cy;

          // ellipse-ish falloff + a bit of randomness
          const d = dx * dx + dy * dy;
          if (d > 1.05) continue;
          if (Math.random() < 0.20 + d * 0.25) continue;

  g
    .rect(x * vox, y * vox, vox, vox)
    .fill({ color: greens[(Math.random() * greens.length) | 0], alpha: 1 });

        }
      }

      // center it
      const b = g.getLocalBounds();
      g.x = -b.width / 2;
      g.y = -b.height / 2;

      leaf.addChild(g);

      // tiny alpha + scale variability
      leaf.alpha = 0.85 + Math.random() * 0.15;
      const s = LEAF_MIN_SCALE + Math.random() * (LEAF_MAX_SCALE - LEAF_MIN_SCALE);
      leaf.scale.set(s);

      return leaf;
    }

    function spawnLeaf() {
      const W = app.renderer.width;
      const H = app.renderer.height;

      let p = leafPool.pop();
      if (!p) {
        const c = makeVoxelLeaf();
        p = { c, vx: 0, vy: 0, vr: 0, life: 0 };
      }

      // start offscreen left OR right, mid-ish vertical band
    const fromLeft = true; // always spawn from left → right

      p.c.x = fromLeft ? -80 : W + 80;
      p.c.y = H * (0.15 + Math.random() * 0.65);

      // drift across + slight downward
      const speed = 35 + Math.random() * 55; // px/sec-ish
      p.vx = (fromLeft ? 1 : -1) * speed;
      p.vy = 10 + Math.random() * 28;

      // spin
      p.vr = (-1 + Math.random() * 2) * 0.35;

      // lifetime
      p.life = 6.0 + Math.random() * 4.0;

      // random tilt
      p.c.rotation = Math.random() * Math.PI * 2;

      leafFxLayer.addChild(p.c);
      leafLive.push(p);
    }

    function tickLeafFx() {
      if (!leafFxEnabled) return;
      const W = app.renderer.width;
      const H = app.renderer.height;
      const dt = app.ticker.deltaMS / 1000;

      // spawn
      leafSpawnAcc += LEAF_SPAWN_PER_SEC * dt;
      const n = Math.floor(leafSpawnAcc);
      if (n > 0) leafSpawnAcc -= n;

      for (let i = 0; i < n; i++) {
        if (leafLive.length >= LEAF_MAX_LIVE) break;
        spawnLeaf();
      }

      // update
      for (let i = leafLive.length - 1; i >= 0; i--) {
        const p = leafLive[i];
        const c = p.c;

        c.x += p.vx * dt;
        c.y += p.vy * dt;
        c.rotation += p.vr * dt;

        // subtle flutter
        c.y += Math.sin((c.x + i * 13) * 0.02) * 0.25;

        // we don't despawn by lifetime — only when the leaf is fully off-screen
    const off =
      c.x < -220 || c.x > W + 220 ||
      c.y < -220 || c.y > H + 220;

    if (off) {
      c.removeFromParent();
      leafLive.splice(i, 1);
      leafPool.push(p);
    }

      }
    }


    function startLeafFx() {
      if (leafTickerAdded) return;
      leafTickerAdded = true;
      addSystem(() => tickLeafFx());
    }

    // start immediately
    startLeafFx();

    // =====================
    // BG CAR — VOXEL EXHAUST TRAIL (cheap)
    // =====================
    const bgCarExhaustLayer = new Container();
    bgCarExhaustLayer.zIndex = 119; // just under bgCarLayer (which is 120)
    bgCarExhaustLayer.eventMode = "none";
    (bgCarExhaustLayer as any).blendMode = "normal";
    backgroundLayer.addChild(bgCarExhaustLayer);

    type ExhaustP = {
      g: Graphics;
      vx: number;
      vy: number;
      life: number;
      life0: number;
      s0: number;
    };

    const exhaustPool: ExhaustP[] = [];
    const exhaustLive: ExhaustP[] = [];
    let exhaustAcc = 0;

    // tuning
    const EXHAUST_SPAWN_PER_SEC = 35;     // 18..45
    const EXHAUST_LIFE_MIN = 0.3;        // seconds
    const EXHAUST_LIFE_MAX = 1;
    const EXHAUST_MIN_VOX = 2;            // px
    const EXHAUST_MAX_VOX = 10;
    const EXHAUST_MAX_LIVE = 140;

    function makeExhaustPuff(): ExhaustP {
      const g = new Graphics();
      return { g, vx: 0, vy: 0, life: 0, life0: 0, s0: 1 };
    }

    function spawnCarExhaust(x: number, y: number, dirNX: number, dirNY: number, speed: number) {
      if (exhaustLive.length >= EXHAUST_MAX_LIVE) return;

      let p = exhaustPool.pop();
      if (!p) p = makeExhaustPuff();

      const g = p.g;
      g.clear();

    g.blendMode = "normal"; // 🔴 force normal alpha blending


      // voxel blocks
      const vox = (EXHAUST_MIN_VOX + Math.random() * (EXHAUST_MAX_VOX - EXHAUST_MIN_VOX + 1)) | 0;
      const blocks = 3 + ((Math.random() * 6) | 0); // 3..8
    const cols = [
      0x4a4a4a, // warm dark grey
      0x5a5a5a,
      0x6a6a6a,
      0x7a7a7a,
    ];


    for (let i = 0; i < blocks; i++) {
    const ox = ((-2 + Math.random() * 4) * vox) | 0;
    const oy = ((-2 + Math.random() * 4) * vox) | 0;

    g
      .rect(ox, oy, vox, vox)
      .fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });
  }


      // “behind car” direction is -dir
      const backX = -dirNX;
      const backY = -dirNY;

      // tiny sideways jitter (perpendicular)
      const perpX = -dirNY;
      const perpY = dirNX;

      // offset where exhaust comes from (tweak these)
      const BACK_PX = 28;  // how far behind car center
      const SIDE_PX = 6;   // slight sideways offset

      // spawn position
      g.x = x + backX * BACK_PX + perpX * (SIDE_PX * (-1 + Math.random() * 2)) + (-3 + Math.random() * 6);
      g.y = y + backY * BACK_PX + perpY * (SIDE_PX * (-1 + Math.random() * 2)) + (-3 + Math.random() * 6);

      // velocity: drift backward + up a bit
      const sp01 = Math.max(0, Math.min(1, (speed - 120) / 260)); // 0..1
      const backSp = 30 + 70 * sp01;   // more trail at speed
      p.vx = backX * backSp + perpX * (-12 + Math.random() * 24);
      p.vy = backY * backSp - (35 + 55 * sp01) + (-10 + Math.random() * 20);

      // lifetime
      p.life0 = EXHAUST_LIFE_MIN + Math.random() * (EXHAUST_LIFE_MAX - EXHAUST_LIFE_MIN);
      p.life = p.life0;

      // start style
      p.s0 = 0.65 + Math.random() * 0.65;
      g.scale.set(p.s0);
      g.alpha = 0.22 + Math.random() * 0.8;

      bgCarExhaustLayer.addChild(g);
      exhaustLive.push(p);
    }

    function tickCarExhaust(dt: number) {
      const W = app.renderer.width;
      const H = app.renderer.height;

      for (let i = exhaustLive.length - 1; i >= 0; i--) {
        const p = exhaustLive[i];
        const g = p.g;

        // slight “float” and spread
        p.vy -= 10 * dt;

        g.x += p.vx * dt;
        g.y += p.vy * dt;

        p.life -= dt;
        const k = Math.max(0, p.life / p.life0); // 1 -> 0

        // fade + expand slightly
        g.alpha = (0.35 * k) * (0.35 + 0.65 * k);
        const s = p.s0 * (1.0 + (1 - k) * 0.55);
        g.scale.set(s);

        const off = (p.life <= 0) || g.x < -260 || g.x > W + 260 || g.y < -260 || g.y > H + 260;
        if (off) {
          g.removeFromParent();
          exhaustLive.splice(i, 1);
          exhaustPool.push(p);
        }
      }
    }

function killCarsNow() {
  if (bgCarLive) {
    bgCarLive.s.removeFromParent();
    bgCarLive = null;
  }
  if (fsCarLive) {
    fsCarLive.s.removeFromParent();
    fsCarLive = null;
  }
  clearCarExhaustNow();

  // also stop cooldown timers so nothing “comes back”
  bgCarCooldown = 9999;
  fsCarCooldown = 9999;
}


    function clearCarExhaustNow() {
      for (let i = exhaustLive.length - 1; i >= 0; i--) {
        const p = exhaustLive[i];
        p.g.removeFromParent();
        exhaustLive.splice(i, 1);
        exhaustPool.push(p);
      }
      exhaustAcc = 0;
    }


    // =====================
    // BACKGROUND CAR FX (BASE ONLY)
    // =====================
    type BgCar = {
      s: Sprite;
      vx: number;      // speed px/sec
      nx: number;      // normalized dir x
      ny: number;      // normalized dir y
      startX: number;  // spawn start (screen-space, backgroundLayer coords)
      startY: number;
      endX: number;    // despawn target
      endY: number;
      t: number;       // progress-ish (optional)
    };




    let bgCarLive: BgCar | null = null;
    let bgCarCooldown = 0;

    // tuning
    const BG_CAR_MIN_DELAY = 18; // seconds
    const BG_CAR_MAX_DELAY = 35;
    const BG_CAR_SPEED = 160;     // px/sec

    // =====================
    // FREE SPINS BACKGROUND CAR (FS ONLY) — TUNING
    // =====================
    let fsCarLive: BgCar | null = null;
    let fsCarCooldown = 0;

    const FS_CAR_MIN_DELAY = 10; // seconds
    const FS_CAR_MAX_DELAY = 18;

    const FS_CAR_SPEED = 160;    // px/sec

    // ✅ FREE SPINS CAR: extra scale multiplier (LANDSCAPE ONLY)
const FS_CAR_LANDSCAPE_SCALE_MUL = 0.78; // 🔧 try 0.70–0.90

function getFsCarScale() {
  const base = getCarScale(); // your existing responsive scale

  // ✅ only affect FREE SPINS car in mobile landscape
  if (isMobileLandscapeUILayout(__layoutDeps)) return base * FS_CAR_LANDSCAPE_SCALE_MUL;

  return base;
}


function getCarScale() {
  const W = app.screen.width;

  // tune these
  const BASE_W = 1920;
  const MIN_S = 0.55;
  const MAX_S = 1.05;

  const s = W / BASE_W;
  return Math.max(MIN_S, Math.min(MAX_S, s));
}

function rescaleLiveCars() {
  const sBase = getCarScale();
  const sFs   = getFsCarScale();

  if (bgCarLive) bgCarLive.s.scale.set(sBase); // ✅ base car unchanged
  if (fsCarLive) fsCarLive.s.scale.set(sFs);   // ✅ FS car gets landscape-only tweak
}

    // ✅ FS car: RIGHT -> LEFT (match base direction feel)
    const FS_CAR_START_X_N = .86;  // spawn off-right
    const FS_CAR_START_Y_N = -0.08; // near top

    const FS_CAR_END_X_N   = -.03;  // exit toward left
    const FS_CAR_END_Y_N   = 0.71;  // down toward road


    const FS_CAR_PAD = 220;
    const FS_CAR_END_EXTRA_PAD = 520;


    // =====================
    // CAR PATH (road line) — top-right -> bottom-left
    // Tweak these to match your red road line
    // =====================
    const BG_CAR_START_X_N = .86; // near top-right
    const BG_CAR_START_Y_N = -0.06;

    const BG_CAR_END_X_N   = -.03 ; // near bottom-left
    const BG_CAR_END_Y_N   = 0.71;

    // extra padding so it starts/ends fully offscreen
    const BG_CAR_PAD = 220;
    const BG_CAR_END_EXTRA_PAD = 520; // how far past the end it should keep driving




    // =====================
    // VOXEL CLOUD FX (top band drifting left -> right)
    // =====================
    const cloudFxLayer = new Container();
    cloudFxLayer.sortableChildren = true;

    cloudFxLayer.zIndex = 300;          // inside backgroundLayer ordering
    cloudFxLayer.eventMode = "none";

    // ✅ put clouds INSIDE backgroundLayer so bgBlur affects them
    backgroundLayer.sortableChildren = true;
    backgroundLayer.addChild(cloudFxLayer);
    backgroundLayer.sortChildren();


    type CloudParticle = {
      c: Container;
      vx: number;
      vy: number;
      vr: number;
    };

    const cloudPool: CloudParticle[] = [];
    const cloudLive: CloudParticle[] = [];

    function retargetAmbientForSplash(ms = 420) {
      const H = app.renderer.height;

      // pick a splash target band
      const cloudYMin = H * 0.25, cloudYMax = H * 0.60;
      const leafYMin  = H * 0.22, leafYMax  = H * 0.70;

      const cloudStarts = cloudLive.map(p => p.c.y);
      const cloudTargets = cloudLive.map(() => cloudYMin + Math.random() * (cloudYMax - cloudYMin));

      const leafStarts = leafLive.map(p => p.c.y);
      const leafTargets = leafLive.map(() => leafYMin + Math.random() * (leafYMax - leafYMin));

      tween(ms, (k) => {
        const e = k * k * (3 - 2 * k); // smoothstep

        for (let i = 0; i < cloudLive.length; i++) {
          const c = cloudLive[i].c;
          c.y = cloudStarts[i] + (cloudTargets[i] - cloudStarts[i]) * e;
        }

        for (let i = 0; i < leafLive.length; i++) {
          const c = leafLive[i].c;
          c.y = leafStarts[i] + (leafTargets[i] - leafStarts[i]) * e;
        }
      });
    }


    let cloudSpawnAcc = 0;
    let cloudTickerAdded = false;
    let cloudFxEnabled = true;

    const CLOUD_MAX_LIVE = 10;

    // tune these
    const CLOUD_SPAWN_PER_SEC = 0.35; // ~1 cloud every ~3s
    const CLOUD_MIN_VOX = 4;
    const CLOUD_MAX_VOX = 5;

    function makeVoxelCloud(): Container {
      const cloud = new Container();
      const g = new Graphics();

      // voxel "cube" size
      const vox = Math.floor(CLOUD_MIN_VOX + Math.random() * (CLOUD_MAX_VOX - CLOUD_MIN_VOX + 1));

      // cloud blob size (in voxels)
      const cols = 10 + ((Math.random() * 10) | 0); // 10..17
      const rows = 4 + ((Math.random() * 5) | 0);  // 4..7

      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;

      // ---- 3D voxel helpers (cheap iso cube) ----
      // Iso cube dimensions derived from vox
      const hw = vox;          // half-width in screen x
      const hh = vox * 0.55;   // half-height in screen y
      const h  = vox * 0.75;   // cube vertical height

      function shade(hex: number, mul: number): number {
        const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * mul)));
        const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * mul)));
        const b = Math.max(0, Math.min(255, Math.round((hex & 255) * mul)));
        return (r << 16) | (g << 8) | b;
      }

      function drawIsoCube(px: number, py: number, baseCol: number, alpha: number) {
        // Top diamond (lighter)
      const topCol = shade(baseCol, 1.08);
    const leftCol = shade(baseCol, 0.92);
    const rightCol = shade(baseCol, 0.84);

        // top face points
        const tx0 = px;
        const ty0 = py - hh;
        const tx1 = px + hw;
        const ty1 = py;
        const tx2 = px;
        const ty2 = py + hh;
        const tx3 = px - hw;
        const ty3 = py;

        // bottom diamond shifted down by h
        const bx0 = tx0;
        const by0 = ty0 + h;
        const bx1 = tx1;
        const by1 = ty1 + h;
        const bx3 = tx3;
        const by3 = ty3 + h;

        // TOP
      g
    .moveTo(tx0, ty0)
    .lineTo(tx1, ty1)
    .lineTo(tx2, ty2)
    .lineTo(tx3, ty3)
    .closePath()
    .fill({ color: topCol, alpha });

        // LEFT face (tx3->tx0->bx0->bx3)
  g
    .moveTo(tx3, ty3)
    .lineTo(tx0, ty0)
    .lineTo(bx0, by0)
    .lineTo(bx3, by3)
    .closePath()
    .fill({ color: leftCol, alpha });

        // RIGHT face (tx0->tx1->bx1->bx0)
    g
    .moveTo(tx0, ty0)
    .lineTo(tx1, ty1)
    .lineTo(bx1, by1)
    .lineTo(bx0, by0)
    .closePath()
    .fill({ color: rightCol, alpha });
      }

      // slightly varied whites for voxel “cloud”
      const baseCols = [0xffffff, 0xf7fdff, 0xfffbf2, 0xf2f2f2];

      // IMPORTANT: draw order for 3D look
      // draw from back->front (y then x) so overlaps look correct
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = (x - cx) / cx;
          const dy = (y - cy) / cy;

          // ellipse falloff
          const d = dx * dx + dy * dy;

          // blobby silhouette
          if (d > 1.10) continue;
          if (Math.random() < 0.18 + d * 0.30) continue;

          const base = baseCols[(Math.random() * baseCols.length) | 0];
          const a = 0.65; // per-cube alpha (cloud alpha applied later too)

          // grid -> iso screen position
          // (x - y) controls iso x, (x + y) controls iso y
          const isoX = (x - y) * hw;
          const isoY = (x + y) * hh;

          // draw a cube at this iso position
          drawIsoCube(isoX, isoY, base, a);
        }
      }

      // center graphic
      const b = g.getLocalBounds();
      g.x = -b.width / 2 - b.x;
      g.y = -b.height / 2 - b.y;

      cloud.addChild(g);

      // overall softness
      cloud.alpha = 0.16 + Math.random() * .3;

      // bigger clouds
      const s = 1.0 + Math.random() * 1.7;
      cloud.scale.set(s);

      return cloud;
    }

    function spawnFsCar() {
      if (carsDisabled(__layoutDeps)) return;
      if (state.overlay.splash) return; // ✅ NO car during splash
        // ✅ NEW: block FS car during the "FS ended, outro pending" pause
  if (state.overlay.fsOutroPending) return;
    if (fsCarLive) return;
    if (state.game.mode !== "FREE_SPINS") return;

    // ✅ FS car should ONLY exist during actual FS gameplay (not intro overlay)
    if (state.overlay.fsIntro) return;

    if (state.overlay.fsOutro) return;
      

      const s = new Sprite(texVehicle("bg_car_night.png"));
      s.anchor.set(0.5);
      s.scale.set(getCarScale());
      s.alpha = 1;
      s.rotation = 0;

      const W = app.renderer.width;
      const H = app.renderer.height;

      const sx = Math.round(W * FS_CAR_START_X_N);
      const sy = Math.round(H * FS_CAR_START_Y_N);

      const ex0 = Math.round(W * FS_CAR_END_X_N);
      const ey0 = Math.round(H * FS_CAR_END_Y_N);

      let dx = ex0 - sx;
      let dy = ey0 - sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;

      const ex = ex0 + nx * FS_CAR_END_EXTRA_PAD;
      const ey = ey0 + ny * FS_CAR_END_EXTRA_PAD;

      // start fully offscreen “behind” the start point
      s.x = sx - nx * FS_CAR_PAD;
      s.y = sy - ny * FS_CAR_PAD;

      // keep upright
      s.rotation = 0;
      (s as any).skew?.set?.(0, 0);
    

      bgCarLayer.addChild(s);
audio?.playSfx?.("car", 0.5, 1.2);
      fsCarLive = {
        s,
        vx: (FS_CAR_SPEED * 2.2) + Math.random() * 60, // same “fast” feel as base
        nx,
        ny,
        startX: sx,
        startY: sy,
        endX: ex,
        endY: ey,
        t: 0,
      };
    }

  

    function spawnBgCar(force = false) {
      if (carsDisabled(__layoutDeps)) return;
      // 🚫 never spawn base car during FREE SPINS (even if forced)
    if (state.game.mode === "FREE_SPINS") return;

      if (state.overlay.fsIntro) {
      // intro is active: ensure FS car is dead, and do nothing else
      if (fsCarLive) {
        fsCarLive.s.removeFromParent();
        fsCarLive = null;
      }
      return;
    }
      if (state.overlay.fsIntro || state.overlay.fsOutro) return; // (optional safety)
      if (state.game.mode !== "BASE") return;         // ✅ base only
      if (bgCarLive) return;
      // already live? don't spawn again
      if (bgCarLive) return;

      // only allow in BASE unless forced (debug)
      if (!force && state.game.mode !== "BASE") return;
      if (!force && state.overlay.fsIntro) return;
      if (!force && state.overlay.fsOutro) return;

      // make the sprite
      const s = new Sprite(texVehicle("bg_red_car.png"));
      s.anchor.set(0.5);
     s.scale.set(getFsCarScale()); // ✅ correct, landscape-only tweak is inside this

      s.alpha = 1;
      s.rotation = 0;
      (s as any).skew?.set?.(0, 0);

      const W = app.renderer.width;
      const H = app.renderer.height;

      // start/end points (same knobs you already declared)
      const sx = Math.round(W * BG_CAR_START_X_N);
      const sy = Math.round(H * BG_CAR_START_Y_N);

      const ex0 = Math.round(W * BG_CAR_END_X_N);
      const ey0 = Math.round(H * BG_CAR_END_Y_N);

      // direction
      let dx = ex0 - sx;
      let dy = ey0 - sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;

      // end past the target so it fully exits
      const ex = ex0 + nx * BG_CAR_END_EXTRA_PAD;
      const ey = ey0 + ny * BG_CAR_END_EXTRA_PAD;

      // spawn fully offscreen “behind” the start point
      s.x = sx - nx * BG_CAR_PAD;
      s.y = sy - ny * BG_CAR_PAD;

      // IMPORTANT: add to the layer
      bgCarLayer.addChild(s);
audio?.playSfx?.("car", 0.5, 1.2);
      // store live car
      bgCarLive = {
        s,
        vx: (BG_CAR_SPEED * 2.2) + Math.random() * 60,
        nx,
        ny,
        startX: sx,
        startY: sy,
        endX: ex,
        endY: ey,
        t: 0,
      };

      
    }


    // =====================
  // INPUT ROUTER (single keydown/keyup source of truth)
  // =====================


  // --- space hold state (replaces your document keydown/keyup hold-auto logic) ---
  let __spaceDown = false;
  let __spaceHoldTimer: any = null;
  let __autoWasOnBeforeSpace = false;

  function __isContinueKey(e: KeyboardEvent) {
    return e.code === "Space" || e.key === " " || e.key === "Enter";
  }

  function __blockEvent(e: KeyboardEvent) {
    e.preventDefault?.();
    (e as any).stopImmediatePropagation?.();
    e.stopPropagation?.();
  }

  function __hardOverlayLocks() {
    // Allow Space/Enter handling during splash (we'll handle it explicitly below)
    return (
      loadingLayer?.visible ||
      state.overlay.startup
    );
  }

  function __overlayWantsContinue(): boolean {
    return state.overlay.bigWin || state.overlay.fsIntro || state.overlay.fsOutro;
  }

  

  






    function spawnCloud() {
      const H = app.renderer.height;

      let p = cloudPool.pop();
      if (!p) {
        const c = makeVoxelCloud();
        p = { c, vx: 0, vy: 0, vr: 0 };
      }

      // always left -> right, start offscreen
      p.c.x = -220;

     const isSplash = state.overlay.splash;

// normal game: 5%..25%
// splash: 25%..60% (more “in frame” behind logo/cards)
const yMin = isSplash ? 0.25 : 0.05;
const yMax = isSplash ? 0.60 : 0.25;

p.c.y = H * (yMin + Math.random() * (yMax - yMin));

      // drift across slowly
      const speed = 12 + Math.random() * 22; // px/sec
      p.vx = speed;
      p.vy = -1 + Math.random() * 2;         // tiny vertical drift
      p.vr = (-1 + Math.random() * 2) * 0.03; // almost no spin

    // =====================
    // CLOUD ROTATION (LOCKED)
    // =====================
    const CLOUD_BASE_ROT = -0.12;
    const CLOUD_ROT_JITTER = 0.10; // very subtle

    p.c.rotation =
      CLOUD_BASE_ROT + (-CLOUD_ROT_JITTER + Math.random() * CLOUD_ROT_JITTER * 2);




      cloudFxLayer.addChild(p.c);
      cloudLive.push(p);
    }

    function tickBgCar() {
      if (state.overlay.fsOutro) return;
      if (!bgCarLive) return;

      const dt = app.ticker.deltaMS / 1000;
      const s = bgCarLive.s;

      // ✅ hard-lock upright every frame
    s.rotation = 0;
    (s as any).skew?.set?.(0, 0);


      // move along the road direction
      s.x += bgCarLive.nx * bgCarLive.vx * dt;
      s.y += bgCarLive.ny * bgCarLive.vx * dt;

    // ✅ subtle vertical bob only (no rotation illusion)
    // ✅ 2-layer bob: slow suspension + fast gravel chatter (NO rotation)
    const now = performance.now();

    // primary slow bob (smooth)
    const bob1 = Math.sin(now * 0.006) * 0.1; // 0.4..1.4

    // gravel chatter (fast + “rough”)
    // Mix a few fast sines so it feels irregular but still stable/fake-perlin.
    const bob2 =
      (Math.sin(now * 0.045) * .4 +
      Math.sin(now * 0.073) * 0.5 +
      Math.sin(now * 0.112) * 0.4);

    // speed-based intensity: faster = slightly more chatter (clamped)
    const v01 = Math.max(0, Math.min(1, (bgCarLive.vx - 80) / 220));
    const gravelAmp = 0.25 + 0.55 * v01; // 0.25..0.80 px-ish

    s.y += bob1 + bob2 * gravelAmp;
    // tiny lateral wiggle (keep VERY small to avoid looking like rotation)
    s.x += Math.sin(now * 0.091) * (0.10 + 0.18 * v01);



      // despawn once it's well past the end point
      // (we project onto the travel direction and compare to the end)
      const px = s.x - bgCarLive.endX;
      const py = s.y - bgCarLive.endY;
      const pastEnd = (px * bgCarLive.nx + py * bgCarLive.ny) > BG_CAR_PAD;

    if (pastEnd) {
      s.removeFromParent();
      bgCarLive = null;
      clearCarExhaustNow();

      bgCarCooldown =
        BG_CAR_MIN_DELAY +
        Math.random() * (BG_CAR_MAX_DELAY - BG_CAR_MIN_DELAY);
      fsCarCooldown =
        FS_CAR_MIN_DELAY +
        Math.random() * (FS_CAR_MAX_DELAY - FS_CAR_MIN_DELAY);

      return; // ✅ IMPORTANT: stop here, bgCarLive is null now
    }

      // =====================
    // VOXEL EXHAUST TRAIL (spawn + update)
    // =====================
    exhaustAcc += EXHAUST_SPAWN_PER_SEC * dt;
    let n = Math.floor(exhaustAcc);
    if (n > 0) exhaustAcc -= n;

    // spawn a few puffs per frame (clamp so dt spikes don't explode counts)
    n = Math.min(n, 6);

    for (let i = 0; i < n; i++) {
      spawnCarExhaust(s.x, s.y, bgCarLive.nx, bgCarLive.ny, bgCarLive.vx);
    }

    // update existing exhaust
    tickCarExhaust(dt);

    }

    function tickFsCar() {
      if (state.overlay.fsOutro) return;
      if (!fsCarLive) return;

      const dt = app.ticker.deltaMS / 1000;
      const s = fsCarLive.s;

      // hard-lock upright every frame
      s.rotation = 0;
      (s as any).skew?.set?.(0, 0);

      // move along direction
      s.x += fsCarLive.nx * fsCarLive.vx * dt;
      s.y += fsCarLive.ny * fsCarLive.vx * dt;

      // optional tiny bob (same as base)
      const now = performance.now();
      const bob1 = Math.sin(now * 0.006) * 0.1;
      const bob2 =
        (Math.sin(now * 0.045) * 0.4 +
        Math.sin(now * 0.073) * 0.5 +
        Math.sin(now * 0.112) * 0.4);

      const v01 = Math.max(0, Math.min(1, (fsCarLive.vx - 80) / 220));
      const gravelAmp = 0.25 + 0.55 * v01;

      s.y += bob1 + bob2 * gravelAmp;
      s.x += Math.sin(now * 0.091) * (0.10 + 0.18 * v01);

      // despawn once past end
      const px = s.x - fsCarLive.endX;
      const py = s.y - fsCarLive.endY;
      const pastEnd = (px * fsCarLive.nx + py * fsCarLive.ny) > FS_CAR_PAD;

      if (pastEnd) {
        s.removeFromParent();
        fsCarLive = null;

        fsCarCooldown =
          FS_CAR_MIN_DELAY +
          Math.random() * (FS_CAR_MAX_DELAY - FS_CAR_MIN_DELAY);
      }
    }




   function tickCloudFx() {
  // ✅ allow clouds during splash too
  if (!cloudFxEnabled) return;

  // optional safety: don’t run clouds during FS overlays if you want
  if (state.overlay.fsIntro || state.overlay.fsOutro) return;

      const W = app.renderer.width;
      const H = app.renderer.height;
      const dt = app.ticker.deltaMS / 1000;

      // spawn
      cloudSpawnAcc += CLOUD_SPAWN_PER_SEC * dt;
      const n = Math.floor(cloudSpawnAcc);
      if (n > 0) cloudSpawnAcc -= n;

      for (let i = 0; i < n; i++) {
        if (cloudLive.length >= CLOUD_MAX_LIVE) break;
        spawnCloud();
      }

      // update
      for (let i = cloudLive.length - 1; i >= 0; i--) {
        const p = cloudLive[i];
        const c = p.c;

        c.x += p.vx * dt;
        c.y += p.vy * dt;
        c.rotation += p.vr * dt;

        // gentle bob
        c.y += Math.sin((c.x + i * 37) * 0.004) * 0.18;

        // recycle only when fully offscreen
        const off = c.x > W + 260 || c.y < -220 || c.y > H + 220;
        if (off) {
          c.removeFromParent();
          cloudLive.splice(i, 1);
          cloudPool.push(p);
        }
      }
    }
    function seedCloudFx(count = 5) {
      const W = app.renderer.width;
      const H = app.renderer.height;

      for (let i = 0; i < count; i++) {
        if (cloudLive.length >= CLOUD_MAX_LIVE) break;

        // create from pool / new
        let p = cloudPool.pop();
        if (!p) {
          const c = makeVoxelCloud();
          p = { c, vx: 0, vy: 0, vr: 0 };
        }

        // Start already on screen (random X across screen)
        p.c.x = Math.random() * (W + 260) - 130;

      // start just above the top so they're visible immediately
    // ✅ splash wants clouds already visible; otherwise keep them near top
    p.c.y = state.overlay.splash
      ? H * (0.25 + Math.random() * 0.35)   // mid screen band
      : H * (0.05 + Math.random() * 0.20);  // your normal top band


        // same motion params as spawnCloud()
        const speed = 12 + Math.random() * 22;
        p.vx = speed;
        p.vy = -2 + Math.random() * 1.2;
        p.vr = (-1 + Math.random() * 2) * 0.03;

        p.c.rotation = (-0.10 + Math.random() * 0.20);

        cloudFxLayer.addChild(p.c);
        cloudLive.push(p);
      }
    }

    function startCloudFx() {
      if (cloudTickerAdded) return;
      cloudTickerAdded = true;
      addSystem(() => tickCloudFx());
    }



  cloudFxEnabled = false;
startCloudFx();

    // ✅ start with a random delay so it doesn't spawn instantly
    bgCarCooldown =
      BG_CAR_MIN_DELAY +
      Math.random() * (BG_CAR_MAX_DELAY - BG_CAR_MIN_DELAY);

    // ✅ run every frame
addSystem((dt) => {
  // ✅ portrait mobile: no cars at all
  if (carsDisabled(__layoutDeps)) {
    killCarsNow();
    return;
  }

  // ✅ NEW: treat pending FS outro like an overlay (no cars, no ticking)
  if (state.overlay.splash || state.overlay.fsOutro || state.overlay.fsOutroPending) {
    killCarsNow();
    return;
  }

  if (state.game.mode === "BASE") {
    if (!bgCarLive) {
      bgCarCooldown -= dt;
      if (bgCarCooldown <= 0) spawnBgCar();
    }
    tickBgCar();
    return;
  }

  if (state.game.mode === "FREE_SPINS") {
    if (state.overlay.fsIntro) return;

    if (!fsCarLive) {
      fsCarCooldown -= dt;
      if (fsCarCooldown <= 0) spawnFsCar();
    }

    tickFsCar();
    return;
  }
});






    // =====================
    // VOXEL SNOW FX (FREE SPINS only)
    // =====================
    const snowFxLayer = new Container();
    snowFxLayer.sortableChildren = true;
    snowFxLayer.zIndex = 1200;     // same as leaves: above background, below gameCore
    snowFxLayer.eventMode = "none";
    root.addChild(snowFxLayer);
    root.sortChildren();

    type SnowParticle = {
      g: Graphics;
      gl: Graphics; // star glint overlay

      vx: number;
      vy: number;
      vr: number;
      spin: number;

      baseA: number;   // starting alpha
      baseS: number;   // starting scale
      tw: number;      // twinkle phase
      twSpeed: number; // twinkle speed

      prevTw01: number; // last frame twinkle (0..1)
      glintT: number;   // glint time remaining (seconds)
      glintArmed: boolean;
    };


    const snowPool: SnowParticle[] = [];
    const snowLive: SnowParticle[] = [];

    let snowSpawnAcc = 0;
    let snowTickerAdded = false;
    let snowFxEnabled = false; // starts off (BASE)

    const SNOW_MAX_LIVE = 140;

    // tune these
    const SNOW_SPAWN_PER_SEC = 10;  // density
    const SNOW_MIN_VOX = 2;         // voxel size px
    const SNOW_MAX_VOX = 4;
    const SNOW_MIN_SCALE = 0.9;
    const SNOW_MAX_SCALE = 1.6;

    function makeVoxelSnowflake(): Graphics {
      const g = new Graphics();

      // tiny voxel cluster (2-6 blocks)
      const vox = Math.floor(SNOW_MIN_VOX + Math.random() * (SNOW_MAX_VOX - SNOW_MIN_VOX + 1));
      const blocks = 2 + ((Math.random() * 5) | 0);

      // soft whites (slightly blue)
      const cols = [0xffffff, 0xffffff, 0xf7fdff, 0xfffbf2]; // a bit brighter + slightly warm sugar


  for (let i = 0; i < blocks; i++) {
    const x = ((-1 + Math.random() * 2) * vox * 1.2) | 0;
    const y = ((-1 + Math.random() * 2) * vox * 1.2) | 0;

    g
      .rect(x, y, vox, vox)
      .fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });
  }


    g.alpha = 0.75 + Math.random() * 0.25; // brighter baseline


      const s = SNOW_MIN_SCALE + Math.random() * (SNOW_MAX_SCALE - SNOW_MIN_SCALE);
      g.scale.set(s);

      return g;
    }

    function spawnSnow() {
      const W = app.renderer.width;

      let p = snowPool.pop();
      if (!p) {
        const g = makeVoxelSnowflake();

    // tiny star glint (a small + cross), normally hidden
  const gl = new Graphics();

  gl
    .rect(-1, -10, 2, 20)
    .fill({ color: 0xffffff, alpha: 1 });

  gl
    .rect(-10, -1, 20, 2)
    .fill({ color: 0xffffff, alpha: 1 });

  gl.alpha = 0;
  gl.visible = false;

  // ✅ v8: don’t use "add" string
  // Option A (quick): just set numeric blend mode
  (gl as any).blendMode = 1; // ADD in Pixi blend modes (works, but a bit “magic number”)

  // Option B (clean): import and use constants
  // import { BLEND_MODES } from "pixi.js";
  // gl.blendMode = BLEND_MODES.ADD;


    p = {
      g, gl,
      vx: 0, vy: 0, vr: 0, spin: 0,
      baseA: 1, baseS: 1, tw: 0, twSpeed: 0,
      prevTw01: 0, glintT: 0, glintArmed: true
    };



      }

      const g = p.g;

      // spawn above screen across full width (+ padding)
      g.x = -40 + Math.random() * (W + 80);
      g.y = -80 - Math.random() * 220;

      // fall speed + gentle drift
      p.vy = 55 + Math.random() * 130;
      p.vx = -25 + Math.random() * 50;

      // little wobble
      p.spin = 0.6 + Math.random() * 1.2;
      p.vr = (-1 + Math.random() * 2) * 0.25;

      g.rotation = Math.random() * Math.PI * 2;

      // twinkle setup (sugar sparkle)
    p.baseA = g.alpha;
    p.baseS = g.scale.x;
    p.tw = Math.random() * Math.PI * 2;
    p.twSpeed = 2.2 + Math.random() * 3.8; // speed range

    p.prevTw01 = 0;
    p.glintT = 0;
    p.glintArmed = true;



    snowFxLayer.addChild(g);
    snowFxLayer.addChild(p.gl); // overlay on top
    snowLive.push(p);

    }

    function clearSnowNow() {
  for (let i = snowLive.length - 1; i >= 0; i--) {
    const p = snowLive[i];
    p.g.removeFromParent();
    p.gl.removeFromParent();

    // safety reset so reused particles never flash a glint
    p.gl.visible = false;
    p.gl.alpha = 0;
    p.glintT = 0;
    p.glintArmed = true;

    snowPool.push(p);
  }
  snowLive.length = 0;
  snowSpawnAcc = 0;
}


   function tickSnowFx() {
  const W = app.renderer.width;
  const H = app.renderer.height;
  const dt = app.ticker.deltaMS / 1000;

  // ✅ Spawn ONLY when enabled
  if (snowFxEnabled) {
    snowSpawnAcc += SNOW_SPAWN_PER_SEC * dt;
    const n = Math.floor(snowSpawnAcc);
    if (n > 0) snowSpawnAcc -= n;

    for (let i = 0; i < n; i++) {
      if (snowLive.length >= SNOW_MAX_LIVE) break;
      spawnSnow();
    }
  }

  // ✅ ALWAYS update existing snow so it can fall off + recycle
  for (let i = snowLive.length - 1; i >= 0; i--) {
    const p = snowLive[i];
    const g = p.g;

    const sway = Math.sin((g.y * 0.012) + (i * 0.7)) * (12 * dt);

    g.x += (p.vx * dt) + sway;
    g.y += (p.vy * dt);
    g.rotation += p.vr * dt;

    p.gl.x = g.x;
    p.gl.y = g.y;
    p.gl.rotation = g.rotation;

    // twinkle
    p.tw += p.twSpeed * dt;
    const tw01 = 0.5 + 0.5 * Math.sin(p.tw);

    const nearPeak = tw01 > 0.985;
    if (!nearPeak) p.glintArmed = true;

    if (nearPeak && p.glintArmed) {
      p.glintArmed = false;
      if (Math.random() < 1 / 70) {
        p.glintT = 0.10 + Math.random() * 0.06;
      }
    }

    let a = p.baseA * (0.78 + tw01 * 0.28);
    let s = p.baseS * (0.92 + tw01 * 0.10);

    if (p.glintT > 0) {
      p.glintT -= dt;
      const k = Math.max(0, p.glintT) / 0.16;

      const pop = 1 + k * 0.55;
      a *= 1.10 * pop;
      s *= pop;

      p.gl.visible = true;
      p.gl.alpha = Math.min(1, 0.15 + k * 0.85);
      const gs = 0.65 + k * 0.85;
      p.gl.scale.set(gs);
    } else {
      p.gl.visible = false;
      p.gl.alpha = 0;
    }

    g.alpha = Math.min(1, a);
    g.scale.set(s);

    const off = g.y > H + 140 || g.x < -220 || g.x > W + 220;
    if (off) {
      g.removeFromParent();
      p.gl.removeFromParent();
      snowLive.splice(i, 1);
      snowPool.push(p);
    }
  }

  // ✅ When disabled, don't keep fractional spawn build-up
  if (!snowFxEnabled) snowSpawnAcc = 0;
}


    function startSnowFx() {
      if (snowTickerAdded) return;
      snowTickerAdded = true;
      addSystem(() => tickSnowFx());
    }

    // start ticker once; enable/disable via snowFxEnabled
    startSnowFx();





    // =====================
    // FULL-SCREEN DIMMER + BACKGROUND BLUR (for overlays / free spins intro)
    // =====================
  const bgBlur = new BlurFilter({ strength: 12 });
  // ✅ start blurred so there’s no “crisp flash”
    (backgroundLayer as any).filters = [bgBlur];


    // =====================
    // FS INTRO TRACTOR (2-frame stop-motion AnimatedSprite)
    // =====================


    let fsTractor: AnimatedSprite | null = null;
    const fsTractorLayer = new Container();
    fsTractorLayer.zIndex = 9451; // above fsContinueText(9450), below award text(9452)
    fsTractorLayer.visible = false;

    fsTractorLayer.eventMode = "none";
    root.addChild(fsTractorLayer);
    root.sortChildren();

    let fsTractorEnterToken = 0;
    let fsTractorExitToken = 0;

    function ensureFsTractor() {
      if (fsTractor) return;

  const t0 = texVehicle("tractor_0.png");
  const t1 = texVehicle("tractor_1.png");


      const a = new AnimatedSprite([t0, t1]);
      a.anchor.set(0.5);
      a.loop = true;

      // "stop motion" feel: slower frame swap
      // (0.12..0.22 feels nice for 2-frame wheel turn)
      a.animationSpeed = 0.10;
      (a as any).autoUpdate = true;
      a.play();

      a.roundPixels = true;

      fsTractor = a;
      fsTractorLayer.addChild(a);

      layoutFsTractor(); // initial position
layoutFsTractorBanner(); // initial banner scale/offsets for current view

      // =====================
    // FS INTRO BANNER (ATTACHED TO TRACTOR)
    // =====================
    const fsTractorBanner = new Container();
    fsTractorBanner.eventMode = "none";
    fsTractorBanner.visible = false;
    (a as any)._banner = fsTractorBanner;

    // --- styles (reusing your existing outro look) ---
    const baseGold: any = (fsOutroWinAmount.style as any);
    const goldStyleObj: any = baseGold?.clone ? baseGold.clone() : { ...(baseGold || {}) };

    const baseWhite: any = (fsOutroTotalLabel.style as any);
    const whiteStyleObj: any = baseWhite?.clone ? baseWhite.clone() : { ...(baseWhite || {}) };

    // 3 lines: "10" / "FREE" / "SPINS"
    const banner10 = new Text({
      text: "10",
      style: new TextStyle({
        ...goldStyleObj,
        fontSize: 300,          // 🔧 tune
        align: "center",
      } as any),
    } as any);
    banner10.anchor.set(0.5);

    const bannerFree = new Text({
  text: "",
  style: localizeStyle({
    fontFamily: "pixeldown",
    fill: 0xffffff,
    fontSize: 64,
    letterSpacing: 2,
    stroke: { color: 0x000000, width: 8 },
  } as any),
} as any);

const bannerSpins = new Text({
  text: "",
  style: localizeStyle({
    fontFamily: "pixeldown",
    fill: 0xffffff,
    fontSize: 64,
    letterSpacing: 2,
    stroke: { color: 0x000000, width: 8 },
  } as any),
} as any);
// 🔧 scale FREE / SPINS slightly smaller than the number
// 🔧 scale FREE / SPINS slightly smaller than the number
const FS_WORD_SCALE =
  (( __layoutDeps as any )?.IS_TINY_VIEW ? 0.6 : 1.2); // ✅ tiny view only

// ✅ FS INTRO — tiny view scaling
const FS_INTRO_TINY_NUM_SCALE  = 0.5; // 🔧 try 0.55–0.75
const FS_INTRO_TINY_WORD_SCALE = 0.5; // 🔧 optional, keeps proportions nice


// ----------------------------------
// FS INTRO BANNER — SCALE (TINY ONLY)
// ----------------------------------



bannerFree.anchor.set(0.5);
bannerSpins.anchor.set(0.5);

function centerBannerText(tt: Text) {
  const b = tt.getLocalBounds();
  tt.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
  tt.x = 0;
}

function setFsIntroBannerText() {
  const txt = applyUiTextCase(t("ui.freeSpins"));
  const parts = txt.trim().split(/\s+/);

  bannerFree.text  = parts[0] ?? txt;
  bannerSpins.text = parts.slice(1).join(" ") || "";

  centerBannerText(bannerFree);
  centerBannerText(bannerSpins);
}


const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
// default gaps (all normal modes)
let GAP_10_TO_FREE = 90;
let GAP_FREE_TO_SPINS = 60;

// ✅ Tiny view only: tighten vertical spacing
if (IS_TINY_VIEW) {
  GAP_10_TO_FREE = 70;      // 🔧 try 48..70
  GAP_FREE_TO_SPINS = 50;   // 🔧 try 28..48
}

banner10.position.set(0, 0);
bannerFree.position.set(0, GAP_10_TO_FREE);
bannerSpins.position.set(0, GAP_10_TO_FREE + GAP_FREE_TO_SPINS);


// ✅ call once after positions are set
setFsIntroBannerText();


    fsTractorBanner.addChild(banner10, bannerFree, bannerSpins);

    // ✅ add banner to the SAME LAYER as the tractor (screen-space sizing)
    fsTractorLayer.addChild(fsTractorBanner);

    // position banner relative to the tractor sprite (local coords)
    // (0,0) is tractor center because anchor=0.5
const BANNER_OFF_X = -290;

const BANNER_OFF_Y =
  isMobileLandscapeUILayout(__layoutDeps) ? -130 :
  isMobilePortraitUILayout(__layoutDeps)  ? -235 :
                                          -220;

// ✅ Tiny view ONLY: pull banner closer to tractor

const TINY_BANNER_Y_PUSH = 65; // 🔧 try 60..120

const bannerOffYFinal = IS_TINY_VIEW
  ? BANNER_OFF_Y + TINY_BANNER_Y_PUSH
  : BANNER_OFF_Y;

fsTractorBanner.position.set(BANNER_OFF_X, bannerOffYFinal);

// keep for follow-system reuse
(a as any)._bannerOffY = bannerOffYFinal;




fsTractorBanner.position.set(BANNER_OFF_X, bannerOffYFinal);

(a as any)._bannerOffX = BANNER_OFF_X;
(a as any)._bannerOffY = bannerOffYFinal;


// 🔧 this is now your REAL size control
const BANNER_SCALE_DESKTOP  = 1.4;
const BANNER_SCALE_PORTRAIT = 1.4;
const BANNER_SCALE_LAND     = 1; // 🔧 landscape smaller (try 0.95..1.25)

// ✅ Tiny view ONLY: shrink the whole “10 FREE SPINS” banner

const TINY_FS_BANNER_SCALE_MUL = 0.9; // 🔧 try 0.60..0.85

let bannerScale =
  isMobileLandscapeUILayout(__layoutDeps) ? BANNER_SCALE_LAND
  : isMobilePortraitUILayout(__layoutDeps) ? BANNER_SCALE_PORTRAIT
  : BANNER_SCALE_DESKTOP;

if (IS_TINY_VIEW) bannerScale *= TINY_FS_BANNER_SCALE_MUL;

(a as any)._bannerScale = bannerScale;

fsTractorBanner.position.set(BANNER_OFF_X, BANNER_OFF_Y);



    // store refs so we can update "10" per entry
    (a as any)._banner10 = banner10;
    (a as any)._banner = fsTractorBanner;



    }

    addSystem((dt) => {
      if (!fsTractor) return;

      const banner = (fsTractor as any)._banner as Container | undefined;
      if (!banner) return;

      if (!fsTractorLayer.visible) {
        banner.visible = false;
        return;
      }

      // follow tractor (same parent layer)
      const offX = (fsTractor as any)._bannerOffX ?? -290;
      const offY = (fsTractor as any)._bannerOffY ?? -140;

      banner.x = Math.round(fsTractor.x + offX);
      banner.y = Math.round(fsTractor.y + offY);

  // keep banner size independent (screen space)
let sc = (fsTractor as any)._bannerScale ?? 1.6;

// ✅ Tiny view ONLY: enforce shrink even if something overwrites _bannerScale later
const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
const TINY_FS_BANNER_SCALE_MUL = 0.75; // keep same value as above
if (IS_TINY_VIEW) sc *= TINY_FS_BANNER_SCALE_MUL;

banner.scale.set(sc);

    });


    function layoutFsTractor() {
      if (!fsTractor) return;

      const W = app.screen.width;
      const H = app.screen.height;

      // scale tuning (change these freely)
     const TRACTOR_TARGET_W_N =
  isMobilePortraitUILayout(__layoutDeps) ? 1.2 :  // ✅ bigger in portrait
  isMobileLandscapeUILayout(__layoutDeps) ? 0.70 : // optional tweak
  0.9;                                           // desktop

const targetW = Math.round(W * TRACTOR_TARGET_W_N);

// also cap by height so it doesn’t become *too* huge
const MAX_H_N =
  isMobilePortraitUILayout(__layoutDeps) ? 0.28 :
  isMobileLandscapeUILayout(__layoutDeps) ? 0.40 :
  0.5;

const targetH = Math.round(H * MAX_H_N);

const texW = fsTractor.texture.width || 1;
const texH = fsTractor.texture.height || 1;

const s = Math.min(targetW / texW, targetH / texH);
fsTractor.scale.set(s);




// vertical placement (tweak) — must match fsTractorY()
const FS_TRACTOR_Y_N =
  isMobilePortraitUILayout(__layoutDeps) ? 0.68 :
  isMobileLandscapeUILayout(__layoutDeps) ? 0.64 :
  0.66;

const y = Math.round(H * FS_TRACTOR_Y_N);


      // if not currently animating, keep it centered
      if (!fsTractorLayer.visible) {
        fsTractor.x = Math.round(W * 0.5);
        fsTractor.y = y;
      }
    }
function layoutFsTractorBanner() {
  if (!fsTractor) return;

  const banner = (fsTractor as any)._banner as Container | undefined;
  if (!banner) return;

  const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;

  // --- Offsets ---
  const BANNER_OFF_X = -290;

  const BANNER_OFF_Y =
    isMobileLandscapeUILayout(__layoutDeps) ? -130 :
    isMobilePortraitUILayout(__layoutDeps)  ? -235 :
                                              -220;

  const TINY_BANNER_Y_PUSH = 65;

  const bannerOffYFinal = IS_TINY_VIEW
    ? BANNER_OFF_Y + TINY_BANNER_Y_PUSH
    : BANNER_OFF_Y;

  (fsTractor as any)._bannerOffX = BANNER_OFF_X;
  (fsTractor as any)._bannerOffY = bannerOffYFinal;

  // --- Scale ---
  const BANNER_SCALE_DESKTOP  = 1.4;
  const BANNER_SCALE_PORTRAIT = 1.4;
  const BANNER_SCALE_LAND     = 1;

  const TINY_FS_BANNER_SCALE_MUL = 0.9;

  let bannerScale =
    isMobileLandscapeUILayout(__layoutDeps) ? BANNER_SCALE_LAND
    : isMobilePortraitUILayout(__layoutDeps) ? BANNER_SCALE_PORTRAIT
    : BANNER_SCALE_DESKTOP;

  if (IS_TINY_VIEW) bannerScale *= TINY_FS_BANNER_SCALE_MUL;

  (fsTractor as any)._bannerScale = bannerScale;
}

   window.addEventListener("resize", () => {
  layoutFsTractor();
  layoutFsTractorBanner();
});

    function fsTractorOffLeftX() {
      const w = fsTractor?.width || 400;
      return -w * 0.6;
    }

   function fsTractorOffRightX() {
  const W = app.screen.width;
  const tractorW = (fsTractor?.width || 400);

  // Default (desktop + non-landscape)
  let x1 = W + tractorW * 0.8;

  // ✅ Mobile LANDSCAPE: push far enough so the trailing banner clears too
  if (isMobileLandscapeUILayout(__layoutDeps)) {
    const banner = (fsTractor as any)?._banner as Container | undefined;

    const offX = (fsTractor as any)?._bannerOffX ?? -290; // banner is usually LEFT of tractor
    const bannerW = banner ? (banner.getBounds().width || 0) : 0;

    x1 =
      W +
      tractorW * 1.6 +
      Math.abs(offX) +
      bannerW * 1.2 +
      80; // safety pad
  }

  return x1;
}


    // =====================
    // FS TRACTOR STOP POSITION OFFSET
    // =====================
    const FS_TRACTOR_STOP_OFFSET_X = 293; // 👉 +right, -left (pixels)

    function fsTractorCenterX() {
      return Math.round(app.screen.width * 0.5 + FS_TRACTOR_STOP_OFFSET_X);
    }


 function fsTractorY() {
  // 🔧 bigger = lower
  const FS_TRACTOR_Y_N =
    isMobilePortraitUILayout(__layoutDeps) ? 0.68 :
    isMobileLandscapeUILayout(__layoutDeps) ? 0.64 :
    0.66; // desktop

  return Math.round(app.screen.height * FS_TRACTOR_Y_N);
}


    // Enter: left -> center
    function showFsTractorEnter(ms = 550) {
      ensureFsTractor();
      if (!fsTractor) return;

      fsTractorEnterToken++;
      const token = fsTractorEnterToken;

      fsTractorLayer.visible = true;
      // 🔥 force recalculation for current layout before animating
layoutFsTractor();
layoutFsTractorBanner();

      // show/update banner (dragged in with tractor)
    const banner = (fsTractor as any)._banner as Container | undefined;
    const banner10 = (fsTractor as any)._banner10 as Text | undefined;
    if (banner) banner.visible = true;
    if (banner10) banner10.text = String(state.fs.remaining); // shows "10"


      // start off left
      const x0 = fsTractorOffLeftX();
      const x1 = fsTractorCenterX();
      const y = fsTractorY();

    fsTractorBobBaseY = y;


      fsTractor.x = x0;
      fsTractor.y = y;
      fsTractor.alpha = 1;

      tween(
        ms,
        (k) => {
          if (token !== fsTractorEnterToken) return;
          const t = Math.max(0, Math.min(1, k));
    const e = softstep(t, 0.12); // 👈 very mild easing
    fsTractor!.x = x0 + (x1 - x0) * e;
    fsTractor!.y = y; 
        }
      );
    }

    // Exit: center -> right (awaitable)
    function playFsTractorExit(ms = 520) {
      ensureFsTractor();
      if (!fsTractor) return Promise.resolve();

      fsTractorExitToken++;
      const token = fsTractorExitToken;

      const x0 = fsTractor.x;
      const x1 = fsTractorOffRightX();
      const y = fsTractorY();

      fsTractorBobBaseY = y;

      return new Promise<void>((resolve) => {
        tween(
          ms,
          (k) => {
            if (token !== fsTractorExitToken) return;
            const e = easeInCubic(Math.max(0, Math.min(1, k)));
            fsTractor!.x = x0 + (x1 - x0) * e;
            fsTractor!.y = y;
          },
          () => {
            if (token !== fsTractorExitToken) return resolve();
            fsTractorLayer.visible = false;
            clearTractorExhaustNow();

            const banner = (fsTractor as any)?._banner as Container | undefined;
    if (banner) banner.visible = false;


            resolve();
          }
        );
      });
    }
// ✅ PORTRAIT ONLY: force tractor + banner to fully leave the screen cleanly
function playFsTractorExitPortrait(ms = 620) {
  ensureFsTractor();
  if (!fsTractor) return Promise.resolve();

  fsTractorExitToken++;
  const token = fsTractorExitToken;

  // Make sure banner stays visible during exit
  const banner = (fsTractor as any)._banner as Container | undefined;
  if (banner) banner.visible = true;

  const W = app.screen.width;

  const x0 = fsTractor.x;
const tractorW = (fsTractor.width || 400);

// banner offset + width matter, because banner trails behind tractor
const offX = (fsTractor as any)._bannerOffX ?? -290;
const bannerW = banner ? (banner.getBounds().width || 0) : 0;

// ✅ exit target ensures BOTH tractor and trailing banner fully clear screen
const x1 =
  W +
  tractorW * 1.6 +
  Math.abs(offX) +
  bannerW * 1.2 +
  80; // extra safety pad

  const y0 = fsTractor.y;

  // lock bob base so bob system doesn’t fight the tween
  fsTractorBobBaseY = y0;

  return new Promise<void>((resolve) => {
    tween(
      ms,
      (k) => {
        if (token !== fsTractorExitToken) return;
        const t = Math.max(0, Math.min(1, k));
        const e = easeInCubic(t);

        // move fully offscreen
        fsTractor!.x = x0 + (x1 - x0) * e;
        fsTractor!.y = y0;

        // fade banner a touch at the end (feels cleaner)
        if (banner) banner.alpha = 1 - (e * e * 0.35);
      },
      () => {
        if (token !== fsTractorExitToken) return resolve();

        // hide everything
        fsTractorLayer.visible = false;
        clearTractorExhaustNow();

        if (banner) {
          banner.visible = false;
          banner.alpha = 1;
        }

        resolve();
      }
    );
  });
}

    // =====================
    // FS TRACTOR — VOXEL EXHAUST (same style as car, but on ROOT layer)
    // =====================
    const fsTractorExhaustLayer = new Container();
    fsTractorExhaustLayer.zIndex = 9450; // under tractor(9451), above fsDimmer(9400)
    fsTractorExhaustLayer.eventMode = "none";
    (root as any).addChild(fsTractorExhaustLayer);
    root.sortChildren();

    type TractorExhaustP = {
      g: Graphics;
      vx: number;
      vy: number;
      life: number;
      life0: number;
      s0: number;
    };

    const tractorExhaustPool: TractorExhaustP[] = [];
    const tractorExhaustLive: TractorExhaustP[] = [];
    let tractorExhaustAcc = 0;

    // tuning (match your car feel)
    const TRACTOR_EXHAUST_SPAWN_PER_SEC = 26; // 18..40
    const TRACTOR_EXHAUST_LIFE_MIN = 0.35;
    const TRACTOR_EXHAUST_LIFE_MAX = 2;
    const TRACTOR_EXHAUST_MIN_VOX = 6;
    const TRACTOR_EXHAUST_MAX_VOX = 10;
    const TRACTOR_EXHAUST_MAX_LIVE = 120;

    // where exhaust comes out relative to tractor
    const TRACTOR_EXHAUST_BACK_NX = 0.37; // negative = left side (back)
    const TRACTOR_EXHAUST_BACK_NY =  -.08; // positive = lower (toward wheels)

    function makeTractorExhaustPuff(): TractorExhaustP {
      const g = new Graphics();
      return { g, vx: 0, vy: 0, life: 0, life0: 0, s0: 1 };
    }

    function spawnTractorExhaustAt(x: number, y: number) {
      if (tractorExhaustLive.length >= TRACTOR_EXHAUST_MAX_LIVE) return;

      let p = tractorExhaustPool.pop();
      if (!p) p = makeTractorExhaustPuff();

      const g = p.g;
      g.clear();
      g.blendMode = "normal";

      const vox =
        (TRACTOR_EXHAUST_MIN_VOX +
          Math.random() * (TRACTOR_EXHAUST_MAX_VOX - TRACTOR_EXHAUST_MIN_VOX + 1)) | 0;

      const blocks = 3 + ((Math.random() * 6) | 0);

      const cols = [0x4a4a4a, 0x5a5a5a, 0x6a6a6a, 0x7a7a7a];

      for (let i = 0; i < blocks; i++) {
    const ox = ((-2 + Math.random() * 4) * vox) | 0;
    const oy = ((-2 + Math.random() * 4) * vox) | 0;

    g
      .rect(ox, oy, vox, vox)
      .fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });
  }

      // spawn position (with jitter)
      g.x = x + (-3 + Math.random() * 6);
      g.y = y + (-3 + Math.random() * 6);

      // velocity: drift backward (left) + up a bit
      p.vx = -(22 + Math.random() * 34);
      p.vy = -(28 + Math.random() * 44);

      // lifetime
      p.life0 =
        TRACTOR_EXHAUST_LIFE_MIN +
        Math.random() * (TRACTOR_EXHAUST_LIFE_MAX - TRACTOR_EXHAUST_LIFE_MIN);
      p.life = p.life0;

      // start style
      p.s0 = 0.65 + Math.random() * 0.65;
      g.scale.set(p.s0);
      g.alpha = 0.22 + Math.random() * 0.45;

      fsTractorExhaustLayer.addChild(g);
      tractorExhaustLive.push(p);
    }

    function tickTractorExhaust(dt: number) {
      const W = app.renderer.width;
      const H = app.renderer.height;

      for (let i = tractorExhaustLive.length - 1; i >= 0; i--) {
        const p = tractorExhaustLive[i];
        const g = p.g;

        // drift
        g.x += p.vx * dt;
        g.y += p.vy * dt;

        p.life -= dt;
        const k = Math.max(0, p.life / p.life0);

        // fade + expand slightly
        g.alpha = (0.35 * k) * (0.35 + 0.65 * k);
        const s = p.s0 * (1.0 + (1 - k) * 0.55);
        g.scale.set(s);

        const off =
          p.life <= 0 ||
          g.x < -260 || g.x > W + 260 ||
          g.y < -260 || g.y > H + 260;

        if (off) {
          g.removeFromParent();
          tractorExhaustLive.splice(i, 1);
          tractorExhaustPool.push(p);
        }
      }
    }

    function clearTractorExhaustNow() {
      for (let i = tractorExhaustLive.length - 1; i >= 0; i--) {
        const p = tractorExhaustLive[i];
        p.g.removeFromParent();
        tractorExhaustLive.splice(i, 1);
        tractorExhaustPool.push(p);
      }
      tractorExhaustAcc = 0;
    }

    // Emit + update every frame while tractor is visible
  addSystem((dt) => {
    dt = Math.min(0.05, dt);

    // always update existing particles
    tickTractorExhaust(dt);

    if (!state.overlay.fsIntro) return;
    if (!fsTractorLayer.visible) return;
    if (!fsTractor) return;

    const b = fsTractor.getBounds();
    const ex = b.x + b.width * (0.5 + TRACTOR_EXHAUST_BACK_NX);
    const ey = b.y + b.height * (0.5 + TRACTOR_EXHAUST_BACK_NY);

    tractorExhaustAcc += TRACTOR_EXHAUST_SPAWN_PER_SEC * dt;
    let n = Math.floor(tractorExhaustAcc);
    if (n > 0) tractorExhaustAcc -= n;

    n = Math.min(n, 6);

    for (let i = 0; i < n; i++) {
      spawnTractorExhaustAt(ex, ey);
    }
  });



    // =====================
    // FS TRACTOR BOB (like car: smooth suspension + gravel chatter)
    // =====================
    let fsTractorBobBaseY = 0;

    const FS_TRACTOR_BOB_ON = true;

    // tuning (keep subtle)
    const FS_TRACTOR_BOB1_AMP = 1.6;   // slow suspension bob (px)
    const FS_TRACTOR_BOB2_AMP = 0.9;   // fast chatter bob (px)
    const FS_TRACTOR_XJIT_AMP = 0.5;   // tiny lateral jitter (px) (optional)

    // speeds
    const FS_TRACTOR_BOB1_SPD = 0.006; // slow bob frequency
    const FS_TRACTOR_BOB2_SPD = 0.045; // chatter base frequency

    // Apply bob every frame while tractor is visible
    addSystem(() => {
    if (!FS_TRACTOR_BOB_ON) return;
    if (!fsTractorLayer.visible) return;
    if (!fsTractor) return;

    const now = performance.now();

    const bob1 = Math.sin(now * FS_TRACTOR_BOB1_SPD) * FS_TRACTOR_BOB1_AMP;

    const bob2 =
      (Math.sin(now * FS_TRACTOR_BOB2_SPD) * 0.40 +
      Math.sin(now * (FS_TRACTOR_BOB2_SPD * 1.62)) * 0.50 +
      Math.sin(now * (FS_TRACTOR_BOB2_SPD * 2.48)) * 0.40) * FS_TRACTOR_BOB2_AMP;

    const xjit = Math.sin(now * 0.091) * FS_TRACTOR_XJIT_AMP;

    fsTractor.y = Math.round(fsTractorBobBaseY + bob1 + bob2);
    fsTractor.x = Math.round(fsTractor.x + xjit * 0.25);
  });



    // Pause after feature background comes in, before showing reels/symbols
    const FS_BG_TO_CORE_PAUSE_MS = 300;



    // Full-screen dimmer (blocks clicks)
    const fsDimmer = new Graphics();
    fsDimmer.zIndex = 9400;            // above game (reels/grid), below menus if needed
    fsDimmer.visible = false;
    fsDimmer.alpha = 0;
    fsDimmer.eventMode = "static";     // ✅ blocks input
    fsDimmer.cursor = "default";
    root.addChild(fsDimmer);

    // =====================
    // FREE SPINS RETRIGGER POPUP (brief)
    // =====================
    const fsAddedDimmer = new Graphics();
    fsAddedDimmer.zIndex = 9410;        // above reels, below menus
    fsAddedDimmer.visible = false;
    fsAddedDimmer.alpha = 0;
    fsAddedDimmer.eventMode = "static"; // block input during popup
    fsAddedDimmer.cursor = "default";
    root.addChild(fsAddedDimmer);

    // --- FS retrigger popup texts (amount + label) ---
    const fsAddedAmountText = new Text({
      text: "",
      style: {
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffd36a,
        fontSize: 120,           // BIG +5
        fontWeight: "100",
        align: "center",
        dropShadow: true,
        dropShadowAlpha: 0.75,
        dropShadowBlur: 14,
        dropShadowDistance: 3,
      } as any,
    });
    fsAddedAmountText.anchor.set(0.5);
    fsAddedAmountText.skew.set(0, 0.39);
    fsAddedAmountText.scale.set(1, 1.15);
    fsAddedAmountText.zIndex = 9411;
    fsAddedAmountText.visible = false;
    fsAddedAmountText.alpha = 0;
    root.addChild(fsAddedAmountText);

    const fsAddedLabelText = new Text({
      text: applyUiTextCase(t("ui.freeSpins")),
      style: {
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffffff,
        fontSize: 40,           // smaller subtitle
        fontWeight: "100",
        align: "center",
        letterSpacing: 1.5,
        dropShadow: true,
        dropShadowAlpha: 0.65,
        dropShadowBlur: 10,
        dropShadowDistance: 3,
      } as any,
    });
    fsAddedLabelText.anchor.set(0.5);
    fsAddedLabelText.skew.set(0, 0.39);
    fsAddedLabelText.scale.set(1, 1.15);
    fsAddedLabelText.zIndex = 9411;
    fsAddedLabelText.visible = false;
    fsAddedLabelText.alpha = 0;
    root.addChild(fsAddedLabelText);


    // keep this near layoutFsDimmer()
function layoutFsAddedPopup() {
  const w = app.renderer.width;
  const h = app.renderer.height;

  fsAddedDimmer.clear();
  fsAddedDimmer.rect(0, 0, w, h).fill(0x000000);

  const centerY = h * 0.48;

  // 🔧 THIS IS YOUR GAP CONTROL (pixels)
 const GAP_PX =
  isMobilePortraitUILayout(__layoutDeps) ? 90 :
  isMobileLandscapeUILayout(__layoutDeps) ? 120 :
  150;

  fsAddedAmountText.position.set(
    Math.round(w * 0.5),
    Math.round(centerY - GAP_PX * 0.5)
  );

  fsAddedLabelText.position.set(
    Math.round(w * 0.5),
    Math.round(centerY + GAP_PX * 0.5)
  );
}





    // =====================
    // FREE SPINS OUTRO (TOTAL WIN) — NEW FULLSCREEN SPLASH + COINS
    // =====================



    const fsOutroLayer = new Container();
    fsOutroLayer.zIndex = 9460;
    fsOutroLayer.visible = false;
    fsOutroLayer.alpha = 0;
    fsOutroLayer.eventMode = "none"; // we keep clicking handled by fsDimmer (like you already do)
    root.addChild(fsOutroLayer);

    // --- Background image ---
    const fsOutroBg = new Sprite(Texture.WHITE); // placeholder
    fsOutroBg.anchor.set(0.5);
    fsOutroLayer.addChild(fsOutroBg);

    // =====================
    // FS OUTRO — SMOKE LAYER (on top of the outro BG)
    // =====================
    const fsOutroSmokeLayer = new Container();
    fsOutroSmokeLayer.zIndex = 0.6; // above bg (0), below texts (1+)
    fsOutroSmokeLayer.eventMode = "none";
    fsOutroLayer.addChild(fsOutroSmokeLayer);
    fsOutroLayer.sortableChildren = true;


    // =====================
    // FS OUTRO — VOXEL FIREFLIES (around the light)
    // =====================
    const fsOutroFireflyLayer = new Container();
    fsOutroFireflyLayer.zIndex = 0.5; // above bg(0), below texts(>1)
    fsOutroFireflyLayer.eventMode = "none";
    fsOutroLayer.addChild(fsOutroFireflyLayer);
    fsOutroLayer.sortableChildren = true;

    // ---- TUNING ----
    let FIREFLY_ON = true;

    // where the "light" is (normalized screen coords)
    let FIREFLY_CENTER_X_N = 0.19;  // tweak to match your lamp/light
    let FIREFLY_CENTER_Y_N = 0.65;

    const FIREFLY_SPAWN_PER_SEC = 10;     // 6..16
    const FIREFLY_MAX_LIVE = 60;          // 40..90
    const FIREFLY_LIFE_MIN = 1.3;         // seconds
    const FIREFLY_LIFE_MAX = 3.2;

    const FIREFLY_RADIUS_MIN = 25;        // px (spawn ring)
    const FIREFLY_RADIUS_MAX = 160;

    const FIREFLY_DRIFT = 14;             // px/sec random drift
    const FIREFLY_ORBIT_PULL = 26;        // px/sec pulls toward center softly
    const FIREFLY_RISE = -6;              // subtle upward bias

    const FIREFLY_VOX_MIN = 2;            // voxel size
    const FIREFLY_VOX_MAX = 4;

    const FIREFLY_ALPHA_MIN = 0.08;       // twinkle base
    const FIREFLY_ALPHA_MAX = 0.95;       // twinkle peak

    type Firefly = {
      g: Graphics;
      vx: number;
      vy: number;
      life: number;
      life0: number;
      tw: number;
      twSpeed: number;
      baseA: number;
      vox: number;
    };

    const fireflyPool: Firefly[] = [];
    const fireflyLive: Firefly[] = [];
    let fireflyAcc = 0;
    let fireflyTickerAdded = false;

    function makeFireflyG(vox: number): Graphics {
      const g = new Graphics();
      // little voxel cluster (like a tiny glowing bug)
      // (use warm whites + gold)
      const cols = [0xffffff, 0xfff2b3, 0xffd36a];

      const blocks = 2 + ((Math.random() * 3) | 0); // 2..4
    for (let i = 0; i < blocks; i++) {
    const ox = ((-1 + Math.random() * 2) * vox * 1.1) | 0;
    const oy = ((-1 + Math.random() * 2) * vox * 1.1) | 0;

    g
      .rect(ox, oy, vox, vox)
      .fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });
  }


      g.roundPixels = true;
      return g;
    }

    function getFsOutroLightPos() {
      const W = app.renderer.width;
      const H = app.renderer.height;
      return {
        x: W * FIREFLY_CENTER_X_N,
        y: H * FIREFLY_CENTER_Y_N,
      };
    }

    function spawnFirefly() {
      if (!FIREFLY_ON) return;
      if (fireflyLive.length >= FIREFLY_MAX_LIVE) return;

      let p = fireflyPool.pop();

      const vox = (FIREFLY_VOX_MIN + Math.random() * (FIREFLY_VOX_MAX - FIREFLY_VOX_MIN)) | 0;

      if (!p) {
        const g = makeFireflyG(vox);
        p = {
          g,
          vx: 0,
          vy: 0,
          life: 0,
          life0: 0,
          tw: 0,
          twSpeed: 0,
          baseA: 0,
          vox,
        };
      } else {
        // re-skin occasionally by rebuilding (cheap enough)
        p.g.clear();
        const cols = [0xffffff, 0xfff2b3, 0xffd36a];
        const blocks = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < blocks; i++) {
    const ox = ((-1 + Math.random() * 2) * vox * 1.1) | 0;
    const oy = ((-1 + Math.random() * 2) * vox * 1.1) | 0;

    p.g
      .rect(ox, oy, vox, vox)
      .fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });
  }

        p.g.roundPixels = true;
        p.vox = vox;
      }

      const g = p.g;
      const c = getFsOutroLightPos();

      // spawn in a ring-ish area around the light
      const ang = Math.random() * Math.PI * 2;
      const r = FIREFLY_RADIUS_MIN + Math.random() * (FIREFLY_RADIUS_MAX - FIREFLY_RADIUS_MIN);
      g.x = c.x + Math.cos(ang) * r + (-8 + Math.random() * 16);
      g.y = c.y + Math.sin(ang) * r + (-8 + Math.random() * 16);

      // gentle random velocity
      p.vx = (-1 + Math.random() * 2) * FIREFLY_DRIFT;
      p.vy = (-1 + Math.random() * 2) * FIREFLY_DRIFT + FIREFLY_RISE;

      // life
      p.life0 = FIREFLY_LIFE_MIN + Math.random() * (FIREFLY_LIFE_MAX - FIREFLY_LIFE_MIN);
      p.life = p.life0;

      // twinkle
      p.tw = Math.random() * Math.PI * 2;
      p.twSpeed = 2.0 + Math.random() * 4.0; // 2..6
      p.baseA = 0.15 + Math.random() * 0.20;

      g.alpha = 0;
      g.scale.set(1);

      fsOutroFireflyLayer.addChild(g);
      fireflyLive.push(p);
    }

    function clearFirefliesNow() {
      for (let i = fireflyLive.length - 1; i >= 0; i--) {
        const p = fireflyLive[i];
        p.g.removeFromParent();
        fireflyLive.splice(i, 1);
        fireflyPool.push(p);
      }
      fireflyAcc = 0;
    }

    function tickFireflies() {
      if (!state.overlay.fsOutro) return;
      if (!FIREFLY_ON) return;

      const dt = Math.min(0.05, app.ticker.deltaMS / 1000);

      // spawn
      fireflyAcc += FIREFLY_SPAWN_PER_SEC * dt;
      let n = Math.floor(fireflyAcc);
      if (n > 0) fireflyAcc -= n;
      n = Math.min(n, 5); // clamp on hitch

      for (let i = 0; i < n; i++) spawnFirefly();

      // update
      const c = getFsOutroLightPos();

      for (let i = fireflyLive.length - 1; i >= 0; i--) {
        const p = fireflyLive[i];
        const g = p.g;

        // soft pull toward the light (creates orbity behaviour)
        const dx = c.x - g.x;
        const dy = c.y - g.y;
        const d = Math.hypot(dx, dy) || 1;

        // pull strength fades with distance (gentle)
        const pull = (FIREFLY_ORBIT_PULL / Math.max(60, d));
        p.vx += (dx / d) * pull;
        p.vy += (dy / d) * pull;

        // slight wobble
        const wob = Math.sin((g.x + i * 17) * 0.02 + p.tw) * 6;
        g.x += (p.vx + wob) * dt;
        g.y += (p.vy) * dt;

        // twinkle
        p.tw += p.twSpeed * dt;
        const tw01 = 0.5 + 0.5 * Math.sin(p.tw);
        const a = FIREFLY_ALPHA_MIN + (FIREFLY_ALPHA_MAX - FIREFLY_ALPHA_MIN) * (tw01 * tw01);
        g.alpha = Math.min(1, p.baseA + a);

        // tiny size pulse with twinkle
        const s = 0.95 + tw01 * 0.20;
        g.scale.set(s);

        // life fade in/out
        p.life -= dt;
        const t01 = 1 - (p.life / p.life0);
        const fadeIn = Math.min(1, t01 / 0.18);
        const fadeOut = Math.min(1, Math.max(0, (t01 - 0.72) / 0.28));
        g.alpha *= fadeIn * (1 - fadeOut);

        if (p.life <= 0) {
          g.removeFromParent();
          fireflyLive.splice(i, 1);
          fireflyPool.push(p);
        }
      }
    }

    function startFireflies() {
      if (fireflyTickerAdded) return;
      fireflyTickerAdded = true;
      addSystem(() => tickFireflies());
    }
    startFireflies();


    // --- Text: TOTAL WIN (white) ---
    const fsOutroTotalLabel = new Text({
      text: t("ui.totalWin"),
      style: {
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffffff,
        fontSize: 110,
        fontWeight: "100",
        align: "center",

      stroke: { color: 0x000000, width: 12 },


        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowAlpha: 0.6,
        dropShadowBlur: 0,
        dropShadowDistance: 12,
        dropShadowAngle: -Math.PI / 4,
      } as any,
    });
    fsOutroTotalLabel.anchor.set(0.5);
    fsOutroTotalLabel.skew.set(0, 0);
    fsOutroLayer.addChild(fsOutroTotalLabel);

    // --- Text: amount (gold) ---
    const fsOutroWinAmount = new Text({
      text: "0.00",
      style: {
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffd36a,
        fontSize: 150,
        fontWeight: "100",
        align: "center",

    stroke: { color: 0x000000, width: 12 },


        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowAlpha: 0.6,
        dropShadowBlur: 0,
        dropShadowDistance: 14,
        dropShadowAngle: -Math.PI / 4,
      } as any,
    });



    fsOutroWinAmount.anchor.set(0.5);
    fsOutroWinAmount.skew.set(0, 0);
    fsOutroLayer.addChild(fsOutroWinAmount);

    // Optional: small continue prompt (keep if you want)
    // If you truly want ONLY "TOTAL WIN + amount", set FS_OUTRO_SHOW_CONTINUE = false.
    const FS_OUTRO_SHOW_CONTINUE = true;

    const fsOutroContinue = new Text({ text: t("ui.clickToContinue"), style: {} as any });
    applyClickToContinueStyle(fsOutroContinue);
    (fsOutroContinue.style as any).dropShadowAngle = -Math.PI / 4;
    fsOutroContinue.anchor.set(0.5);
    fsOutroContinue.visible = FS_OUTRO_SHOW_CONTINUE;
    fsOutroContinue.alpha = 1;
    fsOutroContinue.zIndex = 1;
    fsOutroLayer.addChild(fsOutroContinue);

    // keep the text itself clickable too (routes to fsDimmer tap like your current setup)
    fsOutroContinue.eventMode = "static";
    fsOutroContinue.cursor = "pointer";
    fsOutroContinue.hitArea = new Rectangle(-340, -60, 680, 120);
    fsOutroContinue.on("pointertap", (e: any) => {
      e.stopPropagation?.();
      fsDimmer.emit("pointertap", {} as any);
    });

    function computeFsOutroPortraitScale(finalAmount: number) {
  if (!isMobilePortraitUILayout(__layoutDeps)) return 1;

  const W = app.screen.width;

  // padding from the edges
  const PAD = Math.round(W * 0.10); // tweak 0.07..0.14
  const maxW = Math.max(1, W - PAD * 2);

  // reset scales so bounds measure correctly
  fsOutroTotalLabel.scale.set(1, 1);
  fsOutroWinAmount.scale.set(1, 1);

  // temporarily set widest text to measure FINAL width
  const oldAmt = fsOutroWinAmount.text;
  fsOutroWinAmount.text = fmtMoney(finalAmount);

  const widest = Math.max(
    fsOutroTotalLabel.getBounds().width,
    fsOutroWinAmount.getBounds().width
  );

  // restore
  fsOutroWinAmount.text = oldAmt;

if (widest <= maxW) return 1;

  const s = maxW / widest;
 return Math.max(0.58, Math.min(1, s));// clamp so it doesn’t get microscopic
}

function clampFsOutroScaleToScreen(proposedScale: number) {
  // Only needed on mobile portrait
  if (!isMobilePortraitUILayout(__layoutDeps)) return proposedScale;

  const W = app.screen.width;

  // Same edge padding idea as computeFsOutroPortraitScale
  const PAD = Math.round(W * 0.10);
  const maxW = Math.max(1, W - PAD * 2);

  // Try the proposed scale
  fsOutroTotalLabel.scale.set(proposedScale, proposedScale);
  fsOutroWinAmount.scale.set(proposedScale, proposedScale);

  const widest = Math.max(
    fsOutroTotalLabel.getBounds().width,
    fsOutroWinAmount.getBounds().width
  );

  // If it fits, we're done
  if (widest <= maxW) return proposedScale;

  // Otherwise shrink just enough to fit
  const fitMul = maxW / Math.max(1, widest);
  const s = proposedScale * fitMul;

  // Keep your same “don’t go microscopic” floor
  return Math.max(0.58, s);
}
// =====================
// ✅ FS OUTRO — MOBILE LANDSCAPE AUTO-FIT
// =====================
const FS_OUTRO_LAND_BASE_SCALE = 0.62;     // 🔧 overall smaller in mobile landscape (0.50..0.75)
const FS_OUTRO_LAND_MIN_SCALE  = 0.45;     // 🔧 floor (don’t go microscopic)
const FS_OUTRO_LAND_PAD_N      = 0.10;     // 🔧 side padding as % of screen width (0.06..0.14)




function computeFsOutroLandscapeScale(): number {
  if (!isMobileLandscapeUILayout(__layoutDeps)) return 1;

  const W = app.screen.width;
  const PAD = Math.round(W * FS_OUTRO_LAND_PAD_N);
  const maxW = Math.max(1, W - PAD * 2);

  // measure at base scale
  fsOutroTotalLabel.scale.set(FS_OUTRO_LAND_BASE_SCALE);
  fsOutroWinAmount.scale.set(FS_OUTRO_LAND_BASE_SCALE);

  const widest = Math.max(
    fsOutroTotalLabel.getBounds().width,
    fsOutroWinAmount.getBounds().width
  );

  if (widest <= maxW) return FS_OUTRO_LAND_BASE_SCALE;

  const fit = maxW / Math.max(1, widest);
  const s = FS_OUTRO_LAND_BASE_SCALE * fit;

  return Math.max(FS_OUTRO_LAND_MIN_SCALE, Math.min(FS_OUTRO_LAND_BASE_SCALE, s));
}

function applyFsOutroLandscapeFit() {
  if (!isMobileLandscapeUILayout(__layoutDeps)) return;

  const s = computeFsOutroLandscapeScale();
  fsOutroTotalLabel.scale.set(s, s);
  fsOutroWinAmount.scale.set(s, s);


}
// =====================
// ✅ FS OUTRO — MOBILE PORTRAIT FIT (shared scale for label/amount/continue)
// =====================
function applyFsOutroPortraitFit(finalAmountForMeasure?: number) {
  if (!isMobilePortraitUILayout(__layoutDeps)) return;

  const W = app.screen.width;

  // Side padding so nothing kisses the edges
  const PAD = Math.round(W * 0.10); // 🔧 0.07..0.14
  const maxW = Math.max(1, W - PAD * 2);

  // Base "locked" scale computed from final amount (your existing mechanism)
  const base = fsOutroPortraitScaleLocked ? fsOutroPortraitScale : 1;

  // Start from base on ALL texts (keeps them relatively consistent)
  fsOutroTotalLabel.scale.set(base, base);
  fsOutroWinAmount.scale.set(base, base);
// leave continue alone here (we'll size it after fitting)

  // Measure worst-case width at this scale
  const oldAmt = fsOutroWinAmount.text;
  const measureAmt =
    (typeof finalAmountForMeasure === "number")
      ? fmtMoney(finalAmountForMeasure)
      : oldAmt;

  fsOutroWinAmount.text = measureAmt;

const widest = Math.max(
  fsOutroTotalLabel.getBounds().width,
  fsOutroWinAmount.getBounds().width
);

  // Restore text
  fsOutroWinAmount.text = oldAmt;

  if (widest <= maxW) return;

  // Shrink all together so they match scale + fit width
  const fitMul = maxW / Math.max(1, widest);
  const s = Math.max(0.58, base * fitMul); // floor so it doesn’t go microscopic

fsOutroTotalLabel.scale.set(s, s);
fsOutroWinAmount.scale.set(s, s);

// ✅ portrait-only: continue larger without affecting label/amount
const CONT_MUL = 1.7;                 // 🔧 try 1.5..2.0
const contS = Math.min(1, s * CONT_MUL);
fsOutroContinue.scale.set(contS, contS);
}


// =====================
// FS OUTRO — GAP TUNING
// =====================
const FS_OUTRO_LABEL_Y_DESKTOP = 0.39;
// =====================
// ✅ FS OUTRO — TINY VIEW SCALE (pop-out S)
// =====================
const FS_OUTRO_TINY_BASE_SCALE = 0.42; // 🔧 try 0.34..0.55
const FS_OUTRO_TINY_MIN_SCALE  = 0.30; // 🔧 safety floor
const FS_OUTRO_TINY_PAD_N      = 0.08; // 🔧 side padding as % of W

const FS_OUTRO_AMOUNT_Y_DESKTOP = 0.59;

// ✅ MOBILE LANDSCAPE: bigger gap
const FS_OUTRO_LABEL_Y_LAND = 0.38;   // smaller = higher
const FS_OUTRO_AMOUNT_Y_LAND = 0.70;  // bigger = lower

function normalizeFsOutroTextScalesForCurrentLayout() {
  const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
  const isPortrait = isMobilePortraitUILayout(__layoutDeps);
  const isLand = isMobileLandscapeUILayout(__layoutDeps);

  // Desktop / tablet / anything that's NOT tiny/portrait/landscape-phone:
  // ✅ hard reset all text scales so they can't inherit old tiny values
  if (!IS_TINY_VIEW && !isPortrait && !isLand) {
    fsOutroTotalLabel.scale.set(1, 1);
    fsOutroWinAmount.scale.set(1, 1);
    fsOutroContinue.scale.set(1, 1);
    return;
  }

  // Tiny view: apply the locked (or base) scale to ALL 3
  if (IS_TINY_VIEW) {
    const s = fsOutroTinyScaleLocked ? fsOutroTinyScale : 0.42;
    fsOutroTotalLabel.scale.set(s, s);
    fsOutroWinAmount.scale.set(s, s);
    fsOutroContinue.scale.set(s, s);
    return;
  }

  // Mobile landscape: fit label+amount, and ensure continue isn't stuck tiny
  if (isLand) {
    applyFsOutroLandscapeFit();
    fsOutroContinue.scale.set(1, 1); // ✅ ensure it doesn't inherit tiny
    return;
  }

  // Mobile portrait: your portrait fit sets label/amount and also sizes continue
  if (isPortrait) {
    applyFsOutroPortraitFit(fsOutroFinalAmount);
    return;
  }
}

    function layoutFsOutro() {
      const W = app.screen.width;
      const H = app.screen.height;
  // ✅ NEW: prevents inherited scales when switching layouts
  normalizeFsOutroTextScalesForCurrentLayout();
      // scale bg to cover
      fsOutroBg.x = Math.round(W * 0.5);
      fsOutroBg.y = Math.round(H * 0.5);
      const tw = fsOutroBg.texture.width || 1;
      const th = fsOutroBg.texture.height || 1;
      const s = Math.max(W / tw, H / th);
      fsOutroBg.scale.set(s);

      // layout text (match your screenshot vibe)
const isLand = isMobileLandscapeUILayout(__layoutDeps);

const labelYFrac  = isLand ? FS_OUTRO_LABEL_Y_LAND  : FS_OUTRO_LABEL_Y_DESKTOP;
const amountYFrac = isLand ? FS_OUTRO_AMOUNT_Y_LAND : FS_OUTRO_AMOUNT_Y_DESKTOP;

// --- ANCHORED STACK: label always above amount ---


const cx = Math.round(W * 0.5);
const cy = Math.round(H * 0.5);

// 🔧 GAP between label and amount
const GAP_PX =
  isMobilePortraitUILayout(__layoutDeps) ? 0 :
  isMobileLandscapeUILayout(__layoutDeps) ? 0:
  -20;
const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;

if (IS_TINY_VIEW) {
  const s = fsOutroTinyScaleLocked ? fsOutroTinyScale : 0.42;

  // ✅ hard-apply locked scale (no dynamic refit mid-count)
  fsOutroTotalLabel.scale.set(s, s);
  fsOutroWinAmount.scale.set(s, s);
  fsOutroContinue.scale.set(s, s);
} else {
  // existing behavior untouched
  applyFsOutroLandscapeFit();
  applyFsOutroPortraitFit(fsOutroFinalAmount);
}



// measure heights AFTER scale is applied
const labelH = fsOutroTotalLabel.getBounds().height;
const amtH   = fsOutroWinAmount.getBounds().height;

// total stack height
const stackH = labelH + GAP_PX + amtH;

// center the whole stack on screen
const topY = Math.round(cy - stackH * 0.5);

// place label + amount centered
fsOutroTotalLabel.position.set(cx, Math.round(topY + labelH * 0.5));
fsOutroWinAmount.position.set(cx, Math.round(topY + labelH + GAP_PX + amtH * 0.5));




      // continue at bottom
      fsOutroContinue.position.set(Math.round(W * 0.5), Math.round(H * 0.92));


    }

window.addEventListener("resize", () => {
    // cancel any pulse using stale base scales
  fsOutroPulseToken++;
  // 🔥 Clear ALL scale locks on layout change
  fsOutroPortraitScaleLocked = false;
  fsOutroTinyScaleLocked = false;

  fsOutroPortraitScale = 1;
  fsOutroTinyScale = 1;

  layoutFsOutro();
});


    // =====================
    // FS OUTRO COUNT-UP
    // =====================
    let fsOutroTickToken = 0;
    let fsOutroCountDone = true;
    let fsOutroFinalAmount = 0;
    let fsOutroPortraitScale = 1;
let fsOutroPortraitScaleLocked = false;
let fsOutroTinyScale = 1;
let fsOutroTinyScaleLocked = false;

    let fsOutroBurstDone = false;
    let fsOutroPulseToken = 0;

function startFsOutroIdlePulse() {
  fsOutroPulseToken++;
  const token = fsOutroPulseToken;

const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
const isPortrait = isMobilePortraitUILayout(__layoutDeps);
const isLand = isMobileLandscapeUILayout(__layoutDeps);

let base: number;

if (IS_TINY_VIEW) {
  base = fsOutroTinyScaleLocked ? fsOutroTinyScale : 0.42;
}
else if (isLand) {
  base = computeFsOutroLandscapeScale();
}
else if (isPortrait) {
  base = fsOutroPortraitScaleLocked ? fsOutroPortraitScale : 1;
}
else {
  // ✅ DESKTOP ALWAYS HARD RESET
  base = 1;
}



// keep label matched in landscape too (but DON'T touch continue here)
if (IS_TINY_VIEW || isMobileLandscapeUILayout(__layoutDeps)) {
  fsOutroTotalLabel.scale.set(base, base);
  fsOutroWinAmount.scale.set(base, base);
  // fsOutroContinue scale is handled by layout/apply fit so it doesn't snap at finish
}

  const portrait = isMobilePortraitUILayout(__layoutDeps);
  const isLandscapeMobile = isMobileLandscapeUILayout(__layoutDeps);

  // Portrait: pulse vertically only. Non-portrait: uniform (clamped).
  const upX = portrait ? base : clampFsOutroScaleToScreen(base * 1.08);
  const upY = portrait ? base * 1.4 : upX;

  const UP_MS = 260;
  const DOWN_MS = 320;
  const PAUSE_MS = 220;

  async function loop() {
    while (token === fsOutroPulseToken && state.overlay.fsOutro) {
      await animateMs(UP_MS, (t) => {
        if (token !== fsOutroPulseToken) return;
        const e = easeOutCubic(t);
        const sx = base + (upX - base) * e;
        const sy = base + (upY - base) * e;
        fsOutroWinAmount.scale.set(sx, sy);
      });

      await animateMs(DOWN_MS, (t) => {
        if (token !== fsOutroPulseToken) return;
        const e = t * t * (3 - 2 * t);
        const sx = upX + (base - upX) * e;
        const sy = upY + (base - upY) * e;
        fsOutroWinAmount.scale.set(sx, sy);
      });

      fsOutroWinAmount.scale.set(base, base);
      await waitMs(PAUSE_MS);
    }

    fsOutroWinAmount.scale.set(base, base);
  }

  void loop();
}



function pulseBigWinAmount() {
  const base =
    (isMobilePortraitUILayout(__layoutDeps) && bigWinPortraitScaleLocked)
      ? bigWinPortraitScale
      : (bigWinAmount.scale.x || 1);

  // ✅ Vertical-only pulse: width stays constant, so digits won't affect it
  const peakX = base;
  const peakY = base * 1.7; // 🔧 try 1.06..1.14

  bigWinAmount.scale.set(base, base);

  tween(
    140,
    (k) => {
      const e = easeOutBack(k, 1.05);
      const sx = base + (peakX - base) * e;
      const sy = base + (peakY - base) * e;
      bigWinAmount.scale.set(sx, sy);
    },
    () => {
      tween(220, (k2) => {
        const e2 = k2 * k2 * (3 - 2 * k2);
        const sx = peakX + (base - peakX) * e2;
        const sy = peakY + (base - peakY) * e2;
        bigWinAmount.scale.set(sx, sy);
      });
    }
  );
}


function pulseFsOutroAmount() {
const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
const isPortrait = isMobilePortraitUILayout(__layoutDeps);
const isLand = isMobileLandscapeUILayout(__layoutDeps);

let base: number;

if (IS_TINY_VIEW) {
  base = fsOutroTinyScaleLocked ? fsOutroTinyScale : 0.42;
}
else if (isLand) {
  base = computeFsOutroLandscapeScale();
}
else if (isPortrait) {
  base = fsOutroPortraitScaleLocked ? fsOutroPortraitScale : 1;
}
else {
  // ✅ DESKTOP ALWAYS HARD RESET
  base = 1;
}




  // Portrait: pulse vertically only (keeps width inside bounds)
  const portrait = isMobilePortraitUILayout(__layoutDeps);

  const peakX = base;
  const peakY = portrait ? base * 1.7 : clampFsOutroScaleToScreen(base * 1.06);

  fsOutroWinAmount.scale.set(base, base);

  tween(
    140,
    (k) => {
      const e = easeOutBack(k, 1.05);
      const sx = base + (peakX - base) * e;
      const sy = base + (peakY - base) * e;
      fsOutroWinAmount.scale.set(sx, sy);
    },
    () => {
      tween(220, (k2) => {
        const e2 = k2 * k2 * (3 - 2 * k2); // smoothstep
        const sx = peakX + (base - peakX) * e2;
        const sy = peakY + (base - peakY) * e2;
        fsOutroWinAmount.scale.set(sx, sy);
      });
    }
  );
}





  function fireFsOutroFinishFX() {
  if (fsOutroBurstDone) return;
  fsOutroBurstDone = true;

  // 💰 coins (existing)
  setTimeout(() => {
    burstCoins(1.7, 1.9);
  }, 60);

  // 🌈 FS OUTRO ONLY: short voxel confetti burst
  setTimeout(() => {
    startMaxConfetti(0.9);
    setTimeout(() => stopMaxConfetti(true), 900); // FS-only burst
  }, 80);

  // ✨ number pulse
  pulseFsOutroAmount();
}






   function finishFsOutroCountUp() {
  fsOutroTickToken++; // cancel RAF
  audio?.stopTickLoop?.(80);

  fsOutroWinAmount.text = fmtMoney(fsOutroFinalAmount);
  fsOutroCountDone = true;

// ✅ LANDSCAPE: lock fitted scale at the final snap (prevents “jump big”)
if (isMobileLandscapeUILayout(__layoutDeps)) {
  applyFsOutroLandscapeFit();
  layoutFsOutro();
}
  // ✅ restore music immediately when we hit the final amount (even on skip)
  restoreMusicAfterFsOutro(350);

  // ✅ play finish hit on skip-to-final too
  audio?.playSfx?.("final_fsoutro_amount", 1.15);

  fireFsOutroFinishFX();

  startFsOutroIdlePulse();
}





    function startFsOutroCountUp(
      targetAmount: number,
      durationMs = 1400
    ) {
    // ✅ max progress change PER SECOND (not per frame)
    // 0.12 means it can move 12% of the bar per second max.
    const MAX_STEP_PER_SEC = 0.3;


      fsOutroTickToken++;
      const token = fsOutroTickToken;

      fsOutroFinalAmount = targetAmount;
    fsOutroCountDone = false;
    fsOutroBurstDone = false;
    // ✅ TICK LOOP: start quiet + slow, then ramp during the count
audio?.startTickLoop?.(120, 0.38, 1.0);




      const start = performance.now();
      const from = 0;
    let lastNow = start;

      let lastE = 0;

    function tick(now: number) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;

      if (token !== fsOutroTickToken) return;

      const rawT = (now - start) / durationMs;

      // =====================
      // TIME → SPEED, NOT FINISH
      // =====================
      const t = Math.min(1, rawT);

      const SPLIT = 0.75;
      const END_SLOW_POW = 14;

      let targetE: number;

      if (t <= SPLIT) {
        const u = t / SPLIT;
        targetE = 0.78 * (1 - Math.pow(1 - u, 3));
      } else {
        const u = Math.min(1, (t - SPLIT) / (1 - SPLIT));
        targetE = 0.78 + (1 - 0.78) * (1 - Math.pow(1 - u, END_SLOW_POW));
      }

      // =====================
      // HARD ANTI-SNAP CLAMP
      // =====================
      const delta = targetE - lastE;
    const maxStep = MAX_STEP_PER_SEC * dt;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
    const e = Math.min(1, lastE + step);
    lastE = e;


      const v = from + (targetAmount - from) * e;
fsOutroWinAmount.text = fmtMoney(v);

// ✅ keep FS outro text fitting during count-up
const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;

if (IS_TINY_VIEW) {
  // ✅ keep locked tiny scale while ticking (no snap)
  const s = fsOutroTinyScaleLocked ? fsOutroTinyScale : 0.42;
  fsOutroTotalLabel.scale.set(s, s);
  fsOutroWinAmount.scale.set(s, s);
  fsOutroContinue.scale.set(s, s);

  layoutFsOutro();
} else if (isMobileLandscapeUILayout(__layoutDeps)) {
  applyFsOutroLandscapeFit();
  layoutFsOutro(); // re-stack after scale change
} else if (isMobilePortraitUILayout(__layoutDeps)) {
  applyFsOutroPortraitFit(fsOutroFinalAmount);
  layoutFsOutro(); // keeps the vertical stack correct
}




      // ✅ TICK LOOP ramp (FS OUTRO): rate + volume rise as we approach the end
// progress 0..1
const p = Math.max(0, Math.min(1, e));

const rate = 0.98 + 0.50 * Math.pow(p, 1.4);
const loudnessComp = 1.0 + 0.20 * (rate - 1.0);
const vol = (0.22 + 0.40 * Math.pow(p, 1.2)) * loudnessComp;

audio?.setTickParams?.(vol, rate);


      // =====================
      // FINISH ONLY WHEN VISUALLY DONE
      // =====================
    if (Math.abs(targetAmount - v) > 0.01) { // 1 cent

        requestAnimationFrame(tick);
      } else {
  audio?.stopTickLoop?.(120);

  fsOutroWinAmount.text = fmtMoney(targetAmount);
  fsOutroCountDone = true;
if ((!!(__layoutDeps as any)?.IS_TINY_VIEW)) {
  const s = fsOutroTinyScaleLocked ? fsOutroTinyScale : 0.42;
  fsOutroTotalLabel.scale.set(s, s);
  fsOutroWinAmount.scale.set(s, s);
  fsOutroContinue.scale.set(s, s);
  layoutFsOutro();
}

  restoreMusicAfterFsOutro(350);

  // ✅ play finish hit ONLY when we actually reach the final number
  audio?.playSfx?.("final_fsoutro_amount", 1.15);

  fireFsOutroFinishFX();

  setTimeout(() => {
    if (state.overlay.fsOutro) startFsOutroIdlePulse();
  }, 420);
  // ✅ LANDSCAPE: lock fitted scale at the final snap (prevents “jump big”)
if (isMobileLandscapeUILayout(__layoutDeps)) {
  applyFsOutroLandscapeFit();
  layoutFsOutro();
}

}

    }



      // start at zero visually
      fsOutroWinAmount.text = fmtMoney(0);

      requestAnimationFrame(tick);
    }

function showFsOutroP(on: boolean, totalWin: number, ms = 420) {
  return new Promise<void>((resolve) => {
    // wrap your existing showFsOutro
    showFsOutro(on, totalWin, ms);

    // Only need to wait when hiding
    if (on) return resolve();

    // resolve after the hide tween should be complete
    setTimeout(resolve, ms + 30);
  });
}


function computeFsOutroTinyScale(finalAmount: number): number {
  const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
  if (!IS_TINY_VIEW) return 1;

  const W = app.screen.width;

  // 🔧 tune
  const PAD_N = 0.08;
  const BASE  = 0.42;
  const MIN_S = 0.30;

  const PAD = Math.round(W * PAD_N);
  const maxW = Math.max(1, W - PAD * 2);

  // measure at BASE using FINAL amount (widest)
  const oldAmt = fsOutroWinAmount.text;

  fsOutroTotalLabel.scale.set(BASE, BASE);
  fsOutroWinAmount.scale.set(BASE, BASE);
  fsOutroContinue.scale.set(BASE, BASE);

  fsOutroWinAmount.text = fmtMoney(finalAmount);

  const widest = Math.max(
    fsOutroTotalLabel.getBounds().width,
    fsOutroWinAmount.getBounds().width,
    fsOutroContinue.getBounds().width
  );

  fsOutroWinAmount.text = oldAmt;

  if (widest <= maxW) return BASE;

  const fit = maxW / Math.max(1, widest);
  return Math.max(MIN_S, Math.min(BASE, BASE * fit));
}

    function showFsOutro(on: boolean, totalWin: number, ms = 420) {
      // ✅ FORCE the outro bg texture FIRST (so layout uses correct dimensions)
      const t = Assets.get(FS_OUTRO_BG_URL) as Texture | undefined;
      if (t) fsOutroBg.texture = t;
      fsOutroBg.visible = true;

      // ✅ NOW scale-to-cover using the real texture
      layoutFsOutro();

      // (optional but recommended)
      root.sortChildren();



      if (on) {
        
        state.overlay.fsOutro = true;
 

        // ✅ lock portrait scale ONCE using the final amount (prevents snapping during count-up)
fsOutroPortraitScaleLocked = false;
fsOutroPortraitScale = computeFsOutroPortraitScale(totalWin);

// ✅ MOBILE PORTRAIT ONLY: force a smaller base scale
if (isMobilePortraitUILayout(__layoutDeps)) {
  fsOutroPortraitScale *= 0.5; // 🔧 0.78 = 22% smaller. Try 0.72 for more.
}

fsOutroPortraitScaleLocked = true;
layoutFsOutro();
// ✅ Tiny view: lock a single scale based on FINAL amount (prevents snap at the end)
fsOutroTinyScaleLocked = false;
fsOutroTinyScale = computeFsOutroTinyScale(totalWin);
fsOutroTinyScaleLocked = true;

        // ✅ start fireflies (fresh)
    clearFirefliesNow();
    FIREFLY_ON = true;


        // lock input: only dimmer click
        state.ui.auto = false;
        gameCore.alpha = 0;
        (gameCore as any).eventMode = "none";

        layoutFsDimmer();
        fsDimmer.visible = true;
        fsDimmer.eventMode = "static";



      
    // ✅ tick up the TOTAL WIN amount
    startFsOutroCountUp(totalWin, 1000);

        // show layer
        fsOutroLayer.visible = true;
        fsOutroLayer.alpha = 0;

        // ✅ COIN SHOWER during FS outro
        // intensity is your choice; 1.4–2.0 feels good
        startCoinShower(1.6);

        // blur + dim in (same feel as your current overlays)
        const startA = fsDimmer.alpha;
        const startB = bgBlur.strength;

        tween(ms, (k) => {
          const e = Math.max(0, Math.min(1, k));
          fsDimmer.alpha = startA + (0.55 - startA) * e;
          bgBlur.strength    = startB + (6 - startB) * e;

          fsOutroLayer.alpha = e;
        });

      } else {
        // ✅ reset portrait fit scaling
fsOutroTinyScaleLocked = false;
fsOutroTinyScale = 1;
        const startA = fsDimmer.alpha;
        const startB = bgBlur.strength;
        const startL = fsOutroLayer.alpha;

        tween(
          ms,
          (k) => {
            const e = Math.max(0, Math.min(1, k));
            fsDimmer.alpha = startA * (1 - e);
            bgBlur.strength = startB * (1 - e);

            fsOutroLayer.alpha = startL * (1 - e);
          },
          () => {
            fsDimmer.alpha = 0;
            bgBlur.strength = 0;
            fsDimmer.visible = false;
            fsDimmer.eventMode = "none";

            fsOutroLayer.alpha = 0;
            fsOutroLayer.visible = false;

            // ✅ stop coins (drain true lets them fall away nicely)
            stopCoinShower(true);
            stopMaxConfetti(true);
    // ✅ stop any running FS outro count-up
    fsOutroTickToken++; // stop any running RAF
    fsOutroCountDone = true;
    audio?.stopTickLoop?.(0); // ✅ hard kill tick loop if outro is closing



            state.overlay.fsOutro = false;
            layoutStudioTag();
root.sortChildren();

            restoreMusicAfterFsOutro(250);
            FIREFLY_ON = false;
    clearFirefliesNow();

            fsOutroPulseToken++; // safety kill
              uiController.restoreUiAfterFsOutro();
          }
        );
      }
    }


    // ================= ====
    // BIG WIN OVERLAY — click to continue
    // =====================


let __bigWinPrevMusicVol01: number | null = null;
// ✅ Duck current music to 50% during Big Win (BASE + FREE SPINS)
const BIGWIN_MUSIC_DUCK = 0.35;

// =====================
// FS OUTRO PENDING — MUSIC DUCK TO 50%
// =====================
let __fsOutroPrevMusicVol01: number | null = null;
const FS_OUTRO_MUSIC_DUCK = 0.2; // 50%

function fadeMusicTo(target01: number, ms = 250) {
  const from = audio?.getMusicVolume01?.() ?? 0.6;
  const to = Math.max(0, Math.min(1, target01));

  // If audio isn't ready, just set it (safe no-op if methods missing)
  if (!audio?.setMusicVolume01 || !audio?.apply) return;

  void animateMs(ms, (t) => {
    const e = t * t * (3 - 2 * t); // smoothstep
    audio.setMusicVolume01(from + (to - from) * e);
    audio.apply();
  });
}

function duckMusicForFsOutroPending(ms = 250) {
  if (__fsOutroPrevMusicVol01 == null) {
    __fsOutroPrevMusicVol01 = audio?.getMusicVolume01?.() ?? 0.6;
  }
  fadeMusicTo(__fsOutroPrevMusicVol01 * FS_OUTRO_MUSIC_DUCK, ms);
}

function restoreMusicAfterFsOutro(ms = 250) {
  if (__fsOutroPrevMusicVol01 == null) return;
  fadeMusicTo(__fsOutroPrevMusicVol01, ms);
  __fsOutroPrevMusicVol01 = null;
}


    let bigWinPortraitScale = 1;
let bigWinPortraitScaleLocked = false;
    let bigWinResolve: (() => void) | null = null;
    let bigWinTickToken = 0;          // cancels the RAF count-up
    let bigWinCountDone = true;       // false while counting, true once final
    let bigWinFinalAmount = 0;        // final win amount for snap
    let bigWinFinalTier: BigWinTier = "BIG"; // final tier for snap





    // tune thresholds (in X of bet)
    const BIG_WIN_X   = 10;
    const SUPER_WIN_X = 20;
    const MEGA_WIN_X  = 35;
    const EPIC_WIN_X  = 60;
    const MAX_WIN_X   = 100;
      
    type BigWinTier = "BIG" | "SUPER" | "MEGA" | "EPIC" | "MAX";

    function bigWinTitleKeyForTier(tier: BigWinTier): string {
  if (tier === "SUPER") return "ui.bigWin.super";
  if (tier === "MEGA") return "ui.bigWin.mega";
  if (tier === "EPIC") return "ui.bigWin.epic";
  if (tier === "MAX") return "ui.bigWin.max";
  return "ui.bigWin.big";
}

function setBigWinTitleForTier(tier: BigWinTier) {
  bigWinTitle.text = applyUiTextCase(t(bigWinTitleKeyForTier(tier)));
}

    function bigWinTierForX(x: number): BigWinTier {
      if (x >= MAX_WIN_X)   return "MAX";
      if (x >= EPIC_WIN_X)  return "EPIC";
      if (x >= MEGA_WIN_X)  return "MEGA";
      if (x >= SUPER_WIN_X) return "SUPER";
      return "BIG";
    }


    // =====================
    // BIG WIN TITLE SWAP STATE
    // =====================
    let bigWinTitleAnimActive = false;            // prevents layout fighting the animation
    let bigWinTitleSwapToken = 0;                 // cancels older swaps
    let bigWinShownTier: BigWinTier | null = null; // what is currently displayed

    // =====================
    // BIG WIN STYLES (STRAIGHT / NO SKEW)
    // =====================
    function makeBigWinTitleStyle() {
      return new TextStyle({
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffffff,
        fontSize: 110,
        fontWeight: "100",
        letterSpacing: 2,
        align: "center",

        // bold outline
    stroke: { color: 0x000000, width: 14 },


        // punchy shadow
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowAlpha: 0.75,
        dropShadowBlur: 0,
        dropShadowDistance: 14,
        dropShadowAngle: -Math.PI / 4, // straight down
      } as any);
    }

    function makeBigWinAmountStyle() {
      return new TextStyle({
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffd36a,
        fontSize: 170,
        fontWeight: "100",
        letterSpacing: 1,
        align: "center",

      stroke: { color: 0x000000, width: 16 },


        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowAlpha: 0.75,
        dropShadowBlur: 0,
        dropShadowDistance: 16,
        dropShadowAngle: -Math.PI / 4,
      } as any);
    }

    function makeBigWinContinueStyle() {
      return new TextStyle({
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffffff,
        fontSize: 42,
        fontWeight: "100",
        letterSpacing: 1,
        align: "center",

  stroke: { color: 0x000000, width: 6 },


        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowAlpha: 0.70,
        dropShadowBlur: 0,
        dropShadowDistance: 8,
        dropShadowAngle: -Math.PI / 4,
      } as any);
    }

    // Tier colors (we'll just swap fills, NOT the whole style)
    const BIGWIN_TIER_COLORS: Record<BigWinTier, number> = {
      BIG:   0xffffff,
      SUPER: 0x9ff3ff,
      MEGA:  0xffe066,
      EPIC:  0xff9a3c,
      MAX:   0xff3c3c,
    };

    const BIGWIN_AMOUNT_GOLD = 0xffd36a; // always-gold amount

    const bigWinTitle = new Text({
      text: "BIG WIN",
      style: makeBigWinTitleStyle(),
    } as any);
    bigWinTitle.anchor.set(0.5);
    bigWinTitle.zIndex = 9470;
    bigWinTitle.visible = false;
    bigWinTitle.alpha = 0;
    root.addChild(bigWinTitle);

    const bigWinAmount = new Text({
      text: "0.00",
      style: makeBigWinAmountStyle(),
    } as any);
    bigWinAmount.anchor.set(0.5);
    bigWinAmount.zIndex = 9470;
    bigWinAmount.visible = false;
    bigWinAmount.alpha = 0;
    root.addChild(bigWinAmount);

    // ✅ BIG WIN: allow tap/click anywhere on title/amount to skip/close (same as dimmer)
for (const t of [bigWinTitle, bigWinAmount]) {
  t.eventMode = "static";
  t.cursor = "pointer";

  // generous hit area so taps are easy
  t.hitArea = new Rectangle(-800, -220, 1600, 440);

  t.removeAllListeners?.("pointertap");
  t.on("pointertap", (e: any) => {
    e?.stopPropagation?.();
    fsDimmer.emit("pointertap", {} as any);
  });
}


    // =====================
    // BIG WIN AMOUNT — IDLE PULSE (loop)
    // =====================
    let bigWinPulseToken = 0;

function startBigWinIdlePulse() {
  bigWinPulseToken++;
  const token = bigWinPulseToken;

  const base =
    (isMobilePortraitUILayout(__layoutDeps) && bigWinPortraitScaleLocked)
      ? bigWinPortraitScale
      : (bigWinAmount.scale.x || 1);

  const portrait = isMobilePortraitUILayout(__layoutDeps);

  // ✅ Portrait: vertical-only (no width change, digits won't affect it)
  const upX = base;
  const upY = portrait ? base * 1.10 : clampBigWinScaleToScreen(base * 1.08);

  const UP_MS = 240;
  const DOWN_MS = 320;
  const PAUSE_MS = 220;

  async function loop() {
    while (token === bigWinPulseToken && state.overlay.bigWin) {
      await animateMs(UP_MS, (t) => {
        if (token !== bigWinPulseToken) return;
        const e = easeOutCubic(t);
        const sx = base + (upX - base) * e;
        const sy = base + (upY - base) * e;
        bigWinAmount.scale.set(sx, sy);
      });

      await animateMs(DOWN_MS, (t) => {
        if (token !== bigWinPulseToken) return;
        const e = t * t * (3 - 2 * t);
        const sx = upX + (base - upX) * e;
        const sy = upY + (base - upY) * e;
        bigWinAmount.scale.set(sx, sy);
      });

      bigWinAmount.scale.set(base, base);
      await waitMs(PAUSE_MS);
    }

    bigWinAmount.scale.set(base, base);
  }

  void loop();
}



  function stopBigWinIdlePulse() {
  bigWinPulseToken++; // cancels loop

  // ✅ settle to the correct base scale (prevents 1-frame snap)
  const base =
    (isMobilePortraitUILayout(__layoutDeps) && bigWinPortraitScaleLocked)
      ? bigWinPortraitScale
      : (bigWinAmount.scale.x || 1);

  bigWinAmount.scale.set(base, base);
}


    const bigWinContinue = new Text({
      text: t("ui.clickToContinue"),
      style: makeBigWinContinueStyle(),
    } as any);
    bigWinContinue.anchor.set(0.5);
    bigWinContinue.zIndex = 9470;
    bigWinContinue.visible = false;
    bigWinContinue.alpha = 0;
    root.addChild(bigWinContinue);


    // =====================
    // BIG WIN — GREEN SPOTLIGHT (cone)
    // =====================
    const bigWinSpotlight = new Graphics();
    bigWinSpotlight.zIndex = 9464; // ✅ above dimmer(9400), below apples(9465) + text(9470)
    bigWinSpotlight.visible = false;
    bigWinSpotlight.alpha = 0;
    bigWinSpotlight.eventMode = "none";
    (bigWinSpotlight as any).blendMode = "add"; // ✅ glow feel
    bigWinSpotlight.filters = [new BlurFilter({ strength: 40 })];
    root.addChild(bigWinSpotlight);
    root.sortChildren();

    // tuning knobs
    let BIGWIN_SPOTLIGHT_ON = true;
    let BIGWIN_SPOTLIGHT_COLOR = 0x7CFF6B;  // bright green
    let BIGWIN_SPOTLIGHT_ALPHA = 0.42;      // overall strength
    let BIGWIN_SPOTLIGHT_TOP_W = 300;       // width near the top
    let BIGWIN_SPOTLIGHT_BOTTOM_W = 900;    // width near bottom
    let BIGWIN_SPOTLIGHT_HEIGHT = 1400;      // cone height
    let BIGWIN_SPOTLIGHT_FADE_STEPS = 14;      // 8..20 (more = smoother fade)
    let BIGWIN_SPOTLIGHT_FADE_POWER = 1.8;     // 1.0 linear, 2.0+ stronger fade down
    let BIGWIN_SPOTLIGHT_BOTTOM_FADE = 0.06;   // alpha at the bottom (0.0..0.15)

    let BIGWIN_SPOTLIGHT_TOP_Y = -40;       // where it starts (above screen)

    function redrawBigWinSpotlight() {
      const W = app.screen.width;

      const cx = Math.round(W * 0.5);
      const y0 = BIGWIN_SPOTLIGHT_TOP_Y;
      const y1 = Math.round(y0 + BIGWIN_SPOTLIGHT_HEIGHT);

      const topW = BIGWIN_SPOTLIGHT_TOP_W;
      const botW = BIGWIN_SPOTLIGHT_BOTTOM_W;

      // clear + draw a soft cone
      bigWinSpotlight.clear();

      // MAIN cone (stacked slices -> fades out as it goes down)
    const steps = Math.max(3, BIGWIN_SPOTLIGHT_FADE_STEPS | 0);
    const pwr = Math.max(0.5, BIGWIN_SPOTLIGHT_FADE_POWER);
    const aBot = Math.max(0, Math.min(1, BIGWIN_SPOTLIGHT_BOTTOM_FADE));

  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;         // 0..1
    const t1 = (i + 1) / steps;   // 0..1

    const yy0 = y0 + (y1 - y0) * t0;
    const yy1 = y0 + (y1 - y0) * t1;

    const w0 = topW + (botW - topW) * t0;
    const w1 = topW + (botW - topW) * t1;

    const k0 = Math.pow(1 - t0, pwr);
    const alpha0 = aBot + (1 - aBot) * k0;

    bigWinSpotlight
      .moveTo(cx - w0 * 0.5, yy0)
      .lineTo(cx + w0 * 0.5, yy0)
      .lineTo(cx + w1 * 0.5, yy1)
      .lineTo(cx - w1 * 0.5, yy1)
      .closePath()
      .fill({ color: BIGWIN_SPOTLIGHT_COLOR, alpha: alpha0 });
  }


    // INNER core strip (also fades down)
    const coreTop = topW * 0.4;
    const coreBot = botW * 0.5;

  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;

    const yy0 = y0 + (y1 - y0) * t0;
    const yy1 = y0 + (y1 - y0) * t1;

    const w0 = coreTop + (coreBot - coreTop) * t0;
    const w1 = coreTop + (coreBot - coreTop) * t1;

    // stronger falloff for the core
    const k0 = Math.pow(1 - t0, pwr * 1.25);
    const alpha0 = (aBot * 0.35) + (1 - (aBot * 0.35)) * k0;

    bigWinSpotlight
      .moveTo(cx - w0 * 0.5, yy0)
      .lineTo(cx + w0 * 0.5, yy0)
      .lineTo(cx + w1 * 0.5, yy1)
      .lineTo(cx - w1 * 0.5, yy1)
      .closePath()
      .fill({ color: 0xE8FFD0, alpha: alpha0 });
  }



    

      
    }

    window.addEventListener("resize", () => {
      if (bigWinSpotlight.visible) redrawBigWinSpotlight();
    });

    // =====================
    // PIXEL-PERFECT BIG WIN TEXT
    // =====================
    bigWinTitle.roundPixels = true;
    bigWinAmount.roundPixels = true;
    bigWinContinue.roundPixels = true;


    // =====================
    // BIG WIN SKEW (TITLE ONLY)
    // =====================
    const BIGWIN_TITLE_SKEW = 0.39; // shared slot skew (radians)

    // Y-skew ONLY
    bigWinTitle.skew.set(0, BIGWIN_TITLE_SKEW);

    // keep others straight
    bigWinAmount.skew.set(0, BIGWIN_TITLE_SKEW);
    bigWinContinue.skew.set(0, 0);




    // make the text itself clickable
    bigWinContinue.eventMode = "static";
    bigWinContinue.cursor = "pointer";

function computeBigWinPortraitScale(finalAmount: number) {
  if (!isMobilePortraitUILayout(__layoutDeps)) return 1;

  const W = app.screen.width;

  // leave padding at screen edges
  const PAD = Math.round(W * 0.10);
  const maxW = Math.max(1, W - PAD * 2);

  // ✅ start from your desired portrait "overall smaller" size
  const base = BIGWIN_PORTRAIT_BASE_SCALE;

  // measure at base scale (so we fit from the correct starting size)
  bigWinTitle.scale.set(base, base);
  bigWinAmount.scale.set(base, base);

  // temporarily set to widest possible text
  const oldTitle = bigWinTitle.text;
  const oldAmt = bigWinAmount.text;

  bigWinTitle.text = "EPIC WIN";            // widest-ish title
  bigWinAmount.text = fmtMoney(finalAmount); // widest number

  const widest = Math.max(
    bigWinTitle.getBounds().width,
    bigWinAmount.getBounds().width
  );

  // restore
  bigWinTitle.text = oldTitle;
  bigWinAmount.text = oldAmt;

  // if it fits at base size, use base
  if (widest <= maxW) return base;

  // otherwise shrink further, but don't go microscopic
  const fit = maxW / widest; // < 1
  const s = base * fit;

  return Math.max(base * 0.58, Math.min(base, s));
}
function clampBigWinScaleToScreen(proposedScale: number) {
  if (!isMobilePortraitUILayout(__layoutDeps)) return proposedScale;

  const W = app.screen.width;
  const PAD = Math.round(W * 0.10);
  const maxW = Math.max(1, W - PAD * 2);

  // apply proposed scale to measure
  bigWinTitle.scale.set(proposedScale, proposedScale);
  bigWinAmount.scale.set(proposedScale, proposedScale);

  const widest = Math.max(
    bigWinTitle.getBounds().width,
    bigWinAmount.getBounds().width
  );

  if (widest <= maxW) return proposedScale;

  const fitMul = maxW / Math.max(1, widest);
  const s = proposedScale * fitMul;

  // don’t let it get microscopic
  return Math.max(0.45, s);
}


    function layoutBigWin() {
      const cx = app.screen.width / 2;
      const cy = app.screen.height / 2;
        // =====================
  // ✅ TINY VIEW ONLY: scale down + enforce a real gap (no overlap ever)
  // =====================
  const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
  if (IS_TINY_VIEW) {
    const W = app.screen.width;
    const H = app.screen.height;

    // scale everything down in tiny view
    bigWinTitle.scale.set(BIGWIN_TINY_SCALE, BIGWIN_TINY_SCALE);
    bigWinAmount.scale.set(BIGWIN_TINY_SCALE, BIGWIN_TINY_SCALE);
    bigWinContinue.scale.set(BIGWIN_TINY_SCALE, BIGWIN_TINY_SCALE);

    // ---- guaranteed gap stack (based on real bounds) ----
    // place the stack around a slightly higher center than exact middle
    const stackCy = Math.round(H * BIGWIN_TINY_TITLE_Y_N);

    // measure AFTER scale is applied
   // ✅ Use LOCAL bounds so skew doesn't inflate "height" when the word gets wider
const titleLB = bigWinTitle.getLocalBounds();
const amtLB   = bigWinAmount.getLocalBounds();

const titleH = Math.max(1, titleLB.height) * (bigWinTitle.scale.y || 1);
const amtH   = Math.max(1, amtLB.height)   * (bigWinAmount.scale.y || 1);


    const gap = BIGWIN_TINY_GAP_PX;

    const stackH = titleH + gap + amtH;
    const topY = Math.round(stackCy - stackH * 0.5);

    // anchor is 0.5, so y = center of each text
    bigWinTitle.position.set(cx, Math.round(topY + titleH * 0.5));
    bigWinAmount.position.set(cx, Math.round(topY + titleH + gap + amtH * 0.5));

    // continue stays near bottom
    bigWinContinue.position.set(cx, Math.round(H * 0.92));

    // keep continue hit area sane
    const b = bigWinContinue.getLocalBounds();
    bigWinContinue.hitArea = new Rectangle(
      b.x - 60,
      b.y - 24,
      b.width + 120,
      b.height + 48
    );

    return; // ✅ prevent other layouts (land/portrait/desktop) from overriding
  }

        // =====================
  // MOBILE LANDSCAPE: SCALE DOWN BIG WIN
  // =====================
if (isMobileLandscapeUILayout(__layoutDeps)) {
  // ✅ scale down for landscape
  bigWinTitle.scale.set(BIGWIN_LAND_SCALE);
  bigWinAmount.scale.set(BIGWIN_LAND_SCALE);
  bigWinContinue.scale.set(BIGWIN_LAND_SCALE);

  // ✅ LANDSCAPE ONLY: explicit centered positions
  // (tweak these 3 numbers)
  const BIGWIN_LAND_TITLE_Y  = Math.round(cy - app.screen.height * 0.2);
  const BIGWIN_LAND_AMOUNT_Y = Math.round(cy + app.screen.height * 0.1);
  const BIGWIN_LAND_CONT_Y   = Math.round(app.screen.height * 0.92);

  bigWinTitle.position.set(cx, BIGWIN_LAND_TITLE_Y);
  bigWinAmount.position.set(cx, BIGWIN_LAND_AMOUNT_Y);
  bigWinContinue.position.set(cx, BIGWIN_LAND_CONT_Y);

  // ✅ keep continue hit area sane after scale
  const b = bigWinContinue.getLocalBounds();
  bigWinContinue.hitArea = new Rectangle(
    b.x - 60,
    b.y - 24,
    b.width + 120,
    b.height + 48
  );

  return; // ✅ prevent desktop/portrait logic from overriding
}



    const BIGWIN_TITLE_OFFSET_Y  = -110;
const BIGWIN_AMOUNT_OFFSET_Y =  70;

// ✅ portrait-only adjustment (no redeclaration)
const titleOffset =
  isMobilePortraitUILayout(__layoutDeps) ? -22 : BIGWIN_TITLE_OFFSET_Y;

const amountOffset =
  isMobilePortraitUILayout(__layoutDeps) ? 50 : BIGWIN_AMOUNT_OFFSET_Y;

const titleY = Math.round(cy + titleOffset);
if (!bigWinTitleAnimActive) {
  bigWinTitle.position.set(cx, titleY);
} else {
  bigWinTitle.x = cx;
}

bigWinAmount.position.set(cx, Math.round(cy + amountOffset));

    bigWinContinue.position.set(cx, Math.round(app.screen.height * 0.92));

    // enlarge click area around the continue text
    const b = bigWinContinue.getLocalBounds();
    const padX = 60;
    const padY = 24;
    bigWinContinue.hitArea = new Rectangle(
      b.x - padX,
      b.y - padY,
      b.width + padX * 2,
      b.height + padY * 2
    );

    
  // =====================
// ✅ BIG WIN SCALE RULES
// - Mobile landscape: handled earlier (BIGWIN_LAND_SCALE branch)
// - Mobile portrait: always smaller (base), and use locked scale if available
// - Desktop: normal (1)
// =====================
if (isMobilePortraitUILayout(__layoutDeps)) {
 const s = bigWinPortraitScaleLocked ? bigWinPortraitScale : BIGWIN_PORTRAIT_BASE_SCALE;

  bigWinTitle.scale.set(s, s);
  bigWinAmount.scale.set(s, s);

  // ✅ Bigger continue (portrait only)
  const CONT_MUL = 1.8; // 🔧 try 1.4 .. 2.0
  bigWinContinue.scale.set(s * CONT_MUL, s * CONT_MUL);
} else {
  bigWinTitle.scale.set(1, 1);
  bigWinAmount.scale.set(1, 1);
  bigWinContinue.scale.set(1, 1); // ✅ FIX: reset continue on desktop/tablet
}


if (isMobilePortraitUILayout(__layoutDeps) && bigWinPortraitScaleLocked) {
  bigWinTitle.scale.set(bigWinPortraitScale);
  bigWinAmount.scale.set(bigWinPortraitScale);
  // keep continue as whatever you set above (portrait uses CONT_MUL)
} else if (!isMobilePortraitUILayout(__layoutDeps)) {
  // non-portrait: normal
  bigWinTitle.scale.set(1, 1);
  bigWinAmount.scale.set(1, 1);
  bigWinContinue.scale.set(1, 1); // ✅ FIX: ensure it can't inherit tiny
}


    }

// =====================
// BIG WIN — MOBILE LANDSCAPE SCALE
// =====================
const BIGWIN_LAND_SCALE = 0.6;     // 🔧 try 0.62–0.82
// ✅ BIG WIN — MOBILE PORTRAIT SCALE (TITLE + AMOUNT ONLY)
const BIGWIN_PORTRAIT_BASE_SCALE = 0.35; // 🔧 try 0.70–0.85 (smaller = smaller)\
// ✅ BIG WIN — TINY VIEW (pop-out S) tuning
const BIGWIN_TINY_SCALE = 0.4;   // 🔧 try 0.48..0.65
const BIGWIN_TINY_GAP_PX = 3;    // 🔧 try 12..32 (guaranteed gap)
const BIGWIN_TINY_TITLE_Y_N = 0.5; // 🔧 0.40..0.48 (moves stack up/down a bit)



    // =====================
    // BIG WIN TITLE DROP IN/OUT (TITLE ONLY)
    // =====================
    const BIGWIN_TITLE_DROP_PAD = 180;  // how far above the screen it starts
    const BIGWIN_TITLE_DROP_IN_MS = 520;
    const BIGWIN_TITLE_DROP_OUT_MS = 360;

    function bigWinTitleOffY() {
      // ensure bounds/height is up-to-date
      // (layoutBigWin already calls this often, but this is safe)
      const h = Math.max(1, bigWinTitle.height || bigWinTitle.getBounds().height || 1);

      // fully offscreen above the top (height/2 because anchor=0.5)
      return -h / 2 - BIGWIN_TITLE_DROP_PAD;
    }

    function animateBigWinTitleIn(ms = BIGWIN_TITLE_DROP_IN_MS, targetY?: number) {
      bigWinTitleAnimActive = true;

      // ensure layout has calculated the "rest" y
      layoutBigWin();
      const ty = (typeof targetY === "number") ? targetY : bigWinTitle.y;

      // start offscreen
      bigWinTitle.y = bigWinTitleOffY();

      tween(
        ms,
        (k) => {
          const t = Math.max(0, Math.min(1, k));
          const e = easeOutBack(t, 0.85);
          bigWinTitle.y = bigWinTitleOffY() + (ty - bigWinTitleOffY()) * e;
        },
        () => {
          bigWinTitle.y = ty;
          bigWinTitleAnimActive = false;
        }
      );
    }

    function animateBigWinTitleOut(ms = BIGWIN_TITLE_DROP_OUT_MS, onDone?: () => void) {
      bigWinTitleAnimActive = true;

      const startY = bigWinTitle.y;
      const offY = bigWinTitleOffY();

      tween(
        ms,
        (k) => {
          const t = Math.max(0, Math.min(1, k));
          const e = easeInCubic(t);
          bigWinTitle.y = startY + (offY - startY) * e;
        },
        () => {
          bigWinTitle.y = offY;
          bigWinTitleAnimActive = false;
          onDone?.();
        }
      );
    }
    function swapBigWinTierTitle(nextTier: BigWinTier) {
      // cancel any in-flight swaps
      bigWinTitleSwapToken++;
      const token = bigWinTitleSwapToken;

      // compute the "rest" Y for the title so we drop into the correct place
      layoutBigWin();
      const targetY = bigWinTitle.y;

      // if this tier is already showing, do nothing
      if (bigWinShownTier === nextTier) return;
      bigWinShownTier = nextTier;

      // fly out current title, then swap text, then drop in
      animateBigWinTitleOut(BIGWIN_TITLE_DROP_OUT_MS, () => {
        if (token !== bigWinTitleSwapToken) return; // aborted by a newer swap

    // ✅ make sure it's fully hidden before swapping text
    bigWinTitle.alpha = 0;
    bigWinTitle.y = bigWinTitleOffY();

 setBigWinTitleForTier(nextTier);

    // tier color swap (title + amount)
    const col = BIGWIN_TIER_COLORS[nextTier];
    (bigWinTitle.style as any).fill = col;

    // ✅ keep amount gold forever
    (bigWinAmount.style as any).fill = BIGWIN_AMOUNT_GOLD;


    // ✅ show again (still offscreen), then drop in
    bigWinTitle.alpha = 1;
    animateBigWinTitleIn(BIGWIN_TITLE_DROP_IN_MS, targetY);

      });
    }



    window.addEventListener("resize", layoutBigWin);

    // Atlas frame names (must match keys inside bigwin_items.json)
    const APPLE_BIGWIN   = "apple_big_win.png";
    const PEAR_BIGWIN    = "pear_big_win.png";
    const GRAPES_BIGWIN  = "grapes_big_win.png";

    const RAKE_SUPER     = "rake_super_win.png";
    const SHEEP_SUPER    = "sheep_super_win.png";
    const WATERCAN_SUPER = "wateringcan_super_win.png";

    const COW_MEGA         = "cow_mega_win.png";
    const SPADE_MEGA       = "spade_mega_win.png";
    const WHEELBARROW_MEGA = "wheelbarrow_mega_win.png";

    const TRACTOR_EPIC    = "tractor_epic_win.png";
    const AXE_EPIC        = "axe_epic_win.png";
    const WATERMELON_EPIC = "watermelon_epic_win.png";


    // =====================
    // BIG WIN FRUIT SET
    // =====================
    const BIGWIN_FRUITS = [
      { frame: APPLE_BIGWIN,  weight: 0.55 },
      { frame: PEAR_BIGWIN,   weight: 0.30 },
      { frame: GRAPES_BIGWIN, weight: 0.20 },
    ];

    const SUPERWIN_ITEMS = [
      { frame: WATERCAN_SUPER, weight: 0.20 },
      { frame: RAKE_SUPER,     weight: 0.20 },
      { frame: SHEEP_SUPER,    weight: 0.55 },
    ];

    const MEGAWIN_ITEMS = [
      { frame: COW_MEGA,         weight: 0.20 },
      { frame: SPADE_MEGA,       weight: 0.20 },
      { frame: WHEELBARROW_MEGA, weight: 0.10 },
    ];

    const EPICWIN_ITEMS = [
      { frame: TRACTOR_EPIC,    weight: 0.45 },
      { frame: AXE_EPIC,        weight: 0.35 },
      { frame: WATERMELON_EPIC, weight: 0.20 },
    ];







    // =====================
    // SUPER ITEM SCALE BIAS
    // =====================
    const SUPER_ITEM_SCALE_MULT: Record<string, number> = {
      [WATERCAN_SUPER]: 0.75,
      [RAKE_SUPER]:     1.8,
      [SHEEP_SUPER]:    1.3,
    };

    const MEGA_ITEM_SCALE_MULT: Record<string, number> = {
      [COW_MEGA]:         1.0,
      [SPADE_MEGA]:       1.3,
      [WHEELBARROW_MEGA]: 2.0,
    };

    const EPIC_ITEM_SCALE_MULT: Record<string, number> = {
      [TRACTOR_EPIC]:    1.85,
      [AXE_EPIC]:        1.45,
      [WATERMELON_EPIC]: 1.20,
    };


    function pickWeightedItem(
      list: Array<{ frame: string; weight: number }>
    ): { tex: Texture; frame: string } | null {
      let total = 0;
      for (const it of list) total += it.weight;

      let r = Math.random() * total;
      for (const it of list) {
        r -= it.weight;
        if (r <= 0) return { tex: texBigWinItem(it.frame), frame: it.frame };
      }

      const fallback = list[0];
      return { tex: texBigWinItem(fallback.frame), frame: fallback.frame };
    }



    function pickBigWinFloatItem(tier: BigWinTier): { tex: Texture; frame: string } | null {
      if (tier === "BIG")   return pickWeightedItem(BIGWIN_FRUITS);
      if (tier === "SUPER") return pickWeightedItem(SUPERWIN_ITEMS);
      if (tier === "MEGA")  return pickWeightedItem(MEGAWIN_ITEMS);
      if (tier === "EPIC")  return pickWeightedItem(EPICWIN_ITEMS);
      return pickWeightedItem(EPICWIN_ITEMS); // MAX reuse
    }






    // =====================
    // BIG WIN APPLE FLOAT FX (BIG tier only)
    // =====================
    let appleFxLayer: Container | null = null;
    let appleActive = false;
    let bigWinFloatTier: BigWinTier = "BIG";
    let appleFlyOut = false;
    let appleTickerAdded = false;

    let appleSpawnAcc = 0;

    type AppleP = {
      s: Sprite;
      vx: number;
      vy: number;
      vr: number;
      life: number;
    };

    const applePool: AppleP[] = [];
    const appleLive: AppleP[] = [];

    // tuning
    const APPLE_MAX_LIVE = 16;
    const APPLE_SPAWN_PER_SEC = 2;      // how many per second while active

    // =====================
    // BIG WIN FLOAT SCALE MULTIPLIERS
    // =====================
    const BIG_FLOAT_SCALE_MULT   = 2;
    const SUPER_FLOAT_SCALE_MULT = 2;  // 🔥 increase this (1.4–1.8 sweet spot)
    const MEGA_FLOAT_SCALE_MULT  = 1.75;
    const EPIC_FLOAT_SCALE_MULT  = 1.9;
    const MAX_FLOAT_SCALE_MULT   = 1.9;


    function ensureAppleFxLayer() {
      if (appleFxLayer) return;

      appleFxLayer = new Container();
      appleFxLayer.sortableChildren = true;

      // put apples under big win texts (9470), above dimmer
      appleFxLayer.zIndex = 9465;

      root.addChild(appleFxLayer);
      root.sortChildren();
    }

    function spawnApple() {
      if (!appleFxLayer) return;

    const picked = pickBigWinFloatItem(bigWinFloatTier);
    if (!picked) return;

    const tex = picked.tex;
    const pickedFrame = picked.frame;


      if (appleLive.length >= APPLE_MAX_LIVE) return;

      let p = applePool.pop();
      if (!p) {
        const s = new Sprite(tex);
        s.eventMode = "none";
        s.anchor.set(0.5);
        s.roundPixels = true;
        p = { s, vx: 0, vy: 0, vr: 0, life: 0 };
      } else {
        p.s.texture = tex;
      }
    (p.s as any).__itemFrame = pickedFrame;

      const s = p.s;
      const W = app.renderer.width;
      const H = app.renderer.height;

    // =====================
    // SPAWN X DISTRIBUTION (UNIFORM)
    // =====================
    const EDGE_PAD = 0.10; // 0.00..0.20 (keeps spawns away from edges if you want)
    const nx = EDGE_PAD + Math.random() * (1 - EDGE_PAD * 2);

    s.x = Math.round(W * nx);

    s.y = H + 60 + Math.random() * 160;


    // =====================
    // TIER-AWARE SCALE
    // =====================
    const baseScale = 0.18 + Math.random() * 0.22; // base size

    let tierScale = BIG_FLOAT_SCALE_MULT;

    switch (bigWinFloatTier) {
      case "SUPER": tierScale = SUPER_FLOAT_SCALE_MULT; break;
      case "MEGA":  tierScale = MEGA_FLOAT_SCALE_MULT;  break;
      case "EPIC":  tierScale = EPIC_FLOAT_SCALE_MULT;  break;
      case "MAX":   tierScale = MAX_FLOAT_SCALE_MULT;   break;
    }

    // =====================
    // FINAL SCALE (tier + item bias)
    // =====================
    const itemFrame = (s as any).__itemFrame as string | undefined;

    const superBias = itemFrame ? (SUPER_ITEM_SCALE_MULT[itemFrame] ?? 1.0) : 1.0;
    const megaBias  = itemFrame ? (MEGA_ITEM_SCALE_MULT[itemFrame]  ?? 1.0) : 1.0;
    const epicBias  = itemFrame ? (EPIC_ITEM_SCALE_MULT[itemFrame]  ?? 1.0) : 1.0;

    let itemBias = superBias;
    if (itemFrame && itemFrame in MEGA_ITEM_SCALE_MULT) itemBias = megaBias;
    if (itemFrame && itemFrame in EPIC_ITEM_SCALE_MULT) itemBias = epicBias;

    if (itemFrame === RAKE_SUPER) {
      const TARGET_H = app.renderer.height * 0.55;
      const th = Math.max(1, s.texture.height);
      const sc = TARGET_H / th;
      s.scale.set(sc * tierScale);
    } else {
      s.scale.set(baseScale * tierScale * itemBias);
    }


    s.scale.set(baseScale * tierScale * itemBias);



      s.alpha = 1; // ✅ no fade-in
      s.rotation = (-0.2 + Math.random() * 0.4);

      // upward motion + a little drift
    p.vx = (-1 + Math.random() * 2) * (6 + Math.random() * 10); // ✅ less sideways drift

      p.vy = -(95 + Math.random() * 300); // upward
      p.vr = (-1 + Math.random() * 2) * 0.6;

      

      appleFxLayer.addChild(s);
      appleLive.push(p);
    }

    function tickAppleFx() {
      if (!appleFxLayer) return;

      const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
      const W = app.renderer.width;
      const H = app.renderer.height;

      // spawn while active (but NOT during flyout)
      if (appleActive && !appleFlyOut) {
        appleSpawnAcc += APPLE_SPAWN_PER_SEC * dt;
        let n = Math.floor(appleSpawnAcc);
        if (n > 0) appleSpawnAcc -= n;

        // hitch safety
        n = Math.min(n, 4);

        for (let i = 0; i < n; i++) spawnApple();
      }

      for (let i = appleLive.length - 1; i >= 0; i--) {
        const p = appleLive[i];
        const s = p.s;

        // during flyout: rocket up + fade faster
        if (appleFlyOut) {
          p.vy -= 800 * dt; // accelerate upward
          p.vx *= (1 - 0.6 * dt); // damp sideways
        }
    // gentle pull toward screen center
    const pull = 2; // 0..25 (higher = stronger)
    const dx = (W * 0.5) - s.x;
    p.vx += (dx / Math.max(1, W * 0.5)) * pull * dt;

        s.x += p.vx * dt;
        s.y += p.vy * dt;
        s.rotation += p.vr * dt;

        




    const off =
      s.y < -220 ||
      s.y > H + 260 ||
      s.x < -220 ||
      s.x > W + 220;
    

        if (off) {
          s.removeFromParent();
          appleLive.splice(i, 1);
          applePool.push(p);
        }
      }
      // ✅ if we’re in flyout mode and everything has exited, fully stop the system
    if (appleFlyOut && appleLive.length === 0) {
      appleFlyOut = false;
    }

    }

    function startAppleFloat() {
      ensureAppleFxLayer();
      if (!appleFxLayer) return;

      appleActive = true;
      appleFlyOut = false;
      appleSpawnAcc = 0;

      // small initial burst
      for (let i = 0; i < 8; i++) spawnApple();

      if (!appleTickerAdded) {
    appleTickerAdded = true;
    addSystem(() => tickAppleFx());
  }
    }

    // triggers the "fly out above" behavior, then drains
    function flyOutAndStopApples() {
      if (!appleFxLayer) return;

      appleActive = false;   // stop spawning
      appleFlyOut = true;    // accelerate/fade upward

      // safety: if nothing is live, just reset mode
      if (appleLive.length === 0) {
        appleFlyOut = false;
      }
    }

    // =====================
    // MAX WIN — RAINBOW VOXEL CONFETTI (cubes)
    // =====================
    let maxConfettiLayer: Container | null = null;
    let maxConfettiActive = false;
    let maxConfettiTickerAdded = false;
    let maxConfettiSpawnAcc = 0;

    type MaxConfettiP = {
      g: Graphics;
      vx: number;
      vy: number;
      vr: number;
      life: number;
      life0: number;
      s0: number;
    };

    const maxConfettiPool: MaxConfettiP[] = [];
    const maxConfettiLive: MaxConfettiP[] = [];

    function ensureMaxConfettiLayer() {
      if (maxConfettiLayer) return;
      maxConfettiLayer = new Container();
      maxConfettiLayer.eventMode = "none";
      maxConfettiLayer.zIndex = 9466; // above apples (9465), below text (9470)
      root.addChild(maxConfettiLayer);
      root.sortChildren();
    }

    function shadeRgb(hex: number, mul: number): number {
      const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * mul)));
      const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * mul)));
      const b = Math.max(0, Math.min(255, Math.round(((hex) & 255) * mul)));
      return (r << 16) | (g << 8) | b;
    }


    const MAX_CONFETTI_COLS = [
      0xff3c3c, // red
      0xff8a3c, // orange
      0xffe066, // yellow
      0x55ff7a, // green
      0x4fc3ff, // cyan
      0x6b3fd6, // blue/purple
      0xff6fae, // pink
    ];

    function drawIsoCube(g: Graphics, vox: number, baseCol: number) {
      g.clear();

      const hw = vox;        // half width
      const hh = vox * 0.55; // half height (iso)
      const h  = vox * 0.75; // cube height

      const topCol   = shadeRgb(baseCol, 1.10);
      const leftCol  = shadeRgb(baseCol, 0.92);
      const rightCol = shadeRgb(baseCol, 0.82);

    
    // top diamond
  g
    .moveTo(0, -hh)
    .lineTo(hw, 0)
    .lineTo(0, hh)
    .lineTo(-hw, 0)
    .closePath()
    .fill({ color: topCol, alpha: 1 });

  // left face
  g
    .moveTo(-hw, 0)
    .lineTo(0, hh)
    .lineTo(0, hh + h)
    .lineTo(-hw, h)
    .closePath()
    .fill({ color: leftCol, alpha: 1 });

  // right face
  g
    .moveTo(hw, 0)
    .lineTo(0, hh)
    .lineTo(0, hh + h)
    .lineTo(hw, h)
    .closePath()
    .fill({ color: rightCol, alpha: 1 });

    }

    function spawnMaxConfettiOne() {
      if (!maxConfettiLayer) return;

      let p = maxConfettiPool.pop();
      if (!p) {
        p = {
          g: new Graphics(),
          vx: 0, vy: 0, vr: 0,
          life: 0, life0: 0,
          s0: 1,
        };
      }

      const g = p.g;
      g.eventMode = "none";

      const W = app.renderer.width;

      // spawn ACROSS the screen (no center source)
      const x = -60 + Math.random() * (W + 120);
      const y = -120 - Math.random() * 180;

      // cube size
      const vox = 4 + ((Math.random() * 5) | 0); // 4..8
      const col = MAX_CONFETTI_COLS[(Math.random() * MAX_CONFETTI_COLS.length) | 0];
      drawIsoCube(g, vox, col);

      g.x = x;
      g.y = y;
      g.alpha = 0.95;
      g.rotation = Math.random() * Math.PI * 2;

      // motion (falling + drift)
      p.vy = 160 + Math.random() * 360; // fall speed
      p.vx = (-1 + Math.random() * 2) * 90;  // sideways drift
      p.vr = (-1 + Math.random() * 2) * 3.2; // spin

      // lifetime
      p.life0 = 2.2 + Math.random() * 1.6;
      p.life = p.life0;

      // slight scale variance
      p.s0 = 0.85 + Math.random() * 0.9;
      g.scale.set(p.s0);

      maxConfettiLayer.addChild(g);
      maxConfettiLive.push(p);
    }

    function startMaxConfetti(intensity = 1.0) {
      ensureMaxConfettiLayer();
      if (!maxConfettiLayer) return;
    if (maxConfettiLayer) maxConfettiLayer.visible = true;
      maxConfettiActive = true;
      maxConfettiSpawnAcc = 0;

      // initial burst
      const burst = Math.floor(60 + intensity * 40);
      for (let i = 0; i < burst; i++) spawnMaxConfettiOne();

      (startMaxConfetti as any)._intensity = intensity;

    if (!maxConfettiTickerAdded) {
    maxConfettiTickerAdded = true;
    addSystem(() => tickMaxConfetti());
  }
      if (maxConfettiLayer) maxConfettiLayer.visible = true;
    }

    function stopMaxConfetti(drain = true) {
      maxConfettiActive = false;
      maxConfettiSpawnAcc = 0;

    if (drain) {
      // ✅ stop spawning, keep existing cubes until offscreen
      maxConfettiActive = false;
      return;
    }

      // hard stop
      for (let i = maxConfettiLive.length - 1; i >= 0; i--) {
        const p = maxConfettiLive[i];
        p.g.removeFromParent();
        maxConfettiLive.splice(i, 1);
        maxConfettiPool.push(p);
      }
    }

    function tickMaxConfetti() {
      if (!maxConfettiLayer) return;

      const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
      const W = app.renderer.width;
      const H = app.renderer.height;

      // spawn rate while active
      if (maxConfettiActive) {
        const intensity = (startMaxConfetti as any)._intensity ?? 1.0;
        const spawnPerSec = 90 + intensity * 70; // 🔥 density

        maxConfettiSpawnAcc += spawnPerSec * dt;
        const n = Math.floor(maxConfettiSpawnAcc);
        maxConfettiSpawnAcc -= n;

        // clamp on hitch
        const toSpawn = Math.min(n, 12);
        for (let i = 0; i < toSpawn; i++) spawnMaxConfettiOne();
      }

      // update live
      for (let i = maxConfettiLive.length - 1; i >= 0; i--) {
        const p = maxConfettiLive[i];
        const g = p.g;

        // gravity-ish
        p.vy += 520 * dt;

        g.x += p.vx * dt;
        g.y += p.vy * dt;
        g.rotation += p.vr * dt;

    // no fade — keep vivid until it exits
    p.life -= dt;
    g.alpha = 1;

        // recycle when offscreen
    const off = g.y > H + 220 || g.x < -260 || g.x > W + 260;
        if (off) {
          g.removeFromParent();
          maxConfettiLive.splice(i, 1);
          maxConfettiPool.push(p);
        }
      }
      // ✅ if we’re not active and nothing is left, hide the layer (optional)
    if (!maxConfettiActive && maxConfettiLive.length === 0) {
      if (maxConfettiLayer) maxConfettiLayer.visible = false;
    }
    }

    // =====================
    // BIG WIN COIN SHOWER (TexturePacker sheet)
    // =====================
    let coinFxLayer: Container | null = null;
    let coinActive = false;
    let coinTickerAdded = false;
    let coinSpawnAcc = 0;

    type CoinParticle = {
      s: AnimatedSprite;
      vx: number;
      vy: number;
      vr: number;
      life: number;
    };


    const coinPool: CoinParticle[] = [];
    const coinLive: CoinParticle[] = [];

    function getCoinTextures(): Texture[] {
      return getCoinFramesCached();
    }

    function ensureCoinFxLayer() {
      if (coinFxLayer) return;

      coinFxLayer = new Container();
      coinFxLayer.eventMode = "none";
coinFxLayer.interactiveChildren = false;
      coinFxLayer.sortableChildren = true;

      // Put coins above the dimmer, but below the big win texts
      // (Adjust zIndex if your scene differs)
      coinFxLayer.zIndex = 9005;

      // Add it wherever your overlays live.
      // Search for where you add bigWinTitle/bigWinAmount/bigWinContinue to the stage,
      // and add this layer next to them.
        // Add it where your big win overlay lives (same parent as the texts)
      root.addChild(coinFxLayer);

      // Put coins under the big-win texts (9470), but above the dimmer
    coinFxLayer.zIndex = 9601; // ✅ above outro layer
    root.sortChildren();

    }

    function spawnCoin(intensity = 1) {
      if (!coinFxLayer) return;

      const tex = getCoinTextures();
      if (!tex.length) return;

      const W = app.renderer.width;

      let p = coinPool.pop();

      if (!p) {
        const a = new AnimatedSprite(tex);
        
        a.anchor.set(0.5);
        a.loop = true;
        a.eventMode = "none";

        // IMPORTANT: animated frames
        a.animationSpeed = 0.28 + Math.random() * 0.25; // ✅ slightly calmer (tweak)
        a.play();
        (a as any).autoUpdate = true;

        a.roundPixels = true;

        p = { s: a, vx: 0, vy: 0, vr: 0, life: 0 };
      } else {
        // reuse
        p.s.textures = tex;
        p.s.eventMode = "none";
        p.s.animationSpeed = 0.28 + Math.random() * 0.25;
        p.s.gotoAndPlay(0);
      }

      const s = p.s;

      // spawn above screen
      s.x = Math.random() * W;
      s.y = -40 - Math.random() * 160;

      // size + alpha
      const MIN_COIN_SCALE = 0.12;
      const MAX_COIN_SCALE = 0.75;
      const base = MIN_COIN_SCALE + Math.random() * (MAX_COIN_SCALE - MIN_COIN_SCALE);

      const tierBoost = 1 + Math.min(0.28, (intensity - 1) * 0.12);
      s.scale.set(base * tierBoost);

      s.alpha = 0.95;
      s.rotation = Math.random() * Math.PI * 2;

      // motion (your code uses “*60 dt”; keep consistent)
      p.vx = (-1 + Math.random() * 2) * (1.1 + intensity * 0.85);
      p.vy = (2.3 + Math.random() * 4.6) * (1.0 + intensity * 0.75);
      p.vr = (-1 + Math.random() * 2) * 0.06;

      // life (only used if not draining)
      p.life = 3.2 + Math.random() * 2.2;

      coinFxLayer.addChild(s);
      coinLive.push(p);
    }


    function startCoinShower(intensity = 1) {
      ensureCoinFxLayer();
      if (!coinFxLayer) return;

      coinActive = true;
      coinSpawnAcc = 0;


      // initial burst
      for (let i = 0; i < 0.1 + Math.floor(intensity * 1); i++) spawnCoin(intensity);


      // ensure ticker is running
      if (!coinTickerAdded) {
        coinTickerAdded = true;
        addSystem(() => tickCoinShower());
      }

      // keep spawning while active (handled in tick)
      (startCoinShower as any)._intensity = intensity;
    }

    function burstCoins(intensity: number, multiplier = 1) {
      // quick burst without restarting the whole system
      const count = Math.floor((12 + intensity * 10) * multiplier);
      for (let i = 0; i < count; i++) spawnCoin(intensity);
    }


    function stopCoinShower(drain = true) {
      // stop any new spawns
      coinActive = false;
      coinSpawnAcc = 0;

        if (drain) {
        // ✅ Let existing coins fall out naturally.
        // Prevent mid-air "life" expiry from snapping them away.
        for (const p of coinLive) {
          p.life = 9999; // effectively infinite until offscreen recycle
        }
        return;
      }


      // hard stop (old behavior)
      for (const p of coinLive) {
        // if these are AnimatedSprites
        (p.s as any).stop?.();
        p.s.removeFromParent();
        coinPool.push(p);
      }
      coinLive.length = 0;
    }


    function tickCoinShower() {
      if (!coinFxLayer) return;

      const W = app.renderer.width;
      const H = app.renderer.height;

      const dt = app.ticker.deltaMS / 1000;

      // spawn rate while active
      if (coinActive) {
        const intensity = (startCoinShower as any)._intensity ?? 1;
        const spawnPerSec = 4 + intensity * 3;   // ~14/sec

    // ✅ accumulate fractional spawns so we still emit coins even when dt is small
    coinSpawnAcc += spawnPerSec * dt;
    const spawnCount = Math.floor(coinSpawnAcc);
    coinSpawnAcc -= spawnCount;

    const MAX_LIVE_COINS = 140;

    // ✅ NEVER return here — returning freezes coins in the air.
    // Just limit spawns, but always keep updating existing coins.
    const room = Math.max(0, MAX_LIVE_COINS - coinLive.length);
    const toSpawn = Math.min(spawnCount, room);

    for (let i = 0; i < toSpawn; i++) spawnCoin(intensity);


      }

      const g = 18; // gravity

      for (let i = coinLive.length - 1; i >= 0; i--) {
        const p = coinLive[i];
        const s = p.s;

        p.vy += g * dt;
        s.x += p.vx * 60 * dt;
        s.y += p.vy * 60 * dt;
        s.rotation += p.vr * 60 * dt;

        p.life -= dt;

        // recycle when offscreen or life ends
        if (s.y > H + 120 || s.x < -120 || s.x > W + 120 || p.life <= 0) {
          p.s.stop();
          s.removeFromParent();
          coinLive.splice(i, 1);
          coinPool.push(p);
        }
      }
    }




function playBigWinTierPitch(tier: BigWinTier) {
  const rate =
    tier === "SUPER" ? 1.08 :
    tier === "MEGA"  ? 1.16 :
    tier === "EPIC"  ? 1.24 :
    tier === "MAX"   ? 1.34 :
    1.0;

  // ✅ Only pitch for tier-ups (not BIG)
  if (tier === "SUPER" || tier === "MEGA" || tier === "EPIC" || tier === "MAX") {
    // ✅ hard safety: ensure finite + sane range for Howler
    const safeRate = Number.isFinite(rate) ? Math.max(0.5, Math.min(4.0, rate)) : 1.0;

    // ✅ your AudioManager signature expects a NUMBER rate as arg #3
    audio?.playSfx?.("bigwin_hit", 1.0, safeRate);
  }
}

    function showBigWin(on: boolean, winAmountValue: number, winX: number, ms = 520) {
      
      layoutBigWin();

      if (on) {
      state.overlay.bigWin = true;
// ✅ one hit at overlay start
audio?.playSfx?.("bigwin_hit", 1.0);

// ✅ BASE + FS: keep whatever music is playing, just duck volume
if (__bigWinPrevMusicVol01 == null) {
  __bigWinPrevMusicVol01 = audio?.getMusicVolume01?.() ?? 0.6;
}

const ducked = Math.max(0, Math.min(1, __bigWinPrevMusicVol01 * BIGWIN_MUSIC_DUCK));
audio?.setMusicVolume01?.(ducked);
audio?.apply?.();



      lockInputForBigWin(true);

    // ✅ BIG WIN FRUITS: always start at BIG when the overlay starts
    bigWinFloatTier = "BIG";   // ✅ fruits for BIG
    startAppleFloat();







        // lock input: only dimmer click works
        state.ui.auto = false;
        (gameCore as any).eventMode = "none";

        layoutFsDimmer();
        fsDimmer.visible = true;
        fsDimmer.eventMode = "static";
    // ✅ Spotlight on
    if (BIGWIN_SPOTLIGHT_ON) {
      redrawBigWinSpotlight();
      bigWinSpotlight.visible = true;
      bigWinSpotlight.alpha = 0;

      const start = bigWinSpotlight.alpha;
      tween(ms, (k) => {
        const e = Math.max(0, Math.min(1, k));
        bigWinSpotlight.alpha = start + (BIGWIN_SPOTLIGHT_ALPHA - start) * e;
      });
    }

    showBigWinContinue(false, 0); // keep it hidden until count-up finishes


    bigWinShownTier = null;

    // start with BIG immediately (no fly-out first)
    layoutBigWin();
    setBigWinTitleForTier("BIG");
    (bigWinTitle.style as any).fill = BIGWIN_TIER_COLORS.BIG;
    (bigWinAmount.style as any).fill = BIGWIN_AMOUNT_GOLD;


    animateBigWinTitleIn(BIGWIN_TITLE_DROP_IN_MS);
    bigWinShownTier = "BIG";

        
        // =====================
    // BIG WIN COUNT-UP + TIER PROGRESSION
    // =====================
    const bet = state.bank.betLevels[state.bank.betIndex];
    const targetAmount = winAmountValue;
    const targetX = winX;

    bigWinFinalAmount = targetAmount;
    bigWinFinalTier = bigWinTierForX(targetX);
    // ✅ lock portrait scale ONCE using the final amount (prevents snapping)
bigWinPortraitScaleLocked = false;
bigWinPortraitScale = computeBigWinPortraitScale(bigWinFinalAmount);
bigWinPortraitScaleLocked = true;
layoutBigWin(); // apply it immediately

    bigWinCountDone = false;
audio?.startTickLoop?.(120, 0.22, 1.0);

    // timing (bigger wins count longer)
    const BASE_MS = 1400;
    const duration = Math.min(6500, BASE_MS + targetX * 45);


    bigWinTickToken++;
    const token = bigWinTickToken;

    const start = performance.now();

    let lastTier: BigWinTier | null = null;


    function tickBigWin(now: number) {
      if (token !== bigWinTickToken) return;

        const rawT = Math.min(1, (now - start) / duration);

      // Your MAX tier threshold (matches your intensity/tier logic)
      const MAX_WIN_X = 200;

      // How far through the win we are, relative to MAX tier (0 → 1)
      const maxProgress = Math.min(1, (targetX * rawT) / MAX_WIN_X);

      // slowdown factor: 1 → 0.35 near MAX
    const slowdown = 1 - Math.pow(maxProgress, 2.8) * 0.65;

    // apply slowdown to progress
    const t = Math.min(1, rawT * slowdown + rawT * (1 - slowdown));

    // smooth visuals
      // ✅ normal-ish at the start, slows more toward the end
      // (bigger p = faster early + slower late)
      const currentAmount = targetAmount * t;
      const currentX = currentAmount / bet;

      bigWinAmount.text = fmtMoney(currentAmount);
      // ✅ TICK LOOP ramp (BIG WIN): faster + louder as it climbs
const p01 = Math.max(0, Math.min(1, rawT)); // ✅ 0..1 progress


// 🔊 loudness compensation for higher pitch


// final volume


const rate = 0.98 + 0.65 * Math.pow(p01, 1.45);
const loudnessComp = 1.0 + 0.25 * (rate - 1.0);

const vol = (0.22 + 0.45 * Math.pow(p01, 1.2)) * loudnessComp;
audio?.setTickParams?.(vol, rate);

      const tier = bigWinTierForX(currentX);


   if (tier !== lastTier) {
  lastTier = tier;
  swapBigWinTierTitle(tier);
playBigWinTierPitch(tier);
  // ✅ NEW: play tier upgrade stinger exactly once per tier


  bigWinFloatTier = tier;
      

      // ✅ switch what spawns (BIG=fruits, SUPER+=your new PNGs)
      bigWinFloatTier = tier;
      // ✅ MAX: start rainbow voxel confetti shower
    if (tier === "MAX") {
      startMaxConfetti(1.35); // tweak 1.0..2.0
    }


      // ✅ IMPORTANT: DO NOT stop the system on tier upgrade
      // Instead: do a quick burst so the new set shows immediately.
      if (appleActive && !appleFlyOut) {
        const burst = (tier === "SUPER") ? 6 : (tier === "MEGA") ? 8 : (tier === "EPIC") ? 10 : 12;
        for (let i = 0; i < burst; i++) spawnApple();
      }
    }







    // Amount can still use the tier colour (already applied in swap)
    // If you want the amount to stay gold the whole time, delete this line:
    // (bigWinAmount.style as any).fill = BIGWIN_TIER_COLORS[tier];



      if (rawT < 1) {
        // ✅ TICK LOOP: start for Big Win count-up

        requestAnimationFrame(tickBigWin);
      } else {



      // snap exact final values
      bigWinAmount.text = fmtMoney(targetAmount);
    pulseBigWinAmount(); // ✅ pulse when amount lands (like fsOutro)
   audio?.stopTickLoop?.(0); // kill tick immediately
    audio?.playSfx?.("final_amount", 1.15, 1.0); // volMul=1.15, rate=1.0



      // ✅ now allow click-to-continue
      showBigWinContinue(true, 360);
      bigWinCountDone = true;
      startBigWinIdlePulse();

    }

    }

    lastTier = "BIG";

    requestAnimationFrame(tickBigWin);


        // show
        [bigWinTitle, bigWinAmount, bigWinContinue].forEach((t) => {
          t.visible = true;
          t.alpha = 0;
        });

        // blur + dim in (reuse your overlay look)
        const startA = fsDimmer.alpha;

        
        

        tween(ms, (k) => {
          const e = Math.max(0, Math.min(1, k));
          fsDimmer.alpha = startA + (0.8 - startA) * e; // tweak darkness
          

          bigWinTitle.alpha = e;
          bigWinAmount.alpha = e;
          bigWinContinue.alpha = e;
        });
      } else {
          // ✅ RESET portrait big win scaling
  bigWinPortraitScaleLocked = false;
  bigWinPortraitScale = 1.2;


        stopBigWinIdlePulse();
          // ✅ Apples fly out upward only if they were active (BIG tier case)
      flyOutAndStopApples();
      stopMaxConfetti(true); // let cubes fall away nicely

        const startA = fsDimmer.alpha;
        const startB = bgBlur.strength;
        

      
      

        showBigWinContinue(false, ms);
        // ✅ Title flies up ONLY when we actually close the overlay
    animateBigWinTitleOut(BIGWIN_TITLE_DROP_OUT_MS);


        tween(
          ms,
          (k) => {
            const e = Math.max(0, Math.min(1, k));
            fsDimmer.alpha = startA * (1 - e);
            bgBlur.strength = startB * (1 - e);

            bigWinTitle.alpha = 1 - e;
            bigWinAmount.alpha = 1 - e;
            bigWinContinue.alpha = 1 - e;
    // ✅ fade spotlight out with the overlay
      if (bigWinSpotlight.visible) {
        bigWinSpotlight.alpha = BIGWIN_SPOTLIGHT_ALPHA * (1 - e);
      }
            
          },
          () => {
            [bigWinTitle, bigWinAmount, bigWinContinue].forEach((t) => {
              t.visible = false;
              t.alpha = 0;
            });

            fsDimmer.alpha = 0;
            bgBlur.strength = 0;
            fsDimmer.visible = false;
            fsDimmer.eventMode = "static"

            // ✅ hard hide spotlight
    bigWinSpotlight.visible = false;
    bigWinSpotlight.alpha = 0;

            // restore core
            gameCore.alpha = 1;
            (gameCore as any).eventMode = "auto";
            lockInputForBigWin(false);
audio?.stopTickLoop?.(0); // ✅ safety stop

            state.overlay.bigWin = false;
            // ✅ If we ducked FS music for big win, restore it


// keep your original “resume correct track” behavior for non-FS or safety
// ✅ restore music volume after big win
if (__bigWinPrevMusicVol01 != null) {
  audio?.setMusicVolume01?.(__bigWinPrevMusicVol01);
  audio?.apply?.();
  __bigWinPrevMusicVol01 = null;
}

// keep your safety “resume correct track” (optional but fine)
playMusicWhenUnlocked(state.game.mode === "FREE_SPINS" ? "music_fs" : "music_base", 350);



            

            // resolve awaiter (if any)
            bigWinResolve?.();
            bigWinResolve = null;
          }
        );
      }
    }

function finishBigWinCountUp() {
  bigWinTickToken++;          // cancel RAF
      bigWinAmount.text = fmtMoney(bigWinFinalAmount);
 // 🔊 FINAL AMOUNT HIT (play FIRST)
audio?.playSfx?.("final_amount", 1.15, 1.0); // volMul=1.15, rate=1.0

// 🧹 stop the ticking AFTER the hit has time to land
setTimeout(() => {
  audio?.stopTickLoop?.(120);
}, 80);

      pulseBigWinAmount(); // ✅ pulse even when skipping (matches fsOutro)


      // snap title to final tier immediately (no fly-out/in)
      bigWinShownTier = bigWinFinalTier;
      setBigWinTitleForTier(bigWinFinalTier);

    // ✅ Don’t kill the spawner on skip.
    // Just switch tier and burst the new items so you SEE them.
    bigWinFloatTier = bigWinFinalTier;
    // ✅ If we skipped to the end and it's MAX, force-start the confetti now
    if (bigWinFinalTier === "MAX") {
      startMaxConfetti(1.35); // tweak intensity 1.0..2.0
    }


    if (appleActive && !appleFlyOut) {
      const burst = (bigWinFinalTier === "SUPER") ? 8 : (bigWinFinalTier === "MEGA") ? 10 : (bigWinFinalTier === "EPIC") ? 12 : 14;
      for (let i = 0; i < burst; i++) spawnApple();
    }



    const col = BIGWIN_TIER_COLORS[bigWinFinalTier];
    (bigWinTitle.style as any).fill = col;

    // ✅ keep amount gold forever
    (bigWinAmount.style as any).fill = BIGWIN_AMOUNT_GOLD;


      // allow close now
      bigWinCountDone = true;

      // show continue prompt if you hide it during count
      showBigWinContinue(true, 180);
      startBigWinIdlePulse();
    }


    function showBigWinAndWait(winAmountValue: number, winX: number) {
      return new Promise<void>((resolve) => {
        bigWinResolve = resolve;
        showBigWin(true, winAmountValue, winX, 520);
        
        bigWinContinue.removeAllListeners?.("pointertap");
    bigWinContinue.on("pointertap", (e) => {
  (e as any).stopPropagation?.();

  if (!state.overlay.bigWin) return;

  // 1st click: skip to final (NO click sfx)
  if (!bigWinCountDone) {
    finishBigWinCountUp();
    return;
  }

  // 2nd click: continue/close (PLAY click sfx)
  audio?.playSfx?.("fs_click", 1.15);

  stopBigWinIdlePulse();
  showBigWin(false, 0, 0, 260);
});





      });
    }


    // =====================
    // FS INTRO: click continues (DELAY SPIN UNTIL FADE COMPLETE)
    // =====================
    let fsIntroContinueInFlight = false;

    fsDimmer.on("pointertap", () => {
   // =====================
  // BIG WIN: click = skip then close
  // =====================
  if (state.overlay.bigWin) {
    audio?.initFromUserGesture?.();

    // 1st click: skip (NO click sfx)
    if (!bigWinCountDone) {
      finishBigWinCountUp();
      return;
    }

    // 2nd click: close (PLAY click sfx)
    audio?.playSfx?.("fs_click", 1.15);

    showBigWin(false, 0, 0, 260);
    return;
  }

      // =====================
      // FS OUTRO: click = skip then close
      // =====================
     if (state.overlay.fsOutro) {
      fsOutroPulseToken++;

      // 1st click: skip to final (NO click sfx)
      if (!fsOutroCountDone) {
        finishFsOutroCountUp();
        return;
      }

      // 2nd click: continue/close (PLAY click sfx)
      audio?.playSfx?.("fs_click", 1.15);

      void (async () => {
        await showFsOutroP(false, 0, 260);
        layoutStudioTag();
        root.sortChildren();

        // ✅ IMPORTANT: turn OFF the reel win dimmer when leaving FS outro
        await setReelDimmer(false);

        // extra safety (no harm)
        reelDimmer.alpha = 0;
        reelDimmer.visible = false;

        // ✅ Now fsOutro flag is definitely cleared (and plaque is allowed again)
        layoutMultiplierPlaque();
        uiController.restoreUiAfterFsOutro();
        root.sortChildren();

        // (optional) if you want it to “snap show” no matter what:
        multPlaqueLayer.visible = true;
      })();

      clearSmokeNow();

      setReelHouseForMode("BASE");
      void setBackgroundForMode("BASE", true);
      playMusicWhenUnlocked("music_base", 450);

      snowFxEnabled = false;
      clearSnowNow();
      leafFxEnabled = true;
      cloudFxEnabled = true;
      seedCloudFx(6);
      cloudSpawnAcc = 0;
      smokeFxEnabled = true;

      leafSpawnAcc = 0;
      smokeSpawnAcc = 0;

      state.game.returningFromFreeSpins = true;

      setMult(LADDER[plaqueIdx] ?? 1);

      void (async () => {
        await animatePlaqueReturnToBase();
        state.game.returningFromFreeSpins = false;

        // 🔥 Wait for layout + anchors to stabilize
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {

          });
        });
      })();

      gameCore.alpha = 1;
      (gameCore as any).eventMode = "auto";

      stopCoinShower(true);
      state.overlay.bigWin = false;
      return;
    }

      // =====================
      // FS INTRO: click continues (DELAY SPIN UNTIL FADE COMPLETE)
      // =====================
      if (!state.overlay.fsIntro) return;
      if (fsIntroContinueInFlight) return;
      fsIntroContinueInFlight = true;

      audio?.playSfx?.("fs_click", 1.0);

      // prevent double-trigger while fading (but keep the handler callable in dev)
      // We use the guard above; eventMode stays clickable until we start fading out.

      void (async () => {
        try {
          // 1️⃣ play tractor exit first (same timing you already use)
          if (isMobilePortraitUILayout(__layoutDeps)) {
            await playFsTractorExitPortrait(3000);
          } else {
            await playFsTractorExit(3000);
          }

          // 2️⃣ switch background
          await setBackgroundForMode("FREE_SPINS", true);

          if (!bgBase || !bgFree) return;

          bgBase.visible = false;
          bgBase.alpha = 0;

          bgFree.visible = true;
          bgFree.alpha = 1;

          // 3️⃣ CRITICAL: WAIT for dimmer fade-out to FINISH
          fsDimmer.eventMode = "none"; // now block further taps during the fade
          await new Promise<void>((resolve) => {
            setFsOverlay(false, 0.72, 8, FS_OVERLAY_FADE_OUT_MS);
            setTimeout(resolve, FS_OVERLAY_FADE_OUT_MS);
          });

          // 4️⃣ NOW mark intro finished (this unblocks playSpin)
          state.overlay.fsIntro = false;

          // 5️⃣ reveal core AFTER fade completes
          await waitMs(FS_BG_TO_CORE_PAUSE_MS);
          showGameCoreDelayed(120, 360, 0.9);
          playMusicWhenUnlocked("music_fs", 450);

          fsCarCooldown = 0.6;
        } finally {
          // if the intro is still up for some reason, allow trying again
          if (state.overlay.fsIntro) {
            fsDimmer.eventMode = "static";
          }
          fsIntroContinueInFlight = false;
        }
      })();
    });



    // =====================
    // FS OUTRO PAUSE
    // =====================
    const FS_PRE_OUTRO_PAUSE_MS = 900; // 🔧 try 600–1400


    // =====================
    // "CLICK TO CONTINUE" (slides up from below screen)
    // =====================
    const fsContinueText = new Text({
      text: t("ui.clickToContinue"),
      style: {
        
      } as any,
    });


    fsContinueText.anchor.set(0.5);
    fsContinueText.zIndex = 9450; // above fsDimmer (9400)
    fsContinueText.visible = false;
    fsContinueText.alpha = 0;
    root.addChild(fsContinueText);
    applyClickToContinueStyle(fsContinueText);

    // =====================
    // FS INTRO AWARD TEXT:  "X" + "FREE SPINS" (styled like FS OUTRO)
    // =====================

    // clone the FS OUTRO styles so it matches perfectly
    const fsIntroAmount = new Text({
      text: "0",
      style: {} as any, // ✅ safe placeholder (prevents init crashes)
    } as any);

    fsIntroAmount.anchor.set(0.5);
    fsIntroAmount.visible = false;
    fsIntroAmount.alpha = 0;
    fsIntroAmount.zIndex = 9452;
    root.addChild(fsIntroAmount);
    function applyFsIntroAmountStyle(fontSizePx = 2000) {
      // clone/copy the outro style safely
      const base: any = (fsOutroWinAmount.style as any);
      const baseObj: any = base?.clone ? base.clone() : { ...(base || {}) };

      // IMPORTANT: reassign a fresh TextStyle so Pixi rebuilds the text
      fsIntroAmount.style = new TextStyle({
        ...baseObj,
        fontSize: fontSizePx,
      } as any);
    }

    // ✅ safe to call here because fsIntroAmount now exists
    applyFsIntroAmountStyle();



    // =====================
    // FS INTRO LABEL — DOUBLE STROKE (gold outer + black inner)
    // =====================



    // --- WHITE TEXT WITH BLACK STROKE (FRONT) ---
    const fsIntroLabel = new Text({
      text: t("ui.freeSpins"),
      style: (fsOutroTotalLabel.style as any), // original FS outro style
    } as any);
    fsIntroLabel.anchor.set(0.5);
    fsIntroLabel.visible = false;
    fsIntroLabel.alpha = 0;
    fsIntroLabel.zIndex = 9452;
    root.addChild(fsIntroLabel);



    function layoutFsIntroAward() {
      const W = app.screen.width;
      const H = app.screen.height;

      const cx = Math.round(W * 0.5);

      // =====================
      // GAP TUNING (THIS IS WHAT YOU WANT)
      // =====================
      const FS_INTRO_CENTER_Y = H * 0.52; // overall center of the group
      const FS_INTRO_GAP = 250;           // 👈 increase this (try 80–160)

      fsIntroAmount.position.set(
        cx,
        Math.round(FS_INTRO_CENTER_Y - FS_INTRO_GAP / 2)
      );

      fsIntroLabel.position.set(
        cx,
        Math.round(FS_INTRO_CENTER_Y + FS_INTRO_GAP / 2)
      );
    }





    window.addEventListener("resize", layoutFsIntroAward);


    // ✅ Make the "CLICK TO CONTINUE" text area clickable too
    fsContinueText.eventMode = "static";
    fsContinueText.cursor = "pointer";

    // bigger hit area so it's easy to click (tweak if you want)
    fsContinueText.hitArea = new Rectangle(-340, -60, 680, 120);

    fsContinueText.on("pointertap", (e: any) => {
      e.stopPropagation?.();
      // run the exact same logic as clicking the dimmer
      fsDimmer.emit("pointertap", {} as any);
    });


    const FS_CONTINUE_TARGET_Y_N = 0.95; // 0..1 (lower = higher up)
    const FS_CONTINUE_OFFSCREEN_PAD = 90;

    function fsContinueOffY() {
      return app.screen.height + FS_CONTINUE_OFFSCREEN_PAD;
    }

function fsContinueTargetY() {
  const H = app.screen.height;

  let y = H * FS_CONTINUE_TARGET_Y_N;

  if (isMobileLandscapeUILayout(__layoutDeps)) {
    const safeB = safeInsetBottomPx?.() ?? 0;
    const PAD = 0;

    const halfH = (fsContinueText.getBounds().height || fsContinueText.height || 0) * 0.5;
    const maxY = (H - safeB - PAD) - halfH;

    y = Math.min(y, maxY);
  }

  return y;
}


    function layoutFsContinueX() {
      fsContinueText.x = app.screen.width / 2;
    }
    // =====================
    // BIG WIN "CLICK TO CONTINUE" (slides up from below)
    // =====================
    const BIGWIN_CONTINUE_TARGET_Y_N = .95; // tweak if needed
    const BIGWIN_CONTINUE_OFFSCREEN_PAD = 90;

    function bigWinContinueOffY() {
      return app.screen.height + BIGWIN_CONTINUE_OFFSCREEN_PAD;
    }

   function bigWinContinueTargetY() {
  const H = app.screen.height;

  let y = H * BIGWIN_CONTINUE_TARGET_Y_N;

  if (isMobileLandscapeUILayout(__layoutDeps)) {
    const safeB = safeInsetBottomPx?.() ?? 0;
    const PAD = 0;

    const halfH = (bigWinContinue.getBounds().height || bigWinContinue.height || 0) * 0.5;
    const maxY = (H - safeB - PAD) - halfH;

    y = Math.min(y, maxY);
  }

  return y;
}


    function layoutBigWinContinueX() {
      bigWinContinue.x = app.screen.width / 2;
    }

    function showBigWinContinue(on: boolean, ms = 320) {
      layoutBigWinContinueX();

      const offY = bigWinContinueOffY();
      const targetY = bigWinContinueTargetY();

      if (on) {
        bigWinContinue.visible = true;
        bigWinContinue.alpha = 0;
        bigWinContinue.y = offY;

        tween(ms, (k) => {
          const e = Math.max(0, Math.min(1, k));
          bigWinContinue.alpha = e;
          bigWinContinue.y = offY + (targetY - offY) * e;
        });
      } else {
        const startY = bigWinContinue.y;
        const startA = bigWinContinue.alpha;

        tween(
          ms,
          (k) => {
            const e = Math.max(0, Math.min(1, k));
            bigWinContinue.alpha = startA * (1 - e);
            bigWinContinue.y = startY + (offY - startY) * e;
          },
          () => {
            bigWinContinue.alpha = 0;
            bigWinContinue.y = offY;
            bigWinContinue.visible = false;
          }
        );
      }
    }

    function showFsContinue(on: boolean, ms = 320) {
      layoutFsContinueX();
const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
fsContinueText.scale.set(IS_TINY_VIEW ? 0.5 : 1); // 🔧 0.70..0.85
      const offY = fsContinueOffY();
      const targetY = fsContinueTargetY();

      if (on) {
        fsContinueText.visible = true;
        fsContinueText.alpha = 0;
        fsContinueText.y = offY;

        tween(
          ms,
          (k) => {
            const e = Math.max(0, Math.min(1, k));
            fsContinueText.alpha = e;
            fsContinueText.y = offY + (targetY - offY) * e;
          }
        );
      } else {
        const startY = fsContinueText.y;
        const startA = fsContinueText.alpha;

        tween(
          ms,
          (k) => {
            const e = Math.max(0, Math.min(1, k));
            fsContinueText.alpha = startA * (1 - e);
            fsContinueText.y = startY + (offY - startY) * e;
          },
          () => {
            fsContinueText.alpha = 0;
            fsContinueText.y = offY;
            fsContinueText.visible = false;
          }
        );
      }
    }


function layoutFsDimmer() {
  // draw in ROOT coords (since fsDimmer is a child of root)
  const w = app.screen.width;
  const h = app.screen.height;

  fsDimmer.clear();
  fsDimmer.rect(0, 0, w, h).fill(0x000000);

  // ✅ CRITICAL: make it reliably clickable/tappable
  fsDimmer.hitArea = new Rectangle(0, 0, w, h);
}



    layoutFsAddedPopup();

    // =====================
    // OVERLAY TIMING PRESETS
    // =====================
    const FS_OVERLAY_FADE_IN_MS  = 550;  // slower, more cinematic
    const FS_OVERLAY_FADE_OUT_MS = 260;  // quicker exit feels snappy

    // =====================
// FS RETRIGGER — LANDSCAPE TUNING
// =====================
const FS_ADDED_LAND_AMOUNT_SCALE = 1;   // try 0.65–0.85
const FS_ADDED_LAND_LABEL_SCALE  = 1;

const FS_ADDED_DESK_AMOUNT_SCALE = 1.5;
const FS_ADDED_DESK_LABEL_SCALE  = 1.5;

const FS_ADDED_PORT_AMOUNT_SCALE = 0.75;
const FS_ADDED_PORT_LABEL_SCALE  = 0.80;


    async function showFsAddedPopup(added: number) {
      // Ensure geometry is correct
      layoutFsAddedPopup();
        // 🔊 FS RETRIGGER SFX (plays immediately when popup appears)
  audio?.playSfxThrottled?.("fstrigger", 200, 1.0, 1.0);

      fsAddedAmountText.text = `+${added}`;



      // start state
    fsAddedAmountText.visible = true;
    fsAddedLabelText.visible = true;

    fsAddedAmountText.alpha = 0;
    fsAddedLabelText.alpha = 0;

function getFsAddedBaseScales() {
  if (isMobileLandscapeUILayout(__layoutDeps)) {
    return { amount: FS_ADDED_LAND_AMOUNT_SCALE, label: FS_ADDED_LAND_LABEL_SCALE };
  }
  if (isMobilePortraitUILayout(__layoutDeps)) {
    return { amount: FS_ADDED_PORT_AMOUNT_SCALE, label: FS_ADDED_PORT_LABEL_SCALE };
  }
  return { amount: FS_ADDED_DESK_AMOUNT_SCALE, label: FS_ADDED_DESK_LABEL_SCALE };
}


const { amount: amountBaseScale, label: labelBaseScale } = getFsAddedBaseScales();

fsAddedAmountText.scale.set(amountBaseScale, amountBaseScale * 1.15);
fsAddedLabelText.scale.set(labelBaseScale,  labelBaseScale  * 1.15);


      const dimTarget = 0.55;
      const inMs = 160;
      const holdMs = 1200;
      const outMs = 220;

      const tweenP = (ms: number, fn: (k: number) => void) =>
        new Promise<void>((resolve) => tween(ms, fn, resolve));

      // fade in
    fsAddedDimmer.visible = true;

    await tweenP(inMs, (k) => {
      fsAddedDimmer.alpha = dimTarget * k;

      fsAddedAmountText.alpha = k;
      fsAddedLabelText.alpha = k;

     const s = 0.92 + 0.08 * k;

fsAddedAmountText.scale.set(
  amountBaseScale * s,
  amountBaseScale * 1.15 * s
);

fsAddedLabelText.scale.set(
  labelBaseScale * s,
  labelBaseScale * 1.15 * s
);

      
    });


      await waitMs(holdMs);

      // fade out
    const startDim = fsAddedDimmer.alpha;
    const startAA = fsAddedAmountText.alpha;
    const startAL = fsAddedLabelText.alpha;

    await tweenP(outMs, (k) => {
      const e = 1 - k;

      fsAddedDimmer.alpha = startDim * e;
      fsAddedAmountText.alpha = startAA * e;
      fsAddedLabelText.alpha  = startAL * e;

     const s = 0.98 + 0.02 * e;

fsAddedAmountText.scale.set(
  amountBaseScale * s,
  amountBaseScale * 1.15 * s
);

fsAddedLabelText.scale.set(
  labelBaseScale * s,
  labelBaseScale * 1.15 * s
);
    });

    fsAddedDimmer.visible = false;
    fsAddedAmountText.visible = false;
    fsAddedLabelText.visible = false;

    }

    function setFsOverlay(
      on: boolean,
      dimAlpha = 0.72,
      blurStrength = 8,
      ms = 300
    ) {
      if (on) {
         // 🔊 FS INTRO CONFIRM SFX (plays once at start)
  audio?.initFromUserGesture?.(); // safe if already unlocked
  audio?.playSfx?.("confirm", 0.9);
        // ✅ FS intro: keep whatever music is currently playing, just duck it
audio?.setBaseMusicIntensity?.(0.15, 250);

  // ✅ FS intro tractor loop (fade in, loops only during intro overlay)
  audio?.startFsIntroTractorLoop?.(420, 0.85);

        

  state.overlay.fsIntro = true;
  

        
        gameCore.alpha = 0;
    (gameCore as any).eventMode = "none";

      


        // ✅ HARD HIDE multiplier plaque during FS intro
multPlaqueLayer.visible = false;
        // ✅ ABSOLUTELY NO FS CAR during FS intro overlay
    if (fsCarLive) {
      fsCarLive.s.removeFromParent();
      fsCarLive = null;
    }
    fsCarCooldown = 9999; // freeze FS car respawn until intro ends


        layoutFsDimmer();
        fsDimmer.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

        fsDimmer.visible = true;
        root.sortChildren();
      fsDimmer.eventMode = "static";   // ✅ clickable anywhere
    fsDimmer.cursor = "pointer";     // optional, feels better


    fadeUiLayerTo(0, ms); // ✅ hide UI during FS intro overlay

        fadeGameTo(0, 0.92, ms); // shrink slightly while fading out


        zoomBackgroundTo(1.06, ms + 200);

        showFsContinue(true, ms);
        showFsTractorEnter(ms + 5500);

        // ✅ FS intro award text (X + FREE SPINS) — drop in from above
    fsIntroAmount.text = String(state.fs.remaining); // or state.fs.total if you prefer







        const startA = fsDimmer.alpha;
        const startB = bgBlur.strength;
        

        tween(
          ms,
          (k) => {
            fsDimmer.alpha = startA + (dimAlpha - startA) * k;
            bgBlur.strength   = startB + (blurStrength - startB) * k;
          }
        );
      } else {
        // ✅ stop tractor loop as the intro ends (fade out)
audio?.stopFsIntroTractorLoop?.(350);
       audio?.setBaseMusicIntensity?.(audio?.getBaseMusicIntensity01?.() ?? 1.0, 350);


        zoomBackgroundTo(1.0, ms);
        // fadeGameTo(1, 1.0, ms); // ✅ don't restore here — we will reveal later with showGameCoreDelayed()

        showFsContinue(false, ms);
        const startA = fsDimmer.alpha;
        const startB = bgBlur.strength;

        tween(
          ms,
          (k) => {
            fsDimmer.alpha = startA * (1 - k);
            bgBlur.strength   = startB * (1 - k);
          },
          () => {
            fsDimmer.alpha = 0;
            bgBlur.strength = 0;
            fsDimmer.visible = false;
            fadeUiLayerTo(1, ms); // ✅ restore UI after FS intro closes
            fsDimmer.eventMode = "none"; // unblock input
            state.overlay.fsIntro = false; // ✅ unlock game input again
            // ✅ FS intro ended — allow plaque to appear again (layout decides if/where)
layoutMultiplierPlaque();
                    // ✅ hide FS intro award text
            fsIntroAmount.visible = false;
            fsIntroLabel.visible = false;
            fsIntroAmount.alpha = 0;
            fsIntroLabel.alpha = 0;


          }
        );
      }
    }



    const reelHouseLayer = new Container(); // frame
    const gridLayer = new Container();      // symbols + overlays
    gridLayer.sortableChildren = true;

// IMPORTANT: zIndex only works if sortableChildren = true
    root.sortableChildren = true;
    const payFrameLayer = new Container();








    payFrameLayer.zIndex = 999;             // ensure above symbols


    // Make sure these exist and are added in the right order:
    gridLayer.zIndex = 2000;
    backgroundLayer.zIndex = 0;
    reelHouseLayer.zIndex = 1000;   // reel art
    payFrameLayer.zIndex = 2100;    // frames ABOVE reel art + symbols



    type VoxelExplode = {
      g: Graphics;
      sh: Graphics;
      vx: number;
      vy: number;
      rotV: number;
      life: number;
      life0: number;
    };
    // =====================
    // VOXEL EXPLODE CONSTANTS (shared by spawn + ticker)
    // =====================
    const VOX = 7;
    const GRAVITY = 2200;
    const FADE_START_T = 0.35;


    const voxelExplodeLive: VoxelExplode[] = [];

    // =====================
    // VOXEL EXPLODE — CENTRAL UPDATE LOOP (PERF FIX)
    // =====================
  addSystem((dt) => {
    dt = Math.min(0.033, dt);


      for (let i = voxelExplodeLive.length - 1; i >= 0; i--) {
        const p = voxelExplodeLive[i];
        const g = p.g;
        const sh = p.sh;

        p.vy += GRAVITY * dt;

        g.x += p.vx * dt;
        g.y += p.vy * dt;
        g.rotation += p.rotV * dt;

        sh.x = g.x;
        sh.y = g.y + VOX * 0.85;

        p.life -= dt;
        const t01 = 1 - p.life / p.life0;

        // fade
        let a = 1;
        if (t01 >= FADE_START_T) {
          const k = (t01 - FADE_START_T) / (1 - FADE_START_T);
          a = 1 - k * k * (3 - 2 * k);
        }
        g.alpha = a;
        sh.alpha = 0.22 * Math.max(0, 1 - t01 * 3);

        if (p.life <= 0) {
          g.removeFromParent();
          sh.removeFromParent();
          g.destroy();
          sh.destroy();
          voxelExplodeLive.splice(i, 1);
        }
      }
    });



    // =====================
    // VOXEL PERF QUALITY (auto scales voxel count)
    // =====================
    let voxelQ = 1.0; // 0.35..1.0

    addSystem(() => {
    const fps = (app.ticker as any).FPS ?? (1000 / Math.max(1, app.ticker.deltaMS));

      // target: keep 55–60fps
      const target =
        fps >= 55 ? 1.0 :
        fps >= 48 ? 0.8 :
        fps >= 42 ? 0.65 :
        fps >= 36 ? 0.5 :
        0.35;

      // smooth it (no popping)
      voxelQ += (target - voxelQ) * 0.08;
    });

    const voxelExplodeLayer = new Container();
    voxelExplodeLayer.zIndex = 99999;
    voxelExplodeLayer.eventMode = "none";

    // ✅ Put voxel layer on ROOT so it can sit ABOVE the reel dimmer
    root.addChild(voxelExplodeLayer);
    // ✅ put voxel FX ABOVE FS outro / big win overlays too
    voxelExplodeLayer.zIndex = 9600;
    root.sortChildren();
    root.sortChildren();


    const SYMBOL_COLORS: Record<SymbolId, number> = {
      // LOW symbols (gummies)
      L1: 0xd96a1a, // deep burnt orange
      L2: 0x4b2ca3, // green-yellow (lime candy)
      L3: 0x4fae4a, // deep candy purple
      L4: 0xd83434, // deep candy red

      // HIGH symbols
      H1: 0x7fcfff, // baby blue
      H2: 0x8b5a2b, // milk chocolate brown
      H3: 0xff6fae, // pink
      H4: 0x6fdc7a, // light green
      H5: 0xffc107,



      // SPECIALS
      W1: 0xffffff, // rainbow handled separately (see below)
      S1: 0x1e3cff, // dark blue
      
    };
    const L3_HIGHLIGHT = 0xffc84a;



    // =====================
    // VOXEL EXPLODE FX (symbol burst)
    // =====================


    function shade(hex: number, mul: number): number {
      const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) * mul));
      const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) * mul));
      const b = Math.max(0, Math.min(255, (hex & 255) * mul));
      return ((r | 0) << 16) | ((g | 0) << 8) | (b | 0);
    }
    // =====================
    // VOXEL EXPLODE: spawn burst at a symbol position
    // =====================
    function spawnVoxelBurstAt(
      
      x: number,
      y: number,
      color: number,
      biasDir?: { x: number; y: number },
      color2?: number,
      mixChance = 0.7
    )
    {
  


    if (!voxelExplodeLayer.parent) {
      root.addChild(voxelExplodeLayer);
      voxelExplodeLayer.zIndex = 2062;
      root.sortChildren();
    }

        // =====================
      // TUNING KNOBS
      // =====================
      const VOX =7;                    // voxel size
      const BASE_COUNT = 28;            // base voxel count
      const COUNT = Math.max(10, Math.floor(BASE_COUNT * voxelQ * 1.1));


    const LIFE_MS = 900;        // ⬅️ was 1500 (much snappier)

    const SPEED_MIN = 420;
    const SPEED_MAX = 720;



      const START_ALPHA = 1.0;

      // ✅ direction bias strength (0 = random, 1 = strong outward)
      const BIAS = 0.65;

      // normalize biasDir if provided
      let bdx = 0, bdy = 0;
      if (biasDir) {
        const bl = Math.hypot(biasDir.x, biasDir.y) || 1;
        bdx = biasDir.x / bl;
        bdy = biasDir.y / bl;
      }

      // rainbow prism palette for W1 (when color is passed as 0xffffff)
      const prism = [0xd96a1a,0x6b3fd6,0x9bdc4f,0xd83434,0x8b5a2b];

    

      for (let n = 0; n < COUNT; n++) {
        const g = new Graphics();

        // ✅ cube color selection
      const twoTone = typeof color2 === "number";

    let baseCol = color;

    if (color === 0xffffff) {
      baseCol = prism[(Math.random() * prism.length) | 0];
    } else if (twoTone) {
      // 70% base, 30% highlight
      baseCol = Math.random() < mixChance ? color : (color2 as number);

    }


        // ✅ RANDOM HEIGHT (organic break-up)
        const h = VOX * (0.65 + Math.random() * 0.55);  // 0.65..1.2 * VOX
        const hw = VOX;
        const hh = VOX * 0.55;

        // ✅ FACE COLORS
        let topCol: number, leftCol: number, rightCol: number;

        if (color === 0xffffff) {
          // ✅ WILD PRISM: give each face a slightly different hue from palette
          topCol = prism[(Math.random() * prism.length) | 0];
          leftCol = prism[(Math.random() * prism.length) | 0];
          rightCol = prism[(Math.random() * prism.length) | 0];
        } else {
          // normal symbol: shaded faces
          topCol = shade(baseCol, 1.15 + Math.random() * 0.06);
          leftCol = shade(baseCol, 0.95 + Math.random() * 0.06);
          rightCol = shade(baseCol, 0.80 + Math.random() * 0.06);
        }

        // ✅ draw cube (3 faces)
  // TOP
  g
    .moveTo(0, -hh)
    .lineTo(hw, 0)
    .lineTo(0, hh)
    .lineTo(-hw, 0)
    .closePath()
    .fill({ color: topCol, alpha: 1 });

  // LEFT
  g
    .moveTo(-hw, 0)
    .lineTo(0, hh)
    .lineTo(0, hh + h)
    .lineTo(-hw, h)
    .closePath()
    .fill({ color: leftCol, alpha: 1 });

  // RIGHT
  g
    .moveTo(hw, 0)
    .lineTo(0, hh)
    .lineTo(0, hh + h)
    .lineTo(hw, h)
    .closePath()
    .fill({ color: rightCol, alpha: 1 });

  // ✅ SHADOW “KISS” (cheap): small blurred ellipse beneath cube
  const sh = new Graphics();

  sh
    .ellipse(0, 0, VOX * 0.9, VOX * 0.45)
    .fill({ color: 0x000000, alpha: 1 });

  // cheap shadow — no blur
  sh.alpha = 0.18;


    sh.scale.y = 0.6;

        // spawn jitter
        const jx = (-22 + Math.random() * 24);
        const jy = (-22 + Math.random() * 24);

        g.x = x + jx;
        g.y = y + jy;

        sh.x = g.x;
        sh.y = g.y + (VOX * 0.85); // “touch” under the cube

        // ✅ random direction with outward bias
        const ang = Math.random() * Math.PI * 2;
        const sp = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);

        let vx = Math.cos(ang) * sp;
        let vy = Math.sin(ang) * sp - (300 + Math.random() * 200);

        // blend in bias direction (outward)
        if (biasDir) {
          vx = vx * (1 - BIAS) + (bdx * sp) * BIAS;
          vy = vy * (1 - BIAS) + (bdy * sp) * BIAS;
        }

        const rotV = (-1 + Math.random() * 2) * 7.5;
        g.alpha = START_ALPHA;

        // add shadow first so it sits behind cube
        voxelExplodeLayer.addChild(sh);
        voxelExplodeLayer.addChild(g);

        // ===== per-voxel physics loop =====
        voxelExplodeLive.push({
      g,
      sh,
      vx,
      vy,
      rotV,
      life: LIFE_MS / 1000,
      life0: LIFE_MS / 1000,
    });
      }

    }


    type VoxelParticle = {
      g: Graphics;
      vx: number;
      vy: number;
      vr: number;
      life: number;
      life0: number;
      grav: number;
    };

    const voxelPool: VoxelParticle[] = [];
    const voxelLive: VoxelParticle[] = [];
    let voxelTickerAdded = false;

    function tickVoxelExplodeFx() {
      const dt = app.ticker.deltaMS / 1000;

      for (let i = voxelLive.length - 1; i >= 0; i--) {
        const p = voxelLive[i];
        const g = p.g;

        p.vy += p.grav * dt;

        g.x += p.vx * dt;
        g.y += p.vy * dt;
        g.rotation += p.vr * dt;

        // fade out
        p.life -= dt;
        const k = Math.max(0, p.life / p.life0); // 1 -> 0
        g.alpha = k;

        // tiny shrink near the end
        const s = 0.9 + 0.1 * k;
        g.scale.set(s);

        if (p.life <= 0) {
          g.removeFromParent();
          voxelLive.splice(i, 1);
          voxelPool.push(p);
        }
      }
    }

    function startVoxelExplodeFx() {
      if (voxelTickerAdded) return;
      voxelTickerAdded = true;
      addSystem(() =>tickVoxelExplodeFx());
    }

    startVoxelExplodeFx();

    // =====================
    // GAME CORE (scales from screen center)
    // =====================
    const gameCore = new Container();
    gameCore.sortableChildren = true;
    gameCore.zIndex = 1500;
    root.addChild(gameCore);
    __buildSceneGraphOnce();

    // ✅ FINAL: mount reel + grid AFTER gameCore exists
gameCore.addChild(reelHouseLayer);
gameCore.addChild(gridLayer);

// ensure ordering inside gameCore
reelHouseLayer.zIndex = 1000;
gridLayer.zIndex = 2000;
gameCore.sortChildren();
// ✅ WIN FRAMES LAYER (must be in scene graph)

gameCore.sortChildren();

    // ✅ Prevent 1-frame flash before splash takes control
    gameCore.alpha = 0;
    (gameCore as any).eventMode = "none";




 
    // FS counter should scale with the rest of the game core
    gameCore.addChild(fsCounterWrap);

    // =====================
    // IN-GAME STUDIO TAG (persistent) — "8-BIT WIZARDRY" (no PRESENTS)
    // =====================
    const studioTag = new Text({
      text: "8-BIT\nWIZARDRY",
      style: {
      fontFamily: "Micro5",
      fill: 0xffffff,
      fontSize: 34,
      align: "center",
      letterSpacing: 2,


      } as any,
    });
    forceMicro5(studioTag);
    studioTag.anchor.set(0.5);
   studioTag.zIndex = 5; // now on root, screen-space
    studioTag.eventMode = "none";
    root.addChild(studioTag);
root.sortChildren();

function layoutStudioTag() {
  // 🚫 NEVER show studio tag during any blocking overlay/menu
  if (
    state.overlay.splash ||
    state.overlay.boot ||
    state.overlay.startup ||
    loadingLayer?.visible ||

    // ✅ overlays you mentioned
    state.overlay.fsIntro ||
    state.overlay.fsOutro ||
    state.overlay.fsOutroPending ||
    state.overlay.bigWin ||


   
    (autoMenuApi?.isOpen?.() ?? false)
  ) {
    studioTag.visible = false;
    studioTag.alpha = 0;
    return;
  }

  // ✅ MAIN GAME RULE:
  // Hide on: tablet portrait, tablet landscape, mobile landscape
  // Show on: desktop, mobile portrait
  const hideInMainGame =
    isMobileLandscapeUILayout(__layoutDeps) ||
    isTabletPortrait(__layoutDeps) ||
    isTabletLandscape(__layoutDeps);

  if (hideInMainGame) {
    studioTag.visible = false;
    studioTag.alpha = 0;
    return;
  }

  // ---- existing positioning for desktop + mobile portrait ----
  const safeT = safeInsetTopPx?.() ?? 0;

  studioTag.anchor.set(0, 0);

  const x = isMobilePortraitUILayout(__layoutDeps) ? 16 : 24;
  const y = isMobilePortraitUILayout(__layoutDeps) ? (safeT + 12) : 20;

  studioTag.position.set(Math.round(x), Math.round(y));
  studioTag.alpha = 0.85;

  // ✅ scale tweak (desktop slightly smaller)
  studioTag.scale.set(isMobilePortraitUILayout(__layoutDeps) ? 0.90 : 0.80);
if (isMobilePortraitUILayout(__layoutDeps)) {
  studioTag.scale.set(studioTag.scale.x * 0.6);
}
  studioTag.visible = true;
}






// =====================
// GAME TITLE SCALE LOCK (prevents mobile snap)
// =====================
let titleBaseScale = 1;
let titleScaleLocked = false;
    // =====================
    // GAME TITLE (right of reel house)
    // =====================
  const gameTitle = new Sprite(Texture.WHITE); // placeholder until atlases ready


    gameTitle.anchor.set(0, 0.5);
    gameTitle.zIndex = 1200;

  

    // prevent inherited scaling from gameCore
    gameTitle.eventMode = "none";

    gameTitle.anchor.set(0, 0.5);
    gameTitle.zIndex = 1200;
    gameCore.addChild(gameTitle);


    gameCore.sortableChildren = true; // so zIndex works inside
    gameCore.zIndex = 1500;           // above backgroundLayer (0), below fsDimmer (9400)

    gameTitle.visible = false; // ✅ prevent 1-frame flash before drop-in


    const MOBILE_LANDSCAPE_TITLE_MUL = 0.43; // 🔧 try 0.75–0.95 (smaller = smaller)

    

    // keep gameCore scaling from screen center (no movement at scale=1)
    function layoutGameCorePivot() {
      
      const cx = app.screen.width / 2;
      const cy = app.screen.height / 2;
      gameCore.pivot.set(cx, cy);
      gameCore.position.set(cx, cy);



    }

    window.addEventListener("resize", layoutGameCorePivot);


    // =====================
    // ANTICIPATION ZOOM (gameCore + background)
    // =====================
    let anticipationZoomToken = 0;

function applyGameTitleScaleFromBase() {
  if (!gameTitle) return;

  // Cancel out gameCore "anticipation" zoom so the title doesn't pop larger.
  const coreS = Math.max(0.001, gameCore?.scale?.x ?? 1);

  // Keep the title sized from reel sizing (titleBaseScale), not from gameCore zoom.
  const s = titleBaseScale / coreS;

  gameTitle.scale.set(s);
}


    function startAnticipationZoom(ms = 520, coreScale = 1.04, bgScale = 1.03) {
      // don't fight the FS intro/outro zooms
      if (state.overlay.fsIntro || state.overlay.fsOutro) return;
audio?.setBaseMusicIntensity?.(0.85, 250);
      anticipationZoomToken++;
      const token = anticipationZoomToken;

      const startCore = gameCore.scale.x || 1;

      tween(ms, (k) => {
        if (token !== anticipationZoomToken) return;
        const e = k * k * (3 - 2 * k); // smoothstep
        const s = startCore + (coreScale - startCore) * e;
        gameCore.scale.set(s);
        applyGameTitleScaleFromBase();

      });

      // background zoom (uses your existing pivot/zoom system)
      zoomBackgroundTo(bgScale, ms + 80);
    }

    function endAnticipationZoom(ms = 260, baseCoreScale = 1, baseBgScale = 1) {
      // don't fight the FS intro/outro zooms
      if (state.overlay.fsIntro || state.overlay.fsOutro) return;
audio?.setBaseMusicIntensity?.(0.25, 400);
      anticipationZoomToken++;
      const token = anticipationZoomToken;

      const startCore = gameCore.scale.x || 1;
      

      tween(
        ms,
        (k) => {
          if (token !== anticipationZoomToken) return;
          const e = k * k * (3 - 2 * k); // smoothstep
          const s = startCore + (baseCoreScale - startCore) * e;
          gameCore.scale.set(s);
          applyGameTitleScaleFromBase();
        },
        () => {
          if (token === anticipationZoomToken) gameCore.scale.set(baseCoreScale);
          applyGameTitleScaleFromBase();
        }
      );

      zoomBackgroundTo(baseBgScale, ms);
    }

    // =====================
    // SCATTER PULSE (during anticipation)
    // =====================
    let scatterPulseToken = 0;

    function startScatterPulseDuringAnticipation(grid: Cell[], ms = 520) {
      scatterPulseToken++;
      const token = scatterPulseToken;

      const scatters: { s: Sprite; base: number }[] = [];

    for (let i = 0; i < CELL_COUNT; i++) {
      if (grid[i]?.id !== "S1") continue;

      const s = cellViews[i]?.sprite as Sprite | undefined;
      if (!s || !s.parent) continue;

      // ---- LIFT SCATTER ABOVE MASK ----
      const fromParent = s.parent as Container;
      const fromIndex = fromParent.getChildIndex(s);
      const fromZ = s.zIndex ?? 0;

      const gp = s.getGlobalPosition();
      fromParent.removeChild(s);
      scatterPulseLayer.addChild(s);
      s.position.copyFrom(scatterPulseLayer.toLocal(gp));

      s.zIndex = 10;

      liftedScatterSprites.push({ s, fromParent, fromIndex, fromZ });

      scatters.push({ s, base: s.scale.x });
    }

      if (!scatters.length) return;

      const up = 1.12; // how strong the pulse is
      const half = Math.max(90, Math.floor(ms * 0.45));

      const loop = async () => {
        while (token === scatterPulseToken) {
          // scale up
          await animateMs(half, (t) => {
            if (token !== scatterPulseToken) return;
            const e = t * t * (3 - 2 * t); // smoothstep
            for (const it of scatters) it.s.scale.set(it.base * (1 + (up - 1) * e));
          });

          // scale down
          await animateMs(half, (t) => {
            if (token !== scatterPulseToken) return;
            const e = t * t * (3 - 2 * t);
            for (const it of scatters) it.s.scale.set(it.base * (up - (up - 1) * e));
          });
        }

        // restore
        for (const it of scatters) it.s.scale.set(it.base);
      };

      void loop();
    }


    function stopScatterPulseDuringAnticipation() {
      scatterPulseToken++;

      // ---- RESTORE LIFTED SCATTERS ----
      for (const rec of liftedScatterSprites) {
        const { s, fromParent, fromIndex, fromZ } = rec;
        if (!s) continue;

        const gp = s.getGlobalPosition();
        if (s.parent) s.parent.removeChild(s);

        const safeIndex = Math.min(fromIndex, fromParent.children.length);
        fromParent.addChildAt(s, safeIndex);
        s.position.copyFrom(fromParent.toLocal(gp));
        s.zIndex = fromZ;
      }

      liftedScatterSprites.length = 0;
    }




    // =====================
    // REEL FLASH (brightness bump overlay)
    // =====================
    const reelFlash = new Graphics();
    reelFlash.zIndex = 2600; // above reel + symbols (but your win overlays can still sit higher)
    reelFlash.alpha = 0;
    reelFlash.visible = true;
    (reelFlash as any).blendMode = "add";
    root.addChild(reelFlash);



  function layoutReelFlash() {
const b = gridMask.getBounds(); // ✅ exact visible reel window


  const isPortrait = isMobilePortraitUILayout(__layoutDeps);

  // 🔧 TUNING
  const PAD_Y = 18;                 // vertical padding stays “reel-ish”
  const SIDE_MARGIN = 14;           // device edge margin in portrait
  const PAD_X_DESKTOP = 18;         // original desktop padding
  const PAD_Y_DESKTOP = 32;

  reelFlash.clear();

  if (isPortrait) {
    // Fit flash to device width (root coords match screen coords)
    const W = app.screen.width;

    const x = Math.round(SIDE_MARGIN);
    const w = Math.round(W - SIDE_MARGIN * 2);

    const y = Math.round(b.y - PAD_Y);
    const h = Math.round(b.height + PAD_Y * 2);

    reelFlash.rect(x, y, w, h).fill(0xffffff);
    return;
  }

  // desktop / non-portrait: keep original behavior
 // desktop / non-portrait: custom X/Y padding
const padX = PAD_X_DESKTOP;
const padY = PAD_Y_DESKTOP;

reelFlash
  .rect(
    Math.round(b.x - padX),
    Math.round(b.y - padY),
    Math.round(b.width + padX * 2),
    Math.round(b.height + padY * 2)
  )
  .fill(0xffffff);
  }


    gridLayer.sortableChildren = true;

    

    // If you add children in random places, do this once:






    
    

    // =====================
    // WIN POPUPS — TOPMOST OVERLAY
    // =====================
    const winPopLayer = new Container();
    winPopLayer.sortableChildren = true;
    winPopLayer.zIndex = 20000;   // 🔥 ABOVE EVERYTHING
    winPopLayer.visible = true;
    winPopLayer.eventMode = "none";



    // =====================
    // MULTIPLIER PLAQUE (3-step vertical, updates per cluster win)
    // =====================
const multPlaqueLayer = new Container();

// ✅ Above reels/gameCore, but BELOW all menus/overlays (buy/settings/etc)
multPlaqueLayer.zIndex = 1600;

root.addChild(multPlaqueLayer);
multPlaqueLayer.visible = false;
root.sortChildren();
// ✅ expose plaque layer so tiny-view layout can nudge it without touching other modes
(__layoutDeps as any).multPlaqueLayer = multPlaqueLayer;

// ✅ SAFETY: never allow ladder plaque during FS intro/outro (even if some layout re-enables it)
addSystem(() => {
  if (state.overlay.fsIntro || state.overlay.fsOutro) {
    multPlaqueLayer.visible = false;
  }
});



    const multPlaque = new Container();


    multPlaqueLayer.addChild(multPlaque);

    type PlaqueRow = {
      row: Container;
      bg: Graphics;
      outline: Graphics;
      label: Text;
    };

    const plaqueRows: PlaqueRow[] = [];

    // Base (unscaled) plaque metrics
    const PLAQUE_W = 108;
    // Right-alignment reference (right edge of the plaque)
    const PLAQUE_RIGHT_X = PLAQUE_W;

    const PLAQUE_H = 88;
    const PLAQUE_GAP = 0;



    const PLAQUE_STEP = PLAQUE_H + PLAQUE_GAP;

    // Put the moving rows into their own container so we can mask just the “wheel”
    const multPlaqueWheel = new Container();
    multPlaque.addChild(multPlaqueWheel);

    // ---- MASK (clips the wheel so rows animate in/out cleanly) ----
    // Visible area: 4 slots (top, mid, active, wrap/max)
    const wheelMask = new Graphics()
      .rect(0, 0, PLAQUE_W, PLAQUE_STEP * 4 - PLAQUE_GAP)
      .fill(0xffffff);


    // If you want it to clip a bit tighter at top/bottom, tweak these:
    // wheelMask.y += 2;
    // wheelMask.height -= 4;

    multPlaqueWheel.mask = wheelMask;
    multPlaque.addChild(wheelMask);

    // tweak these to change inactive sizing
    const PLAQUE_SCALES = {
      top: 0.75,    // furthest/inactive
      mid: 0.85,    // next/inactive
      active: 1.00, // current
      max: 0.75,    // the pinned MAX row (if you have it)
    };



    function makePlaqueRow(): PlaqueRow {
      
      const row = new Container();

      const bg = new Graphics();
      bg.rect(0, 0, PLAQUE_W, PLAQUE_H).fill(0xffffff);

      bg.alpha = 0.25;

    const outline = new Graphics();

    // draw stroke INSIDE the box (prevents mask clipping)
    const OUTLINE_W = 2;
    const INSET = OUTLINE_W / 2;

    outline
      .rect(
        INSET,
        INSET,
        PLAQUE_W - OUTLINE_W,
        PLAQUE_H - OUTLINE_W
      )
      .stroke({ width: OUTLINE_W, color: 0x000000, alpha: 1 });


    outline.visible = true; // keep it renderable so it can fade
    outline.alpha = 0;      // start hidden


    

      const label = new Text({
      text: "1x",
      style: {
        fontFamily: "pixeldown",
        fill: 0xffffff,
        fontSize: 55,
        fontWeight: "1",
        letterSpacing: 0,

        // outline
      stroke: { color: 0x000000, width: 6 },


        // shadow
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowAlpha: 0.75,
        dropShadowBlur: 0,
        dropShadowDistance: 7,
        dropShadowAngle: -Math.PI / 5, // ⬇️ straight down
      } as any,
    });

forcePlaquepixeldown(label);


      label.anchor.set(0.5);
      label.x = PLAQUE_W / 2;
      label.y = PLAQUE_H / 2 + 4; // 👈 nudge numbers down (try 3–6)





      // slight italic slant (negative = lean right, positive = lean left)
    label.skew.set(0, .39);   // tweak: -0.12 .. -0.28

    // optional: tiny x scale to keep width feeling “normal”
    label.scale.x = 0.98;


      row.addChild(bg, outline, label);

      multPlaqueWheel.addChild(row);


      return { row, bg, outline, label };

    }

    // Build 4 rows (top=next+2, mid=next+1, active=current, bottom=prev/wrap)
    for (let i = 0; i < 4; i++) {
      const r = makePlaqueRow();

      // keep your right-align logic (pivot to RIGHT-center so scaling stays right-aligned)
      r.row.pivot.set(PLAQUE_W, PLAQUE_H / 2);
      r.row.x = PLAQUE_RIGHT_X;
      r.row.y = i * PLAQUE_STEP + PLAQUE_H / 2;

      plaqueRows.push(r);
    }






    // Small white arrow pointing at ACTIVE (current) row (keep FIXED)
    const plaqueArrow = new Text({
      text: "◀",
      style: {
      fill: 0xffffff,
      fontSize: 25,
      fontWeight: "900",

      // ✅ black outline
  stroke: { color: 0x000000, width: 5 },


      // optional polish
      dropShadow: false,
    } as any,

    });
    

    forcePlaquepixeldown(plaqueArrow);

    plaqueArrow.anchor.set(0.5);
    plaqueArrow.x = PLAQUE_RIGHT_X + 4;
    plaqueArrow.y = 2 * PLAQUE_STEP + PLAQUE_H / 2; // active row (3rd row)

    plaqueArrow.alpha = 0.9;
    multPlaque.addChild(plaqueArrow);

  // Forces LTR so RTL languages can't flip the order
const LTR = "\u200E";

function formatMult(v: number) {
  const isInt = Math.abs(v - Math.round(v)) < 1e-6;
  const n = isInt ? String(Math.round(v)) : v.toFixed(2);

  // OLD was: "1x"   ->   NEW is: "x1" (always, and forced LTR)
  return `${LTR}x${n}`;
}


    // --- slide state ---
    let plaqueIdx = 0;                 // index into LADDER of CURRENT multiplier
    let plaqueAnimBusy = false;
    let queuedTargetIdx: number | null = null;
    function waitForPlaqueIdle() {
      return new Promise<void>((resolve) => {
        const tick = () => {
          if (!plaqueAnimBusy && queuedTargetIdx == null) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }

let pendingFsAward = 0;
    function applyPlaqueState(idx: number) {
    const last = LADDER.length - 1;

    const cur  = LADDER[Math.min(idx, last)] ?? 1;
    const next = LADDER[Math.min(idx + 1, last)] ?? cur;
    const next2 = LADDER[Math.min(idx + 2, last)] ?? next;

    // prev with wrap
    const prev = idx > 0 ? (LADDER[idx - 1] ?? cur) : (LADDER[last] ?? cur);

    // Values top → bottom
    const values: Array<number | null> = [next2, next, cur, prev];

    // If we're near the end, remove extra future slots
    if (idx === last) {
      values[0] = null; // next2 hidden
      values[1] = null; // next hidden
    } else if (idx === last - 1) {
      values[0] = null; // only hide next2
    }


    for (let i = 0; i < 4; i++) {
      const row = plaqueRows[i];
      const v = values[i];

      const hide = (v == null) || shouldHideFutureSlot(i, idx);

      row.row.visible = !hide;
      if (hide) continue;

      row.label.text = formatMult(v);
forcePlaquepixeldown(row.label);
      const maxVal = LADDER[LADDER.length - 1];
      row.label.style.fill = (v === maxVal) ? 0xffd36a : 0xffffff;

      styleRowBySlot(i, row);
    }





    }

      function ladderAtRaw(i: number) {
      return LADDER[i]; // ✅ no clamp
    }

    // ✅ ADD THIS RIGHT HERE ⬇️
    function shouldHideFutureSlot(slot: number, idx: number) {
      const last = LADDER.length - 1;

      // slot mapping:
      // 0 = top (next2)
      // 1 = mid (next)
      // 2 = active (current)
      // 3 = bottom (prev / wrap)
      if (idx >= last) {
        // at MAX: hide both future slots
        return slot === 0 || slot === 1;
      }

      if (idx === last - 1) {
        // one before MAX: hide ONLY next2
        return slot === 0;
      }

      return false;
    }

    function applyPlaqueSlotVisibility(idxForVis: number) {
      for (let slot = 0; slot < 4; slot++) {
        const r = plaqueRows[slot];
        const hide = shouldHideFutureSlot(slot, idxForVis);
        r.row.visible = !hide;
      }
    }




    // prev with wrap (so 0 goes to MAX)
    function ladderPrevWrap(idx: number) {
      const last = LADDER.length - 1;
      if (idx <= 0) return LADDER[last] ?? 1;
      return LADDER[idx - 1] ?? 1;
    }

    // Apply visual styling by slot position (0=top,1=mid,2=active,3=wrap/max)
    function styleRowBySlot(slot: number, r: PlaqueRow) {

      

    // ✅ outline fades (no snapping)
    r.outline.visible = true;
    r.outline.alpha = (slot === 2) ? 1 : 0;


      // ---- DEPTH FX (blur + overall row alpha by slot) ----
      const slotRowAlphas = [0.65, 0.80, 1.00, 0.70]; // top, mid, active, wrap/max
      const slotBlur      = [2,  1,  0.0,  1];

      r.row.alpha = slotRowAlphas[slot] ?? 1;

      const b = slotBlur[slot] ?? 0;
      const prevBlur = (r as any)._blurAmount ?? 0;

    if (Math.abs(prevBlur - b) > 0.01) {
      if (b > 0.01) {
        const f =
    (r as any)._blurFilter ??
    ((r as any)._blurFilter = new BlurFilter({ strength: 0 }));

  (f as any).strength = b; // ✅ v8-safe
  r.row.filters = b > 0.01 ? [f] : null;

        r.row.filters = [f];
      } else {
        r.row.filters = null;
      }
      (r as any)._blurAmount = b;
    }



      const alphas = [0.18, 0.28, 0.55, 0.22];
      r.bg.alpha = alphas[slot] ?? 0.25;

      r.label.alpha = (slot === 2) ? 1 : 0.75;

      if (slot === 2) r.row.scale.set(PLAQUE_SCALES.active);
      else if (slot === 1) r.row.scale.set(PLAQUE_SCALES.mid);
      else if (slot === 0) r.row.scale.set(PLAQUE_SCALES.top);
      else r.row.scale.set(PLAQUE_SCALES.max);
    }

    function restyleAllSlots() {
      for (let i = 0; i < 4; i++) {
        const r = plaqueRows[i];

        // IMPORTANT: use plaqueIdx here (current state of the wheel)
        const hide = shouldHideFutureSlot(i, plaqueIdx);

        r.row.visible = !hide;
        if (hide) continue;

        styleRowBySlot(i, r);
      }
    }




    function slideOneStep(
      dir: 1 | -1,
      onDone: () => void,
      ms = 260,
      easeFn: (t: number) => number = (t) => easeOutBack(t, 2)
    ) {

      if (plaqueIdx >= LADDER.length - 1 && dir === 1) {
      onDone();
      return;
    }
    
      // base slot Y must match how rows were originally placed (+ PLAQUE_H/2)
      const baseY = (i: number) => i * PLAQUE_STEP + PLAQUE_H / 2;

      // move DOWN when dir=+1, move UP when dir=-1
      const shift = dir === 1 ? +PLAQUE_STEP : -PLAQUE_STEP;

      // We DO NOT applyPlaqueState(nextIdx) here (that causes snapping).
      // Instead we recycle one row and only set the incoming row’s value.
      const nextIdx = plaqueIdx + dir;

      // Prepare incoming row offscreen (so it animates in under the mask)
    if (dir === 1) {
      const incoming = plaqueRows[3];
      incoming.row.y = baseY(0) - PLAQUE_STEP;

      const last = LADDER.length - 1;
      const nextIdx = plaqueIdx + 1; // target state after this step

      // Incoming row becomes TOP slot (next2) for the NEXT state:
      const vIdx = nextIdx + 2; // ✅ next2 of next state

    if (vIdx > last) {
      // ✅ DO NOT allow this row to participate in alpha lerps (prevents the "pop")
      incoming.row.visible = false;           // <-- key change
      incoming.row.alpha = 0;
      incoming.bg.alpha = 0;
      incoming.label.alpha = 0;
      incoming.outline.alpha = 0;
      incoming.label.text = "";              // avoid stale text ever flashing
      (incoming as any)._forceHidden = true; // mark it so tween won't touch it
    } else {
      incoming.row.visible = true;
      incoming.row.alpha = 1;
      (incoming as any)._forceHidden = false;
      incoming.label.text = formatMult(ladderAtRaw(vIdx)!);
      styleRowBySlot(0, incoming); // top styling
    }

    }


    else {
        // Recycle top row to become the new incoming BOTTOM row
        const incoming = plaqueRows[0];
        incoming.row.y = baseY(3) + PLAQUE_STEP; // fully below the mask
        incoming.label.text = formatMult(ladderPrevWrap(nextIdx)); // wrap prev for new idx
        styleRowBySlot(3, incoming);
        // ✅ IMPORTANT: during the 12x -> 20x step, hide the extra top slot immediately


      }

        // Capture starting transforms + opacity
      const startYs = plaqueRows.map((r) => r.row.y);
      const startScales = plaqueRows.map((r) => r.row.scale.x);
      const startBgAlphas = plaqueRows.map((r) => r.bg.alpha);
      const startLabelAlphas = plaqueRows.map((r) => r.label.alpha);

      // ✅ overall row opacity + outline fade targets (match styleRowBySlot intent)
      const slotRowAlphas     = [0.65, 0.80, 1.00, 0.70]; // top, mid, active, wrap/max
      const slotOutlineAlphas = [0.00, 0.00, 1.00, 0.00]; // only ACTIVE shows outline

      // Slot targets (top, mid, active, wrap/max)
      const slotScales = [
        PLAQUE_SCALES.top,
        PLAQUE_SCALES.mid,
        PLAQUE_SCALES.active,
        PLAQUE_SCALES.max,
      ];

      const slotBgAlphas    = [0.18, 0.28, 0.55, 0.22];
      const slotLabelAlphas = [0.75, 0.75, 1.00, 0.75];

      // helpers (DECLARE ONCE)
      const wrap = (n: number, m: number) => (n % m + m) % m;
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

      // If shifting down, row i ends in slot i+1. If shifting up, row i ends in slot i-1.
      const dirSlot = shift > 0 ? 1 : -1;

      // Capture starting overall + outline
      const startRowAlphas     = plaqueRows.map((r) => r.row.alpha);
      const startOutlineAlphas = plaqueRows.map((r) => r.outline.alpha);

      // Targets for the new slots (everything lerps TO these)
      const targetScales        = plaqueRows.map((_, i) => slotScales[wrap(i + dirSlot, 4)]);
      const targetBgAlphas      = plaqueRows.map((_, i) => slotBgAlphas[wrap(i + dirSlot, 4)]);
      const targetLabelAlphas   = plaqueRows.map((_, i) => slotLabelAlphas[wrap(i + dirSlot, 4)]);
      const targetRowAlphas     = plaqueRows.map((_, i) => slotRowAlphas[wrap(i + dirSlot, 4)]);
      const targetOutlineAlphas = plaqueRows.map((_, i) => slotOutlineAlphas[wrap(i + dirSlot, 4)]);
    multPlaque.alpha = 1;
  // 🔊 MULTIPLIER PLAQUE STEP-UP SFX (only when climbing up)
if (dir === 1) {
  const muted = audio?.getSfxMuted?.() ?? false;
  const vol = audio?.getSfxVolume01?.() ?? 1;

 

  if (!muted && vol > 0.001) {
    const throttled = audio?.playSfxThrottled?.bind(audio);
    if (throttled) throttled("multiplier", 60, 0.95, 1.0);
    else audio?.playSfx?.("multiplier", 0.95, 1.0);
  }
}
      tween(
      ms,
      (k) => {
        const kPos = k;
        const k01 = Math.max(0, Math.min(1, k));

        for (let i = 0; i < plaqueRows.length; i++) {
          const r = plaqueRows[i];

          r.row.y = startYs[i] + shift * kPos;

          if ((r as any)._forceHidden) {
            r.row.visible = false;
            r.row.alpha = 0;
            r.bg.alpha = 0;
            r.label.alpha = 0;
            r.outline.alpha = 0;
            continue;
          }

          const s = lerp(startScales[i], targetScales[i], k01);
          r.row.scale.set(s);

          r.bg.alpha = lerp(startBgAlphas[i], targetBgAlphas[i], k01);
          r.label.alpha = lerp(startLabelAlphas[i], targetLabelAlphas[i], k01);
          r.row.alpha = lerp(startRowAlphas[i], targetRowAlphas[i], k01);

          r.outline.visible = true;
          r.outline.alpha = lerp(startOutlineAlphas[i], targetOutlineAlphas[i], k01);
        }
      },
      () => {
        if (dir === 1) plaqueRows.unshift(plaqueRows.pop()!);
        else plaqueRows.push(plaqueRows.shift()!);

        for (let i = 0; i < plaqueRows.length; i++) {
          plaqueRows[i].row.y = baseY(i);
        }

        multPlaque.alpha = 1;
        onDone();
      },
      easeFn
    );

    }







    function runToIdx(targetIdx: number) {
      if (targetIdx === plaqueIdx) return;

      plaqueAnimBusy = true;

      const dir: 1 | -1 = targetIdx > plaqueIdx ? 1 : -1;

      const stepOnce = () =>
        new Promise<void>((resolve) => {
          slideOneStep(dir, () => {
            plaqueIdx += dir;

            // ✅ keep visuals/state correct after each step
            applyPlaqueState(plaqueIdx);
            restyleAllSlots();
            applyPlaqueSlotVisibility(plaqueIdx);

            resolve();
          });
        });

      // ✅ multi-step runner
      (async () => {
        while (plaqueIdx !== targetIdx) {
          await stepOnce();
        }

        plaqueAnimBusy = false;

        // handle queued updates if any
        if (queuedTargetIdx !== null && queuedTargetIdx !== plaqueIdx) {
          const q = queuedTargetIdx;
          queuedTargetIdx = null;
          runToIdx(q);
        } else {
          queuedTargetIdx = null;
        }
      })();
    }



    function updateMultiplierPlaque(current: number) {
      // Find current index in LADDER (fallback to 0)
      let idx = LADDER.findIndex((x) => Math.abs(x - current) < 1e-6);
      if (idx < 0) idx = 0;

      if (plaqueAnimBusy) {
        queuedTargetIdx = idx;
        return;
      }

      // first time / no animation needed
      if (idx === plaqueIdx) {
        applyPlaqueState(plaqueIdx);
        return;
      }

      runToIdx(idx);
    }

    function slideOneStepP(
      dir: 1 | -1,
      ms = 260,
      easeFn: (t: number) => number = (t) => easeOutBack(t, 2)
    ) {
      return new Promise<void>((resolve) => slideOneStep(dir, resolve, ms, easeFn));
    }


    async function animatePlaqueReturnToBase() {
      queuedTargetIdx = null;

      // ✅ clear any force-hidden flags so returning looks clean
      for (const r of plaqueRows as any[]) {
        r._forceHidden = false;
        r.row.visible = true;
      }

      const RESET_STEP_MS = 120; // tweak 90..140 (lower = faster)
      while (plaqueIdx > 0) {
        // ✅ fast + smooth (no bouncy “land” per step)
        await slideOneStepP(-1, RESET_STEP_MS, easeOutCubic);

        plaqueIdx -= 1;
        applyPlaqueState(plaqueIdx);
        restyleAllSlots();
        applyPlaqueSlotVisibility(plaqueIdx);
        setMult(LADDER[plaqueIdx] ?? 1);

        // ✅ no extra pause between steps
      }
    }







    // Boot default
    applyPlaqueState(0);

    restyleAllSlots();

let allowGameTitle = false;
let snapTitleAfterFsReturn = false;
    // =====================
    // TITLE DROP-IN (boot + return-to-base)
    // =====================
    let TITLE_DROP_MS = 1200;
    let TITLE_DROP_OFFSCREEN_PAD = 140;

    let titleDropActive = false;

    // =====================
    // TITLE IDLE FLOAT (slow drift on idle)
    // =====================
    let titleBaseX = 0;
    let titleBaseY = 0;

    let titleFloatT = 0;

    // tweak to taste
    const TITLE_FLOAT_AMP_Y = 10;      // px
    const TITLE_FLOAT_AMP_X = 4;       // px
    const TITLE_FLOAT_SPD = 0.18;      // cycles/sec-ish (lower = slower)

    // optional tiny rotation (comment out if you don't want it)
    const TITLE_FLOAT_ROT = 0.012;     // radians
    let titleFloatBlend = 0;                 // 0..1
    const TITLE_FLOAT_BLEND_IN_MS = 520;     // tweak: 300–700


let titleDropToken = 0;
   function animateTitleDropIn(ms = TITLE_DROP_MS) {
// ✅ MOBILE PORTRAIT + TABLET PORTRAIT: never show the PNG title
const tabletPort =
  (isTabletPortrait?.(__layoutDeps) ?? false) ||
  ((isTabletLike?.(__layoutDeps) ?? false) && app.screen.height >= app.screen.width);

if (isMobilePortraitUILayout(__layoutDeps) || tabletPort) {
  allowGameTitle = false;
  titleDropActive = false;
  gameTitle.visible = false;
  gameTitle.alpha = 0;
  return;
}

  allowGameTitle = true; // ✅ safety: any drop-in call should permit title visibility


titleScaleLocked = true;
applyGameTitleScaleFromBase(); // ✅ uses titleBaseScale and cancels gameCore zoom correctly

  // ✅ cancel any previous in-flight drop
  const token = ++titleDropToken;

  // Make sure target position is up to date
  layoutMultiplierPlaque();
  layoutStudioTag();

  const targetX = gameTitle.x;
  const targetY = gameTitle.y;

  // start off-screen (above)
  const offY = -gameTitle.height - TITLE_DROP_OFFSCREEN_PAD;

  titleDropActive = true;

  // stop idle float during the drop
  titleFloatBlend = 0;
  gameTitle.rotation = 0;

  gameTitle.visible = true;
  gameTitle.alpha = 1;
  gameTitle.x = targetX;
  gameTitle.y = offY;

  tween(
    ms,
    (k) => {
      // ✅ if a newer drop started, ignore this one
      if (token !== titleDropToken) return;

      const t = Math.max(0, Math.min(1, k));
      const e = easeOutBack(t, 1.25); // tweak 1.15–1.45

      gameTitle.y = offY + (targetY - offY) * e;
    },
    () => {
      // ✅ only the latest drop is allowed to finalize
      if (token !== titleDropToken) return;

      titleDropActive = false;

      // lock exact landed position as the new "rest" base
      gameTitle.x = targetX;
      gameTitle.y = targetY;
      titleBaseX = targetX;
      titleBaseY = targetY;

      // restart the float phase so it ramps cleanly
      titleFloatT = 0;
      titleFloatBlend = 0;

      tween(
        TITLE_FLOAT_BLEND_IN_MS,
        (kk) => {
          if (token !== titleDropToken) return;
          titleFloatBlend = Math.max(0, Math.min(1, kk));
        },
        () => {
          if (token !== titleDropToken) return;
          titleFloatBlend = 1;
        }
      );
    }
  );

}
function showTitleAtRestAndFloat() {
  // ✅ MOBILE PORTRAIT + TABLET PORTRAIT: never show the PNG title
  const tabletPort =
    (isTabletPortrait?.(__layoutDeps) ?? false) ||
    ((isTabletLike?.(__layoutDeps) ?? false) && app.screen.height >= app.screen.width);

  if (isMobilePortraitUILayout(__layoutDeps) || tabletPort) {
    allowGameTitle = false;
    titleDropActive = false;
    gameTitle.visible = false;
    gameTitle.alpha = 0;
    return;
  }

  allowGameTitle = true;

  // Cancel any in-flight drop
  titleDropToken++;

  // Make sure layout computes titleBaseX/titleBaseY for current view
  layoutMultiplierPlaque();

  // Put it immediately in place
  gameTitle.visible = true;
  gameTitle.alpha = 1;
  gameTitle.rotation = 0;

  gameTitle.x = Math.round(titleBaseX || gameTitle.x);
  gameTitle.y = Math.round(titleBaseY || gameTitle.y);

  // Start (or resume) the float smoothly
  titleDropActive = false;
  titleFloatT = 0;

  // If you want it to fade the float in (nice), ramp it quickly
  titleFloatBlend = 0;
  tween(
    240, // 🔧 quick ramp (try 180..320)
    (k) => {
      titleFloatBlend = Math.max(0, Math.min(1, k));
    },
    () => {
      titleFloatBlend = 1;
    }
  );
}



function layoutMultiplierPlaque() {
  
 const tabletPort =
  (isTabletPortrait?.(__layoutDeps) ?? false) ||
  ((isTabletLike?.(__layoutDeps) ?? false) && app.screen.height >= app.screen.width);


  // -------------------------
  // ✅ ALWAYS LAYOUT THE TITLE FIRST (so drop-in has a real target)
  // -------------------------
  const isDesktop =
    !isMobilePortraitUILayout(__layoutDeps) &&
    !isMobileLandscapeUILayout(__layoutDeps);

// portrait: you intentionally hide the PNG title
const TITLE_BLOCKED =
  !allowGameTitle ||
  state.overlay.boot ||
  loadingLayer?.visible ||
  state.overlay.splash ||
  state.overlay.startup ||
  state.overlay.fsIntro ||
  state.overlay.fsOutro ||
  state.overlay.fsOutroPending ||
  state.overlay.bigWin ||
  state.ui.settingsOpen ||
  state.ui.buyMenuOpen;

// ✅ HARD RULE: never show title in MOBILE PORTRAIT OR TABLET PORTRAIT
if (isMobilePortraitUILayout(__layoutDeps) || tabletPort) {
  gameTitle.visible = false;
  gameTitle.alpha = 0;
} else if (TITLE_BLOCKED && !titleDropActive) {
  // ✅ Prevent the 1-frame “flash” before drop animation
  gameTitle.visible = false;
  gameTitle.alpha = 0;
} else {
  const GAP_X = Math.round(cellSize * 0.33);
  const ox = (isDesktop ? TITLE_OFFSET_X_DESKTOP : TITLE_OFFSET_X) + GAP_X;
  const oy = isDesktop ? TITLE_OFFSET_Y_DESKTOP : TITLE_OFFSET_Y;

  gameTitle.visible = true;
  gameTitle.alpha = 1;

  const A = getReelAnchor(reelHouse);

  const DESIGN_CELL = 130;
  const TITLE_CELL_MUL = 1.3;
  let titleS = (Math.max(1, cellSize) / DESIGN_CELL) * TITLE_CELL_MUL;

  titleS = Math.max(0.45, Math.min(1.0, titleS));
  titleBaseScale = titleS;
  applyGameTitleScaleFromBase();

  gameTitle.x = Math.round(A.right + ox);
  const titleTargetY = Math.round(A.cy + oy);



// ✅ MOBILE LANDSCAPE ONLY: push title PNG DOWN (existing behavior)
let finalTitleY = titleTargetY;

if (isMobileLandscapeUILayout(__layoutDeps)) {
  const LAND_TITLE_Y_DROP = Math.round(cellSize * 0.9); // keep your existing
  finalTitleY += LAND_TITLE_Y_DROP;
}

// ✅ TINY VIEW ONLY: push title PNG DOWN (NEW)
const IS_TINY_VIEW = !!(__layoutDeps as any).IS_TINY_VIEW;
if (IS_TINY_VIEW) {
  const TINY_TITLE_Y_DROP = 60; // 🔧 try 40..90
  finalTitleY += TINY_TITLE_Y_DROP;
}


  const W = app.screen.width;
  const PAD_R = 12;
  const b = gameTitle.getBounds();
  const over = (b.x + b.width) - (W - PAD_R);

  if (over > 0) {
    const fit = Math.max(0.35, (W - PAD_R - b.x) / Math.max(1, b.width));
    titleBaseScale = titleS * fit;
    applyGameTitleScaleFromBase();
    gameTitle.x = Math.round(A.right + ox);
  }

titleBaseX = gameTitle.x;
titleBaseY = finalTitleY;


// 🚫 DO NOT directly set gameTitle.y here.
// Drop + float system owns Y completely.

}




  // -------------------------
  // 🔒 NOW decide if PLAQUE is allowed to show
  // -------------------------
  if (
    (false && state.overlay.boot) ||
    loadingLayer?.visible ||
    state.overlay.splash ||
    state.overlay.startup ||
    state.overlay.fsIntro ||
    state.overlay.fsOutro ||
    state.ui.settingsOpen ||
    state.ui.buyMenuOpen
  ) {
    multPlaqueLayer.visible = false;
    return;
  }

  // 👇 only below here is the plaque EVER allowed to show
  multPlaqueLayer.visible = true;



  
// ✅ TABLET PORTRAIT ONLY — pin plaque to top-right of device (screen space)
if (isTabletPortrait(__layoutDeps)) {
  multPlaqueLayer.visible = true;
  // ✅ Put plaque ABOVE gameCore, ABOVE bottom UI, but BELOW menu overlays
  // uiLayer is 8000 in your code, so this sits above UI but still leaves room for menus.
  multPlaqueLayer.zIndex = 1600;
  root.sortChildren();

  const W = app.screen.width;
  const safeTop = safeInsetTopPx?.() ?? 0;

  const PAD_X = 18;
  const PAD_Y = 18;
  const SCALE = 1.0;

  multPlaqueLayer.scale.set(SCALE);

  // Pivot to TOP-RIGHT of the actual plaque content
  const lb = multPlaque.getLocalBounds(); // ✅ use the inner container
  multPlaqueLayer.pivot.set(lb.x + lb.width, lb.y);

  multPlaqueLayer.x = Math.round(W - PAD_X);
  multPlaqueLayer.y = Math.round(safeTop + PAD_Y);



  // ✅ clip offscreen vertically (show ~60%)
  const VISIBLE_FRAC = 0.60;
  const hiddenFrac = 1 - VISIBLE_FRAC;

  const lb2 = multPlaque.getLocalBounds();
  const plaqueHLocal = lb2.height || 0;
  const plaqueH = plaqueHLocal * (multPlaqueLayer.scale.y || 1);

  multPlaqueLayer.y = Math.round(multPlaqueLayer.y - plaqueH * hiddenFrac);

  applyPlaqueState(plaqueIdx);
  restyleAllSlots();
  applyPlaqueSlotVisibility(plaqueIdx);
  return;
}





// ✅ MOBILE PORTRAIT — PIN TO TOP-RIGHT OF SCREEN + CLIP OFFSCREEN (show ~60%)
if (isMobilePortraitUILayout(__layoutDeps)) {
  multPlaqueLayer.visible = true;

  // (keep your zIndex choice for portrait if you want it behind the reel house)
  multPlaqueLayer.zIndex = 1400;
  root.sortChildren();

  const W = app.screen.width;
  const safeTop = safeInsetTopPx?.() ?? 0;

  const PAD_X = 18;     // 🔧 right padding
  const PAD_Y = 18;     // 🔧 top padding
  const SCALE = 0.60;   // 🔧 keep your portrait scale (adjust if you like)

  multPlaqueLayer.scale.set(SCALE);

  // ✅ true top-right anchor (use plaque content bounds)
  const lb = multPlaque.getLocalBounds();
  multPlaqueLayer.pivot.set(lb.x + lb.width, lb.y);

  // pin to device top-right
  multPlaqueLayer.x = Math.round(W - PAD_X);
  multPlaqueLayer.y = Math.round(safeTop + PAD_Y);

  // ✅ clip vertically: push up so ~40% is offscreen (show ~60%)
  const VISIBLE_FRAC = 0.60;          // 🔧 change to taste
  const hiddenFrac = 1 - VISIBLE_FRAC;

  const plaqueHLocal = lb.height || 0;
  const plaqueH = plaqueHLocal * (multPlaqueLayer.scale.y || 1);

  multPlaqueLayer.y = Math.round(multPlaqueLayer.y - plaqueH * hiddenFrac);

  applyPlaqueState(plaqueIdx);
  restyleAllSlots();
  applyPlaqueSlotVisibility(plaqueIdx);
  return;
}

// ✅ MOBILE LANDSCAPE + TABLET LANDSCAPE — LEFT OF REEL WINDOW (STABLE)
if (isMobileLandscapeUILayout(__layoutDeps) || isTabletLandscape(__layoutDeps)) {
  multPlaqueLayer.visible = true;
  multPlaqueLayer.alpha = 1;

  multPlaqueLayer.zIndex = 1600;
  root.sortChildren();
    // ✅ IMPORTANT: portrait pins by changing pivot — reset it for landscape
  multPlaqueLayer.pivot.set(0, 0);


  // ✅ use the reel window WORLD rect computed in layoutAll.ts
  const rw = (__layoutDeps as any).reelWindowWorld as
    | { left: number; top: number; right: number; bottom: number }
    | undefined;

  // Fallback: if missing for any reason, bail out to avoid jumps
  if (!rw) return;

  // ---- SCALE (same as your desktop approach) ----
  const desiredTotalH = cellSize * 4.1;
  const baseTotalH = PLAQUE_H * 4 + PLAQUE_GAP * 3;

  let s = desiredTotalH / Math.max(1, baseTotalH);

  const minS = isMobileLandscapeUILayout(__layoutDeps) ? 0.55 : 0.65;
  const maxS = isMobileLandscapeUILayout(__layoutDeps) ? 1.00 : 1.10;
  s = Math.max(minS, Math.min(maxS, s));
  multPlaqueLayer.scale.set(s);

    // ---- POSITION (LEFT of REEL HOUSE, aligned to reel house) ----
  const A = getReelAnchor(reelHouse);

  // ✅ IMPORTANT: portrait pins by changing pivot — reset it for landscape
  multPlaqueLayer.pivot.set(0, 0);

  // stable local measurements (don’t use bounds)
  const localRight = PLAQUE_RIGHT_X; // right edge of plaque content (no arrow)

  // 🔧 TUNING
  const GAP_X = Math.round(cellSize * 0.18) + 12; // try 10..28
  const Y_FRAC = 0.10;                            // 0=top, 0.5=center

  // x = reelHouse.left - gap - plaqueWidth
  multPlaqueLayer.x = Math.round(A.left - GAP_X - localRight * s);

  // y = reelHouse.top + fraction of reel height
  const reelH = (A.bottom - A.top);
  multPlaqueLayer.y = Math.round(A.top + reelH * Y_FRAC);

  // ✅ clamp so it never disappears off the left/top
  multPlaqueLayer.x = Math.max(8, multPlaqueLayer.x);
  multPlaqueLayer.y = Math.max(8, multPlaqueLayer.y);




  applyPlaqueState(plaqueIdx);
  restyleAllSlots();
  applyPlaqueSlotVisibility(plaqueIdx);
  return;
}










// ✅ DESKTOP / NON-MOBILE: anchor to reel house (bounds-correct)
multPlaqueLayer.zIndex = 1600;
multPlaqueLayer.visible = true;
// ✅ IMPORTANT: portrait pins by changing pivot — reset it for desktop
multPlaqueLayer.pivot.set(0, 0);


const A = getReelAnchor(reelHouse);

// 🔧 TUNING
const GAP_X = 23;     // space between plaque and reel house
const Y_FRAC = 0.1; // 0=top, 0.5=center

// 1) scale FIRST
const desiredTotalH = cellSize * 4.1;
const baseTotalH = PLAQUE_H * 4 + PLAQUE_GAP * 3;

const s = Math.max(0.6, Math.min(1.3, desiredTotalH / baseTotalH));
multPlaqueLayer.scale.set(s);

// ✅ Use stable, design-time measurements instead of bounds (bounds drift w/ filters/scale)
const localRight = PLAQUE_RIGHT_X; // right edge of the plaque box (NOT including arrow)
const localTop = 0;               // plaque content starts at y=0 in its local space

multPlaqueLayer.x = Math.round(A.left - GAP_X - localRight * s);
let y = Math.round(A.top + A.b.height * Y_FRAC - localTop * s);











applyPlaqueState(plaqueIdx);
restyleAllSlots();
applyPlaqueSlotVisibility(plaqueIdx);

// ✅ TINY VIEW ONLY: apply lift to the y value (NOT the container after)
const IS_TINY_VIEW = !!(__layoutDeps as any).IS_TINY_VIEW;
if (IS_TINY_VIEW && multPlaqueLayer.visible) {
  const TINY_PLAQUE_Y_LIFT = 60; // 🔧 try 30..180
  y = Math.round(y - TINY_PLAQUE_Y_LIFT);
}

// ✅ assign ONCE at the end
multPlaqueLayer.y = y;


}





    function setScaleToHeight(c: Container, targetH: number) {
      // assumes makePngButton() added btnHeight() to the container
      const h = (c as any).btnHeight ? (c as any).btnHeight() : c.height;
      if (h <= 0) return;
      const s = targetH / h;
      c.scale.set(s);
    }






    function fadeUiLayerTo(targetAlpha: number, ms = 250) {
      const start = uiLayer.alpha;

      // disable interaction when hidden
      if (targetAlpha === 0) {
        uiLayer.eventMode = "none";
      }

      tween(
        ms,
        (k) => {
          uiLayer.alpha = start + (targetAlpha - start) * k;
        },
        () => {
          uiLayer.alpha = targetAlpha;
          uiLayer.eventMode = targetAlpha > 0 ? "auto" : "none";
        }
      );
    }

    function fadeGameTo(targetAlpha: number, targetScale: number, ms = 300) {
      // scale/fade ONE wrapper so it scales from the center
      const startA = gameCore.alpha;
      const startS = gameCore.scale.x;

      // when hidden, don’t let anything interactive accidentally catch events
      if (targetAlpha === 0) (gameCore as any).eventMode = "none";

      tween(
        ms,
        (k) => {
          gameCore.alpha = startA + (targetAlpha - startA) * k;
          const s = startS + (targetScale - startS) * k;
          gameCore.scale.set(s);
        },
        () => {
          gameCore.alpha = targetAlpha;
          gameCore.scale.set(targetScale);
          (gameCore as any).eventMode = targetAlpha > 0 ? "auto" : "none";
        }
      );
    }
// =====================
// BET BUTTONS (forward declared to avoid TDZ during early layout)
// =====================
let betUpBtnPixi: any = null;
let betDownBtnPixi: any = null;
  

    function lockInputForBigWin(on: boolean) {
      if (on) {
        uiController.applyUiLocks();
        (gameCore as any).eventMode = "none"; // already doing this, but keep it consistent
      } else {
        uiController.applyUiLocks();
        (gameCore as any).eventMode = "auto";
      }
    }


    function showGameCoreDelayed(
      delayMs = 300,
      fadeMs = 300,
      fromScale = 0.92
    ) {
       gameCore.visible = true;   // ✅ ensure it can render when we reveal it
  uiLayer.visible = true;
      // start hidden
      gameCore.alpha = 0;
      gameCore.scale.set(fromScale);
      (gameCore as any).eventMode = "none";

      setTimeout(() => {
        const startA = gameCore.alpha;
        const startS = gameCore.scale.x;

        tween(
  fadeMs,
  (k) => {
    gameCore.alpha = startA + (1 - startA) * k;
    const s = startS + (1 - startS) * k;
    gameCore.scale.set(s);
  },
          () => {
    gameCore.alpha = 1;
    gameCore.scale.set(1);
    (gameCore as any).eventMode = "auto";

    // ✅ enable UI interaction once visible
    uiLayer.alpha = 1;
    uiLayer.eventMode = "auto";

         layoutStudioTag();
    
  }
);
      }, delayMs);
    }



   
  

  

   


function centerPivot(c: Container) {
  const b = c.getLocalBounds();
  c.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
}

 

    function setTightHitArea(btn: Container, padX: number, padY: number) {
  const bb = btn.getLocalBounds();
  btn.hitArea = new Rectangle(
    bb.x - padX,
    bb.y - padY,
    bb.width + padX * 2,
    bb.height + padY * 2
  );
}








    // =====================
    // UI PANEL TEXT STYLES (shared)
    // =====================
const UI_TITLE_STYLE = localizeStyle({
  fontFamily: "Micro5",
  fill: 0xffd36a,
  fontSize: isMobilePortraitUILayout(__layoutDeps) ? 24 : 32, // ✅ portrait smaller
  fontWeight: "200",
  letterSpacing: 2,
} as any);

const UI_VALUE_STYLE = localizeStyle({
  fontFamily: "Micro5",
  fill: 0xffffff,
  fontSize: isMobilePortraitUILayout(__layoutDeps) ? 30 : 40, // ✅ portrait smaller
  fontWeight: "200",
  letterSpacing: 1,
  stroke: { color: 0x000000, width: 4 },
} as any);




    const balanceLabel = new Text({
      text: fmtMoney(state.bank.balance),
      style: UI_VALUE_STYLE,
    });

    
// ✅ Seed wallet balance from authenticate ONCE (never overwrite later)
if (isRgs) {
  void (async () => {
    await (rgsAuthP ?? Promise.resolve());
    if (__rgsBalanceSeededOnce) return;

    if (rgsAuthed && rgsInitialBalance != null) {
      __rgsBalanceSeededOnce = true;

      state.bank.balance = rgsInitialBalance;
      balanceLabel.text = fmtMoney(state.bank.balance);
      uiController?.refreshSpinAffordability?.();
    }
  })();
}
function showFatalBootError(msg: string, detail?: string) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;" +
    "background:#000;z-index:99999999;color:#fff;font-family:system-ui;padding:24px;text-align:center;";

  box.innerHTML =
    `<div style="max-width:720px;line-height:1.45">
      <div style="font-size:22px;font-weight:700;margin-bottom:12px">Session Error</div>
      <div style="white-space:pre-wrap;font-size:16px;opacity:0.92">${msg}</div>
      ${detail ? `<div style="margin-top:14px;font-size:12px;opacity:0.55;white-space:pre-wrap">${detail}</div>` : ""}
    </div>`;

  document.body.appendChild(box);

  document.body.style.pointerEvents = "none";
  box.style.pointerEvents = "auto";
}




    const balanceTitleLabel = new Text({
      text: t("ui.balance"),
      style: UI_TITLE_STYLE,
    });
    balanceTitleLabel.anchor.set(0.5);




    uiPanel.addChild(balanceTitleLabel);


    uiPanel.addChild(balanceLabel);
    // --- MULT display ---
    const multTitleLabel = new Text({
      text: t("ui.mult"),
      style: {
        fill: 0xffd36a,
        fontSize: 17,
        fontWeight: "600",
        letterSpacing: 2,
      }
    });
    multTitleLabel.anchor.set(0.5);

    const multAmountLabel = new Text({
      text: "x1",
      style: {
        fill: 0xffffff,
        fontSize: 30,
        fontWeight: "700",
      }
    });
    multAmountLabel.anchor.set(0.5);

    // container so we can position it like WIN
    const multUI = new Container();
    multUI.addChild(multTitleLabel, multAmountLabel);



    // helper
    function setMult(v: number) {
      // keep it clean (2dp only if needed)
      const isInt = Math.abs(v - Math.round(v)) < 1e-6;
      multAmountLabel.text = `${LTR}x${isInt ? String(Math.round(v)) : v.toFixed(2)}`;

    }





    // --- WIN display ---


    const winTitleLabel = new Text({
      text: t("ui.win"),
      style: UI_TITLE_STYLE,
    });
    winTitleLabel.anchor.set(0.5);

    winTitleLabel.anchor.set(0.5);

    const winAmountLabel = new Text({
      text: fmtMoney(0),
      style: UI_VALUE_STYLE,
    });
    winAmountLabel.anchor.set(0.5);



    // group so we can center-align and move together
    const winUI = new Container();
    winUI.addChild(winTitleLabel, winAmountLabel);
    uiPanel.addChild(winUI);

    function setWinAmount(v: number) {
       winPanelValue = v; 
      state.bank.lastWin = v;
      winAmountLabel.text = fmtMoney(v);
    }

    let __winTweenToken = 0;

async function animateWinAmountTo(target: number, ms = 140) {
  __winTweenToken++;
  const token = __winTweenToken;

  const from = winPanelValue;
  const to = target;

  // tiny dead-zone (prevents jitter on tiny deltas)
  if (Math.abs(to - from) < 0.001) {
    setWinAmount(to);
    return;
  }

  await animateMs(ms, (t) => {
    if (token !== __winTweenToken) return; // ✅ cancelled by a newer tween
    const e = t * t * (3 - 2 * t); // smoothstep
    const v = from + (to - from) * e;
    setWinAmount(v);
  });

  if (token === __winTweenToken) {
    setWinAmount(to); // ✅ hard snap final
  }
}


let winPanelValue = 0; // ✅ current displayed value in the WIN panel









    // --- BET display (amount readout) ---
    const BET_TEXT_STYLE = UI_VALUE_STYLE;


    // Optional: little pill background behind the bet amount
    const betAmountBg = new Graphics();
    betAmountBg.rect(0, 0, 120, 44).fill(0x000000);
    betAmountBg.alpha = 0.35;

    const betAmountText = new Text({
        text: fmtMoney(state.bank.betLevels[state.bank.betIndex]),
      style: BET_TEXT_STYLE,
    });
    betAmountText.anchor.set(0.5);

    const betTitleLabel = new Text({
      text: t("ui.bet"),
      style: UI_TITLE_STYLE,
    });
   betTitleLabel.anchor.set(0.5);

// container so we can position/scale as a unit
const betAmountUI = new Container();
betAmountUI.addChild(betAmountBg, betAmountText);

// ✅ DO NOT add these to uiPanel directly anymore.
// They will be parented by ensureBetParentingForLayout()

    // =====================
// PORTRAIT GROUPS (BET + BALANCE)
// =====================
const balanceGroup = new Container();
balanceGroup.eventMode = "none";
uiPanel.addChild(balanceGroup);

// move BALANCE title + amount into one group
balanceGroup.addChild(balanceTitleLabel, balanceLabel);

const betGroup = new Container();

// ✅ allow children (buttons) to be interactive, but betGroup itself doesn't need to be clickable
betGroup.eventMode = "passive";

uiPanel.addChild(betGroup);

// =====================
// BET GROUPS (DESKTOP + PORTRAIT)
// =====================
const betDisplayGroup = new Container(); // "BET" + pill
const betControlsGroup = new Container(); // up / down arrows

betDisplayGroup.eventMode = "none";
betControlsGroup.eventMode = "passive";

uiPanel.addChild(betDisplayGroup);
uiPanel.addChild(betControlsGroup);







    function updateSpinButtonVisualState() {
      const bet = state.bank.betLevels[state.bank.betIndex];
      const inFreeSpins = state.fs.remaining > 0;
      const canAfford = inFreeSpins || state.bank.balance >= bet;

      // ✅ change look only (still clickable)
      setSpinSkinsBroke(!canAfford);

      // ✅ IMPORTANT: do NOT hide the button, do NOT disable it here.
      // Let refreshSpinAffordability() decide enabled/disabled for menus/spins.
    }



 






 function updateBetUI() {
  betAmountText.text = fmtMoney(state.bank.betLevels[state.bank.betIndex]);

  // Resize the pill bg to fit text nicely
 const padY = 16;

// ✅ Desktop-only pill tightening
const isDesktop = !isMobilePortraitUILayout(__layoutDeps);
const padX = isDesktop ? 14 : 28; // 👈 smaller = shorter pill (desktop only)

const w = Math.max(90, betAmountText.width + padX);

let h = Math.max(40, betAmountText.height + padY);

// ✅ DESKTOP ONLY: tweak pill HEIGHT (background only)
const BET_PILL_H_SCALE_DESKTOP = isDesktop ? 0.75 : 1.1; // 🔧 try 0.75..1.10
h = Math.round(h * BET_PILL_H_SCALE_DESKTOP);



  // ✅ draw the pill centered around (0,0) instead of from (0,0)
  betAmountBg.clear();
  betAmountBg
    .rect(-w / 2, -h / 2, w, h)
    .fill(0x000000);

  betAmountBg.alpha = 0.35;

  // ✅ keep text centered at (0,0)
  betAmountText.anchor.set(0.5);
  betAmountText.x = 0;
  betAmountText.y = -6; // your optical nudge

  // ✅ IMPORTANT: if you use centerPivot(betAmountUI) anywhere,
  // this stays stable because betAmountUI is already centered.
}


    updateBetUI();



  // ---- Slider helper ----
    function makeSlider(
      iconOnUrl: string,
      iconOffUrl: string,
      initial01: number,
      onChange?: (v01: number) => void
    ) {

      const c = new Container();

      let muted = false;
    const icon = new Sprite(texUI(iconOnUrl));
    icon.anchor.set(0.5);

    // pixel icon size
    const ICON_H = 36;

    // scale using texture size (more reliable than sprite.height early-on)
    const texH = icon.texture?.height || (icon.texture as any)?.orig?.height || 1;
    const s = ICON_H / Math.max(1, texH);
    icon.scale.set(s);

    // crisp
    icon.roundPixels = true;
    // =====================
    // ICON HIT AREA (larger than sprite)
    // =====================
    const ICON_HIT_W = 64; // try 56–72
    const ICON_HIT_H = 64;

    const iconHit = new Graphics();

  // invisible but interactive hit rect
  iconHit
    .rect(
      -ICON_HIT_W / 2,
      -ICON_HIT_H / 2,
      ICON_HIT_W,
      ICON_HIT_H
    )
    .fill({ color: 0xffffff, alpha: 0.001 });


    iconHit.eventMode = "static";
    iconHit.cursor = "pointer";

    // put hit box BEHIND icon
    c.addChild(iconHit);
    c.addChild(icon);




      // ... keep your trackInactive/trackActive/knob code the same ...

    (c as any).setMuted = (m: boolean) => {
      muted = m;
      icon.texture = texUI(muted ? iconOffUrl : iconOnUrl);
    };


      


      icon.anchor.set(0.5);

      const trackActive = new Graphics();
      const trackInactive = new Graphics();
      const trackHit = new Graphics(); // invisible fat hit area for the whole line

      const capL = new Graphics();
      const capR = new Graphics();
      const knob = new Graphics();

    c.addChild(icon, trackInactive, trackActive, trackHit, capL, capR, knob);


    



      let value01 = Math.max(0, Math.min(1, initial01));
      let dragging = false;
      let boundToSettingsLayer = false;


    const sliderParts = new Set<any>();

      

    // mark slider parts as "owned" by the slider
    sliderParts.add(icon); // ✅ include icon too
    sliderParts.add(iconHit);
    sliderParts.add(trackInactive);
    sliderParts.add(trackActive);
    sliderParts.add(knob);

    (c as any).isFromSlider = (target: any) => sliderParts.has(target);
    (c as any).isDragging = () => dragging;


    // ✅ allow settings menu to bind a click handler to the icon ONLY
    (c as any).bindIconTap = (fn: () => void) => {
      // store it so layout() can rebind after it clears listeners
      (c as any)._iconTapFn = fn;

      const bind = (target: any) => {
        target.eventMode = "static";
        target.cursor = "pointer";
        target.removeAllListeners?.("pointertap");
        target.on("pointertap", (e: any) => {
          e.stopPropagation?.();
          fn();
        });
      };

      // bind to BOTH the icon and its larger hit box
      bind(icon);
      bind(iconHit);
    };



      const TRACK_X = 60; // ✅ make this accessible to redraw()

      function redraw(trackW: number) {
        const knobX = Math.round(trackW * value01);

        trackInactive.clear();
        trackInactive
          .moveTo(0, 0)
          .lineTo(trackW, 0)
          .stroke({ width: 6, color: 0xffffff, alpha: 0.25 });

        trackActive.clear();
        if (knobX > 0) {
          trackActive
            .moveTo(0, 0)
            .lineTo(knobX, 0)
            .stroke({ width: 6, color: 0xffffff, alpha: 0.95 });
            // fat invisible hitbox over the whole track
    trackHit.clear();
    trackHit
      .moveTo(0, 0)
      .lineTo(trackW, 0)
      .stroke({ width: 32, color: 0xffffff, alpha: 0.001 }); // big click area, visually invisible

        }

        capL.visible = false;
    capR.visible = false;
        capL.clear();
        capL.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.95 });

        capR.clear();
        capR.circle(trackW, 0, 4).fill({ color: 0xffffff, alpha: 0.95 });

        knob.clear();
        knob.circle(0, 0, 14).fill({ color: 0xffffff, alpha: 1 });

        // ✅ FIX: knob must include TRACK_X offset
        knob.x = TRACK_X + knobX;
        knob.y = 0;
      }

      (c as any).layout = (x: number, y: number, trackW: number) => {
        c.x = x;
        c.y = y;

        icon.x = 0;
        icon.y = 0;

        trackInactive.roundPixels = true;
        trackActive.roundPixels = true;
        capL.roundPixels = true;
        capR.roundPixels = true;
        knob.roundPixels = true;

        trackInactive.x = TRACK_X;
        trackInactive.y = 0;

        trackActive.x = TRACK_X;
        trackActive.y = 0;

        trackHit.x = TRACK_X;
    trackHit.y = 0;


        capL.x = TRACK_X;
        capL.y = 0;

        capR.x = TRACK_X;
        capR.y = 0;

        redraw(trackW);
          






            // knob interactive
        knob.eventMode = "static";
        knob.cursor = "pointer";
    knob.removeAllListeners?.();
    trackInactive.removeAllListeners?.();
    trackActive.removeAllListeners?.();
    trackHit.removeAllListeners?.();

    // ✅ DON’T kill icon taps permanently — we’ll rebind after clearing
    icon.removeAllListeners?.("pointertap");
    iconHit.removeAllListeners?.("pointertap");

    // ✅ Rebind icon mute tap if one was provided
    const fn = (c as any)._iconTapFn as undefined | (() => void);
    if (fn) (c as any).bindIconTap(fn);


        knob.on("pointerdown", (e) => {
          dragging = true;
          (e as any).stopPropagation?.(); // ✅ already doing this
        });

        knob.on("pointertap", (e) => (e as any).stopPropagation?.());


        // click track to jump (grey OR white line)
    const bindTrackClick = (g: any) => {
      g.eventMode = "static";
      g.cursor = "pointer";

      // ⛔️ prevent row mute when clicking slider line
      g.on("pointerdown", (e: any) => e.stopPropagation?.());
      g.on("pointertap",  (e: any) => e.stopPropagation?.());

      g.on("pointertap", (e: any) => {
        e.stopPropagation?.(); // ⛔️ critical: prevents mute/unmute

        const local = g.toLocal(e.global);
        value01 = Math.max(0, Math.min(1, local.x / trackW));
        redraw(trackW);
        onChange?.(value01);
      });
    };

    // ✅ allow clicking both the inactive (grey) and active (white) parts
    bindTrackClick(trackInactive);
    bindTrackClick(trackActive);



      


        const setFromGlobalX = (globalX: number) => {
          const local = trackInactive.toLocal({ x: globalX, y: 0 } as any);
          const t = Math.max(0, Math.min(trackW, local.x));
          value01 = t / trackW;
          redraw(trackW);
          return value01;
        };

        knob.on("pointerdown", (e) => {
          dragging = true;
          (e as any).stopPropagation?.();
        });

        if (!boundToSettingsLayer) {
      boundToSettingsLayer = true;

      app.stage.on("pointermove", (e: any) => {
    if (!dragging) return;
    setFromGlobalX((e as any).global.x);
    onChange?.(value01);
  });

  const stopDrag = () => { dragging = false; };
  app.stage.on("pointerup", stopDrag);
  app.stage.on("pointerupoutside", stopDrag);

    }


    const onTrackDown = (e: any) => {
      e.stopPropagation?.();           // prevent row tap toggling mute
      dragging = true;                 // ✅ start dragging when you press on the line
      setFromGlobalX(e.global.x);
      onChange?.(value01); // ✅ this is the important bit
      return value01;
    };


    // INACTIVE line
    trackInactive.eventMode = "static";
    trackInactive.cursor = "pointer";
    trackInactive.on("pointerdown", onTrackDown);
    trackInactive.on("pointertap", (e) => e.stopPropagation?.());

    // ACTIVE (white) line
    trackActive.eventMode = "static";
    trackActive.cursor = "pointer";
    trackActive.on("pointerdown", onTrackDown);
    trackActive.on("pointertap", (e) => e.stopPropagation?.());

    trackHit.eventMode = "static";
    trackHit.cursor = "pointer";
    trackHit.on("pointerdown", onTrackDown);
    trackHit.on("pointertap", (e) => e.stopPropagation?.());



      };

      (c as any).getValue = () => value01;
      (c as any).setValue = (v: number) => { value01 = Math.max(0, Math.min(1, v)); };

    return c as Container & {
  setEnabled: (b: boolean) => void;
  resetVisual: () => void;   // ✅ ADD THIS
  btnWidth: () => number;
  btnHeight: () => number;
};
    }

    function makePngButton(
  upUrl: string,
  hoverUrl: string,
  downUrl: string,
  onClick: () => void,
  opts?: { clickSfx?: SfxKey | null; clickVol?: number }
) {
      const c = new Container();

      const up = new Sprite(texUI(upUrl));

      const hover = new Sprite(texUI(hoverUrl));
      const down = new Sprite(texUI(downUrl));


      // Center the sprites on the container
      up.anchor.set(0.5);
      hover.anchor.set(0.5);
      down.anchor.set(0.5);

      // Only show UP initially
      hover.visible = false;
      down.visible = false;

      c.addChild(up, hover, down);

      c.eventMode = "static";
      if (!disableCustomCursorOnMobile(__layoutDeps)) {
  setCursorSafe(__layoutDeps,c, "pointer");
}

      c.on("pointerover", () => {
        up.visible = false;
        hover.visible = true;
        down.visible = false;
      });

      c.on("pointerout", () => {
        up.visible = true;
        hover.visible = false;
        down.visible = false;
      });

      c.on("pointerdown", () => {
        up.visible = false;
        hover.visible = false;
        down.visible = true;
      });

      c.on("pointerup", () => {
        // return to hover state if still over button
        up.visible = false;
        hover.visible = true;
        down.visible = false;
      });

c.on("pointertap", () => {
  audio?.initFromUserGesture?.(); // ✅ ensure unlocked

  // ✅ IMPORTANT:
  // - if clickSfx is UNDEFINED -> default to "ui_click"
  // - if clickSfx is NULL      -> play nothing
  // - if clickSfx is a key     -> play that
  const sfx =
    opts && ("clickSfx" in opts)
      ? (opts.clickSfx ?? null)  // preserves explicit null
      : "ui_click";

  if (sfx) audio?.playSfx?.(sfx as any, opts?.clickVol ?? 0.9);

  onClick();
});



        (c as any).setEnabled = (enabled: boolean) => {
        c.eventMode = enabled ? "static" : "none";
        c.alpha = enabled ? 1.0 : 0.5;
        c.cursor = enabled ? "pointer" : "default";

        // ✅ IMPORTANT: when disabling (menus open), force back to UP state
        if (!enabled) {
          up.visible = true;
          hover.visible = false;
          down.visible = false;
        }
      };

      // ✅ expose a manual reset too (useful when closing menus)
      (c as any).resetVisual = () => {
        up.visible = true;
        hover.visible = false;
        down.visible = false;
      };


// ✅ Hit area (bigger only on REAL mobile / touch devices)
// (Prevents "mobile hitboxes" leaking into desktop when the window is narrow)
// ✅ Hit area (tight on desktop, forgiving on touch)
const HIT_PAD_X = IS_TOUCH ? 40 : 4;
const HIT_PAD_Y = IS_TOUCH ? 34 : 4;

// Use bounds so trimmed textures don't inflate click areas
const bb = c.getLocalBounds();
c.hitArea = new Rectangle(
  bb.x - HIT_PAD_X,
  bb.y - HIT_PAD_Y,
  bb.width + HIT_PAD_X * 2,
  bb.height + HIT_PAD_Y * 2
);



      // handy size getters (so layoutUI can use width/height)
      (c as any).btnWidth = () => up.width;
      (c as any).btnHeight = () => up.height;
      

return c as Container & {
  setEnabled: (b: boolean) => void;
  resetVisual: () => void;   // ✅ ADD THIS
  btnWidth: () => number;
  btnHeight: () => number;
};
    }

    function makePngToggleButton(
      offUpUrl: string,
      offHoverUrl: string,
      offDownUrl: string,
      onUpUrl: string,
      onHoverUrl: string,
      onDownUrl: string,
      initialOn: boolean,
      onToggle: (isOn: boolean) => void
    ) {
      const c = new Container();

      // OFF sprites
      const offUp = new Sprite(texUI(offUpUrl));
      const offHover = new Sprite(texUI(offHoverUrl));
      const offDown = new Sprite(texUI(offDownUrl));

      // ON sprites
      const onUp = new Sprite(texUI(onUpUrl));
      const onHover = new Sprite(texUI(onHoverUrl));
      const onDown = new Sprite(texUI(onDownUrl));

      
      const all = [offUp, offHover, offDown, onUp, onHover, onDown];
      all.forEach((s) => {
        s.anchor.set(0.5);
        c.addChild(s);
      });
    // 🔒 Force all toggle sprites to the same size (use OFF_UP as reference)
    const refW = offUp.width;
    const refH = offUp.height;
// ✅ Enlarge hit area for mobile (toggle button)

// ✅ Hit area sizing
// Desktop: tight and precise
// Touch devices: forgiving





    all.forEach((s) => {
      s.width = refW;
      s.height = refH;
    });

      let isOn = initialOn;
      

      function showState(kind: "up" | "hover" | "down") {
        all.forEach((s) => (s.visible = false));

        const up = isOn ? onUp : offUp;
        const hover = isOn ? onHover : offHover;
        const down = isOn ? onDown : offDown;

        if (kind === "up") up.visible = true;
        if (kind === "hover") hover.visible = true;
        if (kind === "down") down.visible = true;
      }

      showState("up");

      c.eventMode = "static";
      if (!disableCustomCursorOnMobile(__layoutDeps)) {
  setCursorSafe(__layoutDeps,c, "pointer");
}

      c.on("pointerover", () => showState("hover"));
      c.on("pointerout", () => showState("up"));
      c.on("pointerdown", () => showState("down"));
      c.on("pointerup", () => showState("hover"));

      c.on("pointertap", () => {
        isOn = !isOn;
        audio?.playSfx?.("ui_toggle", 0.9);

        showState("hover");
        onToggle(isOn);
      });

      (c as any).setOn = (v: boolean) => {
        isOn = v;
        showState("up");
      };
      (c as any).getOn = () => isOn;

      (c as any).setEnabled = (enabled: boolean) => {
        c.eventMode = enabled ? "static" : "none";
        c.alpha = enabled ? 1.0 : 0.5;
        c.cursor = enabled ? "pointer" : "default";
      };

      // size getters (use OFF up as reference)
      ;(c as any).btnWidth = () => offUp.width;
      ;(c as any).btnHeight = () => offUp.height;

(c as any).setTapHandler = (fn: (e?: any) => void) => {
  c.removeAllListeners?.("pointertap");
  c.on("pointertap", (e: any) => {
    e?.stopPropagation?.();

    // ✅ add toggle SFX for custom tap handler buttons (AUTO uses this)
    audio?.playSfx?.("ui_toggle", 0.9);

    fn(e);
  });
};



      return c as Container & {
        setEnabled: (b: boolean) => void;
        setOn: (v: boolean) => void;
        getOn: () => boolean;
        btnWidth: () => number;
        btnHeight: () => number;
      };
    }


    function setPngButtonSkins(
      btn: Container,
      upUrl: string,
      hoverUrl: string,
      downUrl: string
    ) {
      const kids = btn.children as Sprite[];
      const up = kids[0];
      const hover = kids[1];
      const down = kids[2];

    up.texture = texUI(upUrl);
    hover.texture = texUI(hoverUrl);
    down.texture = texUI(downUrl);


      // keep current visible state consistent
      up.visible = true;
      hover.visible = false;
      down.visible = false;

      // keep btnWidth/btnHeight accurate
      (btn as any).btnWidth = () => up.width;
      (btn as any).btnHeight = () => up.height;
    }


    function makeButton(label: string, w: number, h: number, onClick: () => void) {
      const c = new Container();

      const bg = new Graphics()
        .roundRect(0, 0, w, h, 12)
        .fill(0x1a1a1a)
        .stroke({ width: 10, color: 0x666666 });

      const t = new Text({ text: label, style: { fill: 0xffffff, fontSize: 18 } });
      t.anchor.set(0.5);
      t.x = w / 2;
      t.y = h / 2;

      c.addChild(bg, t);

      c.eventMode = "static";
      if (!disableCustomCursorOnMobile(__layoutDeps)) {
  setCursorSafe(__layoutDeps,c, "pointer");
}
      c.on("pointertap", onClick);

      c.on("pointerover", () => { bg.alpha = 0.9; });
      c.on("pointerout",  () => { bg.alpha = 1.0; });

      (c as any).setEnabled = (enabled: boolean) => {
        c.eventMode = enabled ? "static" : "none";
        c.alpha = enabled ? 1.0 : 0.5;
        c.cursor = enabled ? "pointer" : "default";
      };
      (c as any).setLabel = (txt: string) => { t.text = txt; };

      return c as Container & { setEnabled: (b: boolean) => void; setLabel: (s: string) => void };
    }






    // --- UI PNGs ---

    const ICON_INFO = "icon_info.png";


    const SPIN_UP        = "btn_spin_up.png";
    const SPIN_HOVER     = "btn_spin_hover.png";
    const SPIN_DOWN      = "btn_spin_down.png";
    const SPIN_SPINNING  = "btn_spin_spinning.png";


    const ICON_SFX_ON  = "icon_sfx_on.png";
    const ICON_SFX_OFF = "icon_sfx_off.png";


    const ICON_MUSIC_ON  = "icon_music_on.png";
    const ICON_MUSIC_OFF = "icon_music_off.png";




    const SETTINGS_OFF_UP    = "btn_settings_off_up.png";
    const SETTINGS_OFF_HOVER = "btn_settings_off_up.png";   // same frame is fine
    const SETTINGS_OFF_DOWN  = "btn_settings_off_down.png";

    const SETTINGS_ON_UP     = "btn_settings_on_up.png";
    const SETTINGS_ON_HOVER  = "btn_settings_on_up.png";    // same frame is fine
    const SETTINGS_ON_DOWN   = "btn_settings_on_down.png";


    const AUTO_OFF_UP    = "btn_auto_off_up.png";
    const AUTO_OFF_HOVER = "btn_auto_hover.png";
    const AUTO_OFF_DOWN  = "btn_auto_down.png";

    const AUTO_ON_UP    = "btn_auto_on_up.png";
    const AUTO_ON_HOVER = "btn_auto_on_up.png";
    const AUTO_ON_DOWN  = "btn_auto_on_up.png";


    const TURBO_OFF_UP    = "btn_turbo_off_up.png";
    const TURBO_OFF_HOVER = "btn_turbo_hover.png";
    const TURBO_OFF_DOWN  = "btn_turbo_down.png";

    const TURBO_ON_UP    = "btn_turbo_on_up.png";
    const TURBO_ON_HOVER = "btn_turbo_on_up.png";
    const TURBO_ON_DOWN  = "btn_turbo_on_up.png";


    const BET_DOWN_UP    = "btn_bet_down_up.png";
    const BET_DOWN_HOVER = "btn_bet_down_hover.png";
    const BET_DOWN_DOWN  = "btn_bet_down_down.png";

    const BET_UP_UP      = "btn_bet_up_up.png";
    const BET_UP_HOVER   = "btn_bet_up_hover.png";
    const BET_UP_DOWN    = "btn_bet_up_down.png";

    // ✅ CLOSE uses existing atlas frames (these DO exist in ui.json)
    const CLOSE_UP    = "btn_settings_on_up.png";
    const CLOSE_HOVER = "btn_settings_on_up.png";
    const CLOSE_DOWN  = "btn_settings_on_down.png";



    const BUY_UP    = "btn_buy_up.png";
    const BUY_HOVER = "btn_buy_hover.png";
    const BUY_DOWN  = "btn_buy_down.png";


    

    const BIGWIN_ITEMS_ATLAS_URL = "./assets/atlases/bigwin_items.json";
    const UI_ATLAS_URL = "./assets/atlases/ui.json";
    const UI_EXTRA_ATLAS_URL = "./assets/atlases/ui_extra.json";
  const VEHICLES_ATLAS_URL = "./assets/atlases/vehicles.json";
  const REELHOUSE_ATLAS_URL = "./assets/atlases/reelhouse.json";
  const SYMBOLS_ATLAS_URL = "./assets/atlases/symbols.json";
const AUTO_MENU_UI_ATLAS_URL = "./assets/atlases/auto_menu_ui.json";








    // =====================
    // COIN SHOWER — SPRITESHEET (TexturePacker / Pixi atlas)
    // =====================
const COINS_SHEET_URL = "./assets/particles/coins.json";


    let coinFramesCache: Texture[] | null = null;

    function getCoinFramesCached(): Texture[] {
      if (coinFramesCache) return coinFramesCache;

      const sheet = Assets.get(COINS_SHEET_URL) as any; // Pixi Spritesheet
      const texMap = sheet?.textures as Record<string, Texture> | undefined;

      if (!texMap) {
     
        coinFramesCache = [];
        return coinFramesCache;
      }

      // TexturePacker usually names them "coin_0001.png" etc or "1.png"
      // Sort in a stable numeric-ish way:
      const keys = Object.keys(texMap).sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });

      coinFramesCache = keys.map((k) => texMap[k]).filter(Boolean);

      if (!coinFramesCache.length) {
        
      } else {
        
      }

      return coinFramesCache;
    }






await Assets.load([
  AUTO_MENU_UI_ATLAS_URL,
  STUDIO_LOGO_URL,
  STUDIO_LOGO_HOUSE_URL,
]);

studioLogoHouseTex = (Assets.get(STUDIO_LOGO_HOUSE_URL) as Texture) || null;

// ✅ Black (DOM) -> Studio intro (Pixi): remove DOM cover now
document.getElementById("boot-cover")?.remove();

await playStudioIntroTilesReel();

// ✅ Studio intro finished -> now show the loader
loadingLayer.visible = true;
loadingLayer.alpha = 1;
loadingLayer.eventMode = "static";
layoutLoadingScreen();
removeBootCoverSoon();
updateLoadingProgress(0);
root.sortChildren();


    await Assets.load(
      [
        BG_BASE_URL, BG_FREE_URL,
          STUDIO_LOGO_URL,
            STUDIO_LOGO_HOUSE_URL,
        

        // ✅ Atlases
        UI_ATLAS_URL,
        BIGWIN_ITEMS_ATLAS_URL,
        COINS_SHEET_URL,
        UI_EXTRA_ATLAS_URL,
        VEHICLES_ATLAS_URL,
        REELHOUSE_ATLAS_URL,
        SYMBOLS_ATLAS_URL,

        // ✅ Still-real PNGs (not in atlases yet)
        FS_OUTRO_BG_URL,
           INFINITY_ICON_URL,

      ],
      (p: number) => updateLoadingProgress(p)
    );


 uiSheet = Assets.get(UI_ATLAS_URL) as any;

uiExtraSheet = Assets.get(UI_EXTRA_ATLAS_URL) as any;

const autoMenuSheet = Assets.get(AUTO_MENU_UI_ATLAS_URL) as any;

// crisp pixels (optional but recommended)
for (const tex of Object.values(autoMenuSheet.textures || {})) {
  (tex as Texture).source.scaleMode = "nearest";
}

function texAutoMenu(frame: string): Texture {
  const t = autoMenuSheet.textures?.[frame] as Texture | undefined;
  if (!t) throw new Error(`[AUTO_MENU_UI] Missing frame: ${frame}`);
  return t;
}



symbolsSheet = Assets.get(SYMBOLS_ATLAS_URL) as any;

 

  for (const tex of Object.values(symbolsSheet.textures)) {
    (tex as Texture).source.scaleMode = "nearest";
  }


  function texSymbol(frame: string): Texture {
    const t = symbolsSheet.textures?.[frame] as Texture | undefined;
    if (!t) throw new Error(`[SYMBOLS_ATLAS] Missing frame: ${frame}`);
    return t;
  }

  // ✅ Symbols UI icons (for paytable in settingsMenu)
function texSymbols(frame: string): Texture {
  // frames are the keys in symbols.json, e.g. "symbol_low_L1_gummy.png"
  return texSymbol(frame);
}


  // =====================
  // SYMBOL TEXTURES (from symbols atlas)
  // =====================
  const SYMBOL_TEX: Record<SymbolId, Texture> =
    Object.fromEntries(
      (Object.keys(SYMBOL_FRAMES) as SymbolId[]).map((id) => [id, texSymbol(SYMBOL_FRAMES[id])])
    ) as Record<SymbolId, Texture>;

  buildSplashCardArtOnce();
  layoutSplash();

    // =====================
  // REELHOUSE ATLAS
  // =====================
reelhouseSheet = Assets.get(REELHOUSE_ATLAS_URL) as any;

 

  for (const tex of Object.values(reelhouseSheet.textures)) {
    (tex as Texture).source.scaleMode = "nearest";

  }

  function texReelhouse(frame: string): Texture {
    const t = reelhouseSheet.textures?.[frame] as Texture | undefined;
    if (!t) throw new Error(`[REELHOUSE_ATLAS] Missing frame: ${frame}`);
    return t;
  }


    // =====================
  // VEHICLES ATLAS
  // =====================
vehiclesSheet = Assets.get(VEHICLES_ATLAS_URL) as any;


 

  for (const tex of Object.values(vehiclesSheet.textures)) {
    (tex as Texture).source.scaleMode = "nearest";

  }

  function texVehicle(frame: string): Texture {
    const t = vehiclesSheet.textures?.[frame] as Texture | undefined;
    if (!t) throw new Error(`[VEHICLES_ATLAS] Missing frame: ${frame}`);
    return t;
  }



  // crisp pixels for ui_extra too
  for (const tex of Object.values(uiExtraSheet.textures)) {
    (tex as Texture).source.scaleMode = "nearest";

  }

  function texExtra(frame: string): Texture {
    if (!uiExtraSheet?.textures) {
      // UI_EXTRA atlas not loaded yet
      return Texture.WHITE;
    }
    const t = uiExtraSheet.textures?.[frame] as Texture | undefined;
    if (!t) throw new Error(`[UI_EXTRA_ATLAS] Missing frame: ${frame}`);
    return t;
  }

  gameTitle.texture = texExtra("game_title.png");

    for (const tex of Object.values(uiSheet.textures)) {
      (tex as Texture).source.scaleMode = "nearest";

    }

    function texUI(frame: string): Texture {
      const t = uiSheet.textures?.[frame] as Texture | undefined;
      if (!t) throw new Error(`[UI_ATLAS] Missing frame: ${frame}`);
      return t;
    }


    // =====================
    // BIG WIN ITEMS ATLAS (TexturePacker)
    // =====================
bigWinItemsSheet = Assets.get(BIGWIN_ITEMS_ATLAS_URL) as any;


    // crisp pixels
    for (const tex of Object.values(bigWinItemsSheet.textures)) {
      (tex as Texture).source.scaleMode = "nearest";

    }

    function texBigWinItem(frame: string): Texture {
      const t = bigWinItemsSheet.textures?.[frame] as Texture | undefined;
      if (!t) throw new Error(`[BIGWIN_ITEMS] Missing frame: ${frame}`);
      return t;
    }
    // ✅ warm up coin frames cache once (avoids first-use hitch)
    getCoinFramesCached();






    // Spin button (create AFTER load)
    const spinBtnPixi = makePngButton(
      
      SPIN_UP,
      SPIN_HOVER,
      SPIN_DOWN,
     async () => {
          // ✅ RGS AUTH GUARD (ADD THIS)
    if (isRgs && !rgsReady) {
      console.warn("[RGS] spin blocked — not authenticated yet");
      return;
    } 

        // ✅ If auto is running, SPIN becomes "STOP AUTO"
if (state.ui.auto) {
  stopAutoNow("spin button (stop auto)");
  refreshAutoSpinSpinButton();
  return;
  
}

    // ✅ RGS: do not allow play spam while a round is "in flight"
if (isRgs && rgsRoundLock) {
  console.warn("[RGS] spin blocked — round still active (lock)");
  return;
}



 // ✅ If auto is ARMED (picked a value), SPIN becomes "PLAY AUTO"
if (state.ui.autoArmed) {
 
  const rounds = state.ui.autoPendingRounds ?? -1;

  state.ui.auto = true;
  state.ui.autoRounds = rounds;
  state.ui.autoLeft = (rounds === -1) ? 0 : rounds;

  // ✅ clear armed state now that auto is actually running
  state.ui.autoArmed = false;
  state.ui.autoPendingRounds = -1;

  autoBtnPixi?.setOn?.(true);

  // close menu if it's still open
  autoMenuApi?.close?.();
uiController.applyUiLocks();

  refreshAutoSpinSpinButton(); // ✅ now show STOP AUTO skin + counter
  void doSpin();
  return;
}


        // ✅ If we're in BASE and can't afford the bet, show the BUY menu toast
        const bet = state.bank.betLevels[state.bank.betIndex];
        const inFreeSpins = state.fs.remaining > 0;

        if (!inFreeSpins && state.bank.balance < bet) {
          buyMenuApi?.showInsufficientToast?.();

          updateSpinButtonVisualState();
          return;
        }

       // ✅ REPLAY: play the loaded replay instead of placing a bet
if (getReplayParams() && pendingReplayRes) {
  const r = pendingReplayRes;

  // prevent double-click / re-entry
  pendingReplayRes = null;

  try {
    await playSpin(r);
  } finally {
  // allow “Play Again”
  pendingReplayRes = r;

  // ✅ keep replay UI showing PLAY skin
  state.ui.auto = false;
  state.ui.autoArmed = true;
  state.ui.autoPendingRounds = -1;
  refreshAutoSpinSpinButton();
}


  return;
}

// Normal mode
void doSpin();

      
      },
       { clickSfx: null } // ✅ no ui_click on SPIN
      
    );
// ✅ Bigger hit area for SPIN only (doesn't change visuals)
const isTouch =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.matchMedia?.("(pointer: coarse)")?.matches;

const SPIN_HIT_PAD_X = isTouch ? 40 : 6;
const SPIN_HIT_PAD_Y = isTouch ? 34 : 6;

const bb = spinBtnPixi.getLocalBounds();
spinBtnPixi.hitArea = new Rectangle(
  bb.x - SPIN_HIT_PAD_X,
  bb.y - SPIN_HIT_PAD_Y,
  bb.width + SPIN_HIT_PAD_X * 2,
  bb.height + SPIN_HIT_PAD_Y * 2
);



uiPanel.addChild(spinBtnPixi);


    

 // =====================
// ✅ AUTO SPIN VISUALS (PLAY/STOP skins + countdown number)
// =====================

// Text in the center of the button (used only during STOP/AUTO running)
const autoSpinCountText = new Text({
  text: "",
  style: {
    fontFamily: "pixeldown",
    fill: 0xffffff,
    fontSize: 60,
    align: "center",
    stroke: { color: 0x000000, width: 8 },
    dropShadow: true,
    dropShadowAlpha: 0.85,
    dropShadowBlur: 0,
    dropShadowDistance: 6,
    dropShadowAngle: -Math.PI / 4,
  } as any,
});
autoSpinCountText.anchor.set(0.5);
autoSpinCountText.roundPixels = true;
autoSpinCountText.eventMode = "none";
autoSpinCountText.visible = false;
spinBtnPixi.addChild(autoSpinCountText);
// ✅ Infinity icon (replaces "∞" text when rounds === -1)
const autoSpinInfinityIcon = new Sprite(Texture.from(INFINITY_ICON_URL));
autoSpinInfinityIcon.anchor.set(0.5);
autoSpinInfinityIcon.roundPixels = true;
autoSpinInfinityIcon.eventMode = "none";
autoSpinInfinityIcon.visible = false;
spinBtnPixi.addChild(autoSpinInfinityIcon);


function layoutAutoSpinCountText() {
  // default: centered
  let ox = 0;
  let oy = 0;

  // ✅ When STOP AUTO is showing, center to STOP button art
  if (__spinAutoMode === "STOP") {
    const tStop = texAutoMenu("btn_spinstop_auto.png");
    const o = getTexVisualCenterOffset(tStop);
    ox = o.x;
    oy = o.y + COUNTDOWN_Y_NUDGE_PX; // 🔧 optical nudge
  }

  // position text
  autoSpinCountText.x = Math.round(ox);
  autoSpinCountText.y = Math.round(oy);

  // position icon at same place
  autoSpinInfinityIcon.x = autoSpinCountText.x;
  autoSpinInfinityIcon.y = autoSpinCountText.y;

  // scale icon to match your countdown size (local coords; spinBtnPixi scaling applies on top)
  // tweak ICON_H until it looks perfect
  const ICON_H = 20; // 🔧 try 48..64
  const th = autoSpinInfinityIcon.texture.height || 1;
  const s = ICON_H / th;
  autoSpinInfinityIcon.scale.set(s);
}



// 🔧 Optical adjustment for countdown text (positive = down)
const COUNTDOWN_Y_NUDGE_PX = -8; // tweak ±1–3px if needed


function getTexVisualCenterOffset(tex: Texture) {
  const orig = (tex as any).orig;
  const trim = (tex as any).trim;
  const frame = (tex as any).frame;

  // no trim => center is true center
  if (!orig || !trim || !frame) return { x: 0, y: 0 };

  // center of the trimmed frame inside the original untrimmed texture
  const cx = trim.x + frame.width * 0.5;
  const cy = trim.y + frame.height * 0.5;

  // offset relative to original center (this is what we need in sprite-local coords)
  return {
    x: cx - orig.width * 0.5,
    y: cy - orig.height * 0.5,
  };
}


// ✅ Reference SPIN size (from your normal SPIN_UP texture in ui.json)
const SPIN_REF_TEX = texUI(SPIN_UP);
const SPIN_REF_W = SPIN_REF_TEX.width || 1;
const SPIN_REF_H = SPIN_REF_TEX.height || 1;

// Helper: directly swap textures on your existing 3-sprite button
function setSpinButtonTextures(upT: Texture, hoverT: Texture, downT: Texture) {
  const kids = spinBtnPixi.children as any[];
  const up = kids[0] as Sprite;
  const hover = kids[1] as Sprite;
  const down = kids[2] as Sprite;

  up.texture = upT;
  hover.texture = hoverT;
  down.texture = downT;

  // ✅ FORCE all 3 sprites to the same "native" size as btn_spin_up.png
  // (fixes atlas trimming differences between ui.json and auto_menu_ui.json)
  for (const s of [up, hover, down]) {
    s.width = SPIN_REF_W;
    s.height = SPIN_REF_H;
  }

  // force a clean state
  up.visible = true;
  hover.visible = false;
  down.visible = false;

  // keep btnWidth/btnHeight accurate for layout scaling
  (spinBtnPixi as any).btnWidth = () => up.width;
  (spinBtnPixi as any).btnHeight = () => up.height;

  // Re-center hit area after swap (important for trimmed atlas frames)
  const bb = spinBtnPixi.getLocalBounds();
  const padX = IS_TOUCH ? 40 : 6;
  const padY = IS_TOUCH ? 34 : 6;
  spinBtnPixi.hitArea = new Rectangle(
    bb.x - padX,
    bb.y - padY,
    bb.width + padX * 2,
    bb.height + padY * 2
  );

  layoutAutoSpinCountText();
}


type SpinAutoVisualMode = "NORMAL" | "PLAY" | "STOP";
let __spinAutoMode: SpinAutoVisualMode = "NORMAL";

function setSpinAutoMode(mode: SpinAutoVisualMode) {
  if (__spinAutoMode === mode) return;
  __spinAutoMode = mode;

  if (mode === "NORMAL") {
    // default spin button skins (ui atlas)
    setSpinButtonTextures(texUI(SPIN_UP), texUI(SPIN_HOVER), texUI(SPIN_DOWN));
    autoSpinCountText.visible = false;
    return;
  }

  if (mode === "PLAY") {
    // ✅ from auto_menu_ui atlas
    const t = texAutoMenu("btn_spinplay_auto.png");
    setSpinButtonTextures(t, t, t);
    autoSpinCountText.visible = false; // play state has no counter
    return;
  }

  // STOP (auto running)
  {
    const t = texAutoMenu("btn_spinstop_auto.png");
    setSpinButtonTextures(t, t, t);
    autoSpinCountText.visible = true;
    layoutAutoSpinCountText();
  }
}

function refreshAutoSpinSpinButton() {
  const autoRunning = !!state.ui.auto;
  const autoArmed = !!state.ui.autoArmed;

  if (autoRunning) {
    setSpinAutoMode("STOP");

    const rounds = state.ui.autoRounds ?? -1;
    const left = state.ui.autoLeft ?? 0;

    const isInfinite = (rounds === -1);

    // ✅ show either number OR infinity icon
    autoSpinCountText.visible = !isInfinite;
    autoSpinInfinityIcon.visible = isInfinite;

    if (!isInfinite) {
      autoSpinCountText.text = String(Math.max(0, left));
    }

    layoutAutoSpinCountText();
    return;
  }

  if (autoArmed) {
    setSpinAutoMode("PLAY");
    autoSpinCountText.visible = false;
    autoSpinInfinityIcon.visible = false;
    return;
  }

  setSpinAutoMode("NORMAL");
  autoSpinCountText.visible = false;
  autoSpinInfinityIcon.visible = false;
}


// Keep it correct on resize/layout
window.addEventListener("resize", () => {
  layoutAutoSpinCountText();
  refreshAutoSpinSpinButton();
});

// Optional always-correct updater (lightweight)
addSystem(() => {
  if (!spinBtnPixi.visible) return;
  refreshAutoSpinSpinButton();
});



refreshLocalizedText();

    // =====================
    // SPIN BUTTON "BROKE" SKIN SWAP
    // =====================
    let spinSkinsAreBroke = false;

    function setSpinSkinsBroke(on: boolean) {
      if (spinSkinsAreBroke === on) return;
      spinSkinsAreBroke = on;

    if (on) {
      setPngButtonSkins(spinBtnPixi, SPIN_SPINNING, SPIN_HOVER, SPIN_DOWN);
    } else {
      setPngButtonSkins(spinBtnPixi, SPIN_UP, SPIN_HOVER, SPIN_DOWN);
    }
    }

    // "Spinning" overlay (same position as spin button, no input)
    const spinningBtnPixi = new Sprite(texUI(SPIN_SPINNING));
    spinningBtnPixi.anchor.set(0.5);
    spinningBtnPixi.visible = false;
    spinningBtnPixi.eventMode = "none"; // clicking does nothing
    uiPanel.addChild(spinningBtnPixi);







  



    const settingsBtnPixi = makePngToggleButton(
      SETTINGS_OFF_UP,
      SETTINGS_OFF_HOVER,
      SETTINGS_OFF_DOWN,
      SETTINGS_ON_UP,
      SETTINGS_ON_HOVER,
      SETTINGS_ON_DOWN,
      false,
      (isOn) => {
      state.ui.settingsOpen = isOn;

      layoutStudioTag();
root.sortChildren();
      // 🔧 Nudge the ON button slightly left
    const SETTINGS_ON_OFFSET_X = -2; // tweak: -4 to -12 feels good

    settingsBtnPixi.x += isOn ? SETTINGS_ON_OFFSET_X : -SETTINGS_ON_OFFSET_X;

   uiBottom.setDimmer(state.ui.settingsOpen);

  if (state.ui.settingsOpen) settingsApi?.open?.();
  else settingsApi?.close?.();

      // Let the single source of truth decide which buttons are enabled/greyed
uiController.applyUiLocks();


      // ✅ Opening settings should NOT disrupt FREE SPINS auto-chaining.
// Only stop BASE auto (your state.ui.auto system) when NOT in free spins.
if (state.ui.settingsOpen && !uiController.isInFreeSpinsMode()) {
  stopAutoNow("settings opened");
  autoBtnPixi.setOn(false);
}

    }

    );

    // ✅ IMPORTANT: settings should be ABOVE the dimmer
    uiPanel.addChild(settingsBtnPixi);



  // =====================
  // SETTINGS MENU (external module)
  // =====================

  settingsApi = createSettingsMenu({
    app,
    root,
    state,
t,
     uiDimmer: uiBottom.uiDimmer,
    settingsBtnPixi,

    // when settings closes, re-enable UI buttons
 onClosed: () => {
  // SettingsMenu can be closed by clicking outside, so force-sync the toggle state.
  state.ui.settingsOpen = false;
  

  // ensure the settings toggle looks OFF
  settingsBtnPixi?.setOn?.(false);

  // re-apply your "only turbo+settings in FS" rules
  uiController.applyUiLocks();
},


    texUI,
    texSymbols,
    setScaleToHeight,
    makePngButton,

    ICON_INFO,
    ICON_SFX_ON,
    ICON_SFX_OFF,
    ICON_MUSIC_ON,
    ICON_MUSIC_OFF,

    CLOSE_UP,
    CLOSE_HOVER,
    CLOSE_DOWN,

  getSfxMuted: () => audio?.getSfxMuted?.() ?? false,
setSfxMuted: (v: boolean) => audio?.setSfxMuted?.(v),

getMusicMuted: () => audio?.getMusicMuted?.() ?? false,
setMusicMuted: (v: boolean) => audio?.setMusicMuted?.(v),

applyAudioUI: () => {
  audio?.apply?.();
},

makeSlider,

getSfxValue01: () => audio?.getSfxVolume01?.() ?? 0.8,
getMusicValue01: () => audio?.getMusicVolume01?.() ?? 0.6,
setSfxValue01: (v01: number) => audio?.setSfxVolume01?.(v01),
setMusicValue01: (v01: number) => audio?.setMusicVolume01?.(v01),


  });






    const buyBtnPixi = makePngButton(
      
      BUY_UP,
      BUY_HOVER,
      BUY_DOWN,
   () => {
    if (getReplayParams()) return;
    if (state.ui.spinning) return; // ✅ block during spin
    stopAutoNow("buy button");
    

    // close settings if open
if (state.ui.settingsOpen) {
  stopAutoNow("settings opened");
}

    buyMenuApi?.openBuy?.();
    state.ui.buyMenuOpen = true; // ✅ if your buy menu doesn't already set this
layoutStudioTag();
root.sortChildren();
  }

    );
    // ✅ overlay + "opaque disable" behavior for BUY
const buyDisabledOverlay = installDisabledOverlayForBuy(buyBtnPixi);

// Keep a reference to the original setEnabled (from makePngButton)
const __buySetEnabled = (buyBtnPixi as any).setEnabled?.bind(buyBtnPixi);

// Override: disable should NOT fade the button — it should show grey overlay instead
(buyBtnPixi as any).setEnabled = (enabled: boolean) => {
  // keep the original sprite-state reset behavior if your helper relies on it
  __buySetEnabled?.(enabled);

  // BUT force the visual rule you want:
  buyBtnPixi.alpha = 1.0;                 // ✅ never transparent
  buyBtnPixi.eventMode = enabled ? "static" : "none";
  buyBtnPixi.cursor = enabled ? "pointer" : "default";

  // show grey overlay when disabled
  buyDisabledOverlay.visible = !enabled;
buyDisabledOverlay.alpha = !enabled ? 0.7 : 0; // ✅ ensure it isn't stuck at 0

  // when disabling, force the UP visual so it doesn't stick on hover/down
  if (!enabled) (buyBtnPixi as any)?.resetVisual?.();
};

(buyBtnPixi as any)._redrawDisabledOverlay?.();

// ✅ BUY overlay clipped to button shape (alpha mask)
function installDisabledOverlayForBuy(btn: Container) {
  // children[0] is the "up" sprite in makePngButton()
  const upSprite = btn.children?.[0] as Sprite | undefined;

  const overlay = new Graphics();
  overlay.eventMode = "none";
  overlay.visible = false;
  overlay.alpha = 0.9; // 🔧 overlay opacity
  overlay.zIndex = 9999;

  // Use a sprite mask so we clip to the PNG’s alpha shape
  const maskSprite = new Sprite(upSprite?.texture ?? Texture.WHITE);
  maskSprite.anchor.set(0.5);
maskSprite.visible = true;     // ✅ must be renderable for masking
maskSprite.alpha = 0.001;      // ✅ effectively invisible (don’t use 0)
maskSprite.eventMode = "none"; // ✅ no input
  maskSprite.zIndex = overlay.zIndex + 1;

  // ensure overlay sits above the 3 sprites
  (btn as any).sortableChildren = true;

  function redraw() {
    // keep mask synced with the UP sprite texture + transform
    if (upSprite) {
      maskSprite.texture = upSprite.texture;
      maskSprite.position.set(upSprite.x, upSprite.y);
      maskSprite.scale.set(upSprite.scale.x, upSprite.scale.y);
      maskSprite.rotation = upSprite.rotation;
      maskSprite.skew.set((upSprite as any).skew?.x ?? 0, (upSprite as any).skew?.y ?? 0);
    }

    // draw a big rect; mask will clip it to the button shape
    const b = btn.getLocalBounds();
    overlay.clear();
    overlay
      .rect(b.x, b.y, Math.max(1, b.width), Math.max(1, b.height))
      .fill({ color:0x9aa1a8, alpha: 1 });
  }

  // IMPORTANT: mask MUST be in the scene graph
  btn.addChild(overlay);
  btn.addChild(maskSprite);

  overlay.mask = maskSprite;

  redraw();
  btn.sortChildren();

  // expose helpers
  (btn as any)._disabledOverlay = overlay;
  (btn as any)._disabledOverlayMask = maskSprite;
  (btn as any)._redrawDisabledOverlay = redraw;

  return overlay;
}



    // ✅ Bigger hit area for BUY only
const BUY_HIT_PAD_X = IS_TOUCH ? 36 : 6;
const BUY_HIT_PAD_Y = IS_TOUCH ? 30 : 6;

const buyBB = buyBtnPixi.getLocalBounds();
buyBtnPixi.hitArea = new Rectangle(
  buyBB.x - BUY_HIT_PAD_X,
  buyBB.y - BUY_HIT_PAD_Y,
  buyBB.width + BUY_HIT_PAD_X * 2,
  buyBB.height + BUY_HIT_PAD_Y * 2
);


    uiPanel.addChild(buyBtnPixi);





    // Auto toggle button (OFF <-> ON)
    const autoBtnPixi = makePngToggleButton(
      AUTO_OFF_UP,
      AUTO_OFF_HOVER,
      AUTO_OFF_DOWN,
      AUTO_ON_UP,
      AUTO_ON_HOVER,
      AUTO_ON_DOWN,
      state.ui.auto,
      
      (isOn) => {
        if (getReplayParams()) return;
        // If turning ON auto, check funds first (BASE only)
        if (isOn) {
          const bet = state.bank.betLevels[state.bank.betIndex];
          const inFreeSpins = state.fs.remaining > 0;

          if (!inFreeSpins && state.bank.balance < bet) {
            // revert toggle back OFF
            state.ui.auto = false;
            autoBtnPixi.setOn(false);

            buyMenuApi?.showInsufficientToast?.();

            return;
          }
        }

        state.ui.auto = isOn;

        if (state.ui.auto && !state.ui.spinning && !state.overlay.fsIntro && !state.overlay.fsOutro) {
          void doSpin();
        }
      }
    );

    // ✅ ADD IT TO THE UI
    uiPanel.addChild(autoBtnPixi);


function stopAutoNow(reason = "") {
  if (!state.ui.auto && (state.ui.autoRounds ?? -1) === -1 && (state.ui.autoPendingRounds ?? -1) === -1) return;

  

  state.ui.auto = false;
  state.ui.autoArmed = false; // ✅ clear armed state too

  // clear “armed” + “active” auto settings
  state.ui.autoPendingRounds = -1;
  state.ui.autoRounds = -1;
  state.ui.autoLeft = 0;

  autoBtnPixi?.setOn?.(false);

  // if the auto menu is open, close it
  if (autoMenuApi?.isOpen?.()) autoMenuApi?.close?.();
  refreshAutoSpinSpinButton();

}



(autoBtnPixi as any).setTapHandler?.(() => {
  if (getReplayParams()) return;
  if (state.ui.settingsOpen || state.ui.buyMenuOpen) return;

  if (state.ui.auto) {
    stopAutoNow("auto button");
    return;
  }

  // only block *opening the menu* while spinning
  if (state.ui.spinning) return;

  autoMenuApi?.open?.();
});



// Make the AUTO button open the auto menu instead of toggling immediately




    // Turbo toggle button
    const turboBtnPixi = makePngToggleButton(
      TURBO_OFF_UP,
      TURBO_OFF_HOVER,
      TURBO_OFF_DOWN,
      TURBO_ON_UP,
      TURBO_ON_HOVER,
      TURBO_ON_DOWN,
      state.ui.turbo,
      (isOn) => {
        state.ui.turbo = isOn;
        // Optional: reference state.ui.turbo inside doSpin() to speed things up
      }
    );

    uiPanel.addChild(turboBtnPixi);








  

  





   betDownBtnPixi = makePngButton(
    
  BET_DOWN_UP,
  BET_DOWN_HOVER,
  BET_DOWN_DOWN,
  () => {
    if (uiController.isInFreeSpinsMode()) return; // ✅ hard safety
    stopAutoNow("bet down");

    if (state.bank.betIndex > 0) {
  state.bank.betIndex--;

  // ✅ persist selected bet per currency
  try {
    const cur = String(rgsClient.getLastAuth()?.balance?.currency ?? "USD").toUpperCase();
    localStorage.setItem(`bf_lastBetIndex_${cur}`, String(state.bank.betIndex));
  } catch {}

  updateBetUI();
  uiController?.refreshSpinAffordability?.();
  if (state.ui.buyMenuOpen) buyMenuApi?.layoutBuy?.();
}
  }
);

betUpBtnPixi = makePngButton(
  BET_UP_UP,
  BET_UP_HOVER,
  BET_UP_DOWN,
  () => {
    if (uiController.isInFreeSpinsMode()) return; // ✅ hard safety
    stopAutoNow("bet up");

    if (state.bank.betIndex < state.bank.betLevels.length - 1) {
  state.bank.betIndex++;

  // ✅ persist selected bet per currency
  try {
    const cur = String(rgsClient.getLastAuth()?.balance?.currency ?? "USD").toUpperCase();
    localStorage.setItem(`bf_lastBetIndex_${cur}`, String(state.bank.betIndex));
  } catch {}

  updateBetUI();
  uiController?.refreshSpinAffordability?.();
  if (state.ui.buyMenuOpen) buyMenuApi?.layoutBuy?.();
}
  }
);


// ✅ now buttons exist, we can parent them safely (desktop groups)
betControlsGroup.addChild(betUpBtnPixi, betDownBtnPixi);

    // =====================
// AUTO MENU (sub menu)
// =====================
autoMenuApi = createAutoMenu({
  app,
  root, // ✅ root is correct (menus should sit above everything)
 texAutoMenu, 
  // If you want the menu to share your UI dimmer, pass it:
  // uiDimmer,
  audio,
  initialSelectedRounds: -1,
    t,
  
onPick: (rounds) => {
  // ✅ arm the selection (do NOT start auto yet)
  state.ui.autoPendingRounds = rounds;
  state.ui.autoArmed = true;

  // ✅ swap SPIN to "PLAY AUTO" immediately
  refreshAutoSpinSpinButton();
},


onClosed: () => {
  // ✅ If user closes the menu without confirming, revert SPIN visuals
  if (!state.ui.auto) {
    state.ui.autoArmed = false;
    state.ui.autoPendingRounds = -1;
  }

  uiController.applyUiLocks();

  // ✅ This will restore btn_spin_up.png (NORMAL) if not armed/running
  refreshAutoSpinSpinButton();
},

});

uiController = createUiController({
  state,

  spinBtn: spinBtnPixi,
  buyBtn: buyBtnPixi,
  autoBtn: autoBtnPixi,
  turboBtn: turboBtnPixi,
  betUpBtn: betUpBtnPixi,
  betDownBtn: betDownBtnPixi,

  autoMenuApi,
  refreshAutoSpinSpinButton,
});

   

buyMenuApi = createBuyMenu({
  app,
  root,
  uiLayer,
  state,
audio,
  texUI,
  texExtra,
t,
  setScaleToHeight,
  makePngButton,
  makePngToggleButton,

fmtMoney,
updateBetUI,
refreshSpinAffordability: () => uiController?.refreshSpinAffordability?.(),




  onBalanceUpdated: () => {
    balanceLabel.text = fmtMoney(state.bank.balance);
  },

  spinBtnPixi,
  spinningBtnPixi,
  settingsBtnPixi,
  buyBtnPixi,
  autoBtnPixi,
  turboBtnPixi,
  betDownBtnPixi,
  betUpBtnPixi,

  enterFreeSpins,

  CLOSE_UP,
  CLOSE_HOVER,
  CLOSE_DOWN,

  BET_DOWN_UP,
  BET_DOWN_HOVER,
  BET_DOWN_DOWN,

  BET_UP_UP,
  BET_UP_HOVER,
  BET_UP_DOWN,

  waitMs,
  animateMs,
  tween,
  easeOutCubic,
  easeOutBack,
  easeInCubic,
});



    // ✅ INSTALL UI INPUT CONTROLLER (ONE-TIME)
installUiInputController({
  state,
  doSpin,
  stopAutoNow,
  refreshAutoSpinSpinButton,
  autoBtnPixi,
  uiController,
  splashLayer,
  fsDimmer,
  audio,
});





function winPopupScaleMul() {
  const IS_TINY_VIEW = !!(__layoutDeps as any)?.IS_TINY_VIEW;
  if (IS_TINY_VIEW) return 0.45; // keep tiny unchanged

  // ✅ mobile portrait ONLY: smaller popups
  if (isMobilePortraitUILayout(__layoutDeps)) return 0.5; // 🔧 try 0.55–0.65

  // ✅ keep mobile landscape unchanged (use 0.72 as it is now)
  if (isMobileLandscapeUILayout(__layoutDeps)) return 0.5;

  // desktop/tablet unchanged
  return 1.0;
}






function ensureBetParentingForLayout() {
  // ✅ called during early boot/layout; buttons may not exist yet
  if (!betUpBtnPixi || !betDownBtnPixi || !betAmountUI || !betTitleLabel) return;

 const portrait = isMobilePortraitUILayout(__layoutDeps);
const landMobile = isMobileLandscapeUILayout(__layoutDeps);

  if (portrait) {
   // PORTRAIT: everything goes into betGroup
    if (betTitleLabel.parent !== betGroup) betGroup.addChild(betTitleLabel);
    if (betAmountUI.parent !== betGroup) betGroup.addChild(betAmountUI);
    if (betUpBtnPixi.parent !== betGroup) betGroup.addChild(betUpBtnPixi);
    if (betDownBtnPixi.parent !== betGroup) betGroup.addChild(betDownBtnPixi);

    betGroup.visible = true;
    betDisplayGroup.visible = false;
    betControlsGroup.visible = false;
  } else {
    // ✅ DESKTOP + MOBILE LANDSCAPE: split groups
    if (betTitleLabel.parent !== betDisplayGroup) betDisplayGroup.addChild(betTitleLabel);
    if (betAmountUI.parent !== betDisplayGroup) betDisplayGroup.addChild(betAmountUI);

    if (betUpBtnPixi.parent !== betControlsGroup) betControlsGroup.addChild(betUpBtnPixi);
    if (betDownBtnPixi.parent !== betControlsGroup) betControlsGroup.addChild(betDownBtnPixi);

    betGroup.visible = false;
    betDisplayGroup.visible = true;
    betControlsGroup.visible = true;
  }
}

let uiPanelH = 0; 
const { layoutUI } = makeLayoutUI({
  __layoutDeps,
  appScreenW: () => app.screen.width,
  appScreenH: () => app.screen.height,

  PANEL_HEIGHT_FRAC: () => PANEL_HEIGHT_FRAC,

  safeInsetBottomPx: () => safeInsetBottomPx(),

  uiBottom,
  uiPanel,

  spinBtnPixi,
  spinningBtnPixi,
  buyBtnPixi,
  settingsBtnPixi,
  autoBtnPixi,
  turboBtnPixi,

  ensureBetParentingForLayout,

  setScaleToHeight,
  centerPivot,

  winUI,
  winTitleLabel,
  winAmountLabel,

  balanceGroup,
  balanceTitleLabel,
  balanceLabel,

  betGroup,
  betTitleLabel,
  betAmountUI,
  betUpBtnPixi,
  betDownBtnPixi,

  betDisplayGroup,
  betControlsGroup,

  setTightHitArea: (btn, padX, padY) => setTightHitArea(btn, padX, padY),

  setUiPanelH: (v) => { uiPanelH = v; },
});





function layoutUIMobile(panelW: number, targetH: number) {

  // ✅ MUST be first so betGroup really contains the bet items in portrait
ensureBetParentingForLayout();

  
// ===== WIN UI (hidden in portrait mobile) =====
winUI.visible = false;
winTitleLabel.visible = false;
winAmountLabel.visible = false;
  
  const w = panelW;
  const h = targetH;

  // --- tuning knobs ---
  const MAIN_BTN_H = h * 1.60;   // SPIN
  const BUY_BTN_H  = h * 1.2;   // BUY
  const MINI_BTN_H = h * 0.72;   // AUTO / TURBO / SETTINGS






  const winGap = Math.round(h * 0.30);
  winTitleLabel.x = 0;
  winTitleLabel.y = -winGap;
  winAmountLabel.x = 0;
  winAmountLabel.y = 4;

// ===== SPIN (portrait: always centered horizontally) =====
const SPIN_Y = -1; // tweak 0.55..0.78
const SPIN_Y_OFFSET = -h * 0.12; 
spinBtnPixi.x = Math.round(w * 0.5);        // ✅ center horizontally
spinBtnPixi.y = Math.round(h * SPIN_Y + SPIN_Y_OFFSET);// keep Y tunable
setScaleToHeight(spinBtnPixi, MAIN_BTN_H);

// ===== BUY (portrait: LEFT of SPIN) =====
const BUY_OFFSET_X = 0.34; // same distance as AUTO/TURBO, mirrored
const BUY_Y = SPIN_Y;

buyBtnPixi.x = Math.round(w * 0.5 - w * BUY_OFFSET_X);
buyBtnPixi.y = Math.round(h * BUY_Y);
setScaleToHeight(buyBtnPixi, BUY_BTN_H);

// ===== AUTO + TURBO (portrait, right of SPIN) =====
// TUNING KNOBS
const AT_OFFSET_X = 0.32; // distance to the right of SPIN (0.14..0.24)
const AT_GAP_Y = 0.33;    // vertical gap between AUTO / TURBO
const spinX = Math.round(w * 0.5);
const spinY = Math.round(h * SPIN_Y);

// AUTO (above)
autoBtnPixi.x = Math.round(spinX + w * AT_OFFSET_X);
autoBtnPixi.y = Math.round(spinY - h * AT_GAP_Y);
setScaleToHeight(autoBtnPixi, MINI_BTN_H);

// TURBO (below)
turboBtnPixi.x = Math.round(spinX + w * AT_OFFSET_X);
turboBtnPixi.y = Math.round(spinY + h * AT_GAP_Y);
setScaleToHeight(turboBtnPixi, MINI_BTN_H);




// =====================
// PORTRAIT: BET + BALANCE are INDEPENDENT (no shared row / no shared scaling)
// =====================

// (keep WIN hidden for portrait)
winUI.visible = false;
winTitleLabel.visible = false;
winAmountLabel.visible = false;

// ---------- SETTINGS ----------
setScaleToHeight(settingsBtnPixi, MINI_BTN_H * 0.75);
centerPivot(settingsBtnPixi);

// ---------- BET (internal layout) ----------
setScaleToHeight(betAmountUI, h * 0.36);
centerPivot(betAmountUI);




// portrait-only: gap between bet arrows and pill
const BET_ARROW_TO_PILL_MUL = 0.5; // 🔧 0.70..0.85

// ✅ PORTRAIT ONLY: move bet arrows left (more negative = further left)
const BET_ARROWS_X_OFFSET_PX = 2; // 🔧 try 8..30

const BET_BTN_X   = -betAmountUI.width * BET_ARROW_TO_PILL_MUL - BET_ARROWS_X_OFFSET_PX;
const BET_BTN_GAP = 25; // ✅ fixed gap in px (portrait only). Tweak 28..44

const BET_BTN_Y_BIAS = -betAmountUI.height * 0.24;


betAmountUI.position.set(0, 0);

// 🔧 PORTRAIT ONLY: move the "BET" label up/down (negative = up, positive = down)
const BET_LABEL_Y_OFFSET_PX = -10; // <- change this

const BET_TITLE_Y = -betAmountUI.height * 0.6 + BET_LABEL_Y_OFFSET_PX;

betTitleLabel.anchor.set(0.5);
betTitleLabel.position.set(0, Math.round(BET_TITLE_Y));

setScaleToHeight(betUpBtnPixi, h * 0.32);
setScaleToHeight(betDownBtnPixi, h * 0.32);

betUpBtnPixi.position.set(
  Math.round(BET_BTN_X),
  Math.round(-BET_BTN_GAP + BET_BTN_Y_BIAS)
);

betDownBtnPixi.position.set(
  Math.round(BET_BTN_X),
  Math.round(+BET_BTN_GAP + BET_BTN_Y_BIAS)
);

centerPivot(betGroup);

// ---------- BALANCE (internal layout) ----------
balanceLabel.anchor.set(1, 0.5);
balanceTitleLabel.anchor.set(1, 0.5);

// ✅ portrait: BALANCE label ABOVE the amount (purely local, affects ONLY balance)
const BALANCE_TITLE_Y_OFFSET  = -70; // label up
const BALANCE_AMOUNT_Y_OFFSET =  -45; // amount down

balanceTitleLabel.position.set(0, BALANCE_TITLE_Y_OFFSET);
balanceLabel.position.set(0, BALANCE_AMOUNT_Y_OFFSET);


// ✅ pivot to RIGHT edge so the group can be pinned to the device right side
{
  const b = balanceGroup.getLocalBounds();
  balanceGroup.pivot.set(b.x + b.width, b.y + b.height / 2);
}


// ===================================================
// ✅ INDEPENDENT SCREEN POSITIONS (NO COUPLING)
// Tweak these freely — changing BET will NOT change BALANCE.
// ===================================================

// overall vertical line for these HUD items
const HUD_Y = Math.round(h * 0.55);


// SETTINGS position (✅ portrait: left-anchored to device)
const SAFE_L = 0; // (no safeInsetLeft helper yet)
const SETTINGS_PAD_L = 10;  // 🔧 left padding from device edge
const SETTINGS_PAD_Y = -6;  // 🔧 vertical nudge (negative = up)

const sb = settingsBtnPixi.getLocalBounds(); // assumes centerPivot(settingsBtnPixi) was called

const SETTINGS_X = Math.round(SAFE_L + SETTINGS_PAD_L + sb.width * 0.5);
const SETTINGS_Y = Math.round(HUD_Y + SETTINGS_PAD_Y);

settingsBtnPixi.position.set(SETTINGS_X, SETTINGS_Y);






// BALANCE position (✅ portrait: right aligned to device edge)
const BAL_RIGHT_PAD = 5;                 // 🔧 distance from device right edge
const BAL_Y = HUD_Y - (h * 0.09);         // keep your existing vertical behavior
balanceGroup.position.set(
  Math.round(w - BAL_RIGHT_PAD),
  Math.round(BAL_Y)
);




  // (Optional) reset hover visuals on mobile
  spinBtnPixi.resetVisual?.();
  buyBtnPixi.resetVisual?.();
}



    // You'll tweak these 4 numbers to match the opening in your art.
    const REEL_WINDOW_INSET = {
      left: 110,
      top: 310,
      right: 110,
      bottom: 310,
    };

    // These will be updated by layoutAll() and used everywhere via boardOrigin()
    let boardOx = 0;
    let boardOy = 0;
    let boardTotalW = 0;
    let boardTotalH = 0;








    // --- Reel house + mask ---
    const reelHouse = new Sprite(texReelhouse("reel_house.png"));
    
    reelHouse.anchor.set(0.5);
    reelHouseLayer.addChild(reelHouse);
// ✅ FS counter can now safely anchor to the reel house (TDZ-safe)
getFsReelAnchor = () => getReelAnchor(reelHouse);
    // =====================
    // TUMBLE WIN BANNER (Gates-like)
    // =====================

    function isTinyViewNow(): boolean {
  return !!(__layoutDeps as any)?.IS_TINY_VIEW;
}
    const tumbleBanner = new Container();
    tumbleBanner.zIndex = 4000;           // above reelhouse/grid, below overlay stuff
    tumbleBanner.visible = false;
    tumbleBanner.alpha = 0;
    tumbleBanner.eventMode = "none";
    root.addChild(tumbleBanner);
    root.sortChildren();

    const tumbleBannerBg = new Graphics();
tumbleBanner.addChild(tumbleBannerBg);

// ✅ NEW: content group (label + amount live inside this)
const tumbleBannerContent = new Container();
tumbleBanner.addChild(tumbleBannerContent);

const tumbleBannerLabel = new Text({
  text: t("ui.tumbleWin"),
  style: localizeStyle({
    fontFamily: "pixeldown",
    fill: 0xffffff,
    fontSize: 64,
    letterSpacing: 1,
    stroke: { color: 0x000000, width: 8 },
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowAlpha: 0.75,
    dropShadowBlur: 0,
    dropShadowDistance: 8,
    dropShadowAngle: -Math.PI / 4,
  } as any),
} as any);

const tumbleBannerValue = new Text({
  text: "",
  style: localizeStyle({
    fontFamily: "pixeldown",
    fill: 0xffd36a,
    fontSize: 64,
    letterSpacing: 1,
    stroke: { color: 0x000000, width: 8 },
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowAlpha: 0.75,
    dropShadowBlur: 0,
    dropShadowDistance: 8,
    dropShadowAngle: -Math.PI / 4,
  } as any),
} as any);

// ✅ Put label/value inside the content group
tumbleBannerContent.addChild(tumbleBannerLabel, tumbleBannerValue);



    // --- TUNING ---
    const TUMBLE_BANNER_PAD_X = 28;
    const TUMBLE_BANNER_PAD_Y = 5;
    const TUMBLE_BANNER_SCALE = 0.8; // 🔽 try 0.7–0.9
    const TUMBLE_BANNER_BG_ALPHA = 0.35;
    const TUMBLE_BANNER_RADIUS = 0;     // 0 = sharp; try 14 for rounded
   
    // Portrait-only tuning (must be in outer scope)
const TUMBLE_PORTRAIT_SCALE = 0.47;   // tweak this



    let tumbleBannerToken = 0;

function tumbleBaseScale() {
  // ✅ responsive multiplier based on reel sizing (cellSize)
  // 130 is your “full size” cap from computeCellSize()
  const DESIGN_CELL = 130;

  // guard against early boot
  const cs = Math.max(1, cellSize || 1);

  // 1.0 when cellSize is 130, smaller below, larger above (rare)
  let responsive = cs / DESIGN_CELL;

  // clamp for safety
  responsive = Math.max(0.70, Math.min(1.25, responsive));

  // base (desktop / normal)
  let s = TUMBLE_BANNER_SCALE * responsive;

  // portrait override (still responsive)
  if (isMobilePortraitUILayout(__layoutDeps)) {
    s = TUMBLE_PORTRAIT_SCALE * responsive;
  }

  // mobile landscape tweak stays applied on top
  if (isMobileLandscapeUILayout(__layoutDeps)) {
    s *= MOBILE_LANDSCAPE_TUMBLE_BANNER_MUL;
  }

  return s;
}


let tumbleBannerShown = false;

function isTumbleBannerBlocked(): boolean {
 return (
    state.overlay.splash ||
    state.overlay.startup ||
    state.overlay.fsIntro ||
    state.overlay.fsOutro ||
    state.overlay.fsOutroPending ||
    state.overlay.bigWin ||
    state.ui.settingsOpen ||
    state.ui.buyMenuOpen
  );
}


    // Call this any time layout changes (resize / reel scaling)
function layoutTumbleBanner() {
    // ✅ Tiny view only: never show tumble banner
  const IS_TINY_VIEW = !!(__layoutDeps as any).IS_TINY_VIEW;
  if (IS_TINY_VIEW) {
    tumbleBanner.visible = false;
    tumbleBanner.alpha = 0;
    return;
  }
  
    // ✅ Don’t show tumble banner during overlays/menus that block the reels
  if (isTumbleBannerBlocked()) {
    tumbleBanner.visible = false;
    tumbleBanner.alpha = 0;
    return;
  }
  const safeT = safeInsetTopPx?.() ?? 0;

 

  const A = getReelAnchor(reelHouse);

// -------------------------
// TUNING
// -------------------------

// ✅ “a few px above the reel house”, but scales with reel size
// (so it stays visually consistent as the reel shrinks/grows)
const ABOVE_REEL_GAP_PX = Math.round(cellSize * -0.4); // 🔧 try 0.05..0.12

// optional: keep if you still need to compensate for art / inset
const REEL_TOP_VISUAL_OFFSET_PX = 70; // 🔧 try 0..120


  const PORTRAIT_TUMBLE_BANNER_Y_NUDGE = 0;
  const DESKTOP_TUMBLE_BANNER_Y_NUDGE = 0;

  const isDesktop =
    !isMobilePortraitUILayout(__layoutDeps) &&
    !isMobileLandscapeUILayout(__layoutDeps);

  // -------------------------
  // SCALE FIRST (so bannerH is correct)
  // -------------------------
  tumbleBanner.scale.set(tumbleBaseScale());

  // -------------------------
  // X: center above reel house
  // -------------------------
  tumbleBanner.x = Math.round(A.cx);

  // -------------------------
  // Layout label + value in content group
  // -------------------------
  const GAP = 6;

  tumbleBannerLabel.anchor.set(1, 0.5);
  tumbleBannerValue.anchor.set(0, 0.5);

  const CONTENT_OFFSET_X = 0;
  tumbleBannerLabel.x = -GAP / 2 + CONTENT_OFFSET_X;
  tumbleBannerValue.x = +GAP / 2 + CONTENT_OFFSET_X;

  const lb = tumbleBannerLabel.getLocalBounds();
  const vb = tumbleBannerValue.getLocalBounds();
  tumbleBannerLabel.y = -(lb.y + lb.height * 0.5);
  tumbleBannerValue.y = -(vb.y + vb.height * 0.5);

  const cb = tumbleBannerContent.getLocalBounds();
  tumbleBannerContent.pivot.set(cb.x + cb.width * 0.5, cb.y + cb.height * 0.5);
  tumbleBannerContent.position.set(0, 0);

  // -------------------------
  // Draw BG around content (local space)
  // -------------------------
  const w = Math.round(cb.width + TUMBLE_BANNER_PAD_X * 2);
  const h = Math.round(cb.height + TUMBLE_BANNER_PAD_Y * 2);

  tumbleBannerBg.clear();

  if (TUMBLE_BANNER_RADIUS > 0) {
    tumbleBannerBg
      .roundRect(-w / 2, -h / 2, w, h, TUMBLE_BANNER_RADIUS)
      .fill({ color: 0x000000, alpha: TUMBLE_BANNER_BG_ALPHA })
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });
  } else {
    tumbleBannerBg
      .rect(-w / 2, -h / 2, w, h)
      .fill({ color: 0x000000, alpha: TUMBLE_BANNER_BG_ALPHA })
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });
  }

  // -------------------------
  // Compute banner height AFTER BG + scale
  // -------------------------
  const bgLocalH = tumbleBannerBg.getLocalBounds().height;
  const bannerH = bgLocalH * tumbleBanner.scale.y;

  // -------------------------
  // Y: bottom of banner sits just above the reel house (with visual offset)
  // -------------------------
  const reelTopVisual = A.top + REEL_TOP_VISUAL_OFFSET_PX;

  let y = Math.round(reelTopVisual - bannerH * 0.5 - ABOVE_REEL_GAP_PX);

  if (isMobilePortraitUILayout(__layoutDeps)) y += PORTRAIT_TUMBLE_BANNER_Y_NUDGE;
  if (isDesktop) y += DESKTOP_TUMBLE_BANNER_Y_NUDGE;

 // keep out of notch/safe-top (top edge must be below safeT)
const minY = Math.round(safeT + bannerH * 0.5 + 2);
y = Math.max(y, minY);

// ✅ HARD RULE: banner must be ABOVE the reel house (no overlap ever)
// use the reel house TRUE top (not the visual offset)
const reelTopTrue = A.top;

// banner bottom edge = y + bannerH/2
// require: banner bottom <= reelTopTrue - gap
const maxY = Math.round(reelTopTrue - ABOVE_REEL_GAP_PX - bannerH * 0.5);
y = Math.min(y, maxY);


  tumbleBanner.y = y;
    tumbleBanner.visible = tumbleBannerShown && !isTumbleBannerBlocked();

}






   window.addEventListener("resize", () => {
  // keep it responsive while visible
  if (tumbleBannerShown) {
    tumbleBanner.scale.set(tumbleBaseScale() * 1.05);
  }
  layoutTumbleBanner();
});

    function setTumbleBannerText(totalSoFar: number) {
        // ✅ Tiny view: no tumble banner text updates at all
  if (isTinyViewNow()) return;
      tumbleBannerLabel.text = t("ui.tumbleWin");
      tumbleBannerValue.text = fmtMoney(totalSoFar);
      layoutTumbleBanner();
    }

    // Pop in quickly, hold, then pop out
    // =====================
    // Sticky banner controls
    // =====================




async function showOrUpdateTumbleWinBanner(totalSoFar: number) {
    // ✅ Tiny view: tumble banner is completely disabled
  if (isTinyViewNow()) {
    hideTumbleWinBannerNow();
    tumbleBannerShown = false;
    return;
  }
   // ✅ If an overlay/menu is up, hard-hide and do nothing.
  // Prevents any 1-frame “pop back” if something calls this during overlays.
  if (isTumbleBannerBlocked()) {
    hideTumbleWinBannerNow();
    tumbleBannerShown = false;
    return;
  }

  tumbleBannerToken++;
  const token = tumbleBannerToken;

  setTumbleBannerText(totalSoFar);
  layoutTumbleBanner();



 if (tumbleBannerShown && tumbleBanner.visible) {
  const base = tumbleBaseScale();
  if (!isTinyViewNow()) tumbleBanner.visible = true;
  tumbleBanner.alpha = 1;
  tumbleBanner.scale.set(base * 1.05);

  // ✅ NEW: after changing scale, recompute bg + y-position cleanly
  layoutTumbleBanner();

  return;
}



      tumbleBannerShown = true;

const base = tumbleBaseScale();

// First time: animate IN
if (!isTinyViewNow()) tumbleBanner.visible = true;
tumbleBanner.alpha = 0;
tumbleBanner.scale.set(base * 0.92);

await animateMs(160, (t) => {
  if (token !== tumbleBannerToken) return;
  const e = easeOutBack(t, 1.12);
  tumbleBanner.alpha = t;
  const s = (base * 0.92) + ((base * 1.05) - (base * 0.92)) * e;
  tumbleBanner.scale.set(s);
});

if (token !== tumbleBannerToken) return;
tumbleBanner.alpha = 1;
tumbleBanner.scale.set(base * 1.05);

    }



    // Animate OUT once the last tumble finishes
    async function hideTumbleWinBannerAfterLast(ms = 180) {
      if (!tumbleBannerShown || !tumbleBanner.visible) return;

      tumbleBannerToken++;
      const token = tumbleBannerToken;

      const startA = tumbleBanner.alpha;
      const startS = tumbleBanner.scale.x;

      await animateMs(ms, (t) => {
        if (token !== tumbleBannerToken) return;
        const e = easeInCubic(t);
        tumbleBanner.alpha = startA * (1 - e);
        const targetS = tumbleBaseScale() * 0.92;

    const s = startS + (targetS - startS) * e;
    tumbleBanner.scale.set(s);
      });

      if (token !== tumbleBannerToken) return;

      tumbleBanner.visible = false;
      tumbleBanner.alpha = 0;
      tumbleBanner.scale.set(tumbleBaseScale());
      // compute banner height AFTER scale



      tumbleBannerShown = false;
    }


    // Hard hide (safety)
    function hideTumbleWinBannerNow() {
      tumbleBannerToken++;
      tumbleBanner.visible = false;
      tumbleBanner.alpha = 0;
    }



    // =====================
    // REEL HOUSE MODE SWAP
    // =====================
    function setReelHouseForMode(mode: Mode) {
    reelHouse.texture =
      mode === "FREE_SPINS"
        ? texReelhouse("reel_house_free.png")
        : texReelhouse("reel_house.png");
  }


    const INSET_L = 0;   // + hides more on left
    const INSET_T = 0;   // + hides more on top
    const INSET_R = 0;   // + hides more on right
    const INSET_B = 0;   // + hides more on botto
    // Mask that clips symbols to the board rectangle
    const gridMask = new Graphics();
    // keep frames + symbols clipped to the reel window
    gridMask.clear();
  gridMask.rect(
      boardOx + INSET_L,
      boardOy + INSET_T,
      boardTotalW - INSET_L - INSET_R,
      boardTotalH - INSET_T - INSET_B
    ).fill(0xffffff);

    // ✅ FINAL: mask must be in the scene graph
root.addChild(gridMask);
gridMask.zIndex = 2055; // above gridLayer, below overlay stuff (tweak if needed)
root.sortChildren();



    layoutReelFlash();



    gridLayer.mask = gridMask;
    // clip payframes to the same reel window mask as the symbols
    payFrameLayer.mask = gridMask;




    // =====================
    // REEL DIMMER (covers reel house + symbols during cluster wins)
    // =====================
    const reelDimmer = new Graphics();
    reelDimmer.zIndex = 2050;     // above reelHouseLayer + gridLayer; below win frames if they’re higher
    reelDimmer.visible = false;
    reelDimmer.alpha = 0;
    reelDimmer.eventMode = "none"; // don’t block clicks

    // =====================
    // REEL HOUSE OUTER GLOW PULSE (one-shot)
    // =====================
    const reelHouseGlow = new Graphics();
    reelHouseGlow.zIndex = 2065;       // above reelDimmer (2050) so it stays visible
    reelHouseGlow.visible = true;
    reelHouseGlow.alpha = 0;
    reelHouseGlow.eventMode = "none";
    reelHouseGlow.filters = [new BlurFilter({ strength: 6 })]; // soft glow
    root.addChild(reelHouseGlow);

    function redrawReelHouseGlow() {
      reelHouseGlow.clear();

      const b = reelHouse.getBounds();
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || b.width <= 0 || b.height <= 0) return;

// =====================
// 🔧 MANUAL TUNING CONTROLS
// =====================
const isPortrait = isMobilePortraitUILayout(__layoutDeps);
const isLand     = isMobileLandscapeUILayout(__layoutDeps);
const isTabletL  = isTabletLandscape?.(__layoutDeps) ?? false;

const tabletPort = isTabletPortrait?.(__layoutDeps) ?? false;
const tabletLand = isTabletLandscape?.(__layoutDeps) ?? false;
const tabletAny  = (isTabletLike?.(__layoutDeps) ?? false);

// ---------------------------
// ✅ PER-VIEW WIDTH/HEIGHT ADJUST KNOBS (px)
// (positive = bigger, negative = smaller)
// ---------------------------

// MOBILE PORTRAIT
const GLOW_W_ADD_MOB_P = -17;
const GLOW_H_ADD_MOB_P = -90;

// MOBILE LANDSCAPE
const GLOW_W_ADD_MOB_L = 0;
const GLOW_H_ADD_MOB_L = -50;

// TABLET PORTRAIT
const GLOW_W_ADD_TAB_P = -50;  // 🔧 start point; tune
const GLOW_H_ADD_TAB_P = -160; // 🔧 start point; tune

// TABLET LANDSCAPE
const GLOW_W_ADD_TAB_L = -70;  // 🔧 start point; tune
const GLOW_H_ADD_TAB_L = -200; // 🔧 start point; tune

// DESKTOP (everything else)
const GLOW_W_ADD_DESK  = -27;
const GLOW_H_ADD_DESK  = -100;

// pick the correct pair
let W_ADD = GLOW_W_ADD_DESK;
let H_ADD = GLOW_H_ADD_DESK;

if (tabletPort) {
  W_ADD = GLOW_W_ADD_TAB_P;
  H_ADD = GLOW_H_ADD_TAB_P;
} else if (tabletLand) {
  W_ADD = GLOW_W_ADD_TAB_L;
  H_ADD = GLOW_H_ADD_TAB_L;
} else if (isPortrait) {
  W_ADD = GLOW_W_ADD_MOB_P;
  H_ADD = GLOW_H_ADD_MOB_P;
} else if (isLand) {
  W_ADD = GLOW_W_ADD_MOB_L;
  H_ADD = GLOW_H_ADD_MOB_L;
}

// Move glow if art is visually offset
const OFFSET_X = 0;
const OFFSET_Y = 4;

// Visual style
const CORNER_RADIUS = isPortrait ? 34 : 24;
const STROKE_WIDTH  = isPortrait ? 28 : 20;

// ---------------------------
// ✅ APPLY WIDTH/HEIGHT ADJUSTMENTS
// ---------------------------
const w = b.width  + W_ADD;
const h = b.height + H_ADD;

// keep it centered around reelHouse bounds
const x = b.x + (b.width  - w) * 0.5 + OFFSET_X;
const y = b.y + (b.height - h) * 0.5 + OFFSET_Y;

if (w <= 0 || h <= 0) return;

reelHouseGlow
  .roundRect(x, y, w, h, CORNER_RADIUS)
  .stroke({ width: STROKE_WIDTH, color: 0xffffff, alpha: 1 });


    }




    function pulseReelHouseGlowOnce() {
      redrawReelHouseGlow();

      reelHouseGlow.alpha = 0;

      // quick up, then fade out
      return new Promise<void>((resolve) => {
        tween(
          140,
          (k) => {
            // fade in quickly
            reelHouseGlow.alpha = Math.min(1, k) * 0.9;
          },
          () => {
            tween(
              220,
              (k2) => {
                // fade out
                reelHouseGlow.alpha = 0.9 * (1 - Math.min(1, k2));
              },
              () => {
                reelHouseGlow.alpha = 0;
                resolve();
              }
            );
          }
        );
      });
    }


    root.addChild(reelDimmer);
// ✅ WIN FRAMES MUST BE ABOVE reelDimmer (same parent as dimmer)
payFrameLayer.zIndex = 2060;          // reelDimmer is 2050, so this is above it
payFrameLayer.sortableChildren = true;
root.addChild(payFrameLayer);
root.sortChildren();
    // =====================
    // SCATTER PULSE TOP LAYER (UNMASKED)
    // =====================
    const scatterPulseLayer = new Container();
    scatterPulseLayer.zIndex = 2070; // above winSymbolTopLayer (2060)
    scatterPulseLayer.eventMode = "none";
    scatterPulseLayer.mask = null; // 🔴 IMPORTANT: no mask
    root.addChild(scatterPulseLayer);
    root.sortChildren();


    // =====================
    // WINNING SYMBOLS TOP LAYER (sits ABOVE the reelDimmer)
    // =====================
    const winSymbolTopLayer = new Container();
    winSymbolTopLayer.zIndex = 2060;        // higher than reelDimmer (2050), lower than win frames (9999)
    winSymbolTopLayer.sortableChildren = true;
    winSymbolTopLayer.mask = gridMask;      // keep clipped to the reel window
    root.addChild(winSymbolTopLayer);

    // Track lifted sprites so we can restore them
  type LiftedSprite = {
    s: Sprite;
    fromParent: Container;
    fromIndex: number;
    fromZ: number;

    // ✅ eyes follow sprite across layers
    eyesRoot: Container | null;
    eyesFromParent: Container | null;
    eyesFromIndex: number;
    eyesFromZ: number;
  };

  const liftedWinningSprites: LiftedSprite[] = [];


    function liftWinningSprites(indices: number[]) {
    // restore anything still lifted (safety)
    restoreWinningSprites();

    for (const i of indices) {
      const v = cellViews[i];
      const s = v?.sprite as Sprite | undefined;
      if (!s || !s.parent) continue;

      // If already lifted, skip
      if (s.parent === winSymbolTopLayer) continue;

      const fromParent = s.parent as Container;
      const fromIndex = fromParent.getChildIndex(s);
      const fromZ = s.zIndex ?? 0;

      // Preserve world position when reparenting
      const gp = s.getGlobalPosition();
      fromParent.removeChild(s);
      winSymbolTopLayer.addChild(s);
      s.position.copyFrom(winSymbolTopLayer.toLocal(gp));

      // Ensure it renders above the dimmer
      s.zIndex = 500;

      // ✅ ALSO lift eyesRoot to the same layer so coords match during tumble
      const eRoot = v?.eyes?.root as Container | undefined;
      let eyesRoot: Container | null = null;
      let eyesFromParent: Container | null = null;
      let eyesFromIndex = -1;
      let eyesFromZ = 0;

      if (eRoot && eRoot.parent) {
        eyesRoot = eRoot;
        eyesFromParent = eRoot.parent as Container;
        eyesFromIndex = eyesFromParent.getChildIndex(eRoot);
        eyesFromZ = eRoot.zIndex ?? 0;

        const egp = eRoot.getGlobalPosition();
        eyesFromParent.removeChild(eRoot);
        winSymbolTopLayer.addChild(eRoot);
        eRoot.position.copyFrom(winSymbolTopLayer.toLocal(egp));

        // keep above the symbol
        eRoot.zIndex = s.zIndex + 1;
      }

      liftedWinningSprites.push({
        s,
        fromParent,
        fromIndex,
        fromZ,
        eyesRoot,
        eyesFromParent,
        eyesFromIndex,
        eyesFromZ,
      });
    }
  }


  function restoreWinningSprites() {
    for (const rec of liftedWinningSprites) {
      const { s, fromParent, fromIndex, fromZ, eyesRoot, eyesFromParent, eyesFromIndex, eyesFromZ } = rec;

      // restore sprite
      if (s) {
        const gp = s.getGlobalPosition();
        if (s.parent) (s.parent as Container).removeChild(s);

        const safeIndex = Math.min(fromIndex, fromParent.children.length);
        fromParent.addChildAt(s, safeIndex);
        s.position.copyFrom(fromParent.toLocal(gp));
        s.zIndex = fromZ;
      }

      // ✅ restore eyes root
      if (eyesRoot && eyesFromParent) {
        const egp = eyesRoot.getGlobalPosition();
        if (eyesRoot.parent) (eyesRoot.parent as Container).removeChild(eyesRoot);

        const safeEyesIndex = Math.min(eyesFromIndex, eyesFromParent.children.length);
        eyesFromParent.addChildAt(eyesRoot, safeEyesIndex);
        eyesRoot.position.copyFrom(eyesFromParent.toLocal(egp));
        eyesRoot.zIndex = eyesFromZ;
      }
    }

    liftedWinningSprites.length = 0;
  }


    type LiftedScatter = {
      s: Sprite;
      fromParent: Container;
      fromIndex: number;
      fromZ: number;
    };

    const liftedScatterSprites: LiftedScatter[] = [];


    const REEL_DIM_ALPHA = 0.65;
    const REEL_DIM_FADE_MS = 160;
    const LAND_TO_BOUNCE_DELAY_MS = 90; // tweak: 0–200ms feels good




    // 🔧 sizing tweaks (px)
const isPortraitDim = isMobilePortraitUILayout(__layoutDeps);

const REEL_DIM_PAD_X = isPortraitDim ? -22 : (isMobileUILayout(__layoutDeps) ? -14 : -37);
const REEL_DIM_PAD_Y = isPortraitDim ? -78 : (isMobileUILayout(__layoutDeps) ? -60 : -102);


// =====================
// BOOSTED POPUP (Enchanted Wild)
// =====================
boostedText = new Text({
  text: applyUiTextCase(t("ui.popup.boosted")),
  style: {
    fontFamily: overlayBrandFontFamilyFor(getLang()),
    fill: 0xffd36a,
    fontSize: 88,
    letterSpacing: 2,
    align: "center",
    stroke: { color: 0x000000, width: 12 },
    dropShadow: true,
    dropShadowAlpha: 0.85,
    dropShadowBlur: 0,
    dropShadowDistance: 10,
    dropShadowAngle: -Math.PI / 4,
  } as any,
});
boostedText.anchor.set(0.5);
boostedText.zIndex = 22000;
boostedText.visible = false;
boostedText.alpha = 0;
root.addChild(boostedText);
root.sortChildren();


let boostedToken = 0;


async function showBoostedPopup(msIn = 160, holdMs = 420, msOut = 220) {
  boostedToken++;
  const token = boostedToken;

  // ✅ CENTER OF SCREEN (not board, not cluster)
  const W = app.screen.width;
  const H = app.screen.height;
  if (!boostedText) return;
  boostedText.x = Math.round(W * 0.5);
  boostedText.y = Math.round(H * 0.45);


  if (token === boostedToken) {
  audio?.playSfxThrottled?.("boosted", 120, 1, 1.0);
}
  

  boostedText.visible = true;
  boostedText.alpha = 0;
const base = isMobilePortraitUILayout(__layoutDeps) ? 0.54 : 0.85;
const peak = isMobilePortraitUILayout(__layoutDeps) ? 0.72 : 1.12;

boostedText.scale.set(base);

  await animateMs(msIn, (t) => {
    if (token !== boostedToken) return;
    const e = easeOutBack(t, 1.1);
    if (!boostedText) return;
    boostedText.alpha = t;
   const s = base + (peak - base) * e;
    boostedText.scale.set(s);
  });

  if (token !== boostedToken) return;

  await waitMs(holdMs);

  const y0 = boostedText.y;
  await animateMs(msOut, (t) => {
    if (token !== boostedToken) return;
    const e = easeOutCubic(t);
    if (!boostedText) return;
    boostedText.alpha = 1 - e;
    boostedText.y = y0 - 26 * e;
  });

  if (token !== boostedToken) return;

  boostedText.visible = false;
  boostedText.alpha = 0;
}

// =====================
// INFUSED POPUP (Infused Scatter / Infused event)
// =====================
infusedText = new Text({
  text: applyUiTextCase(t("ui.popup.infused")),
  style: {
    fontFamily: overlayBrandFontFamilyFor(getLang()),
    fill: 0xffd36a,
    fontSize: 88,
    letterSpacing: 2,
    align: "center",
    stroke: { color: 0x000000, width: 12 },
    dropShadow: true,
    dropShadowAlpha: 0.85,
    dropShadowBlur: 0,
    dropShadowDistance: 10,
    dropShadowAngle: -Math.PI / 4,
  } as any,
});
infusedText.anchor.set(0.5);
infusedText.zIndex = 22000;
infusedText.visible = false;
infusedText.alpha = 0;
root.addChild(infusedText);
root.sortChildren();


let infusedToken = 0;

async function showInfusedPopup(msIn = 160, holdMs = 420, msOut = 220) {
  infusedToken++;
  const token = infusedToken;

  // ✅ same placement as BOOSTED
  const W = app.screen.width;
  const H = app.screen.height;
  if (!infusedText) return;
  infusedText.x = Math.round(W * 0.5);
  infusedText.y = Math.round(H * 0.45);

  // 🔊 optional: play a dedicated sfx if you have it
  audio?.playSfxThrottled?.("infused", 120, 0.85, 1.0);
  // or reuse boosted sfx if you want it identical:
  // audio?.playSfxThrottled?.("boosted", 120, 0.85, 1.0);

  infusedText.visible = true;
  infusedText.alpha = 0;
const base = isMobilePortraitUILayout(__layoutDeps) ? 0.54 : 0.85;
const peak = isMobilePortraitUILayout(__layoutDeps) ? 0.72 : 1.12;

infusedText.scale.set(base);

  await animateMs(msIn, (t) => {
    if (token !== infusedToken) return;
    const e = easeOutBack(t, 1.1);
    if (!infusedText) return;
    infusedText.alpha = t;
    const s = base + (peak - base) * e;
    infusedText.scale.set(s);
  });

  if (token !== infusedToken) return;

  await waitMs(holdMs);

  const y0 = infusedText.y;
  await animateMs(msOut, (t) => {
    if (token !== infusedToken) return;
    const e = easeOutCubic(t);
    if (!infusedText) return;
    infusedText.alpha = 1 - e;
    infusedText.y = y0 - 26 * e;
  });

  if (token !== infusedToken) return;

  infusedText.visible = false;
  infusedText.alpha = 0;
}


// =====================
// AFTERSHOCK FX LAYER (floating wild hops)
// =====================
const aftershockFxLayer = new Container();
aftershockFxLayer.zIndex = 2080; // above scatterPulse(2070), above dimmer(2050), below huge overlays
aftershockFxLayer.eventMode = "none";
root.addChild(aftershockFxLayer);
root.sortChildren();


function redrawReelDimmer() {
// ✅ Allow reel dimmer on MOBILE PORTRAIT, but keep it off on MOBILE LANDSCAPE (optional)
if (isMobileLandscapeUILayout(__layoutDeps)) {
  reelDimmer.clear();
  reelDimmer.visible = false;
  reelDimmer.alpha = 0;
  return;
}

  reelDimmer.clear();

  // ✅ Prefer the reel WINDOW bounds
  let b = gridMask.getBounds();

  // ✅ Fallback: if mask bounds aren't ready yet, use reelHouse bounds
  if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || b.width <= 1 || b.height <= 1) {
    b = reelHouse.getBounds();
  }

// ✅ padding scales with reel size
const PAD_X = Math.round(cellSize * -0.31); // try 0.05 .. 0.12
const PAD_Y = Math.round(cellSize * -.8); // try 0.06 .. 0.16

  reelDimmer
    .rect(
      Math.round(b.x - PAD_X),
      Math.round(b.y - PAD_Y),
      Math.round(b.width + PAD_X * 2),
      Math.round(b.height + PAD_Y * 2)
    )
    .fill(0x000000);
}




function pickAftershockHopPath(finalIdx: number, hops = 5) {
  // pick unique hop cells (excluding final), then end at final
  const pool: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (i === finalIdx) continue;
    pool.push(i);
  }

  // shuffle-ish
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }

  const path = pool.slice(0, Math.max(2, Math.min(hops, pool.length)));
  path.push(finalIdx);
  return path;
}

async function jumpSpriteToCell(
  
  
  spr: Sprite,
  cellIdx: number,
  opts: { ms: number; arc: number; baseS: number }
) {
  const { cx, cy } = getCellCenterXY(cellIdx);

  const x0 = spr.x;
  const y0 = spr.y;
  const x1 = cx;
  const y1 = cy;

  const ms = opts.ms;
  const arc = opts.arc;
  const baseS = opts.baseS;


// 🔊 wild hop / bounce SFX
audio?.playSfxThrottled?.("bounce", 70, 1, 0.98 + Math.random() * 0.06);

  await animateMs(ms, (t) => {
    // movement
    const e = easeOutCubic(t);
    spr.x = x0 + (x1 - x0) * e;
    spr.y = y0 + (y1 - y0) * e;

    // arc (sin parabola)
    const k = Math.sin(Math.PI * e); // 0..1..0
    spr.y -= k * arc;




    // squash / stretch
    const sx = baseS * (1 + 0.16 * k);
    const sy = baseS * (1 - 0.12 * k);
    spr.scale.set(sx, sy);
  });

  // settle perfectly
  spr.x = Math.round(x1);
  spr.y = Math.round(y1);
  spr.scale.set(baseS, baseS);
}

async function playAftershockSequence(step: SpinStep) {
    // ✅ make sure the board is in "before" state right now
  applyGridToSprites(step.grid);

  const finalIdx = step.aftershockWildIndex ?? -1;
  if (finalIdx < 0) return;

  // Dim reels (your setReelDimmer is desktop-only; on mobile it no-ops)
  await setReelDimmer(true);

  // Floating wild sprite (not "in the grid" yet)
  const wild = new Sprite(SYMBOL_TEX["W1"]);
  wild.anchor.set(0.5);
  wild.eventMode = "none";
  wild.roundPixels = true;

  // fit like a normal wild but a touch bigger
  applySymbolScale(wild, "W1");
  const baseS = wild.scale.x * 1.18;
  wild.scale.set(baseS);

  // start at reel center
  const bm = boardMetrics();
  wild.x = Math.round(bm.cx);
  wild.y = Math.round(bm.cy);

  // mild glow vibe (optional, cheap)
  // wild.filters = [new BlurFilter({ strength: 2 })];
  //(wild as any).blendMode = "add";

  aftershockFxLayer.addChild(wild);

  // hop path
  const path = pickAftershockHopPath(finalIdx, 4 + ((Math.random() * 3) | 0)); // 4..6 hops then final

  // tiny dim-in pause (feels intentional)
  await waitMs(120);

  // hop around
  for (let i = 0; i < path.length; i++) {
    const isFinal = (i === path.length - 1);

    await jumpSpriteToCell(wild, path[i], {
      
      ms: isFinal ? 300 : 200,
      arc: isFinal ? 86 : 42,
      baseS,
    });

    // tiny “tick” hold between hops
    if (!isFinal) await waitMs(40);
  }




  // now actually apply the sim's "aftershock grid" (wild becomes real)
  applyGridToSprites(step.nextGrid);

  // remove floating sprite
  wild.removeFromParent();
  wild.destroy();

  // let the player see the settled wild for a beat
  await waitMs(120);

  await setReelDimmer(false);
}



    // Fade helper
  async function setReelDimmer(on: boolean) {
// ✅ Allow on mobile portrait, optionally disable only on mobile landscape
if (isMobileLandscapeUILayout(__layoutDeps)) {
  reelDimmer.clear();
  reelDimmer.visible = false;
  reelDimmer.alpha = 0;
  return;
}


  if (on) {
    redrawReelDimmer();
    reelDimmer.visible = true;
    const from = reelDimmer.alpha;

    await animateMs(durT(REEL_DIM_FADE_MS), (t) => {
      const e = easeOutCubic(t);
      reelDimmer.alpha = from + (REEL_DIM_ALPHA - from) * e;
    });
  } else {
    if (!reelDimmer.visible) return;
    const from = reelDimmer.alpha;

    await animateMs(durT(REEL_DIM_FADE_MS), (t) => {
      const e = easeOutCubic(t);
      reelDimmer.alpha = from * (1 - e);
    });

    reelDimmer.alpha = 0;
    reelDimmer.visible = false;
  }
}

refreshLocalizedText();
function winFramePadPx() {
  // keep a tiny “inside” pad that scales with cell size
  // (same rule in portrait + landscape)
  return Math.max(1, Math.round(cellSize * 0.03)); // 🔧 try 0.02..0.05
}

function winFrameScaleMul() {
  // ✅ Mobile LANDSCAPE ONLY: slightly larger frames
  if (isMobileLandscapeUILayout(__layoutDeps)) return 1; // 🔧 try 1.06..1.20
  return 1.0;
}

// =====================
// WIN FRAMES (per-cell overlay frame)
// =====================
type WinFrameView = { s: Sprite };

// ✅ declare the array (it was missing)
const winFrameViews: WinFrameView[] = [];

const WIN_FRAME_TEX = () => texExtra("win_frame.png");

function rescaleWinFramesToCell() {
  if (!winFrameViews.length) return;

  const pad = winFramePadPx();
  const inner = Math.max(1, cellSize - pad * 2);
  const mul = winFrameScaleMul();

  for (const v of winFrameViews) {
    const s = v.s;
    const tw = s.texture.width || 1;
    const th = s.texture.height || 1;

    const sc = Math.min(inner / tw, inner / th) * mul;
    s.scale.set(sc);
  }
}

function ensureWinFrameSprites() {
  if (winFrameViews.length) return;

  for (let i = 0; i < CELL_COUNT; i++) {
    const s = new Sprite(WIN_FRAME_TEX());
    s.anchor.set(0.5);
    s.visible = false;
    s.alpha = 0;

    // Keep frames above symbols (payFrameLayer is already above reelDimmer in your setup)
    s.zIndex = 9999;

    payFrameLayer.addChild(s);
    winFrameViews.push({ s });
  }

  // ✅ now that they exist, size them to current cellSize
  rescaleWinFramesToCell();
}

// Hide all frames
function clearWinFrames() {
  for (const v of winFrameViews) {
    v.s.visible = false;
    v.s.alpha = 1;
  }
}

// Fade frames out (instead of snapping off)
async function fadeOutWinFrames(ms = 80) {
  const toHide = winFrameViews.filter(v => v.s.visible && v.s.alpha > 0);

  if (!toHide.length) {
    clearWinFrames();
    return;
  }

  const starts = toHide.map(v => v.s.alpha);

  await animateMs(ms, (t) => {
    const e = easeOutCubic(t);
    for (let i = 0; i < toHide.length; i++) {
      toHide[i].s.alpha = starts[i] * (1 - e);
    }
  });

  for (const v of toHide) {
    v.s.alpha = 0;
    v.s.visible = false;
  }
}






    // =====================
    // WIN POPUP LAYER (must be on ROOT so it can sit above reelDimmer)
    // =====================
    const winPopupLayer = new Container();
    winPopupLayer.zIndex = 20000;     // ABOVE win frames (9999)
    winPopupLayer.sortableChildren = true;
    winPopupLayer.eventMode = "none";
 

    winPopupLayer.eventMode = "none";
    winPopupLayer.mask = null; // ✅ do NOT clip win popups

    // ✅ IMPORTANT: must be in the scene graph or popups won't render
root.addChild(winPopupLayer);
root.sortChildren();



    let activeWinPopups: Container[] = [];

function clearWinPopups() {
  for (const p of activeWinPopups) {
    if (!p || (p as any).destroyed) continue;

    p.removeFromParent();

    requestAnimationFrame(() => {
      if (!(p as any).destroyed) p.destroy({ children: true });
    });
  }
  activeWinPopups = [];
}

function isPopupAlive(p: any): boolean {
  return !!p && !(p as any).destroyed && !!(p as any).parent;
}


    function clusterBoundsInLayer(c: Cluster, layer: Container) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (const pos of c.positions) {
        const s = cellViews[pos]?.sprite;
        if (!s) continue;
        const b = s.getBounds(); // global
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }

      if (!isFinite(minX)) return null;

      const tl = layer.toLocal({ x: minX, y: minY });
      const br = layer.toLocal({ x: maxX, y: maxY });

      return {
        x: tl.x,
        y: tl.y,
        w: br.x - tl.x,
        h: br.y - tl.y,
      };
    }

    function makeWinPopup(baseValue: number, mult: number) {

      const c = new Container();

      const amountText = new Text({
      text: "0.00",
      style: {
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffffff,
        fontSize: 55,
        fontWeight: "1",
      stroke: { color: 0x000000, width: 6 },

        dropShadow: true,
        dropShadowAlpha: 0.35,
        dropShadowBlur: 6,
        dropShadowDistance: 2,
      } as any,
    });

    const xText = new Text({
      text: "x",
      style: {
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffffff,
        fontSize: 44,              // 👈 slightly smaller feels nicer
        fontWeight: "1",
    stroke: { color: 0x000000, width: 5 },

      } as any,
    });

    const multText = new Text({
      text: String(mult),
      style: {
        fontFamily: overlayBrandFontFamilyFor(getLang()),
        fill: 0xffffff,
        fontSize: 55,
        fontWeight: "1",
      stroke: { color: 0x000000, width: 6 },

        dropShadow: true,
        dropShadowAlpha: 0.35,
        dropShadowBlur: 6,
        dropShadowDistance: 2,
      } as any,
    });


      // anchors
    amountText.anchor.set(1, 0.5); // right-aligned
    xText.anchor.set(0.5);
    multText.anchor.set(0, 0.5);   // left-aligned

    // ✅ hide multiplier if it's x1
    const showMult = Math.abs(mult - 1) > 1e-6;

    xText.visible = showMult;
    multText.visible = showMult;

    // 🔧 spacing controls (TWEAK THESE)
    const GAP_AMOUNT_TO_X = 6;
    const GAP_X_TO_MULT   = 6;

    if (!showMult) {
      // just the amount, centered
      amountText.anchor.set(0.5, 0.5);
      amountText.x = 0;
    } else {
      // 3-part layout: [amount][x][mult]
      amountText.anchor.set(1, 0.5);
      xText.anchor.set(0.5, 0.5);
      multText.anchor.set(0, 0.5);

      xText.x = 0;
      amountText.x = -xText.width / 2 - GAP_AMOUNT_TO_X;
      multText.x =  xText.width / 2 + GAP_X_TO_MULT;
    }

    // keep vertical align
    amountText.y = 0;
    xText.y = 2;
    multText.y = 0;


    // vertical align
    amountText.y = 0;
    xText.y = 2;       // tiny optical tweak
    multText.y = 0;

    // skew + polish (match plaque feel)
    amountText.skew.set(0, 0.39);
    xText.skew.set(0, 0.39);
    multText.skew.set(0, 0.39);

    amountText.scale.x = 0.98;
    multText.scale.x = 0.98;



    c.addChild(amountText, xText, multText);


      // ✅ TICK UP FROM 0 → baseValue, while always showing xMULT
      const start = performance.now();

      const BASE_MS = 500;
      const duration = Math.min(
        1100,
        BASE_MS + baseValue * 18
      );

      // ✅ tickhigh only while the popup amount counts up
let startedTickHigh = false;

function tick(now: number) {
  const k = Math.min(1, (now - start) / duration);
  const e = k * k * (3 - 2 * k); // smoothstep
  const v = baseValue * e;

 amountText.text = fmtMoney(v);

  // Start tickhigh the first time we actually tick
  if (!startedTickHigh) {
    startedTickHigh = true;
    audio?.startTickHighLoop?.(40, 0.40, 1.0); // fadeMs, volMul, rate
  }

  // Optional: ramp pitch/vol with the count-up
  const rate = 1.0 + 0.55 * Math.pow(k, 1.25);
  const vol  = 0.30 + 0.35 * Math.pow(k, 1.10);
  audio?.setTickHighParams?.(vol, rate);

  if (k < 1) {
    requestAnimationFrame(tick);
  } else {
    // ✅ stop exactly when count finishes (NOT during hold/fade)
    audio?.stopTickHighLoop?.(60);
  }
}

requestAnimationFrame(tick);



      return c;
    }


function isAlive(d: any) {
  return !!d && !d.destroyed && d.parent !== null;
}

    async function showClusterWinPopups(
      clusters: Cluster[],
      multiplier: number,
      betAmount: number,
      holdMs = 520
    ) {
      clearWinPopups();
      if (!clusters || clusters.length === 0) return;
      


      // show one popup per cluster (like the reference)
      const tasks = clusters.map((c, idx) => {
        const b = clusterBoundsInLayer(c, winPopupLayer);
        if (!b) return Promise.resolve();

        // base money for this cluster (no multiplier shown yet)
    const baseWin = c.payoutX * betAmount;

    // popup displays: baseWin x multiplier  (e.g. 0.50x2)
    const p = makeWinPopup(baseWin, multiplier);



        // position: top-center of cluster bounds
        const px = b.x + b.w * 0.5;
        const py = b.y + 120; // slightly inside the top of the cluster

   p.position.set(px, py);

const POP_BASE = 1.5;
const m = winPopupScaleMul();

p.scale.set(POP_BASE * m);
p.alpha = 0;


        winPopupLayer.addChild(p);
        activeWinPopups.push(p);

        // tiny stagger so multiple clusters don’t pop on the same frame
        const delay = idx * 60;

        return new Promise<void>((resolve) => {
          setTimeout(() => {
            // pop in
            tween(
              140,
              (k) => {
                const e = Math.max(0, Math.min(1, k));
                p.alpha = e;
               const m = winPopupScaleMul();

const s = (1.1 + (1.5 - 1.1) * e) * m;
p.scale.set(s);

              },
              async () => {
                // hold
                await waitMs(holdMs);

                // drift up + fade out
const startY = p.y;

tween(
  220,
  (k) => {
    if (!isPopupAlive(p)) return;      // ✅ bail if it got cleared/destroyed
    const e = Math.max(0, Math.min(1, k));
    p.alpha = 1 - e;
    p.y = startY - 18 * e;
  },
  () => {
  // ✅ safest: just hide + detach; let clearWinPopups own destruction
  if (isAlive(p)) {
    p.visible = false;
    p.alpha = 0;
    p.removeFromParent();
  }
  resolve();
}
);

              },
              (t) => easeOutBack(t, 1.18)
            );
          }, delay);
        });
      });

      await Promise.all(tasks);
      

    }

    // 👇 tweak these (you asked to increase timing between staggers)
    const CLUSTER_STAGGER_MS = 50;     // delay between columns/tiles popping (increase this)
    const CLUSTER_POP_SCALE  = 1.14;    // pop size (e.g. 1.08–1.20)
    const CLUSTER_POP_IN_MS  = 90;      // pop up duration

    // frames follow the exact same stagger as the pop
    const WIN_FRAME_STAGGER_MS = CLUSTER_STAGGER_MS;
    const WIN_FRAME_FADE_MS = 80;

    // per-cell glow sprite cache
    const winGlowSprites: Array<Sprite | null> = Array(CELL_COUNT).fill(null);

    function getSortedWinPositions(clusters: Cluster[]) {
      const winSet = new Set<number>();
      for (const c of clusters) for (const i of c.positions) winSet.add(i);

      const wins = Array.from(winSet);
      // left->right, then top->bottom
      wins.sort((a, b) => {
        const ax = a % COLS, ay = Math.floor(a / COLS);
        const bx = b % COLS, by = Math.floor(b / COLS);
        if (ax !== bx) return ax - bx;
        return ay - by;
      });

      return wins;
    }

    function setWinGlow(i: number, on: boolean) {
      const v = cellViews[i];
      if (!v) return;

      if (!on) {
        const g = winGlowSprites[i];
        if (g) {
          g.visible = false;
          g.alpha = 0;
        }
        return;
      }

      let g = winGlowSprites[i];
      if (!g) {
        // clone of the symbol texture, blurred, behind the symbol
        g = new Sprite(v.sprite.texture);
        g.anchor.set(0.5);
        g.zIndex = 50; // behind symbol (symbol is 100)
        g.filters = [new BlurFilter({ strength: 15 })];
        g.alpha = 0;
        g.visible = false;
        gridLayer.addChild(g);
        winGlowSprites[i] = g;
      }

      // keep glow aligned to symbol
      g.texture = v.sprite.texture;
      g.x = v.sprite.x;
      g.y = v.sprite.y;
      g.scale.set(v.sprite.scale.x * 1.18, v.sprite.scale.y * 1.18);

      g.visible = true;
      g.alpha = 0.55;
    }

    async function popOne(i: number) {
      const v = cellViews[i];
      if (!v) return;

      const s = v.sprite;

      // keep glow ON during the whole win hold
      setWinGlow(i, true);

      const bx = s.scale.x;
      const by = s.scale.y;

      // pop up and STAY there (no settle-back)
      await animateScaleMs(
        s,
        durT(CLUSTER_POP_IN_MS),
        bx, by,
        bx * CLUSTER_POP_SCALE,
        by * CLUSTER_POP_SCALE
      );
    }

    async function playClusterPopAndGlow(clusters: Cluster[]) {
      const wins = getSortedWinPositions(clusters);

      // schedule pops with stagger (no “serial await” drift)
      const tasks = wins.map((i, k) =>
        waitT(WIN_FRAME_STAGGER_MS * k).then(() => popOne(i))
      );

      await Promise.all(tasks);

      // ✅ DO NOT turn glow off here — we keep it persistent until explode
    }

    // Symbols that should NOT get win frames
    const WIN_FRAME_SKIP = new Set<SymbolId>([
      "W1", // Wild
      "S1", // Scatter
    ]);
    async function showWinFramesForClusters(clusters: Cluster[], grid: Cell[]) {

      ensureWinFrameSprites();
      clearWinFrames();

      if (!clusters || clusters.length === 0) return;

      const wins = getSortedWinPositions(clusters);
    const winsFiltered = wins.filter((i) => !WIN_FRAME_SKIP.has(grid[i].id));

      const { x: ox, y: oy } = boardOrigin();

      // schedule frames with the SAME stagger as pops
      const tasks = winsFiltered.map((i, k) =>
        waitT(WIN_FRAME_STAGGER_MS * k).then(() => {
          const { x, y } = idxToXY(i, COLS);

          const px = ox + x * (cellSize + SYMBOL_GAP);
          const py = oy + y * (cellSize + SYMBOL_GAP);

          const v = winFrameViews[i];
          v.s.x = px + cellSize / 2;
          v.s.y = py + cellSize / 2;

          v.s.visible = true;
          v.s.alpha = 0;

          animateMs(durT(WIN_FRAME_FADE_MS), (t) => {
            v.s.alpha = Math.min(1, t);
          });
        })
      );

      await Promise.all(tasks);
    }




    function boardMetrics() {
      return {
        ox: boardOx,
        oy: boardOy,
        totalW: boardTotalW,
        totalH: boardTotalH,
        cx: boardOx + boardTotalW / 2,
        cy: boardOy + boardTotalH / 2,
      };
    }

   

  bgBase = new Sprite(Texture.from(BG_BASE_URL));
bgBase.anchor.set(0.5);
bgBase.alpha = 0.9;

bgFree = new Sprite(Texture.from(BG_FREE_URL));
bgFree.anchor.set(0.5);
bgFree.alpha = 0.9;

backgroundLayer.addChild(bgBase);
backgroundLayer.addChild(bgFree);



// =====================
// BACKGROUND LAYOUT API (moved to src/layout/layoutBackground.ts)
// =====================
const bgApi = makeLayoutBackground({
  app,
  state,
  __layoutDeps,
  backgroundLayer,
  getBgBase: () => bgBase,
  getBgFree: () => bgFree,
});



// expose these names to match your old calls
const {
  layoutBackgroundPivotToScreenCenter,
  resizeBackground,
  zoomBackgroundTo,
  setSplashBackgroundFraming,
  snapBackgroundToTop,
  lockBackgroundForSplash,
  getBgHomes, // ✅ ADD THIS
} = bgApi;


layoutBackgroundPivotToScreenCenter();

window.addEventListener("resize", () => {
  layoutBackgroundPivotToScreenCenter();
});
    // =====================
    // MOUSE Y PARALLAX (backgrounds)
    // =====================


    let mouseNY = 0;            // -1..+1
    let parallaxNY = 0;         // smoothed

    const BG_PARALLAX_BASE_PX = 10;
    const BG_PARALLAX_FREE_PX = 18;
    const BG_PARALLAX_SMOOTH = 0.12; // 0..1 (higher = snappier)

    // make sure stage receives pointer move events everywhere
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

   app.stage.on("pointermove", (e) => {
  if (isMobileUILayout(__layoutDeps)) return; // ✅ ignore on mobile
  const y = e.global.y;
  mouseNY = ((y / app.screen.height) - 0.5) * 2;
  mouseNY = Math.max(-1, Math.min(1, mouseNY));
});

addSystem(() => {
  if (state.overlay.startup) return;
  if (state.overlay.splash) return;

  const homes = getBgHomes();

  if (isMobileUILayout(__layoutDeps)) {
    parallaxNY = 0;
    if (!bgBase || !bgFree) return;
    bgBase.y = homes.baseHomeY;
    bgFree.y = homes.freeHomeY;
    return;
  }

  parallaxNY += (mouseNY - parallaxNY) * BG_PARALLAX_SMOOTH;
  if (!bgBase || !bgFree) return;
  bgBase.y = homes.baseHomeY + parallaxNY * BG_PARALLAX_BASE_PX;
  bgFree.y = homes.freeHomeY + parallaxNY * BG_PARALLAX_FREE_PX;
});





  addSystem((dt) => {
      if (isMobilePortraitUILayout(__layoutDeps)) return;

    if (titleDropActive) return;

    titleFloatT += dt;

    const t = titleFloatT;

    const oy = Math.sin(t * Math.PI * 2 * TITLE_FLOAT_SPD) * TITLE_FLOAT_AMP_Y;
    const ox = Math.cos(t * Math.PI * 2 * (TITLE_FLOAT_SPD * 0.9)) * TITLE_FLOAT_AMP_X;

    gameTitle.x = titleBaseX + ox * titleFloatBlend;
    gameTitle.y = titleBaseY + oy * titleFloatBlend;
    gameTitle.rotation =
      Math.sin(t * Math.PI * 2 * (TITLE_FLOAT_SPD * 0.7)) * TITLE_FLOAT_ROT * titleFloatBlend;
  });

// =====================
// LAYOUT ALL (moved out of main.ts)
// =====================
const { layoutAll } = makeLayoutAll({
  settingsBtnPixi,
    relayoutGridSprites: () => relayoutGridSpritesNow(),
  redrawReelDimmer: () => { if (reelDimmer.visible) redrawReelDimmer(); },
  app,
  state,
  __layoutDeps,

  rotateBlocker,
  root,
  backgroundLayer,
  gameCore,
  uiLayer,

  getDomRotateBlockerEl: () => document.getElementById("rotate-blocker-dom"),
  setRotateBlockerText: (s: string) => {
    const domText = document.getElementById("rotate-blocker-text");
    if (domText) domText.textContent = s || (typeof t === "function" ? t("ui.rotateBackPortrait") : "");
  },

  reelHouse,
  gridMask,
  REEL_WINDOW_INSET,
  INSET_L, INSET_T, INSET_R, INSET_B,

  COLS,
  ROWS,
  FRAME_GAP,
  SYMBOL_GAP,

  computeCellSize,
  getCellSize: () => cellSize,
  setCellSize: (v) => { cellSize = v; },

  MOBILE_LANDSCAPE_REELHOUSE_MUL,

  setBoardMetrics: ({ ox, oy, w, h }) => {
    boardOx = ox;
    boardOy = oy;
    boardTotalW = w;
    boardTotalH = h;
  },

  resizeBackground,
  layoutFsDimmer,
  layoutFsContinueX,
  layoutGameCorePivot,
  layoutFsOutro,
  layoutFsIntroAward,

  layoutUI,
  layoutFsCounter,
  layoutTumbleBanner,
  layoutMultiplierPlaque,
  layoutReelFlash,

  autoMenuLayout: () => autoMenuApi?.layout?.(),
  settingsLayout: () => settingsApi?.layout?.(),
  buyMenuLayout: () => buyMenuApi?.layoutBuy?.(),

  rescaleLiveCars: () => rescaleLiveCars?.(),
  rescaleWinFrames: () => rescaleWinFramesToCell(),
  
});


__layoutReady = true;
    layoutAll();
layoutStudioTag();
    titleDropActive = false;
applyGameTitleScaleFromBase();

    root.sortChildren();
    refreshLocalizedText();
    requestAnimationFrame(() => {
      void (async () => {
        try {
          updateLoadingProgress(1);

         

          snapBackgroundToTop();
          setSplashBackgroundFraming(1, 0);
await runFinalBootPipelineOnce();





        } catch (err) {
      
          // optional: show loader text so you can see it
          loadingPct.text = "BOOT ERROR";
        }
      })();
    });






   

  


    // =====================
    // SPLASH BACKGROUND FRAMING
    // =====================
    // 0 = top of PNG aligned to top of screen
    // 1 = bottom of PNG aligned to bottom of screen
    // 0.5 = centered (normal)
   


    resizeBackground();

    



    // =====================
    // START SMOKE AFTER STARTUP PAN FINISHES
    // =====================
    clearSmokeNow();       // ensure no early particles exist
    smokeFxEnabled = false; // ✅ keep OFF until game start
    smokeSpawnAcc = 0;



    const STARTUP_PAN_MS = 2000;      // tweak
    const STARTUP_REVEAL_DELAY = 10; // tweak

    const startupApi = makeStartupIntro({
  app,
  state,
  gameCore,

  getBgBase: () => bgBase,
  getBgFree: () => bgFree,
  getBgHomes: () => bgApi.getBgHomes(),

  resizeBackground,
  fadeUiLayerTo,
  showGameCoreDelayed,

  playMusicWhenUnlocked,

onStartupFinished: () => {
  state.overlay.boot = false;

  layoutStudioTag();
  layoutMultiplierPlaque();

  if (!carsDisabled(__layoutDeps)) {
    bgCarCooldown = 999;
    spawnBgCar(true);
  }

  __gameReady = true;

if (__pendingResumeRound) {


  // ✅ AUTO-RESUME: once the game is actually booted, programmatically click Resume
  requestAnimationFrame(() => {
    const tick = () => {
      if (!__gameReady) return requestAnimationFrame(tick);
      if (__resumeInProgress) return;

      const btn = document.getElementById("resume-btn") as HTMLButtonElement | null;
      if (btn && !btn.disabled) btn.click();
    };
    tick();
  });
}
},


  setSmokeEnabled: (on) => { smokeFxEnabled = on; },
  clearSmokeNow,
  resetSmokeAcc: () => { smokeSpawnAcc = 0; },

  STARTUP_PAN_MS,
  STARTUP_REVEAL_DELAY,
});

function playStartupIntro() {
  state.overlay.startup = true; // ✅ set immediately
  layoutStudioTag();           // ✅ enforce hide right now
  startupApi.playStartupIntro();
}










  function syncEyesToSprite(i: number) {
    const v = cellViews[i];
    if (!v) return;

    const s = v.sprite;
    const e = v.eyes;
    if (!e) return;

    // Glue to sprite transform (as if it were a child)
    e.root.position.set(s.x, s.y);
    e.root.rotation = s.rotation;
    e.root.alpha = s.alpha;
    e.root.visible = e.active; // you already toggle e.active in applyEyesForCell

    // Start with sprite scale
    let sx = s.scale.x;
    let sy = s.scale.y;

    // Then apply per-symbol eye “perspective” multipliers
  const sid = ((s as any).__sid ?? e.lastId ?? null) as any;
  const spec = (EYE_SPECS as any)[sid] as EyeSpec | undefined;

    if (spec) {
      sx *= (spec.scaleX ?? 1);
      sy *= (spec.scaleY ?? 1);
    
    } else {
      e.root.skew.set(0, 0);
    }

    e.root.scale.set(sx, sy);
  }




    function boardOrigin() {
      const gridPixelW = COLS * cellSize + (COLS - 1) * SYMBOL_GAP;
      const gridPixelH = ROWS * cellSize + (ROWS - 1) * SYMBOL_GAP;

      const ox = Math.round(boardOx + (boardTotalW - gridPixelW) / 2);
      const oy = Math.round(boardOy + (boardTotalH - gridPixelH) / 2);

      return { x: ox, y: oy };
    }

    function getCellCenterXY(i: number) {
      const { x, y } = idxToXY(i, COLS);
      const { x: ox, y: oy } = boardOrigin();
      return {
        cx: ox + x * (cellSize + SYMBOL_GAP) + cellSize / 2,
        cy: oy + y * (cellSize + SYMBOL_GAP) + cellSize / 2,
      };
    }
function relayoutGridSpritesNow() {
  // ✅ guard: grid not built yet (boot, loading, etc.)
  if (!cellViews || !Array.isArray(cellViews) || cellViews.length === 0) return;

  for (let i = 0; i < cellViews.length; i++) {
    const v = cellViews[i];
    const s = v?.sprite;
    if (!s) continue;

    const id = (s as any).__sid;
    if (!id) continue;

    applySymbolScale(s, id);

    const { cx, cy } = getCellCenterXY(i);
    s.x = cx;
    s.y = targetYForSymbol(id, cy);

    // eyes are optional during early boot
    try {
      applyEyesForCell(i, id);
      syncEyesToSprite(i);
    } catch {}
  }
}


    function targetYForSymbol(id: SymbolId, baseCY: number) {
      return baseCY + (id === "S1" ? SCATTER_LIFT_Y : 0);
    }




    type EyeOverlay = {
      root: Container;
      eyeG: Graphics[];   // dynamic list: 1 or 2
      nextBlink: number;
      blinkT: number;
      blinking: boolean;
      active: boolean;
      lastId: SymbolId | null;
    };

    type CellView = { sprite: Sprite; eyes: EyeOverlay };


// =====================
// BLINK RATE TUNING (per symbol)
// =====================
const BLINK_INTERVALS: Partial<Record<SymbolId, { min: number; max: number }>> = {
  // HIGH symbols blink faster
  H1: { min: 0.1, max: 0.6 },
  H2: { min: 0.30, max: 1.10 },
  H3: { min: 0.30, max: 1.10 },
  H4: { min: 0.30, max: 1.10 },
  H5: { min: 0.30, max: 1.10 },

  // (optional) keep others as default by omission
};

const BLINK_DEFAULT = { min: 0.9, max: 2.8 };

function scheduleNextBlink(e: EyeOverlay, id: SymbolId | null) {
  const r = (id && BLINK_INTERVALS[id]) ? BLINK_INTERVALS[id]! : BLINK_DEFAULT;
  e.nextBlink = r.min + Math.random() * (r.max - r.min);
}


   
  addSystem((dt) => {
    // dt already clamped by router, but this is fine if you want extra safety:
    dt = Math.min(0.05, dt);

    for (let i = 0; i < cellViews.length; i++) {
      const e = cellViews[i].eyes;
      if (!e || !e.active || !e.root.visible) continue;
      if (!e.eyeG.length) continue;

      e.nextBlink -= dt;

    if (!e.blinking && e.nextBlink <= 0) {
  e.blinking = true;
  e.blinkT = 0;

  // pick interval based on what symbol is currently in this cell
  const sid = ((cellViews[i].sprite as any).__sid ?? e.lastId ?? null) as SymbolId | null;
  scheduleNextBlink(e, sid);
}


      if (e.blinking) {
        const BLINK_DUR = 0.12;
        e.blinkT += dt;

        const t01 = Math.min(1, e.blinkT / BLINK_DUR);

        const open = t01 < 0.5
          ? (1 - (t01 / 0.5))
          : ((t01 - 0.5) / 0.5);

        const sy = Math.max(0, Math.min(1, open));
        for (const g of e.eyeG) g.scale.y = sy;

        if (t01 >= 1) {
          e.blinking = false;
          for (const g of e.eyeG) g.scale.y = 1;
        }
      }
    }
  });




    type EyePoint = { xN: number; yN: number }; // 0..1 in TEXTURE space
    type EyeSpec = {
      eyes: EyePoint[];
      wN: number;
      hN: number;
      color?: number;

      // ✅ perspective
      skewX?: number;     // radians
      skewY?: number;     // radians
      scaleX?: number;    // optional horizontal squash
      scaleY?: number;    // optional vertical squash
    };


    // ✅ One table for ALL symbols that need eyes
    const EYE_SPECS: Partial<Record<SymbolId, EyeSpec>> = {
      // H1: only ONE eye
      H1: {
          eyes: [{ xN: 0.2, yN: 0.1 }],
        wN: 0.10, hN: 0.13,
        skewX: 0.0,
        skewY: -0.35,    // ✅ matches your general 0.39-ish game skew
        scaleX: 0.48,
        scaleY: .5,
      },

      // examples for others (you will tune these)
      H2: {     
        eyes: [{ xN: 0.03, yN: 0.39 }, { xN: 0.2, yN: 0.39 }],
        wN: 0.10, hN: 0.14,
        skewY: 0.37,
        scaleX: 0.5,
        scaleY: .4,
    },
      H3: {     
        eyes: [{ xN: 0.01, yN: 0.7 }, { xN: 0.18, yN: 0.7 }],
        wN: 0.10, hN: 0.14,
        skewY: 0.42,
        scaleX: 0.5,
        scaleY: .4, },
      H4: {    
        eyes: [{ xN: 0, yN: 0.24 }, { xN: 0.2, yN: 0.25 }],
        wN: 0.10, hN: 0.14,
        skewY: 0.47,
        scaleX: 0.35,
        scaleY: 0.35, },
      H5: {     
      eyes: [{ xN: 0, yN: 0.38 }, { xN: 0.2, yN: 0.38 }],
        wN: 0.10, hN: 0.14,
        skewY: 0.47,
        scaleX: 0.35,
        scaleY: 0.35, }
    };


    function ensureGridSprites() {
    if (cellViews.length) return;

    for (let i = 0; i < CELL_COUNT; i++) {
      const sprite = new Sprite(SYMBOL_TEX["L1"]); // placeholder
      sprite.zIndex = 100;
      sprite.anchor.set(0.5);
      gridLayer.addChild(sprite);

      // ✅ eyes overlay is a SIBLING (Container), not a child of Sprite
      const eyesRoot = new Container();
      eyesRoot.eventMode = "none";
      eyesRoot.visible = false;
      eyesRoot.zIndex = 101; // just above symbol
      gridLayer.addChild(eyesRoot);

      const eyes: EyeOverlay = {
        root: eyesRoot,
        eyeG: [],
        nextBlink: 0.6 + Math.random() * 2.2,
        blinkT: 0,
        blinking: false,
        active: false,
        lastId: null,
      };

      cellViews.push({ sprite, eyes });
    }
  }

  // ✅ Keep eyes glued to their sprites EVERY FRAME (so they follow tumbling/spins)
  addSystem(() => {
    if (!cellViews.length) return;

    for (let i = 0; i < cellViews.length; i++) {
      const v = cellViews[i];
      const e = v.eyes;
      if (!e) continue;

      const s = v.sprite;

      // ✅ source of truth: the sprite’s current symbol id
      const sid = ((s as any).__sid ?? e.lastId) as SymbolId | undefined;
      const spec = sid ? EYE_SPECS[sid] : undefined;

      // show only if this symbol has eyes and sprite is visible
      e.active = !!spec;
      e.root.visible = !!spec && s.visible;

      // always follow sprite motion
      e.root.position.set(s.x, s.y);
      e.root.rotation = s.rotation;
      e.root.alpha = s.alpha;

      // apply perspective + scale every frame (stable)
      let sx = s.scale.x;
      let sy = s.scale.y;

      if (spec) {
        sx *= (spec.scaleX ?? 1);
        sy *= (spec.scaleY ?? 1);
        e.root.skew.set(spec.skewX ?? 0, spec.skewY ?? 0);
      } else {
        e.root.skew.set(0, 0);
      }

      e.root.scale.set(sx, sy);
    }
  });





  function drawEyeRect(g: Graphics, w: number, h: number, col: number) {
    g.clear();

    g
      .rect(-w / 2, -h / 2, w, h)
      .fill({ color: col, alpha: 1 });

    g.roundPixels = true;
  }


  function primeEyesForGrid(grid: Cell[]) {
    // ensure each cell's EyeOverlay is configured for the symbol ID *now*
    for (let i = 0; i < CELL_COUNT; i++) {
      applyEyesForCell(i, grid[i].id);
    }
  }
    function applyEyesForCell(i: number, id: SymbolId) {
      const v = cellViews[i];
      if (!v) return;

      const spec = EYE_SPECS[id];
      const e = v.eyes;

      // hide if this symbol has no eyes
    if (!spec) {
    e.root.visible = false;
    e.active = false;
    // ✅ don't overwrite lastId when there are no eyes
    return;
  }

    




      // ✅ Rebuild if symbol changed OR graphics are missing (fix: eyes vanish during tumble)
  const needsRebuild =
    e.lastId !== id ||
    !e.eyeG.length ||
    e.root.children.length === 0;

  if (needsRebuild) {
    e.root.removeChildren();
    e.eyeG.length = 0;

    const col = spec.color ?? 0x000000;

    // Use texture size (stable) — children inherit sprite scale
    const tw = v.sprite.texture.width || 1;
    const th = v.sprite.texture.height || 1;

    const eyeW = Math.max(1, Math.round(tw * spec.wN));
    const eyeH = Math.max(1, Math.round(th * spec.hN));

    for (const pt of spec.eyes) {
      const g = new Graphics();
      drawEyeRect(g, eyeW, eyeH, col);

      // sprite is anchor 0.5, so local origin is its center
      g.x = Math.round((pt.xN - 0.5) * tw);
      g.y = Math.round((pt.yN - 0.5) * th);

      e.root.addChild(g);
      e.eyeG.push(g);
    }

    // reset blink
    e.blinking = false;
    e.blinkT = 0;
    scheduleNextBlink(e, id);

    e.lastId = id;
  }

  e.root.visible = true;
  e.active = true;

  // ensure “open”
  for (const g of e.eyeG) g.scale.y = 1;


      e.root.visible = true;
      e.active = true;

      // ensure “open”
      for (const g of e.eyeG) g.scale.y = 1;
    }


    function drawGrid(grid: Cell[]) {
      ensureGridSprites();

      for (let i = 0; i < CELL_COUNT; i++) {
        const s = cellViews[i].sprite;
    const id = grid[i].id;
    (s as any).__sid = id;
    s.texture = SYMBOL_TEX[id];

    applySymbolScale(s, id);

    const { cx, cy } = getCellCenterXY(i);
    s.x = cx;
    s.y = targetYForSymbol(id, cy);

    s.alpha = 1;
    // ✅ keep eyesRoot glued to the sprite (same position/scale/rotation)
  const e = cellViews[i].eyes;
  e.root.position.set(s.x, s.y);
  e.root.rotation = s.rotation;


    applyEyesForCell(i, id);
    syncEyesToSprite(i);

      }
    }







    function setHighlight(i: number, on: boolean) {
      const v = cellViews[i];
      if (!v) return;
    }
const { wait, waitT, durT, turboFactor } = makeTurboTiming(() => !!state.ui.turbo);



      function animateScaleMs(
        sprite: Sprite,
        durationMs: number,
        fromX: number,
        fromY: number,
        toX: number,
        toY: number
      ) {
        return animateMs(durationMs, (t) => {
          const e = easeOutCubic(t);
          const sx = fromX + (toX - fromX) * e;
          const sy = fromY + (toY - fromY) * e;
          sprite.scale.set(sx, sy);
        });
      }
    async function crossfadeBackground(from: Sprite, to: Sprite, durationMs = 450, targetAlpha = 0.9) {
      // Ensure both are visible during transition
      from.visible = true;
      to.visible = true;

      


      // Force known starting alphas (important!)
      from.alpha = targetAlpha;
      to.alpha = 0;

      await animateMs(durationMs, (t) => {
        const e = easeOutCubic(t);
        from.alpha = targetAlpha * (1 - e);
        to.alpha = targetAlpha * e;
      });

      from.visible = false;
      from.alpha = 0;

      to.visible = true;
      to.alpha = targetAlpha;
    }

let __fsAutoKickToken = 0;
let __fsCoreReady = true;
let __fsCoreReadyToken = 0;

function markFsCoreNotReady() {
  __fsCoreReady = false;
  __fsCoreReadyToken++;
  return __fsCoreReadyToken;
}
function markFsCoreReady(token: number) {
  // only resolve latest transition
  if (token === __fsCoreReadyToken) __fsCoreReady = true;
}
function isFsCoreReady() {
  return __fsCoreReady;
}

function waitForFsCoreReady(): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (isFsCoreReady()) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
}
function allowFsSpinWhileSettingsOpen(): boolean {
  return state.game.mode === "FREE_SPINS" && state.fs.remaining > 0;
}

function waitForFsIntroToFinish(): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!state.overlay.fsIntro) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function kickFreeSpinsAuto(delayMs = 250) {
  __fsAutoKickToken++;
  const token = __fsAutoKickToken;

  setTimeout(() => {
    if (token !== __fsAutoKickToken) return;

    // only auto-chain during real FREE SPINS
    if (state.game.mode !== "FREE_SPINS") return;
    if (state.fs.remaining <= 0) return;
    // ✅ don’t auto-spin until FS reelhouse/VFX have fully transitioned in
if (!isFsCoreReady()) return;

    // do NOT spin during overlays/menus
   if (
  state.overlay.splash ||
  state.overlay.startup ||
  state.overlay.fsIntro ||
  state.overlay.fsOutro ||
  state.overlay.fsOutroPending ||
  state.overlay.bigWin ||
  state.ui.buyMenuOpen
) return;

    // don’t interrupt an in-flight spin
    if (state.ui.spinning) return;

    void doSpin();
  }, delayMs);
}



type ReplayResponse = {
  payoutMultiplier: number;
  costMultiplier: number;
  state: any; // game-specific
};

function getReplayParams() {
  
const qs = new URLSearchParams(location.search);

const isReplay =
  qs.get("replay") === "true" ||
  location.pathname.includes("/replay") ||
  (qs.has("event") && (qs.has("math") || qs.has("version")) && qs.has("mode"));

if (!isReplay) return null;


  // Stake launcher uses different names
  const rgs_url =
    qs.get("rgs_url") ||
    qs.get("rgsUrl") ||
    qs.get("rgs");

  const game =
    qs.get("game");

  const version =
    qs.get("version") ||
    qs.get("math");        // ✅ launcher uses math=<number>

  const mode =
    qs.get("mode");

  const event =
    qs.get("event") ||
    qs.get("eventId");     // ✅ launcher uses eventId=<number>

  // rgs_url is REQUIRED to actually call /bet/replay/...
  if (!game || !version || !mode || !event || !rgs_url) {
    console.warn("[REPLAY] missing params", { rgs_url, game, version, mode, event });
    return null;
  }

  return {
    rgs_url: rgs_url.replace(/\/+$/, ""),
    game,
    version,
    mode,
    event,
  };
}


async function fetchReplay(): Promise<ReplayResponse> {
  const p = getReplayParams();
  if (!p) throw new Error("Replay missing required query params");

  // ✅ FORCE absolute base url even if p.rgs_url is "rgs.stake-engine.com"
  const base =
    p.rgs_url.startsWith("http://") || p.rgs_url.startsWith("https://")
      ? p.rgs_url
      : `https://${p.rgs_url}`;

  const url = `${base.replace(/\/+$/, "")}/bet/replay/${p.game}/${p.version}/${p.mode}/${p.event}`;

  console.log("[REPLAY] fetch url:", url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Replay fetch failed: HTTP ${res.status}`);
  return (await res.json()) as ReplayResponse;
}



async function bootReplayIfNeeded() {
  const replayParams = getReplayParams();
  if (!replayParams) return;

  console.log("[REPLAY] detected params:", replayParams);

  const replay = await fetchReplay();
  console.log("[REPLAY] raw response keys:", Object.keys(replay as any));
  console.log(
    "[REPLAY] typeof state:",
    typeof (replay as any).state,
    "isArray:",
    Array.isArray((replay as any).state)
  );

 const rawState = (replay as any)?.state;

// ✅ Support both formats:
// A) state is already an array of steps
// B) state is an object with steps (or events) inside it
const replayStateArr =
  Array.isArray(rawState) ? rawState :
  Array.isArray((rawState as any)?.steps) ? (rawState as any).steps :
  Array.isArray((rawState as any)?.events) ? (rawState as any).events :
  null;

if (!Array.isArray(replayStateArr) || replayStateArr.length === 0) {
  console.warn("[REPLAY] rawState keys:", rawState ? Object.keys(rawState) : rawState);
  throw new Error("Replay state has no steps array (state / state.steps / state.events)");
}


  const initialGrid = replayStateArr[0]?.grid;
  if (!Array.isArray(initialGrid) || initialGrid.length === 0) {
    throw new Error("Replay step[0].grid invalid");
  }

  const m = (new URLSearchParams(location.search).get("mode") || "").toUpperCase();
  const visualMode: Mode =
    (m.includes("BONUS") || m.includes("FREE") || m.includes("FS")) ? "FREE_SPINS" : "BASE";

  pendingReplayRes = {
    mode: visualMode,
    initialGrid,
    steps: replayStateArr.map((st: any) => ({
      grid: st.grid,
      nextGrid: st.nextGrid,
      clusters: st.clusters ?? [],
      explodePositions: st.explodePositions ?? [],
      multiplier: st.multiplier ?? 1,
      stepWinX: st.stepWinX ?? 0,
      infusedScatters: st.infusedScatters ?? 0,
      enchantedClusters: st.enchantedClusters ?? 0,
      aftershockWildSpawned: !!st.aftershockWildSpawned,
      aftershockWildIndex: st.aftershockWildIndex ?? -1,
    })),
    totalWinX: Number((replay as any)?.payoutMultiplier ?? 0),
    ladderIndexAfter: state.fs.ladderIndex,
    fsRemainingAfter: state.fs.remaining,
    fsAwarded: 0,
  } as any;

  replayLoaded = true;

  // mark replay mode so playSpin doesn't auto-chain
  (state.ui as any).isReplay = true;

  // disable autoplay state
  state.ui.auto = false;
  state.ui.autoArmed = false;
  state.ui.autoPendingRounds = -1;
// ✅ Replay UI: disable all betting controls
try {
  (spinBtnPixi as any)?.resetVisual?.();      // keep SPIN usable as PLAY
  betUpBtnPixi?.setEnabled?.(false);
  betDownBtnPixi?.setEnabled?.(false);

  // disable BUY
  buyBtnPixi.eventMode = "none";
  buyBtnPixi.cursor = "default";
  buyBtnPixi.alpha = 1;

  // disable AUTO
  autoBtnPixi?.setEnabled?.(false);
} catch {}
// ✅ Replay: show PLAY skin on the spin button
state.ui.autoArmed = true;
refreshAutoSpinSpinButton();

console.log(
  "[REPLAY] ready. pendingReplayRes.steps =",
  pendingReplayRes?.steps?.length ?? 0
);

}


async function doSpin() {

  function computeTotalWinXFromSteps(res: SpinResult): number {
  // Prefer explicit total if provider gives it
  const direct = (res as any).totalWinX;
  if (Number.isFinite(direct)) return direct;

  // Otherwise sum step wins
  const steps = (res as any).steps as any[] | undefined;
  if (!steps || !Array.isArray(steps)) return 0;

  let sum = 0;
  for (const st of steps) {
    const v = st?.stepWinX;
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}


  if (state.overlay.boot) return;
  // ✅ REPLAY MODE: never place bets / never call RGS wallet endpoints
if (getReplayParams()) {
  console.log("[REPLAY] doSpin blocked (replay mode). Use the PLAY button.");
  return;
}
  // reset replay flag unless this spin explicitly sets it
(state.ui as any).isReplay = false;
  if (loadingLayer?.visible) return;
  if (state.overlay.splash) return;
  if (state.overlay.startup) return;
  if (state.overlay.fsIntro || state.overlay.fsOutro) return;

  if (isRgs && !rgsReady) {
    console.warn("[RGS] doSpin blocked — not authenticated yet");
    return;
  }
// ✅ NOW place the active-round guard here
  if (isRgs && rgsClient.getLastRoundActive()) {
    console.warn("[RGS] doSpin blocked — active round exists after refresh (resume/restart required)");
    return;
  }


  if (state.ui.buyMenuOpen || (state.ui.settingsOpen && !allowFsSpinWhileSettingsOpen())) return;
  if (state.ui.settingsOpen && !allowFsSpinWhileSettingsOpen()) return;
  if (state.ui.spinning) return;

const isBuyBonusSpin = !!state.ui.buyChoice;
const mode: Mode = isBuyBonusSpin
  ? "FREE_SPINS"
  : ((state.game.mode === "FREE_SPINS" || state.fs.remaining > 0) ? "FREE_SPINS" : "BASE");

  let rgsRoundStarted = false;

// ✅ RGS safety: do not start another spin while a round is still being processed/closed
if (isRgs && !isDemo && rgsRoundLock) {
  console.warn("[RGS] doSpin blocked — round lock active");
  return;
}


  state.ui.spinning = true;
  uiController.applyUiLocks();
  audio?.playSfx?.("spin_start", 1.0);


     uiController.applyUiLocks();

// ✅ During AUTO: keep STOP button visible (countdown stays on-screen)
// ✅ During manual: show the SPINNING overlay like before
if (state.ui.auto) {
  spinningBtnPixi.visible = false;
  spinBtnPixi.visible = true;        // keep it visible

  // ✅ IMPORTANT: keep STOP AUTO clickable (do NOT disable)
  // Force full alpha in case setEnabled(false) happened earlier
  (spinBtnPixi as any).eventMode = "static";
  spinBtnPixi.cursor = "pointer";
  spinBtnPixi.alpha = 1;
} else {
  spinBtnPixi.visible = false;
  spinningBtnPixi.visible = true;
  uiController.applyUiLocks();
}



      betDownBtnPixi.setEnabled(false);
      betUpBtnPixi.setEnabled(false);
      // ✅ disable BUY + AUTO during spinning
// ✅ disable BUY during spinning but keep it visually FULL (no dim)
buyBtnPixi.eventMode = "none";  // blocks clicks/taps
buyBtnPixi.alpha = 1.0;         // keep full opacity
buyBtnPixi.cursor = "default";
(buyBtnPixi as any)?.resetVisual?.(); // force UP state (optional)

// ✅ disable AUTO during spinning (keep dimmed as normal)
autoBtnPixi?.setEnabled?.(false);

const bet = state.bank.betLevels[state.bank.betIndex];

const betMicro = isRgs
  ? (rgsClient.getLastAuth()?.config?.betLevels?.[state.bank.betIndex] ?? dollarsToMicro(bet))
  : dollarsToMicro(bet);







const spinCost = (mode === "BASE") ? bet : 0;



// ✅ THEN call Stake play (only if we're really spinning)
// (removed) — play is handled in the unified provider section below



    if (spinCost > 0 && state.bank.balance < spinCost) {
      buyMenuApi.showInsufficientToast();


      // ✅ undo the spin-lock if you already set state.ui.spinning=true above
      state.ui.spinning = false;
     // ✅ When a spin ends:
// - Auto mode: keep STOP AUTO visible (between spins too)
// - Manual: restore normal SPIN button
spinningBtnPixi.visible = false;
spinBtnPixi.visible = true;

uiController.applyUiLocks();

// ✅ Ensure the correct auto/normal skin is applied immediately
refreshAutoSpinSpinButton();


      uiController.applyUiLocks();
      betDownBtnPixi.setEnabled(true);
      betUpBtnPixi.setEnabled(true);
      // ✅ restore BUY + AUTO when spin ends (but respect open menus)
const uiFree =
  !state.ui.settingsOpen &&
  !state.ui.buyMenuOpen &&
  !(autoMenuApi?.isOpen?.() ?? false);

buyBtnPixi?.setEnabled?.(uiFree);
autoBtnPixi?.setEnabled?.(uiFree);


      return;
    }


    // ✅ BASE: only reset when the NEXT spin starts (so it happens on click)
    let plaqueResetP: Promise<void> | null = null;

if (!isBuyBonusSpin && mode === "BASE" && plaqueIdx > 0) {
      plaqueResetP = (async () => {
        // wait for any last step-up animation to finish
        await waitForPlaqueIdle();

        // fast smooth return (uses your quick/no-pause version)
        await animatePlaqueReturnToBase();
      })();
    }

    
// ✅ BUY BONUS: trigger FS intro BEFORE board spins out
if (isBuyBonusSpin) {
  const fsToken = markFsCoreNotReady();

  const forcedFs = 10;
  const startMult =
    state.ui.buyChoice === "ULTRA" ? 5 :
    state.ui.buyChoice === "SUPER" ? 3 :
    1;

  // Immediately switch visuals to FREE_SPINS
  enterFreeSpins(forcedFs, startMult);

  // Wait for intro to finish BEFORE any board animation
  await waitForFsIntroToFinish();

  // Allow FS core to spin only AFTER intro
  markFsCoreReady(fsToken);
}

// Now animate board exit
await animateBoardExitDown();
if (plaqueResetP) await plaqueResetP;





      let openedFsIntro = false;           // if true, don't auto-chain spins
      let outcome: any = null; // we’ll type it properly after compile is green

const replayParams = getReplayParams();
const isReplay = !!replayParams;

// ✅ Replay overrides everything: no auth, no /wallet/play, no /end-round.
const useReplay = isReplay;

const useRgsPlay = isRgs && rgsReady && !useReplay;
    try {
      // mode is already decided above


        await setBackgroundForMode(mode, true);
      

    const simCfg = buildSimConfig({
    COLS,
    ROWS,
    fsTotalCap: state.fs.totalCap,
  });

const provider = getResultProvider();

  let res: SpinResult;
  let charged = 0;
  let buyChoice: any = null;




if (useRgsPlay && rgsRoundLock) {
  console.warn("[RGS] blocked: round lock still active");

  // ✅ CLEANUP (same as your finally)
  state.ui.spinning = false;
  spinningBtnPixi.visible = false;
  spinBtnPixi.visible = true;
  betDownBtnPixi.setEnabled(true);
  betUpBtnPixi.setEnabled(true);

  const uiFree =
    !state.ui.settingsOpen &&
    !state.ui.buyMenuOpen &&
    !(autoMenuApi?.isOpen?.() ?? false);

  buyBtnPixi?.setEnabled?.(uiFree);
  autoBtnPixi?.setEnabled?.(uiFree);

  uiController.applyUiLocks();
  return;
}
if (useReplay) {
  // lock UI etc already done above
  const replay = await fetchReplay();

  // 🔒 In replay: disable betting UI (no spin/autoplay/buy/bet)
  // Pick whatever you already use to “lock”:
  state.ui.auto = false;
  state.ui.autoArmed = false;
  state.ui.autoPendingRounds = -1;
    (state.ui as any).isReplay = true;

  // Now convert replay.state into the SAME SpinResult shape your playSpin expects.
  // You already have a converter for Stake round.state arrays — reuse it.

  const replayStateArr = (replay as any)?.state;

  if (!Array.isArray(replayStateArr) || replayStateArr.length === 0) {
    throw new Error("Replay state missing/invalid");
  }

  const initialGrid = replayStateArr[0]?.grid;
  if (!Array.isArray(initialGrid) || initialGrid.length === 0) {
    throw new Error("Replay step[0].grid invalid");
  }

const m = (new URLSearchParams(location.search).get("mode") || "").toUpperCase();
const visualMode: Mode =
  (m.includes("BONUS") || m.includes("FREE") || m.includes("FS")) ? "FREE_SPINS" : "BASE";


  res = {
    mode: visualMode,
    initialGrid,
    steps: replayStateArr.map((st: any) => ({
      grid: st.grid,
      nextGrid: st.nextGrid,
      clusters: st.clusters ?? [],
      explodePositions: st.explodePositions ?? [],
      multiplier: st.multiplier ?? 1,
      stepWinX: st.stepWinX ?? 0,

      infusedScatters: st.infusedScatters ?? 0,
      enchantedClusters: st.enchantedClusters ?? 0,
      aftershockWildSpawned: !!st.aftershockWildSpawned,
      aftershockWildIndex: st.aftershockWildIndex ?? -1,
    })),
    totalWinX: Number(replay?.payoutMultiplier ?? 0),

    // replay should not mutate your FS ladder; keep current
    ladderIndexAfter: state.fs.ladderIndex,
    fsRemainingAfter: state.fs.remaining,
    fsAwarded: 0,
  } as any;

  // No wallet settlement in replay
  rgsRoundStarted = false;
}
console.log("[RGS] useRgsPlay?", {
  useRgsPlay,
  isRgs,
  rgsReady,
  demo: rgsClient.getConfig()?.demo,
  replay: !!getReplayParams(),
});

if (useRgsPlay) {
  rgsRoundLock = true;

  try {
    // Capture buy choice BEFORE computing rgsMode (buyMenu sets state.ui.buyChoice)
    buyChoice = state.ui.buyChoice;

    const rgsMode =
      buyChoice === "SUPER" ? "bonus_super" :
      buyChoice === "ULTRA" ? "bonus_ultra" :
      "base";

    console.log("[BUY] buyChoice used for rgsMode:", buyChoice, "=>", rgsMode);

    const costMult =
      rgsMode === "bonus_super" ? 89 :
      rgsMode === "bonus_ultra" ? 100 :
      1;

    const debitMicro = betMicro * costMult;

    // ✅ Prevent play call if client-side balance is already insufficient
    if (state.bank.balance * 1_000_000 < debitMicro) {
      buyMenuApi?.showInsufficientToast?.();
      rgsRoundLock = false;
      state.ui.spinning = false;
      return;
    }

    console.log("[RGS] about to /wallet/play", { betMicro, rgsMode, modeVisual: mode });

    const playRes: any = await rgsClient.play(betMicro, rgsMode);
    state.ui.buyChoice = null;
    console.log("🔍 FULL playRes:", playRes);
console.log("🔍 playRes.round:", playRes?.round);
 
    // ✅ Always sync client balance from play response
    const playBal = (playRes as any)?.balance;
    const playAmt = (playBal && typeof playBal === "object") ? playBal.amount : null;

    if (typeof playAmt === "number" && Number.isFinite(playAmt)) {
      state.bank.balance = playAmt / 1_000_000;
      balanceLabel.text = fmtMoney(state.bank.balance);
      uiController.applyUiLocks();
    }

   







// ✅ Convert Stake round.state -> our SpinResult shape (defensive)
let round = (playRes as any)?.round ?? null;
let stateArr = round?.state;
const payoutMult = Number(round?.payoutMultiplier ?? 0);
const payout = Number(round?.payout ?? 0);




// ✅ Debug: prove what the server is sending for FS
console.log("[RGS] round.active:", round?.active);
console.log("[RGS] round.event:", round?.event ?? null);

if (Array.isArray(stateArr)) {
  console.log("[RGS] state steps:", stateArr.length);
  console.log("[RGS] step0 keys:", Object.keys(stateArr[0] ?? {}));

  // dump a quick “shape summary” for a few steps
  for (let i = 0; i < Math.min(3, stateArr.length); i++) {
    console.log(`[RGS] step${i} keys:`, Object.keys(stateArr[i] ?? {}));
  }
}

// ✅ Empty state can be a valid losing spin (when payout is zero).
// IMPORTANT: DO NOT try to animate grid when state is empty.
if (!Array.isArray(stateArr) || stateArr.length === 0) {
  if (payoutMult <= 0 && payout <= 0 && round?.active !== true) {
    console.log("[RGS] empty state + zero payout => losing spin");

    const nextGrid = makeNewDemoLosingGrid(lastSettledGrid ?? null, COLS, ROWS);

    await animateBoardReveal(nextGrid as any);
    applyGridToSprites(nextGrid as any);

    await setReelDimmer(false);

    rgsRoundStarted = false;
    rgsRoundLock = false;
    state.ui.spinning = false;

    return;
  }

  console.warn("[RGS] empty state but non-zero / unexpected payout => aborting", {
    active: round?.active,
    payoutMultiplier: round?.payoutMultiplier,
    payout: round?.payout,
    event: (round as any)?.event,
    mode: round?.mode,
  });

  stopAutoNow("RGS empty state");
  refreshAutoSpinSpinButton();
  buyMenuApi?.showToast?.("Stake returned an invalid round. Please refresh.");

  rgsRoundLock = false;
  state.ui.spinning = false;
  return;
}






// Step 0 grid is our initialGrid
const initialGrid = stateArr[0]?.grid;
console.log("[SCATTERS] initial:", countScatters(initialGrid), "payoutX:", Number(round?.payoutMultiplier ?? 0));


if (!Array.isArray(initialGrid) || initialGrid.length === 0) {
  console.warn("[RGS] round.state[0].grid invalid:", stateArr[0]);
  throw new Error("Invalid RGS step[0].grid");
}
console.log("[SCATTERS] step0:", countScatters(initialGrid), "payoutX:", Number(round?.payoutMultiplier ?? 0));


res = {
 mode: buyChoice ? "FREE_SPINS" : mode,
  initialGrid,

  steps: stateArr.map((st: any) => ({
      kind: st.kind,
  fsRemaining: st.fsRemaining,
  fsAfter: st.fsAfter,
  fsTotal: st.fsTotal,
    grid: st.grid,
    nextGrid: st.nextGrid,
    clusters: st.clusters ?? [],
    explodePositions: st.explodePositions ?? [],
    multiplier: st.multiplier ?? 1,
    stepWinX: st.stepWinX ?? 0,

    infusedScatters: st.infusedScatters ?? 0,
    enchantedClusters: st.enchantedClusters ?? 0,
    aftershockWildSpawned: !!st.aftershockWildSpawned,
    aftershockWildIndex: st.aftershockWildIndex ?? -1,
  })),

  // ✅ server truth for win
  totalWinX: Number(round?.payoutMultiplier ?? 0),

  // temporary defaults (we'll wire FS properly next)
  ladderIndexAfter: state.fs.ladderIndex,
  fsRemainingAfter: state.fs.remaining,
  fsAwarded: 0,
} as any;

rgsRoundStarted = (round?.active === true);


  } catch (e: any) {
    // unlock on any play error
    rgsRoundLock = false;

    const msg = String(e?.message ?? e).toLowerCase();

    if (msg.includes("active bet")) {
      stopAutoNow("RGS active bet");
      refreshAutoSpinSpinButton();
      buyMenuApi?.showToast?.("Stake says an active bet is still open. Please refresh the game session.");
      return;
    }
if (msg.includes("err_ipb") || msg.includes("insufficient balance")) {
  // ✅ show your existing "insufficient" UI and exit gracefully
  buyMenuApi?.showInsufficientToast?.();
  return;
}
   buyMenuApi?.showToast?.("RGS play failed. Check console for request payload.");
return;
  }

} else {
  // ✅ Local sim path (also used for RGS demo=true)
  const outcome = await provider({
    cfg: simCfg,
    mode,
    fsRemainingIn: state.fs.remaining,
    ladderIndexIn: state.fs.ladderIndex,
    seed: undefined,
    betAmount: bet,
  });

  res = outcome.result as SpinResult;
  charged = (mode === "BASE") ? ((outcome as any).betAmount ?? spinCost) : 0;
}

if (!useRgsPlay && !useReplay && charged > 0) {
  state.bank.balance = Math.max(0, state.bank.balance - charged);
  balanceLabel.text = fmtMoney(state.bank.balance);
  uiController.applyUiLocks();
}

// ✅ Only apply local-sim FS bookkeeping when NOT using RGS play
if (!useRgsPlay && !useReplay) { 
  state.fs.ladderIndex = res.ladderIndexAfter;

  const prevFs = state.fs.remaining;
  const nextFs = res.fsRemainingAfter;

  const expectedNoAward = Math.max(0, prevFs - 1);
  pendingFsAward = Math.max(0, nextFs - expectedNoAward);

  if (mode === "FREE_SPINS") {
    state.fs.remaining = expectedNoAward;
  } else {
    state.fs.remaining = nextFs;
  }

  refreshFsCounter();
}



        await playSpin(res);
// ✅ back to calm idle after the spin
audio?.setBaseMusicIntensity?.(0.15, 300);

// ✅ WIN: robust totals (stake provider may not fill res.totalWinX/outcome.winAmount)
const winX = computeTotalWinXFromSteps(res);
const winAmount = winX * bet;

// RGS endRound does not take win; server settles based on the play result.
// (Optional) store it back so other code sees it
(res as any).totalWinX = winX;


// ✅ Track FS session total for the FS outro
if (mode === "FREE_SPINS") {
  state.fs.sessionTotalWin += winAmount;
}

// ✅ WIN label should show THIS spin's win (not accumulated)
setWinAmount(winAmount);

// ✅ Big Win overlay:
// - Normal spins: show once using the total.
// - RGS FREE_SPINS packed rounds: Big Wins are shown per spin inside playSpin() using REVEAL boundaries.
const hasRevealBoundaries = (res.steps as any[]).some((s) => (s as any).kind === "REVEAL");
const skipTotalBigWin = (useRgsPlay && res.mode === "FREE_SPINS" && hasRevealBoundaries);

if (!skipTotalBigWin) {
  if (winX >= BIG_WIN_X && winAmount > 0) {
    await showBigWinAndWait(winAmount, winX);
  }
}

// ✅ Wallet: apply win ONLY when NOT running under RGS
if (!useRgsPlay && !useReplay && winAmount > 0) {
  state.bank.balance += winAmount;
  balanceLabel.text = fmtMoney(state.bank.balance);
}








if (!isLiveRgs) {
  if (mode === "BASE" && res.fsAwarded > 0) {
    enterFreeSpins(res.fsAwarded);
    openedFsIntro = true;
  }
} else {
  // ✅ LIVE RGS: ignore client-side FS triggers
  // Free spins must come from server state/event, not local awards.
}


      } finally {


  // ✅ Only close RGS round AFTER the entire feature is finished.
  // Do NOT end the round mid–FREE_SPINS sequence.
  if (
    useRgsPlay &&
    rgsRoundStarted &&
    (state.game.mode !== "FREE_SPINS" || state.fs.remaining === 0)
  ) {
    try {
      const endRes = await rgsClient.endRound();
      console.log("[RGS] endRound response:", endRes);

      // endRound() returns null when round wasn't active (client skipped) or already closed
      if (endRes) {
        const balObj =
          (endRes as any)?.balance ??
          (endRes as any)?.wallet?.balance ??
          (endRes as any)?.player?.balance ??
          (endRes as any)?.data?.balance ??
          null;

        const amt = (balObj && typeof balObj === "object") ? (balObj as any).amount : balObj;

        if (typeof amt === "number" && Number.isFinite(amt)) {
          state.bank.balance = amt / 1_000_000;
          balanceLabel.text = fmtMoney(state.bank.balance);
          uiController.applyUiLocks();
        } else {
          console.warn("[RGS] endRound: no numeric balance.amount found in response");
        }
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      if (msg.includes("player does not have active bet")) {
        console.warn("[RGS] endRound not needed (already closed):", msg);
      } else {
        console.warn("[RGS] endRound failed (fatal in RGS)", e);

        state.ui.auto = false;
        state.ui.autoArmed = false;
        state.ui.autoPendingRounds = -1;
        refreshAutoSpinSpinButton();
        buyMenuApi?.showToast?.("Connection issue. Please refresh.");
      }
    }
  }

  // ✅ Always release the lock when we're done with this spin attempt
  rgsRoundLock = false;
  rgsRoundStarted = false;

  state.ui.spinning = false;

  spinningBtnPixi.visible = false;
  spinBtnPixi.visible = true;

  uiController.applyUiLocks();
  (buyBtnPixi as any)?.resetVisual?.();

  // ✅ If we opened the FS intro, don't auto-spin yet
  if (openedFsIntro) return;

  // ... keep the rest of your existing "FS ended → outro" and auto-chaining logic below ...




    // ✅ FREE SPINS JUST ENDED → show TOTAL WIN outro
    if (state.game.mode === "FREE_SPINS" && state.fs.remaining === 0) {
      // ✅ we are still "in free spins" during the pre-outro pause
      state.overlay.fsOutroPending = true;
  // ✅ FS ended: duck music to 50% during the pause + outro count-up
  duckMusicForFsOutroPending(350);

      // keep FS presentation during the pause
      setReelHouseForMode("FREE_SPINS");   // ✅ keep FS reel house visible
      snowFxEnabled = true;                // ✅ keep snow running
      // (do NOT clear snow here)

      // keep FEATURE background visible immediately
      setBackgroundForMode("FREE_SPINS", false);
      if (!bgBase || !bgFree) return;
      bgBase.visible = false;
      bgBase.alpha = 0;
      bgFree.visible = true;
      bgFree.alpha = 0.9;
      currentBgMode = "FREE_SPINS";

      // stop cars/exhaust so outro is clean
      if (bgCarLive) { bgCarLive.s.removeFromParent(); bgCarLive = null; }
      if (fsCarLive) { fsCarLive.s.removeFromParent(); fsCarLive = null; }
      clearCarExhaustNow();

      // capture total now
      const outroTotalWin = state.fs.sessionTotalWin;
      state.fs.sessionTotalWin = 0;

      (async () => {
        await setReelDimmer(true);
        await waitMs(FS_PRE_OUTRO_PAUSE_MS);

        // ✅ now actually enter outro state
        state.overlay.fsOutroPending = false;

        // now it’s OK to treat mode as BASE "logically" if you want
        // (but visuals are controlled explicitly by the outro)
        state.game.mode = "BASE";

        // show outro
        showFsOutro(true, outroTotalWin, 520);
        killCarsNow(); // ✅ also freezes cooldowns
      })();

      return;
    }





    if (state.fs.remaining > 0) {
  kickFreeSpinsAuto(250);
} else if (state.ui.auto) {
  // ✅ don’t keep chaining if player is in any UI flow
  if (state.ui.settingsOpen || state.ui.buyMenuOpen || autoMenuApi?.isOpen?.()) {
    stopAutoNow("ui opened during auto");
    return;
  }

  if ((state.ui.autoRounds ?? -1) !== -1) {
    state.ui.autoLeft = Math.max(0, (state.ui.autoLeft ?? 0) - 1);
    refreshAutoSpinSpinButton();

    if (state.ui.autoLeft <= 0) {
      stopAutoNow("auto rounds finished");
      return;
    }
  }

  setTimeout(() => { void doSpin(); }, 250);
}



      }
    }


// =====================
// SCATTER AWARD SAFETY (CLIENT AUTHORITATIVE)
// =====================
const BASE_FS_AWARD = 10;      // base game: 3+ scatters => 10 FS
const FS_RETRIGGER_AWARD = 5;  // free spins: 3+ scatters => +5 FS (retrigger)

// Per-spin latch: allow only ONE award per spin outcome
let __scatterAwardedThisSpin = false;
let __activeSpinRes: any = null; // ✅ points at the SpinResult currently being played

  

  function countScatters(grid: Cell[]) {
    let n = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i].id === "S1") n++;
    }
    return n;
  }
async function ensureScatterAwardOnSettledGrid(grid: Cell[], res?: SpinResult) {
  const isRgsDemo = !!rgsClient.getConfig()?.demo;
  const isLiveRgs = !!rgsClient.getConfig()?.sessionID && !isRgsDemo;

// ✅ LIVE RGS is authoritative — don't mint free spins client-side.
if (isLiveRgs) {
  return;
}

  const spinRes: any = res ?? __activeSpinRes; // ✅ NEW

  const sc = countScatters(grid);
  if (sc < 3) return;

  if (__scatterAwardedThisSpin) return;
  __scatterAwardedThisSpin = true;

  if (state.game.mode === "FREE_SPINS") {
    const add =
      pendingFsAward > 0 ? pendingFsAward :
      (spinRes && (spinRes as any).fsAwarded > 0 ? (spinRes as any).fsAwarded : FS_RETRIGGER_AWARD);

    if (add > 0) {
      state.fs.remaining = Math.min(state.fs.totalCap, state.fs.remaining + add);
      state.fs.total = Math.min(state.fs.totalCap, state.fs.total + add);
      refreshFsCounter();
      await showFsAddedPopup(add);
      pendingFsAward = 0;
    }
    return;
  }

  if (state.game.mode === "BASE") {
    const award =
      (spinRes && (spinRes as any).fsAwarded > 0) ? (spinRes as any).fsAwarded : BASE_FS_AWARD;

    if (spinRes) (spinRes as any).fsAwarded = award;
    return;
  }
}




   async function animateExplodeAndTumble(
  prevGrid: Cell[],
  explodePositions: number[],
  nextGrid: Cell[],
  tumbleIndex: number // ✅ NEW (0,1,2...)
) {

        // ✅ we kept glow on during the hold — switch it off as explode begins
      for (const i of explodePositions) setWinGlow(i, false);


      // ✅ Compute cluster center in GLOBAL coords for outward bias
    let cX = 0, cY = 0, cN = 0;
    for (const i of explodePositions) {
      const s = cellViews[i]?.sprite;
      if (!s) continue;
      const p = s.getGlobalPosition();
      cX += p.x;
      cY += p.y;
      cN++;
    }
    if (cN > 0) {
      cX /= cN;
      cY /= cN;
    }

// =====================
// 🔊 EXPLODE SFX (one per tumble) + pitch ladder
// =====================
{
  const EXPLODE_BASE = 1.0;
  const EXPLODE_STEP = 0.07;  // 🔧 tweak 0.04..0.10
  const EXPLODE_MAX  = 1.45;  // 🔧 tweak 1.25..1.65

  const rate = Math.min(EXPLODE_MAX, EXPLODE_BASE + tumbleIndex * EXPLODE_STEP);

  // one clean hit per explosion wave (throttled in case something double-calls)
  audio?.playSfxThrottled?.("explode", 80, 1.2, rate);
  // or if you prefer not throttled:
  // audio?.playSfx?.("explode", 0.9, rate);
}


      // 1) explode (shrink + fade) - keep your current explode
      await Promise.all(
        explodePositions.map((i) => {
          const v = cellViews[i];
    if (!v) return Promise.resolve();

    // ✅ VOXEL BURST colours
    const symId = prevGrid[i]?.id;

    const col = SYMBOL_COLORS[symId] ?? 0xffffff;
    let col2: number | undefined;
    let mixChance = 0.7; // default

    if (symId === "L1") {
      col2 = 0x5fbf5a;
      mixChance = 0.9;     // slightly subtle, tweakable
    }

    if (symId === "L2") {
      col2 = 0x5fbf5a;
      mixChance = 0.9; // unchanged
    }

    if (symId === "L3") {
      col2 = L3_HIGHLIGHT;
      mixChance = 0.5; // ✅ 50 / 50
    }

    if (symId === "L4") {
      col2 = 0x5fbf5a;
      mixChance = 0.8;     // slightly subtle, tweakable
    }

    // ✅ position + outward bias
    const gp = v.sprite.getGlobalPosition();
    const rp = root.toLocal(gp);
    const lp = voxelExplodeLayer.toLocal(rp);

    const dir = { x: gp.x - cX, y: gp.y - cY };

    // ✅ spawn (only once)
    spawnVoxelBurstAt(lp.x, lp.y, col, dir, col2, mixChance);










          if (!v) return Promise.resolve();

          const fromA = v.sprite.alpha;
          const sx0 = v.sprite.scale.x;
          const sy0 = v.sprite.scale.y;

          return animateMs(durT(160), (t) => {
      const e = easeOutCubic(t);
      v.sprite.alpha = fromA * (1 - e);
      v.sprite.scale.set(
        sx0 * (1 - 0.7 * e),
        sy0 * (1 - 0.7 * e)
      );
    });

        })
      );

      // explode set for fast lookup
      const explodeSet = new Set<number>(explodePositions);

      // where every cell "lands"
      const targets = cellViews.map((v) => ({ x: v.sprite.x, y: v.sprite.y }));

      // how far above to spawn new symbols
      const stepY = cellSize + SYMBOL_GAP;

      // 2) Prepare each destination cell's sprite:
      //    - set its texture to nextGrid
      //    - set its START y based on where it comes from (survivor old y OR spawn above)
      for (let col = 0; col < COLS; col++) {
        // old survivors in this column, bottom->top
        const oldSurvivorIdx: number[] = [];
        for (let y = ROWS - 1; y >= 0; y--) {
          const i = xyToIdx(col, y, COLS);
          if (!explodeSet.has(i)) oldSurvivorIdx.push(i);
        }

        const newCount = ROWS - oldSurvivorIdx.length; // holes = explosions in this col

        // Fill destination from bottom->top
        // Bottom part = survivors (same order), Top part = new symbols
        for (let k = 0; k < ROWS; k++) {
          const destY = ROWS - 1 - k;      // bottom->top
          const destI = xyToIdx(col, destY, COLS);
          const s = cellViews[destI].sprite;

          // Always show destination symbol
          
  const id = nextGrid[destI].id;

  // ✅ set symbol id FIRST so the eye sync system sees the right symbol immediately
  (s as any).__sid = id;

  // ✅ swap texture + scale
  s.texture = SYMBOL_TEX[id];
  applySymbolScale(s, id);

  s.visible = true;
  s.alpha = 1;

  // x stays fixed
  s.x = targets[destI].x;

  // set starting y (survivor vs new) — keep your existing logic
  // (don’t call eyes yet; we’ll do it AFTER we set y)



  

          if (k < oldSurvivorIdx.length) {
    const srcI = oldSurvivorIdx[k];
    s.y = targets[srcI].y;

    applyEyesForCell(destI, id);
    syncEyesToSprite(destI);
  } else {
    const newRank = k - oldSurvivorIdx.length;
    const topTargetI = xyToIdx(col, 0, COLS);
    s.y = targets[topTargetI].y - stepY * (newCount - newRank);

    applyEyesForCell(destI, id);
    syncEyesToSprite(destI);
  }

        }
      }
  // ✅ IMPORTANT: prime eyes for the *destination grid* BEFORE any fall tweens start
  primeEyesForGrid(nextGrid);

        // 3) Animate to targets (scatter-aware anticipation: slow AFTER 2nd/3rd scatter lands)
      const basePerColDelayMs = durT(90);
      const basePerCellStaggerMs = durT(14);

      const slowPerColDelayMs = durT(190);   // how slow the remaining columns go
      const slowPerCellStaggerMs = durT(300); // little “tick tick” between symbols in same column
      const extraHoldMs = durT(520);         // the anticipation pause after the scatter column lands

      const prevSc = countScatters(prevGrid);
      const nextSc = countScatters(nextGrid);

      // Trigger ONLY when we just reached 2 scatters, or just reached 3 scatters
    const hitSecond = prevSc < 2 && nextSc >= 2;
    const hitThird  = prevSc < 3 && nextSc >= 3;
   const anticipation = hitSecond || hitThird;


    if (anticipation) {
      startAnticipationZoom(520, 1.04);
      audio?.setBaseMusicIntensity?.(0.85, 250);
      audio?.startTicktockLoop?.(120, 0.4, 1.0);


    }


      // Find which column the newest scatter “landed” in (furthest-right scatter col in the new grid)
      let slowFromCol: number | null = null;
      if (anticipation) {
        let maxScatterCol = -1;
        for (let i = 0; i < CELL_COUNT; i++) {
          if (nextGrid[i].id === "S1") {
            const col = i % COLS;
            if (col > maxScatterCol) maxScatterCol = col;
          }
        }
        slowFromCol = Math.min(COLS, maxScatterCol + 1); // start slowing AFTER that column
      }

      // the scatter column is the column that just landed (the last column that contains a scatter)
    const scatterLandedCol = slowFromCol !== null ? (slowFromCol - 1) : -1;
    let pulseStarted = false;

      const fallMs = durT(220);
      

      const colPromises = Array.from({ length: COLS }, (_, col) => {
        return new Promise<void>((resolve) => {
          // Keep timing normal up to the scatter column, then: hold + slow the remaining columns
          let delay = col * basePerColDelayMs;

          if (slowFromCol !== null && col >= slowFromCol) {
            delay =
              slowFromCol * basePerColDelayMs +
              extraHoldMs +
              (col - slowFromCol) * slowPerColDelayMs;
          }

          setTimeout(async () => {
            // bottom->top feels nicer for a “fall”
            const indices: number[] = [];
            for (let r = ROWS - 1; r >= 0; r--) indices.push(r * COLS + col);

            const perCellStaggerMs =
              slowFromCol !== null && col >= slowFromCol ? slowPerCellStaggerMs : basePerCellStaggerMs;

            await Promise.all(
              indices.map((i, n) => {
                return new Promise<void>((done) => {
                  setTimeout(() => {
                    const s = cellViews[i].sprite;
                    const startY = s.y;
                    const ty = targets[i].y;

                    void animateMs(fallMs, (t) => {
                      const e = easeOutBack(t, 0.7);
                      s.y = startY + (ty - startY) * e;
                    }).then(done);
                  }, n * perCellStaggerMs);
                });
              })
            );
    // Start pulsing exactly when the scatter column has finished landing
    if (anticipation && !pulseStarted && col === scatterLandedCol) {
      pulseStarted = true;
      startScatterPulseDuringAnticipation(nextGrid, extraHoldMs + 260);

    }

            resolve();
          }, delay);
        });
      });

      await Promise.all(colPromises);

    if (anticipation) endAnticipationZoom(260, 1);
    if (anticipation) audio?.stopTicktockLoop?.(140);
    audio?.setBaseMusicIntensity?.(0.25, 400);
    if (anticipation) stopScatterPulseDuringAnticipation();




      // snap-safe: ensure final textures + sizing are correct
      applyGridToSprites(nextGrid);
// ✅ SAFETY: after ANY tumble settles, if 3+ scatters are visible, force award
await ensureScatterAwardOnSettledGrid(nextGrid);


    }






    
      function applyGridToSprites(grid: Cell[]) {
        lastSettledGrid = grid.slice();
      for (let i = 0; i < CELL_COUNT; i++) {
        const id = grid[i].id;
        const s = cellViews[i].sprite;

        s.texture = SYMBOL_TEX[id];
        applyEyesForCell(i, id);
        syncEyesToSprite(i);
        s.visible = true;
        s.alpha = 1;

        applySymbolScale(s, id);

        const { cx, cy } = getCellCenterXY(i);
        s.x = cx;
        s.y = targetYForSymbol(id, cy);
        (s as any).__sid = id;
      }
    }




    async function animateBoardExitDown() {
      if (!cellViews.length) return;

      const drop = cellSize * (ROWS + 1);
      const perColDelayMs = durT(45);
      const fallMs = durT(320);

      const colPromises = Array.from({ length: COLS }, (_, col) => {
        const indices = Array.from({ length: CELL_COUNT }, (_, i) => i).filter((i) => (i % COLS) === col);

        return new Promise<void>((resolve) => {
          setTimeout(() => {
            Promise.all(
              indices.map((i) => {
                const s = cellViews[i].sprite;
                const fromY = s.y;
                const toY = fromY + drop;

                // keep x fixed, just drop + fade
                return animateMs(fallMs, (t) => {
                  const e = easeInCubic(t);
                  s.y = fromY + (toY - fromY) * e;
                  s.alpha = 1 - e;
                });
              })
            ).then(() => resolve());
          }, col * perColDelayMs);
        });
      });

      await Promise.all(colPromises);

      // now it's safe to clear (but keep persistent overlay layers alive)
    gridLayer.removeChildren();
    cellViews = [];



    }

    async function animateBoardReveal(grid: Cell[]) {
      drawGrid(grid);

      
      const drop = cellSize * (ROWS + 1);
      const targets = Array.from({ length: CELL_COUNT }, (_, i) => {
      const id = grid[i].id;
      const { cx, cy } = getCellCenterXY(i);
      return { x: cx, y: targetYForSymbol(id, cy) };
    });


      for (let i = 0; i < CELL_COUNT; i++) {
        const s = cellViews[i].sprite;
        s.x = targets[i].x;
        s.y = targets[i].y - drop;
        s.alpha = 0;
        applySymbolScale(s, grid[i].id);
      }

        // --- BASE timing (normal spin landing) ---
      const basePerColDelayMs = durT(60);
      const basePerCellStaggerMs = durT(0); // normally: drop the whole column together
      const fallMs = durT(420);
// ✅ BASE SPIN: schedule reel-land SFX to match each column landing (TDZ-safe)
const LAND_EARLY_MS = durT(200);          // 0..35 (bigger = earlier sound)
const BASE_COL_DELAY_MS = durT(60);      // MUST match your basePerColDelayMs in this function

for (let col = 0; col < COLS; col++) {
  const landAtMs = (col * BASE_COL_DELAY_MS) + fallMs - LAND_EARLY_MS;

  setTimeout(() => {
    audio?.playSfx?.("reel_land", 0.8);
  }, Math.max(0, landAtMs));
}




      // --- ANTICIPATION timing (after 2nd and 3rd scatter) ---
      const hold2Ms = durT(420);          // pause after 2nd scatter column lands
      const hold3Ms = durT(520);          // pause after 3rd scatter column lands
      const slowPerCol2Ms = durT(300);    // slower remaining columns after 2nd scatter
      const slowPerCol3Ms = durT(300);    // even slower after 3rd scatter
      const slowPerCell2Ms = durT(400);   // tick between symbols in a column after 2nd
      const slowPerCell3Ms = durT(500);   // stronger tick after 3rd

      // figure out in which column the 2nd and 3rd scatter "arrive"
      const scattersByCol = Array.from({ length: COLS }, (_, col) => {
        let c = 0;
        for (let r = 0; r < ROWS; r++) {
          if (grid[r * COLS + col].id === "S1") c++;
        }
        return c;
      });

      let hit2Col: number | null = null;
      let hit3Col: number | null = null;
      let running = 0;
      for (let col = 0; col < COLS; col++) {
        running += scattersByCol[col];
        if (hit2Col === null && running >= 2) hit2Col = col;
        if (hit3Col === null && running >= 3) hit3Col = col;
      }
      

      // helper: compute the scheduled start delay for each column (supports 2 holds)
      function delayForCol(col: number) {
        let d = col * basePerColDelayMs;

        if (hit2Col !== null && col >= hit2Col + 1) {
          d = (hit2Col + 1) * basePerColDelayMs + hold2Ms + (col - (hit2Col + 1)) * slowPerCol2Ms;
        }

        if (hit3Col !== null && col >= hit3Col + 1) {
          // how long it takes to get from (hit2Col+1) -> (hit3Col+1) under the "after-2nd" slowdown
          const after2Start = hit2Col !== null ? (hit2Col + 1) : 0;
          const segCols = Math.max(0, (hit3Col + 1) - after2Start);

          const timeToReach3 =
            (after2Start * basePerColDelayMs) +
            (hit2Col !== null ? hold2Ms : 0) +
            (segCols * (hit2Col !== null ? slowPerCol2Ms : basePerColDelayMs));

          d = timeToReach3 + hold3Ms + (col - (hit3Col + 1)) * slowPerCol3Ms;
        }

        return d;
      }
    // =====================
    // ANTICIPATION ZOOM (initial landing)
    // =====================
    const revealAnticipation =
      hit2Col !== null || hit3Col !== null;

    if (revealAnticipation) {
      // When does the "2nd scatter column" finish landing?
      const secondCol = hit2Col ?? 0;
      const secondLandAt = delayForCol(secondCol) + fallMs;

      // Start zoom right after the 2nd-scatter column lands
        // Start zoom right after the 2nd-scatter column lands,
      // and make the zoom-in duration last until the whole reveal finishes.
      const endZoomOutMs = 320; // keep in sync with endAnticipationZoom(320, 1)

      function perCellStaggerForCol(col: number) {
        let perCellStaggerMs = basePerCellStaggerMs;
        if (hit3Col !== null && col >= hit3Col + 1) perCellStaggerMs = slowPerCell3Ms;
        else if (hit2Col !== null && col >= hit2Col + 1) perCellStaggerMs = slowPerCell2Ms;
        return perCellStaggerMs;
      }

      const revealEndAt = Math.max(
        ...Array.from({ length: COLS }, (_, col) => {
          const perCell = perCellStaggerForCol(col);
          const lastCellExtra = (ROWS - 1) * perCell; // last symbol in that col starts later
          return delayForCol(col) + lastCellExtra + fallMs;
        })
      );

      const zoomInMs = Math.max(
      900, // <- minimum zoom-in duration (bigger = slower)
      ((revealEndAt - secondLandAt) - endZoomOutMs) * 1.6 // <- slow-down multiplier
    );

    // Start zoom right after the 2nd scatter column lands
   setTimeout(() => {
  startAnticipationZoom(zoomInMs, 1.05, 1.03);

  // ✅ start looping ticktock during anticipation
  audio?.startTicktockLoop?.(120, 0.55, 1.0);

  startScatterPulseDuringAnticipation(grid, 700);
}, Math.max(0, secondLandAt));

    // End zoom exactly when the whole reveal finishes (so it can’t “end” before it starts)
setTimeout(() => {
  endAnticipationZoom(320, 1);
  stopScatterPulseDuringAnticipation();

  // ✅ stop looping ticktock when anticipation ends
  audio?.stopTicktockLoop?.(140);
}, Math.max(0, revealEndAt));



    }

      const colPromises = Array.from({ length: COLS }, (_, col) => {
        return new Promise<void>((resolve) => {
          setTimeout(async () => {
            const indices: number[] = [];
            for (let r = 0; r < ROWS; r++) indices.push(r * COLS + col);

            // choose per-cell stagger based on where we are relative to the scatter trigger
            let perCellStaggerMs = basePerCellStaggerMs;
            if (hit3Col !== null && col >= hit3Col + 1) perCellStaggerMs = slowPerCell3Ms;
            else if (hit2Col !== null && col >= hit2Col + 1) perCellStaggerMs = slowPerCell2Ms;

            // animate each symbol with an optional "tick tick" stagger
            await Promise.all(
              indices.map((i, n) => {
                return new Promise<void>((done) => {
                  setTimeout(() => {
                    const s = cellViews[i].sprite;
                    const ty = targets[i].y;
                    const sy = ty - drop;

                    void animateMs(fallMs, (t) => {
                      const k = easeOutBack(t, 0.6);
                      s.y = sy + (ty - sy) * k;
                      s.alpha = Math.min(1, t * 1.2);
                    }).then(done);
                  }, n * perCellStaggerMs);
                });
              })
            );

            resolve();
          }, delayForCol(col));
        });
      });

      await Promise.all(colPromises);
      



      // ensure final intended grid is applied (and fitted)
      applyGridToSprites(grid);

    }




    // =====================
    // WIN BUMP: bounce down + back up (NO SCALE)
    // =====================
    async function winBumpReelHouse() {
      // capture “base” transforms at the moment we trigger it
      const base = {
        rhX: reelHouseLayer.x, rhY: reelHouseLayer.y, rhSX: reelHouseLayer.scale.x, rhSY: reelHouseLayer.scale.y,
        gX: gridLayer.x,      gY: gridLayer.y,      gSX: gridLayer.scale.x,      gSY: gridLayer.scale.y,
        pfX: payFrameLayer.x, pfY: payFrameLayer.y, pfSX: payFrameLayer.scale.x, pfSY: payFrameLayer.scale.y,
        mX: gridMask.x,       mY: gridMask.y,       mSX: gridMask.scale.x,       mSY: gridMask.scale.y,
      };

      const BOUNCE_DOWN_Y = 10; // px downward (tweak 6–14)
      const DOWN_MS = durT(90);
      const UP_MS   = durT(160);

      // Phase 1: push DOWN quickly
      await animateMs(DOWN_MS, (t) => {
        const e = easeOutCubic(t);
        const yOff = BOUNCE_DOWN_Y * e;

        // keep scale unchanged
        reelHouseLayer.scale.set(base.rhSX, base.rhSY);
        gridLayer.scale.set(base.gSX, base.gSY);
        payFrameLayer.scale.set(base.pfSX, base.pfSY);
        gridMask.scale.set(base.mSX, base.mSY);

        // move everything together
        reelHouseLayer.position.set(base.rhX, base.rhY + yOff);
        gridLayer.position.set(base.gX, base.gY + yOff);
        payFrameLayer.position.set(base.pfX, base.pfY + yOff);
        gridMask.position.set(base.mX, base.mY + yOff);
      });

      // Phase 2: spring back UP to base (slight overshoot)
      await animateMs(UP_MS, (t) => {
        const k = easeOutBack(t, 1.25); // tweak 1.10–1.35
        const yOff = BOUNCE_DOWN_Y + (0 - BOUNCE_DOWN_Y) * k;

        reelHouseLayer.scale.set(base.rhSX, base.rhSY);
        gridLayer.scale.set(base.gSX, base.gSY);
        payFrameLayer.scale.set(base.pfSX, base.pfSY);
        gridMask.scale.set(base.mSX, base.mSY);

        reelHouseLayer.position.set(base.rhX, base.rhY + yOff);
        gridLayer.position.set(base.gX, base.gY + yOff);
        payFrameLayer.position.set(base.pfX, base.pfY + yOff);
        gridMask.position.set(base.mX, base.mY + yOff);
      });

      // Hard reset (safety)
      reelHouseLayer.scale.set(base.rhSX, base.rhSY);
      reelHouseLayer.position.set(base.rhX, base.rhY);
      gridLayer.scale.set(base.gSX, base.gSY);
      gridLayer.position.set(base.gX, base.gY);
      payFrameLayer.scale.set(base.pfSX, base.pfSY);
      payFrameLayer.position.set(base.pfX, base.pfY);
      gridMask.scale.set(base.mSX, base.mSY);
      gridMask.position.set(base.mX, base.mY);
    }

function setBaseMusicIntensityFromTumble(tumbleIndex: number) {
  // 0 = calm, 1 = full
  const BASE = 0.15;         // idle base
  const PER_TUMBLE = 0.18;   // each tumble pushes intensity
  const MAX = 1.0;

  const i = Math.min(MAX, BASE + tumbleIndex * PER_TUMBLE);
  audio?.setBaseMusicIntensity?.(i, 180);
}
function playReelLandPerCol(cols: number[], opts?: { baseDelayMs?: number; staggerMs?: number; vol?: number }) {
  const baseDelayMs = opts?.baseDelayMs ?? 0;
  const staggerMs = opts?.staggerMs ?? 45;  // tweak 30..70
  const vol = opts?.vol ?? 0.55;

  // Optional: subtle pitch ladder across columns (left->right)
  const rate0 = 0.98;
  const rateStep = 0.015;

  for (let k = 0; k < cols.length; k++) {
    const rate = rate0 + k * rateStep;
    setTimeout(() => {
      audio?.playSfx?.("reel_land", vol, rate);
      // or if you prefer throttled (safer):
      // audio?.playSfxThrottled?.("reel_land", 30, vol, rate);
    }, baseDelayMs + k * staggerMs);
  }
}


function colsThatMovedFromExplosions(explodePositions: number[], COLS: number) {
  const set = new Set<number>();
  for (const i of explodePositions) set.add(i % COLS);
  return Array.from(set).sort((a, b) => a - b);
}


      async function playSpin(res: SpinResult) {
        // New spin outcome => allow scatter award again
__scatterAwardedThisSpin = false;
__activeSpinRes = res;
        hideTumbleWinBannerNow(); // reset from any previous spin
          // ✅ reset the WIN panel for this spin
  setWinAmount(0);


    if (res.mode !== "FREE_SPINS") {
  setBackgroundForMode(res.mode, false);
}

 
        hideTumbleWinBannerNow(); // reset banner for this spin
       
      let tumbleTotalSoFar = 0;

      // ✅ Per-FREE-SPIN Big Win support (RGS packs the whole feature into one /wallet/play)
      // We treat each segment between REVEAL markers as a single "spin" for Big Win purposes.
      const betAmount = state.bank.betLevels[state.bank.betIndex];
      const hasRevealBoundaries = (res.steps as any[]).some((s) => (s as any).kind === "REVEAL");
      let spinWinXThisSpin = 0; // accumulate stepWinX until the next REVEAL

      async function maybeShowBigWinForCompletedSpin() {
        if (!hasRevealBoundaries) return; // normal single-spin path
        if (spinWinXThisSpin <= 0) return;

        if (spinWinXThisSpin >= BIG_WIN_X) {
          const amount = spinWinXThisSpin * betAmount;
          await showBigWinAndWait(amount, spinWinXThisSpin);
        }

        spinWinXThisSpin = 0;
      }

      // ✅ If this round is FREE_SPINS, force the same "enter feature" presentation
// as your normal (non-RGS) free spins entry.
if (res.mode === "FREE_SPINS") {
  // Find the first REVEAL step (RGS multi-spin marker)
  const firstReveal = (res.steps as any[]).find((s) => (s as any).kind === "REVEAL") as any;

  const fsTot = Number(firstReveal?.fsTotal ?? state.fs.total ?? 0);
  const fsRem = Number(firstReveal?.fsRemaining ?? state.fs.remaining ?? fsTot);

  // Use the multiplier from the REVEAL marker as the feature start mult (fallback 1)
  const startMult = Number(firstReveal?.multiplier ?? 1) || 1;

  
  // ✅ IMPORTANT: don't start revealing/spinning until the FS intro overlay is done
if (state.overlay.fsIntro) {
  await waitForFsIntroToFinish();
}
// ✅ wait for reelhouse/VFX transition to finish too
await waitForFsCoreReady();
  // RGS is authoritative for counters — overwrite whatever enterFreeSpins set
  if (Number.isFinite(fsTot) && fsTot > 0) state.fs.total = fsTot;
  if (Number.isFinite(fsRem) && fsRem >= 0) state.fs.remaining = fsRem;

  refreshFsCounter();

  // Make sure FS background is actually forced on (some paths keep BASE bg)
  await setBackgroundForMode("FREE_SPINS", false, true);
}
      await animateBoardReveal(res.initialGrid);
      // ✅ SAFETY: if initial drop has 3+ scatters, force award
await ensureScatterAwardOnSettledGrid(res.initialGrid, res);


   

      await setReelDimmer(false);

    let pendingFsAfter: number | null = null;
    for (let si = 0; si < res.steps.length; si++) {
      
      
      const step = res.steps[si];
      // ✅ RGS multi-spin support: REVEAL steps mean “start of a new free spin”
const kind = (step as any).kind;
if (kind === "REVEAL") {
  // ✅ A new free spin is starting => the previous spin segment is complete.
// Skip for the very first REVEAL (si===0).
if (si > 0) {
  await maybeShowBigWinForCompletedSpin();
}
  // ✅ if the previous spin has just finished, apply its "after" counter now
if (pendingFsAfter != null) {
  state.fs.remaining = pendingFsAfter;
  refreshFsCounter();
  pendingFsAfter = null;
}
  // Update FS counter from RGS (fast-test books include these)
  const fsRem = Number((step as any).fsRemaining);
  const fsTot = Number((step as any).fsTotal);
  const fsAfter = Number((step as any).fsAfter);
if (Number.isFinite(fsAfter) && fsAfter >= 0) {
  pendingFsAfter = fsAfter;
}

  if (Number.isFinite(fsRem) && fsRem >= 0) {
    state.game.mode = "FREE_SPINS";
    state.fs.remaining = fsRem;
    if (Number.isFinite(fsTot) && fsTot > 0) state.fs.total = fsTot;
    refreshFsCounter();
  }

  // First REVEAL is the same as res.initialGrid (already revealed above)
  if (si === 0 && gridsEqual((step as any).grid as any, res.initialGrid as any)) {
    continue;
  }

  // Subsequent REVEAL steps = new spin reveal inside the same round
  hideTumbleWinBannerNow();
  clearWinPopups();
  setWinAmount(0);
  tumbleTotalSoFar = 0;

  await animateBoardExitDown();
  await animateBoardReveal((step as any).grid);
  await setReelDimmer(false);

  continue;
}
      console.log(
  "[SPIN STEP]",
  si,
  {
    aftershock: !!step.aftershockWildSpawned,
    clusters: step.clusters?.length ?? 0,
    stepWinX: step.stepWinX,
    gridEqNext: gridsEqual(step.grid as any, step.nextGrid as any),
    nextHasClusters: step.nextGrid ? "?" : "null",
  }
);
if ((step as any).kind !== "REVEAL" &&
    !step.aftershockWildSpawned &&
    (!step.clusters || step.clusters.length === 0)) {
  applyGridToSprites(step.grid);
  continue;   // ✅ do NOT break the tumble chain
}
      // ✅ Dynamic soundtrack intensity ramps per tumble
if (res.mode === "BASE") {
  setBaseMusicIntensityFromTumble(si);
}


// If this is Aftershock, HARD APPLY the BEFORE grid first
if (step.aftershockWildSpawned) {
  applyGridToSprites(step.grid);     // ✅ ensures no "final wild" is visible
  await playAftershockSequence(step);
  continue;
}
// ✅ if no wins, do nothing (extra safety)
if (!step.clusters || step.clusters.length === 0) {
  applyGridToSprites(step.grid);
  continue;
}

// normal step
drawGrid(step.grid);



        // highlight + frames for winning positions
      const hi = new Set<number>();
      step.clusters.forEach((c) => c.positions.forEach((p) => hi.add(p)));
      const hiArr = Array.from(hi);

      // ✅ slight pause AFTER reels land, BEFORE dimmer + glow + bump
    if (hiArr.length > 0) {
      await waitMs(LAND_TO_BOUNCE_DELAY_MS);
   if (step.clusters.length > 0) {
  // ✅ original mp3 pitch at tumble 0, then climbs each tumble
  const PITCH_BASE = 1.0;      // original pitch
  const PITCH_STEP = 0.15;     // subtle (try 0.03..0.06)
  const PITCH_MAX  = 3;     // cap (try 1.25..1.45)

  const tumbleIndex = si; // 0,1,2... (si is your step index)
  const rate = Math.min(PITCH_MAX, PITCH_BASE + tumbleIndex * PITCH_STEP);

  audio?.playSfxThrottled?.("cluster_pop", 80, 0.9, rate);
}

    }

  const dimmerInP = setReelDimmer(true);
    const glowP = pulseReelHouseGlowOnce();  // glow starts same moment as dimmer
    liftWinningSprites(hiArr);

    const bumpP = winBumpReelHouse();


 

    hi.forEach((p) => setHighlight(p, true));

    const CLUSTER_HOLD_MS = 500;
    // ✅ Accumulate TOTAL WIN so far across tumbles, update sticky banner
    const stepWinAmount = step.stepWinX * state.bank.betLevels[state.bank.betIndex];
tumbleTotalSoFar += stepWinAmount;
// ✅ Per-spin Big Win accumulation (RGS FREE_SPINS packed into one /wallet/play)
if (hasRevealBoundaries) {
  spinWinXThisSpin += (Number(step.stepWinX) || 0);
}

// ✅ bottom WIN panel: tween up to the new total
await animateWinAmountTo(tumbleTotalSoFar, durT(state.ui.turbo ? 80 : 140));



// banner stays as-is
if (stepWinAmount > 0.000001) {
  void showOrUpdateTumbleWinBanner(tumbleTotalSoFar);
}




// ✅ show BOOSTED first (tiny lead-in), then popups
if ((step.enchantedClusters ?? 0) > 0) {
  void showBoostedPopup();     // or await showBoostedPopup(160, 260, 180) if you want it to block
  await waitMs(120);           // small delay so the word lands first
}

// ✅ then INFUSED
if (((step as any).infusedScatters ?? 0) > 0) {
  void showInfusedPopup();
  await waitMs(120);
}

await Promise.all([
  showWinFramesForClusters(step.clusters, step.grid),
  playClusterPopAndGlow(step.clusters),
  showClusterWinPopups(step.clusters, step.multiplier, state.bank.betLevels[state.bank.betIndex], 520),
]);





    pulseWinFrames(true);
    await waitT(CLUSTER_HOLD_MS);
    pulseWinFrames(false);

    // ✅ frames fade out while the voxel explode begins (same moment)
    const framesOutP = fadeOutWinFrames(durT(80));

    // ✅ turn OFF the black tint as the explosion starts
 const dimmerOutP = setReelDimmer(false);

  // ✅ If sim forgot to populate explodePositions, derive it from clusters
  const explodePositions =
    (step.explodePositions && step.explodePositions.length > 0)
      ? step.explodePositions
      : Array.from(
          new Set(step.clusters.flatMap((c) => c.positions))
        );
        // ✅ tumble landing: only columns that actually changed
const movedCols = colsThatMovedFromExplosions(explodePositions, COLS);

// We play land SFX when the tumble fall finishes.
// Your fall duration in animateExplodeAndTumble is: fallMs = durT(220)
// Add a small cushion so it happens right at settle.
if (movedCols.length > 0) {
  playReelLandPerCol(movedCols, {
    baseDelayMs: durT(220) + 90,
    staggerMs: 70,
    vol: 0.5,
  });
}


const nextStep = res.steps[si + 1];

// ✅ If the NEXT step is Aftershock, end this tumble on the "before-aftershock" grid
// (prevents the wild from snapping into its final cell for 1 frame)
const tumbleNextGrid =
  (nextStep && nextStep.aftershockWildSpawned)
    ? nextStep.grid
    : step.nextGrid;

const explodeP = animateExplodeAndTumble(step.grid, explodePositions, tumbleNextGrid, si);

await Promise.all([framesOutP, dimmerOutP, explodeP]);



    // ✅ Restore symbols back to normal layer (dimmer already gone)
    restoreWinningSprites();


 // ✅ Step UP the multiplier plaque after ANY cluster win
if (step.clusters && step.clusters.length > 0) {
  // Use the plaque's current index as the source of truth.
  // This avoids "stuck at 2x" if step.multiplier is always 1 in BASE.
  const nextIdx = Math.min(plaqueIdx + 1, LADDER.length - 1);
  const nextMult = LADDER[nextIdx] ?? 1;

  updateMultiplierPlaque(nextMult);
  setMult(nextMult);
}




    clearWinPopups();


      



    }

    

    // ✅ Last tumble is done — now hide the sticky banner
    await hideTumbleWinBannerAfterLast(200);
    // ✅ apply final FS counter update after last spin
if (pendingFsAfter != null) {
  state.fs.remaining = pendingFsAfter;
  refreshFsCounter();
  pendingFsAfter = null;
}

// ✅ End of round: finalize the last free-spin segment for per-spin Big Win
await maybeShowBigWinForCompletedSpin();
__activeSpinRes = null;

    }




    function pulseWinFrames(active: boolean) {
      for (const v of winFrameViews) {
        if (!v.s.visible) continue;
        v.s.alpha = active ? 0.85 : 1;
      }
    }




    let currentBgMode: Mode | "INIT" = "INIT";

    // initial
    setBackgroundForMode("BASE", false);


    async function setBackgroundForMode(mode: Mode, animated = true, force = false) {
      // ✅ Only skip if we're not forcing
      if (!force && mode === currentBgMode) return;

      if (!animated) {
        // ✅ HARD SET (always fixes black background states)
        backgroundLayer.visible = true;
        backgroundLayer.alpha = 1;
if (!bgBase || !bgFree) return;
        bgBase.visible = mode === "BASE";
        bgFree.visible = mode === "FREE_SPINS";

        bgBase.alpha = 0.9;
        bgFree.alpha = 0.9;

        currentBgMode = mode;
        return;
      }

      // animated crossfade
      if (mode === "FREE_SPINS") {
        if (!bgBase || !bgFree) return;
        await crossfadeBackground(bgBase, bgFree, 450, 0.9);
      } else {
        if (!bgBase || !bgFree) return;
        await crossfadeBackground(bgFree, bgBase, 450, 0.9);
      }

      // ✅ guarantee final state (prevents rare “both invisible”)
      backgroundLayer.visible = true;
      backgroundLayer.alpha = 1;

      bgBase.visible = mode === "BASE";
      bgFree.visible = mode === "FREE_SPINS";

      currentBgMode = mode;
    }

function makeDeadGrid(): Cell[] {
  // Guaranteed losing-looking board:
  // - No 3+ clusters (checkerboard)
  // - No scatters (S1)
  // - No wilds (W1) or other specials
  const a = "L1";
  const b = "L2";

  const out: Cell[] = new Array(CELL_COUNT);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;

      // checkerboard prevents adjacency clusters
      out[i] = { id: ((r + c) % 2 === 0) ? a : b } as any;
    }
  }

  return out;
}

function bootInitialBoard() {
  const bootGrid = makeGrid(COLS, ROWS, WEIGHTS_BASE);

  // draw immediately so you never start empty
  drawGrid(bootGrid);
  applyGridToSprites(bootGrid);

  // ✅ remember this as the fallback for “empty state”
  lastSettledGrid = bootGrid.slice();
}



}

function gridsEqual(a: any[] | null | undefined, b: any[] | null | undefined) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id) return false;
  }
  return true;
}

// 4-neighbour cluster check (up/down/left/right)
function hasAnyCluster3Plus(grid: any[], cols: number, rows: number) {
  const N = cols * rows;
  const seen = new Uint8Array(N);

  const idx = (c: number, r: number) => r * cols + c;

  for (let i = 0; i < N; i++) {
    if (seen[i]) continue;

    const id = grid[i]?.id;
    if (!id) { seen[i] = 1; continue; }

    // BFS flood fill
    let count = 0;
    const q: number[] = [i];
    seen[i] = 1;

    while (q.length) {
      const cur = q.pop()!;
      count++;

      // Early exit: any cluster >= 3 means "winning-like"
      if (count >= 3) return true;

      const r = Math.floor(cur / cols);
      const c = cur - r * cols;

      // neighbors
      if (c > 0) {
        const j = cur - 1;
        if (!seen[j] && grid[j]?.id === id) { seen[j] = 1; q.push(j); }
      }
      if (c < cols - 1) {
        const j = cur + 1;
        if (!seen[j] && grid[j]?.id === id) { seen[j] = 1; q.push(j); }
      }
      if (r > 0) {
        const j = cur - cols;
        if (!seen[j] && grid[j]?.id === id) { seen[j] = 1; q.push(j); }
      }
      if (r < rows - 1) {
        const j = cur + cols;
        if (!seen[j] && grid[j]?.id === id) { seen[j] = 1; q.push(j); }
      }
    }
  }

  return false;
}

function makeRandomLosingGrid(cols: number, rows: number) {
  // ✅ choose symbols that exist in your atlas and are “normal”
  // Expand this list if you want more variety.
  const pool = ["L1", "L2", "L3", "L4", "H1", "H2", "H3", "H4", "H5"];

  const out: any[] = new Array(cols * rows);
  for (let i = 0; i < out.length; i++) {
    const id = pool[(Math.random() * pool.length) | 0];
    out[i] = { id };
  }
  return out;
}

function makeNewDemoLosingGrid(prev: any[] | null | undefined, cols: number, rows: number) {
  // Try a bunch of times to get a random grid with NO 3+ clusters
  for (let k = 0; k < 250; k++) {
    const g = makeRandomLosingGrid(cols, rows);

    // must be different from last grid
    if (prev && gridsEqual(g, prev)) continue;

    // must be a true “losing” layout (no 3+ connected)
    if (hasAnyCluster3Plus(g, cols, rows)) continue;

    return g;
  }

  // Fallback (very unlikely): force a quick “safe” pattern
  // (still not scatter/wild)
  const fallback = makeRandomLosingGrid(cols, rows);
  return fallback;
}






main().catch((err) => {
  console.error("[BOOT ERROR]", err);
}); 