// ============================================================
// AKISMET SPAM DETECTION SERVICE
// ============================================================
//
// Real integration with the Akismet API (https://akismet.com/).
// Calls the `rest.akismet.com/1.1/comment-check` endpoint to
// classify a comment as spam or ham (not spam).
//
// Required settings (stored in the Setting table, category=DISCUSSION):
//   - akismet_api_key  (ENCRYPTED — the Akismet API key)
//   - akismet_blog_url (URL — the front-page URL of the site)
//
// API docs: https://akismet.com/developers/
// ============================================================

import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

// -------------------- Types --------------------

export interface AkismetCheckParams {
  /** The comment content / body text. */
  commentContent: string;
  /** Comment author name. */
  commentAuthor: string;
  /** Comment author email (if available). */
  commentAuthorEmail?: string;
  /** Comment author website URL (if available). */
  commentAuthorUrl?: string;
  /** The permalink URL of the article the comment was posted to. */
  permalink?: string;
  /** The commenter's IP address (from the request). */
  userAgentIp?: string;
  /** The commenter's User-Agent string (from the request). */
  userAgent?: string;
  /** The referrer header from the comment submission. */
  referrer?: string;
  /** Optional — forces Akismet to treat this as a test request. */
  isTest?: boolean;
}

export interface AkismetCheckResult {
  /** `true` when Akismet classifies the comment as spam. */
  isSpam: boolean;
  /** Akismet's raw response body ("true" = spam, "false" = ham). */
  raw: string;
  /** When Akismet returns `proTip` headers or extra info. */
  proTip?: string;
  /** When the check threw, the error message is captured here. */
  error?: string;
}

// -------------------- Internal helpers --------------------

const AKISMET_API_BASE = 'https://rest.akismet.com';
const AKISMET_API_VERSION = '1.1';
const AKISMET_TIMEOUT_MS = 8000;

/** Form-encode a record of string values (Akismet uses x-www-form-urlencoded). */
function encodeForm(fields: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.set(key, value);
  }
  return params.toString();
}

// -------------------- Settings lookup --------------------

/**
 * Load the Akismet configuration from the Setting table.
 * Returns `null` when Akismet is not configured (missing key or blog URL).
 */
async function getAkismetConfig(): Promise<{ apiKey: string; blog: string } | null> {
  const settings = await db.setting.findMany({
    where: {
      key: { in: ['akismet_api_key', 'akismet_blog_url'] },
    },
    select: { key: true, value: true, isEncrypted: true },
  });

  const apiKeySetting = settings.find((s) => s.key === 'akismet_api_key');
  const blogSetting = settings.find((s) => s.key === 'akismet_blog_url');

  if (!apiKeySetting || !blogSetting) return null;

  // Decrypt the API key if it's stored encrypted.
  let apiKey: string;
  try {
    apiKey = apiKeySetting.isEncrypted
      ? await decrypt(apiKeySetting.value)
      : apiKeySetting.value;
  } catch {
    console.error('[AKISMET] Failed to decrypt API key');
    return null;
  }

  const blog = blogSetting.value;
  if (!apiKey || !blog) return null;

  return { apiKey, blog };
}

// -------------------- Public API --------------------

/**
 * Check whether Akismet is configured (API key + blog URL present).
 * Use this to decide whether to show the "Akismet" option in the UI.
 */
export async function isAkismetConfigured(): Promise<boolean> {
  const config = await getAkismetConfig();
  return config !== null;
}

/**
 * Verify an Akismet API key + blog URL pair by calling the
 * `rest.akismet.com/1.1/verify-key` endpoint.
 *
 * Returns `{ valid: true }` when the key is valid for the blog.
 */
export async function verifyAkismetKey(
  apiKey: string,
  blog: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const body = encodeForm({
      key: apiKey,
      blog,
    });
    const res = await fetch(
      `${AKISMET_API_BASE}/${AKISMET_API_VERSION}/verify-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(AKISMET_TIMEOUT_MS),
      },
    );
    const text = (await res.text()).trim();
    return { valid: text === 'valid' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { valid: false, error: msg };
  }
}

/**
 * Check a comment against Akismet's spam filter.
 *
 * Calls `POST {apiKey}.rest.akismet.com/1.1/comment-check`.
 * Returns `{ isSpam: true }` when Akismet classifies the comment as spam.
 *
 * When the check throws (network error, invalid key, etc.), the function
 * returns `{ isSpam: false, error: msg }` — failing OPEN (allowing the
 * comment) rather than silently blocking legitimate comments when the
 * spam service is unreachable.
 */
export async function checkCommentSpam(
  params: AkismetCheckParams,
): Promise<AkismetCheckResult> {
  const config = await getAkismetConfig();
  if (!config) {
    return {
      isSpam: false,
      raw: '',
      error: 'Akismet is not configured (missing API key or blog URL)',
    };
  }

  const { apiKey, blog } = config;

  // Akismet's comment-check endpoint is keyed by the API key in the
  // hostname: {apiKey}.rest.akismet.com/1.1/comment-check
  const url = `https://${apiKey}.${AKISMET_API_BASE.replace('https://', '')}/${AKISMET_API_VERSION}/comment-check`;

  const body = encodeForm({
    blog,
    comment_content: params.commentContent,
    comment_author: params.commentAuthor,
    comment_author_email: params.commentAuthorEmail ?? '',
    comment_author_url: params.commentAuthorUrl ?? '',
    permalink: params.permalink ?? '',
    user_ip: params.userAgentIp ?? '',
    user_agent: params.userAgent ?? '',
    referrer: params.referrer ?? '',
    is_test: params.isTest ? 'true' : 'false',
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(AKISMET_TIMEOUT_MS),
    });

    const text = (await res.text()).trim();
    const proTip = res.headers.get('x-akismet-pro-tip') ?? undefined;

    // Akismet returns "true" for spam, "false" for ham.
    // Any other response (including "invalid" when the key is bad) is
    // treated as "not spam" to avoid false positives.
    return {
      isSpam: text === 'true',
      raw: text,
      proTip,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    console.warn('[AKISMET] comment-check failed:', msg);
    return { isSpam: false, raw: '', error: msg };
  }
}
