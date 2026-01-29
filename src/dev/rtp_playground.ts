// src/dev/rtp.ts


import { simulateSpin, setRtpScale } from "../game/simulate";
import { buildSimConfig } from "../game/simConfig";
import type { Mode } from "../game/simulate";
let maxObserved = 0;
// Change these:
const SPINS = 20_000_000;// start with 200k, then 1M+
const MODE: Mode = "BASE"; // "BASE" or "FREE_SPINS"

// If you want a full-cycle RTP (base triggers FS, then includes FS results),
// keep MODE="BASE" and let your sim award fsAwarded; this script will track that.

// ---- helpers
function pct(x: number) {
  return (x * 100).toFixed(3) + "%";
}

async function main() {

  const cfg = buildSimConfig({
    COLS: 6,
    ROWS: 5,
    fsTotalCap: 20,
  });
setRtpScale(1.29175);

    let totalBet = 0;
  let totalReturn = 0;
let aftershockSpawns = 0;
  // =====================
  // SUPER FEATURE COUNTERS
  // =====================

  let scatterInfusionHits = 0;
  let enchantedClusterHits = 0;
  let highClusterSpins = 0;   // spins that contained at least one high cluster
let highClusterSteps = 0;   // steps containing high clusters
let highClusterTotal = 0;   // total high clusters found


  let baseSpins = 0;
  let fsSpins = 0;

  let baseReturn = 0;
  let fsReturn = 0;

  let hits = 0;
  let maxWinX = 0;



  // Track free spins “sessions” if you start in BASE
  let fsRemaining = 0;
  let ladderIndex = 1; // match your state.fs.ladderIndex default
  let inFs = (MODE === "FREE_SPINS");

  for (let i = 1; i <= SPINS; i++) {
    const mode: Mode = inFs ? "FREE_SPINS" : "BASE";

    // bet is 1 unit each BASE spin, 0 during FS (RTP is return / bet)
    const bet = (mode === "BASE") ? 1 : 0;

    const res = simulateSpin(cfg, mode, fsRemaining, ladderIndex, undefined);
let spinHadHigh = false;

for (const step of res.steps) {
  let stepHadHigh = false;

  for (const c of step.clusters) {
    if (c.id.startsWith("H")) {
      highClusterTotal++;
      stepHadHigh = true;
      spinHadHigh = true;
    }
  }

  if (stepHadHigh) highClusterSteps++;
}

if (spinHadHigh) highClusterSpins++;

    


    for (const st of res.steps) {
  if (st.aftershockWildSpawned) aftershockSpawns++;
}



// count features
for (const st of res.steps) {
  if (st.scatterInfusionUsed) scatterInfusionHits++;
  if ((st.enchantedClusters ?? 0) > 0) enchantedClusterHits += (st.enchantedClusters ?? 0);
}

if (i <= 5) {
  console.log({
    i,
    mode,
    bet,
    totalWinX: res.totalWinX,
    steps: res.steps.length,
    step0: res.steps[0]
      ? {
          clusters: res.steps[0].clusters.length,
          stepWinX: res.steps[0].stepWinX,
          multiplier: res.steps[0].multiplier,
          sampleCluster: res.steps[0].clusters[0],
        }
      : null,
    fsAwarded: res.fsAwarded,
    fsRemainingAfter: res.fsRemainingAfter,
    ladderIndexAfter: res.ladderIndexAfter,
  });
}

// ✅ update state ONCE
ladderIndex = res.ladderIndexAfter;
fsRemaining = res.fsRemainingAfter;


    const winX = res.totalWinX; // already in "x bet"
// 🔍 MAX WIN TRACKING (real-time)
if (winX > maxObserved) {
  maxObserved = winX;
  console.log("NEW MAX OBSERVED:", maxObserved.toFixed(2) + "x");
}
    totalBet += bet;
    totalReturn += winX;

    if (mode === "BASE") {
      baseSpins++;
      baseReturn += winX;
    } else {
      fsSpins++;
      fsReturn += winX;
    }

    if (winX > 0) hits++;
    if (winX > maxWinX) maxWinX = winX;

    // Enter FS if awarded from BASE
    if (mode === "BASE" && res.fsAwarded > 0) {
      inFs = true;
      // IMPORTANT: your sim already applied remaining in fsRemainingAfter,
      // so just keep using fsRemaining from res.
    }

 

    // progress log
    if (i % 100_000 === 0) {
      const rtpNow = totalBet > 0 ? (totalReturn / totalBet) : 0;
      console.log(
        `[${i.toLocaleString()}] RTP=${pct(rtpNow)} hits=${pct(hits / i)} aftershock=${pct(aftershockSpawns / i)} maxWinX=${maxWinX.toFixed(2)}x`
      );
    }


    if (mode === "FREE_SPINS" && fsRemaining <= 0) {
      inFs = false;
    }



  }

  const rtp = totalBet > 0 ? (totalReturn / totalBet) : 0;
  console.log("========================================");
  console.log("SPINS:", SPINS.toLocaleString());
  console.log("BASE spins:", baseSpins.toLocaleString(), "FS spins:", fsSpins.toLocaleString());
  console.log("Total bet units:", totalBet.toLocaleString());
  console.log("Total return (x units):", totalReturn.toFixed(2));
  console.log("RTP:", pct(rtp));
  console.log("Hit rate:", pct(hits / SPINS));
  console.log("Max win:", maxWinX.toFixed(2) + "x");
  console.log("BASE RTP (per base bet):", (baseSpins ? pct(baseReturn / baseSpins) : "n/a"));
  console.log("FS return contribution (x):", fsReturn.toFixed(2));
  console.log("========================================");
  console.log("Scatter Infusion steps triggered:", scatterInfusionHits);
console.log("Enchanted clusters triggered:", enchantedClusterHits);
console.log("High-cluster spins:", highClusterSpins.toLocaleString());
console.log("High-cluster steps:", highClusterSteps.toLocaleString());
console.log("High-cluster total:", highClusterTotal.toLocaleString());
console.log(
  "High-cluster rate (per spin):",
  pct(highClusterSpins / SPINS)
);

console.log("Aftershock wild spawns:", aftershockSpawns.toLocaleString());
console.log("Aftershock rate per spin:", pct(aftershockSpawns / SPINS));

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
