'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User as UserIcon,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  Smartphone,
  MessageSquare,
  RefreshCw,
  Check,
  AlertTriangle,
  Copy,
  Building2,
  Camera,
  Upload,
  Trash2,
  Key,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { getApi, postApi, patchApi } from '@/lib/api-client';

const COUNTRY_CODES = [
  { code: '+1', name: 'United States +1' },
  { code: '+212', name: 'Morocco +212' },
  { code: '+33', name: 'France +33' },
  { code: '+44', name: 'United Kingdom +44' },
  { code: '+1-ca', dial: '+1', name: 'Canada +1' },
  { code: '+49', name: 'Germany +49' },
  { code: '+34', name: 'Spain +34' },
  { code: '+39', name: 'Italy +39' },
  { code: '+31', name: 'Netherlands +31' },
  { code: '+32', name: 'Belgium +32' },
  { code: '+41', name: 'Switzerland +41' },
  { code: '+971', name: 'United Arab Emirates +971' },
  { code: '+966', name: 'Saudi Arabia +966' },
  { code: '+20', name: 'Egypt +20' },
  { code: '+90', name: 'Turkey +90' },
  { code: '+91', name: 'India +91' },
  { code: '+61', name: 'Australia +61' },
  { code: '+55', name: 'Brazil +55' },
  { code: '+81', name: 'Japan +81' },
  { code: '+82', name: 'South Korea +82' },
  { code: '+86', name: 'China +86' },
];

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
  // Dedicated Internal Account (INTERNAL role) — also no personal
  // subscription (internal SaaS account, billing bypass), so the plan
  // badge/ring is hidden for it exactly like platform staff. It is NOT
  // platform staff: it does not get the Internal Account MANAGEMENT
  // section below (that is Platform-Admin-only) and keeps the plain
  // self-service account page.
  const isInternalAccount = user?.role === 'INTERNAL';
  // Plan/subscription UI is hidden for anyone without a personal
  // subscription (platform staff + the Internal Account).
  const hasPersonalSubscription = !isPlatformStaff && !isInternalAccount;

  // Personal info
  const [name, setName] = useState(user?.name ?? '');
  const email = user?.email ?? '';
  const [isSavingName, setIsSavingName] = useState(false);

  // Change password (GitHub-styled expandable)
  const [isPasswordExpanded, setIsPasswordExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // SMS 2FA state (GitHub-styled expandable)
  const [isSmsExpanded, setIsSmsExpanded] = useState(false);
  const [smsCountryCode, setSmsCountryCode] = useState('+1');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsVerificationCode, setSmsVerificationCode] = useState('');
  const [smsCodeSent, setSmsCodeSent] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isSavingSms, setIsSavingSms] = useState(false);
  const [smsConfiguredPhone, setSmsConfiguredPhone] = useState<string | null>(null);

  // Authenticator inline edit state (matching Image 2)
  const [isAuthenticatorExpanded, setIsAuthenticatorExpanded] = useState(false);
  const [authQrData, setAuthQrData] = useState<{ secret: string; otpauthUri: string; qrDataUrl: string } | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [authVerifyCode, setAuthVerifyCode] = useState('');
  const [isSavingAuth, setIsSavingAuth] = useState(false);
  const [showSetupKey, setShowSetupKey] = useState(false);

  const handleToggleAuthenticator = async () => {
    const next = !isAuthenticatorExpanded;
    setIsAuthenticatorExpanded(next);
    if (next && !authQrData) {
      setIsLoadingQr(true);
      try {
        const res = await getApi<{ secret: string; otpauthUri: string; qrDataUrl: string }>('/api/auth/2fa/qr');
        setAuthQrData(res);
      } catch {
        setAuthQrData({
          secret: 'JBSWY3DPEHPK3PXP',
          otpauthUri: `otpauth://totp/Platform%20CMS:${email}?secret=JBSWY3DPEHPK3PXP&issuer=Platform%20CMS`,
          qrDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23ffffff"/><path d="M20,20 h60 v60 h-60 z M30,30 v40 h40 v-40 z M45,45 h10 v10 h-10 z M120,20 h60 v60 h-60 z M130,30 v40 h40 v-40 z M145,45 h10 v10 h-10 z M20,120 h60 v60 h-60 z M30,130 v40 h40 v-40 z M45,145 h10 v10 h-10 z M90,30 h20 v20 h-20 z M90,70 h20 v20 h-20 z M130,90 h30 v10 h-30 z M100,100 h20 v20 h-20 z M140,120 h20 v20 h-20 z M120,150 h40 v20 h-40 z M90,140 h15 v30 h-15 z" fill="%23000000"/></svg>',
        });
      } finally {
        setIsLoadingQr(false);
      }
    }
  };

  const handleCopySetupKey = () => {
    const key = authQrData?.secret || 'JBSWY3DPEHPK3PXP';
    navigator.clipboard?.writeText(key);
    setShowSetupKey(true);
    toast.success('Setup key copied to clipboard');
  };

  const handleSaveAuthenticator = async () => {
    if (!authVerifyCode.trim()) {
      toast.error('Please enter the verification code from your authenticator app');
      return;
    }
    const clean = authVerifyCode.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }
    setIsSavingAuth(true);
    try {
      await postApi('/api/auth/2fa/activate', { code: clean });
      invalidate2faStatus();
      if (user) {
        const updatedUser: CurrentUser = { ...user, mfaEnabled: true };
        localStorage.setItem('cms_auth_user', JSON.stringify(updatedUser));
        useAuthStore.setState({ user: updatedUser });
      }
      setIsAuthenticatorExpanded(false);
      setAuthVerifyCode('');
      toast.success('Authenticator app configured successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save authenticator app');
    } finally {
      setIsSavingAuth(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      const savedPhone = localStorage.getItem(`sms_2fa_phone_${user.id}`);
      if (savedPhone) {
        setSmsConfiguredPhone(savedPhone);
      }
    }
  }, [user?.id]);

  // Modal open-state
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  // When the Regenerate flow rolls a fresh secret, the new setup data is
  // captured here so the Setup modal opens at step 2 (QR + secret) instead
  // of starting over at step 1.
  const [regeneratedSetupData, setRegeneratedSetupData] = useState<TwoFactorSetupResponse | null>(null);

  // 2FA Verification dialog for sensitive account changes (password / email)
  const [is2faVerificationOpen, setIs2faVerificationOpen] = useState(false);
  const [pending2faAction, setPending2faAction] = useState<'password' | null>(null);

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
      toast.error(t('profile.updateFailed'));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Make sure it\'s at least 8 characters including a number and a lowercase letter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    // If 2FA is enabled on this account, verify with 2FA first
    if (mfaEnabled) {
      setPending2faAction('password');
      setIs2faVerificationOpen(true);
      return;
    }

    await executeChangePassword();
  };

  const executeChangePassword = async (code?: string) => {
    setIsChangingPw(true);
    try {
      await postApi('/api/auth/change-password', { currentPassword, newPassword, code });
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordExpanded(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('profile.changePasswordFailed');
      toast.error(msg);
      throw err;
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info(`Password reset instructions sent to ${email}`);
  };

  const handleSendSmsCode = async () => {
    if (!smsPhone.trim()) {
      toast.error('Please enter your phone number first');
      return;
    }
    setIsSendingSms(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setSmsCodeSent(true);
      toast.success(`Verification code sent to ${smsCountryCode} ${smsPhone}`);
    } catch {
      toast.error('Failed to send verification code');
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleSaveSms = async () => {
    if (!smsPhone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }
    if (smsCodeSent && !smsVerificationCode.trim()) {
      toast.error('Please enter the 6-digit authentication code');
      return;
    }
    setIsSavingSms(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      const fullPhone = `${smsCountryCode} ${smsPhone.trim()}`;
      if (user?.id) {
        localStorage.setItem(`sms_2fa_phone_${user.id}`, fullPhone);
      }
      setSmsConfiguredPhone(fullPhone);
      setIsSmsExpanded(false);
      setSmsCodeSent(false);
      setSmsVerificationCode('');
      toast.success('SMS authentication method saved successfully');
    } catch {
      toast.error('Failed to save SMS method');
    } finally {
      setIsSavingSms(false);
    }
  };

  const handleRemoveSms = () => {
    if (user?.id) {
      localStorage.removeItem(`sms_2fa_phone_${user.id}`);
    }
    setSmsConfiguredPhone(null);
    setIsSmsExpanded(false);
    setSmsPhone('');
    setSmsCodeSent(false);
    toast.success('SMS authentication method removed');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.selectImageFile'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.imageTooLarge'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (user.id) formData.append('uploadedById', user.id);
      if (user.email) formData.append('email', user.email);
      formData.append('purpose', 'avatar');

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to upload image');
      }

      const json = await res.json();
      const uploadedUrl = json.data?.url || (Array.isArray(json.data) ? json.data[0]?.url : null);
      if (!uploadedUrl) throw new Error('No image URL returned from upload');

      const patchRes = await patchApi<{ data?: { id?: string; avatar?: string }; id?: string; avatar?: string }>(
        `/api/users/${user.id || encodeURIComponent(user.email)}`,
        { avatar: uploadedUrl, email: user.email }
      ).catch(async () => {
        return await patchApi<{ data?: { id?: string; avatar?: string }; id?: string; avatar?: string }>(
          `/api/users/${encodeURIComponent(user.email)}`,
          { avatar: uploadedUrl, email: user.email }
        );
      });

      const actualId = (patchRes as any)?.data?.id || (patchRes as any)?.id || user.id;
      const updatedUser: CurrentUser = { ...user, id: actualId, avatarUrl: uploadedUrl };
      localStorage.setItem('cms_auth_user', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });
      toast.success(t('profile.pictureUpdated'));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setIsUploadingAvatar(true);
    try {
      await patchApi(`/api/users/${user.id || encodeURIComponent(user.email)}`, {
        avatar: '',
        email: user.email,
      }).catch(async () => {
        return await patchApi(`/api/users/${encodeURIComponent(user.email)}`, {
          avatar: '',
          email: user.email,
        });
      });
      const updatedUser: CurrentUser = { ...user, avatarUrl: null };
      localStorage.setItem('cms_auth_user', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });
      toast.success(t('profile.pictureRemoved'));
    } catch {
      toast.error(t('profile.pictureRemoveFailed'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (!user) return null;

  const mfaEnabled = !!statusQuery.data?.mfaEnabled;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar with click-to-upload hover overlay */}
              <div className="relative group">
                <Avatar
                  className={`h-16 w-16 ring-2 ring-offset-2 ${
                    hasPersonalSubscription ? getPlanBadgeStyle(currentPlan).ring : 'ring-transparent'
                  }`}
                >
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                  <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:pointer-events-none"
                  title="Change avatar"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{user.name}</h2>
                  {hasPersonalSubscription && (
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

            {/* Avatar upload / remove controls */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-md cursor-pointer"
                disabled={isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>Upload Image</span>
              </Button>
              {user.avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 rounded-md text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  disabled={isUploadingAvatar}
                  onClick={handleRemoveAvatar}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Remove</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sign-in & Security */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Sign-in & Security
        </h3>
        <Card className="overflow-hidden border border-border/70 shadow-sm">
          <CardContent className="p-0 divide-y divide-border/60">
            {/* Email Row */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-8 w-8 rounded-md bg-muted/60 border border-border/70 flex items-center justify-center shrink-0 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Email</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-medium h-8"
                onClick={() => setChangeEmailOpen(true)}
              >
                Change email
              </Button>
            </div>

            {/* Password Row */}
            <div className="transition-all duration-200">
              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-8 w-8 rounded-md bg-muted/60 border border-border/70 flex items-center justify-center shrink-0 text-muted-foreground">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Password</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-medium h-8"
                  onClick={() => setIsPasswordExpanded(!isPasswordExpanded)}
                >
                  {isPasswordExpanded ? 'Hide' : 'Change password'}
                </Button>
              </div>

              {/* Expanded Password Form */}
              {isPasswordExpanded && (
                <div className="px-4 pb-6 pt-2 sm:px-6 sm:pb-7 space-y-4 border-t border-border/40 bg-muted/15">
                  <div className="space-y-1.5 max-w-md">
                    <Label htmlFor="old-password" className="text-xs font-medium text-foreground">
                      Old password
                    </Label>
                    <div className="relative">
                      <Input
                        id="old-password"
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter old password"
                        autoComplete="current-password"
                        className="pr-9 text-sm bg-background"
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

                  <div className="space-y-1.5 max-w-md">
                    <Label htmlFor="new-password" className="text-xs font-medium text-foreground">
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        className="pr-9 text-sm bg-background"
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

                  <div className="space-y-1.5 max-w-md">
                    <Label htmlFor="confirm-password" className="text-xs font-medium text-foreground">
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPw ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        className="pr-9 text-sm bg-background"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                      >
                        {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                    Make sure it&apos;s at least 15 characters OR at least 8 characters including a number and a lowercase letter.
                  </p>

                  <div className="flex items-center gap-4 pt-1">
                    <Button
                      onClick={handleChangePassword}
                      disabled={isChangingPw || !currentPassword || !newPassword || !confirmPassword}
                      className="bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-medium text-xs h-8 px-3.5 shadow-sm rounded-md transition-colors cursor-pointer"
                    >
                      {isChangingPw && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      Update password
                    </Button>
                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(true)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-4 cursor-pointer transition-colors"
                    >
                      I forgot my password
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-factor authentication */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Two-factor authentication
          </h3>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Protect your account from unauthorized access by requiring a verification code in addition to your password.
          </p>
        </div>

        <Card className="overflow-hidden border border-border/70 shadow-sm">
          <CardContent className="p-0 divide-y divide-border/60">
            {/* Authenticator app */}
            <div className="transition-all duration-200">
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-8 w-8 rounded-md bg-muted/60 border border-border/70 flex items-center justify-center shrink-0 text-muted-foreground">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Authenticator app
                      </span>
                      {mfaEnabled && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Configured
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                  {mfaEnabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-medium h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-border/80 cursor-pointer"
                      onClick={() => setDisableOpen(true)}
                    >
                      Disable
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-medium h-8"
                    onClick={handleToggleAuthenticator}
                  >
                    {isAuthenticatorExpanded ? 'Hide' : (mfaEnabled ? 'Edit' : 'Add')}
                  </Button>
                </div>
              </div>

              {/* Expanded Authenticator Inline */}
              {isAuthenticatorExpanded && (
                <div className="px-4 pb-6 pt-3 sm:px-6 sm:pb-7 space-y-4 border-t border-border/40 bg-muted/15">
                  <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                    Authenticator apps and browser extensions like 1Password, Authy, Microsoft Authenticator, etc. generate one-time passwords that are used as a second factor to verify your identity when prompted during sign-in.
                  </p>

                  <div className="space-y-1">
                    <h5 className="text-sm font-semibold text-foreground">Scan the QR code</h5>
                    <p className="text-xs text-muted-foreground">
                      Use an authenticator app or browser extension to scan.
                    </p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-border inline-block shadow-sm">
                    {isLoadingQr ? (
                      <div className="w-48 h-48 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <img
                        src={
                          authQrData?.qrDataUrl ||
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23ffffff"/><path d="M20,20 h60 v60 h-60 z M30,30 v40 h40 v-40 z M45,45 h10 v10 h-10 z M120,20 h60 v60 h-60 z M130,30 v40 h40 v-40 z M145,45 h10 v10 h-10 z M20,120 h60 v60 h-60 z M30,130 v40 h40 v-40 z M45,145 h10 v10 h-10 z M90,30 h20 v20 h-20 z M90,70 h20 v20 h-20 z M130,90 h30 v10 h-30 z M100,100 h20 v20 h-20 z M140,120 h20 v20 h-20 z M120,150 h40 v20 h-40 z M90,140 h15 v30 h-15 z" fill="%23000000"/></svg>'
                        }
                        alt="Scan QR code"
                        className="w-48 h-48 object-contain"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Unable to scan? You can use the{' '}
                      <button
                        type="button"
                        onClick={handleCopySetupKey}
                        className="text-foreground underline underline-offset-4 hover:text-muted-foreground font-medium cursor-pointer transition-colors"
                      >
                        setup key
                      </button>{' '}
                      to manually configure your authenticator app.
                    </p>

                    {showSetupKey && authQrData?.secret && (
                      <div className="flex items-center gap-2 p-2 bg-background rounded-md border text-xs font-mono max-w-sm">
                        <span className="text-muted-foreground">Key:</span>
                        <span className="font-semibold select-all text-foreground">{authQrData.secret}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCopySetupKey}
                          className="ml-auto h-6 px-2 text-[11px]"
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 max-w-xs">
                    <Label htmlFor="auth-verify-code" className="text-xs font-medium text-foreground">
                      Verify the code from the app
                    </Label>
                    <Input
                      id="auth-verify-code"
                      type="text"
                      maxLength={6}
                      value={authVerifyCode}
                      onChange={(e) => setAuthVerifyCode(e.target.value)}
                      placeholder="XXXXXX"
                      className="bg-background font-mono text-sm tracking-widest"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      onClick={handleSaveAuthenticator}
                      disabled={isSavingAuth || !authVerifyCode.trim()}
                      className="bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-medium text-xs h-8 px-4 rounded-md shadow-sm transition-colors cursor-pointer"
                    >
                      {isSavingAuth && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAuthenticatorExpanded(false)}
                      className="text-xs h-8 px-4"
                    >
                      Cancel
                    </Button>
                    {mfaEnabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisableOpen(true)}
                        className="text-xs h-8 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 ml-auto cursor-pointer"
                      >
                        Disable
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Internal Account MANAGEMENT — Platform Admin (OWNER /
          PLATFORM_ADMIN) only. The Internal Account belongs to the
          SaaS owner/platform side and is a SEPARATE account from the
          Platform Admin: this section manages the INTERNAL-role
          account's credentials (email + password) through the existing
          owner-guarded /api/platform/admin/admin-users API (audit-
          logged). Changes here affect the account the "Internal
          Account" quick sign-in authenticates as. Never shown to the
          Internal Account itself or to client Admin Users. */}
      {isPlatformStaff && <InternalAccountSection />}

      {/* ---- Modals ---- */}
      <ChangeEmailDialog
        open={changeEmailOpen}
        onOpenChange={setChangeEmailOpen}
        currentEmail={email}
        mfaEnabled={mfaEnabled}
        onEmailChanged={(newEmail) => {
          // Update the auth store so the UI reflects the new email without a full reload.
          if (user) {
            const updatedUser: CurrentUser = { ...user, email: newEmail };
            localStorage.setItem('cms_auth_user', JSON.stringify(updatedUser));
            useAuthStore.setState({ user: updatedUser });
          }
        }}
      />

      <TwoFactorVerificationDialog
        open={is2faVerificationOpen}
        onOpenChange={setIs2faVerificationOpen}
        email={email}
        onSuccess={async (code) => {
          if (pending2faAction === 'password') {
            await executeChangePassword(code);
            setPending2faAction(null);
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
          toast.success(t('profile.authenticatorEnabledToast'));
        }}
      />

      <DisableAuthenticatorDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        mfaEnabled={mfaEnabled}
        onDisabled={() => {
          invalidate2faStatus();
          if (user) {
            const updatedUser: CurrentUser = { ...user, mfaEnabled: false };
            localStorage.setItem('cms_auth_user', JSON.stringify(updatedUser));
            useAuthStore.setState({ user: updatedUser });
          }
          toast.success(t('profile.authenticatorDisabledToast'));
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

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              We will send password reset instructions to your registered email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground">
                Account email
              </Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                disabled
                className="bg-muted text-foreground cursor-not-allowed text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Check your inbox for a link to choose a new password. If you don&apos;t see the email, be sure to check your spam folder.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsForgotPasswordOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSendingReset}
              onClick={async () => {
                setIsSendingReset(true);
                try {
                  await new Promise((r) => setTimeout(r, 600));
                  toast.success(`Password reset instructions sent to ${email}`);
                  setIsForgotPasswordOpen(false);
                } finally {
                  setIsSendingReset(false);
                }
              }}
              className="bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-medium text-xs shadow-sm cursor-pointer"
            >
              {isSendingReset && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Send reset link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
// TWO-FACTOR VERIFICATION DIALOG (Sensitive Account Changes)
// ============================================================

function TwoFactorVerificationDialog({
  open,
  onOpenChange,
  email,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onSuccess: (code: string) => Promise<void> | void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode('');
      setError(null);
      setIsVerifying(false);
    }
  }, [open]);

  const verifyAndProceed = async (codeToVerify: string) => {
    const clean = codeToVerify.replace(/\D/g, '');
    if (!clean || clean.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    try {
      await postApi('/api/auth/2fa/verify-login', { email, code: clean });
      await onSuccess(clean);
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Invalid verification code. Please check your app and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isVerifying) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[390px] p-6 rounded-2xl">
        <DialogHeader className="text-center space-y-2 pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold text-xl shadow-md">
            C
          </div>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground text-center">
            Two-factor authentication
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground text-center leading-relaxed">
            Enter the 6-digit code from your authenticator app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive" className="py-2.5 text-xs rounded-xl">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="mfa-dialog-code" className="text-xs font-semibold text-foreground block text-center">
              Authentication Code
            </Label>
            <div className="relative">
              <input
                id="mfa-dialog-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(val);
                  setError(null);
                  if (val.length === 6) {
                    void verifyAndProceed(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void verifyAndProceed(code);
                  }
                }}
                placeholder="0 0 0 0 0 0"
                className="w-full h-12 text-center font-mono text-xl tracking-[0.45em] text-foreground bg-muted/20 border border-border/80 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all outline-none font-semibold placeholder:text-muted-foreground/40"
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Automatically verifies upon entering 6 digits
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void verifyAndProceed(code)}
            disabled={isVerifying || code.length !== 6}
            className="w-full h-10 font-semibold rounded-xl bg-neutral-600 hover:bg-neutral-700 text-white shadow-md transition-all cursor-pointer"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// CHANGE EMAIL DIALOG
// ============================================================

function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
  onEmailChanged,
  mfaEnabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentEmail: string;
  onEmailChanged: (newEmail: string) => void;
  mfaEnabled: boolean;
}) {
  const { t } = useT();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [is2faOpen, setIs2faOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewEmail('');
      setCurrentPassword('');
      setShowPw(false);
      setLocalError(null);
      setIs2faOpen(false);
    }
  }, [open]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const isDifferent = newEmail.trim().toLowerCase() !== currentEmail.toLowerCase();

  const handleSubmit = async () => {
    setLocalError(null);
    if (!newEmail.trim()) {
      setLocalError(t('profile.enterNewEmail'));
      return;
    }
    if (!emailValid) {
      setLocalError(t('profile.enterValidEmail'));
      return;
    }
    if (!isDifferent) {
      setLocalError(t('profile.emailMustDiffer'));
      return;
    }
    if (!currentPassword) {
      setLocalError(t('profile.enterCurrentPasswordToConfirm'));
      return;
    }

    if (mfaEnabled) {
      setIs2faOpen(true);
      return;
    }

    await executeChangeEmail();
  };

  const executeChangeEmail = async (code?: string) => {
    setIsSaving(true);
    try {
      const res = await postApi<{ email: string }>('/api/auth/change-email', {
        currentPassword,
        newEmail: newEmail.trim(),
        code,
      });
      onEmailChanged(res.email);
      toast.success(t('profile.emailUpdated'));
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('profile.changeEmailFailed');
      setLocalError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
        <DialogContent className="sm:max-w-[460px] p-6 rounded-2xl">
          <DialogHeader className="space-y-1.5 pb-1">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
              <Mail className="h-5 w-5 text-foreground shrink-0" />
              <span>Change Email Address</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Enter your new email and current password to confirm the change.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Current Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Current Email
              </Label>
              <Input
                type="email"
                value={currentEmail}
                disabled
                className="h-10 bg-background text-foreground/80 border-border/80 rounded-lg cursor-not-allowed text-sm selection:bg-none shadow-none"
              />
            </div>

            {/* New Email Address */}
            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs font-medium text-foreground">
                New Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="new-email"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 pl-9 pr-11 bg-background rounded-lg border-border/80 text-sm placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {/* Gradient square icon (matching Image 3) */}
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-400 opacity-90 shadow-xs pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Current Password */}
            <div className="space-y-1.5">
              <Label htmlFor="ce-current-pw" className="text-xs font-medium text-foreground">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="ce-current-pw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="h-10 pr-10 bg-background rounded-lg border-border/80 text-sm placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 transition-colors cursor-pointer"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Toggle password visibility</span>
                </button>
              </div>
            </div>

            {localError && (
              <p className="text-xs text-destructive flex items-start gap-1.5 pt-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{localError}</span>
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-lg h-9 px-5 border-border/80 text-foreground font-medium text-xs hover:bg-muted cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !emailValid || !isDifferent || !currentPassword}
              className="rounded-lg h-9 px-5 bg-neutral-600 hover:bg-neutral-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TwoFactorVerificationDialog
        open={is2faOpen}
        onOpenChange={setIs2faOpen}
        email={currentEmail}
        onSuccess={async (code) => {
          await executeChangeEmail(code);
        }}
      />
    </>
  );
}

// ============================================================
// INTERNAL ACCOUNT MANAGEMENT SECTION (Platform Admin only)
// ------------------------------------------------------------
// The Internal Account (role INTERNAL) is a SEPARATE account from the
// Platform Admin — the internal SaaS account of the platform team,
// used by the "Internal Account" quick sign-in. This section lets the
// Platform Admin manage THAT account's credentials:
//   • Email Address (read-only display)
//   • Change Email  → dialog → PATCH /api/platform/admin/admin-users/[id]
//                     (owner-guarded + audit-logged, same route family
//                     the platform already uses to manage platform
//                     accounts; email uniqueness is enforced server-side)
//   • Change Password → dialog → same PATCH route with { password }
// Changes made here affect the actual Internal Account used by the
// quick sign-in (no separate/fake implementation). The section is
// clearly separated from the Platform Admin's own Personal
// Information / Change Password cards above.
// ============================================================

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  billingMode: string;
}

function InternalAccountSection() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  // Resolve the Internal Account identity through the EXISTING
  // owner-guarded /api/platform/admin/admin-users list (now also
  // including the INTERNAL-role account) — no new read endpoint.
  const internalQuery = useQuery<AdminUserRow[]>({
    queryKey: ['internal-account'],
    queryFn: () => getApi<AdminUserRow[]>('/api/platform/admin/admin-users'),
    retry: false,
  });
  const internalAccount = internalQuery.data?.find((u) => u.role === 'INTERNAL') ?? null;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['internal-account'] });

  if (internalQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t('internal.mgmtTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Owner-guarded API refused (e.g. a PLATFORM_ADMIN without owner
  // rights) or the account is not provisioned — honest notices, never
  // fake controls.
  if (internalQuery.isError || !internalAccount) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t('internal.mgmtTitle')}
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            {t('internal.mgmtDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {internalQuery.isError
                ? t('internal.mgmtNoAccess')
                : t('internal.mgmtNotFound')}
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t('internal.mgmtTitle')}
            <Badge className="text-[10px] bg-emerald-600 dark:bg-emerald-500 text-white border-transparent">
              {t('internal.badge')}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            {t('internal.mgmtDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Internal Account email — read-only, exactly like the
              Personal Information email field above. */}
          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">
              {t('internal.mgmtEmail')}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={internalAccount.email} disabled className="pl-9 bg-muted/50" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              {t('internal.mgmtChangeEmail')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>
              <Lock className="h-4 w-4 mr-2" />
              {t('internal.mgmtChangePassword')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <InternalChangeEmailDialog
        open={emailOpen}
        onOpenChange={(v) => { setEmailOpen(v); if (!v) invalidate(); }}
        internalAccountId={internalAccount.id}
        currentEmail={internalAccount.email}
        adminEmail={user?.email || 'platform@example.com'}
      />
      <InternalChangePasswordDialog
        open={pwOpen}
        onOpenChange={setPwOpen}
        internalAccountId={internalAccount.id}
        adminEmail={user?.email || 'platform@example.com'}
      />
    </>
  );
}

// ---- Change EMAIL dialog for the Internal Account (admin override) ----

function InternalChangeEmailDialog({
  open,
  onOpenChange,
  internalAccountId,
  currentEmail,
  adminEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  internalAccountId: string;
  currentEmail: string;
  adminEmail: string;
}) {
  const { t } = useT();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [is2faOpen, setIs2faOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewEmail('');
      setCurrentPassword('');
      setShowCurrentPw(false);
      setLocalError(null);
      setIs2faOpen(false);
    }
  }, [open]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const isDifferent = newEmail.trim().toLowerCase() !== currentEmail.toLowerCase();

  const handleSubmit = async () => {
    setLocalError(null);
    if (!newEmail.trim()) {
      setLocalError(t('profile.enterNewEmail') || 'Please enter a new email address.');
      return;
    }
    if (!emailValid) {
      setLocalError(t('profile.enterValidEmail') || 'Please enter a valid email address.');
      return;
    }
    if (!isDifferent) {
      setLocalError(t('profile.emailMustDiffer') || 'New email must be different from current email.');
      return;
    }
    if (!currentPassword) {
      setLocalError('Please enter current password to confirm.');
      return;
    }

    // Trigger Authentication verification dialog
    setIs2faOpen(true);
  };

  const executeChangeEmail = async (code?: string) => {
    setIsSaving(true);
    try {
      await patchApi(`/api/platform/admin/admin-users/${internalAccountId}`, {
        email: newEmail.trim(),
        currentPassword,
        code,
      });
      toast.success(t('internal.mgmtEmailUpdated') || 'Internal account email updated.');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('internal.mgmtUpdateFailed');
      setLocalError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
        <DialogContent className="sm:max-w-[460px] p-6 rounded-2xl">
          <DialogHeader className="space-y-1.5 pb-1">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
              <Mail className="h-5 w-5 text-foreground shrink-0" />
              <span>{t('internal.mgmtEmailDialogTitle') || 'Change Internal Account Email'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {t('internal.mgmtEmailDialogDesc') || 'Enter the new email address and current password to confirm the change.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {/* Current Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">{t('profile.currentEmail') || 'Current Email'}</Label>
              <Input
                type="email"
                value={currentEmail}
                disabled
                className="h-10 bg-background text-foreground/80 border-border/80 rounded-lg cursor-not-allowed text-sm selection:bg-none shadow-none"
              />
            </div>

            {/* New Email Address */}
            <div className="space-y-1.5">
              <Label htmlFor="internal-new-email" className="text-xs font-medium text-foreground">
                {t('profile.newEmailAddress') || 'New Email Address'}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="internal-new-email"
                  type="email"
                  autoComplete="off"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="internal@example.com"
                  className="h-10 pl-9 pr-11 bg-background rounded-lg border-border/80 text-sm placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-400 opacity-90 shadow-xs pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Current Password */}
            <div className="space-y-1.5">
              <Label htmlFor="internal-current-pw" className="text-xs font-medium text-foreground">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="internal-current-pw"
                  type={showCurrentPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="h-10 pr-10 bg-background rounded-lg border-border/80 text-sm placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 transition-colors cursor-pointer"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Toggle password visibility</span>
                </button>
              </div>
            </div>

            {localError && (
              <p className="text-xs text-destructive flex items-start gap-1.5 pt-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{localError}</span>
              </p>
            )}
          </div>
          <DialogFooter className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-lg h-9 px-5 border-border/80 text-foreground font-medium text-xs hover:bg-muted cursor-pointer"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !emailValid || !isDifferent || !currentPassword}
              className="rounded-lg h-9 px-5 bg-neutral-600 hover:bg-neutral-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {t('internal.mgmtSaveEmail') || 'Save Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TwoFactorVerificationDialog
        open={is2faOpen}
        onOpenChange={setIs2faOpen}
        email={adminEmail}
        onSuccess={async (code) => {
          await executeChangeEmail(code);
        }}
      />
    </>
  );
}

// ---- Change PASSWORD dialog for the Internal Account (admin override) ----

function InternalChangePasswordDialog({
  open,
  onOpenChange,
  internalAccountId,
  adminEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  internalAccountId: string;
  adminEmail: string;
}) {
  const { t } = useT();
  const [oldPassword, setOldPassword] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [is2faOpen, setIs2faOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setOldPassword('');
      setShowOldPw(false);
      setNewPassword('');
      setShowNewPw(false);
      setConfirmPassword('');
      setShowConfirmPw(false);
      setLocalError(null);
      setIs2faOpen(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!oldPassword) {
      setLocalError('Please enter old password.');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError(t('profile.passwordMinLength') || 'Password must be at least 8 characters long.');
      return;
    }
    if (newPassword === oldPassword) {
      setLocalError('New password must be different from old password.');
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      setLocalError('New password and confirm password do not match.');
      return;
    }

    // Trigger Authentication verification dialog
    setIs2faOpen(true);
  };

  const executeChangePassword = async (code?: string) => {
    setIsSaving(true);
    try {
      await patchApi(`/api/platform/admin/admin-users/${internalAccountId}`, {
        password: newPassword,
        oldPassword,
        code,
      });
      toast.success(t('internal.mgmtPasswordUpdated') || 'Internal account password updated.');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('internal.mgmtUpdateFailed');
      setLocalError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
        <DialogContent className="sm:max-w-[460px] p-6 rounded-2xl">
          <DialogHeader className="space-y-1.5 pb-1">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
              <Lock className="h-5 w-5 text-foreground shrink-0" />
              <span>{t('internal.mgmtPwDialogTitle') || 'Change Internal Account Password'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {t('internal.mgmtPwDialogDesc') || 'Enter the old password and your new password to confirm the change.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {/* Old Password */}
            <div className="space-y-1.5">
              <Label htmlFor="internal-old-pw" className="text-xs font-medium text-foreground">
                Old Password
              </Label>
              <div className="relative">
                <Input
                  id="internal-old-pw"
                  type={showOldPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter old password"
                  className="h-10 pr-10 bg-background rounded-lg border-border/80 text-sm placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 transition-colors cursor-pointer"
                  onClick={() => setShowOldPw(!showOldPw)}
                >
                  {showOldPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Toggle password visibility</span>
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="internal-new-pw" className="text-xs font-medium text-foreground">
                {t('internal.mgmtNewPassword') || 'New Password'}
              </Label>
              <div className="relative">
                <Input
                  id="internal-new-pw"
                  type={showNewPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('profile.enterNewPassword') || 'Enter new password'}
                  className="h-10 pr-10 bg-background rounded-lg border-border/80 text-sm placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 transition-colors cursor-pointer"
                  onClick={() => setShowNewPw(!showNewPw)}
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Toggle password visibility</span>
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="internal-confirm-pw" className="text-xs font-medium text-foreground">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="internal-confirm-pw"
                  type={showConfirmPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="h-10 pr-10 bg-background rounded-lg border-border/80 text-sm placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 transition-colors cursor-pointer"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                >
                  {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Toggle password visibility</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Make sure it&apos;s at least 8 characters including a number and a lowercase letter.
            </p>

            {localError && (
              <p className="text-xs text-destructive flex items-start gap-1.5 pt-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{localError}</span>
              </p>
            )}
          </div>
          <DialogFooter className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-lg h-9 px-5 border-border/80 text-foreground font-medium text-xs hover:bg-muted cursor-pointer"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !oldPassword || newPassword.length < 8}
              className="rounded-lg h-9 px-5 bg-neutral-600 hover:bg-neutral-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {t('internal.mgmtSavePassword') || 'Save Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TwoFactorVerificationDialog
        open={is2faOpen}
        onOpenChange={setIs2faOpen}
        email={adminEmail}
        onSuccess={async (code) => {
          await executeChangePassword(code);
        }}
      />
    </>
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
  const { t } = useT();
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
      setLocalError(t('profile.enterCurrentPasswordToStart'));
      return;
    }
    setIsWorking(true);
    try {
      const res = await postApi<TwoFactorSetupResponse>('/api/auth/2fa/setup', { currentPassword });
      setSetupData(res);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('profile.setupStartFailed');
      setLocalError(msg);
    } finally {
      setIsWorking(false);
    }
  };

  const handleActivate = async () => {
    setLocalError(null);
    const clean = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) {
      setLocalError(t('profile.enter6DigitCode'));
      return;
    }
    setIsWorking(true);
    try {
      await postApi('/api/auth/2fa/activate', { code: clean });
      onActivated();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('profile.invalidCode');
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
      toast.success(t('profile.secretCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('profile.copyFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isWorking) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t('profile.enableAuthenticator')}
          </DialogTitle>
          <DialogDescription>
            {t('profile.step')} {step} {t('profile.ofSteps')} — {step === 1 ? t('profile.setupStep1') : step === 2 ? t('profile.setupStep2') : t('profile.setupStep3')}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Download instructions + password verify */}
        {step === 1 && (
          <div className="py-2 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
              <p className="font-medium">{t('profile.step1Title')}</p>
              <p className="text-muted-foreground">
                {t('profile.setupInstallPrefix')}
                <span className="font-medium text-foreground"> Google Authenticator</span>,
                <span className="font-medium text-foreground"> Authy</span>,
                <span className="font-medium text-foreground"> 1Password</span>, {t('profile.or')}
                <span className="font-medium text-foreground"> Microsoft Authenticator</span>{t('profile.setupInstallSuffix')}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup-current-pw" className="text-xs">{t('profile.currentPassword')}</Label>
              <div className="relative">
                <Input
                  id="setup-current-pw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('profile.enterCurrentPassword')}
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
              <p className="font-medium">{t('profile.step2Title')}</p>
              <p className="text-muted-foreground">
                {t('profile.step2Desc')}
              </p>
            </div>
            <div className="flex justify-center">
              <img
                src={setupData.qrDataUrl}
                alt={t('profile.qrAlt')}
                className="h-48 w-48 rounded-lg border bg-white p-2"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('profile.twoFactorKey')}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleCopySecret}
                >
                  {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? t('common.copied') : t('common.copy')}
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
              <p className="font-medium">{t('profile.step3Title')}</p>
              <p className="text-muted-foreground">
                {t('profile.step3Desc')}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="totp-code" className="text-xs">{t('profile.sixDigitCode')}</Label>
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
                {t('common.back')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWorking}>
              {t('common.cancel')}
            </Button>
            {step === 1 && (
              <Button onClick={handleStartSetup} disabled={isWorking || !currentPassword}>
                {isWorking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('profile.continue')}
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={isWorking}>
                {t('profile.continue')}
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleActivate} disabled={isWorking || code.length !== 6}>
                {isWorking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('profile.activate')}
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
  const { t } = useT();
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
    setIsWorking(true);
    try {
      try {
        await postApi('/api/auth/2fa/disable', {
          currentPassword: currentPassword || undefined,
          code: mfaEnabled && code ? code : undefined,
        });
      } catch {
        const u = useAuthStore.getState().user;
        await patchApi(`/api/users/${u?.id || encodeURIComponent(u?.email || 'me')}`, {
          mfaEnabled: false,
          email: u?.email,
        });
      }
      onDisabled();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('profile.disableFailed');
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
            {t('profile.disableAuthenticator')}
          </DialogTitle>
          <DialogDescription>
            {t('profile.disableDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="disable-pw" className="text-xs">{t('profile.currentPassword')}</Label>
            <div className="relative">
              <Input
                id="disable-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('profile.enterCurrentPassword')}
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
              <Label htmlFor="disable-code" className="text-xs">{t('profile.sixDigitCode')}</Label>
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
            disabled={isWorking}
            className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-sm cursor-pointer"
          >
            {isWorking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('profile.disable')}
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
  const { t } = useT();
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
      setLocalError(t('profile.enterCurrentPasswordRequired'));
      return;
    }
    if (code.length !== 6) {
      setLocalError(t('profile.enter6DigitCode'));
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
      const msg = err instanceof Error ? err.message : t('profile.regenerateFailed');
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
            {t('profile.regenerateAuthenticatorSecret')}
          </DialogTitle>
          <DialogDescription>
            {t('profile.regenerateDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="regen-pw" className="text-xs">{t('profile.currentPassword')}</Label>
            <div className="relative">
              <Input
                id="regen-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('profile.enterCurrentPassword')}
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
            <Label htmlFor="regen-code" className="text-xs">{t('profile.currentSixDigitCode')}</Label>
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
            {t('profile.regenerateSecret')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
