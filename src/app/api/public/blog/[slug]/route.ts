import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, fail } from '@/lib/platform/platform-auth';

// ============================================================
// GET /api/public/blog/[slug] — PUBLIC single article for the
// marketing site's editorial article page.
// ============================================================
// Read-only, unauthenticated. Same scoping rule as the list
// endpoint: platform-level (siteId NULL) published content only.
//
// Returns the full article (HTML body, SEO fields, author with
// profile + social links, tags) plus up to 3 related articles
// (same category first, then most recent others) with complete
// card data for the "Continue reading" rail.
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

type RouteContext = { params: Promise<{ slug: string }> };

const CARD_SELECT = {
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  publishedAt: true,
  author: { select: { name: true } },
  authorProfile: { select: { displayName: true, avatar: true } },
  category: { select: { name: true, slug: true } },
  featuredImage: { select: { url: true, alt: true } },
} as const;

type CardRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  publishedAt: Date | null;
  author: { name: string } | null;
  authorProfile: { displayName: string | null; avatar: string | null } | null;
  category: { name: string; slug: string } | null;
  featuredImage: { url: string; alt: string | null } | null;
};

function toCard(r: CardRow) {
  return {
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? '',
    category: r.category,
    author: {
      name: r.authorProfile?.displayName ?? r.author?.name ?? 'Karmax Editorial',
      avatar: r.authorProfile?.avatar ?? null,
    },
    publishedAt: r.publishedAt?.toISOString() ?? null,
    readingMinutes: readingMinutes(r.content),
    image: r.featuredImage
      ? { url: r.featuredImage.url, alt: r.featuredImage.alt ?? r.title }
      : null,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;

    const article = await db.contentItem.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        siteId: null,
        deletedAt: null,
        contentType: { slug: 'post' },
      },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        seoTitle: true,
        seoDescription: true,
        author: { select: { name: true, bio: true } },
        authorProfile: {
          select: {
            displayName: true,
            bio: true,
            avatar: true,
            twitter: true,
            github: true,
            linkedin: true,
            website: true,
          },
        },
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true }, orderBy: { name: 'asc' } },
        featuredImage: { select: { url: true, alt: true } },
      },
    });

    if (!article) {
      return fail('ARTICLE_NOT_FOUND', 'Article not found', 404);
    }

    // Related articles — same category first, then most recent
    // others (always excluding the current article), take 3.
    const related: CardRow[] = [];

    if (article.category) {
      const sameCat = await db.contentItem.findMany({
        where: {
          status: 'PUBLISHED',
          siteId: null,
          deletedAt: null,
          contentType: { slug: 'post' },
          slug: { not: article.slug },
          category: { slug: article.category.slug },
        },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        select: CARD_SELECT,
      });
      related.push(...sameCat);
    }

    if (related.length < 3) {
      const excludeSlugs = [article.slug, ...related.map((r) => r.slug)];
      const filler = await db.contentItem.findMany({
        where: {
          status: 'PUBLISHED',
          siteId: null,
          deletedAt: null,
          contentType: { slug: 'post' },
          slug: { notIn: excludeSlugs },
        },
        orderBy: { publishedAt: 'desc' },
        take: 3 - related.length,
        select: CARD_SELECT,
      });
      related.push(...filler);
    }

    return ok({
      article: {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt ?? '',
        html: article.content ?? '',
        publishedAt: article.publishedAt?.toISOString() ?? null,
        updatedAt: article.updatedAt.toISOString(),
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        author: {
          name:
            article.authorProfile?.displayName ??
            article.author?.name ??
            'Karmax Editorial',
          bio: article.authorProfile?.bio ?? article.author?.bio ?? null,
          avatar: article.authorProfile?.avatar ?? null,
          twitter: article.authorProfile?.twitter ?? null,
          github: article.authorProfile?.github ?? null,
          linkedin: article.authorProfile?.linkedin ?? null,
          website: article.authorProfile?.website ?? null,
        },
        category: article.category,
        tags: article.tags,
        readingMinutes: readingMinutes(article.content),
        image: article.featuredImage
          ? { url: article.featuredImage.url, alt: article.featuredImage.alt ?? article.title }
          : null,
      },
      related: related.map(toCard),
    });
  } catch {
    return fail('ARTICLE_UNAVAILABLE', 'Article is temporarily unavailable', 503);
  }
}
