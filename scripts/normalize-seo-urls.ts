import { PrismaClient } from '@prisma/client';
import { normalizeBlogPath } from '../src/lib/seo/url-utils';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Normalizing existing SeoIssue pageUrls ---');
  const issues = await prisma.seoIssue.findMany();
  let updatedCount = 0;

  for (const issue of issues) {
    if (issue.pageUrl) {
      try {
        const u = new URL(issue.pageUrl);
        const normalized = normalizeBlogPath(u.pathname);
        if (normalized !== u.pathname) {
          const newUrl = `${u.origin}${normalized}${u.search}${u.hash}`;
          await prisma.seoIssue.update({
            where: { id: issue.id },
            data: { pageUrl: newUrl },
          });
          updatedCount++;
          console.log(`Updated issue ${issue.id}: ${issue.pageUrl} -> ${newUrl}`);
        }
      } catch {
        // Not a full URL
        const normalized = normalizeBlogPath(issue.pageUrl);
        if (normalized !== issue.pageUrl) {
          await prisma.seoIssue.update({
            where: { id: issue.id },
            data: { pageUrl: normalized },
          });
          updatedCount++;
        }
      }
    }
  }

  console.log(`Updated ${updatedCount} issue URLs out of ${issues.length} total.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
