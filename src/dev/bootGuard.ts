// src/dev/bootGuard.ts
export function ensureSingleBoot(flagName = "__GAME_BOOTED__") {
  const w = window as any;

  if (w[flagName]) {
    console.warn("[BOOT] main() called twice — ignored");
    return false;
  }

  w[flagName] = true;
  return true;
}
