// src/ui/autoMenu.ts

import { Application, Container, Graphics, Text, TextStyle, Rectangle, Sprite, Texture } from "pixi.js";
import { getLang } from "../i18n/i18n";
import { applyUiTextCase, localizeStyle, micro5ForLatinUiFontFamily } from "../i18n/uiTextStyle";
import { isTabletLandscape } from "../ui/layoutFlags";


export type AutoMenuApi = {
  layer: Container;
  open: () => void;
  close: () => void;
  layout: () => void;
  isOpen: () => boolean;
  setSelected: (rounds: number) => void; // -1 = infinite
};

export type AutoMenuOpts = {

    
  app: Application;
  root: Container;

  // If you already keep one shared dimmer elsewhere, you can pass it in.
  // If you don't have one, this file creates its own by default.
  uiDimmer?: Graphics;

  // Called when a chip is clicked:
  // rounds: -1 means infinite, otherwise the chosen round count.
  onPick: (rounds: number) => void;

  // Optional: called when menu closes (to re-enable your UI if needed)
  onClosed?: () => void;

  // Optional: if you want the menu to visually reflect an existing auto state
  initialSelectedRounds?: number; // -1 for infinite

  texAutoMenu: (frame: string) => Texture;
  audio?: { playSfx: (key: any, vol?: number) => void };
 t?: (key: string) => string;
};

type Chip = {
  rounds: number; // -1 = infinite
  wrap: Container;
  btn: Sprite;    // ✅ atlas sprite button
  label: Text;
  pressed: boolean;
};


export function createAutoMenu(opts: AutoMenuOpts): AutoMenuApi {
 
 const { app, root, onPick, audio, t } = opts;

const tt = (key: string, fallback: string) => t?.(key) ?? fallback;

// Two-layer approach (correct):
// - dimmerLayer sits BETWEEN gameCore and uiLayer (so it darkens reels)
// - layer sits ABOVE uiLayer (so the menu panel/chips stay on top)
const dimmerLayer = new Container();
dimmerLayer.visible = false;
dimmerLayer.eventMode = "none"; // ✅ never blocks clicks
root.addChild(dimmerLayer);

const layer = new Container(); // panel layer
layer.visible = false;
layer.eventMode = "none";
root.addChild(layer);

// ✅ zIndex targets (your main.ts: gameCore ~1500, uiLayer = 8000)
const AUTO_MENU_DIMMER_Z = 7900; // above gameCore, below uiLayer (spin stays bright)
const AUTO_MENU_PANEL_Z  = 9000; // above uiLayer

dimmerLayer.zIndex = AUTO_MENU_DIMMER_Z;
layer.zIndex = AUTO_MENU_PANEL_Z;

// ensure root respects zIndex
(root as any).sortableChildren = true;
root.sortChildren?.();





  const uiLabel = (key: string, fallback: string) => applyUiTextCase(tt(key, fallback));
// ✅ Auto-menu-only: force Micro5 for Latin-safe languages (no global impact)
const localizeAutoStyle = <T extends Record<string, any>>(baseStyle: T): T => {
  const s: any = localizeStyle(baseStyle); // keeps your size/spacing tuning
  s.fontFamily = micro5ForLatinUiFontFamily(getLang()); // Micro5 for latin-safe, else normal
  return s as T;
};








const dimmer =
  opts.uiDimmer ??
  (() => {
    const g = new Graphics();
    g.eventMode = "none";     // ✅ visual only
    g.cursor = "default";
    dimmerLayer.addChild(g);  // ✅ goes under UI
    return g;
  })();


// If they passed a shared dimmer, force it into the dimmerLayer (visual only)
if (opts.uiDimmer) {
  if (dimmer.parent !== dimmerLayer) dimmerLayer.addChild(dimmer);
  dimmer.eventMode = "none";   // ✅ visual only
  dimmer.cursor = "default";
}


  // Panel
  const panel = new Container();
  layer.addChild(panel);

function isTinyAutoView() {
  const r = (app.view as any)?.getBoundingClientRect?.();
  const cssW = r?.width ?? (app.view as any)?.clientWidth ?? window.innerWidth;
  const cssH = r?.height ?? (app.view as any)?.clientHeight ?? window.innerHeight;

  const longSide = Math.max(cssW, cssH);
  const shortSide = Math.min(cssW, cssH);
  return longSide <= 400 && shortSide <= 225;
}



function isMobileLandscapeAuto() {
  const w = app.renderer.width;
  const h = app.renderer.height;
  const isPortrait = h >= w;



  // ✅ tablet landscape should NOT be treated as "mobile landscape auto"
  if (isTabletLandscape()) return false;

  const isTouch =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)")?.matches;

  return !isPortrait && (isTouch || w < 820);
}

// default scale (desktop / portrait uses your current look)
panel.scale.set(0.42);

// ✅ PHONE landscape only: make it smaller so it fits
if (isMobileLandscapeAuto()) {
  panel.scale.set(0.32); // 🔧 try 0.28..0.36
}

// ✅ TABLET LANDSCAPE ONLY: scale it UP (iPad landscape)
if (isTabletLandscape()) {
  panel.scale.set(0.50); // 🔧 try 0.46..0.62
}



  const panelBg = new Graphics();
  panel.addChild(panelBg);

  // Titles
const titleStyle = new TextStyle(
localizeAutoStyle({
  fontSize: 54,
  fill: 0xffc400,
  letterSpacing: 2,
} as any)
);

const subStyle = new TextStyle(
localizeAutoStyle({
    fontSize: 44,
    fill: 0xffffff,
    letterSpacing: 2,
  } as any)
);


// Title group (AUTO PLAY + NUMBER OF ROUNDS)
const titleGroup = new Container();
panel.addChild(titleGroup);

titleGroup.scale.set(1.2); // 25% bigger

const title = new Text({
  text: uiLabel("ui.autoPlayTitle", "AUTO PLAY"),
  style: titleStyle,
});

const subtitle = new Text({
  text: uiLabel("ui.autoPlaySubtitle", "NUMBER OF ROUNDS"),
  style: subStyle,
});


title.anchor.set(0.5, 0);
subtitle.anchor.set(0.5, 0);

// Vertical stacking inside the group
title.y = 0;
subtitle.y = title.height + 10;

titleGroup.addChild(title, subtitle);


  
  // Chips grid
const chipsWrap = new Container();
panel.addChild(chipsWrap);

const chipValues: number[] = [-1, 10, 25, 50, 75, 100, 500, 1000];
const chips: Chip[] = [];

const chipLabelStyle = new TextStyle(
  localizeStyle({
    fontFamily: "Micro5",
    fontSize: 60,
    fill: 0x2b2b2b,
    letterSpacing: 1,
  } as any)
);


let selectedRounds = opts.initialSelectedRounds ?? -999; // none by default

// Optical centering tweak for pixel font (positive = lower)
const LABEL_Y_NUDGE = -5; // try 1–4
const LABEL_X_NUDGE = -5;   // 👈 left/right (negative = left)
// ✅ Atlas frame names
const BTN_UP = "btn_submenu_auto_up.png";
const BTN_DOWN = "btn_submenu_auto_down.png";
const BTN_ON = "btn_submenu_auto_on.png";


function setSelected(rounds: number) {
  selectedRounds = rounds;

  for (const c of chips) {
    const isSel = c.rounds === selectedRounds;
    c.btn.texture = opts.texAutoMenu(isSel ? BTN_ON : BTN_UP);

    // keep label styling
   (c.label.style as any).fill = 0x2b2b2b;
(c.label.style as any).fontSize = (c.label.style as any).fontSize; // keep


    // ✅ IMPORTANT: re-center after texture swap
    centerLabelOnButton(c.btn, c.label, c.pressed ? 2 : 0);
  }
}



function centerLabelOnButton(btn: Sprite, label: Text, extraY = 0) {
  const b = btn.getLocalBounds();
  const cx = b.x + b.width * 0.5;
  const cy = b.y + b.height * 0.5;

 label.position.set(
  Math.round(cx + LABEL_X_NUDGE),
  Math.round(cy + LABEL_Y_NUDGE + extraY)
);
}



function makeChip(rounds: number): Chip {
  const wrap = new Container();
  wrap.eventMode = "static";
  wrap.cursor = "pointer";

  const btn = new Sprite(opts.texAutoMenu(BTN_UP));
  btn.anchor.set(0.5);
  btn.roundPixels = true;

  const label = new Text({
    text: rounds === -1 ? "∞" : String(rounds),
    style: chipLabelStyle,
  });
  label.anchor.set(0.5);
  label.roundPixels = true;

  wrap.addChild(btn, label);

  const chip: Chip = { rounds, wrap, btn, label, pressed: false };

wrap.on("pointerdown", (e) => {
  e.stopPropagation?.();
  chip.pressed = true;
  chip.btn.texture = opts.texAutoMenu(BTN_DOWN);
  chip.btn.y = 2;

  // ✅ always center via helper
  centerLabelOnButton(chip.btn, chip.label, 2);
});



const release = () => {
  chip.pressed = false;
  chip.btn.y = 0;

  // ✅ restore correct visual (selected vs unselected)
  chip.btn.texture = opts.texAutoMenu(chip.rounds === selectedRounds ? BTN_ON : BTN_UP);

  // ✅ NOW center using the correct frame bounds
  centerLabelOnButton(chip.btn, chip.label, 0);
};


  wrap.on("pointerup", (e) => {
    e.stopPropagation?.();
    release();
  });
  wrap.on("pointerupoutside", release);
  wrap.on("pointerout", () => {
    if (chip.pressed) release();
  });

 wrap.on("pointertap", (e) => {
  e.stopPropagation?.();

  // ✅ normal click
  audio?.playSfx("ui_click", 0.85);

  setSelected(rounds);
  onPick(rounds);
});


  // good hit area even when scaled down
  wrap.hitArea = new Rectangle(-90, -90, 180, 180);

  return chip;
}




// build chips
for (const v of chipValues) {
  const chip = makeChip(v);
  chips.push(chip);
  chipsWrap.addChild(chip.wrap);
}



  // Prevent clicks through the panel
  panel.eventMode = "static";
  panel.on("pointertap", (e) => e.stopPropagation());
// =====================
// CLOSE ON OUTSIDE TAP (WITHOUT BLOCKING SPIN CLICK)
// =====================
let __autoStageCloseBound = false;

function panelWorldContainsPoint(gx: number, gy: number): boolean {
  // Panel is a Container at panel.x/y and scaled; bounds are world-space.
  const b = panel.getBounds();
  return gx >= b.x && gx <= (b.x + b.width) && gy >= b.y && gy <= (b.y + b.height);
}

function onAutoStagePointerTap(e: any) {
  if (!layer.visible) return;

  const gx = e?.global?.x ?? 0;
  const gy = e?.global?.y ?? 0;

  // If tap is inside the panel, do nothing (chips handle their own taps)
  if (panelWorldContainsPoint(gx, gy)) return;

  // Otherwise, close the menu.
  close();
}

function open() {
  dimmerLayer.visible = true;
layer.visible = true;
layer.eventMode = "static";
  title.text = uiLabel("ui.autoPlayTitle", "AUTO PLAY");
  subtitle.text = uiLabel("ui.autoPlaySubtitle", "NUMBER OF ROUNDS");



  layer.visible = true;
    // ✅ Dimmer should NOT intercept clicks (so SPIN can be clicked underneath)
  dimmer.eventMode = "none";
  dimmer.cursor = "default";

  // ✅ Close by clicking/tapping anywhere outside panel (non-blocking)
  if (!__autoStageCloseBound) {
    __autoStageCloseBound = true;
    app.stage.on("pointertap", onAutoStagePointerTap);
  }

  layer.eventMode = "static";

  layout();
}

function close() {
  dimmerLayer.visible = false;
dimmerLayer.eventMode = "none";

layer.visible = false;
layer.eventMode = "none";

    // ✅ Remove stage outside-tap handler
  if (__autoStageCloseBound) {
    __autoStageCloseBound = false;
    app.stage.off("pointertap", onAutoStagePointerTap);
  }
  audio?.playSfx("ui_toggle", 0.9);

  layer.visible = false;
  layer.eventMode = "none";


  opts.onClosed?.();
}


  function isOpen() {
    return layer.visible;
  }
const AUTO_PANEL_SCALE_DEFAULT = 0.42;
const AUTO_PANEL_SCALE_MOBILE_LAND = 0.32;
const AUTO_PANEL_SCALE_TABLET_LAND = 0.50;

// Tiny view: optional hard cap + extra shrink
const TINY_ABS_MAX = 0.28;   // try 0.22..0.30
const TINY_SHRINK = 0.85;    // try 0.80..0.92

  function layout() {
  const w = app.renderer.width;
  const h = app.renderer.height;

  // Dimmer fill
  dimmer.clear();
  dimmer.beginFill(0x000000, 0.65);
  dimmer.drawRect(0, 0, w, h);
  dimmer.endFill();

  // Panel sizing (responsive)
   // Panel sizing (LOCKED to desktop "maximised" look)
  const isPortrait = h >= w;

  // ✅ Keep the menu looking the same; only reposition later.
  const panelW = 640;
  const panelH = isPortrait ? 1100 : 980;

  // ✅ SCALE (deterministic; prevents cumulative shrink)
let baseScale = AUTO_PANEL_SCALE_DEFAULT;

if (isMobileLandscapeAuto()) baseScale = AUTO_PANEL_SCALE_MOBILE_LAND;
if (isTabletLandscape()) baseScale = AUTO_PANEL_SCALE_TABLET_LAND;

// ✅ MOBILE PORTRAIT ONLY (phone-sized)
if (isPortrait && w <= 460 && h <= 900) {
  baseScale *= 0.85;   // 🔧 10% smaller (try 0.85 for more)
}

// apply base immediately so layout is predictable
panel.scale.set(baseScale);

// ✅ TINY VIEW ONLY: fit to viewport without ever using current panel.scale as the base
if (isTinyAutoView()) {
  const PAD = 8;

  const maxScaleW = (w - PAD * 2) / panelW;
  const maxScaleH = (h - PAD * 2) / panelH;

  // hard cap tiny scale + fit-to-screen + extra shrink
  const tinyScale = Math.min(baseScale, maxScaleW, maxScaleH, TINY_ABS_MAX) * TINY_SHRINK;

  panel.scale.set(tinyScale);
  baseScale = tinyScale; // keep variable in sync if you use it below
}



  // ✅ TINY VIEW ONLY: override scale so the panel fits (leave other modes untouched)
if (isTinyAutoView()) {
  const base = panel.scale.x;

  const PAD = 8;
  const maxScaleW = (w - PAD * 2) / panelW;
  const maxScaleH = (h - PAD * 2) / panelH;

  // 🔽 extra tiny-only shrink
  const TINY_SHRINK = 0.85; // try 0.80–0.90

  const tinyScale = Math.min(base, maxScaleW, maxScaleH) * TINY_SHRINK;

  panel.scale.set(tinyScale);
}



const scale = panel.scale.x;

// Use viewport size for portrait (more accurate on phones)
const vw = isPortrait ? window.innerWidth  : w;
const vh = isPortrait ? window.innerHeight : h;

// Center within the chosen frame
panel.x = Math.round((vw - panelW * scale) * 0.5);
panel.y = Math.round((vh - panelH * scale) * 0.5);
// ✅ MOBILE LANDSCAPE ONLY: keep panel fully on-screen and above bottom UI
if (!isPortrait && isMobileLandscapeAuto()) {
  const TOP_PAD = 18;      // keep off the top edge
  const BOTTOM_UI_PAD = 140; // reserve space for your bottom UI (tweak 120..180)

  const scaledH = panelH * scale;

  const minY = TOP_PAD;
  const maxY = Math.max(TOP_PAD, vh - BOTTOM_UI_PAD - scaledH);

  panel.y = Math.round(Math.max(minY, Math.min(panel.y, maxY)));
}



// ✅ move UP on portrait devices
if (isPortrait) {
  panel.y -= 80; // 👈 try 40, 60, 80, 100
}

  // Panel background (rounded)
  panelBg.clear();
  panelBg.beginFill(0x1f1f1f, 0.92);
  panelBg.drawRoundedRect(0, 0, panelW, panelH, 36);
  panelBg.endFill();

  // Soft top highlight
  panelBg.beginFill(0xffffff, 0.06);
  panelBg.drawRoundedRect(10, 10, panelW - 20, 120, 30);
  panelBg.endFill();

// ----- HEADER BACKER RECT (matches your grey highlight) -----
const headerX = 10;
const headerY = 10;
const headerW = panelW - 20;
const headerH = 120;

// (Optional) keep subtitle spacing correct in case font metrics change
subtitle.y = Math.round(title.height + 10);

// ----- CENTER titleGroup inside the header backer -----
const gb = titleGroup.getLocalBounds();
titleGroup.pivot.set(gb.x + gb.width * 0.5, gb.y + gb.height * 0.5);

titleGroup.x = Math.round(headerX + headerW * 0.5);
titleGroup.y = Math.round(headerY + headerH * 0.5);

titleGroup.y += -6; // try -6..+6

  // Grid layout (2 columns x 4 rows)
  const cols = 2;
  const rows = 4;

  // Chip spacing tuned to match the concept
  const gridTop = 200;
  const gridBottomPad = 44;

// Extra vertical spacing between auto buttons
const BUTTON_ROW_GAP = 24; // try 16–40


const gridHRaw = panelH - gridTop - gridBottomPad;

// ✅ reserve space for gaps so the last row stays inside the box
const totalGapH = (rows - 1) * BUTTON_ROW_GAP;
const gridH = Math.max(1, gridHRaw - totalGapH);

const cellW = panelW / cols;
const cellH = gridH / rows;


  // “disc” size used for scaling the atlas button
  const baseR = Math.min(cellW, cellH) * 0.28;
  const discR = Math.max(44, Math.min(62, baseR));
  const targetD = discR * 2;

 // Use the LARGEST of the 3 textures so ON doesn't cause a jump
const tUp = opts.texAutoMenu(BTN_UP);
const tDn = opts.texAutoMenu(BTN_DOWN);
const tOn = opts.texAutoMenu(BTN_ON);

const bw = Math.max(tUp.width || 1, tDn.width || 1, tOn.width || 1);
const bh = Math.max(tUp.height || 1, tDn.height || 1, tOn.height || 1);

// Fit sprite to targetD (disc diameter)
const BUTTON_SCALE_MULT = 2.4; // 20% bigger buttons

const bs = Math.min(targetD / bw, targetD / bh) * BUTTON_SCALE_MULT;


  for (let i = 0; i < chips.length; i++) {
    
    const c = chips[i];

    const col = i % cols;
    const row = Math.floor(i / cols);

    const cx = Math.round(col * cellW + cellW * 0.5);
    const cy = Math.round(
  gridTop +
  row * (cellH + BUTTON_ROW_GAP) +
  cellH * 0.5
);

    c.wrap.x = cx;
    c.wrap.y = cy;

const wantFrame = (c.rounds === selectedRounds) ? BTN_ON : BTN_UP;


c.btn.texture = opts.texAutoMenu(wantFrame);
c.btn.scale.set(bs);

// label size scales with chip
const fontSize = Math.round(Math.max(34, Math.min(60, discR * 0.95)));
c.label.style = new TextStyle(
  localizeStyle({
    fontFamily: "Micro5",
    fontSize,
    fill: 0x2b2b2b,
    letterSpacing: 1,
  } as any)
);


// ✅ center text based on the actual button frame (UP/DOWN/ON)
centerLabelOnButton(c.btn, c.label, c.pressed ? 2 : 0);

  }

  // If nothing selected yet, you can default highlight the first chip
  if (selectedRounds === -999) {
    setSelected(-1);
  } else {
    // refresh highlight if layout redrew
    setSelected(selectedRounds);
  }
}


  // initial draw
  setSelected(selectedRounds);

  return {
    layer,
    open,
    close,
    layout,
    isOpen,
    setSelected,
  };
}

