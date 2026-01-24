// src/game/simConfig.ts
import type { SymbolId, SimConfig } from "./simulate";

// Ladder multipliers
export const LADDER = [1, 2, 3, 5, 8, 12, 20];

export const WEIGHTS_BASE: Record<SymbolId, number> = {
  L1:22, L2:20, L3:18, L4:16,
  H1: 8, H2: 7, H3: 6, H4: 5, H5: 2,
  W1: 4, S1: 2,
};

export const WEIGHTS_FS: Record<SymbolId, number> = { ...WEIGHTS_BASE, W1: 6 };


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

// Paytable bands (cluster size → payoutX)
export const PAY_BANDS = [
  //            L1    L2    L3    L4            H1    H2    H3    H4    H5
  { min: 5,  max: 6,  L:[0.14,0.18,0.24,0.30], H:[0.32,0.42,0.58,0.75,0.95] },
  { min: 7,  max: 8,  L:[0.22,0.28,0.38,0.50], H:[0.55,0.75,1.05,1.40,1.80] },
  { min: 9,  max:10,  L:[0.32,0.40,0.55,0.70], H:[0.95,1.40,2.00,2.80,3.60] },
  { min:11,  max:12,  L:[0.60,0.75,1.05,1.35], H:[2.00,3.10,4.60,6.80,8.80] },
  { min:13,  max:15,  L:[1.10,1.40,2.00,2.60], H:[4.20,6.80,10.5,15.0,19.0] },
  { min:16,  max:19,  L:[2.20,2.80,4.00,5.20], H:[9.00,15.0,24.0,36.0,46.0] },
  { min:20,  max:999, L:[4.00,5.50,8.00,10.5], H:[18.0,30.0,55.0,95.0,120.0] },
] as const;

// Build the sim config from main.ts values (COLS/ROWS + fs cap)
export function buildSimConfig(args: {
  COLS: number;
  ROWS: number;
  fsTotalCap: number;
}): SimConfig {
  const { COLS, ROWS, fsTotalCap } = args;

  return {
    COLS,
    ROWS,

    LADDER,
    WEIGHTS_BASE,
    WEIGHTS_FS,
    PAY_BANDS: PAY_BANDS as any,

    SYMBOL_FRAMES,

    MAX_TUMBLES: 25,
    TOTAL_WINX_CAP: 10000,

    SCATTER_THRESHOLD: 3,
    FS_AWARD_BASE: 10,
    FS_AWARD_FS: 5,

    FS_TOTAL_CAP: fsTotalCap,
  };
}
