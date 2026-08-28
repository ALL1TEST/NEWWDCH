import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getMaintenanceConfig } from '@/lib/platform/maintenance';
import AppEntry from '@/components/layout/app-entry';
import MaintenanceNotice from '@/components/layout/maintenance-notice';

// Always re-evaluate maintenance state on each request (never cached).
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Server-side maintenance gate: when maintenance is enabled, CLIENT
  // users see the maintenance page while OWNER / PLATFORM_ADMIN remain
  // able to access the admin area. Enforced on the server, not in the UI.
  const cookieStore = await cookies();
  const token = cookieStore.get('cms_session_token')?.value;

  let user: { role: string; status: string } | null = null;
  if (token) {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: { select: { role: true, status: true } } },
    });
    if (session && session.expiresAt > new Date() && session.user.status === 'ACTIVE') {
      user = session.user;
    }
  }

  const maintenance = await getMaintenanceConfig();
  const isPlatformStaff = user?.role === 'OWNER' || user?.role === 'PLATFORM_ADMIN';
  const blocked = maintenance.enabled && !isPlatformStaff;

  if (blocked) {
    return <MaintenanceNotice message={maintenance.message} />;
  }

  return <AppEntry />;
}
