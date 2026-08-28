'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Check,
  ChevronDown,
  LayoutGrid,
  Loader2,
  Trash2,
  Settings,
} from 'lucide-react';
import { useSiteStore, type Site } from '@/lib/stores/site-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { toast } from 'sonner';

// -------------------- Site Colors ----------------

const SITE_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-lime-500',
];

function getSiteColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SITE_COLORS[Math.abs(hash) % SITE_COLORS.length];
}

// -------------------- Validation helpers --------------------

// Slug must be lowercase letters / numbers / hyphens, no leading/trailing hyphen.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateSiteFields(name: string, slug: string): { name?: string; slug?: string } {
  const errors: { name?: string; slug?: string } = {};
  if (!name.trim()) errors.name = 'Site name is required';
  if (!slug.trim()) {
    errors.slug = 'Slug is required';
  } else if (!SLUG_PATTERN.test(slug.trim())) {
    errors.slug = 'Slug must be lowercase letters, numbers, and hyphens only';
  }
  return errors;
}

// -------------------- Create Site Dialog --------------------

function CreateSiteDialog({ onClose }: { onClose: (site: Site) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [open, setOpen] = useState(true);
  const createSite = useSiteStore((s) => s.createSite);

  const fieldErrors = validateSiteFields(name, slug);
  const nameError = submitAttempted ? fieldErrors.name : undefined;
  const slugError = submitAttempted ? fieldErrors.slug : undefined;

  const generateSlug = useCallback((val: string) => {
    return val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(generateSlug(val));
  };

  const handleSubmit = async () => {
    const errors = validateSiteFields(name, slug);
    if (errors.name || errors.slug) {
      setSubmitAttempted(true);
      return;
    }
    setSubmitAttempted(false);
    setError('');
    setIsCreating(true);
    try {
      const site = await createSite({
        name: name.trim(),
        slug: slug.trim(),
        domain: domain.trim() || undefined,
        description: description.trim() || undefined,
      });
      setOpen(false);
      onClose(site);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Site</DialogTitle>
          <DialogDescription>
            Add a new website to your multi-site dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="site-name">Site Name</Label>
            <Input
              id="site-name"
              placeholder="My New Blog"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              autoFocus
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-slug">Slug</Label>
            <Input
              id="site-slug"
              placeholder="my-new-blog"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              aria-invalid={!!slugError}
            />
            {slugError && (
              <p className="text-xs text-destructive">{slugError}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-domain">Domain (optional)</Label>
            <Input
              id="site-domain"
              placeholder="www.example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-desc">Description (optional)</Label>
            <Input
              id="site-desc"
              placeholder="A brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Site'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Edit Site Dialog --------------------

function EditSiteDialog({ site, onClose }: { site: Site; onClose: () => void }) {
  const [name, setName] = useState(site.name);
  const [slug, setSlug] = useState(site.slug);
  const [domain, setDomain] = useState(site.domain || '');
  const [description, setDescription] = useState(site.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [open, setOpen] = useState(true);
  const updateSite = useSiteStore((s) => s.updateSite);
  const deleteSite = useSiteStore((s) => s.deleteSite);

  const fieldErrors = validateSiteFields(name, slug);
  const nameError = submitAttempted ? fieldErrors.name : undefined;
  const slugError = submitAttempted ? fieldErrors.slug : undefined;

  const handleSave = async () => {
    const errors = validateSiteFields(name, slug);
    if (errors.name || errors.slug) {
      setSubmitAttempted(true);
      return;
    }
    setSubmitAttempted(false);
    setError('');
    setIsSaving(true);
    try {
      await updateSite(site.id, {
        name: name.trim(),
        slug: slug.trim(),
        domain: domain.trim() || undefined,
        description: description.trim() || undefined,
      });
      toast.success('Site updated successfully');
      setOpen(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update site');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setIsDeleting(true);
    try {
      await deleteSite(site.id);
      toast.success('Site deleted');
      setOpen(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete site');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Site</DialogTitle>
          <DialogDescription>
            Update site details for {site.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-site-name">Site Name</Label>
            <Input
              id="edit-site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-site-slug">Site URL / Slug</Label>
            <Input
              id="edit-site-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              aria-invalid={!!slugError}
            />
            {slugError && (
              <p className="text-xs text-destructive">{slugError}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-site-domain">Domain</Label>
            <Input
              id="edit-site-domain"
              placeholder="www.example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-site-desc">Description</Label>
            <Input
              id="edit-site-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="mr-auto"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete Site
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update Site
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Sidebar Site Selector --------------------
//
// Lives INSIDE the sidebar header, directly below the "CMS Admin" logo row.
// Uses shadcn's `SidebarMenuButton` as the trigger so it inherits the
// sidebar's native sizing/spacing/hover/active styling AND auto-collapses
// to a 32px icon cell on the rail (group-data-[collapsible=icon]:size-8).
// The built-in `tooltip` prop shows a right-side label ONLY when collapsed
// (SidebarMenuButton hides its tooltip whenever state !== "collapsed").
//
// Dropdown positioning:
//   • Expanded  → side="bottom" align="start" (opens straight down, left-
//                 aligned with the trigger, inside the sidebar column).
//   • Collapsed → side="right"   align="center" (opens to the RIGHT of the
//                 48px rail, vertically centered on the icon — identical
//                 pattern to the collapsed-rail NotificationBell /
//                 UserProfileMenu / CollapsedParentNavItem popovers).
//   • `collisionPadding={12}` keeps it 12px from every viewport edge so it
//     is never clipped, and Radix renders the content through a Portal at
//     z-50 → the sidebar's `overflow: hidden` CANNOT clip it.
//
// "Create New Site" keeps the `onSelect` handler (NOT `onClick`) so the
// action fires synchronously during item activation, before the menu
// auto-closes/unmounts — reliable in BOTH sidebar states (see task 28).

export function SiteSelector() {
  const sites = useSiteStore((s) => s.sites);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const isAllSites = useSiteStore((s) => s.isAllSites());
  const setActiveSite = useSiteStore((s) => s.setActiveSite);
  const setAllSites = useSiteStore((s) => s.setAllSites);
  const [showCreate, setShowCreate] = useState(false);
  const [editSite, setEditSite] = useState<Site | null>(null);
  const { state, isMobile } = useSidebar();
  const isCollapsed = !isMobile && state === 'collapsed';

  const handleCreate = useCallback((site: Site) => {
    setActiveSite(site.id);
    setShowCreate(false);
  }, [setActiveSite]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          variant="outline"
          isActive={!!activeSite}
          tooltip={{
            side: 'right',
            align: 'center',
            sideOffset: 8,
            collisionPadding: 12,
            children: 'Switch Site',
          }}
          className="h-9 border border-sidebar-border bg-background/60 shadow-sm hover:bg-sidebar-accent hover:border-sidebar-accent-foreground/20 hover:shadow-md data-[state=open]:bg-sidebar-accent data-[state=open]:border-sidebar-accent-foreground/20 data-[active=true]:bg-sidebar-accent/60 transition-all duration-150"
          aria-label={
            activeSite
              ? `Switch site — current: ${activeSite.name}`
              : 'Switch site — All Sites'
          }
        >
          {isCollapsed ? (
            <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : activeSite ? (
            <span
              className={`h-2 w-2 rounded-full shrink-0 ring-2 ring-background ${getSiteColor(activeSite.slug)}`}
              aria-hidden="true"
            />
          ) : (
            <LayoutGrid className="h-4 w-4 shrink-0 text-sidebar-foreground/70" aria-hidden="true" />
          )}
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-sm font-medium">
                {activeSite ? activeSite.name : 'All Sites'}
              </span>
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </>
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isCollapsed ? 'center' : 'start'}
        side={isCollapsed ? 'right' : 'bottom'}
        sideOffset={isCollapsed ? 8 : 4}
        collisionPadding={12}
        className="w-64"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch Site
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* All Sites option */}
        <DropdownMenuItem
          className={isAllSites ? 'bg-accent' : ''}
          onClick={() => setAllSites()}
        >
          <LayoutGrid className="mr-2 h-4 w-4" />
          <span className="flex-1">All Sites</span>
          {isAllSites && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Individual sites with settings icon */}
        {sites.filter((s) => s.status === 'ACTIVE').map((s) => (
          <DropdownMenuItem
            key={s.id}
            className={activeSite?.id === s.id ? 'bg-accent' : ''}
            onClick={(e) => {
              e.preventDefault();
              setActiveSite(s.id);
            }}
          >
            <span
              className={`mr-2 h-2 w-2 rounded-full shrink-0 ${getSiteColor(s.slug)}`}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{s.name}</span>
            {s._count && (
              <span className="text-xs text-muted-foreground mr-2">
                {s._count.contentItems}
              </span>
            )}
            {activeSite?.id === s.id && (
              <Check className="h-4 w-4 text-primary mr-1" />
            )}
            <button
              className="ml-auto p-0.5 rounded hover:bg-muted transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setEditSite(s);
              }}
              title="Edit site"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuItem>
        ))}
        {sites.length === 0 && (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No sites yet
          </div>
        )}
        <DropdownMenuSeparator />
        {/* Create new site — `onSelect` (NOT `onClick`) so the handler
            fires synchronously during item activation, BEFORE the menu
            auto-closes/unmounts. Reliable in BOTH sidebar states. */}
        <DropdownMenuItem onSelect={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Site
        </DropdownMenuItem>
      </DropdownMenuContent>

      {showCreate && <CreateSiteDialog onClose={handleCreate} />}
      {editSite && (
        <EditSiteDialog
          site={editSite}
          onClose={() => setEditSite(null)}
        />
      )}
    </DropdownMenu>
  );
}
