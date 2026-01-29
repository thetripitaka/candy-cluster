// src/dev/keys.ts
import type { Mode } from "../game/simulate";

export type KeyDeps = {
  // flags / state access
  FINAL_BUILD: boolean;
  state: any;

  // helpers from main
  isInFreeSpinsMode: () => boolean;
  stopAutoNow: (reason?: string) => void;
  refreshAutoSpinSpinButton: () => void;

  // overlay gate helpers
  hardOverlayLocks: () => boolean;
  overlayWantsContinue: () => boolean;

  // overlay continue targets
  emitOverlayContinue: () => void;          // fsDimmer.emit("pointertap"...)
  emitSplashContinue: () => void;           // splashLayer.emit("pointertap"...)

  // debug actions
  showInfusedPopup: () => void | Promise<void>;
  showBigWinAndWait: (winAmount: number, winX: number) => void | Promise<void>;
  debugForceFsOutro: (amt: number) => void;
  debugForceFsRetrigger: (amt?: number) => void;
  enterFreeSpins: (count: number, startMult: number) => void;

  // car + voxel tests
  spawnBgCar: (force?: boolean) => void;
  spawnFsCar?: () => void;
  clearCarsNow: () => void;
  spawnVoxelBurstTest: () => void;

  // constants
  BIG_WIN_X: number;
  SUPER_WIN_X: number;
  MEGA_WIN_X: number;
  EPIC_WIN_X: number;
  MAX_WIN_X: number;

  getBet: () => number;

  // gameplay action
  doSpin: () => void | Promise<void>;

  // optional UI/menu gates
  isMenuBlocked: () => boolean; // settings/buy/spinning etc
};

function isContinueKey(e: KeyboardEvent) {
  return e.code === "Space" || e.key === " " || e.key === "Enter";
}
function blockEvent(e: KeyboardEvent) {
  e.preventDefault?.();
  (e as any).stopImmediatePropagation?.();
  e.stopPropagation?.();
}

export function installKeyboard(deps: KeyDeps) {
  let spaceDown = false;
  let spaceHoldTimer: any = null;
  let autoWasOnBeforeSpace = false;

  function onKeyDown(e: KeyboardEvent) {
    // stop page scroll from Space
    if (e.code === "Space") e.preventDefault();

    // 0) HARD LOCKS
    if (deps.hardOverlayLocks()) return;

    // SPLASH continue
    if (deps.state.overlay?.splash && isContinueKey(e)) {
      blockEvent(e);
      deps.emitSplashContinue();
      return;
    }

    // 1) OVERLAYS own Space/Enter
    if (deps.overlayWantsContinue()) {
      if (isContinueKey(e)) {
        blockEvent(e);
        deps.emitOverlayContinue();
      } else {
        blockEvent(e);
      }
      return;
    }

    // 2) DEBUG KEYS
    // allow I always (you had this)
    if (e.key.toLowerCase() === "i") {
      console.log("[DEBUG] INFUSED popup");
      void deps.showInfusedPopup();
      return;
    }

    if (!deps.FINAL_BUILD) {
      // 1..5 big win tiers
      if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4" || e.key === "5") {
        const winX =
          e.key === "1" ? deps.BIG_WIN_X :
          e.key === "2" ? deps.SUPER_WIN_X :
          e.key === "3" ? deps.MEGA_WIN_X :
          e.key === "4" ? deps.EPIC_WIN_X :
          deps.MAX_WIN_X;

        const bet = deps.getBet();
        void deps.showBigWinAndWait(winX * bet, winX);
        return;
      }

      // X = voxel burst test
      if (e.key.toLowerCase() === "x") {
        deps.spawnVoxelBurstTest();
        return;
      }

      // C = force car spawn (shift=base, alt=fs)
      if (e.key.toLowerCase() === "c") {
        const forceBase = e.shiftKey;
        const forceFs = e.altKey;

        const wantMode = (forceBase ? "BASE" : forceFs ? "FREE_SPINS" : deps.state.game?.mode) as Mode;

        deps.clearCarsNow();

        if (wantMode === "BASE") {
          deps.spawnBgCar(true);
          console.log("[BG CAR] Forced spawn (BASE)");
        } else {
          deps.spawnFsCar?.();
          console.log("[BG CAR] Forced spawn (FREE_SPINS)");
        }
        return;
      }

      // O = debug FS outro
      if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        if (e.shiftKey) deps.debugForceFsOutro(2500.0);
        else if (e.altKey) deps.debugForceFsOutro(25.0);
        else deps.debugForceFsOutro(233.0);
        return;
      }

      // R = debug FS retrigger
      if (e.key.toLowerCase() === "r") {
        deps.debugForceFsRetrigger(5);
        return;
      }

      // F/B = debug enter FS
      if (e.key.toLowerCase() === "f") {
        if (deps.state.game?.mode !== "FREE_SPINS") deps.enterFreeSpins(10, 1);
        return;
      }
      if (e.key.toLowerCase() === "b") {
        if (deps.state.game?.mode !== "FREE_SPINS") deps.enterFreeSpins(10, 2);
        return;
      }
    }

    // 3) GAMEPLAY SPACE (tap = spin, hold = temp auto)
    if (e.code === "Space") {
      if (deps.isInFreeSpinsMode()) return;
      if (e.repeat) return;
      if (deps.isMenuBlocked()) return;

      if (spaceDown) return;
      spaceDown = true;

      autoWasOnBeforeSpace = !!deps.state.ui?.auto;

      // tap = spin once
      void deps.doSpin();

      // hold = auto after delay
      spaceHoldTimer = setTimeout(() => {
        if (!spaceDown) return;
        if (deps.isMenuBlocked()) return;

        if (!deps.state.ui?.auto) {
          deps.state.ui.auto = true;
        }

        // ensure correct skin/state
        deps.refreshAutoSpinSpinButton();

        // if not spinning, kick a spin
        if (!deps.state.ui?.spinning) void deps.doSpin();
      }, 350);

      return;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code !== "Space") return;
    e.preventDefault();

    spaceDown = false;
    if (spaceHoldTimer) {
      clearTimeout(spaceHoldTimer);
      spaceHoldTimer = null;
    }

    // restore auto state if it was off before hold
    if (!autoWasOnBeforeSpace && deps.state.ui?.auto) {
      deps.state.ui.auto = false;
      deps.refreshAutoSpinSpinButton();
    }
  }

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);

  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
  };
}
