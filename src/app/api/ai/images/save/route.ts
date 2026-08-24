'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import { nanoid } from 'nanoid';

// =====================================================================
// POST /api/ai/images/save — Save an AI-generated image as a Media record
// =====================================================================

const saveSchema = z.object({
  url: z.string().min(1, 'URL is required'),
  prompt: z.string().min(1),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  folderId: z.string().optional().or(z.literal('')),
  alt: z.string().optional(),
  siteId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = 'req_' + crypto.randomUUID().slice(0, 8);

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, meta: { requestId, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const d = parsed.data;

    // Try to determine image size by fetching headers (best-effort)
    let width: number | null = null;
    let height: number | null = null;
    let size = 0;

    try {
      const res = await fetch(d.url, { method: 'HEAD' });
      if (res.ok) {
        const contentLength = res.headers.get('content-length');
        if (contentLength) size = parseInt(contentLength, 10);
      }
    } catch {
      // Best effort
    }

    const filename = `ai-${nanoid(8)}.png`;
    const originalName = `AI Generated - ${d.prompt.slice(0, 50)}${d.prompt.length > 50 ? '...' : ''}.png`;

    // Store AI metadata
    const metadata = JSON.stringify({
      source: 'ai',
      prompt: d.prompt,
      providerId: d.providerId,
      modelId: d.modelId,
    });

    // Resolve an uploader — the Media.uploadedBy relation requires a valid User FK.
    // Pick the first ADMIN (or any user) since there is no auth in this setup.
    let uploader = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    if (!uploader) uploader = await db.user.findFirst({ select: { id: true } });
    if (!uploader) {
      return NextResponse.json(
        { error: { code: 'NO_USER', message: 'No user exists to attribute the upload to' }, meta: { requestId, timestamp: new Date().toISOString() } },
        { status: 500 },
      );
    }

    const item = await db.media.create({
      data: {
        filename,
        originalName,
        mimeType: 'image/png',
        size,
        width,
        height,
        url: d.url,
        thumbnailUrl: d.url,
        alt: d.alt || null,
        folderId: d.folderId === '' ? null : d.folderId ?? null,
        siteId: d.siteId || undefined,
        uploadedById: uploader.id,
        processingStatus: 'READY',
        metadata,
      },
      include: {
        folder: { select: { id: true, name: true, parentId: true } },
        uploadedBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    return NextResponse.json({ data: item, meta: { requestId, timestamp: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error(`[AI/IMAGES/SAVE] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save generated image' }, meta: { requestId, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
