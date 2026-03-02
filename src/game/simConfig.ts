// src/game/simConfig.ts
import type { SymbolId, SimConfig } from "./simulate";


// Ladder multipliers
export const LADDER = [1, 2, 3, 5, 8, 12, 20];

export const SCATTER_WEIGHT_MUL_BASE = 0.77;

export const WEIGHTS_BASE: Record<SymbolId, number> = {
  L1: 22,
  L2: 20,
  L3: 18,
  L4: 16,
H1: 9,
H2: 8,
H3: 7,
H4: 6,
H5: 3,
  W1: 7, // ✅ was 7
  S1: 0,
};

export const WEIGHTS_FS: Record<SymbolId, number> = {
  ...WEIGHTS_BASE,
  W1: 6.64, // was 9
  S1: 2,
};

// Symbol frame mapping (atlas frame names)
export const SYMBOL_FRAMES: Record<SymbolId, string> = {
  L1: "symbol_low_L1_gummy.png",
  L2: "symbol_low_L2_gummy.png",
  L3: "symbol_low_L3_gummy.png",
  L4: "symbol_low_L4_gummy.png",

  H1: "symbol_high_H1_choco.png",
  H2: "symbol_high_H2_choco.png",
  H3: "symbol_high_H3_hard.png",
  H4: "symbol_high_H4_hard.png",
  H5: "symbol_high_H5_hard.png",

  W1: "symbol_wild_W1_gummy.png",
  S1: "symbol_scatter_S1_gold.png",
};

export const PAY_BANDS = [
  //            L1    L2    L3    L4            H1    H2    H3    H4    H5
  { min: 5, max: 6, L: [0.4, 0.55, 0.75, 1.0], H: [0.6, 0.85, 1.15, 1.55, 2.0] },
  { min: 7, max: 8, L: [0.85, 1.1, 1.55, 2.1], H: [1.3, 1.8, 2.45, 3.3, 4.3] },
  { min: 9, max: 10, L: [1.2, 1.6, 2.25, 3.0], H: [2.0, 2.9, 4.1, 5.8, 7.5] },
  { min: 11, max: 12, L: [2.0, 2.7, 3.8, 5.0], H: [3.1, 4.7, 6.8, 9.8, 12.5] },
  { min: 13, max: 15, L: [3.6, 4.8, 6.8, 8.8], H: [4.8, 7.6, 11.5, 16.0, 20.0] },
  { min: 16, max: 19, L: [6.6, 8.8, 12.6, 16.0], H: [9.5, 15.8, 25.0, 37.0, 47.0] },
  { min: 20, max: 999, L: [12.5, 17.5, 25.0, 33.0], H: [18.5, 31.0, 56.0, 96.0, 120.0] },
] as const;

// Build the sim config from main.ts values (COLS/ROWS + fs cap)
export function buildSimConfig(args: { COLS: number; ROWS: number; fsTotalCap: number }): SimConfig {
  const { COLS, ROWS, fsTotalCap } = args;

  return {
    COLS,
    ROWS,

    LADDER,
    WEIGHTS_BASE,
    WEIGHTS_FS,
    PAY_BANDS: PAY_BANDS as any,

    SYMBOL_FRAMES,

    SCATTER_WEIGHT_MUL_BASE,

    MAX_TUMBLES: 25,
    TOTAL_WINX_CAP: 10000,

    SCATTER_THRESHOLD: 3,
    FS_AWARD_BASE: 10,
    FS_AWARD_FS: 5,

    FS_TOTAL_CAP: fsTotalCap,
  };
}
