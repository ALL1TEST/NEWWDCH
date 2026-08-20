'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

function ModuleFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>  );
}

const dashboard = dynamic(() => import('@/modules/dashboard').then(m => ({ default: m.DashboardPage as ComponentType })), { loading: ModuleFallback });
const content = dynamic(() => import('@/modules/content').then(m => ({ default: m.ContentModule as ComponentType })), { loading: ModuleFallback });
const media = dynamic(() => import('@/modules/media').then(m => ({ default: m.MediaModule as ComponentType })), { loading: ModuleFallback });
const users = dynamic(() => import('@/modules/users').then(m => ({ default: m.UsersModule as ComponentType })), { loading: ModuleFallback });
const categories = dynamic(() => import('@/modules/categories').then(m => ({ default: m.CategoriesModule as ComponentType })), { loading: ModuleFallback });
const tags = dynamic(() => import('@/modules/tags').then(m => ({ default: m.TagsModule as ComponentType })), { loading: ModuleFallback });
const comments = dynamic(() => import('@/modules/comments').then(m => ({ default: m.CommentsModule as ComponentType })), { loading: ModuleFallback });
const newsletter = dynamic(() => import('@/modules/newsletter').then(m => ({ default: m.NewsletterModule as ComponentType })), { loading: ModuleFallback });
const seo = dynamic(() => import('@/modules/seo').then(m => ({ default: m.SeoModule as ComponentType })), { loading: ModuleFallback });
const navigation = dynamic(() => import('@/modules/navigation').then(m => ({ default: m.NavigationModule as ComponentType })), { loading: ModuleFallback });
const notifications = dynamic(() => import('@/modules/notifications').then(m => ({ default: m.NotificationsModule as ComponentType })), { loading: ModuleFallback });
const settings = dynamic(() => import('@/modules/settings').then(m => ({ default: m.SettingsModule as ComponentType })), { loading: ModuleFallback });
const ai = dynamic(() => import('@/modules/ai').then(m => ({ default: m.AiModule as ComponentType })), { loading: ModuleFallback });
const webhooks = dynamic(() => import('@/modules/webhooks').then(m => ({ default: m.WebhooksModule as ComponentType })), { loading: ModuleFallback });
const audit = dynamic(() => import('@/modules/audit').then(m => ({ default: m.AuditModule as ComponentType })), { loading: ModuleFallback });
const backups = dynamic(() => import('@/modules/backups').then(m => ({ default: m.BackupsModule as ComponentType })), { loading: ModuleFallback });
const jobs = dynamic(() => import('@/modules/jobs').then(m => ({ default: m.JobsModule as ComponentType })), { loading: ModuleFallback });
const emailTemplates = dynamic(() => import('@/modules/email-templates').then(m => ({ default: m.EmailTemplatesModule as ComponentType })), { loading: ModuleFallback });
const profile = dynamic(() => import('@/modules/profile').then(m => ({ default: m.ProfileModule as ComponentType })), { loading: ModuleFallback });
const billing = dynamic(() => import('@/modules/billing').then(m => ({ default: m.BillingModule as ComponentType })), { loading: ModuleFallback });

export const moduleRegistry: Record<string, ComponentType> = {
  dashboard, content, media, users, categories, tags, comments, newsletter, 'email-templates': emailTemplates, seo, navigation, notifications, settings, ai, webhooks, audit, backups, jobs, profile, billing,
};
