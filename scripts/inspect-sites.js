const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sites = await prisma.site.findMany();
  for (const s of sites) {
    console.log(`Site: ${s.name} (${s.id}) slug=${s.slug} domain=${s.domain}`);
    try {
      const cfg = JSON.parse(s.config || '{}');
      console.log('  Connection platform:', cfg.connection?.platform);
      console.log('  Connection siteUrl:', cfg.connection?.siteUrl);
      console.log('  Connection apiBaseUrl:', cfg.connection?.apiBaseUrl);
    } catch {}
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
