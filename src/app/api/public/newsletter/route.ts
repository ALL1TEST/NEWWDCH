import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// ============================================================
// POST /api/public/newsletter — PUBLIC marketing newsletter
// subscribe for the unauthenticated marketing site.
// ============================================================
// Thin public twin of the authenticated /api/subscribers CMS
// endpoint: the marketing blog's newsletter card is shown to
// anonymous visitors, so it needs an unauthenticated subscribe
// path. Reuses the SAME NewsletterSubscriber model (platform
// scope, siteId NULL) — no duplicate data. The CMS subscriber
// list picks these up like any other subscriber (source
// 'MARKETING_BLOG'); unsubscribes are honored via status.
//
// Behaviour:
//   201  subscribed
//   409  already subscribed (treated as success by the UI)
//   400  invalid email
//   429  too many attempts (in-memory window)
// ============================================================

const schema = z.object({
  email: z.string().email('Valid email is required').max(255).trim().toLowerCase(),
});

// Minimal in-memory rate limit: 5 attempts per IP per 10 minutes.
// (The marketing site is the only consumer; this stops trivial
// abuse without adding infrastructure.)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  attempts.set(ip, list);
  if (attempts.size > 5000) {
    // opportunistic cleanup of stale entries
    for (const [key, times] of attempts) {
      if (times.every((t) => now - t >= WINDOW_MS)) attempts.delete(key);
    }
  }
  return list.length > MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
        { status: 400 },
      );
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'A valid email address is required.' } },
        { status: 400 },
      );
    }

    // Platform-level (siteId NULL) subscriber — same row the CMS
    // newsletter module manages.
    const existing = await db.newsletterSubscriber.findFirst({
      where: { siteId: null, email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: { code: 'ALREADY_SUBSCRIBED', message: 'This email is already subscribed.' } },
        { status: 409 },
      );
    }

    const item = await db.newsletterSubscriber.create({
      data: {
        siteId: null,
        email: parsed.data.email,
        source: 'MARKETING_BLOG',
      },
      select: { id: true },
    });

    return NextResponse.json({ data: { id: item.id } }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: 'SUBSCRIBE_UNAVAILABLE', message: 'Subscription is temporarily unavailable.' } },
      { status: 503 },
    );
  }
}
