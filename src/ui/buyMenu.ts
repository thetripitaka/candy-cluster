// src/ui/buyMenu.ts
import { Application, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from "pixi.js";

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
  uiLayer: Container; // (optional, but you had it)
  state: any;
  audio?: any;
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

    function playUiClick(vol = 0.9) {
    // ✅ also make sure audio is unlocked (harmless on desktop)
    audio?.initFromUserGesture?.();
    audio?.playSfx?.("ui_click", vol);
  }

  const IS_TOUCH =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.matchMedia?.("(pointer: coarse)")?.matches;


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
    text: "BUY BONUS",
    style: {
      fontFamily: "Micro5",
      fill: 0xffffff,
      fontSize: 50,
      fontWeight: "100",
      letterSpacing: 1,
      align: "center",
      stroke: { color: 0x000000, width: 6 },
    } as any,
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

  // generous hit area
  const BUY_CLOSE_HIT = 72;
  buyCloseBtn.hitArea = new Rectangle(-BUY_CLOSE_HIT / 2, -BUY_CLOSE_HIT / 2, BUY_CLOSE_HIT, BUY_CLOSE_HIT);

  // cards container
// -----------------------------
// CARDS SCROLL VIEWPORT (for portrait)
// -----------------------------
const buyCardsViewport = new Container();
buyCardsViewport.eventMode = "static"; // receives drag
buyCardsViewport.cursor = "default";
buyMenuLayer.addChild(buyCardsViewport);

const buyCardsMask = new Graphics();
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
    style: {
      fontFamily: "Micro5",
      stroke: { color: 0x000000, width: 6 },
      fill: 0xffe0e0,
      fontSize: 30,
      align: "center",
      letterSpacing: 1,
    } as any,
  } as any);
  buyToast.anchor.set(0.5);
  buyToast.visible = false;
  buyToast.alpha = 0;
  toastLayer.addChild(buyToast);

  let buyToastTimer: any = null;

  function layoutBuyToast() {
    const W = app.screen.width;
    const H = app.screen.height;
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
    }, 900);
  }

  const BUY_PORTRAIT_TOAST_MSG = "OOPS, NOT ENOUGH BALANCE"; // ✅ portrait wording
const BUY_DESKTOP_TOAST_MSG  = "OOPS — NOT ENOUGH BALANCE or CHANGE BET AMOUNT"; // ✅ desktop/landscape wording

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
let portraitHudLocked = false;
let portraitHudPivotSet = false;

  buyFooter.eventMode = "static";
  buyFooter.cursor = "default";
  buyMenuLayer.addChild(buyFooter);

  const buyFooterBg = new Graphics();
  buyFooter.addChild(buyFooterBg);

  const buyFooterBetBg = new Graphics(); // grey pill behind bet+arrows
  buyFooter.addChild(buyFooterBetBg);

  const BUY_FOOTER_TITLE_STYLE = new TextStyle({
    fontFamily: "Micro5",
    fill: 0xb18cff,
    fontSize: 24,
    letterSpacing: 2,
  } as any);

  const BUY_FOOTER_VALUE_STYLE = new TextStyle({
    fontFamily: "Micro5",
    fill: 0xffffff,
    fontSize: 40,
    letterSpacing: 1,
    stroke: { color: 0x000000, width: 4 },
  } as any);

  const buyFooterBalanceTitle = new Text({ text: "BALANCE", style: BUY_FOOTER_TITLE_STYLE } as any);
  const buyFooterBalanceValue = new Text({ text: fmtMoney(state.bank.balance), style: BUY_FOOTER_VALUE_STYLE } as any);
  const buyFooterBetTitle = new Text({ text: "BET", style: BUY_FOOTER_TITLE_STYLE } as any);
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
    style: {
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
    } as any,
  } as any);
  buyConfirmTitleText.anchor.set(0.5);
  buyConfirmLayer.addChild(buyConfirmTitleText);

  const buyConfirmPriceText = new Text({
    text: "",
    style: {
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
    } as any,
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
  const txt = new Text({
    text: label,
    style: {
      fontFamily: "Micro5",
      fill: 0xffffff,
      fontSize: 45,
      fontWeight: "100",
      letterSpacing: 2,
      align: "center",
      stroke: { color: 0x000000, width: 4 },
    } as any,
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

  btn.eventMode = "static";
  btn.cursor = "pointer";

  btn.on("pointertap", (e: any) => {
    e?.stopPropagation?.();
    audio?.initFromUserGesture?.();
    audio?.playSfx?.(sfxKey as any, vol);
    onTap();
  });

  (btn as any).setLabel = (t: string) => (txt.text = t);
  (btn as any).setRed = () => drawRed();
  (btn as any).setGreen = () => drawGreen();

  return btn as any;
}


  let buyConfirmOnYes: null | (() => void) = null;
 const buyConfirmYesBtn = makeCardButton(
  "CONFIRM",
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

    const pw = Math.min(460, W * 0.72);
    const ph = 210;

    const px = (W - pw) / 2;
    const py = (H - ph) / 2;

    buyConfirmPanel.clear()
      .rect(px, py, pw, ph)
      .fill(0x2b2b2b)
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });

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

    buyConfirmTitleText.text = title;
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
    const txt = new Text({
      text: label,
      style: {
        fontFamily: "Micro5",
        fill: 0xffffff,
        fontSize: 45,
        fontWeight: "100",
        letterSpacing: 2,
        align: "center",
        stroke: { color: 0x000000, width: 4 },
      } as any,
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

    (btn as any).setLabel = (t: string) => (txt.text = t);
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
    { title: "PICK & MIX", body: "ENTRY BONUS\nSTARTS AT 1× MULTIPLIER", priceMult: 50,  startMult: 1, fsCount: 10, artFrame: "buy_art_pick.png" },
    { title: "GIGA",       body: "HIGHER VOLATILITY\nSTARTS AT 2× MULTIPLIER", priceMult: 75,  startMult: 2, fsCount: 10, artFrame: "buy_art_giga.png" },
    { title: "SUPER",      body: "STRONG FEATURE\nSTARTS AT 3× MULTIPLIER", priceMult: 100, startMult: 3, fsCount: 10, artFrame: "buy_art_super.png" },
    { title: "ULTRA",      body: "MAXIMUM INTENSITY\nSTARTS AT 5× MULTIPLIER", priceMult: 150, startMult: 5, fsCount: 10, artFrame: "buy_art_ultra.png" },
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
      text: spec.title,
      style: {
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
      } as any,
    } as any);
    title.anchor.set(0.5, 0);
    card.addChild(title);

    const art = new Sprite(texExtra(spec.artFrame));
    art.anchor.set(0.5);
    art.roundPixels = true;
    art.eventMode = "none";
    card.addChild(art);
    (card as any)._art = art;

    const body = new Text({
      text: spec.body,
      style: {
        fontFamily: "Micro5",
        fill: 0xffffff,
        fontSize: 30,
        lineHeight: 24,
        align: "center",
        letterSpacing: 1,
      } as any,
    } as any);
    body.anchor.set(0.5, 0);
    card.addChild(body);

    const price = new Text({
      text: "",
      style: {
        fontFamily: "Micro5",
        fill: 0xffffff,
        fontSize: 37,
        align: "center",
        letterSpacing: 2,
        stroke: { color: 0x000000, width: 5 },
        dropShadow: false,
      } as any,
    } as any);
    price.anchor.set(0.5, 0);
    card.addChild(price);

    const buyBtn = makeBuyCardButton("BUY", () => {
      const cost = getCurrentBet() * spec.priceMult;

    if (state.bank.balance < cost) {
  // ✅ show toast + shake
  showInsufficientToast();
  shakeBuyToast(); // add this helper below

  // optional: still open wallet
  window.open("https://stake.com/wallet", "_blank", "noopener,noreferrer");
  return;
}

      openBuyConfirm(spec.title, cost, () => {
        state.bank.balance -= cost;
        deps.onBalanceUpdated?.();
        refreshSpinAffordability();
        refreshBuyMenuFooter();
        onBalanceUpdated?.();

        closeBuyMenu();
        enterFreeSpins(spec.fsCount, spec.startMult);
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
        buyBtn.setLabel("BUY");
      } else {
        buyBtn.setRed();
        buyBtn.setLabel("TOP UP");
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


    // divider
    const DIVIDER_W = Math.min(340, W * 0.55);
  const DIVIDER_Y = Math.round(buyHeader.y + (isMobileLandscapeBuyLayout() ? 26 : 34));

    const half = (DIVIDER_W * buyHeaderDividerProgress) * 0.5;

    buyHeaderDivider.clear();
    buyHeaderDivider.moveTo(Math.round(W / 2 - half), DIVIDER_Y);
    buyHeaderDivider.lineTo(Math.round(W / 2 + half), DIVIDER_Y);
    buyHeaderDivider.stroke({ width: 3, color: 0xffffff, alpha: 0.85 } as any);

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


  buyCardsRow.visible = true;
  buyCardsRow.alpha = 1;
  // ✅ DESKTOP: restore proper card sizing + spacing
const DESKTOP_CARD_W = 320; // revert (tweak 280..360)
const DESKTOP_CARD_H = 420; // revert (tweak 360..460)
const DESKTOP_GAP = 22;

const totalW = 4 * DESKTOP_CARD_W + 3 * DESKTOP_GAP;
const rowScale = Math.min(1, (W * 0.92) / totalW);

buyCardsRow.scale.set(rowScale);

const BUY_CARDS_LANDSCAPE_Y_OFFSET = -30; // 🔧 negative = move up

buyCardsRow.scale.set(rowScale);
buyCardsRow.x = Math.round(W / 2);
buyCardsRow.y = Math.round(H * 0.55) + (isMobileLandscapeBuyLayout() ? BUY_CARDS_LANDSCAPE_Y_OFFSET : 0);



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
if (isMobilePortraitBuyLayout()) {
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
buyBetDownBtn.x = betCX - (betValW * 0.5) - (btnW * 0.5) - GAP_X;
buyBetDownBtn.y = buyFooterBetValue.y;

buyBetUpBtn.x   = betCX + (betValW * 0.5) + (btnW * 0.5) + GAP_X;
buyBetUpBtn.y   = buyFooterBetValue.y;

// Layout BALANCE column to the right of BET
const balCX = betCX + (Math.max(betValW, 140) * 0.5) + COL_GAP_X + (Math.max(balValW, 160) * 0.5);

buyFooterBalanceTitle.x = balCX;
buyFooterBalanceTitle.y = -26;

buyFooterBalanceValue.x = balCX;
buyFooterBalanceValue.y = 10;

// ✅ PORTRAIT: lock HUD position (no jumping on bet text changes)
if (!portraitHudPivotSet) {
  // build bounds ONCE (after children positions have been set)
  const hb = buyFooter.getLocalBounds();

  // pivot to its visual center ONCE
  buyFooter.pivot.set(
    Math.round(hb.x + hb.width * 0.5),
    Math.round(hb.y + hb.height * 0.5)
  );

  portraitHudPivotSet = true;
}

// Always keep HUD centered on screen (bounds can change, pivot won't)
buyFooter.x = Math.round(W * 0.5);


// ✅ Move the HUD to the BOTTOM (y)
const hb2 = buyFooter.getLocalBounds();
const HUD_H = hb2.height + 28; // matches your bg padding below
buyFooter.y = Math.round(H - HUD_BOTTOM_PAD - HUD_H * 0.5);

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

  // ✅ Fixed taller card size (this is what you want)
const cardW = Math.min(520, Math.max(320, Math.floor(viewW))); // wider max
const cardH = 440; // taller

  // lay cards vertically (centered in viewport)
  let y = Math.round(cardH / 2);
  for (let i = 0; i < buyCards.length; i++) {
    const c = buyCards[i];
    c.x = 0;
    c.y = y;
    (c as any)._baseY = c.y;

    y += cardH + GAP_Y;

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


  const ART_TARGET_W = Math.round(cardW * 0.42); // bigger art
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
  const contentH = (buyCards.length * cardH) + ((buyCards.length - 1) * GAP_Y);

  // compute max scroll (content taller than viewport)
  cardsScrollMax = Math.max(0, contentH - viewH);

  // clamp existing scroll and apply
  cardsScrollY = clamp(cardsScrollY, -cardsScrollMax, 0);
  buyCardsRow.y = Math.round(cardsScrollY);

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

// This is the vertical “center line” for the pair
const BASELINE_Y = 2; // tweak up/down a touch if needed

// left column (BALANCE)
buyFooterBalanceTitle.y = Math.round(BASELINE_Y - gap * 0.5);
buyFooterBalanceValue.y = Math.round(BASELINE_Y + gap * 0.5);

// center column (BET)
buyFooterBetTitle.y = Math.round(BASELINE_Y - gap * 0.5);
buyFooterBetValue.y = Math.round(BASELINE_Y + gap * 0.5);


    // footer
    const FOOTER_W = Math.min(520, Math.round(W * 0.55));
    const FOOTER_Y = Math.round(H * 0.90);

    buyFooter.x = Math.round(W / 2);
    buyFooter.y = FOOTER_Y;

    // left column
    buyFooterBalanceTitle.anchor.set(0, 0.5);
    buyFooterBalanceValue.anchor.set(0, 0.5);

    buyFooterBalanceTitle.x = -FOOTER_W / 2 + 26;


    buyFooterBalanceValue.x = -FOOTER_W / 2 + 26;


    // right column
   // BET (desktop) — hard centered
buyFooterBetTitle.anchor.set(0.5, 0.5);
buyFooterBetValue.anchor.set(0.5, 0.5);

buyFooterBetTitle.x = 0;


buyFooterBetValue.x = 0;
// -----------------------------
// BET label ↔ value gap (landscape-only tighter)
// -----------------------------
const BET_GAP_DESKTOP = 32;     // your normal spacing
const BET_GAP_LAND    = 26;     // 🔧 landscape tighter (try 14–22)

const betGap = isMobileLandscapeBuyLayout() ? BET_GAP_LAND : BET_GAP_DESKTOP;

// choose the vertical "center" of the BET stack
const BET_BASE_Y = 2; // tweak -2..+6 to taste

buyFooterBetTitle.y = Math.round(BET_BASE_Y - betGap * 0.5);
buyFooterBetValue.y = Math.round(BET_BASE_Y + betGap * 0.5);





// arrows (desktop / landscape)
const ARROW_Y_OFFSET = -2;
const ARROW_X_FROM_CENTER = 90; // tweak 60–90

buyBetDownBtn.x = ARROW_X_FROM_CENTER;
buyBetUpBtn.x   = ARROW_X_FROM_CENTER;

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

const ARROW_CENTER_Y =
  buyFooterBetValue.y + ARROW_Y_OFFSET + arrowCenterLift;

buyBetUpBtn.y   = Math.round(ARROW_CENTER_Y - arrowGapY);
buyBetDownBtn.y = Math.round(ARROW_CENTER_Y + arrowGapY);

// scale arrows (use your existing size, then apply a landscape-only multiplier)
setScaleToHeight(buyBetDownBtn, 24);
setScaleToHeight(buyBetUpBtn, 24);

if (isMobileLandscapeBuyLayout()) {
  buyBetDownBtn.scale.set(buyBetDownBtn.scale.x * LAND_ARROW_SCALE, buyBetDownBtn.scale.y * LAND_ARROW_SCALE);
  buyBetUpBtn.scale.set(buyBetUpBtn.scale.x * LAND_ARROW_SCALE, buyBetUpBtn.scale.y * LAND_ARROW_SCALE);
}

// DESKTOP: bigger hitboxes for bet arrows
// =====================
if (!isMobilePortraitBuyLayout()) {
  const HIT_PAD_X = 26; // tweak 16..40
  const HIT_PAD_Y = 22; // tweak 14..34

  const padHit = (btn: Container) => {
    const b = btn.getLocalBounds();
    btn.hitArea = new Rectangle(
      b.x - HIT_PAD_X,
      b.y - HIT_PAD_Y,
      b.width + HIT_PAD_X * 2,
      b.height + HIT_PAD_Y * 2
    );
  };

  padHit(buyBetUpBtn);
  padHit(buyBetDownBtn);
}


    refreshBuyMenuFooter();

  // -----------------------------
// BET PILL (fixed size on desktop, adaptive on mobile)
// -----------------------------
// -----------------------------
// BET PILL (desktop: fixed + centered to bet value)
// -----------------------------
if (!isMobilePortraitBuyLayout()) {
  const DESKTOP_BET_PILL_W = 130; // your shortened width
  const DESKTOP_BET_PILL_H = 72;

  buyFooterBetBg.clear()
    .roundRect(
      -DESKTOP_BET_PILL_W / 2,
      -DESKTOP_BET_PILL_H / 2,
      DESKTOP_BET_PILL_W,
      DESKTOP_BET_PILL_H,
      0
    )
    .fill({ color: 0x6e6e6e, alpha: 0.80 });

 const BET_PILL_Y_OFFSET = -6; // 🔼 negative = move up (try -4 .. -10)

buyFooterBetBg.x = Math.round(buyFooterBetValue.x);
buyFooterBetBg.y = Math.round(buyFooterBetValue.y + BET_PILL_Y_OFFSET);

}




    buyFooter.sortableChildren = true;
    buyFooterBetBg.zIndex = 0;
    buyFooterBetTitle.zIndex = 1;
    buyFooterBetValue.zIndex = 1;
    buyBetUpBtn.zIndex = 1;
    buyBetDownBtn.zIndex = 1;

// =====================
// DESKTOP HUD: center footer visually on screen
// =====================
if (!isMobilePortraitBuyLayout()) {
  const b = buyFooter.getLocalBounds();
  buyFooter.x = Math.round(W * 0.5 - (b.x + b.width * 0.5));
  buyFooter.y = FOOTER_Y;
}



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

    portraitBetWidthLocked = false;
portraitBetValueW = 0;
portraitHudPivotSet = false; // you already do this


    portraitHudLocked = false;
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

