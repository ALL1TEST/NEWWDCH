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
  'mkt.blog.eyebrow': 'The Blog',
  'mkt.blog.heroTitle': 'Insights, strategies & ideas for better content',
  'mkt.blog.heroSubtitle': 'Practical insights on content creation, SEO, AI, automation, and growing a modern digital business.',
  'mkt.blog.metaDescription': 'Practical articles on content creation, SEO, AI, automation and growing a modern digital business — from the Karmax team.',
  'mkt.blog.searchLabel': 'Search articles',
  'mkt.blog.searchPlaceholder': 'Search articles, topics and guides…',
  'mkt.blog.categories': 'Categories',
  'mkt.blog.all': 'All',
  'mkt.blog.featured': 'Featured',
  'mkt.blog.readMore': 'Read article',
  'mkt.blog.readingTime': '{minutes} min read',
  'mkt.blog.backToBlog': 'Back to blog',
  'mkt.blog.by': 'By',
  'mkt.blog.latest': 'Latest articles',
  'mkt.blog.viewAll': 'View all',
  'mkt.blog.loadMore': 'Load more',
  'mkt.blog.editorsPicks': 'Editor’s picks',
  'mkt.blog.exploreTopics': 'Explore by topic',
  'mkt.blog.articleCount': '{count} articles',
  'mkt.blog.articleCountOne': '{count} article',
  'mkt.blog.resultsFor': 'Results for “{query}”',
  'mkt.blog.clearSearch': 'Clear search',
  'mkt.blog.noResultsTitle': 'No matching articles',
  'mkt.blog.noResultsBody': 'Try a different search or clear the active filters.',
  'mkt.blog.related': 'Continue reading',
  'mkt.blog.recent': 'Recent articles',
  'mkt.blog.aboutAuthor': 'About the author',
  'mkt.blog.newsletterTitle': 'Get better content ideas in your inbox',
  'mkt.blog.newsletterBody': 'Weekly insights on SEO, AI, content strategy and automation. No spam — unsubscribe anytime.',
  'mkt.blog.newsletterPlaceholder': 'you@example.com',
  'mkt.blog.newsletterCta': 'Subscribe',
  'mkt.blog.newsletterSuccess': 'Subscribed — welcome aboard.',
  'mkt.blog.newsletterError': 'Subscription failed. Please try again.',
  'mkt.blog.emptyTitle': 'Fresh insights are on the way',
  'mkt.blog.emptyBody': 'We’re preparing practical guides, strategies and ideas to help you create and grow better content.',
  'mkt.blog.emptyCta': 'Explore resources',
  'mkt.blog.loading': 'Loading articles…',
  'mkt.blog.error': 'Couldn’t load articles. Please try again.',
  'mkt.blog.updated': 'Updated',
  'mkt.blog.toc': 'On this page',
  'mkt.blog.breadcrumb': 'Breadcrumb',
  'mkt.blog.sidebarCtaTitle': 'Try Karmax for free',
  'mkt.blog.sidebarCtaBody': 'Create, optimize and publish content from one calm workspace.',
  'mkt.blog.sidebarCtaButton': 'Get started',

  // ---- About ----
  'mkt.about.eyebrow': 'About',
  'mkt.about.heroTitle': 'Our mission.',
  'mkt.about.missionHead': 'One calm workflow for everything you publish.',
  'mkt.about.missionLead':
    'Karmax exists because the way teams publish is broken — writing in one app, SEO in another, publishing by copy-paste. So we built one calm workflow for all of it.',
  'mkt.about.studioAlt':
    'A calm office lounge with orange armchairs and a large “CALM” letter installation on a wooden slat wall',
  'mkt.about.rowMissionTitle': 'Our mission: one calm platform for people who publish.',
  'mkt.about.rowMissionBody1':
    'Give every person who publishes — solo bloggers, agencies, publishers, businesses — one calm, honest platform for the whole content workflow: writing, media, SEO, engagement and automation.',
  'mkt.about.rowMissionBody2':
    'We only win when your workflow gets calmer. Your content lives in your CMS and your sites stay yours — Karmax manages and publishes, it never holds your work hostage.',
  'mkt.about.teamAlt': 'A small team collaborating around a desk in a warm studio workspace',
  'mkt.about.rowStoryTitle': 'Our story',
  'mkt.about.rowStoryBody1':
    'The tools were all there, but never together. Writing lived in one app, SEO in another, media in a third — and publishing happened by copy-paste. So we built the workflow itself: an editor, a full SEO suite, a media library, a newsletter and automations, connected in one product that talks to the sites you already run.',
  'mkt.about.rowStoryBody2':
    'Today Karmax is a multi-tenant platform: you connect your sites — WordPress via its REST API or any CMS with a standard REST endpoint — and manage content, media, SEO, comments and newsletters per site from one dashboard. Roles and permissions mirror real editorial teams, and automations handle the routine parts.',
  'mkt.about.believeTitle': 'What we believe',
  'mkt.about.believe1Title': 'Simplicity',
  'mkt.about.believe1Body': 'A calm interface, sensible defaults and zero gratuitous animations. The work is the hero, not the UI.',
  'mkt.about.believe2Title': 'Automation',
  'mkt.about.believe2Body': 'Scheduling, distribution and publishing should run on their own — so you can stay focused on the writing.',
  'mkt.about.believe3Title': 'Quality',
  'mkt.about.believe3Body': 'What the marketing says is what the product does. No fake urgency, no dark patterns, no invented numbers.',
  'mkt.about.believe4Title': 'Control',
  'mkt.about.believe4Body': 'Your content lives in your CMS. Documented REST integrations and your own keys — leave anytime, nothing to export.',
  'mkt.about.customersTitle': 'What our customers say',
  'mkt.about.customersBody': 'Stories from the people who publish with Karmax — in their own words.',
  'mkt.about.demoBadge': 'Demo',
  'mkt.about.demoName': 'Sample customer',
  'mkt.about.demoRole': 'Role or title',
  'mkt.about.demoCompany': 'Company',
  'mkt.about.demoQuote1':
    'A real customer’s story will appear here — their exact words about publishing with Karmax, never edited, never invented.',
  'mkt.about.demoQuote2':
    'Each testimonial pairs the customer’s photo with their name, role and company, so readers always know who is speaking.',
  'mkt.about.demoQuote3':
    'Stories rotate one at a time in this carousel — browse with the arrows, the dots or a swipe on touch screens.',
  'mkt.about.demoQuote4':
    'These slides are sample content. When customers share their experiences, their real stories replace this demo completely.',
  'mkt.about.carouselLabel': 'Customer testimonials',
  'mkt.about.carouselPrev': 'Previous testimonial',
  'mkt.about.carouselNext': 'Next testimonial',
  'mkt.about.carouselGoTo': 'Go to testimonial',

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
  'mkt.solp.videoPlayer': 'Product demo video',
  'mkt.solp.play': 'Play',
  'mkt.solp.pause': 'Pause',
  'mkt.solp.mute': 'Mute',
  'mkt.solp.unmute': 'Unmute',
  'mkt.solp.volume': 'Volume',
  'mkt.solp.speed': 'Playback speed',
  'mkt.solp.settings': 'Settings',
  'mkt.solp.qualityShort': 'Quality',
  'mkt.solp.qualityAuto': 'Auto',
  'mkt.solp.fullscreen': 'Enter fullscreen',
  'mkt.solp.exitFullscreen': 'Exit fullscreen',
  'mkt.solp.seek': 'Seek',
  'mkt.solp.storiesTitle': 'Inside the product',
  // Minimal story eyebrow labels — small uppercase section identifiers.
  'mkt.solp.label.content': 'Content',
  'mkt.solp.label.media': 'Media',
  'mkt.solp.label.workflow': 'Workflow',
  'mkt.solp.label.seo': 'SEO',
  'mkt.solp.label.automation': 'Automation',
  'mkt.solp.label.scheduling': 'Scheduling',
  'mkt.solp.label.sites': 'Sites',
  'mkt.solp.label.teams': 'Teams',
  'mkt.solp.label.aiProviders': 'AI providers',
  'mkt.solp.label.integrations': 'Integrations',
  'mkt.solp.benefitsTitle': 'What you get',
  'mkt.solp.usecasesTitle': 'Built for the way you publish',
  'mkt.solp.usecasesSubtitle': 'Whatever you publish, the workflow stays calm.',
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

  // ---- Solution: SEO & Organic Growth ----
  'mkt.solp.seo.heroTitle': 'SEO you can actually keep up with.',
  'mkt.solp.seo.heroBody':
    'Fourteen technical SEO tools per site — audits, schema, redirects, sitemaps, indexing — with per-page reports and Search Console data in one place.',
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

  // ---- Solution: Content Automation ----
  'mkt.solp.au.heroTitle': 'Put your publishing on autopilot.',
  'mkt.solp.au.heroBody':
    'Build visual automations that trigger on content events — schedule publishing, run SEO checks, send newsletters and notify your team while you sleep.',
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

  // ---- Solution: Multi-Site Management ----
  'mkt.solp.ms.heroTitle': 'Every site you run, one login.',
  'mkt.solp.ms.heroBody':
    'Switch between client sites, personal blogs and side projects instantly — with per-site data isolation, roles and permissions on each.',
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

  // ---- Solution: Agencies & Teams ----
  'mkt.solp.ag.heroTitle': 'Run every client site from one workspace.',
  'mkt.solp.ag.heroBody':
    'Agencies and teams get per-site isolation, roles and permissions, review workflows and automation — the operational backbone of client publishing.',
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

  // ---- Solution: Integrations ----
  'mkt.solp.in.heroTitle': 'Connects to the CMS you already use.',
  'mkt.solp.in.heroBody':
    'WordPress natively, any REST CMS through the standard adapter, your own SMTP for email, your own AI keys — Karmax talks to your stack through documented APIs.',
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
  // (4-section footer: Product · Integrations | Features ·
  //  Resources nav grid with a vertical center divider, social
  //  row between hairlines, centered logo + copyright +
  //  pipe-separated legal links; active links point at real
  //  pages/sections, items without a destination yet render
  //  visually inactive)
  'mkt.footer.navigation': 'Footer',
  'mkt.footer.product': 'Product',
  'mkt.footer.integrations': 'Integrations',
  'mkt.footer.features': 'Features',
  'mkt.footer.resources': 'Resources',
  'mkt.footer.aiContent': 'AI Content',
  'mkt.footer.seoSuite': 'SEO Suite',
  'mkt.footer.mediaLibrary': 'Media Library',
  'mkt.footer.newsletter': 'Newsletter',
  'mkt.footer.analytics': 'Analytics',
  'mkt.footer.sites': 'Sites',
  'mkt.footer.anyRestCms': 'Any REST CMS',
  'mkt.footer.smtp': 'SMTP',
  'mkt.footer.blog': 'Blog',
  'mkt.footer.documentation': 'Documentation',
  'mkt.footer.helpCenter': 'Help Center',
  'mkt.footer.freeTools': 'Free Tools',
  'mkt.footer.guides': 'Guides',
  'mkt.footer.apiDeveloper': 'API / Developer',
  'mkt.footer.legal': 'Legal',
  'mkt.footer.privacy': 'Privacy Policy',
  'mkt.footer.terms': 'Terms of Service',
  // Used by the legal pages / document titles — not the footer row.
  'mkt.footer.security': 'Security',
  'mkt.footer.accessibility': 'Website Accessibility',
  'mkt.footer.legalCenter': 'Legal Center',
  'mkt.footer.cookiePrefs': 'Cookie Preferences',
  'mkt.footer.rightsReserved': 'All rights reserved.',
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
    'Your privacy is important to us. This Privacy Policy explains what information we collect, how we use it, how we protect it, and the choices available to you.',
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

  // ---- Legal: privacy — long-form public page ----
  // The 20-section production privacy policy rendered by
  // components/marketing/privacy-page.tsx. Blocks are keyed
  // s<N>{Title,P#,H#,L#} (title / paragraph / subheading / list
  // item) and composed by the page's section table. Paragraph and
  // list strings may embed {tokens} (rendered as links/buttons by
  // the page) and [bracketed placeholders] (styled so the legal
  // team can find and replace them — never invent these facts).
  'mkt.privacy.effectiveAsOf': 'Effective as of',
  'mkt.privacy.metaDescription':
    'Learn how Karmax collects, uses, protects, and manages personal information.',
  'mkt.privacy.onThisPage': 'On this page',
  'mkt.privacy.manageCookies': 'Manage cookie preferences',
  'mkt.privacy.questions': 'Questions about this Privacy Policy?',
  'mkt.privacy.contactEmailLabel': 'Email',
  'mkt.privacy.contactCompanyLabel': 'Company',
  'mkt.privacy.contactAddressLabel': 'Address',
  'mkt.privacy.contactCta': 'Contact us',

  'mkt.privacy.s1Title': 'Scope of this Privacy Policy',
  'mkt.privacy.s1P1':
    'This Privacy Policy applies to the Karmax website, applications and hosted service (together, the “Service”) operated by [Company Legal Name] (“we”, “us”, “our”). It describes how we handle personal information when you browse our website, create an account or use the Service.',
  'mkt.privacy.s1P2':
    'It does not apply to services operated by third parties. When you connect an integration — such as an AI provider, your own SMTP server or Akismet — that service handles information under its own privacy policy. Your use of the Service in general is governed by our {terms}.',

  'mkt.privacy.s2Title': 'What Information Do We Collect?',
  'mkt.privacy.s2P1':
    'The information we handle depends on how you use the Service. In general, it falls into two categories.',
  'mkt.privacy.s2H1': 'Personally identifiable information',
  'mkt.privacy.s2P2':
    'Information that identifies you as an individual — for example your name and email address, the content and media you manage in the product, and communications you send us.',
  'mkt.privacy.s2H2': 'Non-personally identifiable information',
  'mkt.privacy.s2P3':
    'Information that is not linked to a specific identity on its own — for example technical session data and, only with your consent, anonymous usage statistics.',

  'mkt.privacy.s3Title': 'Why Do We Collect Personal Data?',
  'mkt.privacy.s3P1':
    'We collect and use personal information to operate your account, to provide and maintain the Service, to keep the platform secure, and — only if you opt in — to understand aggregate usage so we can improve the product.',
  'mkt.privacy.s3P2':
    'We do not sell your personal information, and we do not run advertising trackers.',

  'mkt.privacy.s4Title': 'Information You Provide Directly',
  'mkt.privacy.s4P1':
    'You give us certain information directly when you use the Service:',
  'mkt.privacy.s4L1':
    'Account information — your name and email address when you create an account, and the credentials you use to sign in.',
  'mkt.privacy.s4L2':
    'Content — the articles, media and settings you create and manage in the product.',
  'mkt.privacy.s4L3':
    'Communications — information you include when you contact us or respond to our messages.',
  'mkt.privacy.s4P2':
    'When you upgrade to a paid plan, billing information is handled by our payment provider — see {serviceProviders} below.',

  'mkt.privacy.s5Title': 'Information We Collect Automatically',
  'mkt.privacy.s5P1':
    'When you use the Service, some information is collected automatically:',
  'mkt.privacy.s5L1':
    'Technical information — data such as your session, which is needed to keep you signed in, and your language and theme preferences.',
  'mkt.privacy.s5L2':
    'Usage information — with your consent, anonymous statistics about how features are used, which help us improve the product.',
  'mkt.privacy.s5P2':
    'We do not use advertising or cross-site tracking cookies.',

  'mkt.privacy.s6Title': 'Information We Receive From Other Sources',
  'mkt.privacy.s6P1':
    'We do not purchase personal information from data brokers, and we do not collect it from third-party sources for our own purposes.',
  'mkt.privacy.s6P2':
    'When you connect an integration — an AI provider, your own SMTP server or Akismet — we may receive the limited information the integration returns in order to work, such as delivery or spam-check results for the content you send through it.',

  'mkt.privacy.s7Title': 'How We Use Your Information',
  'mkt.privacy.s7P1': 'We use the information described in this policy to:',
  'mkt.privacy.s7L1': 'Operate your account and keep you signed in securely.',
  'mkt.privacy.s7L2': 'Provide, maintain and improve the Service.',
  'mkt.privacy.s7L3': 'Process payments for paid plans, through our payment provider.',
  'mkt.privacy.s7L4': 'Keep the platform and your account secure, including through the audit trail.',
  'mkt.privacy.s7L5': 'Understand — only with your consent — aggregate, anonymous usage of the product.',
  'mkt.privacy.s7L6': 'Respond to your requests and communicate with you about your account or the Service.',
  'mkt.privacy.s7P2':
    'We do not use your information to profile you for advertising, and we do not sell it.',

  'mkt.privacy.s8Title': 'Cookies and Similar Technologies',
  'mkt.privacy.s8P1':
    'The Service uses a small number of cookies and similar browser technologies:',
  'mkt.privacy.s8L1':
    'Strictly necessary cookies — session, language and theme. These are always on; the site cannot work without them.',
  'mkt.privacy.s8L2':
    'Analytics — anonymous usage statistics. These load only after you accept them in the cookie banner, and they are off by default.',
  'mkt.privacy.s8P2':
    'We do not set advertising or tracking cookies at any time.',
  'mkt.privacy.s8P3':
    'You can change your choice at any time: {cookiePrefs}.',

  'mkt.privacy.s9Title': 'When Do We Disclose Information to Third Parties?',
  'mkt.privacy.s9P1':
    'We disclose personal information to third parties only in the limited situations described in this policy:',
  'mkt.privacy.s9L1':
    'Service providers that help us operate the Service (see {serviceProviders}).',
  'mkt.privacy.s9L2': 'Legal requirements (see {legalRequirements}).',
  'mkt.privacy.s9L3': 'Business transfers (see {businessTransfers}).',
  'mkt.privacy.s9P2': 'We never sell your personal information.',

  'mkt.privacy.s10Title': 'Service Providers',
  'mkt.privacy.s10P1':
    'We rely on a small number of third-party providers to operate the Service:',
  'mkt.privacy.s10L1':
    'Payments — paid plans are billed through Stripe, which processes your payment information under its own policies.',
  'mkt.privacy.s10L2':
    'Integrations you connect — if you connect an AI provider, your own SMTP server or Akismet, those services receive the data their integration requires to work.',
  'mkt.privacy.s10P2':
    'We share with these providers only what is necessary for the task at hand.',

  'mkt.privacy.s11Title': 'Legal Requirements',
  'mkt.privacy.s11P1':
    'We may disclose information if we are required to do so by applicable law, legal process or a valid request from a public authority, or when we believe it is necessary to protect the rights, property or safety of our users, the Service or others.',

  'mkt.privacy.s12Title': 'Business Transfers',
  'mkt.privacy.s12P1':
    'If we are involved in a merger, acquisition or sale of assets, your information may be transferred as part of that transaction. We will let you know before your information is transferred or becomes subject to a different policy, and we will tell you about the choices available to you.',

  'mkt.privacy.s13Title': 'Affiliates',
  'mkt.privacy.s13P1':
    'We do not currently share your personal information with affiliated companies for their own purposes. If that ever changes, this Privacy Policy will be updated to say so.',

  'mkt.privacy.s14Title': 'Data Retention',
  'mkt.privacy.s14P1':
    'We keep personal information only as long as necessary for the purposes described in this policy and to operate the Service — for example, while your account is active.',
  'mkt.privacy.s14P2':
    'You can export or delete your content from the dashboard at any time, and deleting your account removes your user data. When information is no longer needed, we remove it, except where we are legally required to keep it or while backup copies are rotated out over time.',

  'mkt.privacy.s15Title': 'Data Security',
  'mkt.privacy.s15P1':
    'We use reasonable technical and organizational measures designed to protect information from unauthorized access, loss, misuse or disclosure.',
  'mkt.privacy.s15P2':
    'Traffic between your browser and the Service travels over encrypted HTTPS connections, important account activity is recorded in an audit log, and access for teammates is controlled per user with roles. You can read more on our {security} page.',

  'mkt.privacy.s16Title': 'International Data Transfers',
  'mkt.privacy.s16P1':
    'Your information may be processed in countries other than your own. When that happens, we take measures to help ensure it receives a comparable level of protection, in line with applicable legal requirements.',
  'mkt.privacy.s16P2':
    'Specific processing locations and transfer mechanisms: [to be completed by the legal team].',

  'mkt.privacy.s17Title': 'Your Privacy Rights',
  'mkt.privacy.s17P1':
    'Depending on your location and applicable law, you may have some of the following rights over your personal information:',
  'mkt.privacy.s17L1': 'Access — to know what information we hold about you.',
  'mkt.privacy.s17L2': 'Correction — to ask us to correct inaccurate information.',
  'mkt.privacy.s17L3': 'Deletion — to ask us to delete your information.',
  'mkt.privacy.s17L4': 'Data portability — to receive a copy of your information in a usable format.',
  'mkt.privacy.s17L5': 'Restriction — to ask us to limit how we use your information.',
  'mkt.privacy.s17L6': 'Objection — to object to certain uses.',
  'mkt.privacy.s17L7': 'Consent withdrawal — to withdraw a consent you have given, for example for analytics cookies.',
  'mkt.privacy.s17P2':
    'Independently of where you live, the product gives you direct control: you can export or delete your content from the dashboard at any time, and deleting your account removes your user data. For anything else, contact us and we will help.',

  'mkt.privacy.s18Title': 'Children’s Privacy',
  'mkt.privacy.s18P1':
    'The Service is not directed to children, and we do not knowingly collect personal information from children.',
  'mkt.privacy.s18P2':
    'If you believe a child has provided us with personal information, please contact us and we will take appropriate steps to delete it.',

  'mkt.privacy.s19Title': 'Changes to This Privacy Policy',
  'mkt.privacy.s19P1':
    'We may update this Privacy Policy from time to time. The “Effective as of” date at the top of this page always reflects the current version.',
  'mkt.privacy.s19P2':
    'If we make material changes, we will notify you — for example with a notice on this page or through your account. We encourage you to review this page periodically.',

  'mkt.privacy.s20Title': 'Contact Us',
  'mkt.privacy.s20P1':
    'If you have questions about this Privacy Policy or our privacy practices, please contact us.',

  // ---- Legal: terms — long-form public page ----
  // The 23-section Terms of Service rendered by
  // components/marketing/terms-page.tsx (through the shared
  // LegalPageLayout in legal-document.tsx — the same system as
  // the Privacy Policy page). Blocks are keyed s<N>{Title,P#,H#,L#}
  // (title / paragraph / subheading / list item). Paragraph and
  // list strings may embed {tokens} (rendered as links by the
  // page) and [bracketed placeholders] (styled so the legal team
  // can find and replace them — never invent these facts).
  'mkt.terms.title': 'Terms of Service',
  'mkt.terms.effectiveAsOf': 'Effective as of',
  'mkt.terms.metaDescription':
    'Read the Terms of Service that govern your access to and use of the Karmax service.',
  'mkt.terms.onThisPage': 'On this page',
  'mkt.terms.questions': 'Questions about these Terms?',
  'mkt.terms.contactEmailLabel': 'Email',
  'mkt.terms.contactCompanyLabel': 'Company',
  'mkt.terms.contactCta': 'Contact us',
  'mkt.terms.intro':
    'These Terms of Service govern your access to and use of the Karmax service. By accessing or using the Service, you agree to be bound by these Terms.',

  'mkt.terms.s1Title': 'Acceptance of Terms',
  'mkt.terms.s1P1':
    'These Terms of Service (these “Terms”) govern your access to and use of the Karmax website, applications and hosted service (together, the “Service”) operated by [Company Legal Name] (“we”, “us”, “our”). By accessing or using the Service, you agree to be bound by these Terms and by our {privacy}, which is incorporated into these Terms by reference.',
  'mkt.terms.s1P2':
    'If you do not agree to these Terms, you should not access or use the Service.',
  'mkt.terms.s1P3':
    'If you use the Service on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms. In that case, “you” and “your” refer to that organization.',

  'mkt.terms.s2Title': 'Eligibility and Account',
  'mkt.terms.s2P1':
    'You may use the Service only if you are able to form a binding contract with us and are not barred from doing so under applicable law. [Minimum age and eligibility requirements — to be completed.]',
  'mkt.terms.s2P2':
    'To use the Service you create an account, signing in with an email address and a password, or with Google. You agree to provide accurate, current and complete information when you create your account, and to keep it up to date.',
  'mkt.terms.s2P3':
    'You are responsible for safeguarding your password and other credentials, for keeping your API keys private, and for all activity that occurs under your account. If you suspect unauthorized access to your account, contact us.',
  'mkt.terms.s2P4':
    'You can invite teammates to your workspace; their access is controlled per user with roles. You are responsible for the people you invite and for the permissions you grant them.',

  'mkt.terms.s3Title': 'The Service',
  'mkt.terms.s3P1':
    'Karmax is a content management platform. Depending on your plan, the Service provides content management, SEO tooling, media storage, newsletter and automation features, backups, and related functionality for the sites you manage.',
  'mkt.terms.s3P2':
    'The Service evolves continually. We may add, change or remove features, and the functionality available to you depends on the plan you choose and the limits that apply to it.',
  'mkt.terms.s3P3':
    'We may impose plan limits — such as the number of sites, storage, or AI usage — for the health of the platform and the quality of the Service. The plans and their limits are described on our {pricing} page.',

  'mkt.terms.s4Title': 'Subscriptions and Billing',
  'mkt.terms.s4H1': 'Plans and Pricing',
  'mkt.terms.s4P2':
    'We offer the plans and pricing described on our {pricing} page. What a plan includes — its features and limits — depends on the plan you select.',
  'mkt.terms.s4H2': 'Billing',
  'mkt.terms.s4P3':
    'Paid plans are billed on a monthly or yearly basis through Stripe, our payment provider. The price and billing period are shown to you at checkout before you confirm a purchase. [Billing terms — currency, invoicing and taxes — to be completed.]',
  'mkt.terms.s4H3': 'Automatic Renewal',
  'mkt.terms.s4P4':
    'Paid plans renew automatically at the end of each billing period, using the payment method on file, unless you cancel before the renewal date.',
  'mkt.terms.s4H4': 'Cancellation',
  'mkt.terms.s4P5':
    'You can upgrade, downgrade or cancel your subscription at any time from your dashboard. Cancellation takes effect at the end of the current billing period; the subscription then stops renewing.',
  'mkt.terms.s4H5': 'Refunds',
  'mkt.terms.s4P6':
    '[Refund Policy — to be completed.] If you believe you have been charged in error, please contact us.',
  'mkt.terms.s4H6': 'Price Changes',
  'mkt.terms.s4P7':
    'We may change our prices from time to time. Changes that affect an existing subscription will be communicated to you before they take effect. [Notice period — confirm business policy.]',

  'mkt.terms.s5Title': 'Free Trials',
  'mkt.terms.s5P1':
    'From time to time we may offer free trials or promotional access to parts of the Service. When a trial is offered, its conditions — including its duration and what happens when it ends — are shown to you before you start it.',
  'mkt.terms.s5P2':
    'Unless stated otherwise, trials are provided for evaluation, and these Terms — including the Acceptable Use section — apply to them in the same way as to paid use.',

  'mkt.terms.s6Title': 'Acceptable Use',
  'mkt.terms.s6P1':
    'You may use the Service only for lawful purposes and in accordance with these Terms. In connection with your use of the Service, you must not:',
  'mkt.terms.s6L1':
    'Break the law — use the Service in violation of any applicable law or regulation, or in a way that infringes the rights of others.',
  'mkt.terms.s6L2':
    'Gain unauthorized access — access accounts, data or systems that are not yours, or circumvent authentication, security controls or plan limits.',
  'mkt.terms.s6L3':
    'Distribute malware — upload, transmit or distribute malicious code, viruses or similar harmful software.',
  'mkt.terms.s6L4':
    'Attack the Service — interfere with, overload or disrupt the Service, its infrastructure or other users, including through excessive automated requests where prohibited.',
  'mkt.terms.s6L5':
    'Probe or reverse engineer — probe, scan or test the vulnerability of the Service, or reverse engineer it where prohibited by applicable law.',
  'mkt.terms.s6L6':
    'Abuse others — use the Service to harass, threaten or defame others, or to distribute spam.',
  'mkt.terms.s6L7':
    'Circumvent enforcement — deliberately work around plan limits, enforcement measures or the intended use of the Service.',
  'mkt.terms.s6P2':
    'We may enforce these rules, and plan limits, to protect the platform and its users.',

  'mkt.terms.s7Title': 'User Content',
  'mkt.terms.s7P1':
    'The content you create, upload or manage through the Service — such as articles, media and settings — remains yours, subject to the rights of others and to applicable law. We do not claim ownership of your content.',
  'mkt.terms.s7P2':
    'To provide the Service, you grant us the permissions the Service needs: to host, store, process, transmit and display your content, and to back it up, in each case solely as needed to operate and provide the Service for you.',
  'mkt.terms.s7P3':
    'You are responsible for the content you submit, including for having the rights needed to use it. You can export or delete your content from the dashboard at any time.',

  'mkt.terms.s8Title': 'Intellectual Property',
  'mkt.terms.s8P1':
    'The Service — including its software, website, branding, design, documentation and underlying technology — is owned by [Company Legal Name] and its licensors and is protected by intellectual property laws.',
  'mkt.terms.s8P2':
    'Access to the Service gives you the right to use it under these Terms. It does not transfer ownership of the software, the platform or any of its components to you, and nothing in these Terms grants you a license to our trademarks.',

  'mkt.terms.s9Title': 'Third-Party Services',
  'mkt.terms.s9P1':
    'The Service supports integrations with third-party services — for example AI providers you connect, your own SMTP server, or Akismet. When you connect an integration, it receives the data it needs to work, and your use of that service is governed by its own terms and policies.',
  'mkt.terms.s9P2':
    'We do not control third-party services and are not responsible for their actions or availability. Payments for paid plans are processed by Stripe under its own terms.',

  'mkt.terms.s10Title': 'AI Features',
  'mkt.terms.s10P1':
    'Parts of the Service include AI features — such as AI assistance for writing — subject to the limits of your plan. When you use them, you provide the input, and the Service returns generated output.',
  'mkt.terms.s10P2':
    'AI-generated output may be incomplete, inaccurate or unsuitable for your purpose. You should review any output before relying on it or publishing it.',
  'mkt.terms.s10P3':
    'You are responsible for how you use AI-generated content, including for making sure it complies with these Terms, applicable law and the rights of others.',
  'mkt.terms.s10P4':
    'AI features may rely on platform-provided models or on AI providers you connect. [AI providers and models — list or link the current providers.]',

  'mkt.terms.s11Title': 'Privacy',
  'mkt.terms.s11P1':
    'Your use of the Service is also subject to our {privacy}, which explains how we collect, use and protect personal information.',

  'mkt.terms.s12Title': 'Security',
  'mkt.terms.s12P1':
    'We use reasonable technical and organizational measures designed to protect the Service and its data — such as encrypted HTTPS connections, an audit log of important account activity, per-user roles for teammates, and backups you can run on demand or on a schedule.',
  'mkt.terms.s12P2':
    'No method of transmission or storage is completely secure, and we cannot guarantee absolute security. You can read more on our {security} page.',

  'mkt.terms.s13Title': 'Service Availability',
  'mkt.terms.s13P1':
    'We aim to provide a reliable Service and work on it — with backups, monitoring and honest communication. Even so, the Service may occasionally be unavailable, for example for maintenance, updates, outages or events outside our reasonable control.',
  'mkt.terms.s13P2':
    'We do not promise a specific availability level. [Uptime commitment, if any — to be completed.]',

  'mkt.terms.s14Title': 'Suspension and Termination',
  'mkt.terms.s14P1':
    'You can stop using the Service at any time. You can export or delete your content from the dashboard, and deleting your account removes your user data. [Data retention period after termination — confirm business policy.]',
  'mkt.terms.s14P2':
    'We may suspend or restrict access to the Service, in whole or in part, if we reasonably believe these Terms have been violated, that an account is being used unlawfully, for non-payment of amounts due, or for security or legal reasons.',
  'mkt.terms.s14P3':
    'We may terminate these Terms and close an account for the same reasons, with notice where reasonable. Provisions of these Terms that by their nature are intended to survive termination continue to apply.',

  'mkt.terms.s15Title': 'Disclaimers',
  'mkt.terms.s15P1':
    'The Service is provided on an “as is” and “as available” basis, to the fullest extent permitted by applicable law. Except as expressly stated in these Terms, we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose and non-infringement.',
  'mkt.terms.s15P2':
    'We do not warrant that the Service will be uninterrupted, error-free, completely secure or always available, and we make no representation about the accuracy or reliability of AI-generated output.',

  'mkt.terms.s16Title': 'Limitation of Liability',
  'mkt.terms.s16P1':
    'To the fullest extent permitted by applicable law, we will not be liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue or data, arising from or relating to your use of the Service.',
  'mkt.terms.s16P2':
    'Our aggregate liability for direct damages arising out of or relating to these Terms is limited to: [Liability cap — insert the approved amount or formula]. Nothing in these Terms limits liability that cannot be limited under applicable law.',

  'mkt.terms.s17Title': 'Indemnification',
  'mkt.terms.s17P1':
    'You agree to indemnify and hold us harmless from claims, damages and expenses (including reasonable legal costs) arising from your use of the Service, your content, or your violation of these Terms or applicable law, to the extent permitted by law.',
  'mkt.terms.s17P2':
    '[Insert approved indemnification language — scope, procedures and exceptions to be confirmed by the legal team.]',

  'mkt.terms.s18Title': 'Changes to the Service',
  'mkt.terms.s18P1':
    'The Service evolves over time. We may add, change or remove features, adjust plan limits, or modify how parts of the platform work.',
  'mkt.terms.s18P2':
    'Material changes to the Service will be announced. [Announcement channel — confirm business policy.]',

  'mkt.terms.s19Title': 'Changes to These Terms',
  'mkt.terms.s19P1':
    'We may update these Terms from time to time. The “Effective as of” date at the top of this page always reflects the current version.',
  'mkt.terms.s19P2':
    'If we make material changes, we will notify you — for example with a notice on this page or through your account. Continuing to use the Service after a change means you accept the updated Terms. [Notice period — confirm business policy.]',

  'mkt.terms.s20Title': 'Governing Law',
  'mkt.terms.s20P1':
    'These Terms, and any disputes arising out of or relating to them, are governed by: [Governing law and jurisdiction — to be completed.]',

  'mkt.terms.s21Title': 'Dispute Resolution',
  'mkt.terms.s21P1':
    'If a dispute arises between you and us in connection with the Service, we encourage you to contact us first so that we can try to resolve it informally.',
  'mkt.terms.s21P2':
    '[Dispute-resolution mechanism — to be completed by the legal team.]',

  'mkt.terms.s22Title': 'General Provisions',
  'mkt.terms.s22H1': 'Severability',
  'mkt.terms.s22P1':
    'If a provision of these Terms is found unenforceable, the remaining provisions stay in effect, and the unenforceable provision is replaced by an enforceable one that comes closest to its intent.',
  'mkt.terms.s22H2': 'Waiver',
  'mkt.terms.s22P2':
    'Our failure to enforce a provision of these Terms is not a waiver of it. A waiver is effective only if we give it in writing.',
  'mkt.terms.s22H3': 'Assignment',
  'mkt.terms.s22P3':
    'You may not assign these Terms or transfer your account without our prior written consent. We may assign these Terms, for example in connection with a merger, acquisition or sale of assets.',
  'mkt.terms.s22H4': 'Entire Agreement',
  'mkt.terms.s22P4':
    'These Terms, together with our {privacy} and any additional terms that apply to features you use, form the entire agreement between you and us regarding the Service.',
  'mkt.terms.s22H5': 'Force Majeure',
  'mkt.terms.s22P5':
    'We are not responsible for delays or failures caused by events outside our reasonable control.',

  'mkt.terms.s23Title': 'Contact Us',
  'mkt.terms.s23P1':
    'If you have questions about these Terms, please contact us.',

  // ---- Legal: security — long-form public page ----
  // The security page in 17 sections, rendered by
  // components/marketing/security-page.tsx (via the shared
  // LegalPageLayout of legal-document.tsx — the same system as
  // the privacy policy and the terms of service). Keys
  // s<N>{Title,P#,H#,L#}. Strings may embed {tokens} (rendered
  // as links by the page) and [bracketed placeholders] (styled so
  // the security/legal team can find and replace them — never
  // invent these facts).
  'mkt.security.title': 'Security',
  'mkt.security.lastUpdated': 'Last updated',
  'mkt.security.metaDescription':
    'Learn how Karmax protects your data, secures its infrastructure, and maintains the reliability and integrity of its services.',
  'mkt.security.onThisPage': 'On this page',
  'mkt.security.questions': 'Questions about security?',
  'mkt.security.contactEmailLabel': 'Email',
  'mkt.security.contactCta': 'Contact us',
  'mkt.security.intro':
    'Learn how we protect your data, secure our infrastructure, and maintain the reliability and integrity of our services.',

  'mkt.security.s1Title': 'Security Overview',
  'mkt.security.s1P1':
    'This page describes how we protect the information you entrust to Karmax and how we work to keep the Service secure. Security is an ongoing process: we build features carefully, review them regularly, and improve them over time.',
  'mkt.security.s1P2':
    'We describe our practices honestly and in plain language. Where a detail depends on an operational or organizational policy that has not been finalized, we mark it as a bracketed placeholder rather than stating it as fact.',
  'mkt.security.s1P3':
    'Nothing on this page is a contractual commitment. Our {terms} govern your use of the Service, and our {privacy} explains how we collect and process personal data.',

  'mkt.security.s2Title': 'Infrastructure Security',
  'mkt.security.s2P1':
    'Karmax is a hosted service: the application, its database and its media storage run on server infrastructure operated for the Service. [Hosting and infrastructure details — to be completed.]',
  'mkt.security.s2P2':
    'Access to the infrastructure that runs the Service is limited to the people who need it to operate and maintain the service. [Infrastructure access policy — confirm details.]',

  'mkt.security.s3Title': 'Data Encryption',
  'mkt.security.s3H1': 'Encryption in Transit',
  'mkt.security.s3P1':
    'Traffic between your browser and the Service travels over encrypted HTTPS connections.',
  'mkt.security.s3H2': 'Encryption at Rest',
  'mkt.security.s3P2':
    'Data you store in the Service — content, media and settings — is kept in the Service’s database and media storage. [Encryption at rest — confirm implementation details before publishing.]',

  'mkt.security.s4Title': 'Access Controls',
  'mkt.security.s4P1':
    'Access inside Karmax is controlled per user. When you invite teammates to your workspace, you decide who joins, and the permissions of each teammate are controlled by the role assigned to them.',
  'mkt.security.s4P2':
    'Roles follow the principle of least privilege: each user receives only the access needed for their work, and each site you manage keeps its own content, media and settings inside your workspace, separate from other sites.',
  'mkt.security.s4P3':
    'You can review your account details from your profile at any time, and important account activity is recorded in the audit log — so you always know who did what.',

  'mkt.security.s5Title': 'Authentication',
  'mkt.security.s5P1':
    'Karmax accounts sign in with an email address and a password. Sessions end when you sign out.',
  'mkt.security.s5P2':
    'You can change your password at any time from your profile in the dashboard, and you can review your account details there. Multi-factor authentication is not currently offered; if this changes, this page will be updated.',
  'mkt.security.s5P3':
    'If you suspect that someone else has accessed your account, change your password and contact us.',

  'mkt.security.s6Title': 'Application Security',
  'mkt.security.s6P1':
    'The Service is built as a modern web application, and access to its features is checked against the signed-in user and their role before any action is performed.',
  'mkt.security.s6P2':
    'Features that accept user input — forms, editors, file uploads and API endpoints — validate the data they receive before processing it, and errors are reported clearly instead of failing silently.',
  'mkt.security.s6P3':
    '[Secure development practices, dependency management and security testing — to be completed.]',

  'mkt.security.s7Title': 'Network Security',
  'mkt.security.s7P1':
    'All traffic between your browser and the Service travels over encrypted HTTPS connections. The Service is not accessible through any other public channel.',
  'mkt.security.s7P2':
    '[Additional network protections — confirm what is deployed before publishing.]',

  'mkt.security.s8Title': 'Data Protection',
  'mkt.security.s8P1':
    'The content, media and site settings you create belong to your account and workspace. Each site keeps its own data, separate from other sites you manage.',
  'mkt.security.s8P2':
    'You can export your data, and you can delete sites and content from your workspace when you no longer need them. Backups (see Backups and Recovery below) help you restore a site when something goes wrong.',
  'mkt.security.s8P3':
    'For details on how we collect and process personal data, see our {privacy}.',

  'mkt.security.s9Title': 'Backups and Recovery',
  'mkt.security.s9P1':
    'You can back up a site on demand or on a recurring schedule, download or store archives externally, review a detailed log of every run, and restore a site from a backup when you need to.',
  'mkt.security.s9P2':
    '[Backup and recovery details — confirm operational policy.]',

  'mkt.security.s10Title': 'Monitoring and Logging',
  'mkt.security.s10P1':
    'Important account activity is recorded in the audit log, so that activity in your workspace can be reviewed after the fact.',
  'mkt.security.s10P2':
    '[System monitoring, error monitoring and log retention practices — to be completed.]',

  'mkt.security.s11Title': 'Incident Response',
  'mkt.security.s11P1':
    'If a security incident affects the Service, our priorities are to understand it, limit its impact and fix it.',
  'mkt.security.s11H1': 'Detection',
  'mkt.security.s11P2':
    'Incidents can come to our attention through logs, through the audit trail, or through reports from users and security researchers — see Reporting a Security Issue below.',
  'mkt.security.s11H2': 'Investigation',
  'mkt.security.s11P3':
    'We investigate alerts and reports to understand what happened and which accounts or data, if any, are affected.',
  'mkt.security.s11H3': 'Containment',
  'mkt.security.s11P4':
    'When an issue is confirmed, we work to contain it — for example by fixing the underlying problem or removing access that should not exist.',
  'mkt.security.s11H4': 'Remediation',
  'mkt.security.s11P5':
    'Once contained, we fix the cause and review related areas of the application to help prevent recurrence.',
  'mkt.security.s11H5': 'Notification',
  'mkt.security.s11P6':
    'If we confirm that an incident has affected your account or data, we will notify you. [Notification commitments and timelines — to be completed.]',

  'mkt.security.s12Title': 'Third-Party Services',
  'mkt.security.s12P1':
    'The Service relies on a small number of third-party providers for specific functions: payment processing (Stripe), AI-powered features (our AI provider), outbound email (SMTP) and spam checking (Akismet). Each provider processes only the data needed to perform its function.',
  'mkt.security.s12P2':
    'For more information, see the Service Providers section of our {privacy}.',

  'mkt.security.s13Title': 'Employee Security',
  'mkt.security.s13P1':
    'Access to customer data by the people who operate the Service is limited to what is needed to run, support and improve it.',
  'mkt.security.s13P2':
    '[Employee security practices — background checks, training and policies — to be completed.]',

  'mkt.security.s14Title': 'Availability and Reliability',
  'mkt.security.s14P1':
    'We work to keep the Service available and to fix problems that affect it. Backups and the ability to restore a site help you recover your content when something goes wrong.',
  'mkt.security.s14P2':
    'We do not promise a specific uptime percentage on this page. [Service level commitments — to be completed if offered.]',

  'mkt.security.s15Title': 'Security Responsibilities',
  'mkt.security.s15P1':
    'Security is a shared effort — you play an important role in keeping your account and content safe:',
  'mkt.security.s15L1':
    'Protect your credentials — Keep your password secret and do not share it with anyone.',
  'mkt.security.s15L2':
    'Use strong passwords — Choose passwords that are unique and hard to guess.',
  'mkt.security.s15L3':
    'Keep access information confidential — Treat API keys and other access credentials with the same care as your password.',
  'mkt.security.s15L4':
    'Report suspicious activity — If you notice something unexpected in your account or in the Service, tell us.',
  'mkt.security.s15L5':
    'Maintain appropriate access permissions — Review the teammates and permissions in your workspace, and remove access that is no longer needed.',
  'mkt.security.s15P2':
    'For the responsibilities that apply to your account under our agreement, see our {terms}.',

  'mkt.security.s16Title': 'Reporting a Security Issue',
  'mkt.security.s16P1':
    'If you believe you have discovered a security vulnerability, please contact our security team using the contact information below.',
  'mkt.security.s16P2': 'Security contact: [Security Email]',
  'mkt.security.s16P3':
    'Please include a description of the issue and, where possible, the steps to reproduce it. We ask for reasonable time to investigate and fix the issue before any public disclosure.',
  'mkt.security.s16P4':
    'Please do not test vulnerabilities against accounts or data that are not your own.',

  'mkt.security.s17Title': 'Contact Us',
  'mkt.security.s17P1':
    'If you have questions about our security practices, please contact our team.',

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
