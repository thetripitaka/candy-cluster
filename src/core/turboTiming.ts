// src/core/turboTiming.ts

export function makeTurboTiming(getTurboOn: () => boolean) {
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const turboFactor = () => (getTurboOn() ? 0.5 : 1); // 2× speed when turbo ON

  const waitT = (ms: number) => wait(Math.round(ms * turboFactor()));

  const durT = (ms: number) => Math.round(ms * turboFactor());

  return { wait, waitT, durT, turboFactor };
}
