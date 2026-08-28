'use client';

// ============================================================
// PLATFORM SETTINGS — plans + platform configuration.
// Read-only display. Plans are imported directly from the
// centralized platform-data.ts (the SAME PLANS used by the
// Client Billing page), so the admin sees exactly what
// customers see. No editable forms — pricing changes must be
// made in application configuration (per spec).
// Visual language mirrors platform-overview.tsx.
// ============================================================

import React from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Check, Info, Server, Database, Cpu, Code, ShieldCheck,
} from 'lucide-react';
import {
  PlatformPageHeader, PlanBadge, formatCurrency,
} from './shared';
import { PLANS } from '@/lib/platform/platform-data';
import type { Plan } from '@/lib/platform/platform-data';

const PLATFORM_INFO: { label: string; value: string; icon: React.ReactNode }[] = [
  { label: 'Platform Name', value: 'Enterprise CMS', icon: <ShieldCheck className="h-4 w-4" /> },
  { label: 'Version', value: '0.2.1', icon: <Code className="h-4 w-4" /> },
  { label: 'Environment', value: 'Development', icon: <Cpu className="h-4 w-4" /> },
  { label: 'Database', value: 'SQLite', icon: <Database className="h-4 w-4" /> },
];

export function PlatformSettingsModule() {
  return (
    <div className="space-y-6">
      <PlatformPageHeader title="Platform Settings" subtitle="Plans and platform configuration." />

      {/* Plans management (read-only) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Subscription Plans</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Read-only view. Plans are also shown on the Client Billing page.
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

        {/* Note */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Info className="h-4 w-4" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Plan pricing is configured in the application configuration. Changes affect the same
                plan system used by the Client Dashboard.
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
