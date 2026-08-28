import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { setFeatureFlag } from '@/lib/platform/feature-flags';
import { logAdminAction } from '@/lib/platform/audit';

// Feature-flag toggles are owner-only (platform rollout decisions).
export async function PATCH(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const key = request.nextUrl.pathname.split('/').filter(Boolean).pop()!;
  const body = (await request.json().catch(() => ({}))) as { isEnabled?: boolean };
  if (typeof body.isEnabled !== 'boolean') return fail('VALIDATION_ERROR', 'isEnabled (boolean) is required.', 400);
  await setFeatureFlag(key, body.isEnabled);
  await logAdminAction({
    userId: auth.user.id,
    action: 'feature_flag.changed',
    resourceType: 'FeatureFlag',
    resourceId: key,
    details: `isEnabled=${body.isEnabled}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok({ key, isEnabled: body.isEnabled });
}
