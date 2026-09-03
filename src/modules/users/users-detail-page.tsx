'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Pencil,
  Loader2,
  Globe,
  Github,
  Linkedin,
  Twitter,
  Key,
  Clock,
  Shield,
  Mail,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge, PageHeader } from '@/components/patterns';
import { AvatarWithFallback } from '@/components/shared';
import { getApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import {
  cn,
  formatDate,
  formatRelativeTime,
  labelize,
  truncate,
} from '@/lib/utils';
import type {
  UserRole,
  UserStatus,
  SelectOption,
} from '@/shared/types';
import { useT } from '@/lib/i18n';

// -------------------- Types --------------------

interface AuthorProfileData {
  id: string;
  displayName?: string | null;
  slug?: string | null;
  bio?: string | null;
  website?: string | null;
  twitter?: string | null;
  github?: string | null;
  linkedin?: string | null;
  avatar?: string | null;
}

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  type: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string; avatar?: string | null } | null;
}

interface ContentItemRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  contentType?: { name: string } | null;
  publishedAt?: string | null;
  createdAt: string;
}

interface UserData {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  bio?: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  authorProfile?: AuthorProfileData | null;
}

interface EditFormData {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  bio: string;
  avatar: string;
}

// -------------------- Constants --------------------

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50',
  EDITOR:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
};

// -------------------- Component --------------------

export function UsersDetailPage({ userId }: { userId: string }) {
  const { t } = useT();
  const navigate = useNavigationStore((s) => s.navigate);
  const queryClient = useQueryClient();

  // Role/Status options (translated at render time so labels switch with locale)
  const ROLE_OPTIONS: SelectOption<UserRole>[] = useMemo(() => [
    { label: t('users.roleAdmin'), value: 'ADMIN' },
    { label: t('users.roleEditor'), value: 'EDITOR' },
  ], [t]);
  const STATUS_OPTIONS: SelectOption<UserStatus>[] = useMemo(() => [
    { label: t('common.active'), value: 'ACTIVE' },
    { label: t('users.statusInvited'), value: 'INVITED' },
    { label: t('users.statusSuspended'), value: 'SUSPENDED' },
    { label: t('users.statusDeactivated'), value: 'DEACTIVATED' },
  ], [t]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formData, setFormData] = useState<EditFormData>({
    name: '',
    email: '',
    role: 'EDITOR',
    status: 'ACTIVE',
    bio: '',
    avatar: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch user detail
  const {
    data: user,
    isLoading: isLoadingUser,
  } = useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => getApi<UserData>(`/api/users/${userId}`),
    staleTime: 10_000,
    enabled: !!userId,
  });

  // Fetch user's API keys
  const { data: apiKeys } = useQuery({
    queryKey: ['user-api-keys', userId],
    queryFn: () =>
      getApi<ApiKeyRow[]>(`/api/api-keys?pageSize=100&userId=${userId}`),
    staleTime: 30_000,
    enabled: !!userId,
  });

  // Fetch user's audit logs
  const { data: auditLogsData } = useQuery({
    queryKey: queryKeys.auditLog.list({ userId }),
    queryFn: () =>
      getApi<{ data: AuditLogRow[]; pagination: { total: number } }>(
        '/api/audit-logs',
        { userId, pageSize: 20, sort: 'createdAt', order: 'desc' },
      ),
    staleTime: 10_000,
    enabled: !!userId,
  });

  // Fetch user's content
  const { data: contentData } = useQuery({
    queryKey: ['user-content', userId],
    queryFn: () =>
      getApi<{ data: ContentItemRow[]; pagination: { total: number } }>(
        '/api/content',
        { authorId: userId, pageSize: 20, sort: 'updatedAt', order: 'desc' },
      ),
    staleTime: 10_000,
    enabled: !!userId,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<EditFormData>) =>
      patchApi(`/api/users/${userId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setDrawerOpen(false);
      setFormErrors({});
    },
  });

  const openEditDrawer = useCallback(() => {
    if (user) {
      setFormData({
        name: user.name ?? '',
        email: user.email,
        role: user.role,
        status: user.status,
        bio: user.bio ?? '',
        avatar: user.avatar ?? '',
      });
      setFormErrors({});
    }
    setDrawerOpen(true);
  }, [user]);

  const handleSave = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t('users.nameRequired');
    if (!formData.email.trim()) errors.email = t('users.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = t('users.invalidEmail');
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    updateMutation.mutate({
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role,
      status: formData.status,
      bio: formData.bio.trim() || undefined,
      avatar: formData.avatar.trim() || '',
    });
  }, [formData, updateMutation, t]);

  const auditLogs = auditLogsData?.data ?? [];
  const contentItems = contentData?.data ?? [];
  const keys = apiKeys ?? [];

  // Social links from author profile
  const profile = user?.authorProfile;

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center py-20">
        <h2 className="text-xl font-semibold">{t('users.notFound')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('users.notFoundDescription')}
        </p>
        <Button variant="outline" onClick={() => navigate('users')}>
          {t('users.backToUsers')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('users')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">{t('users.backToUsersSr')}</span>
        </Button>
        <PageHeader
          title={user.name || t('users.unnamedUser')}
          description={user.email}
          action={
            <Button size="sm" onClick={openEditDrawer}>
              <Pencil className="h-4 w-4 mr-2" />
              {t('users.editUser')}
            </Button>
          }
        />
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <AvatarWithFallback
              src={user.avatar ?? undefined}
              name={user.name || user.email}
              size="lg"
              className="h-20 w-20 text-2xl"
            />
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {user.name || t('users.unnamedUser')}
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    'font-medium text-[11px] leading-4 px-1.5 py-0',
                    ROLE_COLORS[user.role],
                  )}
                >
                  {labelize(user.role)}
                </Badge>
                <StatusBadge status={user.status} size="sm" />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </span>
                {user.lastLoginAt && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {t('users.lastLogin')} {formatRelativeTime(user.lastLoginAt)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t('users.memberSince')} {formatDate(user.createdAt)}
                </span>
              </div>
              {user.emailVerified && (
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-muted-foreground">
                    {t('users.emailVerified')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('users.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="content">
            {t('users.tabs.content')}
            {contentItems.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                {contentItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">
            {t('users.tabs.activity')}
            {auditLogs.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                {auditLogs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profile Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {t('users.profileInformation')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {user.bio && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('users.bio')}</p>
                    <p className="text-sm leading-relaxed">{user.bio}</p>
                  </div>
                )}
                {!user.bio && profile?.bio && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('users.authorBio')}
                    </p>
                    <p className="text-sm leading-relaxed">{profile.bio}</p>
                  </div>
                )}
                {!user.bio && !profile?.bio && (
                  <p className="text-sm text-muted-foreground italic">
                    {t('users.noBio')}
                  </p>
                )}
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('users.role')}</p>
                    <p className="font-medium">{labelize(user.role)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('common.status')}</p>
                    <StatusBadge status={user.status} size="sm" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('users.mfa')}</p>
                    <p className="font-medium">
                      {user.mfaEnabled ? t('users.enabled') : t('users.disabled')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('users.authorSlug')}
                    </p>
                    <p className="font-medium font-mono text-xs">
                      {profile?.slug || '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Social Links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {t('users.socialLinks')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile ? (
                  <div className="space-y-3">
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors"
                      >
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{profile.website}</span>
                      </a>
                    )}
                    {profile.twitter && (
                      <a
                        href={profile.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors"
                      >
                        <Twitter className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{profile.twitter}</span>
                      </a>
                    )}
                    {profile.github && (
                      <a
                        href={profile.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors"
                      >
                        <Github className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{profile.github}</span>
                      </a>
                    )}
                    {profile.linkedin && (
                      <a
                        href={profile.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors"
                      >
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{profile.linkedin}</span>
                      </a>
                    )}
                    {!profile.website &&
                      !profile.twitter &&
                      !profile.github &&
                      !profile.linkedin && (
                        <p className="text-sm text-muted-foreground italic">
                          {t('users.noSocialLinks')}
                        </p>
                      )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t('users.noAuthorProfile')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* API Keys */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                {t('users.apiKeys')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {keys.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {keys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{key.name}</p>
                          <StatusBadge
                            status={key.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                            size="sm"
                          />
                          <Badge variant="outline" className="text-[10px]">
                            {key.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          {key.keyPrefix}...
                        </p>
                        {key.lastUsedAt && (
                          <p className="text-xs text-muted-foreground">
                            {t('users.lastUsed')} {formatRelativeTime(key.lastUsedAt)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {t('users.created')} {formatDate(key.createdAt)}
                        </p>
                        {key.expiresAt && (
                          <p className="text-xs text-muted-foreground">
                            {t('users.expires')} {formatDate(key.expiresAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {t('users.noApiKeys')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {t('users.contentByPrefix')} {user.name || t('users.contentByDefault')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contentItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">{t('users.titleColumn')}</TableHead>
                      <TableHead>{t('users.typeColumn')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('users.updatedColumn')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contentItems.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate('content', item.id)}
                      >
                        <TableCell className="font-medium">
                          <div>
                            <p className="text-sm truncate max-w-[300px]">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              /{item.slug}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.contentType?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} size="sm" />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground italic py-8 text-center">
                  {t('users.noContent')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {t('users.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="mt-0.5 shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {labelize(log.action)}
                          </span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {log.resourceType}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(log.createdAt)}
                          {log.ipAddress && (
                            <span className="ml-2">{t('users.fromIp')} {log.ipAddress}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic py-8 text-center">
                  {t('users.noRecentActivity')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="sm:max-w-[640px] w-full overflow-y-auto p-0"
        >
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>{t('users.editUser')}</SheetTitle>
            <SheetDescription>
              {t('users.editUserSheetDescription')}
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-5">
            {/* Avatar preview */}
            <div className="flex items-center gap-4">
              <AvatarWithFallback
                src={formData.avatar || undefined}
                name={formData.name || t('users.user')}
                size="lg"
              />
              <div>
                <p className="font-medium text-sm">
                  {formData.name || t('users.unnamed')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formData.email}
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="detail-edit-name">
                {t('common.name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="detail-edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={t('users.fullNamePlaceholder')}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="detail-edit-email">
                {t('common.email')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="detail-edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder={t('users.emailPlaceholder')}
              />
              {formErrors.email && (
                <p className="text-xs text-destructive">{formErrors.email}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="detail-edit-role">{t('users.role')}</Label>
              <Select
                value={formData.role}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    role: v as UserRole,
                  }))
                }
              >
                <SelectTrigger id="detail-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="detail-edit-status">{t('common.status')}</Label>
              <Select
                value={formData.status}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: v as UserStatus,
                  }))
                }
              >
                <SelectTrigger id="detail-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="detail-edit-bio">{t('users.bio')}</Label>
              <Textarea
                id="detail-edit-bio"
                value={formData.bio}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder={t('users.shortBioPlaceholder')}
                rows={3}
              />
            </div>

            {/* Avatar URL */}
            <div className="space-y-2">
              <Label htmlFor="detail-edit-avatar">{t('users.avatarUrl')}</Label>
              <Input
                id="detail-edit-avatar"
                value={formData.avatar}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, avatar: e.target.value }))
                }
                placeholder={t('users.avatarUrlPlaceholder')}
              />
            </div>
          </div>

          <SheetFooter className="p-6 pt-4 border-t">
            <div className="flex items-center justify-end gap-2 w-full">
              <SheetClose asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDrawerOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
              </SheetClose>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t('common.saveChanges')}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
