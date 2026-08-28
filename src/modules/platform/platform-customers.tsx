'use client';
import { PlatformPageHeader } from './shared';
export function PlatformCustomersModule() {
  return (
    <div className="space-y-6">
      <PlatformPageHeader title="Customers" subtitle="All SaaS customers on the platform." />
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground text-sm">Loading customers…</div>
    </div>
  );
}
