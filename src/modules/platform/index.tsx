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
const payments = dynamic(() => import('./platform-payments').then(m => ({ default: m.PlatformPaymentsModule as ComponentType })), { loading: ModuleFallback });
const plans = dynamic(() => import('./platform-plans').then(m => ({ default: m.PlatformPlansModule as ComponentType })), { loading: ModuleFallback });
const coupons = dynamic(() => import('./platform-coupons').then(m => ({ default: m.PlatformCouponsModule as ComponentType })), { loading: ModuleFallback });
const notifications = dynamic(() => import('./platform-notifications').then(m => ({ default: m.PlatformNotificationsModule as ComponentType })), { loading: ModuleFallback });
const emailTemplates = dynamic(() => import('./platform-email-templates').then(m => ({ default: m.PlatformEmailTemplatesModule as ComponentType })), { loading: ModuleFallback });
const smtp = dynamic(() => import('./platform-smtp').then(m => ({ default: m.PlatformSmtpModule as ComponentType })), { loading: ModuleFallback });
const backups = dynamic(() => import('./platform-backups').then(m => ({ default: m.PlatformBackupsModule as ComponentType })), { loading: ModuleFallback });

export const platformModuleRegistry: Record<string, ComponentType> = {
  'platform-overview': overview,
  'platform-customers': customers,
  'platform-customer-detail': customerDetail,
  'platform-payments': payments,
  'platform-plans': plans,
  'platform-coupons': coupons,
  'platform-notifications': notifications,
  'platform-email-templates': emailTemplates,
  'platform-smtp': smtp,
  'platform-backups': backups,
};
