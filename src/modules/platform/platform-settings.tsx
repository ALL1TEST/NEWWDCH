'use client';

// ============================================================
// PLATFORM SETTINGS — plans + maintenance mode + country pricing
// + platform configuration. Maintenance is owner-only (enforced
// server-side); when enabled, CLIENT users see a maintenance page
// while OWNER / PLATFORM_ADMIN remain able to access the admin area.
// Visual language mirrors platform-overview.tsx.
// ============================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, putApi, deleteApi } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Check, Info, Server, Database, Cpu, Code, ShieldCheck, Wrench, Globe, Loader2, Plus, Trash2,
} from 'lucide-react';
import {
  PlatformPageHeader, PlanBadge, formatCurrency, ErrorState,
} from './shared';
import { PLANS } from '@/lib/platform/platform-data';
import type { Plan } from '@/lib/platform/platform-data';
import { useAuthStore } from '@/lib/stores/auth-store';

interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  allowAdminAccess: boolean;
  scheduledEnd: string | null;
}

interface CountryPricingRow {
  id: string;
  countryCode: string;
  countryName: string;
  currency: string;
  isDefault: boolean;
  regionalPrices: Record<string, { monthly: number; yearly: number }>;
  active: boolean;
}

const PLATFORM_INFO: { label: string; value: string; icon: React.ReactNode }[] = [
  { label: 'Platform Name', value: 'Enterprise CMS', icon: <ShieldCheck className="h-4 w-4" /> },
  { label: 'Version', value: '0.2.1', icon: <Code className="h-4 w-4" /> },
  { label: 'Environment', value: 'Development', icon: <Cpu className="h-4 w-4" /> },
  { label: 'Database', value: 'SQLite', icon: <Database className="h-4 w-4" /> },
];

export function PlatformSettingsModule() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  return (
    <div className="space-y-6">
      <PlatformPageHeader title="Platform Settings" subtitle="Maintenance mode, country pricing, plans and platform configuration." />

      <MaintenanceSection isOwner={isOwner} />
      <CountryPricingSection />

      {/* Plans management (read-only) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Subscription Plans</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Read-only view (edit on the Plans &amp; Pricing page). Plans are also shown on the Client Billing page.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {PLANS.length} plans
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Info className="h-4 w-4" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Plan pricing, entitlements and limits are editable on the <span className="font-medium">Plans &amp; Pricing</span> page
                (owner-only). Changes propagate to the Client Billing page and to MRR.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform information (read-only) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Platform Information</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Read-only system configuration
              </CardDescription>
            </div>
            <Server className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLATFORM_INFO.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    {f.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {f.label}
                    </p>
                    <p className="text-sm font-semibold truncate">{f.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5 pt-1">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              These are demo values. In production, source them from environment metadata and runtime
              diagnostics rather than hardcoding.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Maintenance Mode --------------------

function MaintenanceSection({ isOwner }: { isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const configQuery = useQuery({
    queryKey: ['platform-maintenance'],
    queryFn: () => getApi<MaintenanceConfig>('/api/platform/admin/maintenance'),
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<MaintenanceConfig>) => putApi<MaintenanceConfig>('/api/platform/admin/maintenance', patch),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-maintenance'] });
      setMessage(data.message);
      toast.success(data.enabled ? 'Maintenance mode enabled — clients now see the maintenance page.' : 'Maintenance mode disabled.');
    },
    onError: () => toast.error('Unable to change maintenance mode. OWNER access required.'),
  });

  const config = configQuery.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">Maintenance Mode</CardTitle>
          </div>
          {config?.enabled && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-0">enabled</Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          When enabled, CLIENT users see a maintenance page while OWNER / PLATFORM_ADMIN remain able to access the admin area. Enforced server-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {configQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : configQuery.isError || !config ? (
          <ErrorState message="Unable to load maintenance config." onRetry={() => configQuery.refetch()} />
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Maintenance status</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {config.enabled ? 'Clients are currently blocked.' : 'Platform is live for all users.'}
                </p>
              </div>
              <Switch
                checked={config.enabled}
                disabled={!isOwner || saveMutation.isPending}
                onCheckedChange={(v) => saveMutation.mutate({ enabled: v })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Maintenance message</Label>
              <Textarea
                value={message || config.message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                disabled={!isOwner}
                className="text-sm"
              />
            </div>
            {isOwner && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => saveMutation.mutate({ message: message || config.message })} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Message
                </Button>
              </div>
            )}
            {!isOwner && (
              <p className="text-xs text-muted-foreground">Toggling maintenance mode is restricted to the OWNER role.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Country / Currency Pricing --------------------

function CountryPricingSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [countryName, setCountryName] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [isDefault, setIsDefault] = useState(false);

  const countriesQuery = useQuery({
    queryKey: ['platform-countries'],
    queryFn: () => getApi<CountryPricingRow[]>('/api/platform/admin/countries'),
  });

  const createMutation = useMutation({
    mutationFn: () => postApi<CountryPricingRow>('/api/platform/admin/countries', { countryCode, countryName, currency, isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-countries'] });
      setShowForm(false);
      setCountryCode(''); setCountryName(''); setCurrency('CHF'); setIsDefault(false);
      toast.success('Country added.');
    },
    onError: () => toast.error('Unable to save country.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/platform/admin/countries?id=${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-countries'] }),
  });

  const countries = countriesQuery.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Country &amp; Currency Pricing</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" /> Add Country
          </Button>
        </div>
        <CardDescription className="text-xs">
          IP geolocation is only an initial detection — the server determines the final price. The client cannot change currency to obtain a different price.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border p-3">
            <div className="space-y-1">
              <Label className="text-xs">Code (ISO)</Label>
              <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="US" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <Input value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder="United States" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" className="h-9" />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Default
              </label>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!countryCode || !countryName || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save
              </Button>
            </div>
          </div>
        )}
        {countriesQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : countriesQuery.isError ? (
          <ErrorState message="Unable to load country pricing." onRetry={() => countriesQuery.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Code</th>
                  <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Country</th>
                  <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Currency</th>
                  <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Default</th>
                  <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Regional prices</th>
                  <th className="pb-2 font-medium text-xs text-muted-foreground text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {countries.map((c) => (
                  <tr key={c.id} className="hover:bg-accent/30 transition-colors">
                    <td className="py-2.5 pr-4 font-mono text-xs">{c.countryCode}</td>
                    <td className="py-2.5 pr-4">{c.countryName}</td>
                    <td className="py-2.5 pr-4 text-xs">{c.currency}</td>
                    <td className="py-2.5 pr-4">{c.isDefault && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">default</Badge>}</td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                      {Object.keys(c.regionalPrices).length === 0 ? 'base price' : Object.entries(c.regionalPrices).map(([p, v]) => `${p}:${v.monthly}`).join(', ')}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Sub-components --------------------

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header: name + badge */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight">{plan.name}</h3>
          <PlanBadge planId={plan.id} />
        </div>

        {/* Price + interval */}
        <div className="flex items-baseline gap-1.5">
          {plan.isFree ? (
            <span className="text-2xl font-bold tracking-tight">Free</span>
          ) : (
            <>
              <span className="text-2xl font-bold tracking-tight">
                {formatCurrency(plan.price, plan.currency)}
              </span>
              <span className="text-xs text-muted-foreground">/ {plan.interval}</span>
            </>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-2 pt-1">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-foreground/90">{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
