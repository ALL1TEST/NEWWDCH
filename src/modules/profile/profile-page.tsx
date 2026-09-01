'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type CurrentUser } from '@/lib/stores/auth-store';
import { useSubscriptionStore, getPlanBadgeClasses, getPlanBadgeStyle } from '@/lib/stores/subscription-store';
import { useT } from '@/lib/i18n';
import { getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  User as UserIcon,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  Smartphone,
  RefreshCw,
  Check,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi, postApi, patchApi } from '@/lib/api-client';

// ============================================================
// PROFILE PAGE — Platform Admin personal profile.
// ------------------------------------------------------------
// Structure (per Task 57 spec):
//   • Profile Header
//   • Personal Information (Full Name + Email Address read-only
//     + Change Email button)
//   • Change Password
//   • Security → Authenticator App (Enable / Enabled state)
//
// Removed (per spec):
//   • Account section (Role / Status / Member Since)
//   • Delete My User Account block + confirmation dialog
//   • "Two-Factor Authentication / Setup 2FA" wording
// ============================================================

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { t } = useT();
  const currentPlan = useSubscriptionStore((s) => s.currentPlan);
  const queryClient = useQueryClient();

  // Platform staff (OWNER / PLATFORM_ADMIN) have INTERNAL billing — no
  // personal subscription. Their header plan badge is hidden; only
  // account/security info is shown.
  const isPlatformStaff = user?.role === 'OWNER' || user?.role === 'PLATFORM_ADMIN';

  // Personal info
  const [name, setName] = useState(user?.name ?? '');
  const email = user?.email ?? '';
  const [isSavingName, setIsSavingName] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Modal open-state
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  // When the Regenerate flow rolls a fresh secret, the new setup data is
  // captured here so the Setup modal opens at step 2 (QR + secret) instead
  // of starting over at step 1.
  const [regeneratedSetupData, setRegeneratedSetupData] = useState<TwoFactorSetupResponse | null>(null);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  // ---- 2FA status query (drives the Security card UI) ----
  const statusQuery = useQuery<TwoFactorStatus>({
    queryKey: ['2fa-status'],
    queryFn: () => getApi<TwoFactorStatus>('/api/auth/2fa/status'),
    retry: false,
  });

  const invalidate2faStatus = () =>
    queryClient.invalidateQueries({ queryKey: ['2fa-status'] });

  // ---- Handlers ----

  const handleSaveName = async () => {
    if (!name.trim() || !user) return;
    setIsSavingName(true);
    try {
      await patchApi(`/api/users/${user.id}`, { name: name.trim() });
      const updatedUser: CurrentUser = { ...user, name: name.trim() };
      localStorage.setItem('cms_auth_user', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });
      toast.success(t('profile.nameSaved'));
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in both password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setIsChangingPw(true);
    try {
      await postApi('/api/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      toast.error(msg);
    } finally {
      setIsChangingPw(false);
    }
  };

  if (!user) return null;

  const mfaEnabled = !!statusQuery.data?.mfaEnabled;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Avatar accent — the active plan's OWN ring color
                (getPlanBadgeStyle().ring — the exact same design token
                the sidebar profile-section plan badge uses: Pro →
                ring-violet-500). Reuses the existing Pro/sidebar purple;
                no new color is introduced. Platform staff have no
                personal subscription → default avatar. */}
            <Avatar
              className={`h-16 w-16 ring-2 ring-offset-2 ${
                !isPlatformStaff ? getPlanBadgeStyle(currentPlan).ring : 'ring-transparent'
              }`}
            >
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
              <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{user.name}</h2>
                {!isPlatformStaff && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${getPlanBadgeClasses(currentPlan.badgeVariant)}`}
                  >
                    {currentPlan.name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.personalInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">{t('profile.fullName')}</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-email">{t('profile.emailAddress')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="profile-email" value={email} disabled className="pl-9 bg-muted/50" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setChangeEmailOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Change Email
            </Button>
            <Button onClick={handleSaveName} disabled={isSavingName || name.trim() === user.name}>
              {isSavingName && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('profile.saveChanges')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To set a new password, you need to enter your current password first.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="current-pw">Current Password</Label>
            <div className="relative">
              <Input
                id="current-pw"
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-pw">New Password</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 8 characters)"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPw(!showNewPw)}
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPw || !currentPassword || !newPassword}
            >
              {isChangingPw && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security — Authenticator App */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Security
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Authenticator App
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusQuery.isLoading ? (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Enabled</p>
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0">
                        Authenticator App
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      Your authenticator app is configured and required for login verification.
                    </p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                  onClick={() => setDisableOpen(true)}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Disable Authenticator App
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Secret
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Authenticator App</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                    Use an authenticator app to generate a one-time verification code when logging in.
                    This adds an extra layer of security to your account.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setSetupOpen(true)}>
                  <Smartphone className="h-4 w-4 mr-2" />
                  Enable Authenticator App
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Modals ---- */}
      <ChangeEmailDialog
        open={changeEmailOpen}
        onOpenChange={setChangeEmailOpen}
        currentEmail={email}
        onEmailChanged={(newEmail) => {
          // Update the auth store so the UI reflects the new email without a full reload.
          if (user) {
            const updatedUser: CurrentUser = { ...user, email: newEmail };
            localStorage.setItem('cms_auth_user', JSON.stringify(updatedUser));
            useAuthStore.setState({ user: updatedUser });
          }
        }}
      />

      <AuthenticatorSetupDialog
        open={setupOpen}
        onOpenChange={(v) => {
          setSetupOpen(v);
          if (!v) setRegeneratedSetupData(null);
        }}
        email={email}
        initialSetupData={regeneratedSetupData}
        onActivated={() => {
          invalidate2faStatus();
          setRegeneratedSetupData(null);
          toast.success('Authenticator app enabled.');
        }}
      />

      <DisableAuthenticatorDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        mfaEnabled={mfaEnabled}
        onDisabled={() => {
          invalidate2faStatus();
          toast.success('Authenticator app disabled.');
        }}
      />

      <RegenerateSecretDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        email={email}
        onRegenerated={(setupData) => {
          // After regeneration succeeds, open the setup flow at step 2 (QR) so
          // the user can re-activate with the new secret.
          invalidate2faStatus();
          setRegeneratedSetupData(setupData);
          setSetupOpen(true);
        }}
      />
    </div>
  );
}

// ============================================================
// SHARED: 2FA status type
// ============================================================

interface TwoFactorStatus {
  mfaEnabled: boolean;
  hasSecret: boolean;
}

interface TwoFactorSetupResponse {
  secret: string;
  otpauthUri: string;
  qrDataUrl: string; // base64 data URL
}

// ============================================================
// CHANGE EMAIL DIALOG
// ------------------------------------------------------------
// Modal with:
//   • Current email (read-only display)
//   • New email input (validated client + server-side)
//   • Current password input (server-verified)
// Server uniqueness check at /api/auth/change-email.
// On success: toast + update auth store + close.
// ============================================================

function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
  onEmailChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentEmail: string;
  onEmailChanged: (newEmail: string) => void;
}) {
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNewEmail('');
      setCurrentPassword('');
      setShowPw(false);
      setLocalError(null);
    }
  }, [open]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const isDifferent = newEmail.trim().toLowerCase() !== currentEmail.toLowerCase();

  const handleSubmit = async () => {
    setLocalError(null);
    if (!newEmail.trim()) {
      setLocalError('Please enter a new email address.');
      return;
    }
    if (!emailValid) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!isDifferent) {
      setLocalError('New email must be different from your current email.');
      return;
    }
    if (!currentPassword) {
      setLocalError('Please enter your current password to confirm.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await postApi<{ email: string }>('/api/auth/change-email', {
        currentPassword,
        newEmail: newEmail.trim(),
      });
      onEmailChanged(res.email);
      toast.success('Email address updated successfully.');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change email.';
      setLocalError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Change Email Address
          </DialogTitle>
          <DialogDescription>
            Enter your new email and current password to confirm the change.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Current Email</Label>
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {currentEmail}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-email" className="text-xs">New Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ce-current-pw" className="text-xs">Current Password</Label>
            <div className="relative">
              <Input
                id="ce-current-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {localError && (
            <p className="text-xs text-destructive flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{localError}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !emailValid || !isDifferent || !currentPassword}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// AUTHENTICATOR SETUP DIALOG (3-step flow)
// ------------------------------------------------------------
// Step 1: Download an authenticator app + enter current password
//         (calls /api/auth/2fa/setup → returns secret + QR).
// Step 2: Show QR code + 2FA Key (manual entry).
// Step 3: Enter 6-digit verification code + Activate button
//         (calls /api/auth/2fa/activate → mfaEnabled = true).
//
// `initialStep` lets the Regenerate flow jump straight to step 2
// (with a pre-supplied secret/qrDataUrl) after the new secret is
// rolled server-side.
// ============================================================

type SetupStep = 1 | 2 | 3;

function AuthenticatorSetupDialog({
  open,
  onOpenChange,
  email,
  onActivated,
  initialSetupData,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
  onActivated: () => void;
  initialSetupData?: TwoFactorSetupResponse | null;
}) {
  const [step, setStep] = useState<SetupStep>(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(initialSetupData ?? null);
  const [code, setCode] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset on open/close. If initialSetupData is provided (regenerate
  // flow), skip straight to step 2.
  useEffect(() => {
    if (open) {
      setStep(initialSetupData ? 2 : 1);
      setSetupData(initialSetupData ?? null);
      setCurrentPassword('');
      setShowPw(false);
      setCode('');
      setLocalError(null);
      setCopied(false);
    }
  }, [open, initialSetupData]);

  const handleStartSetup = async () => {
    setLocalError(null);
    if (!currentPassword) {
      setLocalError('Please enter your current password to start.');
      return;
    }
    setIsWorking(true);
    try {
      const res = await postApi<TwoFactorSetupResponse>('/api/auth/2fa/setup', { currentPassword });
      setSetupData(res);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start setup.';
      setLocalError(msg);
    } finally {
      setIsWorking(false);
    }
  };

  const handleActivate = async () => {
    setLocalError(null);
    const clean = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) {
      setLocalError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setIsWorking(true);
    try {
      await postApi('/api/auth/2fa/activate', { code: clean });
      onActivated();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code.';
      setLocalError(msg);
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopySecret = async () => {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      toast.success('Secret copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy secret.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isWorking) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Enable Authenticator App
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3 — {step === 1 ? 'Download an authenticator app' : step === 2 ? 'Scan the QR code' : 'Verify the code'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Download instructions + password verify */}
        {step === 1 && (
          <div className="py-2 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
              <p className="font-medium">Step 1: Download an authenticator app</p>
              <p className="text-muted-foreground">
                Install an authenticator app such as
                <span className="font-medium text-foreground"> Google Authenticator</span>,
                <span className="font-medium text-foreground"> Authy</span>,
                <span className="font-medium text-foreground"> 1Password</span>, or
                <span className="font-medium text-foreground"> Microsoft Authenticator</span> on your phone.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup-current-pw" className="text-xs">Current Password</Label>
              <div className="relative">
                <Input
                  id="setup-current-pw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {localError && (
              <p className="text-xs text-destructive flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{localError}</span>
              </p>
            )}
          </div>
        )}

        {/* Step 2: QR + secret */}
        {step === 2 && setupData && (
          <div className="py-2 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
              <p className="font-medium">Step 2: Scan the QR code</p>
              <p className="text-muted-foreground">
                Scan the QR code below with your authenticator app, or enter the 2FA key manually.
              </p>
            </div>
            <div className="flex justify-center">
              <img
                src={setupData.qrDataUrl}
                alt="Authenticator QR code"
                className="h-48 w-48 rounded-lg border bg-white p-2"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">2FA Key (Manual entry)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleCopySecret}
                >
                  {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs break-all select-all">
                {setupData.secret}
              </div>
            </div>
            {localError && (
              <p className="text-xs text-destructive flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{localError}</span>
              </p>
            )}
          </div>
        )}

        {/* Step 3: Enter 6-digit code */}
        {step === 3 && (
          <div className="py-2 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
              <p className="font-medium">Step 3: Enter the verification code</p>
              <p className="text-muted-foreground">
                Open your authenticator app and enter the 6-digit code shown for this account.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="totp-code" className="text-xs">6-digit verification code</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-lg tracking-[0.5em] font-mono"
              />
            </div>
            {localError && (
              <p className="text-xs text-destructive flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{localError}</span>
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {step > 1 && step < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((step - 1) as SetupStep)}
                disabled={isWorking}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWorking}>
              Cancel
            </Button>
            {step === 1 && (
              <Button onClick={handleStartSetup} disabled={isWorking || !currentPassword}>
                {isWorking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Continue
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={isWorking}>
                Continue
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleActivate} disabled={isWorking || code.length !== 6}>
                {isWorking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Activate
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DISABLE AUTHENTICATOR DIALOG
// ------------------------------------------------------------
// Requires current password + (if currently enabled) the 6-digit
// TOTP code from the configured authenticator.
// ============================================================

function DisableAuthenticatorDialog({
  open,
  onOpenChange,
  mfaEnabled,
  onDisabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mfaEnabled: boolean;
  onDisabled: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCurrentPassword('');
      setShowPw(false);
      setCode('');
      setLocalError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!currentPassword) {
      setLocalError('Please enter your current password.');
      return;
    }
    if (mfaEnabled && code.length !== 6) {
      setLocalError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setIsWorking(true);
    try {
      await postApi('/api/auth/2fa/disable', {
        currentPassword,
        code: mfaEnabled ? code : undefined,
      });
      onDisabled();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disable authenticator.';
      setLocalError(msg);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isWorking) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Disable Authenticator App
          </DialogTitle>
          <DialogDescription>
            This will remove the authenticator from your account. You will no longer need a verification code at login.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="disable-pw" className="text-xs">Current Password</Label>
            <div className="relative">
              <Input
                id="disable-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {mfaEnabled && (
            <div className="grid gap-2">
              <Label htmlFor="disable-code" className="text-xs">6-digit verification code</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-lg tracking-[0.5em] font-mono"
              />
            </div>
          )}
          {localError && (
            <p className="text-xs text-destructive flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{localError}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWorking}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isWorking || !currentPassword || (mfaEnabled && code.length !== 6)}
          >
            {isWorking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Disable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// REGENERATE SECRET DIALOG
// ------------------------------------------------------------
// Requires current password + 6-digit TOTP code from the CURRENT
// authenticator. On success: server rolls a fresh secret (and sets
// mfaEnabled = false). We then jump into the Setup flow at step 2
// with the new QR/secret so the user can re-activate.
// ============================================================

function RegenerateSecretDialog({
  open,
  onOpenChange,
  email,
  onRegenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
  onRegenerated: (setupData: TwoFactorSetupResponse) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCurrentPassword('');
      setShowPw(false);
      setCode('');
      setLocalError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!currentPassword) {
      setLocalError('Please enter your current password.');
      return;
    }
    if (code.length !== 6) {
      setLocalError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setIsWorking(true);
    try {
      const res = await postApi<TwoFactorSetupResponse>('/api/auth/2fa/regenerate', {
        currentPassword,
        code,
      });
      onRegenerated(res);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to regenerate secret.';
      setLocalError(msg);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isWorking) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Regenerate Authenticator Secret
          </DialogTitle>
          <DialogDescription>
            This will roll a new secret and disable 2FA until you re-activate. You will need to scan the new QR code with your authenticator app.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="regen-pw" className="text-xs">Current Password</Label>
            <div className="relative">
              <Input
                id="regen-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="regen-code" className="text-xs">Current 6-digit code</Label>
            <Input
              id="regen-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center text-lg tracking-[0.5em] font-mono"
            />
          </div>
          {localError && (
            <p className="text-xs text-destructive flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{localError}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWorking}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isWorking || !currentPassword || code.length !== 6}
          >
            {isWorking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Regenerate Secret
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
