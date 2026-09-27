'use client';

// ============================================================
// BLOG — SaaS editorial publication
// ============================================================
// The public blog of the marketing site, served entirely from the
// platform's REAL editorial content (/api/public/blog — the
// ContentItems the team publishes inside Karmax itself).
//
// Blog homepage
//   compact editorial hero (eyebrow + title + search)
//   → horizontally-scrollable category pills
//   → featured article (image left, content right)
//   → "Latest articles" 3-col grid + Load more progressive reveal
//   → "Editor's picks" (1 large + 2 small — tag 'editors-choice',
//     controlled from the CMS)
//   → "Explore by topic" category cards (live article counts)
//   → newsletter CTA (real /api/subscribers flow)
//   → professional empty state when nothing is published yet
//
// Article page (#/blog/<slug>)
//   reading-progress bar + breadcrumb + centered editorial header
//   → featured image → content (65%) + sticky TOC sidebar (35%,
//     active-section tracking like the legal pages) + sidebar CTA
//   → tags → author card (social links when present)
//   → "Continue reading" (3 related) → newsletter
//   → per-article SEO: title/description/OG/canonical + JSON-LD
//     (Article, BreadcrumbList, Person, publisher Organization)
//
// Everything is data-driven: publish, unpublish, recategorize or
// re-author an article in the CMS and this page reflects it on
// the next load. Featured = most recent; picks = the
// 'editors-choice' tag. No hardcoded articles.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Github,
  Globe,
  Linkedin,
  Loader2,
  RefreshCw,
  Search,
  Twitter,
  X,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Eyebrow, MarketingButton, Reveal } from './primitives';
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

interface BlogCategory {
  slug: string;
  name: string;
  description: string;
  count: number;
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
// Newsletter — real /api/subscribers flow
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
    <div className="relative overflow-hidden rounded-3xl border border-mkt-accent-border bg-mkt-accent-soft/40">
      <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <h2 className="mkt-display text-3xl text-text-primary sm:text-4xl">
            {t('mkt.blog.newsletterTitle')}
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-text-secondary">
            {t('mkt.blog.newsletterBody')}
          </p>
          {state === 'done' ? (
            <p
              className="mt-7 rounded-xl border border-mkt-accent-border bg-card px-4 py-3 text-sm font-medium text-mkt-accent-soft-fg"
              role="status"
            >
              {t('mkt.blog.newsletterSuccess')}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-7 flex flex-col gap-2.5 sm:flex-row">
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
                className="mkt-focus h-11 flex-1 rounded-full border border-border bg-card px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="mkt-focus h-11 shrink-0 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-60"
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
            <p className="mt-3 text-xs text-destructive" role="alert">
              {t('mkt.blog.newsletterError')}
            </p>
          )}
        </div>
        {/* Branded editorial illustration (static marketing asset). */}
        <figure className="mx-auto hidden w-full max-w-sm sm:block lg:max-w-none">
          <img
            src="/uploads/blog/newsletter-illustration.png"
            alt="Illustration of a newsletter envelope surrounded by floating article cards"
            loading="lazy"
            decoding="async"
            className="w-full"
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

/** Editor's pick — the large left card. */
function PickCardLarge({ article }: { article: BlogArticle }) {
  return (
    <a
      href={`${MKT.blog}/${article.slug}`}
      className="mkt-focus group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_36px_-18px_oklch(0.205_0_0/18%)]"
    >
      <div className="aspect-[16/9] overflow-hidden bg-muted">
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
      <div className="flex flex-1 flex-col gap-2.5 p-6 sm:p-7">
        {article.category && <CategoryLabel>{article.category.name}</CategoryLabel>}
        <h3 className="text-xl font-bold leading-snug text-text-primary transition-colors duration-200 group-hover:text-mkt-accent sm:text-2xl">
          {article.title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-text-secondary">
          {article.excerpt}
        </p>
        <div className="mt-auto flex items-center gap-2.5 pt-2">
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

/** Editor's pick — the small horizontal cards on the right. */
function PickCardSmall({ article }: { article: BlogArticle }) {
  return (
    <a
      href={`${MKT.blog}/${article.slug}`}
      className="mkt-focus group flex flex-1 gap-4 overflow-hidden rounded-2xl border border-border bg-card p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-mkt-accent-border/70 hover:shadow-[0_10px_28px_-16px_oklch(0.205_0_0/16%)]"
    >
      <div className="aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-36">
        {article.image ? (
          <img
            src={article.image.url}
            alt={article.image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="mkt-dotgrid h-full w-full" aria-hidden="true" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1 pr-1">
        {article.category && <CategoryLabel>{article.category.name}</CategoryLabel>}
        <h3 className="line-clamp-2 text-[0.9375rem] font-bold leading-snug text-text-primary transition-colors duration-200 group-hover:text-mkt-accent">
          {article.title}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <ReadingMeta article={article} />
        </span>
      </div>
    </a>
  );
}

/** Topic discovery card — name, description, live count, arrow. */
function TopicCard({
  category,
  onNavigate,
}: {
  category: BlogCategory;
  onNavigate: (slug: string) => void;
}) {
  const { t } = useT();
  const countLabel =
    category.count === 1
      ? t('mkt.blog.articleCountOne').replace('{count}', '1')
      : t('mkt.blog.articleCount').replace('{count}', String(category.count));
  return (
    <button
      type="button"
      onClick={() => onNavigate(category.slug)}
      className="mkt-focus group flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-mkt-accent-border hover:bg-mkt-accent-soft/25"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-bold text-text-primary">{category.name}</span>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-text-muted transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-mkt-accent"
          aria-hidden="true"
        />
      </span>
      {category.description && (
        <span className="line-clamp-2 text-[0.8125rem] leading-relaxed text-text-secondary">
          {category.description}
        </span>
      )}
      <span className="mt-auto pt-1 text-xs font-medium text-text-muted">{countLabel}</span>
    </button>
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
const EDITORS_CHOICE_TAG = 'editors-choice';

export function BlogPage() {
  const { t } = useT();
  const [articles, setArticles] = useState<BlogArticle[] | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [error, setError] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setArticles(null);
    try {
      const res = await fetch('/api/public/blog');
      if (!res.ok) throw new Error('blog failed');
      const json = (await res.json()) as {
        data?: { articles: BlogArticle[]; categories: BlogCategory[] };
      };
      setArticles(json.data?.articles ?? []);
      setCategories(json.data?.categories ?? []);
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

  // ---- Derived collections ----
  const trimmedQuery = query.trim().toLowerCase();

  const searched = useMemo(() => {
    if (!articles || !trimmedQuery) return articles;
    return articles.filter((a) =>
      [
        a.title,
        a.excerpt,
        a.author.name,
        a.category?.name ?? '',
        ...a.tags.map((tg) => tg.name),
      ]
        .join(' ')
        .toLowerCase()
        .includes(trimmedQuery),
    );
  }, [articles, trimmedQuery]);

  const filtered = useMemo(
    () => (activeCat ? searched?.filter((a) => a.category?.slug === activeCat) : searched),
    [searched, activeCat],
  );

  const isFiltering = Boolean(trimmedQuery || activeCat);

  // Featured = the most recent article (unfiltered view only).
  const featured = !isFiltering && filtered && filtered.length > 0 ? filtered[0] : null;

  const gridItems = useMemo(() => {
    if (!filtered) return [];
    return featured ? filtered.slice(1) : filtered;
  }, [filtered, featured]);

  // Editor's picks = 'editors-choice' tag (CMS-controlled), filled
  // with the most recent non-featured articles when fewer than 3.
  const picks = useMemo(() => {
    if (!filtered || isFiltering) return [];
    const pool = featured ? filtered.slice(1) : filtered;
    const chosen = pool.filter((a) => a.tags.some((tg) => tg.slug === EDITORS_CHOICE_TAG));
    const rest = pool.filter((a) => !chosen.includes(a));
    return [...chosen, ...rest].slice(0, 3);
  }, [filtered, isFiltering, featured]);

  const shownGrid = gridItems.slice(0, visibleCount);
  const hasMore = gridItems.length > visibleCount;

  // Categories that actually have published articles.
  const liveCategories = useMemo(
    () => categories.filter((c) => c.count > 0),
    [categories],
  );

  const activeCatName = activeCat
    ? (categories.find((c) => c.slug === activeCat)?.name ?? activeCat)
    : null;

  // ---- Actions ----
  const selectCategory = (slug: string | null) => {
    setActiveCat(slug);
    setVisibleCount(PAGE_SIZE);
  };

  const navigateToTopic = (slug: string) => {
    setQuery('');
    selectCategory(slug);
    // Filtering unmounts the featured + picks sections, which
    // shrinks the page — wait for the layout to settle, then bring
    // the results grid just under the sticky header.
    window.setTimeout(() => {
      const target = document.getElementById('blog-latest');
      const root = document.querySelector('.mkt-scroll-root');
      if (!target || !root) return;
      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const y = root.scrollTop + target.getBoundingClientRect().top - 108;
      root.scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
    }, 140);
  };

  const loadMore = () => {
    setLoadingMore(true);
    // Brief perceived-delay so the reveal reads as intentional.
    window.setTimeout(() => {
      setVisibleCount((n) => n + PAGE_SIZE);
      setLoadingMore(false);
    }, 280);
  };

  const resultsTitle = trimmedQuery
    ? t('mkt.blog.resultsFor').replace('{query}', query.trim())
    : activeCatName ?? t('mkt.blog.latest');

  return (
    <div className="pb-24">
      {/* ============ Compact editorial hero ============ */}
      <section className="relative overflow-hidden pt-28 sm:pt-32">
        <div className="mkt-dotgrid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="mkt-container relative">
          <Reveal>
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <Eyebrow>{t('mkt.blog.eyebrow')}</Eyebrow>
                <h1 className="mkt-display mt-4 text-4xl text-text-primary sm:text-5xl">
                  {t('mkt.blog.heroTitle')}
                </h1>
                <p className="mt-4 text-base leading-relaxed text-text-secondary sm:text-lg">
                  {t('mkt.blog.heroSubtitle')}
                </p>
              </div>

              {/* Search — icon + collapsed label, expanding placeholder */}
              <div className="w-full lg:mb-1 lg:w-[21rem] lg:shrink-0">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                    aria-hidden="true"
                  />
                  <label className="sr-only" htmlFor="blog-search">
                    {t('mkt.blog.searchLabel')}
                  </label>
                  <input
                    id="blog-search"
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder={
                      searchFocused
                        ? t('mkt.blog.searchPlaceholder')
                        : t('mkt.blog.searchLabel')
                    }
                    className="mkt-focus h-11 w-full rounded-full border border-border bg-card pl-11 pr-10 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:border-mkt-accent-border focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label={t('mkt.blog.clearSearch')}
                      className="mkt-focus absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Category pills — horizontally scrollable on mobile */}
          {liveCategories.length > 0 && (
            <Reveal delay={80}>
              <div
                role="tablist"
                aria-label={t('mkt.blog.categories')}
                className="mt-9 -mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
              >
                <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                  <button
                    role="tab"
                    aria-selected={activeCat === null}
                    onClick={() => selectCategory(null)}
                    className={`mkt-focus h-9 shrink-0 rounded-full border px-4 text-xs font-medium transition-colors duration-200 ${
                      activeCat === null
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-text-secondary hover:border-mkt-accent-border hover:text-text-primary'
                    }`}
                  >
                    {t('mkt.blog.all')}
                  </button>
                  {liveCategories.map((c) => (
                    <button
                      key={c.slug}
                      role="tab"
                      aria-selected={activeCat === c.slug}
                      onClick={() => selectCategory(activeCat === c.slug ? null : c.slug)}
                      className={`mkt-focus h-9 shrink-0 rounded-full border px-4 text-xs font-medium transition-colors duration-200 ${
                        activeCat === c.slug
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-text-secondary hover:border-mkt-accent-border hover:text-text-primary'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ============ Content ============ */}
      <div className="mkt-container mt-12 flex flex-col gap-20 sm:mt-14">
        {error ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
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
          <div className="flex flex-col gap-8" role="status" aria-label={t('mkt.blog.loading')}>
            <BlogSkeleton />
          </div>
        ) : articles.length === 0 ? (
          /* ---- Professional empty state — the page stays complete ---- */
          <Reveal>
            <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center sm:py-20">
              <h2 className="mkt-h2 text-2xl text-text-primary sm:text-3xl">
                {t('mkt.blog.emptyTitle')}
              </h2>
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
        ) : (
          <>
            {/* ---- Featured article ---- */}
            {featured && (
              <Reveal>
                <FeaturedCard article={featured} />
              </Reveal>
            )}

            {/* ---- Latest articles grid ---- */}
            {gridItems.length > 0 && (
              <section id="blog-latest" aria-labelledby="blog-latest-heading" className="scroll-mt-24">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="blog-latest-heading"
                    className="mkt-h2 text-2xl text-text-primary sm:text-[1.75rem]"
                  >
                    {resultsTitle}
                    {isFiltering && filtered && (
                      <span className="ml-3 align-middle text-sm font-normal text-text-muted">
                        {filtered.length === 1
                          ? t('mkt.blog.articleCountOne').replace('{count}', '1')
                          : t('mkt.blog.articleCount').replace(
                              '{count}',
                              String(filtered.length),
                            )}
                      </span>
                    )}
                  </h2>
                  {(isFiltering || hasMore) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isFiltering) {
                          setQuery('');
                          selectCategory(null);
                        } else {
                          setVisibleCount(gridItems.length);
                        }
                      }}
                      className="mkt-focus group inline-flex items-center gap-1.5 text-sm font-semibold text-mkt-accent transition-colors hover:text-mkt-accent-strong"
                    >
                      {isFiltering ? t('mkt.blog.viewAll') : t('mkt.blog.viewAll')}
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>

                <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {shownGrid.map((a, i) => (
                    <Reveal key={a.slug} delay={Math.min(i, 3) * 60} className="h-full">
                      <ArticleCard article={a} />
                    </Reveal>
                  ))}
                </div>

                {/* No-results (with a filter active) */}
                {shownGrid.length === 0 && (
                  <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
                    <h3 className="text-lg font-bold text-text-primary">
                      {t('mkt.blog.noResultsTitle')}
                    </h3>
                    <p className="mt-2 text-sm text-text-secondary">
                      {t('mkt.blog.noResultsBody')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        selectCategory(null);
                      }}
                      className="mkt-focus mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-text-primary hover:bg-muted"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      {t('mkt.blog.clearSearch')}
                    </button>
                  </div>
                )}

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

            {/* ---- Editor's picks — 1 large + 2 small ---- */}
            {picks.length >= 2 && (
              <section aria-labelledby="blog-picks-heading">
                <h2
                  id="blog-picks-heading"
                  className="mkt-h2 text-2xl text-text-primary sm:text-[1.75rem]"
                >
                  {t('mkt.blog.editorsPicks')}
                </h2>
                <div className="mt-7 grid gap-6 lg:grid-cols-2">
                  <Reveal className="h-full">
                    <PickCardLarge article={picks[0]} />
                  </Reveal>
                  <div className="flex flex-col gap-6">
                    {picks.slice(1).map((a, i) => (
                      <Reveal key={a.slug} delay={60 + i * 60} className="flex-1">
                        <PickCardSmall article={a} />
                      </Reveal>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ---- Explore by topic (also enriches the empty state) ---- */}
        {liveCategories.length > 0 && (
          <section aria-labelledby="blog-topics-heading">
            <h2
              id="blog-topics-heading"
              className="mkt-h2 text-2xl text-text-primary sm:text-[1.75rem]"
            >
              {t('mkt.blog.exploreTopics')}
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {liveCategories.map((c, i) => (
                <Reveal key={c.slug} delay={Math.min(i, 4) * 40} className="h-full">
                  <TopicCard category={c} onNavigate={navigateToTopic} />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ============ Newsletter ============ */}
      <section className="mt-20 sm:mt-24">
        <div className="mkt-container">
          <Reveal>
            <BlogNewsletter />
          </Reveal>
        </div>
      </section>
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

function socialHref(kind: 'twitter' | 'github' | 'linkedin', handle: string): string {
  const clean = handle.replace(/^@/, '');
  switch (kind) {
    case 'twitter':
      return `https://twitter.com/${clean}`;
    case 'github':
      return `https://github.com/${clean}`;
    default:
      return `https://www.linkedin.com/in/${clean}`;
  }
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

  // ---- Body HTML + TOC, derived together ----
  // Section ids are baked INTO the HTML string (DOMParser), so they
  // survive any React re-render of the dangerouslySetInnerHTML div
  // (progress/active-state updates re-render this page constantly —
  // mutating the live DOM after render would be wiped). The parsed
  // TOC comes from the same pass. The prop object is memoized so
  // React never re-sets the innerHTML during those re-renders.
  const { bodyHtml, toc } = useMemo<{
    bodyHtml: { __html: string } | null;
    toc: TocEntry[];
  }>(() => {
    if (!article?.html) return { bodyHtml: null, toc: [] };
    try {
      const doc = new DOMParser().parseFromString(
        `<div>${article.html}</div>`,
        'text/html',
      );
      const root = doc.body.firstElementChild;
      if (!root) return { bodyHtml: { __html: article.html }, toc: [] };
      const entries: TocEntry[] = [];
      root.querySelectorAll('h2, h3').forEach((h, i) => {
        if (!h.id) h.id = `article-sec-${i}`;
        const label = (h.textContent ?? '').trim();
        if (label) {
          entries.push({ id: h.id, label, level: h.tagName === 'H3' ? 3 : 2 });
        }
      });
      return { bodyHtml: { __html: root.innerHTML }, toc: entries };
    } catch {
      return { bodyHtml: { __html: article.html }, toc: [] };
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
          ...(article.category
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: article.category.name,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: article.title,
                },
              ]
            : [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: article.title,
                },
              ]),
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

  const socials = (
    [
      article.author.twitter && {
        kind: 'twitter' as const,
        href: socialHref('twitter', article.author.twitter),
        label: 'Twitter / X',
      },
      article.author.linkedin && {
        kind: 'linkedin' as const,
        href: socialHref('linkedin', article.author.linkedin),
        label: 'LinkedIn',
      },
      article.author.github && {
        kind: 'github' as const,
        href: socialHref('github', article.author.github),
        label: 'GitHub',
      },
      article.author.website && {
        kind: 'website' as const,
        href: article.author.website,
        label: 'Website',
      },
    ] as const
  ).filter(Boolean);

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

      {/* ============ Article header ============ */}
      <header className="pt-28 sm:pt-32">
        <div className="mkt-container max-w-4xl">
          {/* Breadcrumb */}
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
              {article.category ? (
                <>
                  <li>
                    <a
                      href={MKT.blog}
                      className="mkt-focus font-medium transition-colors hover:text-text-primary"
                    >
                      {article.category.name}
                    </a>
                  </li>
                  <li aria-hidden="true">/</li>
                </>
              ) : null}
              <li className="max-w-[16rem] truncate" aria-current="page">
                {article.title}
              </li>
            </ol>
          </nav>

          <div className="mx-auto mt-8 max-w-3xl text-center">
            {article.category && (
              <a
                href={MKT.blog}
                className="mkt-focus inline-block rounded-full bg-mkt-accent-soft px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-mkt-accent-soft-fg transition-opacity hover:opacity-80"
              >
                {article.category.name}
              </a>
            )}
            <h1 className="mkt-display mt-5 text-3xl text-text-primary sm:text-[2.75rem] sm:leading-[1.12]">
              {article.title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
              {article.excerpt}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-text-muted">
              <span className="inline-flex items-center gap-2">
                <AuthorAvatar
                  name={article.author.name}
                  src={article.author.avatar}
                  className="h-8 w-8"
                  textClassName="text-xs"
                />
                <span className="font-medium text-text-secondary">
                  {t('mkt.blog.by')} {article.author.name}
                </span>
              </span>
              <ReadingMeta article={article} />
              {significantUpdate && (
                <span className="inline-flex items-center gap-1.5">
                  {t('mkt.blog.updated')} {formatDate(article.updatedAt, locale)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ============ Featured image ============ */}
      {article.image && (
        <div className="mkt-container mt-10 max-w-5xl">
          <figure>
            <img
              src={article.image.url}
              alt={article.image.alt}
              loading="eager"
              decoding="async"
              className="aspect-[16/9] w-full rounded-2xl border border-border object-cover"
            />
          </figure>
        </div>
      )}

      {/* ============ Body + sidebar ============ */}
      <div className="mkt-container mt-12 max-w-6xl sm:mt-14">
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

            {/* About the author */}
            <div className="mx-auto mt-12 max-w-[46rem]">
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-text-muted">
                  {t('mkt.blog.aboutAuthor')}
                </p>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <AuthorAvatar
                    name={article.author.name}
                    src={article.author.avatar}
                    className="h-14 w-14"
                    textClassName="text-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-text-primary">
                      {article.author.name}
                    </p>
                    {article.author.bio && (
                      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                        {article.author.bio}
                      </p>
                    )}
                    {socials.length > 0 && (
                      <div className="mt-4 flex items-center gap-2">
                        {socials.map((s) => (
                          <a
                            key={s.kind}
                            href={s.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={s.label}
                            className="mkt-focus flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-mkt-accent-border hover:bg-mkt-accent-soft/40 hover:text-mkt-accent-soft-fg"
                          >
                            {s.kind === 'twitter' && (
                              <Twitter className="h-4 w-4" aria-hidden="true" />
                            )}
                            {s.kind === 'linkedin' && (
                              <Linkedin className="h-4 w-4" aria-hidden="true" />
                            )}
                            {s.kind === 'github' && (
                              <Github className="h-4 w-4" aria-hidden="true" />
                            )}
                            {s.kind === 'website' && (
                              <Globe className="h-4 w-4" aria-hidden="true" />
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
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

      {/* ============ Continue reading ============ */}
      {related.length > 0 && (
        <section className="mt-20 sm:mt-24" aria-labelledby="blog-related-heading">
          <div className="mkt-container max-w-6xl">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="blog-related-heading"
                className="mkt-h2 text-2xl text-text-primary sm:text-[1.75rem]"
              >
                {t('mkt.blog.related')}
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
            <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a, i) => (
                <Reveal key={a.slug} delay={i * 60} className="h-full">
                  <ArticleCard article={a} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ Newsletter ============ */}
      <section className="mt-20 sm:mt-24">
        <div className="mkt-container">
          <Reveal>
            <BlogNewsletter />
          </Reveal>
        </div>
      </section>
    </article>
  );
}
