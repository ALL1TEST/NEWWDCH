import { sanitizeArticleHtmlForPublishing } from '../src/lib/connection/site-publisher';
import { db } from '../src/lib/db';

async function main() {
  const item = await db.contentItem.findUnique({
    where: { id: 'cmuc02x0r004rk9tgstnztju9' },
    include: { featuredImage: true }
  });
  if (!item) return console.log('Item not found');

  const sanitized = sanitizeArticleHtmlForPublishing(item.content || '', item.title, item.featuredImage?.url);
  console.log('Sanitized length:', sanitized.length);
  console.log('Contains draggable:', sanitized.includes('draggable'));
  console.log('Contains base64:', sanitized.includes('base64'));
  console.log('Starts with:\n', sanitized.slice(0, 500));
}

main().catch(console.error);
