'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Pencil,
  Calendar,
  Eye,
  User,
  FolderOpen,
  Tag,
  Search,
  GitBranch,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge, PageHeader } from '@/components/patterns';
import { AvatarWithFallback } from '@/components/shared';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { formatDateTime, formatDate, formatRelativeTime, normalizeContentToHtml } from '@/lib/utils';
import type { PostStatus } from '@/shared/types';

// Small wrapper to avoid React Compiler parsing issue with dangerouslySetInnerHTML
function HtmlContent({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// -------------------- Types ----------------

interface ContentAuthor {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

interface ContentTypeOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface TagOption {
  id: string;
  name: string;
}

interface ContentVersion {
  id: string;
  versionNumber: number;
  title: string;
  changeNote?: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface ReviewAssignment {
  id: string;
  status: string;
  reviewNote?: string;
  reviewer: {
    id: string;
    name: string;
    avatar?: string;
  };
  reviewedAt?: string;
  createdAt: string;
}

interface ContentDetail {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  version: number;
  content?: string;
  excerpt?: string;
  contentTypeId: string;
  contentType: ContentTypeOption;
  categoryId?: string;
  category?: CategoryOption | null;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  viewCount: number;
 publishedAt?: string;
  scheduledAt?: string;
  tags?: TagOption[];
  author: ContentAuthor;
  createdAt: string;
  updatedAt: string;
}

// -------------------- Component ----------------

export function ContentDetailPage({ contentId }: { contentId: string }) {
  const navigate = useNavigationStore((s) => s.navigate);

  const goEdit = React.useCallback(
    () => navigate('content', contentId, 'edit'),
    [navigate, contentId],
  );

  // Fetch content detail
  const {
    data: content,
    isLoading,
  } = useQuery({
    queryKey: queryKeys.content.detail(contentId),
    queryFn: () =>
      getApi<ContentDetail>(`/api/content/${contentId}?include=contentType,category,tags,author`),
    staleTime: 5_000,
    enabled: !!contentId,
  });

  // Fetch versions
  const { data: versions } = useQuery({
    queryKey: queryKeys.contentVersions.list(contentId),
    queryFn: () => getApi<ContentVersion[]>(`/api/content/${contentId}/versions`),
    staleTime: 10_000,
    enabled: !!contentId,
  });

  // Fetch review assignments
  const { data: reviews } = useQuery({
    queryKey: queryKeys.reviews.list(contentId),
    queryFn: () => getApi<ReviewAssignment[]>(`/api/content/${contentId}/reviews`),
    staleTime: 10_000,
    enabled: !!contentId,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Content Detail" breadcrumbs={false} />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="space-y-4">
        <PageHeader title="Content Not Found" breadcrumbs={false} />
        <p className="text-sm text-muted-foreground">
          The requested content could not be found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={content.title}
        breadcrumbs={false}
        action={
          <Button size="sm" onClick={goEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        }
      />

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={content.status} size="md" />
                <Badge variant="outline" className="text-xs">
                  {content.contentType?.name ?? 'Unknown Type'}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  v{content.version}
                </Badge>
              </div>

              {/* Excerpt */}
              {content.excerpt && (
                <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-muted-foreground/20 pl-4">
                  {content.excerpt}
                </p>
              )}

              {/* Content Body */}
              <div className="prose prose-gray prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-p:leading-relaxed prose-a:text-primary dark:prose-invert max-w-none rounded-lg border bg-card p-6 min-h-[200px]">
                {content.content ? (
                  <HtmlContent html={normalizeContentToHtml(content.content)} className="editor-content" />
                ) : (
                  <p className="text-muted-foreground italic">No content body.</p>
                )}
              </div>
            </div>

            {/* Metadata Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <AvatarWithFallback
                      src={content.author?.avatar}
                      name={content.author?.name ?? 'Unknown'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{content.author?.name}</p>
                      <p className="text-xs text-muted-foreground">Author</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Category */}
                  <div className="flex items-start gap-3">
                    <FolderOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="text-sm font-medium">{content.category?.name ?? 'Uncategorized'}</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-start gap-3">
                    <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">Tags</p>
                      {content.tags && content.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {content.tags.map((tag) => (
                            <Badge key={tag.id} variant="secondary" className="text-xs">
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No tags</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SEO Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    SEO
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Meta Title</p>
                    <p className="text-sm">{content.seoTitle || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Meta Description</p>
                    <p className="text-sm">{content.seoDescription || '—'}</p>
                  </div>
                  {content.focusKeyword && (
                    <div>
                      <p className="text-xs text-muted-foreground">Focus Keyword</p>
                      <p className="text-sm">{content.focusKeyword}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dates Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Created</span>
                    <span className="text-xs">{formatDateTime(content.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Updated</span>
                    <span className="text-xs">{formatDateTime(content.updatedAt)}</span>
                  </div>
                  {content.publishedAt && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Published</span>
                      <span className="text-xs">{formatDate(content.publishedAt)}</span>
                    </div>
                  )}
                  {content.scheduledAt && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Scheduled</span>
                      <span className="text-xs">{formatDateTime(content.scheduledAt)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Views</span>
                    <span className="text-sm font-medium tabular-nums">{content.viewCount.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Revisions Tab */}
        <TabsContent value="revisions">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Version History</CardTitle>
            </CardHeader>
            <CardContent>
              {(!versions || versions.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No versions recorded yet.
                </p>
              ) : (
                <div className="space-y-0 divide-y">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{v.title}</span>
                          <Badge variant="outline" className="text-xs font-mono">
                            v{v.versionNumber}
                          </Badge>
                        </div>
                        {v.changeNote && (
                          <p className="text-xs text-muted-foreground mb-1">{v.changeNote}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {v.createdBy?.name ?? 'Unknown'}
                          </span>
                          <span>{formatRelativeTime(v.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Review Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!reviews || reviews.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No review assignments for this content.
                </p>
              ) : (
                <div className="space-y-0 divide-y">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <AvatarWithFallback
                        src={review.reviewer?.avatar}
                        name={review.reviewer?.name ?? 'Unknown'}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{review.reviewer?.name ?? 'Unknown'}</span>
                          <StatusBadge status={review.status} size="sm" />
                        </div>
                        {review.reviewNote && (
                          <p className="text-xs text-muted-foreground mb-1">{review.reviewNote}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Assigned {formatRelativeTime(review.createdAt)}</span>
                          {review.reviewedAt && (
                            <span>Reviewed {formatRelativeTime(review.reviewedAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
