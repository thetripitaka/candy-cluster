// layoutAnchor.ts
import type { Container, Bounds } from "pixi.js";

export type ReelAnchor = {
  // reel house bounds in world coordinates
  b: Bounds;

  // convenience points
  cx: number;
  cy: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function getReelAnchor(reelHouse: Container): ReelAnchor {
  const b = reelHouse.getBounds(); // world-space bounds
  return {
    b,
    cx: b.x + b.width * 0.5,
    cy: b.y + b.height * 0.5,
    top: b.y,
    bottom: b.y + b.height,
    left: b.x,
    right: b.x + b.width,
  };
}