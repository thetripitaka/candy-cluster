// src/ui/layoutFlags.ts
import type { Application } from "pixi.js";

/**
 * Layout flags used across the game.
 *
 * Goals:
 * - Desktop window resizing should NEVER trigger phone/tablet layouts.
 * - DevTools device emulation (iPhone/iPad) SHOULD trigger phone/tablet layouts.
 * - Tablets get their own detection and are NOT treated as phones.
 * - "Mobile portrait/landscape layouts" refer to PHONE-like layouts only.
 */

export type LayoutFlagsDeps = {
  app: Application;

  // If true, PHONE-like devices are forced to use portrait layout rules.
  LOCK_MOBILE_TO_PORTRAIT: boolean;

  // Your touch hint (you already compute this in main.ts).
  IS_TOUCH: boolean;
};

// ------------------------------------------------------------
// Stake preset viewport detectors (size-based, UA-independent)
// ------------------------------------------------------------

export function isStakePopoutS(app: { screen: { width: number; height: number } }) {
  const W = app.screen.width;
  const H = app.screen.height;
  return W <= 420 && H <= 260;
}

export function isStakePopoutL(app: { screen: { width: number; height: number } }) {
  const W = app.screen.width;
  const H = app.screen.height;

  if (!(W > H)) return false;

  const aspect = W / Math.max(1, H);

  const withinSize =
    W >= 700 && W <= 900 &&
    H >= 380 && H <= 520;

  const withinAspect = aspect >= 1.6 && aspect <= 2.1;

  return withinSize && withinAspect;
}

// ✅ PASTE IT RIGHT HERE
export function isStakeMobilePortraitPreset(
  app: { screen: { width: number; height: number } }
) {
  const W = app.screen.width;
  const H = app.screen.height;

  // Must be portrait-ish
  if (!(H > W)) return false;

  // Stake Mobile presets:
  // 425×812, 375×667, 320×568 (with wiggle)
  const withinSize =
    W >= 300 && W <= 460 &&
    H >= 540 && H <= 900;

  const aspect = H / Math.max(1, W);
  const withinAspect = aspect >= 1.4 && aspect <= 2.3;

  return withinSize && withinAspect;
}

export function isTinyView(deps: LayoutFlagsDeps): boolean {
  return isStakePopoutS(deps.app);
}



// ===== Existing multipliers (keep your current values) =====
export const MOBILE_LANDSCAPE_REELHOUSE_MUL = 0.5; // PHONE landscape only
export const MOBILE_LANDSCAPE_TUMBLE_BANNER_MUL = 0.6;

// ------------------------------------------------------------
// Device environment helpers
// ------------------------------------------------------------

function uaLooksMobile(): boolean {
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

function hoverNone(): boolean {
  return window.matchMedia?.("(hover: none)")?.matches ?? false;
}

function anyHoverNone(): boolean {
  return window.matchMedia?.("(any-hover: none)")?.matches ?? false;
}


function coarsePointer(): boolean {
  return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
}

function maxTouchPoints(): number {
  return (navigator as any).maxTouchPoints ?? 0;
}
function urlSaysMobile(): boolean {
  try {
    const d = new URLSearchParams(window.location.search).get("device");
    return (d || "").toLowerCase() === "mobile";
  } catch {
    return false;
  }
}

/**
 * "Real" touch/mobile environment gate:
 * - blocks desktop window resizing from being treated as mobile
 * - still allows DevTools emulation (UA changes to iPhone/iPad)
 *
 * IMPORTANT:
 * - Do NOT use maxTouchPoints alone (can be >0 on desktop)
 * - Treat deps.IS_TOUCH as a hint only (can be true on desktop in some setups)
 */
function isRealTouchOrMobileUA(deps: LayoutFlagsDeps): boolean {
  if (urlSaysMobile()) return true;   // explicit override
  if (uaLooksMobile()) return true;   // DevTools emulation / real phones/tablets

  // Strong touch signal: coarse pointer OR no-hover + touch points
  const strongTouch =
    coarsePointer() ||
    ((hoverNone() || anyHoverNone()) && maxTouchPoints() >= 2);

  return strongTouch;
}


// ------------------------------------------------------------
// Tablet detection
// ------------------------------------------------------------

/**
 * Tablet heuristic:
 * - must be in a real touch/mobile environment
 * - must have large CSS pixel dimensions typical of tablets
 *
 * NOTE: uses window.inner* (CSS pixels), because tablet breakpoints
 * are about CSS size (and DevTools emulation).
 */
export function isTabletLike(deps?: LayoutFlagsDeps): boolean {
  // If caller provides deps, use the strict "real environment" gate
  if (deps && !isRealTouchOrMobileUA(deps)) return false;

  const w = Math.min(window.innerWidth, window.innerHeight);
  const h = Math.max(window.innerWidth, window.innerHeight);

  // coarse pointer is a strong tablet hint (iPad reports coarse in most cases)
  const coarse = coarsePointer();

  // Typical tablet short side is >= ~768 CSS px; use slightly lower to catch small tablets.
  const looksTablet = w >= 740 && h >= 900;

  return coarse && looksTablet;
}

export function isTabletPortrait(deps?: LayoutFlagsDeps): boolean {
  return isTabletLike(deps) && window.innerHeight >= window.innerWidth;
}

export function isTabletLandscape(deps?: LayoutFlagsDeps): boolean {
  return isTabletLike(deps) && window.innerWidth > window.innerHeight;
}

// ------------------------------------------------------------
// Phone-like detection (size/aspect driven, but gated by real env)
// ------------------------------------------------------------

/**
 * Phone-like heuristic:
 * - excluded if tablet-like
 * - requires real touch/mobile UA (prevents desktop resize from flipping)
 * - uses SHORT side so iPhone landscape still qualifies as phone-like
 */
export function isPhoneLike(deps: LayoutFlagsDeps): boolean {
  // ✅ Stake overrides (UA-independent)
  if (
    isStakePopoutS(deps.app) ||
    isStakePopoutL(deps.app) ||
    isStakeMobilePortraitPreset(deps.app)
  ) return true;

  // Exclude tablets first
  if (isTabletLike(deps)) return false;

  // Critical: do not treat desktop resize as phone
  if (!isRealTouchOrMobileUA(deps)) return false;

  const w = deps.app.screen.width;
  const h = deps.app.screen.height;

  const shortSide = Math.min(w, h);
  const longSide = Math.max(w, h);

  // Phone heuristic
  const isSmall = shortSide < 820;

  // Extra robustness (odd reporting in some envs)
  const veryWide = (longSide / Math.max(1, shortSide)) > 1.25;
  const isShortEnoughForPhone = shortSide < 900;

  return isSmall || (veryWide && isShortEnoughForPhone);
}


// ------------------------------------------------------------
// "Mobile UI" gate
// ------------------------------------------------------------

/**
 * Broad "not desktop" layout gate.
 * Returns true only for real touch/mobile environments.
 * Includes phones + tablets.
 */
export function isMobileUILayout(deps: LayoutFlagsDeps): boolean {
  // ✅ Stake presets behave like mobile layouts even on desktop UA
  if (
    isStakePopoutS(deps.app) ||
    isStakePopoutL(deps.app) ||
    isStakeMobilePortraitPreset(deps.app)
  ) return true;

  if (!isRealTouchOrMobileUA(deps)) return false;
  return isPhoneLike(deps) || isTabletLike(deps);
}



// ------------------------------------------------------------
// Orientation helpers (PHONE layouts only)
// ------------------------------------------------------------
export function isMobilePortraitUILayout(deps: LayoutFlagsDeps): boolean {
  const { app, LOCK_MOBILE_TO_PORTRAIT } = deps;

  // Popout S = Tiny view (not portrait UI)
  if (isStakePopoutS(app)) return false;

  // ✅ Mobile L/M/S presets -> portrait UI
  if (isStakeMobilePortraitPreset(app)) return true;

  if (LOCK_MOBILE_TO_PORTRAIT && isPhoneLike(deps)) return true;

  return isPhoneLike(deps) && app.screen.height >= app.screen.width;
}

export function isMobileLandscapeUILayout(deps: LayoutFlagsDeps): boolean {
  const { app, LOCK_MOBILE_TO_PORTRAIT } = deps;

  // ✅ Stake mapping:
  // Popout L = Mobile landscape (always)
  if (isStakePopoutL(app)) return true;

  // Portrait lock blocks phone-landscape rules (but NOT stake popout L)
  if (LOCK_MOBILE_TO_PORTRAIT && isPhoneLike(deps)) return false;

  return isPhoneLike(deps) && app.screen.width > app.screen.height;
}


// ------------------------------------------------------------
// Cursor policy
// ------------------------------------------------------------

/**
 * Default: disable custom cursor on any real touch/mobile environment (phones + tablets).
 * If you want custom cursor on iPad, change this to: return isPhoneLike(deps);
 */
export function disableCustomCursorOnMobile(deps: LayoutFlagsDeps): boolean {
  return isRealTouchOrMobileUA(deps);
}

export function setCursorSafe(
  deps: LayoutFlagsDeps,
  c: { cursor?: string },
  value: string
) {
  if (!disableCustomCursorOnMobile(deps)) c.cursor = value;
}

// ------------------------------------------------------------
// Feature gates
// ------------------------------------------------------------

/**
 * Keep cars OFF only on PHONE portrait (not on tablet).
 */
export function carsDisabled(deps: LayoutFlagsDeps): boolean {
  // ✅ TINY VIEW: disable all cars globally
  if (isTinyView(deps)) return true;

  // OFF on all tablets
  if (isTabletLike(deps)) return true;

  // OFF on phone portrait
  if (isPhoneLike(deps) && deps.app.screen.height >= deps.app.screen.width) {
    return true;
  }

  // ON on desktop + phone landscape
  return false;
}

