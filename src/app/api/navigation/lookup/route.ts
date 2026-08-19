// ============================================================
// GET /api/navigation/lookup — Lookup content for menu item references
// Query params:
//   type: 'pages' | 'content' | 'categories' | 'tags'
//   search: search string
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<Record<string, string>> };

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const type = sp.get('type') || '';
    const search = sp.get('search')?.trim() || '';
    const siteFilter = await getSiteWhere(request);

    const take = Math.min(50, Math.max(1, Number(sp.get('limit')) || 20));

    if (!['pages', 'content', 'categories', 'tags'].includes(type)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TYPE', message: 'Type must be pages, content, categories, or tags' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    let data: unknown[] = [];

    if (type === 'pages' || type === 'content') {
      const where: Record<string, unknown> = {
        ...siteFilter,
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { slug: { contains: search } },
              ],
            }
          : {}),
      };

      data = await db.contentItem.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          contentTypeId: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
      });
    } else if (type === 'categories') {
      const where: Record<string, unknown> = {
        ...siteFilter,
        ...(search ? { name: { contains: search } } : {}),
      };

      data = await db.category.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
        },
        orderBy: { name: 'asc' },
        take,
      });
    } else if (type === 'tags') {
      const where: Record<string, unknown> = {
        ...siteFilter,
        ...(search ? { name: { contains: search } } : {}),
      };

      data = await db.tag.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { name: 'asc' },
        take,
      });
    }

    return NextResponse.json({ data, meta: { requestId: id } });
  } catch (error) {
    console.error(`[NAVIGATION:LOOKUP] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to lookup content' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
