// ============================================================
// COMPREHENSIVE TEST SUITE: REAL TECHNICAL SEO AUTO-FIX
// Tests:
// 1. Dynamic Canonical Calculation (site config + page URL, not hardcoded)
// 2. Action Model Classification (AUTO_FIXABLE vs AI_FIXABLE vs MANUAL vs INFORMATIONAL)
// 3. Technical Fix Registry Execution (canonical, schema, robots)
// 4. Verification Guardrail (never mark resolved without verified public HTML)
// 5. Public HTML Verification:
//    - Public page without canonical -> remains ACTIVE (isResolved = false), honest failure
//    - Public page with verified canonical -> becomes RESOLVED (isResolved = true), history saved
// 6. Resolve vs Auto-Fix vs Fix with AI separation
// 7. Write Access Verification (detects missing write path when applicable)
// ============================================================

import { db } from '../src/lib/db';
import {
  calculateDynamicCanonicalUrl,
  executeAutoFix,
} from '../src/lib/seo/auto-fix';
import { getFindingFixCapability } from '../src/lib/seo/capability';
import { verifyAndResolveFinding } from '../src/lib/seo/verifier';
import { auditSinglePage } from '../src/lib/seo/audit-engine';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING TECHNICAL SEO AUTO-FIX TEST SUITE');
  console.log('====================================================\n');

  // -----------------------------------------------------------------
  // 1. DYNAMIC CANONICAL URL CALCULATION
  // -----------------------------------------------------------------
  console.log('--- TEST GROUP 1: Dynamic Canonical URL Calculation ---');

  const siteWithConfig = {
    domain: 'verdantt.vercel.app',
    config: JSON.stringify({ connection: { siteUrl: 'https://verdantt.vercel.app' } }),
  };

  const canonical1 = calculateDynamicCanonicalUrl(
    '/blog/succulent-care-beginner-handbook',
    siteWithConfig,
  );
  assert(
    canonical1 === 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    'TEST 1.1: Generates canonical from site config and relative path',
    `Expected https://verdantt.vercel.app/blog/succulent-care-beginner-handbook, got ${canonical1}`,
  );

  const canonical2 = calculateDynamicCanonicalUrl(
    'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    siteWithConfig,
  );
  assert(
    canonical2 === 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    'TEST 1.2: Handles full URL input cleanly',
  );

  const customSite = {
    domain: 'custom-domain.com',
    config: JSON.stringify({ connection: { siteUrl: 'https://custom-domain.com' } }),
  };
  const canonical3 = calculateDynamicCanonicalUrl(
    '/articles/monstera-propagation',
    customSite,
  );
  assert(
    canonical3 === 'https://custom-domain.com/articles/monstera-propagation',
    'TEST 1.3: Dynamic calculation adapts to any custom connected domain (no hardcoding)',
  );

  // -----------------------------------------------------------------
  // 2. ACTION MODEL CLASSIFICATION
  // -----------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Core Action Model Classification ---');

  const autoFixableRules = [
    { ruleId: 'canonical-missing', problem: 'Missing canonical URL' },
    { ruleId: 'missing-canonical', problem: 'No canonical link detected' },
    { ruleId: 'invalid-canonical', problem: 'Canonical points to wrong domain' },
    { ruleId: 'schema-article-missing', problem: 'Missing Article structured data' },
    { ruleId: 'robots-noindex-directive', problem: 'Page blocked by robots noindex' },
  ];

  for (const item of autoFixableRules) {
    const cap = getFindingFixCapability(item);
    assert(
      cap.capability === 'AUTO_FIXABLE' && !cap.isAiFixable && !cap.requiresManualAction,
      `TEST 2.1: Rule "${item.ruleId}" correctly classified as AUTO_FIXABLE`,
    );
  }

  const aiFixableRules = [
    { ruleId: 'meta-description-missing', problem: 'Missing meta description' },
    { ruleId: 'meta-title-missing', problem: 'Missing SEO title tag' },
    { ruleId: 'geo-answer-passages', problem: 'Content lacks self-contained answer blocks' },
    { ruleId: 'geo-question-headings', problem: 'Headings do not use search question forms' },
  ];

  for (const item of aiFixableRules) {
    const cap = getFindingFixCapability(item);
    assert(
      cap.capability === 'AI_FIXABLE' && cap.isAiFixable && !cap.requiresManualAction,
      `TEST 2.2: Rule "${item.ruleId}" correctly classified as AI_FIXABLE`,
    );
  }

  const manualRules = [
    { ruleId: 'eeat-experience-signals', problem: 'Missing first-hand experience' },
    { ruleId: 'eeat-author-attribution', problem: 'Author attribution missing credentials' },
    { ruleId: 'eeat-external-citations', problem: 'Zero external source citations' },
    { ruleId: 'http-status-404', problem: 'Page returned HTTP 404 Not Found' },
  ];

  for (const item of manualRules) {
    const cap = getFindingFixCapability(item);
    assert(
      cap.capability === 'MANUAL' && !cap.isAiFixable && cap.requiresManualAction,
      `TEST 2.3: Rule "${item.ruleId}" correctly classified as MANUAL`,
    );
  }

  const infoFinding = getFindingFixCapability({ severity: 'INFO', problem: 'Optional SEO note' });
  assert(
    infoFinding.capability === 'INFORMATIONAL',
    'TEST 2.4: INFO severity classified as INFORMATIONAL',
  );

  // -----------------------------------------------------------------
  // 3. EXECUTE AUTO-FIX: SAFETY GUARDRAIL ON NON-AUTO-FIXABLE RULES
  // -----------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Auto-Fix Guardrails on Manual/AI Rules ---');

  const manualIssue = await db.seoIssue.create({
    data: {
      id: `test-manual-issue-${Date.now()}`,
      severity: 'WARNING',
      resourceType: 'content',
      pageUrl: 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
      problem: 'Missing first-hand experience and real testing signals',
      recommendation: 'Add author first-hand testing notes.\n\n[RULE_ID]: eeat-experience-signals',
      isResolved: false,
    },
  });

  const manualFixResult = await executeAutoFix({
    findingId: manualIssue.id,
    ruleId: 'eeat-experience-signals',
  });

  assert(
    manualFixResult.success === false &&
    manualFixResult.isResolved === false &&
    manualFixResult.status === 'UNSUPPORTED',
    'TEST 3.1: executeAutoFix rejects manual rule without fabricating a fix',
  );

  await db.seoIssue.delete({ where: { id: manualIssue.id } });

  // -----------------------------------------------------------------
  // 4. WRITE PATH VERIFICATION ON UNMANAGED PAGES
  // -----------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Write Path Verification on External/Unmanaged URLs ---');

  const externalIssue = await db.seoIssue.create({
    data: {
      id: `test-ext-issue-${Date.now()}`,
      severity: 'WARNING',
      resourceType: 'content',
      pageUrl: 'https://external-unmanaged-site.com/random-page-12345',
      problem: 'Missing canonical URL directive',
      recommendation: 'Add canonical URL.\n\n[RULE_ID]: canonical-missing',
      isResolved: false,
    },
  });

  const extFixResult = await executeAutoFix({
    findingId: externalIssue.id,
    ruleId: 'canonical-missing',
  });

  assert(
    extFixResult.isResolved === false &&
    extFixResult.status === 'MANUAL_REQUIRED' &&
    extFixResult.message.includes('does not currently have a write path'),
    'TEST 4.1: Honestly reports missing write path when URL has no CMS record',
  );

  await db.seoIssue.delete({ where: { id: externalIssue.id } });

  // -----------------------------------------------------------------
  // 5. CANONICAL AUTO-FIX: PUBLIC HTML REAL VERIFICATION
  // -----------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Real Auto-Fix & Public HTML Verification ---');

  // Use the real succulent article in CMS
  const succulentItem = await db.contentItem.findFirst({
    where: { slug: 'succulent-care-beginner-handbook' },
  });

  if (!succulentItem) {
    console.error('Succulent item not found in DB');
    return;
  }

  // Create real test finding
  const canonicalIssue = await db.seoIssue.create({
    data: {
      id: `test-canonical-${Date.now()}`,
      severity: 'WARNING',
      resourceType: 'content',
      resourceId: succulentItem.id,
      pageUrl: 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
      problem: 'Missing canonical URL directive',
      recommendation: 'Add <link rel="canonical"> in head.\n\n[RULE_ID]: canonical-missing',
      isResolved: false,
    },
  });

  // Execute Auto-Fix
  console.log('Executing executeAutoFix for canonical-missing on succulent article...');
  const autoFixResult = await executeAutoFix({
    findingId: canonicalIssue.id,
    ruleId: 'canonical-missing',
    userId: 'admin-tester',
  });

  assert(
    autoFixResult.ruleId === 'canonical-missing',
    'TEST 5.1: Correct ruleId handled',
  );
  assert(
    autoFixResult.newValue === 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    'TEST 5.2: Calculated exact dynamic canonical URL correctly',
  );

  // Check CMS database: SeoConfig was updated with canonicalUrl
  const updatedConfig = await db.seoConfig.findFirst({
    where: { resourceType: 'content', resourceId: succulentItem.id },
  });
  assert(
    updatedConfig?.canonicalUrl === 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    'TEST 5.3: CMS database SeoConfig was updated with canonicalUrl',
  );

  // Check finding resolution state:
  // If the live public HTML at https://verdantt.vercel.app does NOT have <link rel="canonical">,
  // Section 8 & 19 strictly forbid marking as resolved!
  const livePageCheck = await fetch('https://verdantt.vercel.app/blog/succulent-care-beginner-handbook');
  const liveHtml = await livePageCheck.text();
  const hasLiveCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(liveHtml);

  const issueInDb = await db.seoIssue.findUnique({ where: { id: canonicalIssue.id } });

  if (hasLiveCanonical) {
    assert(
      autoFixResult.isResolved === true && issueInDb?.isResolved === true,
      'TEST 5.4: Live public HTML has canonical -> finding marked RESOLVED',
    );
    assert(
      issueInDb?.recommendation.includes('[VERIFICATION_RESULT]: VERIFIED'),
      'TEST 5.5: History stores verified result in recommendation log',
    );
  } else {
    assert(
      autoFixResult.isResolved === false && issueInDb?.isResolved === false,
      'TEST 5.4: Live public HTML lacks canonical -> finding remains ACTIVE (no fake success)',
    );
    assert(
      autoFixResult.status === 'STILL_OPEN',
      'TEST 5.5: Status is STILL_OPEN when public HTML does not reflect tag',
    );
    assert(
      autoFixResult.message.includes('still not detected on the public page'),
      'TEST 5.6: Explains to user that public page still lacks canonical',
    );
    assert(
      issueInDb?.recommendation.includes('[AUTO_FIX_ATTEMPTED_AT]'),
      'TEST 5.7: History record of fix attempt is preserved in database',
    );
  }

  // -----------------------------------------------------------------
  // 6. AUDIT ENGINE UNIT VERIFICATION: SOURCE OF TRUTH PRINCIPLE
  // -----------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Audit Engine Source-of-Truth Principle ---');

  // Scenario A: CMS has canonical, BUT live HTML lacks it -> finding MUST be detected
  const auditWithMissingLiveCanonical = auditSinglePage({
    url: 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    title: 'Succulent Care 101',
    content: 'Long article text...',
    canonicalUrl: 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    liveHtml: '<html><head><title>Succulent Care 101</title></head><body>No canonical</body></html>',
  });

  const canonicalIssueFoundA = auditWithMissingLiveCanonical.findings.some(
    (f) => f.ruleId === 'canonical-missing',
  );
  assert(
    canonicalIssueFoundA === true,
    'TEST 6.1: When public HTML lacks canonical, audit detects missing canonical even if CMS has it',
  );

  // Scenario B: CMS has canonical, AND live HTML contains correct <link rel="canonical"> -> PASS (no finding)
  const auditWithPresentLiveCanonical = auditSinglePage({
    url: 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    title: 'Succulent Care 101',
    content: 'Long article text...',
    canonicalUrl: 'https://verdantt.vercel.app/blog/succulent-care-beginner-handbook',
    liveHtml: '<html><head><title>Succulent Care 101</title><link rel="canonical" href="https://verdantt.vercel.app/blog/succulent-care-beginner-handbook" /></head><body>Article</body></html>',
  });

  const canonicalIssueFoundB = auditWithPresentLiveCanonical.findings.some(
    (f) => f.ruleId === 'canonical-missing',
  );
  assert(
    canonicalIssueFoundB === false,
    'TEST 6.2: When public HTML contains canonical, rule passes with zero findings',
  );

  // Cleanup test finding
  await db.seoIssue.delete({ where: { id: canonicalIssue.id } });

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL AUTO-FIX TECHNICAL SEO REQUIREMENTS VERIFIED!');
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
