// ============================================================
// API Key Service — Generation, hashing, validation, rotation
// ============================================================

import crypto from 'crypto';
import { nanoid } from 'nanoid';

// -------------------- Key Generation --------------------

export function generateApiKey(type: 'LIVE' | 'TEST' = 'LIVE'): { raw: string; hash: string; prefix: string } {
  const prefix = type === 'LIVE' ? 'cms_live_' : 'cms_test_';
  const raw = `${prefix}${nanoid(32)}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const displayPrefix = raw.substring(0, 16);
  return { raw, hash, prefix: displayPrefix };
}

// -------------------- Key Validation --------------------

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/** Timing-safe comparison to prevent timing attacks */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// -------------------- IP Matching --------------------

export function matchIpPattern(ip: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return ip === pattern;

  // Support CIDR-like wildcard: 192.168.* -> 192.168.0-255.x
  const parts = pattern.split('.');
  const ipParts = ip.split('.');
  if (parts.length !== ipParts.length) return false;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '*') continue;
    if (parts[i] !== ipParts[i]) return false;
  }
  return true;
}

export function isIpAllowed(ip: string, allowedIps: string[]): boolean {
  if (allowedIps.length === 0) return true;
  return allowedIps.some((pattern) => matchIpPattern(ip, pattern));
}

// -------------------- Domain Matching --------------------

export function isDomainAllowed(origin: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  try {
    const hostname = new URL(origin).hostname;
    return allowedDomains.some(
      (d) => d === hostname || hostname === `www.${d}` || hostname.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.some(
    (o) => o === origin || origin.startsWith(o.replace(/\/$/, ''))
  );
}

// -------------------- User Agent Parsing --------------------

export function parseUserAgent(ua: string | null): { browser: string; device: string } {
  if (!ua) return { browser: 'Unknown', device: 'Unknown' };

  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Postman')) browser = 'Postman';
  else if (ua.includes('curl')) browser = 'cURL';
  else if (ua.includes('axios')) browser = 'Axios';
  else if (ua.includes('node-fetch')) browser = 'Node.js';

  let device = 'Desktop';
  if (/Mobile|Android.*Mobile|iPhone|iPod/.test(ua)) device = 'Mobile';
  else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) device = 'Tablet';

  return { browser, device };
}

// -------------------- Scope Definitions --------------------

export const API_SCOPES = [
  { key: 'content:read', label: 'Content — Read', group: 'Content' },
  { key: 'content:write', label: 'Content — Write', group: 'Content' },
  { key: 'content:delete', label: 'Content — Delete', group: 'Content' },
  { key: 'content:publish', label: 'Content — Publish', group: 'Content' },
  { key: 'media:read', label: 'Media — Read', group: 'Media' },
  { key: 'media:write', label: 'Media — Write', group: 'Media' },
  { key: 'media:delete', label: 'Media — Delete', group: 'Media' },
  { key: 'seo:read', label: 'SEO — Read', group: 'SEO' },
  { key: 'seo:write', label: 'SEO — Write', group: 'SEO' },
  { key: 'users:read', label: 'Users — Read', group: 'Users' },
  { key: 'users:write', label: 'Users — Write', group: 'Users' },
  { key: 'users:delete', label: 'Users — Delete', group: 'Users' },
  { key: 'newsletter:read', label: 'Newsletter — Read', group: 'Newsletter' },
  { key: 'newsletter:write', label: 'Newsletter — Write', group: 'Newsletter' },
  { key: 'analytics:read', label: 'Analytics — Read', group: 'Analytics' },
  { key: 'backup:create', label: 'Backup — Create', group: 'Backup' },
  { key: 'backup:restore', label: 'Backup — Restore', group: 'Backup' },
  { key: 'webhook:create', label: 'Webhook — Create', group: 'Webhooks' },
  { key: 'webhook:delete', label: 'Webhook — Delete', group: 'Webhooks' },
  { key: 'settings:read', label: 'Settings — Read', group: 'Settings' },
  { key: 'settings:write', label: 'Settings — Write', group: 'Settings' },
  { key: 'ai:generate', label: 'AI — Generate', group: 'AI' },
  { key: 'ai:usage', label: 'AI — Usage', group: 'AI' },
  { key: 'monitoring:read', label: 'Monitoring — Read', group: 'Monitoring' },
  { key: 'api:*', label: 'API — Full Access', group: 'API' },
] as const;

export const SCOPE_GROUPS = [...new Set(API_SCOPES.map((s) => s.group))];

export const EXPIRATION_OPTIONS = [
  { label: '1 Day', value: '1d' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: 'Never', value: 'never' },
] as const;

export function getExpirationDate(option: string): Date | null {
  if (option === 'never') return null;
  const days = parseInt(option.replace('d', ''), 10);
  if (isNaN(days) || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// -------------------- PAT Generation --------------------

export function generatePat(): { raw: string; hash: string; prefix: string } {
  const raw = `cms_pat_${nanoid(32)}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.substring(0, 16);
  return { raw, hash, prefix };
}

// -------------------- OAuth Client --------------------

export function generateOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
  secretHash: string;
} {
  const clientId = `cms_oauth_${nanoid(16)}`;
  const clientSecret = `cms_os_${nanoid(40)}`;
  const secretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');
  return { clientId, clientSecret, secretHash };
}

// -------------------- Country from IP (simplified) --------------------

// In production, integrate with a GeoIP database like MaxMind
// For now, returns null — can be enhanced later
export function getCountryFromIp(_ip: string): string | null {
  return null;
}
