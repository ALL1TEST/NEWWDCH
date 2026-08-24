'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, Star, RefreshCw, Boxes, ChevronLeft, ChevronRight, Loader2, Plus, Pencil, Trash2, Type as TypeIcon,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns';

// -------------------- Types --------------------

interface AiModel {
  id: string;
  name: string;
  modelId: string;
  providerId: string;
  type: string; // TEXT | IMAGE
  provider?: { id: string; name: string; kind: string };
  contextLength: number | null;
  inputCostPer1k: number | null;
  outputCostPer1k: number | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AiProvider {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
}

const MODEL_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'IMAGE', label: 'Image' },
] as const;

const EMPTY_FORM = {
  name: '',
  modelId: '',
  providerId: '',
  type: 'TEXT' as 'TEXT' | 'IMAGE',
  isActive: true,
  isDefault: false,
};

// -------------------- Component --------------------

export function ModelsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AiModel | null>(null);

  // Fetch providers — also used for the filter and the Add/Edit dialog
  const { data: providersData } = useQuery({
    queryKey: queryKeys.aiProviders.list({ pageSize: 100 }),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', { pageSize: 100 }),
  });
  const providers = providersData?.data ?? [];

  // Fetch models
  const queryParams = useMemo(() => ({
    page, pageSize,
    search: search || undefined,
    providerId: providerFilter !== 'all' ? providerFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  }), [page, pageSize, search, providerFilter, typeFilter]);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.aiModels.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<AiModel>>('/api/ai/models', queryParams),
  });

  const models = data?.data ?? [];
  const pagination = data?.pagination;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => postApi('/api/ai/models', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      toast.success('Model created');
      setFormOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create model'),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY_FORM }) =>
      patchApi(`/api/ai/models/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      toast.success('Model updated');
      setFormOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update model'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/ai/models/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      toast.success('Model deleted');
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete model'),
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      patchApi(`/api/ai/models/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all }),
  });

  // Set default
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/ai/models/${id}`, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      toast.success('Default model updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to set default'),
  });

  // Sync all providers mutation (optional feature)
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const active = providers.filter((p) => p.isActive);
      let totalSynced = 0;
      for (const provider of active) {
        try {
          const res = await postApi<{ count?: number }>(`/api/ai/providers/${provider.id}/sync-models`);
          totalSynced += res?.count ?? 0;
        } catch { /* continue */ }
      }
      return totalSynced;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      toast.success(`Synced ${count} models across all providers`);
    },
    onError: (err: Error) => toast.error(err.message || 'Sync failed'),
  });

  const handleAdd = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormOpen(true);
  };

  const handleEdit = (model: AiModel) => {
    setEditingId(model.id);
    setFormData({
      name: model.name,
      modelId: model.modelId,
      providerId: model.providerId,
      type: (model.type?.toUpperCase() === 'IMAGE' ? 'IMAGE' : 'TEXT'),
      isActive: model.isActive,
      isDefault: model.isDefault,
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.modelId.trim() || !formData.providerId) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">AI Models</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Model
              </Button>
              <Button variant="outline" size="sm" onClick={() => syncAllMutation.mutate()} disabled={syncAllMutation.isPending}>
                {syncAllMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sync All
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search models..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="IMAGE">Image</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Model ID</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                    ))}</TableRow>
                  ))
                ) : isError ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-zinc-500">Failed to load models</TableCell></TableRow>
                ) : models.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                    <Boxes className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                    No models found. Click &quot;Add Model&quot; to create one manually.
                  </TableCell></TableRow>
                ) : models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">{model.name}</TableCell>
                    <TableCell><span className="font-mono text-xs text-muted-foreground">{model.modelId}</span></TableCell>
                    <TableCell>{model.provider?.name ?? model.providerId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={model.type?.toUpperCase() === 'IMAGE'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-transparent'}>
                        {model.type?.toUpperCase() === 'IMAGE' ? 'Image' : 'Text'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {model.isDefault ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Default</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDefaultMutation.mutate(model.id)} title="Set as default">
                          <Star className="h-3.5 w-3.5 text-zinc-400" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={model.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: model.id, isActive: checked })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(model)} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(model)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar />
          </ScrollArea>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-zinc-500">
                {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TypeIcon className="h-5 w-5" />
              {editingId ? 'Edit Model' : 'Add Model'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Update model details.' : 'Manually add a new AI model.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Model Name */}
            <div className="space-y-1.5">
              <Label>Model Name <span className="text-destructive">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. GPT-4o"
              />
            </div>

            {/* Model ID */}
            <div className="space-y-1.5">
              <Label>Model ID <span className="text-destructive">*</span></Label>
              <Input
                value={formData.modelId}
                onChange={(e) => setFormData((p) => ({ ...p, modelId: e.target.value }))}
                placeholder="e.g. gpt-4o"
                className="font-mono text-sm"
              />
            </div>

            {/* Provider */}
            <div className="space-y-1.5">
              <Label>Provider <span className="text-destructive">*</span></Label>
              <Select
                value={formData.providerId}
                onValueChange={(v) => setFormData((p) => ({ ...p, providerId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {providers.filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData((p) => ({ ...p, type: v as 'TEXT' | 'IMAGE' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODEL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active + Default toggles */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData((p) => ({ ...p, isActive: v }))} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.isDefault} onCheckedChange={(v) => setFormData((p) => ({ ...p, isDefault: v }))} />
                <Label>Set as Default</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? 'Save Changes' : 'Add Model'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Model"
        description={
          deleteTarget
            ? deleteTarget.isDefault
              ? `"${deleteTarget.name}" is currently the default model. Deleting it will clear the default setting. Are you sure you want to delete it?`
              : `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
