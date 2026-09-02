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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useT } from '@/lib/i18n';
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
  HelpCircle,
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
  apiKeyMasked: string | null;
  apiVersion: string | null;
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: AiConnectionStatus;
  latencyMs: number | null;
  lastSyncAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
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

// Provider kinds that can be selected when creating/editing a provider.
// Legacy kinds (OPENROUTER, OLLAMA, AZURE_OPENAI) are kept in PROVIDER_CONFIGS
// for display of existing rows but are no longer selectable.
const PROVIDER_KINDS: AiProviderKind[] = [
  'OPENAI', 'ANTHROPIC', 'GEMINI', 'GROQ', 'DEEPSEEK', 'CUSTOM',
];

// NOTE: typed as `Record<string, ...>` (not `Record<AiProviderKind, ...>`) because
// legacy kinds (OPENROUTER, OLLAMA, AZURE_OPENAI) are kept here for display of
// existing rows but are no longer part of the `AiProviderKind` union.
const PROVIDER_CONFIGS: Record<string, { label: string; defaultUrl: string; color: string }> = {
  OPENAI: { label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  ANTHROPIC: { label: 'Anthropic', defaultUrl: 'https://api.anthropic.com/v1', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  GEMINI: { label: 'Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  OPENROUTER: { label: 'OpenRouter', defaultUrl: 'https://openrouter.ai/api/v1', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  GROQ: { label: 'Groq', defaultUrl: 'https://api.groq.com/openai/v1', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  DEEPSEEK: { label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com/v1', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  OLLAMA: { label: 'Ollama', defaultUrl: 'http://localhost:11434/v1', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  AZURE_OPENAI: { label: 'Azure OpenAI', defaultUrl: '', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  CUSTOM: { label: 'Custom', defaultUrl: '', color: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
};

function kindConfig(kind: string): { label: string; color: string } {
  const cfg = PROVIDER_CONFIGS[kind];
  return cfg ?? { label: kind, color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' };
}

// -------------------- Error Diagnostic Parser --------------------
// Parses the `lastError` string (stored by healthCheck as "HTTP {status}: {body}")
// and returns structured, user-friendly diagnostic info. NEVER exposes API keys.

interface ErrorDiagnostic {
  httpStatus: number | null;
  errorType: string | null;       // e.g. "authentication_error", "request_forbidden"
  errorMessage: string | null;    // the provider's own message
  category: string;               // our human-readable category
  suggestion: string | null;      // suggested fix
  rawSnippet: string | null;      // truncated sanitized raw error (no keys)
}

// Patterns that look like API keys or secrets — stripped from any displayed text
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9-_]{8,}/gi,
  /sk-ant-[a-zA-Z0-9-_]{8,}/gi,
  /Bearer\s+[a-zA-Z0-9-_]{8,}/gi,
  /api[_-]?key[=:]\s*["']?[a-zA-Z0-9-_]{8,}["']?/gi,
  /x-api-key:\s*[a-zA-Z0-9-_]{8,}/gi,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g, // base64-looking blobs
];

function sanitizeSecrets(text: string): string {
  let cleaned = text;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  return cleaned;
}

function parseErrorDiagnostic(lastError: string | null, t: (key: string) => string): ErrorDiagnostic | null {
  if (!lastError || lastError.trim() === '') return null;

  const sanitized = sanitizeSecrets(lastError);

  // Extract HTTP status: pattern is "HTTP {status}:" or "HTTP {status} "
  const statusMatch = sanitized.match(/HTTP\s+(\d{3})/i);
  const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : null;

  // Try to parse the JSON body after "HTTP {status}:"
  let errorType: string | null = null;
  let errorMessage: string | null = null;
  let rawSnippet: string | null = null;

  const bodyMatch = sanitized.match(/HTTP\s+\d{3}\s*:?\s*([\s\S]*)/i);
  if (bodyMatch && bodyMatch[1]) {
    const bodyStr = bodyMatch[1].trim();
    try {
      const parsed = JSON.parse(bodyStr);
      if (parsed?.error?.message) errorMessage = sanitizeSecrets(String(parsed.error.message));
      if (parsed?.error?.type) errorType = sanitizeSecrets(String(parsed.error.type));
      if (parsed?.error?.code && !errorType) errorType = sanitizeSecrets(String(parsed.error.code));
    } catch {
      // Not JSON — use the raw body (sanitized) as the message
      if (bodyStr) errorMessage = sanitizeSecrets(bodyStr.slice(0, 200));
    }
  } else {
    // No HTTP status prefix — use the raw error string
    errorMessage = sanitizeSecrets(sanitized.slice(0, 200));
  }

  rawSnippet = sanitized.slice(0, 300);

  // Map HTTP status → category + suggestion
  let category = t('ai.diagConnectionError');
  let suggestion: string | null = null;

  if (httpStatus !== null) {
    if (httpStatus === 401) {
      category = t('ai.diagAuthFailed');
      suggestion = t('ai.diagAuthFailedSuggestion');
    } else if (httpStatus === 403) {
      category = t('ai.diagAccessDenied');
      suggestion = t('ai.diagAccessDeniedSuggestion');
    } else if (httpStatus === 404) {
      category = t('ai.diagEndpointNotFound');
      suggestion = t('ai.diagEndpointNotFoundSuggestion');
    } else if (httpStatus === 429) {
      category = t('ai.diagRateLimit');
      suggestion = t('ai.diagRateLimitSuggestion');
    } else if (httpStatus >= 500) {
      category = `${t('ai.diagProviderServerErrorPrefix')} (${httpStatus})`;
      suggestion = t('ai.diagProviderServerErrorSuggestion');
    } else if (httpStatus >= 400) {
      category = `${t('ai.diagRequestErrorPrefix')} (${httpStatus})`;
      suggestion = t('ai.diagRequestErrorSuggestion');
    }
  } else {
    // No HTTP status — likely a network/timeout error
    const lower = sanitized.toLowerCase();
    if (lower.includes('timeout') || lower.includes('timed out')) {
      category = t('ai.diagTimeout');
      suggestion = t('ai.diagTimeoutSuggestion');
    } else if (lower.includes('fetch failed') || lower.includes('enotfound') || lower.includes('econnrefused') || lower.includes('network')) {
      category = t('ai.diagNetworkError');
      suggestion = t('ai.diagNetworkSuggestion');
    } else if (lower.includes('ssl') || lower.includes('certificate')) {
      category = t('ai.diagSslError');
      suggestion = t('ai.diagSslSuggestion');
    }
  }

  return { httpStatus, errorType, errorMessage, category, suggestion, rawSnippet };
}

// Format the lastHealthCheckAt timestamp for display
function formatLastAttempt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return null;
  }
}

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
  const { t } = useT();

  // Connection status badge labels/colors — inside the component so the
  // labels resolve through t() for the active locale.
  const CONNECTION_STATUS_CONFIG: Record<AiConnectionStatus, { color: string; label: string }> = {
    CONNECTED: { color: 'bg-green-500', label: t('ai.connected') },
    DISCONNECTED: { color: 'bg-zinc-400', label: t('ai.disconnected') },
    ERROR: { color: 'bg-red-500', label: t('ai.error') },
  };

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
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      toast.success(editingProvider ? t('ai.providerUpdated') : t('ai.providerCreated'));
      handleCloseDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || t('ai.failedToSaveProvider'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/ai/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiLogs.all });
      toast.success(t('ai.providerDeleted'));
      setDeleteDialogOpen(false);
      setDeletingProvider(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || t('ai.failedToDeleteProvider'));
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/providers/${id}/test`),
    onSuccess: (result: unknown) => {
      const res = result as { success?: boolean; latency?: number; message?: string; status?: string };
      if (res.success) {
        toast.success(`${t('ai.connectionSuccessful')} (${res.latency ?? 0}ms)`);
      } else {
        toast.error(res.message || `${t('ai.connectionPrefix')}${res.status || t('ai.failedWord')}`);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('ai.connectionTestFailed'));
    },
  });

  // Sync models mutation
  const syncMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/providers/${id}/sync-models`),
    onSuccess: (result: unknown) => {
      const res = result as { syncedCount?: number; count?: number };
      toast.success(`${t('ai.syncedPrefix')} ${res.syncedCount ?? res.count ?? 0} ${t('ai.modelsSuffix')}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('ai.failedToSyncModels'));
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/providers/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiLogs.all });
      toast.success(t('ai.defaultProviderUpdated'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('ai.failedToSetDefault'));
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      patchApi(`/api/ai/providers/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('ai.failedToUpdateProvider'));
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
      toast.error(t('ai.nameRequired'));
      return;
    }
    if (!editingProvider && !formData.apiKey.trim()) {
      toast.error(t('ai.apiKeyRequired'));
      return;
    }
    // CUSTOM providers require a Base URL
    if (formData.kind === 'CUSTOM' && !formData.baseUrl.trim()) {
      toast.error(t('ai.baseUrlRequiredForCustom'));
      return;
    }
    // Validate Base URL format for CUSTOM providers
    if (formData.kind === 'CUSTOM' && formData.baseUrl.trim()) {
      try {
        const u = new URL(formData.baseUrl);
        if (!['http:', 'https:'].includes(u.protocol)) {
          toast.error(t('ai.baseUrlProtocol'));
          return;
        }
      } catch {
        toast.error(t('ai.baseUrlInvalid'));
        return;
      }
    }
    saveMutation.mutate(formData);
  };

  const handleKindChange = (kind: string) => {
    const providerKind = kind as AiProviderKind;
    const prevDefaultUrl = PROVIDER_CONFIGS[formData.kind]?.defaultUrl ?? '';
    setFormData((prev) => ({
      ...prev,
      kind: providerKind,
      baseUrl:
        !prev.baseUrl || prev.baseUrl === prevDefaultUrl
          ? PROVIDER_CONFIGS[providerKind].defaultUrl
          : prev.baseUrl,
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
              <Server className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t('ai.totalProviders')}</p>
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
              <p className="text-sm text-zinc-500">{t('ai.connected')}</p>
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
              <p className="text-sm text-zinc-500">{t('ai.defaultProvider')}</p>
              <div className="text-lg font-bold truncate max-w-[200px]">{isLoading ? <Skeleton className="h-6 w-32 inline-block" /> : defaultProvider?.name ?? t('ai.none')}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">{t('ai.providersTitle')}</CardTitle>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('ai.addProvider')}
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder={t('ai.searchProviders')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={kindFilter} onValueChange={(v) => { setKindFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('ai.providerKind')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.allKinds')}</SelectItem>
                {PROVIDER_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{k === 'CUSTOM' ? t('ai.custom') : PROVIDER_CONFIGS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.allStatus')}</SelectItem>
                <SelectItem value="CONNECTED">{t('ai.connected')}</SelectItem>
                <SelectItem value="DISCONNECTED">{t('ai.disconnected')}</SelectItem>
                <SelectItem value="ERROR">{t('ai.error')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('ai.kind')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('ai.latency')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('ai.lastSync')}</TableHead>
                  <TableHead>{t('ai.default')}</TableHead>
                  <TableHead>{t('common.active')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
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
                      {t('ai.failedToLoadProviders')}
                    </TableCell>
                  </TableRow>
                ) : providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      <Server className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                      {t('ai.noProvidersHint')}
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((provider) => {
                    const kc = kindConfig(provider.kind);
                    const statusConfig = CONNECTION_STATUS_CONFIG[provider.connectionStatus]
                      ?? { color: 'bg-zinc-400', label: provider.connectionStatus || t('ai.unknown') };
                    const errorDiag = provider.connectionStatus === 'ERROR'
                      ? parseErrorDiagnostic(provider.lastError, t)
                      : null;
                    const lastAttempt = formatLastAttempt(provider.lastHealthCheckAt);
                    return (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={kc.color}>
                            {provider.kind === 'CUSTOM' ? t('ai.custom') : kc.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded-full ${statusConfig.color}`} />
                            <span className="text-sm">{statusConfig.label}</span>
                            {errorDiag && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={t('ai.viewErrorDetails')}
                                  >
                                    <HelpCircle className="h-3.5 w-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="top"
                                  align="start"
                                  sideOffset={4}
                                  className="w-[300px] max-w-[calc(100vw-2rem)] p-3"
                                >
                                  <div className="space-y-2 text-xs">
                                    <div className="font-medium text-destructive flex items-center gap-1.5">
                                      <AlertCircle className="h-3.5 w-3.5" />
                                      {errorDiag.category}
                                    </div>
                                    {errorDiag.errorMessage && (
                                      <div className="text-muted-foreground">
                                        <span className="font-medium text-foreground">{t('ai.diagMessage')} </span>
                                        {errorDiag.errorMessage}
                                      </div>
                                    )}
                                    {errorDiag.errorType && (
                                      <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
                                        <span className="font-medium text-foreground">{t('ai.diagType')}</span>
                                        <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{errorDiag.errorType}</code>
                                      </div>
                                    )}
                                    {provider.baseUrl && (
                                      <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
                                        <span className="font-medium text-foreground">{t('ai.diagEndpoint')}</span>
                                        <code className="bg-muted px-1 py-0.5 rounded text-[10px] break-all">{provider.baseUrl}</code>
                                      </div>
                                    )}
                                    {lastAttempt && (
                                      <div className="text-muted-foreground">
                                        <span className="font-medium text-foreground">{t('ai.diagLastAttempt')} </span>
                                        {lastAttempt}
                                      </div>
                                    )}
                                    {errorDiag.suggestion && (
                                      <div className="text-muted-foreground border-t pt-2 mt-2">
                                        <span className="font-medium text-foreground">{t('ai.diagSuggestedFix')} </span>
                                        {errorDiag.suggestion}
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {provider.latencyMs != null ? `${provider.latencyMs}ms` : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-zinc-500">
                          {provider.lastSyncAt
                            ? new Date(provider.lastSyncAt).toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {provider.isDefault && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                              {t('ai.default')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={provider.isActive}
                            disabled={
                              toggleActiveMutation.isPending &&
                              toggleActiveMutation.variables?.id === provider.id
                            }
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
                              <DropdownMenuItem
                                onClick={() => testMutation.mutate(provider.id)}
                                disabled={testMutation.variables === provider.id && testMutation.isPending}
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                {t('ai.testConnection')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => syncMutation.mutate(provider.id)}
                                disabled={syncMutation.variables === provider.id && syncMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                {t('ai.syncModels')}
                              </DropdownMenuItem>
                              {!provider.isDefault && (
                                <DropdownMenuItem onClick={() => setDefaultMutation.mutate(provider.id)}>
                                  <Star className="h-4 w-4 mr-2" />
                                  {t('ai.setDefault')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleOpenEdit(provider)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => { setDeletingProvider(provider); setDeleteDialogOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('common.delete')}
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
                {t('common.showing')} {(pagination.page - 1) * pagination.pageSize + 1}–
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} {t('common.of')} {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{t('ai.pageLabel')} {pagination.page} {t('common.of')} {pagination.totalPages}</span>
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
            <DialogTitle>{editingProvider ? t('ai.editProvider') : t('ai.addProvider')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider-name">{t('common.name')}</Label>
              <Input
                id="provider-name"
                placeholder={t('ai.namePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-kind">{t('ai.providerKind')}</Label>
              <Select value={formData.kind} onValueChange={handleKindChange}>
                <SelectTrigger id="provider-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{k === 'CUSTOM' ? t('ai.custom') : PROVIDER_CONFIGS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-url">
                {t('ai.baseUrl')}{formData.kind === 'CUSTOM' ? ' *' : ''}
              </Label>
              <Input
                id="provider-url"
                placeholder={formData.kind === 'CUSTOM' ? 'https://api.example.com/v1' : 'https://api.openai.com/v1'}
                value={formData.baseUrl}
                onChange={(e) => setFormData((p) => ({ ...p, baseUrl: e.target.value }))}
                required={formData.kind === 'CUSTOM'}
              />
              {formData.kind === 'CUSTOM' && (
                <p className="text-xs text-muted-foreground">
                  {t('ai.baseUrlHint')}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-key">{t('ai.apiKey')}</Label>
              <div className="relative">
                <Input
                  id="provider-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={editingProvider ? t('ai.apiKeyKeepPlaceholder') : 'sk-...'}
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
              {editingProvider && (
                <p className="text-xs text-muted-foreground">
                  {t('ai.apiKeyHint')}
                </p>
              )}
            </div>
            {formData.kind === 'AZURE_OPENAI' && (
              <p className="text-xs text-muted-foreground">
                {t('ai.azureLegacyNote')}
              </p>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-active">{t('common.active')}</Label>
              <Switch
                id="provider-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProvider ? t('ai.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ai.deleteProvider')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ai.deleteConfirmPrefix')}{deletingProvider?.name}{t('ai.deleteConfirmSuffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingProvider && deleteMutation.mutate(deletingProvider.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
