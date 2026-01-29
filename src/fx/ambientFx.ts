// src/fx/ambientFx.ts
import { Container, Graphics } from "pixi.js";
import type { Application } from "pixi.js";

type AddSystem = (fn: (dt: number) => void) => void;

type AmbientFxEnabled = {
  clouds?: boolean;
  leaves?: boolean;
  smoke?: boolean;
  snow?: boolean;
};

type AmbientFxOpts = {
  app: Application;
  root: Container;
  backgroundLayer: Container;
  state: any;                // your state object (overlay flags live here)
  addSystem: AddSystem;

  // Optional: if you want smoke to render on top of FS outro BG when outro is active
  fsOutroSmokeLayer?: Container | null;
};

export function createAmbientFx(opts: AmbientFxOpts) {
  const { app, root, backgroundLayer, state, addSystem } = opts;

  // -----------------------------
  // CLOUD FX
  // -----------------------------
  const cloudFxLayer = new Container();
  cloudFxLayer.sortableChildren = true;
  cloudFxLayer.zIndex = 300;
  cloudFxLayer.eventMode = "none";
  backgroundLayer.addChild(cloudFxLayer);

  type CloudParticle = { c: Container; vx: number; vy: number; vr: number };
  const cloudPool: CloudParticle[] = [];
  const cloudLive: CloudParticle[] = [];
  let cloudSpawnAcc = 0;
  let cloudFxEnabled = true;

  const CLOUD_MAX_LIVE = 10;
  const CLOUD_SPAWN_PER_SEC = 0.35;

  function shade(hex: number, mul: number): number {
    const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * mul)));
    const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * mul)));
    const b = Math.max(0, Math.min(255, Math.round((hex & 255) * mul)));
    return (r << 16) | (g << 8) | b;
  }

  function makeVoxelCloud(): Container {
    const cloud = new Container();
    const g = new Graphics();

    const vox = 4 + ((Math.random() * 2) | 0); // ~4..5
    const cols = 10 + ((Math.random() * 10) | 0);
    const rows = 4 + ((Math.random() * 5) | 0);

    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;

    const hw = vox;
    const hh = vox * 0.55;
    const h  = vox * 0.75;

    function drawIsoCube(px: number, py: number, baseCol: number, alpha: number) {
      const topCol = shade(baseCol, 1.08);
      const leftCol = shade(baseCol, 0.92);
      const rightCol = shade(baseCol, 0.84);

      const tx0 = px;
      const ty0 = py - hh;
      const tx1 = px + hw;
      const ty1 = py;
      const tx2 = px;
      const ty2 = py + hh;
      const tx3 = px - hw;
      const ty3 = py;

      const bx0 = tx0;
      const by0 = ty0 + h;
      const bx1 = tx1;
      const by1 = ty1 + h;
      const bx2 = tx2;
      const by2 = ty2 + h;
      const bx3 = tx3;
      const by3 = ty3 + h;

      g.moveTo(tx0, ty0).lineTo(tx1, ty1).lineTo(tx2, ty2).lineTo(tx3, ty3).closePath()
        .fill({ color: topCol, alpha });

      g.moveTo(tx3, ty3).lineTo(tx0, ty0).lineTo(bx0, by0).lineTo(bx3, by3).closePath()
        .fill({ color: leftCol, alpha });

      g.moveTo(tx0, ty0).lineTo(tx1, ty1).lineTo(bx1, by1).lineTo(bx0, by0).closePath()
        .fill({ color: rightCol, alpha });
    }

    const baseCols = [0xffffff, 0xf7fdff, 0xfffbf2, 0xf2f2f2];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const d = dx * dx + dy * dy;

        if (d > 1.10) continue;
        if (Math.random() < 0.18 + d * 0.30) continue;

        const base = baseCols[(Math.random() * baseCols.length) | 0];
        const a = 0.65;

        const isoX = (x - y) * hw;
        const isoY = (x + y) * hh;

        drawIsoCube(isoX, isoY, base, a);
      }
    }

    const b = g.getLocalBounds();
    g.x = -b.width / 2 - b.x;
    g.y = -b.height / 2 - b.y;

    cloud.addChild(g);
    cloud.alpha = 0.16 + Math.random() * 0.3;
    cloud.scale.set(1.0 + Math.random() * 1.7);

    return cloud;
  }

  function spawnCloud() {
    const W = app.renderer.width;
    const H = app.renderer.height;

    let p = cloudPool.pop();
    if (!p) p = { c: makeVoxelCloud(), vx: 0, vy: 0, vr: 0 };

    p.c.x = -220;
    p.c.y = H * (0.05 + Math.random() * 0.20);

    const speed = 12 + Math.random() * 22;
    p.vx = speed;
    p.vy = -1 + Math.random() * 2;
    p.vr = (-1 + Math.random() * 2) * 0.03;

    const CLOUD_BASE_ROT = -0.12;
    const CLOUD_ROT_JITTER = 0.10;
    p.c.rotation = CLOUD_BASE_ROT + (-CLOUD_ROT_JITTER + Math.random() * CLOUD_ROT_JITTER * 2);

    cloudFxLayer.addChild(p.c);
    cloudLive.push(p);
  }

  function tickCloudFx(dt: number) {
    if (!cloudFxEnabled) return;

    const W = app.renderer.width;
    const H = app.renderer.height;

    cloudSpawnAcc += CLOUD_SPAWN_PER_SEC * dt;
    const n = Math.floor(cloudSpawnAcc);
    if (n > 0) cloudSpawnAcc -= n;

    for (let i = 0; i < n; i++) {
      if (cloudLive.length >= CLOUD_MAX_LIVE) break;
      spawnCloud();
    }

    for (let i = cloudLive.length - 1; i >= 0; i--) {
      const p = cloudLive[i];
      const c = p.c;

      c.x += p.vx * dt;
      c.y += p.vy * dt;
      c.rotation += p.vr * dt;
      c.y += Math.sin((c.x + i * 37) * 0.004) * 0.18;

      const off = c.x > W + 260 || c.y < -220 || c.y > H + 220;
      if (off) {
        c.removeFromParent();
        cloudLive.splice(i, 1);
        cloudPool.push(p);
      }
    }
  }

  function seedClouds(count = 6) {
    const W = app.renderer.width;
    const H = app.renderer.height;

    for (let i = 0; i < count; i++) {
      if (cloudLive.length >= CLOUD_MAX_LIVE) break;

      let p = cloudPool.pop();
      if (!p) p = { c: makeVoxelCloud(), vx: 0, vy: 0, vr: 0 };

      p.c.x = Math.random() * (W + 260) - 130;
      p.c.y = state?.overlay?.splash
        ? H * (0.25 + Math.random() * 0.35)
        : H * (0.05 + Math.random() * 0.20);

      const speed = 12 + Math.random() * 22;
      p.vx = speed;
      p.vy = -2 + Math.random() * 1.2;
      p.vr = (-1 + Math.random() * 2) * 0.03;

      p.c.rotation = (-0.10 + Math.random() * 0.20);

      cloudFxLayer.addChild(p.c);
      cloudLive.push(p);
    }
  }

  function clearClouds() {
    for (let i = cloudLive.length - 1; i >= 0; i--) {
      const p = cloudLive[i];
      p.c.removeFromParent();
      cloudLive.splice(i, 1);
      cloudPool.push(p);
    }
    cloudSpawnAcc = 0;
  }

  // -----------------------------
  // LEAF FX
  // -----------------------------
  const leafFxLayer = new Container();
  leafFxLayer.sortableChildren = true;
  leafFxLayer.zIndex = 400;
  leafFxLayer.eventMode = "none";
  backgroundLayer.addChild(leafFxLayer);

  type LeafParticle = { c: Container; vx: number; vy: number; vr: number; life: number };
  const leafPool: LeafParticle[] = [];
  const leafLive: LeafParticle[] = [];
  let leafSpawnAcc = 0;
  let leafFxEnabled = true;

  const LEAF_MAX_LIVE = 26;
  const LEAF_SPAWN_PER_SEC = 3;
  const LEAF_MIN_VOX = 4;
  const LEAF_MAX_VOX = 7;
  const LEAF_MIN_SCALE = 0.9;
  const LEAF_MAX_SCALE = 1.35;

  function makeVoxelLeaf(): Container {
    const leaf = new Container();
    const g = new Graphics();

    const vox = Math.floor(LEAF_MIN_VOX + Math.random() * (LEAF_MAX_VOX - LEAF_MIN_VOX + 1));
    const cols = 4 + Math.floor(Math.random() * 3);
    const rows = 3 + Math.floor(Math.random() * 3);

    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;

    const greens = [0x6fd46a, 0x47c46a, 0x2fb36a, 0x8eea6a];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const d = dx * dx + dy * dy;
        if (d > 1.05) continue;
        if (Math.random() < 0.20 + d * 0.25) continue;

        g.rect(x * vox, y * vox, vox, vox)
          .fill({ color: greens[(Math.random() * greens.length) | 0], alpha: 1 });
      }
    }

    const b = g.getLocalBounds();
    g.x = -b.width / 2;
    g.y = -b.height / 2;

    leaf.addChild(g);
    leaf.alpha = 0.85 + Math.random() * 0.15;

    const s = LEAF_MIN_SCALE + Math.random() * (LEAF_MAX_SCALE - LEAF_MIN_SCALE);
    leaf.scale.set(s);

    return leaf;
  }

  function spawnLeaf() {
    const W = app.renderer.width;
    const H = app.renderer.height;

    let p = leafPool.pop();
    if (!p) p = { c: makeVoxelLeaf(), vx: 0, vy: 0, vr: 0, life: 0 };

    p.c.x = -80;
    p.c.y = H * (0.15 + Math.random() * 0.65);

    const speed = 35 + Math.random() * 55;
    p.vx = speed;
    p.vy = 10 + Math.random() * 28;
    p.vr = (-1 + Math.random() * 2) * 0.35;
    p.life = 6.0 + Math.random() * 4.0;

    p.c.rotation = Math.random() * Math.PI * 2;

    leafFxLayer.addChild(p.c);
    leafLive.push(p);
  }

  function tickLeafFx(dt: number) {
    if (!leafFxEnabled) return;

    const W = app.renderer.width;
    const H = app.renderer.height;

    leafSpawnAcc += LEAF_SPAWN_PER_SEC * dt;
    const n = Math.floor(leafSpawnAcc);
    if (n > 0) leafSpawnAcc -= n;

    for (let i = 0; i < n; i++) {
      if (leafLive.length >= LEAF_MAX_LIVE) break;
      spawnLeaf();
    }

    for (let i = leafLive.length - 1; i >= 0; i--) {
      const p = leafLive[i];
      const c = p.c;

      c.x += p.vx * dt;
      c.y += p.vy * dt;
      c.rotation += p.vr * dt;
      c.y += Math.sin((c.x + i * 13) * 0.02) * 0.25;

      const off = c.x < -220 || c.x > W + 220 || c.y < -220 || c.y > H + 220;
      if (off) {
        c.removeFromParent();
        leafLive.splice(i, 1);
        leafPool.push(p);
      }
    }
  }

  function clearLeaves() {
    for (let i = leafLive.length - 1; i >= 0; i--) {
      const p = leafLive[i];
      p.c.removeFromParent();
      leafLive.splice(i, 1);
      leafPool.push(p);
    }
    leafSpawnAcc = 0;
  }

  // -----------------------------
  // SMOKE FX (voxel puffs)
  // -----------------------------
  const smokeFxLayer = new Container();
  smokeFxLayer.sortableChildren = true;
  smokeFxLayer.zIndex = 200;
  smokeFxLayer.eventMode = "none";
  backgroundLayer.addChild(smokeFxLayer);

  type SmokeParticle = {
    g: Graphics;
    vx: number;
    vy: number;
    life: number;
    life0: number;
    spin: number;
    grow: number;
  };

  const smokePool: SmokeParticle[] = [];
  const smokeLive: SmokeParticle[] = [];
  let smokeSpawnAcc = 0;
  let smokeFxEnabled = false;

  const SMOKE_MAX_LIVE = 70;
  const SMOKE_SPAWN_PER_SEC = 15;
  const SMOKE_MIN_VOX = 3;
  const SMOKE_MAX_VOX = 6;

  // FS outro chimney emitters (keep your one)
  type SmokeEmitter = { xN: number; yN: number; rate: number };
  const FS_OUTRO_CHIMNEY_EMITTERS: SmokeEmitter[] = [
    { xN: 0.655, yN: 0.265, rate: 6 },
  ];

  function makeVoxelPuff(): Graphics {
    const g = new Graphics();
    const vox = (SMOKE_MIN_VOX + Math.random() * (SMOKE_MAX_VOX - SMOKE_MIN_VOX)) | 0;
    const blocks = 5 + ((Math.random() * 9) | 0);

    const cols = [0xffffff, 0xf2f2f2, 0xd9d9d9, 0xc8c8c8];

    for (let i = 0; i < blocks; i++) {
      const x = ((-2 + Math.random() * 4) * vox) | 0;
      const y = ((-2 + Math.random() * 4) * vox) | 0;
      if (Math.random() < 0.10) continue;

      g.rect(x, y, vox, vox).fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });
    }

    g.alpha = 0.22 + Math.random() * 0.18;
    g.scale.set(0.9 + Math.random() * 0.7);
    return g;
  }

  function spawnSmokeAtNorm(xN: number, yN: number) {
    const W = app.renderer.width;
    const H = app.renderer.height;

    let p = smokePool.pop();
    if (!p) {
      const g = makeVoxelPuff();
      p = { g, vx: 0, vy: 0, life: 0, life0: 0, spin: 0, grow: 0 };
    }

    const g = p.g;
    g.x = W * xN + (-6 + Math.random() * 12);
    g.y = H * yN + (-6 + Math.random() * 12);

    p.vx = -4 + Math.random() * 8;
    p.vy = -(10 + Math.random() * 16);
    p.spin = (-1 + Math.random() * 2) * 0.18;

    p.life0 = 2.6 + Math.random() * 1.6;
    p.life = p.life0;

    p.grow = 0.18 + Math.random() * 0.22;

    g.rotation = Math.random() * Math.PI * 2;

    // choose layer (FS outro smoke layer if provided + outro active)
    const fsOutroLayer = opts.fsOutroSmokeLayer;
    if (state?.overlay?.fsOutro && fsOutroLayer) fsOutroLayer.addChild(g);
    else smokeFxLayer.addChild(g);

    smokeLive.push(p);
  }

  function spawnSmoke() {
    const W = app.renderer.width;
    const H = app.renderer.height;

    let p = smokePool.pop();
    if (!p) {
      const g = makeVoxelPuff();
      p = { g, vx: 0, vy: 0, life: 0, life0: 0, spin: 0, grow: 0 };
    }

    const g = p.g;

    // your default emitter point (keep your knobs here if you want)
    const SMOKE_EMIT_X_N = 0.9;
    const SMOKE_EMIT_Y_N = 0.3;

    g.x = W * SMOKE_EMIT_X_N + (-10 + Math.random() * 20);
    g.y = H * SMOKE_EMIT_Y_N + (-8 + Math.random() * 16);

    p.vx = 18 + Math.random() * 26;
    p.vy = -(22 + Math.random() * 36);
    p.spin = (-1 + Math.random() * 2) * 0.35;

    p.life0 = 1.05 + Math.random() * 0.75;
    p.life = p.life0;

    p.grow = 0.22 + Math.random() * 0.26;

    g.rotation = Math.random() * Math.PI * 2;
    g.alpha = 0.22 + Math.random() * 0.18;
    g.scale.set(0.75 + Math.random() * 0.55);

    smokeFxLayer.addChild(g);
    smokeLive.push(p);
  }

  function tickSmokeFx(dt: number) {
    const W = app.renderer.width;
    const H = app.renderer.height;

    // FS outro chimney spawn
    if (state?.overlay?.fsOutro) {
      for (const e of FS_OUTRO_CHIMNEY_EMITTERS) {
        smokeSpawnAcc += e.rate * dt;
        let n = Math.floor(smokeSpawnAcc);
        if (n > 0) smokeSpawnAcc -= n;
        n = Math.min(n, 4);
        for (let i = 0; i < n; i++) spawnSmokeAtNorm(e.xN, e.yN);
      }
    }

    // update existing smoke
    for (let i = smokeLive.length - 1; i >= 0; i--) {
      const p = smokeLive[i];
      const g = p.g;

      const sway = Math.sin((g.y + i * 17) * 0.02) * 8;

      g.x += (p.vx + sway) * dt;
      g.y += p.vy * dt;
      g.rotation += p.spin * dt;

      const s = g.scale.x + p.grow * dt;
      g.scale.set(s);

      p.life -= dt;
      const k = Math.max(0, p.life / p.life0);
      g.alpha = (0.02 + 0.40 * k * k);

      const off =
        p.life <= 0 ||
        g.x < -220 || g.x > W + 220 ||
        g.y < -220 || g.y > H + 220;

      if (off) {
        g.removeFromParent();
        smokeLive.splice(i, 1);
        smokePool.push(p);
      }
    }

    // base game smoke spawn
    if (!smokeFxEnabled) {
      smokeSpawnAcc = 0;
      return;
    }

    smokeSpawnAcc += SMOKE_SPAWN_PER_SEC * dt;
    let n = Math.floor(smokeSpawnAcc);
    if (n > 0) smokeSpawnAcc -= n;

    for (let i = 0; i < n; i++) {
      if (smokeLive.length >= SMOKE_MAX_LIVE) break;
      spawnSmoke();
    }
  }

  function clearSmoke() {
    for (let i = smokeLive.length - 1; i >= 0; i--) {
      const p = smokeLive[i];
      p.g.removeFromParent();
      smokeLive.splice(i, 1);
      smokePool.push(p);
    }
    smokeSpawnAcc = 0;
  }

  // -----------------------------
  // SNOW FX
  // -----------------------------
  const snowFxLayer = new Container();
  snowFxLayer.sortableChildren = true;
  snowFxLayer.zIndex = 1200;
  snowFxLayer.eventMode = "none";
  root.addChild(snowFxLayer);

  type SnowParticle = {
    g: Graphics;
    vx: number;
    vy: number;
    vr: number;
    life: number;
    life0: number;
  };

  const snowPool: SnowParticle[] = [];
  const snowLive: SnowParticle[] = [];
  let snowSpawnAcc = 0;
  let snowFxEnabled = false;

  const SNOW_MAX_LIVE = 140;
  const SNOW_SPAWN_PER_SEC = 10;

  function makeVoxelSnowflake(): Graphics {
    const g = new Graphics();
    const vox = 2 + ((Math.random() * 2) | 0); // 2..4
    const blocks = 2 + ((Math.random() * 5) | 0);
    const cols = [0xffffff, 0xffffff, 0xf7fdff, 0xfffbf2];

    for (let i = 0; i < blocks; i++) {
      const x = ((-1 + Math.random() * 2) * vox * 1.2) | 0;
      const y = ((-1 + Math.random() * 2) * vox * 1.2) | 0;
      g.rect(x, y, vox, vox).fill({ color: cols[(Math.random() * cols.length) | 0], alpha: 1 });
    }

    g.alpha = 0.75 + Math.random() * 0.25;
    g.scale.set(0.9 + Math.random() * 0.7);
    return g;
  }

  function spawnSnow() {
    const W = app.renderer.width;

    let p = snowPool.pop();
    if (!p) {
      const g = makeVoxelSnowflake();
      p = { g, vx: 0, vy: 0, vr: 0, life: 0, life0: 0 };
    }

    const g = p.g;

    g.x = -40 + Math.random() * (W + 80);
    g.y = -80 - Math.random() * 220;

    p.vy = 55 + Math.random() * 130;
    p.vx = -25 + Math.random() * 50;
    p.vr = (-1 + Math.random() * 2) * 0.25;

    p.life0 = 2.0 + Math.random() * 1.6;
    p.life = p.life0;

    g.rotation = Math.random() * Math.PI * 2;

    snowFxLayer.addChild(g);
    snowLive.push(p);
  }

  function tickSnowFx(dt: number) {
    const W = app.renderer.width;
    const H = app.renderer.height;

    if (snowFxEnabled) {
      snowSpawnAcc += SNOW_SPAWN_PER_SEC * dt;
      const n = Math.floor(snowSpawnAcc);
      if (n > 0) snowSpawnAcc -= n;

      for (let i = 0; i < n; i++) {
        if (snowLive.length >= SNOW_MAX_LIVE) break;
        spawnSnow();
      }
    } else {
      snowSpawnAcc = 0;
    }

    for (let i = snowLive.length - 1; i >= 0; i--) {
      const p = snowLive[i];
      const g = p.g;

      g.x += p.vx * dt;
      g.y += p.vy * dt;
      g.rotation += p.vr * dt;

      p.life -= dt;

      const off = g.y > H + 140 || g.x < -220 || g.x > W + 220 || p.life <= 0;
      if (off) {
        g.removeFromParent();
        snowLive.splice(i, 1);
        snowPool.push(p);
      }
    }
  }

  function clearSnow() {
    for (let i = snowLive.length - 1; i >= 0; i--) {
      const p = snowLive[i];
      p.g.removeFromParent();
      snowLive.splice(i, 1);
      snowPool.push(p);
    }
    snowSpawnAcc = 0;
  }

  // -----------------------------
  // Public API
  // -----------------------------
  function setEnabled(v: AmbientFxEnabled) {
    if (typeof v.clouds === "boolean") cloudFxEnabled = v.clouds;
    if (typeof v.leaves === "boolean") leafFxEnabled = v.leaves;
    if (typeof v.smoke === "boolean") smokeFxEnabled = v.smoke;
    if (typeof v.snow === "boolean") snowFxEnabled = v.snow;
  }

  // Central ticker (one addSystem for all 4)
  addSystem((dt) => {
    dt = Math.min(0.05, dt);
    tickCloudFx(dt);
    tickLeafFx(dt);
    tickSmokeFx(dt);
    tickSnowFx(dt);
  });

  // Ensure correct initial ordering (in case)
  backgroundLayer.sortChildren();
  root.sortChildren();

  return {
    layers: { cloudFxLayer, leafFxLayer, smokeFxLayer, snowFxLayer },

    // enable toggles
    setEnabled,

    // clouds
    seedClouds,
    clearClouds,

    // leaves
    clearLeaves,

    // smoke
    clearSmoke,

    // snow
    clearSnow,
  };
}
