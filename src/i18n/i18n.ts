// src/i18n/i18n.ts

export type Lang =
  | "en"
  | "ar"
  | "de"
  | "es"
  | "fi"
  | "fr"
  | "hi"
  | "id"
  | "ja"
  | "ko"
  | "pl"
  | "pt"
  | "ru"
  | "tr"
  | "vi"
  | "zh"
  | "tl";

export type Dict = Record<string, string>;

const supported: Lang[] = [
  "en",
  "ar",
  "de",
  "es",
  "fi",
  "fr",
  "hi",
  "id",
  "ja",
  "ko",
  "pl",
  "pt",
  "ru",
  "tr",
  "vi",
  "zh",
  "tl",
];

let currentLang: Lang = "en";

export function setLang(raw?: string | null) {
  const v = (raw || "").toLowerCase().split("-")[0];
  currentLang = (supported as string[]).includes(v) ? (v as Lang) : "en";
}

export function getLang() {
  return currentLang;
}

// Optional params: t("ui.bigWin.xTimes", { x: "5" })
export function t(key: string, params?: Record<string, string | number>) {
  const en = DICTS.en ?? {};
  const d = DICTS[currentLang] ?? en;
  const raw = d[key] ?? en[key] ?? key;

  if (!params) return raw;

  return raw.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}

export const DICTS: Partial<Record<Lang, Dict>> = {
  // --------------------------------------------------
  // ENGLISH (SOURCE OF TRUTH)
  // --------------------------------------------------
  en: {
        // Boost / Infuse popup
    "ui.popup.boosted": "BOOSTED",
    "ui.popup.infused": "INFUSED",
    // Title split into two words so your animation still works
    "splash.title.blocky": "BLOCKY",
    "splash.title.farm": "FARM",

    // 3 splash info cards
    "splash.card1.title": "BONUS MODE",
    "splash.card1.body": "LAND 3 BONUS SYMBOLS\nTO ENTER BONUS MODE",

    "splash.card2.title": "+ MULTIPLIER",
    "splash.card2.body": "MULTIPLIER COMPOUNDS\nON EVERY CLUSTER WIN",

    "splash.card3.title": "BOUNCING WILD",
    "splash.card3.body": "SECOND CHANCE WILDS",

    "ui.tumbleWin": "TUMBLE WIN",
    "ui.freeSpins": "FREE SPINS",
    "ui.spinsLeft": "SPINS LEFT",
    "ui.info": "INFO",
    "ui.gameInfoTitle": "BLOCKY FARM – GAME INFO",

    // Core HUD
    "ui.clickToContinue": "CLICK TO CONTINUE",
    "ui.totalWin": "TOTAL WIN",
    "ui.balance": "BALANCE",
    "ui.bet": "BET",
    "ui.win": "WIN",
    "ui.mult": "MULT",

    // Loader / rotate
    "ui.loading": "LOADING SPELLS",
    "ui.loadingPct": "LOADING",
    "ui.rotateBackPortrait": "PLEASE ROTATE\nBACK TO PORTRAIT",

    // Buttons
    "ui.btnBuy": "BUY",
    "ui.btnTopUp": "TOP UP",
    "ui.btnConfirm": "CONFIRM",
    "ui.btnAuto": "AUTO",
    "ui.btnSettings": "SETTINGS",
    "ui.btnPlayAuto": "PLAY AUTO",
    "ui.btnStopAuto": "STOP AUTO",

    // Buy menu
    "ui.buyBonus": "BUY BONUS",
    "ui.insufficientBalance": "OOPS, NOT ENOUGH BALANCE",
    "ui.insufficientBalanceOrChangeBet":
      "OOPS — NOT ENOUGH BALANCE OR CHANGE BET AMOUNT",

    // Auto menu
    "ui.autoPlayTitle": "AUTO PLAY",
    "ui.autoPlaySubtitle": "NUMBER OF ROUNDS",

    // Buy cards
    "ui.buyCard.pickMixTitle": "PICK & MIX",
    "ui.buyCard.pickMixBody": "ENTRY BONUS\nSTARTS AT 1× MULTIPLIER",
    "ui.buyCard.gigaTitle": "GIGA",
    "ui.buyCard.gigaBody": "HIGHER VOLATILITY\nSTARTS AT 2× MULTIPLIER",
    "ui.buyCard.superTitle": "SUPER",
    "ui.buyCard.superBody": "STRONG FEATURE\nSTARTS AT 3× MULTIPLIER",
    "ui.buyCard.ultraTitle": "ULTRA",
    "ui.buyCard.ultraBody": "MAXIMUM INTENSITY\nSTARTS AT 5× MULTIPLIER",

    // -----------------------------
    // BIG WIN (NEW)
    // -----------------------------
    "ui.bigWin.big": "BIG WIN",
    "ui.bigWin.super": "SUPER WIN",
    "ui.bigWin.mega": "MEGA WIN",
    "ui.bigWin.epic": "EPIC WIN",
    "ui.bigWin.max": "MAX WIN",
    // optional helper if you ever want to show "x-times" text
    "ui.bigWin.xTimes": "×{x}",
  },

  // --------------------------------------------------
  // ARABIC
  // --------------------------------------------------
  ar: {
        "ui.popup.boosted": "مُعَزَّز",
    "ui.popup.infused": "مُمْدَد",
    "splash.title.blocky": "بلوكي",
    "splash.title.farm": "فارم",
    "splash.card1.title": "وضع البونص",
    "splash.card1.body": "اهبط 3 رموز بونص\nللدخول إلى وضع البونص",
    "splash.card2.title": "+ مضاعف",
    "splash.card2.body": "يزداد المضاعف\nمع كل فوز بالعنقود",
    "splash.card3.title": "وايلد مرتد",
    "splash.card3.body": "وايلد يمنحك\nفرصة ثانية",

    "ui.tumbleWin": "فوز متتالي",
    "ui.freeSpins": "لفات مجانية",
    "ui.spinsLeft": "اللفات المتبقية",
    "ui.info": "معلومات",
    "ui.gameInfoTitle": "بلوكي فارم – معلومات اللعبة",
    "ui.clickToContinue": "اضغط للمتابعة",
    "ui.totalWin": "إجمالي الربح",
    "ui.balance": "الرصيد",
    "ui.bet": "الرهان",
    "ui.win": "الربح",
    "ui.mult": "المضاعف",

    "ui.loading": "جارٍ تحميل التعويذات",
    "ui.loadingPct": "تحميل",
    "ui.rotateBackPortrait": "يرجى تدوير الجهاز\nللعودة للوضع العمودي",

    "ui.btnBuy": "شراء",
    "ui.btnTopUp": "شحن",
    "ui.btnConfirm": "تأكيد",
    "ui.btnAuto": "تلقائي",
    "ui.btnSettings": "الإعدادات",
    "ui.btnPlayAuto": "تشغيل تلقائي",
    "ui.btnStopAuto": "إيقاف تلقائي",

    "ui.buyBonus": "شراء البونص",
    "ui.insufficientBalance": "عذرًا، الرصيد غير كافٍ",
    "ui.insufficientBalanceOrChangeBet":
      "عذرًا — الرصيد غير كافٍ أو غيّر الرهان",

    "ui.autoPlayTitle": "تشغيل تلقائي",
    "ui.autoPlaySubtitle": "عدد الجولات",

    "ui.buyCard.pickMixTitle": "اختر وامزج",
    "ui.buyCard.pickMixBody": "دخول البونص\nيبدأ عند ×1",
    "ui.buyCard.gigaTitle": "ضخم",
    "ui.buyCard.gigaBody": "تقلب أعلى\nيبدأ عند ×2",
    "ui.buyCard.superTitle": "قوي",
    "ui.buyCard.superBody": "ميزة قوية\nيبدأ عند ×3",
    "ui.buyCard.ultraTitle": "أسطوري",
    "ui.buyCard.ultraBody": "أقصى شدة\nيبدأ عند ×5",

    // BIG WIN (NEW)
    "ui.bigWin.big": "فوز كبير",
    "ui.bigWin.super": "فوز خارق",
    "ui.bigWin.mega": "فوز ضخم",
    "ui.bigWin.epic": "فوز ملحمي",
    "ui.bigWin.max": "أقصى فوز",
    "ui.bigWin.xTimes": "×{x}",
  },

  // --------------------------------------------------
  // GERMAN
  // --------------------------------------------------
  de: {
        "ui.popup.boosted": "VERSTÄRKT",
    "ui.popup.infused": "DURCHTRÄNKT",
    "splash.title.blocky": "BLOCKY",
    "splash.title.farm": "FARM",
    "splash.card1.title": "BONUSMODUS",
    "splash.card1.body": "ERHALTE 3 BONUSSYMBOLE\nFÜR DEN BONUSMODUS",
    "splash.card2.title": "+ MULTI",
    "splash.card2.body": "MULTIPLIKATOR STEIGERT\nSICH BEI JEDEM\nCLUSTER-GEWINN",
    "splash.card3.title": "SPRINGENDER\nWILD",
    "splash.card3.body": "WILDS MIT\nZWEITER CHANCE",

    "ui.tumbleWin": "KASKADEN-GEWINN",
    "ui.freeSpins": "FREISPIELE",
    "ui.spinsLeft": "VERBLEIBENDE SPIELE",
    "ui.info": "INFO",
    "ui.gameInfoTitle": "BLOCKY FARM – SPIELINFO",
    "ui.clickToContinue": "KLICKEN ZUM FORTFAHREN",
    "ui.totalWin": "GESAMTGEWINN",
    "ui.balance": "GUTHABEN",
    "ui.bet": "EINSATZ",
    "ui.win": "GEWINN",
    "ui.mult": "MULT",

    "ui.loading": "ZAUBER WERDEN GELADEN",
    "ui.loadingPct": "LÄDT",
    "ui.rotateBackPortrait": "BITTE DREHEN\nZURÜCK INS HOCHFORMAT",

    "ui.btnBuy": "KAUFEN",
    "ui.btnTopUp": "AUFLADEN",
    "ui.btnConfirm": "BESTÄTIGEN",
    "ui.btnAuto": "AUTO",
    "ui.btnSettings": "EINSTELLUNGEN",
    "ui.btnPlayAuto": "AUTO STARTEN",
    "ui.btnStopAuto": "AUTO STOPPEN",

    "ui.buyBonus": "BONUS KAUFEN",
    "ui.insufficientBalance": "NICHT GENUG GUTHABEN",
    "ui.insufficientBalanceOrChangeBet":
      "NICHT GENUG GUTHABEN ODER EINSATZ ÄNDERN",

    "ui.autoPlayTitle": "AUTO-SPIEL",
    "ui.autoPlaySubtitle": "ANZAHL DER RUNDEN",

    "ui.buyCard.pickMixTitle": "MIX & MATCH",
    "ui.buyCard.pickMixBody": "BONUS-EINSTIEG\nBEGINNT BEI 1× MULTI",
    "ui.buyCard.gigaTitle": "GIGANTISCH",
    "ui.buyCard.gigaBody": "HÖHERE VOLATILITÄT\nBEGINNT BEI 2× MULTI",
    "ui.buyCard.superTitle": "STARK",
    "ui.buyCard.superBody": "STARKE FUNKTION\nBEGINNT BEI 3× MULTI",
    "ui.buyCard.ultraTitle": "EXTREM",
    "ui.buyCard.ultraBody": "MAXIMALE INTENSITÄT\nBEGINNT BEI 5× MULTI",

    // BIG WIN (NEW)
    "ui.bigWin.big": "GROSSER GEWINN",
    "ui.bigWin.super": "SUPER-GEWINN",
    "ui.bigWin.mega": "MEGA-GEWINN",
    "ui.bigWin.epic": "EPISCHER GEWINN",
    "ui.bigWin.max": "MAXIMALER GEWINN",
    "ui.bigWin.xTimes": "×{x}",
  },
es: {
      "ui.popup.boosted": "POTENCIADO",
    "ui.popup.infused": "INFUNDIDO",
    "ui.bigWin.big": "GRAN PREMIO",
  "ui.bigWin.super": "SÚPER PREMIO",
  "ui.bigWin.mega": "MEGA PREMIO",
  "ui.bigWin.epic": "PREMIO ÉPICO",
  "ui.bigWin.max": "PREMIO MÁXIMO",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "BLOCKY",
"splash.title.farm": "FARM",

"splash.card1.title": "MODO BONUS",
"splash.card1.body": "CAEN 3 SÍMBOLOS BONUS\nPARA ACTIVAR EL BONUS",

"splash.card2.title": "+ MULTI",
"splash.card2.body": "EL MULTIPLICADOR\nAUMENTA EN CADA\nCLUSTER GANADOR",

"splash.card3.title": "WILD\nREBOTADOR",
"splash.card3.body": "WILDS CON\nSEGUNDA OPORTUNIDAD",

  "ui.tumbleWin": "GANANCIA EN CASCADA",
"ui.freeSpins": "TIRADAS GRATIS",
"ui.spinsLeft": "TIRADAS RESTANTES",

  "ui.info": "INFO",
"ui.gameInfoTitle": "BLOCKY FARM – INFORMACIÓN DEL JUEGO",
  "ui.clickToContinue": "HAZ CLIC PARA CONTINUAR",
  "ui.totalWin": "GANANCIA TOTAL",
  "ui.balance": "SALDO",
  "ui.bet": "APUESTA",
  "ui.win": "GANANCIA",
  "ui.mult": "MULT",

  "ui.loading": "CARGANDO HECHIZOS",
  "ui.loadingPct": "CARGANDO",
  "ui.rotateBackPortrait": "POR FAVOR GIRA\nA MODO VERTICAL",

  "ui.btnBuy": "COMPRAR",
  "ui.btnTopUp": "RECARGAR",
  "ui.btnConfirm": "CONFIRMAR",
  "ui.btnAuto": "AUTO",
  "ui.btnSettings": "AJUSTES",
  "ui.btnPlayAuto": "INICIAR AUTO",
  "ui.btnStopAuto": "DETENER AUTO",

  "ui.buyBonus": "COMPRAR BONUS",
  "ui.insufficientBalance": "SALDO INSUFICIENTE",
  "ui.insufficientBalanceOrChangeBet": "SALDO INSUFICIENTE O CAMBIA LA APUESTA",

  "ui.autoPlayTitle": "JUEGO AUTOMÁTICO",
  "ui.autoPlaySubtitle": "NÚMERO DE RONDAS",

  "ui.buyCard.pickMixTitle": "MEZCLA Y ELIGE",
  "ui.buyCard.pickMixBody": "ENTRADA AL BONUS\nCOMIENZA EN 1× MULTI",
  "ui.buyCard.gigaTitle": "GIGANTE",
  "ui.buyCard.gigaBody": "MAYOR VOLATILIDAD\nCOMIENZA EN 2× MULTI",
  "ui.buyCard.superTitle": "POTENTE",
  "ui.buyCard.superBody": "FUNCIÓN POTENTE\nCOMIENZA EN 3× MULTI",
  "ui.buyCard.ultraTitle": "MÁXIMO",
  "ui.buyCard.ultraBody": "INTENSIDAD MÁXIMA\nCOMIENZA EN 5× MULTI",
},
fi: {
      "ui.popup.boosted": "TEHOSTETTU",
    "ui.popup.infused": "LADATTU",
    "ui.bigWin.big": "ISO VOITTO",
  "ui.bigWin.super": "SUPERVOITTO",
  "ui.bigWin.mega": "MEGAVOITTO",
  "ui.bigWin.epic": "EEPPINEN VOITTO",
  "ui.bigWin.max": "MAKSIMIVOITTO",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "BLOCKY",
"splash.title.farm": "FARM",

"splash.card1.title": "BONUSTILA",
"splash.card1.body": "SAAVUTA 3 BONUSSYMBOLIA\nPÄÄSTÄKSESI BONUKSEEN",

"splash.card2.title": "+ KERROIN",
"splash.card2.body": "KERROIN KASVAA\nCLUSTEREISTA",

"splash.card3.title": "POMPPIVA WILD",
"splash.card3.body": "WILDIT TOISELLA\nMAHDOLLISUUDELLA",

  "ui.tumbleWin": "KETJUVOITTO",
"ui.freeSpins": "ILMAISET KIERROKSET",
"ui.spinsLeft": "KIERROKSIA JÄLJELLÄ",

  "ui.info": "INFO",
"ui.gameInfoTitle": "BLOCKY FARM – PELIN TIEDOT",
  "ui.clickToContinue": "NAPAUTA JATKAAKSESI",
  "ui.totalWin": "KOKONAISVOITTO",
  "ui.balance": "SALDO",
  "ui.bet": "PANOS",
  "ui.win": "VOITTO",
  "ui.mult": "KERROIN",

  "ui.loading": "LOITSUJA LADATAAN",
  "ui.loadingPct": "LADATAAN",
  "ui.rotateBackPortrait": "KÄÄNNÄ LAITE\nPYSTYTILAAN",

  "ui.btnBuy": "OSTA",
  "ui.btnTopUp": "LISÄÄ SALDOA",
  "ui.btnConfirm": "VAHVISTA",
  "ui.btnAuto": "AUTO",
  "ui.btnSettings": "ASETUKSET",
  "ui.btnPlayAuto": "KÄYNNISTÄ AUTO",
  "ui.btnStopAuto": "PYSÄYTÄ AUTO",

  "ui.buyBonus": "OSTA BONUS",
  "ui.insufficientBalance": "EI TARPEEKSI SALDOA",
  "ui.insufficientBalanceOrChangeBet": "EI TARPEEKSI SALDOA TAI MUUTA PANOSTA",

  "ui.autoPlayTitle": "AUTOMAATTINEN PELI",
  "ui.autoPlaySubtitle": "KIERROSTEN MÄÄRÄ",

  "ui.buyCard.pickMixTitle": "VALITSE & SEKOITA",
  "ui.buyCard.pickMixBody": "BONUKSEN SISÄÄNPÄÄSY\nALKAEN 1× KERROIN",
  "ui.buyCard.gigaTitle": "VALTAVA",
  "ui.buyCard.gigaBody": "SUUREMPI VOLATILITEETTI\nALKAEN 2× KERROIN",
  "ui.buyCard.superTitle": "VAHVA",
  "ui.buyCard.superBody": "VAHVA OMINAISUUS\nALKAEN 3× KERROIN",
  "ui.buyCard.ultraTitle": "ÄÄRIMMÄINEN",
  "ui.buyCard.ultraBody": "MAKSIMI-INTENSITEETTI\nALKAEN 5× KERROIN",
},
fr: {
     "ui.popup.boosted": "BOOSTÉ",
    "ui.popup.infused": "INFUSÉ",
    "ui.bigWin.big": "GROS GAIN",
  "ui.bigWin.super": "SUPER GAIN",
  "ui.bigWin.mega": "MEGA GAIN",
  "ui.bigWin.epic": "GAIN ÉPIQUE",
  "ui.bigWin.max": "GAIN MAX",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "BLOCKY",
"splash.title.farm": "FARM",

"splash.card1.title": "MODE BONUS",
"splash.card1.body": "OBTENEZ 3 SYMBOLES\nBONUS POUR ENTRER\nEN BONUS",

"splash.card2.title": "+ MULTI",
"splash.card2.body": "LE MULTIPLICATEUR\nAUGMENTEÀ CHAQUE\nGAIN EN CLUSTER",

"splash.card3.title": "WILD\nREBONDISSANT",
"splash.card3.body": "WILDS AVEC\nSECONDE CHANCE",

  "ui.tumbleWin": "GAIN EN CASCADE",
"ui.freeSpins": "TOURS GRATUITS",
"ui.spinsLeft": "TOURS RESTANTS",

  "ui.info": "INFOS",
"ui.gameInfoTitle": "BLOCKY FARM – INFOS JEU",
  "ui.clickToContinue": "CLIQUEZ POUR CONTINUER",
  "ui.totalWin": "GAIN TOTAL",
  "ui.balance": "SOLDE",
  "ui.bet": "MISE",
  "ui.win": "GAIN",
  "ui.mult": "MULT",

  "ui.loading": "CHARGEMENT DES SORTS",
  "ui.loadingPct": "CHARGEMENT",
  "ui.rotateBackPortrait": "VEUILLEZ TOURNER\nEN MODE PORTRAIT",

  "ui.btnBuy": "ACHETER",
  "ui.btnTopUp": "RECHARGER",
  "ui.btnConfirm": "CONFIRMER",
  "ui.btnAuto": "AUTO",
  "ui.btnSettings": "RÉGLAGES",
  "ui.btnPlayAuto": "LANCER AUTO",
  "ui.btnStopAuto": "ARRÊTER AUTO",

  "ui.buyBonus": "ACHETER BONUS",
  "ui.insufficientBalance": "SOLDE INSUFFISANT",
  "ui.insufficientBalanceOrChangeBet": "SOLDE INSUFFISANT OU MODIFIER LA MISE",

  "ui.autoPlayTitle": "JEU AUTOMATIQUE",
  "ui.autoPlaySubtitle": "NOMBRE DE TOURS",

  "ui.buyCard.pickMixTitle": "CHOISIR & MÉLANGER",
  "ui.buyCard.pickMixBody": "ENTRÉE BONUS\nDÉBUTE À 1× MULTIPLICATEUR",
  "ui.buyCard.gigaTitle": "GÉANT",
  "ui.buyCard.gigaBody": "VOLATILITÉ PLUS ÉLEVÉE\nDÉBUTE À 2× MULTIPLICATEUR",
  "ui.buyCard.superTitle": "PUISSANT",
  "ui.buyCard.superBody": "FONCTIONNALITÉ PUISSANTE\nDÉBUTE À 3× MULTIPLICATEUR",
  "ui.buyCard.ultraTitle": "ULTIME",
  "ui.buyCard.ultraBody": "INTENSITÉ MAXIMALE\nDÉBUTE À 5× MULTIPLICATEUR",
},
hi: {
      "ui.popup.boosted": "बूस्टेड",
    "ui.popup.infused": "इन्फ्यूज़्ड",
    "ui.bigWin.big": "बड़ी जीत",
  "ui.bigWin.super": "सुपर जीत",
  "ui.bigWin.mega": "मेगा जीत",
  "ui.bigWin.epic": "एपिक जीत",
  "ui.bigWin.max": "मैक्स जीत",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "ब्लॉकी",
"splash.title.farm": "फ़ार्म",

"splash.card1.title": "बोनस मोड",
"splash.card1.body": "3 बोनस प्रतीक प्राप्त करें\nबोनस मोड में प्रवेश के लिए",

"splash.card2.title": "+ गुणक",
"splash.card2.body": "हर क्लस्टर जीत पर\nगुणक बढ़ता है",

"splash.card3.title": "उछलता वाइल्ड",
"splash.card3.body": "दूसरा मौका देने वाले\nवाइल्ड",

  "ui.tumbleWin": "कास्केड जीत",
"ui.freeSpins": "फ्री स्पिन",
"ui.spinsLeft": "बचे हुए स्पिन",

  "ui.info": "जानकारी",
"ui.gameInfoTitle": "ब्लॉकी फ़ार्म – गेम जानकारी",
  "ui.clickToContinue": "जारी रखने के लिए क्लिक करें",
  "ui.totalWin": "कुल जीत",
  "ui.balance": "शेष राशि",
  "ui.bet": "दांव",
  "ui.win": "जीत",
  "ui.mult": "गुणक",

  "ui.loading": "मंत्र लोड हो रहे हैं",
  "ui.loadingPct": "लोड हो रहा है",
  "ui.rotateBackPortrait": "कृपया डिवाइस घुमाएँ\nपोर्ट्रेट मोड में",

  "ui.btnBuy": "खरीदें",
  "ui.btnTopUp": "टॉप अप",
  "ui.btnConfirm": "पुष्टि करें",
  "ui.btnAuto": "ऑटो",
  "ui.btnSettings": "सेटिंग्स",
  "ui.btnPlayAuto": "ऑटो शुरू करें",
  "ui.btnStopAuto": "ऑटो रोकें",

  "ui.buyBonus": "बोनस खरीदें",
  "ui.insufficientBalance": "पर्याप्त शेष राशि नहीं",
  "ui.insufficientBalanceOrChangeBet": "पर्याप्त शेष राशि नहीं या दांव बदलें",

  "ui.autoPlayTitle": "ऑटो प्ले",
  "ui.autoPlaySubtitle": "राउंड की संख्या",

  "ui.buyCard.pickMixTitle": "चुनें और मिलाएँ",
  "ui.buyCard.pickMixBody": "बोनस प्रवेश\n1× गुणक से शुरू",
  "ui.buyCard.gigaTitle": "विशाल",
  "ui.buyCard.gigaBody": "अधिक अस्थिरता\n2× गुणक से शुरू",
  "ui.buyCard.superTitle": "शक्तिशाली",
  "ui.buyCard.superBody": "मजबूत फीचर\n3× गुणक से शुरू",
  "ui.buyCard.ultraTitle": "महान",
  "ui.buyCard.ultraBody": "अधिकतम तीव्रता\n5× गुणक से शुरू",
},
id: {
      "ui.popup.boosted": "DIPERKUAT",
    "ui.popup.infused": "DIINFUS",
    "ui.bigWin.big": "KEMENANGAN BESAR",
  "ui.bigWin.super": "KEMENANGAN SUPER",
  "ui.bigWin.mega": "KEMENANGAN MEGA",
  "ui.bigWin.epic": "KEMENANGAN EPIK",
  "ui.bigWin.max": "KEMENANGAN MAKS",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "BLOCKY",
"splash.title.farm": "FARM",

"splash.card1.title": "MODE BONUS",
"splash.card1.body": "DAPATKAN 3 SIMBOL BONUS\nUNTUK MASUK MODE BONUS",

"splash.card2.title": "+ PENGALI",
"splash.card2.body": "PENGALI NAIK\nSETIAP CLUSTER",

"splash.card3.title": "WILD MEMANTUL",
"splash.card3.body": "WILD DENGAN\nKESEMPATAN KEDUA",

  "ui.tumbleWin": "MENANG BERUNTUN",
"ui.freeSpins": "PUTARAN GRATIS",
"ui.spinsLeft": "SISA PUTARAN",

  "ui.info": "INFO",
"ui.gameInfoTitle": "BLOCKY FARM – INFO GAME",
  "ui.clickToContinue": "KLIK UNTUK LANJUT",
  "ui.totalWin": "TOTAL KEMENANGAN",
  "ui.balance": "SALDO",
  "ui.bet": "TARUHAN",
  "ui.win": "MENANG",
  "ui.mult": "MULT",

  "ui.loading": "MEMUAT MANTRA",
  "ui.loadingPct": "MEMUAT",
  "ui.rotateBackPortrait": "PUTAR PERANGKAT\nKE MODE POTRET",

  "ui.btnBuy": "BELI",
  "ui.btnTopUp": "ISI SALDO",
  "ui.btnConfirm": "KONFIRMASI",
  "ui.btnAuto": "AUTO",
  "ui.btnSettings": "PENGATURAN",
  "ui.btnPlayAuto": "MULAI AUTO",
  "ui.btnStopAuto": "HENTIKAN AUTO",

  "ui.buyBonus": "BELI BONUS",
  "ui.insufficientBalance": "SALDO TIDAK CUKUP",
  "ui.insufficientBalanceOrChangeBet": "SALDO TIDAK CUKUP ATAU UBAH TARUHAN",

  "ui.autoPlayTitle": "AUTO PLAY",
  "ui.autoPlaySubtitle": "JUMLAH PUTARAN",

  "ui.buyCard.pickMixTitle": "PILIH & CAMPUR",
  "ui.buyCard.pickMixBody": "MASUK BONUS\nDIMULAI DARI 1× PENGALI",
  "ui.buyCard.gigaTitle": "Raksasa",
  "ui.buyCard.gigaBody": "VOLATILITAS LEBIH TINGGI\nDIMULAI DARI 2×",
  "ui.buyCard.superTitle": "Kuat",
  "ui.buyCard.superBody": "FITUR KUAT\nDIMULAI DARI 3×",
  "ui.buyCard.ultraTitle": "Maksimal",
  "ui.buyCard.ultraBody": "INTENSITAS MAKSIMUM\nDIMULAI DARI 5×",
},
ja: {
     "ui.popup.boosted": "ブースト",
    "ui.popup.infused": "注入",
    "ui.bigWin.big": "ビッグウィン",
  "ui.bigWin.super": "スーパーウィン",
  "ui.bigWin.mega": "メガウィン",
  "ui.bigWin.epic": "エピックウィン",
  "ui.bigWin.max": "マックスウィン",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "ブロッキー",
"splash.title.farm": "ファーム",

"splash.card1.title": "ボーナスモード",
"splash.card1.body": "ボーナスシンボ\nルを3つ獲得で\nボーナスモード突入",

"splash.card2.title": "+ 倍率",
"splash.card2.body": "クラスター勝利ごとに\n倍率が上昇",

"splash.card3.title": "バウンド\nワイルド",
"splash.card3.body": "セカンドチャンスの\nワイルド",

  "ui.tumbleWin": "連鎖勝利",
"ui.freeSpins": "フリースピン",
"ui.spinsLeft": "残り回数",

  "ui.info": "情報",
"ui.gameInfoTitle": "BLOCKY FARM – ゲーム情報",
  "ui.clickToContinue": "クリックして続行",
  "ui.totalWin": "合計獲得",
  "ui.balance": "残高",
  "ui.bet": "ベット",
  "ui.win": "獲得",
  "ui.mult": "倍率",

  "ui.loading": "呪文を読み込み中",
  "ui.loadingPct": "読み込み中",
  "ui.rotateBackPortrait": "端末を回転して\n縦向きに戻してください",

  "ui.btnBuy": "購入",
  "ui.btnTopUp": "チャージ",
  "ui.btnConfirm": "確認",
  "ui.btnAuto": "オート",
  "ui.btnSettings": "設定",
  "ui.btnPlayAuto": "オート開始",
  "ui.btnStopAuto": "オート停止",

  "ui.buyBonus": "ボーナス購入",
  "ui.insufficientBalance": "残高が不足しています",
  "ui.insufficientBalanceOrChangeBet": "残高不足、またはベット額を変更してください",

  "ui.autoPlayTitle": "オートプレイ",
  "ui.autoPlaySubtitle": "ラウンド数",

  "ui.buyCard.pickMixTitle": "ピック＆ミックス",
  "ui.buyCard.pickMixBody": "ボーナス突入\n1×倍率から開始",
  "ui.buyCard.gigaTitle": "巨大",
  "ui.buyCard.gigaBody": "高いボラティリティ\n2×倍率から開始",
  "ui.buyCard.superTitle": "強力",
  "ui.buyCard.superBody": "強力な機能\n3×倍率から開始",
  "ui.buyCard.ultraTitle": "究極",
  "ui.buyCard.ultraBody": "最大強度\n5×倍率から開始",
},

ko: {
      "ui.popup.boosted": "부스트",
    "ui.popup.infused": "주입",
    "ui.bigWin.big": "빅 윈",
  "ui.bigWin.super": "슈퍼 윈",
  "ui.bigWin.mega": "메가 윈",
  "ui.bigWin.epic": "에픽 윈",
  "ui.bigWin.max": "맥스 윈",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "블로키",
"splash.title.farm": "팜",

"splash.card1.title": "보너스 모드",
"splash.card1.body": "보너스 심볼 3개 획득 시\n보너스 모드 진입",

"splash.card2.title": "+ 배수",
"splash.card2.body": "클러스터 승리마다\n배수가 증가",

"splash.card3.title": "바운싱 와일드",
"splash.card3.body": "두 번째 기회를 주는\n와일드",

  "ui.tumbleWin": "연쇄 승리",
"ui.freeSpins": "프리 스핀",
"ui.spinsLeft": "남은 횟수",

  "ui.info": "정보",
"ui.gameInfoTitle": "BLOCKY FARM – 게임 정보",
  "ui.clickToContinue": "클릭하여 계속",
  "ui.totalWin": "총 당첨",
  "ui.balance": "잔액",
  "ui.bet": "베팅",
  "ui.win": "당첨",
  "ui.mult": "배수",

  "ui.loading": "주문 불러오는 중",
  "ui.loadingPct": "불러오는 중",
  "ui.rotateBackPortrait": "기기를 돌려\n세로 모드로 전환하세요",

  "ui.btnBuy": "구매",
  "ui.btnTopUp": "충전",
  "ui.btnConfirm": "확인",
  "ui.btnAuto": "자동",
  "ui.btnSettings": "설정",
  "ui.btnPlayAuto": "자동 시작",
  "ui.btnStopAuto": "자동 중지",

  "ui.buyBonus": "보너스 구매",
  "ui.insufficientBalance": "잔액이 부족합니다",
  "ui.insufficientBalanceOrChangeBet": "잔액이 부족하거나 베팅 금액을 변경하세요",

  "ui.autoPlayTitle": "자동 플레이",
  "ui.autoPlaySubtitle": "라운드 수",

  "ui.buyCard.pickMixTitle": "픽 & 믹스",
  "ui.buyCard.pickMixBody": "보너스 진입\n1× 배수부터 시작",
  "ui.buyCard.gigaTitle": "거대",
  "ui.buyCard.gigaBody": "더 높은 변동성\n2× 배수부터 시작",
  "ui.buyCard.superTitle": "강력",
  "ui.buyCard.superBody": "강력한 기능\n3× 배수부터 시작",
  "ui.buyCard.ultraTitle": "궁극",
  "ui.buyCard.ultraBody": "최대 강도\n5× 배수부터 시작",
},
pl: {
      "ui.popup.boosted": "WZMOCNIONE",
    "ui.popup.infused": "NASYCONE",
    "ui.bigWin.big": "WIELKA WYGRANA",
  "ui.bigWin.super": "SUPER WYGRANA",
  "ui.bigWin.mega": "MEGA WYGRANA",
  "ui.bigWin.epic": "EPICKA WYGRANA",
  "ui.bigWin.max": "MAKS. WYGRANA",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "BLOCKY",
"splash.title.farm": "FARM",

"splash.card1.title": "TRYB BONUSOWY",
"splash.card1.body": "ZDOBĄDŹ 3 SYMBOLE\nBONUSU ABY WEJŚĆ\n DO BONUSU",

"splash.card2.title": "+ MNOŻNIK",
"splash.card2.body": "MNOŻNIK ROŚNIE\nPRZY KLASTRACH",

"splash.card3.title": "SKACZĄCY WILD",
"splash.card3.body": "WILDY Z\nDRUGĄ SZANSĄ",

  "ui.tumbleWin": "WYGRANA KASKADOWA",
"ui.freeSpins": "DARMOWE SPINY",
"ui.spinsLeft": "POZOSTAŁO SPINÓW",

  "ui.info": "INFO",
"ui.gameInfoTitle": "BLOCKY FARM – INFORMACJE O GRZE",
  "ui.clickToContinue": "KLIKNIJ, ABY KONTYNUOWAĆ",
  "ui.totalWin": "SUMA WYGRANYCH",
  "ui.balance": "SALDO",
  "ui.bet": "STAWKA",
  "ui.win": "WYGRANA",
  "ui.mult": "MNOŻNIK",

  "ui.loading": "ŁADOWANIE ZAKLĘĆ",
  "ui.loadingPct": "ŁADOWANIE",
  "ui.rotateBackPortrait": "OBRÓĆ URZĄDZENIE\nDO TRYBU PIONOWEGO",

  "ui.btnBuy": "KUP",
  "ui.btnTopUp": "DOŁADUJ",
  "ui.btnConfirm": "POTWIERDŹ",
  "ui.btnAuto": "AUTO",
  "ui.btnSettings": "USTAWIENIA",
  "ui.btnPlayAuto": "START AUTO",
  "ui.btnStopAuto": "STOP AUTO",

  "ui.buyBonus": "KUP BONUS",
  "ui.insufficientBalance": "NIEWYSTARCZAJĄCE SALDO",
  "ui.insufficientBalanceOrChangeBet": "BRAK SALDA LUB ZMIEŃ STAWKĘ",

  "ui.autoPlayTitle": "GRA AUTOMATYCZNA",
  "ui.autoPlaySubtitle": "LICZBA RUND",

  "ui.buyCard.pickMixTitle": "WYBIERZ I MIESZAJ",
  "ui.buyCard.pickMixBody": "WEJŚCIE DO BONUSU\nSTART OD 1× MNOŻNIKA",
  "ui.buyCard.gigaTitle": "OGROMNY",
  "ui.buyCard.gigaBody": "WYŻSZA ZMIENNOŚĆ\nSTART OD 2× MNOŻNIKA",
  "ui.buyCard.superTitle": "MOCNY",
  "ui.buyCard.superBody": "MOCNA FUNKCJA\nSTART OD 3× MNOŻNIKA",
  "ui.buyCard.ultraTitle": "MAKSYMALNY",
  "ui.buyCard.ultraBody": "MAKSYMALNA INTENSYWNOŚĆ\nSTART OD 5× MNOŻNIKA",
},
pt: {
      "ui.popup.boosted": "TURBINADO",
    "ui.popup.infused": "INFUNDIDO",
    "ui.bigWin.big": "GRANDE GANHO",
  "ui.bigWin.super": "SUPER GANHO",
  "ui.bigWin.mega": "MEGA GANHO",
  "ui.bigWin.epic": "GANHO ÉPICO",
  "ui.bigWin.max": "GANHO MÁXIMO",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "BLOCKY",
"splash.title.farm": "FARM",

"splash.card1.title": "MODO BÔNUS",
"splash.card1.body": "OBTENHA 3 SÍMBOLOS\nBÔNUS PARA ENTRAR\nNO BÔNUS",

"splash.card2.title": "+ MULTI",
"splash.card2.body": "O MULTIPLICADOR AUMENTA\nA CADA GANHO EM CLUSTER",

"splash.card3.title": "WILD\nSALTITANTE",
"splash.card3.body": "WILDS COM\nSEGUNDA CHANCE",

  "ui.tumbleWin": "GANHO EM CASCATA",
"ui.freeSpins": "RODADAS GRÁTIS",
"ui.spinsLeft": "RODADAS RESTANTES",

  "ui.info": "INFO",
"ui.gameInfoTitle": "BLOCKY FARM – INFORMAÇÕES DO JOGO",
  "ui.clickToContinue": "CLIQUE PARA CONTINUAR",
  "ui.totalWin": "GANHO TOTAL",
  "ui.balance": "SALDO",
  "ui.bet": "APOSTA",
  "ui.win": "GANHO",
  "ui.mult": "MULT",

  "ui.loading": "CARREGANDO FEITIÇOS",
  "ui.loadingPct": "CARREGANDO",
  "ui.rotateBackPortrait": "GIRE PARA\nMODO RETRATO",

  "ui.btnBuy": "COMPRAR",
  "ui.btnTopUp": "RECARREGAR",
  "ui.btnConfirm": "CONFIRMAR",
  "ui.btnAuto": "AUTO",
  "ui.btnSettings": "AJUSTES",
  "ui.btnPlayAuto": "INICIAR AUTO",
  "ui.btnStopAuto": "PARAR AUTO",

  "ui.buyBonus": "COMPRAR BÔNUS",
  "ui.insufficientBalance": "SALDO INSUFICIENTE",
  "ui.insufficientBalanceOrChangeBet": "SALDO INSUFICIENTE OU ALTERE A APOSTA",

  "ui.autoPlayTitle": "JOGO AUTOMÁTICO",
  "ui.autoPlaySubtitle": "NÚMERO DE RODADAS",

  "ui.buyCard.pickMixTitle": "PEGAR & MISTURAR",
  "ui.buyCard.pickMixBody": "ENTRADA NO BÔNUS\nCOMEÇA EM 1× MULTIPLICADOR",
  "ui.buyCard.gigaTitle": "GIGANTE",
  "ui.buyCard.gigaBody": "MAIOR VOLATILIDADE\nCOMEÇA EM 2× MULTIPLICADOR",
  "ui.buyCard.superTitle": "PODEROSO",
  "ui.buyCard.superBody": "RECURSO FORTE\nCOMEÇA EM 3× MULTIPLICADOR",
  "ui.buyCard.ultraTitle": "SUPREMO",
  "ui.buyCard.ultraBody": "INTENSIDADE MÁXIMA\nCOMEÇA EM 5× MULTIPLICADOR",
},
ru: {
      "ui.popup.boosted": "УСИЛЕНО",
    "ui.popup.infused": "НАПИТАНО",
    "ui.bigWin.big": "БОЛЬШОЙ ВЫИГРЫШ",
  "ui.bigWin.super": "СУПЕР ВЫИГРЫШ",
  "ui.bigWin.mega": "МЕГА ВЫИГРЫШ",
  "ui.bigWin.epic": "ЭПИЧЕСКИЙ ВЫИГРЫШ",
  "ui.bigWin.max": "МАКС. ВЫИГРЫШ",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "БЛОКИ",
"splash.title.farm": "ФЕРМА",

"splash.card1.title": "БОНУСНЫЙ РЕЖИМ",
"splash.card1.body": "ПОЛУЧИТЕ 3\nБОНУС-СИМВОЛА\nДЛЯ ВХОДА В БОНУС",

"splash.card2.title": "+ МНОЖИТЕЛЬ",
"splash.card2.body": "МНОЖИТЕЛЬ РАСТЁТ\n КАЖДОЙ КОМБИНАЦИЕЙЕ",

"splash.card3.title": "ПРЫГАЮЩИЙ WILD",
"splash.card3.body": "WILD-СИМВОЛЫ\nС ВТОРЫМ ШАНСОМ",

  "ui.tumbleWin": "КАСКАДНЫЙ ВЫИГРЫШ",
"ui.freeSpins": "БЕСПЛАТНЫЕ СПИНЫ",
"ui.spinsLeft": "ОСТАЛОСЬ СПИНОВ",

  "ui.info": "ИНФО",
"ui.gameInfoTitle": "BLOCKY FARM — ИНФОРМАЦИЯ ОБ ИГРЕ",
  "ui.clickToContinue": "НАЖМИТЕ ДЛЯ ПРОДОЛЖЕНИЯ",
  "ui.totalWin": "ОБЩИЙ\nВЫИГРЫШ",
  "ui.balance": "БАЛАНС",
  "ui.bet": "СТАВКА",
  "ui.win": "ВЫИГРЫШ",
  "ui.mult": "МНОЖ",

  "ui.loading": "ЗАГРУЗКА ЗАКЛИНАНИЙ",
  "ui.loadingPct": "ЗАГРУЗКА",
  "ui.rotateBackPortrait": "ПОВЕРНИТЕ УСТРОЙСТВО\nВ ПОРТРЕТНЫЙ РЕЖИМ",

  "ui.btnBuy": "КУПИТЬ",
  "ui.btnTopUp": "ПОПОЛНИТЬ",
  "ui.btnConfirm": "ПОДТВЕРДИТЬ",
  "ui.btnAuto": "АВТО",
  "ui.btnSettings": "НАСТРОЙКИ",
  "ui.btnPlayAuto": "ЗАПУСТИТЬ АВТО",
  "ui.btnStopAuto": "ОСТАНОВИТЬ АВТО",

  "ui.buyBonus": "КУПИТЬ БОНУС",
  "ui.insufficientBalance": "НЕДОСТАТОЧНО СРЕДСТВ",
  "ui.insufficientBalanceOrChangeBet": "НЕДОСТАТОЧНО СРЕДСТВ ИЛИ ИЗМЕНИТЕ СТАВКУ",

  "ui.autoPlayTitle": "АВТОИГРА",
  "ui.autoPlaySubtitle": "КОЛИЧЕСТВО РАУНДОВ",

  "ui.buyCard.pickMixTitle": "ВЫБОР И МИКС",
  "ui.buyCard.pickMixBody": "ВХОД В БОНУС\nСТАРТ С 1× МНОЖИТЕЛЯ",
  "ui.buyCard.gigaTitle": "ГИГАНТ",
  "ui.buyCard.gigaBody": "ВЫСОКАЯ ВОЛАТИЛЬНОСТЬ\nСТАРТ С 2× МНОЖИТЕЛЯ",
  "ui.buyCard.superTitle": "МОЩНЫЙ",
  "ui.buyCard.superBody": "МОЩНАЯ ФУНКЦИЯ\nСТАРТ С 3× МНОЖИТЕЛЯ",
  "ui.buyCard.ultraTitle": "ЭПИЧЕСКИЙ",
  "ui.buyCard.ultraBody": "МАКСИМАЛЬНАЯ ИНТЕНСИВНОСТЬ\nСТАРТ С 5× МНОЖИТЕЛЯ",
},
tr: {
      "ui.popup.boosted": "GÜÇLENDİRİLDİ",
    "ui.popup.infused": "AŞILANDI",
    "ui.bigWin.big": "BÜYÜK KAZANÇ",
  "ui.bigWin.super": "SÜPER KAZANÇ",
  "ui.bigWin.mega": "MEGA KAZANÇ",
  "ui.bigWin.epic": "EFSANE KAZANÇ",
  "ui.bigWin.max": "MAKS. KAZANÇ",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "BLOCKY",
"splash.title.farm": "FARM",

"splash.card1.title": "BONUS MODU",
"splash.card1.body": "BONUS MODUNA GİRMEK İÇİN\n3 BONUS SEMBOLÜ KAZAN",

"splash.card2.title": "+ ÇARPAN",
"splash.card2.body": "HER CLUSTER KAZANCINDA\nÇARPAN ARTAR",

"splash.card3.title": "ZIPLAYAN WILD",
"splash.card3.body": "İKİNCİ ŞANS SUNAN\nWILD’LAR",

  "ui.tumbleWin": "KASKAT KAZANCI",
"ui.freeSpins": "ÜCRETSİZ SPİN",
"ui.spinsLeft": "KALAN SPİN",

  "ui.info": "BİLGİ",
"ui.gameInfoTitle": "BLOCKY FARM – OYUN BİLGİSİ",
  "ui.clickToContinue": "DEVAM ETMEK İÇİN TIKLAYIN",
  "ui.totalWin": "TOPLAM KAZANÇ",
  "ui.balance": "BAKİYE",
  "ui.bet": "BAHİS",
  "ui.win": "KAZANÇ",
  "ui.mult": "ÇARPAN",

  "ui.loading": "BÜYÜLER YÜKLENİYOR",
  "ui.loadingPct": "YÜKLENİYOR",
  "ui.rotateBackPortrait": "CİHAZI DÖNDÜRÜN\nDİKEY MODA GEÇİN",

  "ui.btnBuy": "SATIN AL",
  "ui.btnTopUp": "BAKİYE YÜKLE",
  "ui.btnConfirm": "ONAYLA",
  "ui.btnAuto": "OTO",
  "ui.btnSettings": "AYARLAR",
  "ui.btnPlayAuto": "OTO BAŞLAT",
  "ui.btnStopAuto": "OTO DURDUR",

  "ui.buyBonus": "BONUS SATIN AL",
  "ui.insufficientBalance": "BAKİYE YETERSİZ",
  "ui.insufficientBalanceOrChangeBet": "BAKİYE YETERSİZ YA DA BAHİSİ DEĞİŞTİR",

  "ui.autoPlayTitle": "OTOMATİK OYUN",
  "ui.autoPlaySubtitle": "TUR SAYISI",

  "ui.buyCard.pickMixTitle": "SEÇ & KARIŞTIR",
  "ui.buyCard.pickMixBody": "BONUS GİRİŞİ\n1× ÇARPANLA BAŞLAR",
  "ui.buyCard.gigaTitle": "DEV",
  "ui.buyCard.gigaBody": "DAHA YÜKSEK VOLATİLİTE\n2× ÇARPANLA BAŞLAR",
  "ui.buyCard.superTitle": "GÜÇLÜ",
  "ui.buyCard.superBody": "GÜÇLÜ ÖZELLİK\n3× ÇARPANLA BAŞLAR",
  "ui.buyCard.ultraTitle": "ZİRVE",
  "ui.buyCard.ultraBody": "MAKSİMUM YOĞUNLUK\n5× ÇARPANLA BAŞLAR",
},
vi: {
      "ui.popup.boosted": "TĂNG CƯỜNG",
    "ui.popup.infused": "TRUYỀN NĂNG LƯỢNG",
    "ui.bigWin.big": "THẮNG LỚN",
  "ui.bigWin.super": "THẮNG SIÊU",
  "ui.bigWin.mega": "THẮNG MEGA",
  "ui.bigWin.epic": "THẮNG HUYỀN THOẠI",
  "ui.bigWin.max": "THẮNG TỐI ĐA",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "Khối",
"splash.title.farm": "Nông Trại",

"splash.card1.title": "CHẾ ĐỘ BONUS",
"splash.card1.body": "NHẬN 3 BIỂU TƯỢNG BONUS\nĐỂ VÀO CHẾ ĐỘ BONUS",

"splash.card2.title": "+ NHÂN",
"splash.card2.body": "HỆ SỐ NHÂN TĂNG\nSAU MỖI CHIẾN THẮNG CLUSTER",

"splash.card3.title": "WILD NẢY",
"splash.card3.body": "WILD VỚI\nCƠ HỘI THỨ HAI",

  "ui.tumbleWin": "THẮNG LIÊN TIẾP",
"ui.freeSpins": "VÒNG QUAY MIỄN PHÍ",
"ui.spinsLeft": "CÒN LẠI",

  "ui.info": "THÔNG TIN",
"ui.gameInfoTitle": "BLOCKY FARM – THÔNG TIN TRÒ CHƠI",
  "ui.clickToContinue": "NHẤN ĐỂ TIẾP TỤC",
  "ui.totalWin": "TỔNG THẮNG",
  "ui.balance": "SỐ DƯ",
  "ui.bet": "CƯỢC",
  "ui.win": "THẮNG",
  "ui.mult": "NHÂN",

  "ui.loading": "ĐANG TẢI PHÉP THUẬT",
  "ui.loadingPct": "ĐANG TẢI",
  "ui.rotateBackPortrait": "XOAY THIẾT BỊ\nVỀ CHẾ ĐỘ DỌC",

  "ui.btnBuy": "MUA",
  "ui.btnTopUp": "NẠP",
  "ui.btnConfirm": "XÁC NHẬN",
  "ui.btnAuto": "AUTO",
  "ui.btnSettings": "CÀI ĐẶT",
  "ui.btnPlayAuto": "CHẠY AUTO",
  "ui.btnStopAuto": "DỪNG AUTO",

  "ui.buyBonus": "MUA BONUS",
  "ui.insufficientBalance": "KHÔNG ĐỦ SỐ DƯ",
  "ui.insufficientBalanceOrChangeBet": "KHÔNG ĐỦ SỐ DƯ HOẶC ĐỔI MỨC CƯỢC",

  "ui.autoPlayTitle": "CHƠI TỰ ĐỘNG",
  "ui.autoPlaySubtitle": "SỐ VÒNG",

  "ui.buyCard.pickMixTitle": "CHỌN & TRỘN",
  "ui.buyCard.pickMixBody": "VÀO BONUS\nBẮT ĐẦU TỪ 1×",
  "ui.buyCard.gigaTitle": "Khổng Lồ",
  "ui.buyCard.gigaBody": "BIẾN ĐỘNG CAO\nBẮT ĐẦU TỪ 2×",
  "ui.buyCard.superTitle": "Mạnh Mẽ",
  "ui.buyCard.superBody": "TÍNH NĂNG MẠNH\nBẮT ĐẦU TỪ 3×",
  "ui.buyCard.ultraTitle": "Tối Thượng",
  "ui.buyCard.ultraBody": "CƯỜNG ĐỘ TỐI ĐA\nBẮT ĐẦU TỪ 5×",
},
zh: {
    "ui.popup.boosted": "强化",
    "ui.popup.infused": "注入",
  "ui.bigWin.big": "大赢",
  "ui.bigWin.super": "超级大赢",
  "ui.bigWin.mega": "巨型大赢",
  "ui.bigWin.epic": "史诗大赢",
  "ui.bigWin.max": "最强大赢",
  "ui.bigWin.xTimes": "×{x}",

"splash.title.blocky": "方块",
"splash.title.farm": "农场",

"splash.card1.title": "奖励模式",
"splash.card1.body": "落下 3 个奖励符号\n进入奖励模式",

"splash.card2.title": "+ 倍数",
"splash.card2.body": "每次连消获胜\n倍数都会叠加",

"splash.card3.title": "弹跳百搭",
"splash.card3.body": "获得第二次机会百搭",
  "ui.tumbleWin": "连消赢取",
"ui.freeSpins": "免费旋转",
"ui.spinsLeft": "剩余次数",

  "ui.info": "信息",
"ui.gameInfoTitle": "BLOCKY FARM – 游戏信息",
  "ui.clickToContinue": "点击继续",
  "ui.totalWin": "总赢得",
  "ui.balance": "余额",
  "ui.bet": "投注",
  "ui.win": "赢取",
  "ui.mult": "倍数",

  "ui.loading": "正在加载法术",
  "ui.loadingPct": "加载中",
  "ui.rotateBackPortrait": "请将设备\n旋转为竖屏",

  "ui.btnBuy": "购买",
  "ui.btnTopUp": "充值",
  "ui.btnConfirm": "确认",
  "ui.btnAuto": "自动",
  "ui.btnSettings": "设置",
  "ui.btnPlayAuto": "开始自动",
  "ui.btnStopAuto": "停止自动",

  "ui.buyBonus": "购买奖励",
  "ui.insufficientBalance": "余额不足",
  "ui.insufficientBalanceOrChangeBet": "余额不足或请更改投注金额",

  "ui.autoPlayTitle": "自动游戏",
  "ui.autoPlaySubtitle": "回合数量",

  "ui.buyCard.pickMixTitle": "挑选混合",
  "ui.buyCard.pickMixBody": "进入奖励\n从 1× 倍数开始",
  "ui.buyCard.gigaTitle": "巨型",
  "ui.buyCard.gigaBody": "更高波动\n从 2× 倍数开始",
  "ui.buyCard.superTitle": "强力",
  "ui.buyCard.superBody": "强力功能\n从 3× 倍数开始",
  "ui.buyCard.ultraTitle": "究极",
  "ui.buyCard.ultraBody": "最高强度\n从 5× 倍数开始",
},
tl: {
      "ui.popup.boosted": "PINATIBAY",
    "ui.popup.infused": "PINUNO",
    "ui.bigWin.big": "MALAKING PANALO",
  "ui.bigWin.super": "SOBRANG PANALO",
  "ui.bigWin.mega": "MEGA PANALO",
  "ui.bigWin.epic": "EPIC NA PANALO",
  "ui.bigWin.max": "PINAKAMALAKING PANALO",
  "ui.bigWin.xTimes": "×{x}",

  "splash.title.blocky": "BLOCKY",
"splash.title.farm": "FARM",

"splash.card1.title": "BONUS MODE",
"splash.card1.body": "3 BONUS SYMBOL\nPARA BONUS MODE",

"splash.card2.title": "+ MULTIPLIER",
"splash.card2.body": "LUMALAKI ANG\nMULTIPLIERSA BAWAT\nPANALONG CLUSTER",

"splash.card3.title": "TUMATALONG WILD",
"splash.card3.body": "MGA WILD NA MAY\nIKALAWANG PAGKAKATAON",

  "ui.tumbleWin": "SUNOD-SUNOD NA PANALO",
"ui.freeSpins": "Libreng Ikot",
"ui.spinsLeft": "Natitirang Ikot",

  "ui.info": "IMPORMASYON",
"ui.gameInfoTitle": "BLOCKY FARM – IMPORMASYON NG LARO",
  "ui.clickToContinue": "I-CLICK PARA MAGPATULOY",
  "ui.totalWin": "KABUUANG PANALO",
  "ui.balance": "BALANSE",
  "ui.bet": "TAYA",
  "ui.win": "PANALO",
  "ui.mult": "MULT",

  "ui.loading": "NAGLO-LOAD NG MGA MAHIWAGA",
  "ui.loadingPct": "NAGLO-LOAD",
  "ui.rotateBackPortrait": "IBALIK SA\nPATAYONG POSISYON",

  "ui.btnBuy": "BILI",
  "ui.btnTopUp": "MAGDAGDAG",
  "ui.btnConfirm": "KUMPIRMA",
  "ui.btnAuto": "AUTO",
  "ui.btnSettings": "SETTINGS",
  "ui.btnPlayAuto": "SIMULAN AUTO",
  "ui.btnStopAuto": "ITIGIL AUTO",

  "ui.buyBonus": "BILHIN ANG BONUS",
  "ui.insufficientBalance": "KULANG ANG BALANSE",
  "ui.insufficientBalanceOrChangeBet": "KULANG ANG BALANSE O PALITAN ANG TAYA",

  "ui.autoPlayTitle": "AUTO PLAY",
  "ui.autoPlaySubtitle": "BILANG NG IKOT",

  "ui.buyCard.pickMixTitle": "PUMILI AT IHALO",
  "ui.buyCard.pickMixBody": "PASOK SA BONUS\nSIMULA SA 1× MULTIPLIER",
  "ui.buyCard.gigaTitle": "Higante",
  "ui.buyCard.gigaBody": "MAS MATAAS NA VOLATILITY\nSIMULA SA 2× MULTIPLIER",
  "ui.buyCard.superTitle": "Malakas",
  "ui.buyCard.superBody": "MALAKAS NA FEATURE\nSIMULA SA 3× MULTIPLIER",
  "ui.buyCard.ultraTitle": "Sukdulan",
  "ui.buyCard.ultraBody": "PINAKAMATAAS NA INTENSITY\nSIMULA SA 5× MULTIPLIER",
},



};
