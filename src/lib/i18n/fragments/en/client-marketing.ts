// ============================================================
// i18n — FRAGMENT: Marketing / public website (English)
// ============================================================
// Every user-visible string of the public marketing site
// (header, hero, sections, pricing, blog, about, solutions,
// legal, cookie banner, footer) lives under the `mkt.*`
// prefix. en = source of truth; fr is fully translated; all
// other locales fall back per the standard t() chain
// (dict[locale][key] ?? dict.en[key] ?? key).
//
// Shared chrome keys are REUSED, not redefined:
//   auth.* (login form), theme.*, language.*, common.*
// ============================================================

export const clientMarketingEn: Record<string, string> = {
  // ---- Brand ----
  'mkt.brand.name': 'Karmax',
  'mkt.brand.tagline': 'Craft content that ranks.',

  // ---- Header / navigation ----
  'mkt.nav.features': 'Features',
  'mkt.nav.pricing': 'Pricing',
  'mkt.nav.solutions': 'Solutions',
  'mkt.nav.blog': 'Blog',
  'mkt.nav.about': 'About',
  'mkt.nav.login': 'Log in',
  'mkt.nav.getStarted': 'Get started',
  'mkt.nav.menu': 'Menu',
  'mkt.nav.openMenu': 'Open menu',
  'mkt.nav.closeMenu': 'Close menu',
  'mkt.nav.skipToContent': 'Skip to content',

  // ---- Solutions mega-menu (renders from the solutions catalog) ----
  'mkt.menu.solutionsTitle': 'Solutions',
  'mkt.menu.solutionsSubtitle': 'Built for teams that publish seriously',
  'mkt.menu.contentPublishing': 'Content Publishing',
  'mkt.menu.contentPublishingDesc': 'Create, manage and publish content across connected sites',
  'mkt.menu.seo': 'SEO & Organic Growth',
  'mkt.menu.seoDesc': 'Optimize content and improve search visibility',
  'mkt.menu.automation': 'Content Automation',
  'mkt.menu.automationDesc': 'Automate workflows, scheduling and publishing',
  'mkt.menu.multiSite': 'Multi-Site Management',
  'mkt.menu.multiSiteDesc': 'Manage multiple websites from one dashboard',
  'mkt.menu.agencies': 'For Agencies & Teams',
  'mkt.menu.agenciesDesc': 'Clients, sites and workflows on one platform',
  'mkt.menu.integrations': 'Integrations',
  'mkt.menu.integrationsDesc': 'Connect WordPress or any compatible REST CMS',
  'mkt.menu.exploreAll': 'Explore all solutions',

  // ---- Hero ----
  'mkt.hero.eyebrow': 'The multi-site content platform',
  'mkt.hero.titleA': 'Run every site you publish',
  'mkt.hero.titleAccent': 'from one calm dashboard.',
  'mkt.hero.subtitle':
    'Karmax brings AI-assisted writing, a complete SEO suite, media management, newsletter and automation together — and connects straight to WordPress or any REST CMS.',
  'mkt.hero.ctaPrimary': 'Start for free',
  'mkt.hero.ctaSecondary': 'See how it works',
  'mkt.hero.demoLabel': 'Live product demo',
  'mkt.hero.demoCaption': 'The real Karmax dashboard — Executive view',

  // ---- Product showcase labels ----
  'mkt.showcase.ai': 'AI Content',
  'mkt.showcase.seo': 'SEO',
  'mkt.showcase.automation': 'Automation',
  'mkt.showcase.media': 'Media',
  'mkt.showcase.dashboard': 'Dashboard',
  'mkt.showcase.newsletter': 'Newsletter',

  // ---- Value proposition ----
  'mkt.value.eyebrow': 'Why Karmax',
  'mkt.value.title': 'Your content workflow shouldn’t scatter across six tools.',
  'mkt.value.body':
    'Most teams write in one app, check SEO in another, store media somewhere else, and still publish by hand. Karmax replaces that patchwork with one platform that connects to the sites you already run.',
  'mkt.value.withoutTitle': 'Without Karmax',
  'mkt.value.without1': 'Drafts, media and SEO spread across disconnected tools',
  'mkt.value.without2': 'Manual copy-paste publishing for every article',
  'mkt.value.without3': 'SEO checked after publishing — if at all',
  'mkt.value.without4': 'No repeatable process, no history, no overview',
  'mkt.value.withTitle': 'With Karmax',
  'mkt.value.with1': 'Writing, media, SEO and publishing in one place',
  'mkt.value.with2': 'Connect WordPress or any REST CMS and publish directly',
  'mkt.value.with3': 'Audit, schema, redirects and indexing handled per site',
  'mkt.value.with4': 'Automations that run your routine work around the clock',

  // ---- Capabilities (real, verifiable numbers only) ----
  'mkt.stats.title': 'What you get, in numbers',
  'mkt.stats.seoTools': 'SEO tools',
  'mkt.stats.seoToolsDesc': 'Audit, schema, redirects, sitemap, robots, indexing and more',
  'mkt.stats.languages': 'Languages',
  'mkt.stats.languagesDesc': 'Full dashboard localization with English fallback',
  'mkt.stats.sites': 'Sites on Max',
  'mkt.stats.sitesDesc': 'Every site you run, one dashboard',
  'mkt.stats.aiArticles': 'AI articles / month',
  'mkt.stats.aiArticlesDesc': 'On the Pro plan — more on Max',
  'mkt.stats.unlimited': 'Unlimited',

  // ---- Features section ----
  'mkt.features.eyebrow': 'Features',
  'mkt.features.title': 'Everything you publish, one platform.',
  'mkt.features.subtitle': 'Each capability is built in and connected — no plugins to stitch together.',

  'mkt.feat.ai.label': 'AI Content',
  'mkt.feat.ai.title': 'Write with AI that knows your workflow.',
  'mkt.feat.ai.body':
    'Draft complete articles in the built-in editor with AI assistance, reusable prompt templates, and editorial skills for content style and SEO ranking. Bring your own AI provider and keep full control of models and usage.',
  'mkt.feat.ai.point1': 'AI playground, prompts library and job queue',
  'mkt.feat.ai.point2': 'Editorial skills: content style + SEO ranking checks',
  'mkt.feat.ai.point3': 'Bring your own provider — models, keys and usage tracked',
  'mkt.feat.ai.cta': 'Explore AI content',

  'mkt.feat.seo.label': 'SEO',
  'mkt.feat.seo.title': 'Optimize every article before it ships.',
  'mkt.feat.seo.body':
    'A complete technical SEO suite per site: audits, schema markup, redirects, XML sitemaps, robots.txt, canonicals, internal links, broken-link scans and indexing status — with social previews before you publish.',
  'mkt.feat.seo.point1': 'Per-page SEO reports with focus keywords',
  'mkt.feat.seo.point2': 'Sitemap, robots, canonicals and redirect engine',
  'mkt.feat.seo.point3': 'Search Console integration and indexing views',
  'mkt.feat.seo.cta': 'Explore the SEO suite',

  'mkt.feat.automation.label': 'Automation',
  'mkt.feat.automation.title': 'Turn routine publishing into a system.',
  'mkt.feat.automation.body':
    'Build visual automations that trigger on content events — schedule publishing, run SEO checks, send newsletters and notify your team while you sleep. Every run is logged and auditable.',
  'mkt.feat.automation.point1': 'Visual automation builder with triggers and steps',
  'mkt.feat.automation.point2': 'Scheduled publishing and recurring jobs',
  'mkt.feat.automation.point3': 'Run history, logs and error handling built in',
  'mkt.feat.automation.cta': 'Explore automation',

  'mkt.feat.media.label': 'Media',
  'mkt.feat.media.title': 'A real library for your assets.',
  'mkt.feat.media.body':
    'Upload, organize and reuse images across sites with folders, search and per-site scoping. Storage scales with your plan — from 1 GB on Free to 100 GB on Max.',
  'mkt.feat.media.point1': 'Folders, search and multi-site scoping',
  'mkt.feat.media.point2': 'Usage tracked against your plan’s storage',
  'mkt.feat.media.cta': 'Explore media',

  'mkt.feat.engagement.label': 'Newsletter & Comments',
  'mkt.feat.engagement.title': 'Grow the audience you already have.',
  'mkt.feat.engagement.body':
    'Manage subscribers, send campaigns over your own SMTP, and moderate comments with Akismet spam protection — engagement lives next to the content it belongs to.',
  'mkt.feat.engagement.point1': 'Subscriber management and campaign sending',
  'mkt.feat.engagement.point2': 'Comment moderation queue with spam checks',
  'mkt.feat.engagement.cta': 'Explore engagement',

  'mkt.feat.multisite.label': 'Multi-site',
  'mkt.feat.multisite.title': 'Every site, one login.',
  'mkt.feat.multisite.body':
    'Switch between client sites, personal blogs and side projects instantly. Roles, permissions and plan limits apply per site, and platform staff get their own overview of everything.',
  'mkt.feat.multisite.point1': 'Site switcher with per-site data isolation',
  'mkt.feat.multisite.point2': 'Roles and granular page permissions',
  'mkt.feat.multisite.cta': 'Explore multi-site',

  // ---- Workflow ----
  'mkt.workflow.eyebrow': 'How it works',
  'mkt.workflow.title': 'From idea to published in four steps.',
  'mkt.workflow.subtitle': 'Connect once — then everything happens inside Karmax.',
  'mkt.workflow.step1.title': 'Connect your website',
  'mkt.workflow.step1.body': 'Link WordPress or any REST CMS with the connection verifier. Karmax confirms write access before you publish.',
  'mkt.workflow.step2.title': 'Create and optimize content',
  'mkt.workflow.step2.body': 'Draft with AI assistance, manage media, and run per-page SEO checks with focus keywords and social previews.',
  'mkt.workflow.step3.title': 'Review and schedule',
  'mkt.workflow.step3.body': 'Route drafts through review with roles and permissions, then schedule publishing on your calendar.',
  'mkt.workflow.step4.title': 'Publish and automate',
  'mkt.workflow.step4.body': 'Push to your site directly, trigger automations for newsletters and routine jobs, and track everything from the dashboard.',

  // ---- Platform / integrations ----
  'mkt.platform.eyebrow': 'Open platform',
  'mkt.platform.title': 'Connects to what you already use.',
  'mkt.platform.subtitle': 'Karmax talks to your stack through documented APIs — no lock-in, no proprietary plugin.',
  'mkt.platform.wordpress': 'WordPress',
  'mkt.platform.wordpressDesc': 'Native REST API client with connection verification',
  'mkt.platform.cms': 'Any REST CMS',
  'mkt.platform.cmsDesc': 'Standard API adapter with API-key authentication',
  'mkt.platform.stripe': 'Stripe',
  'mkt.platform.stripeDesc': 'Billing and subscription management',
  'mkt.platform.smtp': 'SMTP Email',
  'mkt.platform.smtpDesc': 'Your own mail server for newsletters and notifications',
  'mkt.platform.ai': 'AI Providers',
  'mkt.platform.aiDesc': 'Bring your own keys and models',
  'mkt.platform.akismet': 'Akismet',
  'mkt.platform.akismetDesc': 'Comment spam protection',
  'mkt.platform.webhooks': 'Webhooks',
  'mkt.platform.webhooksDesc': 'Outgoing webhooks for content events',

  // ---- Use cases / solutions ----
  'mkt.usecases.eyebrow': 'Solutions',
  'mkt.usecases.title': 'Built for people who publish.',
  'mkt.usecases.subtitle': 'One platform, shaped around how you work.',
  'mkt.uc.bloggers.title': 'Bloggers',
  'mkt.uc.bloggers.body': 'Write with AI assistance, keep your media tidy and let the SEO suite check every post — then publish straight to WordPress without copy-paste.',
  'mkt.uc.agencies.title': 'Agencies',
  'mkt.uc.agencies.body': 'Every client site in one dashboard with per-site isolation, roles and permissions. Switch contexts instantly and automate the recurring work.',
  'mkt.uc.publishers.title': 'Publishers',
  'mkt.uc.publishers.body': 'An editorial workflow that scales: drafts, review assignments, calendar scheduling and a newsletter to grow each publication.',
  'mkt.uc.seoteams.title': 'SEO Teams',
  'mkt.uc.seoteams.body': 'Fourteen technical SEO tools per site — audits, schema, redirects, internal links, indexing — with per-page reports and search console data.',
  'mkt.uc.contentteams.title': 'Content Teams',
  'mkt.uc.contentteams.body': 'Admins, editors and authors with exactly the permissions they need. Tasks, comments and notifications keep everyone aligned.',
  'mkt.uc.businesses.title': 'Businesses',
  'mkt.uc.businesses.body': 'Run your site alongside the business: automated publishing, backups, user management and billing under one login.',

  // ---- Pricing ----
  'mkt.pricing.heroTitle': 'The best work solution, for the best price.',
  'mkt.pricing.subtitle': 'Start free, upgrade when your sites grow. Every plan includes the full editor, SEO basics and media library.',
  'mkt.pricing.billingToggle': 'Billing period',
  'mkt.pricing.monthly': 'Monthly',
  'mkt.pricing.yearly': 'Yearly',
  'mkt.pricing.perMonth': '/ month',
  'mkt.pricing.perMonthShort': '/mo',
  'mkt.pricing.billedYearly': 'Billed {amount} yearly',
  'mkt.pricing.perYear': '/ year',
  'mkt.pricing.free': 'Free',
  'mkt.pricing.popular': 'Most popular',
  'mkt.pricing.currentPlan': 'Current plan',
  'mkt.pricing.cta.free': 'Start for free',
  'mkt.pricing.cta': 'Choose {plan}',
  'mkt.pricing.custom': 'Custom',
  'mkt.pricing.sites': 'Sites',
  'mkt.pricing.sitesUnlimited': 'Unlimited sites',
  'mkt.pricing.sitesCount': '{count} sites',
  'mkt.pricing.storage': 'Storage',
  'mkt.pricing.aiArticles': 'AI articles / month',
  'mkt.pricing.aiImages': 'AI images / month',
  'mkt.pricing.editor': 'Full rich-text editor',
  'mkt.pricing.seoBasics': 'SEO suite',
  'mkt.pricing.mediaLibrary': 'Media library',
  'mkt.pricing.newsletter': 'Newsletter & subscribers',
  'mkt.pricing.automation': 'Automation builder',
  'mkt.pricing.backups': 'Automated backups',
  'mkt.pricing.completeFeatureList': 'Complete feature list',
  'mkt.pricing.ctaTitle': 'Publish your next site with us.',
  'mkt.pricing.error': 'Couldn’t load plans. Please try again.',
  'mkt.pricing.retry': 'Retry',
  'mkt.pricing.loading': 'Loading plans…',
  'mkt.pricing.included': 'Included in {plan}',

  // ---- Pricing: comparison table ----
  'mkt.compare.featureCol': 'Feature',
  'mkt.compare.usage': 'Usage',
  'mkt.compare.sites': 'Sites',
  'mkt.compare.content': 'Content',
  'mkt.compare.aiContent': 'AI content',
  'mkt.compare.comments': 'Comments',
  'mkt.compare.emailTemplates': 'Email templates',
  'mkt.compare.seo': 'SEO',
  'mkt.compare.advancedSeo': 'Advanced SEO (redirects, schema, Search Console)',
  'mkt.compare.automation': 'Automation',
  'mkt.compare.scheduledPublishing': 'Scheduled publishing',
  'mkt.compare.dataSecurity': 'Data & security',
  'mkt.compare.advancedAnalytics': 'Advanced analytics',
  'mkt.compare.auditLog': 'Audit log',
  'mkt.compare.platform': 'Platform',
  'mkt.compare.wordpress': 'WordPress integration',
  'mkt.compare.restCms': 'REST CMS / API',
  'mkt.compare.webhooks': 'Webhooks',
  'mkt.compare.ownKeys': 'Your own API keys',

  // ---- Pricing: FAQ ----
  'mkt.faq.title': 'Frequently asked questions',
  'mkt.faq.subtitle':
    'Find answers to your questions right here, and don’t hesitate to Contact us if you couldn’t find what you’re looking for.',
  'mkt.faq.contact': 'Contact us',
  'mkt.faq.loadMore': 'Load more',
  'mkt.faq.upgradeDowngrade.q': 'Can I upgrade or downgrade my plan?',
  'mkt.faq.upgradeDowngrade.a':
    'Yes — plans are self-serve. You can move between Free, Plus, Pro and Max at any time from the billing area of your dashboard, and your sites, content and media move with you.',
  'mkt.faq.paymentMethods.q': 'What payment methods do you accept?',
  'mkt.faq.paymentMethods.a':
    'Payments are processed by Stripe. Card details are handled entirely by Stripe’s hosted checkout — they never reach our servers.',
  'mkt.faq.cancel.q': 'Can I cancel my subscription?',
  'mkt.faq.cancel.a':
    'Yes. You can manage or cancel your subscription anytime from your dashboard. Your content stays accessible on the Free plan.',
  'mkt.faq.planLimits.q': 'What happens when I reach my plan limits?',
  'mkt.faq.planLimits.a':
    'Plan limits cover the number of sites, storage and monthly AI usage. When you hit an AI limit you can upgrade your plan or connect your own AI provider keys for unlimited use.',
  'mkt.faq.multipleSites.q': 'Can I manage multiple sites?',
  'mkt.faq.multipleSites.a':
    'Yes — every plan is multi-site from day one. Each plan sets how many sites you can manage, and the Max plan has no site limit.',
  'mkt.faq.startFree.q': 'What happens if I start on the Free plan?',
  'mkt.faq.startFree.a':
    'Nothing expires. The Free plan stays free and includes the full editor, SEO basics and the media library — you only upgrade when your sites grow.',
  'mkt.faq.connectCms.q': 'Can I connect WordPress or another REST CMS?',
  'mkt.faq.connectCms.a':
    'Yes. Karmax ships a native WordPress REST client with connection verification, plus a standard REST CMS adapter with API-key authentication — on every plan.',
  'mkt.faq.aiLimits.q': 'How do AI article and image limits work?',
  'mkt.faq.aiLimits.a':
    'Platform AI usage is metered by generations: each plan sets a monthly number of AI articles and AI images, resetting every calendar month. On the Max plan you connect your own AI provider keys, which are never metered by us.',

  // ---- Contact page ----
  'mkt.contact.eyebrow': 'Contact',
  'mkt.contact.title': 'Contact us',
  'mkt.contact.intro':
    'The fastest ways to get help with Karmax — every channel below is real and available today.',
  'mkt.contact.billingTitle': 'Plans & billing',
  'mkt.contact.billingBody':
    'Plan changes, upgrades and cancellations are self-serve from the billing area of your dashboard. The pricing page explains what every plan includes.',
  'mkt.contact.billingCta': 'See plans & pricing',
  'mkt.contact.faqTitle': 'Product questions',
  'mkt.contact.faqBody':
    'Most questions about plans, limits, sites and AI usage are answered in the pricing FAQ.',
  'mkt.contact.faqCta': 'Read the FAQ',
  'mkt.contact.securityTitle': 'Security reports',
  'mkt.contact.securityBody':
    'If you believe you have found a security issue in Karmax, please follow the responsible disclosure process described on the security page.',
  'mkt.contact.securityCta': 'Security & disclosure',
  'mkt.contact.tryTitle': 'Just exploring?',
  'mkt.contact.tryBody':
    'The best way to evaluate Karmax is to use it — create a free account and publish your first site in minutes.',
  'mkt.contact.tryCta': 'Create your free account',

  // ---- Blog ----
  'mkt.blog.title': 'Blog',
  'mkt.blog.subtitle': 'Notes on content craft, SEO and building Karmax.',
  'mkt.blog.featured': 'Featured article',
  'mkt.blog.allPosts': 'All posts',
  'mkt.blog.categories': 'Categories',
  'mkt.blog.all': 'All',
  'mkt.blog.readMore': 'Read article',
  'mkt.blog.readingTime': '{minutes} min read',
  'mkt.blog.backToBlog': 'Back to blog',
  'mkt.blog.by': 'By',
  'mkt.blog.related': 'Related articles',
  'mkt.blog.newsletterTitle': 'Get one thoughtful email a month',
  'mkt.blog.newsletterBody': 'New articles, product notes and honest lessons from running a content platform. No spam — unsubscribe anytime.',
  'mkt.blog.newsletterPlaceholder': 'you@example.com',
  'mkt.blog.newsletterCta': 'Subscribe',
  'mkt.blog.newsletterSuccess': 'Subscribed — welcome aboard.',
  'mkt.blog.newsletterError': 'Subscription failed. Please try again.',
  'mkt.blog.empty': 'No articles published yet.',
  'mkt.blog.loading': 'Loading articles…',
  'mkt.blog.error': 'Couldn’t load articles. Please try again.',
  'mkt.blog.published': 'Published',
  'mkt.blog.updated': 'Updated',
  'mkt.blog.toc': 'On this page',

  // ---- About ----
  'mkt.about.eyebrow': 'About',
  'mkt.about.title': 'We build the tool we publish with.',
  'mkt.about.intro':
    'Karmax is an independent product built by a small team that runs multiple content sites and got tired of stitching six tools together for every article.',
  'mkt.about.missionTitle': 'Our mission',
  'mkt.about.missionBody':
    'Give every person who publishes — solo bloggers, agencies, publishers, businesses — one calm, honest platform for the whole content workflow: writing, media, SEO, engagement and automation.',
  'mkt.about.whyTitle': 'Why we built it',
  'mkt.about.whyBody':
    'The tools were all there, but never together. Writing lived in one app, SEO in another, media in a third, publishing by copy-paste. We wanted the workflow itself — so we connected an editor, a full SEO suite, a media library, newsletter and automation into one product that talks to the sites you already run.',
  'mkt.about.howTitle': 'How it works',
  'mkt.about.howBody':
    'Karmax is a multi-tenant platform: you connect your sites — WordPress via its REST API or any CMS with a standard REST endpoint — and manage content, media, SEO, comments and newsletters per site from one dashboard. Roles and permissions mirror real editorial teams, and automations handle the routine parts.',
  'mkt.about.principlesTitle': 'Core principles',
  'mkt.about.principle1Title': 'Honest software',
  'mkt.about.principle1Body': 'No fake urgency, no dark patterns, no invented numbers. What the marketing says is what the product does.',
  'mkt.about.principle2Title': 'Your data, your sites',
  'mkt.about.principle2Body': 'Your content lives in your CMS. Karmax manages and publishes — it never holds your site hostage.',
  'mkt.about.principle3Title': 'Calm by default',
  'mkt.about.principle3Body': 'A quiet interface, sensible defaults and zero gratuitous animations. The work is the hero, not the UI.',
  'mkt.about.principle4Title': 'Open connections',
  'mkt.about.principle4Body': 'Documented REST integrations, webhooks, and your own SMTP and AI keys. Leave anytime — nothing to export.',
  'mkt.about.capabilitiesTitle': 'Key capabilities',
  'mkt.about.capabilitiesBody': 'Everything below ships in the product today — not on a roadmap slide.',
  'mkt.about.ctaTitle': 'Publish your next site with us.',
  'mkt.about.ctaBody': 'Start on the free plan and grow from there.',

  // ---- Solutions overview (#/solutions) ----
  'mkt.sol.title': 'Solutions for every publishing goal.',
  'mkt.sol.subtitle':
    'Karmax brings writing, SEO, media, automation and multi-site management together — and publishes straight to WordPress or any REST CMS.',
  'mkt.sol.categoriesTitle': 'Find the solution that fits your work',
  'mkt.sol.categoriesSubtitle': 'Six ways teams put Karmax to work — each one built on capabilities that ship today.',
  'mkt.sol.audiencesSubtitle': 'One platform, shaped around how you publish.',
  'mkt.sol.details': 'See how it fits',

  // ---- Solutions shared template (solution pages) ----
  'mkt.solp.learnMore': 'Learn more',
  'mkt.solp.workflowTitle': 'How it works',
  'mkt.solp.storiesTitle': 'Inside the product',
  'mkt.solp.storyLabel': 'Chapter',
  'mkt.solp.benefitsEyebrow': 'Benefits',
  'mkt.solp.benefitsTitle': 'What you get',
  'mkt.solp.usecasesTitle': 'Built for the way you publish',
  'mkt.solp.usecasesSubtitle': 'Whatever you publish, the workflow stays calm.',
  'mkt.solp.usecaseLink': 'Explore this solution',
  'mkt.solp.possibleEyebrow': 'Examples',
  'mkt.solp.possibleTitle': 'See what’s possible with Karmax',
  'mkt.solp.possibleSubtitle': 'Real workflows you can set up today — no invented numbers, just what the product does.',
  'mkt.solp.relatedTitle': 'Related resources',
  'mkt.solp.resBlogTitle': 'From the Karmax blog',
  'mkt.solp.resBlogBody': 'Product updates and publishing guides from the team.',
  'mkt.solp.resBlogCta': 'Read the blog',
  'mkt.solp.resFeaturesTitle': 'Explore the feature set',
  'mkt.solp.resFeaturesBody': 'AI writing, SEO, automation, media and more — every capability in one tour.',
  'mkt.solp.resFeaturesCta': 'View all features',
  'mkt.solp.resPricingTitle': 'Compare plans',
  'mkt.solp.resPricingBody': 'See what every plan includes, from Free to Max.',
  'mkt.solp.resPricingCta': 'View pricing',
  'mkt.solp.ctaTitle': 'Ready to simplify how you publish?',
  'mkt.solp.ctaBody': 'Create, optimize and publish your content from one calm workflow.',
  'mkt.solp.ctaSecondary': 'Explore features',

  // Audience one-liners (use-case cards)
  'mkt.solp.uc.bloggers': 'Publish consistently without managing multiple tools.',
  'mkt.solp.uc.publishers': 'Build repeatable editorial workflows.',
  'mkt.solp.uc.agencies': 'Manage multiple client sites from one workspace.',
  'mkt.solp.uc.teamsTitle': 'Teams',
  'mkt.solp.uc.teams': 'Keep content, SEO and publishing in one workflow.',
  'mkt.solp.uc.seoTeams': 'Run technical SEO across every site you manage.',
  'mkt.solp.uc.businesses': 'Run your sites alongside the business.',

  // ---- Solution: Content Publishing ----
  'mkt.solp.cp.heroTitle': 'Create and publish content without the busywork.',
  'mkt.solp.cp.heroBody':
    'Draft with AI assistance, keep media organized and check SEO as you write — then publish straight to WordPress or any REST CMS from the same editor.',
  'mkt.solp.cp.introTitle': 'One editor, from first draft to published post.',
  'mkt.solp.cp.introBody':
    'Karmax replaces the copy-paste routine. Articles, media and metadata live together, drafts keep their status and author, and publishing is a click — not a migration.',
  'mkt.solp.cp.step1Title': 'Create',
  'mkt.solp.cp.step1Body': 'Generate or write your content with the Karmax editor and AI tools — prompts library, job queue and editorial skills included.',
  'mkt.solp.cp.step2Title': 'Optimize',
  'mkt.solp.cp.step2Body': 'Improve SEO, metadata, structure and media before publishing, with per-page checks and focus keywords.',
  'mkt.solp.cp.step3Title': 'Publish',
  'mkt.solp.cp.step3Body': 'Send content directly to connected WordPress or REST CMS sites — immediately or on a schedule.',
  'mkt.solp.cp.story1Title': 'Write with AI that fits your workflow.',
  'mkt.solp.cp.story1Body':
    'Draft complete articles with AI assistance, reusable prompt templates and editorial skills for content style and SEO ranking. Bring your own provider and keep control of models and usage.',
  'mkt.solp.cp.story2Title': 'Every asset, organized.',
  'mkt.solp.cp.story2Body':
    'Upload, organize and reuse images across sites with folders, search and per-site scoping. Storage scales with your plan — from 1 GB on Free to 100 GB on Max.',
  'mkt.solp.cp.story3Title': 'From draft to published, tracked.',
  'mkt.solp.cp.story3Body':
    'The article list is your editorial source of truth: filter tabs for every state, with status and author on every row.',
  'mkt.solp.cp.story3p1': 'Draft, review, scheduled and published states',
  'mkt.solp.cp.story3p2': 'Scheduled publishing on your calendar',
  'mkt.solp.cp.story3p3': 'Author and status visible on every row',
  'mkt.solp.cp.benefit1': 'Publish from one dashboard — no copy-paste between tools',
  'mkt.solp.cp.benefit2': 'Reduce repetitive writing work with prompts and templates',
  'mkt.solp.cp.benefit3': 'Keep SEO checks inside the writing flow, not after it',
  'mkt.solp.cp.benefit4': 'Connect WordPress or any REST CMS and publish directly',
  'mkt.solp.cp.pos1Title': 'The weekly post routine',
  'mkt.solp.cp.pos1Body':
    'Connect your WordPress site once, draft with AI assistance, run the per-page checks, schedule for Friday — and skip the admin work entirely.',
  'mkt.solp.cp.pos2Title': 'One article, every site',
  'mkt.solp.cp.pos2Body':
    'Write once and adapt per site: media from the shared library, per-site SEO targets, and direct publishing to each connected CMS.',
  'mkt.solp.cp.pos3Title': 'From idea backlog to calendar',
  'mkt.solp.cp.pos3Body':
    'Keep every draft in one list with status and author tracking, move them through review, and fill your publishing calendar without spreadsheets.',

  // ---- Solution: SEO & Organic Growth ----
  'mkt.solp.seo.heroTitle': 'SEO you can actually keep up with.',
  'mkt.solp.seo.heroBody':
    'Fourteen technical SEO tools per site — audits, schema, redirects, sitemaps, indexing — with per-page reports and Search Console data in one place.',
  'mkt.solp.seo.introTitle': 'Technical SEO, organized per site.',
  'mkt.solp.seo.introBody':
    'Every connected site gets its own SEO workspace: an audit with a living score, structured data, a redirect engine and indexing status — nothing depends on one specialist remembering.',
  'mkt.solp.seo.step1Title': 'Audit',
  'mkt.solp.seo.step1Body': 'Run a full technical audit per site and work the issue list — missing headings, canonicals, broken links — with a living SEO score.',
  'mkt.solp.seo.step2Title': 'Optimize',
  'mkt.solp.seo.step2Body': 'Set focus keywords per page, fix metadata and schema, and preview social cards before anything ships.',
  'mkt.solp.seo.step3Title': 'Monitor',
  'mkt.solp.seo.step3Body': 'Track sitemap status, robots.txt and Search Console indexing views as content publishes.',
  'mkt.solp.seo.story1Title': 'A living SEO score, not a quarterly PDF.',
  'mkt.solp.seo.story1Body':
    'The overview shows the score, the issues behind it and the status of sitemaps and Search Console connectivity — updated as you fix things.',
  'mkt.solp.seo.story2Title': 'Traffic next to the work.',
  'mkt.solp.seo.story2Body':
    'Visitor trends, content counts and health score sit on the same dashboard as your SEO work — see what ships and what it does.',
  'mkt.solp.seo.story2p1': 'Traffic overview per site',
  'mkt.solp.seo.story2p2': 'Health score and pending actions',
  'mkt.solp.seo.story2p3': 'Recent content at a glance',
  'mkt.solp.seo.benefit1': 'Keep SEO workflows consistent across every site',
  'mkt.solp.seo.benefit2': 'Catch technical issues before they cost you rankings',
  'mkt.solp.seo.benefit3': 'Per-page reports with focus keywords, built into the editor',
  'mkt.solp.seo.benefit4': 'Redirects, schema and sitemaps managed per site',
  'mkt.solp.seo.pos1Title': 'The launch checklist',
  'mkt.solp.seo.pos1Body':
    'Connect a new site, run the first audit, fix the critical issues and submit the sitemap — the same repeatable routine for every launch.',
  'mkt.solp.seo.pos2Title': 'The content refresh cycle',
  'mkt.solp.seo.pos2Body':
    'Use per-page reports to find weak metadata and broken links, fix them in the editor, and republish without leaving Karmax.',
  'mkt.solp.seo.pos3Title': 'Multi-site oversight',
  'mkt.solp.seo.pos3Body':
    'Switch between per-site SEO workspaces to compare scores and issue lists — one place for every domain you manage.',

  // ---- Solution: Content Automation ----
  'mkt.solp.au.heroTitle': 'Put your publishing on autopilot.',
  'mkt.solp.au.heroBody':
    'Build visual automations that trigger on content events — schedule publishing, run SEO checks, send newsletters and notify your team while you sleep.',
  'mkt.solp.au.introTitle': 'Routine work, turned into a system.',
  'mkt.solp.au.introBody':
    'Every automation is a visual workflow: a trigger, a set of steps, and a run history you can audit. No cron jobs, no scripts to babysit.',
  'mkt.solp.au.step1Title': 'Trigger',
  'mkt.solp.au.step1Body': 'Start from content events — a new article, a status change, a schedule — or run on a recurring calendar.',
  'mkt.solp.au.step2Title': 'Act',
  'mkt.solp.au.step2Body': 'Chain steps that publish, check SEO, send newsletters over your SMTP, or fire webhooks to the rest of your stack.',
  'mkt.solp.au.step3Title': 'Monitor',
  'mkt.solp.au.step3Body': 'Every run is logged with status and errors, so you can see what happened and when.',
  'mkt.solp.au.story1Title': 'Visual workflows with a paper trail.',
  'mkt.solp.au.story1Body':
    'Active and completed run counts, plus trigger, status and schedule per automation — the table tells you what ran and what needs a look.',
  'mkt.solp.au.story2Title': 'Scheduled publishing that just happens.',
  'mkt.solp.au.story2Body':
    'Articles move through draft and review on your calendar and publish at the time you set — status and author visible on every row.',
  'mkt.solp.au.story2p1': 'Schedule per article or as a recurring job',
  'mkt.solp.au.story2p2': 'Status tabs from draft to published',
  'mkt.solp.au.story2p3': 'Author and status on every row',
  'mkt.solp.au.benefit1': 'Automate scheduled publishing around the clock',
  'mkt.solp.au.benefit2': 'Reduce repetitive content work with reusable workflows',
  'mkt.solp.au.benefit3': 'Every run logged — a history you can audit',
  'mkt.solp.au.benefit4': 'Newsletters and notifications triggered by content events',
  'mkt.solp.au.pos1Title': 'The morning newsletter',
  'mkt.solp.au.pos1Body':
    'New article published, subscribers get the campaign over your SMTP, and the team is notified. One automation, zero manual steps.',
  'mkt.solp.au.pos2Title': 'The weekly publish slot',
  'mkt.solp.au.pos2Body':
    'A recurring job runs your weekly post at the same slot — with run history proving it happened, every week.',
  'mkt.solp.au.pos3Title': 'Guardrail checks',
  'mkt.solp.au.pos3Body':
    'Trigger checks on every status change so nothing ships without its metadata and focus keywords.',

  // ---- Solution: Multi-Site Management ----
  'mkt.solp.ms.heroTitle': 'Every site you run, one login.',
  'mkt.solp.ms.heroBody':
    'Switch between client sites, personal blogs and side projects instantly — with per-site data isolation, roles and permissions on each.',
  'mkt.solp.ms.introTitle': 'Multi-site without the tab juggling.',
  'mkt.solp.ms.introBody':
    'Each site keeps its own articles, media, SEO workspace and settings. The switcher moves you between them in a click, and plan limits apply per site.',
  'mkt.solp.ms.step1Title': 'Connect',
  'mkt.solp.ms.step1Body': 'Add WordPress or REST CMS sites with the connection verifier — Karmax confirms write access before anything ships.',
  'mkt.solp.ms.step2Title': 'Organize',
  'mkt.solp.ms.step2Body': 'Give each site its own media folders, SEO targets and team roles.',
  'mkt.solp.ms.step3Title': 'Switch',
  'mkt.solp.ms.step3Body': 'Move between sites instantly — data, permissions and settings stay isolated per site.',
  'mkt.solp.ms.story1Title': 'A home screen per site.',
  'mkt.solp.ms.story1Body':
    'Visitors, content counts, health score, pending actions and recent content — one dashboard per site, no mixed data.',
  'mkt.solp.ms.story1p1': 'Per-site dashboards with traffic and content KPIs',
  'mkt.solp.ms.story1p2': 'Data isolation between sites',
  'mkt.solp.ms.story1p3': 'An overview of everything for platform staff',
  'mkt.solp.ms.story2Title': 'Media scoped per site.',
  'mkt.solp.ms.story2Body':
    'Folders, search and per-site scoping keep one site’s assets from bleeding into another — storage tracked against your plan.',
  'mkt.solp.ms.story2p3': 'Storage from 1 GB on Free to 100 GB on Max',
  'mkt.solp.ms.benefit1': 'Manage multiple sites centrally from one dashboard',
  'mkt.solp.ms.benefit2': 'Per-site isolation for data, media and settings',
  'mkt.solp.ms.benefit3': 'Roles and granular permissions per site',
  'mkt.solp.ms.benefit4': 'Unlimited sites on the Max plan',
  'mkt.solp.ms.pos1Title': 'The portfolio publisher',
  'mkt.solp.ms.pos1Body':
    'Five niche sites, one Monday routine: switch, check each dashboard, publish the week’s posts — all before coffee.',
  'mkt.solp.ms.pos2Title': 'Separation by default',
  'mkt.solp.ms.pos2Body':
    'One site’s media never appears in another site’s library — folders and per-site scoping enforce it.',
  'mkt.solp.ms.pos3Title': 'Grow into Max',
  'mkt.solp.ms.pos3Body':
    'Start on Free with three sites and add more as you go — the workspace stays the same.',

  // ---- Solution: Agencies & Teams ----
  'mkt.solp.ag.heroTitle': 'Run every client site from one workspace.',
  'mkt.solp.ag.heroBody':
    'Agencies and teams get per-site isolation, roles and permissions, review workflows and automation — the operational backbone of client publishing.',
  'mkt.solp.ag.introTitle': 'Client work with guardrails.',
  'mkt.solp.ag.introBody':
    'Admins, editors and authors get exactly the permissions they need. Reviews route drafts through the team, and every client’s data stays in its own site workspace.',
  'mkt.solp.ag.step1Title': 'Set up clients',
  'mkt.solp.ag.step1Body': 'Connect each client’s WordPress or REST CMS site and invite the team with roles — admin, editor, author.',
  'mkt.solp.ag.step2Title': 'Run the workflow',
  'mkt.solp.ag.step2Body': 'Drafts move through review with comments and tasks; the calendar keeps publishing predictable.',
  'mkt.solp.ag.step3Title': 'Prove the work',
  'mkt.solp.ag.step3Body': 'Run history, statuses and per-site dashboards show every client what shipped and when.',
  'mkt.solp.ag.story1Title': 'The Monday standup view.',
  'mkt.solp.ag.story1Body':
    'Per-site dashboards with pending actions, traffic and recent content — the numbers you need before the client call.',
  'mkt.solp.ag.story1p1': 'Pending actions and health score per site',
  'mkt.solp.ag.story1p2': 'Traffic overview per site',
  'mkt.solp.ag.story1p3': 'Recent content per site',
  'mkt.solp.ag.story2Title': 'Editorial workflow that scales.',
  'mkt.solp.ag.story2Body':
    'The article list is the team’s shared source of truth — filter by state, with author and status on every row.',
  'mkt.solp.ag.story2p1': 'Draft, review and published states per article',
  'mkt.solp.ag.story2p2': 'Roles and granular page permissions',
  'mkt.solp.ag.story2p3': 'Comment moderation and notifications',
  'mkt.solp.ag.benefit1': 'Manage multiple client sites from one workspace',
  'mkt.solp.ag.benefit2': 'Roles and granular permissions per site',
  'mkt.solp.ag.benefit3': 'Review workflow with comments and tasks',
  'mkt.solp.ag.benefit4': 'Automations for the recurring client work',
  'mkt.solp.ag.pos1Title': 'The client onboarding routine',
  'mkt.solp.ag.pos1Body':
    'Connect the site, set roles, load the media library and schedule the first month — one checklist, one workspace.',
  'mkt.solp.ag.pos2Title': 'Review without the email thread',
  'mkt.solp.ag.pos2Body':
    'Authors submit, editors review the same draft, and comments live next to the content — feedback never scatters.',
  'mkt.solp.ag.pos3Title': 'Recurring deliverables',
  'mkt.solp.ag.pos3Body':
    'Weekly posts per client become scheduled automations; the team reviews output, not logistics.',

  // ---- Solution: Integrations ----
  'mkt.solp.in.heroTitle': 'Connects to the CMS you already use.',
  'mkt.solp.in.heroBody':
    'WordPress natively, any REST CMS through the standard adapter, your own SMTP for email, your own AI keys — Karmax talks to your stack through documented APIs.',
  'mkt.solp.in.introTitle': 'Open platform, no lock-in.',
  'mkt.solp.in.introBody':
    'No proprietary plugin, no export hostage. Connections are verified before use, keys stay yours, and webhooks let the rest of your stack react to content events.',
  'mkt.solp.in.step1Title': 'Connect',
  'mkt.solp.in.step1Body': 'Add WordPress or a REST CMS with API-key authentication and verify write access before publishing.',
  'mkt.solp.in.step2Title': 'Extend',
  'mkt.solp.in.step2Body': 'Plug in your own SMTP server, your AI providers and Akismet for spam protection.',
  'mkt.solp.in.step3Title': 'React',
  'mkt.solp.in.step3Body': 'Outgoing webhooks fire on content events so your other tools stay in sync.',
  'mkt.solp.in.story1Title': 'Your keys, your models.',
  'mkt.solp.in.story1Body':
    'AI providers are configured per workspace — models, keys and usage tracked — so the intelligence stays on your accounts.',
  'mkt.solp.in.story1p1': 'Bring your own AI provider and keys',
  'mkt.solp.in.story1p2': 'Models and usage tracked per provider',
  'mkt.solp.in.story1p3': 'Provider status and latency at a glance',
  'mkt.solp.in.story2Title': 'A documented API surface.',
  'mkt.solp.in.story2Body':
    'WordPress via the native REST client, any standard CMS via the adapter, SMTP for campaigns, Akismet for comments and webhooks for events.',
  'mkt.solp.in.story2p1': 'WordPress REST API client with connection verification',
  'mkt.solp.in.story2p2': 'Standard REST CMS adapter with API-key auth',
  'mkt.solp.in.story2p3': 'Outgoing webhooks for content events',
  'mkt.solp.in.benefit1': 'Connect WordPress or any compatible REST CMS',
  'mkt.solp.in.benefit2': 'Connection verification before anything publishes',
  'mkt.solp.in.benefit3': 'Your own SMTP, AI keys and spam protection',
  'mkt.solp.in.benefit4': 'Outgoing webhooks for content events',
  'mkt.solp.in.pos1Title': 'The WordPress native',
  'mkt.solp.in.pos1Body':
    'Connect via the REST API, verify write access and publish directly — posts, media and metadata land where they belong.',
  'mkt.solp.in.pos2Title': 'Headless or bespoke CMS',
  'mkt.solp.in.pos2Body':
    'The standard REST adapter with API-key auth connects custom stacks — one configuration, the same publishing flow.',
  'mkt.solp.in.pos3Title': 'An event-driven stack',
  'mkt.solp.in.pos3Body':
    'Webhooks notify your chat, CRM or analytics on every publish — Karmax becomes your content event source.',

  // ---- Login page ----
  'mkt.login.title': 'Welcome back.',
  'mkt.login.subtitle': 'Sign in to your Karmax account.',
  'mkt.login.noAccount': 'New to Karmax?',
  'mkt.login.createAccount': 'Create an account',
  'mkt.login.panelTitle': 'One dashboard for every site.',
  'mkt.login.panelBody': 'AI writing, SEO suite, media, newsletter and automation — connected to WordPress or any REST CMS.',

  // ---- Signup / Create Account page ----
  'mkt.signup.title': 'Create your account',
  'mkt.signup.subtitle': 'Start publishing with Karmax',
  // Karmax is the brand this page presents (scoped to signup).
  'mkt.signup.brandName': 'Karmax',
  'mkt.signup.progressLabel': 'Sign-up progress',
  'mkt.signup.stepAccount': 'Create account',
  'mkt.signup.stepPayment': 'Payment',
  'mkt.signup.stepFinish': 'Finish',
  'mkt.signup.googleCta': 'Continue with Google',
  'mkt.signup.orContinueWith': 'Or continue with',
  'mkt.signup.panelTitle': 'Every site you publish, one calm workflow.',
  'mkt.signup.panelBody':
    'Write with AI, optimize for search, and publish to WordPress or any REST CMS — all from a single dashboard built for people who publish.',
  'mkt.signup.cardAiTitle': 'AI Content',
  'mkt.signup.cardAiBody': 'Draft complete articles with AI assistance and reusable prompts.',
  'mkt.signup.cardSeoTitle': 'SEO Suite',
  'mkt.signup.cardSeoBody': 'Audit and optimize every page before it ships.',
  'mkt.signup.cardAutomationTitle': 'Automation',
  'mkt.signup.cardAutomationBody': 'Schedule publishing and routine work that runs itself.',
  'mkt.signup.cardAiHint': 'Continue writing',
  'mkt.signup.cardSeoScore': 'SEO score',
  'mkt.signup.cardSeoKeyword': 'content workflow',
  'mkt.signup.cardAutomationNext': 'Next run · Tue 09:00',
  'mkt.signup.name': 'Full name',
  'mkt.signup.namePlaceholder': 'Your name',
  'mkt.signup.email': 'Email address',
  'mkt.signup.emailPlaceholder': 'you@example.com',
  'mkt.signup.password': 'Password',
  'mkt.signup.passwordPlaceholder': 'Create a password',
  'mkt.signup.confirmPassword': 'Confirm password',
  'mkt.signup.confirmPlaceholder': 'Confirm your password',
  'mkt.signup.reqLength': 'At least 8 characters',
  'mkt.signup.reqUpper': 'One uppercase letter',
  'mkt.signup.reqLower': 'One lowercase letter',
  'mkt.signup.reqNumber': 'One number',
  'mkt.signup.termsPrefix': 'I agree to the',
  'mkt.signup.termsAnd': 'and',
  'mkt.signup.submit': 'Create account',
  'mkt.signup.submitting': 'Creating your account…',
  'mkt.signup.hasAccount': 'Already have an account?',
  'mkt.signup.signIn': 'Sign in',
  'mkt.signup.errName': 'Please enter your name.',
  'mkt.signup.errEmail': 'Please enter a valid email address.',
  'mkt.signup.errPassword': 'Password doesn’t meet the requirements above.',
  'mkt.signup.errMismatch': 'Passwords don’t match.',
  'mkt.signup.errTerms': 'Please accept the Terms of Service and Privacy Policy to continue.',
  'mkt.signup.errEmailExists': 'An account with this email already exists. Try signing in instead.',
  'mkt.signup.errGeneric': 'Couldn’t create your account. Please try again.',
  'mkt.signup.errGoogle':
    'Google sign-in didn’t complete. Please try again, or continue with the form below.',

  // ---- Checkout (payment step of the conversion journey) ----
  'mkt.checkout.title': 'Checkout',
  'mkt.checkout.loading': 'Loading your checkout…',
  'mkt.checkout.planSummary': 'Selected plan',
  'mkt.checkout.changingFrom': 'Changing from {plan}',
  'mkt.checkout.couponLabel': 'Coupon code',
  'mkt.checkout.couponPlaceholder': 'Enter a code',
  'mkt.checkout.applyCoupon': 'Apply',
  'mkt.checkout.removeCoupon': 'Remove',
  'mkt.checkout.couponApplied': 'Code {code} applied',
  'mkt.checkout.couponAtPayment': 'Discount applied at payment',
  'mkt.checkout.couponInvalid': 'This coupon code is not valid for the selected plan.',
  'mkt.checkout.taxNote':
    'Taxes, if applicable, are calculated on the secure payment page. The final amount is confirmed before you pay.',
  'mkt.checkout.payCta': 'Continue to payment',
  'mkt.checkout.paying': 'Redirecting to secure payment…',
  'mkt.checkout.payFailed': 'Payment could not be started.',
  'mkt.checkout.methodCard': 'Card',
  'mkt.checkout.methodApplePay': 'Apple Pay',
  'mkt.checkout.methodGooglePay': 'Google Pay',
  'mkt.checkout.securityNote':
    'Payments are processed securely by Stripe. Karmax never stores your card or payment details.',
  'mkt.checkout.successTitle': 'You’re all set.',
  'mkt.checkout.successBody': 'Your {plan} plan is now active.',
  'mkt.checkout.verifyingTitle': 'Confirming your payment…',
  'mkt.checkout.verifyingBody':
    'We received your payment and are activating your subscription. This usually only takes a few seconds.',
  'mkt.checkout.verifySlow':
    'This is taking longer than expected. Your payment is safe — you can check again or come back later.',
  'mkt.checkout.checkAgain': 'Check again',
  'mkt.checkout.failedTitle': 'Payment not completed',
  'mkt.checkout.failedBody': 'Your payment failed or was cancelled. Your account is safe — nothing was charged.',
  'mkt.checkout.cancelledBody':
    'The payment was cancelled. Your account is safe — you can retry whenever you’re ready.',
  'mkt.checkout.failedNote': 'No paid features were activated.',
  'mkt.checkout.retryPayment': 'Retry payment',
  'mkt.checkout.returnToPlans': 'Return to plans',
  'mkt.checkout.continueDashboard': 'Continue to dashboard',
  'mkt.checkout.alreadyTitle': 'You’re already subscribed',
  'mkt.checkout.alreadyBody': 'Your {plan} plan is already active.',
  'mkt.checkout.internalTitle': 'No checkout needed',
  'mkt.checkout.internalBody': 'Internal accounts have full access without a subscription.',
  'mkt.checkout.missingTitle': 'No plan selected',
  'mkt.checkout.missingBody': 'Choose a plan from the pricing page to continue.',
  'mkt.checkout.signRequired': 'Sign in to continue to checkout.',

  // ---- Final CTA ----
  'mkt.cta.title': 'Ready to publish smarter?',
  'mkt.cta.body': 'Start on the free plan — no credit card, your first three sites included.',
  'mkt.cta.button': 'Start for free',
  'mkt.cta.secondary': 'View pricing',

  // ---- Footer ----
  // (HubSpot-architecture footer: 4-column nav grid with a
  //  two-sub-column Popular Features group, social row between
  //  hairlines, centered logo + copyright + pipe-separated legal
  //  links; active links point at real pages/sections, items
  //  without a destination yet render visually inactive)
  'mkt.footer.navigation': 'Footer',
  'mkt.footer.popularFeatures': 'Popular Features',
  'mkt.footer.allFeatures': 'All Features',
  'mkt.footer.aiWriting': 'AI-Assisted Writing',
  'mkt.footer.seoSuite': 'SEO Suite',
  'mkt.footer.mediaManagement': 'Media Management',
  'mkt.footer.newsletterAutomation': 'Newsletter Automation',
  'mkt.footer.wordpressIntegration': 'WordPress Integration',
  'mkt.footer.restCms': 'REST CMS',
  'mkt.footer.freeTools': 'Free Tools',
  'mkt.footer.websiteSpeedTest': 'Website Speed Test',
  'mkt.footer.headlineAnalyzer': 'Headline Analyzer',
  'mkt.footer.blogPostGenerator': 'Blog Post Generator',
  'mkt.footer.metaTagGenerator': 'Meta Tag Generator',
  'mkt.footer.company': 'Company',
  'mkt.footer.aboutKarmax': 'About Karmax',
  'mkt.footer.careers': 'Careers',
  'mkt.footer.managementTeam': 'Management Team',
  'mkt.footer.investorRelations': 'Investor Relations',
  'mkt.footer.blog': 'Blog',
  'mkt.footer.contactUs': 'Contact Us',
  'mkt.footer.customers': 'Customers',
  'mkt.footer.customerSupport': 'Customer Support',
  'mkt.footer.joinUserGroup': 'Join a Local User Group',
  'mkt.footer.customerStories': 'Customer Stories',
  'mkt.footer.community': 'Community',
  'mkt.footer.userGroups': 'User Groups',
  'mkt.footer.agencies': 'Agencies',
  'mkt.footer.partners': 'Partners',
  'mkt.footer.partnerProgram': 'Partner Program',
  'mkt.footer.findAPartner': 'Find a Partner',
  'mkt.footer.marketplace': 'Marketplace',
  'mkt.footer.legal': 'Legal',
  'mkt.footer.legalCenter': 'Legal Center',
  'mkt.footer.privacy': 'Privacy Policy',
  'mkt.footer.terms': 'Terms of Service',
  'mkt.footer.security': 'Security',
  'mkt.footer.accessibility': 'Website Accessibility',
  'mkt.footer.cookiePrefs': 'Cookie Settings',
  'mkt.footer.social': 'Social media',
  'mkt.footer.socialFacebook': 'Karmax on Facebook',
  'mkt.footer.socialInstagram': 'Karmax on Instagram',
  'mkt.footer.socialYouTube': 'Karmax on YouTube',
  'mkt.footer.socialX': 'Karmax on X (Twitter)',
  'mkt.footer.socialLinkedIn': 'Karmax on LinkedIn',
  'mkt.footer.socialReddit': 'Karmax on Reddit',
  'mkt.footer.socialTikTok': 'Karmax on TikTok',

  // ---- Cookie banner ----
  'mkt.cookie.title': 'Your privacy matters',
  'mkt.cookie.body':
    'We use cookies to keep you signed in, remember your language and theme, and — only with your permission — understand how the site is used. No advertising trackers, ever.',
  'mkt.cookie.accept': 'Accept all',
  'mkt.cookie.reject': 'Reject all',
  'mkt.cookie.customize': 'Customize',
  'mkt.cookie.save': 'Save preferences',
  'mkt.cookie.necessary': 'Strictly necessary',
  'mkt.cookie.necessaryDesc': 'Session, language and theme. Always on — the site doesn’t work without them.',
  'mkt.cookie.analytics': 'Analytics',
  'mkt.cookie.analyticsDesc': 'Anonymous usage statistics that help us improve. Off by default.',
  'mkt.cookie.alwaysOn': 'Always on',
  'mkt.cookie.managePrefs': 'You can change your choice anytime via “Cookie preferences” in the footer.',

  // ---- Common marketing states ----
  'mkt.common.backHome': 'Back to home',
  'mkt.common.notFoundTitle': 'Page not found',
  'mkt.common.notFoundBody': 'The page you’re looking for doesn’t exist or has moved.',
  'mkt.common.errorTitle': 'Something went wrong',
  'mkt.common.explore': 'Learn more',
  'mkt.common.arrow': '→',

  // ---- Legal: privacy ----
  'mkt.privacy.title': 'Privacy Policy',
  'mkt.privacy.updated': 'Last updated',
  'mkt.privacy.intro':
    'This policy explains what Karmax collects, why, and the choices you have. We keep it short and honest.',
  'mkt.privacy.collectTitle': 'What we collect',
  'mkt.privacy.collectBody':
    'Account data you provide (name, email), the content and media you manage in the product, and technical data such as session cookies needed to keep you signed in. With your consent, anonymous usage statistics.',
  'mkt.privacy.whyTitle': 'Why we collect it',
  'mkt.privacy.whyBody':
    'To operate your account, provide the service, keep the platform secure, and — only if you opt in — understand aggregate usage to improve the product.',
  'mkt.privacy.cookiesTitle': 'Cookies',
  'mkt.privacy.cookiesBody':
    'Strictly necessary cookies (session, language, theme) always work. Analytics cookies load only after you accept them in the cookie banner. You can change your choice anytime via “Cookie preferences” in the footer.',
  'mkt.privacy.thirdTitle': 'Third parties',
  'mkt.privacy.thirdBody':
    'Payments are processed by Stripe. If you connect AI providers, your own SMTP server or Akismet, those services receive the data their integration requires. We do not sell data, and we run no advertising trackers.',
  'mkt.privacy.rightsTitle': 'Your rights',
  'mkt.privacy.rightsBody':
    'You can export or delete your content from the dashboard at any time. Deleting your account removes your user data. Contact us for anything else and we will help.',

  // ---- Legal: terms ----
  'mkt.terms.title': 'Terms of Service',
  'mkt.terms.intro':
    'These terms govern your use of Karmax. Plain language, no traps.',
  'mkt.terms.accountTitle': 'Your account',
  'mkt.terms.accountBody':
    'You are responsible for your account credentials and for the content you publish through the platform. Keep your password safe and your API keys private.',
  'mkt.terms.serviceTitle': 'The service',
  'mkt.terms.serviceBody':
    'Karmax provides content management, SEO tooling, media storage, newsletter and automation features per your plan. We may improve or change features; material changes will be announced.',
  'mkt.terms.fairUseTitle': 'Fair use',
  'mkt.terms.fairUseBody':
    'Plan limits (sites, storage, AI usage) are enforced for the health of the platform. Use the service lawfully and respect the sites you connect.',
  'mkt.terms.billingTitle': 'Billing',
  'mkt.terms.billingBody':
    'Paid plans are billed monthly or yearly in CHF through Stripe. You can upgrade, downgrade or cancel anytime from your dashboard; cancellations take effect at the end of the billing period.',
  'mkt.terms.liabilityTitle': 'Liability',
  'mkt.terms.liabilityBody':
    'The service is provided “as is”. We work hard on reliability — backups, monitoring, honest uptime — but we are not liable for indirect damages or lost profits.',

  // ---- Security page ----
  'mkt.security.title': 'Security at Karmax',
  'mkt.security.intro':
    'How we protect your account, your content and your readers’ data — described honestly, based on what the platform actually does today.',
  'mkt.security.accountsTitle': 'Accounts & sign-in',
  'mkt.security.accountsBody':
    'Karmax accounts sign in with an email address and a password, or with Google. Sessions end when you sign out, and you can review your account details from your profile at any time.',
  'mkt.security.dataTitle': 'Data protection',
  'mkt.security.dataBody':
    'Traffic between your browser and Karmax travels over encrypted HTTPS connections. Each site you manage keeps its own content, media and settings inside your workspace, separate from other sites.',
  'mkt.security.backupsTitle': 'Backups & recovery',
  'mkt.security.backupsBody':
    'You can back up a site on demand or on a recurring schedule, download or store archives externally, review a detailed log of every run, and restore a site from a backup when you need to.',
  'mkt.security.auditTitle': 'Audit trail & permissions',
  'mkt.security.auditBody':
    'Important account activity is recorded in the audit log, and access for teammates is controlled per user with roles — so you always know who did what.',
  'mkt.security.reportTitle': 'Responsible disclosure',
  'mkt.security.reportBody':
    'If you believe you have found a security issue in Karmax, please tell us through an official channel listed on this site so we can investigate and fix it. We ask for reasonable time to respond before any public disclosure.',

  // ---- Accessibility page ----
  'mkt.a11y.intro':
    'Our commitment to keeping this website usable by everyone, and how we work toward it.',
  'mkt.a11y.keyboardTitle': 'Keyboard navigation',
  'mkt.a11y.keyboardBody':
    'Every interactive element — links, buttons, menus and forms — can be reached and operated with the keyboard alone, and the focused element is always clearly outlined.',
  'mkt.a11y.motionTitle': 'Reduced motion',
  'mkt.a11y.motionBody':
    'The site honors your operating system’s reduced-motion preference: entrance animations and smooth scrolling are toned down automatically.',
  'mkt.a11y.contrastTitle': 'Readable design',
  'mkt.a11y.contrastBody':
    'We design with a high-contrast text palette on a consistent type scale, and keep testing our color pairs against WCAG AA contrast targets.',
  'mkt.a11y.feedbackTitle': 'Feedback',
  'mkt.a11y.feedbackBody':
    'If anything on this site is hard for you to use, we want to hear about it — tell us through any official Karmax channel and we will do our best to fix it.',

  // ---- Legal Center page ----
  'mkt.legal.intro':
    'Policies and legal information for the Karmax platform, in one place.',

    'mkt.plan.free.desc': 'For getting started — your first sites, the full editor and SEO basics.',
  'mkt.plan.plus.desc': 'For growing bloggers — AI writing and more sites on one account.',
  'mkt.plan.pro.desc': 'For serious publishers — full AI capacity, more storage, every site in one place.',
  'mkt.plan.max.desc': 'For agencies and teams — unlimited sites and maximum storage.',
  'mkt.plan.default.desc': 'Everything included in this plan, managed from your dashboard.',
};
