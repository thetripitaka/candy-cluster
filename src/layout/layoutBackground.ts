// src/layout/layoutBackground.ts
import type { Application, Container, Sprite } from "pixi.js";
import { isMobileUILayout } from "../ui/layoutFlags";

type LayoutBackgroundDeps = {
  app: Application;
  state: any;
  __layoutDeps: any;
  backgroundLayer: Container;
  getBgBase: () => Sprite | null;
  getBgFree: () => Sprite | null;
};

export function makeLayoutBackground(deps: LayoutBackgroundDeps) {
  const { app, state, __layoutDeps, backgroundLayer, getBgBase, getBgFree } = deps;

  // ✅ SINGLE SOURCE OF TRUTH for "home Y" (parallax baselines)
  let baseHomeY = 0;
  let freeHomeY = 0;

  function setHomes(baseY: number, freeY: number) {
    baseHomeY = baseY;
    freeHomeY = freeY;
  }

  function getBgHomes() {
    return { baseHomeY, freeHomeY };
  }

  // zoom tween cancel token (module-owned)
  let bgZoomToken = 0;

 function layoutBackgroundPivotToScreenCenter() {
  const cx = app.screen.width / 2;
  const cy = app.screen.height / 2;

  // ✅ zoom/pan should be about the screen center
  backgroundLayer.pivot.set(cx, cy);
  backgroundLayer.position.set(cx, cy);

  // ❌ do NOT touch scale here (zoomBackgroundTo controls scale)
}

  function resizeBackground() {
    const bgBase = getBgBase();
    const bgFree = getBgFree();
    if (!bgBase || !bgFree) return;

    // keep your old rule (optional): don't resize during splash
    if (state.overlay?.splash) return;

    const cx = app.screen.width / 2;
    const cy = app.screen.height / 2;

    for (const bg of [bgBase, bgFree]) {
      bg.x = cx;
      bg.y = cy;

      const texW = bg.texture.width || 1;
      const texH = bg.texture.height || 1;
      const s = Math.max(app.screen.width / texW, app.screen.height / texH);
      bg.scale.set(s);
    }

    // baseline for parallax
    setHomes(bgBase.y, bgFree.y);
  }

  function setSplashBackgroundFraming(t01: number, nudgePx = 0) {
    const bgBase = getBgBase();
    const bgFree = getBgFree();
    if (!bgBase || !bgFree) return;

    const H = app.screen.height;

    function yFor(bg: Sprite) {
      const topY = bg.height * 0.5;
      const botY = H - bg.height * 0.5;
      return Math.round(topY + (botY - topY) * t01 + nudgePx);
    }

    bgBase.y = yFor(bgBase);
    bgFree.y = yFor(bgFree);

    setHomes(bgBase.y, bgFree.y);
  }

  function snapBackgroundToTop() {
    const bgBase = getBgBase();
    const bgFree = getBgFree();
    if (!bgBase || !bgFree) return;

    bgBase.y = Math.round(bgBase.height * 0.5);
    bgFree.y = Math.round(bgFree.height * 0.5);

    setHomes(bgBase.y, bgFree.y);
  }

  function zoomBackgroundTo(targetScaleMul: number, ms = 500) {
    // keep your old rule: no zoom during splash
    if (state.overlay?.splash) return;

    layoutBackgroundPivotToScreenCenter();

    const start = backgroundLayer.scale.x || 1;
    const token = ++bgZoomToken;

    const t0 = performance.now();

    function tick(now: number) {
      if (token !== bgZoomToken) return;

      const k = ms <= 0 ? 1 : Math.max(0, Math.min(1, (now - t0) / ms));
      const e = k * k * (3 - 2 * k); // smoothstep
      const s = start + (targetScaleMul - start) * e;
      backgroundLayer.scale.set(s);

      if (k < 1) requestAnimationFrame(tick);
      else backgroundLayer.scale.set(targetScaleMul);
    }

    requestAnimationFrame(tick);
  }

  function lockBackgroundForSplash() {
    // cancel any in-flight zoom tween
    bgZoomToken++;

    // optional safety
    if (isMobileUILayout(__layoutDeps)) {
      backgroundLayer.scale.set(1);
    }

    // your chosen splash framing
    setSplashBackgroundFraming(1, 0);

    const bgBase = getBgBase();
    const bgFree = getBgFree();
    if (!bgBase || !bgFree) return;

    // ensure only BASE shows during splash
    bgBase.visible = true;
    bgFree.visible = false;
    bgBase.alpha = 0.9;
    bgFree.alpha = 0;

    setHomes(bgBase.y, bgFree.y);
  }

  return {
    layoutBackgroundPivotToScreenCenter,
    resizeBackground,
    zoomBackgroundTo,
    setSplashBackgroundFraming,
    snapBackgroundToTop,
    lockBackgroundForSplash,
    getBgHomes,
  };
}
