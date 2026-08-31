'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFeature } from '@/lib/platform/platform-auth';

// =====================================================================
// GET — export logs as CSV
// =====================================================================

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'ai_content');
  if ('response' in auth) return auth.response;
  try {
    const sp = new URL(request.url).searchParams;
    const search = sp.get('search')?.trim() || '';
    const status = sp.get('status')?.trim();
    const providerId = sp.get('providerId')?.trim();
    const modelId = sp.get('modelId')?.trim();

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { question: { contains: search } },
        { response: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (providerId) where.providerId = providerId;
    if (modelId) where.modelId = modelId;

    const items = await db.aiLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const header = 'ID,Provider,Model,Status,Input Tokens,Output Tokens,Total Tokens,Cost (USD),Duration (ms),Created At,Question,Response';
    const rows = items.map((item) => {
      const question = (item.question || '').replace(/"/g, '""');
      const response = (item.response || '').replace(/"/g, '""');
      return `${item.id},${item.providerName || ''},${item.modelId || ''},${item.status},${item.inputTokens || 0},${item.outputTokens || 0},${item.totalTokens || 0},${item.costUsd || 0},${item.durationMs || 0},${item.createdAt.toISOString()},"${question}","${response}"`;
    });

    const csv = [header, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ai-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error('[AI/LOGS:EXPORT] —', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to export logs' }, meta: { requestId: crypto.randomUUID().slice(0, 8), timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
