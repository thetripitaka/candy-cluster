// src/core/timing.ts

export function waitMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function softstep(t: number, amt = 0.18) {
  t = Math.max(0, Math.min(1, t));
  const s = t * t * (3 - 2 * t); // smoothstep
  return t + (s - t) * amt;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t: number) {
  return t * t * t;
}

export function easeOutBack(t: number, overshoot = 1.18) {
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function linear(t: number) {
  return t;
}

export function tween(
  durationMs: number,
  onUpdate: (k: number) => void,
  onDone?: () => void,
  easeFn: (t: number) => number = easeOutCubic
) {
  const start = performance.now();

  function tick(now: number) {
    const t = Math.min(1, (now - start) / durationMs);
    const k = easeFn(t);
    onUpdate(k);

    if (t < 1) requestAnimationFrame(tick);
    else onDone?.();
  }

  requestAnimationFrame(tick);
}

export function animateMs(durationMs: number, onUpdate: (t: number) => void) {
  return new Promise<void>((resolve) => {
    const start = performance.now();

    const tick = (now: number) => {
      const raw = (now - start) / durationMs;
      const t = Math.max(0, Math.min(1, raw));

      onUpdate(t);

      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };

    requestAnimationFrame(tick);
  });
}
