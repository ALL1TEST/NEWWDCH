import { db } from './src/lib/db';
async function main() {
  const conn = await db.searchConsoleConnection.findFirst({ include: { stats: { orderBy: { date: 'desc' }, take: 3 }, topPages: { take: 8, orderBy: { clicks: 'desc' } }, topQueries: { take: 5, orderBy: { clicks: 'desc' } } } });
  console.log('=== CONNECTION ===');
  console.log(conn ? JSON.stringify({ id: conn.id, siteUrl: conn.siteUrl, status: conn.status, siteId: conn.siteId, lastSyncAt: conn.lastSyncAt, statsCount: conn.stats.length }) : 'NONE');
  const statCount = await db.searchConsoleStat.count();
  const statRange = await db.searchConsoleStat.aggregate({ _min: { date: true }, _max: { date: true }, _sum: { clicks: true, impressions: true }, _avg: { ctr: true, position: true } });
  console.log('=== STATS ===', JSON.stringify({ count: statCount, range: statRange }));
  console.log('=== SAMPLE STATS (last 3) ===', JSON.stringify(conn?.stats.map(s => ({ date: s.date, clicks: s.clicks, impressions: s.impressions, ctr: s.ctr, position: s.position }))));
  console.log('=== SAMPLE PAGES (top 8) ===', JSON.stringify(conn?.topPages.map(p => ({ pageUrl: p.pageUrl, clicks: p.clicks, impressions: p.impressions }))));
  console.log('=== SAMPLE QUERIES (top 5) ===', JSON.stringify(conn?.topQueries.map(q => ({ query: q.query, clicks: q.clicks }))));
  const pageCount = await db.searchConsolePage.count();
  const qCount = await db.searchConsoleQuery.count();
  console.log('=== TOTALS ===', JSON.stringify({ pages: pageCount, queries: qCount }));
  const sampleContent = await db.contentItem.findMany({ take: 5, select: { id: true, slug: true, title: true, status: true }, orderBy: { publishedAt: 'desc' } });
  console.log('=== CONTENT (published-ish) ===', JSON.stringify(sampleContent));
}
main().catch(e => { console.error('ERR', e); process.exit(1); }).finally(() => db.$disconnect());
