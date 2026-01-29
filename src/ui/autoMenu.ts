// src/ui/autoMenu.ts

import { Application, Container, Graphics, Text, TextStyle, Rectangle, Sprite, Texture } from "pixi.js";
import { getLang } from "../i18n/i18n";
import { applyUiTextCase, localizeStyle, micro5ForLatinUiFontFamily } from "../i18n/uiTextStyle";


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
  // Layer that holds everything (dimmer + panel)
  const layer = new Container();
  layer.visible = false;
  layer.eventMode = "none";
  root.addChild(layer);

  const uiLabel = (key: string, fallback: string) => applyUiTextCase(tt(key, fallback));
// ✅ Auto-menu-only: force Micro5 for Latin-safe languages (no global impact)
const localizeAutoStyle = <T extends Record<string, any>>(baseStyle: T): T => {
  const s: any = localizeStyle(baseStyle); // keeps your size/spacing tuning
  s.fontFamily = micro5ForLatinUiFontFamily(getLang()); // Micro5 for latin-safe, else normal
  return s as T;
};


  // ✅ ensure it renders ABOVE reelhouse/symbols/UI
layer.zIndex = 7500;   // ✅ above reels/symbols (gameCore), below uiLayer (8000)
root.sortChildren?.();


  // Dimmer
  const dimmer =
    opts.uiDimmer ??
    (() => {
      const g = new Graphics();
      g.eventMode = "static";
      g.cursor = "pointer";
      layer.addChild(g);
      return g;
    })();

  // If they passed a shared dimmer, ensure it’s inside this layer
  if (opts.uiDimmer) {
    // assume caller already added it to the display list elsewhere;
    // but for safety, if it isn't parented, add it.
    if (!dimmer.parent) layer.addChild(dimmer);
    dimmer.eventMode = "static";
    dimmer.cursor = "pointer";
  }

  // Panel
  const panel = new Container();
  layer.addChild(panel);

  // ✅ scale the entire menu panel (50% smaller)
panel.scale.set(0.6);

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

titleGroup.scale.set(1.12); // 25% bigger

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

  // Close by tapping dimmer/outside
dimmer.on("pointertap", () => close());

  // Prevent clicks through the panel
  panel.eventMode = "static";
  panel.on("pointertap", (e) => e.stopPropagation());

 function open() {
  title.text = uiLabel("ui.autoPlayTitle", "AUTO PLAY");
subtitle.text = uiLabel("ui.autoPlaySubtitle", "NUMBER OF ROUNDS");

  layer.visible = true;
  layer.eventMode = "static";
  root.sortChildren?.(); // ✅ bring zIndex ordering up-to-date
  layout();
}


function close() {
  audio?.playSfx("ui_toggle", 0.9);

  layer.visible = false;
  layer.eventMode = "none";
  opts.onClosed?.();
}


  function isOpen() {
    return layer.visible;
  }

  function layout() {
  const w = app.renderer.width;
  const h = app.renderer.height;

  // Dimmer fill
  dimmer.clear();
  dimmer.beginFill(0x000000, 0.65);
  dimmer.drawRect(0, 0, w, h);
  dimmer.endFill();

  // Panel sizing (responsive)
  const isPortrait = h >= w;

  const panelW = Math.min(w * (isPortrait ? 0.86 : 0.55), 640);
  const panelH = Math.min(h * (isPortrait ? 0.95 : 0.82), isPortrait ? 1100 : 980);

const scale = panel.scale.x;

// Use viewport size for portrait (more accurate on phones)
const vw = isPortrait ? window.innerWidth  : w;
const vh = isPortrait ? window.innerHeight : h;

// Center within the chosen frame
panel.x = Math.round((vw - panelW * scale) * 0.5);
panel.y = Math.round((vh - panelH * scale) * 0.5);


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
const BUTTON_SCALE_MULT = 2; // 20% bigger buttons

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

