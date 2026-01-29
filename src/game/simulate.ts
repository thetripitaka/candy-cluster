// src/game/simulate.ts
// Pure simulation (NO Pixi, NO global state). Deterministic if you pass a seed.

export type Mode = "BASE" | "FREE_SPINS";

export type SymbolId =
  | "L1" | "L2" | "L3" | "L4"
  | "H1" | "H2" | "H3" | "H4" | "H5"
  | "W1" | "S1";

export type Cell = { id: SymbolId };

export type Cluster = {
  id: SymbolId;          // the paid symbol id (wilds can be inside positions)
  positions: number[];   // flat indices into the grid
  size: number;
  payoutX: number;       // base payout in X (before multiplier)
};

export type SpinStep = {
  grid: Cell[];
  nextGrid: Cell[];
  clusters: Cluster[];
  explodePositions: number[];
  multiplier: number;
  stepWinX: number;

  scatterInfusionUsed?: boolean;
  enchantedClusters?: number;
  infusedScatters?: number;

  // ✅ add these
  aftershockWildSpawned?: boolean;
  aftershockWildIndex?: number;

  // ✅ NEW
  enchantedWildUsed?: boolean;
};





export type SpinResult = {
  mode: Mode;
  initialGrid: Cell[];
  steps: SpinStep[];
  totalWinX: number;

  fsAwarded: number;
  fsRemainingAfter: number;

  // IMPORTANT for FREE_SPINS ladder persistence:
  // this is the ladder index AFTER this spin finishes (after all tumbles)
  ladderIndexAfter: number;
};

// ----------------------------
// RTP calibration (global knob)
// ----------------------------
export let RTP_SCALE_BASE = 1.0;
export let RTP_SCALE_FS = 1.0;

export function setRtpScale(base: number, fs: number = base) {
  RTP_SCALE_BASE = base;
  RTP_SCALE_FS = fs;
}


export type SimConfig = {
  COLS: number;
  ROWS: number;

  LADDER: number[];

  WEIGHTS_BASE: Record<SymbolId, number>;
  WEIGHTS_FS: Record<SymbolId, number>;

  SCATTER_WEIGHT_MUL_BASE?: number;

  // Map symbol id -> frame name (optional for your renderer; sim doesn't use it)
  SYMBOL_FRAMES?: Partial<Record<SymbolId, string>>;

  // payout table bands (same structure you already use)
  PAY_BANDS: Array<{
    min: number;
    max: number;
    L: number[]; // L1..L4
    H: number[]; // H1..H5
  }>;

  // tumble / sim limits
  MAX_TUMBLES?: number;      // default 25
  TOTAL_WINX_CAP?: number;   // default 10000

  // scatter rules
  FS_AWARD_BASE?: number;    // default 10 when BASE sees 3+
  FS_AWARD_FS?: number;      // default 5 when FREE_SPINS sees 3+
  SCATTER_THRESHOLD?: number; // default 3

  // FS cap
  FS_TOTAL_CAP?: number;     // default 20 (caps fsRemainingAfter)
};

// ----------------------------
// RNG (seedable)
// ----------------------------
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed?: number) {
  if (typeof seed === "number") return mulberry32(seed);
  return Math.random;
}

// ----------------------------
// Helpers
// ----------------------------
function idxToXY(i: number, COLS: number) {
  return { x: i % COLS, y: Math.floor(i / COLS) };
}

function xyToIdx(x: number, y: number, COLS: number) {
  return y * COLS + x;
}

function inBounds(x: number, y: number, COLS: number, ROWS: number) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function rngChoiceWeighted<T extends string>(
  weights: Record<T, number>,
  rng: () => number
): T {
  let total = 0;
  for (const k in weights) total += weights[k as T];

  const r = rng() * total;
  let acc = 0;

  for (const k in weights) {
    acc += weights[k as T];
    if (r <= acc) return k as T;
  }
  return Object.keys(weights)[0] as T;
}

function pickIndexWeighted(indices: number[], weights: number[], rng: () => number) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];

  // fallback (shouldn't happen, but safe)
  if (total <= 0) return indices[Math.floor(rng() * indices.length)];

  let r = rng() * total;
  for (let i = 0; i < indices.length; i++) {
    r -= weights[i];
    if (r <= 0) return indices[i];
  }
  return indices[indices.length - 1];
}

function countScatters(grid: Cell[]) {
  let n = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i].id === "S1") n++;
  return n;
}

function payoutXFor(symbol: SymbolId, size: number, PAY_BANDS: SimConfig["PAY_BANDS"]) {
  if (symbol === "S1" || symbol === "W1") return 0;
  const isLow = symbol.startsWith("L");
  const idx = Number(symbol.slice(1)) - 1;

  const band =
    PAY_BANDS.find(b => size >= b.min && size <= b.max) ??
    PAY_BANDS[0];

  return isLow ? (band.L[idx] ?? 0) : (band.H[idx] ?? 0);
}

// ----------------------------
// Cluster finding
// - pays only L/H symbols
// - wilds can substitute, but the cluster "id" is the paid symbol
// - clusters cannot overlap (we greedily keep best payoutX then size)
// ----------------------------
function findClusters(grid: Cell[], COLS: number, ROWS: number, PAY_BANDS: SimConfig["PAY_BANDS"]) {
  const CELL_COUNT = COLS * ROWS;
  const visited = new Array<boolean>(CELL_COUNT).fill(false);

  const clusters: Cluster[] = [];
  const getId = (i: number) => grid[i].id;

  const targets: SymbolId[] = ["L1","L2","L3","L4","H1","H2","H3","H4","H5"];

  for (const target of targets) {
    visited.fill(false);

    for (let i = 0; i < CELL_COUNT; i++) {
      if (visited[i]) continue;

      const id = getId(i);
      const match = (id === target || id === "W1");

      if (!match) {
        visited[i] = true;
        continue;
      }

      const queue = [i];
      const positions: number[] = [];
      visited[i] = true;

      while (queue.length) {
        const cur = queue.pop()!;
        positions.push(cur);

        const { x, y } = idxToXY(cur, COLS);
        const neigh = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ];

        for (const n of neigh) {
          if (!inBounds(n.x, n.y, COLS, ROWS)) continue;
          const ni = xyToIdx(n.x, n.y, COLS);
          if (visited[ni]) continue;

          const nid = getId(ni);
          if (nid === target || nid === "W1") {
            visited[ni] = true;
            queue.push(ni);
          }
        }
      }

      if (positions.length >= 5) {
        clusters.push({
          id: target,
          positions,
          size: positions.length,
          payoutX: payoutXFor(target, positions.length, PAY_BANDS),
        });
      }
    }
  }

  // Sort by best value first
  clusters.sort((a, b) => (b.payoutX - a.payoutX) || (b.size - a.size));

  // Remove overlaps (greedy keep best)
  const taken = new Set<number>();
  const final: Cluster[] = [];

  for (const c of clusters) {
    if (c.positions.some(p => taken.has(p))) continue;
    c.positions.forEach(p => taken.add(p));
    final.push(c);
  }

  return final;
}

// ----------------------------
// Tumble (drop + refill)
// explode is a set of indices to remove
// ----------------------------
function applyTumble(
  grid: Cell[],
  explode: Set<number>,
  weights: Record<SymbolId, number>,
  COLS: number,
  ROWS: number,
  rng: () => number
): Cell[] {
  const CELL_COUNT = COLS * ROWS;
  const out: (Cell | null)[] = new Array(CELL_COUNT).fill(null);

  for (let x = 0; x < COLS; x++) {
    const col: Cell[] = [];

    // collect survivors from bottom -> top
    for (let y = ROWS - 1; y >= 0; y--) {
      const i = xyToIdx(x, y, COLS);
      if (!explode.has(i)) col.push({ id: grid[i].id }); // clone
    }

    // refill at top
    while (col.length < ROWS) col.push({ id: rngChoiceWeighted(weights, rng) });

    // write back bottom -> top
    for (let y = ROWS - 1; y >= 0; y--) {
      out[xyToIdx(x, y, COLS)] = col[ROWS - 1 - y];
    }
  }

  return out as Cell[];
}

function makeGrid(
  weights: Record<SymbolId, number>,
  COLS: number,
  ROWS: number,
  rng: () => number
): Cell[] {
  const CELL_COUNT = COLS * ROWS;
  return Array.from({ length: CELL_COUNT }, () => ({ id: rngChoiceWeighted(weights, rng) }));
}

// ----------------------------
// PUBLIC: simulateSpin
// - pass ladderIndexIn for FREE_SPINS persistence
// - returns ladderIndexAfter so you can store it in your state
// ----------------------------
export function simulateSpin(
  
  cfg: SimConfig,
  mode: Mode,
  fsRemainingIn: number,
  ladderIndexIn: number,
  seed?: number
): SpinResult {
  const rng = makeRng(seed);
    // ----------------------------
  // Aftershock Wild (end-of-tumble spice)
  // ----------------------------
const AFTERSHOCK_WILD_ON = true;

const AFTERSHOCK_WILD_MAX = 1; // max wilds per spin
let aftershockWildsUsed = 0;


// ✅ SIM VERSION STAMP (prints once, ESM-safe)
if (!(globalThis as any).__SIM_VER__) {
  (globalThis as any).__SIM_VER__ = true;
  console.log("[SIM] simulateSpin running ✅");
}


  const COLS = cfg.COLS;
  const ROWS = cfg.ROWS;
  const LADDER = cfg.LADDER;

  const MAX_TUMBLES = cfg.MAX_TUMBLES ?? 25;
  const TOTAL_WINX_CAP = cfg.TOTAL_WINX_CAP ?? 10000;

  const SCATTER_THRESHOLD = cfg.SCATTER_THRESHOLD ?? 3;
  const FS_AWARD_BASE = cfg.FS_AWARD_BASE ?? 10;
  const FS_AWARD_FS = cfg.FS_AWARD_FS ?? 5;
  const FS_TOTAL_CAP = cfg.FS_TOTAL_CAP ?? 20;
  
   // =====================
  // SUPER FEATURES (A + B)
  // =====================

  // A) Enchanted Wild: if a paying cluster contains >=2 wilds, boost its payout
  const ENCHANTED_WILD_MIN = 2;     // 2 wilds to trigger
  const ENCHANTED_WILD_MULT = 1.6;  // 1.3..2.0 (start 1.5–1.7)

  // B) Scatter Infusion: if current grid has exactly 2 scatters,
  // temporarily treat ladderIndex as +1 for this win step (once per spin)
  const SCATTER_INFUSION_ON = true;
  const SCATTER_INFUSION_STEPS = 1; // +1 ladder step



// -----------------------------
// Symbol weights (with BASE scatter tuning)
// -----------------------------
const weightsRaw =
  mode === "FREE_SPINS"
    ? cfg.WEIGHTS_FS
    : cfg.WEIGHTS_BASE;

// clone so we can safely tweak
const weights: Record<SymbolId, number> = { ...weightsRaw };

// BASE only: nudge scatter frequency
if (mode === "BASE" && cfg.SCATTER_WEIGHT_MUL_BASE) {
  weights.S1 = weights.S1 * cfg.SCATTER_WEIGHT_MUL_BASE;
}


  let grid = makeGrid(weights, COLS, ROWS, rng);
  const initialGrid = grid.map(c => ({ id: c.id }));
// DEBUG: confirm scatter multiplier is applied (prints once)
if (mode === "BASE" && !(globalThis as any).__SC_MUL_ONCE__) {
  (globalThis as any).__SC_MUL_ONCE__ = true;
  console.log(
    "[SIM] BASE scatter mul =",
    cfg.SCATTER_WEIGHT_MUL_BASE,
    "S1 effective =",
    weights.S1
  );
}

  // Scatter awards:
  // - award if initial grid has 3+
  // - ALSO award if after a tumble we CROSS from <3 to >=3
  let fsAwarded = 0;

  const scatters0 = countScatters(grid);
  let prevScatterCount = scatters0;

  if (scatters0 >= SCATTER_THRESHOLD) {
    fsAwarded += (mode === "BASE" ? FS_AWARD_BASE : FS_AWARD_FS);
  }

  const steps: SpinStep[] = [];

  // ladder index used this spin
  let ladderIndex = (mode === "FREE_SPINS") ? ladderIndexIn : 0;
  let totalWinX = 0;
  let hadAnyClusterWinThisSpin = false;

  let scatterInfusionUsed = false; // ✅ once per spin

  for (let t = 0; t < MAX_TUMBLES; t++) {
       const clusters = findClusters(grid, COLS, ROWS, cfg.PAY_BANDS);
       if (clusters.length) hadAnyClusterWinThisSpin = true;


if (!clusters.length) {
  // ✅ ALWAYS after a winning spin finishes (once per spin)
  if (
    hadAnyClusterWinThisSpin &&
    AFTERSHOCK_WILD_ON &&
    aftershockWildsUsed < AFTERSHOCK_WILD_MAX
  ) {
    const before = grid.map(c => ({ id: c.id }));

    const candidates = grid
      .map((_, i) => i)
      .filter(i => grid[i].id !== "W1" && grid[i].id !== "S1"); // don't overwrite wild/scatter

    if (candidates.length > 0) {
      // Prefer spawning near HIGH symbols (H1..H5)
      const weightsForCandidates: number[] = [];

      for (const ci of candidates) {
        const { x, y } = idxToXY(ci, COLS);

        const neigh = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ];

        let highAdj = 0;
        let wildAdj = 0;

        for (const n of neigh) {
          if (!inBounds(n.x, n.y, COLS, ROWS)) continue;
          const ni = xyToIdx(n.x, n.y, COLS);
          const nid = grid[ni].id;

          if (nid.startsWith("H")) highAdj++;
          else if (nid === "W1") wildAdj++;
        }

        const base = 1;
        const w = base + (highAdj * 6) + (wildAdj * 1);
        weightsForCandidates.push(w);
      }

      const idx = pickIndexWeighted(candidates, weightsForCandidates, rng);

      // mutate grid
      grid[idx] = { id: "W1" };
      aftershockWildsUsed++;

      const after = grid.map(c => ({ id: c.id }));

      // ✅ emit a step so UI + RTP can see it
      steps.push({
        grid: before,
        nextGrid: after,
        clusters: [],
        explodePositions: [],
        multiplier: 1,
        stepWinX: 0,
        aftershockWildSpawned: true,
        aftershockWildIndex: idx,
      });

      continue; // re-check clusters with the new wild
    }
  }

  break; // truly dead grid
}






    // =====================
    // A) ENCHANTED WILD (cluster boost if >=2 wilds inside the cluster)
    // =====================
  let enchantedClustersThisStep = 0;

for (const c of clusters) {
  let wilds = 0;
  for (const p of c.positions) {
    if (grid[p]?.id === "W1") wilds++;
  }
  if (wilds >= ENCHANTED_WILD_MIN) {
    c.payoutX *= ENCHANTED_WILD_MULT;
    enchantedClustersThisStep++;
  }
}

  // RTP CALIBRATION (global knob; set by rtp.ts)
const rtpScale = (mode === "FREE_SPINS") ? RTP_SCALE_FS : RTP_SCALE_BASE;
if (!(globalThis as any).__RTP_SCALE_ONCE__) {
  (globalThis as any).__RTP_SCALE_ONCE__ = true;

}
for (const c of clusters) c.payoutX *= rtpScale;

    // =====================
    // B) SCATTER INFUSION (2 scatters => temporary +1 ladder step, once per spin)
    // =====================
let ladderIdxForThisStep = ladderIndex;
let scatterInfusionUsedThisStep = false;

const scattersNow = countScatters(grid);

let infusedScattersThisStep = 0;

if (SCATTER_INFUSION_ON && !scatterInfusionUsed) {
  // ✅ only “infused” if there is an actual win this step
  const hasClusterWin = clusters.length > 0;

  if (hasClusterWin && scattersNow === 2) {
    ladderIdxForThisStep = ladderIndex + SCATTER_INFUSION_STEPS;
    scatterInfusionUsed = true;
    scatterInfusionUsedThisStep = true;

    infusedScattersThisStep = scattersNow; // ✅ will be 2
  }
}




    const mult = LADDER[Math.min(ladderIdxForThisStep, LADDER.length - 1)] ?? 1;
    const baseWinX = clusters.reduce((acc, c) => acc + c.payoutX, 0);
    const stepWinX = baseWinX * mult;




    const explodeSet = new Set<number>();
    for (const c of clusters) for (const p of c.positions) explodeSet.add(p);
    const explodePositions = Array.from(new Set(clusters.flatMap(c => c.positions)));

    const nextGrid = applyTumble(grid, explodeSet, weights, COLS, ROWS, rng);

    // Scatter crossing check (after tumble)
    const scattersAfter = countScatters(nextGrid);
    if (scattersAfter >= SCATTER_THRESHOLD && prevScatterCount < SCATTER_THRESHOLD) {
      fsAwarded += (mode === "BASE" ? FS_AWARD_BASE : FS_AWARD_FS);
    }
    prevScatterCount = scattersAfter;

steps.push({
  grid,
  nextGrid,
  clusters,
  explodePositions,
  multiplier: mult,
  stepWinX,

  scatterInfusionUsed: scatterInfusionUsedThisStep,
  infusedScatters: infusedScattersThisStep, // ✅ ADD THIS

  enchantedClusters: enchantedClustersThisStep,
  enchantedWildUsed: enchantedClustersThisStep > 0,
});




    totalWinX += stepWinX;
    grid = nextGrid;
    ladderIndex++;
  }

  // apply cap
  totalWinX = Math.min(totalWinX, TOTAL_WINX_CAP);

  // Remaining FS after this spin:
  // - In FREE_SPINS you consume 1 spin
  // - Add awarded spins
  const consumed = (mode === "FREE_SPINS") ? 1 : 0;
  const nextFsRaw = Math.max(0, fsRemainingIn - consumed) + fsAwarded;
  const fsRemainingAfter = Math.min(FS_TOTAL_CAP, nextFsRaw);

  return {
    mode,
    initialGrid,
    steps,
    totalWinX,
    fsAwarded,
    fsRemainingAfter,
    ladderIndexAfter: ladderIndex,
  };
}
