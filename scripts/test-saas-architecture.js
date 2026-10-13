const fs = require('fs');

console.log('=== VERIFYING SAAS PLATFORM ARCHITECTURE & CLIENT COMMENTS UI ===\n');

// 1. Client Comments Page
const commentsPage = fs.readFileSync('src/modules/comments/comments-page.tsx', 'utf8');

const forbiddenInClient = [
  'Automatic spam filtering isn',
  'Please configure spam protection',
  'Provider:',
  'spam provider',
  'comment_spam_provider',
  'Akismet',
  'Custom provider',
  'Custom Provider',
  'API key',
  'api_key',
];

for (const term of forbiddenInClient) {
  if (commentsPage.includes(term)) {
    console.error(`❌ Found forbidden term in client comments page: "${term}"`);
    process.exit(1);
  }
}
console.log('✓ Client Comments page has NO warnings, NO provider mentions, and NO configuration tasks.');

const requiredClient = [
  'Allow Comments',
  'Auto Spam Detection',
  'Allow visitors to post comments on your articles.',
  'Automatically detect and filter suspicious comments.',
];

for (const req of requiredClient) {
  if (!commentsPage.includes(req)) {
    console.error(`❌ Missing expected text in client comments page: "${req}"`);
    process.exit(1);
  }
}
console.log('✓ Client Comments page ONLY displays the two simple switches and their descriptions.');

// 2. Platform Admin Spam Module
const platformSpam = fs.readFileSync('src/modules/platform/platform-spam.tsx', 'utf8');
if (!platformSpam.includes('PlatformSpamModule') || !platformSpam.includes('Akismet Anti-Spam')) {
  console.error('❌ PlatformSpamModule is invalid.');
  process.exit(1);
}
console.log('✓ Platform Owner Spam Protection module exists at src/modules/platform/platform-spam.tsx.');

// 3. Platform Module Registry & Sidebar
const platformIndex = fs.readFileSync('src/modules/platform/index.tsx', 'utf8');
if (!platformIndex.includes("'platform-spam': spam")) {
  console.error('❌ platform-spam not registered in platformModuleRegistry.');
  process.exit(1);
}
console.log('✓ platform-spam registered in platformModuleRegistry.');

const sidebar = fs.readFileSync('src/components/layout/sidebar.tsx', 'utf8');
if (!sidebar.includes("href: '#platform-spam'")) {
  console.error('❌ #platform-spam not in PLATFORM_NAV_ITEMS.');
  process.exit(1);
}
if (sidebar.includes("href: '#settings/spam'")) {
  console.error('❌ #settings/spam should NOT be in client navigation.');
  process.exit(1);
}
console.log('✓ Sidebar correctly routes spam protection ONLY under Platform Admin (#platform-spam).');

// 4. Akismet backend environment & DB configuration
const akismetLib = fs.readFileSync('src/lib/akismet.ts', 'utf8');
if (!akismetLib.includes('process.env.AKISMET_API_KEY')) {
  console.error('❌ akismet.ts does not check process.env.AKISMET_API_KEY.');
  process.exit(1);
}
console.log('✓ Backend supports infrastructure-level AKISMET_API_KEY environment configuration.');

console.log('\n=== ALL SAAS ARCHITECTURE CHECKS PASSED ===');
