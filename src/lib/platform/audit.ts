// ============================================================
// AUDIT — admin action logging.
// ============================================================
// Every sensitive admin operation writes an AuditLog row via
// logAdminAction. NEVER log passwords, SMTP secrets, API keys or
// other sensitive credentials — callers must pass only safe
// human-readable detail.
// ============================================================

import { db } from '@/lib/db';

export interface AuditLogInput {
  userId: string;
  action: string; // e.g. 'plan.update', 'customer.suspend', 'coupon.create'
  resourceType: string; // e.g. 'PlanConfig', 'Customer', 'Coupon'
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogRow {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export async function logAdminAction(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        details: input.details ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch {
    // Audit logging must never break the primary operation.
  }
}

export async function listAuditLog(limit = 50): Promise<AuditLogRow[]> {
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { email: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    details: r.details,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.createdAt.toISOString(),
  }));
}
