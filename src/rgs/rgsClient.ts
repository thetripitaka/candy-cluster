// src/rgs/rgsClient.ts

export type RgsConfig = {
  rgsUrl: string;      // e.g. "https://rgs.stake-engine.com"
  sessionID: string;   // uuid
  lang: string;        // "en"
  currency?: string;   // "USD"
  device?: string;     // "desktop" | "mobile"
  social?: boolean;
  demo?: boolean;
};

export type Balance = {
  amount: number;   // micro-units (6dp)
  currency: string;
};

export type AuthenticateResponse = {
  balance: Balance;
  config: {
    gameID?: string; // sometimes blank in demo
    minBet: number;
    maxBet: number;
    stepBet: number;
    defaultBetLevel: number;
    betLevels?: number[];
    betModes?: Record<string, unknown>;
    jurisdiction?: Record<string, unknown>;
  };
  round: null | {
    id?: string | number;
    betID?: string | number;
    active?: boolean;
    event?: unknown;
  };
  meta?: unknown;
};

export type PlayResponse = {
  balance: Balance;
  round: {
    betID?: number | string;
    id?: number | string;
    amount?: number;
    payout?: number;
    payoutMultiplier?: number;
    active?: boolean;     // IMPORTANT: end-round is only valid if true
    state?: any[];        // may be [] in demo mode
    mode?: string;        // "base"
    event?: unknown;      // may be null in demo mode
    [k: string]: any;
  };
};

export type BalanceResponse = { balance: Balance };
export type EndRoundResponse = { balance: Balance };

function qsGet(...keys: string[]): string | null {
  const qs = new URLSearchParams(window.location.search);
  for (const k of keys) {
    const v = qs.get(k);
    if (v != null && v !== "") return v;
  }
  return null;
}

function qsBool(key: string, fallback = false): boolean {
  const v = new URLSearchParams(window.location.search).get(key);
  if (v == null) return fallback;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function normalizeRgsBase(raw: string): string {
  const withProto = raw.startsWith("http://") || raw.startsWith("https://")
    ? raw
    : `https://${raw}`;
  return withProto.replace(/\/+$/, "");
}

export class RgsClient {
  // Your published math currently supports exactly one mode.
  public readonly MODE_BASE = "base" as const;

  private cfg: RgsConfig | null = null;

  private lastAuth: AuthenticateResponse | null = null;
  private lastBalance: Balance | null = null;

  // round tracking
  private lastRoundActive = false;
  private lastBetId: string | null = null;

  /* ------------------------- INIT ------------------------- */

  initFromUrl(): boolean {
    // The iframe URL you showed uses: sessionID, rgs_url, lang, currency, device, social, demo
    const sessionID = qsGet("sessionID", "sessionId", "session");
    const rgsUrlRaw = qsGet("rgs_url", "rgsUrl", "rgs");
    const lang = qsGet("lang", "language") ?? "en";

    const currency = qsGet("currency") ?? undefined;
    const device = qsGet("device", "deviceType") ?? undefined;
    const social = qsBool("social", false);
    const demo = qsBool("demo", false);

    if (!sessionID || !rgsUrlRaw) {
      console.warn("[RGS] Missing URL params (sessionID / rgs_url)");
      return false;
    }

    this.cfg = {
      sessionID,
      rgsUrl: normalizeRgsBase(rgsUrlRaw),
      lang,
      currency,
      device,
      social,
      demo,
    };

    console.log("[RGS] Detected environment", this.cfg);
    return true;
  }

  isReady(): boolean {
    return !!this.cfg;
  }

  isDemo(): boolean {
    return !!this.cfg?.demo;
  }

  getConfig(): RgsConfig | null {
    return this.cfg;
  }

  getLastAuth(): AuthenticateResponse | null {
    return this.lastAuth;
  }

  getLastBalance(): Balance | null {
    return this.lastBalance;
  }

  getLastBetId(): string | null {
    return this.lastBetId;
  }

  getLastRoundActive(): boolean {
    return this.lastRoundActive;
  }

  /* ------------------------- HTTP ------------------------- */

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!this.cfg) throw new Error("RGS not initialized");

    const payload = { ...body, sessionID: this.cfg.sessionID };

    console.log("[RGS] POST", path, payload);

    const res = await fetch(`${this.cfg.rgsUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[RGS HTTP ERROR] ${path} ${res.status}`, text);
      throw new Error(text || `HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  }

  /* ------------------------- BET VALIDATION ------------------------- */

  private snapAmountToAuth(amountMicro: number): number {
    const cfg = this.lastAuth?.config;
    const raw = Math.trunc(Number(amountMicro) || 0);

    if (!cfg) return raw;

    const levels = cfg.betLevels;
    if (Array.isArray(levels) && levels.length) {
      let best = levels[0];
      let bestDist = Math.abs(raw - best);
      for (const v of levels) {
        const d = Math.abs(raw - v);
        if (d < bestDist) {
          bestDist = d;
          best = v;
        }
      }
      return best;
    }

    const min = Math.trunc(cfg.minBet);
    const max = Math.trunc(cfg.maxBet);
    const step = Math.max(1, Math.trunc(cfg.stepBet));

    const clamped = Math.max(min, Math.min(max, raw));
    const snapped = clamped - (clamped % step);

    return Math.max(min, Math.min(max, snapped));
  }

  /* ------------------------- AUTH ------------------------- */

  async authenticate(): Promise<AuthenticateResponse> {
    const res = await this.post<AuthenticateResponse>("/wallet/authenticate", {});

    this.lastAuth = res;
    this.lastBalance = res.balance ?? null;

    // round info (often null on load)
    const r = res.round;
    this.lastRoundActive = !!r?.active;
    const id = r?.betID ?? r?.id ?? null;
    this.lastBetId = id != null ? String(id) : null;

    console.log("[RGS] authenticated", {
      balance: res.balance,
      minBet: res.config?.minBet,
      maxBet: res.config?.maxBet,
      stepBet: res.config?.stepBet,
      betLevelsCount: res.config?.betLevels?.length ?? 0,
      gameID: res.config?.gameID,
    });

    return res;
  }

  /* ------------------------- BALANCE ------------------------- */

  async balance(): Promise<BalanceResponse> {
    const res = await this.post<BalanceResponse>("/wallet/balance", {});
    this.lastBalance = res.balance ?? this.lastBalance;
    return res;
  }

  /* ------------------------- PLAY ------------------------- */

  async play(amountMicro: number, mode: string = this.MODE_BASE): Promise<PlayResponse> {
    const amount = this.snapAmountToAuth(amountMicro);

    const res = await this.post<PlayResponse>("/wallet/play", {
      amount,
      mode,
    });

    // Track whether end-round is allowed
    const r = res?.round;
    this.lastRoundActive = !!r?.active;

    const betID = r?.betID ?? r?.id ?? null;
    this.lastBetId = betID != null ? String(betID) : null;

    this.lastBalance = res.balance ?? this.lastBalance;

    return res;
  }

  /**
   * Only call endRound if the server says round.active === true.
   * In demo sessions you’ve observed active=false, and end-round returns ERR_VAL.
   */
  async endRound(): Promise<EndRoundResponse | null> {
    if (!this.lastRoundActive) {
      console.log("[RGS] endRound skipped — round not active");
      return null;
    }

    try {
      const res = await this.post<EndRoundResponse>("/wallet/end-round", {});
      this.lastRoundActive = false;
      this.lastBetId = null;
      this.lastBalance = res.balance ?? this.lastBalance;
      return res;
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      // Not fatal: already closed
      if (msg.includes("player does not have active bet")) {
        console.warn("[RGS] endRound not needed (already closed)");
        this.lastRoundActive = false;
        this.lastBetId = null;
        return null;
      }

      throw e;
    }
  }
}

export const rgsClient = new RgsClient();
export default rgsClient;
