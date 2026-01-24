// src/ui/overlays.ts
import { Container, Sprite, Texture, Graphics, Text, TextStyle, Rectangle } from "pixi.js";
import type { Mode } from "../game/simulate";

type OverlaysDeps = {
  app: any;
  root: Container;
  state: any;

  // shared helpers from main.ts
  tween: any;
  animateMs: any;
  waitMs: any;

  fmtMoney: (v: number) => string;
  applyClickToContinueStyle: (t: Text) => void;

  // shared systems / layers
  bgBlur: any;
  gameCore: Container;
  fsDimmer: Graphics;

  // assets + other helpers
  Assets: any;
  FS_OUTRO_BG_URL: string;

  // hooks back into main.ts
  layoutFsDimmer: () => void;

  // coin shower hooks (implemented in main.ts)
  startCoinShower: (intensity: number) => void;
  stopCoinShower: (drain?: boolean) => void;
  burstCoins: (intensity: number, multiplier?: number) => void;

  // smoke / firefly hooks (optional to let your existing smoke system keep working)
  clearFirefliesNow?: () => void;
};

export function createOverlays(deps: OverlaysDeps) {
  const {
    app,
    root,
    state,
    tween,
    animateMs,
    waitMs,
    fmtMoney,
    applyClickToContinueStyle,
    bgBlur,
    gameCore,
    fsDimmer,
    Assets,
    FS_OUTRO_BG_URL,
    layoutFsDimmer,
    startCoinShower,
    stopCoinShower,
    burstCoins,
  } = deps;

  // =====================
  // FREE SPINS OUTRO (TOTAL WIN) — NEW FULLSCREEN SPLASH + COINS
  // =====================
  const fsOutroLayer = new Container();
  fsOutroLayer.zIndex = 9460;
  fsOutroLayer.visible = false;
  fsOutroLayer.alpha = 0;
  fsOutroLayer.eventMode = "none";
  root.addChild(fsOutroLayer);

  const fsOutroBg = new Sprite(Texture.WHITE);
  fsOutroBg.anchor.set(0.5);
  fsOutroLayer.addChild(fsOutroBg);

  // smoke layer placeholder (you already route smoke into it from main)
  const fsOutroSmokeLayer = new Container();
  fsOutroSmokeLayer.zIndex = 0.6;
  fsOutroSmokeLayer.eventMode = "none";
  fsOutroLayer.addChild(fsOutroSmokeLayer);
  fsOutroLayer.sortableChildren = true;

  // TOTAL WIN + amount
  const fsOutroTotalLabel = new Text({
    text: "TOTAL WIN",
    style: {
      fontFamily: "pixeldown",
      fill: 0xffffff,
      fontSize: 110,
      fontWeight: "100",
      align: "center",
      stroke: { color: 0x000000, width: 12 },
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.6,
      dropShadowBlur: 0,
      dropShadowDistance: 12,
      dropShadowAngle: -Math.PI / 4,
    } as any,
  });
  fsOutroTotalLabel.anchor.set(0.5);
  fsOutroLayer.addChild(fsOutroTotalLabel);

  const fsOutroWinAmount = new Text({
    text: "0.00",
    style: {
      fontFamily: "pixeldown",
      fill: 0xffd36a,
      fontSize: 150,
      fontWeight: "100",
      align: "center",
      stroke: { color: 0x000000, width: 12 },
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.6,
      dropShadowBlur: 0,
      dropShadowDistance: 14,
      dropShadowAngle: -Math.PI / 4,
    } as any,
  });
  fsOutroWinAmount.anchor.set(0.5);
  fsOutroLayer.addChild(fsOutroWinAmount);

  const FS_OUTRO_SHOW_CONTINUE = true;
  const fsOutroContinue = new Text({ text: "CLICK TO CONTINUE", style: {} as any });
  applyClickToContinueStyle(fsOutroContinue);
  (fsOutroContinue.style as any).dropShadowAngle = -Math.PI / 4;
  fsOutroContinue.anchor.set(0.5);
  fsOutroContinue.visible = FS_OUTRO_SHOW_CONTINUE;
  fsOutroContinue.alpha = 1;
  fsOutroContinue.zIndex = 1;
  fsOutroLayer.addChild(fsOutroContinue);

  // =====================
// FS OUTRO — LANDSCAPE GAP TUNING
// =====================
const FS_OUTRO_LABEL_Y_DESKTOP = 0.44;
const FS_OUTRO_AMOUNT_Y_DESKTOP = 0.59;

const FS_OUTRO_LABEL_Y_LAND = 0.1;   // 🔧 move label UP
const FS_OUTRO_AMOUNT_Y_LAND = 0.66;  // 🔧 move amount DOWN

function isMobileLandscapeUILayout() {
  const w = app.screen.width;
  const h = app.screen.height;
  const aspect = w / h;

  const isTouch =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)")?.matches;

  const isMobileUI = !!isTouch || w < 820 || aspect < 0.90;
  return isMobileUI && w > h;
}


  function layoutFsOutro() {
    const W = app.screen.width;
    const H = app.screen.height;

    fsOutroBg.x = Math.round(W * 0.5);
    fsOutroBg.y = Math.round(H * 0.5);

    const tw = fsOutroBg.texture.width || 1;
    const th = fsOutroBg.texture.height || 1;
    const s = Math.max(W / tw, H / th);
    fsOutroBg.scale.set(s);

 const labelYFrac = isMobileLandscapeUILayout()
  ? FS_OUTRO_LABEL_Y_LAND
  : FS_OUTRO_LABEL_Y_DESKTOP;

const amountYFrac = isMobileLandscapeUILayout()
  ? FS_OUTRO_AMOUNT_Y_LAND
  : FS_OUTRO_AMOUNT_Y_DESKTOP;

fsOutroTotalLabel.position.set(
  Math.round(W * 0.5),
  Math.round(H * labelYFrac)
);

fsOutroWinAmount.position.set(
  Math.round(W * 0.5),
  Math.round(H * amountYFrac)
);

    fsOutroContinue.position.set(Math.round(W * 0.5), Math.round(H * 0.92));
  }
  window.addEventListener("resize", layoutFsOutro);

  // =====================
  // FS OUTRO COUNT-UP
  // =====================
  let fsOutroTickToken = 0;
  let fsOutroCountDone = true;
  let fsOutroFinalAmount = 0;
  let fsOutroBurstDone = false;
  let fsOutroPulseToken = 0;

  function pulseFsOutroAmount() {
    fsOutroWinAmount.scale.set(1, 1);
    tween(
      140,
      (k: number) => {
        const e = k; // ok
        const s = 1 + 0.06 * e;
        fsOutroWinAmount.scale.set(s, s);
      },
      () => {
        tween(220, (k2: number) => {
          const e2 = k2 * k2 * (3 - 2 * k2);
          fsOutroWinAmount.scale.set(1.06 + (1 - 1.06) * e2);
        });
      }
    );
  }

  function fireFsOutroFinishFX() {
    if (fsOutroBurstDone) return;
    fsOutroBurstDone = true;

    setTimeout(() => {
      burstCoins(1.7, 1.9);
    }, 60);

    pulseFsOutroAmount();
  }

  function startFsOutroIdlePulse() {
    fsOutroPulseToken++;
    const token = fsOutroPulseToken;

    const baseScale = fsOutroWinAmount.scale.x;
    const UP_SCALE = 1.1;
    const UP_MS = 260;
    const DOWN_MS = 320;
    const PAUSE_MS = 220;

    async function loop() {
      while (token === fsOutroPulseToken && state.overlay.fsOutro) {
        await animateMs(UP_MS, (t: number) => {
          if (token !== fsOutroPulseToken) return;
          const e = t;
          const s = baseScale + (UP_SCALE - baseScale) * e;
          fsOutroWinAmount.scale.set(s, s);
        });

        await animateMs(DOWN_MS, (t: number) => {
          if (token !== fsOutroPulseToken) return;
          const e = t * t * (3 - 2 * t);
          const s = UP_SCALE + (baseScale - UP_SCALE) * e;
          fsOutroWinAmount.scale.set(s, s);
        });

        fsOutroWinAmount.scale.set(baseScale, baseScale);
        await waitMs(PAUSE_MS);
      }
      fsOutroWinAmount.scale.set(baseScale, baseScale);
    }
    void loop();
  }

  function finishFsOutroCountUp() {
    fsOutroTickToken++;
    fsOutroWinAmount.text = fmtMoney(fsOutroFinalAmount);
    fsOutroCountDone = true;
    fireFsOutroFinishFX();
    startFsOutroIdlePulse();
  }

  function startFsOutroCountUp(targetAmount: number, durationMs = 1400) {
    const MAX_STEP_PER_SEC = 0.12;

    fsOutroTickToken++;
    const token = fsOutroTickToken;

    fsOutroFinalAmount = targetAmount;
    fsOutroCountDone = false;
    fsOutroBurstDone = false;

    const start = performance.now();
    let lastNow = start;
    let lastE = 0;

    function tick(now: number) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      if (token !== fsOutroTickToken) return;

      const rawT = (now - start) / durationMs;
      const t = Math.min(1, rawT);

      const SPLIT = 0.75;
      const END_SLOW_POW = 14;

      let targetE: number;
      if (t <= SPLIT) {
        const u = t / SPLIT;
        targetE = 0.78 * (1 - Math.pow(1 - u, 3));
      } else {
        const u = Math.min(1, (t - SPLIT) / (1 - SPLIT));
        targetE = 0.78 + (1 - 0.78) * (1 - Math.pow(1 - u, END_SLOW_POW));
      }

      const delta = targetE - lastE;
      const maxStep = MAX_STEP_PER_SEC * dt;
      const step = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
      const e = Math.min(1, lastE + step);
      lastE = e;

      const v = targetAmount * e;
      fsOutroWinAmount.text = fmtMoney(v);

      if (Math.abs(targetAmount - v) > 0.01) {
        requestAnimationFrame(tick);
      } else {
        fsOutroWinAmount.text = fmtMoney(targetAmount);
        fsOutroCountDone = true;
        fireFsOutroFinishFX();

        setTimeout(() => {
          if (state.overlay.fsOutro) startFsOutroIdlePulse();
        }, 420);
      }
    }

    fsOutroWinAmount.text = fmtMoney(0);
    requestAnimationFrame(tick);
  }

  function showFsOutro(on: boolean, totalWin: number, ms = 420) {
    const t = Assets.get(FS_OUTRO_BG_URL) as Texture | undefined;
    if (t) fsOutroBg.texture = t;
    fsOutroBg.visible = true;

    layoutFsOutro();
    root.sortChildren();

    if (on) {
      state.overlay.fsOutro = true;

      state.ui.auto = false;
      gameCore.alpha = 0;
      (gameCore as any).eventMode = "none";

      layoutFsDimmer();
      fsDimmer.visible = true;
      fsDimmer.eventMode = "static";

      startFsOutroCountUp(totalWin, 1600);
      fsOutroFinalAmount = totalWin;

      fsOutroLayer.visible = true;
      fsOutroLayer.alpha = 0;

      startCoinShower(1.6);

      const startA = fsDimmer.alpha;
      const startB = bgBlur.strength;

      tween(ms, (k: number) => {
        const e = Math.max(0, Math.min(1, k));
        fsDimmer.alpha = startA + (0.55 - startA) * e;
        bgBlur.strength = startB + (6 - startB) * e;
        fsOutroLayer.alpha = e;
      });
    } else {
      const startA = fsDimmer.alpha;
      const startB = bgBlur.strength;
      const startL = fsOutroLayer.alpha;

      tween(
        ms,
        (k: number) => {
          const e = Math.max(0, Math.min(1, k));
          fsDimmer.alpha = startA * (1 - e);
          bgBlur.strength = startB * (1 - e);
          fsOutroLayer.alpha = startL * (1 - e);
        },
        () => {
          fsDimmer.alpha = 0;
          bgBlur.strength = 0;
          fsDimmer.visible = false;
          fsDimmer.eventMode = "none";

          fsOutroLayer.alpha = 0;
          fsOutroLayer.visible = false;

          stopCoinShower(true);

          fsOutroTickToken++;
          fsOutroCountDone = true;

          state.overlay.fsOutro = false;
          fsOutroPulseToken++;
        }
      );
    }
  }

  // keep continue text click behavior the same (routes to fsDimmer tap)
  fsOutroContinue.eventMode = "static";
  fsOutroContinue.cursor = "pointer";
  fsOutroContinue.hitArea = new Rectangle(-340, -60, 680, 120);
  fsOutroContinue.on("pointertap", (e: any) => {
    e.stopPropagation?.();
    fsDimmer.emit("pointertap", {} as any);
  });

 return {
  showFsOutro,
  finishFsOutroCountUp,
  getFsOutroSmokeLayer: () => fsOutroSmokeLayer,
  layoutFsOutro,

  // ✅ expose styles so main.ts can reuse them for FS intro banner text
  getFsOutroWinAmountStyle: () => fsOutroWinAmount.style,
  getFsOutroTotalLabelStyle: () => fsOutroTotalLabel.style,
};

}
