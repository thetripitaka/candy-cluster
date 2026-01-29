
import { getLang } from "../i18n/i18n";
import { applyUiTextCase, localizeStyle, micro5ForLatinUiFontFamily } from "../i18n/uiTextStyle";
import { uiFontFamilyFor } from "../i18n/fonts";


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
// ✅ Info-modal-only: force *system/computer* font (no Pixeldown/Micro5)
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

// ✅ Info-modal-only: force SAFE fallback fonts (no Pixeldown/Micro5)
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

    // scale icon to a fixed height
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

  (section as any).__layout = (viewportW: number) => {
    const GAP_X = 26, GAP_Y = 28, PAD_TOP = 10;

    title.x = Math.round(viewportW / 2);
    title.y = 0;

    const row1Cols = 4;
    const row2Cols = 5;

    const maxCardW1 = Math.floor((viewportW - GAP_X * (row1Cols - 1)) / row1Cols);
    const maxCardW2 = Math.floor((viewportW - GAP_X * (row2Cols - 1)) / row2Cols);
    const cardW = Math.max(120, Math.min(maxCardW1, maxCardW2));

    let y = Math.round(title.y + title.height + PAD_TOP);

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
      for (const ch of row1.children as any[]) ch.y = Math.round((rowH - ch.height) / 2);
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
      for (const ch of row2.children as any[]) ch.y = Math.round((rowH - ch.height) / 2);
      y += rowH;
    }

    return { h: y };
  };

  return section;
}


  // =====================
  // SETTINGS SUBMENU (overlay)
  // =====================
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
const INFO_TEXT_TOP = `
GAME RULES
Blocky Farm is a 6×5 tumbling slot game that pays wins in clusters.
A win is formed when 5 or more identical symbols connect anywhere on the grid.

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
• Resets when no further winning tumbles occur

FREE SPINS
• Triggered by landing 3 or more Scatter symbols
• Awards Free Spins
• Uses the same tumbling and cluster mechanics as the base game
• The Global Multiplier does NOT reset during Free Spins
• Multiplier progression persists for the entire Free Spins session

SECOND CHANCE WILD
After a winning spin finishes tumbling, if no further cluster wins are available:
• A Wild symbol may land anywhere on the grid
• This can create a final chance for an additional cluster win

BOOSTED WILDS
If a winning cluster contains 2 or more Wild symbols:
• That cluster’s paytable value is boosted (1.6×)
• The boost applies only to the affected cluster
• The boost is applied before the Global Multiplier

INFUSED SCATTERS
If exactly 2 Scatter symbols are present on the grid and a win occurs:
• The winning tumble is infused
• The Global Multiplier temporarily advances by one additional step for that tumble
• This effect can occur once per spin
`;

const INFO_TEXT_BOTTOM = `
GENERAL TERMS
• Theoretical RTP is approximately 97%
• Maximum win is 10,000× the bet
• All wins are paid according to the paytable and active multipliers
• Malfunctions void all pays and play
• Incomplete or interrupted games may be resumed
`;

const infoTextStyle = new TextStyle(localizeInfoSystemStyle({
  fontSize: 20,
  fill: 0xffffff,
  align: "center",
  wordWrap: true,
  wordWrapWidth: 760, // updated in layoutInfo()
  lineHeight: 30,
} as any));

const infoBodyTop = new Text(INFO_TEXT_TOP, infoTextStyle);
infoBodyTop.anchor.set(0.5, 0);

const infoBodyBottom = new Text(INFO_TEXT_BOTTOM, infoTextStyle);
infoBodyBottom.anchor.set(0.5, 0);

infoContent.addChild(infoBodyTop);

// ✅ paytable section (create once)
const paytableSection = buildPaytableSection();

infoContent.addChild(paytableSection);

infoContent.addChild(infoBodyBottom);

// scrolling state
let infoScrollY = 0;
let infoViewportX = 0;
let infoViewportY = 0;
let infoViewportW = 0;
let infoViewportH = 0;

// drag to scroll (dragging the panel)
let dragging = false;
let dragStartY = 0;
let scrollStartY = 0;

infoPanel.on("pointerdown", (e: any) => {
  dragging = true;
  dragStartY = e.global.y;
  scrollStartY = infoScrollY;
});
infoPanel.on("pointerup", () => (dragging = false));
infoPanel.on("pointerupoutside", () => (dragging = false));
infoPanel.on("pointermove", (e: any) => {
  if (!dragging) return;
  const dy = e.global.y - dragStartY;
  setInfoScroll(scrollStartY + dy);
});

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

window.addEventListener("wheel", (e) => {
  if (!infoLayer.visible) return;
  setInfoScroll(infoScrollY - e.deltaY);
}, { passive: true });

// close button (X)
const infoClose = new Graphics();
infoClose.eventMode = "static";
infoClose.cursor = "pointer";
infoClose.on("pointertap", () => hideInfo());
infoLayer.addChild(infoClose);

function showInfo() {
  infoLayer.visible = true;
  layoutInfo();
}

function hideInfo() {
  infoLayer.visible = false;
}

function layoutInfo() {
  const W = app.screen.width;
  const H = app.screen.height;

  // backdrop
  infoBackdrop.clear();
  infoBackdrop.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.7 });

  const panelW = Math.min(900, Math.round(W * 0.9));
  const panelH = Math.min(700, Math.round(H * 0.85));
  const x = (W - panelW) / 2;
  const y = (H - panelH) / 2;

  infoPanel.clear();
  infoPanel
    .roundRect(x, y, panelW, panelH, 16)
    .fill({ color: 0x0b0b0b, alpha: 0.95 })
    .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });

  infoModalTitle.x = Math.round(W / 2);
  infoModalTitle.y = Math.round(y + 20);

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

  // content is local to viewport
  infoContent.x = 0;
  infoContent.y = 0;

  // update wrapping width
  (infoBodyTop.style as any).wordWrapWidth = infoViewportW;
  (infoBodyBottom.style as any).wordWrapWidth = infoViewportW;

  // layout children vertically (local coords)
  infoBodyTop.x = Math.round(infoViewportW / 2);
  infoBodyTop.y = 0;

  const topEndY = infoBodyTop.y + infoBodyTop.height + 26;

  paytableSection.x = 0;
  paytableSection.y = Math.round(topEndY);

  // layout paytable to viewport width
  const paySize = (paytableSection as any).__layout?.(infoViewportW);
  const payEndY = paytableSection.y + (paySize?.h ?? paytableSection.height) + 26;

  infoBodyBottom.x = Math.round(infoViewportW / 2);
  infoBodyBottom.y = Math.round(payEndY);

  // mask (world coords)
  infoMask.clear();
  infoMask
    .rect(infoViewportX, infoViewportY, infoViewportW, infoViewportH)
    .fill({ color: 0xffffff, alpha: 1 });

  // clamp + apply scroll
  setInfoScroll(infoScrollY);

  // close button
  const cx = Math.round(x + panelW - 30);
  const cy = Math.round(y + 30);

  infoClose.clear();
  infoClose
    .circle(cx, cy, 16)
    .fill({ color: 0x000000, alpha: 0.4 })
    .stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
    .moveTo(cx - 6, cy - 6).lineTo(cx + 6, cy + 6)
    .moveTo(cx + 6, cy - 6).lineTo(cx - 6, cy + 6)
    .stroke({ width: 3, color: 0xffffff });
}


  let settingsPanelRect = new Rectangle();

  // click-blocker full screen (invisible)
  const settingsBlocker = new Graphics();
  settingsMenuLayer.addChild(settingsBlocker);

  // main panel (rounded rect)
  const settingsPanel = new Graphics();
  settingsMenuLayer.addChild(settingsPanel);

  // swallow clicks inside panel
  settingsPanel.eventMode = "static";
  settingsPanel.cursor = "default";
  settingsPanel.on("pointerdown", (e: any) => e.stopPropagation?.());
  settingsPanel.on("pointertap",  (e: any) => e.stopPropagation?.());

  // INFO row
  const infoRow = new Container();
  settingsMenuLayer.addChild(infoRow);

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

  function layoutInfoRow(cx: number, y: number, panelW: number) {
    const BTN_W = Math.round(panelW * 0.86);
    const BTN_H = isMobileLandscapeSettingsLayout() ? 56 : 70;

    const R = 18;

    const ICON_X = -BTN_W / 2 + 48;
    const TEXT_X = ICON_X + 34;

    infoRow.x = cx - 12;
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
  settingsMenuLayer.addChild(closeSettingsBtn);

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

  settingsMenuLayer.addChild(sfxRow, musicRow);

  function layoutSettingsMenu() {
      const LAND = isMobileLandscapeSettingsLayout();
    // blocker to screen size
    settingsBlocker.clear();
    settingsBlocker
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: 0x000000, alpha: 0.001 });

    settingsBlocker.eventMode = "static";
    settingsBlocker.cursor = "default";

    // click outside closes
    settingsBlocker.removeAllListeners?.("pointertap");
    settingsBlocker.on("pointertap", () => closeFromOutside());

    // panel size

  
const W = app.screen.width;
const H = app.screen.height;

// ✅ portrait mobile detection (settings)
const PORTRAIT_MOBILE = (W < 820 || (W / H) < 0.90) && H >= W;

const panelW = LAND
  ? Math.min(980, Math.round(W * 0.88))
  : (PORTRAIT_MOBILE
      ? Math.min(900, Math.round(W * 0.72))   // ✅ wider on mobile portrait (try 0.90..0.96)
      : Math.min(520, Math.round(W * 0.55))); // desktop-ish


const panelH = LAND
  ? Math.min(280, Math.round(H * 0.60))
  : (PORTRAIT_MOBILE
      ? Math.min(520, Math.round(H * 0.52))  // ✅ taller on mobile portrait
      : Math.min(420, Math.round(H * 0.35))); // desktop-ish portrait



    const radius = 0;

    const cx = Math.round(app.screen.width / 2);
    const cy = Math.round(app.screen.height / 2) - 20;

    settingsPanel.clear();
    settingsPanel
      .roundRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, radius)
      .fill({ color: 0x0b0b0b, alpha: 0.75 })
      .stroke({ width: 2, color: 0xb0b0b0, alpha: 0.35 });

    settingsPanelRect.x = cx - panelW / 2;
    settingsPanelRect.y = cy - panelH / 2;
    settingsPanelRect.width = panelW;
    settingsPanelRect.height = panelH;

   

// rows: INFO, SFX, MUSIC
let rowInfoY: number;
let rowSfxY: number;
let rowMusY: number;

if (LAND) {
  const topPad = 56;  // 🔧
  const rowGap = 66;  // 🔧
  rowInfoY = Math.round(cy - panelH / 2 + topPad);
  rowSfxY  = Math.round(rowInfoY + rowGap);
  rowMusY  = Math.round(rowSfxY + rowGap);
} else {
  // ✅ portrait spacing
  const topPad    = PORTRAIT_MOBILE ? 90 : 110;
  const bottomPad = PORTRAIT_MOBILE ? 60 : 80;

  const topY = cy - panelH / 2 + topPad;
  const bottomY = cy + panelH / 2 - bottomPad;

  // spread 3 rows across the available span
  const rowGap = (bottomY - topY) / 2;

  rowInfoY = Math.round(topY + rowGap * 0);
  rowSfxY  = Math.round(topY + rowGap * 1);
  rowMusY  = Math.round(topY + rowGap * 2);
}


layoutInfoRow(cx, rowInfoY, panelW);
sfxRow.x = cx;   sfxRow.y = rowSfxY;
musicRow.x = cx; musicRow.y = rowMusY;


sfxRow.x = cx;   sfxRow.y = rowSfxY;
musicRow.x = cx; musicRow.y = rowMusY;


   const BTN_W = Math.round(panelW * 0.86);
const BTN_H = LAND ? 56 : 70;

const leftPad  = LAND ? 74 : 40;
const rightPad = LAND ? 34 : 40;

// your slider uses TRACK_X = 60 internally
const trackW = BTN_W - leftPad - rightPad - 60;

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

    settingsMenuLayer.visible = true;
    layoutSettingsMenu();
  }

  function close() {
    settingsMenuLayer.visible = false;
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
