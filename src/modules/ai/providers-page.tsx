'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { AiProviderKind, AiConnectionStatus, PaginatedResponse, PaginationMeta } from '@/shared/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Zap,
  RefreshCw,
  Star,
  Eye,
  EyeOff,
  Server,
  Wifi,
  WifiOff,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

// -------------------- Types --------------------

interface AiProvider {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  apiKey: string | null;
  apiVersion: string | null;
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: AiConnectionStatus;
  latency: number | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProviderFormData {
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  isActive: boolean;
}

// -------------------- Constants --------------------

const PROVIDER_KINDS: AiProviderKind[] = [
  'OPENAI', 'ANTHROPIC', 'GEMINI', 'OPENROUTER', 'GROQ', 'DEEPSEEK', 'OLLAMA', 'AZURE_OPENAI',
];

const PROVIDER_CONFIGS: Record<AiProviderKind, { label: string; defaultUrl: string; color: string }> = {
  OPENAI: { label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', color: 'bg-emerald-100 text-emerald-700' },
  ANTHROPIC: { label: 'Anthropic', defaultUrl: 'https://api.anthropic.com/v1', color: 'bg-orange-100 text-orange-700' },
  GEMINI: { label: 'Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1', color: 'bg-sky-100 text-sky-700' },
  OPENROUTER: { label: 'OpenRouter', defaultUrl: 'https://openrouter.ai/api/v1', color: 'bg-violet-100 text-violet-700' },
  GROQ: { label: 'Groq', defaultUrl: 'https://api.groq.com/openai/v1', color: 'bg-rose-100 text-rose-700' },
  DEEPSEEK: { label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com/v1', color: 'bg-cyan-100 text-cyan-700' },
  OLLAMA: { label: 'Ollama', defaultUrl: 'http://localhost:11434/v1', color: 'bg-zinc-100 text-zinc-700' },
  AZURE_OPENAI: { label: 'Azure OpenAI', defaultUrl: '', color: 'bg-teal-100 text-teal-700' },
};

const CONNECTION_STATUS_CONFIG: Record<AiConnectionStatus, { color: string; label: string }> = {
  CONNECTED: { color: 'bg-green-500', label: 'Connected' },
  DISCONNECTED: { color: 'bg-zinc-400', label: 'Disconnected' },
  ERROR: { color: 'bg-red-500', label: 'Error' },
};

const emptyForm: ProviderFormData = {
  name: '',
  kind: 'OPENAI',
  baseUrl: PROVIDER_CONFIGS.OPENAI.defaultUrl,
  apiKey: '',
  apiVersion: '',
  isActive: true,
};

// -------------------- Component --------------------

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(emptyForm);
  const [showApiKey, setShowApiKey] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState<AiProvider | null>(null);

  // Fetch providers
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.aiProviders.list({ page, pageSize, search, kind: kindFilter, connectionStatus: statusFilter }),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', {
      page,
      pageSize,
      search: search || undefined,
      kind: kindFilter !== 'all' ? kindFilter : undefined,
      connectionStatus: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const providers = data?.data ?? [];
  const pagination = data?.pagination;

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: (body: ProviderFormData) => {
      if (editingProvider) {
        const patchBody: Record<string, unknown> = { ...body };
        if (!patchBody.apiKey) delete patchBody.apiKey;
        return patchApi<AiProvider>(`/api/ai/providers/${editingProvider.id}`, patchBody);
      }
      return postApi<AiProvider>('/api/ai/providers', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      toast.success(editingProvider ? 'Provider updated' : 'Provider created');
      handleCloseDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save provider');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/ai/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      toast.success('Provider deleted');
      setDeleteDialogOpen(false);
      setDeletingProvider(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete provider');
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/providers/${id}/test`),
    onSuccess: (result: unknown) => {
      const res = result as { success?: boolean; latency?: number; message?: string };
      if (res.success) {
        toast.success(`Connection successful (${res.latency ?? 0}ms)`);
      } else {
        toast.error(res.message || 'Connection failed');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Connection test failed');
    },
  });

  // Sync models mutation
  const syncMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/providers/${id}/sync-models`),
    onSuccess: (result: unknown) => {
      const res = result as { count?: number };
      toast.success(`Synced ${res.count ?? 0} models`);
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to sync models');
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/providers/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      toast.success('Default provider updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to set default');
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      patchApi(`/api/ai/providers/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update provider');
    },
  });

  // Handlers
  const handleOpenCreate = () => {
    setEditingProvider(null);
    setFormData(emptyForm);
    setShowApiKey(false);
    setDialogOpen(true);
  };

  const handleOpenEdit = (provider: AiProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      apiKey: '', // masked in edit
      apiVersion: provider.apiVersion ?? '',
      isActive: provider.isActive,
    });
    setShowApiKey(false);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProvider(null);
    setFormData(emptyForm);
    setShowApiKey(false);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleKindChange = (kind: string) => {
    const providerKind = kind as AiProviderKind;
    setFormData((prev) => ({
      ...prev,
      kind: providerKind,
      baseUrl: PROVIDER_CONFIGS[providerKind].defaultUrl,
    }));
  };

  // KPI calculations
  const totalProviders = pagination?.total ?? 0;
  const connectedCount = providers.filter((p) => p.connectionStatus === 'CONNECTED').length;
  const defaultProvider = providers.find((p) => p.isDefault);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-zinc-100">
              <Server className="h-5 w-5 text-zinc-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total Providers</p>
              <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : totalProviders}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-green-100">
              <Wifi className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Connected</p>
              <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : connectedCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-amber-100">
              <Star className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Default Provider</p>
              <div className="text-lg font-bold truncate max-w-[200px]">{isLoading ? <Skeleton className="h-6 w-32 inline-block" /> : defaultProvider?.name ?? 'None'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">AI Providers</CardTitle>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search providers..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={kindFilter} onValueChange={(v) => { setKindFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Provider Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Kinds</SelectItem>
                {PROVIDER_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{PROVIDER_CONFIGS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="CONNECTED">Connected</SelectItem>
                <SelectItem value="DISCONNECTED">Disconnected</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Latency</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Sync</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                      Failed to load providers
                    </TableCell>
                  </TableRow>
                ) : providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      <Server className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                      No providers found. Click &quot;Add Provider&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((provider) => {
                    const kindConfig = PROVIDER_CONFIGS[provider.kind];
                    const statusConfig = CONNECTION_STATUS_CONFIG[provider.connectionStatus];
                    return (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={kindConfig.color}>
                            {kindConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${statusConfig.color}`} />
                            <span className="text-sm">{statusConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {provider.latency != null ? `${provider.latency}ms` : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-zinc-500">
                          {provider.lastSyncAt
                            ? new Date(provider.lastSyncAt).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {provider.isDefault && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                              Default
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={provider.isActive}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ id: provider.id, isActive: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => testMutation.mutate(provider.id)} disabled={testMutation.isPending}>
                                <Zap className="h-4 w-4 mr-2" />
                                Test Connection
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => syncMutation.mutate(provider.id)} disabled={syncMutation.isPending}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Sync Models
                              </DropdownMenuItem>
                              {!provider.isDefault && (
                                <DropdownMenuItem onClick={() => setDefaultMutation.mutate(provider.id)}>
                                  <Star className="h-4 w-4 mr-2" />
                                  Set Default
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleOpenEdit(provider)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => { setDeletingProvider(provider); setDeleteDialogOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <ScrollBar />
          </ScrollArea>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-zinc-500">
                Showing {(pagination.page - 1) * pagination.pageSize + 1}–
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Page {pagination.page} of {pagination.totalPages}</span>
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider-name">Name</Label>
              <Input
                id="provider-name"
                placeholder="e.g. My OpenAI"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-kind">Provider Kind</Label>
              <Select value={formData.kind} onValueChange={handleKindChange}>
                <SelectTrigger id="provider-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{PROVIDER_CONFIGS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-url">Base URL</Label>
              <Input
                id="provider-url"
                placeholder="https://api.openai.com/v1"
                value={formData.baseUrl}
                onChange={(e) => setFormData((p) => ({ ...p, baseUrl: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-key">API Key</Label>
              <div className="relative">
                <Input
                  id="provider-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={editingProvider ? 'Leave blank to keep existing key' : 'sk-...'}
                  value={formData.apiKey}
                  onChange={(e) => setFormData((p) => ({ ...p, apiKey: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {formData.kind === 'AZURE_OPENAI' && (
              <div className="grid gap-2">
                <Label htmlFor="provider-version">API Version</Label>
                <Input
                  id="provider-version"
                  placeholder="2024-02-01"
                  value={formData.apiVersion}
                  onChange={(e) => setFormData((p) => ({ ...p, apiVersion: e.target.value }))}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-active">Active</Label>
              <Switch
                id="provider-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProvider ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingProvider?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingProvider && deleteMutation.mutate(deletingProvider.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
