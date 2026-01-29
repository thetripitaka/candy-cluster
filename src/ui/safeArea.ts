// src/ui/safeArea.ts

export function safeInsetBottomPx() {
  const v = getComputedStyle(document.documentElement).getPropertyValue(
    "env(safe-area-inset-bottom)"
  );
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function safeInsetTopPx() {
  const v = getComputedStyle(document.documentElement).getPropertyValue(
    "env(safe-area-inset-top)"
  );
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
