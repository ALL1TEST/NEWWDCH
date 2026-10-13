// ============================================================
// Automated Tests: Real Verdant Sitemap & Semantic Robots.txt System
// Includes full verification of Cases A through F and live endpoints.
// ============================================================

import { db } from '../src/lib/db';
import { verifyRobotsSemantic } from '../src/lib/seo/robots-verifier';

async function runTests() {
  console.log('====================================================');
  console.log('TESTING SEMANTIC ROBOTS.TXT & SITEMAP VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  const connectedDomain = 'verdantt.vercel.app';
  const expectedSitemapUrl = 'https://verdantt.vercel.app/sitemap.xml';
  const baseCmsContent = `User-agent: *\nAllow: /\n\nSitemap: https://verdantt.vercel.app/sitemap.xml`;

  // ----------------------------------------------------
  // CASE A: CMS and public robots.txt contain required directives -> Published & Live
  // ----------------------------------------------------
  const caseA = verifyRobotsSemantic({
    cmsContent: baseCmsContent,
    publicContent: `User-agent: *\nAllow: /\n\nSitemap: https://verdantt.vercel.app/sitemap.xml`,
    publicRobotsHttpStatus: 200,
    publicSitemapHttpStatus: 200,
    expectedSitemapUrl,
    connectedDomain,
  });
  assert(caseA.status === 'PUBLISHED', 'Case A: Status is PUBLISHED');
  assert(caseA.statusLabel === 'Published & Live', 'Case A: Status label is "Published & Live"');
  assert(caseA.isLiveSynced === true, 'Case A: isLiveSynced is true');

  // ----------------------------------------------------
  // CASE B: Public robots.txt has extra valid directives (Disallow: /api/) -> Published & Live
  // ----------------------------------------------------
  const caseB = verifyRobotsSemantic({
    cmsContent: baseCmsContent,
    publicContent: `User-Agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://verdantt.vercel.app/sitemap.xml`,
    publicRobotsHttpStatus: 200,
    publicSitemapHttpStatus: 200,
    expectedSitemapUrl,
    connectedDomain,
  });
  assert(caseB.status === 'PUBLISHED', 'Case B: Extra Disallow: /api/ allows PUBLISHED');
  assert(caseB.statusLabel === 'Published & Live', 'Case B: Status label is "Published & Live"');
  assert(caseB.isLiveSynced === true, 'Case B: isLiveSynced is true');

  // ----------------------------------------------------
  // CASE C: Public robots.txt is missing the Sitemap directive -> Mismatch detected
  // ----------------------------------------------------
  const caseC = verifyRobotsSemantic({
    cmsContent: baseCmsContent,
    publicContent: `User-agent: *\nAllow: /\nDisallow: /api/`,
    publicRobotsHttpStatus: 200,
    publicSitemapHttpStatus: 200,
    expectedSitemapUrl,
    connectedDomain,
  });
  assert(caseC.status === 'MISMATCH_DETECTED', 'Case C: Missing sitemap causes MISMATCH_DETECTED');
  assert(caseC.statusLabel === 'Mismatch detected', 'Case C: Status label is "Mismatch detected"');
  assert(caseC.isLiveSynced === false, 'Case C: isLiveSynced is false');

  // ----------------------------------------------------
  // CASE D: Public robots.txt contains wrong sitemap domain -> Mismatch detected
  // ----------------------------------------------------
  const caseD = verifyRobotsSemantic({
    cmsContent: baseCmsContent,
    publicContent: `User-agent: *\nAllow: /\n\nSitemap: https://cms.example.com/sitemap.xml`,
    publicRobotsHttpStatus: 200,
    publicSitemapHttpStatus: 200,
    expectedSitemapUrl,
    connectedDomain,
  });
  assert(caseD.status === 'MISMATCH_DETECTED', 'Case D: Wrong sitemap domain causes MISMATCH_DETECTED');
  assert(caseD.statusLabel === 'Mismatch detected', 'Case D: Status label is "Mismatch detected"');
  assert(caseD.isLiveSynced === false, 'Case D: isLiveSynced is false');

  // ----------------------------------------------------
  // CASE E: Public robots.txt returns 404/500 -> Public verification failed
  // ----------------------------------------------------
  const caseE = verifyRobotsSemantic({
    cmsContent: baseCmsContent,
    publicContent: '404 Not Found',
    publicRobotsHttpStatus: 404,
    publicSitemapHttpStatus: 200,
    expectedSitemapUrl,
    connectedDomain,
  });
  assert(caseE.status === 'VERIFICATION_FAILED', 'Case E: HTTP 404 causes VERIFICATION_FAILED');
  assert(caseE.statusLabel === 'Public verification failed', 'Case E: Status label is "Public verification failed"');
  assert(caseE.isLiveSynced === false, 'Case E: isLiveSynced is false');

  // ----------------------------------------------------
  // CASE F: CMS database contains configuration but public robots.txt is outdated -> Saved in CMS — not published
  // ----------------------------------------------------
  const caseF = verifyRobotsSemantic({
    cmsContent: `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /checkout/\n\nSitemap: https://verdantt.vercel.app/sitemap.xml`,
    publicContent: `User-Agent: *\nAllow: /\n\nSitemap: https://verdantt.vercel.app/sitemap.xml`,
    publicRobotsHttpStatus: 200,
    publicSitemapHttpStatus: 200,
    expectedSitemapUrl,
    connectedDomain,
  });
  assert(caseF.status === 'SAVED_NOT_PUBLISHED', 'Case F: Outdated public causes SAVED_NOT_PUBLISHED');
  assert(caseF.statusLabel === 'Saved in CMS — not published', 'Case F: Status label is "Saved in CMS — not published"');
  assert(caseF.isLiveSynced === false, 'Case F: isLiveSynced is false');

  // ----------------------------------------------------
  // Live API Endpoints Verification
  // ----------------------------------------------------
  console.log('\n--- Checking Live API Endpoints ---');

  // 1. GET /api/seo/robots
  const robotsRes = await fetch('http://localhost:3000/api/seo/robots');
  assert(robotsRes.status === 200, 'Live API: GET /api/seo/robots returns 200 OK');
  const robotsJson = await robotsRes.json();
  const robotsData = robotsJson.data;

  assert(robotsData.publicUrl === 'https://verdantt.vercel.app/robots.txt', 'Live API: robots.txt publicUrl is https://verdantt.vercel.app/robots.txt');
  assert(robotsData.sitemapUrl === 'https://verdantt.vercel.app/sitemap.xml', 'Live API: sitemapUrl is https://verdantt.vercel.app/sitemap.xml');
  assert(robotsData.isLiveSynced === true, 'Live API: Verdant public robots.txt is verified LiveSynced');
  assert(robotsData.status === 'PUBLISHED', 'Live API: status is PUBLISHED');
  assert(robotsData.statusLabel === 'Published & Live', 'Live API: statusLabel is "Published & Live"');

  // 2. POST /api/seo/robots?action=verify (Verify Public Robots.txt action)
  const verifyRes = await fetch('http://localhost:3000/api/seo/robots?action=verify', { method: 'POST' });
  assert(verifyRes.status === 200, 'Live API: POST /api/seo/robots?action=verify returns 200 OK');
  const verifyJson = await verifyRes.json();
  const verifyData = verifyJson.data;

  assert(verifyData.isLiveSynced === true, 'Verify Action: LiveSynced confirmed');
  assert(verifyData.status === 'PUBLISHED', 'Verify Action: Status is PUBLISHED');
  assert(verifyData.publicHttpStatus === 200, 'Verify Action: Public robots HTTP 200');
  assert(verifyData.publicSitemapHttpStatus === 200, 'Verify Action: Public sitemap HTTP 200');

  // 3. GET /api/seo/sitemap
  const sitemapRes = await fetch('http://localhost:3000/api/seo/sitemap');
  assert(sitemapRes.status === 200, 'Live API: GET /api/seo/sitemap returns 200 OK');
  const sitemapJson = await sitemapRes.json();
  const sitemapData = sitemapJson.data;

  assert(sitemapData.isPubliclyAccessible === true, 'Live API: Public sitemap is accessible');
  assert(sitemapData.publishingStatus === 'PUBLISHED', 'Live API: Sitemap status is PUBLISHED');
  assert(sitemapData.sitemapUrl === 'https://verdantt.vercel.app/sitemap.xml', 'Live API: Sitemap URL is real Verdant URL');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
