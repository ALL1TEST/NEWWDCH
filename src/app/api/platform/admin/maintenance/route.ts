import { NextRequest } from 'next/server';
import { requireOwner, ok, getClientIp } from '@/lib/platform/platform-auth';
import { getMaintenanceConfig, setMaintenanceConfig, invalidateMaintenanceCache, type MaintenanceConfig } from '@/lib/platform/maintenance';
import { logAdminAction } from '@/lib/platform/audit';

export async function GET(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  return ok(await getMaintenanceConfig());
}

export async function PUT(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Partial<MaintenanceConfig>;
  const next = await setMaintenanceConfig(body);
  invalidateMaintenanceCache();
  await logAdminAction({
    userId: auth.user.id,
    action: 'maintenance.changed',
    resourceType: 'PlatformSetting',
    resourceId: 'platform.maintenance',
    details: `enabled=${next.enabled}, message="${next.message.slice(0, 80)}"`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(next);
}
