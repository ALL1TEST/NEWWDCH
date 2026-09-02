'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  RotateCcw,
  ShieldCheck,
  HardDrive,
  Loader2,
  AlertTriangle,
  ChevronRight,
  DatabaseBackup,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { PageHeader, StatusBadge } from '@/components/patterns';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatFileSize, formatRelativeTime, labelize } from '@/lib/utils';
import type { ApiResponse, BackupScope, BackupStatus } from '@/shared/types';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';
import { PlatformPageHeader } from '@/modules/platform/shared';
import { useT } from '@/lib/i18n';

// -------------------- Types --------------------

interface BackupOption {
  id: string;
  name: string;
  scope: BackupScope;
  size: number;
  status: BackupStatus;
  verificationStatus: string | null;
  createdAt: string;
}

interface BackupDetail extends BackupOption {
  note: string | null;
  type: string;
  storageProvider: string;
  encryptionStatus: string;
  durationMs: number | null;
  checksum: string | null;
  storagePath: string | null;
}

// -------------------- Animation Variants --------------------

const stepVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// -------------------- Restore Page --------------------

export function RestorePage({ scope = 'client' }: { scope?: 'client' | 'platform' } = {}) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const isPlatform = scope === 'platform';
  const { t } = useT();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedBackupId, setSelectedBackupId] = useState<string>('');
  const [confirmed, setConfirmed] = useState(false);

  // Fetch completed backups for selection
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.backups.list({
      status: 'COMPLETED',
      // Include scope in the cache key so client and platform entries do
      // not collide. The value here is opaque to TanStack Query.
      scope: isPlatform ? 'platform' : undefined,
    }),
    queryFn: () => getApi<ApiResponse<BackupOption[]>>('/api/backups', {
      status: 'COMPLETED',
      pageSize: 100,
      sort: 'createdAt',
      order: 'desc',
      ...(isPlatform ? { scope: 'platform' } : {}),
    }, { raw: true }),
    staleTime: 15_000,
  });

  const backups = data?.data ?? [];

  // Fetch selected backup details
  const { data: backupDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: queryKeys.backups.detail(selectedBackupId),
    queryFn: () => getApi<BackupDetail>(`/api/backups/${selectedBackupId}`),
    enabled: !!selectedBackupId && step === 2,
    staleTime: 10_000,
  });

  const restoreMutation = useMutation({
    // The restore endpoint requires `{ createdById }` in the zod body
    // schema. We always pass it from the auth-store user id (fixing a
    // latent bug where the page sent no body). When isPlatform, also
    // pass `scope: 'platform'` as a marker so the API gates the
    // request with requirePlatformAdmin.
    mutationFn: (id: string) => postApi(`/api/backups/${id}/restore`, {
      createdById: currentUserId,
      ...(isPlatform ? { scope: 'platform' } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.backupLogs.all });
      toast.success(t('backups.restoreInitiatedFull'));
      setStep(1);
      setSelectedBackupId('');
      setConfirmed(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || t('backups.restoreInitiateFailed'));
    },
  });

  const selectedBackup = backups.find((b) => b.id === selectedBackupId);

  const handleProceed = () => {
    if (!selectedBackupId) return;
    setConfirmed(false);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setConfirmed(false);
  };

  const handleRestore = () => {
    if (!selectedBackupId || !confirmed) return;
    restoreMutation.mutate(selectedBackupId);
  };

  return (
    <div className="space-y-6">
      {isPlatform ? (
        <PlatformPageHeader
          title={t('backups.restore')}
          subtitle={t('backups.restorePlatformSubtitle')}
        />
      ) : (
        <PageHeader
          breadcrumbs={false}
          title={t('backups.restore')}
          description={t('backups.restoreDescription')}
        />
      )}

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={handleBack}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors',
            step === 1
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center text-xs">
            1
          </span>
          {t('backups.selectBackup')}
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <button
          disabled={step === 1}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors',
            step === 2
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <span className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center text-xs">
            2
          </span>
          {t('backups.confirmRestore')}
        </button>
      </div>

      {/* Step 1: Select Backup */}
      {step === 1 && (
        <motion.div
          key="step1"
          initial="enter"
          animate="center"
          exit="exit"
          variants={stepVariants}
          transition={{ duration: 0.25 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('backups.selectBackupTitle')}</CardTitle>
              <CardDescription>
                {t('backups.selectBackupDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('backups.backupLabel')}</label>
                {isLoading ? (
                  <div className="h-10 animate-pulse bg-muted rounded-md" />
                ) : backups.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground text-sm">
                    <DatabaseBackup className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    {t('backups.noCompletedBackups')}
                  </div>
                ) : (
                  <Select value={selectedBackupId} onValueChange={setSelectedBackupId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('backups.selectBackupPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {backups.map((backup) => (
                        <SelectItem key={backup.id} value={backup.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{backup.name}</span>
                            <span className="text-xs text-muted-foreground">
                              — {labelize(backup.scope)} · {formatFileSize(backup.size)} · {formatRelativeTime(backup.createdAt)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Preview of selected backup */}
              {selectedBackup && (
                <div className="rounded-md border bg-muted/30 p-4">
                  <h4 className="text-sm font-medium mb-3">{t('backups.backupPreview')}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('common.name')}</p>
                      <p className="text-sm font-medium">{selectedBackup.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('backups.scope')}</p>
                      <p className="text-sm">
                        <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                          {labelize(selectedBackup.scope)}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('backups.size')}</p>
                      <p className="text-sm font-medium">{formatFileSize(selectedBackup.size)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('backups.created')}</p>
                      <p className="text-sm">{formatRelativeTime(selectedBackup.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('common.status')}</p>
                      <StatusBadge status={selectedBackup.status} size="sm" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('backups.verification')}</p>
                      {selectedBackup.verificationStatus ? (
                        <StatusBadge status={selectedBackup.verificationStatus} size="sm" />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleProceed} disabled={!selectedBackupId}>
                  {t('backups.continue')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Step 2: Confirm & Restore */}
      {step === 2 && (
        <motion.div
          key="step2"
          initial="enter"
          animate="center"
          exit="exit"
          variants={stepVariants}
          transition={{ duration: 0.25 }}
        >
          <div className="space-y-4">
            {/* Backup Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('backups.backupDetails')}</CardTitle>
                <CardDescription>{t('backups.backupDetailsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDetail || !backupDetail ? (
                  <div className="space-y-3">
                    <div className="h-6 animate-pulse bg-muted rounded w-1/3" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse bg-muted rounded" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('common.name')}</p>
                      <p className="text-sm font-semibold">{backupDetail.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('backups.scope')}</p>
                      <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                        {labelize(backupDetail.scope)}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('backups.size')}</p>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatFileSize(backupDetail.size)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('backups.created')}</p>
                      <p className="text-sm">{formatRelativeTime(backupDetail.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('backups.storage')}</p>
                      <p className="text-sm">{labelize(backupDetail.storageProvider)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('common.status')}</p>
                      <StatusBadge status={backupDetail.status} size="sm" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('backups.verification')}</p>
                      {backupDetail.verificationStatus ? (
                        <StatusBadge status={backupDetail.verificationStatus} size="sm" />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('backups.encryption')}</p>
                      <span className={cn(
                        'text-sm font-medium',
                        backupDetail.encryptionStatus === 'ENCRYPTED'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-muted-foreground'
                      )}>
                        {backupDetail.encryptionStatus === 'ENCRYPTED' ? t('backups.encrypted') : t('backups.none')}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Warning & Confirmation */}
            <Card className="border-amber-200 dark:border-amber-800/50">
              <CardContent className="pt-0 space-y-4">
                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>{t('backups.warningLabel')}</strong>{t('backups.warningText')}
                  </AlertDescription>
                </Alert>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    {t('backups.understandText')}
                  </span>
                </label>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    {t('common.back')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRestore}
                    disabled={!confirmed || restoreMutation.isPending}
                  >
                    {restoreMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('backups.restoring')}
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {t('backups.restoreBackup')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </div>
  );
}
