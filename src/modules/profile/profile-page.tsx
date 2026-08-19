'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, type CurrentUser } from '@/lib/stores/auth-store';
import { useSubscriptionStore, getPlanBadgeClasses } from '@/lib/stores/subscription-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useT } from '@/lib/i18n';
import { getInitials, formatDateTime } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  CreditCard,
  Loader2,
  Lock,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useT();
  const currentPlan = useSubscriptionStore((s) => s.currentPlan);
  const subscriptionStatus = useSubscriptionStore((s) => s.status);
  const navigate = useNavigationStore((s) => s.navigate);

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

  // Delete account
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  // ---- Handlers ----

  const handleSaveName = async () => {
    if (!name.trim() || !user) return;
    setIsSavingName(true);
    try {
      const { patchApi } = await import('@/lib/api-client');
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
      const { postApi } = await import('@/lib/api-client');
      await postApi('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to change password';
      toast.error(msg);
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== user.email) {
      toast.error('Please type your email to confirm');
      return;
    }
    setIsDeleting(true);
    try {
      const { deleteApi } = await import('@/lib/api-client');
      await deleteApi(`/api/users/${user.id}`);
      toast.success('Account deleted');
      await logout();
    } catch {
      toast.error('Failed to delete account');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleManageBilling = () => navigate('billing');

  if (!user) return null;

  const memberSince = user.createdAt
    ? formatDateTime(user.createdAt)
    : t('profile.memberSinceUnknown');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
              <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{user.name}</h2>
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${getPlanBadgeClasses(currentPlan.badgeVariant)}`}
                >
                  {currentPlan.name}
                </Badge>
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
          <div className="flex justify-end">
            <Button onClick={handleSaveName} disabled={isSavingName || name.trim() === user.name}>
              {isSavingName && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('profile.saveChanges')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.subscription')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('profile.currentPlan')}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-semibold">{currentPlan.name}</span>
                <Badge variant="outline" className={`text-[10px] font-semibold ${getPlanBadgeClasses(currentPlan.badgeVariant)}`}>
                  {currentPlan.name}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentPlan.price === 0
                  ? t('billing.free')
                  : `${currentPlan.price} ${currentPlan.currency}/${currentPlan.interval}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={subscriptionStatus === 'active' ? 'default' : 'outline'} className="capitalize">
                {subscriptionStatus}
              </Badge>
              <Button size="sm" variant="outline" onClick={handleManageBilling}>
                {t('billing.manage')}
              </Button>
            </div>
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

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.account')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="secondary">{user.role.replace(/_/g, ' ')}</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={user.status === 'ACTIVE' ? 'default' : 'outline'}>{user.status}</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('profile.memberSince')}</span>
            <span className="text-foreground">{memberSince}</span>
          </div>
        </CardContent>
      </Card>

      {/* Security Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add an extra layer of security to your account.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Two-factor authentication is not yet available"
            >
              Setup 2FA
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">Delete My User Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Type <strong className="text-foreground">{user.email}</strong> to confirm:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={user.email}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting || deleteConfirmText !== user.email}
              onClick={handleDeleteAccount}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
