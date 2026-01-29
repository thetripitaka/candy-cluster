// src/i18n/fonts.ts
import type { Lang } from "./i18n";

export function uiFontFamilyFor(lang: Lang): string {
  switch (lang) {
    case "ar":
      return `"Marhey", system-ui, sans-serif`;

    case "hi":
      return `"PlaypenSansDeva", system-ui, sans-serif`;

    case "zh":
      return `"ZCOOLKuaiLe", system-ui, sans-serif`;

    case "ja":
      return `"PottaOne", system-ui, sans-serif`;

    case "ko":
      return `"DoHyeon", system-ui, sans-serif`;

    case "vi":
      return `"Neucha", system-ui, sans-serif`; // or "RoadRage"

    case "ru":
      return `"Neucha", system-ui, sans-serif`;

      case "tr":
      return `"Bahiana", system-ui, sans-serif`;

    default:
      return `"Pixeldown","Micro5", system-ui, sans-serif`;
  }
}



