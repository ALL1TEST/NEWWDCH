import { analyzeGeoCitability } from '../src/lib/seo/geo-engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runGeoTests() {
  console.log('====================================================');
  console.log('TESTING REFINED GEO ANSWER PASSAGES RULE');
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

  // ----------------------------------------------------
  // TEST 1: Current Verdant Article (/blog/rare-houseplants-worth-investment)
  // ----------------------------------------------------
  console.log('--- TEST 1: Live Verdant Rare Plants Article ---');
  const rarePlantsArticle = await prisma.contentItem.findFirst({
    where: { slug: 'rare-houseplants-worth-investment' },
    select: { title: true, content: true },
  });

  const contentToTest = rarePlantsArticle?.content || `
<h2>The Thrill of the Hunt</h2>
<p>For many plant enthusiasts, there comes a point where pothos and snake plants no longer satisfy the craving. The rare plant market offers something different: unique genetics, stunning variegation, and the genuine excitement of growing something few other people own.</p>
<p>But rare plants come with a premium price tag. How do you decide which ones are worth the investment?</p>
<h2>What Makes a Plant "Rare"</h2>
<p>True rarity in houseplants comes from:</p>
<ul>
<li><strong>Slow propagation</strong> — Some plants can only be multiplied through division, not cuttings</li>
<li><strong>Genetic instability</strong> — Variegated forms may revert, making stable specimens scarce</li>
<li><strong>Limited commercial production</strong> — Not yet mass-produced by large nurseries</li>
<li><strong>Geographic restrictions</strong> — Native to remote regions with limited export</li>
</ul>
<h2>10 Rare Plants Worth the Investment</h2>
<h3>1. Monstera Thai Constellation</h3>
<p>A stably variegated monstera with creamy-white splashes across its leaves. Unlike the unstable 'Albo Variegata,' the Thai Constellation maintains its variegation reliably.</p>
<ul>
<li><strong>Price range:</strong> $150-$500+</li>
<li><strong>Care difficulty:</strong> Moderate</li>
<li><strong>Why it's worth it:</strong> Stable variegation, dramatic presence, reliable growth</li>
</ul>
`;

  const res1 = analyzeGeoCitability({
    url: 'https://verdantt.vercel.app/blog/rare-houseplants-worth-investment',
    title: '10 Rare Houseplants Worth the Investment for Serious Collectors',
    content: contentToTest,
    pageType: 'ARTICLE',
    intent: 'INFORMATIONAL',
  });

  console.log('res1.geo:', res1.geo);
  console.log('res1.findings:', res1.findings);

  const passageFinding1 = res1.findings.find((f) => f.ruleId === 'geo-answer-passages');
  assert(!!passageFinding1, 'TEST 1: Rule identifies genuine GEO opportunity on rare plants article');
  assert(passageFinding1?.severity === 'INFO', 'TEST 1: Finding severity is strictly INFO (opportunity, not error)');
  assert(
    passageFinding1?.problem === 'Some sections could provide clearer self-contained answers for AI search' ||
    passageFinding1?.problem === 'Content has limited self-contained answer passages for AI search',
    'TEST 1: Problem wording accurately describes AI search opportunity'
  );
  assert(
    passageFinding1?.evidence === 'Several major sections rely on short paragraphs and bullet lists rather than standalone answer passages.',
    'TEST 1: Evidence accurately explains content structure (short paragraphs and bullet lists)'
  );
  assert(
    !passageFinding1?.evidence?.includes('80-200') && !passageFinding1?.evidence?.includes('80–200'),
    'TEST 1: Evidence does NOT mention rigid 80-200 word arbitrary requirement'
  );
  assert(
    passageFinding1?.expectedValue === 'Consider adding 1–3 concise, self-contained answer passages where they naturally improve the article.',
    'TEST 1: Expected value is flexible and encourages natural improvement'
  );

  // ----------------------------------------------------
  // TEST 2: Paragraph with 50-70 words (NOT treated as bad)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Article with 50-70 word standalone answer passages ---');
  const fiftyWordParagraph = 'Monstera deliciosa thrives best in bright, indirect sunlight filtered through a sheer curtain or positioned near an east-facing window. Direct midday sun can scorch the glossy leaves, while deep shade slows down the development of iconic fenestrations. Maintain indoor temperatures between 65°F and 85°F for optimal foliage growth and vigorous aerial root development.';
  const sixtyWordParagraph = 'Water your monstera thoroughly only when the top two inches of potting soil feel completely dry to the touch. Ensure the planter contains adequate drainage holes so excess moisture escapes quickly, preventing root rot. In winter months, reduce watering frequency as plant transpiration naturally slows during cooler, lower-light periods.';

  const res2 = analyzeGeoCitability({
    url: 'https://verdantt.vercel.app/blog/monstera-care',
    title: 'Monstera Care Essentials',
    content: `
<h2>How Much Light Does a Monstera Need?</h2>
<p>${fiftyWordParagraph}</p>
<h2>How Often Should You Water Monstera Plants?</h2>
<p>${sixtyWordParagraph}</p>
`,
    pageType: 'ARTICLE',
    intent: 'INFORMATIONAL',
  });

  const passageFinding2 = res2.findings.find((f) => f.ruleId === 'geo-answer-passages');
  assert(!passageFinding2, 'TEST 2: 50-70 word self-contained passages are recognized as STRONG (NO finding triggered)');
  assert(res2.geo.selfContainedPassagesCount >= 2, 'TEST 2: Self-contained passages count correctly counts the 50-70 word answer passages');

  // ----------------------------------------------------
  // TEST 3: Article with definition and structured bullets (GOOD structure)
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Article with 1 strong answer + structured bullets ---');
  const res3 = analyzeGeoCitability({
    url: 'https://verdantt.vercel.app/blog/succulent-soil',
    title: 'Succulent Soil Guide',
    content: `
<h2>What is Succulent Soil?</h2>
<p>Succulent soil is an airy, fast-draining potting mixture formulated with porous materials such as perlite, pumice, and coarse sand. It provides rapid drainage that prevents root moisture retention, allowing desert and arid houseplants to thrive without rot risks.</p>
<h2>Best Components for Potting Mix</h2>
<p>A balanced homemade succulent mix contains:</p>
<ul>
<li>50% standard potting soil</li>
<li>30% perlite or pumice</li>
<li>20% coarse horticultural sand</li>
</ul>
<h2>Signs of Poor Soil Drainage</h2>
<p>Watch out for these symptoms:</p>
<ul>
<li>Water standing on the soil surface for over 30 seconds</li>
<li>Mushy lower foliage and dark stem bases</li>
</ul>
`,
    pageType: 'ARTICLE',
    intent: 'INFORMATIONAL',
  });

  const passageFinding3 = res3.findings.find((f) => f.ruleId === 'geo-answer-passages');
  assert(!passageFinding3, 'TEST 3: 1 strong passage + structured sections is recognized as GOOD (NO finding triggered)');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runGeoTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
