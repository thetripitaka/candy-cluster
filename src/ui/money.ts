// src/ui/money.ts

// =====================
// MONEY FORMATTER (STAKE-REVIEW SAFE)
// =====================

// 🔒 DEV-only currency override (read-only, no import cycles)
function getDevForcedCurrency(): string | null {
  try {
    // URL wins (easy to share links)
    const urlCur = new URLSearchParams(window.location.search).get("currency");
    if (urlCur) return urlCur.toUpperCase();

    // persisted dev choice
    const ls = localStorage.getItem("__DEV_FORCE_CURRENCY__");
    return ls ? ls.toUpperCase() : null;
  } catch {
    return null;
  }
}

// Optional: DEV-only amount override helper (kept for convenience)
export function getDevTestAmount(): number | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(window.location.search).get("testAmount");
  return v ? Number(v) : null;
}

// ---------------------
// Stake currency metadata
// ---------------------

export type CurrencyCode = string;

type CurrencyMeta = {
  symbol: string;
  decimals: number;
  symbolAfter?: boolean; // if true => "10.00 KR" else => "$10.00"
};

// ✅ Based on Stake docs' supported currencies + display examples.
// (If Stake adds more later, fallback shows the code after the amount.)
const CURRENCY_META: Record<string, CurrencyMeta> = {
  USD: { symbol: "$", decimals: 2 },
  CAD: { symbol: "CA$", decimals: 2 },
  JPY: { symbol: "¥", decimals: 0 },
  EUR: { symbol: "€", decimals: 2 },
  RUB: { symbol: "₽", decimals: 2 },
  CNY: { symbol: "CN¥", decimals: 2 },

  PHP: { symbol: "₱", decimals: 2 },
  INR: { symbol: "₹", decimals: 2 },

  IDR: { symbol: "Rp", decimals: 0 },           // ✅ Stake: Rp10
  KRW: { symbol: "₩", decimals: 0 },            // ✅ Stake: ₩10
  BRL: { symbol: "R$", decimals: 2 },
  MXN: { symbol: "MX$", decimals: 2 },

  DKK: { symbol: "KR", decimals: 2, symbolAfter: true }, // ✅ Stake: 10.00 KR
  PLN: { symbol: "zł", decimals: 2, symbolAfter: true }, // ✅ Stake: 10.00 zł
  VND: { symbol: "₫", decimals: 0, symbolAfter: true },  // ✅ Stake: 10 ₫

  TRY: { symbol: "₺", decimals: 2 },
  CLP: { symbol: "CLP", decimals: 0, symbolAfter: true },
  ARS: { symbol: "ARS", decimals: 2, symbolAfter: true },
  PEN: { symbol: "S/", decimals: 2, symbolAfter: true },

  NGN: { symbol: "₦", decimals: 2 },
  SAR: { symbol: "SAR", decimals: 2, symbolAfter: true },
  ILS: { symbol: "ILS", decimals: 2, symbolAfter: true },
  AED: { symbol: "AED", decimals: 2, symbolAfter: true },
  TWD: { symbol: "NT$", decimals: 2 },
  NOK: { symbol: "kr", decimals: 2, symbolAfter: true },

  // 3-decimal “dinars” aren’t explicitly stated in the snippet you pasted,
  // but Stake commonly expects correct decimals here. If your Stake docs say 2,
  // change them to 2 — otherwise 3 is safer for review.
  KWD: { symbol: "KD", decimals: 3 },
  JOD: { symbol: "JD", decimals: 3 },
  BHD: { symbol: "BD", decimals: 3 },
  TND: { symbol: "TND", decimals: 3, symbolAfter: true },
  OMR: { symbol: "OMR", decimals: 3, symbolAfter: true },
  QAR: { symbol: "QAR", decimals: 2, symbolAfter: true },
  MYR: { symbol: "RM", decimals: 2 },
  SGD: { symbol: "SG$", decimals: 2 },
  CRC: { symbol: "₡", decimals: 2 },

  // Social Casino
  XGC: { symbol: "GC", decimals: 2 },
  XSC: { symbol: "SC", decimals: 2 },
};

// ---------------------
// Current session currency (set by RGS responses)
// ---------------------

let __sessionCurrency: string | null = null;

/**
 * Call this whenever you learn the real currency (authenticate/play/end-round).
 * Example: setSessionCurrency(res.balance.currency)
 */
export function setSessionCurrency(code: string | null | undefined) {
  const c = String(code || "").trim().toUpperCase();
  __sessionCurrency = c ? c : null;
}

function getActiveCurrency(): string {
  // DEV override wins (for local testing)
  const dev = import.meta.env.DEV ? getDevForcedCurrency() : null;
  if (dev) return dev;

  // Real Stake/RGS currency (authoritative)
  if (__sessionCurrency) return __sessionCurrency;

  // Fallback (choose your preferred default)
  return "USD";
}

// ---------------------
// Smart shortening (your existing behaviour)
// ---------------------

function shortenNumber(v: number) {
  const abs = Math.abs(v);

  // Keep up to 4 digits unshortened (0..9,999)
  if (abs < 10_000) return { value: v, suffix: "" };

  if (abs >= 1_000_000_000) return { value: v / 1_000_000_000, suffix: "B" };
  if (abs >= 1_000_000)     return { value: v / 1_000_000,     suffix: "M" };
  return { value: v / 1_000, suffix: "K" };
}

function formatFixed(v: number, digits: number) {
  // Stake uses plain fixed decimals (no locale commas requirement in docs)
  // If you *want* grouping (1,000) you can add it later, but this is the safest.
  return v.toFixed(digits);
}

function stakeFormatAmount(amount: number, currency: string): string {
  const meta: CurrencyMeta =
    CURRENCY_META[currency] ?? { symbol: currency, decimals: 2, symbolAfter: true };

  const { value, suffix } = shortenNumber(amount);

  const baseDigits = meta.decimals;

  // If shortened (K/M/B), show fewer decimals:
  // - >= 100K/M/B: 0dp (125K)
  // - else: 1dp (12.5K)
  const shortDigits =
    suffix ? (Math.abs(value) >= 100 ? 0 : 1) : baseDigits;

  const num = formatFixed(value, shortDigits);

  // apply suffix to the numeric part (keeps symbol placement stable)
  const numWithSuffix = suffix ? `${num}${suffix}` : num;

  return meta.symbolAfter
    ? `${numWithSuffix} ${meta.symbol}`
    : `${meta.symbol}${numWithSuffix}`;
}

/**
 * Stake-review safe money formatter.
 * - Uses Stake currency symbol + decimals + placement.
 * - Uses DEV override currency when present.
 * - Otherwise uses session currency set via setSessionCurrency().
 */
export function fmtMoney(v: number, currencyOverride?: string) {
  const cur = (currencyOverride ? currencyOverride.toUpperCase() : getActiveCurrency());
  return stakeFormatAmount(Number(v) || 0, cur);
}
