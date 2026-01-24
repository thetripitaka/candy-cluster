// src/core/tickerRouter.ts
import type { Application } from "pixi.js";

export type TickFn = (dt: number) => void;

const __tickSystems: TickFn[] = [];
let __tickerInstalled = false;

export function addSystem(fn: TickFn) {
  __tickSystems.push(fn);
  return fn;
}

export function ensureTickerRouter(app: Application) {
  if (__tickerInstalled) return;
  __tickerInstalled = true;

  app.ticker.add(() => {
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
    for (let i = 0; i < __tickSystems.length; i++) {
      __tickSystems[i](dt);
    }
  });
}
