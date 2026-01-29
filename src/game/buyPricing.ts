// src/game/buyPricing.ts
import type { SimConfig } from "./simulate";
import { simulateSpin } from "./simulate";

type BuyOption = {
  name: string;
  priceMult: number;
  fsCount: number;
  startMult: number;
};

function percentile(sorted: number[], p: number) {
  const i = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1)))
  );
  return sorted[i];
}

export function simBuyOption(
  cfg: SimConfig,
  opt: BuyOption,
  N = 200_000,
  seed0 = 12345
) {
  const ladderIndexStart = cfg.LADDER.indexOf(opt.startMult);
  if (ladderIndexStart < 0) {
    throw new Error(`startMult ${opt.startMult} not in LADDER`);
  }
console.log("[BUY DEBUG]", opt.name, { startMult: opt.startMult, ladderIndexStart });

  const wins: number[] = new Array(N);

  for (let n = 0; n < N; n++) {
    if (n % 500 === 0) console.log(`[BUY] ${opt.name}: ${n}/${N}`);
    let fsRemaining = opt.fsCount;
    let ladderIndex = ladderIndexStart;
    let sessionWinX = 0;

    let spinsThisSession = 0;
const SESSION_SPIN_CAP = 400; // safety cap (try 200..800)

while (fsRemaining > 0 && spinsThisSession < SESSION_SPIN_CAP) {
  const r = simulateSpin(
    cfg,
    "FREE_SPINS",
    fsRemaining,
    ladderIndex,
    seed0 + n * 9973 + fsRemaining * 17 + spinsThisSession * 101
  );

  sessionWinX += r.totalWinX;
  fsRemaining = r.fsRemainingAfter;
  ladderIndex = r.ladderIndexAfter;
  spinsThisSession++;
}

if (spinsThisSession >= SESSION_SPIN_CAP) {
  // not “wrong”, just means retriggers can keep it going a long time
  // log rarely so it doesn't spam
  // (this also helps you see if retriggers are too frequent)
  // eslint-disable-next-line no-console
  console.warn(`[BUY] Session hit cap (${SESSION_SPIN_CAP}) for ${opt.name}. fsRemaining=${fsRemaining}`);
}


    wins[n] = sessionWinX;
  }

  const sorted = [...wins].sort((a, b) => a - b);
  const mean = wins.reduce((a, b) => a + b, 0) / N;

  const costX = opt.priceMult;

  return {
    name: opt.name,
    N,
    costX,
    meanWinX: mean,
    buyRtp: mean / costX,

    medianWinX: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],

    dudRates: {
      belowCost: wins.filter(w => w < costX).length / N,
      belowHalfCost: wins.filter(w => w < costX * 0.5).length / N,
      below20pct: wins.filter(w => w < costX * 0.2).length / N,
    },

    recommendedPriceAt97: mean / 0.97,
    
  };
}

export function runBuyPricing(cfg: SimConfig) {
const opts = [
  { name: "Pick & Mix", priceMult: 67, fsCount: 10, startMult: 1 },
  { name: "Giga",      priceMult: 78, fsCount: 10, startMult: 2 },
  { name: "Super",     priceMult: 90, fsCount: 10, startMult: 3 },
  { name: "Ultra",     priceMult: 100, fsCount: 10, startMult: 5 },
];

  for (const o of opts) {
    const out = simBuyOption(cfg, o, 50_000);
    console.log("BUY PRICING:", out);
  }
}



