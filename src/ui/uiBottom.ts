// src/ui/UIbottom.ts
import { Container, Graphics } from "pixi.js";

export type UIBottomLayoutArgs = {
  W: number;
  H: number;

  uiH: number;      // BASE (unscaled) panel height
  safeB: number;    // safe inset bottom in px

  uiScale: number;  // ✅ NEW: uniform scale for the entire bottom UI layer

  isMobile: boolean;
  isPortrait: boolean;
};


export function createUIBottom() {
  const layer = new Container();
  layer.sortableChildren = true;

  // Panel background
  const panelBg = new Graphics();
  panelBg.zIndex = 0;
  panelBg.eventMode = "none";
  layer.addChild(panelBg);

  // ✅ Panel dimmer (blocks clicks when menus open)
  const uiDimmer = new Graphics();
  uiDimmer.zIndex = 9999;      // above anything in the panel
  uiDimmer.visible = false;
  uiDimmer.alpha = 0.65;
  uiDimmer.eventMode = "static";
  uiDimmer.cursor = "default";
  layer.addChild(uiDimmer);

 function layout(args: UIBottomLayoutArgs) {
  const { W, H, uiH, safeB, uiScale } = args;

  const s = Math.max(0.01, uiScale || 1);

  // ✅ scale the entire panel uniformly
  layer.scale.set(s);

  // Pin whole panel to bottom (using SCALED height)
  layer.x = 0;
  layer.y = Math.round(H - uiH * s - safeB);


    // --- draw panel bg ---
    const PANEL_FILL = 0x000000;
    const PANEL_ALPHA = 0.38;
    const PANEL_OUTLINE_A = 0.35;
    const PANEL_OUTLINE_W = 2;
    const PANEL_RADIUS = 0;

   panelBg.clear();

const localW = W / s;
const localH = uiH;

if (PANEL_RADIUS > 0) {
  panelBg
    .roundRect(0, 0, localW, localH, PANEL_RADIUS)

        .fill({ color: PANEL_FILL, alpha: PANEL_ALPHA })
        .stroke({ width: PANEL_OUTLINE_W, color: 0xc7c7c7, alpha: PANEL_OUTLINE_A });
    } else {
      panelBg
        .rect(0, 0, localW, localH)
        .fill({ color: PANEL_FILL, alpha: PANEL_ALPHA })
        .stroke({ width: PANEL_OUTLINE_W, color: 0xc7c7c7, alpha: PANEL_OUTLINE_A });
    }

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
