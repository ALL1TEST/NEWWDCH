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
import { useT } from '@/lib/i18n';

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
  { value: 'TEXT', labelKey: 'ai.textType' },
  { value: 'IMAGE', labelKey: 'ai.imageType' },
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
  const { t } = useT();
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
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiLogs.all });
      toast.success(t('ai.modelCreated'));
      setFormOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToCreateModel')),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY_FORM }) =>
      patchApi(`/api/ai/models/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiLogs.all });
      toast.success(t('ai.modelUpdated'));
      setFormOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToUpdateModel')),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/ai/models/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiLogs.all });
      toast.success(t('ai.modelDeleted'));
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToDeleteModel')),
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      patchApi(`/api/ai/models/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiLogs.all });
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToUpdateModel')),
  });

  // Set default
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/ai/models/${id}`, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiLogs.all });
      toast.success(t('ai.defaultModelUpdated'));
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToSetDefault')),
  });

  // Sync all providers mutation (optional feature)
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const active = providers.filter((p) => p.isActive);
      let totalSynced = 0;
      const failed: string[] = [];
      for (const provider of active) {
        try {
          const res = await postApi<{ syncedCount?: number; count?: number }>(`/api/ai/providers/${provider.id}/sync-models`);
          totalSynced += res?.syncedCount ?? res?.count ?? 0;
        } catch {
          failed.push(provider.name);
        }
      }
      return { totalSynced, failed };
    },
    onSuccess: ({ totalSynced, failed }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      if (failed.length > 0) {
        toast.warning(`${t('ai.syncedPrefix')} ${totalSynced} ${t('ai.modelsSuffix')}. ${t('ai.syncFailedListPrefix')} ${failed.join(', ')}`);
      } else {
        toast.success(`${t('ai.syncedPrefix')} ${totalSynced} ${t('ai.modelsAcrossProvidersSuffix')}`);
      }
    },
    onError: (err: Error) => toast.error(err.message || t('ai.syncFailed')),
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
      toast.error(t('ai.fillRequiredFields'));
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
            <h2 className="text-lg font-semibold">{t('ai.modelsTitle')}</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                {t('ai.addModel')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => syncAllMutation.mutate()} disabled={syncAllMutation.isPending}>
                {syncAllMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {t('ai.syncAll')}
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder={t('ai.searchModels')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('ai.provider')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.allProviders')}</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder={t('ai.type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.allTypes')}</SelectItem>
                <SelectItem value="TEXT">{t('ai.textType')}</SelectItem>
                <SelectItem value="IMAGE">{t('ai.imageType')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ai.modelName')}</TableHead>
                <TableHead>{t('ai.modelId')}</TableHead>
                <TableHead>{t('ai.provider')}</TableHead>
                <TableHead>{t('ai.type')}</TableHead>
                <TableHead>{t('ai.default')}</TableHead>
                <TableHead>{t('common.active')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-zinc-500">{t('ai.failedToLoadModels')}</TableCell></TableRow>
              ) : models.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                  <Boxes className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                  {t('ai.noModelsHint')}
                </TableCell></TableRow>
              ) : models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium">{model.name}</TableCell>
                  <TableCell><span className="font-mono text-xs text-muted-foreground">{model.modelId}</span></TableCell>
                  <TableCell>{model.provider?.name ?? t('ai.unknownProvider')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={model.type?.toUpperCase() === 'IMAGE'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-transparent'}>
                      {model.type?.toUpperCase() === 'IMAGE' ? t('ai.imageType') : t('ai.textType')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {model.isDefault ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('ai.default')}</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDefaultMutation.mutate(model.id)} title={t('ai.setAsDefault')}>
                        <Star className="h-3.5 w-3.5 text-zinc-400" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={model.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: model.id, isActive: checked })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(model)} title={t('common.edit')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(model)} title={t('common.delete')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-zinc-500">
                {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} {t('common.of')} {pagination.total}
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
              {editingId ? t('ai.editModel') : t('ai.addModel')}
            </DialogTitle>
            <DialogDescription>
              {editingId ? t('ai.editModelDesc') : t('ai.addModelDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Model Name */}
            <div className="space-y-1.5">
              <Label>{t('ai.modelName')} <span className="text-destructive">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('ai.modelNamePlaceholder')}
              />
            </div>

            {/* Model ID */}
            <div className="space-y-1.5">
              <Label>{t('ai.modelId')} <span className="text-destructive">*</span></Label>
              <Input
                value={formData.modelId}
                onChange={(e) => setFormData((p) => ({ ...p, modelId: e.target.value }))}
                placeholder={t('ai.modelIdPlaceholder')}
                className="font-mono text-sm"
              />
            </div>

            {/* Provider */}
            <div className="space-y-1.5">
              <Label>{t('ai.provider')} <span className="text-destructive">*</span></Label>
              <Select
                value={formData.providerId}
                onValueChange={(v) => setFormData((p) => ({ ...p, providerId: v }))}
              >
                <SelectTrigger><SelectValue placeholder={t('ai.selectProvider')} /></SelectTrigger>
                <SelectContent>
                  {providers.filter((p) => p.isActive || p.id === formData.providerId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>{t('ai.type')} <span className="text-destructive">*</span></Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData((p) => ({ ...p, type: v as 'TEXT' | 'IMAGE' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODEL_TYPES.map((mt) => (
                    <SelectItem key={mt.value} value={mt.value}>{t(mt.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active + Default toggles */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData((p) => ({ ...p, isActive: v }))} />
                <Label>{t('common.active')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.isDefault} onCheckedChange={(v) => setFormData((p) => ({ ...p, isDefault: v }))} />
                <Label>{t('ai.setAsDefaultLabel')}</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? t('common.saveChanges') : t('ai.addModel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('ai.deleteModel')}
        description={
          deleteTarget
            ? deleteTarget.isDefault
              ? `${t('ai.deleteModelDefaultPrefix')}${deleteTarget.name}${t('ai.deleteModelDefaultSuffix')}`
              : `${t('ai.deleteConfirmPrefix')}${deleteTarget.name}${t('ai.deleteConfirmSuffix')}`
            : undefined
        }
        confirmLabel={t('common.delete')}
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
