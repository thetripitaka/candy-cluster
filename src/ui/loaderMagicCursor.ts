// src/ui/loaderMagicCursor.ts
import { Application, Container, Graphics } from "pixi.js";
import { addSystem } from "../core/tickerRouter";
import { disableCustomCursorOnMobile } from "./layoutFlags";

type LayoutDeps = { app: Application; LOCK_MOBILE_TO_PORTRAIT: boolean; IS_TOUCH: boolean };

export type LoaderMagicCursorApi = {
  stop: () => void;
};

export function installLoaderMagicCursor(opts: {
  app: Application;
  root: Container;

  // read-only “is loader visible?” gate for click bursts
  isLoadingVisible: () => boolean;

  // layout flags deps (you already have __layoutDeps in main.ts)
  layoutDeps: LayoutDeps;

  // optional: keep sparks during the game (you had this as a const)
  sparksInGame?: boolean;
}): LoaderMagicCursorApi {
  const { app, root, isLoadingVisible, layoutDeps } = opts;

  // =====================
  // MAGIC CURSOR (LOADER ONLY) — ribbon + sparks + wand + starburst
  // =====================

  // keep your original default
  const CURSOR_SPARKS_IN_GAME = !!opts.sparksInGame;

  // hide system cursor during loader (desktop)
  (app.canvas as any).style.cursor = "none";

  const loaderCursorLayer = new Container();
  loaderCursorLayer.zIndex = 1000000;
  loaderCursorLayer.eventMode = "none";
  root.addChild(loaderCursorLayer);
  root.sortChildren();

  // ✅ Mobile: disable the entire loader cursor system (no square cursor)
  if (disableCustomCursorOnMobile(layoutDeps)) {
    loaderCursorLayer.visible = false;

    // Force Pixi to NEVER show a custom cursor
    app.renderer.events.cursorStyles.default = "default";
    app.renderer.events.cursorStyles.pointer = "default";
    app.stage.cursor = "default";
  }

  // ---- Ribbon trail (soft glow) ----
  const ribbonG = new Graphics();
  (ribbonG as any).blendMode = "none";
  // loaderCursorLayer.addChild(ribbonG);

  // ---- Pixel sparks (8-bit shower) ----
  const sparkLayer = new Container();
  sparkLayer.eventMode = "none";
  sparkLayer.zIndex = 2;
  loaderCursorLayer.addChild(sparkLayer);

  // ---- Starbursts (click pop) ----
  const burstLayer = new Container();
  burstLayer.eventMode = "none";
  burstLayer.zIndex = 3;
  loaderCursorLayer.addChild(burstLayer);

  // ---- Wand tip ----
  const wandTip = new Graphics();
  (wandTip as any).blendMode = "normal";
  loaderCursorLayer.addChild(wandTip);

  function drawWandTip() {
    wandTip.clear();

    const SIZE = 12;
    wandTip.rect(-Math.floor(SIZE / 2), -Math.floor(SIZE / 2), SIZE, SIZE).fill(0xffffff);

    wandTip.roundPixels = true;
    wandTip.x = Math.round(wandTip.x);
    wandTip.y = Math.round(wandTip.y);
  }
  drawWandTip();

  type Pt = { x: number; y: number };
  const trail: Pt[] = [];
  const TRAIL_MAX = 40;

  // cursor smoothing
  let loaderCursorOn = true;
  let targetX = app.screen.width / 2;
  let targetY = app.screen.height / 1.5;
  let curX = targetX;
  let curY = targetY;

  function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
  }

  // =========
  // 8-bit sparks (pool)
  // =========
  type Spark = {
    g: Graphics;
    vx: number;
    vy: number;
    vr: number;
    life: number;
    life0: number;
    s0: number;
  };

  const sparkPool: Spark[] = [];
  const sparkLive: Spark[] = [];

  function spawnSpark(x: number, y: number, burst = false) {
    let p = sparkPool.pop();
    if (!p) {
      const g = new Graphics();
      (g as any).blendMode = "add";
      p = { g, vx: 0, vy: 0, vr: 0, life: 0, life0: 0, s0: 1 };
    }

    const g = p.g;
    g.clear();

    const vox = burst ? 4 + ((Math.random() * 3) | 0) : 3 + ((Math.random() * 2) | 0);
    const blocks = burst ? 4 + ((Math.random() * 4) | 0) : 2 + ((Math.random() * 3) | 0);

    const cols = [0x2a9df4];

    for (let i = 0; i < blocks; i++) {
      const ox = ((-2 + Math.random() * 4) * vox) | 0;
      const oy = ((-2 + Math.random() * 4) * vox) | 0;

      g.rect(ox, oy, vox, vox).fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });
    }

    g.x = x + (-6 + Math.random() * 12);
    g.y = y + (-6 + Math.random() * 12);
    g.rotation = Math.random() * Math.PI * 2;

    const ang = Math.random() * Math.PI * 2;
    const sp = (burst ? 240 : 140) + Math.random() * (burst ? 340 : 220);
    p.vx = Math.cos(ang) * sp;
    p.vy = Math.sin(ang) * sp - (burst ? 260 + Math.random() * 220 : 120 + Math.random() * 160);
    p.vr = (-1 + Math.random() * 2) * (burst ? 10 : 7);

    p.life0 = (burst ? 0.55 : 0.35) + Math.random() * (burst ? 0.35 : 0.22);
    p.life = p.life0;

    p.s0 = 0.9 + Math.random() * 0.9;
    g.scale.set(p.s0);
    g.alpha = burst ? 1.0 : 0.85;

    sparkLayer.addChild(g);
    sparkLive.push(p);
  }

  // =========
  // Starburst (click pop)
  // =========
  type Burst = {
    g: Graphics;
    life: number;
    life0: number;
    rot: number;
    s0: number;
  };

  const burstPool: Burst[] = [];
  const burstLive: Burst[] = [];

  function spawnLoaderClickBurst(x: number, y: number) {
    spawnStarburst(x, y);

    const BURST_COUNT = 30;
    for (let i = 0; i < BURST_COUNT; i++) spawnSpark(x, y, true);
  }

  function spawnStarburst(x: number, y: number) {
    let p = burstPool.pop();
    if (!p) {
      const g = new Graphics();
      (g as any).blendMode = "add";
      p = { g, life: 0, life0: 0, rot: 0, s0: 1 };
    }

    const g = p.g;
    g.clear();

    const spokes = 0;
    const r0 = 10;
    const r1 = 42;

    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const x0 = Math.cos(a) * r0;
      const y0 = Math.sin(a) * r0;
      const x1 = Math.cos(a) * r1;
      const y1 = Math.sin(a) * r1;

      const col = i % 2 === 0 ? 0xffffff : 0xffd36a;

      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke({ width: 3, color: col, alpha: 0.9 });
    }

    g.circle(0, 0, 6).fill({ color: 0xffffff, alpha: 1 });

    g.x = x;
    g.y = y;
    g.alpha = 1;

    p.life0 = 0.28 + Math.random() * 0.10;
    p.life = p.life0;
    p.rot = (-1 + Math.random() * 2) * 2.2;
    p.s0 = 0.85 + Math.random() * 0.25;

    g.scale.set(p.s0);
    burstLayer.addChild(g);
    burstLive.push(p);
  }

  // =========
  // Ribbon drawing (soft trail)
  // =========
  function drawRibbon(points: Pt[]) {
    ribbonG.clear();
    if (points.length < 2) return;

    for (let pass = 0; pass < 2; pass++) {
      const isInner = pass === 1;
      const baseCol = isInner ? 0x4fc3ff : 0xcfefff;

      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];

        const t = i / (points.length - 1);
        const tail = 1 - t;

        const a = (isInner ? 0.38 : 0.22) * (tail * tail);
        if (a < 0.01) continue;

        const w = (isInner ? 6 : 14) * tail + (isInner ? 2.5 : 4.0);

        ribbonG.moveTo(p0.x, p0.y);
        ribbonG.lineTo(p1.x, p1.y);
        ribbonG.stroke({ width: w, color: baseCol, alpha: a, cap: "round", join: "round" } as any);
      }
    }
  }

  // make sure the stage receives pointer events everywhere
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  // =====================
  // MAGIC CURSOR OFFSET
  // =====================
  const CURSOR_OFFSET_X = -2;
  const CURSOR_OFFSET_Y = -2;

  const CURSOR_STEP = 8;

  function snapToStep(v: number, step: number) {
    return Math.round(v / step) * step;
  }

  app.stage.on("pointermove", (e: any) => {
    if (disableCustomCursorOnMobile(layoutDeps)) return;

    const p = e.global;
    targetX = snapToStep(p.x + CURSOR_OFFSET_X, CURSOR_STEP);
    targetY = snapToStep(p.y + CURSOR_OFFSET_Y, CURSOR_STEP);
  });

  app.stage.on("pointerdown", () => {
    if (!isLoadingVisible()) return; // loader-only gate
    if (!loaderCursorOn) return;

    spawnLoaderClickBurst(targetX, targetY);
  });

  // =========
  // stop / cleanup
  // =========
  function stopLoaderMagicCursor() {
    loaderCursorOn = false;
    (app.canvas as any).style.cursor = "none";

    for (let i = sparkLive.length - 1; i >= 0; i--) {
      const p = sparkLive[i];
      p.g.removeFromParent();
      sparkPool.push(p);
      sparkLive.splice(i, 1);
    }

    ribbonG.clear();
    loaderCursorLayer.removeFromParent();
  }

  // =========
  // ticker update
  // =========
  let sparkAcc = 0;

  addSystem((dt) => {
    if (!loaderCursorOn) return;
    if (disableCustomCursorOnMobile(layoutDeps)) return;

    // RETRO STEPPED CURSOR (NO LAG)
    curX = targetX;
    curY = targetY;

    wandTip.position.set(curX, curY);
    wandTip.x = Math.round(wandTip.x);
    wandTip.y = Math.round(wandTip.y);

    trail.unshift({ x: curX, y: curY });
    if (trail.length > TRAIL_MAX) trail.pop();

    drawRibbon(trail);

    const tt = performance.now() * 0.0032;
    wandTip.scale.set(1 + Math.sin(tt) * 0.06);

    const allowSparks = isLoadingVisible() || CURSOR_SPARKS_IN_GAME;
    if (allowSparks) {
      const sparksPerSec = 28;
      sparkAcc += sparksPerSec * dt;
      const n = Math.floor(sparkAcc);
      if (n > 0) sparkAcc -= n;

      for (let i = 0; i < n; i++) {
        const idx = Math.min(trail.length - 1, 6 + ((Math.random() * 6) | 0));
        const tp = trail[idx] ?? trail[trail.length - 1];
        spawnSpark(tp.x, tp.y, false);
      }
    }

    for (let i = sparkLive.length - 1; i >= 0; i--) {
      const p = sparkLive[i];
      const g = p.g;

      p.vy += 620 * dt;

      g.x += p.vx * dt;
      g.y += p.vy * dt;
      g.rotation += p.vr * dt;

      p.life -= dt;
      const k = clamp(p.life / p.life0, 0, 1);

      g.alpha = 0.95 * k * k;
      const s = p.s0 * (0.85 + 0.15 * k);
      g.scale.set(s);

      if (p.life <= 0) {
        g.removeFromParent();
        sparkLive.splice(i, 1);
        sparkPool.push(p);
      }
    }

    for (let i = burstLive.length - 1; i >= 0; i--) {
      const p = burstLive[i];
      const g = p.g;

      p.life -= dt;
      const k = clamp(p.life / p.life0, 0, 1);

      g.alpha = k * k;
      g.rotation += p.rot * dt;

      const s = p.s0 * (0.92 + 0.08 * k);
      g.scale.set(s);

      if (p.life <= 0) {
        g.removeFromParent();
        burstLive.splice(i, 1);
        burstPool.push(p);
      }
    }
  });

  // keep your old global hook (so your existing code can still call it)
  (window as any).__stopLoaderMagicCursor = stopLoaderMagicCursor;

  return { stop: stopLoaderMagicCursor };
}
