'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

function ModuleFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

const overview = dynamic(() => import('./platform-overview').then(m => ({ default: m.PlatformOverviewModule as ComponentType })), { loading: ModuleFallback });
const customers = dynamic(() => import('./platform-customers').then(m => ({ default: m.PlatformCustomersModule as ComponentType })), { loading: ModuleFallback });
const customerDetail = dynamic(() => import('./platform-customer-detail').then(m => ({ default: m.PlatformCustomerDetailModule as ComponentType })), { loading: ModuleFallback });
const sites = dynamic(() => import('./platform-sites').then(m => ({ default: m.PlatformSitesModule as ComponentType })), { loading: ModuleFallback });
const subscriptions = dynamic(() => import('./platform-subscriptions').then(m => ({ default: m.PlatformSubscriptionsModule as ComponentType })), { loading: ModuleFallback });
const payments = dynamic(() => import('./platform-payments').then(m => ({ default: m.PlatformPaymentsModule as ComponentType })), { loading: ModuleFallback });
const usage = dynamic(() => import('./platform-usage').then(m => ({ default: m.PlatformUsageModule as ComponentType })), { loading: ModuleFallback });
const systemHealth = dynamic(() => import('./platform-system-health').then(m => ({ default: m.PlatformSystemHealthModule as ComponentType })), { loading: ModuleFallback });
const audit = dynamic(() => import('./platform-audit').then(m => ({ default: m.PlatformAuditModule as ComponentType })), { loading: ModuleFallback });
const settings = dynamic(() => import('./platform-settings').then(m => ({ default: m.PlatformSettingsModule as ComponentType })), { loading: ModuleFallback });

export const platformModuleRegistry: Record<string, ComponentType> = {
  'platform-overview': overview,
  'platform-customers': customers,
  'platform-customer-detail': customerDetail,
  'platform-sites': sites,
  'platform-subscriptions': subscriptions,
  'platform-payments': payments,
  'platform-usage': usage,
  'platform-system-health': systemHealth,
  'platform-audit': audit,
  'platform-settings': settings,
};
