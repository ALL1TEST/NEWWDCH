import { PrismaClient } from '@prisma/client';
import { clientMarketingEn } from '../src/lib/i18n/fragments/en/client-marketing';

const prisma = new PrismaClient();

function t(key: string): string {
  return clientMarketingEn[key] ?? key;
}

function resolveTokens(raw: string, tokens: Record<string, string>): string {
  let text = raw;
  // Replace tokens like {terms}, {privacy}, etc.
  for (const [token, replacement] of Object.entries(tokens)) {
    text = text.replaceAll(`{${token}}`, replacement);
  }
  // Replace placeholders [like this] with styled span
  text = text.replace(/\[([^\]]+)\]/g, '<span class="px-1.5 py-0.5 rounded border border-border bg-muted/60 font-mono text-xs text-muted-foreground">[$1]</span>');
  return text;
}

async function run() {
  const pageType = await prisma.contentType.findFirst({ where: { slug: 'page' } });
  const author = await prisma.user.findFirst({ where: { id: 'cmt0pg30r0000uwmza35j6bwu' } }) || await prisma.user.findFirst({ where: { role: { in: ['OWNER', 'PLATFORM_ADMIN', 'ADMIN'] } } });

  if (!pageType || !author) {
    console.error('Missing pageType or author');
    return;
  }

  // Common legal tokens
  const legalTokens: Record<string, string> = {
    terms: '<a href="#/terms" class="font-medium text-primary underline underline-offset-2">Terms of Service</a>',
    privacy: '<a href="#/privacy" class="font-medium text-primary underline underline-offset-2">Privacy Policy</a>',
    security: '<a href="#/security" class="font-medium text-primary underline underline-offset-2">Security</a>',
    pricing: '<a href="#/pricing" class="font-medium text-primary underline underline-offset-2">Pricing</a>',
    cookiePrefs: 'Cookie Preferences',
    serviceProviders: '<a href="#privacy-service-providers" class="font-medium text-primary underline underline-offset-2">Service Providers</a>',
    legalRequirements: '<a href="#privacy-legal-requirements" class="font-medium text-primary underline underline-offset-2">Legal Requirements</a>',
    businessTransfers: '<a href="#privacy-business-transfers" class="font-medium text-primary underline underline-offset-2">Business Transfers</a>',
  };

  // 1. Build Exact SECURITY HTML (17 sections)
  let securityHtml = `<div class="legal-document space-y-8">
  <div class="border-b pb-6 mb-8">
    <h1 class="text-3xl font-bold tracking-tight mb-2">${t('mkt.security.title')}</h1>
    <p class="text-sm text-muted-foreground mb-4">${t('mkt.security.lastUpdated')}: September 23, 2026</p>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.security.intro')}</p>
  </div>`;

  const securitySections = [
    { num: 1, title: 'mkt.security.s1Title', blocks: [{ p: 'mkt.security.s1P1' }, { p: 'mkt.security.s1P2' }, { p: 'mkt.security.s1P3' }] },
    { num: 2, title: 'mkt.security.s2Title', blocks: [{ p: 'mkt.security.s2P1' }, { p: 'mkt.security.s2P2' }] },
    { num: 3, title: 'mkt.security.s3Title', blocks: [{ h3: 'mkt.security.s3H1' }, { p: 'mkt.security.s3P1' }, { h3: 'mkt.security.s3H2' }, { p: 'mkt.security.s3P2' }] },
    { num: 4, title: 'mkt.security.s4Title', blocks: [{ p: 'mkt.security.s4P1' }, { p: 'mkt.security.s4P2' }, { p: 'mkt.security.s4P3' }] },
    { num: 5, title: 'mkt.security.s5Title', blocks: [{ p: 'mkt.security.s5P1' }, { p: 'mkt.security.s5P2' }, { p: 'mkt.security.s5P3' }] },
    { num: 6, title: 'mkt.security.s6Title', blocks: [{ p: 'mkt.security.s6P1' }, { p: 'mkt.security.s6P2' }, { p: 'mkt.security.s6P3' }] },
    { num: 7, title: 'mkt.security.s7Title', blocks: [{ p: 'mkt.security.s7P1' }, { p: 'mkt.security.s7P2' }] },
    { num: 8, title: 'mkt.security.s8Title', blocks: [{ p: 'mkt.security.s8P1' }, { p: 'mkt.security.s8P2' }, { p: 'mkt.security.s8P3' }] },
    { num: 9, title: 'mkt.security.s9Title', blocks: [{ p: 'mkt.security.s9P1' }, { p: 'mkt.security.s9P2' }] },
    { num: 10, title: 'mkt.security.s10Title', blocks: [{ p: 'mkt.security.s10P1' }, { p: 'mkt.security.s10P2' }] },
    {
      num: 11,
      title: 'mkt.security.s11Title',
      blocks: [
        { p: 'mkt.security.s11P1' },
        { h3: 'mkt.security.s11H1' }, { p: 'mkt.security.s11P2' },
        { h3: 'mkt.security.s11H2' }, { p: 'mkt.security.s11P3' },
        { h3: 'mkt.security.s11H3' }, { p: 'mkt.security.s11P4' },
        { h3: 'mkt.security.s11H4' }, { p: 'mkt.security.s11P5' },
        { h3: 'mkt.security.s11H5' }, { p: 'mkt.security.s11P6' },
      ],
    },
    { num: 12, title: 'mkt.security.s12Title', blocks: [{ p: 'mkt.security.s12P1' }, { p: 'mkt.security.s12P2' }] },
    { num: 13, title: 'mkt.security.s13Title', blocks: [{ p: 'mkt.security.s13P1' }, { p: 'mkt.security.s13P2' }] },
    { num: 14, title: 'mkt.security.s14Title', blocks: [{ p: 'mkt.security.s14P1' }, { p: 'mkt.security.s14P2' }] },
    {
      num: 15,
      title: 'mkt.security.s15Title',
      blocks: [
        { p: 'mkt.security.s15P1' },
        {
          ul: [
            'mkt.security.s15L1',
            'mkt.security.s15L2',
            'mkt.security.s15L3',
            'mkt.security.s15L4',
            'mkt.security.s15L5',
          ],
        },
        { p: 'mkt.security.s15P2' },
      ],
    },
    { num: 16, title: 'mkt.security.s16Title', blocks: [{ p: 'mkt.security.s16P1' }, { p: 'mkt.security.s16P2' }, { p: 'mkt.security.s16P3' }, { p: 'mkt.security.s16P4' }] },
    { num: 17, title: 'mkt.security.s17Title', blocks: [{ p: 'mkt.security.s17P1' }] },
  ];

  for (const sec of securitySections) {
    securityHtml += `\n<section class="space-y-3 pt-6 border-t first:border-0 first:pt-0">
  <h2 class="text-xl font-bold tracking-tight text-foreground flex items-baseline gap-2">
    <span class="text-muted-foreground font-semibold text-lg">${sec.num}.</span>
    <span>${t(sec.title)}</span>
  </h2>`;

    for (const b of sec.blocks as any[]) {
      if (b.h3) {
        securityHtml += `\n  <h3 class="text-lg font-semibold text-foreground mt-4">${t(b.h3)}</h3>`;
      } else if (b.p) {
        securityHtml += `\n  <p class="text-base leading-relaxed text-muted-foreground">${resolveTokens(t(b.p), legalTokens)}</p>`;
      } else if (b.ul) {
        securityHtml += `\n  <ul class="space-y-2 pl-5 list-disc text-muted-foreground my-3">`;
        for (const it of b.ul) {
          const raw = t(it);
          const split = raw.split(' — ');
          const lead = split.length > 1 ? split.shift() : null;
          const rest = split.join(' — ');
          securityHtml += `\n    <li class="leading-relaxed">${lead ? `<strong class="text-foreground font-semibold">${lead}</strong> — ` : ''}${resolveTokens(rest, legalTokens)}</li>`;
        }
        securityHtml += `\n  </ul>`;
      }
    }

    if (sec.num === 17) {
      securityHtml += `\n  <div class="mt-6 rounded-xl border bg-muted/30 p-5 space-y-3">
    <p class="font-semibold text-foreground">${t('mkt.security.questions')}</p>
    <p class="text-sm text-muted-foreground"><strong>${t('mkt.security.contactEmailLabel')}:</strong> <span class="px-1.5 py-0.5 rounded border border-border bg-muted/60 font-mono text-xs">[Security Contact Email]</span></p>
    <a href="#/contact" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">${t('mkt.security.contactCta')} &rarr;</a>
  </div>`;
    }

    securityHtml += `\n</section>`;
  }
  securityHtml += `\n</div>`;

  // 2. Build Exact PRIVACY HTML (20 sections)
  let privacyHtml = `<div class="legal-document space-y-8">
  <div class="border-b pb-6 mb-8">
    <h1 class="text-3xl font-bold tracking-tight mb-2">${t('mkt.privacy.title')}</h1>
    <p class="text-sm text-muted-foreground mb-4">${t('mkt.privacy.effectiveAsOf')}: September 22, 2026</p>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.privacy.intro')}</p>
  </div>`;

  const privacySections = [
    { num: 1, title: 'mkt.privacy.s1Title', blocks: [{ p: 'mkt.privacy.s1P1' }, { p: 'mkt.privacy.s1P2' }] },
    { num: 2, title: 'mkt.privacy.s2Title', blocks: [{ p: 'mkt.privacy.s2P1' }, { h3: 'mkt.privacy.s2H1' }, { p: 'mkt.privacy.s2P2' }, { h3: 'mkt.privacy.s2H2' }, { p: 'mkt.privacy.s2P3' }] },
    { num: 3, title: 'mkt.privacy.s3Title', blocks: [{ p: 'mkt.privacy.s3P1' }, { p: 'mkt.privacy.s3P2' }] },
    { num: 4, title: 'mkt.privacy.s4Title', blocks: [{ p: 'mkt.privacy.s4P1' }, { ul: ['mkt.privacy.s4L1', 'mkt.privacy.s4L2', 'mkt.privacy.s4L3'] }, { p: 'mkt.privacy.s4P2' }] },
    { num: 5, title: 'mkt.privacy.s5Title', blocks: [{ p: 'mkt.privacy.s5P1' }, { ul: ['mkt.privacy.s5L1', 'mkt.privacy.s5L2'] }, { p: 'mkt.privacy.s5P2' }] },
    { num: 6, title: 'mkt.privacy.s6Title', blocks: [{ p: 'mkt.privacy.s6P1' }, { p: 'mkt.privacy.s6P2' }] },
    { num: 7, title: 'mkt.privacy.s7Title', blocks: [{ p: 'mkt.privacy.s7P1' }, { ul: ['mkt.privacy.s7L1', 'mkt.privacy.s7L2', 'mkt.privacy.s7L3', 'mkt.privacy.s7L4', 'mkt.privacy.s7L5', 'mkt.privacy.s7L6'] }, { p: 'mkt.privacy.s7P2' }] },
    { num: 8, title: 'mkt.privacy.s8Title', blocks: [{ p: 'mkt.privacy.s8P1' }, { ul: ['mkt.privacy.s8L1', 'mkt.privacy.s8L2'] }, { p: 'mkt.privacy.s8P2' }, { p: 'mkt.privacy.s8P3' }] },
    { num: 9, title: 'mkt.privacy.s9Title', blocks: [{ p: 'mkt.privacy.s9P1' }, { ul: ['mkt.privacy.s9L1', 'mkt.privacy.s9L2', 'mkt.privacy.s9L3'] }, { p: 'mkt.privacy.s9P2' }] },
    { num: 10, title: 'mkt.privacy.s10Title', blocks: [{ p: 'mkt.privacy.s10P1' }, { ul: ['mkt.privacy.s10L1', 'mkt.privacy.s10L2'] }, { p: 'mkt.privacy.s10P2' }] },
    { num: 11, title: 'mkt.privacy.s11Title', blocks: [{ p: 'mkt.privacy.s11P1' }] },
    { num: 12, title: 'mkt.privacy.s12Title', blocks: [{ p: 'mkt.privacy.s12P1' }] },
    { num: 13, title: 'mkt.privacy.s13Title', blocks: [{ p: 'mkt.privacy.s13P1' }] },
    { num: 14, title: 'mkt.privacy.s14Title', blocks: [{ p: 'mkt.privacy.s14P1' }, { p: 'mkt.privacy.s14P2' }] },
    { num: 15, title: 'mkt.privacy.s15Title', blocks: [{ p: 'mkt.privacy.s15P1' }, { p: 'mkt.privacy.s15P2' }] },
    { num: 16, title: 'mkt.privacy.s16Title', blocks: [{ p: 'mkt.privacy.s16P1' }, { p: 'mkt.privacy.s16P2' }] },
    { num: 17, title: 'mkt.privacy.s17Title', blocks: [{ p: 'mkt.privacy.s17P1' }, { ul: ['mkt.privacy.s17L1', 'mkt.privacy.s17L2', 'mkt.privacy.s17L3', 'mkt.privacy.s17L4', 'mkt.privacy.s17L5', 'mkt.privacy.s17L6', 'mkt.privacy.s17L7'] }, { p: 'mkt.privacy.s17P2' }] },
    { num: 18, title: 'mkt.privacy.s18Title', blocks: [{ p: 'mkt.privacy.s18P1' }, { p: 'mkt.privacy.s18P2' }] },
    { num: 19, title: 'mkt.privacy.s19Title', blocks: [{ p: 'mkt.privacy.s19P1' }, { p: 'mkt.privacy.s19P2' }] },
    { num: 20, title: 'mkt.privacy.s20Title', blocks: [{ p: 'mkt.privacy.s20P1' }] },
  ];

  for (const sec of privacySections) {
    privacyHtml += `\n<section class="space-y-3 pt-6 border-t first:border-0 first:pt-0">
  <h2 class="text-xl font-bold tracking-tight text-foreground flex items-baseline gap-2">
    <span class="text-muted-foreground font-semibold text-lg">${sec.num}.</span>
    <span>${t(sec.title)}</span>
  </h2>`;

    for (const b of sec.blocks as any[]) {
      if (b.h3) {
        privacyHtml += `\n  <h3 class="text-lg font-semibold text-foreground mt-4">${t(b.h3)}</h3>`;
      } else if (b.p) {
        privacyHtml += `\n  <p class="text-base leading-relaxed text-muted-foreground">${resolveTokens(t(b.p), legalTokens)}</p>`;
      } else if (b.ul) {
        privacyHtml += `\n  <ul class="space-y-2 pl-5 list-disc text-muted-foreground my-3">`;
        for (const it of b.ul) {
          const raw = t(it);
          const split = raw.split(' — ');
          const lead = split.length > 1 ? split.shift() : null;
          const rest = split.join(' — ');
          privacyHtml += `\n    <li class="leading-relaxed">${lead ? `<strong class="text-foreground font-semibold">${lead}</strong> — ` : ''}${resolveTokens(rest, legalTokens)}</li>`;
        }
        privacyHtml += `\n  </ul>`;
      }
    }

    if (sec.num === 20) {
      privacyHtml += `\n  <div class="mt-6 rounded-xl border bg-muted/30 p-5 space-y-3">
    <p class="font-semibold text-foreground">${t('mkt.privacy.questions')}</p>
    <p class="text-sm text-muted-foreground"><strong>${t('mkt.privacy.contactEmailLabel')}:</strong> <span class="px-1.5 py-0.5 rounded border border-border bg-muted/60 font-mono text-xs">[Privacy Contact Email]</span></p>
    <p class="text-sm text-muted-foreground"><strong>${t('mkt.privacy.contactCompanyLabel')}:</strong> <span class="px-1.5 py-0.5 rounded border border-border bg-muted/60 font-mono text-xs">[Company Legal Name]</span></p>
    <p class="text-sm text-muted-foreground"><strong>${t('mkt.privacy.contactAddressLabel')}:</strong> <span class="px-1.5 py-0.5 rounded border border-border bg-muted/60 font-mono text-xs">[Business Address]</span></p>
    <a href="#/contact" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">${t('mkt.privacy.contactCta')} &rarr;</a>
  </div>`;
    }

    privacyHtml += `\n</section>`;
  }
  privacyHtml += `\n</div>`;

  // 3. Build Exact TERMS OF SERVICE HTML (23 sections)
  let termsHtml = `<div class="legal-document space-y-8">
  <div class="border-b pb-6 mb-8">
    <h1 class="text-3xl font-bold tracking-tight mb-2">${t('mkt.terms.title')}</h1>
    <p class="text-sm text-muted-foreground mb-4">${t('mkt.terms.effectiveAsOf')}: September 22, 2026</p>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.terms.intro')}</p>
  </div>`;

  const termsSections = [
    { num: 1, title: 'mkt.terms.s1Title', blocks: [{ p: 'mkt.terms.s1P1' }, { p: 'mkt.terms.s1P2' }, { p: 'mkt.terms.s1P3' }] },
    { num: 2, title: 'mkt.terms.s2Title', blocks: [{ p: 'mkt.terms.s2P1' }, { p: 'mkt.terms.s2P2' }, { p: 'mkt.terms.s2P3' }, { p: 'mkt.terms.s2P4' }] },
    { num: 3, title: 'mkt.terms.s3Title', blocks: [{ p: 'mkt.terms.s3P1' }, { p: 'mkt.terms.s3P2' }, { p: 'mkt.terms.s3P3' }] },
    {
      num: 4,
      title: 'mkt.terms.s4Title',
      blocks: [
        { h3: 'mkt.terms.s4H1' }, { p: 'mkt.terms.s4P2' },
        { h3: 'mkt.terms.s4H2' }, { p: 'mkt.terms.s4P3' },
        { h3: 'mkt.terms.s4H3' }, { p: 'mkt.terms.s4P4' },
        { h3: 'mkt.terms.s4H4' }, { p: 'mkt.terms.s4P5' },
        { h3: 'mkt.terms.s4H5' }, { p: 'mkt.terms.s4P6' },
        { h3: 'mkt.terms.s4H6' }, { p: 'mkt.terms.s4P7' },
      ],
    },
    { num: 5, title: 'mkt.terms.s5Title', blocks: [{ p: 'mkt.terms.s5P1' }, { p: 'mkt.terms.s5P2' }] },
    { num: 6, title: 'mkt.terms.s6Title', blocks: [{ p: 'mkt.terms.s6P1' }, { ul: ['mkt.terms.s6L1', 'mkt.terms.s6L2', 'mkt.terms.s6L3', 'mkt.terms.s6L4', 'mkt.terms.s6L5', 'mkt.terms.s6L6', 'mkt.terms.s6L7'] }, { p: 'mkt.terms.s6P2' }] },
    { num: 7, title: 'mkt.terms.s7Title', blocks: [{ p: 'mkt.terms.s7P1' }, { p: 'mkt.terms.s7P2' }, { p: 'mkt.terms.s7P3' }] },
    { num: 8, title: 'mkt.terms.s8Title', blocks: [{ p: 'mkt.terms.s8P1' }, { p: 'mkt.terms.s8P2' }] },
    { num: 9, title: 'mkt.terms.s9Title', blocks: [{ p: 'mkt.terms.s9P1' }, { p: 'mkt.terms.s9P2' }] },
    { num: 10, title: 'mkt.terms.s10Title', blocks: [{ p: 'mkt.terms.s10P1' }, { p: 'mkt.terms.s10P2' }, { p: 'mkt.terms.s10P3' }, { p: 'mkt.terms.s10P4' }] },
    { num: 11, title: 'mkt.terms.s11Title', blocks: [{ p: 'mkt.terms.s11P1' }] },
    { num: 12, title: 'mkt.terms.s12Title', blocks: [{ p: 'mkt.terms.s12P1' }, { p: 'mkt.terms.s12P2' }] },
    { num: 13, title: 'mkt.terms.s13Title', blocks: [{ p: 'mkt.terms.s13P1' }, { p: 'mkt.terms.s13P2' }] },
    { num: 14, title: 'mkt.terms.s14Title', blocks: [{ p: 'mkt.terms.s14P1' }, { p: 'mkt.terms.s14P2' }, { p: 'mkt.terms.s14P3' }] },
    { num: 15, title: 'mkt.terms.s15Title', blocks: [{ p: 'mkt.terms.s15P1' }, { p: 'mkt.terms.s15P2' }] },
    { num: 16, title: 'mkt.terms.s16Title', blocks: [{ p: 'mkt.terms.s16P1' }, { p: 'mkt.terms.s16P2' }] },
    { num: 17, title: 'mkt.terms.s17Title', blocks: [{ p: 'mkt.terms.s17P1' }, { p: 'mkt.terms.s17P2' }] },
    { num: 18, title: 'mkt.terms.s18Title', blocks: [{ p: 'mkt.terms.s18P1' }, { p: 'mkt.terms.s18P2' }] },
    { num: 19, title: 'mkt.terms.s19Title', blocks: [{ p: 'mkt.terms.s19P1' }, { p: 'mkt.terms.s19P2' }] },
    { num: 20, title: 'mkt.terms.s20Title', blocks: [{ p: 'mkt.terms.s20P1' }] },
    { num: 21, title: 'mkt.terms.s21Title', blocks: [{ p: 'mkt.terms.s21P1' }, { p: 'mkt.terms.s21P2' }] },
    {
      num: 22,
      title: 'mkt.terms.s22Title',
      blocks: [
        { h3: 'mkt.terms.s22H1' }, { p: 'mkt.terms.s22P1' },
        { h3: 'mkt.terms.s22H2' }, { p: 'mkt.terms.s22P2' },
        { h3: 'mkt.terms.s22H3' }, { p: 'mkt.terms.s22P3' },
        { h3: 'mkt.terms.s22H4' }, { p: 'mkt.terms.s22P4' },
        { h3: 'mkt.terms.s22H5' }, { p: 'mkt.terms.s22P5' },
      ],
    },
    { num: 23, title: 'mkt.terms.s23Title', blocks: [{ p: 'mkt.terms.s23P1' }] },
  ];

  for (const sec of termsSections) {
    termsHtml += `\n<section class="space-y-3 pt-6 border-t first:border-0 first:pt-0">
  <h2 class="text-xl font-bold tracking-tight text-foreground flex items-baseline gap-2">
    <span class="text-muted-foreground font-semibold text-lg">${sec.num}.</span>
    <span>${t(sec.title)}</span>
  </h2>`;

    for (const b of sec.blocks as any[]) {
      if (b.h3) {
        termsHtml += `\n  <h3 class="text-lg font-semibold text-foreground mt-4">${t(b.h3)}</h3>`;
      } else if (b.p) {
        termsHtml += `\n  <p class="text-base leading-relaxed text-muted-foreground">${resolveTokens(t(b.p), legalTokens)}</p>`;
      } else if (b.ul) {
        termsHtml += `\n  <ul class="space-y-2 pl-5 list-disc text-muted-foreground my-3">`;
        for (const it of b.ul) {
          const raw = t(it);
          const split = raw.split(' — ');
          const lead = split.length > 1 ? split.shift() : null;
          const rest = split.join(' — ');
          termsHtml += `\n    <li class="leading-relaxed">${lead ? `<strong class="text-foreground font-semibold">${lead}</strong> — ` : ''}${resolveTokens(rest, legalTokens)}</li>`;
        }
        termsHtml += `\n  </ul>`;
      }
    }

    if (sec.num === 23) {
      termsHtml += `\n  <div class="mt-6 rounded-xl border bg-muted/30 p-5 space-y-3">
    <p class="font-semibold text-foreground">${t('mkt.terms.questions')}</p>
    <p class="text-sm text-muted-foreground"><strong>${t('mkt.terms.contactEmailLabel')}:</strong> <span class="px-1.5 py-0.5 rounded border border-border bg-muted/60 font-mono text-xs">[Legal Contact Email]</span></p>
    <p class="text-sm text-muted-foreground"><strong>${t('mkt.terms.contactCompanyLabel')}:</strong> <span class="px-1.5 py-0.5 rounded border border-border bg-muted/60 font-mono text-xs">[Company Legal Name]</span></p>
    <a href="#/contact" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">${t('mkt.terms.contactCta')} &rarr;</a>
  </div>`;
    }

    termsHtml += `\n</section>`;
  }
  termsHtml += `\n</div>`;

  // 4. Build Exact ABOUT HTML
  const aboutHtml = `<div class="about-document space-y-10">
  <div class="border-b pb-8">
    <h1 class="text-4xl font-extrabold tracking-tight mb-3">${t('mkt.about.heroTitle')}</h1>
    <h2 class="text-2xl font-bold text-foreground mb-3">${t('mkt.about.missionHead')}</h2>
    <p class="text-lg text-muted-foreground leading-relaxed max-w-3xl">${t('mkt.about.missionLead')}</p>
  </div>

  <section class="space-y-4">
    <h2 class="text-2xl font-bold tracking-tight text-foreground">${t('mkt.about.rowMissionTitle')}</h2>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.about.rowMissionBody1')}</p>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.about.rowMissionBody2')}</p>
  </section>

  <section class="space-y-4 pt-6 border-t">
    <h2 class="text-2xl font-bold tracking-tight text-foreground">${t('mkt.about.rowStoryTitle')}</h2>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.about.rowStoryBody1')}</p>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.about.rowStoryBody2')}</p>
  </section>

  <section class="space-y-6 pt-6 border-t">
    <h2 class="text-2xl font-bold tracking-tight text-foreground">${t('mkt.about.believeTitle')}</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-xl border p-5 bg-card">
        <h3 class="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-primary"></span>
          ${t('mkt.about.believe1Title')}
        </h3>
        <p class="text-sm text-muted-foreground leading-relaxed">${t('mkt.about.believe1Body')}</p>
      </div>
      <div class="rounded-xl border p-5 bg-card">
        <h3 class="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-primary"></span>
          ${t('mkt.about.believe2Title')}
        </h3>
        <p class="text-sm text-muted-foreground leading-relaxed">${t('mkt.about.believe2Body')}</p>
      </div>
      <div class="rounded-xl border p-5 bg-card">
        <h3 class="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-primary"></span>
          ${t('mkt.about.believe3Title')}
        </h3>
        <p class="text-sm text-muted-foreground leading-relaxed">${t('mkt.about.believe3Body')}</p>
      </div>
      <div class="rounded-xl border p-5 bg-card">
        <h3 class="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-primary"></span>
          ${t('mkt.about.believe4Title')}
        </h3>
        <p class="text-sm text-muted-foreground leading-relaxed">${t('mkt.about.believe4Body')}</p>
      </div>
    </div>
  </section>

  <section class="space-y-4 pt-6 border-t">
    <h2 class="text-2xl font-bold tracking-tight text-foreground">${t('mkt.about.customersTitle')}</h2>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.about.customersBody')}</p>
    <div class="rounded-xl border bg-muted/20 p-6 space-y-3">
      <p class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">${t('mkt.about.demoBadge')}</p>
      <blockquote class="italic text-base text-foreground font-serif">&ldquo;${t('mkt.about.demoQuote1')}&rdquo;</blockquote>
      <p class="text-sm text-muted-foreground font-medium">— ${t('mkt.about.demoName')}, ${t('mkt.about.demoRole')} at ${t('mkt.about.demoCompany')}</p>
    </div>
  </section>
</div>`;

  // 5. Build Exact CONTACT HTML
  const contactHtml = `<div class="contact-document space-y-8">
  <div class="border-b pb-6">
    <h1 class="text-3xl font-bold tracking-tight mb-2">${t('mkt.contact.title')}</h1>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.contact.intro')}</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <div class="rounded-xl border p-6 bg-card space-y-3">
      <h3 class="text-lg font-semibold text-foreground">${t('mkt.contact.billingTitle')}</h3>
      <p class="text-sm text-muted-foreground leading-relaxed">${t('mkt.contact.billingBody')}</p>
      <a href="#/pricing" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">${t('mkt.contact.billingCta')} &rarr;</a>
    </div>

    <div class="rounded-xl border p-6 bg-card space-y-3">
      <h3 class="text-lg font-semibold text-foreground">${t('mkt.contact.faqTitle')}</h3>
      <p class="text-sm text-muted-foreground leading-relaxed">${t('mkt.contact.faqBody')}</p>
      <a href="#/pricing#faq" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">${t('mkt.contact.faqCta')} &rarr;</a>
    </div>

    <div class="rounded-xl border p-6 bg-card space-y-3">
      <h3 class="text-lg font-semibold text-foreground">${t('mkt.contact.securityTitle')}</h3>
      <p class="text-sm text-muted-foreground leading-relaxed">${t('mkt.contact.securityBody')}</p>
      <a href="#/security" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">${t('mkt.contact.securityCta')} &rarr;</a>
    </div>

    <div class="rounded-xl border p-6 bg-card space-y-3">
      <h3 class="text-lg font-semibold text-foreground">${t('mkt.contact.tryTitle')}</h3>
      <p class="text-sm text-muted-foreground leading-relaxed">${t('mkt.contact.tryBody')}</p>
      <a href="#/signup" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">${t('mkt.contact.tryCta')} &rarr;</a>
    </div>
  </div>
</div>`;

  // 6. Build Exact ACCESSIBILITY HTML
  const accessibilityHtml = `<div class="accessibility-document space-y-8">
  <div class="border-b pb-6">
    <h1 class="text-3xl font-bold tracking-tight mb-2">${t('mkt.footer.accessibility')}</h1>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.a11y.intro')}</p>
  </div>
  
  <div class="space-y-6">
    <section class="space-y-2">
      <h2 class="text-lg font-semibold text-foreground">${t('mkt.a11y.keyboardTitle')}</h2>
      <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.a11y.keyboardBody')}</p>
    </section>

    <section class="space-y-2 pt-4 border-t">
      <h2 class="text-lg font-semibold text-foreground">${t('mkt.a11y.motionTitle')}</h2>
      <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.a11y.motionBody')}</p>
    </section>

    <section class="space-y-2 pt-4 border-t">
      <h2 class="text-lg font-semibold text-foreground">${t('mkt.a11y.contrastTitle')}</h2>
      <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.a11y.contrastBody')}</p>
    </section>

    <section class="space-y-2 pt-4 border-t">
      <h2 class="text-lg font-semibold text-foreground">${t('mkt.a11y.feedbackTitle')}</h2>
      <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.a11y.feedbackBody')}</p>
    </section>
  </div>
</div>`;

  // 7. Build Exact LEGAL CENTER HTML
  const legalCenterHtml = `<div class="legal-center-document space-y-8">
  <div class="border-b pb-6">
    <h1 class="text-3xl font-bold tracking-tight mb-2">${t('mkt.footer.legalCenter')}</h1>
    <p class="text-base text-muted-foreground leading-relaxed">${t('mkt.legal.intro')}</p>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <a href="#/privacy" class="p-5 rounded-xl border bg-card hover:border-primary/50 transition-colors flex items-center justify-between">
      <div>
        <h3 class="font-semibold text-foreground">${t('mkt.footer.privacy')}</h3>
        <p class="text-xs text-muted-foreground mt-1">Data collection, protection and rights</p>
      </div>
      <span class="text-primary">&rarr;</span>
    </a>
    <a href="#/terms" class="p-5 rounded-xl border bg-card hover:border-primary/50 transition-colors flex items-center justify-between">
      <div>
        <h3 class="font-semibold text-foreground">${t('mkt.footer.terms')}</h3>
        <p class="text-xs text-muted-foreground mt-1">Platform service terms & agreements</p>
      </div>
      <span class="text-primary">&rarr;</span>
    </a>
    <a href="#/security" class="p-5 rounded-xl border bg-card hover:border-primary/50 transition-colors flex items-center justify-between">
      <div>
        <h3 class="font-semibold text-foreground">${t('mkt.footer.security')}</h3>
        <p class="text-xs text-muted-foreground mt-1">Infrastructure, encryption & audits</p>
      </div>
      <span class="text-primary">&rarr;</span>
    </a>
    <a href="#/accessibility" class="p-5 rounded-xl border bg-card hover:border-primary/50 transition-colors flex items-center justify-between">
      <div>
        <h3 class="font-semibold text-foreground">${t('mkt.footer.accessibility')}</h3>
        <p class="text-xs text-muted-foreground mt-1">Inclusive web and WCAG guidelines</p>
      </div>
      <span class="text-primary">&rarr;</span>
    </a>
  </div>
</div>`;

  const pagesToSeed = [
    {
      title: 'Security & Compliance',
      slug: 'security',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-23T10:00:00Z'),
      seoTitle: 'Security & Infrastructure — Karmax',
      seoDescription: 'Learn how Karmax protects your data, secures its infrastructure, and maintains the reliability and integrity of its services.',
      content: securityHtml,
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-22T10:00:00Z'),
      seoTitle: 'Privacy Policy — Karmax',
      seoDescription: 'Read the Karmax Privacy Policy to understand how we collect, use, protect, and manage your personal data.',
      content: privacyHtml,
    },
    {
      title: 'Terms of Service',
      slug: 'terms',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-22T10:00:00Z'),
      seoTitle: 'Terms of Service — Karmax',
      seoDescription: 'Read the terms and conditions that govern your access to and use of the Karmax multi-site publishing platform.',
      content: termsHtml,
    },
    {
      title: 'About Karmax',
      slug: 'about',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-20T10:00:00Z'),
      seoTitle: 'About Karmax — One Calm Workflow for Everything You Publish',
      seoDescription: 'Learn about the Karmax mission, our editorial principles, and how we empower publishers to run every site from one calm dashboard.',
      content: aboutHtml,
    },
    {
      title: 'Contact Us',
      slug: 'contact',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-21T10:00:00Z'),
      seoTitle: 'Contact Karmax — Support, Sales & Inquiries',
      seoDescription: 'Get in touch with the Karmax team for platform support, enterprise sales, security disclosures, and partnership inquiries.',
      content: contactHtml,
    },
    {
      title: 'Accessibility Statement',
      slug: 'accessibility',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-21T10:00:00Z'),
      seoTitle: 'Accessibility — Karmax',
      seoDescription: 'Our commitment to keeping this website usable by everyone, and how we work toward it.',
      content: accessibilityHtml,
    },
    {
      title: 'Legal Center',
      slug: 'legal',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-21T10:00:00Z'),
      seoTitle: 'Legal Center — Karmax',
      seoDescription: 'Policies and legal information for the Karmax platform, in one place.',
      content: legalCenterHtml,
    },
  ];

  for (const page of pagesToSeed) {
    const existing = await prisma.contentItem.findFirst({
      where: { slug: page.slug, contentTypeId: pageType.id, siteId: null },
    });
    if (existing) {
      await prisma.contentItem.update({
        where: { id: existing.id },
        data: {
          title: page.title,
          content: page.content,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          status: page.status,
          updatedAt: new Date(),
        },
      });
      console.log(`Updated page '${page.title}' (${page.slug}) — Content length: ${page.content.length} chars`);
    } else {
      await prisma.contentItem.create({
        data: page,
      });
      console.log(`Created page '${page.title}' (${page.slug}) — Content length: ${page.content.length} chars`);
    }
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
