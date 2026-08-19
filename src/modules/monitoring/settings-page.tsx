'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/patterns';
import { getApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

// -------------------- Types --------------------

interface MonitorSettingsItem {
  key: string;
  value: string;
}

interface MonitorSettingsResponse {
  settings: Record<string, string>;
  items: MonitorSettingsItem[];
}

// -------------------- Constants --------------------

const ALERT_CHANNEL_OPTIONS = [
  { key: 'default_alert_channels_in_app', label: 'In-App' },
  { key: 'default_alert_channels_email', label: 'Email' },
  { key: 'default_alert_channels_webhook', label: 'Webhook' },
  { key: 'default_alert_channels_slack', label: 'Slack' },
  { key: 'default_alert_channels_discord', label: 'Discord' },
  { key: 'default_alert_channels_telegram', label: 'Telegram' },
];

// -------------------- Settings Page --------------------

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.settings(),
    queryFn: () => getApi<MonitorSettingsResponse>('/api/monitoring/settings'),
    staleTime: 30_000,
  });

  const allSettings = data?.settings ?? {};

  const defaultForm = useMemo(() => {
    const s = allSettings;
    return {
      health_check_interval: s['health_check_interval'] ?? '30',
      metrics_retention_period: s['metrics_retention_period'] ?? '30',
      alert_cooldown: s['alert_cooldown'] ?? '300',
      max_stored_metrics: s['max_stored_metrics'] ?? '10000',
      error_log_retention: s['error_log_retention'] ?? '90',
      enable_auto_resolve: s['enable_auto_resolve'] ?? 'false',
    };
  }, [allSettings]);

  const defaultChannels = useMemo(() => {
    const ch: Record<string, boolean> = {};
    for (const opt of ALERT_CHANNEL_OPTIONS) {
      ch[opt.key] = allSettings[opt.key] === 'true';
    }
    return ch;
  }, [allSettings]);

  const [form, setForm] = useState<Record<string, string>>(defaultForm);
  const [channels, setChannels] = useState<Record<string, boolean>>(defaultChannels);

  const saveMutation = useMutation({
    mutationFn: () => {
      const settings: Record<string, string> = { ...form };
      for (const opt of ALERT_CHANNEL_OPTIONS) {
        settings[opt.key] = channels[opt.key] ? 'true' : 'false';
      }
      return patchApi('/api/monitoring/settings', { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.settings() });
      toast.success('Settings saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save settings'),
  });

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChannel = (key: string) => {
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Monitor Settings" description="Configure monitoring behavior and alerts" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Monitor Settings" description="Configure monitoring behavior and alerts" />

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General Settings</CardTitle>
          <CardDescription>Configure health check intervals, retention, and alert behavior.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="health-interval">Health Check Interval (seconds)</Label>
              <Input
                id="health-interval"
                type="number"
                min={5}
                value={form.health_check_interval}
                onChange={(e) => updateForm('health_check_interval', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metrics-retention">Metrics Retention Period (days)</Label>
              <Input
                id="metrics-retention"
                type="number"
                min={1}
                value={form.metrics_retention_period}
                onChange={(e) => updateForm('metrics_retention_period', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-cooldown">Alert Cooldown (seconds)</Label>
              <Input
                id="alert-cooldown"
                type="number"
                min={0}
                value={form.alert_cooldown}
                onChange={(e) => updateForm('alert_cooldown', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-metrics">Max Stored Metrics</Label>
              <Input
                id="max-metrics"
                type="number"
                min={100}
                value={form.max_stored_metrics}
                onChange={(e) => updateForm('max_stored_metrics', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="error-retention">Error Log Retention (days)</Label>
              <Input
                id="error-retention"
                type="number"
                min={1}
                value={form.error_log_retention}
                onChange={(e) => updateForm('error_log_retention', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Alert Channels</CardTitle>
          <CardDescription>Select which channels receive alert notifications by default.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ALERT_CHANNEL_OPTIONS.map((opt) => (
              <div key={opt.key} className="flex items-center gap-2">
                <Checkbox
                  id={opt.key}
                  checked={channels[opt.key] ?? false}
                  onCheckedChange={() => toggleChannel(opt.key)}
                />
                <Label htmlFor={opt.key} className="text-sm cursor-pointer">{opt.label}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Auto Resolve */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automation</CardTitle>
          <CardDescription>Configure automated alert resolution behavior.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-resolve"
              checked={form.enable_auto_resolve === 'true'}
              onCheckedChange={(checked) => updateForm('enable_auto_resolve', checked ? 'true' : 'false')}
            />
            <Label htmlFor="auto-resolve" className="text-sm cursor-pointer">Enable Auto-Resolve</Label>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Automatically resolve alerts when the condition returns to normal.</p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
