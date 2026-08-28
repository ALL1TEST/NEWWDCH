import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/platform/audit';

// Owner-only: update a platform admin's role/status/billingMode/2FA.
// Sensitive — every change is audit-logged. Never returns passwords.
export async function PATCH(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    role?: 'OWNER' | 'PLATFORM_ADMIN';
    status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
    billingMode?: 'EXTERNAL' | 'INTERNAL' | 'EXEMPT';
    mfaEnabled?: boolean;
    // password reset (demo-only plain text)
    password?: string;
  };
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return fail('NOT_FOUND', 'Admin user not found.', 404);
  if (target.role !== 'OWNER' && target.role !== 'PLATFORM_ADMIN') {
    return fail('VALIDATION_ERROR', 'Target is not a platform admin.', 400);
  }
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.role !== undefined) data.role = body.role;
  if (body.status !== undefined) data.status = body.status;
  if (body.billingMode !== undefined) data.billingMode = body.billingMode;
  if (body.mfaEnabled !== undefined) data.mfaEnabled = body.mfaEnabled;
  if (body.password) data.password = body.password; // demo-only
  if (Object.keys(data).length === 0) return fail('VALIDATION_ERROR', 'No fields to update.', 400);
  const updated = await db.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, status: true, billingMode: true, mfaEnabled: true },
  });
  await logAdminAction({
    userId: auth.user.id,
    action: 'admin_user.updated',
    resourceType: 'User',
    resourceId: id,
    // Never log the password value.
    details: `${updated.email}: ${Object.keys(data).filter((k) => k !== 'password').join(', ') || 'updated'}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(updated);
}

export async function DELETE(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return fail('NOT_FOUND', 'Admin user not found.', 404);
  if (target.role === 'OWNER') return fail('FORBIDDEN', 'Cannot delete an OWNER account.', 403);
  await db.user.update({ where: { id }, data: { status: 'DEACTIVATED', deletedAt: new Date() } });
  await logAdminAction({
    userId: auth.user.id,
    action: 'admin_user.deactivated',
    resourceType: 'User',
    resourceId: id,
    details: `${target.email} deactivated`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok({ deactivated: true });
}
