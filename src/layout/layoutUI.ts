// src/layout/layoutUI.ts
import type { Container, Rectangle } from "pixi.js";
import { Graphics } from "pixi.js";


import {
  isMobileUILayout,
  isMobilePortraitUILayout,
  isMobileLandscapeUILayout,
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

    uiScale: number; // ✅ NEW

    isMobile: boolean;
    isPortrait: boolean;
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

winUI.x = Math.round(anchorX);


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




    // BUTTONS (keep your existing desktop placement)
placeOnPanel(spinBtnPixi, 0.86, 0.1, panelW, targetH);
setScaleToHeight(spinBtnPixi, targetH * 1.7);

// ✅ lock spin X to the reel anchor (keep your Y logic unchanged)
const SPIN_FROM_ANCHOR_FRAC = 0.36; // ✅ positive moves right, negative moves left
spinBtnPixi.x = Math.round(anchorX + panelW * SPIN_FROM_ANCHOR_FRAC);


    placeOnPanel(autoBtnPixi, 0.78, 0.5, panelW, targetH);
    setScaleToHeight(autoBtnPixi, targetH * 0.78);

    placeOnPanel(turboBtnPixi, 0.935, 0.5, panelW, targetH);
    setScaleToHeight(turboBtnPixi, targetH * 0.9);

    const BUY_Y_NUDGE = -0.2; // negative = move up
placeOnPanel(buyBtnPixi, 0.14, 0.23 + BUY_Y_NUDGE, panelW, targetH);
    setScaleToHeight(buyBtnPixi, targetH * 1.7);

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
    setScaleToHeight(betAmountUI, h * 0.36);
    centerPivot(betAmountUI);

    const BET_ARROW_TO_PILL_MUL = 0.78;
    const BET_ARROWS_X_OFFSET_PX = 18;
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

    betGroup.position.set(Math.round(w * 0.42), HUD_Y);

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

 function layoutUIMobileLandscape(panelW: number, targetH: number, anchorX: number) {

    const w = panelW;
    const h = targetH;

    // predictable pivots
    centerPivot(buyBtnPixi);
    centerPivot(spinBtnPixi);
    centerPivot(settingsBtnPixi);
    centerPivot(autoBtnPixi);
    centerPivot(turboBtnPixi);

    centerPivot(betDisplayGroup);
    centerPivot(betControlsGroup);
    centerPivot(winUI);
    centerPivot(balanceGroup);

    const BUY_H   = h * 2.4;
    const SPIN_H  = h * 2.4;
    const MINI_H  = h * 1.5;
    const ARROW_H = h * 0.6;

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

    const CY = Math.round(h * 0.72);
    const GROUPS_Y_OFFSET = Math.round(h * -0.2);
    const LAND_GROUP_H = (h * 0.58) * 1.9;
    const SETTINGS_Y_OFFSET = Math.round(h * -0.3);

 const LEFT_PAD = 18;

// ✅ Right edge of the panel (local coords in uiPanel space)
const RIGHT_EDGE_X = panelW;

// ✅ mirrored left edge around anchorX (pairs with RIGHT_EDGE_X)
const LEFT_EDGE_X = anchorX - (RIGHT_EDGE_X - anchorX);


settingsBtnPixi.x = Math.round(LEFT_EDGE_X + LEFT_PAD + settingsBtnPixi.getLocalBounds().width * 0.5);

    settingsBtnPixi.y = CY + SETTINGS_Y_OFFSET;

    buyBtnPixi.x = Math.round(settingsBtnPixi.x + settingsBtnPixi.width * 0.75 + buyBtnPixi.width * 0.5 + 12);
    buyBtnPixi.y = CY;

    // bet arrows group
    const arrowsX = Math.round(buyBtnPixi.x + buyBtnPixi.width * 0.62 + betControlsGroup.getLocalBounds().width * 0.5 + 16);
    betControlsGroup.x = arrowsX;

    const BET_ARROW_GAP_Y = Math.round(h * 0.36);
    const BET_ARROWS_GROUP_Y_OFFSET = -10;
    betControlsGroup.y = CY + GROUPS_Y_OFFSET + BET_ARROWS_GROUP_Y_OFFSET;

    betUpBtnPixi.position.set(0, -BET_ARROW_GAP_Y);
    betDownBtnPixi.position.set(0, +BET_ARROW_GAP_Y);

    // bet display group scaling
    betDisplayGroup.y = CY + GROUPS_Y_OFFSET;
    betDisplayGroup.scale.set(1, 1);
    const betH0 = Math.max(1, betDisplayGroup.getLocalBounds().height);
    betDisplayGroup.scale.set(LAND_GROUP_H / betH0);

    const BET_GAP_PX = Math.round(h * 0.01);
    betTitleLabel.y -= Math.round(BET_GAP_PX / Math.max(0.0001, betDisplayGroup.scale.y));

    // win group scale + gap
    winUI.scale.set(1, 1);
    const winH0 = Math.max(1, winUI.getLocalBounds().height);
    winUI.scale.set(LAND_GROUP_H / winH0);
   winUI.x = Math.round(anchorX);
    winUI.y = CY + GROUPS_Y_OFFSET;

    // balance group scale
    balanceGroup.scale.set(1, 1);
    const balH0 = Math.max(1, balanceGroup.getLocalBounds().height);
    balanceGroup.scale.set(LAND_GROUP_H / balH0);
    balanceGroup.y = CY + GROUPS_Y_OFFSET;

    // equal spacing around win
    const WIN_ANCHOR_X = winUI.x;
    const GROUP_GAP_X = Math.round(h * 2.8);

    const scaledW = (c: Container) => c.getLocalBounds().width * (c.scale.x || 1);

    const betW = scaledW(betDisplayGroup);
    const winW = scaledW(winUI);
    const balW = scaledW(balanceGroup);

    betDisplayGroup.x = Math.round(WIN_ANCHOR_X - (winW * 0.5) - GROUP_GAP_X - (betW * 0.5));
    balanceGroup.x = Math.round(WIN_ANCHOR_X + (winW * 0.5) + GROUP_GAP_X + (balW * 0.5));

    // arrows attached left of bet
    const CTRL_TO_BET_GAP = Math.round(h * 0.25);
    const ctrlW = betControlsGroup.getLocalBounds().width * (betControlsGroup.scale.x || 1);
    betControlsGroup.x = Math.round(betDisplayGroup.x - (betW * 0.5) - CTRL_TO_BET_GAP - (ctrlW * 0.5));

// right side spin + stack
const RIGHT_PAD = -5;

// ✅ right boundary for the right cluster (panel right edge in local coords)
const RIGHT_CLUSTER_EDGE_X = w; // same as panelWLocal
    const STACK_TO_SPIN_GAP = -50;
    const STACK_GAP_Y = Math.round(h * 0.6);
    const SPIN_Y_OFFSET = Math.round(h * -1);

    const spinW = spinBtnPixi.getLocalBounds().width;

    spinBtnPixi.x = Math.round(RIGHT_CLUSTER_EDGE_X - RIGHT_PAD - spinW * 0.5);


    spinBtnPixi.y = CY + SPIN_Y_OFFSET;

    buyBtnPixi.y = spinBtnPixi.y;

    spinningBtnPixi.x = spinBtnPixi.x;
    spinningBtnPixi.y = spinBtnPixi.y;
    spinningBtnPixi.scale.set(spinBtnPixi.scale.x, spinBtnPixi.scale.y);

    const autoW = autoBtnPixi.getLocalBounds().width;
    const turboW = turboBtnPixi.getLocalBounds().width;

    const stackX = Math.round(
      spinBtnPixi.x - (spinW * 0.5) - STACK_TO_SPIN_GAP - Math.max(autoW, turboW) * 0.5
    );

    const STACK_CENTER_Y = CY + SPIN_Y_OFFSET;

    autoBtnPixi.x = stackX;
    autoBtnPixi.y = STACK_CENTER_Y - STACK_GAP_Y;

    turboBtnPixi.x = stackX;
    turboBtnPixi.y = STACK_CENTER_Y + STACK_GAP_Y;
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

  const PORTRAIT_PANEL_BG_FRAC = 0.1;
  const bgHLocal = Math.round(
  screenHLocal * (isMobilePortraitUILayout(__layoutDeps) ? PORTRAIT_PANEL_BG_FRAC : PANEL_HEIGHT_FRAC())
);

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
  uiH: bgHLocal, // ✅ IMPORTANT: unscaled height (UIbottom applies uiScale)
  safeB,
  uiScale: s,
  isMobile: isMobileUILayout(__layoutDeps),
  isPortrait: isMobilePortraitUILayout(__layoutDeps),
});


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

if (isMobilePortraitUILayout(__layoutDeps)) {
  layoutUIMobilePortrait(panelWLocal, layoutHLocal, anchorXLocal);
} else {
  // desktop ONLY (mobile landscape is disabled)
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
