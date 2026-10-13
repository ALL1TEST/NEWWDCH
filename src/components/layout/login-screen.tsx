'use client';

import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useT } from '@/lib/i18n';

// Quick Sign-in demo accounts — each button performs a REAL one-click
// sign-in through the existing auth-store login() (POST /api/auth/login,
// session cookie, then the account's OWN dashboard). The credentials are
// the SAME seeded demo users the normal email/password form accepts
// (src/lib/platform/bootstrap.ts + src/lib/seed.ts) — three SEPARATE
// account types, each with its own identity, session, dashboard and
// profile:
//   • Admin                 → admin@example.com (ADMIN role → Admin
//                             User client CMS dashboard)
//   • Platform Admin (Staff)→ platform@example.com (OWNER role →
//                             Platform Admin dashboard)
//   • Internal Account      → internal@example.com — the DEDICATED
//                             INTERNAL-role account (internal SaaS
//                             account of the platform team) → its OWN
//                             Internal Account dashboard. NOT the same
//                             account as Platform Admin.
// No duplicate users or auth logic — all three authenticate through the
// single existing /api/auth/login flow.
// The Editor / Author demo users still exist and remain reachable via
// the normal email/password form — only their quick buttons are removed.
// i18n: each entry carries labelKey; the label resolves through t() so
// the quick buttons follow the selected language (English fallback for
// locales without auth.* translations).
const QUICK_ACCOUNTS = [
  { labelKey: 'auth.accountAdmin', email: 'admin@example.com', password: 'admin123', accent: false },
  { labelKey: 'auth.accountPlatformAdmin', email: 'platform@example.com', password: 'platform123', accent: true },
  { labelKey: 'auth.accountInternal', email: 'internal@example.com', password: 'internal123', accent: true },
] as const;

// Translated quick-account label (identity for the pending spinner).
const quickLabel = (a: (typeof QUICK_ACCOUNTS)[number], t: (k: string) => string) => t(a.labelKey);

export function LoginScreen({ embedded = false }: { embedded?: boolean }) {
  const login = useAuthStore((s) => s.login);
  const verifyMfaLogin = useAuthStore((s) => s.verifyMfaLogin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const { t } = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Which quick sign-in button is currently authenticating (drives its
  // inline spinner); null while idle or when the normal form is used.
  const [pendingQuick, setPendingQuick] = useState<string | null>(null);

  // 2FA state (matches Image 4)
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEmail, setMfaEmail] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setMfaError(null);
    try {
      const res = await login(email, password);
      if (res && res.requiresMfa) {
        setMfaEmail(res.email || email);
        setMfaRequired(true);
      }
    } catch {
      // Error is already set in the store
    }
  };

  // One-click demo sign-in — reuses the SAME login() the form uses
  const handleQuickSignIn = async (account: {
    labelKey: string;
    email: string;
    password: string;
  }) => {
    clearError();
    setMfaError(null);
    setEmail(account.email);
    setPassword(account.password);
    setPendingQuick(account.labelKey);
    try {
      const res = await login(account.email, account.password);
      if (res && res.requiresMfa) {
        setMfaEmail(res.email || account.email);
        setMfaRequired(true);
      }
    } catch {
      // Error is already set in the store and shown in the form's Alert
    } finally {
      setPendingQuick(null);
    }
  };

  const triggerVerify = async (codeToVerify: string) => {
    const clean = codeToVerify.replace(/\D/g, '');
    if (!clean || clean.length !== 6 || isVerifyingMfa) return;
    setIsVerifyingMfa(true);
    setMfaError(null);
    try {
      await verifyMfaLogin(mfaEmail, clean);
      // Immediately clear 2FA view
      setMfaRequired(false);
      setMfaCode('');
      // Navigate straight to CMS dashboard
      window.location.hash = '#dashboard';
      useNavigationStore.getState().navigate('dashboard');
    } catch (err: any) {
      setMfaError(err?.message || 'Invalid verification code. Please try again.');
      setIsVerifyingMfa(false);
    }
  };

  const handleMfaSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!mfaCode.trim()) return;
    await triggerVerify(mfaCode);
  };

  // When 2FA is required, render CMS-branded verification screen
  if (mfaRequired) {
    if (embedded) {
      return (
        <div className="w-full space-y-4 py-2">
          <div className="text-center space-y-2 pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl shadow-md shadow-primary/20">
              C
            </div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Two-factor authentication
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>

          {mfaError && (
            <Alert variant="destructive" className="py-2.5 text-xs rounded-xl">
              <AlertDescription>{mfaError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-mfa-code" className="text-xs font-medium text-foreground block text-center">
                Authentication Code
              </Label>
              <div className="relative">
                <input
                  id="auth-mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setMfaCode(val);
                    setMfaError(null);
                    if (val.length === 6) {
                      void triggerVerify(val);
                    }
                  }}
                  placeholder="000000"
                  className="w-full h-12 text-center font-mono text-xl tracking-[0.45em] text-foreground bg-muted/25 border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all outline-none font-semibold placeholder:text-muted-foreground/40"
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Automatically verifies upon entering 6 digits
              </p>
            </div>

            <Button
              type="submit"
              disabled={isVerifyingMfa || mfaCode.length !== 6}
              className="w-full h-10 font-semibold rounded-xl transition-all shadow-md cursor-pointer"
            >
              {isVerifyingMfa ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <div className="pt-2 text-center border-t border-border/50">
              <button
                type="button"
                onClick={() => {
                  setMfaRequired(false);
                  setMfaCode('');
                  setMfaError(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
              >
                &larr; Back to sign in
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="w-full max-w-sm mx-auto">
          <Card className="border border-border/80 shadow-xl bg-card rounded-2xl overflow-hidden">
            <CardHeader className="text-center space-y-3 pb-3 pt-6">
              {/* CMS Brand Logo */}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl shadow-lg shadow-primary/20">
                C
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                  Two-factor authentication
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Enter the 6-digit code from your authenticator app to access your account.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 px-6 pb-6">
              {mfaError && (
                <Alert variant="destructive" className="py-2.5 text-xs rounded-xl">
                  <AlertDescription>{mfaError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-mfa-code" className="text-xs font-medium text-foreground block text-center">
                    Authentication Code
                  </Label>
                  <div className="relative">
                    <input
                      id="auth-mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                      value={mfaCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setMfaCode(val);
                        setMfaError(null);
                        if (val.length === 6) {
                          void triggerVerify(val);
                        }
                      }}
                      placeholder="000000"
                      className="w-full h-12 text-center font-mono text-xl tracking-[0.45em] text-foreground bg-muted/25 border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all outline-none font-semibold placeholder:text-muted-foreground/40"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Automatically verifies upon entering 6 digits
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isVerifyingMfa || mfaCode.length !== 6}
                  className="w-full h-10 font-semibold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {isVerifyingMfa ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify'
                  )}
                </Button>

                <div className="pt-2 text-center border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => {
                      setMfaRequired(false);
                      setMfaCode('');
                      setMfaError(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                  >
                    &larr; Back to sign in
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'w-full'
          : 'min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4'
      }
    >
      <div className="w-full max-w-sm mx-auto">
        <Card className="border-0 shadow-lg">
          {!embedded && (
            <CardHeader className="text-center space-y-3 pb-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
                C
              </div>
              <div>
                <CardTitle className="text-xl">{t('auth.welcomeBack')}</CardTitle>
                <CardDescription className="mt-1.5">
                  {t('auth.signInSubtitle')}
                </CardDescription>
              </div>
            </CardHeader>
          )}

          <CardContent className={embedded ? 'pt-6' : undefined}>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('auth.password')}</Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.enterPassword')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="h-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    </span>
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10"
                disabled={isLoading || !email || !password}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? t('auth.signingIn') : t('auth.signIn')}
              </Button>
            </form>

            {/* Quick Sign-in — three demo accounts, each performing a
                REAL authentication via the existing login flow. Editor
                and Author quick buttons are removed per spec (the demo
                users themselves are untouched and still sign in through
                the normal form). */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground font-medium mb-2 text-center">
                {t('auth.quickSignIn')}
              </p>
              <div className="space-y-1.5 text-xs">
                {QUICK_ACCOUNTS.map((account) => {
                  const label = quickLabel(account, t);
                  return (
                  <Button
                    key={account.labelKey}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={
                      'h-8 w-full text-[11px]' +
                      (account.accent
                        ? ' border-primary/40 text-primary hover:bg-primary/5'
                        : '')
                    }
                    disabled={isLoading}
                    onClick={() => void handleQuickSignIn(account)}
                  >
                    {pendingQuick === account.labelKey && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    {label}
                  </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-center pb-6 pt-0">
            <p className="text-xs text-muted-foreground">
              Enterprise CMS &copy; {new Date().getFullYear()}
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
