'use client';

// ============================================================
// PLATFORM COUPONS — promo-code management.
// ============================================================
// Coupon validation is server-side (validateCoupon). The Client
// Billing / Checkout flow uses the same coupon system via
// POST /api/platform/billing/validate-coupon. The client cannot obtain
// a different price by manipulating the frontend.
// ============================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Ticket } from 'lucide-react';
import { PlatformPageHeader, ErrorState, EmptyState, formatCurrency, formatDate } from '@/modules/platform/shared';

interface CouponRow {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  currency: string;
  applicablePlans: string[];
  startsAt: string | null;
  expiresAt: string | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  active: boolean;
  timesRedeemed: number;
  createdAt: string;
}

export function PlatformCouponsModule() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('10');
  const [currency, setCurrency] = useState('CHF');
  const [applicablePlans, setApplicablePlans] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');

  const couponsQuery = useQuery({
    queryKey: ['platform-coupons'],
    queryFn: () => getApi<CouponRow[]>('/api/platform/admin/coupons'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      postApi<CouponRow>('/api/platform/admin/coupons', {
        code,
        type,
        value: Number(value) || 0,
        currency,
        applicablePlans,
        expiresAt: expiresAt || null,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-coupons'] });
      setShowForm(false);
      setCode(''); setValue('10'); setExpiresAt(''); setMaxRedemptions(''); setApplicablePlans([]);
      toast.success('Coupon created.');
    },
    onError: () => toast.error('Unable to create coupon.'),
  });

  const toggleActive = useMutation({
    mutationFn: (c: CouponRow) => patchApi(`/api/platform/admin/coupons/${c.id}`, { active: !c.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-coupons'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/platform/admin/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-coupons'] });
      toast.success('Coupon deleted.');
    },
  });

  const PLANS = ['beta', 'pro', 'max'];

  return (
    <div className="space-y-4">
      <PlatformPageHeader
        title="Coupons"
        subtitle="Promo codes for checkout. Validation is server-side — the client checkout flow uses the same coupon system."
        actions={
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" /> New Coupon
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'percent' | 'fixed')}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">percent (%)</SelectItem>
                    <SelectItem value="fixed">fixed (amount)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Expires At</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Redemptions</Label>
                <Input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="unlimited" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Applicable Plans (empty = all)</Label>
                <div className="flex gap-2 items-center h-9">
                  {PLANS.map((p) => {
                    const on = applicablePlans.includes(p);
                    return (
                      <label key={p} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={on} onChange={() => setApplicablePlans((cur) => on ? cur.filter((x) => x !== p) : [...cur, p])} />
                        {p}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!code || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Coupon
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          {couponsQuery.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : couponsQuery.isError || !couponsQuery.data ? (
            <ErrorState message="Unable to load coupons." onRetry={() => couponsQuery.refetch()} />
          ) : couponsQuery.data.length === 0 ? (
            <EmptyState message="No coupons yet." icon={<Ticket className="h-5 w-5 opacity-50" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Code</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Discount</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Plans</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Redemptions</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Expires</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Active</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {couponsQuery.data.map((c) => (
                    <tr key={c.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 pr-4 font-mono text-xs font-semibold">{c.code}</td>
                      <td className="py-2.5 pr-4">
                        {c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value, c.currency)}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                        {c.applicablePlans.length === 0 ? 'all' : c.applicablePlans.join(', ')}
                      </td>
                      <td className="py-2.5 pr-4 text-xs">{c.timesRedeemed}{c.maxRedemptions !== null ? `/${c.maxRedemptions}` : ''}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{formatDate(c.expiresAt)}</td>
                      <td className="py-2.5 pr-4">
                        <Switch checked={c.active} onCheckedChange={() => toggleActive.mutate(c)} />
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
    </div>
  );
}
