  // src/audio/audio.ts
  import { Howl, Howler } from "howler";

export type SfxKey =
  | "ui_click"
  | "confirm"
  | "ui_toggle"
  | "spin_start"
  | "reel_land"
  | "cluster_pop"
  | "explode"
  | "fs_click"
  | "bigwin_hit"
  | "final_amount"
  | "final_fsoutro_amount"
  | "bounce"
  | "multiplier"
  | "boosted"
  | "infused"
  | "car"
  | "tick"
  | "tickhigh"
  | "ticktock"
  | "fstrigger";








  // -----------------------------
  // FS INTRO TRACTOR LOOP (gapless)
  // -----------------------------
  const TRACTOR_LOOP_START = 0.2;   // seconds
  const TRACTOR_LOOP_END   = .9; // seconds


  type MusicKey = "music_base" | "music_fs" | "music_bigwin";

  type AudioOptions = {
    sfxVolume01?: number;    // 0..1
    musicVolume01?: number;  // 0..1
    sfxMuted?: boolean;
    musicMuted?: boolean;
  };

  export class AudioManager {
    getBaseMusicIntensity01() {
    return this.baseIntensity01;
  }
  private lastMusicKey: MusicKey | null = null;
    // ✅ Ensure base layers are playing (muted), so they stay in sync
  private ensureBaseLayersPlaying() {
    if (this.baseLayersInited) return;
    this.baseLayersInited = true;

    for (const h of this.musicBaseLayers) {
      try {
        h.stop();
      } catch {}
      h.volume(0);
      h.play(); // start immediately so all stems align
    }
  }

  // ✅ Stop base layers (used when switching away from base soundtrack)
  private stopBaseLayers(fadeMs = 250) {
    this.baseLayersInited = false;

    for (const h of this.musicBaseLayers) {
      if (!h) continue;
      if (h.playing()) {
        const v0 = h.volume();
        h.fade(v0, 0, fadeMs);
        setTimeout(() => h.stop(), fadeMs + 20);
      } else {
        try { h.stop(); } catch {}
      }
      h.volume(0);
    }
  }

  // ✅ "Fake dynamic soundtrack": fade layers based on intensity 0..1
  setBaseMusicIntensity(intensity01: number, fadeMs = 250) {
      // 🚫 NEVER allow base layers outside base mode
    if (this.currentMusicKey !== "music_base") {
      return;
    }
    this.baseIntensity01 = clamp01(intensity01);

    // If muted, keep everything silent but still playing (for sync)
    if (this.musicMuted) {
      for (const h of this.musicBaseLayers) {
        if (h.playing()) h.volume(0);
      }
      return;
    }

    this.ensureBaseLayersPlaying();

    // 3 layers: drums always, bass mid, melody high
    // Tweak these thresholds to taste.
    const i = this.baseIntensity01;

    const vDrums  = this.musicVolume01 * (0.55 + 0.45 * i);                     // 0.55..1.0
    const vBass   = this.musicVolume01 * smoothstep01((i - 0.20) / 0.45);       // fades in around 0.20..0.65
    const vMelody = this.musicVolume01 * smoothstep01((i - 0.55) / 0.35);       // fades in around 0.55..0.90

    const vols = [vDrums, vBass, vMelody];

    for (let idx = 0; idx < this.musicBaseLayers.length; idx++) {
      const h = this.musicBaseLayers[idx];
      if (!h) continue;

      const target = vols[idx] ?? 0;
      const cur = h.volume();

      // Howler fade is smooth and cheap
      h.fade(cur, target, fadeMs);
    }
  }

  private musicDuckTarget = 1;
  private musicDuckCurrent = 1;
  private musicDuckToken = 0;

  duckMusic(target01: number, ms = 300) {
    this.musicDuckToken++;
    const token = this.musicDuckToken;

    const from = this.musicDuckCurrent;
    const to = Math.max(0, Math.min(1, target01));
    const start = performance.now();

    const tick = () => {
      if (token !== this.musicDuckToken) return;

      const t = Math.min(1, (performance.now() - start) / ms);
      const e = t * t * (3 - 2 * t); // smoothstep
      this.musicDuckCurrent = from + (to - from) * e;

      this.apply(); // re-apply Howler volumes

      if (t < 1) requestAnimationFrame(tick);
    };

    tick();
  }

  getMusicDuck(): number {
    return this.musicDuckCurrent;
  }

    private inited = false;

    private sfxMuted = false;
    private musicMuted = false;

    private sfxVolume01 = 0.8;
    private musicVolume01 = 0.6;

    private sfx: Record<SfxKey, Howl>;
    private music: Record<MusicKey, Howl>;

  // ✅ Layered stems for "music_base"
  private musicBaseLayers: Howl[] = [];
  private baseIntensity01 = 0;   // 0..1
  private baseLayersInited = false;
  // =====================
  // TICK LOOP (Big Win + FS Outro)
  // =====================
  private tickId: number | null = null;
  private tickGain = 2.3; // try 1.3 .. 2.5
  private tickOn = false;
  private tickLastRate = 1;
  private tickLastVol = 0;
    // =====================
  // TICKHIGH LOOP (Cluster Win Popup)
  // =====================
  private tickHighId: number | null = null;
  private tickHighOn = false;
  private tickHighVolMul = 0.35;
  private tickHighLastRate = 1;
  private tickHighLastVol = 0;
  // =====================
  // ANTICIPATION TICKTOCK LOOP
  // =====================
  private ticktockId: number | null = null;
  private ticktockOn = false;
  private ticktockVolMul = 0.6; // tweak 0.4 .. 0.8
  private ticktockRate = 1.0;

  // =====================
  // FS INTRO: TRACTOR LOOP (overlay-only)
  // =====================
  private fsIntroTractor: Howl;
  private fsIntroTractorId: number | null = null;
  private fsIntroTractorVolMul = 0.85; // tweak 0.6..1.0


  private currentMusic: Howl | null = null;
  private currentMusicKey: MusicKey | null = null;

    constructor(opts: AudioOptions = {}) {
      this.sfxMuted = !!opts.sfxMuted;
      this.musicMuted = !!opts.musicMuted;
      if (typeof opts.sfxVolume01 === "number") this.sfxVolume01 = clamp01(opts.sfxVolume01);
      if (typeof opts.musicVolume01 === "number") this.musicVolume01 = clamp01(opts.musicVolume01);

      // Create Howls (don’t auto-play yet)
      this.sfx = {
        infused: this.makeSfx("/assets/audio/infused.mp3"),
    ui_click: this.makeSfx("/assets/audio/ui_click.mp3"),
    confirm:  this.makeSfx("/assets/audio/confirm.mp3"), 
    ui_toggle: this.makeSfx("/assets/audio/ui_toggle.mp3"),
    spin_start: this.makeSfx("/assets/audio/spin_start.mp3"),
    reel_land: this.makeSfx("/assets/audio/reel_land.mp3"),
    cluster_pop: this.makeSfx("/assets/audio/cluster_pop.mp3"),
    fs_click: this.makeSfx("/assets/audio/fs_click.mp3"),
    explode: this.makeSfx("/assets/audio/explode.mp3"),
    car: this.makeSfx("/assets/audio/car.mp3"), 
    fstrigger: this.makeSfx("/assets/audio/fstrigger.mp3"),
    bigwin_hit: this.makeSfx("/assets/audio/bigwin_hit.mp3"),
  final_amount: this.makeSfx("/assets/audio/final_amount.mp3"),
  final_fsoutro_amount: this.makeSfx("/assets/audio/final_fsoutro_amount.mp3"),
    bounce: this.makeSfx("/assets/audio/bounce.mp3"),
    boosted: this.makeSfx("/assets/audio/boosted.mp3"),
      tick: this.makeSfx("/assets/audio/tick.mp3"),
      tickhigh: new Howl({
  src: ["/assets/audio/tickhigh.mp3"],
  preload: true,
  loop: true,
  volume: this.sfxVolume01,
}),
        ticktock: new Howl({
  src: ["/assets/audio/ticktock.mp3"],
  preload: true,
  loop: true,
  volume: this.sfxVolume01,
}),
    multiplier: this.makeSfx("/assets/audio/multiplier.mp3"),
  };

  // FS INTRO tractor loop (gapless sprite loop — overlay only)
  this.fsIntroTractor = new Howl({
    src: ["/assets/audio/tractor.mp3"],
    preload: true,
    html5: false, // force WebAudio for accurate looping
    volume: 0,    // start silent, fade in
    sprite: {
      loop: [
        TRACTOR_LOOP_START * 1000,
        (TRACTOR_LOOP_END - TRACTOR_LOOP_START) * 1000,
        true, // loop forever
      ],
    },
  });


  console.log("[AUDIO] explode howl exists?", !!this.sfx.explode);
  this.sfx.explode.on("load", () => console.log("[AUDIO] explode LOADED ✅"));
  this.sfx.explode.on("loaderror", (_id: number, err: unknown) =>
    console.warn("[AUDIO] explode LOAD ERROR ❌", err)
  );

  this.sfx.explode.on("playerror", (_id: number, err: unknown) =>
    console.warn("[AUDIO] explode PLAY ERROR ❌", err)
  );



      this.music = {
        music_base: this.makeMusic("/assets/audio/music_base.mp3"),
        music_fs: this.makeMusic("/assets/audio/music_free.mp3"),
        music_bigwin: this.makeMusic("/assets/audio/music_bigwin.mp3"),
      };
      // ✅ Build base layered stems (all loop, silent until activated)
  this.musicBaseLayers = [
    this.makeMusic("/assets/audio/music_base_drums.mp3"),
    this.makeMusic("/assets/audio/music_base_drums.mp3"),
    this.makeMusic("/assets/audio/music_base_drums.mp3"),
  ];

  // start silent until we activate base layers
  for (const h of this.musicBaseLayers) {
    h.volume(0);
  }

      this.apply();
    }

    // IMPORTANT: call once from a USER GESTURE (pointerdown) to unlock audio on mobile.
    initFromUserGesture() {
      
      if (this.inited) return;
      this.inited = true;
  console.log("[AUDIO] usingWebAudio:", (Howler as any).usingWebAudio, "ctx:", (Howler as any).ctx);

      // Some browsers need an explicit Howler context resume.
      try {
        // @ts-ignore
        Howler.ctx?.resume?.();
      } catch {}
      this.apply();
    }


    
    // -----------------
    // Controls
    // -----------------
    setSfxMuted(v: boolean) {
      this.sfxMuted = !!v;
      this.apply();
    }
  setMusicMuted(v: boolean) {
    this.musicMuted = !!v;

    if (this.musicMuted) {
      // stop whatever is currently playing
      this.stopMusic?.(120);
    } else {
      // resume whatever track was last requested
      if (this.lastMusicKey) this.playMusic(this.lastMusicKey, 120);
    }

    this.apply?.();
  }
    setSfxVolume01(v: number) {
      this.sfxVolume01 = clamp01(v);
      this.apply();
    }
    setMusicVolume01(v: number) {
      this.musicVolume01 = clamp01(v);
      this.apply();
    }

    getSfxMuted() { return this.sfxMuted; }
    getMusicMuted() { return this.musicMuted; }
    getSfxVolume01() { return this.sfxVolume01; }
    getMusicVolume01() { return this.musicVolume01; }

    // -----------------
    // Playback
    // -----------------
  playSfx(key: SfxKey, volMul = 1, rate = 1.0) {
    this.initFromUserGesture();
    if (this.sfxMuted) return;

    const h = this.sfx[key];

    if (!h) return;

    const busVol =
      this.sfxVolume01 *
      Math.max(0, volMul); // ✅ remove tickGain from normal SFX

    const r = Math.max(0.5, Math.min(2.5, rate));

    h.rate(r);
    h.volume(busVol);

    const id = h.play();
    h.rate(r, id);
    h.volume(busVol, id);
  }




    // Small helper for spammy sounds (cluster pops etc.)
  playSfxThrottled(key: SfxKey, ms: number, volMul = 1, rate = 1.0) {
    const now = performance.now();
    const k = `__thr_${key}` as const;
    // @ts-ignore
    const last = (this as any)[k] as number | undefined;
    if (ms > 0 && last != null && now - last < ms) return;
    // @ts-ignore
    (this as any)[k] = now;

    this.playSfx(key, volMul, rate);
  }

  // =====================
  // FS INTRO tractor loop controls
  // =====================
  startFsIntroTractorLoop(fadeMs = 300, volMul = 0.85) {
    this.fsIntroTractorVolMul = Math.max(0, volMul);

    // If muted, do nothing (but keep state consistent)
    if (this.sfxMuted) return;

    const target = this.sfxVolume01 * this.fsIntroTractorVolMul;

    // already playing? just fade to correct volume
  const existingId = this.fsIntroTractorId;
  if (existingId != null && this.fsIntroTractor.playing(existingId)) {
    const cur = this.fsIntroTractor.volume(existingId) as number;
    this.fsIntroTractor.fade(cur, target, fadeMs, existingId);
    return;
  }


    // start fresh at 0 then fade in
    this.fsIntroTractor.volume(0);
  const id = this.fsIntroTractor.play("loop") as unknown as number;
  this.fsIntroTractorId = id;

  this.fsIntroTractor.fade(0, target, fadeMs, id);

  }

  stopFsIntroTractorLoop(fadeMs = 250) {
    if (this.fsIntroTractorId == null) return;

    const id = this.fsIntroTractorId as unknown as number;

    // If it isn't playing anymore, just clear state
    if (!this.fsIntroTractor.playing(id)) {
      this.fsIntroTractorId = null;
      return;
    }

    const cur = this.fsIntroTractor.volume(id) as number;
    this.fsIntroTractor.fade(cur, 0, fadeMs, id);

    // hard stop after fade
    setTimeout(() => {
      if (this.fsIntroTractorId !== (id as any)) return;
      try { this.fsIntroTractor.stop(id); } catch {}
      this.fsIntroTractorId = null;
    }, fadeMs + 30);
  }

  // =====================
  // TICK LOOP controls (Big Win + FS Outro)
  // =====================
  startTickLoop(fadeMs = 120, volMul = 0.35, rate = 1.0) {
    // ✅ ensure audio is unlocked before starting any loop
    this.initFromUserGesture();

    if (this.sfxMuted) return;
    const h = this.sfx.tick;
    console.log("[TICK] startTickLoop", {
    sfxMuted: this.sfxMuted,
    sfxVolume01: this.sfxVolume01,
    volMul,
    rate,
    tickId: this.tickId,
    playing: this.tickId != null ? h.playing(this.tickId) : false,
  });

    if (!h) return;

    this.tickOn = true;

  const busVol =
    this.sfxVolume01 *
    Math.max(0, volMul) *
    this.tickGain;
    const busVolClamped = Math.min(1.0, busVol);
    const r = Math.max(0.5, Math.min(3.5, rate));

    // start loop if needed
    if (this.tickId == null || !h.playing(this.tickId)) {
      h.loop(true);
      h.volume(0);
      h.rate(r);
      const id = h.play() as unknown as number;
      this.tickId = id;
    }

    // fade in to target
    const id = this.tickId!;
    const cur = h.volume(id);
    try {
      h.fade(cur as number, busVol, fadeMs, id);
    } catch {
      h.volume(busVol, id);
    }

    this.tickLastRate = r;
    this.tickLastVol = busVol;
  }

  setTickParams(volMul: number, rate: number) {
    if (!this.tickOn) return;
    if (this.sfxMuted) return;

    const h = this.sfx.tick;
    if (!h) return;
    if (this.tickId == null) return;

    const id = this.tickId;

    const busVol = this.sfxVolume01 * Math.max(0, volMul);
    const r = Math.max(0.5, Math.min(3.5, rate));

    // avoid micro-spam
    if (Math.abs(r - this.tickLastRate) > 0.01) {
      h.rate(r, id);
      this.tickLastRate = r;
    }
    if (Math.abs(busVol - this.tickLastVol) > 0.01) {
      h.volume(busVol, id);
      this.tickLastVol = busVol;
    }
  }

  stopTickLoop(fadeMs = 140) {
    const h = this.sfx.tick;
    if (!h) return;

    this.tickOn = false;

    if (this.tickId == null) return;

    const id = this.tickId;
    this.tickId = null;

    try {
      const cur = h.volume(id);
      h.fade(cur as number, 0, fadeMs, id);
      setTimeout(() => {
        try { h.stop(id); } catch {}
      }, fadeMs + 20);
    } catch {
      try { h.stop(id); } catch {}
    }
  }
  // =====================
  // ANTICIPATION TICKTOCK LOOP controls
  // =====================
  startTicktockLoop(fadeMs = 120, volMul = 0.6, rate = 1.0) {
    this.initFromUserGesture();
    if (this.sfxMuted) return;

    const h = this.sfx.ticktock;
    if (!h) return;

    this.ticktockOn = true;
    this.ticktockVolMul = Math.max(0, volMul);
    this.ticktockRate = Math.max(0.5, Math.min(2.5, rate));

    const targetVol = this.sfxVolume01 * this.ticktockVolMul;

    // already playing → just fade to target
    if (this.ticktockId != null && h.playing(this.ticktockId)) {
      const cur = h.volume(this.ticktockId) as number;
      try { h.fade(cur, targetVol, fadeMs, this.ticktockId); }
      catch { h.volume(targetVol, this.ticktockId); }
      h.rate(this.ticktockRate, this.ticktockId);
      return;
    }

    // start fresh (IMPORTANT: do NOT set h.loop(true) globally)
    h.volume(0);
    const id = h.play() as unknown as number;
    this.ticktockId = id;

    // loop ONLY this playback id
    h.loop(true, id);
    h.rate(this.ticktockRate, id);

    try { h.fade(0, targetVol, fadeMs, id); }
    catch { h.volume(targetVol, id); }
  }
// =====================
// TICKHIGH LOOP controls (Cluster Win Popup)
// =====================
startTickHighLoop(fadeMs = 80, volMul = 0.22, rate = 1.0) {
  this.initFromUserGesture();
  if (this.sfxMuted) return;

  const h = this.sfx.tickhigh;
  if (!h) return;

  this.tickHighOn = true;

  const busVol = this.sfxVolume01 * Math.max(0, volMul);
  const r = Math.max(0.5, Math.min(3.5, rate));

  // start loop if needed
  if (this.tickHighId == null || !h.playing(this.tickHighId)) {
    h.volume(0);
    h.rate(r);
    const id = h.play() as unknown as number;
    this.tickHighId = id;

    // ensure loop for this playback
    try { h.loop(true, id); } catch { h.loop(true); }
  }

  const id = this.tickHighId!;
  const cur = h.volume(id) as number;

  try {
    h.fade(cur, busVol, fadeMs, id);
  } catch {
    h.volume(busVol, id);
  }

  this.tickHighLastRate = r;
  this.tickHighLastVol = busVol;
}

setTickHighParams(volMul: number, rate: number) {
  if (!this.tickHighOn) return;
  if (this.sfxMuted) return;

  const h = this.sfx.tickhigh;
  if (!h) return;
  if (this.tickHighId == null) return;

  const id = this.tickHighId;

  const busVol = this.sfxVolume01 * Math.max(0, volMul);
  const r = Math.max(0.5, Math.min(3.5, rate));

  if (Math.abs(r - this.tickHighLastRate) > 0.01) {
    h.rate(r, id);
    this.tickHighLastRate = r;
  }

  if (Math.abs(busVol - this.tickHighLastVol) > 0.01) {
    h.volume(busVol, id);
    this.tickHighLastVol = busVol;
  }
}

stopTickHighLoop(fadeMs = 80) {
  const h = this.sfx.tickhigh;
  if (!h) return;

  this.tickHighOn = false;

  const id = this.tickHighId;
  this.tickHighId = null;

  if (id == null) return;

  try { h.loop(false, id); } catch {}

  try {
    const cur = h.volume(id) as number;
    if (fadeMs <= 0) {
      try { h.stop(id); } catch {}
      return;
    }

    h.fade(cur, 0, fadeMs, id);
    setTimeout(() => {
      try { h.stop(id); } catch {}
    }, fadeMs + 20);
  } catch {
    try { h.stop(id); } catch {}
  }
}


  stopTicktockLoop(fadeMs = 120) {
    const h = this.sfx.ticktock;
    if (!h) return;

    this.ticktockOn = false;

    const id = this.ticktockId;
    this.ticktockId = null;

    // If we don't know the id anymore, still hard-stop any stray ticktock instances.
    if (id == null) {
      try { h.loop(false); } catch {}
      try { h.stop(); } catch {}
      return;
    }

    // turn looping off for this playback id
    try { h.loop(false, id); } catch {}

    // fade out then stop (and also hard-stop any strays as a backstop)
    try {
      const cur = h.volume(id) as number;
      if (fadeMs <= 0) {
        try { h.stop(id); } catch {}
        try { h.loop(false); } catch {}
        try { h.stop(); } catch {} // backstop: kill any stray ticktock loops
        return;
      }

      h.fade(cur, 0, fadeMs, id);
      setTimeout(() => {
        try { h.stop(id); } catch {}
        try { h.loop(false); } catch {}
        try { h.stop(); } catch {} // backstop
      }, fadeMs + 30);
    } catch {
      try { h.stop(id); } catch {}
      try { h.loop(false); } catch {}
      try { h.stop(); } catch {} // backstop
    }
  }


  playMusic(key: MusicKey, fadeMs = 300) {
    this.lastMusicKey = key;
  if (this.musicMuted) {
    // don't start any new music while muted
    this.stopMusic?.(fadeMs ?? 0);
    return;
  }
    // 🔒 Guard
    if (this.currentMusicKey === key) return;

    const prevKey = this.currentMusicKey;

    // 🔴 BASE MUSIC IS LAYER-ONLY
    if (key === "music_base") {
      // stop any non-base music
      if (this.currentMusic) {
        const cur = this.currentMusic;
        cur.fade(cur.volume(), 0, fadeMs);
        setTimeout(() => cur.stop(), fadeMs + 20);
        this.currentMusic = null;
      }

      this.currentMusicKey = "music_base";

      // start layered base music ONLY
      this.ensureBaseLayersPlaying();
      this.setBaseMusicIntensity(this.baseIntensity01, fadeMs);
      return;
    }

    // 🔴 leaving base → stop layers
    if (prevKey === "music_base") {
      this.stopBaseLayers(fadeMs);
    }

    // 🔵 NORMAL MUSIC (FS / BIG WIN)
    const next = this.music[key];
    if (!next) return;

    const prev = this.currentMusic;

    this.currentMusic = next;
    this.currentMusicKey = key;

    next.volume(0);
    next.loop(true);
    next.play();
    next.fade(0, this.musicVolume01, fadeMs);

    if (prev) {
      const v = prev.volume();
      prev.fade(v, 0, fadeMs);
      setTimeout(() => prev.stop(), fadeMs + 20);
    }
  }



    stopMusic(fadeMs = 250) {
    if (!this.currentMusic) return;

    // ✅ Correct base-layer shutdown
    if (this.currentMusicKey === "music_base") {
      this.stopBaseLayers(fadeMs);
    }

    const cur = this.currentMusic;
    this.currentMusic = null;
    this.currentMusicKey = null;

    if (!cur.playing()) return;

    const v0 = cur.volume();
    cur.fade(v0, 0, fadeMs);
    setTimeout(() => cur.stop(), fadeMs + 20);
  }

    // Re-apply bus state to everything
    apply() {
      


      // ✅ FS INTRO tractor loop follows SFX mute/volume live
  if (this.fsIntroTractorId != null) {
    const id = this.fsIntroTractorId;

    if (this.sfxMuted) {
      // keep playing? no — silence it immediately, and stop cleanly
      this.fsIntroTractor.volume(0, id);
    } else {
      const target = this.sfxVolume01 * this.fsIntroTractorVolMul;
      this.fsIntroTractor.volume(target, id);
    }
  }

    // ✅ stop tick loop when muting
    // ✅ stop anticipation ticktock when muting
  if (this.sfxMuted) {
    this.stopTicktockLoop(0);
  }
    if (this.sfxMuted) {
      this.stopTickLoop(0);
    }
    if (this.sfxMuted) {
  this.stopTickHighLoop(0);
}

      // SFX: nothing playing continuously, so just keep volumes updated when played.

      // Music: enforce mute/volume on currently playing track
      for (const k of Object.keys(this.music) as MusicKey[]) {
        const h = this.music[k];
        if (!h) continue;

        if (this.musicMuted) {
          if (h.playing()) h.volume(0);
        } else {
          // Only the current track should be audible
          if (this.currentMusicKey === k) h.volume(this.musicVolume01);
          else h.volume(0);
        }
      }
  if (this.currentMusicKey === "music_base") {
    this.setBaseMusicIntensity(this.baseIntensity01, 60);
  }


    }

    // -----------------
    // Internals
    // -----------------
  private makeSfx(url: string) {
    const h = new Howl({
      src: [url],
      preload: true,
      volume: this.sfxVolume01,
    });

    h.on("load", () => console.log("[SFX load OK]", url));
  h.on("loaderror", (_id: number, err: unknown) => console.warn("[SFX load ERROR]", url, err));
  h.on("playerror", (_id: number, err: unknown) => console.warn("[SFX play ERROR]", url, err));


    return h;
  }

    private makeMusic(url: string) {
      return new Howl({
        src: [url],
        preload: true,
        loop: true,
        volume: this.musicVolume01,
      });
    }
  }

  function smoothstep01(x: number) {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  }


  function clamp01(v: number) {
    return Math.max(0, Math.min(1, v));
  }
