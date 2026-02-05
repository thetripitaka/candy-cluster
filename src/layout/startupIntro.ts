// src/layout/startupIntro.ts
import type { Container, Sprite } from "pixi.js";

type StartupIntroDeps = {
  app: { screen: { height: number } };
  state: any;

  // visuals
  gameCore: Container;

  // background sprites
  getBgBase: () => Sprite | null;
  getBgFree: () => Sprite | null;

  // the "home Y" values (set by layoutBackground module)
  getBgHomes: () => { baseHomeY: number; freeHomeY: number };

  // hooks back into main.ts
  resizeBackground: () => void;
  fadeUiLayerTo: (alpha: number, ms?: number) => void;
  showGameCoreDelayed: (delayMs?: number, fadeMs?: number, fromScale?: number) => void;

  // audio hook (you already have this)
  playMusicWhenUnlocked: (key: string, ms?: number) => void;

  // start-of-game hook(s)
  onStartupFinished: () => void;

  // smoke controls (your existing vars)
  setSmokeEnabled: (on: boolean) => void;
  clearSmokeNow: () => void;
  resetSmokeAcc: () => void;

  // optional: tweakables
  STARTUP_PAN_MS: number;
  STARTUP_REVEAL_DELAY: number;
};

export function makeStartupIntro(deps: StartupIntroDeps) {
  const {
    app,
    state,
    gameCore,
    getBgBase,
    getBgFree,
    getBgHomes,
    resizeBackground,
    fadeUiLayerTo,
    showGameCoreDelayed,
    playMusicWhenUnlocked,
    onStartupFinished,
    setSmokeEnabled,
    clearSmokeNow,
    resetSmokeAcc,
    STARTUP_PAN_MS,
    STARTUP_REVEAL_DELAY,
  } = deps;

  function playStartupIntro() {
    state.overlay.startup = true;

    // --- SMOKE: keep OFF during startup pan ---
    setSmokeEnabled(false);
    clearSmokeNow();
    resetSmokeAcc();

    // Hide/lock everything except the background
    gameCore.alpha = 0;
    gameCore.scale.set(1);
    (gameCore as any).eventMode = "none";

    // Hide UI immediately
    fadeUiLayerTo(0, 0);

    // Make sure backgrounds are in their correct "home" layout first
    resizeBackground();

    const bgBase = getBgBase();
    const bgFree = getBgFree();
    if (!bgBase || !bgFree) return;

    const { baseHomeY, freeHomeY } = getBgHomes();

    // Start with the BOTTOM of the texture exactly at the bottom of the screen.
    // With anchor 0.5, bottom edge is (y + height/2),
    // so y = screenH - height/2
    const screenH = app.screen.height;

    const baseStartY = Math.round(screenH - bgBase.height * 0.5);
    const freeStartY = Math.round(screenH - bgFree.height * 0.5);

    const BOTTOM_PAD = 0;

    bgBase.y = baseStartY + BOTTOM_PAD;
    bgFree.y = freeStartY + BOTTOM_PAD;

    const STARTUP_HOLD_MS = 40;

    setTimeout(() => {
      // Use your tween in main via window/global if you already have it,
      // but simplest: requestAnimationFrame loop here
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / STARTUP_PAN_MS);
        const e = t * t * (3 - 2 * t); // smoothstep

        bgBase.y = baseStartY + (baseHomeY - baseStartY) * e;
        bgFree.y = freeStartY + (freeHomeY - freeStartY) * e;

        if (t < 1) {
          requestAnimationFrame(step);
          return;
        }

        // Reveal the game
        state.overlay.startup = false;

        showGameCoreDelayed(STARTUP_REVEAL_DELAY, 420, 0.92);
        fadeUiLayerTo(1, 320);
        playMusicWhenUnlocked("music_base", 600);

        onStartupFinished();

        // Start smoke after intro pan finishes
        setTimeout(() => {
          setSmokeEnabled(true);
        }, 150);
      };

      requestAnimationFrame(step);
    }, STARTUP_HOLD_MS);
  }

  return { playStartupIntro };
}
