// ============================================================
// Catch-all route — Redirect engine
// ============================================================
// Resolves URL redirects from the database. Runs in the Node.js
// runtime (not Edge) so Prisma works reliably.
//
// Behavior (per spec):
//   if redirect.exists && redirect.active:
//       type === 301/308 → permanent redirect (301/308)
//       type === 302/307 → temporary redirect (302/307)
//   if redirect.exists && redirect.inactive:
//       do NOT redirect (fall through to 404)
//   if !redirect.exists:
//       404
//
// On a successful redirect, the hit count is incremented and
// persisted in the same request.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type RouteContext = { params: Promise<{ slug: string[] }> };

const TYPE_TO_STATUS: Record<string, number> = {
  PERMANENT_301: 301,
  TEMPORARY_302: 302,
  TEMPORARY_307: 307,
  PERMANENT_308: 308,
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  // Reconstruct the pathname from the catch-all segments.
  const pathname = '/' + slug.join('/');

  // Look up an active redirect for this path. Inactive redirects are
  // intentionally ignored — the toggle in the admin UI controls whether
  // the redirect actually fires.
  const redirect = await db.redirect.findFirst({
    where: {
      fromPath: pathname,
      isActive: true,
    },
    select: {
      id: true,
      toPath: true,
      type: true,
    },
  });

  if (redirect) {
    // Increment hit count (fire-and-forget — don't block the redirect).
    db.redirect
      .update({
        where: { id: redirect.id },
        data: { hitCount: { increment: 1 } },
      })
      .catch(() => {
        // Swallow — the redirect itself is more important than the counter.
      });

    const statusCode = TYPE_TO_STATUS[redirect.type] ?? 301;
    const url = request.nextUrl.clone();
    url.pathname = redirect.toPath;
    // Search params are preserved via the clone — they carry over to the
    // destination URL automatically.
    return NextResponse.redirect(url, statusCode);
  }

  // No active redirect — return 404.
  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
