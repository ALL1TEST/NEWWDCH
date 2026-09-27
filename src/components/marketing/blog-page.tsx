'use client';

// ============================================================
// BLOG — SaaS editorial publication
// ============================================================
// The public blog of the marketing site, served entirely from the
// platform's REAL editorial content (/api/public/blog — the
// ContentItems the team publishes inside Karmax itself).
//
// Blog homepage — clean and focused on article discovery:
//   featured article (image left, content right)
//   → "Latest articles" 3-col grid + Load more progressive reveal
//   → professional empty state when nothing is published yet
//
// Article page (#/blog/<slug>)
//   reading-progress bar + breadcrumb (Blog / title — no
//     category label anywhere in the hero)
//   → two-column editorial hero on a warm off-white band
//     (title/description/author LEFT, featured image RIGHT —
//     one H1; byline = round avatar + bold name + plain
//     "Updated …" secondary text, no icons)
//   → editorial intro (leading paragraphs + supporting visual)
//   → content (65%) + sticky TOC sidebar (35%, active-section
//     tracking like the legal pages) + sidebar CTA + tags
//   → compact newsletter CTA (text/form LEFT, illustration
//     RIGHT) → "Recent articles" editorial 3-column list
//     (title/author/read-time, thin divider, no image cards)
//   → per-article SEO: title/description/OG/canonical + JSON-LD
//     (Article, BreadcrumbList, Person, publisher Organization)
//
// Everything is data-driven: publish, unpublish, recategorize or
// re-author an article in the CMS and this page reflects it on
// the next load. Featured = most recent. No hardcoded articles.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { MarketingButton, Reveal } from './primitives';
import { MKT } from './marketing-header';
import { scrollToLegalId } from './legal-document';

// ============================================================
// Types — mirrors of the /api/public/blog payloads
// ============================================================

interface BlogAuthor {
  name: string;
  avatar: string | null;
}

interface BlogTag {
  name: string;
  slug: string;
}

interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: { name: string; slug: string } | null;
  author: BlogAuthor;
  tags: BlogTag[];
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
  image: { url: string; alt: string } | null;
}

interface ArticleDetailAuthor extends BlogAuthor {
  bio: string | null;
  twitter: string | null;
  github: string | null;
  linkedin: string | null;
  website: string | null;
}

interface ArticleDetail extends BlogArticle {
  html: string;
  seoTitle: string | null;
  seoDescription: string | null;
  author: ArticleDetailAuthor;
}

// ============================================================
// Shared helpers
// ============================================================

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Warm, brand-adjacent avatar tints (deterministic per name).
const AVATAR_TINTS = [
  'bg-mkt-accent-soft text-mkt-accent-soft-fg',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-stone-200 text-stone-700',
  'bg-orange-100 text-orange-800',
  'bg-lime-100 text-lime-800',
];

function avatarTint(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function AuthorAvatar({
  name,
  src,
  className = 'h-6 w-6',
  textClassName = 'text-[0.625rem]',
}: {
  name: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${className} ${textClassName} ${avatarTint(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Small uppercase category label used across cards. */
function CategoryLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-mkt-accent-soft-fg">
      {children}
    </span>
  );
}

/** Date · reading-time meta line. */
function ReadingMeta({
  article,
  className = '',
}: {
  article: BlogArticle;
  className?: string;
}) {
  const { t, locale } = useT();
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {article.publishedAt && (
        <>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDate(article.publishedAt, locale)}
          <span aria-hidden="true">·</span>
        </>
      )}
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {t('mkt.blog.readingTime').replace('{minutes}', String(article.readingMinutes))}
    </span>
  );
}

// ============================================================
// Newsletter — compact editorial CTA for the article page.
// Real /api/public/newsletter subscribe flow. Horizontal on
// desktop (~60% text+form / ~38% illustration, ≈240px tall);
// stacked text → form → image on mobile.
// ============================================================

function BlogNewsletter() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || state === 'sending') return;
    setState('sending');
    try {
      // Public marketing subscribe (works for anonymous visitors —
      // the CMS's /api/subscribers is authenticated staff-only).
      const res = await fetch('/api/public/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok && res.status !== 409) throw new Error('failed');
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-mkt-accent-border bg-mkt-accent-soft/35 shadow-[0_1px_2px_rgb(0_0_0/0.03),0_16px_40px_-28px_rgb(0_0_0/0.18)]">
      <div className="grid lg:grid-cols-[1.6fr_1fr]">
        {/* Text + form — compact, vertically centered */}
        <div className="flex flex-col justify-center px-6 py-7 sm:px-8 lg:px-10 lg:py-8">
          <h2 className="text-xl font-bold leading-snug tracking-tight text-text-primary sm:text-[1.3125rem]">
            {t('mkt.blog.newsletterTitle')}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            {t('mkt.blog.newsletterBody')}
          </p>
          {state === 'done' ? (
            <p
              className="mt-4 rounded-xl border border-mkt-accent-border bg-card px-4 py-2.5 text-sm font-medium text-mkt-accent-soft-fg"
              role="status"
            >
              {t('mkt.blog.newsletterSuccess')}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <label className="sr-only" htmlFor="blog-newsletter-email">
                {t('mkt.blog.newsletterPlaceholder')}
              </label>
              <input
                id="blog-newsletter-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('mkt.blog.newsletterPlaceholder')}
                className="mkt-focus h-10 flex-1 rounded-full border border-border bg-card px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="mkt-focus h-10 shrink-0 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-60"
              >
                {state === 'sending' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  t('mkt.blog.newsletterCta')
                )}
              </button>
            </form>
          )}
          {state === 'error' && (
            <p className="mt-2.5 text-xs text-destructive" role="alert">
              {t('mkt.blog.newsletterError')}
            </p>
          )}
        </div>
        {/* Branded editorial illustration — fills the right column
            on desktop, sits below the form on mobile. */}
        <figure className="relative min-h-[11rem] lg:min-h-0" aria-hidden="true">
          <img
            src="/uploads/blog/newsletter-illustration.png"
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </figure>
      </div>
    </div>
  );
}

// ============================================================
// Cards
// ============================================================

/** Standard grid card — image, category, title, excerpt, meta. */
function ArticleCard({ article }: { article: BlogArticle }) {
  const { t } = useT();
  return (
    <a
      href={`${MKT.blog}/${article.slug}`}
      className="mkt-focus group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-mkt-accent-border/70 hover:shadow-[0_14px_36px_-18px_oklch(0.205_0_0/18%)]"
    >
      <div className="aspect-[16/10] overflow-hidden bg-muted">
        {article.image ? (
          <img
            src={article.image.url}
            alt={article.image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="mkt-dotgrid h-full w-full" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        {article.category && <CategoryLabel>{article.category.name}</CategoryLabel>}
        <h3 className="text-[1.0625rem] font-bold leading-snug text-text-primary transition-colors duration-200 group-hover:text-mkt-accent">
          {article.title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-text-secondary">
          {article.excerpt}
        </p>
        <div className="mt-auto flex items-center gap-2.5 border-t border-border pt-3.5">
          <AuthorAvatar name={article.author.name} src={article.author.avatar} />
          <span className="truncate text-xs font-medium text-text-secondary">
            {article.author.name}
          </span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
            <ReadingMeta article={article} />
          </span>
        </div>
      </div>
    </a>
  );
}

/** Featured article — image left (~57%), editorial content right. */
function FeaturedCard({ article }: { article: BlogArticle }) {
  const { t } = useT();
  return (
    <a
      href={`${MKT.blog}/${article.slug}`}
      className="mkt-focus group grid overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_-20px_oklch(0.205_0_0/20%)] lg:grid-cols-[57%_43%]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto lg:min-h-[21rem]">
        {article.image ? (
          <img
            src={article.image.url}
            alt={article.image.alt}
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="mkt-dotgrid absolute inset-0" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-col justify-center gap-4 p-7 sm:p-9 lg:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-mkt-accent-soft px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-mkt-accent-soft-fg">
            {t('mkt.blog.featured')}
          </span>
          {article.category && <CategoryLabel>{article.category.name}</CategoryLabel>}
        </div>
        <h2 className="mkt-display text-2xl leading-[1.15] text-text-primary transition-colors duration-200 group-hover:text-mkt-accent sm:text-3xl lg:text-[2.125rem]">
          {article.title}
        </h2>
        <p className="line-clamp-3 text-[0.9375rem] leading-relaxed text-text-secondary">
          {article.excerpt}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-muted">
          <span className="inline-flex items-center gap-2">
            <AuthorAvatar name={article.author.name} src={article.author.avatar} className="h-7 w-7" textClassName="text-[0.6875rem]" />
            <span className="font-medium text-text-secondary">
              {t('mkt.blog.by')} {article.author.name}
            </span>
          </span>
          <ReadingMeta article={article} />
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-mkt-accent">
          {t('mkt.blog.readMore')}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </div>
    </a>
  );
}

/** Recent-articles list entry — editorial, text-only: strong
 *  title + compact author/read-time meta. No card chrome, no
 *  image (the "Recent articles" rail on the article page). */
function RecentArticleItem({ article }: { article: BlogArticle }) {
  return (
    <a
      href={`${MKT.blog}/${article.slug}`}
      className="mkt-focus group flex flex-col gap-3 border-t border-border pt-5"
    >
      <h3 className="text-[1.0625rem] font-bold leading-snug text-text-primary transition-colors duration-200 group-hover:text-mkt-accent">
        {article.title}
      </h3>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] text-text-muted">
        <span className="font-medium text-text-secondary">{article.author.name}</span>
        <span aria-hidden="true">·</span>
        <ReadingMeta article={article} />
      </span>
    </a>
  );
}

// ============================================================
// Loading skeletons
// ============================================================

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" aria-hidden="true">
      <div className="aspect-[16/10] animate-pulse bg-muted" />
      <div className="flex flex-col gap-3 p-5">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-5 w-full animate-pulse rounded bg-muted" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function BlogSkeleton() {
  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card" aria-hidden="true">
        <div className="grid lg:grid-cols-[57%_43%]">
          <div className="aspect-[16/10] animate-pulse bg-muted lg:aspect-auto lg:min-h-[21rem]" />
          <div className="flex flex-col justify-center gap-4 p-7 sm:p-9 lg:p-10">
            <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </>
  );
}

// ============================================================
// Blog list page
// ============================================================

const PAGE_SIZE = 6;

export function BlogPage() {
  const { t } = useT();
  const [articles, setArticles] = useState<BlogArticle[] | null>(null);
  const [error, setError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setArticles(null);
    try {
      const res = await fetch('/api/public/blog');
      if (!res.ok) throw new Error('blog failed');
      const json = (await res.json()) as {
        data?: { articles: BlogArticle[] };
      };
      setArticles(json.data?.articles ?? []);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Per-route meta description (complements the document title
  // managed by MarketingSite).
  useEffect(() => {
    const el = document.querySelector('meta[name="description"]');
    if (!el) return;
    const previous = el.getAttribute('content');
    el.setAttribute('content', t('mkt.blog.metaDescription'));
    return () => {
      if (previous !== null) el.setAttribute('content', previous);
    };
  }, [t]);

  // Featured = the most recent published article; the grid below
  // carries the rest.
  const featured = articles && articles.length > 0 ? articles[0] : null;

  const gridItems = useMemo(() => {
    if (!articles || articles.length === 0) return [];
    return articles.slice(1);
  }, [articles]);

  const shownGrid = gridItems.slice(0, visibleCount);
  const hasMore = gridItems.length > visibleCount;

  // ---- Actions ----
  const loadMore = () => {
    setLoadingMore(true);
    // Brief perceived-delay so the reveal reads as intentional.
    window.setTimeout(() => {
      setVisibleCount((n) => n + PAGE_SIZE);
      setLoadingMore(false);
    }, 280);
  };

  return (
    <div className="pb-24">
      {error ? (
        <div className="mkt-container flex flex-col items-center gap-4 pb-16 pt-32 text-center">
          <p className="text-sm text-text-secondary">{t('mkt.blog.error')}</p>
          <button
            onClick={load}
            className="mkt-focus inline-flex h-10 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-text-primary hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('mkt.pricing.retry')}
          </button>
        </div>
      ) : !articles ? (
        <div
          className="mkt-container pt-28 sm:pt-32"
          role="status"
          aria-label={t('mkt.blog.loading')}
        >
          <div className="flex flex-col gap-8">
            <BlogSkeleton />
          </div>
        </div>
      ) : articles.length === 0 ? (
        /* ---- Professional empty state — the page stays complete ---- */
        <div className="mkt-container pb-8 pt-28 sm:pt-32">
          <Reveal>
            <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center sm:py-20">
              <h1 className="mkt-h2 text-2xl text-text-primary sm:text-3xl">
                {t('mkt.blog.emptyTitle')}
              </h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-text-secondary">
                {t('mkt.blog.emptyBody')}
              </p>
              <div className="mt-8">
                <MarketingButton href={MKT.features}>
                  {t('mkt.blog.emptyCta')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </MarketingButton>
              </div>
            </div>
          </Reveal>
        </div>
      ) : (
        <div className="mkt-container flex flex-col gap-16 pt-28 sm:gap-20 sm:pt-32">
          {/* The page keeps a proper document outline without a
              visible marketing headline. */}
          <h1 className="sr-only">{t('mkt.blog.title')}</h1>

          {/* ---- Featured article ---- */}
          {featured && (
            <Reveal>
              <FeaturedCard article={featured} />
            </Reveal>
          )}

          {/* ---- Latest articles grid ---- */}
          {gridItems.length > 0 && (
            <section
              id="blog-latest"
              aria-labelledby="blog-latest-heading"
              className="scroll-mt-24"
            >
              <h2
                id="blog-latest-heading"
                className="mkt-h2 text-2xl text-text-primary sm:text-[1.75rem]"
              >
                {t('mkt.blog.latest')}
              </h2>

              <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {shownGrid.map((a, i) => (
                  <Reveal key={a.slug} delay={Math.min(i, 3) * 60} className="h-full">
                    <ArticleCard article={a} />
                  </Reveal>
                ))}
              </div>

              {hasMore && (
                <div className="mt-10 text-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="mkt-focus inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-7 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-mkt-accent-border hover:bg-muted disabled:opacity-60"
                  >
                    {loadingMore && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    )}
                    {t('mkt.blog.loadMore')}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Single article page
// ============================================================

interface TocEntry {
  id: string;
  label: string;
  level: 2 | 3;
}

/** Sticky TOC list (mirrors the legal-document pattern). */
function ArticleToc({
  toc,
  activeId,
  onNavigate,
}: {
  toc: TocEntry[];
  activeId: string | null;
  onNavigate: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col">
      {toc.map((item) => {
        const active = activeId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'location' : undefined}
              className={`mkt-focus flex w-full items-start gap-2.5 border-l-2 py-[0.3rem] pr-1 text-left text-[0.8125rem] leading-[1.4] transition-colors ${
                item.level === 3 ? 'pl-6' : 'pl-3'
              } ${
                active
                  ? 'border-mkt-accent font-medium text-mkt-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {item.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function BlogArticlePage({ slug }: { slug: string }) {
  const { t, locale } = useT();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [related, setRelated] = useState<BlogArticle[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'notfound'>('loading');

  // Reading progress + TOC active-section state
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // ---- Body HTML + TOC + editorial intro, derived together ----
  // Section ids are baked INTO the HTML string (DOMParser), so they
  // survive any React re-render of the dangerouslySetInnerHTML div
  // (progress/active-state updates re-render this page constantly —
  // mutating the live DOM after render would be wiped). The parsed
  // TOC comes from the same pass. The prop object is memoized so
  // React never re-sets the innerHTML during those re-renders.
  //
  // Editorial intro: the article's leading paragraphs (before the
  // first heading) are promoted into the two-column lead block, and
  // the first inline image becomes that block's supporting visual —
  // unless it merely repeats the hero cover, in which case it is
  // dropped from the flow so nothing renders twice and the cover
  // itself backs the intro visual.
  const { bodyHtml, toc, introHtml, introImage } = useMemo<{
    bodyHtml: { __html: string } | null;
    toc: TocEntry[];
    introHtml: string | null;
    introImage: { url: string; alt: string; caption: string | null } | null;
  }>(() => {
    if (!article?.html) {
      return { bodyHtml: null, toc: [], introHtml: null, introImage: null };
    }
    try {
      const doc = new DOMParser().parseFromString(
        `<div>${article.html}</div>`,
        'text/html',
      );
      const root = doc.body.firstElementChild;
      if (!root) {
        return {
          bodyHtml: { __html: article.html },
          toc: [],
          introHtml: null,
          introImage: null,
        };
      }
      const entries: TocEntry[] = [];
      root.querySelectorAll('h2, h3').forEach((h, i) => {
        if (!h.id) h.id = `article-sec-${i}`;
        const label = (h.textContent ?? '').trim();
        if (label) {
          entries.push({ id: h.id, label, level: h.tagName === 'H3' ? 3 : 2 });
        }
      });

      // Leading <p> elements (bounded) become the intro lead — but
      // only when the article still has content below them, so a
      // single-paragraph article stays a normal body.
      const children = Array.from(root.children);
      const lead: Element[] = [];
      for (const child of children) {
        if (child.tagName === 'P' && lead.length < 3) lead.push(child);
        else break;
      }
      const hasRest = children.length - lead.length > 0;

      let visual: { url: string; alt: string; caption: string | null } | null = null;
      let intro: string | null = null;

      if (lead.length > 0 && hasRest) {
        intro = lead.map((p) => p.outerHTML).join('');
        lead.forEach((p) => p.remove());

        // The first inline image is promoted out of the flow into
        // the intro visual slot — unless it just repeats the hero
        // cover, in which case it is removed so it never shows
        // twice on the page.
        const firstImg = root.querySelector('img');
        if (firstImg) {
          const src = firstImg.getAttribute('src') ?? '';
          if (src) {
            const normalize = (u: string) => u.split('#')[0].split('?')[0];
            const repeatsHero =
              !!article.image && normalize(article.image.url) === normalize(src);
            if (!repeatsHero) {
              const fig = firstImg.closest('figure');
              visual = {
                url: src,
                alt: firstImg.getAttribute('alt') ?? '',
                caption:
                  fig?.querySelector('figcaption')?.textContent?.trim() ?? null,
              };
            }
            (firstImg.closest('figure') ?? firstImg).remove();
          }
        }
        if (!visual && article.image) {
          visual = { url: article.image.url, alt: article.image.alt, caption: null };
        }
      }

      return {
        bodyHtml: { __html: root.innerHTML },
        toc: entries,
        introHtml: intro,
        introImage: visual,
      };
    } catch {
      return {
        bodyHtml: { __html: article.html },
        toc: [],
        introHtml: null,
        introImage: null,
      };
    }
  }, [article]);

  // ---- Fetch ----
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setProgress(0);
    (async () => {
      try {
        const res = await fetch(`/api/public/blog/${encodeURIComponent(slug)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setState('notfound');
          return;
        }
        if (!res.ok) throw new Error('failed');
        const json = (await res.json()) as {
          data?: { article: ArticleDetail; related: BlogArticle[] };
        };
        if (!json.data) throw new Error('no data');
        setArticle(json.data.article);
        setRelated(json.data.related ?? []);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ---- Per-article document title (overrides the route default) ----
  useEffect(() => {
    if (article) {
      document.title = `${article.seoTitle ?? article.title} — ${t('mkt.brand.name')}`;
    }
  }, [article, t]);

  // ---- SEO: description + Open Graph + canonical ----
  useEffect(() => {
    if (!article) return;
    const canonical = new URL(`/#/blog/${article.slug}`, window.location.origin).href;
    const description = article.seoDescription ?? article.excerpt;
    const ogImage = article.image
      ? new URL(article.image.url, window.location.origin).href
      : null;

    const created: Array<HTMLElement> = [];
    const upsertMeta = (selector: string, attr: string, key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute('content', value);
    };

    const descEl = document.querySelector('meta[name="description"]');
    const prevDesc = descEl?.getAttribute('content') ?? null;
    if (descEl) descEl.setAttribute('content', description);

    upsertMeta('meta[property="og:title"]', 'property', 'og:title', article.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'article');
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    if (ogImage) upsertMeta('meta[property="og:image"]', 'property', 'og:image', ogImage);

    let canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const prevCanonical = canonicalEl?.getAttribute('href') ?? null;
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
      created.push(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonical);

    return () => {
      if (descEl && prevDesc !== null) descEl.setAttribute('content', prevDesc);
      for (const el of created) el.remove();
      if (canonicalEl && prevCanonical !== null) canonicalEl.setAttribute('href', prevCanonical);
    };
  }, [article]);

  // ---- SEO: JSON-LD structured data (Article + BreadcrumbList +
  //      Person author + publisher Organization) ----
  useEffect(() => {
    if (!article) return;
    const canonical = new URL(`/#/blog/${article.slug}`, window.location.origin).href;
    const graph: Record<string, unknown>[] = [
      {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: article.title,
        description: article.seoDescription ?? article.excerpt,
        image: article.image
          ? [new URL(article.image.url, window.location.origin).href]
          : undefined,
        datePublished: article.publishedAt ?? undefined,
        dateModified: article.updatedAt,
        author: {
          '@type': 'Person',
          '@id': `${new URL('/', window.location.origin).href}#/blog/author/${article.author.name
            .toLowerCase()
            .replace(/\s+/g, '-')}#person`,
          name: article.author.name,
          url: article.author.website ?? undefined,
        },
        publisher: {
          '@type': 'Organization',
          name: t('mkt.brand.name'),
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: t('mkt.blog.title'),
            item: new URL(`/#/blog`, window.location.origin).href,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: article.title,
          },
        ],
      },
    ];

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.blogArticleLd = 'true';
    script.text = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [article, t]);

  // ---- TOC extraction is handled in the bodyHtml/toc memo above
  //      (ids are baked into the rendered HTML string). ----

  // ---- Reading progress + active heading tracking ----
  useEffect(() => {
    if (state !== 'ready') return;
    const root = document.querySelector('.mkt-scroll-root');
    if (!root) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      // Progress
      const total = root.scrollHeight - root.clientHeight;
      setProgress(total > 0 ? Math.min(1, Math.max(0, root.scrollTop / total)) : 0);
      // Active section — the first entry stays active while the
      // reader is still in the article header/intro (same
      // convention as the legal pages' topId).
      const threshold = 150;
      let current: string | null = toc[0]?.id ?? null;
      for (const entry of toc) {
        const el = document.getElementById(entry.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold) current = entry.id;
        else break;
      }
      const atBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 8;
      if (atBottom && toc.length > 0) current = toc[toc.length - 1].id;
      setActiveId((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [state, toc]);

  // ---- Early states ----
  if (state === 'loading') {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-2.5 pt-24 text-sm text-text-muted"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('mkt.blog.loading')}
      </div>
    );
  }

  if (state === 'error' || state === 'notfound' || !article) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 pt-24 text-center">
        <h1 className="text-2xl font-bold text-text-primary">
          {state === 'notfound' ? t('mkt.common.notFoundTitle') : t('mkt.common.errorTitle')}
        </h1>
        <p className="max-w-sm text-sm text-text-secondary">{t('mkt.common.notFoundBody')}</p>
        <MarketingButton href={MKT.blog} variant="secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('mkt.blog.backToBlog')}
        </MarketingButton>
      </div>
    );
  }

  const navigateToc = (id: string) => {
    // On mobile the collapsible TOC sits above the content —
    // collapse it first so the smooth scroll measures the final
    // layout (same pattern as the legal pages).
    if (tocOpen) {
      setTocOpen(false);
      window.setTimeout(() => scrollToLegalId(id), 230);
    } else {
      scrollToLegalId(id);
    }
  };

  const significantUpdate =
    article.publishedAt &&
    new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() >
      24 * 3600 * 1000;

  return (
    <article className="pb-24">
      {/* Reading progress bar — above everything, accent-colored */}
      <div
        className="fixed inset-x-0 top-0 z-[80] h-[3px] origin-left bg-mkt-accent"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />

      {/* ============ Article hero — editorial two-column on a warm
                        off-white band: text LEFT, image RIGHT ============ */}
      <header className="border-b border-border/70 bg-mkt-surface-2">
        <div className="pb-12 pt-28 sm:pb-14 sm:pt-32">
          <div className="mkt-container max-w-6xl">
            {/* Breadcrumb — Blog / title. The category appears only
                as the small label above the headline (never as a
                duplicated metadata item). */}
            <nav aria-label={t('mkt.blog.breadcrumb')} className="text-sm">
              <ol className="flex flex-wrap items-center gap-1.5 text-text-muted">
                <li>
                  <a
                    href={MKT.blog}
                    className="mkt-focus font-medium transition-colors hover:text-text-primary"
                  >
                    {t('mkt.blog.title')}
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                <li className="max-w-[16rem] truncate" aria-current="page">
                  {article.title}
                </li>
              </ol>
            </nav>

            <div className="mt-8 grid items-center gap-10 lg:mt-10 lg:grid-cols-2 lg:gap-14">
              {/* Left — title, description, author. No category
                  label here (CMS data untouched): the headline starts
                  directly under the breadcrumb spacing. */}
              <div>
                <h1 className="mkt-display text-[1.875rem] leading-[1.12] text-text-primary sm:text-[2.375rem]">
                  {article.title}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
                  {article.excerpt}
                </p>
                {/* Byline — round avatar + bold name, with the
                    last-updated date as plain secondary text below
                    (no icons, no date / read-time clutter). */}
                <div className="mt-7 flex items-center gap-3">
                  <AuthorAvatar
                    name={article.author.name}
                    src={article.author.avatar}
                    className="h-10 w-10 ring-1 ring-border"
                    textClassName="text-xs"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary">
                      {t('mkt.blog.by')} {article.author.name}
                    </p>
                    {significantUpdate && (
                      <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-text-muted">
                        {t('mkt.blog.updated')} {formatDate(article.updatedAt, locale)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right — large featured image, aligned with the text */}
              {article.image && (
                <figure>
                  <img
                    src={article.image.url}
                    alt={article.image.alt}
                    loading="eager"
                    decoding="async"
                    className="aspect-[4/3] w-full rounded-2xl border border-border object-cover shadow-[0_2px_6px_rgb(0_0_0/0.04),0_24px_60px_-28px_rgb(0_0_0/0.22)]"
                  />
                </figure>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ============ Editorial intro — opening text LEFT,
                        supporting visual RIGHT ============ */}
      {introHtml && (
        <div className="mt-14 sm:mt-16 lg:mt-20">
          <div className="mkt-container max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
              <div
                className="mkt-intro-lead"
                // Intro HTML is the article's own leading paragraphs
                // (curated CMS content — no public input).
                dangerouslySetInnerHTML={{ __html: introHtml }}
              />
              {introImage && (
                <figure>
                  <div className="rounded-2xl border border-border bg-card p-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-24px_rgb(0_0_0/0.18)]">
                    <img
                      src={introImage.url}
                      alt={introImage.alt}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[5/4] w-full rounded-xl object-cover"
                    />
                  </div>
                  {introImage.caption && (
                    <figcaption className="mt-3 text-center text-xs leading-relaxed text-text-muted">
                      {introImage.caption}
                    </figcaption>
                  )}
                </figure>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ Body + sidebar ============ */}
      <div className="mkt-container mt-14 max-w-6xl sm:mt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:gap-14">
          {/* ---- Main column ---- */}
          <div>
            {/* Mobile / tablet — collapsible "On this page" */}
            {toc.length > 0 && (
              <div className="mb-10 lg:hidden">
                <div className="rounded-2xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setTocOpen((v) => !v)}
                    aria-expanded={tocOpen}
                    className="mkt-focus flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left"
                  >
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-text-muted">
                      {t('mkt.blog.toc')}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${
                        tocOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                      tocOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden" inert={!tocOpen}>
                      <div className="max-h-80 overflow-y-auto px-5 pb-4 pt-1">
                        <ArticleToc toc={toc} activeId={activeId} onNavigate={navigateToc} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* The article body — CMS-generated HTML (ids baked in
                by the bodyHtml memo; the prop object is stable so
                scroll-driven re-renders never re-set it) */}
            <div
              ref={bodyRef}
              className="mkt-prose mkt-article-body mx-auto max-w-[46rem]"
              // Article HTML is authored in the product's own Tiptap
              // editor + curated seed content (no public input).
              dangerouslySetInnerHTML={bodyHtml ?? undefined}
            />

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="mx-auto mt-10 flex max-w-[46rem] flex-wrap items-center gap-2">
                {article.tags.map((tg) => (
                  <span
                    key={tg.slug}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-text-secondary"
                  >
                    #{tg.name}
                  </span>
                ))}
              </div>
            )}

            {/* The author is presented only in the hero byline —
                no duplicated author card below the content. The
                author data itself stays intact in the CMS. */}
          </div>

          {/* ---- Desktop sticky sidebar ---- */}
          <aside className="hidden lg:block">
            <div className="sticky top-25 flex max-h-[calc(100vh-9.5rem)] flex-col gap-6 overflow-y-auto">
              {toc.length > 0 && (
                <nav
                  aria-label={t('mkt.blog.toc')}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-text-muted">
                    {t('mkt.blog.toc')}
                  </p>
                  <div className="mt-3">
                    <ArticleToc toc={toc} activeId={activeId} onNavigate={navigateToc} />
                  </div>
                </nav>
              )}

              {/* Sidebar CTA */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-bold text-text-primary">
                  {t('mkt.blog.sidebarCtaTitle')}
                </p>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-text-secondary">
                  {t('mkt.blog.sidebarCtaBody')}
                </p>
                <div className="mt-4">
                  <MarketingButton href={MKT.signup} className="w-full !px-4">
                    {t('mkt.blog.sidebarCtaButton')}
                  </MarketingButton>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ============ Newsletter CTA — compact editorial band
                        (text + form LEFT, illustration RIGHT) ============ */}
      <section className="mt-16 sm:mt-20">
        <div className="mx-auto w-full max-w-[1064px] px-5 sm:px-8 lg:px-10">
          <Reveal>
            <BlogNewsletter />
          </Reveal>
        </div>
      </section>

      {/* ============ Recent articles — editorial 3-column list
                        (thin divider above, no image cards) ============ */}
      {related.length > 0 && (
        <section className="mt-16 border-t border-border sm:mt-20" aria-labelledby="blog-related-heading">
          <div className="mkt-container max-w-6xl pt-10 sm:pt-12">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="blog-related-heading"
                className="text-sm font-bold uppercase tracking-[0.14em] text-text-primary"
              >
                {t('mkt.blog.recent')}
              </h2>
              <a
                href={MKT.blog}
                className="mkt-focus group inline-flex items-center gap-1.5 text-sm font-semibold text-mkt-accent transition-colors hover:text-mkt-accent-strong"
              >
                {t('mkt.blog.viewAll')}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </a>
            </div>
            <div className="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
              {related.map((a, i) => (
                <Reveal key={a.slug} delay={i * 60}>
                  <RecentArticleItem article={a} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
