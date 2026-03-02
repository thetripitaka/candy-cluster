// src/layout/layoutAll.ts
import { makeLayoutTinyView, isTinyViewSize } from "./layoutTinyView";
import type { Application, Graphics, Sprite, Container } from "pixi.js";
import {
  isMobileUILayout,
  isMobilePortraitUILayout,
  isMobileLandscapeUILayout,
  isTabletLike,
  isTabletPortrait,
  isTabletLandscape,
} from "../ui/layoutFlags";

type LayoutDeps = {
    // ✅ NEW: relayout existing grid sprites after cellSize changes
  relayoutGridSprites?: () => void;
  redrawReelDimmer?: () => void;
   
  app: Application;
  state: any;
  __layoutDeps: any;

  // blockers / layers
  rotateBlocker: Graphics;
  root: Container;
  backgroundLayer: Container;
  gameCore: Container;
  uiLayer: Container;

  // ✅ NEW: Settings button (so tablet can pin it to screen corner)
  settingsBtnPixi: any;


  // DOM blocker
  getDomRotateBlockerEl: () => HTMLElement | null;
  setRotateBlockerText: (s: string) => void;

  // reel house + board window
  reelHouse: Sprite;
  gridMask: Graphics;
  REEL_WINDOW_INSET: { left: number; top: number; right: number; bottom: number };
  INSET_L: number; INSET_T: number; INSET_R: number; INSET_B: number;

  // sizing + symbol grid
  COLS: number;
  ROWS: number;
  FRAME_GAP: number;
  SYMBOL_GAP: number;

  computeCellSize: () => number;
  getCellSize: () => number;
  setCellSize: (v: number) => void;

  

  // reel-house scaling constants
  MOBILE_LANDSCAPE_REELHOUSE_MUL: number;

  // board metrics setters
  setBoardMetrics: (m: { ox: number; oy: number; w: number; h: number }) => void;

  // layout hooks (callbacks back into main.ts)
  resizeBackground: () => void;
  layoutFsDimmer: () => void;
  layoutFsContinueX: () => void;
  layoutGameCorePivot: () => void;
  layoutFsOutro: () => void;
  layoutFsIntroAward: () => void;

  layoutUI: () => void;
  layoutFsCounter: () => void;
  layoutTumbleBanner: () => void;
  layoutMultiplierPlaque: () => void;
  layoutReelFlash: () => void;

  autoMenuLayout: () => void;
  settingsLayout: () => void;
  buyMenuLayout: () => void;

    rescaleLiveCars?: () => void;
  rescaleWinFrames?: () => void;
};


export function makeLayoutAll(deps: LayoutDeps) {
  
  const {
    
    app, state, __layoutDeps,
    rotateBlocker, root, backgroundLayer, gameCore, uiLayer,
        settingsBtnPixi,
    getDomRotateBlockerEl, setRotateBlockerText,
    reelHouse, gridMask, REEL_WINDOW_INSET,
    INSET_L, INSET_T, INSET_R, INSET_B,
    COLS, ROWS, FRAME_GAP, SYMBOL_GAP,
    computeCellSize, getCellSize, setCellSize,
    MOBILE_LANDSCAPE_REELHOUSE_MUL,
    setBoardMetrics,

    resizeBackground,
    layoutFsDimmer,
    layoutFsContinueX,
    layoutGameCorePivot,

    layoutFsOutro,
    layoutFsIntroAward,
      relayoutGridSprites,
    redrawReelDimmer,
    layoutUI,
    layoutFsCounter,
    layoutTumbleBanner,
    layoutMultiplierPlaque,
    layoutReelFlash,
    autoMenuLayout,
    settingsLayout,
       buyMenuLayout,
    rescaleLiveCars,
    rescaleWinFrames,
  } = deps;
const tinyView = makeLayoutTinyView({
  app, state, __layoutDeps,
  root, backgroundLayer, gameCore, uiLayer,
  reelHouse, gridMask, REEL_WINDOW_INSET,
  INSET_L, INSET_T, INSET_R, INSET_B,
  COLS, ROWS, FRAME_GAP, SYMBOL_GAP,
  getCellSize,
  setCellSize,
  setBoardMetrics,
  resizeBackground,
  layoutFsDimmer,
  layoutFsContinueX,
  layoutGameCorePivot,
  layoutFsOutro,
  layoutFsIntroAward,
  relayoutGridSprites,
  redrawReelDimmer,
  layoutUI,
  autoMenuLayout,
  settingsLayout,
  buyMenuLayout,
  layoutFsCounter,
  layoutTumbleBanner,
  layoutMultiplierPlaque,
  layoutReelFlash,
  rescaleLiveCars,
  rescaleWinFrames,
});

  function layoutRotateBlocker() {
    // you already have a Pixi blocker that draws in main.ts; keep minimal here:
    const W = app.screen.width;
    const H = app.screen.height;
    rotateBlocker.clear();
    rotateBlocker.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.85 });
  }
function layoutTabletReelhouseByTargetCell() {
  // Only for tablets
  if (!isTabletLike()) return;

  // ✅ IMPORTANT: Tablet LANDSCAPE should NOT force a fixed cell size,
  // because the reelHouse may be scaled later by fitReelHouseBetweenTopAndUiTablet().
  // We'll compute cellSize from the final reel-window bounds instead.
  if (isTabletLandscape()) return;

  // 1) Choose a tablet target cell size (bigger than phone)
  //    Tune these 3 numbers to taste.
  const TAB_CELL_MIN = 110;
  const TAB_CELL_MAX = 130;
  const TAB_CELL_PORTRAIT_BIAS = 1.00; // try 1.00..1.10
  const TAB_CELL_LAND_BIAS     = 1.00; // try 0.92..1.02

  // Use your existing computeCellSize() as a “smart baseline”
  let cs = computeCellSize();

  if (isTabletPortrait()) cs = Math.round(cs * TAB_CELL_PORTRAIT_BIAS);
  if (isTabletLandscape()) cs = Math.round(cs * TAB_CELL_LAND_BIAS);

  cs = Math.max(TAB_CELL_MIN, Math.min(TAB_CELL_MAX, cs));
  setCellSize(cs);

  // 2) Scale the reelhouse so the WINDOW fits the target grid
  const cellSize = getCellSize();

  const gridW = COLS * cellSize + (COLS - 1) * SYMBOL_GAP;
  const gridH = ROWS * cellSize + (ROWS - 1) * SYMBOL_GAP;

  const targetWindowW = gridW + FRAME_GAP * 2;
  const targetWindowH = gridH + FRAME_GAP * 2;

  const texW = reelHouse.texture.width || 1;
  const texH = reelHouse.texture.height || 1;

  const windowW0 = Math.max(1, texW - REEL_WINDOW_INSET.left - REEL_WINDOW_INSET.right);
  const windowH0 = Math.max(1, texH - REEL_WINDOW_INSET.top - REEL_WINDOW_INSET.bottom);

  // scale so the opening fits the target window
  const s = Math.max(targetWindowW / windowW0, targetWindowH / windowH0);
  reelHouse.scale.set(s);
}


  function layoutAll() {
    const W = app.screen.width;
    const H = app.screen.height;

    const IS_MOBILE =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia?.("(pointer: coarse)")?.matches;

    const isLandscape = W > H;

    // =====================
    // PORTRAIT-ONLY LOCK (MOBILE + DOM BLOCKER)
    // =====================
   const domBlocker = getDomRotateBlockerEl();




function pinSettingsTopLeftTablet() {
  if (!isTabletLike()) return;

  if (settingsBtnPixi.parent !== uiLayer) uiLayer.addChild(settingsBtnPixi);

  // ✅ TABLET-ONLY SIZE
  const TAB_SETTINGS_SCALE = 1.8; // 🔧 try 1.15 .. 1.45
  settingsBtnPixi.scale.set(TAB_SETTINGS_SCALE);

  const TOP_PAD = 14;
  const LEFT_PAD = 14;

  // ✅ after scaling, use bounds for correct positioning
  const b = settingsBtnPixi.getBounds();
  settingsBtnPixi.x = Math.round(LEFT_PAD + b.width * 0.5);
  settingsBtnPixi.y = Math.round(TOP_PAD + b.height * 0.5);

  settingsBtnPixi.zIndex = 999999;
  uiLayer.sortableChildren = true;
  uiLayer.sortChildren();
}



// ✅ Only block landscape if the portrait-lock flag is ON
const LOCK_MOBILE_TO_PORTRAIT = !!(__layoutDeps as any)?.LOCK_MOBILE_TO_PORTRAIT;

if (LOCK_MOBILE_TO_PORTRAIT && IS_MOBILE && isLandscape) {
  rotateBlocker.visible = true;
  (rotateBlocker as any).eventMode = "static";

  layoutRotateBlocker();
  setRotateBlockerText?.("rotate"); // triggers main fallback t("ui.rotateBackPortrait")
  if (domBlocker) domBlocker.style.display = "flex";

  backgroundLayer.visible = false;
  gameCore.visible = false;
  uiLayer.visible = false;

  root.sortChildren();
  return;
}



   // always hide blocker when not actively blocking
rotateBlocker.visible = false;
(rotateBlocker as any).eventMode = "none";
rotateBlocker.clear(); // ✅ hard safety (no invisible hit area)
if (domBlocker) domBlocker.style.display = "none";

backgroundLayer.visible = true;
gameCore.visible = true;
uiLayer.visible = true;

// ✅ default (non-tiny)
(__layoutDeps as any).IS_TINY_VIEW = false;
state.ui.IS_TINY_VIEW = false;

// =====================
// TINY VIEW (<= 400x225) — use CSS pixels (DevTools DPR safe)
// =====================
const cssW = (app.view as any)?.clientWidth ?? window.innerWidth;
const cssH = (app.view as any)?.clientHeight ?? window.innerHeight;

if (isTinyViewSize(cssW, cssH)) {
  // ✅ IMPORTANT: mark tiny BEFORE laying out tiny view
  (__layoutDeps as any).IS_TINY_VIEW = true;
  state.ui.IS_TINY_VIEW = true;

  tinyView.layoutTinyAll();
  return;
}


    // --- background + overlays ---
    resizeBackground();
    layoutFsDimmer();
    layoutFsContinueX();
    layoutGameCorePivot();
    layoutFsOutro();
    layoutFsIntroAward();

    // Center reel house
    const screenCx = W / 2;
    const screenCy = H / 2;

   const isPortrait = isMobilePortraitUILayout(__layoutDeps);
const isLandMobile = isMobileLandscapeUILayout(__layoutDeps);

const PORTRAIT_BOARD_Y_LIFT_PX = Math.round(H * 0.055);
const LANDSCAPE_BOARD_Y_LIFT_PX = Math.round(H * 0.03); // 🔧 small lift in landscape

reelHouse.x = screenCx;
reelHouse.y = isPortrait
  ? Math.round(screenCy - PORTRAIT_BOARD_Y_LIFT_PX)
  : isLandMobile
    ? Math.round(screenCy - LANDSCAPE_BOARD_Y_LIFT_PX)
    : screenCy;


    const isMob = isMobileUILayout(__layoutDeps);
const isTablet = isTabletLike();
const isPhoneMobile = isMob && !isTablet;
// =====================
// TABLET: keep reel house above bottom UI (no overlap)
// Only affects tablet-like devices. Phone + desktop untouched.
// =====================
function fitReelHouseBetweenTopAndUiTablet() {
  if (!isTablet) return;

  // Reserve bottom UI height (screen px). Keep in sync with layoutUI.ts bgFrac logic.
  const TAB_PORTRAIT_UI_FRAC = 0.10;
  const TAB_LAND_UI_FRAC = 0.075;

  const tabPortrait = isTabletPortrait();
  const uiFrac = tabPortrait ? TAB_PORTRAIT_UI_FRAC : TAB_LAND_UI_FRAC;

  const uiReservePx = Math.round(H * uiFrac);
  const safeB = 0; // you don't have a safeInsetBottom dep here; OK for iPad (usually 0). If you later pass it, use it.

  const TOP_PAD_PX = 10;
  const GAP_ABOVE_UI_PX = 12;

  const allowedTop = TOP_PAD_PX;
  const allowedBottom = H - safeB - uiReservePx - GAP_ABOVE_UI_PX;
  const availH = Math.max(1, allowedBottom - allowedTop);

  // Convert a WORLD-space deltaY into local space for reelHouse parent.
  const parent = reelHouse.parent as any;
  const worldDeltaToLocalDy = (dyWorld: number) => {
    if (!parent?.toLocal) return dyWorld;
    const p0 = parent.toLocal({ x: 0, y: 0 } as any);
    const p1 = parent.toLocal({ x: 0, y: dyWorld } as any);
    return (p1.y - p0.y) || dyWorld;
  };

  // 1) Scale down if too tall for the allowed band
  let b = reelHouse.getBounds(); // GLOBAL (screen px)
  if (b.height > availH) {
    const k = availH / b.height;
    const newS = reelHouse.scale.x * k; // uniform
    reelHouse.scale.set(newS);
    b = reelHouse.getBounds();
  }

  // 2) Clamp Y to stay inside band (top + bottom)
  if (b.y + b.height > allowedBottom) {
    const shiftUpWorld = (b.y + b.height) - allowedBottom;
    reelHouse.y -= worldDeltaToLocalDy(shiftUpWorld);
    b = reelHouse.getBounds();
  }

  if (b.y < allowedTop) {
    const shiftDownWorld = allowedTop - b.y;
    reelHouse.y += worldDeltaToLocalDy(shiftDownWorld);
  }
}

    // ----------------------------------------
    // DESKTOP: existing behavior
    // ----------------------------------------
if (!isMob) {
  setCellSize(computeCellSize());

  const cellSize = getCellSize();

  // ✅ This is the grid content size (symbols area)
  const gridW = COLS * cellSize + (COLS - 1) * SYMBOL_GAP;
  const gridH = ROWS * cellSize + (ROWS - 1) * SYMBOL_GAP;

  // ✅ Optional: FRAME_GAP is “reel house sizing only”
  // Treat it like padding inside the reel window.
  const targetWindowW = gridW + FRAME_GAP * 2;
  const targetWindowH = gridH + FRAME_GAP * 2;

  const texW = reelHouse.texture.width || 1;
  const texH = reelHouse.texture.height || 1;

  // ✅ Compute the REEL WINDOW size in texture pixels (the opening)
  const windowW0 = Math.max(1, texW - REEL_WINDOW_INSET.left - REEL_WINDOW_INSET.right);
  const windowH0 = Math.max(1, texH - REEL_WINDOW_INSET.top - REEL_WINDOW_INSET.bottom);

  // ✅ Scale reel house so the *opening* fits the grid
  const s = Math.max(targetWindowW / windowW0, targetWindowH / windowH0);

  reelHouse.scale.set(s);
}


// ✅ PHONE: keep your existing width-based reelhouse scaling (unchanged)
if (isMob && !isTabletLike()) {
  const MARGIN_X = 14;
  const targetOuterW = Math.max(1, (W - MARGIN_X * 2) * 0.94);

  const texW = reelHouse.texture.width || 1;
  const baseScale = targetOuterW / texW;

  const portraitMul = isMobilePortraitUILayout(__layoutDeps) ? 1.08 : 1.0;

  const isLand = isMobileLandscapeUILayout(__layoutDeps);
  const landscapeMul = isLand
    ? Math.max(0.62, Math.min(0.92, MOBILE_LANDSCAPE_REELHOUSE_MUL))
    : 1.0;

  reelHouse.scale.set(baseScale * portraitMul * landscapeMul);
}

// ✅ TABLET: size reelhouse by TARGET CELL SIZE (keeps symbols big)
if (isMob && isTabletLike()) {
  layoutTabletReelhouseByTargetCell();
}

// ✅ TABLET ONLY: ensure reel house never underlaps the bottom UI
fitReelHouseBetweenTopAndUiTablet();




// =====================================================
// MOBILE LANDSCAPE: keep reel house fully on-screen (TOP included)
// and ALWAYS above the bottom UI panel (no overlap)
// Uses GLOBAL bounds + optional scale-down if too tall.
// =====================================================
if (isMob && isMobileLandscapeUILayout(__layoutDeps)) {
  // keep this in sync with layoutUI.ts
  const LANDSCAPE_PANEL_BG_FRAC = 0.075;

  const uiReservePx = Math.round(H * LANDSCAPE_PANEL_BG_FRAC);
  const SAFE_GAP_PX = 10;  // gap above panel
  const TOP_PAD_PX = 10;   // gap from top of screen

  const allowedTop = TOP_PAD_PX;
  const allowedBottom = H - uiReservePx - SAFE_GAP_PX;
  const availH = Math.max(1, allowedBottom - allowedTop);

  // helper: convert a WORLD-space Y delta into this sprite-parent LOCAL delta
  const parent = reelHouse.parent as any;
  const worldDeltaToLocalDy = (dyWorld: number) => {
    if (!parent?.toLocal) return dyWorld; // fallback
    const p0 = parent.toLocal({ x: 0, y: 0 } as any);
    const p1 = parent.toLocal({ x: 0, y: dyWorld } as any);
    return (p1.y - p0.y) || dyWorld;
  };

  // 1) If reel house is too tall on-screen, SCALE DOWN to fit safe height
  // (do this BEFORE clamping Y)
  let b = reelHouse.getBounds(); // GLOBAL bounds (screen pixels)
  if (b.height > availH) {
    const k = availH / b.height;
    const newS = reelHouse.scale.x * k; // uniform scale (assumes x==y)
    reelHouse.scale.set(newS);

    // refresh bounds after scaling
    b = reelHouse.getBounds();
  }

  // 2) Clamp Y so top >= allowedTop and bottom <= allowedBottom
  // shift UP if bottom is too low
  if (b.y + b.height > allowedBottom) {
    const shiftUpWorld = (b.y + b.height) - allowedBottom;
    reelHouse.y -= worldDeltaToLocalDy(shiftUpWorld);
    b = reelHouse.getBounds();
  }

  // shift DOWN if top is too high
  if (b.y < allowedTop) {
    const shiftDownWorld = allowedTop - b.y;
    reelHouse.y += worldDeltaToLocalDy(shiftDownWorld);
    // b = reelHouse.getBounds(); // not strictly needed beyond here
  }
}
// ✅ TRUE WORLD (SCREEN) reel-window rect using toGlobal (stable across gameCore pivot/scale)
let left = 0, top = 0, right = 0, bottom = 0;

{
  const texW = reelHouse.texture.width || 1;
  const texH = reelHouse.texture.height || 1;

  // local coordinates inside the reelHouse sprite (pre-scale; toGlobal includes scale)
  const lx0 = (-texW * 0.5) + REEL_WINDOW_INSET.left;
  const ly0 = (-texH * 0.5) + REEL_WINDOW_INSET.top;
  const lx1 = ( texW * 0.5) - REEL_WINDOW_INSET.right;
  const ly1 = ( texH * 0.5) - REEL_WINDOW_INSET.bottom;

  const pTL = reelHouse.toGlobal({ x: lx0, y: ly0 } as any);
  const pBR = reelHouse.toGlobal({ x: lx1, y: ly1 } as any);

  left   = Math.min(pTL.x, pBR.x);
  right  = Math.max(pTL.x, pBR.x);
  top    = Math.min(pTL.y, pBR.y);
  bottom = Math.max(pTL.y, pBR.y);

  // ✅ UI horizontal anchor = reel-window center in TRUE world coords
  (__layoutDeps as any).uiAnchorX = (left + right) * 0.5;

  // ✅ stable world rect for plaque placement
  (__layoutDeps as any).reelWindowWorld = { left, top, right, bottom };
}

// ✅ convert WORLD -> gameCore LOCAL
const tl = gameCore.toLocal({ x: left, y: top } as any);
const br = gameCore.toLocal({ x: right, y: bottom } as any);


const boardOx = Math.round(tl.x);
const boardOy = Math.round(tl.y);
const boardTotalW = Math.round(br.x - tl.x);
const boardTotalH = Math.round(br.y - tl.y);

setBoardMetrics({ ox: boardOx, oy: boardOy, w: boardTotalW, h: boardTotalH });
// ✅ expose FINAL reel-window rect in GAMECORE local coords (stable anchor for plaque)
(__layoutDeps as any).reelWindowLocal = {
  x: boardOx,
  y: boardOy,
  w: boardTotalW,
  h: boardTotalH,
};
// ✅ TABLET LANDSCAPE: derive cellSize from the FINAL reel-window bounds
// This guarantees symbols fit perfectly inside the reel window even if reelHouse
// was scaled down by fitReelHouseBetweenTopAndUiTablet().
if (isMob && isTabletLandscape()) {
  const cellFromW = (boardTotalW - (COLS - 1) * SYMBOL_GAP) / COLS;
  const cellFromH = (boardTotalH - (ROWS - 1) * SYMBOL_GAP) / ROWS;

  let cs = Math.floor(Math.min(cellFromW, cellFromH));

  // Allow tablet landscape to be larger than phone, but still clamp
  const MIN_CELL = 1;
  const MAX_CELL_TAB_LAND = 170; // 🔧 tune if you want (150..190)
  cs = Math.max(MIN_CELL, Math.min(MAX_CELL_TAB_LAND, cs));

  setCellSize(cs);
}



// TABLET: cellSize was already chosen above (keep it)
if (isMob && !isTabletLike()) {
  const cellFromW = (boardTotalW - (COLS - 1) * SYMBOL_GAP) / COLS;
  const cellFromH = (boardTotalH - (ROWS - 1) * SYMBOL_GAP) / ROWS;

  let cs = Math.floor(Math.min(cellFromW, cellFromH));

  const MAX_CELL = 130;
  cs = Math.min(MAX_CELL, Math.max(1, cs));

  setCellSize(cs);
}

// ✅ always relayout after we know final cellSize (tablet or phone)
relayoutGridSprites?.();
redrawReelDimmer?.();

// ✅ Desktop: keep UI scale stable
if (!isMob) {
  (__layoutDeps as any).uiScale = 1;
} else {
  const cs = Math.max(1, getCellSize());
  const DESIGN_CELL = 130;

  const isTab = isTabletLike();

  // Phone: follow cellSize more aggressively
  const PHONE_MIN = 0.85;
  const PHONE_MAX = 1.15;

  // Tablet: keep UI a bit bigger and steadier
  const TAB_MIN = 0.95;
  const TAB_MAX = 1.25;

  const minS = isTab ? TAB_MIN : PHONE_MIN;
  const maxS = isTab ? TAB_MAX : PHONE_MAX;

  const basedOnCell = cs / DESIGN_CELL;
  (__layoutDeps as any).uiScale = Math.min(maxS, Math.max(minS, basedOnCell));
}




// ✅ Win frames must match the FINAL cellSize in ALL layouts (portrait/landscape/tablet/desktop)
rescaleWinFrames?.();

    // Update grid mask
    gridMask.clear();
    gridMask
      .rect(
        boardOx + INSET_L,
        boardOy + INSET_T,
        boardTotalW - INSET_L - INSET_R,
        boardTotalH - INSET_T - INSET_B
      )
      .fill(0xffffff);

    // UI + menus + misc
   layoutUI();
autoMenuLayout();
settingsLayout();
buyMenuLayout();
pinSettingsTopLeftTablet();
layoutFsCounter();
layoutTumbleBanner();
layoutMultiplierPlaque();

layoutReelFlash();


    rescaleLiveCars?.();

    root.sortChildren();
  
  }

  return { layoutAll };
}