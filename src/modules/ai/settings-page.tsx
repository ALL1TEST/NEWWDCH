'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Save, Loader2, Type, Image as ImageIcon,
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
  modelId: string;
  providerId: string;
  type: string; // 'TEXT' | 'IMAGE'
  isActive: boolean;
}

interface AiSettings {
  defaultProviderId: string | null;
  defaultModelId: string | null;
  defaultTemperature: number;
  defaultMaxTokens: number;
  imageProviderId?: string | null;
  imageModelId: string | null;
  // legacy fields kept for API compatibility but not shown in UI
  streamingEnabled?: boolean;
  jsonModeEnabled?: boolean;
  functionCallingEnabled?: boolean;
  embeddingModelId?: string | null;
  monthlyBudget?: number | null;
  warningThreshold?: number;
  stopOnBudgetReached?: boolean;
  requestsPerMinute?: number | null;
  tokensPerDay?: number | null;
}

// -------------------- Component --------------------

export function SettingsPage() {
  return <SettingsPageInner />;
}

function SettingsPageInner() {
  const queryClient = useQueryClient();

  const defaultSettings: AiSettings = {
    defaultProviderId: null,
    defaultModelId: null,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    imageProviderId: null,
    imageModelId: null,
  };

  // Form state — local edits layered on top of the fetched settings.
  // `localEdits` is cleared ONLY in `saveMutation.onSuccess` so background
  // refetches (e.g. from another mutation invalidating `aiSettings.all`)
  // do NOT discard the user's unsaved edits.
  const [localEdits, setLocalEdits] = useState<Partial<AiSettings>>({});
  const updateField = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setLocalEdits((prev) => ({ ...prev, [key]: value }));
  };

  // Fetch settings
  const { data: settingsData, isLoading: settingsLoading, isError: settingsIsError } = useQuery({
    queryKey: queryKeys.aiSettings.list({ scope: 'global' }),
    queryFn: () => getApi<AiSettings>('/api/ai/settings', { scope: 'global' }),
  });

  // settings = fetched data with local edits applied on top
  const settings: AiSettings = { ...(settingsData ?? defaultSettings), ...localEdits } as AiSettings;

  // Fetch all providers (we want active ones for the dropdowns, but keep all for display)
  const { data: providersData } = useQuery({
    queryKey: queryKeys.aiProviders.list({ isActive: true }),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', { isActive: true, pageSize: 100 }),
  });
  const activeProviders = providersData?.data ?? [];

  // Fetch all active models — we filter client-side by provider + type
  const { data: allModelsData } = useQuery({
    queryKey: queryKeys.aiModels.list({ isActive: true, pageSize: 200 }),
    queryFn: () => getApi<PaginatedResponse<AiModel>>('/api/ai/models', { pageSize: 200, isActive: true }),
  });
  const allModels = allModelsData?.data ?? [];

  // Filter models for the Text AI dropdown: same provider + type=TEXT
  const textModels = allModels.filter(
    (m) => (!settings.defaultProviderId || m.providerId === settings.defaultProviderId) && m.type?.toUpperCase() === 'TEXT',
  );

  // Image providers: any provider that has at least one IMAGE model.
  const imageProviderIds = new Set(
    allModels.filter((m) => m.type?.toUpperCase() === 'IMAGE').map((m) => m.providerId),
  );
  const imageProviders = activeProviders.filter((p) => imageProviderIds.has(p.id));

  // Image models: same provider + type=IMAGE
  const imageModels = allModels.filter(
    (m) => (!settings.imageProviderId || m.providerId === settings.imageProviderId) && m.type?.toUpperCase() === 'IMAGE',
  );

  // Save settings
  const saveMutation = useMutation({
    mutationFn: (body: AiSettings) => postApi('/api/ai/settings', { ...body, scope: 'global' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings.all });
      setLocalEdits({});
      toast.success('Settings saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save'),
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (settingsLoading) {
    return <div className="space-y-6">{[1, 2].map((i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>)}</div>;
  }

  if (settingsIsError) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Failed to load AI settings. Please refresh the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Text AI Settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" /> Text AI Settings</CardTitle>
          <CardDescription>Default provider and model for text generation (articles, SEO, prompts).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Default Text Provider */}
            <div className="grid gap-2">
              <Label>Default Provider</Label>
              <Select
                value={settings.defaultProviderId ?? ''}
                onValueChange={(v) => {
                  updateField('defaultProviderId', v);
                  updateField('defaultModelId', ''); // reset model when provider changes
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {activeProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeProviders.length === 0 && (
                <p className="text-xs text-muted-foreground">No active providers. Add a provider in the Providers tab.</p>
              )}
            </div>

            {/* Default Text Model (filtered by provider + type=TEXT) */}
            <div className="grid gap-2">
              <Label>Default Model</Label>
              <Select
                value={settings.defaultModelId ?? ''}
                onValueChange={(v) => updateField('defaultModelId', v)}
                disabled={!settings.defaultProviderId}
              >
                <SelectTrigger><SelectValue placeholder={settings.defaultProviderId ? 'Select model' : 'Select provider first'} /></SelectTrigger>
                <SelectContent>
                  {textModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {settings.defaultProviderId && textModels.length === 0 && (
                <p className="text-xs text-muted-foreground">No active text models for this provider. Add models in the Models tab.</p>
              )}
            </div>
          </div>

          {/* Temperature */}
          <div className="grid gap-1">
            <div className="flex justify-between text-sm">
              <Label>Default Temperature</Label>
              <span className="text-muted-foreground">{settings.defaultTemperature.toFixed(1)}</span>
            </div>
            <Slider min={0} max={2} step={0.1} value={[settings.defaultTemperature ?? 0.7]} onValueChange={([v]) => updateField('defaultTemperature', v)} />
          </div>

          {/* Max Tokens */}
          <div className="grid gap-2">
            <Label htmlFor="max-tokens">Default Max Tokens</Label>
            <Input
              id="max-tokens"
              type="number"
              min={1}
              value={settings.defaultMaxTokens ?? 2048}
              onChange={(e) => updateField('defaultMaxTokens', e.target.value ? parseInt(e.target.value) : 2048)}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Image AI Settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Image AI Settings</CardTitle>
          <CardDescription>Default provider and model for image generation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Default Image Provider */}
            <div className="grid gap-2">
              <Label>Default Image Provider</Label>
              <Select
                value={settings.imageProviderId ?? ''}
                onValueChange={(v) => {
                  updateField('imageProviderId', v);
                  updateField('imageModelId', ''); // reset model when provider changes
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {imageProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {imageProviders.length === 0 && (
                <p className="text-xs text-muted-foreground">No providers with image models. Add an IMAGE model in the Models tab first.</p>
              )}
            </div>

            {/* Default Image Model (filtered by provider + type=IMAGE) */}
            <div className="grid gap-2">
              <Label>Default Image Model</Label>
              <Select
                value={settings.imageModelId ?? ''}
                onValueChange={(v) => updateField('imageModelId', v)}
                disabled={!settings.imageProviderId}
              >
                <SelectTrigger><SelectValue placeholder={settings.imageProviderId ? 'Select model' : 'Select provider first'} /></SelectTrigger>
                <SelectContent>
                  {imageModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {settings.imageProviderId && imageModels.length === 0 && (
                <p className="text-xs text-muted-foreground">No active image models for this provider. Add models in the Models tab.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
