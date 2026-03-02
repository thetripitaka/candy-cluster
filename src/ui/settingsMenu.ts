
import { getLang } from "../i18n/i18n";
import { applyUiTextCase, localizeStyle, micro5ForLatinUiFontFamily } from "../i18n/uiTextStyle";
import { uiFontFamilyFor } from "../i18n/fonts";
import infoI18n from "../i18n/info_i18n_all_languages.json";


// src/ui/settingsMenu.ts
import { Container, Graphics, Rectangle, Text, TextStyle, Sprite } from "pixi.js";

export type SettingsMenuApi = {
  layer: Container;
  layout: () => void;
  open: () => void;
  close: () => void;
  closeFromOutside: () => void;
};



export function createSettingsMenu(opts: {
  t?: (key: string) => string;

  app: any;
  root: Container;
  state: any;

  // ui
  uiDimmer: Graphics;
  settingsBtnPixi: any;

  onClosed: () => void;

  // textures + helpers
  texUI: (frame: string) => any;
  texSymbols: (frame: string) => any; // ✅ ONLY ONE
  setScaleToHeight: (c: any, targetH: number) => void;
  makePngButton: (up: string, hover: string, down: string, onClick: () => void) => any;


  // icons / frames
  ICON_INFO: string;
  ICON_SFX_ON: string;
  ICON_SFX_OFF: string;
  ICON_MUSIC_ON: string;
  ICON_MUSIC_OFF: string;

  CLOSE_UP: string;
  CLOSE_HOVER: string;
  CLOSE_DOWN: string;

  // audio state glue (keeps your existing behavior in main)
  getSfxMuted: () => boolean;
  setSfxMuted: (v: boolean) => void;

  getMusicMuted: () => boolean;
  setMusicMuted: (v: boolean) => void;

  applyAudioUI: () => void;

  // slider factory FROM MAIN (so we don't re-implement your complex slider)
  makeSlider: (
    iconOnUrl: string,
    iconOffUrl: string,
    initial01: number,
    onChange?: (v01: number) => void
  ) => any;

  // initial slider values (0..1)
  getSfxValue01: () => number;
  getMusicValue01: () => number;
    // slider setters (0..1)
  setSfxValue01: (v01: number) => void;
  setMusicValue01: (v01: number) => void;

}) : SettingsMenuApi {
  const {
  app, root, state,
  uiDimmer, settingsBtnPixi,
  onClosed,
  texUI, texSymbols, setScaleToHeight, makePngButton,
  ICON_INFO, ICON_SFX_ON, ICON_SFX_OFF, ICON_MUSIC_ON, ICON_MUSIC_OFF,
  CLOSE_UP, CLOSE_HOVER, CLOSE_DOWN,
  getSfxMuted, setSfxMuted,
  getMusicMuted, setMusicMuted,
  applyAudioUI,
  makeSlider,
  getSfxValue01,
  getMusicValue01,
  setSfxValue01,
  setMusicValue01,
  t,
} = opts;

  const tt = (key: string, fallback: string) => t?.(key) ?? fallback;
const uiLabel = (key: string, fallback: string) => applyUiTextCase(tt(key, fallback));
// ✅ Info-modal-only: force *system/computer* font (no pixeldown/Micro5)
const localizeInfoSystemStyle = <T extends Record<string, any>>(baseStyle: T): T => {
  const s: any = localizeStyle(baseStyle);
  // system font stack
  s.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  return s as T;
};

// ✅ Settings-menu-only: force Micro5 for Latin-safe languages (no global impact)
const localizeSettingsStyle = <T extends Record<string, any>>(baseStyle: T): T => {
  const s: any = localizeStyle(baseStyle);
  s.fontFamily = micro5ForLatinUiFontFamily(getLang());
  return s as T;
};

// ✅ Info-modal-only: force SAFE fallback fonts (no pixeldown/Micro5)
const localizeInfoSafeStyle = <T extends Record<string, any>>(baseStyle: T): T => {
  const s: any = localizeStyle(baseStyle);
  s.fontFamily = uiFontFamilyFor(getLang()); // <- your safe font mapping
  return s as T;
};



  const IS_TOUCH =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.matchMedia?.("(pointer: coarse)")?.matches;

function isMobileLandscapeSettingsLayout() {
  const w = app.screen.width;
  const h = app.screen.height;
  const aspect = w / h;

  const mobileish = !!IS_TOUCH || w < 820 || aspect < 0.90;
  return mobileish && w > h;
}

function buildPaytableSection() {
  const section = new Container();

const title = new Text("PAYTABLE", new TextStyle(localizeInfoSystemStyle({
  fontSize: 26,
  fill: 0xffffff,
  align: "center",
} as any)));
  title.anchor.set(0.5, 0);
  section.addChild(title);




  // ---- PAYTABLE DATA ----
  const PAY_BANDS = [
    { min: 5,  max: 6,  L:[0.40,0.55,0.75,1.00], H:[0.60,0.85,1.15,1.55,2.00] },
    { min: 7,  max: 8,  L:[0.85,1.10,1.55,2.10], H:[1.30,1.80,2.45,3.30,4.30] },
    { min: 9,  max:10,  L:[1.20,1.60,2.25,3.00], H:[2.00,2.90,4.10,5.80,7.50] },
    { min:11,  max:12,  L:[2.00,2.70,3.80,5.00], H:[3.10,4.70,6.80,9.80,12.5] },
    { min:13,  max:15,  L:[3.60,4.80,6.80,8.80], H:[4.80,7.60,11.5,16.0,20.0] },
    { min:16,  max:19,  L:[6.60,8.80,12.6,16.0], H:[9.50,15.8,25.0,37.0,47.0] },
    { min:20,  max:999, L:[12.5,17.5,25.0,33.0], H:[18.5,31.0,56.0,96.0,120.0] },
  ] as const;

  const fmtBandRange = (min: number, max: number) => (max >= 999 ? `${min}+` : `${min}–${max}`);

  function makePayCard(iconFrame: string, lines: { left: string; right: string }[]) {
  const c = new Container();

  // --- ICON (above) ---
  const icon = new Sprite(texSymbols(iconFrame));
  icon.anchor.set(0.5, 0); // top center
  c.addChild(icon);

  // --- BOX ---
  const bg = new Graphics();
  c.addChild(bg);

  const lineStyle = new TextStyle(localizeInfoSystemStyle({
    fontSize: 18,
    fill: 0xffffff,
    align: "center",
  } as any));

  const rowTexts: Text[] = [];
  for (const ln of lines) {
    const t = new Text(`${ln.left} | ${ln.right}`, lineStyle);
    t.anchor.set(0.5, 0);
    rowTexts.push(t);
    c.addChild(t);
  }

  (c as any).__layout = (w: number) => {
    const ICON_H = 90;      // tweak to taste
    const GAP = 10;
    const PAD_T = 14;
    const PAD_B = 14;
    const GAP_L = 8;

    // scale icon to a fixed height (RESET first to avoid scale ping-pong)
icon.scale.set(1);
const s = ICON_H / Math.max(1, icon.height);
icon.scale.set(s);
    icon.x = Math.round(w / 2);
    icon.y = 0;

    const boxY = Math.round(icon.y + icon.height + GAP);

    let y = boxY + PAD_T;
    for (const t of rowTexts) {
      t.x = Math.round(w / 2);
      t.y = Math.round(y);
      y += t.height + GAP_L;
    }

    const boxH = Math.round((y - boxY) + PAD_B);

    bg.clear();
    bg
      .roundRect(0, boxY, w, boxH, 10)
      .fill({ color: 0x000000, alpha: 0.001 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.55 });

    return { w, h: boxY + boxH };
  };

  return c;
}
function makeRuleCard(iconFrame: string, heading: string, lines: string[]) {
  const c = new Container();

  const icon = new Sprite(texSymbols(iconFrame));
  icon.anchor.set(0.5, 0);
  c.addChild(icon);

  const bg = new Graphics();
  c.addChild(bg);

  const headingStyle = new TextStyle(localizeInfoSystemStyle({
    fontSize: 20,
    fill: 0xffd36a,
    align: "center",
  } as any));

  const lineStyle = new TextStyle(localizeInfoSystemStyle({
    fontSize: 18,
    fill: 0xffffff,
    align: "center",
  } as any));

  const tHeading = new Text(heading, headingStyle);
  tHeading.anchor.set(0.5, 0);
  c.addChild(tHeading);

  const rowTexts: Text[] = [];
  for (const s of lines) {
    const t = new Text(s, lineStyle);
    t.anchor.set(0.5, 0);
    rowTexts.push(t);
    c.addChild(t);
  }

  (c as any).__layout = (w: number) => {
    const ICON_H = 90;
    const GAP = 10;
    const PAD_T = 14;
    const PAD_B = 14;
    const GAP_L = 8;

 // scale icon to a fixed height (RESET first to avoid scale ping-pong)
icon.scale.set(1);
const s = ICON_H / Math.max(1, icon.height);
icon.scale.set(s);
    icon.x = Math.round(w / 2);
    icon.y = 0;

    const boxY = Math.round(icon.y + icon.height + GAP);

    let y = boxY + PAD_T;

    tHeading.x = Math.round(w / 2);
    tHeading.y = Math.round(y);
    y += tHeading.height + GAP_L;

    for (const t of rowTexts) {
      t.x = Math.round(w / 2);
      t.y = Math.round(y);
      y += t.height + GAP_L;
    }

    const boxH = Math.round((y - boxY) + PAD_B);

    bg.clear();
    bg
      .roundRect(0, boxY, w, boxH, 10)
      .fill({ color: 0x000000, alpha: 0.25 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.55 });

    return { w, h: boxY + boxH };
  };

  return c;
}


  const lowFrames = [
  "symbol_low_L1_gummy.png",
  "symbol_low_L2_gummy.png",
  "symbol_low_L3_gummy.png",
  "symbol_low_L4_gummy.png",
];
const highFrames = [
  "symbol_high_H1_choco.png",
  "symbol_high_H2_choco.png",
  "symbol_high_H3_hard.png",
  "symbol_high_H4_hard.png",
  "symbol_high_H5_hard.png",
];

  const row1 = new Container();
  const row2 = new Container();
  section.addChild(row1, row2);
  // ✅ Feature symbols row (WILD + SCATTER)
const featureRow = new Container();
section.addChild(featureRow);

const wildCard = makeRuleCard(
  "symbol_wild_W1_gummy.png",
  "WILD",
  ["Substitutes for all symbols", "Except SCATTER"]
);

const scatterCard = makeRuleCard(
  "symbol_scatter_S1_gold.png",
  "SCATTER",
  ["3+ triggers FREE SPINS", "Base: awards 10", "In FS: awards 5"]
);

featureRow.addChild(wildCard, scatterCard);


  const lowCards = lowFrames.map((frame, i) =>
  makePayCard(frame, PAY_BANDS.map(b => ({
    left: fmtBandRange(b.min, b.max),
    right: `${b.L[i]}x`,
  })))
);

const highCards = highFrames.map((frame, i) =>
  makePayCard(frame, PAY_BANDS.map(b => ({
    left: fmtBandRange(b.min, b.max),
    right: `${b.H[i]}x`,
  })))
);


  lowCards.forEach(c => row1.addChild(c));
  highCards.forEach(c => row2.addChild(c));

 (section as any).__layout = (viewportW: number, portrait: boolean = false) => {
  const GAP_X = 26, GAP_Y = 28, PAD_TOP = 10;

  title.x = Math.round(viewportW / 2);
  title.y = 0;

  let y = Math.round(title.y + title.height + PAD_TOP);
  // ✅ Layout featureRow first (2 cards)
{
  const cols = portrait ? 1 : 2;
const gapX = 26;
const gapY = 18;
const sidePad = 10;

featureRow.visible = true;
featureRow.x = 0;
featureRow.y = y;

const kids = [wildCard, scatterCard] as any[];

if (cols === 1) {
  // ✅ portrait: stack vertically
  const cardW = Math.max(260, Math.floor(viewportW - sidePad * 2));
  const xCard = Math.round((viewportW - cardW) / 2);

  let yy = 0;
  for (const ch of kids) {
    ch.x = xCard;
    ch.y = yy;
    const size = ch.__layout(cardW);
    yy += (size?.h ?? ch.height) + gapY;
  }

  y += yy + 12;
} else {
  // ✅ desktop/tablet: 2-up
  const cardW = Math.max(160, Math.floor((viewportW - sidePad * 2 - gapX) / 2));
  const totalW = 2 * cardW + gapX;
  let x = Math.round((viewportW - totalW) / 2);

  let rowH = 0;
  for (const ch of kids) {
    ch.x = x;
    ch.y = 0;
    const size = ch.__layout(cardW);
    rowH = Math.max(rowH, size?.h ?? ch.height);
    x += cardW + gapX;
  }

  y += rowH + 24;
}

}


if (portrait) {
  const sidePad = 10;
  const cardW = Math.max(260, Math.floor(viewportW - sidePad * 2));
  const xCard = Math.round((viewportW - cardW) / 2);
  const gap = 18;

  // ✅ keep parents visible (cards live inside them)
  row1.visible = true;
  row2.visible = true;

  // Row 1 (L symbols) stacked vertically
  row1.x = 0;
  row1.y = y;

  let yy = 0;
  for (const ch of lowCards as any[]) {
    ch.visible = true;
    ch.x = xCard;
    ch.y = yy;

    const size = ch.__layout(cardW);
    yy += (size?.h ?? ch.height) + gap;
  }

  y += yy;

  // Row 2 (H symbols) stacked vertically
  row2.x = 0;
  row2.y = y;

  yy = 0;
  for (const ch of highCards as any[]) {
    ch.visible = true;
    ch.x = xCard;
    ch.y = yy;

    const size = ch.__layout(cardW);
    yy += (size?.h ?? ch.height) + gap;
  }

  y += yy;

  return { h: y };
}


  // ✅ DESKTOP/TABLET: your original 2-row layout
  row1.visible = true;
  row2.visible = true;

  // make sure cards are visible (if we previously hid them)
  lowCards.forEach(c => (c.visible = true));
  highCards.forEach(c => (c.visible = true));

  const row1Cols = 4;
  const row2Cols = 5;

  const maxCardW1 = Math.floor((viewportW - GAP_X * (row1Cols - 1)) / row1Cols);
  const maxCardW2 = Math.floor((viewportW - GAP_X * (row2Cols - 1)) / row2Cols);
  const cardW = Math.max(120, Math.min(maxCardW1, maxCardW2));

  // row1
  row1.y = y;
  {
    const totalW = row1Cols * cardW + (row1Cols - 1) * GAP_X;
    let x = Math.round((viewportW - totalW) / 2);

    let rowH = 0;
    for (const ch of row1.children as any[]) {
      ch.x = x;
      ch.y = 0;
      const size = ch.__layout(cardW);
      rowH = Math.max(rowH, size.h);
      x += cardW + GAP_X;
    }
    y += rowH + GAP_Y;
  }

  // row2
  row2.y = y;
  {
    const totalW = row2Cols * cardW + (row2Cols - 1) * GAP_X;
    let x = Math.round((viewportW - totalW) / 2);

    let rowH = 0;
    for (const ch of row2.children as any[]) {
      ch.x = x;
      ch.y = 0;
      const size = ch.__layout(cardW);
      rowH = Math.max(rowH, size.h);
      x += cardW + GAP_X;
    }
    y += rowH;
  }

  return { h: y };
};


  return section;
}


  // =====================
  // SETTINGS SUBMENU (overlay)
  // =====================
  // ✅ baseline used so settings scales immediately from the size you opened it at

  const settingsMenuLayer = new Container();
settingsMenuLayer.zIndex = 9000;
root.addChild(settingsMenuLayer);
settingsMenuLayer.visible = false;
settingsMenuLayer.eventMode = "static";
settingsMenuLayer.cursor = "default";

// =====================
// INFO MODAL (Game Rules / Paytable)
// =====================
const infoLayer = new Container();
infoLayer.zIndex = 9500;
infoLayer.visible = false;
infoLayer.eventMode = "static";
settingsMenuLayer.addChild(infoLayer);

// backdrop (click outside to close)
const infoBackdrop = new Graphics();
infoBackdrop.eventMode = "static";
infoBackdrop.cursor = "default";
infoBackdrop.on("pointertap", () => hideInfo());
infoLayer.addChild(infoBackdrop);

// panel
const infoPanel = new Graphics();
infoPanel.eventMode = "static";
infoPanel.cursor = "default";
infoPanel.on("pointertap", (e: any) => e.stopPropagation?.());
infoLayer.addChild(infoPanel);

// title
const infoModalTitle = new Text(
  uiLabel("ui.gameInfoTitle", "BLOCKY FARM – GAME INFO"),
  new TextStyle(localizeSettingsStyle({
    fontSize: 38,
    fill: 0xffd36a,
    letterSpacing: 2,
    stroke: { color: 0x000000, width: 4 },
  } as any))
);
infoModalTitle.anchor.set(0.5, 0);
infoLayer.addChild(infoModalTitle);

// ---- Scroll viewport + mask ----
const infoScrollViewport = new Container();
infoLayer.addChild(infoScrollViewport);

const infoMask = new Graphics();
infoLayer.addChild(infoMask);
infoScrollViewport.mask = infoMask;

// content container (local coords inside viewport)
const infoContent = new Container();
infoScrollViewport.addChild(infoContent);

// We’ll use 2 text blocks + a paytable section in-between
const INFO_TEXT_TOP_EN = `
GAME RULES

Blocky Farm is a 6×5 tumbling slot game that pays wins in clusters.
A win is formed when 5 or more identical symbols connect horizontally and/or vertically.
Diagonal connections do NOT form a cluster win.

Winning symbols explode and are removed from the grid.
New symbols tumble into place and may create additional wins.
This process continues until no further winning clusters are formed.

WAYS TO WIN
• Land 5 or more matching symbols anywhere on the grid to form a cluster win
• Winning symbols tumble and can trigger multiple wins in a single spin
• Wild symbols substitute for all regular symbols except Scatter symbols


GLOBAL MULTIPLIER
• Starts at 1× on every spin
• Advances on every winning tumble:
  1× → 2× → 3× → 5× → 8× → 12× → 20×
• Resets when no further winning tumbles occur in the base game


FREE SPINS
• In the base game, 3 or more Scatter symbols trigger 10 Free Spins
• During Free Spins, 3 or more Scatters award 5 additional Free Spins
• Free Spins use the same tumbling and cluster mechanics as the base game
• The Global Multiplier does NOT reset between Free Spins
• The multiplier can advance a maximum of one step per Free Spin
• Multiplier progression persists for the entire Free Spins session


BONUS BUY
• Players may purchase entry into a Free Spins feature
• SUPER starts with 10 Free Spins at a 3× starting multiplier
• ULTRA starts with 10 Free Spins at a 5× starting multiplier
• Bonus Buy modes enter the feature directly without requiring Scatter symbols


SECOND CHANCE WILD
After a winning spin finishes tumbling, if no further cluster wins are available:
• A Wild symbol may randomly land anywhere on the grid
• This may create one additional opportunity for a final cluster win


BOOSTED WILDS
If a winning cluster contains 2 or more Wild symbols:
• That cluster’s paytable value is boosted by 1.25×
• The boost applies only to the affected cluster
• The boost is applied before the Global Multiplier


INFUSED SCATTERS
If exactly 2 Scatter symbols are present on the grid when a winning tumble occurs:
• That winning tumble is infused
• The Global Multiplier temporarily advances by one additional step for that tumble
• This effect can occur once per spin


Music by: 
Cody O’Quinn
`;

const INFO_TEXT_BOTTOM_EN = `
GENERAL TERMS

GAME MODES

BASE GAME
• Cost: 1× bet
• RTP: 97.08%
• Maximum win: 27.58× the bet

SUPER BONUS BUY
• Cost: 89× bet
• RTP: 97.08%
• Starts with 10 Free Spins at 3× starting multiplier
• Maximum win: 769× the bet

ULTRA BONUS BUY
• Cost: 100× bet
• RTP: 96.99%
• Starts with 10 Free Spins at 5× starting multiplier
• Maximum win: 704.8× the bet

• Theoretical RTP is approximately 97% over a long period of play
• All wins are paid according to the paytable and active multipliers

Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2025 Stake Engine
`;


type InfoBundle = {
  INFO_TEXT_TOP: string;
  INFO_TEXT_BOTTOM: string;
};

function getInfoBundle(lang: string): InfoBundle {
  const hit = (infoI18n as any)[lang] as InfoBundle | undefined;
  if (hit?.INFO_TEXT_TOP && hit?.INFO_TEXT_BOTTOM) {
    return hit;
  }
  return {
    INFO_TEXT_TOP: INFO_TEXT_TOP_EN,
    INFO_TEXT_BOTTOM: INFO_TEXT_BOTTOM_EN,
  };
}

const infoTextStyle = new TextStyle(localizeInfoSystemStyle({
  fontSize: 20,
  fill: 0xffffff,
  align: "center",
  wordWrap: true,
  wordWrapWidth: 760, // updated in layoutInfo()
  lineHeight: 30,
} as any));

const infoBodyTop = new Text(INFO_TEXT_TOP_EN, infoTextStyle);
infoBodyTop.anchor.set(0.5, 0);

const infoBodyBottom = new Text(INFO_TEXT_BOTTOM_EN, infoTextStyle);
infoBodyBottom.anchor.set(0.5, 0);

infoContent.addChild(infoBodyTop);

// ✅ paytable section (create once)
const paytableSection = buildPaytableSection();

// ✅ define FIRST
function buildWaysExampleSection() {
  const section = new Container();

  const title = new Text(
    "WAYS TO WIN EXAMPLES",
    new TextStyle(localizeInfoSystemStyle({
      fontSize: 24,
      fill: 0xffffff,
      align: "center",
    } as any))
  );
  title.anchor.set(0.5, 0);
  section.addChild(title);

  const gridSize = 14;
  const cols = 6;
  const rows = 6;

  const labelStyle = new TextStyle(localizeInfoSystemStyle({
    fontSize: 14,
    fill: 0xffffff,
    align: "center",
  } as any));

  const badStyle = new TextStyle(localizeInfoSystemStyle({
    fontSize: 14,
    fill: 0xff3b30,
    align: "center",
  } as any));

  function drawBaseGrid(g: Graphics) {
    g.clear();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        g.rect(x * gridSize, y * gridSize, gridSize - 2, gridSize - 2)
          .fill({ color: 0x555555 });
      }
    }
  }

  function fillCell(g: Graphics, x: number, y: number, col: number) {
    g.rect(x * gridSize, y * gridSize, gridSize - 2, gridSize - 2)
      .fill({ color: col });
  }

  function makeExampleBlock(opts: {
    heading: string;
    headingColor?: number;
    kind: "H" | "V" | "M" | "D";
    showRedX?: boolean;
  }) {
    const wrap = new Container();

    const head = new Text(
      opts.heading,
      new TextStyle(localizeInfoSystemStyle({
        fontSize: 14,
        fill: opts.headingColor ?? 0xffffff,
        align: "center",
      } as any))
    );
    head.anchor.set(0.5, 0);

    const g = new Graphics();

    // draw grid + highlight
    drawBaseGrid(g);

    const blue = 0x4a8cff;

    if (opts.kind === "H") {
      for (let i = 0; i < 5; i++) fillCell(g, 1 + i, 2, blue);
    } else if (opts.kind === "V") {
      for (let i = 0; i < 5; i++) fillCell(g, 2, 1 + i, blue);
    } else if (opts.kind === "M") {
      // any-shape cluster (orthogonally connected)
      fillCell(g, 2, 1, blue);
      fillCell(g, 2, 2, blue);
      fillCell(g, 2, 3, blue);
      fillCell(g, 3, 3, blue);
      fillCell(g, 4, 3, blue);
    } else {
      // D = diagonal (not counted)
      for (let i = 0; i < 5; i++) fillCell(g, 1 + i, 1 + i, blue);
    }

  

    wrap.addChild(head, g);
 

    (wrap as any).__layout = (w: number) => {
      const gridW = cols * gridSize;
      const gridH = rows * gridSize;

      head.x = Math.round(w / 2);
      head.y = 0;

      g.x = Math.round((w - gridW) / 2);
      g.y = Math.round(head.height + 10);

   

      return { h: Math.round(g.y + gridH) };
    };

    return wrap;
  }

  // ✅ Valid examples (top row)
  const goodBlocks = [
    makeExampleBlock({ heading: "HORIZONTAL", kind: "H" }),
    makeExampleBlock({ heading: "VERTICAL", kind: "V" }),
    makeExampleBlock({ heading: "ANY SHAPE (CLUSTER)", kind: "M" }),
  ];

 const badBlock = makeExampleBlock({
  heading: "DIAGONAL (NOT COUNTED)",
  headingColor: 0xff3b30,
  kind: "D",
});

  goodBlocks.forEach((b) => section.addChild(b));
  section.addChild(badBlock);

  (section as any).__layout = (w: number) => {
    title.x = Math.round(w / 2);
    title.y = 0;

    let y = Math.round(title.height + 18);

    // ----- Row 1: 3-up if wide enough, else stack -----
    const row1Use3Up = w >= 720;
    const row1Cols = row1Use3Up ? 3 : 1;
    const row1GapX = row1Use3Up ? 36 : 0;
    const rowGapY = 22;

    const row1CellW = Math.max(1, Math.floor((w - row1GapX * (row1Cols - 1)) / row1Cols));
    const row1StartX = Math.round((w - (row1CellW * row1Cols + row1GapX * (row1Cols - 1))) / 2);

    let row1H = 0;
    for (let i = 0; i < goodBlocks.length; i++) {
      const r = Math.floor(i / row1Cols);
      const c = i % row1Cols;

      const b: any = goodBlocks[i];
      b.x = row1StartX + c * (row1CellW + row1GapX);
      b.y = y + r * ( (b.__layout(row1CellW).h ?? b.height) + rowGapY );
      const h = b.__layout(row1CellW).h ?? b.height;
      row1H = Math.max(row1H, h);
    }

    // advance y past row1 (handle stacked case too)
    const row1Rows = Math.ceil(goodBlocks.length / row1Cols);
    y += row1Rows * (row1H + rowGapY);

    // ----- Row 2: Bad example centered -----
    const badW = Math.min(w, 520); // keep it a bit tighter
    const bx = Math.round((w - badW) / 2);

    (badBlock as any).x = bx;
    (badBlock as any).y = y;

    const badH = (badBlock as any).__layout?.(badW)?.h ?? badBlock.height;

    y += badH;

    return { h: y };
  };

  return section;
}

// ✅ create once AFTER it's defined
const waysExampleSection = buildWaysExampleSection();

infoContent.addChild(waysExampleSection);
infoContent.addChild(paytableSection);
infoContent.addChild(infoBodyBottom);

// scrolling state
let infoScrollY = 0;
let infoViewportX = 0;
let infoViewportY = 0;
let infoViewportW = 0;
let infoViewportH = 0;

// drag to scroll (MOBILE PORTRAIT ONLY) — thumb scroll on the viewport
let dragEnabled = false;
let dragging = false;
let dragStartY = 0;
let scrollStartY = 0;
let infoPanelRect = new Rectangle(); // ✅ used to restrict drag + wheel to the panel


function setInfoDragEnabled(v: boolean) {
  dragEnabled = v;

  // Enable pointer events on both the panel and the viewport
  infoScrollViewport.eventMode = v ? "static" : "passive";
  infoPanel.eventMode = "static"; // panel must remain static so it catches drags

  infoScrollViewport.cursor = v ? "grab" : "default";

  // Clear old listeners
  infoScrollViewport.removeAllListeners?.();
  infoPanel.removeAllListeners?.("pointerdown");
  infoPanel.removeAllListeners?.("pointerup");
  infoPanel.removeAllListeners?.("pointerupoutside");
  infoPanel.removeAllListeners?.("pointermove");

  if (!v) return;

  const startDrag = (e: any) => {
    e.stopPropagation?.();

    // only allow drag if the pointer is inside the panel rect
    const gx = e.global?.x ?? 0;
    const gy = e.global?.y ?? 0;
    if (!infoPanelRect.contains(gx, gy)) return;

    dragging = true;
    dragStartY = gy;
    scrollStartY = infoScrollY;

    infoScrollViewport.cursor = "grabbing";
  };

  const endDrag = (e?: any) => {
    e?.stopPropagation?.();
    dragging = false;
    infoScrollViewport.cursor = "grab";
  };

  const moveDrag = (e: any) => {
    if (!dragEnabled || !dragging) return;
    e.stopPropagation?.();

    const gy = e.global?.y ?? 0;
    const dy = gy - dragStartY;

    // drag up => content moves up (scroll down)
    setInfoScroll(scrollStartY + dy);
  };

  // ✅ dragging anywhere on the panel scrolls
  infoPanel.on("pointerdown", startDrag);
  infoPanel.on("pointermove", moveDrag);
  infoPanel.on("pointerup", endDrag);
  infoPanel.on("pointerupoutside", endDrag);

  // ✅ dragging directly on the viewport also scrolls (same handlers)
  infoScrollViewport.on("pointerdown", startDrag);
  infoScrollViewport.on("pointermove", moveDrag);
  infoScrollViewport.on("pointerup", endDrag);
  infoScrollViewport.on("pointerupoutside", endDrag);
}



function getInfoContentHeight() {
  const b = infoContent.getLocalBounds();
  return b.y + b.height;
}

function setInfoScroll(y: number) {
  const contentH = getInfoContentHeight();
  const minY = Math.min(0, infoViewportH - contentH);

  if (y < minY) y = minY;
  if (y > 0) y = 0;

  infoScrollY = y;
  infoScrollViewport.y = Math.round(infoViewportY + infoScrollY);
}
function onInfoWheel(e: WheelEvent) {
  if (!infoLayer.visible) return;

  // ✅ always allow wheel/trackpad scroll while INFO is open
  e.preventDefault();
  e.stopPropagation?.();

  setInfoScroll(infoScrollY - e.deltaY);
}



const infoWheelOpts = { passive: false, capture: true } as AddEventListenerOptions;

// ✅ Pixi v8: use app.canvas (NOT app.view)
(app.canvas as any)?.addEventListener?.("wheel", onInfoWheel, infoWheelOpts);

// ✅ fallback: some embedded views deliver wheel to window
window.addEventListener("wheel", onInfoWheel, infoWheelOpts);

// ✅ document fallback
document.addEventListener("wheel", onInfoWheel, infoWheelOpts);













// close button (X)
const infoClose = new Graphics();
infoClose.eventMode = "static";
infoClose.cursor = "pointer";
infoClose.on("pointertap", () => hideInfo());
infoLayer.addChild(infoClose);

function showInfo() {
  infoLayer.visible = true;
  refreshInfoTextForLanguage();  // ✅ set correct language
  layoutInfo();                  // ✅ then measure + layout
}
function hideInfo() {
  infoLayer.visible = false;
}

function isMobilePortraitInfoLayout(W: number, H: number) {
  const aspect = W / H;
  const mobileish = !!IS_TOUCH || W < 820 || aspect < 0.90;
  return mobileish && H >= W; // portrait
}

function refreshInfoTextForLanguage() {
  const lang = getLang();
  const b = getInfoBundle(lang);

  infoBodyTop.text = b.INFO_TEXT_TOP;
  infoBodyBottom.text = b.INFO_TEXT_BOTTOM;

  // ✅ Force center alignment (including Arabic)
  infoBodyTop.style.align = "center";
  infoBodyBottom.style.align = "center";

  infoBodyTop.anchor.x = 0.5;
  infoBodyBottom.anchor.x = 0.5;
}

// ✅ Tiny-view scaling for Settings overlay only


function isTinyView(): boolean {
  return !!state?.ui?.IS_TINY_VIEW;
}

const INFO_FONT_NORMAL = 20;
const INFO_LINE_NORMAL = 30;

const INFO_FONT_TINY = 14;   // 🔧 try 13..16
const INFO_LINE_TINY = 20;   // 🔧 try 18..22

function isTabletLikeInfoLayout(W: number, H: number) {
  // same “mobileish” heuristic you use elsewhere
  const aspect = W / H;
  const mobileish = !!IS_TOUCH || W < 820 || aspect < 0.90;
  const tabletish = mobileish && Math.min(W, H) >= 740; // matches your tablet threshold vibe
  return tabletish;
}

function fitInfoTitleToWidth(maxW: number) {
  // reset first so we don't "ping-pong" shrink on repeated layout calls
  infoModalTitle.scale.set(1);

  const b = infoModalTitle.getLocalBounds();
  const w = Math.max(1, b.width);

  if (w <= maxW) return;

  const s = maxW / w;

  // clamp so it doesn't become microscopic
  const MIN_S = 0.72; // 🔧 try 0.65..0.80
  infoModalTitle.scale.set(Math.max(MIN_S, s));
}

function layoutInfo() {
 
const W = app.screen.width;
const H = app.screen.height;

// ✅ Tiny view: shrink INFO body typography
const fs = isTinyView() ? INFO_FONT_TINY : INFO_FONT_NORMAL;
const lh = isTinyView() ? INFO_LINE_TINY : INFO_LINE_NORMAL;

(infoBodyTop.style as any).fontSize = fs;
(infoBodyBottom.style as any).fontSize = fs;

(infoBodyTop.style as any).lineHeight = lh;
(infoBodyBottom.style as any).lineHeight = lh;


const cx = Math.round(W / 2);
const cy = Math.round(H / 2); // ✅ no -20 in tiny view for info either
applyTinyMainScale(cx, cy);
  const LAND = isMobileLandscapeSettingsLayout();

  // backdrop
  infoBackdrop.clear();
  infoBackdrop.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.7 });

// ✅ Larger INFO modal (independent of Settings size)
const panelW = Math.min(900, Math.round(W * 0.9));
const panelH = Math.min(700, Math.round(H * 0.85));
  const x = (W - panelW) / 2;
  const y = (H - panelH) / 2;

  // ✅ panel rect used for scrolling + hit testing
infoPanelRect = new Rectangle(Math.round(x), Math.round(y), Math.round(panelW), Math.round(panelH));

// ✅ make the panel catch pointer events everywhere inside it
infoPanel.hitArea = infoPanelRect;




  infoPanel.clear();
  infoPanel
    .roundRect(x, y, panelW, panelH, 16)
    .fill({ color: 0x0b0b0b, alpha: 0.95 })
    .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });

 infoModalTitle.x = Math.round(W / 2);
infoModalTitle.y = Math.round(y + 20);

// ✅ Tiny view only: force title to fit inside the panel width
if (isTinyView()) {
  // panel inner width (account for padding)
  const pad = 30;
  const titleMaxW = Math.max(1, panelW - pad * 2);
  fitInfoTitleToWidth(titleMaxW);
}


  // viewport rectangle (inside the panel)
  const pad = 30;
  const titleH = 90;

  infoViewportX = Math.round(x + pad);
  infoViewportY = Math.round(y + titleH);
  infoViewportW = Math.round(panelW - pad * 2);
  infoViewportH = Math.round(panelH - titleH - pad);

  // position viewport container (world coords)
  infoScrollViewport.x = infoViewportX;
  infoScrollViewport.y = infoViewportY;

  // ✅ keep the scroll viewport interactive (so dragging on content works too)
infoScrollViewport.hitArea = new Rectangle(0, 0, infoViewportW, infoViewportH);

  // content is local to viewport
  infoContent.x = 0;
  infoContent.y = 0;

  // update wrapping width
  (infoBodyTop.style as any).wordWrapWidth = infoViewportW;
  (infoBodyBottom.style as any).wordWrapWidth = infoViewportW;

  // ✅ Mobile portrait: split header into 2 lines
const PORTRAIT_INFO = isMobilePortraitInfoLayout(W, H);
if (PORTRAIT_INFO) {
  infoModalTitle.text = "BLOCKY FARM\nGAME INFO";
  (infoModalTitle.style as any).align = "center";
  (infoModalTitle.style as any).lineHeight = 40;
} else {
  infoModalTitle.text = uiLabel("ui.gameInfoTitle", "BLOCKY FARM – GAME INFO");
  (infoModalTitle.style as any).lineHeight = 0;
}

// ✅ Drag-scroll enable (keep your current rules if you want to refine later)
setInfoDragEnabled(true);

// layout children vertically (local coords)
infoBodyTop.x = Math.round(infoViewportW / 2);
infoBodyTop.y = 0;

// ✅ Ways example (between top text and paytable)
waysExampleSection.x = 0;
waysExampleSection.y = Math.round(infoBodyTop.y + infoBodyTop.height + 26);

const waysSize = (waysExampleSection as any).__layout?.(infoViewportW);
const afterWaysY = Math.round(
  waysExampleSection.y + (waysSize?.h ?? waysExampleSection.height) + 26
);

// ✅ Paytable (after ways example)
paytableSection.x = 0;
paytableSection.y = afterWaysY;

const paySize = (paytableSection as any).__layout?.(infoViewportW, PORTRAIT_INFO);
const payEndY = Math.round(
  paytableSection.y + (paySize?.h ?? paytableSection.height) + 26
);

// Bottom text after paytable
infoBodyBottom.x = Math.round(infoViewportW / 2);
infoBodyBottom.y = payEndY;

  // mask (world coords)
  infoMask.clear();
  infoMask
    .rect(infoViewportX, infoViewportY, infoViewportW, infoViewportH)
    .fill({ color: 0xffffff, alpha: 1 });

  // clamp + apply scroll
  setInfoScroll(infoScrollY);



// ✅ Close button — top-right of INFO panel
const closeX = Math.round(x + panelW - 30);
const closeY = Math.round(y + 30);

infoClose.clear();
infoClose
  .circle(closeX, closeY, 16)
  .fill({ color: 0x000000, alpha: 0.4 })
  .stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
  .moveTo(closeX - 6, closeY - 6).lineTo(closeX + 6, closeY + 6)
  .moveTo(closeX + 6, closeY - 6).lineTo(closeX - 6, closeY + 6)
  .stroke({ width: 3, color: 0xffffff });

}


  let settingsPanelRect = new Rectangle();

  // click-blocker full screen (invisible) — MUST stay unscaled
const settingsBlocker = new Graphics();
settingsMenuLayer.addChild(settingsBlocker);

// ✅ Wrap panel+content so we can scale them around screen center (tiny view only)
const settingsMain = new Container();
settingsMenuLayer.addChild(settingsMain);



function applyTinyMainScale(cx: number, cy: number) {
  const mul = isTinyView() ? 0.82 : 1; // 🔧 tweak 0.78..0.88

  if (mul !== 1) {
    settingsMain.pivot.set(cx, cy);
    settingsMain.position.set(cx, cy);
    settingsMain.scale.set(mul);
  } else {
    settingsMain.scale.set(1);
    settingsMain.pivot.set(0, 0);
    settingsMain.position.set(0, 0);
  }
}


// main panel (rounded rect)
const settingsPanel = new Graphics();
settingsMain.addChild(settingsPanel);

// ✅ All UI elements that must visually scale live in here
const settingsContent = new Container();
settingsMain.addChild(settingsContent);


  // swallow clicks inside panel
  settingsPanel.eventMode = "static";
  settingsPanel.cursor = "default";
  settingsPanel.on("pointerdown", (e: any) => e.stopPropagation?.());
  settingsPanel.on("pointertap",  (e: any) => e.stopPropagation?.());

  // INFO row
  const infoRow = new Container();
settingsContent.addChild(infoRow);

  const infoBtnBg = new Graphics();
  infoRow.addChild(infoBtnBg);
  infoBtnBg.alpha = 0;

  const infoIcon = new Sprite(texUI(ICON_INFO));
  infoIcon.anchor.set(0.5);
  infoIcon.eventMode = "none";

const infoTitle = new Text({
  text: uiLabel("ui.info", "INFO"),
  style: localizeSettingsStyle({
    fill: 0xffd36a,
    fontSize: 35,
    fontWeight: "100",
    letterSpacing: 2,
    stroke: { color: 0x000000, width: 4 },
  } as any),
} as any);


  infoTitle.anchor.set(0, 0.5);
  infoTitle.eventMode = "none";

  infoRow.addChild(infoIcon, infoTitle);
  infoRow.eventMode = "static";
  infoRow.cursor = "pointer";
 infoRow.on("pointertap", (e: any) => {
  e.stopPropagation?.();
  showInfo();
});
  infoRow.on("pointerover", () => { infoBtnBg.alpha = 0.35; });
  infoRow.on("pointerout",  () => { infoBtnBg.alpha = 0; });

 function layoutInfoRow(cx: number, y: number, panelW: number, uiScale: number) {
  const BTN_W = Math.round(panelW * 0.86);
  const BTN_H = Math.round((isMobileLandscapeSettingsLayout() ? 56 : 70) * uiScale);

  const R = 18;

  const ICON_X = -BTN_W / 2 + Math.round(48 * uiScale);
  const TEXT_X = ICON_X + Math.round(34 * uiScale);

  infoRow.x = cx - Math.round(12 * uiScale);
  infoRow.y = y;

  infoBtnBg.clear();
  infoBtnBg.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, R).fill(0x000000);

  infoRow.hitArea = new Rectangle(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);

  infoIcon.x = ICON_X;
  infoIcon.y = 0;

  infoTitle.x = TEXT_X;
  infoTitle.y = 0;
}


  // close button
  const closeSettingsBtn = makePngButton(
    CLOSE_UP, CLOSE_HOVER, CLOSE_DOWN,
    () => closeFromOutside()
  );
  settingsContent.addChild(closeSettingsBtn);

  const SETTINGS_CLOSE_HIT = 200;
  closeSettingsBtn.hitArea = new Rectangle(
    -SETTINGS_CLOSE_HIT / 2,
    -SETTINGS_CLOSE_HIT / 2,
    SETTINGS_CLOSE_HIT,
    SETTINGS_CLOSE_HIT
  );

    const sfxSlider = makeSlider(ICON_SFX_ON, ICON_SFX_OFF, getSfxValue01(), (v01: number) => {
    // ✅ persist slider value (this calls audio.setSfxVolume01 in main)
    setSfxValue01(v01);

    // ✅ auto-mute when dragged to 0
    const m = v01 <= 0.001;
    setSfxMuted(m);

    // ✅ update icon immediately
    (sfxSlider as any).setMuted?.(getSfxMuted());

    // ✅ apply real audio routing now
    applyAudioUI();
  });



   const musicSlider = makeSlider(ICON_MUSIC_ON, ICON_MUSIC_OFF, getMusicValue01(), (v01: number) => {
    // ✅ persist slider value (this calls audio.setMusicVolume01 in main)
    setMusicValue01(v01);

    const m = v01 <= 0.001;
    setMusicMuted(m);

    (musicSlider as any).setMuted?.(getMusicMuted());

    applyAudioUI();
  });


  // click only icons to mute/unmute (reuses your slider hook)
 (sfxSlider as any).bindIconTap?.(() => {
  setSfxMuted(!getSfxMuted());
  (sfxSlider as any).setMuted?.(getSfxMuted()); // ✅ update icon immediately
  applyAudioUI();
});


  (musicSlider as any).bindIconTap?.(() => {
  setMusicMuted(!getMusicMuted());
  (musicSlider as any).setMuted?.(getMusicMuted()); // ✅ update icon immediately
  applyAudioUI();
});


  // capsule rows (like your current style)
  function makeCapsuleRow() {
    const row = new Container();
    const bg = new Graphics();
    row.addChild(bg);

    bg.visible = true;
    bg.alpha = 0;

    row.eventMode = "static";
    row.cursor = "pointer";
    row.on("pointerover", () => { bg.alpha = 0.35; });
    row.on("pointerout",  () => { bg.alpha = 0; });
    row.on("pointertap", (e) => (e as any).stopPropagation?.());

    (row as any)._bg = bg;
    return row as Container & { _bg?: Graphics };
  }

  const sfxRow = makeCapsuleRow();
  const musicRow = makeCapsuleRow();

  sfxRow.addChild(sfxSlider);
  musicRow.addChild(musicSlider);

settingsContent.addChild(sfxRow, musicRow);

  function layoutSettingsMenu() {

// ✅ hard reset — settingsMenuLayer must be screen space
settingsMenuLayer.scale.set(1);
settingsMenuLayer.position.set(0, 0);
      const LAND = isMobileLandscapeSettingsLayout();
        // ✅ tiny-view scale (only)

 const W = app.screen.width;
const H = app.screen.height;

const PORTRAIT_MOBILE = (W < 820 || (W / H) < 0.90) && H >= W;


    // blocker to screen size
  settingsBlocker.clear();
  settingsBlocker
    .rect(0, 0, W, H)
    .fill({ color: 0x000000, alpha: 0.35 });

    settingsBlocker.eventMode = "static";
    settingsBlocker.cursor = "default";

    // click outside closes
    settingsBlocker.removeAllListeners?.("pointertap");
    settingsBlocker.on("pointertap", () => closeFromOutside());

    // panel size

  


// ✅ portrait PHONE ONLY (exclude tablets + exclude tiny)
const shortSide = Math.min(W, H);
const PORTRAIT_PHONE =
  shortSide < 740 &&                 // ✅ tablet guard
  !state?.ui?.IS_TINY_VIEW &&        // ✅ don't touch tiny view
  (W < 820 || (W / H) < 0.90) &&
  H >= W;

// ✅ shrink settings menu ONLY in mobile portrait phone
const panelW = PORTRAIT_PHONE ? 340 : 420;          // 🔧 try 360..400
const panelH = LAND ? 260 : (PORTRAIT_PHONE ? 300 : 320); // 🔧 try 285..310




    const radius = 0;

const cx = Math.round(app.screen.width / 2);

// ✅ Tiny view: no vertical offset (400×225 can’t afford -20)
const cy = Math.round(app.screen.height / 2) - (state?.ui?.IS_TINY_VIEW ? 0 : 20);

applyTinyMainScale(cx, cy);



    settingsPanel.clear();
    settingsPanel
      .roundRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, radius)
 .fill({ color: 0x0b0b0b, alpha: 0.9 })
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });

    settingsPanelRect.x = cx - panelW / 2;
    settingsPanelRect.y = cy - panelH / 2;
    settingsPanelRect.width = panelW;
    settingsPanelRect.height = panelH;

   

// ✅ NO SCALING: fixed-size menu, just repositions as window changes
settingsContent.scale.set(1);
settingsContent.x = 0;
settingsContent.y = 0;

const BTN_W = Math.round(panelW * 0.86);
const BTN_H = LAND ? 56 : 70;

const topPad = LAND ? 56 : (PORTRAIT_MOBILE ? 70 : 90);
const rowGap = LAND ? 16 : 18;

// screen-space row Y (never inverts)
const rowInfoY = Math.round(cy - panelH / 2 + topPad);
const rowSfxY  = Math.round(rowInfoY + BTN_H + rowGap);
const rowMusY  = Math.round(rowSfxY  + BTN_H + rowGap);

// Place rows in SCREEN coords
layoutInfoRow(cx, rowInfoY, panelW, 1);
sfxRow.x = cx;   sfxRow.y = rowSfxY;
musicRow.x = cx; musicRow.y = rowMusY;

// Slider row backgrounds + slider layout (SCREEN units)
const leftPad  = LAND ? 74 : 40;
const rightPad = LAND ? 34 : 40;
const TRACK_X = 60;
const trackW = BTN_W - leftPad - rightPad - TRACK_X;

function drawRowBg(row: any) {
  const bg: Graphics = row._bg;
  bg.clear();
  bg.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 18).fill(0x000000);
  row.hitArea = new Rectangle(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);
}
drawRowBg(sfxRow);
drawRowBg(musicRow);

const sliderX = -BTN_W / 2 + leftPad;
sfxSlider.layout(sliderX, 0, trackW);
musicSlider.layout(sliderX, 0, trackW);


    // close button
closeSettingsBtn.x = cx + panelW / 2 - 36;
closeSettingsBtn.y = cy - panelH / 2 + 36;
    setScaleToHeight(closeSettingsBtn, panelH * 0.07);
  }

 function open() {
  infoTitle.text = uiLabel("ui.info", "INFO");
  infoModalTitle.text = uiLabel("ui.gameInfoTitle", "BLOCKY FARM – GAME INFO");

  // ✅ hide bottom UI / black bar
  uiDimmer.visible = false;

  settingsMenuLayer.visible = true;
  layoutSettingsMenu();
}

function close() {
  settingsMenuLayer.visible = false;

  // ✅ restore bottom UI / black bar
  uiDimmer.visible = true;
}

  function closeFromOutside() {
    hideInfo();
    if (!state.ui.settingsOpen) return;

    state.ui.settingsOpen = false;
    settingsBtnPixi.setOn(false);

    close();
    uiDimmer.visible = false;

    onClosed();
  }

  // resize hook
  window.addEventListener("resize", layoutSettingsMenu);
  layoutSettingsMenu();

  // sync initial visuals
 (sfxSlider as any).setMuted?.(getSfxMuted());
(musicSlider as any).setMuted?.(getMusicMuted());
applyAudioUI();


  return {
    layer: settingsMenuLayer,
    layout: layoutSettingsMenu,
    open,
    close,
    closeFromOutside,
  };
}
