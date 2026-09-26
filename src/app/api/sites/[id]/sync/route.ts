// ============================================================
// POST /api/sites/[id]/sync — Synchronize content from connected site
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { syncSiteContent } from '@/lib/connection/site-sync';
import { getAuthUser } from '@/lib/platform/platform-auth';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Optional auth check: ensure user has access to this site
    const authUser = await getAuthUser(request);
    if (authUser && authUser.role !== 'INTERNAL' && authUser.role !== 'OWNER' && authUser.role !== 'PLATFORM_ADMIN') {
      const site = await db.site.findUnique({
        where: { id },
        select: { ownerId: true },
      });
      if (site && site.ownerId && site.ownerId !== authUser.id) {
        return NextResponse.json(
          { error: { message: 'Unauthorized to sync content for this site' } },
          { status: 403 },
        );
      }
    }

    const report = await syncSiteContent(id);

    return NextResponse.json({
      ok: true,
      data: report,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('POST /api/sites/[id]/sync error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: error.message || 'Failed to synchronize external site content',
        },
      },
      { status: 500 },
    );
  }
}
