// src/i18n/loadFonts.ts
import { uiFontFamilyFor } from "./fonts";
import type { Lang } from "./i18n";

function families(fontFamily: string) {
  // `"pixeldown","BigShoulders60pt-Black","Tiny5-Regular", system-ui`
  // -> ["pixeldown", "BigShoulders60pt-Black", "Tiny5-Regular", "system-ui"]
  return fontFamily
    .split(",")
    .map(s => s.trim().replaceAll('"', ""))
    .filter(Boolean);
}

export async function ensureUiFontLoaded(lang: Lang) {
  const fams = families(uiFontFamilyFor(lang));

  // Load the first few real font faces (skip system-ui / sans-serif)
  const toLoad = fams.filter(f => !["system-ui", "sans-serif", "serif", "monospace"].includes(f)).slice(0, 3);

  await Promise.allSettled(
    toLoad.map(f => (document as any).fonts?.load?.(`16px "${f}"`))
  );
  await (document as any).fonts?.ready;
}
