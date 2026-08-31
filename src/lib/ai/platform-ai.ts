// ============================================================
// PLATFORM AI — internal platform-AI helpers (server-only).
// ============================================================
// The strict separation between the Platform Admin AI management
// experience and the Client AI experience:
//
//   PLATFORM ADMIN (AI → Providers / Models / Prompt Library /
//   Settings)  = CONFIGURES Platform AI — providers, API keys,
//   models, defaults, temperature/max-tokens and the internal
//   prompt templates.
//
//   CLIENT (AI / AI Tools)  = USES Platform AI — generate content,
//   generate images, SEO AI tools, view remaining usage. The client
//   never sees providers, API keys, models, settings or prompt
//   templates; the system internally selects the appropriate
//   Platform Admin prompt and runs it on the platform's configured
//   provider/model.
//
// This module provides the server-side building blocks:
//   1. getPlatformStaffUserIds()   — the users allowed to manage
//      the platform's AI infrastructure (OWNER / PLATFORM_ADMIN /
//      INTERNAL / EXEMPT billing).
//   2. platformOwnedProviderFilter() — Prisma where-clause matching
//      providers CREATED BY platform staff. Platform AI generation
//      runs exclusively on these; a client's own providers
//      (Client's Own AI API) are never used for platform generation
//      and their usage never consumes Platform AI limits.
//   3. resolvePlatformPrompt(slot, vars) — internal prompt-slot
//      resolution from the Platform Admin Prompt Library. When a
//      client uses an AI tool, the system picks the matching active
//      Platform Admin prompt, injects the tool variables, and
//      executes it. Clients can never read these prompts.
// ============================================================

import { db } from '@/lib/db';

// -------------------- Platform staff ownership --------------------

/** Staff user ids, cached briefly (the user table is tiny). */
let staffIdsCache: { ids: string[]; at: number } | null = null;
const STAFF_IDS_TTL_MS = 30_000;

/** Users who may manage the platform's AI infrastructure:
 *  role OWNER or PLATFORM_ADMIN, or billingMode INTERNAL/EXEMPT. */
export async function getPlatformStaffUserIds(): Promise<string[]> {
  const now = Date.now();
  if (staffIdsCache && now - staffIdsCache.at < STAFF_IDS_TTL_MS) {
    return staffIdsCache.ids;
  }
  const staff = await db.user.findMany({
    where: {
      OR: [
        { role: 'OWNER' },
        { role: 'PLATFORM_ADMIN' },
        { billingMode: 'INTERNAL' },
        { billingMode: 'EXEMPT' },
      ],
    },
    select: { id: true },
  });
  const ids = staff.map((u) => u.id);
  staffIdsCache = { ids, at: now };
  return ids;
}

/** Prisma `where` fragment matching AiProvider rows created by
 *  platform staff — the platform-owned AI infrastructure. Platform
 *  AI generation only ever runs on these providers; providers
 *  created by clients (Client's Own AI API) are excluded. */
export async function platformOwnedProviderFilter(): Promise<Record<string, unknown>> {
  const ids = await getPlatformStaffUserIds();
  return { createdById: { in: ids.length > 0 ? ids : ['__none__'] } };
}

// -------------------- Prompt-slot resolution --------------------

/** The functional tool slots the Platform Admin Prompt Library can
 *  drive. A prompt is bound to a slot by an EXACT tag match (e.g.
 *  tags: ["article"]) or — as a fallback — by its slugified name
 *  containing the slot key as a whole segment ("SEO Article Writer"
 *  matches the "article" slot). */
export type PlatformPromptSlot =
  | 'article' // Generate Article (full draft)
  | 'ideas' // Generate Article Ideas
  | 'title' // Generate Title
  | 'outline' // Generate Outline
  | 'rewrite' // Rewrite Content
  | 'improve' // Improve Content
  | 'seo-title' // Generate SEO Title
  | 'seo-description' // Generate SEO Description
  | 'text-action' // generic editor action (fallback slot)
  | 'images'; // AI image prompt wrapper

export interface ResolvedPlatformPrompt {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

interface PromptRow {
  id: string;
  name: string;
  tags: string | null;
  variables: string | null;
  systemPrompt: string | null;
  userPrompt: string | null;
  temperature: number | null;
  maxTokens: number | null;
  isActive: boolean;
  isFavorite: boolean;
  updatedAt: Date;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    // fall through to comma split
  }
  return trimmed.split(',').map((t) => t.trim()).filter(Boolean);
}

interface VariableDescriptor {
  name: string;
  default?: unknown;
  required?: boolean;
}

function parseVariableDescriptors(raw: string | null): VariableDescriptor[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
        .map((v) => ({
          name: String(v.name ?? ''),
          default: v.default,
          required: v.required === true,
        }))
        .filter((v) => v.name.length > 0);
    }
  } catch {
    // unparsable → no descriptors
  }
  return [];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Replace {{placeholder}} tokens with the provided variables.
 *  Missing optional variables resolve to ''; a missing REQUIRED
 *  variable (per the prompt's `variables` JSON) makes the prompt
 *  unusable for this call → returns null so the caller falls back
 *  to its built-in default prompt. */
function renderTemplate(
  template: string,
  vars: Record<string, string>,
  descriptors: VariableDescriptor[],
): string | null {
  const placeholders = new Set<string>();
  for (const m of template.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)) {
    placeholders.add(m[1]);
  }
  const resolved: Record<string, string> = { ...vars };
  for (const name of placeholders) {
    if (resolved[name] !== undefined) continue;
    const descriptor = descriptors.find((d) => d.name === name);
    if (descriptor && descriptor.default !== undefined && descriptor.default !== null) {
      resolved[name] = String(descriptor.default);
    } else if (descriptor?.required) {
      return null; // required variable missing → cannot use this prompt
    } else {
      resolved[name] = '';
    }
  }
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_all, name: string) =>
    resolved[name] ?? '',
  );
}

/** Internally resolve the Platform Admin prompt for a tool slot.
 *  Returns null when no active prompt is bound to the slot (the
 *  caller then uses its built-in default prompt) or when a required
 *  variable cannot be satisfied. NEVER exposed to clients — used
 *  exclusively inside server-side generation routes. */
export async function resolvePlatformPrompt(
  slot: PlatformPromptSlot,
  vars: Record<string, string>,
): Promise<ResolvedPlatformPrompt | null> {
  const rows = await db.promptTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, tags: true, variables: true,
      systemPrompt: true, userPrompt: true,
      temperature: true, maxTokens: true,
      isActive: true, isFavorite: true, updatedAt: true,
    },
  });

  // 1. Exact tag match (case-insensitive) — favorites first, then
  //    most recently updated.
  const tagMatches = rows
    .filter((r) => parseTags(r.tags).some((t) => t.trim().toLowerCase() === slot))
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt.getTime() - a.updatedAt.getTime());

  // 2. Name-slug fallback — the slot appears as a whole segment of
  //    the slugified prompt name.
  const nameMatches = rows
    .filter((r) => {
      const slug = slugify(r.name);
      return new RegExp(`(^|-)${slot.replace(/-[a-z]+$/, '')}(-|$)`).test(slug) || slug.includes(slot);
    })
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt.getTime() - a.updatedAt.getTime());

  const candidates: PromptRow[] = [...tagMatches, ...nameMatches.filter((m) => !tagMatches.includes(m))];

  for (const row of candidates) {
    const system = row.systemPrompt ?? '';
    const user = row.userPrompt ?? '';
    if (!system.trim() && !user.trim()) continue;
    const descriptors = parseVariableDescriptors(row.variables);
    const renderedSystem = system.trim() ? renderTemplate(system, vars, descriptors) : '';
    const renderedUser = user.trim() ? renderTemplate(user, vars, descriptors) : '';
    if (renderedSystem === null || renderedUser === null) continue; // required var missing
    return {
      systemPrompt: renderedSystem,
      userPrompt: renderedUser,
      ...(row.temperature != null ? { temperature: row.temperature } : {}),
      ...(row.maxTokens != null ? { maxTokens: row.maxTokens } : {}),
    };
  }
  return null;
}

/** Map a free-text editor action (e.g. "Generate SEO Title") to its
 *  prompt slot. Used by /api/content/ai-edit-selection. */
export function slotForAction(action: string): PlatformPromptSlot {
  const a = action.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (a.includes('seo-title') || a.includes('seo-title-tag')) return 'seo-title';
  if (a.includes('seo-description') || a.includes('meta-description')) return 'seo-description';
  if (a.includes('seo')) return 'seo-title';
  if (a.includes('title')) return 'title';
  if (a.includes('outline')) return 'outline';
  if (a.includes('rewrite')) return 'rewrite';
  if (a.includes('improve') || a.includes('expand') || a.includes('enhance')) return 'improve';
  return 'text-action';
}
