// src/dev/devCurrencySwitcher.ts

const CURRENCIES = [
  "USD", "JPY", "IDR", "VND", "KRW",
  "EUR", "PLN", "DKK", "XGC", "XSC",
] as const;

const KEY = "__DEV_FORCE_CURRENCY__";

export function getDevForcedCurrency(): string | null {
  try {
    // URL wins (easy to share)
    const urlCur = new URLSearchParams(window.location.search).get("currency");
    if (urlCur) return urlCur.toUpperCase();

    // localStorage persists across reloads
    const ls = localStorage.getItem(KEY);
    return ls ? ls.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function installDevCurrencySwitcher() {
  // DEV ONLY
  if (!import.meta.env.DEV) return;

  // don’t show during replay (optional but recommended)
  const isReplay = new URLSearchParams(window.location.search).get("replay") === "true";
  if (isReplay) return;

  // already mounted?
  if (document.getElementById("dev-currency-switcher")) return;

  const wrap = document.createElement("div");
  wrap.id = "dev-currency-switcher";
  wrap.style.position = "fixed";
  wrap.style.right = "10px";
  wrap.style.bottom = "10px";
  wrap.style.zIndex = "999999";
  wrap.style.display = "flex";
  wrap.style.gap = "8px";
  wrap.style.alignItems = "center";
  wrap.style.padding = "8px 10px";
  wrap.style.background = "rgba(0,0,0,0.6)";
  wrap.style.border = "1px solid rgba(255,255,255,0.25)";
  wrap.style.borderRadius = "8px";
  wrap.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  wrap.style.fontSize = "12px";
  wrap.style.color = "white";

  const label = document.createElement("span");
  label.textContent = "DEV Currency:";

  const sel = document.createElement("select");
  sel.style.padding = "4px 6px";
  sel.style.borderRadius = "6px";

  const cur = getDevForcedCurrency() ?? "USD";
  for (const c of CURRENCIES) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  }
  sel.value = cur;

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.style.padding = "4px 8px";
  clearBtn.style.borderRadius = "6px";
  clearBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  clearBtn.style.background = "rgba(255,255,255,0.10)";
  clearBtn.style.color = "white";
  clearBtn.style.cursor = "pointer";

  sel.onchange = () => {
    localStorage.setItem(KEY, sel.value);
    location.reload();
  };

  clearBtn.onclick = () => {
    localStorage.removeItem(KEY);
    location.reload();
  };

  wrap.appendChild(label);
  wrap.appendChild(sel);
  wrap.appendChild(clearBtn);
  document.body.appendChild(wrap);
}
