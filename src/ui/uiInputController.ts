// src/ui/uiInputController.ts
export function installUiInputController(opts: {
  state: any;
  doSpin: () => Promise<void>;
  stopAutoNow: (reason: string) => void;
  refreshAutoSpinSpinButton: () => void;
  autoBtnPixi?: any;
uiController?: {
  isInFreeSpinsMode: () => boolean;
};

  splashLayer?: any;
  fsDimmer?: any;
  audio?: any;
}) {
  const {
    state,
    doSpin,
    stopAutoNow,
    refreshAutoSpinSpinButton,
    autoBtnPixi,
    uiController,
    splashLayer,
    fsDimmer,
    audio,
  } = opts;

  let spaceDown = false;
  let spaceHoldTimer: any = null;
  let autoWasOnBeforeSpace = false;

  function isContinueKey(e: KeyboardEvent) {
    return e.code === "Space" || e.key === " " || e.key === "Enter";
  }

 function hardOverlayLocks() {
  return state.overlay.startup;
}
  function overlayWantsContinue() {
    return (
      state.overlay.bigWin ||
      state.overlay.fsIntro ||
      state.overlay.fsOutro
    );
  }

  function block(e: KeyboardEvent) {
    e.preventDefault?.();
    e.stopImmediatePropagation?.();
    e.stopPropagation?.();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === "Space") e.preventDefault();

    // Loader / splash hard lock
    if (hardOverlayLocks()) return;

    // Splash continue
    if (state.overlay.splash && isContinueKey(e)) {
      block(e);
      splashLayer?.emit?.("pointertap", {});
      return;
    }

    // Overlay continue (big win / FS intro/outro)
    if (overlayWantsContinue()) {
      if (isContinueKey(e)) {
        block(e);
        fsDimmer?.emit?.("pointertap", {});
      } else {
        block(e);
      }
      return;
    }

    // Gameplay SPACE
    if (e.code !== "Space") return;
    if (e.repeat) return;

    // ❌ Block manual spins during FREE SPINS
   // ✅ safe even if uiController hasn't been created yet
if ((uiController?.isInFreeSpinsMode?.() ?? (state.game?.mode === "FREE_SPINS"))) return;


    // ❌ Block while menus open / spinning
    if (
      state.ui.settingsOpen ||
      state.ui.buyMenuOpen ||
      state.ui.spinning
    ) return;

    spaceDown = true;
    autoWasOnBeforeSpace = state.ui.auto;

    // Tap = spin
    void doSpin();

    // Hold = auto
    spaceHoldTimer = setTimeout(() => {
      if (!spaceDown) return;
      if (state.ui.settingsOpen || state.ui.buyMenuOpen) return;

      if (!state.ui.auto) {
        state.ui.auto = true;
        autoBtnPixi?.setOn?.(true);
      }

      if (!state.ui.spinning) void doSpin();
    }, 350);
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code !== "Space") return;

    spaceDown = false;
    if (spaceHoldTimer) {
      clearTimeout(spaceHoldTimer);
      spaceHoldTimer = null;
    }

    if (!autoWasOnBeforeSpace && state.ui.auto) {
      state.ui.auto = false;
      autoBtnPixi?.setOn?.(false);
      stopAutoNow("space released");
      refreshAutoSpinSpinButton();
    }
  }

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);

  return {
    destroy() {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    },
  };
}
