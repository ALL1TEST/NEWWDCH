// GET /api/automations/search-provider — Check status of configured SERP/search provider
import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSearchProvider } from '@/lib/automation/serp-research';
import { requireFeature } from '@/lib/platform/platform-auth';

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'automation');
  if ('response' in auth) return auth.response;

  const status = getAvailableSearchProvider();
  return NextResponse.json({
    data: {
      provider: status.provider,
      isLive: status.isLive,
      label: status.label,
    },
  });
}
