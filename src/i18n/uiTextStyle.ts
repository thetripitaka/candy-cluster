// src/i18n/uiTextStyle.ts
// src/i18n/uiTextStyle.ts
import { TextStyle } from "pixi.js";
import { getLang, t } from "./i18n";
import type { Lang } from "./i18n";
import { uiFontFamilyFor } from "./fonts";

function isLatinUiLang(lang: string) {
  const base = (lang || "en").toLowerCase();
    if (base === "tr" || base.startsWith("tr-")) return false;
  const latin = [
    "en", "es", "fr", "de", "it", "pt",
    "nl", "sv", "da", "no", "fi","id", "tl",
    "pl", "cs", "sk", "hu", "ro", 
  ];
  return latin.some((k) => base === k || base.startsWith(k + "-"));
}

export function micro5ForLatinUiFontFamily(lang: string) {
  if (isLatinUiLang(lang)) return '"Micro5"';
  return uiFontFamilyFor(lang as any);
}

export function splashSubtitleFontFamilyFor(lang: string) {
  if (isLatinUiLang(lang)) return '"Micro5"';
  return uiFontFamilyFor(lang as any);
}






function uiTextTuningFor(lang: Lang) {
  switch (lang) {
    case "ar":
      return { fontSizeMul: .8, letterSpacing: 0, lineHeightMul: 1.15, uppercase: false };

    case "hi":
      return { fontSizeMul: 0.6, letterSpacing: 0, lineHeightMul: 1.2, uppercase: false };

    case "zh":
        return { fontSizeMul: 0.8, letterSpacing: 0, lineHeightMul: 1.2, uppercase: false };
    case "ja":
      return { fontSizeMul: .7, letterSpacing: -1, lineHeightMul: 1.1, uppercase: false };
    case "ko":
      return { fontSizeMul: .8, letterSpacing: 0, lineHeightMul: 1.1, uppercase: false };

      case "tr":
      return { fontSizeMul: 1.1, letterSpacing: 0, lineHeightMul: 1.1, uppercase: false };

    case "vi":
      return { fontSizeMul: .7, letterSpacing: 0, lineHeightMul: 1.1, uppercase: true };

    // 🔴 RUSSIAN FIX
    case "ru":
      return { fontSizeMul: 0.7, letterSpacing: 1, lineHeightMul: 1.05, uppercase: true };

    default:
      return { fontSizeMul: 1.0, letterSpacing: 2, lineHeightMul: 1.0, uppercase: true };
  }
}


/**
 * Create a Pixi TextStyle that automatically uses a good font for the current language.
 */
export function makeUiTextStyle(base: {
  fontSize: number;
  fill?: any;
  stroke?: any;
  strokeThickness?: number;
  align?: "left" | "center" | "right";
}) {
  const lang = getLang();
  const tune = uiTextTuningFor(lang);

  return new TextStyle({
    ...base,
    fontFamily: uiFontFamilyFor(lang),
    fontSize: Math.round(base.fontSize * tune.fontSizeMul),
    letterSpacing: tune.letterSpacing,
    lineHeight: Math.round(base.fontSize * tune.lineHeightMul),
  });
}

/**
 * Apply casing rules for the current language.
 * (Latin: uppercase; CJK/Arabic/Hindi: keep as-is)
 */
export function applyUiTextCase(text: string) {
  const lang = getLang();
  const tune = uiTextTuningFor(lang);
  return tune.uppercase ? text.toUpperCase() : text;
}

/**
 * Convenience: translate + apply casing rules in one call.
 */
export function resolveUiText(key: string) {
  return applyUiTextCase(t(key));
}
export function localizeStyle<T extends Record<string, any>>(baseStyle: T): T {
  const lang = getLang();
  const tune = uiTextTuningFor(lang);

  // Keep ALL your original styling, just swap what needs to change per language.
  const out: any = { ...baseStyle };

  // Swap font family to the language-specific one
  out.fontFamily = uiFontFamilyFor(lang);

  // Apply sizing/spacing tuning (only if the base style has these)
  if (typeof out.fontSize === "number") out.fontSize = Math.round(out.fontSize * tune.fontSizeMul);
  if (out.letterSpacing != null) out.letterSpacing = tune.letterSpacing;
  if (typeof out.lineHeight === "number") out.lineHeight = Math.round(out.lineHeight * tune.lineHeightMul);

  return out;
}
