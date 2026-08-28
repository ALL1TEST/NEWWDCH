'use client';
import { PlatformPageHeader } from './shared';
export function PlatformCustomerDetailModule() {
  return (
    <div className="space-y-6">
      <PlatformPageHeader title="Customer" subtitle="Customer details." />
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground text-sm">Loading customer…</div>
    </div>
  );
}
