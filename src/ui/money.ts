// src/ui/money.ts

// =====================
// MONEY FORMATTER
// =====================
const moneyFmt = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

export function fmtMoney(v: number) {
  return moneyFmt.format(v);
}