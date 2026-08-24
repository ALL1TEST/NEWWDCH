'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Users,
  Mail,
  Loader2,
  Send,
  Eye,
  Play,
  Clock,
  XCircle,
  RotateCcw,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  StatusBadge,
  PageHeader,
  ConfirmDialog,
} from '@/components/patterns';
import { getApi, postApi, deleteApi, patchApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import { formatDate, cn } from '@/lib/utils';
import type {
  SubscriberStatus,
  CampaignStatus,
} from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

// -------------------- Subscriber Types --------------------

interface SubscriberRow {
  id: string;
  email: string;
  name?: string;
  status: SubscriberStatus;
  source?: string;
  subscribedAt: string;
}

// -------------------- Campaign Types --------------------

interface CampaignTemplate {
  id: string;
  name: string;
  subject?: string;
  category?: string;
}

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  contentOverride?: string | null;
  templateId?: string | null;
  template?: CampaignTemplate | null;
  status: CampaignStatus;
  recipientCount: number;
  openRate?: number;
  clickRate?: number;
  scheduledAt?: string | null;
  sentAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

// -------------------- Campaign Create Form --------------------

interface CampaignForm {
  name: string;
  subject: string;
  templateId: string;
  contentOverride: string;
  scheduledAt: string;
  audience: 'all' | 'selected';
  selectedSubscriberIds: string[];
}

const INITIAL_CAMPAIGN_FORM: CampaignForm = {
  name: '',
  subject: '',
  templateId: '',
  contentOverride: '',
  scheduledAt: '',
  audience: 'all',
  selectedSubscriberIds: [],
};

// -------------------- Campaign Status Options --------------------

const CAMPAIGN_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Sending', value: 'SENDING' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

// -------------------- Component --------------------

type NewsletterSubPage = 'subscribers' | 'campaigns';

export function NewsletterPage() {
  const queryClient = useQueryClient();
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  const activeTab: NewsletterSubPage =
    (currentSubPage as NewsletterSubPage) || 'subscribers';

  const handleTabChange = (value: string) => {
    navigate('newsletter', null, value);
  };

  useEffect(() => {
    if (!currentSubPage) {
      navigate('newsletter', null, 'subscribers');
    }
  }, [currentSubPage, navigate]);

  // ======================== SUBSCRIBERS ========================

  const subTable = useDataTable({
    initialSortField: 'subscribedAt',
    initialSortOrder: 'desc',
    initialPageSize: DEFAULT_PAGE_SIZE,
  });

  const subQueryParams = useMemo(
    () => ({
      page: subTable.currentPage,
      pageSize: subTable.pageSize,
      sort: subTable.sortField,
      order: subTable.sortOrder,
      search: subTable.searchValue || undefined,
    }),
    [subTable.currentPage, subTable.pageSize, subTable.sortField, subTable.sortOrder, subTable.searchValue],
  );

  const { data: subRaw, isLoading: subLoading } = useQuery({
    queryKey: queryKeys.newsletterSubscribers.list(subQueryParams),
    queryFn: () => getApi<{ data: SubscriberRow[]; meta: { pagination: { page: number; pageSize: number; total: number; totalPages: number } } }>('/api/subscribers', subQueryParams, { raw: true }),
    staleTime: 10_000,
  });

  const subscribers = (Array.isArray(subRaw?.data) ? subRaw.data : []) as SubscriberRow[];
  const totalSubscribers = subRaw?.meta?.pagination?.total ?? 0;

  const subscriberColumns = useMemo<ColumnDef<SubscriberRow>[]>(
    () => [
      ColumnDefHelper.textColumn<SubscriberRow>({
        id: 'email',
        header: 'Email',
        accessorKey: 'email',
        className: 'font-medium',
      }),
      ColumnDefHelper.textColumn<SubscriberRow>({
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: false,
      }),
      ColumnDefHelper.statusColumn<SubscriberRow>({
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        renderStatus: (status) => <StatusBadge status={status} size="sm" />,
      }),
      ColumnDefHelper.textColumn<SubscriberRow>({
        id: 'source',
        header: 'Source',
        accessorKey: 'source',
        enableSorting: false,
      }),
      ColumnDefHelper.dateColumn<SubscriberRow>({
        id: 'subscribedAt',
        header: 'Subscribed',
        accessorKey: 'subscribedAt',
        format: (d) => formatDate(d),
      }),
    ],
    [],
  );

  // ======================== CAMPAIGNS ========================

  const campTable = useDataTable({
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
    initialPageSize: DEFAULT_PAGE_SIZE,
  });
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('all');
  const [deleteCampaignTarget, setDeleteCampaignTarget] = useState<CampaignRow | null>(null);

  const campQueryParams = useMemo(
    () => ({
      page: campTable.currentPage,
      pageSize: campTable.pageSize,
      sort: campTable.sortField,
      order: campTable.sortOrder,
      ...(campaignStatusFilter !== 'all' ? { status: campaignStatusFilter } : {}),
    }),
    [campTable.currentPage, campTable.pageSize, campTable.sortField, campTable.sortOrder, campaignStatusFilter],
  );

  const { data: campRaw, isLoading: campLoading } = useQuery({
    queryKey: queryKeys.newsletterCampaigns.list(campQueryParams),
    queryFn: () => getApi<{ data: CampaignRow[]; meta: { pagination: { page: number; pageSize: number; total: number; totalPages: number } } }>('/api/campaigns', campQueryParams, { raw: true }),
    staleTime: 10_000,
  });

  const campaigns = (Array.isArray(campRaw?.data) ? campRaw.data : []) as CampaignRow[];
  const totalCampaigns = campRaw?.meta?.pagination?.total ?? 0;

  // Fetch email templates for the Create Campaign dialog's template selector.
  // Only ENABLED templates are shown.
  const { data: templatesData } = useQuery({
    queryKey: ['email-templates', 'enabled'],
    queryFn: () => getApi<{ id: string; name: string; subject?: string; category?: string }[]>('/api/email-templates?status=ENABLED&pageSize=100'),
    staleTime: 30_000,
  });
  const emailTemplates = templatesData ?? [];

  // Fetch eligible subscribers (status=SUBSCRIBED) for the audience selector
  // + live recipient count preview.
  const { data: eligibleSubsData } = useQuery({
    queryKey: ['campaigns', 'eligible-subscribers'],
    queryFn: () => getApi<{ id: string; email: string; name?: string }[]>('/api/campaigns/eligible-subscribers'),
    staleTime: 30_000,
  });
  const eligibleSubscribers = eligibleSubsData ?? [];
  const eligibleCount = eligibleSubscribers.length;

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.newsletterCampaigns.all });
      setDeleteCampaignTarget(null);
      toast.success('Campaign deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete campaign');
    },
  });

  // Duplicate campaign mutation
  const duplicateCampaignMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/campaigns/${id}/duplicate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.newsletterCampaigns.all });
      toast.success('Campaign duplicated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to duplicate campaign');
    },
  });

  // Create campaign dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(INITIAL_CAMPAIGN_FORM);
  const authUser = useAuthStore((s) => s.user);

  // Compute the live recipient count for the Create Campaign dialog
  // (must be after campaignForm state declaration)
  const liveRecipientCount = campaignForm.audience === 'all'
    ? eligibleCount
    : campaignForm.selectedSubscriberIds.length;

  const createCampaignMutation = useMutation({
    mutationFn: (payload: CampaignForm) => {
      // Build the API payload — audience is 'all' or an array of IDs
      const apiPayload: Record<string, unknown> = {
        name: payload.name,
        subject: payload.subject,
        templateId: payload.templateId,
        contentOverride: payload.contentOverride || '',
        scheduledAt: payload.scheduledAt || '',
        createdById: authUser?.id,
      };
      if (payload.audience === 'all') {
        apiPayload.audience = 'all';
      } else {
        apiPayload.audience = payload.selectedSubscriberIds;
      }
      return postApi('/api/campaigns', apiPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.newsletterCampaigns.all });
      setCreateOpen(false);
      setCampaignForm(INITIAL_CAMPAIGN_FORM);
      toast.success('Campaign created');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create campaign');
    },
  });

  // Send campaign now (Draft → Sending → Sent/Failed)
  const sendCampaignMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/campaigns/${id}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.newsletterCampaigns.all });
      toast.success('Campaign sent');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send campaign');
    },
  });

  // Cancel a scheduled campaign
  const cancelCampaignMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/campaigns/${id}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.newsletterCampaigns.all });
      toast.success('Campaign cancelled');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to cancel campaign');
    },
  });

  // Retry a failed campaign
  const retryCampaignMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/campaigns/${id}/retry`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.newsletterCampaigns.all });
      toast.success('Campaign retry started');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to retry campaign');
    },
  });

  const campaignColumns = useMemo<ColumnDef<CampaignRow>[]>(
    () => [
      ColumnDefHelper.textColumn<CampaignRow>({
        id: 'subject',
        header: 'Subject',
        accessorKey: 'subject',
        truncate: 50,
        className: 'font-medium',
      }),
      ColumnDefHelper.statusColumn<CampaignRow>({
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        renderStatus: (status) => <StatusBadge status={status} size="sm" />,
      }),
      {
        id: 'recipientCount',
        header: 'Recipients',
        size: 110,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.recipientCount.toLocaleString()}</span>
        ),
      } as ColumnDef<CampaignRow>,
      {
        id: 'openRate',
        header: 'Open Rate',
        size: 100,
        enableSorting: false,
        cell: ({ row }) => {
          const rate = row.original.openRate;
          if (rate === undefined || rate === null) return <span className="text-muted-foreground">—</span>;
          return (
            <span className={cn(
              'text-sm tabular-nums font-medium',
              rate >= 30 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
            )}>
              {rate.toFixed(1)}%
            </span>
          );
        },
      } as ColumnDef<CampaignRow>,
      {
        id: 'clickRate',
        header: 'Click Rate',
        size: 100,
        enableSorting: false,
        cell: ({ row }) => {
          const rate = row.original.clickRate;
          if (rate === undefined || rate === null) return <span className="text-muted-foreground">—</span>;
          return (
            <span className={cn(
              'text-sm tabular-nums font-medium',
              rate >= 5 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
            )}>
              {rate.toFixed(1)}%
            </span>
          );
        },
      } as ColumnDef<CampaignRow>,
      ColumnDefHelper.dateColumn<CampaignRow>({
        id: 'scheduledAt',
        header: 'Scheduled',
        accessorKey: 'scheduledAt',
        format: (d) => formatDate(d),
      }),
      ColumnDefHelper.actionColumn<CampaignRow>({
        id: 'actions',
        render: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Draft: Edit / Schedule / Send Now / Delete */}
              {row.status === 'DRAFT' && (
                <>
                  <DropdownMenuItem>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => sendCampaignMutation.mutate(row.id)}
                    disabled={sendCampaignMutation.isPending}
                  >
                    {sendCampaignMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Now
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteCampaignTarget(row)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}

              {/* Scheduled: Edit / Cancel */}
              {row.status === 'SCHEDULED' && (
                <>
                  <DropdownMenuItem>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => cancelCampaignMutation.mutate(row.id)}
                    disabled={cancelCampaignMutation.isPending}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel
                  </DropdownMenuItem>
                </>
              )}

              {/* Sending: show state, no actions */}
              {row.status === 'SENDING' && (
                <DropdownMenuItem disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </DropdownMenuItem>
              )}

              {/* Sent: View / Duplicate */}
              {row.status === 'SENT' && (
                <>
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => duplicateCampaignMutation.mutate(row.id)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                </>
              )}

              {/* Failed: Retry / Edit / Delete */}
              {row.status === 'FAILED' && (
                <>
                  <DropdownMenuItem
                    onClick={() => retryCampaignMutation.mutate(row.id)}
                    disabled={retryCampaignMutation.isPending}
                  >
                    {retryCampaignMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                    Retry
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteCampaignTarget(row)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}

              {/* Cancelled: Duplicate / Delete */}
              {row.status === 'CANCELLED' && (
                <>
                  <DropdownMenuItem onClick={() => duplicateCampaignMutation.mutate(row.id)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteCampaignTarget(row)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ],
    [duplicateCampaignMutation, sendCampaignMutation, cancelCampaignMutation, retryCampaignMutation],
  );

  // Campaign filter content
  const campaignFilterContent = (
    <Select
      value={campaignStatusFilter}
      onValueChange={(v) => {
        setCampaignStatusFilter(v);
        campTable.setCurrentPage(1);
      }}
    >
      <SelectTrigger size="sm" className="w-[140px] h-9">
        <SelectValue placeholder="All Statuses" />
      </SelectTrigger>
      <SelectContent>
        {CAMPAIGN_STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Newsletter"
        description="Manage subscribers and campaigns"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="subscribers">
            <Users className="h-4 w-4 mr-1" />
            Subscribers
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <Mail className="h-4 w-4 mr-1" />
            Campaigns
          </TabsTrigger>
        </TabsList>

        {/* Subscribers Tab */}
        <TabsContent value="subscribers" className="mt-4">
          <DataTable
            columns={subscriberColumns}
            data={subscribers}
            isLoading={subLoading}
            totalItems={totalSubscribers}
            pageSize={subTable.pageSize}
            currentPage={subTable.currentPage}
            onPageChange={(p) => subTable.setCurrentPage(p)}
            onSortChange={(field, order) => subTable.setSortField(field, order)}
            sortField={subTable.sortField}
            sortOrder={subTable.sortOrder}
            searchPlaceholder="Search by email..."
            searchValue={subTable.searchValue}
            onSearch={(v) => { subTable.setSearchValue(v); subTable.setCurrentPage(1); }}
            getRowId={(row) => row.id}
            emptyMessage="No subscribers found."
          />
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-4">
          <div className="flex justify-end mb-0">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Campaign</DialogTitle>
                  <DialogDescription>
                    Select an email template and audience to send a newsletter campaign.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Campaign Name */}
                  <div className="space-y-2">
                    <Label htmlFor="camp-name">Campaign Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="camp-name"
                      placeholder="e.g. Weekly Digest #42"
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>

                  {/* Email Template Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="camp-template">Email Template <span className="text-destructive">*</span></Label>
                    {emailTemplates.length === 0 ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                        No email templates found. Create a template first in Settings → Email Templates before creating a campaign.
                      </div>
                    ) : (
                      <Select
                        value={campaignForm.templateId}
                        onValueChange={(v) => setCampaignForm((f) => ({ ...f, templateId: v }))}
                      >
                        <SelectTrigger id="camp-template">
                          <SelectValue placeholder="Select an email template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {emailTemplates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              {tpl.name}{tpl.category ? ` (${tpl.category})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                      The template provides the email design. You can override the content below without modifying the original template.
                    </p>
                  </div>

                  {/* Subject Line */}
                  <div className="space-y-2">
                    <Label htmlFor="camp-subject">Subject Line <span className="text-destructive">*</span></Label>
                    <Input
                      id="camp-subject"
                      placeholder="e.g. Your weekly updates"
                      value={campaignForm.subject}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, subject: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the actual subject subscribers will see. It can differ from the template's subject.
                    </p>
                  </div>

                  {/* Content Override (optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="camp-content">Content Override (optional)</Label>
                    <Textarea
                      id="camp-content"
                      placeholder="Leave empty to use the template's HTML body. Or paste custom HTML to override the template content for this campaign only."
                      rows={4}
                      value={campaignForm.contentOverride}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, contentOverride: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Editing this does NOT modify the original Email Template.
                    </p>
                  </div>

                  {/* Audience Selector */}
                  <div className="space-y-2">
                    <Label>Audience / Recipients <span className="text-destructive">*</span></Label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audience"
                          checked={campaignForm.audience === 'all'}
                          onChange={() => setCampaignForm((f) => ({ ...f, audience: 'all' }))}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">All subscribed subscribers</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audience"
                          checked={campaignForm.audience === 'selected'}
                          onChange={() => setCampaignForm((f) => ({ ...f, audience: 'selected' }))}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Select specific subscribers</span>
                      </label>
                    </div>

                    {/* Live recipient count */}
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <strong className="text-foreground">{liveRecipientCount}</strong>
                      <span className="text-muted-foreground"> subscriber{liveRecipientCount !== 1 ? 's' : ''} will receive this campaign</span>
                      {eligibleCount === 0 && (
                        <span className="text-amber-600 dark:text-amber-400 ml-2">(no eligible subscribers — status=SUBSCRIBED required)</span>
                      )}
                    </div>

                    {/* Selected subscribers list (only when audience=selected) */}
                    {campaignForm.audience === 'selected' && (
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {eligibleSubscribers.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">No eligible subscribers available.</p>
                        ) : (
                          eligibleSubscribers.map((sub) => (
                            <label key={sub.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 cursor-pointer border-b last:border-b-0">
                              <Checkbox
                                checked={campaignForm.selectedSubscriberIds.includes(sub.id)}
                                onCheckedChange={(checked) => {
                                  setCampaignForm((f) => ({
                                    ...f,
                                    selectedSubscriberIds: checked
                                      ? [...f.selectedSubscriberIds, sub.id]
                                      : f.selectedSubscriberIds.filter((id) => id !== sub.id),
                                  }));
                                }}
                              />
                              <span className="text-sm truncate">{sub.name || sub.email}</span>
                              {sub.name && <span className="text-xs text-muted-foreground truncate">{sub.email}</span>}
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Schedule (optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="camp-schedule">Schedule (optional)</Label>
                    <Input
                      id="camp-schedule"
                      type="datetime-local"
                      value={campaignForm.scheduledAt}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to save as Draft. Select a future date/time to schedule the campaign.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createCampaignMutation.mutate(campaignForm)}
                    disabled={
                      createCampaignMutation.isPending ||
                      !campaignForm.name ||
                      !campaignForm.subject ||
                      !campaignForm.templateId ||
                      liveRecipientCount === 0 ||
                      (campaignForm.audience === 'selected' && campaignForm.selectedSubscriberIds.length === 0)
                    }
                  >
                    {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <DataTable
            columns={campaignColumns}
            data={campaigns}
            isLoading={campLoading}
            totalItems={totalCampaigns}
            pageSize={campTable.pageSize}
            currentPage={campTable.currentPage}
            onPageChange={(p) => campTable.setCurrentPage(p)}
            onSortChange={(field, order) => campTable.setSortField(field, order)}
            sortField={campTable.sortField}
            sortOrder={campTable.sortOrder}
            filterContent={campaignFilterContent}
            getRowId={(row) => row.id}
            emptyMessage="No campaigns found."
          />
        </TabsContent>
      </Tabs>

      {/* Delete Campaign Confirmation */}
      <ConfirmDialog
        open={!!deleteCampaignTarget}
        onOpenChange={(open) => !open && setDeleteCampaignTarget(null)}
        title="Delete Campaign"
        description={
          deleteCampaignTarget
            ? `Are you sure you want to delete the campaign "${deleteCampaignTarget.name}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteCampaignTarget) deleteCampaignMutation.mutate(deleteCampaignTarget.id);
        }}
        isLoading={deleteCampaignMutation.isPending}
      />
    </div>
  );
}