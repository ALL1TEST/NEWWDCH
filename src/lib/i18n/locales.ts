// ============================================================
// i18n — DICTIONARY ASSEMBLY
// ============================================================
// Assembles every locale dictionary from its parts:
//
//   CORE dictionaries (src/lib/i18n/core/<locale>.ts)
//     → the shared application chrome (navigation, profile menu,
//       common actions, titles…). Provided for ALL 40 supported
//       locales. Incomplete cores fall back key-by-key.
//
//   FRAGMENT dictionaries (src/lib/i18n/fragments/<en|fr>/<area>.ts)
//     → deep page-level strings. Only provided for the
//       fully-translated locales (en + fr).
//
// Fallback chain in t(): dict[locale][key] ?? dict.en[key] ?? key
// — no runtime "missing key" error can ever surface; an
// incomplete locale simply renders the English string.
// ============================================================

import { coreEn } from './core/en';
import { coreFr } from './core/fr';
import { coreDe } from './core/de';
import { coreEs } from './core/es';
import { coreIt } from './core/it';
import { corePtBr } from './core/pt-br';
import { corePtPt } from './core/pt-pt';
import { coreNl } from './core/nl';
import { coreRu } from './core/ru';
import { coreJa } from './core/ja';
import { coreKo } from './core/ko';
import { coreZh } from './core/zh';
import { coreAr } from './core/ar';
import { coreHi } from './core/hi';
import { coreBn } from './core/bn';
import { coreGu } from './core/gu';
import { coreFa } from './core/fa';
import { corePa } from './core/pa';
import { coreMr } from './core/mr';
import { coreTa } from './core/ta';
import { coreTe } from './core/te';
import { coreKn } from './core/kn';
import { coreMl } from './core/ml';
import { coreTh } from './core/th';
import { coreVi } from './core/vi';
import { coreTr } from './core/tr';
import { corePl } from './core/pl';
import { coreCs } from './core/cs';
import { coreDa } from './core/da';
import { coreFi } from './core/fi';
import { coreSv } from './core/sv';
import { coreNb } from './core/nb';
import { coreUk } from './core/uk';
import { coreRo } from './core/ro';
import { coreHu } from './core/hu';
import { coreBg } from './core/bg';
import { coreEl } from './core/el';
import { coreHe } from './core/he';
import { coreId } from './core/id';
import { coreMs } from './core/ms';

// Fragments (deep page-level strings — en + fr only)
import { clientContentEn } from './fragments/en/client-content';
import { clientPeopleEn } from './fragments/en/client-people';
import { clientAccountEn } from './fragments/en/client-account';
import { platformAEn } from './fragments/en/platform-a';
import { platformBEn } from './fragments/en/platform-b';
import { clientContentFr } from './fragments/fr/client-content';
import { clientPeopleFr } from './fragments/fr/client-people';
import { clientAccountFr } from './fragments/fr/client-account';
import { platformAFr } from './fragments/fr/platform-a';
import { platformBFr } from './fragments/fr/platform-b';

// ---- Fully-translated locales: core + every fragment ----

const en: Record<string, string> = {
  ...coreEn,
  ...clientContentEn,
  ...clientPeopleEn,
  ...clientAccountEn,
  ...platformAEn,
  ...platformBEn,
};

const fr: Record<string, string> = {
  ...coreFr,
  ...clientContentFr,
  ...clientPeopleFr,
  ...clientAccountFr,
  ...platformAFr,
  ...platformBFr,
};

// ---- Partially-translated locales: core chrome only; missing
//      keys (and any incomplete core key) fall back to `en`. ----

export const dictionaries: Record<string, Record<string, string>> = {
  en,
  fr,
  de: coreDe,
  es: coreEs,
  it: coreIt,
  'pt-BR': corePtBr,
  'pt-PT': corePtPt,
  nl: coreNl,
  ru: coreRu,
  ja: coreJa,
  ko: coreKo,
  zh: coreZh,
  ar: coreAr,
  hi: coreHi,
  bn: coreBn,
  gu: coreGu,
  fa: coreFa,
  pa: corePa,
  mr: coreMr,
  ta: coreTa,
  te: coreTe,
  kn: coreKn,
  ml: coreMl,
  th: coreTh,
  vi: coreVi,
  tr: coreTr,
  pl: corePl,
  cs: coreCs,
  da: coreDa,
  fi: coreFi,
  sv: coreSv,
  nb: coreNb,
  uk: coreUk,
  ro: coreRo,
  hu: coreHu,
  bg: coreBg,
  el: coreEl,
  he: coreHe,
  id: coreId,
  ms: coreMs,
};
