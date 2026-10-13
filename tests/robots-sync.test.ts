// ============================================================
// Unit & Integration Tests: Semantic Robots.txt Synchronization
// Covers Cases A through F as specified in requirements.
// ============================================================

import { describe, it, test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRobotsSemantic } from '../src/lib/seo/robots-verifier';

const test = nodeTest || it;

function expect(actual: any) {
  return {
    toBe(expected: any) {
      assert.strictEqual(actual, expected);
    },
    toContain(expected: string) {
      assert.ok(
        typeof actual === 'string' && actual.includes(expected),
        `Expected "${actual}" to contain "${expected}"`
      );
    },
  };
}

describe('Robots.txt Semantic Synchronization Engine', () => {
  const connectedDomain = 'verdantt.vercel.app';
  const expectedSitemapUrl = 'https://verdantt.vercel.app/sitemap.xml';

  const baseCmsContent = `User-agent: *
Allow: /

Sitemap: https://verdantt.vercel.app/sitemap.xml`;

  // -------------------------------------------------------------------------
  // Case A: CMS and public robots.txt contain required directives -> Published & Live
  // -------------------------------------------------------------------------
  test('Case A: CMS and public robots.txt contain required directives -> Published & Live', () => {
    const publicContent = `User-agent: *
Allow: /

Sitemap: https://verdantt.vercel.app/sitemap.xml`;

    const res = verifyRobotsSemantic({
      cmsContent: baseCmsContent,
      publicContent,
      publicRobotsHttpStatus: 200,
      publicSitemapHttpStatus: 200,
      expectedSitemapUrl,
      connectedDomain,
    });

    expect(res.status).toBe('PUBLISHED');
    expect(res.statusLabel).toBe('Published & Live');
    expect(res.isLiveSynced).toBe(true);
    expect(res.message).toContain('Published and Live');
  });

  // -------------------------------------------------------------------------
  // Case B: Public robots.txt has extra valid directives such as Disallow: /api/ -> Published & Live
  // -------------------------------------------------------------------------
  test('Case B: Public robots.txt has extra valid directives (e.g. Disallow: /api/) -> Published & Live', () => {
    const publicContent = `User-Agent: *
Allow: /
Disallow: /api/

Sitemap: https://verdantt.vercel.app/sitemap.xml`;

    const res = verifyRobotsSemantic({
      cmsContent: baseCmsContent,
      publicContent,
      publicRobotsHttpStatus: 200,
      publicSitemapHttpStatus: 200,
      expectedSitemapUrl,
      connectedDomain,
    });

    expect(res.status).toBe('PUBLISHED');
    expect(res.statusLabel).toBe('Published & Live');
    expect(res.isLiveSynced).toBe(true);
    expect(res.sitemapFoundInRobots).toBe('https://verdantt.vercel.app/sitemap.xml');
  });

  // -------------------------------------------------------------------------
  // Case C: Public robots.txt is missing the Sitemap directive -> Mismatch detected
  // -------------------------------------------------------------------------
  test('Case C: Public robots.txt is missing the Sitemap directive -> Mismatch detected', () => {
    const publicContent = `User-agent: *
Allow: /
Disallow: /api/`;

    const res = verifyRobotsSemantic({
      cmsContent: baseCmsContent,
      publicContent,
      publicRobotsHttpStatus: 200,
      publicSitemapHttpStatus: 200,
      expectedSitemapUrl,
      connectedDomain,
    });

    expect(res.status).toBe('MISMATCH_DETECTED');
    expect(res.statusLabel).toBe('Mismatch detected');
    expect(res.isLiveSynced).toBe(false);
    expect(res.message).toContain('missing the Sitemap directive');
  });

  // -------------------------------------------------------------------------
  // Case D: Public robots.txt contains wrong sitemap domain -> Mismatch detected
  // -------------------------------------------------------------------------
  test('Case D: Public robots.txt contains wrong sitemap domain (e.g. example.com) -> Mismatch detected', () => {
    const publicContent = `User-agent: *
Allow: /

Sitemap: https://cms.example.com/sitemap.xml`;

    const res = verifyRobotsSemantic({
      cmsContent: baseCmsContent,
      publicContent,
      publicRobotsHttpStatus: 200,
      publicSitemapHttpStatus: 200,
      expectedSitemapUrl,
      connectedDomain,
    });

    expect(res.status).toBe('MISMATCH_DETECTED');
    expect(res.statusLabel).toBe('Mismatch detected');
    expect(res.isLiveSynced).toBe(false);
    expect(res.message).toContain('wrong sitemap domain');
  });

  // -------------------------------------------------------------------------
  // Case E: Public robots.txt returns 404/500 -> Public verification failed
  // -------------------------------------------------------------------------
  test('Case E: Public robots.txt returns 404/500 -> Public verification failed', () => {
    const res = verifyRobotsSemantic({
      cmsContent: baseCmsContent,
      publicContent: '404 Not Found',
      publicRobotsHttpStatus: 404,
      publicSitemapHttpStatus: 200,
      expectedSitemapUrl,
      connectedDomain,
    });

    expect(res.status).toBe('VERIFICATION_FAILED');
    expect(res.statusLabel).toBe('Public verification failed');
    expect(res.isLiveSynced).toBe(false);
    expect(res.message).toContain('Public verification failed');
  });

  test('Case E-2: Public sitemap returns 404 -> Public verification failed', () => {
    const publicContent = `User-agent: *
Allow: /

Sitemap: https://verdantt.vercel.app/sitemap.xml`;

    const res = verifyRobotsSemantic({
      cmsContent: baseCmsContent,
      publicContent,
      publicRobotsHttpStatus: 200,
      publicSitemapHttpStatus: 404,
      expectedSitemapUrl,
      connectedDomain,
    });

    expect(res.status).toBe('VERIFICATION_FAILED');
    expect(res.statusLabel).toBe('Public verification failed');
    expect(res.isLiveSynced).toBe(false);
    expect(res.message).toContain('Public verification failed: Sitemap URL');
  });

  // -------------------------------------------------------------------------
  // Case F: CMS database contains configuration but public robots.txt is outdated -> Saved in CMS — not published
  // -------------------------------------------------------------------------
  test('Case F: CMS database contains new disallow rules but public robots.txt is outdated -> Saved in CMS — not published', () => {
    const advancedCmsContent = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /checkout/

Sitemap: https://verdantt.vercel.app/sitemap.xml`;

    const outdatedPublicContent = `User-Agent: *
Allow: /

Sitemap: https://verdantt.vercel.app/sitemap.xml`;

    const res = verifyRobotsSemantic({
      cmsContent: advancedCmsContent,
      publicContent: outdatedPublicContent,
      publicRobotsHttpStatus: 200,
      publicSitemapHttpStatus: 200,
      expectedSitemapUrl,
      connectedDomain,
    });

    expect(res.status).toBe('SAVED_NOT_PUBLISHED');
    expect(res.statusLabel).toBe('Saved in CMS — not published');
    expect(res.isLiveSynced).toBe(false);
    expect(res.message).toBe('Saved in CMS — not published to the public site.');
  });
});
