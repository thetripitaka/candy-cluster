// src/game/gridMath.ts

export function idxToXY(i: number, COLS: number) {
  return { x: i % COLS, y: Math.floor(i / COLS) };
}

export function xyToIdx(x: number, y: number, COLS: number) {
  return y * COLS + x;
}
