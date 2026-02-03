// src/engine/resultProvider.ts
import type { EngineSpinRequest, EngineSpinOutcome } from "./types";
import { simulateSpin } from "../game/simulate";
import { callStakeEngine } from "./stakeClient";

function isEngineEnabled(): boolean {
  const p = new URLSearchParams(window.location.search);
  return p.get("engine") === "1";
}

// -------------------------
// SIM provider (WORKING NOW)
// -------------------------
async function simResultProvider(req: EngineSpinRequest): Promise<EngineSpinOutcome> {
  const res = simulateSpin(
    req.cfg,
    req.mode,
    req.fsRemainingIn,
    req.ladderIndexIn,
    req.seed
  );

  // ✅ engine-compatible wallet rules
  const betAmount = req.mode === "BASE" ? req.betAmount : 0;
  const winAmount = res.totalWinX * betAmount;

  return {
    result: res,
    betAmount,
    winAmount,
  };
}

// -------------------------
// ENGINE provider (STUB FOR NOW)
// -------------------------
async function engineResultProvider(req: EngineSpinRequest): Promise<EngineSpinOutcome> {
  // ✅ if the engine endpoint isn’t running yet, you’ll get a useful error
  return callStakeEngine(req);
}

// -------------------------
// Public: choose provider
// -------------------------
export function getResultProvider() {
  return isEngineEnabled() ? engineResultProvider : simResultProvider;
}
