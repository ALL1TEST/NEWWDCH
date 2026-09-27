import { db } from '@/lib/db';
import { ok, fail } from '@/lib/platform/platform-auth';

// ============================================================
// GET /api/public/blog — PUBLIC editorial feed for the marketing
// site's Blog page.
// ============================================================
// Read-only, unauthenticated. Serves the platform's OWN published
// editorial content: ContentItems with a NULL siteId (platform-
// level articles, not any tenant's site data). Tenant site content
// is NEVER exposed here — the marketing blog only shows what the
// product team publishes in Karmax itself.
//
// Shape (ApiResponse envelope):
//   {
//     articles: Array<{
//       slug, title, excerpt, category: { name, slug } | null,
//       author: { name, avatar }, tags: [{ name, slug }],
//       publishedAt, updatedAt, readingMinutes,
//       image: { url, alt } | null
//     }>,
//     categories: Array<{ slug, name, description, count }>
//   }
//
// The list payload intentionally omits article HTML (the detail
// endpoint serves it) — the body is only read in-memory to derive
// each article's reading time.
// Search / filtering / progressive reveal happen client-side.
// ============================================================

const WORDS_PER_MINUTE = 200;

function readingMinutes(html: string | null | undefined): number {
  if (!html) return 1;
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&\w+;/g, ' ')
    .trim();
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export async function GET() {
  try {
    const rows = await db.contentItem.findMany({
      where: {
        status: 'PUBLISHED',
        siteId: null,
        deletedAt: null,
        contentType: { slug: 'post' },
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        author: { select: { name: true } },
        authorProfile: { select: { displayName: true, avatar: true } },
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true }, orderBy: { name: 'asc' } },
        featuredImage: { select: { url: true, alt: true } },
      },
    });

    const articles = rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt ?? '',
      category: r.category
        ? { name: r.category.name, slug: r.category.slug }
        : null,
      author: {
        name: r.authorProfile?.displayName ?? r.author?.name ?? 'Karmax Editorial',
        avatar: r.authorProfile?.avatar ?? null,
      },
      tags: r.tags,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
      // Derived from the body while the row is in memory — the HTML
      // itself never leaves the server (list payload stays light).
      readingMinutes: readingMinutes(r.content),
      image: r.featuredImage
        ? { url: r.featuredImage.url, alt: r.featuredImage.alt ?? r.title }
        : null,
    }));

    // Platform-level categories with their published-article counts
    // (for the hero pills and the "Explore by topic" cards).
    const cats = await db.category.findMany({
      where: { siteId: null },
      select: {
        slug: true,
        name: true,
        description: true,
        _count: {
          select: {
            content: {
              where: {
                status: 'PUBLISHED',
                siteId: null,
                deletedAt: null,
                contentType: { slug: 'post' },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const categories = cats.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description ?? '',
      count: c._count.content,
    }));

    return ok({ articles, categories });
  } catch {
    return fail('BLOG_UNAVAILABLE', 'The blog is temporarily unavailable', 503);
  }
}
