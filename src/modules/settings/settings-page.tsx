'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Save,
  RotateCcw,
  Search,
  Download,
  Upload,
  Globe,
  BookOpen,
  MessageSquare,
  Shield,
  Key,
  Sparkles,
  Database,
  Gauge,
  ImageIcon,
  Layers,
  Mail,
  SettingsIcon,
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/patterns';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ==================== Category Navigation Config ====================

interface CategoryNavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  subPage: string;
}

const CATEGORY_NAV: CategoryNavItem[] = [
  { key: 'GENERAL', label: 'General', icon: <Globe className="h-4 w-4" />, subPage: 'general' },
  { key: 'LOCALIZATION', label: 'Localization', icon: <Globe className="h-4 w-4" />, subPage: 'localization' },
  { key: 'READING', label: 'Reading', icon: <BookOpen className="h-4 w-4" />, subPage: 'reading' },
  { key: 'DISCUSSION', label: 'Discussion', icon: <MessageSquare className="h-4 w-4" />, subPage: 'discussion' },
  { key: 'SEO', label: 'SEO', icon: <Search className="h-4 w-4" />, subPage: 'seo' },
  { key: 'MEDIA', label: 'Media', icon: <ImageIcon className="h-4 w-4" />, subPage: 'media' },
  { key: 'SEARCH_ENGINE', label: 'Search', icon: <Search className="h-4 w-4" />, subPage: 'search' },
  { key: 'EMAIL', label: 'Email (SMTP)', icon: <Mail className="h-4 w-4" />, subPage: 'email' },
  { key: 'SECURITY', label: 'Security', icon: <Shield className="h-4 w-4" />, subPage: 'security' },
  { key: 'API', label: 'API Configuration', icon: <Key className="h-4 w-4" />, subPage: 'api' },
  { key: 'AI', label: 'AI', icon: <Sparkles className="h-4 w-4" />, subPage: 'ai' },
  { key: 'CACHE', label: 'Cache', icon: <Database className="h-4 w-4" />, subPage: 'cache' },
  { key: 'PERFORMANCE', label: 'Performance', icon: <Gauge className="h-4 w-4" />, subPage: 'performance' },
  { key: 'MAINTENANCE', label: 'Maintenance', icon: <AlertTriangle className="h-4 w-4" />, subPage: 'maintenance' },
  { key: 'MULTI_SITE', label: 'Multi-Site', icon: <Layers className="h-4 w-4" />, subPage: 'multi-site' },
  { key: 'IMPORT_EXPORT', label: 'Import / Export', icon: <Upload className="h-4 w-4" />, subPage: 'import-export' },
  { key: 'ADVANCED', label: 'Advanced', icon: <SettingsIcon className="h-4 w-4" />, subPage: 'advanced' },
];

// ==================== Types ====================

interface SettingFieldDef {
  key: string;
  label: string;
  description: string;
  type: string;
  control: string;
  group?: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  isPublic?: boolean;
  isSensitive?: boolean;
}

interface CategoryDef {
  key: string;
  label: string;
  description: string;
  icon: string;
  fieldCount: number;
  fields: SettingFieldDef[];
}

// ==================== Helper ====================

function subPageToCategory(subPage: string): string {
  const map: Record<string, string> = {
    'general': 'GENERAL',
    'localization': 'LOCALIZATION',
    'reading': 'READING',
    'discussion': 'DISCUSSION',
    'seo': 'SEO',
    'media': 'MEDIA',
    'search': 'SEARCH_ENGINE',
    'email': 'EMAIL',
    'security': 'SECURITY',
    'api': 'API',
    'ai': 'AI',
    'cache': 'CACHE',
    'performance': 'PERFORMANCE',
    'maintenance': 'MAINTENANCE',
    'multi-site': 'MULTI_SITE',
    'import-export': 'IMPORT_EXPORT',
    'advanced': 'ADVANCED',
  };
  return map[subPage] ?? 'GENERAL';
}

function getSettingVal(key: string, allSettings: Record<string, string>): string {
  return allSettings[key] ?? '';
}

// ==================== Field Renderer ====================

interface FieldProps {
  field: SettingFieldDef;
  value: string;
  onChange: (val: string) => void;
}

function SettingField({ field, value, onChange }: FieldProps) {
  const [showSecret, setShowSecret] = useState(false);
  const isPassword = field.control === 'password';
  const isSecret = field.type === 'SECRET' || field.type === 'ENCRYPTED';
  const isBoolean = field.type === 'BOOLEAN';
  const isSelect = field.control === 'select' && field.options && field.options.length > 0;
  const isCode = field.control === 'code';
  const isJson = field.control === 'json';
  const isTextarea = field.control === 'textarea' || isCode || isJson;
  const displayValue = (isSecret || isPassword) && !showSecret && value && value !== '[ENCRYPTED]' ? '••••••••' : value;

  if (isBoolean) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{field.label}</Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
        <Switch
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(String(checked))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={field.key} className="text-sm font-medium">
          {field.label}
          {field.isSensitive && <Badge variant="outline" className="ml-2 text-[10px]">Sensitive</Badge>}
        </Label>
        {(isSecret || isPassword) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      {isSelect ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={field.placeholder ?? 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {field.options!.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : isTextarea ? (
        <Textarea
          id={field.key}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={isCode ? 6 : 3}
          className={cn(isCode && 'font-mono text-xs')}
        />
      ) : (
        <Input
          id={field.key}
          type={isPassword && !showSecret ? 'password' : field.control === 'number' ? 'number' : field.control === 'email' ? 'email' : 'text'}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      )}
    </div>
  );
}

// ==================== Category Page ====================

interface CategoryPageProps {
  category: CategoryDef;
  allSettings: Record<string, string>;
  isSaving: boolean;
  onSave: (settings: Array<{ key: string; value: string; type?: string; category?: string }>) => void;
  onReset: (category: string) => void;
  isResetting: boolean;
}

function CategoryPage({ category, allSettings, isSaving, onSave, onReset, isResetting }: CategoryPageProps) {
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {};
    for (const f of category.fields) {
      vals[f.key] = getSettingVal(f.key, allSettings);
    }
    return vals;
  });

  const [isDirty, setIsDirty] = useState(false);

  const handleChange = useCallback((key: string, value: string) => {
    setLocalValues((prev) => {
      const next = { ...prev, [key]: value };
      const currentVal = getSettingVal(key, allSettings);
      const hasChanges = category.fields.some((f) => next[f.key] !== getSettingVal(f.key, allSettings));
      setIsDirty(hasChanges);
      return next;
    });
  }, [allSettings, category.fields]);

  const handleSave = useCallback(() => {
    const changes = category.fields
      .filter((f) => localValues[f.key] !== getSettingVal(f.key, allSettings))
      .map((f) => ({
        key: f.key,
        value: localValues[f.key],
        type: f.type,
        category: category.key,
      }));

    if (changes.length === 0) {
      toast.info('No changes to save');
      return;
    }

    onSave(changes);
  }, [localValues, allSettings, category.fields, category.key, onSave]);

  const handleReset = useCallback(() => {
    onReset(category.key);
  }, [onReset, category.key]);

  // Group fields by group name
  const groups = useMemo(() => {
    const map = new Map<string, SettingFieldDef[]>();
    for (const f of category.fields) {
      const g = f.group ?? 'General';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return map;
  }, [category.fields]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{category.label}</h2>
          <p className="text-sm text-muted-foreground">{category.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isResetting}
              >
                {isResetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Reset
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to defaults</TooltipContent>
          </Tooltip>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Fields by group */}
      {Array.from(groups.entries()).map(([groupName, fields]) => (
        <Card key={groupName}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{groupName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {fields.map((field) => (
              <SettingField
                key={field.key}
                field={field}
                value={localValues[field.key] ?? ''}
                onChange={(val) => handleChange(field.key, val)}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Sticky save bar */}
      {isDirty && (
        <div className="fixed bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg border bg-background p-3 shadow-lg">
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

// ==================== Import/Export Page ====================

function ImportExportPage() {
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const res = await getApi<any>('/api/settings/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cms-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Settings exported successfully');
    } catch {
      toast.error('Failed to export settings');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!importText.trim()) {
      toast.error('Please paste the settings JSON to import');
      return;
    }

    try {
      const parsed = JSON.parse(importText);
      const settings = parsed.settings || parsed;
      setIsImporting(true);
      await postApi('/api/settings/import', { settings });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success('Settings imported successfully');
      setImportText('');
    } catch (e) {
      if (e instanceof SyntaxError) {
        toast.error('Invalid JSON format');
      } else {
        toast.error('Failed to import settings');
      }
    } finally {
      setIsImporting(false);
    }
  }, [importText, queryClient]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Import / Export</h2>
        <p className="text-sm text-muted-foreground">Backup and restore your configuration</p>
      </div>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Settings</CardTitle>
          <CardDescription>Download all current settings as a JSON file</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export All Settings
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Settings</CardTitle>
          <CardDescription>Paste settings JSON below to import. This will overwrite existing values.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{ "settings": { "site_title": { "value": "My Site" } } }'
            rows={10}
            className="font-mono text-xs"
          />
          <Button onClick={handleImport} disabled={isImporting || !importText.trim()}>
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import Settings
          </Button>
        </CardContent>
      </Card>

      {/* Reset All */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>Reset all settings to their default values</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset All Settings?</DialogTitle>
                <DialogDescription>
                  This will reset ALL settings across ALL categories to their default values.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" onClick={async () => {
                  await postApi('/api/settings/reset', {});
                  await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
                  toast.success('All settings reset to defaults');
                }}>
                  Reset Everything
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== Search Dialog ====================

function SettingsSearchDialog({ allSettings }: { allSettings: Record<string, string> }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ category: string; categoryLabel: string; field: SettingFieldDef }>>([]);
  const navigate = useNavigationStore((s) => s.navigate);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    const res = await getApi<Array<{ category: string; categoryLabel: string; field: SettingFieldDef }>>('/api/settings/search?q=' + encodeURIComponent(q));
    setResults(res);
  }, []);

  const categoryToSubPage = (cat: string) => {
    const nav = CATEGORY_NAV.find(n => n.key === cat);
    return nav?.subPage ?? 'general';
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Search className="h-4 w-4 mr-2" />
          Search Settings
          <kbd className="ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            Ctrl+K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Search Settings</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, key, or description..."
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && query.length >= 2 && (
            <p className="text-sm text-muted-foreground text-center py-4">No settings found</p>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 hover:bg-muted rounded-md flex items-center justify-between group"
              onClick={() => {
                navigate('settings', null, categoryToSubPage(r.category));
              }}
            >
              <div>
                <p className="text-sm font-medium">{r.field.label}</p>
                <p className="text-xs text-muted-foreground">{r.field.key} · {r.categoryLabel}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Main Settings Page ====================

export function SettingsPage() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);
  const queryClient = useQueryClient();

  // Auto-navigate to 'general' when no sub-page is selected
  useEffect(() => {
    if (!currentSubPage) {
      navigate('settings', null, 'general');
    }
  }, [currentSubPage, navigate]);

  const activeCategory = currentSubPage ?? 'general';
  const categoryKey = subPageToCategory(activeCategory);
  const isImportExportPage = activeCategory === 'import-export';

  // Fetch all settings (getApi already unwraps the ApiResponse envelope)
  const { data: allSettings = {}, isLoading: isLoadingSettings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => getApi<Record<string, string>>('/api/settings'),
  });

  // Fetch category definitions (getApi already unwraps the ApiResponse envelope)
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: queryKeys.settings.categories(),
    queryFn: () => getApi<CategoryDef[]>('/api/settings/categories'),
  });

  const currentCatDef = categories.find((c) => c.key === categoryKey);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (settings: Array<{ key: string; value: string; type?: string; category?: string }>) =>
      postApi('/api/settings/batch', { settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success('Settings saved successfully');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: (category: string) =>
      postApi('/api/settings/reset', { category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success('Settings reset to defaults');
    },
    onError: () => {
      toast.error('Failed to reset settings');
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <PageHeader title="Settings" description="Manage your CMS configuration" action={<SettingsSearchDialog allSettings={allSettings} />} />

      {/* Content Area — no duplicate navigation, sidebar handles it */}
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoadingSettings || isLoadingCategories ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isImportExportPage ? (
          <ImportExportPage />
        ) : currentCatDef ? (
          <>
            <CategoryPage
              key={currentCatDef.key}
              category={currentCatDef}
              allSettings={allSettings}
              isSaving={saveMutation.isPending}
              onSave={saveMutation.mutate}
              onReset={resetMutation.mutate}
              isResetting={resetMutation.isPending}
            />
            {categoryKey === 'API' && (
              <div className="mt-4">
                <Button variant="outline" onClick={() => navigate('api')} className="gap-2">
                  Manage API <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <SettingsIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a category to configure</p>
          </div>
        )}
      </div>
    </div>
  );
}
