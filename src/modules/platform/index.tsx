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
const stripeSettings = dynamic(() => import('./platform-stripe-settings').then(m => ({ default: m.PlatformStripeSettingsModule as ComponentType })), { loading: ModuleFallback });
const notifications = dynamic(() => import('./platform-notifications').then(m => ({ default: m.PlatformNotificationsModule as ComponentType })), { loading: ModuleFallback });
const emailTemplates = dynamic(() => import('./platform-email-templates').then(m => ({ default: m.PlatformEmailTemplatesModule as ComponentType })), { loading: ModuleFallback });
const smtp = dynamic(() => import('./platform-smtp').then(m => ({ default: m.PlatformSmtpModule as ComponentType })), { loading: ModuleFallback });
const backups = dynamic(() => import('./platform-backups').then(m => ({ default: m.PlatformBackupsModule as ComponentType })), { loading: ModuleFallback });
const ai = dynamic(() => import('./platform-ai').then(m => ({ default: m.PlatformAiModule as ComponentType })), { loading: ModuleFallback });
const content = dynamic(() => import('@/modules/content').then(m => ({ default: m.ContentModule as ComponentType })), { loading: ModuleFallback });
const pages = dynamic(() => import('@/modules/pages').then(m => ({ default: m.PagesModule as ComponentType })), { loading: ModuleFallback });
const calendar = dynamic(() => import('@/modules/calendar').then(m => ({ default: m.CalendarModule as ComponentType })), { loading: ModuleFallback });
const media = dynamic(() => import('@/modules/media').then(m => ({ default: m.MediaModule as ComponentType })), { loading: ModuleFallback });
const newsletter = dynamic(() => import('@/modules/newsletter').then(m => ({ default: m.NewsletterModule as ComponentType })), { loading: ModuleFallback });
const seo = dynamic(() => import('@/modules/seo').then(m => ({ default: m.SeoModule as ComponentType })), { loading: ModuleFallback });
const automation = dynamic(() => import('@/modules/automation').then(m => ({ default: m.AutomationModule as ComponentType })), { loading: ModuleFallback });
const tasks = dynamic(() => import('@/modules/tasks').then(m => ({ default: m.TasksModule as ComponentType })), { loading: ModuleFallback });

export const platformModuleRegistry: Record<string, ComponentType> = {
  'platform-overview': overview,
  'platform-customers': customers,
  'platform-customer-detail': customerDetail,
  'platform-tasks': tasks,
  'platform-payments-group': payments,
  'platform-billing': payments,
  'platform-payments': payments,
  'platform-plans': plans,
  'platform-coupons': coupons,
  'platform-stripe-settings': stripeSettings,
  'platform-notifications': notifications,
  'platform-email-templates': emailTemplates,
  'platform-smtp': smtp,
  'platform-backups': backups,
  'platform-ai': ai,
  'platform-blogs': content,
  'platform-blog': content,
  'platform-content': content,
  'platform-pages': pages,
  'platform-calendar': calendar,
  'platform-media': media,
  'platform-newsletter': newsletter,
  'platform-seo': seo,
  'platform-automation': automation,
};

