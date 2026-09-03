// ============================================================
// i18n LOCALE GENERATOR — machine-assisted translation of the full
// client dictionary + missing core keys into the 38 non-en/fr
// supported locales (+ the 8 NEW fragment families for French).
// ============================================================
// Uses z-ai-web-dev-sdk (backend-only) chat completions in batches.
// Robustness:
//   • per-request timeout (the SDK itself never times out)
//   • global request pacing (≥3s between request starts)
//   • shared 60s cooldown after any 429
//   • lenient JSON salvage for truncated outputs
//   • missing-key retranslation (truncation never loses a key)
//   • progress persisted per (locale, batch) → resumable
// Failed keys are omitted — t() falls back to the English string.
// ============================================================

import ZAI from 'z-ai-web-dev-sdk';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT = '/home/z/my-project';
const PROGRESS_DIR = path.join(PROJECT, '.zscripts', 'i18n-progress');
fs.mkdirSync(PROGRESS_DIR, { recursive: true });

// -------------------- Locale registry --------------------

const LOCALES: { code: string; name: string }[] = [
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt-BR', name: 'Brazilian Portuguese' },
  { code: 'pt-PT', name: 'European Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Simplified Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'fa', name: 'Persian (Farsi)' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'nb', name: 'Norwegian Bokmål' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ro', name: 'Romanian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
];

// -------------------- English source dictionaries --------------------

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
import { platformAEn } from '../src/lib/i18n/fragments/en/platform-a';
import { platformBEn } from '../src/lib/i18n/fragments/en/platform-b';

// The FULL client key set (11 families) every locale receives.
const clientKeys: Record<string, string> = {
  ...clientContentEn,
  ...clientPeopleEn,
  ...clientAccountEn,
  ...clientAiEn,
  ...clientBackupsEn,
  ...clientEmailTemplatesEn,
  ...clientAnalyticsEn,
  ...clientAuditEn,
  ...clientJobsEn,
  ...clientTaxonomyEn,
  ...clientSeoEn,
  // Platform Admin UI (overview, customers, payments, plans, coupons,
  // stripe, notifications, email-templates, smtp, ai, backups) — the
  // platform-a + platform-b fragment families. Without these the
  // Platform Admin dashboard renders translated nav but English cards/
  // tables/empty states (the exact "partial translation" bug).
  ...platformAEn,
  ...platformBEn,
};

// The 8 NEW families (French already has curated translations for the
// 3 original families — only these need generating for fr).
const newFamilyKeys: Record<string, string> = {
  ...clientAiEn,
  ...clientBackupsEn,
  ...clientEmailTemplatesEn,
  ...clientAnalyticsEn,
  ...clientAuditEn,
  ...clientJobsEn,
  ...clientTaxonomyEn,
  ...clientSeoEn,
};

// -------------------- Config --------------------

const BATCH_SIZE = 150;
const CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 150_000;
const MIN_REQUEST_GAP_MS = 1_500; // probed safe at concurrency 2
const RATE_COOLDOWN_MS = 60_000;

// -------------------- Pacing / cooldown --------------------

let nextAllowedRequestAt = 0; // shared gate
let lastRequestStart = 0;

async function requestGate(): Promise<void> {
  for (;;) {
    const now = Date.now();
    const waitUntil = Math.max(nextAllowedRequestAt, lastRequestStart + MIN_REQUEST_GAP_MS);
    if (now >= waitUntil) {
      lastRequestStart = now;
      return;
    }
    await new Promise((r) => setTimeout(r, Math.min(waitUntil - now, 5_000)));
  }
}

function triggerCooldown(): void {
  nextAllowedRequestAt = Date.now() + RATE_COOLDOWN_MS;
}

// -------------------- Helpers --------------------

const fileCode = (code: string) => code.toLowerCase(); // 'pt-BR' → 'pt-br'
const pascal = (code: string) =>
  code
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(''); // 'pt-br' → 'PtBr'

const HEARTBEAT = path.join(PROGRESS_DIR, 'heartbeat');

interface Task {
  locale: string; // dict key e.g. 'pt-BR'
  name: string; // language name
  batchIndex: number;
  keys: string[];
  tag: string;
}

function progressPath(t: Task) {
  return path.join(PROGRESS_DIR, `${fileCode(t.locale)}.${t.tag}.batch${t.batchIndex}.json`);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadCore(locale: string): Promise<Record<string, string>> {
  const fc = fileCode(locale);
  const mod = (await import(`../src/lib/i18n/core/${fc}.ts`)) as Record<
    string,
    Record<string, string>
  >;
  const exportName = 'core' + pascal(fc);
  return mod[exportName] ?? {};
}

// -------------------- LLM call --------------------

let zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

/** Lenient `"key": "value"` salvage for truncated JSON outputs. */
function lenientParse(text: string, validKeys: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /"((?:[^"\\\n]|\\.)+)"\s*:\s*"((?:[^"\\\n]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const k = m[1];
    if (validKeys.has(k)) {
      try {
        out[k] = JSON.parse('"' + m[2] + '"');
      } catch {
        // Skip malformed escape sequence.
      }
    }
  }
  return out;
}

async function translateBatch(
  languageName: string,
  pairs: Record<string, string>,
): Promise<Record<string, string> | null> {
  if (!zai) zai = await ZAI.create();

  const system = `You are a professional software localizer for a CMS admin dashboard UI. You will receive a JSON object mapping translation keys to English UI strings (labels, buttons, page titles, table headers, form descriptions, toast messages, empty states). Translate EVERY value into ${languageName}.

STRICT RULES:
- Return ONLY a valid JSON object with the EXACT SAME KEYS — no markdown, no code fences, no commentary.
- Keep translations concise and natural for UI (buttons short, descriptions clear).
- Preserve the casing style (Title Case stays Title Case where the language uses it), trailing ellipsis (… or ...), punctuation and placeholder tokens.
- Keep brand/technical names as-is: SEO, AI, API, SMTP, SFTP, URL, CSV, JSON, HTML, DNS, XML, RSS, Stripe, OpenAI, Anthropic, Gemini, OpenRouter, Ollama, cron.
- Do NOT merge, split, add or drop keys.`;

  const user = `Translate every value to ${languageName} and return ONLY the JSON object:\n${JSON.stringify(
    pairs,
    null,
    0,
  )}`;

  await requestGate();

  const callPromise = zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: system },
      { role: 'user', content: user },
    ],
    thinking: { type: 'disabled' },
  });

  // The SDK has no internal timeout — race it so a hung connection
  // cannot stall a worker forever.
  let timedOut = false;
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, REQUEST_TIMEOUT_MS);
  });
  let completion: Awaited<typeof callPromise> | null = null;
  try {
    completion = (await Promise.race([callPromise, timeout])) as typeof completion;
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if (msg.includes('429')) triggerCooldown();
    console.error('LLM call failed:', msg.slice(0, 100));
    return null;
  }
  if (completion === null) {
    if (timedOut) console.error('LLM call timed out after', REQUEST_TIMEOUT_MS / 1000, 's');
    return null;
  }

  try {
    let text = completion.choices[0]?.message?.content ?? '';
    if (!text.trim()) return null;
    text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    // 1) Strict parse.
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim().length > 0 && k in pairs) out[k] = v;
        }
        if (Object.keys(out).length > 0) return out;
      }
    } catch {
      // Fall through to lenient parse.
    }
    // 2) Lenient parse — salvage complete pairs from truncated output.
    const salvaged = lenientParse(text, new Set(Object.keys(pairs)));
    return Object.keys(salvaged).length > 0 ? salvaged : null;
  } catch (err) {
    console.error('response handling failed:', (err as Error).message?.slice(0, 100));
    return null;
  }
}

// -------------------- Task runner --------------------

async function runTask(t: Task): Promise<void> {
  const pp = progressPath(t);
  if (fs.existsSync(pp)) return; // already done (resume support)

  const allPairs: Record<string, string> = {};
  for (const k of t.keys) {
    const value = (t.tag === 'frnew' ? newFamilyKeys : clientKeys)[k] ?? coreEn[k];
    if (value !== undefined) allPairs[k] = value;
  }
  if (Object.keys(allPairs).length === 0) {
    fs.writeFileSync(pp, JSON.stringify({}));
    return;
  }

  // Translations accumulate here; only the REMAINING (untranslated)
  // keys are resent, so a truncated response never loses a key — the
  // follow-up attempt simply covers the rest.
  const translated: Record<string, string> = {};
  let remaining: Record<string, string> = { ...allPairs };
  let noProgressStreak = 0; // consecutive calls with <25% progress
  let backoffMs = 12_000;

  while (Object.keys(remaining).length > 0 && noProgressStreak < 5) {
    const remainingCount = Object.keys(remaining).length;
    const before = Date.now();
    const attempt = await translateBatch(t.name, remaining);
    fs.writeFileSync(HEARTBEAT, String(Date.now()));

    if (attempt === null || Object.keys(attempt).length === 0) {
      // 429 / hang / unparseable → adaptive backoff, does not consume
      // a no-progress slot unless it keeps happening.
      noProgressStreak++;
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 1.5, 90_000);
      continue;
    }

    const recovered = Object.keys(attempt).length;
    for (const [k, v] of Object.entries(attempt)) {
      translated[k] = v;
      delete remaining[k];
    }
    // Decent progress resets the failure streak and the backoff.
    if (recovered >= remainingCount * 0.25) {
      noProgressStreak = 0;
      backoffMs = 12_000;
    } else {
      noProgressStreak++;
      await new Promise((r) => setTimeout(r, 3_000));
    }
    const secs = ((Date.now() - before) / 1000).toFixed(0);
    console.log(
      `[${t.locale}/${t.tag}] batch ${t.batchIndex}: +${recovered} (${Object.keys(translated).length}/${Object.keys(allPairs).length} in ${secs}s)`,
    );
  }

  const missing = Object.keys(remaining);
  fs.writeFileSync(pp, JSON.stringify(translated));
  console.log(
    `[${t.locale}/${t.tag}] batch ${t.batchIndex} DONE: ${Object.keys(translated).length}/${t.keys.length}${
      missing.length ? ` (missing ${missing.length} → en fallback)` : ''
    }`,
  );
}

// -------------------- Main --------------------

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

async function main() {
  // Optional: exit cleanly after N completed batches (wrapper restarts
  // the process — resilient against crashes/OOM and long-lived SDK
  // connection issues). 0 = unlimited.
  const maxBatchesPerRun = Number(process.env.MAX_BATCHES ?? '0');
  let completedThisRun = 0;

  const tasks: Task[] = [];

  for (const { code, name } of LOCALES) {
    const core = await loadCore(code);
    const missingCore = Object.keys(coreEn).filter((k) => !(k in core));
    const full = [...Object.keys(clientKeys), ...missingCore];
    const batches = chunk(full, BATCH_SIZE);
    batches.forEach((keys, i) => tasks.push({ locale: code, name, batchIndex: i, keys, tag: 'full' }));
    console.log(
      `${code}: ${full.length} keys (${batches.length} batches, ${missingCore.length} core-missing)`,
    );
  }

  {
    const frCore = await loadCore('fr');
    const missingCoreFr = Object.keys(coreEn).filter((k) => !(k in frCore));
    const frKeys = [...Object.keys(newFamilyKeys), ...missingCoreFr];
    chunk(frKeys, BATCH_SIZE).forEach((keys, i) =>
      tasks.push({ locale: 'fr', name: 'French', batchIndex: i, keys, tag: 'frnew' }),
    );
    console.log(`fr: ${frKeys.length} new-family keys`);
  }

  // Round-robin by batch index: sort pending tasks so EVERY locale gets
  // its batch 0 before any locale gets batch 1, batch 1 before batch 2,
  // etc. This guarantees broad partial coverage across ALL locales fast
  // (every language gets its first ~150 translated keys ASAP) instead of
  // fully completing a few locales while 25 others stay at zero. The
  // (batchIndex, locale) sort key achieves this; locale is the tiebreaker
  // so the order is deterministic and stable across restarts.
  const pending = tasks
    .filter((t) => !fs.existsSync(progressPath(t)))
    .sort((a, b) => a.batchIndex - b.batchIndex || a.locale.localeCompare(b.locale));
  console.log(`TOTAL tasks: ${tasks.length}, pending: ${pending.length}, concurrency: ${CONCURRENCY}`);

  let idx = 0;
  const started = Date.now();
  async function worker(id: number) {
    for (;;) {
      if (maxBatchesPerRun > 0 && completedThisRun >= maxBatchesPerRun) {
        console.log(`[worker ${id}] batch limit reached (${maxBatchesPerRun}) — clean exit for restart`);
        return;
      }
      const my = idx++;
      if (my >= pending.length) break;
      const t = pending[my];
      try {
        await runTask(t);
        completedThisRun++;
      } catch (err) {
        console.error(`worker ${id} task failed:`, (err as Error).message);
      }
      if ((my + 1) % 20 === 0) {
        console.log(
          `progress: ${my + 1}/${pending.length} tasks, ${((Date.now() - started) / 60000).toFixed(1)} min, rss=${Math.round(process.memoryUsage().rss / 1e6)}MB`,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  if (pending.every((_, i) => fs.existsSync(progressPath(pending[i]))) || idx >= pending.length) {
    console.log('ALL BATCHES DONE in', ((Date.now() - started) / 60000).toFixed(1), 'min');
    fs.writeFileSync(path.join(PROGRESS_DIR, 'ALL_DONE'), String(Date.now()));
  } else {
    console.log('RUN ENDED (restart needed) — completed this run:', completedThisRun);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
