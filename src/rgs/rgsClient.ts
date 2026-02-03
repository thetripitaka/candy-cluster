// src/rgs/rgsClient.ts

type RgsConfig = {
  rgsUrl: string;
  sessionID: string;
  currency: string;
  lang: string;
};

function getQueryParam(name: string) {
  return new URLSearchParams(window.location.search).get(name);
}

// ✅ ADD THIS RIGHT HERE (below getQueryParam, above the class)
function normalizeRgsBase(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return "https://" + s;
}

export class RgsClient {
  private cfg: RgsConfig | null = null;
  private roundId: string | null = null;

  initFromUrl(): boolean {
    const rgsUrlRaw = getQueryParam("rgs_url");
    const sessionID = getQueryParam("sessionID");
    const currency = getQueryParam("currency");
    const lang = getQueryParam("lang") ?? "en";

  const rgsUrl = rgsUrlRaw
  ? normalizeRgsBase(rgsUrlRaw).replace(/\/+$/, "")
  : null;

    if (!rgsUrl || !sessionID || !currency) {
      console.warn("[RGS] Not running inside Stake RGS");
      return false;
    }

    this.cfg = { rgsUrl, sessionID, currency, lang };
    console.log("[RGS] Detected RGS environment", this.cfg);
    return true;
  }

  private async post(path: string, body: any) {
    if (!this.cfg) throw new Error("RGS not initialized");

    const res = await fetch(`${this.cfg.rgsUrl}${path}`, {
      method: "POST",
      credentials: "include", // ✅ important for dashboard sessions
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionID: this.cfg.sessionID,
        currency: this.cfg.currency,
        lang: this.cfg.lang,
        ...body,
      }),
    });

   if (!res.ok) {
  const t = await res.text();

  // ✅ show the full response body + request details in DevTools
  console.error("[RGS HTTP ERROR]", {
    url: `${this.cfg.rgsUrl}${path}`,
    status: res.status,
    statusText: res.statusText,
    body: t,
  });

  throw new Error(`[RGS ${path}] ${res.status}: ${t}`);
}


    return res.json();
  }

  async authenticate() {
    return this.post("/wallet/authenticate", {});

  }

async play(bet: number, mode: string) {
  // Stake expects integer "amount" with 6 decimals (micro-units)
  const amount = Math.round(bet * 1_000_000);

  const res = await this.post("/wallet/play", { amount, mode });
  this.roundId = (res as any)?.round?.id ?? (res as any)?.roundId ?? null;
  return res;
}


  async endRound(totalWin: number) {
    if (!this.roundId) return;

  // Stake expects integer win in micro-units (6 decimals)
const win = Math.round(totalWin * 1_000_000);

const res = await this.post("/wallet/end-round", {
  roundId: this.roundId,
  win,
});


    this.roundId = null;
    return res;
  }
} // ✅ close class

export const rgsClient = new RgsClient();
export default rgsClient;
