// src/i18n/fonts.ts
import type { Lang } from "./i18n";

export const PIXELDOWN_STACK =
  `"pixeldown","BigShoulders60pt-Black", system-ui, Arial, sans-serif`;

export const MICRO5_STACK =
  `"Micro5","Tiny5-Regular", system-ui, Arial, sans-serif`;

function withSystemFallback(primary: string) {
  if (primary.includes("system-ui")) return primary;
  return `${primary}, system-ui, Arial, sans-serif`;
}

export function uiFontFamilyFor(lang: Lang): string {
  switch (lang) {
    case "ar":
      return withSystemFallback(`"Marhey"`);

    case "hi":
      return withSystemFallback(`"PlaypenSansDeva"`);

    case "zh":
      return withSystemFallback(`"ZCOOLKuaiLe"`);

    case "ja":
      return withSystemFallback(`"PottaOne"`);

    case "ko":
      return withSystemFallback(`"DoHyeon"`);

    case "vi":
    case "ru":
      return withSystemFallback(`"Neucha"`);

    case "tr":
      return withSystemFallback(`"Bahiana"`);

    default:
      return PIXELDOWN_STACK;
  }
}
