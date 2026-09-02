import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/platform/audit';

type RouteContext = { params: Promise<{ id: string }> };

// Owner-only: update a platform admin's role/status/billingMode/2FA —
// and, for the dedicated INTERNAL-role account (the platform-side
// Internal Account), its email + password credentials. Sensitive — every
// change is audit-logged. Never returns passwords.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    role?: 'OWNER' | 'PLATFORM_ADMIN';
    status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
    billingMode?: 'EXTERNAL' | 'INTERNAL' | 'EXEMPT';
    mfaEnabled?: boolean;
    // Email change — only supported for the INTERNAL account target
    // (the Internal Account management section in the Platform Admin
    // profile). Validated + globally-unique-checked exactly like the
    // self-service /api/auth/change-email route.
    email?: string;
    // password reset (demo-only plain text)
    password?: string;
  };
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return fail('NOT_FOUND', 'Admin user not found.', 404);
  if (target.role !== 'OWNER' && target.role !== 'PLATFORM_ADMIN' && target.role !== 'INTERNAL') {
    return fail('VALIDATION_ERROR', 'Target is not a platform admin.', 400);
  }
  // The INTERNAL-role account is the dedicated Internal Account — the
  // only credentials (email/password) this admin route may rewrite. Its
  // role is fixed (INTERNAL) so the account-type separation can never be
  // collapsed from here.
  const isInternalAccount = target.role === 'INTERNAL';
  if (body.email !== undefined) {
    if (!isInternalAccount) {
      return fail('VALIDATION_ERROR', 'Email change is only supported for the Internal Account.', 400);
    }
    const newEmail = body.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return fail('VALIDATION_ERROR', 'Please enter a valid email address.', 400);
    }
    if (newEmail === target.email) {
      return fail('VALIDATION_ERROR', 'New email must be different from the current email.', 400);
    }
    const existing = await db.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== target.id) {
      return fail('CONFLICT', 'This email is already used by another account.', 409);
    }
  }
  if ((body.role !== undefined || body.status !== undefined || body.billingMode !== undefined || body.mfaEnabled !== undefined) && isInternalAccount) {
    return fail('VALIDATION_ERROR', 'Only email/password may be managed for the Internal Account.', 400);
  }
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.role !== undefined) data.role = body.role;
  if (body.status !== undefined) data.status = body.status;
  if (body.billingMode !== undefined) data.billingMode = body.billingMode;
  if (body.mfaEnabled !== undefined) data.mfaEnabled = body.mfaEnabled;
  if (body.email !== undefined) {
    data.email = body.email.toLowerCase().trim();
    // emailVerified is reset — same convention as /api/auth/change-email.
    data.emailVerified = false;
  }
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
    // Never log the password value. The Internal Account email change is
    // logged so credential management is traceable.
    details: `${updated.email}: ${Object.keys(data).filter((k) => k !== 'password').join(', ') || 'updated'}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const { id } = await context.params;
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
