// src/dev/removeOldTopLeftHud.ts
export function removeOldTopLeftHud() {
  // Common ids/classes
  const selectors = [
    "#hud",
    "#topLeftHud",
    "#debugHud",
    ".hud",
    ".top-left-hud",
    ".debug-hud",
  ];

  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => (el as HTMLElement).remove());
  });

  // Fallback: remove any element that literally contains these strings
  const needles = ["Mode:", "Mult:", "Win:", "FS:", "SPIN"];
  document.querySelectorAll("body *").forEach((el) => {
    const t = (el as HTMLElement).innerText;
    if (!t) return;
    if (needles.some((n) => t.includes(n))) {
      // Only remove small HUD-like blocks, not the whole body
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 900 && r.height < 120) (el as HTMLElement).remove();
    }
  });
}
