// src/layout/layoutTinyView.ts
import type { Application, Container, Graphics, Sprite } from "pixi.js";

export type TinyViewDeps = {
  app: Application;
  state: any;
  __layoutDeps: any;

  root: Container;
  backgroundLayer: Container;
  gameCore: Container;
  uiLayer: Container;

  reelHouse: Sprite;
  gridMask: Graphics;

  REEL_WINDOW_INSET: { left: number; top: number; right: number; bottom: number };
  INSET_L: number; INSET_T: number; INSET_R: number; INSET_B: number;

  COLS: number;
  ROWS: number;
  FRAME_GAP: number;
  SYMBOL_GAP: number;

  getCellSize: () => number;
  setCellSize: (v: number) => void;

  setBoardMetrics: (m: { ox: number; oy: number; w: number; h: number }) => void;

  // same hooks you already call in layoutAll
  resizeBackground: () => void;
  layoutFsDimmer: () => void;
  layoutFsContinueX: () => void;
  layoutGameCorePivot: () => void;
  layoutFsOutro: () => void;
  layoutFsIntroAward: () => void;

  relayoutGridSprites?: () => void;
  redrawReelDimmer?: () => void;

  layoutUI: () => void;
  autoMenuLayout: () => void;
  settingsLayout: () => void;
  buyMenuLayout: () => void;

  layoutFsCounter: () => void;
  layoutTumbleBanner: () => void;
  layoutMultiplierPlaque: () => void;
  layoutReelFlash: () => void;

  rescaleLiveCars?: () => void;
  rescaleWinFrames?: () => void;
};

/**
 * Tiny View trigger:
 * - "400x225 and lower" (either orientation)
 */
export function isTinyViewSize(w: number, h: number) {
  const longSide = Math.max(w, h);
  const shortSide = Math.min(w, h);
  return longSide <= 400 && shortSide <= 225;
}

export function makeLayoutTinyView(deps: TinyViewDeps) {
  const {
    app, state, __layoutDeps,
    root, backgroundLayer, gameCore, uiLayer,
    reelHouse, gridMask, REEL_WINDOW_INSET,
    INSET_L, INSET_T, INSET_R, INSET_B,
    COLS, ROWS, FRAME_GAP, SYMBOL_GAP,
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
  } = deps;

  function layoutTinyAll() {
    (__layoutDeps as any).IS_TINY_VIEW = true;
 
    const W = app.screen.width;
    const H = app.screen.height;
(__layoutDeps as any).IS_TINY_VIEW = true;
    // show everything (no rotate blocker logic in here — layoutAll keeps that)
    backgroundLayer.visible = true;
    gameCore.visible = true;
    uiLayer.visible = true;

    // keep your usual pipeline
    resizeBackground();
    layoutFsDimmer();
    layoutFsContinueX();
    layoutGameCorePivot();
    layoutFsOutro();
    layoutFsIntroAward();

    // ---- TINY: aggressive fit ----
    // Center board slightly above center to preserve room for bottom UI
    const screenCx = W / 2;
    const screenCy = H / 2;
    reelHouse.x = screenCx;
    reelHouse.y = Math.round(screenCy - H * 0.04);

    // Scale reelhouse to fit *both* width + height (tiny safe)
    const texW = reelHouse.texture.width || 1;
    const texH = reelHouse.texture.height || 1;

    const PAD_X = 6;
    const PAD_Y = 6;

    const targetOuterW = Math.max(1, W - PAD_X * 2);
    const targetOuterH = Math.max(1, H - PAD_Y * 2);

    const sW = targetOuterW / texW;
    const sH = targetOuterH / texH;

    // choose the limiting scale, then nudge slightly smaller so UI never fights it
    const s = Math.min(sW, sH) * 0.98;
    reelHouse.scale.set(s);

    // ---- compute reel-window WORLD rect (same as your layoutAll) ----
    let left = 0, top = 0, right = 0, bottom = 0;

    {
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

      (__layoutDeps as any).uiAnchorX = (left + right) * 0.5;
      (__layoutDeps as any).reelWindowWorld = { left, top, right, bottom };
    }

    // WORLD -> gameCore LOCAL (same as yours)
    const tl = gameCore.toLocal({ x: left, y: top } as any);
    const br = gameCore.toLocal({ x: right, y: bottom } as any);

    const boardOx = Math.round(tl.x);
    const boardOy = Math.round(tl.y);
    const boardTotalW = Math.round(br.x - tl.x);
    const boardTotalH = Math.round(br.y - tl.y);

    setBoardMetrics({ ox: boardOx, oy: boardOy, w: boardTotalW, h: boardTotalH });
    (__layoutDeps as any).reelWindowLocal = { x: boardOx, y: boardOy, w: boardTotalW, h: boardTotalH };

    // ---- derive a tiny-friendly cellSize from final reel window ----
    const cellFromW = (boardTotalW - (COLS - 1) * SYMBOL_GAP) / COLS;
    const cellFromH = (boardTotalH - (ROWS - 1) * SYMBOL_GAP) / ROWS;

    let cs = Math.floor(Math.min(cellFromW, cellFromH));
    // tiny clamp (keep readable but never overflow)
    cs = Math.max(1, Math.min(95, cs));
    setCellSize(cs);

    relayoutGridSprites?.();
    redrawReelDimmer?.();

    // ---- UI scale: force smaller in tiny ----
    const DESIGN_CELL = 130;
    const basedOnCell = cs / DESIGN_CELL;
    (__layoutDeps as any).uiScale = Math.max(0.65, Math.min(0.90, basedOnCell));

    // win frames must match cellSize
    rescaleWinFrames?.();

    // update mask (same as yours)
    gridMask.clear();
    gridMask
      .rect(
        boardOx + INSET_L,
        boardOy + INSET_T,
        boardTotalW - INSET_L - INSET_R,
        boardTotalH - INSET_T - INSET_B
      )
      .fill(0xffffff);

    // layout UI + menus
    layoutUI();
    autoMenuLayout();
    settingsLayout();
    buyMenuLayout();

    layoutFsCounter();
    layoutTumbleBanner();
    layoutMultiplierPlaque();
    // ✅ TINY VIEW ONLY: final plaque Y nudge (runs AFTER plaque layout pins it)
const mpl = (__layoutDeps as any).multPlaqueLayer as Container | undefined;
if (mpl) {
  const TINY_PLAQUE_Y_LIFT = 60; // 🔧 try 30..140
  mpl.y = Math.round(mpl.y - TINY_PLAQUE_Y_LIFT);
}

    layoutReelFlash();

    rescaleLiveCars?.();

    root.sortChildren();
  }

  return { layoutTinyAll };
}
