import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { getAuditLog, type AuditEntry } from '@/lib/platform/platform-data';
import { listAuditLog } from '@/lib/platform/audit';

// Merges the relational mock audit feed with the REAL admin-action audit
// log (written by logAdminAction). Real entries surface first so admin
// actions are always visible; the mock feed provides historical context.
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? 50);
  const mockFeed: AuditEntry[] = getAuditLog(limit);
  const realFeed = await listAuditLog(limit);
  const real: AuditEntry[] = realFeed.map((r) => ({
    id: r.id,
    timestamp: r.createdAt,
    actor: r.userId ?? 'system',
    action: r.action,
    target: `${r.resourceType}${r.resourceId ? `:${r.resourceId}` : ''}`,
    detail: r.details ?? '',
    severity: r.action.includes('suspend') || r.action.includes('cancel') || r.action.includes('delet')
      ? 'critical'
      : r.action.includes('price') || r.action.includes('feature') || r.action.includes('maintenance')
        ? 'warning'
        : 'info',
  }));
  return ok([...real, ...mockFeed].slice(0, limit));
}
