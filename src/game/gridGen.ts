// src/game/gridGen.ts
import type { SymbolId, Cell } from "./simulate";

export function rngChoiceWeighted<T extends string>(weights: Record<T, number>): T {
  let total = 0;
  for (const k in weights) total += weights[k as T];
  const r = Math.random() * total;
  let acc = 0;
  for (const k in weights) {
    acc += weights[k as T];
    if (r <= acc) return k as T;
  }
  return Object.keys(weights)[0] as T;
}

export function makeGrid(COLS: number, ROWS: number, weights: Record<SymbolId, number>): Cell[] {
  const CELL_COUNT = COLS * ROWS;
  return Array.from({ length: CELL_COUNT }, () => ({ id: rngChoiceWeighted(weights) }));
}
