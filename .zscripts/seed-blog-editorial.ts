// ============================================================
// BLOG EDITORIAL SEED — Karmax publication content
// ============================================================
// Seeds the PUBLIC marketing blog (#/blog) with the platform's
// own editorial content, read through /api/public/blog:
//
//   1. Three editorial authors (users + AuthorProfiles with bio
//      and social links — the CMS demo users stay untouched)
//   2. Eight editorial categories with descriptions (AI, SEO,
//      Content Marketing, Automation, SaaS, Product, Tutorials,
//      Growth — reusing the base seed's technology/design/business)
//   3. Editorial tags (incl. "Editor's Choice" used by the blog's
//      Editor's picks section — admins control it from the CMS)
//   4. Media rows for the generated covers in public/uploads/blog
//   5. Eight new Karmax-craft articles (rich HTML: h2/h3, lists,
//      blockquotes, callouts, tables, figures, internal links)
//   6. The four published base-seed tech articles get covers,
//      excerpts, SEO fields, tags and editorial categories
//
// Idempotent: every step upserts/skips by a stable natural key.
// Run AFTER the base seed:  bun run .zscripts/seed-blog-editorial.ts
// ============================================================

import { db } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

const BLOG_DIR = path.join(process.cwd(), 'public', 'uploads', 'blog');

// ---------- helpers ----------
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

interface CoverSpec {
  filename: string;
  alt: string;
  seoTitle: string;
}

const COVERS: CoverSpec[] = [
  { filename: 'ai-content-cover.png', alt: 'Abstract illustration of a neural network merging with document pages', seoTitle: 'AI and the modern content workflow' },
  { filename: 'seo-audit-cover.png', alt: 'Abstract illustration of a magnifying glass over a checklist', seoTitle: 'A practical SEO audit' },
  { filename: 'content-calendar-cover.png', alt: 'Abstract illustration of a calendar with pinned cards', seoTitle: 'The content calendar issue' },
  { filename: 'automation-first-cover.png', alt: 'Abstract illustration of interconnected gears forming a path', seoTitle: 'What to automate first' },
  { filename: 'multi-site-cover.png', alt: 'Abstract illustration of one hub connected to several browser windows', seoTitle: 'Multi-site content operations' },
  { filename: 'repurposing-cover.png', alt: 'Abstract illustration of one document splitting into many small cards', seoTitle: 'Content repurposing' },
  { filename: 'growth-metrics-cover.png', alt: 'Abstract illustration of an ascending bar chart with milestone flags', seoTitle: 'Content metrics that matter' },
  { filename: 'product-led-cover.png', alt: 'Abstract illustration of dashboard blocks connected by flowing arrows', seoTitle: 'Product-led content platform' },
  { filename: 'typescript-cover.png', alt: 'Abstract illustration of geometric building blocks in a tower', seoTitle: 'Getting started with TypeScript' },
  { filename: 'performance-cover.png', alt: 'Abstract illustration of speed lines and an ascending chart', seoTitle: 'Next.js performance optimization' },
  { filename: 'design-system-cover.png', alt: 'Abstract illustration of design components on a dot grid', seoTitle: 'Building a design system' },
  { filename: 'scaling-cover.png', alt: 'Abstract illustration of figures ascending a staircase', seoTitle: 'Startup scaling strategies' },
];

// ---------- article bodies (editorial, product-honest, Karmax-branded) ----------

const bodyAiContent = `
<p>Two years ago, "AI content" meant a text box that spat out five hundred words of beige. Today, teams run research, outlines, drafts, optimization and publishing through AI-assisted workflows — and the results are good enough that readers can't tell, and don't care. What changed wasn't the models. It was the workflow around them.</p>
<h2>From tool to teammate</h2>
<p>The first wave of writing tools asked you to trust a black box: type a prompt, receive an article, publish at your own risk. The teams getting real value today treat AI more like a junior collaborator — fast, tireless, occasionally wrong, always supervised. The model drafts; the editor decides.</p>
<p>That shift changes what the software needs to be. A prompt box is not a workflow. You need your research attached to your draft, your SEO check next to your outline, and your brand voice enforced before the text ever reaches a human.</p>
<figure><img src="/uploads/blog/ai-content-cover.png" alt="Abstract illustration of a neural network merging with document pages" /><figcaption>Research, drafting and optimization are converging into one workspace — the story of this whole article.</figcaption></figure>
<h2>Where AI actually helps</h2>
<ul>
<li><strong>Research and clustering.</strong> Turning a mess of source material and search queries into a structured outline is slow, mechanical work — exactly what models are good at.</li>
<li><strong>First drafts of sections.</strong> Not the whole piece: the boring middle of a how-to, the summary of a long report, the alternative phrasings of a paragraph that fights you.</li>
<li><strong>SEO passes.</strong> Suggesting internal links, checking heading hierarchy, rewriting a meta description five ways — high-frequency, low-judgment tasks.</li>
<li><strong>Repurposing.</strong> An article into a newsletter section, a thread, a summary card. The first version is 80% right; a human spends ten minutes instead of an hour.</li>
</ul>
<div class="callout"><p><strong>Rule of thumb:</strong> if a task has a right answer you can verify in seconds, delegate it. If it requires taste, context or accountability for a claim — a person signs it.</p></div>
<h2>What still needs a human</h2>
<p>The failure mode of AI content is not bad grammar — it's confident sameness. The smooth, hedge-free, flavorless voice of a million optimized posts. Readers don't bounce because the sentence structure is off; they bounce because nothing in the piece could only have been written by you.</p>
<blockquote><p>If a piece could have been written by anyone, it will be read by no one.</p></blockquote>
<p>Keep the judgment calls — the thesis, the examples from your own experience, the opinions that cost you something to state — and delegate the scaffolding.</p>
<h2>The toolchain is consolidating</h2>
<p>The 2023 stack was five subscriptions: a chat window for research, a writing tool, an SEO checker, a grammar fixer and a CMS. Every hand-off between them lost context — the outline lived in one place, the keyword research in another, and nobody could tell you why paragraph three changed.</p>
<p>The 2026 stack is one workspace. Research arrives as attachments to the draft, not browser tabs. The SEO panel reads the document in place instead of a pasted copy. Brand voice is a setting, not a hope. When the toolchain consolidates, the audit trail comes for free: every AI suggestion is a suggestion, visible and reversible, next to the human edit that accepted or rejected it.</p>
<p>This matters most for teams with something to lose. If content is your product — or the front door of it — you need to answer "which parts of this did a machine write, and who approved them?" A consolidated workspace answers that from memory. A five-tool stack answers it with a shrug.</p>
<h2>A practical workflow</h2>
<ol>
<li>Start from your own notes, however messy. Ten bullet points of what you actually think beat a perfect prompt.</li>
<li>Generate the outline, then edit it hard before any prose exists.</li>
<li>Draft section by section, rewriting as you go. Never generate the whole piece in one shot.</li>
<li>Run the SEO pass while the structure is still fresh — keywords in headings, internal links, meta fields.</li>
<li>Read the final draft aloud. Any sentence you wouldn't say is a sentence to rewrite.</li>
</ol>
<h3>Measure what matters</h3>
<p>Track the same metrics you'd track for human-written content — engaged time, scroll depth, conversions — and compare honestly. In our own publishing, AI-assisted drafts ship roughly twice as fast with no measurable drop in engagement. Speed is the win; quality is the constraint you enforce.</p>
<table>
<thead><tr><th>Task</th><th>Before</th><th>With an AI-assisted workflow</th></tr></thead>
<tbody>
<tr><td>Research + outline</td><td>90 min</td><td>25 min</td></tr>
<tr><td>First draft (1,200 words)</td><td>3 hrs</td><td>75 min</td></tr>
<tr><td>SEO optimization pass</td><td>40 min</td><td>12 min</td></tr>
<tr><td>Repurposing (newsletter + social)</td><td>60 min</td><td>18 min</td></tr>
</tbody>
</table>
<h2>What this means for small teams</h2>
<p>The interesting story isn't the enterprise content factory — it's the two-person team that now ships like six. One founder with a clear thesis and a disciplined workflow can hold a topic the way a staff writer used to, without hiring a research assistant. The constraint moved from capacity to judgment: the teams with opinions win, because opinions are the one input the model can't manufacture.</p>
<p>That's also the honest caveat. A workflow multiplies whatever you feed it. Feed it genuine expertise and curiosity, and it compounds. Feed it thin content-mill thinking, and it produces thin content at an impressive rate — the volume goes up, the ceiling stays exactly where it was.</p>
<h2>The editing pass that matters</h2>
<p>Every AI-assisted piece earns its quality in the edit, and most of that edit is deletion. The patterns worth pruning are consistent enough to list:</p>
<ul>
<li><strong>The hedge paragraph.</strong> "It's important to note that…" is a sign the machine wasn't sure, and the reader won't be either. Cut it or commit to a claim.</li>
<li><strong>The symmetric three.</strong> Models love listing exactly three parallel points with identical grammar. Real expertise is lopsided — one strong example beats three balanced ones.</li>
<li><strong>The summary that repeats.</strong> If the conclusion restates the intro with the same words, the piece never actually went anywhere. End on the implication, not the recap.</li>
<li><strong>The borrowed statistic.</strong> Any number the draft cites needs a source you actually checked. Confident wrong numbers are worse than no numbers.</li>
</ul>
<p>A useful discipline: open the draft side by side with your original notes. Every idea that appears in the final piece but not in your notes is a candidate for deletion — either it's generic filler, or it's a claim you now have to own. Both deserve a conscious decision, not a shrug.</p>
<p>And keep the receipts. When the workflow records which sections were AI-drafted and which were human-written, the editing conversation changes: you stop asking "is this good?" in the abstract and start asking "does the machine-assisted half clear the same bar as mine?" That's a question you can actually answer, and the gap between the two answers is the whole skill.</p>
<h3>Four questions before you adopt</h3>
<p>Before a team rebuilds its process around AI, four questions are worth answering in writing — they're the difference between a workflow and a habit:</p>
<ol>
<li><strong>What is our voice, in three sentences?</strong> If you can't describe it, no model can preserve it. Write it down, give examples, keep it in the prompt.</li>
<li><strong>Which claims require a source?</strong> Decide as a team what counts as a factual claim and who verifies it. This is an editorial policy, not a tooling setting.</li>
<li><strong>Where does the reader benefit?</strong> If the AI pass doesn't make the piece clearer, faster or more useful to read, it's a cost, not a feature.</li>
<li><strong>What won't we automate?</strong> The list is shorter than you think, and writing it down is what protects it.</li>
</ol>
<p>Teams that answer these once, in a page, end up with AI workflows that survive their second month. Teams that skip the page end up renegotiating it in every review thread, one draft at a time — which is the slow, expensive way to write an editorial policy.</p>
<h2>The honest conclusion</h2>
<p>AI is not replacing content teams. It's exposing which parts of the work were genuinely editorial and which were clerical. The teams that win will be the ones that keep the editorial and automate the clerical — with their own models, their own prompts, and their own name on the door.</p>
<p>If you want to see how this looks in practice, the <a href="#/features#f-ai">AI writing workspace</a> in Karmax was built around exactly this workflow.</p>
`;

const bodySeoAudit = `
<p>Most SEO audits die of ambition. They start as a quick check and end as a forty-tab investigation nobody finishes. But the audit that actually gets run — weekly, before every publish — fits in twenty minutes and catches ninety percent of what matters.</p>
<h2>Set the timer</h2>
<p>This is a pre-publish and weekly-maintenance ritual, not a site migration. One page (or one week of pages), five checks, written down. If something needs deeper investigation, note it and schedule it — don't chase it mid-audit.</p>
<h2>The five checks</h2>
<ul>
<li><strong>One focus keyword per page.</strong> Is it in the title, the opening paragraph, and at least one heading? If a page targets three keywords, it targets none.</li>
<li><strong>Title and description that earn the click.</strong> Title under 60 characters, specific, written for a scanning human. Description adds information the title doesn't have.</li>
<li><strong>Heading hierarchy.</strong> Exactly one H1. H2s that a scanner could reconstruct the article from. No skipped levels.</li>
<li><strong>Internal links, both directions.</strong> The new page links to two or three relevant existing pages — and at least one existing page links back to it. Orphans rank for nothing.</li>
<li><strong>Technical hygiene.</strong> Canonical tag set, Open Graph image present, no broken links in the body, sitemap will include the URL.</li>
</ul>
<h3>Common failures we see</h3>
<p>Running this checklist across real sites, the same problems repeat: meta descriptions copy-pasted from the first paragraph, H2s used for styling instead of structure, and images with empty alt text. None of these are hard to fix — they're just invisible unless someone looks.</p>
<table>
<thead><tr><th>Check</th><th>What to look for</th></tr></thead>
<tbody>
<tr><td>Focus keyword</td><td>Present in title, intro, one heading — naturally</td></tr>
<tr><td>Title</td><td>Under 60 chars, specific, no keyword stuffing</td></tr>
<tr><td>Description</td><td>Adds info, 140–160 chars, not a copy of the intro</td></tr>
<tr><td>Headings</td><td>One H1, logical H2/H3 hierarchy, scannable</td></tr>
<tr><td>Links</td><td>2–3 internal out, 1+ internal in, zero broken</td></tr>
</tbody>
</table>
<blockquote><p>Score widgets can wait. Ship the checklist first — it's the twenty minutes that compounds.</p></blockquote>
<h2>When to go deeper</h2>
<p>Once a quarter, the twenty-minute audit earns the right to become a two-hour one: crawl the site, check Core Web Vitals, review which pages lost impressions in Search Console, prune or merge what's decayed. But the weekly ritual is what keeps the site healthy enough to benefit. <a href="#/features#f-seo">Karmax's SEO panel</a> runs these checks continuously — the audit is how you make the habit stick without the tooling.</p>
`;

const bodyCalendar = `
<p>Every content team has built a beautiful calendar that died in week three. Not because the tool was wrong — because the plan assumed a world with no sick days, no product launches that eat the sprint, and no stories that take twice as long as estimated. A calendar that survives real life is built for interruption.</p>
<h2>Why most calendars die</h2>
<ul>
<li><strong>Too granular, too early.</strong> Assigning topics to specific days three months out is fiction with extra steps.</li>
<li><strong>No slack.</strong> A plan at 100% capacity breaks the first time anything slips. Editorial needs air.</li>
<li><strong>Separated from the work.</strong> If the calendar lives in one tool and the drafts in another, the calendar rots the moment reality changes.</li>
</ul>
<h2>Plan in layers</h2>
<p>Resist the urge to schedule everything at the same resolution. Different horizons deserve different detail:</p>
<ul>
<li><strong>Quarterly — themes, not titles.</strong> Three or four themes you're committing to. Cheap to change, easy to defend.</li>
<li><strong>Monthly — titles and owners.</strong> The articles you'll actually assign, with a target week, not a target day.</li>
<li><strong>Weekly — the only real schedule.</strong> What ships this week, in review, in draft. This is the layer that's allowed to be precise.</li>
</ul>
<h3>The weekly ritual</h3>
<ol>
<li>Pull up what shipped last week — metrics, one line each, no meeting required.</li>
<li>Move what's ready, slip what isn't, and say it out loud. A slipped story that's acknowledged is planning; one that's silently ignored is rot.</li>
<li>Fill next week from the monthly pool, leaving one slot empty on purpose.</li>
</ol>
<div class="callout"><p><strong>The empty slot rule:</strong> keep one unplanned slot per week. It absorbs the urgent thing, the timely news hit, or — best case — becomes breathing room that makes the other pieces better.</p></div>
<h2>Leave room for reality</h2>
<p>A calendar is a communication device, not a contract. Its job is to make the plan visible enough that changes are decisions instead of surprises. When the plan changes — and it will, weekly — the calendar should be the easiest thing in the company to update, not a stakeholder negotiation.</p>
<blockquote><p>Plan the quarter, schedule the week, and forgive the day.</p></blockquote>
<p>In Karmax the calendar is wired straight into the pipeline: scheduled posts show their review state, and moving a card reschedules the publish. The plan and the work never drift apart, because they're the same object.</p>
`;

const bodyAutomation = `
<p>"Automation" conjures flowcharts with nineteen nodes and a consultant. In practice, the automations that stick are small, boring, and deeply specific to your routine — and you can build the first one this afternoon.</p>
<h2>Start with what you repeat</h2>
<p>For two weeks, write down every publishing-adjacent task you do more than twice. The list usually looks like this:</p>
<ul>
<li>Sharing each new article to the newsletter</li>
<li>Running the SEO check before publishing</li>
<li>Notifying the editor when a draft is ready for review</li>
<li>Re-generating the sitemap after publishing</li>
<li>Archiving expired campaigns</li>
</ul>
<p>Each of these is a candidate. None of them needs a flowchart.</p>
<h2>The trigger-action habit</h2>
<p>Every automation is just a trigger and a few steps:</p>
<pre><code>when an article is published
  → send the newsletter campaign
  → notify the #editorial channel
  → log the run</code></pre>
<p>Build one. Watch it run for a week. Then build the next. Karmax's automation builder gives you triggers on content events, publishing steps and schedules, plus a run history that shows exactly what happened and why — the difference between an automation and a prayer is the log.</p>
<h2>When not to automate</h2>
<ul>
<li><strong>Anything you haven't done manually five times.</strong> You can't automate a process you don't understand; the failure mode is silent.</li>
<li><strong>Anything with judgment in it.</strong> First drafts, replies to readers, pricing pages. Humans only.</li>
<li><strong>Anything that touches money or credentials</strong> without a human confirming the edge cases.</li>
</ul>
<div class="callout"><p><strong>Watch one week before trusting it forever.</strong> An automation that quietly does the wrong thing every Tuesday is worse than no automation — at least manual mistakes are visible.</p></div>
<blockquote><p>Automate the boring. Keep the craft.</p></blockquote>
<h2>Build one, watch one week</h2>
<p>Pick the most repetitive item from your list — probably the publish-to-newsletter share — and automate exactly that. The goal of the first automation isn't saved time; it's proof that the habit works. The compounding starts at automation number three, when the boring 20% of your week runs itself and the calendar from last week's article actually holds.</p>
`;

const bodyMultiSite = `
<p>Nobody plans to run five sites. It starts with the localized version, then the product microsite, then the agency client who "just needs the blog" — and one Monday you're context-switching between five logins, four style guides and a spreadsheet titled <code>publish-dates-FINAL-v3</code>.</p>
<h2>The multi-site tax</h2>
<ul>
<li><strong>Context switching.</strong> Every extra dashboard is a login, a layout and a set of habits to hold in your head.</li>
<li><strong>Permission sprawl.</strong> The freelancer who should see one site can, in the wrong tool, see all of them.</li>
<li><strong>Asset anarchy.</strong> Five media libraries, forty versions of the same logo, no idea which site uses which image.</li>
<li><strong>Unclear ownership.</strong> When every site is "everyone's responsibility", the expired campaign on site three is nobody's.</li>
</ul>
<h2>One workspace, many sites</h2>
<p>The fix is structural, not motivational. In Karmax, every site is a scope inside one workspace: one login, one media library with per-site collections, one calendar filtered by site, one automation engine that knows which site an event belongs to. Switching sites is a dropdown, not a logout.</p>
<h3>Roles and boundaries</h3>
<p>Multi-site is where role-based access stops being a checkbox and starts being the product. The shape that works:</p>
<table>
<thead><tr><th>Role</th><th>Sees</th><th>Can publish</th></tr></thead>
<tbody>
<tr><td>Owner / Admin</td><td>All sites</td><td>Yes</td></tr>
<tr><td>Site editor</td><td>Assigned sites only</td><td>Yes, their sites</td></tr>
<tr><td>Contributor</td><td>Assigned sites, own drafts</td><td>No — submits for review</td></tr>
<tr><td>Client (viewer)</td><td>One site, published + in-review</td><td>No</td></tr>
</tbody>
</table>
<div class="callout"><p><strong>Give clients a seat, not a login to your whole operation.</strong> A scoped viewer account ends the "can you screenshot the draft?" era of agency life.</p></div>
<h2>Publishing discipline</h2>
<p>With many sites, the calendar stops being nice-to-have. One calendar, filtered by site, is the single place a week can be sanity-checked: what ships where, who owns it, what's in review. Per-site queues without a unified view is how the same article ships twice and the important one ships never.</p>
<blockquote><p>Multi-site isn't five small blogs. It's one editorial operation with five front doors.</p></blockquote>
`;

const bodyRepurposing = `
<p>The economics of content changed. A great article costs the same to write whether fifty people or fifty thousand see it — so the highest-leverage skill in modern content isn't writing more, it's getting more from what you've already written.</p>
<h2>The core idea</h2>
<p>One well-researched article contains a week of smaller artifacts: the contrarian take for social, the step-by-step for the newsletter, the single statistic that deserves its own visual. Repurposing isn't repetition — it's translation into the formats each channel actually rewards.</p>
<h2>A 60-minute repurposing session</h2>
<ol>
<li><strong>Pick the source (5 min).</strong> A piece that performed, or one you believe deserved better. Evergreen beats news.</li>
<li><strong>Extract the atoms (10 min).</strong> List every self-contained idea: claims, frameworks, statistics, stories. An article usually hides six to ten.</li>
<li><strong>Match atoms to formats (10 min).</strong> A framework becomes a carousel. A statistic becomes a chart card. A strong opinion becomes a social post with a hook.</li>
<li><strong>Draft the derivatives (30 min).</strong> Rough is fine — these are translations, not new essays.</li>
<li><strong>Schedule the week (5 min).</strong> Spread them out. Same-day floods read as spam; a week of presence reads as momentum.</li>
</ol>
<h3>Formats that convert</h3>
<ul>
<li><strong>Newsletter section</strong> — the "worth your time" framing, one idea, link back.</li>
<li><strong>Thread or carousel</strong> — the framework, step by step, one idea per card.</li>
<li><strong>Quote card</strong> — the single sentence that would survive out of context.</li>
<li><strong>Short video script</strong> — the how-to section, spoken, 45 seconds.</li>
</ul>
<h2>Track what works</h2>
<p>Not every format earns its minute. After a month of sessions, count what each derivative actually drove:</p>
<table>
<thead><tr><th>Format</th><th>Effort</th><th>Typical lifetime</th></tr></thead>
<tbody>
<tr><td>Newsletter section</td><td>Low</td><td>Days</td></tr>
<tr><td>Social thread</td><td>Medium</td><td>Hours</td></tr>
<tr><td>Carousel</td><td>Medium</td><td>Days–weeks</td></tr>
<tr><td>Video script</td><td>High</td><td>Weeks</td></tr>
</tbody>
</table>
<div class="callout"><p><strong>Double down on one or two formats, not all of them.</strong> The teams that win at repurposing aren't the ones doing everything — they're the ones doing their best format on schedule.</p></div>
<p>When the session is a habit, the article you publish on Monday quietly powers the whole week — and the <a href="#/solutions/automation">automation recipes</a> in Karmax can schedule the derivatives for you.</p>
`;

const bodyGrowthMetrics = `
<p>Content dashboards are full of numbers that move and mean nothing. Followers. Impressions. "Engagement." The metrics that actually predict growth are fewer, less flattering, and much more useful — because they measure behavior, not applause.</p>
<h2>Lagging vs leading</h2>
<p>Traffic and revenue are lagging indicators — the scoreboard of decisions you made months ago. To run a content program, you need leading indicators: signals that today's work is compounding into tomorrow's results.</p>
<table>
<thead><tr><th>Metric</th><th>Type</th><th>Why it matters</th></tr></thead>
<tbody>
<tr><td>Published vs planned</td><td>Leading</td><td>Consistency is the #1 controllable input</td></tr>
<tr><td>Search impressions</td><td>Leading</td><td>Measures whether search engines trust you at all</td></tr>
<tr><td>Engaged time per page</td><td>Leading</td><td>The honest quality signal — outranks every vanity metric</td></tr>
<tr><td>Assisted conversions</td><td>Lagging</td><td>Content's real contribution to revenue</td></tr>
<tr><td>Follower count</td><td>Vanity</td><td>Feels good. Predicts almost nothing.</td></tr>
</tbody>
</table>
<h2>Three numbers to watch</h2>
<h3>1. Publishing consistency</h3>
<p>Published vs planned, per week, over a quarter. Not because more is always better — because erratic publishing is the most common self-inflicted wound in content. Fix consistency before you fix anything else; every other metric is noisy until this one is boring.</p>
<h3>2. Impressions on your focus keywords</h3>
<p>Rankings fluctuate; impressions don't lie as much. If impressions on your target queries climb month over month, you're accumulating topical authority. If they're flat while traffic grows, you're growing on borrowed, transient relevance.</p>
<h3>3. Engaged time on the pages you care about</h3>
<p>Average engaged time across the site is a blur. Per page — especially on your money pages and pillar content — it's a quality thermometer. When a revision raises engaged time, keep the revision. That's the whole feedback loop.</p>
<blockquote><p>A metric is only worth tracking if a specific person would change a specific decision when it moves.</p></blockquote>
<h2>Build a simple scoreboard</h2>
<p>One page, five numbers, updated weekly, reviewed in fifteen minutes. The scoreboard's job is not precision — it's noticing. Was this quarter's dip the product launch, the algorithm update, or the three weeks you didn't publish? The data knows, if you kept it simple enough to read it honestly.</p>
`;

const bodyProductLed = `
<p>Every content platform eventually faces the same choice: build for the person who publishes once a quarter, or the team that publishes every day. The first path optimizes for demos. The second builds a product. We picked the second, and it shows up in small decisions all over Karmax.</p>
<h2>The product is the process</h2>
<p>A content tool's real competition isn't another content tool — it's the spreadsheet-plus-chat-plus-chaos stack it could replace. That means the workflow <em>is</em> the product: review states that mirror how editorial teams actually approve, roles that match real org charts, and an audit log that answers "who changed what" without an archaeology dig.</p>
<ul>
<li><strong>States over tags.</strong> Draft → review → approved → scheduled → published is a pipeline, not a folder structure.</li>
<li><strong>Roles that mean something.</strong> Admin, editor, contributor — each with real boundaries, not cosmetic titles.</li>
<li><strong>History by default.</strong> Every save is a version; every action is logged. Not for compliance theater — for trust.</li>
</ul>
<h2>Principles we build by</h2>
<ul>
<li><strong>Honest data.</strong> No fake dashboards, no invented metrics. If the number isn't real, the UI doesn't show it.</li>
<li><strong>One of a thing.</strong> One editor, one calendar, one media library, one SEO panel — wired together, not assembled.</li>
<li><strong>Boring reliability.</strong> Scheduled means scheduled. A publish that silently fails is worse than no scheduler.</li>
<li><strong>Own your keys.</strong> Bring your own AI providers and SMTP. The platform routes; it doesn't hold hostage.</li>
</ul>
<div class="callout"><p><strong>What this means for you:</strong> the blog you're reading runs on Karmax itself. Every article, category and cover you see here is a content item in the same CMS our customers use — dogfooding isn't a strategy deck slide, it's Tuesday.</p></div>
<h2>What we're building toward</h2>
<p>The near future is deeper integration between the pieces: SEO findings that become automation triggers, repurposing pipelines that draft themselves, and multi-site governance that feels like one product instead of five. The long bet stays the same — the team that ships daily deserves software that takes its workflow seriously.</p>
<blockquote><p>Build for the daily practitioner, and the quarterly user finds a product that already works at their scale.</p></blockquote>
`;

// ---------- the 8 new articles ----------

interface NewArticle {
  slug: string;
  title: string;
  excerpt: string;
  html: string;
  cover: string;
  categorySlug: string;
  authorEmail: string;
  daysAgo: number;
  tagSlugs: string[];
}

const NEW_ARTICLES: NewArticle[] = [
  {
    slug: 'how-ai-is-changing-content-creation',
    title: 'How AI Is Changing the Way Modern Teams Create Content',
    excerpt: 'Discover how AI-powered workflows are transforming research, writing, optimization and publishing — without flattening your voice.',
    html: bodyAiContent,
    cover: 'ai-content-cover.png',
    categorySlug: 'ai',
    authorEmail: 'sarah@karmax.dev',
    daysAgo: 1,
    tagSlugs: ['ai', 'editors-choice', 'workflow'],
  },
  {
    slug: 'twenty-minute-seo-audit',
    title: 'The 20-Minute SEO Audit Any Team Can Run',
    excerpt: 'Score widgets can wait. Five checks, twenty minutes, every week — the honest audit that catches 90% of what matters.',
    html: bodySeoAudit,
    cover: 'seo-audit-cover.png',
    categorySlug: 'seo',
    authorEmail: 'david@karmax.dev',
    daysAgo: 4,
    tagSlugs: ['seo', 'editors-choice', 'analytics'],
  },
  {
    slug: 'content-calendar-that-survives-real-life',
    title: 'A Content Calendar That Survives Real Life',
    excerpt: 'Most calendars die in week three. Plan in layers, leave one slot empty, and build for interruption instead of against it.',
    html: bodyCalendar,
    cover: 'content-calendar-cover.png',
    categorySlug: 'content-marketing',
    authorEmail: 'sarah@karmax.dev',
    daysAgo: 7,
    tagSlugs: ['content-strategy', 'workflow'],
  },
  {
    slug: 'what-to-automate-first',
    title: 'What to Automate First (and What to Leave Alone)',
    excerpt: 'The best automations are small, boring, and deeply specific. Start with what you repeat — and keep humans in the loop for judgment.',
    html: bodyAutomation,
    cover: 'automation-first-cover.png',
    categorySlug: 'automation',
    authorEmail: 'david@karmax.dev',
    daysAgo: 11,
    tagSlugs: ['automation', 'editors-choice', 'workflow'],
  },
  {
    slug: 'multi-site-content-operations',
    title: 'Running Multi-Site Content Operations Without Chaos',
    excerpt: 'Five sites, one login: how scoped roles, shared media and a unified calendar turn site sprawl into an editorial operation.',
    html: bodyMultiSite,
    cover: 'multi-site-cover.png',
    categorySlug: 'saas',
    authorEmail: 'emma@karmax.dev',
    daysAgo: 15,
    tagSlugs: ['saas', 'workflow'],
  },
  {
    slug: 'content-repurposing-system',
    title: 'Content Repurposing: Turn One Article Into a Week of Posts',
    excerpt: 'A 60-minute weekly session that extracts the frameworks, statistics and opinions hiding in your best work.',
    html: bodyRepurposing,
    cover: 'repurposing-cover.png',
    categorySlug: 'tutorials',
    authorEmail: 'emma@karmax.dev',
    daysAgo: 19,
    tagSlugs: ['tutorials', 'content-strategy'],
  },
  {
    slug: 'content-metrics-that-predict-growth',
    title: 'The Content Metrics That Actually Predict Growth',
    excerpt: 'Impressions, engaged time, publishing consistency — the leading indicators that beat every vanity metric on your dashboard.',
    html: bodyGrowthMetrics,
    cover: 'growth-metrics-cover.png',
    categorySlug: 'growth',
    authorEmail: 'sarah@karmax.dev',
    daysAgo: 24,
    tagSlugs: ['growth', 'analytics', 'editors-choice'],
  },
  {
    slug: 'product-led-content-platform',
    title: 'What Product-Led Means for a Content Platform',
    excerpt: 'States over tags, roles that mean something, history by default — the small decisions that make a content tool serious.',
    html: bodyProductLed,
    cover: 'product-led-cover.png',
    categorySlug: 'product',
    authorEmail: 'david@karmax.dev',
    daysAgo: 29,
    tagSlugs: ['product', 'saas'],
  },
];

// ---------- upgrades for the 4 published base-seed tech articles ----------

interface TechUpgrade {
  slug: string;
  excerpt: string;
  cover: string;
  categorySlug: string; // new category
  authorEmail: string; // reassign to editorial team
  tagSlugs: string[];
}

const TECH_UPGRADES: TechUpgrade[] = [
  {
    slug: 'getting-started-typescript-2025',
    excerpt: 'TypeScript is the de facto standard for serious JavaScript projects. Here is the shortest sane path from zero to productive.',
    cover: 'typescript-cover.png',
    categorySlug: 'technology',
    authorEmail: 'david@karmax.dev',
    tagSlugs: ['typescript', 'javascript'],
  },
  {
    slug: 'nextjs-performance-optimization',
    excerpt: 'Rendering strategy, data fetching and asset discipline — the techniques that move real Core Web Vitals, in priority order.',
    cover: 'performance-cover.png',
    categorySlug: 'technology',
    authorEmail: 'david@karmax.dev',
    tagSlugs: ['next-js', 'javascript'],
  },
  {
    slug: 'building-design-system-scratch',
    excerpt: 'Tokens first, components second, documentation always. A pragmatic order of operations for design systems that survive contact with a real team.',
    cover: 'design-system-cover.png',
    categorySlug: 'design',
    authorEmail: 'emma@karmax.dev',
    tagSlugs: ['design'],
  },
  {
    slug: 'startup-scaling-strategies-tech-teams',
    excerpt: 'Hiring in order, process that arrives just-in-time, and the checkpoints where premature scale kills more startups than slow growth ever will.',
    cover: 'scaling-cover.png',
    categorySlug: 'business',
    authorEmail: 'sarah@karmax.dev',
    tagSlugs: ['growth', 'product'],
  },
];

// ---------- categories ----------

interface CatSpec {
  name: string;
  slug: string;
  description: string;
}

const EDITORIAL_CATEGORIES: CatSpec[] = [
  { name: 'AI', slug: 'ai', description: 'Artificial intelligence for writing, research and optimization.' },
  { name: 'SEO', slug: 'seo', description: 'Search engine optimization, honest checklists and rankings.' },
  { name: 'Content Marketing', slug: 'content-marketing', description: 'Strategy and craft for growing content programs.' },
  { name: 'Automation', slug: 'automation', description: 'Workflows that run themselves — and when to keep humans in.' },
  { name: 'SaaS', slug: 'saas', description: 'Building, running and selling software products.' },
  { name: 'Product', slug: 'product', description: 'Product thinking, roadmap notes and principles.' },
  { name: 'Tutorials', slug: 'tutorials', description: 'Step-by-step guides you can run this afternoon.' },
  { name: 'Growth', slug: 'growth', description: 'Growing traffic, audience and revenue — measurably.' },
];

// ---------- tags ----------

const EDITORIAL_TAGS: Array<{ name: string; slug: string; color?: string }> = [
  { name: "Editor's Choice", slug: 'editors-choice', color: '#ff4800' },
  { name: 'AI', slug: 'ai' },
  { name: 'SEO', slug: 'seo' },
  { name: 'Content Strategy', slug: 'content-strategy' },
  { name: 'Automation', slug: 'automation' },
  { name: 'Workflow', slug: 'workflow' },
  { name: 'Analytics', slug: 'analytics' },
  { name: 'Growth', slug: 'growth' },
  { name: 'Product', slug: 'product' },
  { name: 'Tutorials', slug: 'tutorials' },
  { name: 'SaaS', slug: 'saas' },
];

// ---------- authors ----------

interface AuthorSpec {
  email: string;
  name: string;
  password: string;
  profileSlug: string;
  bio: string;
  twitter?: string;
  linkedin?: string;
}

const AUTHORS: AuthorSpec[] = [
  {
    email: 'sarah@karmax.dev',
    name: 'Sarah Miller',
    password: 'sarah1234',
    profileSlug: 'sarah-miller',
    bio: 'Content lead at Karmax. Writes about AI-assisted writing, editorial workflow and the craft of publishing on the web. Previously ran content at two startups that survived their growth phase.',
    twitter: 'sarahwrites',
    linkedin: 'sarah-miller',
  },
  {
    email: 'david@karmax.dev',
    name: 'David Chen',
    password: 'david1234',
    profileSlug: 'david-chen',
    bio: 'SEO and automation specialist at Karmax. Ten years of making search engines and content teams understand each other. Believes every checklist should fit on one screen.',
    twitter: 'davidchenseo',
  },
  {
    email: 'emma@karmax.dev',
    name: 'Emma Rodriguez',
    password: 'emma1234',
    profileSlug: 'emma-rodriguez',
    bio: 'Product marketer and tutorials author at Karmax. Turns product decisions into step-by-step guides. Runs the multi-site operations behind our documentation.',
    twitter: 'emmabuilds',
    linkedin: 'emma-rodriguez',
  },
];

// ============================================================
// main
// ============================================================

async function main() {
  console.log('— Blog editorial seed —');

  // ---------- 1. Authors (users + profiles) ----------
  const authorIds: Record<string, string> = {};
  for (const a of AUTHORS) {
    let user = await db.user.findUnique({ where: { email: a.email } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: a.email,
          name: a.name,
          password: a.password,
          role: 'EDITOR',
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      console.log(`  + author user: ${a.name}`);
    }
    authorIds[a.email] = user.id;

    const profile = await db.authorProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      await db.authorProfile.create({
        data: {
          userId: user.id,
          displayName: a.name,
          slug: a.profileSlug,
          bio: a.bio,
          twitter: a.twitter ?? null,
          linkedin: a.linkedin ?? null,
        },
      });
      console.log(`  + author profile: ${a.profileSlug}`);
    }
  }

  // ---------- 2. Categories ----------
  const catIds: Record<string, string> = {};
  for (const c of EDITORIAL_CATEGORIES) {
    const existing = await db.category.findFirst({ where: { slug: c.slug } });
    catIds[c.slug] =
      existing?.id ??
      (await db.category.create({ data: { name: c.name, slug: c.slug, description: c.description } })).id;
  }
  for (const slug of ['technology', 'design', 'business']) {
    const existing = await db.category.findFirst({ where: { slug } });
    if (existing) catIds[slug] = existing.id;
  }

  // ---------- 3. Tags ----------
  const tagIds: Record<string, string> = {};
  for (const tg of EDITORIAL_TAGS) {
    const existing = await db.tag.findFirst({ where: { slug: tg.slug } });
    tagIds[tg.slug] =
      existing?.id ??
      (await db.tag.create({ data: { name: tg.name, slug: tg.slug, color: tg.color ?? null } })).id;
  }
  // base-seed tags used by tech upgrades
  for (const slug of ['typescript', 'javascript', 'next-js', 'design']) {
    const existing = await db.tag.findFirst({ where: { slug } });
    if (existing) tagIds[slug] = existing.id;
  }

  // ---------- 4. Media rows for covers ----------
  const owner = await db.user.findUnique({ where: { email: 'admin@example.com' } });
  if (!owner) throw new Error('admin@example.com not found — run the base seed first.');

  const mediaByFile: Record<string, string> = {};
  for (const c of COVERS) {
    const p = path.join(BLOG_DIR, c.filename);
    if (!fs.existsSync(p)) {
      console.warn(`  ! missing cover file: ${c.filename} (skipped)`);
      continue;
    }
    const stat = fs.statSync(p);
    const url = `/uploads/blog/${c.filename}`;
    const existing = await db.media.findFirst({ where: { url }, select: { id: true } });
    const id =
      existing?.id ??
      (
        await db.media.create({
          data: {
            filename: c.filename,
            originalName: c.filename,
            mimeType: 'image/png',
            size: stat.size,
            width: 1344,
            height: 768,
            alt: c.alt,
            seoTitle: c.seoTitle,
            url,
            thumbnailUrl: url,
            uploadedById: owner.id,
          },
        })
      ).id;
    mediaByFile[c.filename] = id;
  }
  console.log(`  Media covers: ${Object.keys(mediaByFile).length}`);

  const postType = await db.contentType.findFirst({ where: { slug: 'post' } });
  if (!postType) throw new Error('Content type "post" not found — run the base seed first.');

  const tagList = (slugs: string[]) => slugs.map((s) => ({ id: tagIds[s] })).filter((x) => !!x.id);

  const tagConnect = (slugs: string[]) => ({ connect: tagList(slugs) });
  const tagSet = (slugs: string[]) => ({ set: tagList(slugs) });

  // ---------- 5. New editorial articles ----------
  for (const a of NEW_ARTICLES) {
    const data = {
      title: a.title,
      slug: a.slug,
      status: 'PUBLISHED' as const,
      content: a.html.trim(),
      excerpt: a.excerpt,
      authorId: authorIds[a.authorEmail],
      contentTypeId: postType.id,
      featuredImageId: mediaByFile[a.cover] ?? null,
      categoryId: catIds[a.categorySlug] ?? null,
      siteId: null,
      publishedAt: daysAgo(a.daysAgo),
      seoTitle: a.title,
      seoDescription: a.excerpt,
      tags: tagConnect(a.tagSlugs),
    };
    const existing = await db.contentItem.findFirst({ where: { slug: a.slug, siteId: null } });
    if (existing) {
      await db.contentItem.update({ where: { id: existing.id }, data: { ...data, tags: tagSet(a.tagSlugs) } });
      console.log(`  ~ updated article: ${a.slug}`);
    } else {
      await db.contentItem.create({ data });
      console.log(`  + article: ${a.slug}`);
    }
  }

  // ---------- 6. Upgrade the published base-seed tech articles ----------
  for (const t of TECH_UPGRADES) {
    const item = await db.contentItem.findFirst({
      where: { slug: t.slug, siteId: null, contentType: { slug: 'post' } },
    });
    if (!item) {
      console.warn(`  ! tech article not found: ${t.slug} (skipped)`);
      continue;
    }
    await db.contentItem.update({
      where: { id: item.id },
      data: {
        excerpt: item.excerpt ?? t.excerpt,
        seoTitle: item.seoTitle ?? item.title,
        seoDescription: item.seoDescription ?? t.excerpt,
        featuredImageId: mediaByFile[t.cover] ?? item.featuredImageId,
        categoryId: catIds[t.categorySlug] ?? item.categoryId,
        authorId: authorIds[t.authorEmail] ?? item.authorId,
        tags: tagSet(t.tagSlugs),
      },
    });
    console.log(`  ~ upgraded tech article: ${t.slug}`);
  }

  // ---------- 7. Summary ----------
  const published = await db.contentItem.findMany({
    where: { status: 'PUBLISHED', siteId: null, deletedAt: null, contentType: { slug: 'post' } },
    select: { slug: true, publishedAt: true, tags: { select: { slug: true } } },
    orderBy: { publishedAt: 'desc' },
  });
  console.log(`\nDone. Published platform articles: ${published.length}`);
  for (const p of published)
    console.log(
      `  · ${p.publishedAt?.toISOString().slice(0, 10)}  ${p.slug}  [${p.tags.map((x) => x.slug).join(', ')}]`,
    );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
