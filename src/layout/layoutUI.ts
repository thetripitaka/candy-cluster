// src/layout/layoutUI.ts
import type { Container, Rectangle } from "pixi.js";
import { Graphics } from "pixi.js";


import {
  isMobileUILayout,
  isMobilePortraitUILayout,
  isMobileLandscapeUILayout,
  isTabletLike, 
    isTabletLandscape, 
} from "../ui/layoutFlags";

type LayoutUIArgs = {
  __layoutDeps: any;
  appScreenW: () => number;
  appScreenH: () => number;

  PANEL_HEIGHT_FRAC: () => number;

  safeInsetBottomPx: () => number;

  // ui bottom module
 uiBottom: {
     layer: Container;
 layout: (p: {
  W: number;
  H: number;
  uiH: number;
  safeB: number;

  uiScale: number;

  isMobile: boolean;
  isPortrait: boolean;
  isLandscape: boolean; // ✅ NEW
}) => void;

};


  // containers
  uiPanel: Container;

  // buttons (pixi containers)
  spinBtnPixi: any;
  spinningBtnPixi: any;
  buyBtnPixi: any;
  settingsBtnPixi: any;
  autoBtnPixi: any;
  turboBtnPixi: any;

  // bet groupings
  ensureBetParentingForLayout: () => void;

  // helpers
  setScaleToHeight: (c: any, targetH: number) => void;
  centerPivot: (c: Container) => void;

  // win/balance/bet groups
  winUI: Container;
  winTitleLabel: any;
  winAmountLabel: any;

  balanceGroup: Container;
  balanceTitleLabel: any;
  balanceLabel: any;

  betGroup: Container;
  betTitleLabel: any;
  betAmountUI: Container;
  betUpBtnPixi: any;
  betDownBtnPixi: any;

  betDisplayGroup: Container;
  betControlsGroup: Container;

  // (optional) tighter hit areas
  setTightHitArea?: (btn: any, padX: number, padY: number) => void;

  // output hook (so main.ts keeps its uiPanelH)
  setUiPanelH: (v: number) => void;
};

function placeOnPanel(c: any, nx: number, ny: number, panelW: number, panelH: number) {
  c.x = Math.round(panelW * nx);
  c.y = Math.round(panelH * ny);
}

function alignGroupTop(group: Container, topY: number) {
  const b = group.getLocalBounds();
  group.y = Math.round(topY - b.y * (group.scale.y || 1));
}

function aabbInParent(c: any) {
  // Axis-aligned bounds in PARENT space (no rotations assumed, which matches your UI)
  const b = c.getLocalBounds?.() ?? { x: 0, y: 0, width: 0, height: 0 };
  const sx = c.scale?.x ?? 1;
  const sy = c.scale?.y ?? 1;
  const px = c.pivot?.x ?? 0;
  const py = c.pivot?.y ?? 0;

  const left = c.x + (b.x - px) * sx;
  const top = c.y + (b.y - py) * sy;
  const right = left + b.width * sx;
  const bottom = top + b.height * sy;

  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function applyUniformScale(c: any, mul: number) {
  const sx = c.scale?.x ?? 1;
  const sy = c.scale?.y ?? 1;
  c.scale.set(sx * mul, sy * mul);
}


export function makeLayoutUI(args: LayoutUIArgs) {
  const {
    __layoutDeps,
    appScreenW,
    appScreenH,
    PANEL_HEIGHT_FRAC,
    safeInsetBottomPx,
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

    setTightHitArea,
    setUiPanelH,
  } = args;
  // ✅ optional debug: show anchor line
const DEBUG_UI_ANCHOR = false;
const anchorGfx = new Graphics();
anchorGfx.eventMode = "none";
anchorGfx.alpha = 0.6;
uiPanel.addChild(anchorGfx);
let didWarmRelayout = false;

function layoutStatGroupTopAligned(opts: {
  group: Container;
  title: any;
  value: any;
  targetH: number;      // panel local height used for sizing
  topY: number;         // baseline for TOP edge (local space)
  titleOffsetY: number; // title above value (local space, negative)
  scaleFrac: number;    // fraction of targetH used as group height
}) {
  const { group, title, value, targetH, topY, titleOffsetY, scaleFrac } = opts;

  group.visible = true;
  // ✅ stat widgets must not carry old pivots from other layouts
  group.pivot.set(0, 0);
  // predictable anchors
  value.anchor?.set?.(0.5);
  title.anchor?.set?.(0.5);

  // internal positions (local to the group)
  value.position.set(0, 0);
  title.position.set(0, Math.round(titleOffsetY));

  // scale group to desired height
  group.scale.set(1, 1);
  const h0 = Math.max(1, group.getLocalBounds().height);
  const targetGroupH = targetH * scaleFrac;
  const s = targetGroupH / h0;
  // ✅ hard reset so scale never accumulates between layout modes
group.scale.set(1, 1);
  group.scale.set(s);

// snap TOP edge to baseline (correct even with scale + pivot)
const b = group.getLocalBounds();
const sy = group.scale.y || 1;
const py = group.pivot?.y || 0;

// renderedTop = y + (b.y - pivotY) * scaleY  =>  y = topY - (b.y - pivotY) * scaleY
group.y = Math.round(topY - (b.y - py) * sy);

}

function layoutUIDesktop(panelW: number, targetH: number, anchorX: number) {
  
      // ✅ keep “8px” in SCREEN pixels even though the panel layer is scaled
const PANEL_TOP_PAD_PX = 2;
const sPanel = Math.max(0.01, uiBottom.layer.scale.y || 1);
const PANEL_TOP_PAD_LOCAL = PANEL_TOP_PAD_PX / sPanel;



    const GROUP_TOP_Y = Math.round(targetH * 0);

// WIN (stat widget, same base as BALANCE)
winUI.visible = true;
winTitleLabel.visible = true;
winAmountLabel.visible = true;



// =====================
// LANDSCAPE STAT ROW — MATCH BALANCE EXACTLY
// WIN + BET clone BALANCE sizing + baseline
// =====================
const STAT_TITLE_OFFSET_Y = -35;
const STAT_SCALE_FRAC = 1;


layoutStatGroupTopAligned({
  group: winUI,
  title: winTitleLabel,
  value: winAmountLabel,
  targetH,
topY: PANEL_TOP_PAD_LOCAL, // ✅ 8px below the top of the UI panel background
  // ✅ same baseline as balance
  titleOffsetY: -35,                    // ✅ same title spacing as balance
  scaleFrac: 0.73,                      // ✅ same sizing as balance
});

winUI.x = Math.round(panelW * 0.5);



  // BALANCE (base stat widget)
layoutStatGroupTopAligned({
  group: balanceGroup,
  title: balanceTitleLabel,
  value: balanceLabel,
  targetH,
topY: PANEL_TOP_PAD_LOCAL, // ✅ 8px below the top of the UI panel background
 // ✅ baseline inside panel
  titleOffsetY: -35,
  scaleFrac: 0.73,
});

// ✅ responsive default: narrower screens need a smaller gap so BALANCE doesn’t live under buttons
const WIN_TO_BALANCE_GAP = Math.round(Math.max(140, Math.min(310, panelW * 0.15)));

// ✅ use local bounds (stable) + current scale
const winLB = winUI.getLocalBounds();
const winW = winLB.width * (winUI.scale.x || 1);

// ✅ balance width after scaling
const balLB = balanceGroup.getLocalBounds();
const balW = balLB.width * (balanceGroup.scale.x || 1);

// place to the right of WIN (X only)
balanceGroup.x = Math.round(winUI.x + winW * 0.5 + WIN_TO_BALANCE_GAP + balW * 0.5);




 // =====================
// DESKTOP BUTTONS (RESTORED)
// =====================

// SPIN
placeOnPanel(spinBtnPixi, 0.86, 0.1, panelW, targetH);
setScaleToHeight(spinBtnPixi, targetH * 1.7);

// lock spin X to reel anchor (desktop rule)
const SPIN_FROM_ANCHOR_FRAC = 0.36;
spinBtnPixi.x = Math.round(anchorX + panelW * SPIN_FROM_ANCHOR_FRAC);

// AUTO
placeOnPanel(autoBtnPixi, 0.78, 0.5, panelW, targetH);
setScaleToHeight(autoBtnPixi, targetH * 0.78);

// TURBO
placeOnPanel(turboBtnPixi, 0.935, 0.5, panelW, targetH);
setScaleToHeight(turboBtnPixi, targetH * 0.9);



// BUY
const BUY_Y_NUDGE = -0.2;
placeOnPanel(buyBtnPixi, 0.14, 0.23 + BUY_Y_NUDGE, panelW, targetH);
setScaleToHeight(buyBtnPixi, targetH * 1.7);

// SETTINGS
placeOnPanel(settingsBtnPixi, 0.07, 0.54, panelW, targetH);
setScaleToHeight(settingsBtnPixi, targetH * 0.4);





    // BET (desktop grouping)
    betDisplayGroup.visible = true;
    betControlsGroup.visible = true;
    betGroup.visible = false;
    // ✅ Ensure bet arrows live inside betControlsGroup (betGroup is hidden on desktop)
betUpBtnPixi.visible = true;
betDownBtnPixi.visible = true;
betUpBtnPixi.alpha = 1;
betDownBtnPixi.alpha = 1;

if (betUpBtnPixi.parent !== betControlsGroup) betControlsGroup.addChild(betUpBtnPixi);
if (betDownBtnPixi.parent !== betControlsGroup) betControlsGroup.addChild(betDownBtnPixi);

// predictable pivots
centerPivot(betUpBtnPixi);
centerPivot(betDownBtnPixi);




    const BET_ARROW_SCALE = isMobileLandscapeUILayout(__layoutDeps) ? 0.24 : 0.30;
    setScaleToHeight(betUpBtnPixi, targetH * BET_ARROW_SCALE);
    setScaleToHeight(betDownBtnPixi, targetH * BET_ARROW_SCALE);
    // ✅ position AFTER scaling so they never touch
const upH = betUpBtnPixi.getLocalBounds().height * (betUpBtnPixi.scale.y || 1);
const dnH = betDownBtnPixi.getLocalBounds().height * (betDownBtnPixi.scale.y || 1);

// screen-pixel padding between arrows (converted to local)
const ARROW_PAD_PX = 4;
const ARROW_PAD_LOCAL = ARROW_PAD_PX / sPanel;

// half gap = half heights + pad
const halfGap = (upH * 0.5 + dnH * 0.5) * 0.5 + ARROW_PAD_LOCAL;

betUpBtnPixi.position.set(0, -halfGap);
betDownBtnPixi.position.set(0, +halfGap);


// BET display (stat widget, same base as BALANCE/WIN)
layoutStatGroupTopAligned({
  group: betDisplayGroup,
  title: betTitleLabel,
  value: betAmountUI,                    // ✅ the pill acts as the "value"
  targetH,
  topY: PANEL_TOP_PAD_LOCAL, // ✅ 8px below the top of the UI panel background
 // ✅ same baseline
  titleOffsetY: -35,                     // ✅ same title spacing
  scaleFrac: 0.73,                       // ✅ same sizing
});

// keep the pill itself at normal scale inside its group
betAmountUI.scale.set(1);
betAmountUI.position.set(0, 0);


    // position bet relative to win
const WIN_TO_BET_GAP = 320;

const betLB = betDisplayGroup.getLocalBounds();
const betWLocal = betLB.width * (betDisplayGroup.scale.x || 1);

betDisplayGroup.x = Math.round(winUI.x - winW * 0.5 - WIN_TO_BET_GAP - betWLocal * 0.5);

// now that betDisplayGroup.x is final, compute pillLeft
const pillW = betAmountUI.getBounds().width;
const pillLeft = betDisplayGroup.x - (pillW * 0.5);

// controls
const bb = betControlsGroup.getLocalBounds();
const controlsRightLocal = bb.x + bb.width;
const CTRL_TO_PILL_GAP = 50;

betControlsGroup.x = Math.round(pillLeft - CTRL_TO_PILL_GAP - controlsRightLocal);
betControlsGroup.x += 30;



 






    // =====================
// DESKTOP X-COLLISION FIX
// Keep BET / WIN / BALANCE inside the lane between BUY (left) and SPIN (right)
// =====================
const scaledWof = (c: any) => {
  const b = c.getLocalBounds?.() ?? { width: 0 };
  return (b.width || 0) * (c.scale?.x || 1);
};

const PAD_X = 18;

// left boundary = BUY right edge
const buyW = scaledWof(buyBtnPixi);
const leftLimit = Math.round(buyBtnPixi.x + buyW * 0.5 + PAD_X);

// right boundary = closest LEFT edge among the right-side buttons (spin/auto/turbo)
const leftEdgeOf = (c: any) => Math.round(c.x - scaledWof(c) * 0.5 - PAD_X);

const rightLimit = Math.min(
  leftEdgeOf(spinBtnPixi),
  leftEdgeOf(autoBtnPixi),
  leftEdgeOf(turboBtnPixi),
);


const avail = Math.max(1, rightLimit - leftLimit);

// widths (already scaled by your height logic)
const winW2 = winW;
const betW2 = betWLocal;
const balLB2 = balanceGroup.getLocalBounds();
const balW2 = (balLB2.width || 0) * (balanceGroup.scale.x || 1);

// start from your “ideal” gaps
let gapL = WIN_TO_BET_GAP;
let gapR = WIN_TO_BALANCE_GAP;

// if we don’t fit, compress ONLY the gaps (keep text readable)
const widthsOnly = betW2 + winW2 + balW2;
const gapsOnly = gapL + gapR;

if (widthsOnly + gapsOnly > avail) {
  const gapAvail = Math.max(0, avail - widthsOnly);
  const k = gapsOnly > 0 ? gapAvail / gapsOnly : 0;

  const MIN_K = 0.25; // don’t collapse gaps to zero
  const kk = Math.max(MIN_K, Math.min(1, k));

  gapL = Math.round(gapL * kk);
  gapR = Math.round(gapR * kk);
}

// clamp WIN center so the trio stays inside the lane
const minWinX = leftLimit + betW2 * 0.5 + gapL + winW2 * 0.5;
const maxWinX = rightLimit - (balW2 * 0.5 + gapR + winW2 * 0.5);

const winXClamped = Math.round(Math.max(minWinX, Math.min(maxWinX, winUI.x)));
winUI.x = winXClamped;

// re-place BALANCE from the clamped win (BET is handled separately)
balanceGroup.x = Math.round(winUI.x + winW2 * 0.5 + gapR + balW2 * 0.5);

// ✅ place BET group just RIGHT of the BUY button
const BET_FROM_BUY_GAP = 70;

const betWFinal = scaledWof(betDisplayGroup);

// buy right edge (already scaled)
const buyRight = Math.round(buyBtnPixi.x + scaledWof(buyBtnPixi) * 0.5);

// candidate bet center X
let betX = Math.round(buyRight + BET_FROM_BUY_GAP + betWFinal * 0.5);

// clamp so BET stays left of WIN (so it doesn't sit on top of balance/win zone)
const BET_TO_WIN_GAP = 18;
const winLeft = Math.round(winUI.x - winW2 * 0.5);
const maxBetX = Math.round(winLeft - BET_TO_WIN_GAP - betWFinal * 0.5);

betDisplayGroup.x = Math.min(betX, maxBetX);





// ✅ place bet arrows LEFT of the bet group, vertically centered to it
const BET_CTRL_GAP = 10;


const ctrlWFinal = scaledWof(betControlsGroup);

betControlsGroup.x = Math.round(
  betDisplayGroup.x - betWFinal * 0.5 - BET_CTRL_GAP - ctrlWFinal * 0.5
);

// vertical center to betDisplayGroup
betControlsGroup.y = Math.round(betDisplayGroup.y);



  }

function tabletPortraitClampStatsToButtons() {
 const PAD_BTN_MIN = 14;        // minimum safety gap (never overlap)
const PAD_BTN_MAX = 48;        // target max “air” if we can afford it
  const GAP_MIN = 14;     // minimum gap between BET–WIN and WIN–BAL
  const BET_CTRL_GAP = 10;

  const buyBox = aabbInParent(buyBtnPixi);
  const spinBox = aabbInParent(spinBtnPixi);
  const autoBox = aabbInParent(autoBtnPixi);
  const turboBox = aabbInParent(turboBtnPixi);

// We'll choose the biggest padding we can afford, up to PAD_BTN_MAX.
const leftBtnEdge = buyBox.right;
const rightBtnEdge = Math.min(spinBox.left, autoBox.left, turboBox.left);

// First measure with MIN pad (guaranteed safe)
let leftLimit  = Math.round(leftBtnEdge + PAD_BTN_MIN);
let rightLimit = Math.round(rightBtnEdge - PAD_BTN_MIN);
let avail = Math.max(1, rightLimit - leftLimit);

// We'll later increase padding if there is spare room.


  const unionBox = (a: any, b: any) => {
    const left = Math.min(a.left, b.left);
    const right = Math.max(a.right, b.right);
    const top = Math.min(a.top, b.top);
    const bottom = Math.max(a.bottom, b.bottom);
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  };

  // Measure BET as DISPLAY + CONTROLS together (composite footprint)
  const measure = () => {
    const winBox = aabbInParent(winUI);
    const balBox = aabbInParent(balanceGroup);

    const betDispBox = aabbInParent(betDisplayGroup);
    const betCtrlBox = aabbInParent(betControlsGroup);
    const betBox = unionBox(betDispBox, betCtrlBox);

    return {
      winW: winBox.width,
      balW: balBox.width,
      betBox,
      betDispBox,
      betCtrlBox,
      need: betBox.width + winBox.width + balBox.width + GAP_MIN + GAP_MIN,
    };
  };

  // If we don’t fit, shrink stats (including bet arrows) with a floor
  let guard = 0;
  const FLOOR = 0.62;
  const STEP = 0.94;

  while (guard++ < 12) {
    const m = measure();
    if (m.need <= avail) break;

    if ((winUI.scale?.x ?? 1) <= FLOOR) break;

    applyUniformScale(winUI, STEP);
    applyUniformScale(balanceGroup, STEP);
    applyUniformScale(betDisplayGroup, STEP);
    applyUniformScale(betControlsGroup, STEP);

    centerPivot(winUI);
    centerPivot(balanceGroup);
    centerPivot(betDisplayGroup);
    centerPivot(betControlsGroup);
  }

  // ---- Place BET–WIN–BAL inside lane (BET = composite) ----
  const m0 = measure();


  // ✅ Visual tuning: use a TARGET button gap (not the maximum possible),
// so the stat row sits closer to buttons and doesn't leave dead space.
const PAD_BTN_TARGET = 18; // 🔧 try 14..28 (smaller = closer to buttons)

const PAD_BTN = Math.max(PAD_BTN_MIN, Math.min(PAD_BTN_MAX, PAD_BTN_TARGET));

// Rebuild lane using TARGET pad
leftLimit  = Math.round(leftBtnEdge + PAD_BTN);
rightLimit = Math.round(rightBtnEdge - PAD_BTN);
avail = Math.max(1, rightLimit - leftLimit);


const widthsOnly = (m0.betBox.width + m0.winW + m0.balW);
const extra = Math.max(0, avail - widthsOnly);

// ✅ Use ALL extra space by expanding the internal gaps evenly.
// This pushes BET left and BAL right (reduces "dead space" near buttons).
const gapEach = Math.floor(extra / 2);

const gapL = Math.max(GAP_MIN, gapEach);
const gapR = Math.max(GAP_MIN, extra - gapL); // consume remainder



  // We need to know how far the composite BET extends left of betDisplayGroup's center.
  // We attach controls left of display, then compute the union and clamp.
  // Start by placing WIN in a conservative clamped range using composite width.

  const minWinX = leftLimit + (m0.betBox.width * 0.5) + gapL + (m0.winW * 0.5);
  const maxWinX = rightLimit - (m0.balW * 0.5 + gapR + m0.winW * 0.5);
  winUI.x = Math.round(Math.max(minWinX, Math.min(maxWinX, winUI.x)));

  // Place BAL relative to WIN
  balanceGroup.x = Math.round(winUI.x + m0.winW * 0.5 + gapR + m0.balW * 0.5);

  // Place BET DISPLAY relative to WIN (controls attached after)
  betDisplayGroup.x = Math.round(winUI.x - m0.winW * 0.5 - gapL - (aabbInParent(betDisplayGroup).width * 0.5));
  betDisplayGroup.y = Math.round(winUI.y);

  // Attach bet controls to the left of bet display
  betControlsGroup.y = Math.round(betDisplayGroup.y);

  const betDispNow = aabbInParent(betDisplayGroup);
  const betCtrlNow = aabbInParent(betControlsGroup);
  betControlsGroup.x = Math.round(
    betDisplayGroup.x - betDispNow.width * 0.5 - BET_CTRL_GAP - betCtrlNow.width * 0.5
  );

  // ---- Final composite clamp (prevents arrows underlapping BUY) ----
  const betUnion = unionBox(aabbInParent(betDisplayGroup), aabbInParent(betControlsGroup));

  // If composite BET leaks left into BUY zone, shift the whole stat row RIGHT
  let dx = 0;
  if (betUnion.left < leftLimit) {
    dx = Math.round(leftLimit - betUnion.left);
  }

  // If after shifting right we’d exceed rightLimit, clamp back left instead
  if (dx !== 0) {
    // apply dx
    winUI.x += dx;
    balanceGroup.x += dx;
    betDisplayGroup.x += dx;
    betControlsGroup.x += dx;

    // if we pushed into right buttons, pull left by overflow
    const balNow = aabbInParent(balanceGroup);
    const overflow = Math.round(balNow.right - rightLimit);
    if (overflow > 0) {
      winUI.x -= overflow;
      balanceGroup.x -= overflow;
      betDisplayGroup.x -= overflow;
      betControlsGroup.x -= overflow;
    }
  }

  // Also ensure BALANCE never sits under turbo/auto (extra safety)
  const balFinal = aabbInParent(balanceGroup);
  const rightHazard = Math.round(rightBtnEdge - PAD_BTN);
  if (balFinal.right > rightHazard) {
    const pull = Math.round(balFinal.right - rightHazard);
    winUI.x -= pull;
    balanceGroup.x -= pull;
    betDisplayGroup.x -= pull;
    betControlsGroup.x -= pull;
  }
}


function layoutUITablet(panelW: number, targetH: number, anchorX: number) {
  // Start from desktop layout so WIN/BAL/BET remain identical
  layoutUIDesktop(panelW, targetH, anchorX);

  // Tablet portrait vs landscape
  const isPortrait = appScreenH() >= appScreenW();

  // Stable pivots for all button math
  centerPivot(buyBtnPixi);
  centerPivot(spinBtnPixi);
  centerPivot(autoBtnPixi);
  centerPivot(turboBtnPixi);

// --- Pin BUY to left edge (tablet) ---
{
  const isPortrait = appScreenH() >= appScreenW();

  // 🔧 tighter padding in TABLET PORTRAIT ONLY
  const BUY_LEFT_PAD = isPortrait ? -8 : 18; // try 6–12 for portrait

  const buyLB = buyBtnPixi.getLocalBounds();
  const buyW = (buyLB.width || 0) * (buyBtnPixi.scale?.x || 1);

  buyBtnPixi.x = Math.round(BUY_LEFT_PAD + buyW * 0.5);
}


  // -------------------------------------------------
  // ✅ TABLET PORTRAIT ONLY: make buttons smaller
  // -------------------------------------------------
  if (isPortrait) {
  // 🔧 Tablet portrait size tuning (ONLY)
  const SPIN_MUL = 0.7;        // already working
  const BUY_MUL  = 0.7;       // 🔧 try 0.55..0.75
  const MINI_MUL = 0.75;

  // Spin
  setScaleToHeight(spinBtnPixi, targetH * 1.7 * SPIN_MUL);

  // Buy (desktop base is also 1.7)
  setScaleToHeight(buyBtnPixi, targetH * 1.7 * BUY_MUL);

  // Mini buttons
  setScaleToHeight(autoBtnPixi, targetH * 0.78 * MINI_MUL);
  setScaleToHeight(turboBtnPixi, targetH * 0.9 * MINI_MUL);

  // Re-center pivots after rescale
  centerPivot(spinBtnPixi);
  centerPivot(buyBtnPixi);
  centerPivot(autoBtnPixi);
  centerPivot(turboBtnPixi);




}
// -------------------------------------------------
// ✅ TABLET LANDSCAPE ONLY: shrink SETTINGS button
// -------------------------------------------------
if (!isPortrait && isTabletLandscape(__layoutDeps)) {
  // desktop base is targetH * 0.4
  setScaleToHeight(settingsBtnPixi, targetH * 0.1); // 🔧 try 0.24–0.32
  centerPivot(settingsBtnPixi);
}

  // --- Pin SPIN to right edge (AFTER any portrait scaling) ---
  {
    const SPIN_RIGHT_PAD = 18;
    const spinLB = spinBtnPixi.getLocalBounds();
    const spinW = (spinLB.width || 0) * (spinBtnPixi.scale?.x || 1);
    spinBtnPixi.x = Math.round(panelW - SPIN_RIGHT_PAD - spinW * 0.5);
  }

  // Measure sizes AFTER final scaling (used by both branches)
  const spinLB = spinBtnPixi.getLocalBounds();
  const spinW = (spinLB.width || 0) * (spinBtnPixi.scale?.x || 1);
  const spinH = (spinLB.height || 0) * (spinBtnPixi.scale?.y || 1);

  const autoLB = autoBtnPixi.getLocalBounds();
  const turboLB = turboBtnPixi.getLocalBounds();

  const autoW = (autoLB.width || 0) * (autoBtnPixi.scale?.x || 1);
  const autoH = (autoLB.height || 0) * (autoBtnPixi.scale?.y || 1);

  const turboW = (turboLB.width || 0) * (turboBtnPixi.scale?.x || 1);
  const turboH = (turboLB.height || 0) * (turboBtnPixi.scale?.y || 1);

  if (isPortrait) {
    // ✅ TABLET PORTRAIT: mini buttons to the LEFT of SPIN (side stack)
    const GAP_X = Math.round(targetH * 0.1); // 🔧 try 0.35..0.65
    const GAP_Y = Math.round(targetH * 0.35); // 🔧 try 0.25..0.55

    const miniColW = Math.max(autoW, turboW);

    const spinLeft = Math.round(spinBtnPixi.x - spinW * 0.5);
    const miniX = Math.round(spinLeft - GAP_X - miniColW * 0.5);

    autoBtnPixi.x = miniX;
    turboBtnPixi.x = miniX;

    // center around SPIN Y
    autoBtnPixi.y = Math.round(spinBtnPixi.y - GAP_Y);
    turboBtnPixi.y = Math.round(spinBtnPixi.y + GAP_Y);
  } else {
    // ✅ TABLET LANDSCAPE: keep vertical stack ABOVE SPIN (your existing behavior)
    autoBtnPixi.x = spinBtnPixi.x;
    turboBtnPixi.x = spinBtnPixi.x;

    const spinTop = Math.round(spinBtnPixi.y - spinH * 0.5);
    const PAD = Math.round(targetH * 0.14); // 🔧 try 0.10..0.22

    autoBtnPixi.y = Math.round(spinTop - PAD - autoH * 0.5);
    const autoTop = Math.round(autoBtnPixi.y - autoH * 0.5);
    turboBtnPixi.y = Math.round(autoTop - PAD - turboH * 0.5);
  }
  // ✅ FINAL PASS (tablet portrait only): keep stats clear of final button positions
if (isPortrait) {
  tabletPortraitClampStatsToButtons();
}

}



function layoutUIMobilePortrait(panelW: number, targetH: number, anchorX: number) {
    const w = panelW;
    const h = targetH;

    // hide win in portrait
    winUI.visible = false;
    winTitleLabel.visible = false;
    winAmountLabel.visible = false;

    const MAIN_BTN_H = h * 1.60;
    const BUY_BTN_H  = h * 1.2;
    const MINI_BTN_H = h * 0.72;

    // SPIN centered
    const SPIN_Y = -1;
    const SPIN_Y_OFFSET = -h * 0.12;
   spinBtnPixi.x = Math.round(anchorX);
    spinBtnPixi.y = Math.round(h * SPIN_Y + SPIN_Y_OFFSET);
    setScaleToHeight(spinBtnPixi, MAIN_BTN_H);

    // BUY left
    const BUY_OFFSET_X = 0.34;
    buyBtnPixi.x = Math.round(w * 0.5 - w * BUY_OFFSET_X);
    buyBtnPixi.y = Math.round(h * SPIN_Y);
    setScaleToHeight(buyBtnPixi, BUY_BTN_H);

    // AUTO + TURBO right stack
    const AT_OFFSET_X = 0.32;
    const AT_GAP_Y = 0.33;
const spinX = Math.round(anchorX);
    const spinY = Math.round(h * SPIN_Y);

    autoBtnPixi.x = Math.round(spinX + w * AT_OFFSET_X);
    autoBtnPixi.y = Math.round(spinY - h * AT_GAP_Y);
    setScaleToHeight(autoBtnPixi, MINI_BTN_H);

    turboBtnPixi.x = Math.round(spinX + w * AT_OFFSET_X);
    turboBtnPixi.y = Math.round(spinY + h * AT_GAP_Y);
    setScaleToHeight(turboBtnPixi, MINI_BTN_H);

    // SETTINGS left pinned
    setScaleToHeight(settingsBtnPixi, MINI_BTN_H * 0.75);
    centerPivot(settingsBtnPixi);

    // BET group
    betGroup.scale.set(1, 1); // ✅ reset so scale doesn't accumulate between layouts
    setScaleToHeight(betAmountUI, h * 0.36);
    centerPivot(betAmountUI);

    const BET_ARROW_TO_PILL_MUL = 0.78;
    const BET_ARROWS_X_OFFSET_PX = 5;
    const BET_BTN_X   = -betAmountUI.width * BET_ARROW_TO_PILL_MUL - BET_ARROWS_X_OFFSET_PX;
    const BET_BTN_GAP = 25;
    const BET_BTN_Y_BIAS = -betAmountUI.height * 0.24;

    betAmountUI.position.set(0, 0);

    const BET_LABEL_Y_OFFSET_PX = -10;
    const BET_TITLE_Y = -betAmountUI.height * 0.6 + BET_LABEL_Y_OFFSET_PX;

    betTitleLabel.anchor.set(0.5);
    betTitleLabel.position.set(0, Math.round(BET_TITLE_Y));

    setScaleToHeight(betUpBtnPixi, h * 0.32);
    setScaleToHeight(betDownBtnPixi, h * 0.32);

    betUpBtnPixi.position.set(Math.round(BET_BTN_X), Math.round(-BET_BTN_GAP + BET_BTN_Y_BIAS));
    betDownBtnPixi.position.set(Math.round(BET_BTN_X), Math.round(+BET_BTN_GAP + BET_BTN_Y_BIAS));

    centerPivot(betGroup);

balanceGroup.scale.set(1, 1);
balanceGroup.pivot.set(0, 0);

    // BALANCE group (right pinned)
    balanceLabel.anchor.set(1, 0.5);
    balanceTitleLabel.anchor.set(1, 0.5);

    balanceTitleLabel.position.set(0, -70);
    balanceLabel.position.set(0, -45);

    // pivot to right
    {
      const b = balanceGroup.getLocalBounds();
      balanceGroup.pivot.set(b.x + b.width, b.y + b.height / 2);
    }

    const HUD_Y = Math.round(h * 0.55);

    const SETTINGS_PAD_L = 10;
    const SETTINGS_PAD_Y = -6;
    const sb = settingsBtnPixi.getLocalBounds();
    settingsBtnPixi.position.set(
      Math.round(SETTINGS_PAD_L + sb.width * 0.5),
      Math.round(HUD_Y + SETTINGS_PAD_Y)
    );

// ✅ BET pinned to the RIGHT of SETTINGS (true pixel gap)
{
  const BET_TO_SETTINGS_GAP = 20; // 🔧 try 0..20

  // Ensure pivots are stable BEFORE measuring
  centerPivot(settingsBtnPixi);
  centerPivot(betGroup);

  // Measure in the SAME parent space (panel layer)
  const setBox = aabbInParent(settingsBtnPixi);
  const betBox = aabbInParent(betGroup);

  // Move betGroup so its LEFT edge is setBox.right + gap
  const wantLeft = setBox.right + BET_TO_SETTINGS_GAP;
  const dx = wantLeft - betBox.left;

  betGroup.x = Math.round(betGroup.x + dx);
  betGroup.y = HUD_Y;
}

    const BAL_RIGHT_PAD = 5;
    balanceGroup.position.set(Math.round(w - BAL_RIGHT_PAD), Math.round(HUD_Y - (h * 0.09)));

    // keep spinner overlay aligned
    spinningBtnPixi.x = spinBtnPixi.x;
    spinningBtnPixi.y = spinBtnPixi.y;
    spinningBtnPixi.scale.set(spinBtnPixi.scale.x, spinBtnPixi.scale.y);
    spinningBtnPixi.pivot.set(spinBtnPixi.pivot.x, spinBtnPixi.pivot.y);
    // One extra pass next frame so Text metrics / bounds settle before we "lock" layout
if (!didWarmRelayout) {
  didWarmRelayout = true;
  requestAnimationFrame(() => {
    try {
      layoutUI();
    } catch {}
  });
}

  }

  // =====================
// SETTINGS — PIN TO TOP LEFT (MOBILE LANDSCAPE)
// =====================
{
  const TOP_PAD = 12;   // distance from top edge
  const LEFT_PAD = 12;  // distance from left edge

  // Settings lives in screen space, not panel space
  settingsBtnPixi.x = LEFT_PAD + settingsBtnPixi.width * 0.5;
  settingsBtnPixi.y = TOP_PAD + settingsBtnPixi.height * 0.5;
}


 function layoutUIMobileLandscape(panelW: number, targetH: number, anchorX: number) {

    const w = panelW;
    const h = targetH;

    // predictable pivots
    centerPivot(buyBtnPixi);
    centerPivot(spinBtnPixi);
    centerPivot(settingsBtnPixi);
    centerPivot(autoBtnPixi);
    centerPivot(turboBtnPixi);


const BUY_H   = h * 3;  // bigger buy
const SPIN_H  = h * 3;  // bigger spin (primary)
const MINI_H  = h * 2;  // auto / turbo / settings
const ARROW_H = h * 0.9;  // bet arrows

    setScaleToHeight(buyBtnPixi, BUY_H);
    setScaleToHeight(spinBtnPixi, SPIN_H);
    setScaleToHeight(settingsBtnPixi, MINI_H * 0.6);
    setScaleToHeight(autoBtnPixi, MINI_H);
    setScaleToHeight(turboBtnPixi, MINI_H);
    setScaleToHeight(betUpBtnPixi, ARROW_H);
    setScaleToHeight(betDownBtnPixi, ARROW_H);

    // tighten bet +/- hitboxes so they don’t overlap neighbors
    if (setTightHitArea && isMobileLandscapeUILayout(__layoutDeps)) {
      const padX = 14;
      const padY = 14;
      setTightHitArea(betUpBtnPixi, padX, padY);
      setTightHitArea(betDownBtnPixi, padX, padY);
    }

    winUI.visible = true;
    balanceGroup.visible = true;
    betDisplayGroup.visible = true;
    betControlsGroup.visible = true;
    // ✅ portrait hides these; landscape must re-enable them
winTitleLabel.visible = true;
winAmountLabel.visible = true;
// 🔧 move entire landscape UI row UP so buttons don’t clip bottom
const CY = Math.round(h * -1);
const STAT_ROW_Y_OFFSET = Math.round(h * .4); // 🔧 positive = DOWN
const STAT_TOP_Y = CY + STAT_ROW_Y_OFFSET;


const SETTINGS_Y_OFFSET = 0;
// =====================
// LANDSCAPE STAT ROW — MATCH BALANCE EXACTLY
// WIN + BET clone BALANCE sizing + baseline
// =====================


const STAT_TITLE_OFFSET_Y = -30;
const STAT_SCALE_FRAC = 1.2;

// BALANCE (reference)
layoutStatGroupTopAligned({
  group: balanceGroup,
  title: balanceTitleLabel,
  value: balanceLabel,
  targetH: h,
  topY: STAT_TOP_Y,
  titleOffsetY: STAT_TITLE_OFFSET_Y,
  scaleFrac: STAT_SCALE_FRAC,
});

// ✅ IMPORTANT: in landscape, the BET "pill" should NOT carry portrait scaling.
// The group is scaled by layoutStatGroupTopAligned; the pill must stay neutral inside it.
betAmountUI.scale.set(1);
betAmountUI.position.set(0, 0);

// WIN (same as balance)
layoutStatGroupTopAligned({
  group: winUI,
  title: winTitleLabel,
  value: winAmountLabel,
  targetH: h,
  topY: STAT_TOP_Y,
  titleOffsetY: STAT_TITLE_OFFSET_Y,
  scaleFrac: STAT_SCALE_FRAC,
});
winUI.x = Math.round(w * 0.5);

// BET (same as balance)
layoutStatGroupTopAligned({
  group: betDisplayGroup,
  title: betTitleLabel,
  value: betAmountUI,
  targetH: h,
  topY: STAT_TOP_Y,
  titleOffsetY: STAT_TITLE_OFFSET_Y,
  scaleFrac: STAT_SCALE_FRAC,
});

// ✅ Align bet arrows vertically to the BET stat group (same row)
{
  const b = betDisplayGroup.getLocalBounds();
  const sy = betDisplayGroup.scale.y || 1;

  const betCenterY = Math.round(
    betDisplayGroup.y + (b.y * sy) + (b.height * sy * 0.5)
  );

  // ✅ THIS is what prevents "drift" when switching layouts
  betControlsGroup.y = betCenterY;
}





const LEFT_PAD = 12;

// ✅ true panel edges in LOCAL space
const LEFT_EDGE_X = 0;
const RIGHT_EDGE_X = w;



// =====================
// BUY — PIN TO LEFT EDGE (MOBILE LANDSCAPE)
// =====================
const BUY_LEFT_PAD = 12; // 🔧 tweak: 12–24 feels good

const buyW = buyBtnPixi.getLocalBounds().width * (buyBtnPixi.scale.x || 1);

// panel-local coords → left edge = 0
buyBtnPixi.x = Math.round(BUY_LEFT_PAD + buyW * 0.5);
buyBtnPixi.y = CY;


    buyBtnPixi.y = CY;

    // bet arrows group
   const buyW2 = buyBtnPixi.getLocalBounds().width * (buyBtnPixi.scale.x || 1);
const controlsW = betControlsGroup.getLocalBounds().width * (betControlsGroup.scale.x || 1);



   const BET_ARROW_GAP_Y = Math.round(h * 0.5);
  const BET_ARROWS_GROUP_Y_OFFSET = 0;
   

    betUpBtnPixi.position.set(0, -BET_ARROW_GAP_Y);
    betDownBtnPixi.position.set(0, +BET_ARROW_GAP_Y);

    // ✅ center the arrows group's pivot so x/y are true center
{
  const b = betControlsGroup.getLocalBounds();
  betControlsGroup.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
}

const GAP_BET_TO_WIN = Math.round(h * 3);
const GAP_WIN_TO_BAL = Math.round(h * 5.4);

    // equal spacing around win
    const WIN_ANCHOR_X = winUI.x;
  

    const scaledW = (c: Container) => {
  const b = c.getLocalBounds();
  return (b.width || 0) * (c.scale.x || 1);
};

    const betW = scaledW(betDisplayGroup);
    const winW = scaledW(winUI);
    const balW = scaledW(balanceGroup);

    betDisplayGroup.x =
  WIN_ANCHOR_X - (winW * 0.5) - GAP_BET_TO_WIN - (betW * 0.5);
balanceGroup.x =
  WIN_ANCHOR_X + (winW * 0.5) + GAP_WIN_TO_BAL - (balW * 0.5);

    

    // arrows attached left of bet
    const CTRL_TO_BET_GAP = Math.round(h * 0.25);
    const cb = betControlsGroup.getLocalBounds();
const ctrlW = (cb.width || 0) * (betControlsGroup.scale.x || 1);

    betControlsGroup.x = Math.round(betDisplayGroup.x - (betW * 0.5) - CTRL_TO_BET_GAP - (ctrlW * 0.5));

// right side spin + stack
const RIGHT_PAD = 8;          // ✅ keeps SPIN safely inside the panel edge
const STACK_TO_SPIN_GAP = 2;  // ✅ positive gap between stack and SPIN

// ✅ right boundary for the right cluster (panel right edge in local coords)
const RIGHT_CLUSTER_EDGE_X = w;
const STACK_GAP_Y = Math.round(h * 0.8);
const SPIN_Y_OFFSET = 0;


   const spinW = spinBtnPixi.getLocalBounds().width * (spinBtnPixi.scale.x || 1);

spinBtnPixi.x = Math.round(RIGHT_CLUSTER_EDGE_X - RIGHT_PAD - spinW * 0.5);


spinBtnPixi.y = CY + SPIN_Y_OFFSET;
  

    spinningBtnPixi.x = spinBtnPixi.x;
    spinningBtnPixi.y = spinBtnPixi.y;
    spinningBtnPixi.scale.set(spinBtnPixi.scale.x, spinBtnPixi.scale.y);

   const autoW = autoBtnPixi.getLocalBounds().width * (autoBtnPixi.scale.x || 1);
const turboW = turboBtnPixi.getLocalBounds().width * (turboBtnPixi.scale.x || 1);


    const stackX = Math.round(
      spinBtnPixi.x - (spinW * 0.5) - STACK_TO_SPIN_GAP - Math.max(autoW, turboW) * 0.5
    );

   const STACK_CENTER_Y = CY + SPIN_Y_OFFSET;

    autoBtnPixi.x = stackX;
    autoBtnPixi.y = STACK_CENTER_Y - STACK_GAP_Y;

    turboBtnPixi.x = stackX;
    turboBtnPixi.y = STACK_CENTER_Y + STACK_GAP_Y;
    // ✅ keep spinning overlay perfectly locked to SPIN in landscape
spinningBtnPixi.x = spinBtnPixi.x;
spinningBtnPixi.y = spinBtnPixi.y;
spinningBtnPixi.scale.set(spinBtnPixi.scale.x, spinBtnPixi.scale.y);
spinningBtnPixi.pivot.set(spinBtnPixi.pivot.x, spinBtnPixi.pivot.y);

  }


 function layoutUI() {
  const panelW = appScreenW();
  const screenH = appScreenH();

  // ✅ use the reel-house-derived UI scale (same one passed into uiBottom)
  const uiScale = (__layoutDeps as any).uiScale ?? 1;
  const s = Math.max(0.01, uiScale);

  // LOCAL (unscaled) dimensions for laying out children inside a scaled uiBottom.layer
  const panelWLocal = panelW / s;
  // ✅ anchor X in LOCAL uiPanel space
const anchorXWorld = (__layoutDeps as any).uiAnchorX ?? (panelW * 0.5);
const anchorXLocal = Math.round(anchorXWorld / s);
  const screenHLocal = screenH / s;

  const layoutHLocal = Math.round(screenHLocal * PANEL_HEIGHT_FRAC());

const PORTRAIT_PANEL_BG_FRAC = 0.10;
const LANDSCAPE_PANEL_BG_FRAC = 0.075; // 🔧 tweak 0.06..0.09

const bgFrac =
  isMobilePortraitUILayout(__layoutDeps) ? PORTRAIT_PANEL_BG_FRAC :
  isMobileLandscapeUILayout(__layoutDeps) ? LANDSCAPE_PANEL_BG_FRAC :
  PANEL_HEIGHT_FRAC();

const bgHLocal = Math.round(screenHLocal * bgFrac);


// ✅ screen-space height (what the panel background actually draws to)
const bgH = Math.round(bgHLocal * s);

  // keep reporting the REAL onscreen bg height to main (if it uses it elsewhere)
setUiPanelH(bgH);

  uiPanel.x = 0;
  uiPanel.y = 0;

  const safeB = safeInsetBottomPx();

uiBottom.layout({
  W: panelW,
  H: screenH,
  uiH: bgHLocal,
  safeB,
  uiScale: s,
  isMobile: isMobileUILayout(__layoutDeps),
  isPortrait: isMobilePortraitUILayout(__layoutDeps),
  isLandscape: isMobileLandscapeUILayout(__layoutDeps), // ✅ NEW
});

// =====================
// PANEL BACKGROUND ALPHA (mode-specific)
// Landscape mobile: invisible panel BG
// Desktop + Portrait: semi-transparent BG
// =====================
const land = isMobileLandscapeUILayout(__layoutDeps);
const portrait = isMobilePortraitUILayout(__layoutDeps);

// If your uiBottom has a background Graphics, this is the safest:
if ((uiBottom as any).bg) {
  (uiBottom as any).bg.alpha = land ? 0 : 0.5;
} else {
  // fallback: set the whole panel container alpha, BUT keep UI elements visible
  // (If this hides your buttons/text, your bg is not separated—use the bg approach above.)
  uiPanel.alpha = land ? 1 : 1; // keep panel content visible
}


// =====================
// SETTINGS BUTTON — TOP-LEFT ON MOBILE LANDSCAPE (screen space)
// =====================
const isLand = isMobileLandscapeUILayout(__layoutDeps);

if (isLand) {
  // move settings OUT of the bottom panel so coords are screen-space
  const host = uiBottom.layer.parent as Container | null;
if (host && settingsBtnPixi.parent !== host) host.addChild(settingsBtnPixi);


  const TOP_PAD = 12;
  const LEFT_PAD = 12;

  // uiLayer is screen space, so use screen coords
  settingsBtnPixi.x = Math.round(LEFT_PAD + settingsBtnPixi.width * 0.5);
  settingsBtnPixi.y = Math.round(TOP_PAD + settingsBtnPixi.height * 0.5);
} else {
  // put settings back into the panel for desktop + portrait
  const panelLayer = uiBottom.layer;
  if (settingsBtnPixi.parent !== panelLayer) panelLayer.addChild(settingsBtnPixi);
}




  // ensure parenting before we position
  ensureBetParentingForLayout();


// --- DEBUG: show anchor line in panel local space ---
anchorGfx.clear();
if (DEBUG_UI_ANCHOR) {
  anchorGfx
    .rect(anchorXLocal - 1, 0, 2, Math.max(1, layoutHLocal))
    .fill(0xff00ff);
}




// ✅ Ensure stats live inside the panel background coordinate space BEFORE layout
const panelLayer = uiBottom.layer;
if (winUI.parent !== panelLayer) panelLayer.addChild(winUI);
if (balanceGroup.parent !== panelLayer) panelLayer.addChild(balanceGroup);
if (betDisplayGroup.parent !== panelLayer) panelLayer.addChild(betDisplayGroup);
if (betControlsGroup.parent !== panelLayer) panelLayer.addChild(betControlsGroup);
if (betGroup.parent !== panelLayer) panelLayer.addChild(betGroup);


if (isMobilePortraitUILayout(__layoutDeps)) {
  layoutUIMobilePortrait(panelWLocal, bgHLocal, anchorXLocal);
} else if (isMobileLandscapeUILayout(__layoutDeps)) {
  layoutUIMobileLandscape(panelWLocal, bgHLocal, anchorXLocal);
} else if (isTabletLike()) {
  layoutUITablet(panelWLocal, bgHLocal, anchorXLocal);
} else {
  layoutUIDesktop(panelWLocal, bgHLocal, anchorXLocal);
}





    // keep spinning overlay aligned (desktop + any mode)
    spinningBtnPixi.x = spinBtnPixi.x;
    spinningBtnPixi.y = spinBtnPixi.y;
    spinningBtnPixi.scale.set(spinBtnPixi.scale.x, spinBtnPixi.scale.y);
    spinningBtnPixi.pivot.set(spinBtnPixi.pivot.x, spinBtnPixi.pivot.y);
  }

  return { layoutUI };
}
