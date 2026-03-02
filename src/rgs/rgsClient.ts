// src/rgs/rgsClient.ts
import { setSessionCurrency } from "../ui/money";

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
  currency: string; // e.g. "USD"
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

function safeCurrencyFromBalance(b: Balance | null | undefined): string | null {
  const c = String(b?.currency ?? "").trim().toUpperCase();
  return c ? c : null;
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
    // The iframe URL uses: sessionID, rgs_url, lang, currency, device, social, demo
    const sessionID = qsGet("sessionID", "sessionId", "session");
    const rgsUrlRaw = qsGet("rgs_url", "rgsUrl", "rgs");
    const lang = (qsGet("lang", "language") ?? "en").toLowerCase();

    const currency = qsGet("currency") ?? undefined;
    const device = qsGet("device", "deviceType") ?? undefined;
    const social = qsBool("social", false);
    const demo = qsBool("demo", false);

 if (!sessionID) {
  console.warn("[RGS] Missing sessionID");
  return false;
}

// If Stake no longer provides rgs_url,
// default to same-origin (modern Stake launcher)
const finalRgsUrl = rgsUrlRaw
  ? normalizeRgsBase(rgsUrlRaw)
  : window.location.origin;

this.cfg = {
  sessionID,
  rgsUrl: finalRgsUrl,
  lang,
  currency: currency?.toUpperCase(),
  device,
  social,
  demo,
};

// ✅ Pre-seed currency from URL so UI can show correct sign immediately.
if (this.cfg.currency) setSessionCurrency(this.cfg.currency);

console.log("[RGS] Detected environment", this.cfg);
console.log("[RGS] Using rgsUrl:", this.cfg.rgsUrl);
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

  // Try to surface structured Stake errors (ERR_VAL, ERR_IS, etc.)
  let j: any = null;
  try { j = text ? JSON.parse(text) : null; } catch {}

  const code = (j && typeof j === "object" && j.error) ? String(j.error) : "";
  const msg  = (j && typeof j === "object" && j.message) ? String(j.message) : "";

  // Make sure downstream code can match reliably
  const combined =
    (code || msg)
      ? `${code}${code && msg ? " " : ""}${msg}`.trim()
      : (text || `HTTP ${res.status}`);

  throw new Error(combined);
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

    // ✅ currency is display-only, but must be applied by the frontend
    const cur = safeCurrencyFromBalance(res.balance);
    if (cur) setSessionCurrency(cur);

    // round info (often null on load)
    const r = res.round;
    this.lastRoundActive = !!r?.active;
    const id = r?.betID ?? r?.id ?? null;
    this.lastBetId = id != null ? String(id) : null;
    // ✅ If Stake says there is an active round on load, DO NOT auto-close.
// The game should be able to resume/restart this round after refresh.
// We only record the state here.
if (r?.active) {
  console.warn("[RGS] Active round found on authenticate — leaving it open for resume", {
    betID: r?.betID ?? r?.id,
    active: r?.active,
  });
}


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

    const cur = safeCurrencyFromBalance(res.balance);
    if (cur) setSessionCurrency(cur);

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

    const cur = safeCurrencyFromBalance(res.balance);
    if (cur) setSessionCurrency(cur);

    return res;
  }

  /**
   * Only call endRound if the server says round.active === true.
   * In demo sessions you may see active=false; end-round will error if called.
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

      const cur = safeCurrencyFromBalance(res.balance);
      if (cur) setSessionCurrency(cur);

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
