'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Search,
  Eye,
  Save,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  Code2,
  Variable,
  Mail,
  Send,
  MousePointerClick,
  Replace,
  X,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAuthStore } from '@/lib/stores/auth-store';

import { getApi, patchApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type {
  EmailTemplateStatus,
  EmailTemplateCategory,
} from '@/shared/types';

// ============================================================
// Types
// ============================================================

interface TemplateEditorProps {
  templateId: string;
  isNew?: boolean;
  onBack: () => void;
  onPreview: (id: string) => void;
  onCreated?: (id: string) => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  htmlBody: string;
  category: EmailTemplateCategory;
  status: EmailTemplateStatus;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateSettings {
  category: EmailTemplateCategory;
  status: EmailTemplateStatus;
}

interface DynamicVariable {
  key: string;
  description: string;
}

interface VariableGroup {
  label: string;
  icon: React.ReactNode;
  variables: DynamicVariable[];
}

// ============================================================
// Constants
// ============================================================

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: 'Customer',
    icon: <MousePointerClick className="h-3.5 w-3.5" />,
    variables: [
      { key: 'customer.first_name', description: 'Customer\'s first name' },
      { key: 'customer.last_name', description: 'Customer\'s last name' },
      { key: 'customer.email', description: 'Customer\'s email address' },
      { key: 'customer.phone', description: 'Customer\'s phone number' },
      { key: 'customer.avatar_url', description: 'Customer\'s avatar image URL' },
    ],
  },
  {
    label: 'Site',
    icon: <Code2 className="h-3.5 w-3.5" />,
    variables: [
      { key: 'site.name', description: 'Site name' },
      { key: 'site.url', description: 'Site URL' },
      { key: 'site.logo', description: 'Site logo URL' },
      { key: 'site.description', description: 'Site description' },
      { key: 'site.domain', description: 'Site domain' },
    ],
  },
  {
    label: 'Company',
    icon: <Mail className="h-3.5 w-3.5" />,
    variables: [
      { key: 'company.name', description: 'Company name' },
      { key: 'company.logo', description: 'Company logo URL' },
      { key: 'company.address', description: 'Company address' },
      { key: 'company.phone', description: 'Company phone number' },
      { key: 'company.email', description: 'Company email address' },
    ],
  },
  {
    label: 'User',
    icon: <MousePointerClick className="h-3.5 w-3.5" />,
    variables: [
      { key: 'user.name', description: 'User\'s full name' },
      { key: 'user.email', description: 'User\'s email address' },
      { key: 'user.role', description: 'User\'s role' },
      { key: 'user.avatar_url', description: 'User\'s avatar image URL' },
    ],
  },
  {
    label: 'Article',
    icon: <Code2 className="h-3.5 w-3.5" />,
    variables: [
      { key: 'article.title', description: 'Article title' },
      { key: 'article.url', description: 'Article URL' },
      { key: 'article.excerpt', description: 'Article excerpt/summary' },
      { key: 'article.author', description: 'Article author name' },
      { key: 'article.published_at', description: 'Article publish date' },
      { key: 'article.featured_image', description: 'Article featured image URL' },
    ],
  },
  {
    label: 'Comment',
    icon: <Mail className="h-3.5 w-3.5" />,
    variables: [
      { key: 'comment.author', description: 'Comment author name' },
      { key: 'comment.content', description: 'Comment content text' },
      { key: 'comment.article_title', description: 'Title of the article commented on' },
      { key: 'comment.url', description: 'Comment URL' },
      { key: 'comment.created_at', description: 'Comment creation date' },
    ],
  },
  {
    label: 'Newsletter',
    icon: <Send className="h-3.5 w-3.5" />,
    variables: [
      { key: 'newsletter.name', description: 'Newsletter name' },
      { key: 'newsletter.subject', description: 'Newsletter subject line' },
      { key: 'newsletter.unsubscribe_url', description: 'Unsubscribe link' },
      { key: 'newsletter.preview_url', description: 'Newsletter preview URL' },
    ],
  },
  {
    label: 'System',
    icon: <Code2 className="h-3.5 w-3.5" />,
    variables: [
      { key: 'current_date', description: 'Current date' },
      { key: 'current_year', description: 'Current year' },
      { key: 'current_month', description: 'Current month name' },
      { key: 'verification_url', description: 'Email verification link' },
      { key: 'reset_password_url', description: 'Password reset link' },
      { key: 'invite_url', description: 'Invitation accept link' },
      { key: 'unsubscribe_url', description: 'Global unsubscribe link' },
    ],
  },
];

const CATEGORY_OPTIONS: { value: EmailTemplateCategory; label: string }[] = [
  { value: 'CUSTOMER_EMAILS', label: 'Customer Emails' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
  { value: 'NEWSLETTER', label: 'Newsletter' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TRANSACTIONAL', label: 'Transactional' },
  { value: 'NOTIFICATIONS', label: 'Notifications' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'SYSTEM', label: 'System' },
];

const STATUS_OPTIONS: { value: EmailTemplateStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ENABLED', label: 'Enabled' },
];

// ============================================================
// Helper: Escape for regex
// ============================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// Component: Line Numbers
// ============================================================

function LineNumbers({ text, scrollTop }: { text: string; scrollTop: number }) {
  const lines = text.split('\n');
  const lineCount = lines.length;

  return (
    <div
      className="flex-shrink-0 select-none overflow-hidden py-4 text-right font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-600"
      style={{ width: '3.5rem' }}
    >
      <div style={{ transform: `translateY(-${scrollTop}px)` }}>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="pr-3">
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Component: Save Indicator
// ============================================================

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={cn(
          'h-2 w-2 rounded-full transition-colors duration-300',
          state === 'idle' && 'bg-zinc-300 dark:bg-zinc-600',
          state === 'dirty' && 'bg-amber-400',
          state === 'saving' && 'bg-sky-400 animate-pulse',
          state === 'saved' && 'bg-emerald-400',
        )}
      />
      <span
        className={cn(
          'tabular-nums',
          state === 'idle' && 'text-muted-foreground',
          state === 'dirty' && 'text-amber-600 dark:text-amber-400',
          state === 'saving' && 'text-sky-600 dark:text-sky-400',
          state === 'saved' && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {state === 'idle' && 'No changes'}
        {state === 'dirty' && 'Unsaved changes'}
        {state === 'saving' && 'Saving...'}
        {state === 'saved' && 'Saved'}
      </span>
    </div>
  );
}

// ============================================================
// Component: Search Replace Bar
// ============================================================

function SearchReplaceBar({
  isOpen,
  onClose,
  onSearch,
  onReplace,
  onReplaceAll,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  onReplace: (query: string, replacement: string) => void;
  onReplaceAll: (query: string, replacement: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [replace, setReplace] = useState('');
  const [showReplace, setShowReplace] = useState(false);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="border-b bg-card"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value) onSearch(e.target.value);
          }}
          placeholder="Find..."
          className="h-7 flex-1 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0"
          autoFocus
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowReplace(!showReplace)}
            >
              <Replace className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Replace</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <AnimatePresence>
        {showReplace && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center gap-2 border-t px-3 py-2">
              <Replace className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                placeholder="Replace with..."
                className="h-7 flex-1 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  if (search) onReplace(search, replace);
                }}
                disabled={!search}
              >
                Replace
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  if (search) onReplaceAll(search, replace);
                }}
                disabled={!search}
              >
                All
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================
// Component: Variable Chip
// ============================================================

function VariableChip({
  variable,
  onInsert,
}: {
  variable: DynamicVariable;
  onInsert: (key: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const tag = `{{${variable.key}}}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tag);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onInsert(variable.key)}
          className="group flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:border-border"
        >
          <code className="truncate font-mono text-[11px] text-foreground">
            {tag}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        {variable.description}
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================
// Main Component
// ============================================================

export function TemplateEditor({ templateId, isNew = false, onBack, onPreview, onCreated }: TemplateEditorProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  // -------------------- State --------------------

  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [settings, setSettings] = useState<TemplateSettings>({
    category: 'SYSTEM',
    status: 'DRAFT',
  });
  const [templateName, setTemplateName] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [originalData, setOriginalData] = useState<{ subject: string; htmlBody: string; settings: TemplateSettings } | null>(null);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------- Track dirty --------------------

  const isDirty = useMemo(() => {
    if (!originalData) return false;
    return (
      originalData.subject !== subject ||
      originalData.htmlBody !== htmlBody ||
      JSON.stringify(originalData.settings) !== JSON.stringify(settings)
    );
  }, [subject, htmlBody, settings, originalData]);

  // Derive display save state: saving/saved take priority over dirty/idle
  const displaySaveState = useMemo((): SaveState => {
    if (saveState === 'saving' || saveState === 'saved') return saveState;
    return isDirty ? 'dirty' : 'idle';
  }, [isDirty, saveState]);

  // -------------------- Data Fetching --------------------

  const { data: template, isLoading: isLoadingTemplate } = useQuery<EmailTemplate>({
    queryKey: queryKeys.emailTemplates.detail(templateId),
    queryFn: () => getApi<EmailTemplate>(`/api/email-templates/${templateId}`),
    enabled: !!templateId && !isNew,
  });

  // -------------------- Create Mutation (for new templates) --------------------

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      subject: string;
      htmlBody: string;
      category?: EmailTemplateCategory;
      status?: EmailTemplateStatus;
    }) => postApi<EmailTemplate>('/api/email-templates', { ...data, createdById: currentUser?.id }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      toast.success('Template created successfully');
      onCreated?.(created.id);
    },
    onError: (err: Error) => {
      setSaveState('idle');
      toast.error(err.message || 'Failed to create template');
    },
  });

  // -------------------- Sync template data to state --------------------

  useEffect(() => {
    if (template) {
      const newSettings: TemplateSettings = {
        category: template.category,
        status: template.status,
      };
      const orig = {
        subject: template.subject,
        htmlBody: template.htmlBody,
        settings: newSettings,
      };
      React.startTransition(() => {
        setSubject(template.subject);
        setHtmlBody(template.htmlBody);
        setSettings(newSettings);
        setOriginalData(orig);
      });
    }
  }, [template]);

  // -------------------- Save Mutation --------------------

  const saveMutation = useMutation({
    mutationFn: (data: {
      subject: string;
      htmlBody: string;
      category?: EmailTemplateCategory;
      status?: EmailTemplateStatus;
    }) => patchApi<EmailTemplate>(`/api/email-templates/${templateId}`, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.detail(templateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      setSaveState('saved');
      const newSettings: TemplateSettings = {
        category: updated.category,
        status: updated.status,
      };
      setOriginalData({
        subject: updated.subject,
        htmlBody: updated.htmlBody,
        settings: newSettings,
      });
      setTimeout(() => {
        setSaveState((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
      toast.success('Template saved');
    },
    onError: (err: Error) => {
      setSaveState('idle');
      toast.error(err.message || 'Failed to save template');
    },
  });

  // -------------------- Auto-Save --------------------

  const performSave = useCallback(() => {
    if (!isDirty || saveMutation.isPending) return;
    setSaveState('saving');
    saveMutation.mutate({
      subject,
      htmlBody,
      category: settings.category,
      status: settings.status,
    });
  }, [isDirty, saveMutation, subject, htmlBody, settings]);

  useEffect(() => {
    if (isNew || !isDirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      return;
    }
    autoSaveTimerRef.current = setTimeout(performSave, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isNew, isDirty, subject, htmlBody, settings, performSave]);

  // -------------------- Variable Insertion --------------------

  const insertVariable = useCallback(
    (key: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const tag = `{{${key}}}`;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = htmlBody.substring(0, start);
      const after = htmlBody.substring(end);
      setHtmlBody(before + tag + after);
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + tag.length;
        textarea.setSelectionRange(newPos, newPos);
      });
      toast.success(`Inserted {{${key}}}`);
    },
    [htmlBody],
  );

  // -------------------- Search/Replace --------------------

  const handleSearch = useCallback(
    (query: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const idx = htmlBody.indexOf(query, textarea.selectionEnd);
      if (idx >= 0) {
        textarea.focus();
        textarea.setSelectionRange(idx, idx + query.length);
      } else {
        const idxFromStart = htmlBody.indexOf(query);
        if (idxFromStart >= 0) {
          textarea.focus();
          textarea.setSelectionRange(idxFromStart, idxFromStart + query.length);
        }
      }
    },
    [htmlBody],
  );

  const handleReplace = useCallback(
    (query: string, replacement: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const selected = htmlBody.substring(start, textarea.selectionEnd);
      if (selected === query) {
        const before = htmlBody.substring(0, start);
        const after = htmlBody.substring(start + query.length);
        setHtmlBody(before + replacement + after);
        requestAnimationFrame(() => {
          textarea.focus();
          const newPos = start + replacement.length;
          textarea.setSelectionRange(newPos, newPos);
        });
      } else {
        handleSearch(query);
      }
    },
    [htmlBody, handleSearch],
  );

  const handleReplaceAll = useCallback(
    (query: string, replacement: string) => {
      const regex = new RegExp(escapeRegex(query), 'g');
      setHtmlBody(htmlBody.replace(regex, replacement));
      toast.success(`Replaced all occurrences`);
    },
    [htmlBody],
  );

  // -------------------- Editor scroll sync --------------------

  const [editorScrollTop, setEditorScrollTop] = useState(0);

  // -------------------- Tab handling --------------------

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = htmlBody.substring(0, start);
        const after = htmlBody.substring(end);
        setHtmlBody(before + '  ' + after);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [htmlBody],
  );

  // -------------------- Settings updater --------------------

  const updateSettings = useCallback(<K extends keyof TemplateSettings>(key: K, value: TemplateSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // -------------------- Line count --------------------

  const lineCount = useMemo(() => htmlBody.split('\n').length, [htmlBody]);

  // -------------------- Create-mode save handler --------------------

  const handleCreate = useCallback(() => {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (createMutation.isPending) return;
    setSaveState('saving');
    createMutation.mutate({
      name: templateName.trim(),
      subject,
      htmlBody,
      category: settings.category,
      status: settings.status,
    });
  }, [templateName, subject, htmlBody, settings, createMutation]);

  // -------------------- Keyboard Shortcuts --------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isNew) { handleCreate(); } else { performSave(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isNew) { handleCreate(); } else { performSave(); }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performSave, isNew, handleCreate]);

  // -------------------- Loading --------------------

  if (!isNew && (isLoadingTemplate || !template)) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center border-b px-4 gap-4">
          <Skeleton className="h-4 w-48" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="flex flex-1 gap-0">
          <div className="flex flex-1 flex-col gap-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[500px] w-full" />
          </div>
          <div className="hidden w-80 border-l p-4 lg:block">
            <Skeleton className="h-8 w-full mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // -------------------- Render --------------------

  const editorContent = (
    <>
      {/* ---- Name Field (create mode only) ---- */}
      {isNew && (
        <div className="space-y-1.5">
          <Label htmlFor="template-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Template Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="template-name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. Welcome Email, Order Confirmation..."
            className="h-10 text-sm"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            A descriptive name for internal reference.
          </p>
        </div>
      )}

      {/* ---- Subject Field ---- */}
      <div className="space-y-1.5">
        <Label htmlFor="template-subject" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Subject <span className="text-red-500">*</span>
        </Label>
        <Input
          id="template-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject line..."
          className="h-10 text-sm"
        />
        {subject && (
          <p className="text-xs text-muted-foreground truncate">
            Preview: {subject.replace(/\{\{[^}]+\}\}/g, (match) => {
              const key = match.replace(/\{\{|\}\}/g, '');
              const found = VARIABLE_GROUPS.flatMap((g) => g.variables).find((v) => v.key === key);
              return found ? `[${found.description}]` : match;
            })}
          </p>
        )}
      </div>

      {/* ---- Category + Status Row ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Template Category <span className="text-red-500">*</span>
          </Label>
          <Select
            value={settings.category}
            onValueChange={(v) => updateSettings('category', v as EmailTemplateCategory)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Status
          </Label>
          <Select
            value={settings.status}
            onValueChange={(v) => updateSettings('status', v as EmailTemplateStatus)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ---- HTML Editor ---- */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  textareaRef.current?.focus();
                  document.execCommand('undo');
                }}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  textareaRef.current?.focus();
                  document.execCommand('redo');
                }}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showSearch ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search &amp; Replace (Ctrl+F)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setSidebarOpen(true);
                }}
              >
                <Variable className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Variable</TooltipContent>
          </Tooltip>

          <div className="ml-auto flex items-center gap-1">
            <span className="mr-2 text-[11px] tabular-nums text-muted-foreground">
              {lineCount} lines
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Search/Replace Bar */}
        <AnimatePresence>
          {showSearch && (
            <SearchReplaceBar
              isOpen={showSearch}
              onClose={() => setShowSearch(false)}
              onSearch={handleSearch}
              onReplace={handleReplace}
              onReplaceAll={handleReplaceAll}
            />
          )}
        </AnimatePresence>

        {/* Editor + Line Numbers */}
        <div className="flex flex-1 overflow-hidden">
          <div className="overflow-hidden bg-zinc-950 dark:bg-zinc-950 light:bg-zinc-50">
            <LineNumbers text={htmlBody} scrollTop={editorScrollTop} />
          </div>
          <textarea
            ref={textareaRef}
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            onScroll={(e) => setEditorScrollTop(e.currentTarget.scrollTop)}
            spellCheck={false}
            className="flex-1 resize-none bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-100 placeholder:text-zinc-600 focus:outline-none dark:bg-zinc-950 light:bg-zinc-50 light:text-zinc-900"
            style={{ minHeight: 500 }}
            placeholder="<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body>...</body>\n</html>"
          />
        </div>
      </div>
    </>
  );

  // ---- Sidebar Content ----

  const sidebarContent = (
    <div className="space-y-1">
      {/* ====== Dynamic Variables ====== */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
          <div className="flex items-center gap-2">
            <Variable className="h-4 w-4 text-muted-foreground" />
            Dynamic Variables
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-0 [[data-state=closed]>&]:-rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-72 overflow-y-auto px-1 pb-2">
            {VARIABLE_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.icon}
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.variables.map((v) => (
                    <VariableChip
                      key={v.key}
                      variable={v}
                      onInsert={insertVariable}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* ====== Top Header Bar ====== */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Email Templates</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate font-medium max-w-[200px] lg:max-w-[400px]">
            {isNew ? 'Create Template' : (template?.name ?? 'Loading...')}
          </span>
        </nav>

        {/* Right Actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Save Indicator */}
          <div className="hidden md:flex mr-2">
            <SaveIndicator state={displaySaveState} />
          </div>

          {/* Cancel */}
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
          >
            <X className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">Cancel</span>
          </Button>

          {/* Save / Create */}
          <Button
            size="sm"
            onClick={isNew ? handleCreate : performSave}
            disabled={
              isNew
                ? createMutation.isPending
                : (!isDirty || saveMutation.isPending)
            }
          >
            {(isNew ? createMutation.isPending : saveMutation.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="ml-1.5">{isNew ? 'Create Template' : 'Save'}</span>
          </Button>

          {/* Toggle Sidebar (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      {/* ====== Main Content ====== */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Editor */}
        <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
          {editorContent}
        </main>

        {/* Right Sidebar */}
        <aside
          className={cn(
            'flex-shrink-0 border-l bg-card overflow-y-auto transition-all duration-300',
            'fixed inset-y-0 right-0 z-50 w-80 shadow-xl lg:relative lg:inset-auto lg:z-auto lg:shadow-none',
            sidebarOpen
              ? 'translate-x-0'
              : 'translate-x-full lg:translate-x-0 lg:w-0 lg:border-l-0 lg:overflow-hidden',
            !sidebarOpen && 'lg:w-0',
          )}
        >
          <ScrollArea className="h-full max-h-screen">
            <div className="w-80 p-4">
              {sidebarContent}
            </div>
          </ScrollArea>
        </aside>

        {/* Mobile sidebar backdrop */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ====== Fullscreen Overlay ====== */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex flex-col bg-background"
          >
            {/* Fullscreen Header */}
            <div className="flex h-12 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {isNew ? 'New Template' : `${template?.name} — HTML Editor`}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {lineCount} lines
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <SaveIndicator state={displaySaveState} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullscreen(false)}
                >
                  <Minimize2 className="h-4 w-4 mr-1.5" />
                  Exit Fullscreen
                </Button>
              </div>
            </div>
            {/* Fullscreen Editor */}
            <div className="flex flex-1 overflow-hidden">
              <div className="overflow-hidden bg-zinc-950 dark:bg-zinc-950">
                <LineNumbers text={htmlBody} scrollTop={editorScrollTop} />
              </div>
              <textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                onScroll={(e) => setEditorScrollTop(e.currentTarget.scrollTop)}
                spellCheck={false}
                className="flex-1 resize-none bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-100 placeholder:text-zinc-600 focus:outline-none dark:bg-zinc-950"
                placeholder="<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body>...</body>\n</html>"
                autoFocus
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
