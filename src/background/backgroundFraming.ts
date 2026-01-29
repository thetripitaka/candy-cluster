// src/background/backgroundFraming.ts
import type { Container, Sprite } from "pixi.js";
import type { Mode } from "../game/simulate";

export type BackgroundDeps = {
  backgroundLayer: Container;
  bgBase: Sprite;
  bgFree: Sprite;
  setBgBaseHomeY: (y: number) => void;
  setBgFreeHomeY: (y: number) => void;
};

export function setSplashBackgroundFraming(
  deps: BackgroundDeps,
  t01: number,
  nudgePx = 0
) {
  const H = (deps.backgroundLayer as any).parent?.renderer?.height ?? window.innerHeight;

  function yFor(bg: Sprite) {
    const topY = bg.height * 0.5;
    const botY = H - bg.height * 0.5;
    return Math.round(topY + (botY - topY) * t01 + nudgePx);
  }

  deps.bgBase.y = yFor(deps.bgBase);
  deps.bgFree.y = yFor(deps.bgFree);

  // update homes so parallax doesn't fight this
  deps.setBgBaseHomeY(deps.bgBase.y);
  deps.setBgFreeHomeY(deps.bgFree.y);
}

export function snapBackgroundToTop(deps: BackgroundDeps) {
  deps.bgBase.y = Math.round(deps.bgBase.height * 0.5);
  deps.bgFree.y = Math.round(deps.bgFree.height * 0.5);

  deps.setBgBaseHomeY(deps.bgBase.y);
  deps.setBgFreeHomeY(deps.bgFree.y);
}

export async function setBackgroundForMode(
  deps: BackgroundDeps,
  mode: Mode,
  animated = true,
  force = false,
  crossfadeBackground?: (from: Sprite, to: Sprite, durationMs?: number, targetAlpha?: number) => Promise<void>
) {
  // NOTE: currentBgMode is handled in main.ts; this helper just applies visuals.
  // main.ts can pass force/current checks before calling if desired.

  if (!animated || !crossfadeBackground) {
    deps.backgroundLayer.visible = true;
    deps.backgroundLayer.alpha = 1;

    deps.bgBase.visible = mode === "BASE";
    deps.bgFree.visible = mode === "FREE_SPINS";

    deps.bgBase.alpha = 0.9;
    deps.bgFree.alpha = 0.9;
    return;
  }

  if (mode === "FREE_SPINS") {
    await crossfadeBackground(deps.bgBase, deps.bgFree, 450, 0.9);
  } else {
    await crossfadeBackground(deps.bgFree, deps.bgBase, 450, 0.9);
  }

  deps.backgroundLayer.visible = true;
  deps.backgroundLayer.alpha = 1;

  deps.bgBase.visible = mode === "BASE";
  deps.bgFree.visible = mode === "FREE_SPINS";
}
