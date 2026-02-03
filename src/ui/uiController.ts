// src/ui/uiController.ts

export type UiControllerDeps = {
  state: any;

  // buttons
  spinBtn: any;
  buyBtn: any;
  autoBtn: any;
  turboBtn: any;
  betUpBtn: any;
  betDownBtn: any;

  // optional menu APIs
  autoMenuApi?: any;

  // helpers from main
  refreshAutoSpinSpinButton?: () => void;
};

export function createUiController(deps: UiControllerDeps) {
  const {
    state,
    spinBtn,
    buyBtn,
    autoBtn,
    turboBtn,
    betUpBtn,
    betDownBtn,
    autoMenuApi,
    refreshAutoSpinSpinButton,
  } = deps;

  function isInFreeSpinsMode(): boolean {
    return (
      state.game.mode === "FREE_SPINS" ||
      state.fs.remaining > 0 ||
      state.overlay.fsOutroPending
    );
  }

  function refreshSpinAffordability() {
    const bet = state.bank.betLevels[state.bank.betIndex];
    const canSpin =
      state.fs.remaining > 0 || state.bank.balance >= bet;

    spinBtn?.setEnabled?.(
      canSpin &&
      (!state.ui.spinning || state.ui.auto) &&
      !state.ui.settingsOpen &&
      !state.ui.buyMenuOpen
    );
  }

  function applyUiLocks() {
    const hardOverlay =
      state.overlay.splash ||
      state.overlay.startup ||
      state.overlay.fsIntro ||
      state.overlay.fsOutro ||
      state.overlay.bigWin;

    const anyMenuOpen =
      state.ui.settingsOpen ||
      state.ui.buyMenuOpen ||
      (autoMenuApi?.isOpen?.() ?? false);

    const fsLock = isInFreeSpinsMode();

    // SETTINGS + TURBO
    settingsRule(hardOverlay);
    turboRule(hardOverlay);

    if (hardOverlay) {
      disableAll();
      return;
    }

    if (fsLock) {
      lockForFreeSpins();
      return;
    }

    // base game
    refreshSpinAffordability();
    applyBaseRules(anyMenuOpen);
  }

  function settingsRule(hardOverlay: boolean) {
    // settings allowed unless hard overlay
    // handled externally if needed
  }

  function turboRule(hardOverlay: boolean) {
    turboBtn?.setEnabled?.(!hardOverlay);
  }

  function disableAll() {
    spinBtn?.setEnabled?.(false);
    buyBtn?.setEnabled?.(false);
    autoBtn?.setEnabled?.(false);
    betUpBtn?.setEnabled?.(false);
    betDownBtn?.setEnabled?.(false);
  }

  function lockForFreeSpins() {
    spinBtn?.setEnabled?.(false);
    autoBtn?.setEnabled?.(false);
    betUpBtn?.setEnabled?.(false);
    betDownBtn?.setEnabled?.(false);

    buyBtn?.setEnabled?.(false);
    buyBtn.eventMode = "none";
    buyBtn.alpha = 1.0;
    buyBtn.cursor = "default";
    buyBtn?.resetVisual?.();

    refreshAutoSpinSpinButton?.();
  }

  function applyBaseRules(anyMenuOpen: boolean) {
    const uiFree = !anyMenuOpen && !state.ui.spinning;

    buyBtn?.setEnabled?.(uiFree);
    autoBtn?.setEnabled?.(uiFree);
    betUpBtn?.setEnabled?.(!anyMenuOpen && !state.ui.spinning);
    betDownBtn?.setEnabled?.(!anyMenuOpen && !state.ui.spinning);
  }

  function restoreUiAfterFsOutro() {
    refreshSpinAffordability();
    refreshAutoSpinSpinButton?.();
    applyUiLocks();
  }

  return {
    applyUiLocks,
    refreshSpinAffordability,
    restoreUiAfterFsOutro,
    isInFreeSpinsMode,
  };
}
