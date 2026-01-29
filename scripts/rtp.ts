// scripts/rtp.ts
import { runBuyPricing } from "../src/game/buyPricing";
import { simulateSpin } from "../src/game/simulate";
import { buildSimConfig } from "../src/game/simConfig";
import { setRtpScale } from "../src/game/simulate";

const TRIGGERED_FS_START_MULT = 2;

function ladderIndexForStartMult(cfg: ReturnType<typeof buildSimConfig>, startMult: number) {
  const idx = cfg.LADDER.indexOf(startMult);
  return idx >= 0 ? idx : 0;
}

function runBaseStats(cfg: ReturnType<typeof buildSimConfig>, N = 1_000_000) {
  let baseSpins = 0;
  let baseHitSpins = 0;
  let totalTumbles = 0;

  let fsTriggers = 0;
  let totalFsAwarded = 0;

  for (let i = 0; i < N; i++) {
    baseSpins++;

    const r = simulateSpin(cfg, "BASE", 0, 0, 12345 + i);

    if (r.steps.some(s => s.clusters.length > 0)) baseHitSpins++;
    totalTumbles += r.steps.length;

    if (r.fsAwarded > 0) {
      fsTriggers++;
      totalFsAwarded += r.fsAwarded;
    }

    if (i % 100_000 === 0 && i > 0) console.log(`[BASE] ${i}/${N}`);
  }

  const hitRate = baseHitSpins / baseSpins;
  const avgTumbles = totalTumbles / baseSpins;
  const triggerRate = fsTriggers > 0 ? baseSpins / fsTriggers : Infinity;
  const avgFsPerTrigger = fsTriggers > 0 ? totalFsAwarded / fsTriggers : 0;

  console.log("=== BASE STATS ===");
  console.log("Base spins:", baseSpins);
  console.log(`Base hit rate: ${(hitRate * 100).toFixed(2)}%`);
  console.log(`Avg tumbles per spin: ${avgTumbles.toFixed(3)}`);
  console.log(`FS trigger rate: 1 in ${triggerRate.toFixed(1)}`);
  console.log(`Avg FS awarded per trigger: ${avgFsPerTrigger.toFixed(2)}`);
}

function runFsSessionStats(cfg: ReturnType<typeof buildSimConfig>, N = 100_000) {
  let sessions = 0;
  let sessionsWithRetrigger = 0;
  let totalSpinsPlayed = 0;
  let totalFsAwarded = 0;
  let hitCapCount = 0;

  for (let i = 0; i < N; i++) {
    sessions++;

    let fsRemaining = 10; // base trigger award
    let ladderIndex = ladderIndexForStartMult(cfg, TRIGGERED_FS_START_MULT);

    let spinsPlayed = 0;
    let retriggered = false;

    const SESSION_SPIN_CAP = 500;

    while (fsRemaining > 0 && spinsPlayed < SESSION_SPIN_CAP) {
      const r = simulateSpin(cfg, "FREE_SPINS", fsRemaining, ladderIndex, 98765 + i * 31 + spinsPlayed);

      if (r.fsAwarded > 0) retriggered = true;

      totalFsAwarded += r.fsAwarded;
      fsRemaining = r.fsRemainingAfter;
      ladderIndex = r.ladderIndexAfter;

      spinsPlayed++;
      totalSpinsPlayed++;
    }

    if (retriggered) sessionsWithRetrigger++;
    if (fsRemaining >= (cfg.FS_TOTAL_CAP ?? 20)) hitCapCount++;
  }

  console.log("=== FS SESSION STATS (start=10, starts at 2x) ===");
  console.log("Sessions:", sessions);
  console.log(`% sessions with retrigger: ${((sessionsWithRetrigger / sessions) * 100).toFixed(2)}%`);
  console.log(`Avg spins per session: ${(totalSpinsPlayed / sessions).toFixed(2)}`);
  console.log(`Avg FS awarded per session: ${(totalFsAwarded / sessions).toFixed(2)}`);
  console.log(`% sessions hitting FS cap: ${((hitCapCount / sessions) * 100).toFixed(2)}%`);
}

function runOverallRtp(cfg: ReturnType<typeof buildSimConfig>, N = 1_000_000) {
      const MAX_TUMBLES = cfg.MAX_TUMBLES ?? 25;
  const TOTAL_WINX_CAP = cfg.TOTAL_WINX_CAP ?? 10000;
  const FS_TOTAL_CAP = cfg.FS_TOTAL_CAP ?? 20;

  let baseHitTotalCap = 0;
  let fsHitTotalCap = 0;

  let baseHitMaxTumbles = 0;
  let fsHitMaxTumbles = 0;

  let fsSessionSpinCapHits = 0;
  let fsSessionHitFsCapCount = 0;

  let spins = 0;

  let totalWinX = 0;
  let baseWinX = 0;
  let fsWinX = 0;

  let fsTriggers = 0;
  let totalFsSpinsPlayed = 0;

  let maxSpinWinX = 0;

  for (let i = 0; i < N; i++) {
    spins++;

    const rBase = simulateSpin(cfg, "BASE", 0, 0, 12345 + i);
        if (rBase.totalWinX >= TOTAL_WINX_CAP - 1e-9) baseHitTotalCap++;
    if (rBase.steps.length >= MAX_TUMBLES) baseHitMaxTumbles++;

    baseWinX += rBase.totalWinX;
    totalWinX += rBase.totalWinX;
    if (rBase.totalWinX > maxSpinWinX) maxSpinWinX = rBase.totalWinX;

    if (rBase.fsAwarded > 0) {
      fsTriggers++;

      let fsRemaining = rBase.fsAwarded;
      let ladderIndex = ladderIndexForStartMult(cfg, TRIGGERED_FS_START_MULT);

      let spinsPlayed = 0;
      const SESSION_SPIN_CAP = 800;

      while (fsRemaining > 0 && spinsPlayed < SESSION_SPIN_CAP) {
        const rFs = simulateSpin(cfg, "FREE_SPINS", fsRemaining, ladderIndex, 98765 + i * 31 + spinsPlayed);
        if (rFs.totalWinX >= TOTAL_WINX_CAP - 1e-9) fsHitTotalCap++;
        if (rFs.steps.length >= MAX_TUMBLES) fsHitMaxTumbles++;
        if (rFs.fsRemainingAfter >= FS_TOTAL_CAP) fsSessionHitFsCapCount++;

        fsWinX += rFs.totalWinX;
        totalWinX += rFs.totalWinX;
        if (rFs.totalWinX > maxSpinWinX) maxSpinWinX = rFs.totalWinX;

        fsRemaining = rFs.fsRemainingAfter;
        ladderIndex = rFs.ladderIndexAfter;

        spinsPlayed++;
        totalFsSpinsPlayed++;
      }
            if (spinsPlayed >= SESSION_SPIN_CAP && fsRemaining > 0) {
        fsSessionSpinCapHits++;
      }

    }

    if (i % 100_000 === 0 && i > 0) console.log(`[OVERALL] ${i}/${N}`);
  }

  const overallRtp = totalWinX / spins;
  const baseRtp = baseWinX / spins;
  const fsContribution = fsWinX / spins;

  console.log("=== OVERALL RTP (triggered FS starts at 2x) ===");
  console.log("Spins:", spins);
  console.log(`Overall RTP: ${(overallRtp * 100).toFixed(2)}%`);
  console.log(`Base RTP: ${(baseRtp * 100).toFixed(2)}%`);
  console.log(`Triggered FS contribution: ${(fsContribution * 100).toFixed(2)}%`);
  console.log(`FS trigger rate: 1 in ${(spins / Math.max(1, fsTriggers)).toFixed(1)}`);
  console.log(`Avg FS spins played per trigger: ${(totalFsSpinsPlayed / Math.max(1, fsTriggers)).toFixed(2)}`);
  console.log(`Max single-spin winX observed: ${maxSpinWinX.toFixed(2)}x`);
  console.log("=== CAPS / LOOPS CHECK ===");
  console.log(`BASE hit TOTAL_WINX_CAP: ${baseHitTotalCap} (${(baseHitTotalCap / spins * 100).toFixed(4)}%)`);
  console.log(`FS hit TOTAL_WINX_CAP: ${fsHitTotalCap} (${(fsHitTotalCap / Math.max(1, totalFsSpinsPlayed) * 100).toFixed(4)}% of FS spins)`);
  console.log(`BASE hit MAX_TUMBLES: ${baseHitMaxTumbles} (${(baseHitMaxTumbles / spins * 100).toFixed(4)}%)`);
  console.log(`FS hit MAX_TUMBLES: ${fsHitMaxTumbles} (${(fsHitMaxTumbles / Math.max(1, totalFsSpinsPlayed) * 100).toFixed(4)}% of FS spins)`);
  console.log(`FS sessions hit SESSION_SPIN_CAP: ${fsSessionSpinCapHits}`);
  console.log(`FS spins where fsRemainingAfter hit FS_TOTAL_CAP: ${fsSessionHitFsCapCount}`);

}

// ----------------------------------------------------
// Build cfg ONCE
// ----------------------------------------------------
console.log("[RTP] runner started");
const cfg = buildSimConfig({ COLS: 6, ROWS: 5, fsTotalCap: 20 });
setRtpScale(0.49295, 0.49295);
console.log("[RTP] cfg built", {
  COLS: cfg.COLS,
  ROWS: cfg.ROWS,
  LADDER: cfg.LADDER,
  FS_TOTAL_CAP: cfg.FS_TOTAL_CAP,
});

console.log("[RTP] WEIGHTS_BASE:", cfg.WEIGHTS_BASE);
console.log("[RTP] WEIGHTS_FS:", cfg.WEIGHTS_FS);

 

// ✅ Choose what to run (comment/uncomment)
 runBuyPricing(cfg);
runOverallRtp(cfg, 5_000_000);

// runBaseStats(cfg, 1_000_000);
// runFsSessionStats(cfg, 100_000);
