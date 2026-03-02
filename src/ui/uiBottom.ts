// src/ui/UIbottom.ts
import { Container, Graphics } from "pixi.js";

export type UIBottomLayoutArgs = {
  W: number;
  H: number;

  uiH: number;
  safeB: number;

  uiScale: number;

  isMobile: boolean;
  isPortrait: boolean;
  isLandscape: boolean; // ✅ NEW
};



export function createUIBottom() {
  const layer = new Container();
  layer.sortableChildren = true;

  // Panel background
  const panelBg = new Graphics();
  panelBg.zIndex = 0;
  panelBg.eventMode = "none";
  layer.addChild(panelBg);

// ✅ Landscape-only background plate (taller)
const panelBgLand = new Graphics();
panelBgLand.zIndex = -1;      // behind panelBg (and behind everything)
panelBgLand.eventMode = "none";
layer.addChild(panelBgLand);

  // ✅ Panel dimmer (blocks clicks when menus open)
  const uiDimmer = new Graphics();
  uiDimmer.zIndex = 9999;      // above anything in the panel
  uiDimmer.visible = false;
  uiDimmer.alpha = 0.65;
  uiDimmer.eventMode = "static";
  uiDimmer.cursor = "default";
  layer.addChild(uiDimmer);

function layout(args: UIBottomLayoutArgs) {
  const { W, H, uiH, safeB, uiScale, isLandscape } = args;




  const s = Math.max(0.01, uiScale || 1);

  // ✅ scale the entire panel uniformly
  layer.scale.set(s);

  // Pin whole panel to bottom (using SCALED height)
  layer.x = 0;
  layer.y = Math.round(H - uiH * s - safeB);


   // --- draw panel bg ---
const PANEL_FILL = 0x000000;

// ✅ landscape: invisible bg
// ✅ desktop + portrait: semi-transparent bg
const PANEL_ALPHA = isLandscape ? 0 : 0.5;

const PANEL_OUTLINE_A = 0;
const PANEL_OUTLINE_W = 2;
const PANEL_RADIUS = 0;



    
   panelBg.clear();

const localW = W / s;
const localH = uiH;

panelBgLand.clear();

if (isLandscape) {
  const LAND_BG_H_MUL = 1.6; // 🔧 1.2–1.8
  const landH = Math.round(localH * LAND_BG_H_MUL);
  const y0 = Math.round(localH - landH);

  panelBgLand
    .rect(0, y0, localW, landH)
    .fill({ color: 0x000000, alpha: 0.5 });
} else {
  panelBgLand.clear();
}

// draw main panel bg
panelBg.clear();
panelBg
  .rect(0, 0, localW, localH)
  .fill({ color: PANEL_FILL, alpha: PANEL_ALPHA })
  .stroke({ width: PANEL_OUTLINE_W, color: 0xc7c7c7, alpha: PANEL_OUTLINE_A });


    // --- draw dimmer (panel-sized) ---
uiDimmer.clear();
uiDimmer.rect(0, 0, W / s, uiH).fill(0x000000);
  }

  // small helper (optional, but nice)
  function setDimmer(on: boolean, alpha = 0.65) {
    uiDimmer.alpha = alpha;
    uiDimmer.visible = on;
    uiDimmer.eventMode = on ? "static" : "none";
  }

  return { layer, layout, uiDimmer, setDimmer };
}
