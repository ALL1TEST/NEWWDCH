const fs = require('fs');

console.log('=== VERIFYING SIMPLIFIED COMMENTS UI & BACKEND INTEGRITY ===\n');

// 1. Check Comments Page UI
const commentsPageContent = fs.readFileSync('src/modules/comments/comments-page.tsx', 'utf8');

const forbiddenTerms = [
  'SPAM_PROVIDERS',
  'ProviderDraft',
  'Select provider',
  'Provider:',
  't(\'comments.provider\')',
  'comments.providerAkismet',
  'comments.providerCustom',
  'comments.providerNone',
  'akismet-api-key',
  'akismet-blog-url',
  'Save Akismet',
  'Test Connection',
  'Custom Provider Not Supported',
];

let hasForbidden = false;
for (const term of forbiddenTerms) {
  if (commentsPageContent.includes(term)) {
    console.error(`❌ Found forbidden term in comments-page.tsx: "${term}"`);
    hasForbidden = true;
  }
}

if (!hasForbidden) {
  console.log('✓ Provider dropdown, options, keys, and technical details completely removed from Comments page.');
} else {
  process.exit(1);
}

// Check presence of desired elements in comments-page.tsx
const requiredElements = [
  'Allow Comments',
  'Auto Spam Detection',
  'Automatic spam filtering isn\'t configured yet.',
  'Please configure spam protection in Settings.',
  'enable-comments',
  'spam-detection',
];

for (const el of requiredElements) {
  if (!commentsPageContent.includes(el.replace("'", "&apos;")) && !commentsPageContent.includes(el)) {
    console.error(`❌ Missing expected element in comments-page.tsx: "${el}"`);
    process.exit(1);
  }
}
console.log('✓ Only "Allow Comments", "Auto Spam Detection", and friendly warning banner present in Comments page UI.\n');

// 2. Check Backend Akismet integration files exist and intact
const akismetLib = fs.readFileSync('src/lib/akismet.ts', 'utf8');
if (
  akismetLib.includes('checkCommentSpam') &&
  akismetLib.includes('isAkismetConfigured') &&
  akismetLib.includes('verifyAkismetKey')
) {
  console.log('✓ Backend Akismet library intact (checkCommentSpam, isAkismetConfigured, verifyAkismetKey).');
} else {
  console.error('❌ Akismet library missing core functions.');
  process.exit(1);
}

// 3. Check Settings Page
const spamSettingsPage = fs.readFileSync('src/modules/settings/spam-settings-page.tsx', 'utf8');
if (
  spamSettingsPage.includes('Spam Protection Settings') &&
  spamSettingsPage.includes('Akismet Anti-Spam') &&
  spamSettingsPage.includes('/api/settings/spam/verify-akismet')
) {
  console.log('✓ Platform/Settings level Spam Protection page created and properly integrated.\n');
} else {
  console.error('❌ SpamSettingsPage invalid.');
  process.exit(1);
}

console.log('=== ALL SIMPLIFICATION & BACKEND INTEGRITY CHECKS PASSED ===');
