// ============================================================
// Semantic Robots.txt Verification Engine
// Compares public robots.txt against CMS configuration semantically.
// ============================================================

export interface ParsedRobotsDirective {
  key: string;
  value: string;
  raw: string;
}

export interface ParsedRobotsTxt {
  userAgents: Map<string, { allow: string[]; disallow: string[] }>;
  sitemaps: string[];
  allDirectives: ParsedRobotsDirective[];
}

export type RobotsSyncStatus =
  | 'PUBLISHED'           // Published & Live
  | 'SAVED_NOT_PUBLISHED' // Saved in CMS — not published
  | 'VERIFICATION_FAILED' // Public verification failed (404/500/network)
  | 'MISMATCH_DETECTED';  // Mismatch detected (missing sitemap, wrong domain, etc.)

export interface RobotsVerificationResult {
  status: RobotsSyncStatus;
  statusLabel: string;
  isLiveSynced: boolean;
  publicRobotsHttpStatus: number;
  publicSitemapHttpStatus: number;
  publicRobotsContent: string;
  sitemapFoundInRobots: string | null;
  expectedSitemapUrl: string;
  details: string[];
  message: string;
}

/**
 * Parses a robots.txt string into normalized directives.
 */
export function parseRobotsTxt(content: string): ParsedRobotsTxt {
  const lines = (content || '').split(/\r?\n/);
  const userAgents = new Map<string, { allow: string[]; disallow: string[] }>();
  const sitemaps: string[] = [];
  const allDirectives: ParsedRobotsDirective[] = [];

  let currentAgents: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    allDirectives.push({ key, value, raw: trimmed });

    if (key === 'user-agent') {
      const agent = value.toLowerCase();
      currentAgents = [agent];
      if (!userAgents.has(agent)) {
        userAgents.set(agent, { allow: [], disallow: [] });
      }
    } else if (key === 'allow') {
      if (currentAgents.length === 0) {
        currentAgents = ['*'];
        if (!userAgents.has('*')) userAgents.set('*', { allow: [], disallow: [] });
      }
      for (const agent of currentAgents) {
        userAgents.get(agent)?.allow.push(value);
      }
    } else if (key === 'disallow') {
      if (currentAgents.length === 0) {
        currentAgents = ['*'];
        if (!userAgents.has('*')) userAgents.set('*', { allow: [], disallow: [] });
      }
      for (const agent of currentAgents) {
        userAgents.get(agent)?.disallow.push(value);
      }
    } else if (key === 'sitemap') {
      if (value) {
        sitemaps.push(value);
      }
    }
  }

  return { userAgents, sitemaps, allDirectives };
}

/**
 * Performs semantic verification between CMS robots configuration and public robots.txt.
 *
 * Rules:
 * 1. Public robots.txt must return HTTP 200.
 * 2. Public robots.txt must contain a Sitemap directive.
 * 3. Sitemap URL must match expected URL and domain (no example.com, no fake domains).
 * 4. Public sitemap URL must return HTTP 200.
 * 5. Extra valid directives in public robots (e.g. Disallow: /api/) are ALLOWED and must NOT fail sync.
 * 6. Wildcard blockall (Disallow: / without Allow) causes mismatch.
 */
export function verifyRobotsSemantic(params: {
  cmsContent: string;
  publicContent: string;
  publicRobotsHttpStatus: number;
  publicSitemapHttpStatus: number;
  expectedSitemapUrl: string;
  connectedDomain: string;
}): RobotsVerificationResult {
  const {
    cmsContent,
    publicContent,
    publicRobotsHttpStatus,
    publicSitemapHttpStatus,
    expectedSitemapUrl,
    connectedDomain,
  } = params;

  const details: string[] = [];
  const cleanExpectedSitemap = expectedSitemapUrl.replace(/\/+$/, '').toLowerCase();
  const cleanConnectedDomain = connectedDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // 1. Check HTTP status of public robots.txt
  if (publicRobotsHttpStatus !== 200) {
    return {
      status: 'VERIFICATION_FAILED',
      statusLabel: 'Public verification failed',
      isLiveSynced: false,
      publicRobotsHttpStatus,
      publicSitemapHttpStatus,
      publicRobotsContent: publicContent,
      sitemapFoundInRobots: null,
      expectedSitemapUrl,
      details: [`Public endpoint returned HTTP ${publicRobotsHttpStatus || 0}`],
      message: `Public verification failed: https://${cleanConnectedDomain}/robots.txt returned HTTP ${publicRobotsHttpStatus || 0}`,
    };
  }

  // 2. Parse both contents
  const publicParsed = parseRobotsTxt(publicContent);
  const cmsParsed = parseRobotsTxt(cmsContent);

  // 3. Verify Sitemap directive existence in public robots.txt
  if (publicParsed.sitemaps.length === 0) {
    return {
      status: 'MISMATCH_DETECTED',
      statusLabel: 'Mismatch detected',
      isLiveSynced: false,
      publicRobotsHttpStatus,
      publicSitemapHttpStatus,
      publicRobotsContent: publicContent,
      sitemapFoundInRobots: null,
      expectedSitemapUrl,
      details: ['Missing Sitemap directive in public robots.txt'],
      message: 'Mismatch detected: Public robots.txt is missing the Sitemap directive.',
    };
  }

  // 4. Verify Sitemap URL matches connected domain and expected URL
  const matchingSitemap = publicParsed.sitemaps.find((u) => {
    const cleanU = u.replace(/\/+$/, '').toLowerCase();
    return cleanU === cleanExpectedSitemap;
  });

  const firstPublicSitemap = publicParsed.sitemaps[0];

  // Check if sitemap domain matches connected domain
  let hasValidDomain = false;
  try {
    const parsedUrl = new URL(firstPublicSitemap);
    hasValidDomain = parsedUrl.hostname.toLowerCase() === cleanConnectedDomain &&
      !firstPublicSitemap.includes('example.com') &&
      !firstPublicSitemap.includes('cms.example.com');
  } catch {
    hasValidDomain = false;
  }

  if (!hasValidDomain) {
    return {
      status: 'MISMATCH_DETECTED',
      statusLabel: 'Mismatch detected',
      isLiveSynced: false,
      publicRobotsHttpStatus,
      publicSitemapHttpStatus,
      publicRobotsContent: publicContent,
      sitemapFoundInRobots: firstPublicSitemap,
      expectedSitemapUrl,
      details: [
        `Public robots.txt points to invalid sitemap domain: "${firstPublicSitemap}"`,
        `Expected domain: "${cleanConnectedDomain}"`,
      ],
      message: `Mismatch detected: Public robots.txt contains wrong sitemap domain (${firstPublicSitemap}).`,
    };
  }

  if (!matchingSitemap) {
    return {
      status: 'MISMATCH_DETECTED',
      statusLabel: 'Mismatch detected',
      isLiveSynced: false,
      publicRobotsHttpStatus,
      publicSitemapHttpStatus,
      publicRobotsContent: publicContent,
      sitemapFoundInRobots: firstPublicSitemap,
      expectedSitemapUrl,
      details: [
        `Public sitemap directive is "${firstPublicSitemap}"`,
        `Expected "${expectedSitemapUrl}"`,
      ],
      message: `Mismatch detected: Public robots.txt sitemap URL does not match configured URL (${expectedSitemapUrl}).`,
    };
  }

  // 5. Verify Public Sitemap endpoint accessibility
  if (publicSitemapHttpStatus !== 200) {
    return {
      status: 'VERIFICATION_FAILED',
      statusLabel: 'Public verification failed',
      isLiveSynced: false,
      publicRobotsHttpStatus,
      publicSitemapHttpStatus,
      publicRobotsContent: publicContent,
      sitemapFoundInRobots: matchingSitemap,
      expectedSitemapUrl,
      details: [
        `Public sitemap at ${expectedSitemapUrl} returned HTTP ${publicSitemapHttpStatus}`,
      ],
      message: `Public verification failed: Sitemap URL at ${expectedSitemapUrl} returned HTTP ${publicSitemapHttpStatus}.`,
    };
  }

  // 6. Verify User-agent: * directives
  const publicWildcard = publicParsed.userAgents.get('*');
  const cmsWildcard = cmsParsed.userAgents.get('*');

  // Check for dangerous Disallow: / in public wildcard without any Allow
  if (publicWildcard) {
    const hasDisallowAll = publicWildcard.disallow.some((d) => d === '/' || d === '/*');
    const hasAllowAll = publicWildcard.allow.some((a) => a === '/' || a === '/*');
    if (hasDisallowAll && !hasAllowAll) {
      return {
        status: 'MISMATCH_DETECTED',
        statusLabel: 'Mismatch detected',
        isLiveSynced: false,
        publicRobotsHttpStatus,
        publicSitemapHttpStatus,
        publicRobotsContent: publicContent,
        sitemapFoundInRobots: matchingSitemap,
        expectedSitemapUrl,
        details: ['Public robots.txt is blocking all crawlers (Disallow: /)'],
        message: 'Mismatch detected: Public robots.txt completely blocks all search crawlers.',
      };
    }
  }

  // 7. Check if CMS has specific directives that public is completely missing
  if (cmsWildcard && cmsWildcard.disallow.length > 0) {
    if (!publicWildcard) {
      return {
        status: 'SAVED_NOT_PUBLISHED',
        statusLabel: 'Saved in CMS — not published',
        isLiveSynced: false,
        publicRobotsHttpStatus,
        publicSitemapHttpStatus,
        publicRobotsContent: publicContent,
        sitemapFoundInRobots: matchingSitemap,
        expectedSitemapUrl,
        details: ['CMS contains specific disallow rules not present in public robots.txt'],
        message: 'Saved in CMS — not published to the public site.',
      };
    }

    const missingDisallows = cmsWildcard.disallow.filter(
      (d) => !publicWildcard.disallow.includes(d),
    );
    if (missingDisallows.length > 0) {
      return {
        status: 'SAVED_NOT_PUBLISHED',
        statusLabel: 'Saved in CMS — not published',
        isLiveSynced: false,
        publicRobotsHttpStatus,
        publicSitemapHttpStatus,
        publicRobotsContent: publicContent,
        sitemapFoundInRobots: matchingSitemap,
        expectedSitemapUrl,
        details: [`CMS has disallow rules not in public: ${missingDisallows.join(', ')}`],
        message: 'Saved in CMS — not published to the public site.',
      };
    }
  }

  // 8. All checks passed! Extra valid directives like Disallow: /api/ are accepted
  return {
    status: 'PUBLISHED',
    statusLabel: 'Published & Live',
    isLiveSynced: true,
    publicRobotsHttpStatus,
    publicSitemapHttpStatus,
    publicRobotsContent: publicContent,
    sitemapFoundInRobots: matchingSitemap,
    expectedSitemapUrl,
    details: [
      `Public robots.txt returned HTTP ${publicRobotsHttpStatus}`,
      `Public sitemap returned HTTP ${publicSitemapHttpStatus}`,
      `Verified Sitemap directive: ${matchingSitemap}`,
      'Directives compatible with CMS configuration',
    ],
    message: 'Published and Live on Public Site: Directives and real sitemap verified.',
  };
}
