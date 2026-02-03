// src/engine/stakeClient.ts
import type { EngineSpinRequest, EngineSpinOutcome } from "./types";

// ✅ You can point this at:
// - a local proxy server (recommended) e.g. http://localhost:8787/spin
// - or your real engine endpoint later
const DEFAULT_ENGINE_URL = "http://localhost:8787/spin";

function getEngineUrl(): string {
  // optional override via ?engineUrl=...
  const p = new URLSearchParams(window.location.search);
  return p.get("engineUrl") || DEFAULT_ENGINE_URL;
}

export async function callStakeEngine(req: EngineSpinRequest): Promise<EngineSpinOutcome> {
  const url = getEngineUrl();

  // -----------------------------
  // Build payload for the engine
  // -----------------------------
  // Keep it simple + explicit. You can rename fields later to match Stake exactly.
  const payload = {
    mode: req.mode, // "BASE" | "FREE_SPINS"
    betAmount: req.betAmount,
    fsRemainingIn: req.fsRemainingIn,
    ladderIndexIn: req.ladderIndexIn,

    // If your engine wants cfg, include it. If it has its own math, omit later.
    cfg: req.cfg,

    // Seed optional
    seed: req.seed ?? null,
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`[ENGINE] HTTP ${r.status} ${r.statusText} :: ${text}`);
  }

  // Expecting engine to return something we can adapt into EngineSpinOutcome
  const data: any = await r.json();

  // -----------------------------
  // Adapt response -> EngineSpinOutcome
  // -----------------------------
  // We require:
  //   result: SpinResult
  //   betAmount: number
  //   winAmount: number
  //
  // If the engine returns the same shape already, this is basically a pass-through.
  const outcome: EngineSpinOutcome = {
    result: data.result ?? data.spinResult ?? data, // tolerate early formats
    betAmount: Number(data.betAmount ?? payload.betAmount ?? 0),
    winAmount: Number(data.winAmount ?? 0),
  };

  // minimal safety checks
  if (!outcome.result || !Array.isArray((outcome.result as any).steps)) {
    throw new Error("[ENGINE] Bad response: missing SpinResult-like shape (steps[]).");
  }

  return outcome;
}
