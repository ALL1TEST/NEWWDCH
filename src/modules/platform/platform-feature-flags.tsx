'use client';

// ============================================================
// PLATFORM FEATURE FLAGS — platform-level rollout toggles.
// ============================================================
// Distinct from entitlements: a feature flag = whether the PLATFORM has
// the feature enabled (rolled out). An entitlement = whether a CUSTOMER
// is allowed to use something (plan-based). Toggling here flips the
// FeatureFlag row server-side; isFlagEnabled(key) is the authority.
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, patchApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Flag } from 'lucide-react';
import { PlatformPageHeader, ErrorState } from '@/modules/platform/shared';
import { useAuthStore } from '@/lib/stores/auth-store';

interface FeatureFlagRow {
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  targetType: string;
  targetValue: string | null;
}

export function PlatformFeatureFlagsModule() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';
  const queryClient = useQueryClient();

  const flagsQuery = useQuery({
    queryKey: ['platform-feature-flags'],
    queryFn: () => getApi<FeatureFlagRow[]>('/api/platform/admin/feature-flags'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, isEnabled }: { key: string; isEnabled: boolean }) =>
      patchApi(`/api/platform/admin/feature-flags/${key}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-feature-flags'] });
      toast.success('Feature flag updated.');
    },
    onError: () => toast.error('Unable to update feature flag. OWNER access required.'),
  });

  return (
    <div className="space-y-4">
      <PlatformPageHeader
        title="Feature Flags"
        subtitle="Platform-level feature rollout toggles. These are separate from plan entitlements — they control whether a feature is enabled for the whole platform."
      />

      <Card>
        <CardContent className="p-4">
          {flagsQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : flagsQuery.isError || !flagsQuery.data ? (
            <ErrorState message="Unable to load feature flags." onRetry={() => flagsQuery.refetch()} />
          ) : flagsQuery.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Flag className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No feature flags configured.</p>
            </div>
          ) : (
            <div className="divide-y">
              {flagsQuery.data.map((flag) => (
                <div key={flag.key} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{flag.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{flag.key}</Badge>
                      {flag.isEnabled && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0">enabled</Badge>
                      )}
                    </div>
                    {flag.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {toggleMutation.isPending && toggleMutation.variables?.key === flag.key ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={flag.isEnabled}
                        disabled={!isOwner}
                        onCheckedChange={(v) => toggleMutation.mutate({ key: flag.key, isEnabled: v })}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {!isOwner && (
        <p className="text-xs text-muted-foreground px-1">
          Toggling feature flags is restricted to the OWNER role.
        </p>
      )}
    </div>
  );
}
