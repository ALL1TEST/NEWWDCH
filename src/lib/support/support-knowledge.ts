// ============================================================
// KARMAX CMS SUPPORT KNOWLEDGE BASE & SYSTEM PROMPT
// ============================================================
// Provides full contextual expertise on every tool, module,
// setting, integration, and workflow in the Karmax SaaS platform.
// ============================================================

export const KARMAX_SUPPORT_SYSTEM_PROMPT = `
You are the dedicated AI Support Specialist for Karmax CMS (also known as Komax), a modern multi-site headless and hybrid Content Management System.
Your job is to provide clear, actionable, friendly, and step-by-step guidance to users, editors, writers, agencies, and administrators whenever they need help with any tool or feature on the platform.

### Language Capabilities:
- Detect the user's language automatically (English, French, Moroccan Darija, or Arabic) and respond in the same language.
- For Moroccan Darija, use natural Moroccan Darija with clear Latin/Arabic script as requested by the user, providing straightforward practical instructions ("Dir had l-khotwa...", "Mchi l Settings...", etc.).

### Comprehensive Karmax Platform Capabilities & Documentation:

1. **Articles & Content Management** (Navigation: Sidebar -> Articles / \`#content\`):
   - **Creating Content**: Click "Create New" in the top-right header of Articles. Enter Title, write content with TipTap rich editor, set Featured Image, Slug, Excerpt, Category, and Tags in the right sidebar.
   - **Publishing Modes**:
     - *Save Draft*: Saves unreleased changes without publishing.
     - *Publish*: Makes the article live immediately and triggers any active CMS sync / automations.
     - *Schedule*: Set a future publishing date and time.
   - **TipTap Rich Editor**: Supports headings (H1-H6), bullet/numbered lists, quotes, tables, code blocks, media embeds, and drag-and-drop block reordering.
   - **Floating AI Assistant in Editor**: Highlight text or click the AI assistant bar to Generate ideas, Rewrite, Summarize, Fix Grammar, Expand, or Translate.
   - **Categories & Tags**: Managed directly via the "Categories & Tags" modal button in the Articles header (no separate page needed).
   - **Bulk Actions**: Select multiple articles via checkboxes to perform "Set Draft", "Set Published", or "Delete Selected".

2. **Static Pages** (Navigation: Sidebar -> Pages / \`#pages\`):
   - Create and manage standalone pages (e.g. About, Contact, Terms of Service, Privacy Policy, Custom landing pages).
   - Always assigns ContentType = "PAGE".

3. **Connecting Websites & CMS Integrations** (Navigation: Sidebar -> Settings -> CMS Connections / \`#settings\`):
   - **WordPress Integration**:
     - *Step 1*: Go to Settings -> CMS Connections.
     - *Step 2*: Select "WordPress".
     - *Step 3*: Enter the WordPress REST URL (e.g. \`https://example.com\`).
     - *Step 4*: Generate an **Application Password** in WordPress:
       - In WordPress Admin, navigate to Users -> Profile.
       - Scroll down to "Application Passwords".
       - Enter an app name (e.g., "Karmax") and click "Add New Application Password".
       - Copy the generated password.
     - *Step 5*: Enter your WordPress username and the Application Password in Karmax.
     - *Step 6*: Click "Test Connection" and "Save". All published articles will sync automatically!
   - **Custom REST CMS**: Connect any compatible REST CMS by specifying the endpoint and authorization header/token.

4. **SEO Suite & Health Audit** (Navigation: Sidebar -> SEO / \`#seo\`):
   - **SEO Health Score**: Scored from 0 to 100 based on technical and on-page criteria.
   - **Audit Issues & How to Fix**:
     - *Missing H1*: Ensure the article or page has exactly one main Heading 1.
     - *Duplicate Titles*: Open articles sharing the same title and update their titles or meta titles to be distinct.
     - *Missing Canonical*: Set the Canonical URL in the article's SEO tab or site settings to prevent duplicate content penalties.
     - *Redirects (301/302)*: Configure URL redirects in the Redirects tab to prevent 404 errors when moving or renaming URLs.
     - *Robots.txt & Sitemap.xml*: Generated automatically under Technical SEO; can be customized or inspected directly.
   - **On-Page SEO**: In the article sidebar, enter Meta Title, Meta Description, and focus keywords. A Google search snippet preview is displayed in real-time.

5. **AI Suite Configuration** (Navigation: Sidebar -> AI / \`#ai\`):
   - **Providers**: Go to AI -> Providers. Configure API keys for OpenAI, Anthropic Claude, Google Gemini, Groq, NVIDIA NIM, Cloudflare Workers AI, etc.
   - **Models**: In AI -> Models, view discovered models, activate desired ones, and set the default text and vision models.
   - **Marketplace & Prompts**: Access pre-built prompt templates for content creation, SEO generation, social copy, and blog outlining.
   - **Usage & Budget**: Monitor monthly token consumption and set budget alerts under AI Settings.

6. **Editorial Calendar** (Navigation: Sidebar -> Calendar / \`#calendar\`):
   - Visual monthly/weekly calendar view of all scheduled and published articles.
   - Click any date to plan or schedule a new post for that day.

7. **Media Library** (Navigation: Sidebar -> Media / \`#media\`):
   - Upload images, graphics, and assets.
   - Organize assets into folders, add alt text for accessibility and SEO, and search by tag or name.
   - Insert media directly into articles from the editor or set as Featured Image.

8. **Newsletter & Engagement** (Navigation: Sidebar -> Newsletter / Email Templates / Comments):
   - **Subscribers**: Import subscribers via CSV, manage audience lists.
   - **Campaigns**: Compose email newsletters and broadcast to subscriber lists.
   - **Email Templates**: Visual template editor and preview.
   - **SMTP Settings**: Configure your SMTP host (SendGrid, Mailgun, Amazon SES, Google Workspace, custom SMTP), port, user, and password under Email Templates / Settings -> SMTP.
   - **Comments Moderation**: Approve, mark as spam, reply to, or delete comments on your articles.

9. **Multi-Site Management**:
   - The site switcher is located at the top-left of the sidebar (e.g. "Verdant" or "All Sites").
   - Click the site dropdown to switch to another website or select "All Sites" for a unified view.
   - Add new sites from the site selector or under Settings -> Sites.

10. **Users, Roles & Permissions** (Navigation: Sidebar -> Users / \`#users\`):
    - Roles: **Owner**, **Platform Admin**, **Admin**, **Editor**, **Author**, **Contributor**, **Client**.
    - Click "Invite User", provide an email, and assign the appropriate role and site access.

11. **Tasks & Content Workflow** (Navigation: Sidebar -> Tasks / \`#tasks\`):
    - Kanban board tracking editorial workflows: Idea -> In Progress -> Review -> Ready to Publish -> Done.
    - Assign articles and due dates to team members.

12. **Billing, Plans & Subscriptions** (Navigation: Sidebar -> Settings -> Billing / \`#settings/billing\`):
    - Tiers: **Free**, **Plus**, **Pro**, **Max**.
    - Manage subscriptions, upgrade plans, view invoices, and manage payment methods via Stripe.

13. **Backups & Recovery** (Navigation: Sidebar -> Settings -> Backups):
    - Create on-demand full database backups.
    - Set recurring automated backup schedules (daily, weekly) with retention policies and download backups.

### Response Style:
- Always give clear, concise, step-by-step instructions.
- Reference exact sidebar names and button labels so users know exactly where to click.
- Be encouraging, polite, and directly address the user's specific problem.
`;

export interface FallbackTopic {
  keywords: string[];
  titleEn: string;
  responseEn: string;
  titleFr: string;
  responseFr: string;
  titleDarija: string;
  responseDarija: string;
}

export const FALLBACK_TOPICS: FallbackTopic[] = [
  {
    keywords: ['wordpress', 'connect site', 'connect website', 'ربط', 'rabt', 'connecter', 'wp'],
    titleEn: 'How to connect your WordPress site',
    responseEn: `To connect your WordPress website to Karmax:

1. **Navigate to Settings**: Click **Settings** in the left sidebar, then select **CMS Connections** (or **Integrations**).
2. **Select WordPress**: Click on the WordPress card.
3. **Enter Site URL**: Type your website URL (e.g. \`https://yourdomain.com\`).
4. **Generate Application Password in WordPress**:
   - Log into your WordPress Admin.
   - Go to **Users** -> **Profile** (or **All Users** -> Edit your admin account).
   - Scroll down to the **Application Passwords** section.
   - Type a name (e.g. \`Karmax CMS\`) and click **Add New Application Password**.
   - Copy the generated password.
5. **Authenticate in Karmax**:
   - Enter your WordPress **Username** and paste the **Application Password**.
   - Click **Test Connection**. Once verified with a green checkmark, click **Save**.
6. **Publishing**: From now on, whenever you publish an article in Karmax, it will be automatically synced and published to your WordPress site!`,
    titleFr: 'Comment connecter votre site WordPress',
    responseFr: `Pour connecter votre site WordPress à Karmax :

1. **Accédez aux Paramètres** : Cliquez sur **Settings** dans la barre latérale, puis **CMS Connections**.
2. **Sélectionnez WordPress** : Choisissez WordPress dans la liste des intégrations.
3. **Entrez l'URL du site** : Saisissez l'URL de votre site (ex: \`https://votresite.com\`).
4. **Générez un Mot de Passe d'Application dans WordPress** :
   - Connectez-vous à votre panneau WordPress.
   - Allez dans **Utilisateurs** -> **Profil**.
   - Descendez jusqu'à la section **Mots de passe d'application**.
   - Donnez un nom (ex: \`Karmax CMS\`) et cliquez sur **Ajouter un mot de passe**.
   - Copiez le mot de passe affiché.
5. **Validez dans Karmax** :
   - Entrez votre nom d'utilisateur WordPress et collez le mot de passe d'application.
   - Cliquez sur **Test Connection** puis **Save**.
6. Vos articles publiés dans Karmax seront désormais synchronisés directement sur votre WordPress !`,
    titleDarija: 'Kifach trbat l-website dyalk WordPress m3a Karmax',
    responseDarija: `Bach trbat l-website dyalk WordPress m3a Karmax, tba3 had l-khotowat:

1. **Dkhol l Settings**: F l-menu 3la lisr, cliqui 3la **Settings** o khtar **CMS Connections**.
2. **Khtar WordPress**: Cliqui 3la l-bouton dyal WordPress.
3. **Dkhel l-lien dyal l-site**: Kteb l-URL dyal l-website dyalk (mital: \`https://yourdomain.com\`).
4. **Sayb Application Password f WordPress**:
   - Dkhol l-dashboard dyal WordPress dyalk (\`wp-admin\`).
   - Mchi l **Users** -> **Profile**.
   - Hbet l te7t tlqa **Application Passwords**.
   - Kteb smya (bhal \`Karmax CMS\`) o cliqui **Add New Application Password**.
   - Copier hadak l-mot de passe li ghadi i3tik.
5. **Rje3 l Karmax**:
   - Kteb l-Username dyalk f WordPress o coller hadak l-mot de passe.
   - Cliqui 3la **Test Connection**. Mlli itla3 khder, cliqui **Save**.
6. Daba ay m9al nchrtih f Karmax ghadi it-publia direct f l-site WordPress dyalk!`
  },
  {
    keywords: ['publish', 'article', 'post', 'm9al', 'nachr', 'publier', 'create article', 'write'],
    titleEn: 'How to write and publish an article',
    responseEn: `To create and publish an article in Karmax:

1. **Open Articles**: Click **Articles** in the sidebar.
2. **Create New**: Click the **Create New** button in the top right corner.
3. **Title & Content**:
   - Enter your article headline.
   - Write using the rich TipTap editor (supports headings, lists, quotes, tables, and images).
   - Use the **AI Assistant bar** inside the editor to generate ideas, rewrite sections, or fix grammar.
4. **Sidebar Settings** (on the right):
   - **Featured Image**: Upload an image or select from your Media library.
   - **Publishing**: Select category and add tags.
   - **SEO**: Optimize Meta Title and Description with real-time preview.
5. **Publish**: Click **Publish** to publish immediately, **Save Draft** to save your work, or **Schedule** to set a future date and time.`,
    titleFr: 'Comment rédiger et publier un article',
    responseFr: `Pour rédiger et publier un article dans Karmax :

1. **Ouvrez Articles** : Cliquez sur **Articles** dans la barre latérale.
2. **Nouveau contenu** : Cliquez sur le bouton **Create New** en haut à droite.
3. **Rédaction** :
   - Écrivez votre titre et votre texte avec l'éditeur TipTap.
   - Utilisez la barre d'assistance IA pour générer, reformuler ou optimiser votre texte.
4. **Paramètres à droite** :
   - Image à la une (Featured Image).
   - Catégorie et étiquettes (Tags).
   - Optimisation SEO (Titre meta, description).
5. **Publication** : Cliquez sur **Publish** pour mettre en ligne, **Save Draft** pour enregistrer en brouillon, ou **Schedule** pour planifier.`,
    titleDarija: 'Kifach t-kteb o t-publier m9al (Article)',
    responseDarija: `Bach t-kteb o t-publier m9al jdid f Karmax:

1. **Mchi l Articles**: Cliqui 3la **Articles** f l-menu 3la lisr.
2. **Cliqui Create New**: Ghadi tlqa bouton **Create New** lfoq 3la limn.
3. **Kteb l-M9al**:
   - Kteb l-3onwan (Title).
   - Kteb l-mo7tawa f l-editor (TipTap editor fih formatage kaml: headings, sowar, tables).
   - Ila w7lti f l-ktaba, st3mel l-barre dyal **AI Assistant** bach i-generer lik afkar ola i-sahha7 lik l-akhta2.
4. **L-barre dyal limn (Sidebar)**:
   - Khtar **Featured Image** (tswira dyal l-m9al).
   - Khtar **Category** o zid **Tags**.
   - Qad l-**SEO** (Meta title o Description).
5. **Publier**: Cliqui 3la **Publish** bach it-ncher f l-blasa, ola **Save Draft** ila bghiti tkhllih brouillon, ola **Schedule** bach t7dded l-wqt foqach it-ncher!`
  },
  {
    keywords: ['ai', 'configure ai', 'provider', 'api key', 'openai', 'gemini', 'claude', 'tahi2at ai', 'model'],
    titleEn: 'How to configure AI providers and models',
    responseEn: `To configure AI capabilities in Karmax:

1. **Navigate to AI**: Click **AI** in the sidebar.
2. **Open Providers**: Go to **AI** -> **Providers**.
3. **Configure Provider**:
   - Choose your provider (OpenAI, Anthropic Claude, Google Gemini, Groq, NVIDIA, Cloudflare, etc.).
   - Click **Configure / Edit** on the provider card.
   - Paste your API key and click **Save**.
   - Click **Test Connection** to confirm connectivity.
4. **Choose Active Models**:
   - Go to **AI** -> **Models**.
   - Enable the models you want to use (e.g. GPT-4o, Claude 3.5 Sonnet, Llama 3.1).
   - Set your preferred default model for text generation and vision.
5. **AI Features Unlocked**: Once configured, the AI writing assistant in the editor, prompt marketplace, and content generator will be fully active!`,
    titleFr: 'Comment configurer l’IA et les clés API',
    responseFr: `Pour configurer l'intelligence artificielle dans Karmax :

1. **Allez dans AI** : Cliquez sur **AI** dans le menu latéral.
2. **Fournisseurs (Providers)** : Rendez-vous dans **AI** -> **Providers**.
3. **Ajout de la clé API** :
   - Sélectionnez votre fournisseur (OpenAI, Anthropic Claude, Google Gemini, Groq, NVIDIA, etc.).
   - Cliquez sur Configurer et collez votre clé API.
   - Cliquez sur **Test Connection** pour vérifier la connexion.
4. **Sélection des modèles** :
   - Dans **AI** -> **Models**, activez les modèles souhaités et définissez le modèle par défaut.
5. Dès que c'est fait, l'assistant IA dans l'éditeur d'articles et les générateurs automatiques fonctionnent instantanément !`,
    titleDarija: 'Kifach t-configurer l-AI o l-Clés API',
    responseDarija: `Bach t-khddem l-AI f Karmax:

1. **Dkhol l AI**: F l-menu 3la lisr cliqui 3la **AI**.
2. **Mchi l Providers**: Cliqui 3la **Providers**.
3. **Dkhel l-API Key**:
   - Khtar l-Fournisseur li 3ndk fih l-compte (OpenAI, Google Gemini, Claude, Groq, NVIDIA, etc.).
   - Cliqui 3la **Configure** o coller l-API Key dyalk.
   - Cliqui **Test Connection** bach t-t2aked bli khddama mzyan.
4. **Khtar l-Models**:
   - Mchi l **Models**, o ch3el l-model li bghiti tkhddem bih (bhal GPT-4o ola Claude 3.5).
5. Saafi, daba l-assistant AI f l-editor dyal l-m9alat o l-prompts ghadi ikono khddamin 100%!`
  },
  {
    keywords: ['seo', 'audit', 'score', 'h1', 'canonical', 'meta', 'keywords', 'sitemap', 'robots'],
    titleEn: 'How to monitor and fix SEO issues',
    responseEn: `To audit and optimize your site's SEO in Karmax:

1. **Go to SEO Overview**: Click **SEO** in the left sidebar.
2. **Review Health Score**: You'll see your overall SEO Health Score (0-100) and breakdown cards:
   - **Missing H1**: Indicates articles without a primary heading. Open the article and add an H1 title.
   - **Duplicate Titles**: Multiple pages share the same title. Edit them to provide unique, keyword-rich titles.
   - **Missing Canonical**: Set canonical URLs under article SEO settings to avoid search engine duplication penalties.
   - **Redirects**: Click Redirects to set up 301/302 rules for old or broken URLs.
3. **Technical SEO**:
   - Check **Sitemap.xml** status (auto-generated for all published pages).
   - Check **Robots.txt** rules to guide search engines on what to crawl.
4. **Article-Level SEO**: When writing any article, fill out the Meta Title and Meta Description in the right sidebar for optimal Google rankings.`,
    titleFr: 'Comment optimiser le référencement (SEO)',
    responseFr: `Pour surveiller et corriger le SEO dans Karmax :

1. **Ouvrez SEO** : Cliquez sur **SEO** dans le menu de gauche.
2. **Score de santé** : Vous verrez le score global (0-100) et les problèmes détectés :
   - **Missing H1** : Articles sans titre principal H1. Ajoutez un H1 dans l'article.
   - **Duplicate Titles** : Titres dupliqués. Rendez chaque titre unique.
   - **Missing Canonical** : Ajoutez l'URL canonique dans les options SEO de l'article.
   - **Redirects** : Gérez les redirections 301 pour éviter les erreurs 404.
3. **SEO Technique** : Vérifiez que le sitemap.xml et robots.txt sont bien actifs.`,
    titleDarija: 'Kifach t-slah o t-7assen l-SEO dyal l-site',
    responseDarija: `Bach t-qad l-SEO o t-talla3 score dyal l-website dyalk f Karmax:

1. **Dkhol l SEO**: F l-menu 3la lisr cliqui 3la **SEO**.
2. **Chouf l-Health Score**: Ghadi tlqa score dyal l-SEO (0 tal 100) o les cartes dyal l-machakil:
   - **Missing H1**: M9alat ma fihomch titre H1 principal. Dkhol l l-m9al o zido H1.
   - **Duplicate Titles**: 3anawin m3awdin. Bddel les titres bach kol m9al ikoun 3ndo titre unique.
   - **Missing Canonical**: Qad l-lien canonical f l-paramètres SEO dyal l-m9al.
   - **Redirects**: Qad les redirections 301 ila kano 3ndk liens mharbin (404).
3. **Technical SEO**: T2aked bli Sitemap.xml o Robots.txt rahom Active.
4. F ay m9al kat-ktbo, 3mmar Meta Title o Meta Description f l-barre dyal limn bach itla3 mzyan f Google!`
  },
  {
    keywords: ['subscription', 'plan', 'billing', 'stripe', 'upgrade', 'flous', 'prix', 'tarifs', 'pricing', 'abonnements', 'abonnement', 'forfait', 'facturation', 'payer'],
    titleEn: 'How to manage your subscription and upgrade plans',
    responseEn: `To manage your plan or upgrade in Karmax:

1. **Open Billing**: Click your profile avatar at the bottom of the sidebar, or go to **Settings** -> **Billing**.
2. **Current Plan**: View your active tier (Free, Plus, Pro, or Max) along with your monthly limits (connected sites, AI token limits, automation quotas).
3. **Upgrade**:
   - Click **Upgrade Plan** or **Manage Plan**.
   - Choose Monthly or Yearly billing (yearly includes discounted rates).
   - Complete checkout securely via Stripe.
4. **Instant Activation**: Your upgraded quotas (additional sites, higher AI limits) are unlocked immediately after successful payment.`,
    titleFr: 'Comment gérer votre abonnement et changer de forfait',
    responseFr: `Pour gérer votre abonnement ou passer à une formule supérieure :

1. **Accédez à Billing** : Allez dans **Settings** -> **Billing** ou cliquez sur votre profil.
2. **Forfait actuel** : Visualisez votre formule (Free, Plus, Pro, Max) et vos limites d'utilisation.
3. **Changer de plan** : Cliquez sur **Upgrade Plan**, choisissez la facturation mensuelle ou annuelle, et validez via Stripe.
4. Les nouvelles fonctionnalités et limites sont débloquées instantanément.`,
    titleDarija: 'Kifach t-gérer l-Abonnement dyalk o t-dir Upgrade',
    responseDarija: `Bach t-beddel l-Plan dyalk ola t-gérer l-Facturation:

1. **Mchi l Billing**: Cliqui 3la l-profil dyalk lte7t f l-menu, ola mchi l **Settings** -> **Billing**.
2. **Chouf l-Plan l-7ali**: Ghadi tchouf l-Plan dyalk (Free, Plus, Pro, Max) o ch7al baqi lik f les limites (3adad l-websites, AI tokens).
3. **Dir Upgrade**: Cliqui 3la **Upgrade Plan**, khtar chhar ola 3am, o khelles b l-carte bancaire via Stripe b amane.
4. Mlli kat-khlless, les fonctionnalités l-jdidin o les limites zaydin kay-t7ello lik direct f l-blasa!`
  },
  {
    keywords: ['calendar', 'schedule', 'planning', 'waqt', 'jadwal', 'calendrier'],
    titleEn: 'How to use the Editorial Calendar',
    responseEn: `To plan your content with the Calendar:

1. **Open Calendar**: Click **Calendar** in the sidebar.
2. **View Schedule**: See all published and scheduled articles color-coded by date.
3. **Schedule Directly**: Click on any future date to create and schedule an article for that specific day and time.
4. **Reschedule**: Open any scheduled article to adjust its release timestamp.`,
    titleFr: 'Comment utiliser le calendrier éditorial',
    responseFr: `Pour planifier vos publications avec le calendrier :

1. Cliquez sur **Calendar** dans la barre latérale.
2. Visualisez tous vos articles programmés et publiés par date.
3. Cliquez sur n'importe quel jour futur pour créer et planifier un article directement à cette date.`,
    titleDarija: 'Kifach t-kheddem l-Calendrier Editorial',
    responseDarija: `Bach t-nadham l-m9alat dyalk b l-waqt:

1. Cliqui 3la **Calendar** f l-menu 3la lisr.
2. Ghadi tchouf ga3 l-m9alat li deja t-nchro ola li m-planyin b l-alwan 3la 7sab l-iyam.
3. Cliqui 3la ay nhar f l-mostaqbal bach t-dir programmer l-m9al it-ncher fih b d-dabt!`
  },
  {
    keywords: ['media', 'image', 'upload', 'tsawer', 'photos', 'folders', 'bibliothèque'],
    titleEn: 'How to manage the Media Library',
    responseEn: `To manage your images and assets:

1. Click **Media** in the sidebar.
2. **Upload**: Drag and drop images or click **Upload** to add new assets.
3. **Folders**: Organize assets by creating folders (e.g. "Blog Covers", "Logos", "Products").
4. **Alt Text & Details**: Click on any image to inspect its dimensions, URL, and set Alt Text for accessibility and SEO.
5. **In Editor**: When writing an article, insert media directly from your library or set as Featured Image.`,
    titleFr: 'Comment gérer la médiathèque',
    responseFr: `Pour gérer vos images et médias :

1. Cliquez sur **Media** dans la barre latérale.
2. **Téléversement** : Glissez-déposez vos images ou cliquez sur **Upload**.
3. **Dossiers** : Organisez vos fichiers dans des dossiers thématiques.
4. **Alt Text** : Renseignez le texte alternatif pour améliorer votre SEO.`,
    titleDarija: 'Kifach t-gérer l-Media o Tsawer',
    responseDarija: `Bach t-qad tsawer o les fichiers f Karmax:

1. Cliqui 3la **Media** f l-menu 3la lisr.
2. **Upload**: Loe7 tsawer drag-and-drop ola cliqui 3la **Upload**.
3. **Dossiers**: Qad des dossiers bach tnaddem tsawer dyalk (bhal "Logos", "Articles").
4. **Alt Text**: Cliqui 3la ay tswira o kteb liha Alt Text bach i-3awnk f l-SEO dyal Google!
5. F west l-m9al, tqder t-dir insert l ay tswira direct mn l-Media Library.`
  },
  {
    keywords: ['newsletter', 'smtp', 'email', 'subscribers', 'campaign', 'barid'],
    titleEn: 'How to send newsletters and configure SMTP',
    responseEn: `To configure email sending and newsletters:

1. **Configure SMTP**:
   - Go to **Email Templates** (or Settings -> SMTP).
   - Enter your SMTP Host (e.g. SendGrid, Mailgun, Amazon SES, Google Workspace), Port (587 or 465), Username, and Password.
   - Send a test email to verify delivery.
2. **Subscribers**: In **Newsletter** -> Subscribers, import contacts via CSV or manage subscription statuses.
3. **Campaigns**: Click "New Campaign", select your audience list, choose an email template, and send or schedule the broadcast.`,
    titleFr: 'Comment configurer SMTP et envoyer des newsletters',
    responseFr: `Pour envoyer des newsletters et configurer l'email :

1. **Configuration SMTP** : Allez dans **Email Templates** -> Paramètres SMTP, renseignez vos identifiants d'envoi et testez l'envoi.
2. **Abonnés** : Importez vos abonnés par fichier CSV dans la section Newsletter.
3. **Campagnes** : Créez une campagne, rédigez le message et lancez l'envoi.`,
    titleDarija: 'Kifach t-dir Newsletter o t-configurer l-SMTP dyal l-Email',
    responseDarija: `Bach t-sayb Newsletter o t-sefet emails l l-clients:

1. **Qad l-SMTP**:
   - Mchi l **Email Templates** (ola Settings -> SMTP).
   - Dkhel l-Host dyal l-email (bhal SendGrid, Mailgun, Gmail...), Port (587), Username o Mot de passe.
   - Sefet email test bach t2aked bli kay-wsal.
2. **Subscribers**: Dkhol l **Newsletter** o zid les emails dyal l-mouchtarikin (tqder t-telechargi fichier CSV).
3. **Campaigns**: Cliqui New Campaign, khtar l-mo7tawa o sefet l-newsletter l ga3 l-clients dyalk!`
  },
  {
    keywords: ['users', 'roles', 'permissions', 'invite', 'team', 'a3da2', 'membres'],
    titleEn: 'How to manage users and permissions',
    responseEn: `To manage your team in Karmax:

1. Click **Users** in the sidebar.
2. Click **Invite User**.
3. Enter their email address and assign a role:
   - **Admin**: Full operational access across the workspace.
   - **Editor**: Can write, edit, schedule, and publish content.
   - **Author**: Can write and manage their own articles.
   - **Contributor**: Can write drafts for review.
   - **Client**: Restricted view-only access.
4. For multi-site setups, you can restrict specific users to specific client websites.`,
    titleFr: 'Comment gérer les utilisateurs et rôles',
    responseFr: `Pour gérer les membres de votre équipe :

1. Cliquez sur **Users** dans le menu latéral.
2. Cliquez sur **Invite User**.
3. Renseignez l'email et attribuez le rôle approprié (Admin, Editor, Author, Contributor, Client).
4. Définissez à quels sites l'utilisateur a accès.`,
    titleDarija: 'Kifach t-zid l-A3da2 (Users) o t-7dded l-Adwar (Roles)',
    responseDarija: `Bach t-zid nass ikhdmo m3ak f l-ekip:

1. Cliqui 3la **Users** f l-menu 3la lisr.
2. Cliqui 3la **Invite User**.
3. Kteb l-email dyalo o khtar l-Role dyalo:
   - **Admin**: 3ndo ga3 l-sola7iyat.
   - **Editor**: Kay-kteb, i-modifier o i-publier l-m9alat.
   - **Author**: Kay-kteb l-m9alat dyalo bo7do.
   - **Contributor**: Kay-kteb ghir brouillon bach i-checkih l-admin.
4. Tqder t-7dded lih chmen website 3ndo l-7eq idkhl lih!`
  },
  {
    keywords: ['automation', 'webhook', 'workflow', 'automate', 'otomatiki'],
    titleEn: 'How to set up Automations & Webhooks',
    responseEn: `To build automated workflows:

1. Click **Automation** in the sidebar.
2. Click **New Automation**.
3. Select a **Trigger**: (e.g. "When Article is Published", "When Comment is Submitted").
4. Add **Actions**: (e.g. "Send Webhook to Zapier/Make", "Send Email Notification", "Trigger CMS Sync").
5. Test each action and toggle the automation to **Active**.`,
    titleFr: 'Comment créer des automatisations et webhooks',
    responseFr: `Pour créer des flux automatisés :

1. Cliquez sur **Automation** dans la barre latérale.
2. Cliquez sur **New Automation**.
3. Choisissez un déclencheur (ex: publication d'un article) et ajoutez des actions (ex: webhook vers Make/Zapier, email, etc.).
4. Activez l'automatisation.`,
    titleDarija: 'Kifach t-qad Automations o Webhooks',
    responseDarija: `Bach t-qad les automatisations b format visuel:

1. Cliqui 3la **Automation** f l-menu 3la lisr.
2. Cliqui 3la **New Automation**.
3. Khtar l-Trigger (Mital: "Mlli it-ncher chi m9al jdid").
4. Zid l-Action (Mital: "Sefet Webhook l Make/Zapier" ola "Sefet email notification").
5. Ch3el l-bouton dyal Active bach twlli khddama automatiquemen!`
  }
];

export function resolveSupportFallback(query: string, locale: string = 'en'): string {
  const q = query.toLowerCase().trim();

  // Detect language
  const isDarija =
    /[ء-ي]/.test(query) ||
    /\b(kifach|dyal|blan|chi|m3rfch|w7lt|fin|3afak|slah|bach|chno|bghit|khoya|db|wash|fain|hadi)\b/i.test(q);
  const isFr = !isDarija && (locale === 'fr' || /\b(comment|pourquoi|site|faire|publier|connexion|créer|bonjour|merci|forfait)\b/i.test(q));

  // Find best topic match using word boundary checking for short acronyms
  let bestMatch: FallbackTopic | null = null;
  let maxScore = 0;

  function matchesKeyword(text: string, kw: string): boolean {
    if (kw.length <= 3) {
      const reg = new RegExp(`(^|[^a-zA-Z0-9])${kw}([^a-zA-Z0-9]|$)`, 'i');
      return reg.test(text);
    }
    return text.includes(kw.toLowerCase());
  }

  for (const topic of FALLBACK_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (matchesKeyword(q, kw)) {
        score += kw.length;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = topic;
    }
  }

  if (bestMatch && maxScore > 0) {
    if (isDarija) return bestMatch.responseDarija;
    if (isFr) return bestMatch.responseFr;
    return bestMatch.responseEn;
  }

  // General helpful overview fallback
  if (isDarija) {
    return `Marhba bik f Karmax Support! Ana m3ak bach n-3awnk f ay haja w7lti fiha f had l-platform.

Tqder t-sewlni 3la ay blan:
- **Kifach trbat l-website WordPress** dyalk (via Settings -> CMS Connections)
- **Kifach t-kteb o t-publier m9al** b l-AI o l-editor TipTap (Articles -> Create New)
- **Kifach t-configurer l-AI** o t-zid les clés API (AI -> Providers)
- **Kifach t-slah machakil l-SEO** (Missing H1, Duplicates, Redirects)
- **Kifach t-gérer l-Media o Tsawer** (Media Library)
- **Kifach t-zid l-ekip dyalk** (Users & Permissions)
- **Kifach t-dir upgrade l l-plan dyalk** (Settings -> Billing)

Kteb lia b d-dabt chno l-mouchkil li wq3 lik o ana n-3tik l-7all khotwa b khotwa!`;
  }

  if (isFr) {
    return `Bonjour et bienvenue sur Karmax Support ! Je suis là pour vous aider à maîtriser l'ensemble de la plateforme.

Vous pouvez me poser des questions sur :
- **Connecter un site WordPress ou REST CMS** (Settings -> CMS Connections)
- **Rédiger et publier des articles** avec l'éditeur TipTap et l'IA (Articles -> Create New)
- **Configurer l'IA et vos clés API** (AI -> Providers & Models)
- **Optimiser le score SEO** et corriger les erreurs (SEO Overview)
- **Planifier du contenu** (Calendar)
- **Gérer votre abonnement et facturation** (Settings -> Billing)

Dites-moi simplement quel est votre besoin ou sur quelle étape vous bloquez, et je vous guiderai pas à pas !`;
  }

  return `Hello and welcome to Karmax Support! I am here to help you solve any issue or learn how to use any tool across the entire platform.

Here are popular guides you can ask me about:
- **Connecting your website / WordPress**: Go to **Settings -> CMS Connections** and authenticate using an Application Password.
- **Publishing an article**: Head to **Articles -> Create New** to write, format with TipTap, use AI assistance, and publish.
- **Configuring AI**: Navigate to **AI -> Providers** to add your OpenAI, Claude, or Gemini API keys.
- **Fixing SEO issues**: Open **SEO** to audit your health score, fix missing H1s, duplicate titles, and sitemaps.
- **Managing team members**: Go to **Users -> Invite User** and set granular roles.
- **Billing & Subscriptions**: Access **Settings -> Billing** to manage plans and payment.

Please tell me what tool or workflow you need assistance with, and I will walk you through it step-by-step!`;
}
