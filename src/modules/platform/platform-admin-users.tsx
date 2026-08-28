'use client';

// ============================================================
// PLATFORM ADMIN USERS — OWNER / PLATFORM_ADMIN management.
// ============================================================
// Only the OWNER can list / create / update platform admins. Normal
// clients can never access or create platform admins (enforced
// server-side via requireOwner). 2FA status (mfaEnabled) is surfaced
// and recommended for OWNER and PLATFORM_ADMIN. Passwords are never
// returned by the API.
// ============================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, patchApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Plus, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';
import { PlatformPageHeader, ErrorState, EmptyState, formatDate } from '@/modules/platform/shared';
import { useAuthStore } from '@/lib/stores/auth-store';

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'PLATFORM_ADMIN';
  status: string;
  billingMode: string;
  mfaEnabled: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export function PlatformAdminUsersModule() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [billingMode, setBillingMode] = useState<'EXTERNAL' | 'INTERNAL' | 'EXEMPT'>('EXTERNAL');

  const usersQuery = useQuery({
    queryKey: ['platform-admin-users'],
    queryFn: () => getApi<AdminUserRow[]>('/api/platform/admin/admin-users'),
    enabled: isOwner,
  });

  const createMutation = useMutation({
    mutationFn: () => postApi<AdminUserRow>('/api/platform/admin/admin-users', { email, name, password, billingMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admin-users'] });
      setShowForm(false);
      setEmail(''); setName(''); setPassword(''); setBillingMode('EXTERNAL');
      toast.success('Platform admin created.');
    },
    onError: () => toast.error('Unable to create admin user.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdminUserRow> & { password?: string } }) =>
      patchApi<AdminUserRow>(`/api/platform/admin/admin-users/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admin-users'] }),
  });

  return (
    <div className="space-y-4">
      <PlatformPageHeader
        title="Admin Users"
        subtitle="Manage OWNER and PLATFORM_ADMIN accounts. 2FA is recommended for all platform admins. Only the OWNER can manage admins."
        actions={
          isOwner ? (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4 mr-2" /> New Admin
            </Button>
          ) : null
        }
      />

      {!isOwner ? (
        <Card>
          <CardContent className="p-4 flex items-start gap-3 bg-amber-50/50 dark:bg-amber-950/20">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-400">Owner-only</p>
              <p className="text-muted-foreground">Managing platform admins is restricted to the OWNER role.</p>
            </div>
          </CardContent>
        </Card>
      ) : showForm ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password (demo)</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Billing Mode</Label>
                <Select value={billingMode} onValueChange={(v) => setBillingMode(v as 'EXTERNAL' | 'INTERNAL' | 'EXEMPT')}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXTERNAL">EXTERNAL (paying)</SelectItem>
                    <SelectItem value="INTERNAL">INTERNAL (bypass)</SelectItem>
                    <SelectItem value="EXEMPT">EXEMPT (complimentary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">New admins are created with the PLATFORM_ADMIN role.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!email || !password || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-4">
          {usersQuery.isLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : usersQuery.isError || !usersQuery.data ? (
            <ErrorState message="Unable to load admin users." onRetry={() => usersQuery.refetch()} />
          ) : usersQuery.data.length === 0 ? (
            <EmptyState message="No platform admins." icon={<ShieldCheck className="h-5 w-5 opacity-50" />} />
          ) : (
            <div className="divide-y">
              {usersQuery.data.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{u.name ?? u.email}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{u.role}</Badge>
                      <Badge variant="outline" className="text-[10px]">{u.billingMode}</Badge>
                      {u.role === 'OWNER' && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">owner</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-muted-foreground">Created {formatDate(u.createdAt ?? null)}</span>
                      {!u.mfaEnabled && (
                        <span className="text-[11px] text-amber-600 flex items-center gap-1">
                          <KeyRound className="h-3 w-3" /> 2FA recommended
                        </span>
                      )}
                      {u.mfaEnabled && (
                        <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> 2FA on
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={u.billingMode}
                      onValueChange={(v) => updateMutation.mutate({ id: u.id, patch: { billingMode: v as 'EXTERNAL' | 'INTERNAL' | 'EXEMPT' } })}
                    >
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXTERNAL">EXTERNAL</SelectItem>
                        <SelectItem value="INTERNAL">INTERNAL</SelectItem>
                        <SelectItem value="EXEMPT">EXEMPT</SelectItem>
                      </SelectContent>
                    </Select>
                    {u.role !== 'OWNER' && (
                      <Switch
                        checked={u.status === 'ACTIVE'}
                        onCheckedChange={(v) => updateMutation.mutate({ id: u.id, patch: { status: v ? 'ACTIVE' : 'SUSPENDED' } })}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
