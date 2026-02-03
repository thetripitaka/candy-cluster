// src/engine/spinOutcome.ts
import type { SpinResult } from "../game/simulate";

export type SpinOutcome = {
  result: SpinResult;

  // Wallet deltas (engine-driven later)
  betAmount: number;      // the bet placed for this round
  winAmount: number;      // money won for this round (in currency, not X)
  balanceBefore: number;  // optional but useful for UI
  balanceAfter: number;   // what the wallet should show after the round resolves
};
