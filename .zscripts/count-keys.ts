import { coreEn } from '/home/z/my-project/src/lib/i18n/core/en';
import { clientContentEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-content';
import { clientPeopleEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-people';
import { clientAccountEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-account';
import { clientAiEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-ai';
import { clientBackupsEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-backups';
import { clientEmailTemplatesEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-email-templates';
import { clientAnalyticsEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-analytics';
import { clientAuditEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-audit';
import { clientJobsEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-jobs';
import { clientTaxonomyEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-taxonomy';
import { clientSeoEn } from '/home/z/my-project/src/lib/i18n/fragments/en/client-seo';
import { coreFr } from '/home/z/my-project/src/lib/i18n/core/fr';

const families: Record<string, Record<string,string>> = {
  content: clientContentEn, people: clientPeopleEn, account: clientAccountEn,
  ai: clientAiEn, backups: clientBackupsEn, emailTemplates: clientEmailTemplatesEn,
  analytics: clientAnalyticsEn, audit: clientAuditEn, jobs: clientJobsEn,
  taxonomy: clientTaxonomyEn, seo: clientSeoEn,
};
let total = 0;
for (const [name, dict] of Object.entries(families)) {
  console.log(name, Object.keys(dict).length);
  total += Object.keys(dict).length;
}
console.log('TOTAL client keys:', total);
console.log('core en:', Object.keys(coreEn).length, 'core fr:', Object.keys(coreFr).length);
// collisions check across families
const seen = new Map<string, string>();
let dup = 0;
for (const [name, dict] of Object.entries(families)) {
  for (const k of Object.keys(dict)) {
    if (seen.has(k)) { console.log('DUP:', k, seen.get(k), name); dup++; }
    seen.set(k, name);
  }
}
for (const k of Object.keys(coreEn)) {
  if (seen.has(k)) { console.log('DUP-CORE:', k); dup++; }
}
console.log('dup collisions:', dup);
