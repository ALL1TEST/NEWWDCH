'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  X,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Flag,
  Flag as FlagIcon,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Shield,
  Save,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Archive,
  RotateCcw,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/patterns';
import { getApi, deleteApi, patchApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useT } from '@/lib/i18n';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  PaginatedResponse,
  CommentStatus,
} from '@/shared/types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/shared/constants';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEMO_COMMENTS,
  getStatusCounts,
  type DemoComment,
  type DemoCommentStatus,
} from './demo-comments';

// ============================================================
// DEMO DATA FLAG
// ============================================================
// When true, the Comments page renders against the in-memory
// `DEMO_COMMENTS` dataset (36 realistic comments — 6 per status).
// This is for UI/UX preview only and does NOT touch the production
// database. The real `/api/comments` routes are unchanged; flip
// this flag to `false` to fall back to live API data.
const USE_DEMO_DATA = false;

// -------------------- Types --------------------

interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  // Demo-only fields — ignored by the real API but rendered by the UI.
  website?: string;
  ipAddress?: string;
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
  // Cast to a wider string type so the demo 'TRASH' value can flow
  // through without fighting the strict `CommentStatus` union.
  status: CommentStatus | 'TRASH';
  createdAt: string;
  updatedAt: string;
  // Demo-only metadata — populated for SPAM / FLAGGED rows.
  spamScore?: number;
  flagReason?: string;
  parentId?: string;
}

// -------------------- Status Tab Config --------------------

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Spam', value: 'SPAM' },
  { label: 'Trash', value: 'TRASH' },
];

// i18n key per status tab / badge value (tab strip + small status badge).
const STATUS_LABEL_KEYS: Record<string, string> = {
  all: 'comments.all',
  PENDING: 'comments.pending',
  APPROVED: 'comments.approved',
  REJECTED: 'comments.rejected',
  FLAGGED: 'comments.flagged',
  SPAM: 'comments.spam',
  TRASH: 'comments.trash',
};

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
  { value: 'createdAt_desc', labelKey: 'comments.newest', defaultLabel: 'Newest' },
  { value: 'createdAt_asc', labelKey: 'comments.oldest', defaultLabel: 'Oldest' },
] as const;

// -------------------- Sub-components --------------------

function StatusBadgeSmall({ status }: { status: string }) {
  const { t } = useT();
  const colorClass =
    STATUS_BADGE_COLORS[status] ??
    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  const label = STATUS_LABEL_KEYS[status]
    ? t(STATUS_LABEL_KEYS[status])
    : status.charAt(0) + status.slice(1).toLowerCase();
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

// -------------------- Comment Text (Read More / Read Less) --------------------
// Measures the actual rendered height of the paragraph against its
// truncated (2-line) height. If scrollHeight > clientHeight, the text
// IS being truncated and "Read More" is shown. This is based on the
// actual rendered content, not an arbitrary character threshold.

function CommentText({
  content,
  commentId,
  isExpanded,
  onToggle,
}: {
  content: string;
  commentId: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}) {
  const { t } = useT();
  const paraRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = paraRef.current;
    if (!el) return;

    const check = () => {
      if (isExpanded) {
        // When expanded, always show "Read Less"
        setIsTruncated(true);
        return;
      }
      // Compare scrollHeight (full content) vs clientHeight (visible area).
      // If scrollHeight > clientHeight, the text IS being clipped by
      // line-clamp-2 — "Read More" should appear.
      const isClipped = el.scrollHeight > el.clientHeight + 2;
      setIsTruncated(isClipped);
    };

    // Use requestAnimationFrame to ensure the DOM has settled
    const raf = requestAnimationFrame(check);

    // Re-check on resize (container width may change)
    const observer = new ResizeObserver(() => requestAnimationFrame(check));
    observer.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [content, isExpanded]);

  return (
    <>
      <p
        ref={paraRef}
        className={cn(
          'text-sm text-foreground/90 mt-1 leading-relaxed',
          !isExpanded && 'line-clamp-2',
        )}
      >
        {content}
      </p>
      {isTruncated && (
        <button
          type="button"
          className="text-xs text-primary hover:underline mt-0.5"
          onClick={() => onToggle(commentId)}
        >
          {isExpanded ? t('comments.readLess') : t('comments.readMore')}
        </button>
      )}
    </>
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

// -------------------- Comment Settings Card --------------------

function CommentSettingsCard() {
  const queryClient = useQueryClient();
  const { t } = useT();

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings', 'discussion', 'comments-page'],
    queryFn: () => getApi<Record<string, string> | null>('/api/settings', { category: 'DISCUSSION' }),
    staleTime: 10_000,
  });

  const savedCommentsEnabled = settingsData
    ? settingsData.enable_comments !== 'false'
    : false;
  const [localCommentsEnabled, setLocalCommentsEnabled] = useState<boolean | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cms_allow_comments');
      if (stored !== null) return stored === 'true';
    }
    return null;
  });

  useEffect(() => {
    if (settingsData) {
      const isCommentsEnabled = settingsData.enable_comments !== 'false';
      setLocalCommentsEnabled(isCommentsEnabled);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cms_allow_comments', String(isCommentsEnabled));
      }
    }
  }, [settingsData]);

  const commentsEnabled = localCommentsEnabled ?? savedCommentsEnabled;

  const saveMutation = useMutation({
    mutationFn: (variables: { commentsEnabled?: boolean }) => {
      const activeComments = variables.commentsEnabled !== undefined ? variables.commentsEnabled : commentsEnabled;

      const settings: Array<{ key: string; value: string; type?: string; category: string }> = [
        { key: 'enable_comments', value: String(activeComments), type: 'BOOLEAN', category: 'DISCUSSION' },
      ];

      return postApi('/api/settings', { settings });
    },
    onSuccess: (_, variables) => {
      const activeComments = variables.commentsEnabled !== undefined ? variables.commentsEnabled : commentsEnabled;

      if (typeof window !== 'undefined') {
        localStorage.setItem('cms_allow_comments', String(activeComments));
      }

      queryClient.setQueryData(['settings', 'discussion', 'comments-page'], (old: Record<string, string> | null) => ({
        ...(old || {}),
        enable_comments: String(activeComments),
      }));

      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(t('comments.settingsSaved') || 'Settings saved');
    },
    onError: (err: Error) => {
      if (settingsData) {
        const isCommentsEnabled = settingsData.enable_comments !== 'false';
        setLocalCommentsEnabled(isCommentsEnabled);
        if (typeof window !== 'undefined') {
          localStorage.setItem('cms_allow_comments', String(isCommentsEnabled));
        }
      }
      toast.error(err.message || t('comments.settingsSaveFailed') || 'Failed to save settings');
    },
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-40" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* Global comment settings */}
      <div className="flex items-start gap-3">
        <Switch
          id="enable-comments"
          checked={commentsEnabled}
          onCheckedChange={(v) => {
            setLocalCommentsEnabled(v);
            if (typeof window !== 'undefined') {
              localStorage.setItem('cms_allow_comments', String(v));
            }
            saveMutation.mutate({ commentsEnabled: v });
          }}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor="enable-comments" className="text-sm font-medium cursor-pointer">
            {t('comments.allowComments') || 'Allow Comments'}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('comments.allowCommentsDesc') || 'Allow visitors to post comments on your articles.'}
          </p>
        </div>
      </div>
    </Card>
  );
}

// -------------------- Main Component --------------------

export function CommentsPage() {
  const queryClient = useQueryClient();
  const { t } = useT();

  // ---------- Plan entitlement gate (client-side) ----------
  // Comments is a real plan feature entitlement. The AUTHORITATIVE
  // check is the server-side requireFeature('comments') gate on every
  // /api/comments route; this probe mirrors it in the UI so a plan
  // without Comments sees a clear "not included" state instead of the
  // moderation tooling. While the probe loads the page renders normally
  // (no lock flash); the server still 403s any real API call.
  const { data: entitlementData, isLoading: entitlementLoading } = useQuery({
    queryKey: ['entitlements-me'],
    queryFn: () =>
      getApi<{ entitlements: string[]; billingMode: string }>(
        '/api/platform/admin/entitlements/me',
      ),
    staleTime: 30_000,
    retry: false,
  });
  const commentsAllowed =
    entitlementLoading || !!entitlementData?.entitlements?.includes('comments');

  const [statusTab, setStatusTab] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CommentRow | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set(),
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Build query params
  const queryParams = useMemo(
    () => ({
      page: currentPage,
      pageSize,
      sort: sortField,
      order: sortOrder,
      search: searchValue || undefined,
      ...(statusTab !== 'all' ? { status: statusTab } : {}),
    }),
    [currentPage, pageSize, sortField, sortOrder, searchValue, statusTab],
  );

  // ---------- DEMO DATA STATE ----------
  // Local copy of the 36 demo comments. All mutations in demo mode
  // update this state instead of hitting the API. Reload resets it.
  const [demoComments, setDemoComments] = useState<DemoComment[]>(DEMO_COMMENTS);

  // Fetch comments (only used when USE_DEMO_DATA === false).
  // The query is preserved so flipping the flag back to false will
  // immediately resume using live API data with zero code changes.
  const { data, isLoading: apiIsLoading } = useQuery({
    queryKey: queryKeys.comments.list(queryParams),
    queryFn: () =>
      getApi<{
        data: CommentRow[];
        meta: {
          requestId: string;
          pagination: { page: number; pageSize: number; total: number; totalPages: number };
          statusCounts: Record<string, number>;
        };
      }>('/api/comments', queryParams, { raw: true }),
    staleTime: 10_000,
    enabled: !USE_DEMO_DATA,
  });

  // ---------- DEMO: filter / search / sort / paginate ----------
  // Pre-compute per-status counts from the FULL demo set (so tab
  // counts stay accurate even when the user is filtering/searching).
  const statusCounts = useMemo(
    () => getStatusCounts(demoComments),
    [demoComments],
  );

  // Apply the active status tab + search query + sort locally.
  const filteredDemoComments = useMemo(() => {
    let result = demoComments;
    if (statusTab !== 'all') {
      result = result.filter((c) => c.status === statusTab);
    }
    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.author.name.toLowerCase().includes(q) ||
          c.content.toLowerCase().includes(q) ||
          c.contentItem.title.toLowerCase().includes(q) ||
          (c.author.email ?? '').toLowerCase().includes(q) ||
          (c.author.website ?? '').toLowerCase().includes(q),
      );
    }
    const sorted = [...result].sort((a, b) => {
      let cmp: number;
      if (sortField === 'content') {
        cmp = a.content.localeCompare(b.content);
      } else {
        // createdAt — string comparison works for ISO timestamps.
        cmp = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [demoComments, statusTab, searchValue, sortField, sortOrder]);

  // Paginate the filtered set (mirrors the API pagination shape).
  const demoTotalItems = filteredDemoComments.length;
  const demoTotalPages = Math.max(1, Math.ceil(demoTotalItems / pageSize));
  const demoPageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDemoComments.slice(start, start + pageSize);
  }, [filteredDemoComments, currentPage, pageSize]);

  // Decide which data the UI renders.
  const apiComments: CommentRow[] = useMemo(() => {
    if (Array.isArray(data)) return data as CommentRow[];
    if (Array.isArray((data as unknown as { data?: CommentRow[] })?.data)) {
      return (data as unknown as { data: CommentRow[] }).data;
    }
    return [];
  }, [data]);

  const comments: CommentRow[] = USE_DEMO_DATA
    ? (demoPageItems as unknown as CommentRow[])
    : apiComments;
  const isLoading = USE_DEMO_DATA ? false : apiIsLoading;
  const totalItems = USE_DEMO_DATA
    ? demoTotalItems
    : ((data as unknown as { pagination?: { total?: number } })?.pagination?.total ??
       (data as unknown as { meta?: { pagination?: { total?: number } } })?.meta?.pagination?.total ??
       apiComments.length);
  const totalPages = USE_DEMO_DATA
    ? demoTotalPages
    : ((data as unknown as { pagination?: { totalPages?: number } })?.pagination?.totalPages ??
       (data as unknown as { meta?: { pagination?: { totalPages?: number } } })?.meta?.pagination?.totalPages ??
       Math.max(1, Math.ceil(totalItems / pageSize)));

  // Helper to optimistically adjust meta.statusCounts in React Query cache
  const adjustStatusCounts = useCallback(
    (transitions: Array<{ fromStatus?: string; toStatus: string }>) => {
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old || !old.meta?.statusCounts) return old;
        const newCounts = { ...old.meta.statusCounts };
        for (const { fromStatus, toStatus } of transitions) {
          if (fromStatus && fromStatus !== toStatus) {
            if (newCounts[fromStatus] !== undefined) {
              newCounts[fromStatus] = Math.max(0, newCounts[fromStatus] - 1);
            }
            if (newCounts[toStatus] !== undefined) {
              newCounts[toStatus] = (newCounts[toStatus] || 0) + 1;
            }
            if (toStatus === 'TRASH' && fromStatus !== 'TRASH') {
              newCounts.all = Math.max(0, (newCounts.all || 1) - 1);
            } else if (fromStatus === 'TRASH' && toStatus !== 'TRASH') {
              newCounts.all = (newCounts.all || 0) + 1;
            }
          }
        }
        return {
          ...old,
          meta: {
            ...old.meta,
            statusCounts: newCounts,
          },
        };
      });
    },
    [queryClient],
  );

  // ---------- Mutations ----------
  // Real API mutations — kept intact so flipping USE_DEMO_DATA to
  // false restores production behavior with no code changes.
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'APPROVED' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const target = comments.find((c) => c.id === id);
      adjustStatusCounts([{ fromStatus: target?.status, toStatus: 'APPROVED' }]);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const updateRow = (r: CommentRow) => (r.id === id ? { ...r, status: 'APPROVED' as const } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('comments.toastApproved') || 'Comment approved');
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to approve comment');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'REJECTED' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const target = comments.find((c) => c.id === id);
      adjustStatusCounts([{ fromStatus: target?.status, toStatus: 'REJECTED' }]);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const updateRow = (r: CommentRow) => (r.id === id ? { ...r, status: 'REJECTED' as const } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('comments.toastRejected') || 'Comment rejected');
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to reject comment');
    },
  });

  const unapproveMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'PENDING' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const target = comments.find((c) => c.id === id);
      adjustStatusCounts([{ fromStatus: target?.status, toStatus: 'PENDING' }]);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const updateRow = (r: CommentRow) => (r.id === id ? { ...r, status: 'PENDING' as const } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('comments.toastUnapproved') || 'Comment moved to pending');
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to update comment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/comments/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const target = comments.find((c) => c.id === id);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const newCounts = { ...(old.meta?.statusCounts || {}) };
        const status = target?.status;
        if (status && newCounts[status] !== undefined) {
          newCounts[status] = Math.max(0, newCounts[status] - 1);
        }
        if (status && status !== 'TRASH') {
          newCounts.all = Math.max(0, (newCounts.all || 1) - 1);
        }
        const filterRow = (r: CommentRow) => r.id !== id;
        if (Array.isArray(old)) return old.filter(filterRow);
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.filter(filterRow),
            meta: {
              ...old.meta,
              statusCounts: newCounts,
            },
          };
        }
        return old;
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('comments.toastDeleted') || 'Comment deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setDeleteTarget(null);
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to delete comment');
    },
  });

  const markSpamMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'SPAM' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const target = comments.find((c) => c.id === id);
      adjustStatusCounts([{ fromStatus: target?.status, toStatus: 'SPAM' }]);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const updateRow = (r: CommentRow) => (r.id === id ? { ...r, status: 'SPAM' as const } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('comments.toastMarkedSpam') || 'Comment marked as spam');
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to mark comment as spam');
    },
  });

  const flagMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'FLAGGED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });

  const trashMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'TRASH' as CommentStatus }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const target = comments.find((c) => c.id === id);
      adjustStatusCounts([{ fromStatus: target?.status, toStatus: 'TRASH' }]);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const updateRow = (r: CommentRow) => (r.id === id ? { ...r, status: 'TRASH' as any } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('comments.toastTrashed') || 'Comment moved to trash');
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to move comment to trash');
    },
  });

  // Restore = restore comment directly to APPROVED.
  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      patchApi(`/api/comments/${id}`, { status: 'APPROVED' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const target = comments.find((c) => c.id === id);
      adjustStatusCounts([{ fromStatus: target?.status ?? 'TRASH', toStatus: 'APPROVED' }]);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const updateRow = (r: CommentRow) => (r.id === id ? { ...r, status: 'APPROVED' as const } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('comments.toastRestored') || 'Comment restored');
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to restore comment');
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) =>
      patchApi('/api/comments/bulk-status', { ids, status: 'APPROVED' }),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const transitions = ids.map((id) => {
        const comment = comments.find((c) => c.id === id);
        return { fromStatus: comment?.status, toStatus: 'APPROVED' };
      });
      adjustStatusCounts(transitions);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const idSet = new Set(ids);
        const updateRow = (r: CommentRow) => (idSet.has(r.id) ? { ...r, status: 'APPROVED' as const } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: (_, ids) => {
      toast.success(ids.length === 1 ? t('comments.bulkApprovedSingular') : `${ids.length} ${t('comments.bulkApprovedPlural')}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setSelectedIds(new Set());
    },
    onError: (err: Error, _ids, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to approve comments');
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: (ids: string[]) =>
      patchApi('/api/comments/bulk-status', { ids, status: 'REJECTED' }),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const transitions = ids.map((id) => {
        const comment = comments.find((c) => c.id === id);
        return { fromStatus: comment?.status, toStatus: 'REJECTED' };
      });
      adjustStatusCounts(transitions);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const idSet = new Set(ids);
        const updateRow = (r: CommentRow) => (idSet.has(r.id) ? { ...r, status: 'REJECTED' as const } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: (_, ids) => {
      toast.success(ids.length === 1 ? t('comments.bulkRejectedSingular') : `${ids.length} ${t('comments.bulkRejectedPlural')}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setSelectedIds(new Set());
    },
    onError: (err: Error, _ids, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to reject comments');
    },
  });

  const bulkSpamMutation = useMutation({
    mutationFn: (ids: string[]) =>
      patchApi('/api/comments/bulk-status', { ids, status: 'SPAM' }),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const transitions = ids.map((id) => {
        const comment = comments.find((c) => c.id === id);
        return { fromStatus: comment?.status, toStatus: 'SPAM' };
      });
      adjustStatusCounts(transitions);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const idSet = new Set(ids);
        const updateRow = (r: CommentRow) => (idSet.has(r.id) ? { ...r, status: 'SPAM' as const } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: (_, ids) => {
      toast.success(ids.length === 1 ? t('comments.bulkSpamSingular') : `${ids.length} ${t('comments.bulkSpamPlural')}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setSelectedIds(new Set());
    },
    onError: (err: Error, _ids, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to mark comments as spam');
    },
  });

  const bulkTrashMutation = useMutation({
    mutationFn: (ids: string[]) =>
      patchApi('/api/comments/bulk-status', { ids, status: 'TRASH' as CommentStatus }),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const transitions = ids.map((id) => {
        const comment = comments.find((c) => c.id === id);
        return { fromStatus: comment?.status, toStatus: 'TRASH' };
      });
      adjustStatusCounts(transitions);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const idSet = new Set(ids);
        const updateRow = (r: CommentRow) => (idSet.has(r.id) ? { ...r, status: 'TRASH' as any } : r);
        if (Array.isArray(old)) return old.map(updateRow);
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateRow) };
        return old;
      });
      return { previous };
    },
    onSuccess: (_, ids) => {
      toast.success(ids.length === 1 ? t('comments.bulkTrashSingular') : `${ids.length} ${t('comments.bulkTrashPlural')}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setSelectedIds(new Set());
    },
    onError: (err: Error, _ids, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to move comments to trash');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => deleteApi(`/api/comments/${id}`))),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.comments.all });
      const idSet = new Set(ids);
      queryClient.setQueriesData({ queryKey: queryKeys.comments.all }, (old: any) => {
        if (!old) return old;
        const newCounts = { ...(old.meta?.statusCounts || {}) };
        for (const id of ids) {
          const comment = comments.find((c) => c.id === id);
          const status = comment?.status;
          if (status && newCounts[status] !== undefined) {
            newCounts[status] = Math.max(0, newCounts[status] - 1);
          }
          if (status && status !== 'TRASH') {
            newCounts.all = Math.max(0, (newCounts.all || 1) - 1);
          }
        }
        const filterRow = (r: CommentRow) => !idSet.has(r.id);
        if (Array.isArray(old)) return old.filter(filterRow);
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.filter(filterRow),
            meta: {
              ...old.meta,
              statusCounts: newCounts,
            },
          };
        }
        return old;
      });
      return { previous };
    },
    onSuccess: (_, ids) => {
      toast.success(ids.length === 1 ? t('comments.bulkDeleteSingular') : `${ids.length} ${t('comments.bulkDeletePlural')}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      setSelectedIds(new Set());
    },
    onError: (err: Error, _ids, context) => {
      if (context?.previous) {
        context.previous.forEach(([k, v]) => queryClient.setQueryData(k, v));
      }
      toast.error(err.message || 'Failed to delete comments');
    },
  });

  // ---------- DEMO: local mutation helpers ----------
  // When in demo mode, update the in-memory state directly. The real
  // API mutations above stay defined but are NOT called.
  const updateDemoStatus = useCallback(
    (id: string, status: DemoCommentStatus) => {
      setDemoComments((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status, updatedAt: new Date().toISOString() }
            : c,
        ),
      );
    },
    [],
  );

  const removeDemoComment = useCallback((id: string) => {
    setDemoComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Single-comment action wrappers — dispatch to demo or API.
  const handleApprove = useCallback(
    (id: string) => {
      if (USE_DEMO_DATA) {
        updateDemoStatus(id, 'APPROVED');
        toast.success(t('comments.toastApproved'));
      } else {
        approveMutation.mutate(id);
      }
    },
    [approveMutation, updateDemoStatus, t],
  );

  const handleReject = useCallback(
    (id: string) => {
      if (USE_DEMO_DATA) {
        updateDemoStatus(id, 'REJECTED');
        toast.success(t('comments.toastRejected'));
      } else {
        rejectMutation.mutate(id);
      }
    },
    [rejectMutation, updateDemoStatus, t],
  );

  const handleUnapprove = useCallback(
    (id: string) => {
      if (USE_DEMO_DATA) {
        updateDemoStatus(id, 'PENDING');
        toast.success(t('comments.toastUnapproved') || 'Comment moved to pending');
      } else {
        unapproveMutation.mutate(id);
      }
    },
    [unapproveMutation, updateDemoStatus, t],
  );

  const handleMarkSpam = useCallback(
    (id: string) => {
      if (USE_DEMO_DATA) {
        updateDemoStatus(id, 'SPAM');
        toast.success(t('comments.toastMarkedSpam'));
      } else {
        markSpamMutation.mutate(id);
      }
    },
    [markSpamMutation, updateDemoStatus, t],
  );

  const handleFlag = useCallback(
    (id: string) => {
      if (USE_DEMO_DATA) {
        updateDemoStatus(id, 'FLAGGED');
        toast.success(t('comments.toastFlagged'));
      } else {
        flagMutation.mutate(id);
      }
    },
    [flagMutation, updateDemoStatus, t],
  );

  const handleMoveToTrash = useCallback(
    (id: string) => {
      if (USE_DEMO_DATA) {
        updateDemoStatus(id, 'TRASH');
        toast.success(t('comments.toastTrashed'));
      } else {
        trashMutation.mutate(id);
      }
    },
    [trashMutation, updateDemoStatus, t],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (USE_DEMO_DATA) {
        removeDemoComment(id);
        setDeleteTarget(null);
        toast.success(t('comments.toastDeleted'));
      } else {
        deleteMutation.mutate(id);
      }
    },
    [deleteMutation, removeDemoComment, t],
  );

  // Restore a comment back to Approved.
  const handleRestore = useCallback(
    (id: string) => {
      if (USE_DEMO_DATA) {
        updateDemoStatus(id, 'APPROVED');
        toast.success(t('comments.toastRestored'));
      } else {
        restoreMutation.mutate(id);
      }
    },
    [restoreMutation, updateDemoStatus, t],
  );

  // Bulk action wrappers.
  const handleBulkApprove = useCallback(
    (ids: string[]) => {
      if (USE_DEMO_DATA) {
        ids.forEach((id) => updateDemoStatus(id, 'APPROVED'));
        setSelectedIds(new Set());
        toast.success(`${ids.length} ${ids.length > 1 ? t('comments.bulkApprovedPlural') : t('comments.bulkApprovedSingular')}`);
      } else {
        bulkApproveMutation.mutate(ids);
      }
    },
    [bulkApproveMutation, updateDemoStatus, t],
  );

  const handleBulkReject = useCallback(
    (ids: string[]) => {
      if (USE_DEMO_DATA) {
        ids.forEach((id) => updateDemoStatus(id, 'REJECTED'));
        setSelectedIds(new Set());
        toast.success(`${ids.length} ${ids.length > 1 ? t('comments.bulkRejectedPlural') : t('comments.bulkRejectedSingular')}`);
      } else {
        bulkRejectMutation.mutate(ids);
      }
    },
    [bulkRejectMutation, updateDemoStatus, t],
  );

  const handleBulkSpam = useCallback(
    (ids: string[]) => {
      if (USE_DEMO_DATA) {
        ids.forEach((id) => updateDemoStatus(id, 'SPAM'));
        setSelectedIds(new Set());
        toast.success(`${ids.length} ${ids.length > 1 ? t('comments.bulkSpamPlural') : t('comments.bulkSpamSingular')}`);
      } else {
        bulkSpamMutation.mutate(ids);
      }
    },
    [bulkSpamMutation, updateDemoStatus, t],
  );

  const handleBulkTrash = useCallback(
    (ids: string[]) => {
      if (USE_DEMO_DATA) {
        ids.forEach((id) => updateDemoStatus(id, 'TRASH'));
        setSelectedIds(new Set());
        toast.success(`${ids.length} ${ids.length > 1 ? t('comments.bulkTrashPlural') : t('comments.bulkTrashSingular')}`);
      } else {
        bulkTrashMutation.mutate(ids);
      }
    },
    [bulkTrashMutation, updateDemoStatus, t],
  );

  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      if (USE_DEMO_DATA) {
        ids.forEach((id) => removeDemoComment(id));
        setSelectedIds(new Set());
        toast.success(`${ids.length} ${ids.length > 1 ? t('comments.bulkDeletePlural') : t('comments.bulkDeleteSingular')}`);
      } else {
        bulkDeleteMutation.mutate(ids);
      }
    },
    [bulkDeleteMutation, removeDemoComment, t],
  );

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

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Status-aware bulk actions based on selected comments
  const selectedComments = useMemo(() => {
    return comments.filter((c) => selectedIds.has(c.id));
  }, [comments, selectedIds]);

  const canBulkApprove = selectedComments.length > 0 && selectedComments.every((c) => c.status !== 'APPROVED');
  const canBulkReject = selectedComments.length > 0 && selectedComments.every((c) => c.status === 'APPROVED' || (c.status as string) === 'PENDING');
  const canBulkSpam = selectedComments.length > 0 && selectedComments.every((c) => c.status !== 'SPAM' && c.status !== 'TRASH');
  const canBulkTrash = selectedComments.length > 0 && selectedComments.every((c) => c.status !== 'TRASH');
  const canBulkDelete = selectedComments.length > 0;

  const allSelectedTrash = selectedComments.length > 0 && selectedComments.every((c) => c.status === 'TRASH');
  const allSelectedSpam = selectedComments.length > 0 && selectedComments.every((c) => c.status === 'SPAM');
  const allSelectedPending = selectedComments.length > 0 && selectedComments.every((c) => c.status === 'PENDING');
  const approveLabel = allSelectedTrash
    ? (t('comments.restore') || 'Restore')
    : (t('comments.approve') || 'Approve');

  // Pagination helpers
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * DEFAULT_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * DEFAULT_PAGE_SIZE, totalItems);

  // Empty state messages
  const emptyMessage = useMemo(() => {
    if (searchValue) return t('comments.emptySearch');
    switch (statusTab) {
      case 'PENDING':
        return t('comments.emptyPending') || 'No pending comments to review.';
      case 'APPROVED':
        return t('comments.emptyApproved');
      case 'REJECTED':
        return t('comments.emptyRejected');
      case 'SPAM':
        return t('comments.emptySpam');
      case 'TRASH':
        return t('comments.emptyTrash');
      default:
        return t('comments.emptyDefault');
    }
  }, [searchValue, statusTab, t]);

  // ---------- Plan entitlement gate ----------
  // The current plan does not include the Comments feature → render a
  // clear "not included" state instead of the moderation tooling. The
  // server-side requireFeature('comments') gate independently blocks
  // every /api/comments call with 403 FEATURE_NOT_AVAILABLE, so this
  // UI state can never bypass enforcement.
  if (!commentsAllowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">
                {t('comments.notIncludedTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('comments.notIncludedDescription')}
              </p>
            </div>
            <Button
              onClick={() => {
                window.location.hash = '#billing';
              }}
              className="mt-2"
            >
              {t('comments.viewPlans')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* Page Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t('title.comments')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('comments.pageDescription')}
            </p>
          </div>
        </header>

        {/* Comment Settings (inline — moved from Discussion settings) */}
        <CommentSettingsCard />

        {/* Search + Filter + Sort Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('comments.searchPlaceholder') || 'Search by author, content or email...'}
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select
            value={`${sortField}_${sortOrder}`}
            onValueChange={(val) => {
              const [field, order] = val.split('_');
              setSortField(field);
              setSortOrder(order as 'asc' | 'desc');
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-[130px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.labelKey) || opt.defaultLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Status Filter Tabs — each tab shows its live count */}
        <nav
          className="flex gap-1 overflow-x-auto border-b scrollbar-none -mx-1 px-1"
          aria-label={t('comments.statusFilterAria')}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = statusTab === tab.value;
            const apiStatusCounts = (data as unknown as { meta?: { statusCounts?: Record<string, number> } })?.meta?.statusCounts;
            const count = USE_DEMO_DATA
              ? (statusCounts[tab.value as DemoCommentStatus | 'all'] ?? 0)
              : (apiStatusCounts?.[tab.value] ??
                  (tab.value === 'all'
                    ? totalItems
                    : comments.filter((c) => c.status === tab.value).length));
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  'relative flex-shrink-0 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center gap-2',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80',
                )}
              >
                {STATUS_LABEL_KEYS[tab.value]
                  ? t(STATUS_LABEL_KEYS[tab.value])
                  : tab.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.25rem] h-5 text-[11px] font-semibold leading-none',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
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
              <h3 className="mt-4 text-sm font-semibold">{t('comments.noComments')}</h3>
              <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
                {emptyMessage}
              </p>
            </div>
          ) : (
            <div>
              {/* Select all header */}
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={
                      comments.length > 0 &&
                      selectedIds.size === comments.length
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label={t('comments.selectAllAria')}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} ${t('comments.selectedCount')}`
                      : `${totalItems} ${totalItems !== 1 ? t('comments.commentsPlural') : t('comments.commentSingular')}`}
                  </span>
                </div>
              </div>

              {/* Comment Cards — natural page scroll (no nested scrollbar) */}
              <div>
                {comments.map((comment) => {
                  const isSelected = selectedIds.has(comment.id);
                  const isHovered = hoveredId === comment.id;
                  const isApproved = comment.status === 'APPROVED';
                  const isRejected = comment.status === 'REJECTED';
                  const isSpam = comment.status === 'SPAM';
                  const isTrashed = comment.status === 'TRASH';
                  const isExpanded = expandedComments.has(comment.id);

                  return (
                    <div
                      key={comment.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-muted/30',
                        isSpam && 'bg-red-50/40 dark:bg-red-900/5',
                        isTrashed && 'opacity-60',
                      )}
                      onMouseEnter={() => setHoveredId(comment.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(comment.id)}
                          aria-label={`${t('comments.selectByPrefix')}${comment.author?.name ?? t('comments.anonymous')}`}
                        />
                      </div>

                      {/* Content area — Name, Email, Comment, Article link, Status */}
                      <div className="flex-1 min-w-0">
                        {/* Name + Email (inline) */}
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {comment.author?.name ?? t('comments.anonymous')}
                          </span>
                          {comment.author?.email && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[16rem]">
                              {comment.author.email}
                            </span>
                          )}
                        </div>

                        {/* Comment text — Read More/Less based on actual rendered truncation */}
                        <CommentText
                          content={comment.content}
                          commentId={comment.id}
                          isExpanded={isExpanded}
                          onToggle={toggleExpand}
                        />

                        {/* Article link + Date + Status badge */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {comment.contentItem && (
                            <span className="text-xs text-muted-foreground">
                              {t('comments.onArticle')}{' '}
                              <a
                                href={`#content/${comment.contentItem.id}`}
                                className="text-foreground/70 hover:text-primary transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {comment.contentItem.title}
                              </a>
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                          <StatusBadgeSmall status={comment.status} />
                        </div>
                      </div>

                      {/* Actions — status-aware More menu */}
                      <div className="flex items-center shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">{t('comments.moreActions') || 'Actions'}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {/* Restore / Approve (valid on REJECTED, SPAM, TRASH) */}
                            {!isApproved && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isTrashed) {
                                    handleRestore(comment.id);
                                  } else {
                                    handleApprove(comment.id);
                                  }
                                }}
                                className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-950/30 cursor-pointer"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                {isTrashed
                                  ? (t('comments.restore') || 'Restore')
                                  : (t('comments.approve') || 'Approve')}
                              </DropdownMenuItem>
                            )}

                            {/* Reject (valid on APPROVED and legacy PENDING) */}
                            {(isApproved || (comment.status as string) === 'PENDING') && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReject(comment.id);
                                }}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer"
                              >
                                <X className="h-4 w-4 mr-2" />
                                {t('comments.reject') || 'Reject'}
                              </DropdownMenuItem>
                            )}

                            {/* Mark as Spam (valid on APPROVED, REJECTED, and PENDING) */}
                            {!isSpam && !isTrashed && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkSpam(comment.id);
                                }}
                                className="cursor-pointer"
                              >
                                <Flag className="h-4 w-4 mr-2" />
                                {t('comments.markAsSpam') || 'Mark as Spam'}
                              </DropdownMenuItem>
                            )}

                            {/* Move to Trash (valid on APPROVED, REJECTED, SPAM, and PENDING) */}
                            {!isTrashed && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToTrash(comment.id);
                                }}
                                className="cursor-pointer"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                {t('comments.moveToTrash') || 'Move to Trash'}
                              </DropdownMenuItem>
                            )}

                            {/* Delete (valid on ALL) */}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(comment);
                              }}
                              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete') || 'Delete'}
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

          {/* Pagination matching Image 2 & 3 */}
          {!isLoading && comments.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">
                {t('app.showingRange') || 'Showing'} {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} {t('app.showingRangeOf') || 'of'} {totalItems} {t('app.showingRangeItems') || 'items'}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{t('app.rows') || 'Rows'}</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">{t('app.previousPage') || 'Previous'}</span>
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">{t('app.nextPage') || 'Next'}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-4 max-w-[calc(100vw-2rem)]">
            {canBulkApprove && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => handleBulkApprove(Array.from(selectedIds))}
              >
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                {approveLabel}
              </Button>
            )}
            {canBulkReject && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => handleBulkReject(Array.from(selectedIds))}
              >
                <X className="h-3.5 w-3.5 text-red-600" />
                {t('comments.reject') || 'Reject'}
              </Button>
            )}
            {canBulkSpam && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => handleBulkSpam(Array.from(selectedIds))}
              >
                <Flag className="h-3.5 w-3.5 text-purple-600" />
                <span className="hidden sm:inline">{t('comments.markAsSpam') || 'Mark as Spam'}</span>
                <span className="sm:hidden">{t('comments.spam') || 'Spam'}</span>
              </Button>
            )}
            {canBulkTrash && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => handleBulkTrash(Array.from(selectedIds))}
              >
                <Archive className="h-3.5 w-3.5 text-orange-600" />
                <span className="hidden sm:inline">{t('comments.moveToTrash') || 'Move to Trash'}</span>
                <span className="sm:hidden">{t('comments.trash') || 'Trash'}</span>
              </Button>
            )}
            {canBulkDelete && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-destructive hover:text-destructive"
                onClick={() => handleBulkDelete(Array.from(selectedIds))}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('common.delete') || 'Delete'}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={clearSelection}
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
          </div>
        )}

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={t('comments.deleteComment')}
          description={
            deleteTarget
              ? `${t('comments.deleteConfirmPrefix')}${deleteTarget.author?.name ?? t('comments.anonymous')}${t('comments.deleteConfirmSuffix')}`
              : undefined
          }
          confirmLabel={t('common.delete') || 'Delete'}
          variant="destructive"
          onConfirm={() => {
            if (deleteTarget) handleDelete(deleteTarget.id);
          }}
          isLoading={!USE_DEMO_DATA && deleteMutation.isPending}
        />
      </div>
    </TooltipProvider>
  );
}
