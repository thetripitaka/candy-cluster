// src/engine/resultProvider.ts
import type { Mode, SpinResult, SimConfig } from "../game/simulate";
import { simulateSpin } from "../game/simulate";

export type SpinRequest = {
  cfg: SimConfig;
  mode: Mode;
  fsRemainingIn: number;
  ladderIndexIn: number;
  seed?: number;      // dev only
  betAmount?: number; // engine will care later
};

export type ResultProvider = (req: SpinRequest) => Promise<SpinResult>;

export const devResultProvider: ResultProvider = async (req) => {
  return simulateSpin(
    req.cfg,
    req.mode,
    req.fsRemainingIn,
    req.ladderIndexIn,
    req.seed
  );
};

export const engineResultProvider: ResultProvider = async (_req) => {
  throw new Error(
    "[ENGINE] engineResultProvider not implemented yet. Use devResultProvider for now."
  );
};

// ✅ IMPORTANT: named export must match your import in main.ts
export function getResultProvider(): ResultProvider {
  const useEngine =
    new URLSearchParams(window.location.search).get("engine") === "1";
  return useEngine ? engineResultProvider : devResultProvider;
}
