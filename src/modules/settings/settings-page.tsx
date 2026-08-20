'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Save, Loader2, RotateCcw, Shield, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApi, postApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// -------------------- Spam Provider Options --------------------
// Extensible: add new providers here to make them available in the dropdown.
const SPAM_PROVIDERS = [
  { label: 'None', value: 'none' },
  { label: 'Akismet', value: 'akismet' },
  { label: 'Custom', value: 'custom' },
] as const;

// -------------------- Discussion Settings Page --------------------

export function SettingsPage() {
  const queryClient = useQueryClient();

  // Fetch discussion settings from the API
  // The API returns an object: { enable_comments: "true", comment_auto_spam_detection: "true", ... }
  const { data, isLoading } = useQuery<Record<string, string> | null>({
    queryKey: ['settings', 'discussion'],
    queryFn: () => getApi<Record<string, string> | null>('/api/settings?category=DISCUSSION'),
    staleTime: 10_000,
  });

  // Derive setting values from fetched data (with defaults from settings-service)
  const savedComments = data?.enable_comments !== 'false'; // default: true
  const savedSpamDetection = data?.comment_auto_spam_detection === 'true'; // default: true
  const savedSpamProvider = data?.comment_spam_provider || 'none'; // default: none
  const savedNotifications = data?.comment_notification !== 'false'; // default: true

  // Local state — initialized from fetched data, synced before user interaction
  const [commentsEnabled, setCommentsEnabled] = useState(savedComments);
  const [spamDetectionEnabled, setSpamDetectionEnabled] = useState(savedSpamDetection);
  const [spamProvider, setSpamProvider] = useState(savedSpamProvider);
  const [commentNotifications, setCommentNotifications] = useState(savedNotifications);
  const [isDirty, setIsDirty] = useState(false);

  // Sync state when data first loads (before user interaction)
  const dataVersion = data ? JSON.stringify(data) : '';
  const [lastDataVersion, setLastDataVersion] = useState('');
  if (dataVersion && dataVersion !== lastDataVersion && !isDirty) {
    setLastDataVersion(dataVersion);
    setCommentsEnabled(savedComments);
    setSpamDetectionEnabled(savedSpamDetection);
    setSpamProvider(savedSpamProvider);
    setCommentNotifications(savedNotifications);
  }

  // Wrap setters to mark dirty
  const updateComments = (v: boolean) => { setIsDirty(true); setCommentsEnabled(v); };
  const updateSpamDetection = (v: boolean) => { setIsDirty(true); setSpamDetectionEnabled(v); };
  const updateSpamProvider = (v: string) => { setIsDirty(true); setSpamProvider(v); };
  const updateCommentNotifications = (v: boolean) => { setIsDirty(true); setCommentNotifications(v); };

  // Save mutation — uses the batch upsert API
  const saveMutation = useMutation({
    mutationFn: () =>
      postApi('/api/settings', {
        settings: [
          { key: 'enable_comments', value: String(commentsEnabled), type: 'BOOLEAN', category: 'DISCUSSION' },
          { key: 'comment_auto_spam_detection', value: String(spamDetectionEnabled), type: 'BOOLEAN', category: 'DISCUSSION' },
          { key: 'comment_spam_provider', value: spamProvider, type: 'STRING', category: 'DISCUSSION' },
          { key: 'comment_notification', value: String(commentNotifications), type: 'BOOLEAN', category: 'DISCUSSION' },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setIsDirty(false);
      toast.success('Settings saved successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save settings'),
  });

  // Reset to defaults
  const handleReset = useCallback(() => {
    setIsDirty(true);
    setCommentsEnabled(true);
    setSpamDetectionEnabled(true);
    setSpamProvider('none');
    setCommentNotifications(true);
    toast.info('Settings reset to defaults (click Save to persist)');
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 animate-pulse bg-muted rounded" />
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse bg-muted rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Discussion Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure how comments work on your site.</p>
      </div>

      {/* Discussion Settings Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Comment Settings</CardTitle>
          </div>
          <CardDescription>Control comment behavior, spam protection, and notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 1. Enable Comments */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enable Comments</Label>
              <p className="text-xs text-muted-foreground">Enables or disables comments globally.</p>
            </div>
            <Switch checked={commentsEnabled} onCheckedChange={updateComments} />
          </div>

          {/* 2. Auto Spam Detection */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Auto Spam Detection
              </Label>
              <p className="text-xs text-muted-foreground">Automatically checks comments for spam.</p>
            </div>
            <Switch checked={spamDetectionEnabled} onCheckedChange={updateSpamDetection} />
          </div>

          {/* 3. Spam Provider (only visible when spam detection is enabled) */}
          {spamDetectionEnabled && (
            <div className={cn('space-y-2 transition-all')}>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Spam Provider</Label>
                <Select value={spamProvider} onValueChange={updateSpamProvider}>
                  <SelectTrigger className="w-full sm:w-[240px]">
                    <SelectValue placeholder="Select a spam provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPAM_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Choose the service used for spam detection.</p>
              </div>
            </div>
          )}

          {/* 4. Comment Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                Comment Notifications
              </Label>
              <p className="text-xs text-muted-foreground">Enables or disables notifications for new comments.</p>
            </div>
            <Switch checked={commentNotifications} onCheckedChange={updateCommentNotifications} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
