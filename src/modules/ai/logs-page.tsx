'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Search, ChevronLeft, ChevronRight, Download, FileText, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

// -------------------- Types --------------------

interface AiLog {
  id: string;
  question: string;
  response: string;
  provider: string;
  model: string;
  providerId: string;
  modelId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  durationMs: number | null;
  status: 'success' | 'error';
  errorMessage: string | null;
  createdAt: string;
}

interface AiProvider {
  id: string;
  name: string;
}

interface AiModel {
  id: string;
  name: string;
  providerId: string;
}

// -------------------- Component --------------------

export function LogsPage() {
  const { t } = useT();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<AiLog | null>(null);

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: queryKeys.aiProviders.list(),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', { pageSize: 100 }),
  });
  const providers = providersData?.data ?? [];

  // Fetch models for filter
  const { data: modelsData } = useQuery({
    queryKey: queryKeys.aiModels.list({ providerId: providerFilter !== 'all' ? providerFilter : undefined }),
    queryFn: () => getApi<PaginatedResponse<AiModel>>('/api/ai/models', {
      providerId: providerFilter !== 'all' ? providerFilter : undefined,
      pageSize: 200,
    }),
  });
  const models = modelsData?.data ?? [];

  // Fetch logs
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.aiLogs.list({ page, pageSize, search, status: statusFilter, providerId: providerFilter, modelId: modelFilter }),
    queryFn: () => getApi<PaginatedResponse<AiLog>>('/api/ai/logs', {
      page, pageSize,
      search: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      providerId: providerFilter !== 'all' ? providerFilter : undefined,
      modelId: modelFilter !== 'all' ? modelFilter : undefined,
    }),
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  const handleExportCsv = async () => {
    try {
      const blob = await getApi<Blob>('/api/ai/logs/export', {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        providerId: providerFilter !== 'all' ? providerFilter : undefined,
        modelId: modelFilter !== 'all' ? modelFilter : undefined,
      }, { raw: true });
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('ai.csvExported'));
    } catch {
      toast.error(t('ai.failedToExportCsv'));
    }
  };

  const truncate = (str: string, len: number) => {
    if (!str) return '—';
    return str.length > len ? str.slice(0, len) + '...' : str;
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{t('ai.logsTitle')}</h2>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-2" /> {t('ai.exportCsv')}
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder={t('ai.searchLogs')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.all')}</SelectItem>
                <SelectItem value="success">{t('ai.success')}</SelectItem>
                <SelectItem value="error">{t('ai.error')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setModelFilter('all'); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[170px]"><SelectValue placeholder={t('ai.provider')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.allProviders')}</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modelFilter} onValueChange={(v) => { setModelFilter(v); setPage(1); }} disabled={providerFilter === 'all'}>
              <SelectTrigger className="w-full sm:w-[170px]"><SelectValue placeholder={providerFilter !== 'all' ? t('ai.model') : t('ai.selectProviderFirst')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.allModels')}</SelectItem>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ai.question')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('ai.response')}</TableHead>
                  <TableHead>{t('ai.provider')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('ai.model')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('ai.inTok')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('ai.outTok')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('ai.cost')}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t('ai.duration')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t('ai.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                    ))}</TableRow>
                  ))
                ) : isError ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-zinc-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" /> {t('ai.failedToLoadLogs')}
                  </TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-zinc-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-zinc-300" /> {t('ai.noLogs')}
                  </TableCell></TableRow>
                ) : logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedLog(log)}
                  >
                    <TableCell className="max-w-[200px]"><p className="text-sm truncate">{truncate(log.question, 50)}</p></TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[200px]"><p className="text-sm truncate text-zinc-500">{truncate(log.response, 50)}</p></TableCell>
                    <TableCell className="text-sm">{log.provider}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm max-w-[120px] truncate">{log.model}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{log.inputTokens?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{log.outputTokens?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{log.cost != null ? `$${log.cost.toFixed(4)}` : '—'}</TableCell>
                    <TableCell className="hidden xl:table-cell text-sm">{log.durationMs != null ? `${(log.durationMs / 1000).toFixed(1)}s` : '—'}</TableCell>
                    <TableCell>
                      {log.status === 'success' ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />{t('ai.ok')}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-700"><AlertCircle className="h-3 w-3 mr-1" />{t('ai.err')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-zinc-500">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar />
          </ScrollArea>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-zinc-500">{(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} {t('common.of')} {pagination.total}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={!!expandedLog} onOpenChange={(open) => { if (!open) setExpandedLog(null); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('ai.logDetail')}</DialogTitle>
          </DialogHeader>
          {expandedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><p className="text-xs text-zinc-500">{t('common.status')}</p><Badge variant="secondary" className={expandedLog.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}>{expandedLog.status}</Badge></div>
                <div><p className="text-xs text-zinc-500">{t('ai.provider')}</p><p className="text-sm font-medium">{expandedLog.provider}</p></div>
                <div><p className="text-xs text-zinc-500">{t('ai.model')}</p><p className="text-sm font-medium">{expandedLog.model}</p></div>
                <div><p className="text-xs text-zinc-500">{t('ai.cost')}</p><p className="text-sm font-medium">{expandedLog.cost != null ? `$${expandedLog.cost.toFixed(4)}` : '—'}</p></div>
                <div><p className="text-xs text-zinc-500">{t('ai.inputTokens')}</p><p className="text-sm font-medium">{expandedLog.inputTokens?.toLocaleString() ?? '—'}</p></div>
                <div><p className="text-xs text-zinc-500">{t('ai.outputTokens')}</p><p className="text-sm font-medium">{expandedLog.outputTokens?.toLocaleString() ?? '—'}</p></div>
                <div><p className="text-xs text-zinc-500">{t('ai.duration')}</p><p className="text-sm font-medium">{expandedLog.durationMs != null ? `${(expandedLog.durationMs / 1000).toFixed(2)}s` : '—'}</p></div>
                <div><p className="text-xs text-zinc-500">{t('ai.date')}</p><p className="text-sm font-medium">{new Date(expandedLog.createdAt).toLocaleString()}</p></div>
              </div>
              {expandedLog.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-600 mb-1">{t('ai.error')}</p>
                  <p className="text-sm text-red-700">{expandedLog.errorMessage}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">{t('ai.question')}</p>
                <div className="bg-zinc-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{expandedLog.question || '—'}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">{t('ai.response')}</p>
                <div className="bg-zinc-50 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">{expandedLog.response || '—'}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
