import type { SpinResult, Mode, SimConfig } from "../game/simulate";

export type EngineSpinRequest = {
  cfg: SimConfig;
  mode: Mode;
  fsRemainingIn: number;
  ladderIndexIn: number;
  seed?: number;
  betAmount: number;
};

export type EngineSpinOutcome = {
  result: SpinResult;
  betAmount: number;   // cost charged (0 in FREE_SPINS)
  winAmount: number;   // money win (betAmount * totalWinX, or engine-provided later)
};
