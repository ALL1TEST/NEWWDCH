import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/platform/audit';

// Only the OWNER can list/create platform admins. Normal clients can
// never access or create platform admins.
// The list also includes the dedicated INTERNAL-role account (the
// platform-side Internal Account) so the Platform Admin profile's
// "Internal Account" management section can resolve its identity.
export async function GET(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const users = await db.user.findMany({
    where: { role: { in: ['OWNER', 'PLATFORM_ADMIN', 'INTERNAL'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      billingMode: true,
      mfaEnabled: true,
      emailVerified: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  return ok(users);
}

export async function POST(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    password?: string;
    role?: 'PLATFORM_ADMIN';
    billingMode?: 'EXTERNAL' | 'INTERNAL' | 'EXEMPT';
  };
  if (!body.email || !body.password) return fail('VALIDATION_ERROR', 'email and password are required.', 400);
  // OWNER can only be created via bootstrap; this endpoint creates PLATFORM_ADMIN only.
  const role = 'PLATFORM_ADMIN' as const;
  const exists = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (exists) return fail('CONFLICT', 'A user with that email already exists.', 409);
  const user = await db.user.create({
    data: {
      email: body.email.toLowerCase(),
      name: body.name ?? null,
      password: body.password, // demo-only plain text (matches existing convention)
      role,
      status: 'ACTIVE',
      billingMode: body.billingMode ?? 'EXTERNAL',
      emailVerified: true,
    },
    select: { id: true, email: true, name: true, role: true, status: true, billingMode: true, mfaEnabled: true, createdAt: true },
  });
  await logAdminAction({
    userId: auth.user.id,
    action: 'admin_user.created',
    resourceType: 'User',
    resourceId: user.id,
    details: `${user.email} (${user.role}) billingMode=${user.billingMode}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(user);
}
