// ============================================================
// i18n LOCALE ASSEMBLER — turns the translation progress files into
// the final dictionary wiring:
//   1. fragments/<locale>/client.ts for each of the 38 non-en/fr
//      locales (merged 11-family client dictionary, machine-assisted
//      translation; missing keys omitted → English fallback).
//   2. Missing core keys appended into each core/<locale>.ts.
//   3. fragments/fr/client-<family>.ts for the 8 NEW families
//      (French keeps its curated translations for the 3 originals).
//   4. locales.ts rewritten to merge every locale: core + client.
// Run AFTER translate-locales.ts finishes (or partially — it only
// assembles what exists; untranslated batches are simply omitted).
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

const PROJECT = '/home/z/my-project';
const PROGRESS_DIR = path.join(PROJECT, '.zscripts', 'i18n-progress');

const LOCALES: { code: string; name: string }[] = [
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'pt-BR', name: 'Brazilian Portuguese (Português do Brasil)' },
  { code: 'pt-PT', name: 'European Portuguese (Português de Portugal)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'zh', name: 'Simplified Chinese (简体中文)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'fa', name: 'Persian (فارسی)' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', name: 'Malayalam (മലയാളം)' },
  { code: 'th', name: 'Thai (ไทย)' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'cs', name: 'Czech (Čeština)' },
  { code: 'da', name: 'Danish (Dansk)' },
  { code: 'fi', name: 'Finnish (Suomi)' },
  { code: 'sv', name: 'Swedish (Svenska)' },
  { code: 'nb', name: 'Norwegian Bokmål (Norsk bokmål)' },
  { code: 'uk', name: 'Ukrainian (Українська)' },
  { code: 'ro', name: 'Romanian (Română)' },
  { code: 'hu', name: 'Hungarian (Magyar)' },
  { code: 'bg', name: 'Bulgarian (Български)' },
  { code: 'el', name: 'Greek (Ελληνικά)' },
  { code: 'he', name: 'Hebrew (עברית)' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'ms', name: 'Malay (Bahasa Melayu)' },
];

const fileCode = (code: string) => code.toLowerCase();
const pascal = (code: string) =>
  code
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');

// -------------------- English sources --------------------

import { coreEn } from '../src/lib/i18n/core/en';
import { clientContentEn } from '../src/lib/i18n/fragments/en/client-content';
import { clientPeopleEn } from '../src/lib/i18n/fragments/en/client-people';
import { clientAccountEn } from '../src/lib/i18n/fragments/en/client-account';
import { clientAiEn } from '../src/lib/i18n/fragments/en/client-ai';
import { clientBackupsEn } from '../src/lib/i18n/fragments/en/client-backups';
import { clientEmailTemplatesEn } from '../src/lib/i18n/fragments/en/client-email-templates';
import { clientAnalyticsEn } from '../src/lib/i18n/fragments/en/client-analytics';
import { clientAuditEn } from '../src/lib/i18n/fragments/en/client-audit';
import { clientJobsEn } from '../src/lib/i18n/fragments/en/client-jobs';
import { clientTaxonomyEn } from '../src/lib/i18n/fragments/en/client-taxonomy';
import { clientSeoEn } from '../src/lib/i18n/fragments/en/client-seo';

// Full client key set in SOURCE ORDER (stable across runs).
const clientKeyOrder: string[] = [
  ...Object.keys(clientContentEn),
  ...Object.keys(clientPeopleEn),
  ...Object.keys(clientAccountEn),
  ...Object.keys(clientAiEn),
  ...Object.keys(clientBackupsEn),
  ...Object.keys(clientEmailTemplatesEn),
  ...Object.keys(clientAnalyticsEn),
  ...Object.keys(clientAuditEn),
  ...Object.keys(clientJobsEn),
  ...Object.keys(clientTaxonomyEn),
  ...Object.keys(clientSeoEn),
];
const clientKeySet = new Set(clientKeyOrder);

const englishClient: Record<string, string> = {
  ...clientContentEn, ...clientPeopleEn, ...clientAccountEn, ...clientAiEn,
  ...clientBackupsEn, ...clientEmailTemplatesEn, ...clientAnalyticsEn,
  ...clientAuditEn, ...clientJobsEn, ...clientTaxonomyEn, ...clientSeoEn,
};

const frFamilies: { file: string; exportName: string; keys: string[]; source: Record<string, string> }[] = [
  { file: 'client-ai', exportName: 'clientAiFr', keys: Object.keys(clientAiEn), source: clientAiEn },
  { file: 'client-backups', exportName: 'clientBackupsFr', keys: Object.keys(clientBackupsEn), source: clientBackupsEn },
  { file: 'client-email-templates', exportName: 'clientEmailTemplatesFr', keys: Object.keys(clientEmailTemplatesEn), source: clientEmailTemplatesEn },
  { file: 'client-analytics', exportName: 'clientAnalyticsFr', keys: Object.keys(clientAnalyticsEn), source: clientAnalyticsEn },
  { file: 'client-audit', exportName: 'clientAuditFr', keys: Object.keys(clientAuditEn), source: clientAuditEn },
  { file: 'client-jobs', exportName: 'clientJobsFr', keys: Object.keys(clientJobsEn), source: clientJobsEn },
  { file: 'client-taxonomy', exportName: 'clientTaxonomyFr', keys: Object.keys(clientTaxonomyEn), source: clientTaxonomyEn },
  { file: 'client-seo', exportName: 'clientSeoFr', keys: Object.keys(clientSeoEn), source: clientSeoEn },
];

// -------------------- progress loading --------------------

function loadProgress(fileCode: string, tag: string): Record<string, string> {
  const merged: Record<string, string> = {};
  let i = 0;
  for (;;) {
    const p = path.join(PROGRESS_DIR, `${fileCode}.${tag}.batch${i}.json`);
    if (!fs.existsSync(p)) break;
    Object.assign(merged, JSON.parse(fs.readFileSync(p, 'utf8')));
    i++;
  }
  return merged;
}

// -------------------- TS file emission --------------------

function emitDict(exportName: string, entries: [string, string][], comment: string): string {
  const lines = entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  return `// ============================================================\n${comment}\n// ============================================================\n\nexport const ${exportName}: Record<string, string> = {\n${lines.join('\n')}\n};\n`;
}

function patchCoreFile(fc: string, newEntries: [string, string][]): void {
  const corePath = path.join(PROJECT, 'src/lib/i18n/core', `${fc}.ts`);
  let content = fs.readFileSync(corePath, 'utf8');
  for (const [k] of newEntries) {
    // Remove a (possibly empty) existing definition to avoid dup keys.
    const re = new RegExp(`^\\s*${JSON.stringify(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*.*$\\n?`, 'm');
    content = content.replace(re, '');
  }
  const lastBrace = content.lastIndexOf('};');
  if (lastBrace === -1) throw new Error(`core/${fc}.ts has no closing brace`);
  const insert =
    '\n  // ---- Keys filled by the locale generator (were missing; previously\n' +
    '  //      English fallbacks) ----\n' +
    newEntries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n') +
    '\n';
  fs.writeFileSync(corePath, content.slice(0, lastBrace) + insert + content.slice(lastBrace));
}

// -------------------- main --------------------

function main() {
  const stats: { code: string; client: number; core: number }[] = [];

  for (const { code, name } of LOCALES) {
    const fc = fileCode(code);
    const translated = loadProgress(fc, 'full');
    if (Object.keys(translated).length === 0) {
      console.log(`${code}: NO progress yet — skipped`);
      continue;
    }

    // 1. Client dictionary for this locale (only keys that translated).
    const clientEntries = clientKeyOrder
      .filter((k) => k in translated)
      .map((k) => [k, translated[k]] as [string, string]);
    const fragDir = path.join(PROJECT, 'src/lib/i18n/fragments', fc);
    fs.mkdirSync(fragDir, { recursive: true });
    const exportName = 'client' + pascal(fc);
    fs.writeFileSync(
      path.join(fragDir, 'client.ts'),
      emitDict(
        exportName,
        clientEntries,
        `// i18n — CLIENT dictionary: ${name}\n// Machine-assisted translation of the full client fragment key set\n// (11 families merged: content, people, account, ai, backups,\n// emailTemplates, analytics, audit, jobs, taxonomy, seo) generated\n// from fragments/en/*. Keys that failed translation are omitted on\n// purpose — t() falls back to the English value per key.\n// FOR MANUAL EDITS: edit fragments/en/* (source of truth) or this\n// file directly — both are plain dictionaries.`,
      ),
    );

    // 2. Core key fills.
    const coreKeys = Object.keys(coreEn).filter((k) => !clientKeySet.has(k) && k in translated);
    const coreEntries = coreKeys.map((k) => [k, translated[k]] as [string, string]);
    if (coreEntries.length > 0) patchCoreFile(fc, coreEntries);

    stats.push({ code, client: clientEntries.length, core: coreEntries.length });
    console.log(
      `${code}: client ${clientEntries.length}/${clientKeyOrder.length}, core +${coreEntries.length}`,
    );
  }

  // 3. French new families.
  {
    const frT = loadProgress('fr', 'frnew');
    if (Object.keys(frT).length > 0) {
      for (const fam of frFamilies) {
        const entries = fam.keys
          .filter((k) => k in frT)
          .map((k) => [k, frT[k]] as [string, string]);
        fs.writeFileSync(
          path.join(PROJECT, 'src/lib/i18n/fragments/fr', `${fam.file}.ts`),
          emitDict(
            fam.exportName,
            entries,
            `// i18n — FRAGMENT: ${fam.file} (French — Français)\n// Machine-assisted translation of fragments/en/${fam.file}.ts.\n// Keys that failed translation are omitted — t() falls back to\n// the English value per key.`,
          ),
        );
        console.log(`fr/${fam.file}: ${entries.length}/${fam.keys.length}`);
      }
    } else {
      console.log('fr: NO frnew progress yet — skipped');
    }
  }

  // 4. Rewrite locales.ts.
  const localesPath = path.join(PROJECT, 'src/lib/i18n/locales.ts');
  let content = fs.readFileSync(localesPath, 'utf8');

  // Remove any previous generated import block + merges (idempotent).
  content = content.replace(
    /\n\/\/ ---- Generated per-locale client dictionaries[\s\S]*?\nimport \{ clientMs \} from '\.\/fragments\/ms\/client';\n/,
    '\n',
  );

  const importLines = stats
    .map(({ code }) => {
      const fc = fileCode(code);
      return `import { client${pascal(fc)} } from './fragments/${fc}/client';`;
    })
    .join('\n');
  const importBlock = `\n// ---- Generated per-locale client dictionaries (machine-assisted\n//      translations of the full client key set; see\n//      .zscripts/translate-locales.ts + assemble-locales.ts) ----\n${importLines}\n`;
  const anchor = "import { platformBFr } from './fragments/fr/platform-b';";
  if (!content.includes(anchor)) throw new Error('locales.ts anchor not found');
  content = content.replace(anchor, anchor + importBlock);

  for (const { code } of stats) {
    const fc = fileCode(code);
    const name = pascal(fc);
    // Dictionaries map entries: `de: coreDe,` or `'pt-BR': corePtBr,`.
    const codeLiteral = code.includes('-') ? `'${code}'` : code;
    const escapedLiteral = codeLiteral.replace(/'/g, "\\'");
    const re = new RegExp(`^(\\s*)${escapedLiteral}: core${name},$`, 'm');
    if (!re.test(content)) {
      console.error(`locales.ts merge line not found for ${code} — skipping its merge`);
      continue;
    }
    content = content.replace(re, `$1${codeLiteral}: { ...core${name}, ...client${name} },`);
  }
  fs.writeFileSync(localesPath, content);
  console.log('locales.ts rewritten for', stats.length, 'locales');

  console.log(
    '\nDONE. Total client keys:',
    clientKeyOrder.length,
    '— locales assembled:',
    stats.length,
  );
}

main();
