// src/ui/layoutFlags.ts
import type { Application } from "pixi.js";

export type LayoutFlagsDeps = {
  app: Application;
  LOCK_MOBILE_TO_PORTRAIT: boolean;
  IS_TOUCH: boolean;
};

export const MOBILE_LANDSCAPE_REELHOUSE_MUL = 0.5; // outer art smaller
export const MOBILE_LANDSCAPE_TUMBLE_BANNER_MUL = 0.48;

export function isMobileUILayout({ app, IS_TOUCH }: LayoutFlagsDeps) {
  const w = app.screen.width;
  const h = app.screen.height;
  const aspect = w / h;

  // touch OR narrow screens behave as mobile
  return !!IS_TOUCH || w < 820 || aspect < 0.90;
}

export function isMobilePortraitUILayout({ app, LOCK_MOBILE_TO_PORTRAIT, IS_TOUCH }: LayoutFlagsDeps) {
  // ✅ if we lock to portrait, ANY mobile orientation uses portrait layout rules
  if (LOCK_MOBILE_TO_PORTRAIT && isMobileUILayout({ app, LOCK_MOBILE_TO_PORTRAIT, IS_TOUCH })) return true;

  const w = app.screen.width;
  const h = app.screen.height;
  const aspect = w / h;
  return (w < 820 || aspect < 0.90) && h >= w;
}

export function isMobileLandscapeUILayout({ app, LOCK_MOBILE_TO_PORTRAIT, IS_TOUCH }: LayoutFlagsDeps) {
  // ✅ if we lock to portrait, NEVER allow landscape layout rules
  if (LOCK_MOBILE_TO_PORTRAIT && isMobileUILayout({ app, LOCK_MOBILE_TO_PORTRAIT, IS_TOUCH })) return false;

  return isMobileUILayout({ app, LOCK_MOBILE_TO_PORTRAIT, IS_TOUCH }) && app.screen.width > app.screen.height;
}

export function disableCustomCursorOnMobile(deps: LayoutFlagsDeps) {
  return isMobileUILayout(deps); // ✅ all mobile views (portrait + landscape)
}

export function setCursorSafe(deps: LayoutFlagsDeps, c: { cursor?: string }, value: string) {
  if (!disableCustomCursorOnMobile(deps)) {
    c.cursor = value;
  }
}

export function carsDisabled(deps: LayoutFlagsDeps) {
  // ✅ only disable cars in MOBILE PORTRAIT
  return isMobilePortraitUILayout(deps);
}
