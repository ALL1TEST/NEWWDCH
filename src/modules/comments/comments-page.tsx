'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  X,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  Sparkles,
  Reply,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  Eye,
  Flag,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/patterns';
import { AvatarWithFallback } from '@/components/shared';
import { getApi, deleteApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils';
import type {
  PaginatedResponse,
  CommentStatus,
} from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { Skeleton } from '@/components/ui/skeleton';

// -------------------- Types --------------------

interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

interface ContentItemRef {
  id: string;
  title: string;
}

interface CommentRow {
  id: string;
  content: string;
  author: CommentAuthor;
  contentItem: ContentItemRef;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

type SentimentType = 'positive' | 'negative' | 'neutral';

// -------------------- Sentiment Detection --------------------

const POSITIVE_WORDS = new Set([
  'great', 'love', 'excellent', 'amazing', 'good', 'nice', 'best',
  'wonderful', 'perfect', 'awesome',
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'horrible', 'worst', 'hate', 'awful', 'poor',
  'disgusting', 'waste', 'disappointed',
]);

function detectSentiment(text: string): SentimentType {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/);
  let posCount = 0;
  let negCount = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.has(w)) posCount++;
    if (NEGATIVE_WORDS.has(w)) negCount++;
  }
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

const SENTIMENT_CONFIG: Record<
  SentimentType,
  { emoji: string; label: string; className: string }
> = {
  positive: {
    emoji: '\u{1F60A}',
    label: 'Positive',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  },
  negative: {
    emoji: '\u{1F61E}',
    label: 'Negative',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  },
  neutral: {
    emoji: '\u{1F610}',
    label: 'Neutral',
    className:
      'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700',
  },
};

// -------------------- Status Tab Config --------------------

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Flagged', value: 'FLAGGED' },
  { label: 'Spam', value: 'SPAM' },
  { label: 'Trash', value: 'TRASH' },
];

const STATUS_BADGE_COLORS: Record<string, string> = {
  PENDING:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  REJECTED:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FLAGGED:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  SPAM:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  TRASH:
    'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const SORT_OPTIONS = [
  { label: 'Date', value: 'createdAt' },
  { label: 'Content', value: 'content' },
] as const;

// -------------------- Sub-components --------------------

function SentimentBadge({ sentiment }: { sentiment: SentimentType }) {
  const config = SENTIMENT_CONFIG[sentiment];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4',
        config.className,
      )}
    >
      <span className="text-xs leading-none">{config.emoji}</span>
      {config.label}
    </span>
  );
}

function StatusBadgeSmall({ status }: { status: string }) {
  const colorClass =
    STATUS_BADGE_COLORS[status] ??
    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent px-1.5 py-0 text-[10px] font-medium leading-4',
        colorClass,
      )}
    >
      {label}
    </span>
  );
}

// -------------------- Loading Skeleton --------------------

function CommentCardSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 border-b">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-3/4 max-w-sm" />
      </div>
    </div>
  );
}

// -------------------- Main Component --------------------

export function CommentsPage() {
  const queryClient = useQueryClient();

  const [statusTab, setStatusTab] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CommentRow | null>(null);
  const [sheetComment, setSheetComment] = useState<CommentRow | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set(),
  );
  const [aiReplies, setAiReplies] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Build query params
  const queryParams = useMemo(
    () => ({
      page: currentPage,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: sortField,
      order: sortOrder,
      search: searchValue || undefined,
      ...(statusTab !== 'all' ? { status: statusTab } : {}),
    }),
    [currentPage, sortField, sortOrder, searchValue, statusTab],
  );

  // Fetch comments
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.comments.list(queryParams),
    queryFn: () =>
      getApi<PaginatedResponse<CommentRow>>('/api/comments', queryParams),
    staleTime: 10_000,
  });

  const comments = data?.data ?? [];
  const pagination = data?.pagination;
  const totalItems = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'APPROVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'REJECTED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setDeleteTarget(null);
      setSheetComment(null);
    },
  });

  // Mark spam mutation
  const markSpamMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'SPAM' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });

  // Bulk approve
  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) =>
      patchApi('/api/comments/bulk-status', { ids, status: 'APPROVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setSelectedIds(new Set());
    },
  });

  // Bulk reject
  const bulkRejectMutation = useMutation({
    mutationFn: (ids: string[]) =>
      patchApi('/api/comments/bulk-status', { ids, status: 'REJECTED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setSelectedIds(new Set());
    },
  });

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => deleteApi(`/api/comments/${id}`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setSelectedIds(new Set());
    },
  });

  // Handlers
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      setCurrentPage(1);
    },
    [],
  );

  const handleTabChange = useCallback((value: string) => {
    setStatusTab(value);
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortField((prev) => {
      if (prev === value) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('desc');
      return value;
    });
    setCurrentPage(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === comments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(comments.map((c) => c.id)));
    }
  }, [comments, selectedIds.size]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAiReply = useCallback((id: string) => {
    setAiReplies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Pagination helpers
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * DEFAULT_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * DEFAULT_PAGE_SIZE, totalItems);

  // Empty state messages
  const emptyMessage = useMemo(() => {
    if (searchValue) return 'No comments match your search.';
    switch (statusTab) {
      case 'PENDING':
        return 'No pending comments to review.';
      case 'APPROVED':
        return 'No approved comments yet.';
      case 'REJECTED':
        return 'No rejected comments.';
      case 'FLAGGED':
        return 'No flagged comments.';
      case 'SPAM':
        return 'No spam comments detected.';
      case 'TRASH':
        return 'Trash is empty.';
      default:
        return 'No comments yet. They will appear here when users leave comments on your content.';
    }
  }, [searchValue, statusTab]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* Page Header */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Comments</h1>
          <p className="text-muted-foreground mt-1">
            Moderate and manage user comments across your content
          </p>
        </header>

        {/* Search + Sort Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search comments by content or author..."
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={sortField} onValueChange={handleSortChange}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.label}
                    {sortField === opt.value && (
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => {
              setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
            }}
          >
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </Button>
        </div>

        {/* Custom Status Filter Tabs */}
        <nav
          className="flex gap-1 overflow-x-auto border-b scrollbar-none -mx-1 px-1"
          aria-label="Comment status filter"
        >
          {STATUS_TABS.map((tab) => {
            const isActive = statusTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  'relative flex-shrink-0 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80',
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Comments List */}
        <div className="rounded-lg border bg-card">
          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <CommentCardSkeleton key={i} />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">No comments</h3>
              <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
                {emptyMessage}
              </p>
            </div>
          ) : (
            <div>
              {/* Select all header */}
              <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/20">
                <Checkbox
                  checked={
                    comments.length > 0 &&
                    selectedIds.size === comments.length
                  }
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all comments"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : `${totalItems} comment${totalItems !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Comment Cards */}
              <div className="max-h-[600px] overflow-y-auto">
                {comments.map((comment) => {
                  const sentiment = detectSentiment(comment.content);
                  const isExpanded = expandedComments.has(comment.id);
                  const showAiReply = aiReplies.has(comment.id);
                  const isSelected = selectedIds.has(comment.id);
                  const isHovered = hoveredId === comment.id;

                  return (
                    <div
                      key={comment.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-4 border-b last:border-b-0 transition-colors hover:bg-muted/30 cursor-pointer',
                      )}
                      onMouseEnter={() => setHoveredId(comment.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => setSheetComment(comment)}
                    >
                      {/* Checkbox */}
                      <div
                        className="pt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(comment.id)}
                          aria-label={`Select comment by ${comment.author?.name ?? 'Anonymous'}`}
                        />
                      </div>

                      {/* Avatar */}
                      <AvatarWithFallback
                        src={comment.author?.avatar}
                        name={comment.author?.name ?? 'Anonymous'}
                        className="h-10 w-10 shrink-0"
                      />

                      {/* Content area */}
                      <div className="flex-1 min-w-0">
                        {/* Author row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {comment.author?.name ?? 'Anonymous'}
                          </span>
                          <StatusBadgeSmall status={comment.status} />
                          <SentimentBadge sentiment={sentiment} />
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>

                        {/* Article reference */}
                        {comment.contentItem && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            on &ldquo;{comment.contentItem.title}&rdquo;
                          </p>
                        )}

                        {/* Comment text */}
                        <p
                          className={cn(
                            'text-sm text-foreground/90 mt-1.5 leading-relaxed',
                            !isExpanded && 'line-clamp-2',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(comment.id);
                          }}
                        >
                          {comment.content}
                        </p>
                        {comment.content.length > 120 && (
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline mt-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(comment.id);
                            }}
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}

                        {/* AI Suggest Reply (pending only) */}
                        {comment.status === 'PENDING' && !showAiReply && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAiReply(comment.id);
                            }}
                          >
                            <Sparkles className="h-3 w-3" />
                            AI Suggest Reply
                          </button>
                        )}

                        {showAiReply && (
                          <div
                            className="mt-2 rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-900/10 p-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Sparkles className="h-3 w-3 text-violet-500" />
                              <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400">
                                AI Suggested Reply
                              </span>
                            </div>
                            <p className="text-xs text-foreground/80 leading-relaxed">
                              Thank you for your feedback! We appreciate you taking
                              the time to share your thoughts.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Hover Actions */}
                      <div
                        className={cn(
                          'flex items-center gap-0.5 shrink-0 transition-opacity',
                          isHovered || isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {comment.status !== 'APPROVED' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                onClick={() => approveMutation.mutate(comment.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Approve</TooltipContent>
                          </Tooltip>
                        )}

                        {comment.status !== 'REJECTED' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => rejectMutation.mutate(comment.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reject</TooltipContent>
                          </Tooltip>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <Reply className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reply</TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">More actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setSheetComment(comment)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Full Comment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => markSpamMutation.mutate(comment.id)}
                              disabled={markSpamMutation.isPending}
                            >
                              <Flag className="h-4 w-4 mr-2" />
                              Mark Spam
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(comment)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && comments.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {pageStart} to {pageEnd} of {totalItems}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 1,
                  )
                  .reduce<(number | string)[]>((acc, page, idx, arr) => {
                    if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    typeof item === 'string' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1 text-muted-foreground text-sm"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={item}
                        variant={currentPage === item ? 'default' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </Button>
                    ),
                  )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-4">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <div className="w-px h-5 bg-border" />
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={() =>
                bulkApproveMutation.mutate(Array.from(selectedIds))
              }
              disabled={bulkApproveMutation.isPending}
            >
              {bulkApproveMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() =>
                bulkRejectMutation.mutate(Array.from(selectedIds))
              }
              disabled={bulkRejectMutation.isPending}
            >
              {bulkRejectMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <X className="h-3.5 w-3.5 text-red-600" />
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-destructive hover:text-destructive"
              onClick={() =>
                bulkDeleteMutation.mutate(Array.from(selectedIds))
              }
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={clearSelection}
            >
              Clear
            </Button>
          </div>
        )}

        {/* Comment Detail Sheet */}
        <Sheet
          open={!!sheetComment}
          onOpenChange={(open) => !open && setSheetComment(null)}
        >
          <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
            <SheetHeader className="pr-8">
              <SheetTitle>Comment Details</SheetTitle>
              <SheetDescription>
                {sheetComment
                  ? `By ${sheetComment.author?.name ?? 'Anonymous'} on ${formatDate(sheetComment.createdAt)}`
                  : undefined}
              </SheetDescription>
            </SheetHeader>

            {sheetComment && (
              <div className="flex-1 space-y-6 pb-4">
                {/* Author details */}
                <div className="flex items-center gap-3">
                  <AvatarWithFallback
                    src={sheetComment.author?.avatar}
                    name={sheetComment.author?.name ?? 'Anonymous'}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">
                      {sheetComment.author?.name ?? 'Anonymous'}
                    </p>
                    {sheetComment.author?.email && (
                      <p className="text-xs text-muted-foreground">
                        {sheetComment.author.email}
                      </p>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <StatusBadgeSmall status={sheetComment.status} />
                    <SentimentBadge
                      sentiment={detectSentiment(sheetComment.content)}
                    />
                  </div>
                </div>

                {/* Article reference */}
                {sheetComment.contentItem && (
                  <div className="text-sm text-muted-foreground">
                    Article:{' '}
                    <span className="font-medium text-primary">
                      {sheetComment.contentItem.title}
                    </span>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground/70">Created</span>
                    <br />
                    {formatDate(sheetComment.createdAt)}
                    <br />
                    <span className="text-[11px]">
                      {formatRelativeTime(sheetComment.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground/70">Updated</span>
                    <br />
                    {formatDate(sheetComment.updatedAt)}
                    <br />
                    <span className="text-[11px]">
                      {formatRelativeTime(sheetComment.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* Full comment */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {sheetComment.content}
                  </p>
                </div>

                {/* AI Reply section */}
                {sheetComment.status === 'PENDING' && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">AI Reply</h4>
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-900/10 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                        <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                          Suggested Reply
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        Thank you for your feedback! We appreciate you taking
                        the time to share your thoughts.
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <SheetFooter className="flex-row flex-wrap gap-2 sm:justify-start">
                  {sheetComment.status !== 'APPROVED' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        approveMutation.mutate(sheetComment.id);
                        setSheetComment(null);
                      }}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      )}
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  )}
                  {sheetComment.status !== 'REJECTED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        rejectMutation.mutate(sheetComment.id);
                        setSheetComment(null);
                      }}
                      disabled={rejectMutation.isPending}
                    >
                      {rejectMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      )}
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setDeleteTarget(sheetComment);
                      setSheetComment(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </SheetFooter>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete Comment"
          description={
            deleteTarget
              ? `Are you sure you want to delete this comment by "${deleteTarget.author?.name ?? 'Anonymous'}"? This action cannot be undone.`
              : undefined
          }
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          }}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </TooltipProvider>
  );
}
