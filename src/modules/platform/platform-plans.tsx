'use client';

// ============================================================
// PLATFORM PLANS & PRICING — editable single source of truth.
// ============================================================
// Owner edits plan name / price / currency / interval / features /
// entitlements / limits / active / sort here. Every change writes to
// the PlanConfig table via PUT /api/platform/admin/plans/[planId] and
// refreshes the shared plan-config cache — so the Client Billing page
// and MRR reflect the new values on the next read. The same cache the
// client reads. Pricing edits are OWNER-ONLY (enforced server-side);
// PLATFORM_ADMIN can view but the PUT returns 403.
// ============================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, putApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, RotateCcw, ShieldAlert } from 'lucide-react';
import {
  PlatformPageHeader,
  ErrorState,
  formatCurrency,
} from '@/modules/platform/shared';
import {
  ENTITLEMENT_KEYS,
  ENTITLEMENT_LABELS,
  ENTITLEMENT_DESCRIPTIONS,
  LIMIT_KEYS,
  LIMIT_LABELS,
  UNLIMITED,
} from '@/lib/platform/feature-config';
import type { PlanConfigData } from '@/lib/platform/plan-config';
import { useAuthStore } from '@/lib/stores/auth-store';

type PlanPatch = Partial<PlanConfigData>;

function EditablePlanCard({ plan }: { plan: PlanConfigData }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plan.name);
  const [priceMonthly, setPriceMonthly] = useState(String(plan.priceMonthly));
  const [priceYearly, setPriceYearly] = useState(String(plan.priceYearly));
  const [currency, setCurrency] = useState(plan.currency);
  const [interval, setInterval] = useState<'monthly' | 'yearly'>(plan.interval);
  const [active, setActive] = useState(plan.active);
  const [features, setFeatures] = useState(plan.features.join('\n'));
  const [entitlements, setEntitlements] = useState<string[]>(plan.entitlements);
  const [limits, setLimits] = useState(plan.limits);

  const reset = () => {
    setName(plan.name);
    setPriceMonthly(String(plan.priceMonthly));
    setPriceYearly(String(plan.priceYearly));
    setCurrency(plan.currency);
    setInterval(plan.interval);
    setActive(plan.active);
    setFeatures(plan.features.join('\n'));
    setEntitlements(plan.entitlements);
    setLimits(plan.limits);
  };

  const saveMutation = useMutation({
    mutationFn: (patch: PlanPatch) => putApi<PlanConfigData>(`/api/platform/admin/plans/${plan.planId}`, patch),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
      queryClient.invalidateQueries({ queryKey: ['platform-billing-me'] });
      queryClient.invalidateQueries({ queryKey: ['platform-overview'] });
      // Sync local state to the saved server value.
      setName(data.name);
      setPriceMonthly(String(data.priceMonthly));
      setPriceYearly(String(data.priceYearly));
      setCurrency(data.currency);
      setInterval(data.interval);
      setActive(data.active);
      setFeatures(data.features.join('\n'));
      setEntitlements(data.entitlements);
      setLimits(data.limits);
      toast.success(`${data.name} updated — changes are now live for clients.`);
    },
    onError: (err: unknown) => {
      const e = err as { error?: { message?: string }; message?: string };
      toast.error(e?.error?.message ?? e?.message ?? 'Unable to save plan. You may need OWNER access.');
    },
  });

  const buildPatch = (): PlanPatch => ({
    name,
    priceMonthly: Number(priceMonthly) || 0,
    priceYearly: Number(priceYearly) || 0,
    currency,
    interval,
    active,
    features: features.split('\n').map((f) => f.trim()).filter(Boolean),
    entitlements,
    limits: { ...limits, storageBytes: Number(limits.storageBytes) || 0 },
  });

  return (
    <Card className={active ? '' : 'opacity-70'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{plan.name}</CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">{plan.planId}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Active</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Pricing */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monthly Price</Label>
            <Input type="number" value={priceMonthly} onChange={(e) => setPriceMonthly(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Yearly Price</Label>
            <Input type="number" value={priceYearly} onChange={(e) => setPriceYearly(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Billing Interval</Label>
            <Select value={interval} onValueChange={(v) => setInterval(v as 'monthly' | 'yearly')}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">monthly</SelectItem>
                <SelectItem value="yearly">yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Effective monthly</p>
            <p className="text-sm font-semibold">
              {formatCurrency(interval === 'yearly' ? Math.round((Number(priceYearly) || 0) / 12) : Number(priceMonthly) || 0, currency)}
            </p>
          </div>
        </div>

        {/* Features (marketing copy) */}
        <div className="space-y-1">
          <Label className="text-xs">Features (one per line — marketing copy shown to clients)</Label>
          <Textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={4} className="text-sm" />
        </div>

        {/* Entitlements */}
        <div className="space-y-2">
          <Label className="text-xs">Entitlements (server-side enforced via hasFeature)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ENTITLEMENT_KEYS.map((key) => {
              const on = entitlements.includes(key);
              return (
                <label
                  key={key}
                  className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={on}
                    onChange={() =>
                      setEntitlements((cur) =>
                        on ? cur.filter((k) => k !== key) : [...cur, key],
                      )
                    }
                  />
                  <span className="text-xs">
                    <span className="font-medium">{ENTITLEMENT_LABELS[key]}</span>
                    <span className="block text-muted-foreground">{ENTITLEMENT_DESCRIPTIONS[key]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Limits */}
        <div className="space-y-2">
          <Label className="text-xs">Usage Limits (-1 = unlimited)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {LIMIT_KEYS.map((k) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{LIMIT_LABELS[k]}</Label>
                <Input
                  type="number"
                  value={String(limits[k])}
                  onChange={(e) =>
                    setLimits((cur) => ({ ...cur, [k]: Number(e.target.value) }))
                  }
                  className="h-9"
                />
                {limits[k] === UNLIMITED && (
                  <p className="text-[10px] text-emerald-600">unlimited</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={reset} disabled={saveMutation.isPending}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate(buildPatch())} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlatformPlansModule() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const plansQuery = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => getApi<PlanConfigData[]>('/api/platform/admin/plans'),
  });

  return (
    <div className="space-y-4">
      <PlatformPageHeader
        title="Plans & Pricing"
        subtitle="The single source of truth for plans, pricing, entitlements and usage limits. Edits propagate to the Client Billing page and to MRR."
      />

      {!isOwner && (
        <Card>
          <CardContent className="p-4 flex items-start gap-3 bg-amber-50/50 dark:bg-amber-950/20">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-400">View-only</p>
              <p className="text-muted-foreground">Editing plan pricing, entitlements and limits is restricted to the OWNER role. Your changes would be rejected server-side.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {plansQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-6 w-40" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : plansQuery.isError || !plansQuery.data ? (
        <Card><CardContent className="p-4"><ErrorState message="Unable to load plan configuration." onRetry={() => plansQuery.refetch()} /></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {plansQuery.data.map((plan) => (
            <EditablePlanCard key={plan.planId} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
