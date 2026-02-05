import type { Sprite } from "pixi.js";

export type ReelAnchor = {
  b: any;          // ✅ don’t fight Pixi’s Bounds typing
  cx: number;
  cy: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function getReelAnchor(reelHouse: Sprite): ReelAnchor {
  const b: any = reelHouse.getBounds(); // world/screen coords
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
