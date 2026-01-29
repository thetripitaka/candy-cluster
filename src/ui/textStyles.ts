// src/ui/textStyles.ts
import { Text, TextStyle, Rectangle } from "pixi.js";
import { localizeStyle } from "../i18n/uiTextStyle";

// =====================
// SHARED "CLICK TO CONTINUE" STYLE (localized font)
// =====================
export function applyClickToContinueStyle(t: Text) {
  const styleObj = localizeStyle({
    // base font (will be overridden by localizeStyle per language)
    fontFamily: "Pixeldown",
    fill: 0xffffff,
    fontSize: 35,
    fontWeight: "200",
    letterSpacing: 1,
    align: "center",

    // ✅ STROKE (outline)
    stroke: { color: 0x000000, width: 4 },

    // ✅ SHADOW
    dropShadow: true,
    dropShadowAlpha: 0.9,
    dropShadowBlur: 0,
    dropShadowDistance: 4,
    dropShadowAngle: -Math.PI / 4,
  } as any);

  t.style = new TextStyle(styleObj as any);

  t.anchor.set(0.5);
  t.eventMode = "static";
  t.cursor = "pointer";

  // generous, consistent click area
  t.hitArea = new Rectangle(-360, -60, 720, 120);
}
