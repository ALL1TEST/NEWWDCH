'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Save, Loader2, Settings, DollarSign, Shield, ArrowUpDown, Plus, Trash2, GripVertical,
} from 'lucide-react';

// -------------------- Types --------------------

interface AiProvider {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
}

interface AiModel {
  id: string;
  name: string;
  providerId: string;
  isActive: boolean;
}

interface AiSettings {
  defaultProviderId: string | null;
  defaultModelId: string | null;
  defaultTemperature: number;
  defaultMaxTokens: number;
  streamingEnabled: boolean;
  jsonModeEnabled: boolean;
  functionCallingEnabled: boolean;
  imageModelId: string | null;
  embeddingModelId: string | null;
  monthlyBudget: number | null;
  warningThreshold: number;
  stopOnBudgetReached: boolean;
  requestsPerMinute: number | null;
  tokensPerDay: number | null;
}

interface FallbackProvider {
  id: string;
  providerId: string;
  provider?: AiProvider;
  fallbackId: string;
  fallback?: AiProvider;
  order: number;
  createdAt: string;
}

// -------------------- Component --------------------

export function SettingsPage() {
  const queryClient = useQueryClient();

  const defaultSettings: AiSettings = {
    defaultProviderId: '',
    defaultModelId: '',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    streamingEnabled: true,
    jsonModeEnabled: false,
    functionCallingEnabled: true,
    imageModelId: '',
    embeddingModelId: '',
    monthlyBudget: null,
    warningThreshold: 80,
    stopOnBudgetReached: true,
    requestsPerMinute: null,
    tokensPerDay: null,
  };

  // Form state
  const [localSettings, setLocalSettings] = useState<AiSettings>(defaultSettings);
  const settings = settingsData ?? localSettings;
  const updateField = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const [selectedProviderForFallback, setSelectedProviderForFallback] = useState('');
  const [selectedFallbackTarget, setSelectedFallbackTarget] = useState('');

  // Fetch settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: queryKeys.aiSettings.list({ scope: 'global' }),
    queryFn: () => getApi<AiSettings>('/api/ai/settings', { scope: 'global' }),
  });



  // Fetch providers for selects
  const { data: providersData } = useQuery({
    queryKey: queryKeys.aiProviders.list({ isActive: true }),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', { isActive: true, pageSize: 100 }),
  });
  const activeProviders = providersData?.data ?? [];

  // Fetch models filtered by default provider
  const { data: modelsData } = useQuery({
    queryKey: queryKeys.aiModels.list({ providerId: settings.defaultProviderId || undefined }),
    queryFn: () => getApi<PaginatedResponse<AiModel>>('/api/ai/models', {
      providerId: settings.defaultProviderId || undefined,
      pageSize: 200,
    }),
    enabled: !!settings.defaultProviderId,
  });
  const models = modelsData?.data ?? [];

  // Fetch all models for image/embedding selects
  const { data: allModelsData } = useQuery({
    queryKey: queryKeys.aiModels.list({ all: true }),
    queryFn: () => getApi<PaginatedResponse<AiModel>>('/api/ai/models', { pageSize: 200, isActive: true }),
  });
  const allModels = allModelsData?.data ?? [];

  // Fetch fallbacks
  const { data: fallbacksData, isLoading: fallbacksLoading } = useQuery({
    queryKey: queryKeys.aiFallbacks.list(),
    queryFn: () => getApi<FallbackProvider[]>('/api/ai/fallbacks'),
  });
  const fallbacks = fallbacksData ?? [];

  // Save settings
  const saveMutation = useMutation({
    mutationFn: (body: AiSettings) => postApi('/api/ai/settings', { ...body, scope: 'global' }),
    onSuccess: () => {
      toast.success('Settings saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save'),
  });

  // Add fallback
  const addFallbackMutation = useMutation({
    mutationFn: () => postApi('/api/ai/fallbacks', {
      providerId: selectedProviderForFallback,
      fallbackId: selectedFallbackTarget,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiFallbacks.all });
      toast.success('Fallback added');
      setSelectedProviderForFallback('');
      setSelectedFallbackTarget('');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add fallback'),
  });

  // Remove fallback
  const removeFallbackMutation = useMutation({
    mutationFn: ({ providerId, fallbackId }: { providerId: string; fallbackId: string }) =>
      deleteApi('/api/ai/fallbacks', { params: { providerId, fallbackId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiFallbacks.all });
      toast.success('Fallback removed');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to remove fallback'),
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };



  if (settingsLoading) {
    return <div className="space-y-6">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>)}</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Settings className="h-5 w-5" /> AI Settings
      </h2>

      {/* Global Settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Global Settings</CardTitle>
          <CardDescription>Configure default AI behavior across your platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Default Provider</Label>
              <Select value={settings.defaultProviderId ?? ''} onValueChange={(v) => updateField('defaultProviderId', v)}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {activeProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Default Model</Label>
              <Select value={settings.defaultModelId ?? ''} onValueChange={(v) => updateField('defaultModelId', v)}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            <div className="flex justify-between text-sm"><span>Default Temperature</span><span className="text-zinc-500">{settings.defaultTemperature}</span></div>
            <Slider min={0} max={2} step={0.1} value={[settings.defaultTemperature]} onValueChange={([v]) => updateField('defaultTemperature', v)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="settings-max-tokens">Default Max Tokens</Label>
            <Input id="settings-max-tokens" type="number" value={settings.defaultMaxTokens} onChange={(e) => updateField('defaultMaxTokens', parseInt(e.target.value) || 2048)} />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Image Model</Label>
              <Select value={settings.imageModelId ?? ''} onValueChange={(v) => updateField('imageModelId', v)}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {allModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Embedding Model</Label>
              <Select value={settings.embeddingModelId ?? ''} onValueChange={(v) => updateField('embeddingModelId', v)}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {allModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Streaming Enabled</Label>
              <Switch checked={settings.streamingEnabled} onCheckedChange={(v) => updateField('streamingEnabled', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>JSON Mode Enabled</Label>
              <Switch checked={settings.jsonModeEnabled} onCheckedChange={(v) => updateField('jsonModeEnabled', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Function Calling Enabled</Label>
              <Switch checked={settings.functionCallingEnabled} onCheckedChange={(v) => updateField('functionCallingEnabled', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Management */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Budget Management</CardTitle>
          <CardDescription>Set spending limits for AI usage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="budget-monthly">Monthly Budget (USD)</Label>
              <Input id="budget-monthly" type="number" min={0} step={10} placeholder="100.00" value={settings.monthlyBudget ?? ''} onChange={(e) => updateField('monthlyBudget', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          </div>

          <div className="grid gap-1">
            <div className="flex justify-between text-sm"><span>Warning Threshold</span><span className="text-zinc-500">{settings.warningThreshold}%</span></div>
            <Slider min={10} max={100} step={5} value={[settings.warningThreshold]} onValueChange={([v]) => updateField('warningThreshold', v)} />
          </div>

          <div className="flex items-center justify-between">
            <Label>Stop Requests When Budget Reached</Label>
            <Switch checked={settings.stopOnBudgetReached} onCheckedChange={(v) => updateField('stopOnBudgetReached', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Rate Limits</CardTitle>
          <CardDescription>Control API request frequency.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rate-rpm">Requests per Minute</Label>
              <Input id="rate-rpm" type="number" min={1} placeholder="60" value={settings.requestsPerMinute ?? ''} onChange={(e) => updateField('requestsPerMinute', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate-tpd">Tokens per Day</Label>
              <Input id="rate-tpd" type="number" min={1} placeholder="1000000" value={settings.tokensPerDay ?? ''} onChange={(e) => updateField('tokensPerDay', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fallback Providers */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2"><ArrowUpDown className="h-4 w-4" /> Fallback Providers</CardTitle>
          <CardDescription>Configure fallback chain when the primary provider fails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fallbacksLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : fallbacks.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">No fallback providers configured.</p>
          ) : (
            <div className="space-y-2">
              {fallbacks.map((fb, idx) => (
                <div key={fb.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                  <GripVertical className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="text-xs text-zinc-400 font-medium w-6">#{idx + 1}</span>
                  <span className="text-sm font-medium flex-1">{fb.provider?.name ?? fb.providerId}</span>
                  <span className="text-xs text-zinc-400">→</span>
                  <span className="text-sm text-zinc-600">{fb.fallback?.name ?? fb.fallbackId}</span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeFallbackMutation.mutate({ providerId: fb.providerId, fallbackId: fb.fallbackId })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={selectedProviderForFallback} onValueChange={setSelectedProviderForFallback}>
              <SelectTrigger><SelectValue placeholder="Primary Provider" /></SelectTrigger>
              <SelectContent>
                {activeProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Select value={selectedFallbackTarget} onValueChange={setSelectedFallbackTarget}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Fallback Provider" /></SelectTrigger>
                <SelectContent>
                  {activeProviders.filter((p) => p.id !== selectedProviderForFallback).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => addFallbackMutation.mutate()} disabled={!selectedProviderForFallback || !selectedFallbackTarget || addFallbackMutation.isPending} size="sm">
                {addFallbackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="min-w-[120px]">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
