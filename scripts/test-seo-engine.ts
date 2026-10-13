/**
 * Verification test script for the CMS-native SEO engine
 * Validates:
 * 1. calculateCategoryScores: priority deductions, category scores, health grades
 * 2. generateSchemaJsonLd & validateSchemaJsonLd: schema generation & 2024-2026 deprecation warnings
 * 3. analyzeEeat: experience, expertise, authoritativeness, trustworthiness checks
 * 4. analyzeGeoCitability: AI search answerability, heading question ratios, entity definitions
 * 5. auditSinglePage: combined on-page + technical + schema + eeat + geo audit
 */

import { calculateCategoryScores } from '../src/lib/seo/scoring';
import { generateSchemaJsonLd, validateSchemaJsonLd } from '../src/lib/seo/schema-engine';
import { analyzeEeat } from '../src/lib/seo/eeat-engine';
import { analyzeGeoCitability } from '../src/lib/seo/geo-engine';
import { auditSinglePage } from '../src/lib/seo/audit-engine';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function runTests() {
  console.log('--- TEST 1: Scoring Engine ---');
  const emptyIssues = calculateCategoryScores([]);
  assert(emptyIssues.overallScore === 100, 'Empty findings produce 100 score');
  assert(emptyIssues.grade === 'EXCELLENT', 'Grade is EXCELLENT for 100');

  const criticalIssues = calculateCategoryScores([
    {
      category: 'TECHNICAL',
      severity: 'CRITICAL',
      issue: 'Page is blocked by noindex',
      explanation: 'Search engines will not index this page',
      recommendation: 'Remove noindex directive',
    },
  ]);
  assert(criticalIssues.overallScore < 100, 'Critical issue reduces overall score');
  assert(criticalIssues.severitySummary.critical === 1, 'Critical count tracked accurately');
  const techCat = criticalIssues.categories.find((c) => c.category === 'TECHNICAL');
  assert(techCat !== undefined && techCat.score < 100, 'Technical category score penalized');

  console.log('\n--- TEST 2: Schema Engine & Deprecations ---');
  const articleSchema = generateSchemaJsonLd({
    type: 'Article',
    title: 'How to Build Real-Time Apps',
    description: 'A comprehensive guide to real-time architecture.',
    url: 'https://example.com/real-time-apps',
    authorName: 'Alex Smith',
    publishedAt: '2026-01-01T00:00:00Z',
  });
  assert(articleSchema['@type'] === 'Article', 'Generated Article schema type matches');
  assert(articleSchema.headline === 'How to Build Real-Time Apps', 'Headline matches');

  const schemaValidation = validateSchemaJsonLd({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Obsolete HowTo schema',
  });
  assert(schemaValidation.isDeprecated === true, 'Google 2024-2026 HowTo deprecation correctly flagged');
  assert(schemaValidation.warnings.length > 0, 'Deprecation warning present in validation result');

  console.log('\n--- TEST 3: E-E-A-T Signals Engine ---');
  const goodEeatContent = `
    In our testing over the last 3 weeks, we measured query response times across 500,000 requests.
    Our hands-on analysis revealed that caching cut latency by 60%.
    According to official specifications, indexes must be carefully maintained.
    <img src="/chart.png" alt="Benchmark results" />
  `;
  const { eeat } = analyzeEeat({
    url: '/test-post',
    title: 'Benchmarking Query Performance',
    content: goodEeatContent,
    authorName: 'Dr. Jane Doe',
    authorBio: 'Senior Database Architect with 15 years experience in distributed storage systems.',
    publishedAt: '2026-02-01',
  });
  assert(eeat.experience.score > 30, 'First-hand testing cues recognized for Experience');
  assert(eeat.expertise.score > 50, 'Author bio and credentials recognized for Expertise');
  assert(eeat.trustworthiness.score > 40, 'Published date and citations recognized for Trust');

  console.log('\n--- TEST 4: GEO / AI Search Citability Engine ---');
  const geoContent = `
    <h2>What is Headless CMS?</h2>
    <p>A headless CMS is a back-end only content management system that acts primarily as a content repository. It makes content accessible via an API for display on any device, separating the content repository from the presentation layer. Organizations using headless systems achieve higher omnichannel flexibility and faster content delivery across web and mobile surfaces.</p>
    <ul>
      <li>API-first architecture</li>
      <li>Omnichannel publishing</li>
      <li>Framework flexibility</li>
    </ul>
  `;
  const { geo } = analyzeGeoCitability({
    url: '/headless-cms',
    title: 'What is Headless CMS',
    content: geoContent,
  });
  assert(geo.questionHeadingsRatio > 0, 'Question headings recognized');
  assert(geo.structuralReadability.hasDefinitions === true, 'Self-contained direct definition recognized as citable');
  assert(geo.structuralReadability.hasBulletPoints === true, 'Bullet points recognized for structural readability');

  console.log('\n--- TEST 5: Single Page Combined Audit ---');
  const fullAudit = auditSinglePage({
    url: 'https://example.com/seo-2026',
    title: 'Search Engine Optimization Strategies for 2026 | Ultimate Playbook',
    content: `
      <h1>Search Engine Optimization Strategies for 2026</h1>
      <p>In this comprehensive guide, we review modern search engine optimization and Generative Engine Optimization.</p>
      <h2>What is Search Engine Optimization?</h2>
      <p>Search engine optimization is the practice of orienting your website to rank higher on search engines and AI answer engines like Claude, ChatGPT, and Perplexity. In our testing over several months, content structured around direct answer passages improved search impressions by 35%.</p>
      <img src="/sample.png" alt="SEO Dashboard overview" />
      <ul>
        <li>Focus on direct answers</li>
        <li>Implement structured data</li>
        <li>Build strong E-E-A-T signals</li>
      </ul>
    `,
    seoTitle: 'Search Engine Optimization Strategies for 2026 | Ultimate Playbook',
    seoDescription: 'Discover the top search engine optimization strategies for 2026 including technical SEO, E-E-A-T signals, and AI search readiness.',
    focusKeyword: 'Search Engine Optimization',
    canonicalUrl: 'https://example.com/seo-2026',
    authorName: 'Sarah Connor',
    authorBio: 'SEO strategist with 10 years of experience.',
    publishedAt: '2026-03-01',
  });

  assert(fullAudit.overallScore > 70, 'Comprehensive audit scores well for well-structured content');
  assert(fullAudit.categories.find((c) => c.category === 'ON_PAGE')?.score! > 60, 'On-page category scored');
  assert(fullAudit.keywordAnalysis?.inTitle === true, 'Focus keyword recognized in title');
  assert(fullAudit.headingStructure.h1Count === 1, 'Single H1 verified');
  assert(fullAudit.headingStructure.isValid === true, 'Heading hierarchy is valid');

  console.log('\n🎉 ALL SEO ENGINE TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
