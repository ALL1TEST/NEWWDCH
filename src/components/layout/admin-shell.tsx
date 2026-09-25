'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSiteStore } from '@/lib/stores/site-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/brand';
import { MarketingSite } from '@/components/marketing/marketing-site';
import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { readPlanSelection, clearPlanSelection, isCheckoutHash } from '@/lib/checkout/plan-selection';
import { AppSidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from '@/components/patterns/command-palette';
import { SupportPanel } from './support-panel';
import { SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

// Marketing hash segments (the unauthenticated tree's routes).
// NOTE: 'privacy' is deliberately NOT listed — the Privacy Policy is
// a PUBLIC page rendered by the marketing tree for EVERYONE (see
// isPrivacyHash below): unauthenticated visitors AND authenticated
// users (the account menu's Help → Privacy action opens #/privacy in
// a NEW TAB). Keeping it out of this redirect list is what lets a
// logged-in #/privacy load render the PUBLIC policy page instead of
// bouncing to the dashboard.
const MARKETING_HASHES = [
  'pricing', 'blog', 'about', 'solutions', 'login', 'signup', 'terms', 'features',
];

// '#/privacy' (or Chromium-normalized '#privacy') — the PUBLIC
// Privacy Policy route. Unlike the MARKETING_HASHES segments (which
// redirect authenticated users into the dashboard), the privacy hash
// ALWAYS renders the marketing tree: AdminShell gates on it BEFORE
// mounting any dashboard chrome, so the page shows the public
// Karmax frontend layout (marketing header/footer) with no CMS
// sidebar, topbar or account menu — for authenticated users too.
function isPrivacyHash(hash: string): boolean {
  return hash.replace(/^#\/?/, '').split(/[/?#]/)[0] === 'privacy';
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isCheckingAuth, checkAuth } = useAuthStore();
  const initializeSites = useSiteStore((s) => s.initialize);
  const isSiteInitialized = useSiteStore((s) => s.isInitialized);
  const mainRef = useRef<HTMLElement>(null);

  const currentModule = useNavigationStore((s) => s.currentModule);
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const currentItemId = useNavigationStore((s) => s.currentItemId);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [currentModule, currentSubPage, currentItemId]);

  // Invalidate all queries when the ACTIVE SITE changes, so site-scoped
  // data (dashboard stats, content, media, etc.) refetches with the new
  // siteId. Without this, creating a new site + auto-switching to it leaves
  // the dashboard showing the previously-active site's data until a manual
  // reload. The store updates `window.__CMS_ACTIVE_SITE_DB_ID__` (which the
  // api-client reads to inject `?siteId=`), but no query is re-triggered.
  // Guard: only fire on a real site→site switch, not during initial
  // bootstrap (null → siteId), to avoid a redundant refetch on first load.
  const queryClient = useQueryClient();
  const activeSiteDbId = useSiteStore((s) => s.activeSiteDbId);
  const prevSiteRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (
      prevSiteRef.current !== undefined &&
      prevSiteRef.current !== activeSiteDbId
    ) {
      queryClient.invalidateQueries();
    }
    prevSiteRef.current = activeSiteDbId;
  }, [activeSiteDbId, queryClient]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // ---- Public Privacy Policy route (#/privacy) ----
  // The Privacy Policy is a PUBLIC frontend page: #/privacy renders
  // the marketing tree (MarketingSite) for authenticated users too —
  // the account menu's Help → Privacy action opens it in a NEW
  // browser tab (target="_blank"), and that tab must show the public
  // layout with NO CMS chrome. The new tab shares the session
  // cookie, so authentication alone cannot be the gate — the hash
  // itself is. Tracked lazily at mount + via hashchange, exactly
  // like the checkout-route tracking below.
  const [isPublicPrivacyRoute, setIsPublicPrivacyRoute] = useState(() =>
    typeof window === 'undefined' ? false : isPrivacyHash(window.location.hash),
  );
  useEffect(() => {
    const read = () => setIsPublicPrivacyRoute(isPrivacyHash(window.location.hash));
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  // ---- Checkout route tracking (#/checkout) ----
  // The payment step of the pricing → signup/login → payment →
  // dashboard journey renders as its OWN CHROME (no dashboard
  // sidebar) while the user is authenticated. Reads the hash lazily
  // at mount (covers the Stripe return / Google next=checkout full
  // page loads) and follows hashchange afterwards. Accepts both
  // "#/checkout" and "#checkout" (Chromium normalization).
  const [isCheckoutRoute, setIsCheckoutRoute] = useState(() =>
    typeof window === 'undefined' ? false : isCheckoutHash(window.location.hash),
  );
  useEffect(() => {
    const read = () => setIsCheckoutRoute(isCheckoutHash(window.location.hash));
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  // When the session flips to authenticated while a marketing hash
  // (e.g. #/signup from the Create Account page, or #/login) is
  // still in the address bar, the navigation store would otherwise
  // treat that marketing segment as a module name (breadcrumb
  // "signup", module-router fallback). Redirect the store to the
  // default module — navigate() also canonicalizes the URL via
  // replaceState, which fires no hashchange, so no loop is possible.
  // Runs ONLY when authenticated; the marketing site (unauthenticated)
  // keeps full control of its own hashes.
  //
  // CONVERSION JOURNEY: when a PAID plan was selected on the pricing
  // page, the just-created / just-logged-in account continues to the
  // checkout step instead of the dashboard (the dashboard is reached
  // after verified payment — or immediately for free selections).
  useEffect(() => {
    if (!isAuthenticated) return;
    const firstSeg = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
    if (firstSeg === 'checkout') return; // the checkout route owns itself
    if (MARKETING_HASHES.includes(firstSeg)) {
      const selection = readPlanSelection();
      if (selection && !selection.isFree) {
        // Paid journey → payment step. The hash assignment updates the
        // URL, and the synthetic hashchange fires the checkout-route
        // listener SYNCHRONOUSLY (listeners run inline) so no stray
        // dashboard frame renders before CheckoutFlow takes over. The
        // browser's own (async) hashchange re-fires the same idempotent
        // listener afterwards — harmless.
        window.location.hash = '#/checkout';
        window.dispatchEvent(new Event('hashchange'));
      } else {
        // Free (or no) selection → the journey ends at the dashboard.
        if (selection) clearPlanSelection();
        useNavigationStore.getState().navigate('dashboard');
      }
      // The marketing site owns document.title while unauthenticated —
      // restore the product default so no stale "Create your account"
      // / "Log in" title follows the user into the dashboard.
      document.title = `${SITE_NAME} — ${SITE_TAGLINE}`;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && !isSiteInitialized) {
      initializeSites();
    }
  }, [isAuthenticated, isSiteInitialized, initializeSites]);

  if (isCheckingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!isAuthenticated || isPublicPrivacyRoute) {
    // PUBLIC MARKETING SITE — the unauthenticated surface is the
    // full marketing website (home / pricing / blog / about /
    // solutions / legal) with the login experience at #/login
    // (the LoginScreen itself is embedded there, auth logic
    // untouched). On successful login the auth store flips and
    // this shell re-renders into the dashboard below.
    //
    // #/privacy renders this SAME public tree for AUTHENTICATED
    // users (new tab opened by the account menu's Help → Privacy
    // action — the dashboard stays open in the original tab): the
    // isPublicPrivacyRoute gate above mounts the marketing site
    // instead of the dashboard shell, so the public Privacy Policy
    // shows the Karmax frontend layout with no CMS chrome.
    return <MarketingSite />;
  }

  if (isCheckoutRoute) {
    // CHECKOUT — the payment step of the conversion journey, with
    // its own chrome (no dashboard sidebar/topbar). Reached after
    // signup/login with a paid plan selected, or directly from the
    // Stripe / Google redirects. Renders INSTEAD of the dashboard
    // tree; leaving it (dashboard / billing) restores the shell.
    return <CheckoutFlow />;
  }

  return (
    // Canonical shadcn shell contract: the provider is viewport-clamped
    // (h-svh + overflow-hidden). Do NOT relax it to h-auto/overflow-visible —
    // that lets this wrapper (and the in-flow [data-slot=sidebar] peer)
    // stretch to full page height on short viewports, so transparent box of
    // stretched rows ends up under the footer utility cluster and hijacks
    // its clicks (avatar "not responding" bug).
    <SidebarProvider>
      {/* Inner row must not outgrow the clamped wrapper; main becomes the
          scroll container so tall pages still scroll — just internally,
          exactly like every standard shadcn dashboard layout. */}
      <div className="flex h-full w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Topbar />
          <main
            ref={mainRef}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto flex flex-col",
              currentModule === 'media' ? "p-0" : "px-6 pb-6 pt-4"
            )}
          >
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
      {/* Help / Support floating panel — opened from the account
          menu's "Help → Help Center" action (global support-panel
          store, same pattern as the CommandPalette above). Mounted
          once, over the dashboard. */}
      <SupportPanel />
    </SidebarProvider>
  );
}
