// ============================================================
// DEMO COMMENTS — Realistic in-memory dataset for UI preview.
// ============================================================
//
// This module provides 36 realistic demo comments (6 per status:
// PENDING, APPROVED, REJECTED, FLAGGED, SPAM, TRASH) so the
// Comments page can be visually tested end-to-end without
// permanently seeding fake records into the production database.
//
// IMPORTANT:
//   - These comments live ONLY in browser memory. They are NOT
//     persisted to the database. Reloading the page resets them.
//   - The existing /api/comments routes are unchanged — the page
//     uses this dataset when `USE_DEMO_DATA` is true and falls back
//     to the real API when it is false.
//   - CommentStatus type in shared/types doesn't include 'TRASH',
//     but the page already handles 'TRASH' as a string (it's a UI
//     concept for soft-deleted comments). We extend the type here
//     for the demo dataset.
// ============================================================

// --- Types -----------------------------------------------------------

export type DemoCommentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'FLAGGED'
  | 'SPAM'
  | 'TRASH';

export interface DemoCommentAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  website?: string;
  // IP address is shown for spam/flagged comments in the detail sheet.
  ipAddress?: string;
}

export interface DemoContentItemRef {
  id: string;
  title: string;
  slug?: string;
}

export interface DemoComment {
  id: string;
  content: string;
  author: DemoCommentAuthor;
  contentItem: DemoContentItemRef;
  status: DemoCommentStatus;
  // ISO timestamp strings — the page uses formatRelativeTime + formatDate.
  createdAt: string;
  updatedAt: string;
  // Optional metadata shown only where relevant (spam score, flag reason).
  spamScore?: number; // 0-100, only for SPAM comments
  flagReason?: string; // only for FLAGGED comments
  // Optional parent comment ID for threaded replies (preserves the
  // existing CommentRow shape's parentId concept).
  parentId?: string;
}

// --- Helpers ---------------------------------------------------------

/**
 * Compute per-status counts for the status tabs.
 * Returns `{ all, PENDING, APPROVED, REJECTED, FLAGGED, SPAM, TRASH }`.
 */
export function getStatusCounts(
  comments: DemoComment[],
): Record<DemoCommentStatus | 'all', number> {
  const counts: Record<DemoCommentStatus | 'all', number> = {
    all: comments.length,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    FLAGGED: 0,
    SPAM: 0,
    TRASH: 0,
  };
  for (const c of comments) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }
  return counts;
}

// --- Realistic article references -----------------------------------

const ARTICLES = {
  seoTips: {
    id: 'art_seo_tips',
    title: '10 Tips for Writing SEO-Friendly Blog Posts in 2025',
    slug: '10-tips-seo-friendly-blog-posts',
  },
  nextjs: {
    id: 'art_nextjs_16',
    title: 'The Complete Guide to Next.js 16 App Router',
    slug: 'complete-guide-nextjs-16-app-router',
  },
  bundleSize: {
    id: 'art_bundle_size',
    title: 'How We Reduced Our Bundle Size by 40%',
    slug: 'reduced-bundle-size-40-percent',
  },
  tsGenerics: {
    id: 'art_ts_generics',
    title: 'Understanding TypeScript Generics: A Practical Guide',
    slug: 'understanding-typescript-generics',
  },
  a11y: {
    id: 'art_a11y_2025',
    title: 'Building Accessible Web Apps in 2025',
    slug: 'building-accessible-web-apps-2025',
  },
  graphql: {
    id: 'art_graphql_switch',
    title: 'Why We Switched from REST to GraphQL (and What We Learned)',
    slug: 'why-we-switched-rest-to-graphql',
  },
} as const;

// Helper to generate ISO timestamps relative to "now" so the page always
// shows fresh relative-time labels ("2 hours ago", "3 days ago", etc.).
// `hoursAgo` can be a fraction (e.g. 0.5 = 30 min ago).
function ts(hoursAgo: number): string {
  const d = new Date(Date.now() - hoursAgo * 3600 * 1000);
  return d.toISOString();
}

// Stable IDs so React keys + selection state are deterministic.
let _id = 0;
function nid(prefix: string): string {
  _id += 1;
  return `demo_${prefix}_${_id}`;
}

// --- The 36 demo comments -------------------------------------------

export const DEMO_COMMENTS: DemoComment[] = [
  // ===================== PENDING (6) =====================
  {
    id: nid('pnd'),
    content:
      "This is incredibly helpful! I've been struggling with optimizing my meta descriptions for months, and tip #4 about keeping them under 155 characters was a game-changer. Bookmarked for future reference — going to audit all my old posts this weekend.",
    author: {
      id: 'usr_sarah_chen',
      name: 'Sarah Chen',
      email: 'sarah.chen@gmail.com',
      website: 'https://sarahchen.dev',
    },
    contentItem: ARTICLES.seoTips,
    status: 'PENDING',
    createdAt: ts(0.5),
    updatedAt: ts(0.5),
  },
  {
    id: nid('pnd'),
    content:
      "Great walkthrough of the new App Router conventions! One question though — how does the new caching behavior interact with ISR in production? We're seeing stale data in some edge cases and would love a follow-up post on debugging cache invalidation.",
    author: {
      id: 'usr_marcus_w',
      name: 'Marcus Williams',
      email: 'marcus.w@protonmail.com',
    },
    contentItem: ARTICLES.nextjs,
    status: 'PENDING',
    createdAt: ts(2),
    updatedAt: ts(1.5),
  },
  {
    id: nid('pnd'),
    content:
      "We tried a similar approach with dynamic imports and it made a huge difference on our Lighthouse scores. Did you run into any issues with code-splitting inside the layouts directory? Our team kept hitting hydration mismatches until we moved those imports into client components.",
    author: {
      id: 'usr_priya_patel',
      name: 'Priya Patel',
      email: 'priya@patel-studio.com',
      website: 'https://patel-studio.com',
    },
    contentItem: ARTICLES.bundleSize,
    status: 'PENDING',
    createdAt: ts(4),
    updatedAt: ts(4),
  },
  {
    id: nid('pnd'),
    content:
      'Finally a tutorial that explains constraints without drowning me in jargon. The `extends` example with key remapping in Mapped Types was the clearest explanation I have ever read. Subscribed and looking forward to the conditional types follow-up.',
    author: {
      id: 'usr_diego_ramos',
      name: 'Diego Ramos',
      email: 'diego.ramos@outlook.com',
    },
    contentItem: ARTICLES.tsGenerics,
    status: 'PENDING',
    createdAt: ts(6),
    updatedAt: ts(6),
  },
  {
    id: nid('pnd'),
    content:
      "Thank you for emphasizing semantic HTML over ARIA-first thinking. So many devs reach for aria-label when a proper <button> or <nav> element would do the job. I'm sharing this with my entire engineering team — accessibility should be a default, not an afterthought.",
    author: {
      id: 'usr_emma_thompson',
      name: 'Emma Thompson',
      email: 'emma.thompson@hey.com',
      website: 'https://emmathompson.me',
    },
    contentItem: ARTICLES.a11y,
    status: 'PENDING',
    createdAt: ts(8),
    updatedAt: ts(8),
  },
  {
    id: nid('pnd'),
    content:
      "Curious about your migration strategy from REST to GraphQL. Did you run REST and GraphQL in parallel during the transition, or did you do a big-bang cutover? We're about to start a similar migration and I'm trying to figure out the lowest-risk path.",
    author: {
      id: 'usr_yuki_tanaka',
      name: 'Yuki Tanaka',
      email: 'yuki.tanaka@fastmail.com',
    },
    contentItem: ARTICLES.graphql,
    status: 'PENDING',
    createdAt: ts(12),
    updatedAt: ts(12),
  },

  // ===================== APPROVED (6) =====================
  {
    id: nid('appr'),
    content:
      "Solid advice across the board. I'd add one more tip: always validate your structured data with Google's Rich Results Test before publishing. We caught a couple of schema.org bugs that way that would have hurt our search appearance.",
    author: {
      id: 'usr_liam_os',
      name: "Liam O'Sullivan",
      email: 'liam@osullivan.io',
      website: 'https://osullivan.io',
    },
    contentItem: ARTICLES.seoTips,
    status: 'APPROVED',
    createdAt: ts(26),
    updatedAt: ts(25),
  },
  {
    id: nid('appr'),
    content:
      'This is exactly what I needed today. The section on parallel routes and intercepting routes finally clicked for me after reading three other tutorials that confused me more. Sharing with my team right now, thanks!',
    author: {
      id: 'usr_aisha_khan',
      name: 'Aisha Khan',
      email: 'aisha.khan@dev.to',
    },
    contentItem: ARTICLES.nextjs,
    status: 'APPROVED',
    createdAt: ts(36),
    updatedAt: ts(35),
  },
  {
    id: nid('appr'),
    content:
      'Impressive results. We achieved a similar reduction by switching from moment.js to date-fns with tree-shaking — ended up saving around 45 KB gzipped. Every kilobyte counts on mobile connections, especially in emerging markets.',
    author: {
      id: 'usr_noah_b',
      name: 'Noah Bergmann',
      email: 'noah@bergmann.codes',
      website: 'https://bergmann.codes',
    },
    contentItem: ARTICLES.bundleSize,
    status: 'APPROVED',
    createdAt: ts(48),
    updatedAt: ts(48),
  },
  {
    id: nid('appr'),
    content:
      'The comparison between function overloading and generics was eye-opening. I never realized how much cleaner the generics approach is until I saw them side by side. Subscribed to your RSS feed, please keep these coming!',
    author: {
      id: 'usr_sofia_garcia',
      name: 'Sofia Garcia',
      email: 'sofia.garcia@gmail.com',
    },
    contentItem: ARTICLES.tsGenerics,
    status: 'APPROVED',
    createdAt: ts(72),
    updatedAt: ts(72),
  },
  {
    id: nid('appr'),
    content:
      'As a screen reader user myself, I really appreciate posts like this. Too many "accessible" tutorials still use divs with onClick for interactive elements. Thank you for getting the fundamentals right — semantic HTML first, ARIA only when necessary.',
    author: {
      id: 'usr_ethan_park',
      name: 'Ethan Park',
      email: 'ethan.park@accessibility-matters.org',
      website: 'https://accessibility-matters.org',
    },
    contentItem: ARTICLES.a11y,
    status: 'APPROVED',
    createdAt: ts(96),
    updatedAt: ts(96),
  },
  {
    id: nid('appr'),
    content:
      'We made the same switch last year and never looked back. The reduction in over-fetching alone saved us serious bandwidth costs on our mobile API. Our frontend team also appreciates not having to chain three REST calls just to render a profile page.',
    author: {
      id: 'usr_hannah_m',
      name: 'Hannah Müller',
      email: 'hannah@mueller.dev',
    },
    contentItem: ARTICLES.graphql,
    status: 'APPROVED',
    createdAt: ts(120),
    updatedAt: ts(120),
  },

  // ===================== REJECTED (6) =====================
  {
    id: nid('rej'),
    content:
      "This is all wrong. Real SEO experts know that keyword density is the only thing that matters in 2025. Stop misleading beginners with this user-experience nonsense and go back to actually ranking pages.",
    author: {
      id: 'usr_anon_seo',
      name: 'SEO Truth Teller',
      email: 'seotruth@anonymous.com',
    },
    contentItem: ARTICLES.seoTips,
    status: 'REJECTED',
    createdAt: ts(20),
    updatedAt: ts(18),
  },
  {
    id: nid('rej'),
    content:
      'Next.js is overrated. Vue and SvelteKit are objectively better frameworks. Stop pretending React is the only option — this kind of biased content is exactly why our industry has a diversity problem in tooling.',
    author: {
      id: 'usr_troll_master',
      name: 'Framework Troll',
    },
    contentItem: ARTICLES.nextjs,
    status: 'REJECTED',
    createdAt: ts(30),
    updatedAt: ts(28),
  },
  {
    id: nid('rej'),
    content:
      'Your blog is garbage. Come back when you have something original to say instead of recycling content from other blogs. Lazy writing like this is why the dev content space is so saturated with low-effort noise.',
    author: {
      id: 'usr_disappointed',
      name: 'Disappointed Reader',
      email: 'disappointed@protonmail.com',
    },
    contentItem: ARTICLES.bundleSize,
    status: 'REJECTED',
    createdAt: ts(44),
    updatedAt: ts(43),
  },
  {
    id: nid('rej'),
    content:
      'Waste of time. I expected advanced patterns and got a beginner tutorial dressed up as a deep dive. Clickbait title, won\'t be coming back to this site. Thumbs down.',
    author: {
      id: 'usr_angry_dev',
      name: 'Angry Dev',
    },
    contentItem: ARTICLES.tsGenerics,
    status: 'REJECTED',
    createdAt: ts(60),
    updatedAt: ts(59),
  },
  {
    id: nid('rej'),
    content:
      'Accessibility is just a checkbox for compliance. Nobody actually cares about screen readers in the real world. Stop pushing this agenda and write about something that actually moves the needle for the business.',
    author: {
      id: 'usr_bitter_vet',
      name: 'Bitter Veteran',
      email: 'bittervet@outlook.com',
    },
    contentItem: ARTICLES.a11y,
    status: 'REJECTED',
    createdAt: ts(80),
    updatedAt: ts(79),
  },
  {
    id: nid('rej'),
    content:
      'GraphQL is a fad. REST has worked fine for 25 years and will continue to work long after this GraphQL nonsense dies. You sound like every junior dev who thinks newer always means better.',
    author: {
      id: 'usr_old_school',
      name: 'Old School Dev',
    },
    contentItem: ARTICLES.graphql,
    status: 'REJECTED',
    createdAt: ts(108),
    updatedAt: ts(107),
  },

  // ===================== FLAGGED (6) =====================
  {
    id: nid('flg'),
    content:
      "Helpful post overall, but this section contains some outdated information about meta keywords. Google hasn't used them for ranking in years — flagging this for an accuracy review so other readers don't get misled.",
    author: {
      id: 'usr_concerned_user',
      name: 'Concerned Reader',
      email: 'concerned@example.com',
    },
    contentItem: ARTICLES.seoTips,
    status: 'FLAGGED',
    createdAt: ts(3),
    updatedAt: ts(2.5),
    flagReason: 'Inaccurate claim about meta keywords — needs fact-check',
  },
  {
    id: nid('flg'),
    content:
      "Multiple readers reported that the code snippets don't render correctly on mobile devices. The horizontal scroll seems broken on iOS Safari. Might be a CSS issue with the syntax highlighter container.",
    author: {
      id: 'usr_mod_alert',
      name: 'Moderator Alert',
      email: 'mod@cms-team.internal',
    },
    contentItem: ARTICLES.nextjs,
    status: 'FLAGGED',
    createdAt: ts(5),
    updatedAt: ts(4.5),
    flagReason: 'Code blocks overflow on mobile — possible CSS regression',
  },
  {
    id: nid('flg'),
    content:
      "I think there's a typo in the webpack config screenshot — line 12 references the TerserPlugin but the import isn't shown anywhere in the accompanying repo. Worth a second look before readers copy-paste and hit errors.",
    author: {
      id: 'usr_verified_reader',
      name: 'Verified Reader',
      email: 'verified@subscribers.dev',
    },
    contentItem: ARTICLES.bundleSize,
    status: 'FLAGGED',
    createdAt: ts(7),
    updatedAt: ts(7),
    flagReason: 'Possible typo in code snippet — line 12 references missing import',
  },
  {
    id: nid('flg'),
    content:
      "Example 3 uses `any` as a fallback type which kind of defeats the purpose of teaching generics. Maybe revise to use `unknown` instead, with a proper type guard? Otherwise great explanation of the fundamentals.",
    author: {
      id: 'usr_careful_coder',
      name: 'Careful Coder',
      email: 'careful@code-review.io',
    },
    contentItem: ARTICLES.tsGenerics,
    status: 'FLAGGED',
    createdAt: ts(10),
    updatedAt: ts(9.5),
    flagReason: 'Code example uses `any` — recommend `unknown` for type safety',
  },
  {
    id: nid('flg'),
    content:
      "The color contrast in the code examples doesn't meet WCAG AA. The dark theme text on the dark background is hard to read for users with low vision. Flagging for review — would be great to bump the text color a shade.",
    author: {
      id: 'usr_a11y_advocate',
      name: 'Accessibility Advocate',
      email: 'advocate@a11y-first.org',
      website: 'https://a11y-first.org',
    },
    contentItem: ARTICLES.a11y,
    status: 'FLAGGED',
    createdAt: ts(15),
    updatedAt: ts(14),
    flagReason: 'Code block color contrast fails WCAG AA — needs visual review',
  },
  {
    id: nid('flg'),
    content:
      "The performance numbers in the comparison table seem off. Our internal benchmarks with similar payloads show very different results for the N+1 query scenario. Can you share your methodology and the dataset size used for testing?",
    author: {
      id: 'usr_long_time_reader',
      name: 'Long-time Reader',
      email: 'longtime@subscriber.dev',
    },
    contentItem: ARTICLES.graphql,
    status: 'FLAGGED',
    createdAt: ts(22),
    updatedAt: ts(21),
    flagReason: 'Performance benchmarks appear inconsistent — methodology unclear',
  },

  // ===================== SPAM (6) =====================
  {
    id: nid('spm'),
    content:
      'AMAZING post!!! Best SEO tips ever!!! Want to rank #1 on Google in 7 days? Buy cheap high-quality backlinks at seoguru.biz — boost your rankings GUARANTEED or your money back! Limited time 50% off offer, click NOW before your competitors do!!!',
    author: {
      id: 'usr_seo_guru',
      name: 'SEO Guru',
      email: 'promotions@seoguru-marketing.biz',
      website: 'http://seoguru.biz',
      ipAddress: '185.220.101.45',
    },
    contentItem: ARTICLES.seoTips,
    status: 'SPAM',
    createdAt: ts(1),
    updatedAt: ts(1),
    spamScore: 98,
  },
  {
    id: nid('spm'),
    content:
      'Tired of working for someone else? Learn how I make $50,000/month with crypto trading from my laptop in Bali! No experience needed. Click here to start your journey to financial freedom today — limited spots available, act FAST!!!',
    author: {
      id: 'usr_crypto_bro',
      name: 'Crypto Freedom',
      email: 'rich@crypto-wealth-system.io',
      website: 'http://crypto-wealth-system.io',
      ipAddress: '45.137.21.7',
    },
    contentItem: ARTICLES.nextjs,
    status: 'SPAM',
    createdAt: ts(3.5),
    updatedAt: ts(3.5),
    spamScore: 99,
  },
  {
    id: nid('spm'),
    content:
      'Best deals on web hosting anywhere on the internet! Unlimited bandwidth, free SSL certificate, free domain for life, only $1.99/month! Use code SAVE90 at checkout. Visit hostmaster247.com now before this offer expires forever!!!',
    author: {
      id: 'usr_discount_mart',
      name: 'Discount Mart',
      email: 'deals@hostmaster247-promo.com',
      website: 'http://hostmaster247.com',
      ipAddress: '193.27.14.88',
    },
    contentItem: ARTICLES.bundleSize,
    status: 'SPAM',
    createdAt: ts(5.5),
    updatedAt: ts(5.5),
    spamScore: 96,
  },
  {
    id: nid('spm'),
    content:
      'WIN BIG at Royal Slots Online Casino! 200% welcome bonus + 200 free spins, no deposit required! Instant payouts, 24/7 support, play from anywhere in the world. Click here to claim your bonus and change your life today!!!',
    author: {
      id: 'usr_casino_king',
      name: 'Casino King',
      email: 'winner@royal-slots-promo.net',
      website: 'http://royal-slots-online.net',
      ipAddress: '212.193.30.42',
    },
    contentItem: ARTICLES.tsGenerics,
    status: 'SPAM',
    createdAt: ts(8.5),
    updatedAt: ts(8.5),
    spamScore: 100,
  },
  {
    id: nid('spm'),
    content:
      'Best prices on generic medications online! No prescription needed, fast discreet shipping worldwide. Viagra, Cialis, weight loss pills — all 80% off retail prices. Visit cheap-meds-online.shop now for a limited-time BOGO offer!!!',
    author: {
      id: 'usr_pharma_seller',
      name: 'Meds Direct',
      email: 'orders@cheap-meds-online.shop',
      website: 'http://cheap-meds-online.shop',
      ipAddress: '62.133.50.119',
    },
    contentItem: ARTICLES.a11y,
    status: 'SPAM',
    createdAt: ts(11),
    updatedAt: ts(11),
    spamScore: 97,
  },
  {
    id: nid('spm'),
    content:
      'WORK FROM HOME and EARN $5000/WEEK guaranteed! No experience needed, sit at your computer just 2 hours a day. Watch this FREE 15-minute video to learn the secret system the elites don\'t want you to know about. Click NOW before spots fill up!!!',
    author: {
      id: 'usr_make_money',
      name: 'Money Maker',
      email: 'income@fast-cash-system.biz',
      website: 'http://fast-cash-system.biz',
      ipAddress: '91.243.59.7',
    },
    contentItem: ARTICLES.graphql,
    status: 'SPAM',
    createdAt: ts(14),
    updatedAt: ts(14),
    spamScore: 99,
  },

  // ===================== TRASH (6) =====================
  {
    id: nid('trsh'),
    content: '[This comment was removed by the author]',
    author: {
      id: 'usr_deleted_1',
      name: 'Deleted User',
    },
    contentItem: ARTICLES.seoTips,
    status: 'TRASH',
    createdAt: ts(40),
    updatedAt: ts(38),
  },
  {
    id: nid('trsh'),
    content:
      '[Comment deleted by moderator — violated community guidelines on personal attacks]',
    author: {
      id: 'usr_removed_acct',
      name: 'Removed Account',
    },
    contentItem: ARTICLES.nextjs,
    status: 'TRASH',
    createdAt: ts(56),
    updatedAt: ts(54),
  },
  {
    id: nid('trsh'),
    content: '[User account no longer exists]',
    author: {
      id: 'usr_former_reader',
      name: 'Former Reader',
    },
    contentItem: ARTICLES.bundleSize,
    status: 'TRASH',
    createdAt: ts(88),
    updatedAt: ts(85),
  },
  {
    id: nid('trsh'),
    content: '[This comment was permanently removed by our moderation team]',
    author: {
      id: 'usr_banned_user',
      name: 'Banned User',
    },
    contentItem: ARTICLES.tsGenerics,
    status: 'TRASH',
    createdAt: ts(100),
    updatedAt: ts(99),
  },
  {
    id: nid('trsh'),
    content: '[Comment soft-deleted by user]',
    author: {
      id: 'usr_closed_acct',
      name: 'Closed Account',
    },
    contentItem: ARTICLES.a11y,
    status: 'TRASH',
    createdAt: ts(140),
    updatedAt: ts(140),
  },
  {
    id: nid('trsh'),
    content: '[Removed at user\'s request — contained personal information]',
    author: {
      id: 'usr_deleted_visitor',
      name: 'Deleted Visitor',
    },
    contentItem: ARTICLES.graphql,
    status: 'TRASH',
    createdAt: ts(160),
    updatedAt: ts(158),
  },
];
