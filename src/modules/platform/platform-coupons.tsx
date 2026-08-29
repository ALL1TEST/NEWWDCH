'use client';

// ============================================================
// PLATFORM COUPONS — promo-code management.
// ============================================================
// Coupon validation is server-side (validateCoupon). The Client
// Billing / Checkout flow uses the same coupon system via
// POST /api/platform/billing/validate-coupon. The client cannot obtain
// a different price by manipulating the frontend.
//
// The New Coupon form is intentionally minimal: currency is auto-
// derived from the platform's default (the backend `createCoupon`
// service defaults to the platform currency when none is supplied),
// and `active` defaults to ON. Only the 7 essential inputs remain.
// ============================================================

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, patchApi, deleteApi, ApiClientError } from '@/lib/api-client';
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

const PLANS = ['beta', 'pro', 'max'] as const;
type PlanId = (typeof PLANS)[number];

// A small reusable inline-error text that only renders when `message`
// is non-null — keeps the layout stable (no jumping) when fields are
// empty/valid by reserving the same height slot via `min-h-[14px]`.
function FieldError({ message }: { message: string | null }) {
  return (
    <p className={`text-[11px] leading-tight text-rose-500 min-h-[14px] ${message ? 'opacity-100' : 'opacity-0'}`}>
      {message ?? '\u00a0'}
    </p>
  );
}

export function PlatformCouponsModule() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // ---- Form state (only the 7 essential inputs) ----
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [applicablePlans, setApplicablePlans] = useState<PlanId[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  // Tracks which fields the user has interacted with — only shows
  // errors after a field has been touched (or on submit attempt).
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const couponsQuery = useQuery({
    queryKey: ['platform-coupons'],
    queryFn: () => getApi<CouponRow[]>('/api/platform/admin/coupons'),
  });

  // ---- Inline validation ----
  const codeTrimmed = code.trim();
  const codeUpper = codeTrimmed.toUpperCase();

  const existingCodes = useMemo(
    () => new Set((couponsQuery.data ?? []).map((c) => c.code.toUpperCase())),
    [couponsQuery.data],
  );

  const codeError = !codeTrimmed
    ? 'Code is required.'
    : existingCodes.has(codeUpper)
      ? 'This code is already in use.'
      : null;

  const valueNum = Number(value);
  const valueError = (() => {
    if (!value.trim()) return 'Value is required.';
    if (Number.isNaN(valueNum) || !Number.isFinite(valueNum)) return 'Value must be a number.';
    if (type === 'percent') {
      if (valueNum < 1 || valueNum > 100) return 'Percentage must be between 1 and 100.';
    } else if (valueNum <= 0) {
      return 'Fixed amount must be greater than 0.';
    }
    return null;
  })();

  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const expiresAtError = expiresAt
    ? new Date(expiresAt) < todayMidnight
      ? 'Expiration date cannot be in the past.'
      : null
    : null;

  const maxRedemptionsError = (() => {
    const v = maxRedemptions.trim();
    if (!v) return null; // empty = unlimited (allowed)
    const n = Number(v);
    if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) {
      return 'Must be a positive integer (or empty for unlimited).';
    }
    return null;
  })();

  const isFormValid =
    !codeError && !valueError && !expiresAtError && !maxRedemptionsError;

  const shouldShow = (key: string) => touched[key] || submitAttempted;

  const createMutation = useMutation({
    mutationFn: () => {
      // Currency is intentionally NOT sent — the backend `createCoupon`
      // service derives the platform default ('CHF' = the platform's
      // plan currency) when none is supplied. `active` defaults to ON.
      return postApi<CouponRow>('/api/platform/admin/coupons', {
        code: codeUpper,
        type,
        value: valueNum,
        applicablePlans,
        expiresAt: expiresAt || null,
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions.trim()) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-coupons'] });
      toast.success('Coupon created.');
      resetForm();
      setShowForm(false);
    },
    onError: (err: unknown) => {
      // The backend ultimately enforces uniqueness via the prisma
      // @unique constraint; surface its message if our client-side
      // check missed a race.
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to create coupon.';
      toast.error(message);
    },
  });

  function resetForm() {
    setCode('');
    setType('percent');
    setValue('');
    setApplicablePlans([]);
    setExpiresAt('');
    setMaxRedemptions('');
    setTouched({});
    setSubmitAttempted(false);
  }

  function handleCreateClick() {
    setSubmitAttempted(true);
    if (!isFormValid) return;
    createMutation.mutate();
  }

  function markTouched(key: string) {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }

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
          <CardContent className="p-4 space-y-3">
            {/* Row 1: [ Code ] [ Discount Type ] [ Discount Value ] */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  Coupon Code <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={code}
                  onChange={(e) => {
                    // Auto-trim spaces and uppercase as the user types.
                    const next = e.target.value.toUpperCase().replace(/\s+/g, '');
                    setCode(next);
                  }}
                  onBlur={() => markTouched('code')}
                  placeholder="WELCOME10"
                  className="h-9 font-mono"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <FieldError message={shouldShow('code') ? codeError : null} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Discount Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'percent' | 'fixed')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={null} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Discount Value <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={type === 'percent' ? 1 : 1}
                    max={type === 'percent' ? 100 : undefined}
                    step={type === 'percent' ? 1 : 1}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={() => markTouched('value')}
                    placeholder={type === 'percent' ? 'e.g. 10' : 'e.g. 25'}
                    className="h-9 pr-8"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    {type === 'percent' ? '%' : 'CHF'}
                  </span>
                </div>
                <FieldError message={shouldShow('value') ? valueError : null} />
              </div>
            </div>

            {/* Row 2: [ Applicable Plans ] [ Expires At ] [ Max Redemptions ] */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  Applicable Plans
                  <span className="text-muted-foreground font-normal ml-1">(empty = all)</span>
                </Label>
                <div className="flex h-9 items-center gap-1.5">
                  {PLANS.map((p) => {
                    const on = applicablePlans.includes(p);
                    return (
                      <Button
                        key={p}
                        type="button"
                        size="sm"
                        variant={on ? 'default' : 'outline'}
                        className="h-7 px-2.5 text-xs capitalize"
                        onClick={() =>
                          setApplicablePlans((cur) =>
                            on ? cur.filter((x) => x !== p) : [...cur, p],
                          )
                        }
                      >
                        {p}
                      </Button>
                    );
                  })}
                </div>
                <FieldError message={null} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Expiration Date
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </Label>
                <Input
                  type="date"
                  value={expiresAt}
                  min={todayMidnight.toISOString().slice(0, 10)}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  onBlur={() => markTouched('expiresAt')}
                  className="h-9"
                />
                <FieldError message={shouldShow('expiresAt') ? expiresAtError : null} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Max Redemptions
                  <span className="text-muted-foreground font-normal ml-1">(empty = unlimited)</span>
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  onBlur={() => markTouched('maxRedemptions')}
                  placeholder="unlimited"
                  className="h-9"
                />
                <FieldError message={shouldShow('maxRedemptions') ? maxRedemptionsError : null} />
              </div>
            </div>

            {/* Bottom: [ Cancel ] [ Create Coupon ] */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateClick}
                disabled={!isFormValid || createMutation.isPending}
              >
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
