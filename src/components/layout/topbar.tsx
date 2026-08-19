'use client';

import { useTheme } from 'next-themes';
import { useState, useCallback, useEffect } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  Plus,
  Check,
  ChevronDown,
  LayoutGrid,
  CreditCard,
  Languages,
  Loader2,
  Trash2,
} from 'lucide-react';
import { getInitials, cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSiteStore, type Site } from '@/lib/stores/site-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { useCommandPaletteStore } from '@/lib/stores/command-palette-store';
import { useLocaleStore } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
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

// -------------------- Create Site Dialog --------------------

function CreateSiteDialog({ onClose }: { onClose: (site: Site) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(true);
  const createSite = useSiteStore((s) => s.createSite);

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
    if (!name.trim() || !slug.trim()) return;
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
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-slug">Slug</Label>
            <Input
              id="site-slug"
              placeholder="my-new-blog"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
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
          <Button onClick={handleSubmit} disabled={!name.trim() || !slug.trim() || isCreating}>
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
  const [open, setOpen] = useState(true);
  const updateSite = useSiteStore((s) => s.updateSite);
  const deleteSite = useSiteStore((s) => s.deleteSite);

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) return;
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
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-site-slug">Site URL / Slug</Label>
            <Input
              id="edit-site-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
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
          <Button onClick={handleSave} disabled={!name.trim() || !slug.trim() || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update Site
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Site Selector --------------------

function SiteSelector() {
  const sites = useSiteStore((s) => s.sites);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const isAllSites = useSiteStore((s) => s.isAllSites());
  const setActiveSite = useSiteStore((s) => s.setActiveSite);
  const setAllSites = useSiteStore((s) => s.setAllSites);
  const [showCreate, setShowCreate] = useState(false);
  const [editSite, setEditSite] = useState<Site | null>(null);

  const handleCreate = useCallback((site: Site) => {
    setActiveSite(site.id);
    setShowCreate(false);
  }, [setActiveSite]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 max-w-[200px] font-normal text-foreground border-border/60 hover:bg-accent/50"
          >
            {activeSite ? (
              <>
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${getSiteColor(activeSite.slug)}`}
                  aria-hidden="true"
                />
                <span className="truncate text-sm">{activeSite.name}</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">All Sites</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
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
          {/* Create new site */}
          <DropdownMenuItem onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Site
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showCreate && <CreateSiteDialog onClose={handleCreate} />}
      {editSite && (
        <EditSiteDialog
          site={editSite}
          onClose={() => setEditSite(null)}
        />
      )}
    </>
  );
}

// -------------------- Topbar --------------------

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleNavigate = (targetMod: string) => {
    useNavigationStore.getState().navigate(targetMod);
    closeMobile();
  };

  return (
    <header className="h-14 shrink-0 border-b bg-background flex items-center gap-2 px-3 sm:px-4">
      {/* Mobile menu toggle + Sidebar trigger */}
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="mr-1 h-4" />

      {/* Site Selector */}
      <SiteSelector />

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Breadcrumbs */}
      <div className="flex-1 overflow-hidden">
        <Breadcrumbs />
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1">
        {/* Search button */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex h-8 w-48 justify-start gap-2 text-muted-foreground font-normal"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4" />
          <span className="text-xs">Search...</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:hidden"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTheme}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          onClick={() => handleNavigate('notifications')}
        >
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? 'User'} />
                <AvatarFallback className="text-xs">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name ?? 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email ?? ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleNavigate('profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <Languages className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Language</span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={cn(
                      'h-6 px-2.5 text-xs font-medium rounded-md transition-colors',
                      locale === 'en'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                    onClick={() => { setLocale('en'); toast.success('Language set to EN'); }}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'h-6 px-2.5 text-xs font-medium rounded-md transition-colors',
                      locale === 'fr'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                    onClick={() => { setLocale('fr'); toast.success('Langue définie sur FR'); }}
                  >
                    FR
                  </button>
                </div>
              </div>
              <DropdownMenuItem onClick={() => handleNavigate('billing')}>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigate('settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => void logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
