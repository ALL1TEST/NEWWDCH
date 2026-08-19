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
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  StatusBadge,
  PageHeader,
  ConfirmDialog,
} from '@/components/patterns';
import { getApi, postApi, deleteApi } from '@/lib/api-client';
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

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  recipientCount: number;
  openRate?: number;
  clickRate?: number;
  scheduledAt?: string;
  createdAt: string;
}

// -------------------- Campaign Create Form --------------------

interface CampaignForm {
  name: string;
  subject: string;
  content: string;
  scheduledAt: string;
}

const INITIAL_CAMPAIGN_FORM: CampaignForm = {
  name: '',
  subject: '',
  content: '',
  scheduledAt: '',
};

// -------------------- Campaign Status Options --------------------

const CAMPAIGN_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Sending', value: 'SENDING' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Failed', value: 'FAILED' },
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

  const createCampaignMutation = useMutation({
    mutationFn: (payload: CampaignForm) =>
      postApi('/api/campaigns', { ...payload, createdById: authUser?.id }),
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateCampaignMutation.mutate(row.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteCampaignTarget(row)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ],
    [duplicateCampaignMutation],
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
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Campaign</DialogTitle>
                  <DialogDescription>
                    Fill in the details below to create a new newsletter campaign.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="camp-name">Campaign Name</Label>
                    <Input
                      id="camp-name"
                      placeholder="e.g. Weekly Digest #42"
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="camp-subject">Subject Line</Label>
                    <Input
                      id="camp-subject"
                      placeholder="e.g. Your weekly updates"
                      value={campaignForm.subject}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, subject: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="camp-content">Content</Label>
                    <Textarea
                      id="camp-content"
                      placeholder="Write your newsletter content here..."
                      rows={6}
                      value={campaignForm.content}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, content: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="camp-schedule">Schedule (optional)</Label>
                    <Input
                      id="camp-schedule"
                      type="datetime-local"
                      value={campaignForm.scheduledAt}
                      onChange={(e) => setCampaignForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createCampaignMutation.mutate(campaignForm)}
                    disabled={createCampaignMutation.isPending || !campaignForm.name || !campaignForm.subject}
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