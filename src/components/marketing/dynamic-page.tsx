'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Loader2, Calendar, FileText } from 'lucide-react';
import { Reveal, Eyebrow } from './primitives';
import { formatDate } from '@/lib/utils';

interface PublicPageData {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  author?: { name: string } | null;
}

export function DynamicMarketingPage({
  slug,
  fallback,
}: {
  slug: string;
  fallback?: React.ReactNode;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-page', slug],
    queryFn: () => getApi<{ page: PublicPageData }>(`/api/public/pages/${slug}`),
    staleTime: 10_000,
  });

  const page = data?.page;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !page) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="mkt-container max-w-3xl pt-32 pb-16 text-center">
        <h1 className="text-3xl font-bold text-text-primary">Page not found</h1>
        <p className="mt-4 text-text-secondary">The requested page does not exist or is not published.</p>
      </div>
    );
  }

  return (
    <article className="mkt-container max-w-4xl pt-32 pb-20 sm:pt-40">
      <Reveal>
        <header className="border-b border-border pb-8">
          <Eyebrow>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Karmax Official
          </Eyebrow>
          <h1 className="mkt-display mt-3 text-3xl font-bold text-text-primary sm:text-4xl lg:text-5xl">
            {page.title}
          </h1>
          {page.excerpt && (
            <p className="mt-4 text-lg text-text-secondary leading-relaxed">
              {page.excerpt}
            </p>
          )}
          <div className="mt-6 flex items-center gap-4 text-xs text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Updated {formatDate(page.updatedAt)}
            </span>
            {page.author?.name && (
              <span>By {page.author.name}</span>
            )}
          </div>
        </header>
      </Reveal>

      <Reveal delay={100}>
        <div
          className="prose prose-zinc dark:prose-invert max-w-none mt-10 leading-relaxed text-text-secondary [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-text-primary [&>h2]:mt-10 [&>h2]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:text-text-primary [&>h3]:mt-8 [&>h3]:mb-3 [&>p]:mb-4 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>li]:mb-1.5"
          dangerouslySetInnerHTML={{ __html: page.content || '' }}
        />
      </Reveal>
    </article>
  );
}
