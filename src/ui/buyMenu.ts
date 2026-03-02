 // src/ui/buyMenu.ts
import { Application, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { applyUiTextCase, localizeStyle, micro5ForLatinUiFontFamily } from "../i18n/uiTextStyle";
import { getLang } from "../i18n/i18n";




export type BuyMenuApi = {
  openBuy: () => void;
  closeBuy: () => void;
  layoutBuy: () => void;
  buyLayer: Container;
  showToast: (msg: string) => void;
  showInsufficientToast: () => void;
};

export type BuyMenuDeps = {
  app: Application;
  root: Container;
  uiLayer: Container;
  state: any;
  audio?: any;

  t?: (key: string) => string; // ✅ ADD THIS

  // texture helpers
  texUI: (frame: string) => Texture;
  texExtra: (frame: string) => Texture;

  // UI helpers
  setScaleToHeight: (c: Container, targetH: number) => void;
  makePngButton: any;
  makePngToggleButton: any;

  // format + labels you update
  fmtMoney: (v: number) => string;
  updateBetUI: () => void;
  refreshSpinAffordability: () => void;
  onBalanceUpdated?: () => void;
  

  // buttons to disable/enable while menu open
  spinBtnPixi: any;
  spinningBtnPixi: any;
  settingsBtnPixi: any;
  buyBtnPixi: any;
  autoBtnPixi: any;
  turboBtnPixi: any;
  betDownBtnPixi: any;
  betUpBtnPixi: any;

  // FS entry
  enterFreeSpins: (count: number, startMult?: number) => void;

  // constants / frames
  CLOSE_UP: string;
  CLOSE_HOVER: string;
  CLOSE_DOWN: string;

  BET_DOWN_UP: string;
  BET_DOWN_HOVER: string;
  BET_DOWN_DOWN: string;

  BET_UP_UP: string;
  BET_UP_HOVER: string;
  BET_UP_DOWN: string;

  // timing
  waitMs: (ms: number) => Promise<void>;
  animateMs: (ms: number, fn: (t01: number) => void) => Promise<void>;
  tween: (ms: number, fn: (k: number) => void, onDone?: () => void, easeFn?: (t: number) => number) => any;
  easeOutCubic: (t: number) => number;
  easeOutBack: (t: number, s?: number) => number;
  easeInCubic: (t: number) => number;
};

export function createBuyMenu(deps: BuyMenuDeps): BuyMenuApi {
  



  // ✅ Portrait arrow spacing lock (must persist across layout calls)
let portraitBetWidthLocked = false;
let portraitBetValueW = 0;



  const {
  app,
  root,
  state,
  audio,
  texExtra,
  setScaleToHeight,
  makePngButton,

    t, // ✅ ADD THIS
  fmtMoney,
  updateBetUI,
  refreshSpinAffordability,
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
  } = deps;
  
  const tt = (key: string, fallback: string) => t?.(key) ?? fallback;
const uiLabel = (key: string, fallback: string) => applyUiTextCase(tt(key, fallback));

function applyLatinMicro5ToBuyMenuText() {
  const ff = micro5ForLatinUiFontFamily(getLang());

  // Footer
  (buyFooterBalanceTitle.style as any).fontFamily = ff;
  (buyFooterBalanceValue.style as any).fontFamily = ff;
  (buyFooterBetTitle.style as any).fontFamily = ff;
  (buyFooterBetValue.style as any).fontFamily = ff;

  // Card subtitles (body)
  for (const c of buyCards as any[]) {
    const body = c?._body as Text | undefined;
    if (body) (body.style as any).fontFamily = ff;

    const price = c?._price as Text | undefined;
    if (price) (price.style as any).fontFamily = ff;

    // button text inside the buy button
    const btn = c?._buyBtn as any;
    const txt = btn?.children?.find((ch: any) => ch instanceof Text) as Text | undefined;
    if (txt) (txt.style as any).fontFamily = ff;
  }

  // Confirm popup button text (CONFIRM)
  // (buyConfirmYesBtn contains a Text child too)
  {
    const txt = buyConfirmYesBtn?.children?.find((ch: any) => ch instanceof Text) as Text | undefined;
    if (txt) (txt.style as any).fontFamily = ff;
  }

  // Confirm popup price text (you want Micro5 for Latin too)
  (buyConfirmPriceText.style as any).fontFamily = ff;

  // Toast already Micro5; leave it alone (or force it too)
  // (buyToast.style as any).fontFamily = ff;
}


    function playUiClick(vol = 0.9) {
    // ✅ also make sure audio is unlocked (harmless on desktop)
    audio?.initFromUserGesture?.();
    audio?.playSfx?.("ui_click", vol);
  }

  const IS_TOUCH =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.matchMedia?.("(pointer: coarse)")?.matches;
// Tighten hit areas on touch devices (mobile + tablets)
const IS_TOUCH_UI = IS_TOUCH; // one knob if you ever want to override

function setTightHitArea(btn: Container, w: number, h: number, padX: number, padY: number) {
  // hit rect in the button's LOCAL space
  btn.hitArea = new Rectangle(
    -padX,
    -padY,
    w + padX * 2,
    h + padY * 2
  );
}
function isTinyViewBuyLayout() {
  const flag = !!(deps as any).__layoutDeps?.IS_TINY_VIEW;

  const w = app.screen.width;
  const h = app.screen.height;

  // tiny = 400x225 and lower (either orientation)
  const longSide = Math.max(w, h);
  const shortSide = Math.min(w, h);
  const sizeTiny = longSide <= 400 && shortSide <= 225;

  return flag || sizeTiny;
}


  function isMobilePortraitBuyLayout() {
  const w = app.screen.width;
  const h = app.screen.height;
  return (w < 820 || (w / h) < 0.90) && h >= w; // matches your main.ts logic
}
function isMobileLandscapeBuyLayout() {
  const w = app.screen.width;
  const h = app.screen.height;
  const aspect = w / h;

  const mobileish = !!IS_TOUCH || w < 820 || aspect < 0.90;
  return mobileish && w > h;
}



  // optional callback you can pass from main.ts to update balanceLabel, etc.
  const onBalanceUpdated = (deps as any).onBalanceUpdated as undefined | (() => void);

  // -----------------------------
  // ROOT LAYER
  // -----------------------------
  const buyMenuLayer = new Container();
  buyMenuLayer.zIndex = 9000;
  buyMenuLayer.visible = false;
  buyMenuLayer.eventMode = "static";
  buyMenuLayer.cursor = "default";
  root.addChild(buyMenuLayer);
  root.sortChildren();

  // dimmer
  const buyBlocker = new Graphics();
  buyBlocker.eventMode = "static";
  buyBlocker.cursor = "default";
  buyMenuLayer.addChild(buyBlocker);

  // header
const buyHeader = new Text({
  text: uiLabel("ui.buyBonus", "BUY BONUS"),
style: localizeStyle({
  fontFamily: "pixeldown",
  fill: 0xffffff,
  fontSize: 38,
  fontWeight: "100",
  align: "center",
  letterSpacing: 2,
  dropShadow: true,
  dropShadowAlpha: 0.6,
  dropShadowDistance: 2,
  dropShadowBlur: 0,
  dropShadowAngle: -Math.PI / 4,
} as any),

} as any);

  buyHeader.anchor.set(0.5);
  buyMenuLayer.addChild(buyHeader);

  // divider under header (animated)
  const buyHeaderDivider = new Graphics();
  buyMenuLayer.addChild(buyHeaderDivider);

  let buyHeaderDividerProgress = 0; // 0..1
  let buyHeaderDividerAnimToken = 0;


  
  // close button
  const buyCloseBtn = makePngButton(CLOSE_UP, CLOSE_HOVER, CLOSE_DOWN, () => closeBuyMenu());
  buyCloseBtn.eventMode = "static";
  buyCloseBtn.cursor = "pointer";
  buyMenuLayer.addChild(buyCloseBtn);

// close button hit area (tighter on touch)
const BUY_CLOSE_HIT_DESKTOP = 72;
const BUY_CLOSE_HIT_TOUCH   = 40; // 🔧 try 40..52

const closeHit = IS_TOUCH_UI ? BUY_CLOSE_HIT_TOUCH : BUY_CLOSE_HIT_DESKTOP;
buyCloseBtn.hitArea = new Rectangle(-closeHit / 2, -closeHit / 2, closeHit, closeHit);


  // cards container
// -----------------------------
// CARDS SCROLL VIEWPORT (for portrait)
// -----------------------------
const buyCardsViewport = new Container();
buyCardsViewport.eventMode = "static"; // receives drag
buyCardsViewport.cursor = "default";
buyMenuLayer.addChild(buyCardsViewport);

const buyCardsMask = new Graphics();
// ✅ Mask should NEVER block input, but MUST stay renderable for Pixi masking
buyCardsMask.eventMode = "none";
buyCardsMask.cursor = "default";

// IMPORTANT: keep it "renderable" (alpha tiny) so masking works,
// but visually invisible.
buyCardsMask.visible = true;
buyCardsMask.alpha = 0.001;

buyCardsViewport.addChild(buyCardsMask);


const buyCardsRow = new Container(); // content
buyCardsViewport.addChild(buyCardsRow);

// mask the content (viewport clipping)
buyCardsRow.mask = buyCardsMask;


  // -----------------------------
  // TOAST (global-ish but kept inside menu layer)
  // -----------------------------
  const toastLayer = new Container();
  toastLayer.eventMode = "none";
  toastLayer.zIndex = 99999;
  root.addChild(toastLayer);     // ✅ global so it shows outside buyMenu
root.sortChildren();


const buyToast = new Text({
  text: "",
  style: localizeStyle({
    fontFamily: "Micro5",
    stroke: { color: 0x000000, width: 6 },
    fill: 0xffe0e0,
    fontSize: 30,
    align: "center",
    letterSpacing: 1,
  } as any),
} as any);

  buyToast.anchor.set(0.5);
  buyToast.visible = false;
  buyToast.alpha = 0;
  toastLayer.addChild(buyToast);

  let buyToastTimer: any = null;

function layoutBuyToast() {
  const W = app.screen.width;
  const H = app.screen.height;

  // ✅ tiny view only (pop-out S)
  const IS_TINY = isTinyViewBuyLayout();

  

  // ✅ HARD SAFETY: if confirm popup isn't open, it must not block clicks (prevents residual dimmer)
if (!buyConfirmLayer.visible) {
  buyConfirmLayer.visible = false;
  buyConfirmLayer.eventMode = "none";
  buyConfirmDimmer.eventMode = "none";
  buyConfirmDimmer.cursor = "default";
}


  // scale down toast ONLY in tiny view
  buyToast.scale.set(IS_TINY ? 0.5 : 1); // 🔧 try 0.70..0.85

  buyToast.x = Math.round(W / 2);
  buyToast.y = Math.round(H - 120);
}

  function showToast(msg: string) {
    layoutBuyToast();

    buyToast.text = msg;
    buyToast.visible = true;
    buyToast.alpha = 1;

    if (buyToastTimer) clearTimeout(buyToastTimer);
    buyToastTimer = setTimeout(() => {
      const start = performance.now();
      const dur = 250;
      const tick = () => {
        const t = (performance.now() - start) / dur;
        buyToast.alpha = Math.max(0, 1 - t);
        if (t < 1) requestAnimationFrame(tick);
        else buyToast.visible = false;
      };
      requestAnimationFrame(tick);
      buyToast.text = applyUiTextCase(msg);
    }, 900);
  }
  

const BUY_PORTRAIT_TOAST_MSG = tt("ui.insufficientBalance", "OOPS, NOT ENOUGH BALANCE");
const BUY_DESKTOP_TOAST_MSG  = tt("ui.insufficientBalanceOrChangeBet", "OOPS — NOT ENOUGH BALANCE or CHANGE BET AMOUNT");


function getInsufficientMsg() {
  return isMobilePortraitBuyLayout()
    ? BUY_PORTRAIT_TOAST_MSG
    : BUY_DESKTOP_TOAST_MSG;
}

function showInsufficientToast() {
  showToast(getInsufficientMsg()); // ✅ uses portrait-only wording automatically

  requestAnimationFrame(() => {
    layoutBuyToast();
    shakeBuyToast();
  });

  state.ui.auto = false;
  deps.autoBtnPixi?.setOn?.(false);
}


function shakeBuyToast() {
  if (!buyToast.visible) return;

  // ✅ Shake the TEXT itself (since buyToast holds the actual screen position)
  const x0 = buyToast.x;

  const AMP = 12;   // px (try 8..18)
  const MS  = 260;  // duration

  const t0 = performance.now();

  function tick(now: number) {
    const t = Math.min(1, (now - t0) / MS);
    const decay = 1 - (t * t * (3 - 2 * t)); // smoothstep (1 -> 0)
    const s = Math.sin(t * Math.PI * 12) * decay;

    buyToast.x = Math.round(x0 + s * AMP);

    if (t < 1) requestAnimationFrame(tick);
    else buyToast.x = x0;
  }

  requestAnimationFrame(tick);
}


  // -----------------------------
  // FOOTER (balance + bet + arrows)
  // -----------------------------
  const buyFooter = new Container();

  // ✅ Portrait HUD lock (prevents jumping when text width changes)

let portraitHudPivotSet = false;

  buyFooter.eventMode = "static";
  buyFooter.cursor = "default";
  buyMenuLayer.addChild(buyFooter);

  const buyFooterBg = new Graphics();
  buyFooter.addChild(buyFooterBg);

  const buyFooterBetBg = new Graphics(); // grey pill behind bet+arrows
  buyFooter.addChild(buyFooterBetBg);

const BUY_FOOTER_TITLE_STYLE_OBJ: any = localizeStyle({
  fontFamily: "Micro5", // placeholder
  fill: 0xb18cff,
  fontSize: 24,
  letterSpacing: 2,
} as any);
BUY_FOOTER_TITLE_STYLE_OBJ.fontFamily = micro5ForLatinUiFontFamily(getLang());
const BUY_FOOTER_TITLE_STYLE = new TextStyle(BUY_FOOTER_TITLE_STYLE_OBJ);

const BUY_FOOTER_VALUE_STYLE_OBJ: any = localizeStyle({
  fontFamily: "Micro5", // placeholder
  fill: 0xffffff,
  fontSize: 40,
  letterSpacing: 1,
  stroke: { color: 0x000000, width: 4 },
} as any);
BUY_FOOTER_VALUE_STYLE_OBJ.fontFamily = micro5ForLatinUiFontFamily(getLang());
const BUY_FOOTER_VALUE_STYLE = new TextStyle(BUY_FOOTER_VALUE_STYLE_OBJ);



 const buyFooterBalanceTitle = new Text({ text: uiLabel("ui.balance", "BALANCE"), style: BUY_FOOTER_TITLE_STYLE } as any);
  const buyFooterBalanceValue = new Text({ text: fmtMoney(state.bank.balance), style: BUY_FOOTER_VALUE_STYLE } as any);
  const buyFooterBetTitle     = new Text({ text: uiLabel("ui.bet", "BET"), style: BUY_FOOTER_TITLE_STYLE } as any);
  const buyFooterBetValue = new Text({ text: fmtMoney(state.bank.betLevels[state.bank.betIndex]), style: BUY_FOOTER_VALUE_STYLE } as any);

  buyFooter.addChild(buyFooterBalanceTitle, buyFooterBalanceValue, buyFooterBetTitle, buyFooterBetValue);

  const buyBetDownBtn = makePngButton(BET_DOWN_UP, BET_DOWN_HOVER, BET_DOWN_DOWN, () => {
  // ✅ force button back to UP so its bounds/width are stable
  (buyBetDownBtn as any).resetVisual?.();

  if (state.bank.betIndex > 0) {
    state.bank.betIndex--;
    updateBetUI();
    refreshSpinAffordability();
    refreshBuyMenuFooter();
    updateBuyPrices();

    layoutBuyMenu();
  }
});

const buyBetUpBtn = makePngButton(BET_UP_UP, BET_UP_HOVER, BET_UP_DOWN, () => {
  // ✅ force button back to UP so its bounds/width are stable
  (buyBetUpBtn as any).resetVisual?.();

  if (state.bank.betIndex < state.bank.betLevels.length - 1) {
    state.bank.betIndex++;
    updateBetUI();
    refreshSpinAffordability();
    refreshBuyMenuFooter();
    updateBuyPrices();

    layoutBuyMenu();
  }
});

  buyFooter.addChild(buyBetDownBtn, buyBetUpBtn);
  // =====================
// ✅ Tiny HUD groups (so we can scale down but keep left/right clamped)
// =====================
const tinyBalGroup = new Container();
const tinyBetGroup = new Container();
buyFooter.addChild(tinyBalGroup, tinyBetGroup);

// Move items into the groups (they were already added to buyFooter above)
tinyBalGroup.addChild(buyFooterBalanceTitle, buyFooterBalanceValue);
tinyBetGroup.addChild(buyFooterBetTitle, buyFooterBetValue, buyBetUpBtn, buyBetDownBtn);


  function refreshBuyMenuFooter() {
    buyFooterBalanceValue.text = fmtMoney(state.bank.balance);
    buyFooterBetValue.text = fmtMoney(state.bank.betLevels[state.bank.betIndex]);

    (buyBetDownBtn as any).setEnabled?.(state.bank.betIndex > 0);
    (buyBetUpBtn as any).setEnabled?.(state.bank.betIndex < state.bank.betLevels.length - 1);
  }

  // -----------------------------
  // CONFIRM POPUP
  // -----------------------------
  const buyConfirmLayer = new Container();
  buyConfirmLayer.sortableChildren = true;
  buyConfirmLayer.zIndex = 99999;
  buyConfirmLayer.visible = false;
  buyConfirmLayer.eventMode = "none";
  root.addChild(buyConfirmLayer);
  root.sortChildren();

  const buyConfirmDimmer = new Graphics();
  buyConfirmDimmer.eventMode = "static";
  buyConfirmDimmer.cursor = "default";
  buyConfirmLayer.addChild(buyConfirmDimmer);

  const buyConfirmPanel = new Graphics();
  buyConfirmLayer.addChild(buyConfirmPanel);

  const buyConfirmDivider = new Graphics();
  buyConfirmLayer.addChild(buyConfirmDivider);

  let buyConfirmDividerProgress = 1;
  let buyConfirmDividerAnimToken = 0;

  const buyConfirmTitleText = new Text({
  text: "",
  style: localizeStyle({
    fontFamily: "pixeldown",
    fill: 0xffffff,
    fontSize: 38,
    fontWeight: "100",
    align: "center",
    letterSpacing: 2,
    dropShadow: true,
    dropShadowAlpha: 0.6,
    dropShadowDistance: 2,
    dropShadowBlur: 0,
    dropShadowAngle: -Math.PI / 4,
  } as any),
} as any);

  buyConfirmTitleText.anchor.set(0.5);
  buyConfirmLayer.addChild(buyConfirmTitleText);

  const buyConfirmPriceText = new Text({
    text: "",
    style: localizeStyle({
  fontFamily: "Micro5",
  fill: 0xffd36a,
  fontSize: 42,
  fontWeight: "100",
  align: "center",
  letterSpacing: 2,
  dropShadow: true,
  dropShadowAlpha: 0.65,
  dropShadowDistance: 2,
  dropShadowBlur: 0,
  dropShadowAngle: -Math.PI / 4,
} as any),
  } as any);
  buyConfirmPriceText.anchor.set(0.5);
  buyConfirmLayer.addChild(buyConfirmPriceText);

function makeCardButton(
  label: string,
  onTap: () => void,
  sfxKey: "ui_click" | "confirm" = "ui_click",
  vol = 0.9
) {
  const btn = new Container();

  const bg = new Graphics();
  const btnTextStyle: any = localizeStyle({
  fontFamily: "Micro5", // placeholder
  fill: 0xffffff,
  fontSize: 45,
  fontWeight: "100",
  letterSpacing: 2,
  align: "center",
  stroke: { color: 0x000000, width: 4 },
} as any);

// ✅ override font AFTER localizeStyle
btnTextStyle.fontFamily = micro5ForLatinUiFontFamily(getLang());

const txt = new Text({
  text: applyUiTextCase(label),
  style: btnTextStyle,
} as any);

  txt.anchor.set(0.5);
  txt.position.set(110, 22);

  btn.addChild(bg, txt);

  function drawGreen() {
    bg.clear().rect(0, 0, 220, 56).fill({ color: 0x18c964 });
  }
  function drawRed() {
    bg.clear().rect(0, 0, 220, 56).fill({ color: 0xd32f2f });
    (txt.style as any).fill = 0xffffff;
  }



  drawGreen();

// ✅ Explicit hit area (prevents oversized bounds on touch/tablets)
const BTN_W = 220;
const BTN_H = 56;
const padX = IS_TOUCH_UI ? 2 : 10;
const padY = IS_TOUCH_UI ? 2 : 8;
setTightHitArea(btn, BTN_W, BTN_H, padX, padY);


  btn.eventMode = "static";
  btn.cursor = "pointer";

  btn.on("pointertap", (e: any) => {
    e?.stopPropagation?.();
    audio?.initFromUserGesture?.();
    audio?.playSfx?.(sfxKey as any, vol);
    onTap();
  });

  (btn as any).setLabel = (s: string) => (txt.text = applyUiTextCase(s));
   (txt.style as any).fontFamily = micro5ForLatinUiFontFamily(getLang());
  (btn as any).setRed = () => drawRed();
  (btn as any).setGreen = () => drawGreen();

  return btn as any;
}


  let buyConfirmOnYes: null | (() => void) = null;
 const buyConfirmYesBtn = makeCardButton(
   tt("ui.btnConfirm", "CONFIRM"),
  () => {
    const cb = buyConfirmOnYes;
    closeBuyConfirm();
    cb?.();
  },
  "ui_click" // ✅ CONFIRM SFX
  
);


  buyConfirmLayer.addChild(buyConfirmYesBtn);

  // confirm nudge loop
  let confirmBounceToken = 0;
  function startConfirmBtnNudge() {
    confirmBounceToken++;
    const token = confirmBounceToken;

    const BOUNCE_Y = 6;
    const UP_MS = 140;
    const DOWN_MS = 220;
    const PAUSE_MS = 1800;

    const getBaseY = () => (buyConfirmYesBtn as any)._baseY ?? buyConfirmYesBtn.y;

    (async () => {
      while (token === confirmBounceToken && buyConfirmLayer.visible) {
        const baseY = getBaseY();
        buyConfirmYesBtn.y = baseY;

        await animateMs(UP_MS, (t) => {
          if (token !== confirmBounceToken) return;
          const e = easeOutBack(t, 1.05);
          buyConfirmYesBtn.y = baseY - BOUNCE_Y * e;
        });

        await animateMs(DOWN_MS, (t) => {
          if (token !== confirmBounceToken) return;
          const e = t * t * (3 - 2 * t);
          buyConfirmYesBtn.y = (baseY - BOUNCE_Y) + (BOUNCE_Y * e);
        });

        buyConfirmYesBtn.y = baseY;
        await waitMs(PAUSE_MS);
      }
    })();
  }

  function stopConfirmBtnNudge() {
    confirmBounceToken++;
    const baseY = (buyConfirmYesBtn as any)._baseY ?? buyConfirmYesBtn.y;
    buyConfirmYesBtn.y = baseY;
  }

  function layoutBuyConfirm() {
    const W = app.screen.width;
    const H = app.screen.height;

    buyConfirmDimmer.clear().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.72 });

    // ✅ make the dimmer reliably clickable everywhere (closes on outside tap)
buyConfirmDimmer.eventMode = "static";
buyConfirmDimmer.cursor = "default";
buyConfirmDimmer.hitArea = new Rectangle(0, 0, W, H);

// ✅ ensure the confirm layer is interactive when visible
buyConfirmLayer.eventMode = "static";


    const pw = Math.min(460, W * 0.72);
    const ph = 210;

    const px = (W - pw) / 2;
    const py = (H - ph) / 2;

    buyConfirmPanel.clear()
      .rect(px, py, pw, ph)
      .fill(0x2b2b2b)
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });
// ✅ clicks on the panel itself should NOT close the popup
buyConfirmPanel.eventMode = "static";
buyConfirmPanel.cursor = "default";
buyConfirmPanel.hitArea = new Rectangle(px, py, pw, ph);
buyConfirmPanel.removeAllListeners?.("pointertap");
buyConfirmPanel.on("pointertap", (e: any) => e?.stopPropagation?.());

    const cx = Math.round(W / 2);
    const TITLE_PRICE_GAP = 50;

    buyConfirmTitleText.position.set(cx, Math.round(H / 2 - 64));
    buyConfirmPriceText.position.set(cx, Math.round(buyConfirmTitleText.y + TITLE_PRICE_GAP));

    const DIVIDER_W = Math.min(260, pw * 0.65);
    const DIVIDER_Y = Math.round((buyConfirmTitleText.y + buyConfirmPriceText.y) * 0.5);

    const half = (DIVIDER_W * buyConfirmDividerProgress) * 0.5;
    buyConfirmDivider.clear();
    buyConfirmDivider.moveTo(W / 2 - half, DIVIDER_Y);
    buyConfirmDivider.lineTo(W / 2 + half, DIVIDER_Y);
    buyConfirmDivider.stroke({ width: 3, color: 0xffffff, alpha: 0.85 } as any);

    buyConfirmYesBtn.position.set(W / 2 - 110, H / 2 + 20);
    (buyConfirmYesBtn as any)._baseY = buyConfirmYesBtn.y;

    root.sortChildren();
  }

  function openBuyConfirm(title: string, price: number, onYes: () => void) {
    buyConfirmOnYes = onYes;

    buyConfirmTitleText.text = applyUiTextCase(title);
    buyConfirmPriceText.text = fmtMoney(price);

    layoutBuyConfirm();

    // animate divider
    buyConfirmDividerProgress = 0;
    buyConfirmDividerAnimToken++;
    const token = buyConfirmDividerAnimToken;

    const DIVIDER_IN_MS = 400;
    const t0 = performance.now();

    function tick(now: number) {
      if (token !== buyConfirmDividerAnimToken) return;
      const t = Math.min(1, (now - t0) / DIVIDER_IN_MS);
      buyConfirmDividerProgress = Math.min(1, easeOutCubic(t));
      layoutBuyConfirm();
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    buyConfirmLayer.visible = true;
    buyConfirmLayer.eventMode = "static";
    stopConfirmBtnNudge();
    startConfirmBtnNudge();
  }

  function closeBuyConfirm() {
    stopConfirmBtnNudge();
    buyConfirmLayer.visible = false;
    buyConfirmLayer.eventMode = "none";
    buyConfirmOnYes = null;
  }

  buyConfirmDimmer.on("pointertap", () => closeBuyConfirm());

  // -----------------------------
  // BUY CARD BUTTON (green/red)
  // -----------------------------
  function makeBuyCardButton(label: string, onTap: () => void) {
    const btn = new Container();
    const bg = new Graphics();
    const btnTextStyle: any = localizeStyle({
  fontFamily: "Micro5", // placeholder
  fill: 0xffffff,
  fontSize: 45,
  fontWeight: "100",
  letterSpacing: 2,
  align: "center",
  stroke: { color: 0x000000, width: 4 },
} as any);

// ✅ override font AFTER localizeStyle
btnTextStyle.fontFamily = micro5ForLatinUiFontFamily(getLang());

const txt = new Text({
  text: applyUiTextCase(label),
  style: btnTextStyle,
} as any);
    txt.anchor.set(0.5);
    txt.position.set(110, 22);

    btn.addChild(bg, txt);

    function drawGreen() { bg.clear().rect(0, 0, 220, 56).fill({ color: 0x18c964 }); }
    function drawRed()   { bg.clear().rect(0, 0, 220, 56).fill({ color: 0xd32f2f }); }

    drawGreen();

    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointertap", (e: any) => {
  e?.stopPropagation?.();
  playUiClick(0.9);
  onTap();
});

    (btn as any).setLabel = (s: string) => (txt.text = applyUiTextCase(s));
 (txt.style as any).fontFamily = micro5ForLatinUiFontFamily(getLang());
    (btn as any).setRed = () => drawRed();
    (btn as any).setGreen = () => drawGreen();

    return btn as any;
  }

  // -----------------------------
  // BUY CARDS
  // -----------------------------
  type BuyCardSpec = {
    title: string;
    body: string;
    priceMult: number;
    startMult: number;
    fsCount: number;
    artFrame: string;
  };

const buyCardSpecs: BuyCardSpec[] = [
  {
    title: tt("ui.buyCard.superTitle", "SUPER"),
    body:  tt("ui.buyCard.superBody",  "STRONG FEATURE\nSTARTS AT 3× MULTIPLIER"),
    priceMult: 89, startMult: 3, fsCount: 10, artFrame: "buy_art_super.png"
  },
  {
    title: tt("ui.buyCard.ultraTitle", "ULTRA"),
    body:  tt("ui.buyCard.ultraBody",  "MAXIMUM INTENSITY\nSTARTS AT 5× MULTIPLIER"),
    priceMult: 100, startMult: 5, fsCount: 10, artFrame: "buy_art_ultra.png"
  },
];




  const buyCards: Container[] = [];

  function getCurrentBet(): number {
    const bet = state.bank.betLevels[state.bank.betIndex];
    return typeof bet === "number" ? bet : Number(bet);
  }

  function makeBuyCard(spec: BuyCardSpec) {
    const card = new Container();
    card.eventMode = "static";
    card.cursor = "default";

    const bg = new Graphics();
    card.addChild(bg);

    const title = new Text({
  text: applyUiTextCase(spec.title),
  style: localizeStyle({
    fontFamily: "pixeldown",
    fill: 0xffd36a,
    fontSize: 31,
    align: "center",
    letterSpacing: 1,
    stroke: { color: 0x000000, width: 5 },
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowAlpha: 0.85,
    dropShadowDistance: 3,
    dropShadowBlur: 0,
    dropShadowAngle: -Math.PI / 4,
  } as any),
} as any);

    title.anchor.set(0.5, 0);
    card.addChild(title);

    const art = new Sprite(texExtra(spec.artFrame));
    art.anchor.set(0.5);
    art.roundPixels = true;
    art.eventMode = "none";
    card.addChild(art);
    (card as any)._art = art;

 const bodyStyle: any = localizeStyle({
  // keep styling same
  fontFamily: "Micro5", // placeholder
  fill: 0xffffff,
  fontSize: 30,
  lineHeight: 24,
  align: "center",
  letterSpacing: 1,
} as any);

// ✅ override font AFTER localizeStyle
bodyStyle.fontFamily = micro5ForLatinUiFontFamily(getLang());

const body = new Text({
  text: spec.body,
  style: bodyStyle,
} as any);

    body.anchor.set(0.5, 0);
    card.addChild(body);

    const price = new Text({
  text: "",
  style: localizeStyle({
    fontFamily: "Micro5",
    fill: 0xffffff,
    fontSize: 37,
    align: "center",
    letterSpacing: 2,
    stroke: { color: 0x000000, width: 5 },
    dropShadow: false,
  } as any),
} as any);
    price.anchor.set(0.5, 0);
    card.addChild(price);

    const buyBtn = makeBuyCardButton(tt("ui.btnBuy", "BUY"), () => {
      const cost = getCurrentBet() * spec.priceMult;

    if (state.bank.balance < cost) {
      // ✅ show toast + shake
      showInsufficientToast();
      shakeBuyToast(); // add this helper below
      return;
    }
    openBuyConfirm(spec.title, cost, () => {
      // ✅ Any Stake wallet session (including demo) is server-debited on /wallet/play
      const hasRgsSession = !!(window as any).rgsClient?.getConfig?.()?.sessionID;

      if (!hasRgsSession) {
        state.bank.balance -= cost;
      }

      deps.onBalanceUpdated?.();
      refreshSpinAffordability();
      refreshBuyMenuFooter();
      onBalanceUpdated?.();

      if (!hasRgsSession) {
        closeBuyMenu();
        // ✅ DEV / OFFLINE: immediately enter free spins
        enterFreeSpins(spec.fsCount, spec.startMult);
        return;
      }

      // ✅ RGS (including demo): set buy choice BEFORE closing the menu
      // (prevents any UI/state cleanup from clearing it before doSpin reads it)
      state.ui.buyChoice = (spec.priceMult === 89) ? "SUPER" : "ULTRA";
      console.log("[BUY] set state.ui.buyChoice", state.ui.buyChoice, "priceMult", spec.priceMult);

      closeBuyMenu();

      // ✅ Auto-spin once
      requestAnimationFrame(() => {
        deps.spinBtnPixi?.emit?.("pointertap", { stopPropagation() {} });
      });
    });


    });
    card.addChild(buyBtn);
buyBtn.on("pointerdown", (e: any) => e.stopPropagation?.());
buyBtn.on("pointertap", (e: any) => e.stopPropagation?.());
    // hover lift
    const HOVER_LIFT_Y = 12;
    const HOVER_MS_IN = 120;
    const HOVER_MS_OUT = 160;
    let hoverToken = 0;

    (card as any)._baseY = 0;

    function hoverTo(yTarget: number, ms: number) {
      hoverToken++;
      const token = hoverToken;
      const y0 = card.y;

      tween(ms, (k) => {
        if (token !== hoverToken) return;
        const e = k * k * (3 - 2 * k);
        card.y = y0 + (yTarget - y0) * e;
      });
    }

    card.on("pointerover", () => {
      
  // 🔊 hover sfx (throttled so it won’t spam)
  audio?.initFromUserGesture?.();
  audio?.playSfxThrottled?.("multiplier", 120, 0.35, 1.0) ?? audio?.playSfx?.("multiplier", 0.35, 1.0);

  const baseY = (card as any)._baseY ?? card.y;
  hoverTo(baseY - HOVER_LIFT_Y, HOVER_MS_IN);

     // delayed toast if insufficient
if (!(card as any).canAfford) {
  setTimeout(() => {
    if (!buyMenuLayer.visible) return;
    if ((card as any).canAfford) return; // re-check after delay

showToast(getInsufficientMsg());

    // ✅ shake after it becomes visible + positioned
    requestAnimationFrame(() => {
      layoutBuyToast();
      shakeBuyToast();
    });
  }, 250);
}

    });

    card.on("pointerout", () => {
      const baseY = (card as any)._baseY ?? card.y;
      hoverTo(baseY, HOVER_MS_OUT);
    });

    (card as any)._bg = bg;
    (card as any)._title = title;
    (card as any)._body = body;
    (card as any)._price = price;
    (card as any)._buyBtn = buyBtn;
    (card as any).canAfford = false;

    return card;
  }

  for (const spec of buyCardSpecs) {
    const c = makeBuyCard(spec);
    buyCardsRow.addChild(c);
    buyCards.push(c);
  }

  // -----------------------------
  // PRICE / BUTTON STATE UPDATE
  // -----------------------------
  function updateBuyPrices() {
    for (let i = 0; i < buyCards.length; i++) {
      const spec = buyCardSpecs[i];
      const cost = getCurrentBet() * spec.priceMult;

      const card = buyCards[i];
      const priceText = (card as any)._price as Text;
      const buyBtn = (card as any)._buyBtn as any;

      const canAfford = state.bank.balance >= cost;
      (card as any).canAfford = canAfford;

      priceText.text = `${fmtMoney(cost)}  (${spec.priceMult}x)`;

      if (canAfford) {
        buyBtn.setGreen();
        buyBtn.setLabel(tt("ui.btnBuy", "BUY"));
      } else {
        buyBtn.setRed();
        buyBtn.setLabel(tt("ui.btnTopUp", "TOP UP"));

      }

      // dim non-button children only
      for (const child of card.children) {
        if (child === buyBtn) child.alpha = 1.0;
        else child.alpha = canAfford ? 1.0 : 0.45;
      }
    }
  }
let cardsScrollY = 0;           // current scroll offset (px)
let cardsScrollMax = 0;         // max scroll amount (px)
let draggingCards = false;
let dragStartY = 0;
let scrollStartY = 0;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// drag to scroll (portrait only)
buyCardsViewport.on("pointerdown", (e: any) => {
  if (!isMobilePortraitBuyLayout()) return;
  draggingCards = true;
  dragStartY = e.global.y;
  scrollStartY = cardsScrollY;
  e.stopPropagation?.();
});

buyCardsViewport.on("pointerup", () => { draggingCards = false; });
buyCardsViewport.on("pointerupoutside", () => { draggingCards = false; });

buyCardsViewport.on("pointermove", (e: any) => {
  if (!isMobilePortraitBuyLayout()) return;
  if (!draggingCards) return;

  const dy = e.global.y - dragStartY;
  cardsScrollY = clamp(scrollStartY + dy, -cardsScrollMax, 0);
  buyCardsRow.y = Math.round(cardsScrollY);
  e.stopPropagation?.();
});

  // -----------------------------
  // ULTRA button nudge
  // -----------------------------
  let ultraBounceToken = 0;

  function startUltraBuyBtnNudge() {
    ultraBounceToken++;
    const token = ultraBounceToken;

    const ultraCard = buyCards[3];
    if (!ultraCard) return;

    const btn = (ultraCard as any)._buyBtn as any;
    if (!btn) return;

    const BOUNCE_Y = 6;
    const UP_MS = 140;
    const DOWN_MS = 220;
    const PAUSE_MS = 1600;

    const getBaseY = () => (btn as any)._baseY ?? btn.y;

    (async () => {
      while (token === ultraBounceToken && buyMenuLayer.visible) {
        if (buyConfirmLayer.visible) {
          await waitMs(120);
          continue;
        }

        const baseY = getBaseY();
        btn.y = baseY;

        await animateMs(UP_MS, (t) => {
          if (token !== ultraBounceToken) return;
          const e = easeOutBack(t, 1.05);
          btn.y = baseY - BOUNCE_Y * e;
        });

        await animateMs(DOWN_MS, (t) => {
          if (token !== ultraBounceToken) return;
          const e = t * t * (3 - 2 * t);
          btn.y = (baseY - BOUNCE_Y) + (BOUNCE_Y * e);
        });

        btn.y = baseY;
        await waitMs(PAUSE_MS);
      }

      const baseY = getBaseY();
      btn.y = baseY;
    })();
  }

  function stopUltraBuyBtnNudge() {
    ultraBounceToken++;
    const ultraCard = buyCards[3];
    const btn = ultraCard ? ((ultraCard as any)._buyBtn as any) : null;
    if (btn) btn.y = (btn as any)._baseY ?? btn.y;
  }

  // -----------------------------
  // LAYOUT
  // -----------------------------
  function layoutBuyMenu() {

  const W = app.screen.width;
  const H = app.screen.height;
  const IS_TINY = isTinyViewBuyLayout();

  // ✅ Buy menu: remove the footer HUD background pill in ALL views
buyFooterBg.clear();
buyFooterBg.visible = false;

// (safety) if you ever draw this one too, keep it off
buyFooterBetBg.clear();
buyFooterBetBg.visible = false;

  // ✅ HARD RESET (prevents drift when switching layouts/sizes)
// NOTE: reset pivots/positions, but DO NOT force scale=1 on containers
buyFooter.scale.set(1);
buyFooter.pivot.set(0, 0);
buyFooter.position.set(0, 0);

buyCardsRow.pivot.set(0, 0);
buyCardsRow.position.set(0, 0);

buyCardsViewport.pivot.set(0, 0);
buyCardsViewport.position.set(0, 0);

tinyBalGroup.scale.set(1);
tinyBalGroup.pivot.set(0, 0);
tinyBalGroup.position.set(0, 0);

tinyBetGroup.scale.set(1);
tinyBetGroup.pivot.set(0, 0);
tinyBetGroup.position.set(0, 0);

// ✅ reset cards themselves (safe)
for (const c of buyCards) {
  c.scale.set(1);
  c.pivot.set(0, 0);
  c.skew?.set?.(0, 0);
  c.rotation = 0;
  (c as any)._baseY = 0;
}

  // ✅ Tiny view: remove title + divider
  buyHeader.visible = !IS_TINY;
  buyHeaderDivider.visible = !IS_TINY;
const TINY_HUD_SCALE = 1;              // ✅ keep footer unscaled so it can hit screen edges
const TINY_FONT_MUL  = IS_TINY ? 0.72 : 1;

// ✅ Tiny: shrink bet/balance text itself (independent of container scale)
(buyFooterBalanceTitle.style as any).fontSize = Math.round(24 * TINY_FONT_MUL);
(buyFooterBetTitle.style as any).fontSize     = Math.round(24 * TINY_FONT_MUL);

(buyFooterBalanceValue.style as any).fontSize = Math.round(40 * TINY_FONT_MUL);
(buyFooterBetValue.style as any).fontSize     = Math.round(40 * TINY_FONT_MUL);


    // dimmer
    buyBlocker.clear();
    buyBlocker.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.85 });

    // header
const HEADER_Y_FRAC_DESKTOP = 0.27;
const HEADER_Y_FRAC_LAND_MOBILE = 0.07;

// ✅ portrait-only: move header up
const HEADER_Y_FRAC_PORTRAIT_MOBILE = 0.11; // smaller = higher (try 0.09..0.14)

const headerYFrac = isMobilePortraitBuyLayout()
  ? HEADER_Y_FRAC_PORTRAIT_MOBILE
  : (isMobileLandscapeBuyLayout() ? HEADER_Y_FRAC_LAND_MOBILE : HEADER_Y_FRAC_DESKTOP);

buyHeader.x = Math.round(W / 2);
buyHeader.y = Math.round(H * headerYFrac);


      // divider (draw AFTER we potentially move the header)
    const drawBuyHeaderDivider = () => {
      const DIVIDER_W = Math.min(340, W * 0.55);
      const DIVIDER_Y = Math.round(buyHeader.y + (isMobileLandscapeBuyLayout() ? 22 : 34));


      const half = (DIVIDER_W * buyHeaderDividerProgress) * 0.5;

      buyHeaderDivider.clear();
      buyHeaderDivider.moveTo(Math.round(W / 2 - half), DIVIDER_Y);
      buyHeaderDivider.lineTo(Math.round(W / 2 + half), DIVIDER_Y);
      buyHeaderDivider.stroke({ width: 3, color: 0xffffff, alpha: 0.85 } as any);
    };


    // close button
    const closePad = 26;
    buyCloseBtn.x = Math.round(W - closePad);
    buyCloseBtn.y = Math.round(closePad);
    setScaleToHeight(buyCloseBtn, H * 0.045);



    // -----------------------------
// DESKTOP / LANDSCAPE: turn OFF viewport mask (it clips the cards to nothing)
// -----------------------------
if (!isMobilePortraitBuyLayout()) {
  // ✅ Desktop: viewport stays visible because it CONTAINS the row
  buyCardsViewport.visible = true;
buyCardsViewport.eventMode = "passive"; // ✅ allows children (buttons) to work

  buyCardsViewport.cursor = "default";

  // ✅ treat viewport as a plain container (no clipping)
  buyCardsViewport.x = 0;
  buyCardsViewport.y = 0;

  // ✅ remove the mask so cards render
  buyCardsRow.mask = null;

  buyCardsMask.clear(); // ✅ make sure no old mask geometry lingers


  // ✅ reset any portrait scroll offset so row isn't sitting offscreen
  cardsScrollY = 0;
  buyCardsRow.y = 0; // ✅ add this


  buyCardsRow.visible = true;
  buyCardsRow.alpha = 1;
  // ✅ DESKTOP: restore proper card sizing + spacing
const DESKTOP_CARD_W = 320; // revert (tweak 280..360)
const DESKTOP_CARD_H = 420; // revert (tweak 360..460)
const DESKTOP_GAP = 22;
const totalW = buyCards.length * DESKTOP_CARD_W + (buyCards.length - 1) * DESKTOP_GAP;
const baseScale = Math.min(1, (W * 0.92) / totalW);

// ✅ caps per layout
const LAND_CAP = 0.49; // 🔧 try 0.62..0.80
const TINY_CAP = 0.4; // 🔧 try 0.45..0.62

const rowScale =
  IS_TINY ? Math.min(baseScale, TINY_CAP) :
  isMobileLandscapeBuyLayout() ? Math.min(baseScale, LAND_CAP) :
  baseScale;




const BUY_CARDS_LANDSCAPE_Y_OFFSET = -30; // 🔧 negative = move up


buyCardsRow.scale.set(rowScale);
buyCardsRow.x = Math.round(W / 2);
buyCardsRow.y = Math.round(H * 0.55) + (isMobileLandscapeBuyLayout() ? BUY_CARDS_LANDSCAPE_Y_OFFSET : 0);

// ✅ MOBILE LANDSCAPE ONLY: anchor title above cards (does not affect desktop)
if (isMobileLandscapeBuyLayout()) {
  const cardsTopY = buyCardsRow.y - (DESKTOP_CARD_H * rowScale) * 0.5;

  const LAND_HEADER_TO_CARDS_GAP = 18; // 🔧 try 14..26 (smaller = closer to cards)
  const targetHeaderY = cardsTopY - LAND_HEADER_TO_CARDS_GAP - (buyHeader.height * 0.5);

  const MIN_Y = 44; // safety clamp
  buyHeader.y = Math.round(Math.max(MIN_Y, targetHeaderY));
}

// ✅ DESKTOP ONLY (no touch devices): keep title + divider always above cards
if (!isMobileLandscapeBuyLayout() && !IS_TOUCH_UI) {
  const cardsTopY = buyCardsRow.y - (DESKTOP_CARD_H * rowScale) * 0.5;

  const DESKTOP_HEADER_TO_CARDS_GAP = 40; // 🔧 try 18..40
  const targetHeaderY =
    cardsTopY - DESKTOP_HEADER_TO_CARDS_GAP - (buyHeader.height * 0.5);

  // keep a reasonable top clamp so it never goes into the close button area
  const MIN_Y = 64;
  buyHeader.y = Math.round(Math.max(MIN_Y, targetHeaderY));
}


// draw divider after header settles
if (!IS_TINY) drawBuyHeaderDivider();
else buyHeaderDivider.clear();



// lay cards horizontally (desktop)
for (let i = 0; i < buyCards.length; i++) {
  const c = buyCards[i];
  const x0 = -totalW / 2 + DESKTOP_CARD_W / 2 + i * (DESKTOP_CARD_W + DESKTOP_GAP);
  c.x = x0;
  c.y = 0;
  (c as any)._baseY = c.y;

  const bg = (c as any)._bg as Graphics;
  bg.clear()
    .rect(-DESKTOP_CARD_W / 2, -DESKTOP_CARD_H / 2, DESKTOP_CARD_W, DESKTOP_CARD_H)
    .fill(0x2b2b2b)
    .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });

  const title = (c as any)._title as Text;
  const body = (c as any)._body as Text;
  const price = (c as any)._price as Text;
  const art = (c as any)._art as Sprite;
  const buyBtn = (c as any)._buyBtn as any;

  title.x = 0;
  title.y = -DESKTOP_CARD_H / 2 + 26;

  art.x = 0;
  art.y = -DESKTOP_CARD_H / 2 + 155;

  // desktop art size (revert)
  const ART_TARGET_W = 160; // tweak 140..190
  const tw = Math.max(1, art.texture.width);
  art.scale.set(ART_TARGET_W / tw);

  body.x = 0;
  body.y = -DESKTOP_CARD_H / 2 + 240;

  price.x = 0;
  price.y = DESKTOP_CARD_H / 2 - 120;

  buyBtn.x = -110;
  buyBtn.y = DESKTOP_CARD_H / 2 - 70;
  (buyBtn as any)._baseY = buyBtn.y;
}

}


    // -----------------------------
// CARDS LAYOUT (portrait = vertical stack)
// -----------------------------
if (!IS_TINY && isMobilePortraitBuyLayout()) {
    // ✅ PORTRAIT HARD RESET: cards must NOT inherit scale from desktop/landscape/tiny
  for (const c of buyCards) {
    c.scale.set(1);

    const art = (c as any)._art as Sprite | undefined;
    if (art) art.scale.set(1); // important: desktop branch scales art explicitly

    const bg = (c as any)._bg as Graphics | undefined;
    if (bg) bg.scale.set(1);
  }
  // ✅ PORTRAIT: row must be unscaled (desktop/landscape may leave a rowScale behind)
  buyCardsRow.scale.set(1);
  buyCardsRow.pivot.set(0, 0);
  buyFooter.visible = true;
  // portrait uses the scroll viewport + mask
buyCardsViewport.visible = true;
buyCardsViewport.eventMode = "static";
buyCardsRow.mask = buyCardsMask;

// ----- PORTRAIT TOP HUD: BET + BALANCE (centered) -----
buyFooter.sortableChildren = true;

// anchors
buyFooterBalanceTitle.anchor.set(0.5);
buyFooterBalanceValue.anchor.set(0.5);
buyFooterBetTitle.anchor.set(0.5);
buyFooterBetValue.anchor.set(0.5);


// scale the arrows a bit for mobile
setScaleToHeight(buyBetUpBtn, 30);
setScaleToHeight(buyBetDownBtn, 30);

// TUNING
const HUD_BOTTOM_PAD = 22;              // 👈 distance from bottom edge
let HUD_H = 0;                          // ✅ will be filled after scaling block    // 👈 distance from bottom edge
const GAP_X = 18;                       // spacing between items
const COL_GAP_X = 54;                   // spacing between BET column and BALANCE column





// Measure widths (after any text updates)
const balValW = buyFooterBalanceValue.width;
// ✅ make sure we measure the UP state (trimmed frames differ per state)
(buyBetUpBtn as any).resetVisual?.();
(buyBetDownBtn as any).resetVisual?.();

// ✅ use btnWidth() if your makePngButton exposes it (yours does), fallback to bounds
const upW = (buyBetUpBtn as any).btnWidth?.() ?? buyBetUpBtn.getLocalBounds().width;
const dnW = (buyBetDownBtn as any).btnWidth?.() ?? buyBetDownBtn.getLocalBounds().width;

const btnW = Math.max(upW, dnW);


// ✅ PORTRAIT: lock the bet-value width so arrows don't shift when digits change
if (!portraitBetWidthLocked) {
  // choose a "widest" bet string for your game
  // safest: last bet level
  const maxBet = state.bank.betLevels[state.bank.betLevels.length - 1] ?? 0;
  const sample = fmtMoney(Number(maxBet)); // e.g. "$200.00"

  const old = buyFooterBetValue.text;
  buyFooterBetValue.text = sample;

  portraitBetValueW = buyFooterBetValue.width;

  buyFooterBetValue.text = old;
  portraitBetWidthLocked = true;
}

const betValW = portraitBetValueW || buyFooterBetValue.width;



// Layout BET column (with arrows beside value)
const betCX = 0; // local coords (we'll center the whole footer later)

buyFooterBetTitle.x = betCX;
buyFooterBetValue.x = betCX;

// 🔧 GAP CONTROL (keep your existing portrait look)
const BET_LABEL_VALUE_GAP_DESKTOP   = 36;
const BET_LABEL_VALUE_GAP_LANDSCAPE = 10;

const betLabelValueGap = isMobileLandscapeBuyLayout()
  ? BET_LABEL_VALUE_GAP_LANDSCAPE
  : BET_LABEL_VALUE_GAP_DESKTOP;

buyFooterBetTitle.y = Math.round(-betLabelValueGap * 0.5);
buyFooterBetValue.y = Math.round( betLabelValueGap * 0.5);

// arrows to the left/right of the bet value (horizontal)
buyBetDownBtn.x = betCX - (betValW * 0.3) - (btnW * 0.5) - GAP_X;
buyBetDownBtn.y = buyFooterBetValue.y;

buyBetUpBtn.x   = betCX + (betValW * 0.3) + (btnW * 0.5) + GAP_X;
buyBetUpBtn.y   = buyFooterBetValue.y;

// Layout BALANCE column to the right of BET
const balCX = betCX + (Math.max(betValW, 140) * 0.5) + COL_GAP_X + (Math.max(balValW, 160) * 0.5);

buyFooterBalanceTitle.x = balCX;
buyFooterBalanceTitle.y = -26;

buyFooterBalanceValue.x = balCX;
buyFooterBalanceValue.y = 10;

// ✅ PORTRAIT: ensure HUD fits within device width by scaling the whole panel down
// (portrait only)
{
  // Reset scale first so our width measurement is consistent
  buyFooter.scale.set(1);

  // How much horizontal room we allow (tweak if you want more/less margin)
  const HUD_SIDE_MARGIN = 16; // px
  const maxHudPixelW = Math.max(1, W - HUD_SIDE_MARGIN * 2);

  // Measure "design" width (local space)
  const hb = buyFooter.getLocalBounds();

  // Your bg adds padding later: +36 total width (18 each side)
  const paddedHudW = hb.width + 36;

  // Scale down ONLY if needed
  const s = Math.min(1, maxHudPixelW / Math.max(1, paddedHudW));
  buyFooter.scale.set(s);

  // Pivot to visual center (in local coords) so centering is stable
  buyFooter.pivot.set(
    Math.round(hb.x + hb.width * 0.5),
    Math.round(hb.y + hb.height * 0.5)
  );

  // Center on screen
  buyFooter.x = Math.round(W * 0.5);

  // ✅ Move HUD to bottom (account for scale!)
  const HUD_BOTTOM_PAD = 22; // keep same as your tuning above
  HUD_H = (hb.height + 28) * s; // +28 matches your bg padding below, scaled

  buyFooter.y = Math.round(H - HUD_BOTTOM_PAD - HUD_H * 0.5);
}


// Background pill behind the HUD (same as you had)
buyFooterBg.clear();
const hudBounds = buyFooter.getLocalBounds();
buyFooterBg
  .rect(hudBounds.x - 18, hudBounds.y - 14, hudBounds.width + 36, hudBounds.height + 28)
  .fill({ color: 0x000000, alpha: 0.25 });
buyFooterBg.zIndex = -1;

const SIDE_PAD = 14;
const GAP_Y = 18;

// ✅ Cards viewport now goes: below header -> above bottom HUD
const cardsTop = Math.round(buyHeader.y + 52); // ✅ smaller = cards start higher (try 44..64)

const cardsBottomPad = HUD_BOTTOM_PAD + HUD_H;   // reserve space for bottom HUD

const viewX = SIDE_PAD;
const viewY = cardsTop;
const viewW = Math.round(W - SIDE_PAD * 2);
const viewH = Math.round((H - cardsBottomPad) - cardsTop);


  // position viewport
  buyCardsViewport.x = viewX;
  buyCardsViewport.y = viewY;

  // draw mask
  buyCardsMask.clear();
  buyCardsMask.rect(0, 0, viewW, viewH).fill({ color: 0xffffff, alpha: 1 });

  // content origin inside viewport
  buyCardsRow.x = Math.round(viewW / 2);
  // y is controlled by cardsScrollY (scroll offset)
  // buyCardsRow.y will be set below after we compute bounds

// ✅ PORTRAIT ONLY: ONE KNOB (scales the whole card, including internal Y positions)
const PORTRAIT_CARD_SCALE = 0.8; // try 0.82..0.95

// "Design" size (keep your nice layout numbers based on these)
const cardW = Math.min(520, Math.max(320, Math.floor(viewW)));
const cardH = 440;

// convenience
const scaledCardH = cardH * PORTRAIT_CARD_SCALE;



let y = Math.round(scaledCardH / 2);
for (let i = 0; i < buyCards.length; i++) {
  const c = buyCards[i];

  // ✅ apply the knob (everything inside scales automatically)
  c.scale.set(PORTRAIT_CARD_SCALE);

  c.x = 0;
  c.y = y;
  (c as any)._baseY = c.y;

  // ✅ step by scaled height so spacing stays correct
  y += scaledCardH + GAP_Y;


    // draw card bg
    const bg = (c as any)._bg as Graphics;
    bg.clear()
      .rect(-cardW / 2, -cardH / 2, cardW, cardH)
      .fill(0x2b2b2b)
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });

    // internal layout
    const title = (c as any)._title as Text;
    const body = (c as any)._body as Text;
    const price = (c as any)._price as Text;
    const art = (c as any)._art as Sprite;
    const buyBtn = (c as any)._buyBtn as any;

    title.x = 0;
    title.y = Math.round(-cardH * 0.5 + 22);

    art.x = 0;
    // ✅ PORTRAIT ONLY: push art + subtitle DOWN toward price
const ART_PUSH_DOWN = 28;   // try 18..40
const BODY_PUSH_DOWN = 28;  // try 18..40

art.y  = Math.round(-cardH * 0.5 + 135 + ART_PUSH_DOWN);
body.y = Math.round(-cardH * 0.5 + 205 + BODY_PUSH_DOWN);


  const ART_TARGET_W = Math.round(cardW * 0.38); // ✅ portrait smaller art

    const tw = Math.max(1, art.texture.width);
    art.scale.set(ART_TARGET_W / tw);

    body.x = 0;


    price.x = 0;
    price.y = Math.round(cardH * 0.5 - 120);

    buyBtn.x = -110;
   buyBtn.y = Math.round(cardH * 0.5 - 76); // a bit lower
    (buyBtn as any)._baseY = buyBtn.y;
  }

  // total content height
const contentH = (buyCards.length * scaledCardH) + ((buyCards.length - 1) * GAP_Y);


  // compute max scroll (content taller than viewport)
  cardsScrollMax = Math.max(0, contentH - viewH);

  // clamp existing scroll and apply
  cardsScrollY = clamp(cardsScrollY, -cardsScrollMax, 0);
  buyCardsRow.y = Math.round(cardsScrollY);

  // divider for portrait too (header already positioned by frac logic)
if (!IS_TINY) drawBuyHeaderDivider();
else buyHeaderDivider.clear();

  layoutBuyToast();
  if (buyConfirmLayer.visible) layoutBuyConfirm();
  return;

}

// -----------------------------
// LABEL ↔ VALUE GAP (non-portrait: desktop + landscape)
// -----------------------------
const GAP_DESKTOP = 32;      // tweak
const GAP_LANDSCAPE = 26;    // 🔧 tighter in landscape

const gap = isMobileLandscapeBuyLayout() ? GAP_LANDSCAPE : GAP_DESKTOP;
// =====================
// ✅ GROUP ANCHORING (non-portrait): BALANCE left, BET right
// =====================
const SIDE_PAD = IS_TINY ? 10 : 22; // tiny needs tighter padding

// Make sure titles/values measure from their left edge (easier to anchor)
buyFooterBalanceTitle.anchor.set(0, 0.5);
buyFooterBalanceValue.anchor.set(0, 0.5);
buyFooterBetTitle.anchor.set(0, 0.5);
buyFooterBetValue.anchor.set(0, 0.5);

// Measure group widths (local space)
const balW = Math.max(
  buyFooterBalanceTitle.width,
  buyFooterBalanceValue.width
);

const betW = Math.max(
  buyFooterBetTitle.width,
  buyFooterBetValue.width
);

// Arrow sizing/spacing (you already do this below, but we need widths now too)
(buyBetUpBtn as any).resetVisual?.();
(buyBetDownBtn as any).resetVisual?.();

const upW2 = (buyBetUpBtn as any).btnWidth?.() ?? buyBetUpBtn.getLocalBounds().width;
const dnW2 = (buyBetDownBtn as any).btnWidth?.() ?? buyBetDownBtn.getLocalBounds().width;
const arrowW = Math.max(upW2, dnW2);

const ARROW_X_GAP = IS_TINY ? 6 : 10; // gap between bet value and arrows

// Bet group width includes arrows to the right
const betGroupW = betW + ARROW_X_GAP + arrowW;


// This is the vertical “center line” for the pair
const BASELINE_Y = 2; // tweak up/down a touch if needed

// left column (BALANCE)
buyFooterBalanceTitle.y = Math.round(BASELINE_Y - gap * 0.5);
buyFooterBalanceValue.y = Math.round(BASELINE_Y + gap * 0.5);

// center column (BET)
buyFooterBetTitle.y = Math.round(BASELINE_Y - gap * 0.5);
buyFooterBetValue.y = Math.round(BASELINE_Y + gap * 0.5);


    // footer
const FOOTER_W =
  IS_TINY
    ? Math.round(W * 0.96)                 // ✅ tiny: almost full width
    : isMobileLandscapeBuyLayout()
      ? Math.round(W * 0.88)               // ✅ mobile landscape: wide
      : Math.round(Math.min(1100, W * 0.92)); // ✅ desktop: wide (cap optional)


const FOOTER_Y = Math.round(H * 0.90);



  buyFooter.x = Math.round(W / 2);




const FOOTER_LIFT_Y = IS_TINY ? Math.round(H * 0.01) : 0;

buyFooter.x = Math.round(W * 0.5);
buyFooter.y = Math.round(FOOTER_Y - FOOTER_LIFT_Y);

 // -----------------------------
// ✅ Anchor balance LEFT, bet+arrows RIGHT (non-portrait)
// -----------------------------

// Left edge in buyFooter local space
const leftX = -FOOTER_W / 2 + SIDE_PAD;

// Right edge in buyFooter local space
const rightX = FOOTER_W / 2 - SIDE_PAD;
const TINY_GROUP_SCALE = IS_TINY ? 0.72 : 1; // 🔧 make smaller/bigger

if (IS_TINY) {
  // ✅ scale groups, not the whole footer
  tinyBalGroup.scale.set(TINY_GROUP_SCALE);
  tinyBetGroup.scale.set(TINY_GROUP_SCALE);

  // anchors inside groups (so left edge stays left, right edge stays right)
  buyFooterBalanceTitle.anchor.set(0, 0.5);
  buyFooterBalanceValue.anchor.set(0, 0.5);
  buyFooterBetTitle.anchor.set(0, 0.5);
  buyFooterBetValue.anchor.set(0, 0.5);
  // ✅ TINY: hard-author the arrow X so they never inherit stale positions
  // (prevents the "down arrow drifts left" bug on startup/switch)
  buyFooterBetTitle.x = 0;
  buyFooterBetValue.x = 0;

  // arrows sit to the RIGHT of the bet value
  const arrowsXLocal = betW + ARROW_X_GAP + (arrowW * 0.5);
  buyBetUpBtn.x = arrowsXLocal;
  buyBetDownBtn.x = arrowsXLocal;

  // --- BAL group pivot at its LEFT edge ---
  const bL = tinyBalGroup.getLocalBounds();
  tinyBalGroup.pivot.set(bL.x, 0);
  tinyBalGroup.position.set(leftX, 0);

  // --- BET group pivot at its RIGHT edge ---
  const bR = tinyBetGroup.getLocalBounds();
  tinyBetGroup.pivot.set(bR.x + bR.width, 0);
  tinyBetGroup.position.set(rightX, 0);

} else {
  // ✅ non-tiny: keep your existing direct positioning (no groups)
  tinyBalGroup.scale.set(1);
  tinyBetGroup.scale.set(1);

 if (!IS_TINY) {
  // BALANCE group anchored to left
  buyFooterBalanceTitle.x = leftX;
  buyFooterBalanceValue.x = leftX;

  // BET group anchored to right:
  const betTextLeftX = rightX - betGroupW;

  buyFooterBetTitle.x = betTextLeftX;
  buyFooterBetValue.x = betTextLeftX;

  const arrowsX = betTextLeftX + betW + ARROW_X_GAP + (arrowW * 0.5);
  buyBetUpBtn.x = arrowsX;
  buyBetDownBtn.x = arrowsX;
}

}





// ✅ LANDSCAPE-ONLY tuning
const LAND_ARROW_Y_LIFT = -10;     // negative = move UP (try -6 .. -18)
const LAND_ARROW_SCALE  = 1;    // smaller = smaller (try 0.75 .. 0.95)

// gap between arrows (half-gap)
const ARROW_GAP_Y_DESKTOP    = 20;
const ARROW_GAP_Y_LANDSCAPE  = 17; // tighter in landscape (try 10–14)

const arrowGapY = isMobileLandscapeBuyLayout()
  ? ARROW_GAP_Y_LANDSCAPE
  : ARROW_GAP_Y_DESKTOP;

const arrowCenterLift = isMobileLandscapeBuyLayout()
  ? LAND_ARROW_Y_LIFT
  : 0;
// arrows vertical center offset (tweak)
const ARROW_Y_OFFSET = -2;
const ARROW_CENTER_Y =
  buyFooterBetValue.y + ARROW_Y_OFFSET + arrowCenterLift;

buyBetUpBtn.y   = Math.round(ARROW_CENTER_Y - arrowGapY);
buyBetDownBtn.y = Math.round(ARROW_CENTER_Y + arrowGapY);

// scale arrows (use your existing size, then apply a landscape-only multiplier)
const ARROW_H = IS_TINY ? 18 : 24;
setScaleToHeight(buyBetDownBtn, ARROW_H);
setScaleToHeight(buyBetUpBtn, ARROW_H);


if (isMobileLandscapeBuyLayout()) {
  buyBetDownBtn.scale.set(buyBetDownBtn.scale.x * LAND_ARROW_SCALE, buyBetDownBtn.scale.y * LAND_ARROW_SCALE);
  buyBetUpBtn.scale.set(buyBetUpBtn.scale.x * LAND_ARROW_SCALE, buyBetUpBtn.scale.y * LAND_ARROW_SCALE);
}

// ✅ PASTE THIS RIGHT HERE
if (IS_TINY) {
  (buyBetUpBtn as any).resetVisual?.();
  (buyBetDownBtn as any).resetVisual?.();

  const bu = buyBetUpBtn.getLocalBounds();
  buyBetUpBtn.pivot.set(bu.x + bu.width * 0.5, bu.y + bu.height * 0.5);

  const bd = buyBetDownBtn.getLocalBounds();
  buyBetDownBtn.pivot.set(bd.x + bd.width * 0.5, bd.y + bd.height * 0.5);
}


// DESKTOP: bigger hitboxes for bet arrows
// =====================
if (!isMobilePortraitBuyLayout()) {
  const padX = IS_TOUCH_UI ? 2 : 26;
  const padY = IS_TOUCH_UI ? 2 : 22;

  const padHit = (btn: Container) => {
    const b = btn.getLocalBounds();
    btn.hitArea = new Rectangle(
      b.x - padX,
      b.y - padY,
      b.width + padX * 2,
      b.height + padY * 2
    );
  };

  padHit(buyBetUpBtn);
  padHit(buyBetDownBtn);
}


    refreshBuyMenuFooter();

// -----------------------------
// ✅ BET PILL: disabled (desktop + mobile landscape + tiny)
// -----------------------------
buyFooterBetBg.visible = false;
buyFooterBetBg.clear();






    buyFooter.sortableChildren = true;
    buyFooterBetBg.zIndex = 0;
    buyFooterBetTitle.zIndex = 1;
    buyFooterBetValue.zIndex = 1;
    buyBetUpBtn.zIndex = 1;
    buyBetDownBtn.zIndex = 1;





    layoutBuyToast();
    if (buyConfirmLayer.visible) layoutBuyConfirm();
  }

window.addEventListener("resize", () => {
  portraitBetWidthLocked = false;
  portraitBetValueW = 0;

  portraitHudPivotSet = false;
  layoutBuyMenu();
});

  // -----------------------------
  // OPEN / CLOSE
  // -----------------------------
  function openBuyMenu() {
buyHeader.text = uiLabel("ui.buyBonus", "BUY BONUS");
buyFooterBalanceTitle.text = uiLabel("ui.balance", "BALANCE");
buyFooterBetTitle.text = uiLabel("ui.bet", "BET");
  applyLatinMicro5ToBuyMenuText(); 
    portraitBetWidthLocked = false;
portraitBetValueW = 0;
portraitHudPivotSet = false; // you already do this


    
portraitHudPivotSet = false;


    state.ui.buyMenuOpen = true;
    buyMenuLayer.visible = true;
    buyMenuLayer.eventMode = "static";

    // animate header divider
    buyHeaderDividerProgress = 0;
    buyHeaderDividerAnimToken++;
    const token = buyHeaderDividerAnimToken;
    const DIVIDER_IN_MS = 400;
    const t0 = performance.now();

    function tick(now: number) {
      if (token !== buyHeaderDividerAnimToken) return;
      const t = Math.min(1, (now - t0) / DIVIDER_IN_MS);
      buyHeaderDividerProgress = Math.min(1, easeOutCubic(t));
      layoutBuyMenu();
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // disable base UI
    deps.spinBtnPixi?.setEnabled?.(false);
    deps.settingsBtnPixi?.setEnabled?.(false);
    deps.buyBtnPixi?.setEnabled?.(false);
    deps.autoBtnPixi?.setEnabled?.(false);
    deps.turboBtnPixi?.setEnabled?.(false);
    deps.betDownBtnPixi?.setEnabled?.(false);
    deps.betUpBtnPixi?.setEnabled?.(false);

    layoutBuyMenu();
    updateBuyPrices();
    refreshBuyMenuFooter();

    stopUltraBuyBtnNudge();
    startUltraBuyBtnNudge();

    root.sortChildren();
  }

  function closeBuyMenu() {
    state.ui.buyMenuOpen = false;
    buyMenuLayer.visible = false;
    buyMenuLayer.eventMode = "none";

    // restore base UI
    deps.spinBtnPixi?.setEnabled?.(!state.ui.spinning);
    deps.settingsBtnPixi?.setEnabled?.(true);
    deps.buyBtnPixi?.setEnabled?.(true);
    deps.autoBtnPixi?.setEnabled?.(true);
    deps.turboBtnPixi?.setEnabled?.(true);
    deps.betDownBtnPixi?.setEnabled?.(true);
    deps.betUpBtnPixi?.setEnabled?.(true);

    // reset visuals if your buttons support it
    deps.buyBtnPixi?.resetVisual?.();
    buyCloseBtn?.resetVisual?.();

    stopUltraBuyBtnNudge();
  }

  // click-outside-to-close (but not if click is inside cards/footer)
  buyBlocker.on("pointertap", (e: any) => {
    const p = e.global;

    const cardsB = buyCardsViewport.getBounds();

    const footerB = buyFooter.getBounds();

    const insideCards =
      p.x >= cardsB.x && p.x <= cardsB.x + cardsB.width &&
      p.y >= cardsB.y && p.y <= cardsB.y + cardsB.height;

    const insideFooter =
      p.x >= footerB.x && p.x <= footerB.x + footerB.width &&
      p.y >= footerB.y && p.y <= footerB.y + footerB.height;

    if (insideCards || insideFooter) return;

    closeBuyMenu();
  });

  // initial
  layoutBuyMenu();

  return {
    openBuy: openBuyMenu,
    closeBuy: closeBuyMenu,
    layoutBuy: layoutBuyMenu,
    buyLayer: buyMenuLayer,
    showToast,
    showInsufficientToast,
  };
}
