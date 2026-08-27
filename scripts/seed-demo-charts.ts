/* Dev-only demo data seeder for chart verification. Run: bun run scripts/seed-demo-charts.ts */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ---- Backup Activity data ----
  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  const createdById = anyUser?.id ?? 'seed-user';
  await prisma.backup.deleteMany({ where: { name: { startsWith: 'Demo backup' } } });
  for (let i = 0; i < 6; i++) {
    const completedAt = new Date(Date.now() - i * 24 * 3600_000 - 3600_000);
    await prisma.backup.create({
      data: {
        name: `Demo backup ${i + 1}`,
        filename: `demo-backup-${i + 1}.zip`,
        status: 'COMPLETED' as never,
        size: 1_200_000 + i * 340_000,
        durationMs: 42_000 + i * 1000,
        createdById,
        completedAt,
        createdAt: new Date(completedAt.getTime() - 60_000),
      },
    });
  }
  console.log('Seeded 6 completed backups');

  // ---- Search Console data ----
  const existingConn = await prisma.searchConsoleConnection.findFirst();
  let connId = existingConn?.id;
  if (!connId) {
    const conn = await prisma.searchConsoleConnection.create({
      data: { siteUrl: 'https://demo.example.com', status: 'CONNECTED' as never, lastSyncAt: new Date() },
    });
    connId = conn.id;
  } else {
    await prisma.searchConsoleConnection.update({
      where: { id: connId },
      data: { status: 'CONNECTED' as never, lastSyncAt: new Date() },
    });
  }
  await prisma.searchConsoleStat.deleteMany({ where: { connectionId: connId } });
  const stats: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600_000);
    const date = d.toISOString().slice(0, 10);
    const clicks = 24 + ((13 - i) * 7) % 41;
    const impressions = 1200 + i * 90 + (i % 3) * 130;
    stats.push({ date, clicks, impressions, ctr: clicks / impressions, position: +(9.4 - (13 - i) * 0.08).toFixed(2) });
  }
  for (const s of stats) {
    await prisma.searchConsoleStat.create({ data: { ...s, connectionId: connId! } });
  }
  console.log('Seeded 14 SearchConsoleStat days');
}

main().finally(() => prisma.$disconnect());
