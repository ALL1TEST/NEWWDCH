'use client';

import { useT } from '@/lib/i18n';
import { useSubscriptionStore, getPlanBadgeClasses, getPlanCardBorderClasses, type Plan } from '@/lib/stores/subscription-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Check,
  Receipt,
  Clock,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function BillingPage() {
  const { t } = useT();
  const currentPlan = useSubscriptionStore((s) => s.currentPlan);
  const otherPlans = useSubscriptionStore((s) => s.otherPlans);
  const status = useSubscriptionStore((s) => s.status);
  const trialEnd = useSubscriptionStore((s) => s.trialEnd);
  const changePlan = useSubscriptionStore((s) => s.changePlan);

  const [changingTo, setChangingTo] = useState<string | null>(null);

  const handlePlanChange = async (plan: Plan) => {
    setChangingTo(plan.id);
    // Simulate a brief delay for the operation
    await new Promise((r) => setTimeout(r, 600));
    changePlan(plan.id);
    toast.success(
      plan.price > currentPlan.price
        ? `Upgraded to ${plan.name}`
        : `Changed to ${plan.name}`
    );
    setChangingTo(null);
  };

  const isHigherPlan = (plan: Plan) => plan.price > currentPlan.price;
  const getActionLabel = (plan: Plan) => {
    if (isHigherPlan(plan)) return t('billing.upgrade');
    if (plan.price < currentPlan.price) return t('billing.downgrade');
    return t('billing.changePlan');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold">{t('billing.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('billing.description')}</p>
      </div>

      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('billing.currentPlan')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-lg">{currentPlan.name}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${getPlanBadgeClasses(currentPlan.badgeVariant)}`}
                >
                  {currentPlan.name}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                {currentPlan.price === 0
                  ? t('billing.free')
                  : `${currentPlan.price} ${currentPlan.currency}/${currentPlan.interval}`}
              </p>
            </div>
            <Badge
              variant={status === 'active' ? 'default' : 'outline'}
              className="capitalize"
            >
              {status}
            </Badge>
          </div>

          {trialEnd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {t('billing.trialActive')} — ends {trialEnd}
              </span>
            </div>
          )}

          <Separator />

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                {t('billing.managePayment')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled
              >
                {t('billing.cancelSubscription')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Other Plans */}
      <div>
        <h2 className="text-base font-semibold mb-4">{t('billing.otherPlans')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {otherPlans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${getPlanCardBorderClasses(plan.badgeVariant)}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold ${getPlanBadgeClasses(plan.badgeVariant)}`}
                  >
                    {plan.name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-2xl font-bold">
                    {plan.price === 0 ? t('billing.free') : `${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground ml-1">
                      {plan.currency}/{plan.interval}
                    </span>
                  )}
                </div>
                <Separator />
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isHigherPlan(plan) ? 'default' : 'outline'}
                  disabled={changingTo === plan.id}
                  onClick={() => handlePlanChange(plan)}
                >
                  {changingTo === plan.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {getActionLabel(plan)}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('billing.paymentHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-sm">{t('billing.noPayments')}</h3>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
