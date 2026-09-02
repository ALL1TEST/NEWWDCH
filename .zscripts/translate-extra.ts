// ============================================================
// i18n SUPPLEMENTARY TRANSLATOR — translates a small set of keys
// that were added to fragments/en AFTER the main translation run
// started, for the 38 generated locales. Patches the generated
// fragments/<locale>/client.ts files directly.
// Run AFTER assemble-locales.ts.
// ============================================================

import ZAI from 'z-ai-web-dev-sdk';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT = '/home/z/my-project';

const EXTRA_KEYS: Record<string, string> = {
  'billing.internalFeatureFullAccess': 'Full platform access',
  'billing.internalFeatureAllEnabled': 'All features enabled',
  'billing.internalFeatureBypass': 'Billing bypass',
  'billing.internalFeatureNoMrr': 'Not counted in MRR',
};

const LOCALES: { code: string; name: string }[] = [
  { code: 'de', name: 'German' }, { code: 'es', name: 'Spanish' }, { code: 'it', name: 'Italian' },
  { code: 'pt-BR', name: 'Brazilian Portuguese' }, { code: 'pt-PT', name: 'European Portuguese' },
  { code: 'nl', name: 'Dutch' }, { code: 'ru', name: 'Russian' }, { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' }, { code: 'zh', name: 'Simplified Chinese' }, { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' }, { code: 'bn', name: 'Bengali' }, { code: 'gu', name: 'Gujarati' },
  { code: 'fa', name: 'Persian (Farsi)' }, { code: 'pa', name: 'Punjabi' }, { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' }, { code: 'te', name: 'Telugu' }, { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' }, { code: 'th', name: 'Thai' }, { code: 'vi', name: 'Vietnamese' },
  { code: 'tr', name: 'Turkish' }, { code: 'pl', name: 'Polish' }, { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' }, { code: 'fi', name: 'Finnish' }, { code: 'sv', name: 'Swedish' },
  { code: 'nb', name: 'Norwegian Bokmål' }, { code: 'uk', name: 'Ukrainian' }, { code: 'ro', name: 'Romanian' },
  { code: 'hu', name: 'Hungarian' }, { code: 'bg', name: 'Bulgarian' }, { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' }, { code: 'id', name: 'Indonesian' }, { code: 'ms', name: 'Malay' },
];

const fileCode = (code: string) => code.toLowerCase();

async function main() {
  const zai = await ZAI.create();
  const system = `You are a professional software localizer for a CMS admin dashboard UI. Translate EVERY value into the requested language. Return ONLY a valid JSON object with the EXACT SAME KEYS — no markdown, no code fences. Keep translations concise and natural for UI. Keep brand/technical names as-is (MRR is a finance metric — keep it).`;

  for (const { code, name } of LOCALES) {
    const fc = fileCode(code);
    const filePath = path.join(PROJECT, 'src/lib/i18n/fragments', fc, 'client.ts');
    if (!fs.existsSync(filePath)) {
      console.log(`${code}: no generated client.ts — skipped`);
      continue;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    const present = Object.keys(EXTRA_KEYS).filter((k) => content.includes(JSON.stringify(k) + ':'));
    const missing = Object.keys(EXTRA_KEYS).filter((k) => !content.includes(JSON.stringify(k) + ':'));
    if (missing.length === 0) {
      console.log(`${code}: all extra keys already present`);
      continue;
    }

    const pairs: Record<string, string> = {};
    for (const k of missing) pairs[k] = EXTRA_KEYS[k];

    let out: Record<string, string> | null = null;
    for (let attempt = 1; attempt <= 3 && !out; attempt++) {
      try {
        await new Promise((r) => setTimeout(r, 3_000));
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: system },
            {
              role: 'user',
              content: `Translate every value to ${name} and return ONLY the JSON object:\n${JSON.stringify(pairs)}`,
            },
          ],
          thinking: { type: 'disabled' },
        });
        const text = (completion.choices[0]?.message?.content ?? '')
          .trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/, '');
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null) {
          const clean: Record<string, string> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string' && v.trim() && k in pairs) clean[k] = v;
          }
          if (Object.keys(clean).length > 0) out = clean;
        }
      } catch (err) {
        console.error(`${code} attempt ${attempt} failed:`, (err as Error).message?.slice(0, 80));
        await new Promise((r) => setTimeout(r, 8_000));
      }
    }
    if (!out) {
      console.error(`${code}: FAILED — extra keys fall back to English`);
      continue;
    }
    const insert =
      '\n  // ---- Supplementary keys (added after the main run) ----\n' +
      Object.entries(out)
        .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
        .join('\n') +
      '\n';
    const lastBrace = content.lastIndexOf('};');
    if (lastBrace === -1) throw new Error(`bad file: ${filePath}`);
    content = content.slice(0, lastBrace) + insert + content.slice(lastBrace);
    fs.writeFileSync(filePath, content);
    console.log(`${code}: +${Object.keys(out).length} extra keys (${present.length} already present)`);
  }
  console.log('EXTRA DONE');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
