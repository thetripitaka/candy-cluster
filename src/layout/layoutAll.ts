// src/layout/layoutAll.ts
import type { Application, Graphics, Sprite, Container } from "pixi.js";
import {
  isMobileUILayout,
  isMobilePortraitUILayout,
  isMobileLandscapeUILayout,
} from "../ui/layoutFlags";

type LayoutDeps = {
   
  app: Application;
  state: any;
  __layoutDeps: any;

  // blockers / layers
  rotateBlocker: Graphics;
  root: Container;
  backgroundLayer: Container;
  gameCore: Container;
  uiLayer: Container;

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

  function layoutRotateBlocker() {
    // you already have a Pixi blocker that draws in main.ts; keep minimal here:
    const W = app.screen.width;
    const H = app.screen.height;
    rotateBlocker.clear();
    rotateBlocker.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.85 });
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

    if (IS_MOBILE && isLandscape) {
      rotateBlocker.visible = true;
      layoutRotateBlocker();
      setRotateBlockerText?.("rotate"); // just triggers main's fallback t("ui.rotateBackPortrait")
      if (domBlocker) domBlocker.style.display = "flex";

      backgroundLayer.visible = false;
      gameCore.visible = false;
      uiLayer.visible = false;

      root.sortChildren();
      return;
    }

    // leaving landscape
    rotateBlocker.visible = false;
    if (domBlocker) domBlocker.style.display = "none";

    backgroundLayer.visible = true;
    gameCore.visible = true;
    uiLayer.visible = true;

    // safety: ensure interaction comes back (main.ts can still manage alpha/eventMode)
    gameCore.visible = true;
    uiLayer.visible = true;

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

    const PORTRAIT_BOARD_Y_LIFT_PX = Math.round(H * 0.055);
    reelHouse.x = screenCx;
    reelHouse.y = isPortrait
      ? Math.round(screenCy - PORTRAIT_BOARD_Y_LIFT_PX)
      : screenCy;

    const isMob = isMobileUILayout(__layoutDeps);

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

    // ----------------------------------------
    // MOBILE: reel house matches device width
    // ----------------------------------------
    if (isMob) {
      const MARGIN_X = 14;
      const targetOuterW = Math.max(1, W - MARGIN_X * 2);

      const texW = reelHouse.texture.width || 1;
      const baseScale = targetOuterW / texW;

      const portraitMul = isMobilePortraitUILayout(__layoutDeps) ? 1.08 : 1.0;
      const landscapeMul = isMobileLandscapeUILayout(__layoutDeps)
        ? MOBILE_LANDSCAPE_REELHOUSE_MUL
        : 1.0;

      reelHouse.scale.set(baseScale * portraitMul * landscapeMul);
    }

   // Convert inset px to world px
const sx = reelHouse.scale.x;
const sy = reelHouse.scale.y;

// ✅ Desktop: keep UI scale stable (no resizing jumps)
// ✅ Mobile: follow reel house scale (clamped)
if (!isMob) {
  (__layoutDeps as any).uiScale = 1;
} else {
  const UI_SCALE_MIN = 0.85;
  const UI_SCALE_MAX = 1.15;

  (__layoutDeps as any).uiScale = Math.min(
    UI_SCALE_MAX,
    Math.max(UI_SCALE_MIN, sx)
  );
}



    // WORLD coords (unchanged)
const left   = reelHouse.x - reelHouse.width / 2 + REEL_WINDOW_INSET.left * sx;
const top    = reelHouse.y - reelHouse.height / 2 + REEL_WINDOW_INSET.top * sy;
const right  = reelHouse.x + reelHouse.width / 2 - REEL_WINDOW_INSET.right * sx;
const bottom = reelHouse.y + reelHouse.height / 2 - REEL_WINDOW_INSET.bottom * sy;

// ✅ UI horizontal anchor = reel-window center (world space)
(__layoutDeps as any).uiAnchorX = (left + right) * 0.5;


// ✅ convert WORLD -> gameCore LOCAL
const tl = gameCore.toLocal({ x: left, y: top } as any);
const br = gameCore.toLocal({ x: right, y: bottom } as any);

const boardOx = Math.round(tl.x);
const boardOy = Math.round(tl.y);
const boardTotalW = Math.round(br.x - tl.x);
const boardTotalH = Math.round(br.y - tl.y);

setBoardMetrics({ ox: boardOx, oy: boardOy, w: boardTotalW, h: boardTotalH });


    // MOBILE: derive cellSize from reel window
    if (isMob) {
      const cellFromW = (boardTotalW - (COLS - 1) * SYMBOL_GAP) / COLS;
      const cellFromH = (boardTotalH - (ROWS - 1) * SYMBOL_GAP) / ROWS;
      setCellSize(Math.floor(Math.min(cellFromW, cellFromH)));
    }

// ✅ Win frames need to match current cellSize on desktop
if (!isMob) rescaleWinFrames?.();

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

    layoutFsCounter();
    layoutTumbleBanner();
    layoutMultiplierPlaque();
    layoutReelFlash();

    rescaleLiveCars?.();

    root.sortChildren();
  }

  return { layoutAll };
}