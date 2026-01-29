// src/dev/perfHud.ts
import { Container, Graphics, Text, TextStyle } from "pixi.js";
let lastTime = 0;
let accum = 0; // now in ms
let frames = 0;
export type PerfHud = {
  layer: Container;
  setEnabled: (on: boolean) => void;
  isEnabled: () => boolean;
  toggle: () => void;
  update: (dt: number) => void; // call from your ticker/system
  layout: () => void;           // call on resize/orientation changes
};

function canReadMemory(): boolean {
  // performance.memory is Chrome-only (not Safari/iOS)
  return typeof performance !== "undefined" && (performance as any).memory;
}

function fmtMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function createPerfHud(opts: {
  root: Container;        // where to add the HUD (usually your top ui/root)
  width: () => number;    // viewport width getter (renderer.screen.width etc.)
  height: () => number;   // viewport height getter
  anchor?: "tl" | "tr" | "bl" | "br";
  margin?: number;
}): PerfHud {
  const {
    root,
    width,
    height,
    anchor = "tl",
    margin = 10,
  } = opts;

  const layer = new Container();
  layer.sortableChildren = false;
  layer.zIndex = 999999; // if you use zIndex sorting
  root.addChild(layer);

  const bg = new Graphics();
  layer.addChild(bg);

  const style = new TextStyle({
    fontFamily: "Micro5, Pixeldown, monospace",
    fontSize: 18,
    fill: 0xffffff,
    lineHeight: 20,
    letterSpacing: 0,
  });

  const label = new Text({ text: "", style });
  label.roundPixels = true;
  layer.addChild(label);

  // --- stats ---
  let enabled = false;
  layer.visible = false;

  let accum = 0;
  let frames = 0;

  let fpsInstant = 0;
  let fpsSmooth = 60;

  // EMA smoothing factor: higher = reacts faster
  const SMOOTH_ALPHA = 0.12;

  function drawBg() {
    const padX = 10;
    const padY = 8;

    // measure based on label bounds
    const w = Math.ceil(label.width + padX * 2);
    const h = Math.ceil(label.height + padY * 2);

    bg.clear()
      .roundRect(0, 0, w, h, 10)
      .fill({ color: 0x000000, alpha: 0.55 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.15 });

    label.x = padX;
    label.y = padY;
  }

  function place() {
    const vw = width();
    const vh = height();

    // after bg redraw, bg has bounds
    const bw = bg.width || layer.width;
    const bh = bg.height || layer.height;

    let x = margin;
    let y = margin;

    if (anchor.includes("r")) x = vw - bw - margin;
    if (anchor.includes("b")) y = vh - bh - margin;

    layer.x = Math.round(x);
    layer.y = Math.round(y);
  }

  function setEnabled(on: boolean) {
    enabled = on;
    layer.visible = enabled;
  }

  function isEnabled() {
    return enabled;
  }

  function toggle() {
    setEnabled(!enabled);
  }

  function update(dt: number) {
    if (!enabled) return;

    const now = performance.now();

if (!lastTime) {
  lastTime = now;
  return;
}

const dtMs = now - lastTime;
lastTime = now;

accum += dtMs;
frames += 1;

// instantaneous FPS
if (dtMs > 0) {
  fpsInstant = 1000 / dtMs;
  fpsSmooth = fpsSmooth + (fpsInstant - fpsSmooth) * SMOOTH_ALPHA;
}


    // update text ~4 times a second
    if (accum >= 0.25) {
      const avgFps = (frames * 1000) / accum;
      const ms = 1000 / Math.max(1, fpsSmooth);

      let memLine = "MEM: n/a";
      if (canReadMemory()) {
        const m = (performance as any).memory;
        // usedJSHeapSize / totalJSHeapSize
        memLine = `MEM: ${fmtMB(m.usedJSHeapSize)} / ${fmtMB(m.totalJSHeapSize)} MB`;
      }

      label.text =
        `FPS: ${avgFps.toFixed(1)} (now ${fpsSmooth.toFixed(0)})\n` +
        `FT:  ${ms.toFixed(1)} ms\n` +
        memLine;

      drawBg();
      place();

      // reset window
      accum = 0;
      frames = 0;
    }
  }

  function layout() {
    if (!enabled) return;
    drawBg();
    place();
  }

  // initial draw
  label.text = "FPS: --\nFT: --\nMEM: --";
  drawBg();
  place();

  return { layer, setEnabled, isEnabled, toggle, update, layout };
}
