// src/i18n/loadFonts.ts
import { uiFontFamilyFor } from "./fonts";
import type { Lang } from "./i18n";

function firstFamily(fontFamily: string) {
  // `"Pixeldown","Micro5", system-ui` -> Pixeldown
  return fontFamily.split(",")[0].trim().replaceAll('"', "");
}

export async function ensureUiFontLoaded(lang: Lang) {
  const fam = firstFamily(uiFontFamilyFor(lang));
  // Ask browser to load it (size doesn't matter much; 16px is fine)
  await (document as any).fonts?.load?.(`16px "${fam}"`);
  await (document as any).fonts?.ready;
}
