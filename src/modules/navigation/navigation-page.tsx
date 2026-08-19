'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderTree,
  Link2,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Search,
  Menu,
  MapPin,
  Check,
  Loader2,
  Save,
  Send,
  AlertTriangle,
  X,
  ArrowRight,
  LayoutGrid,
  Globe,
  ExternalLink,
  Tag,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PageHeader,
  EmptyState,
  ConfirmDialog,
} from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { cn, slugify } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// -------------------- Types --------------------

type NavItemType = 'PAGE_LINK' | 'CATEGORY_LINK' | 'CUSTOM_URL' | 'SEPARATOR' | 'DROPDOWN' | 'CONTENT_REFERENCE';
type MenuLocation = 'HEADER' | 'SECONDARY' | 'FOOTER' | 'MOBILE' | null;
type MenuStatus = 'ACTIVE' | 'DRAFT' | 'DISABLED';

interface NavMenuItem {
  id: string;
  label: string;
  type: NavItemType;
  url: string;
  target: string;
  parentId?: string | null;
  order?: number;
  isActive?: boolean;
  icon?: string | null;
  description?: string | null;
  cssClass?: string | null;
  pageId?: string | null;
  categoryId?: string | null;
  contentId?: string | null;
  tagId?: string | null;
  children?: NavMenuItem[];
}

interface NavigationMenu {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  items: string;
  location: MenuLocation;
  status: MenuStatus;
  isActive: boolean;
  siteId: string | null;
  createdAt: string;
  updatedAt: string;
  site?: { id: string; name: string; slug: string } | null;
}

interface LookupItem {
  id: string;
  title?: string;
  name?: string;
  slug: string;
  status?: string;
}

// -------------------- Constants --------------------

const LOCATION_OPTIONS: { value: MenuLocation; label: string }[] = [
  { value: 'HEADER', label: 'Header' },
  { value: 'SECONDARY', label: 'Secondary' },
  { value: 'FOOTER', label: 'Footer' },
  { value: 'MOBILE', label: 'Mobile' },
];

const STATUS_OPTIONS: { value: MenuStatus; label: string; color: string }[] = [
  { value: 'ACTIVE', label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'DRAFT', label: 'Draft', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'DISABLED', label: 'Disabled', color: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
];

const ITEM_TYPE_OPTIONS: { value: NavItemType; label: string; icon: React.ReactNode }[] = [
  { value: 'CUSTOM_URL', label: 'Custom Link', icon: <Link2 className="h-4 w-4" /> },
  { value: 'PAGE_LINK', label: 'Page', icon: <FileText className="h-4 w-4" /> },
  { value: 'CONTENT_REFERENCE', label: 'Article', icon: <BookOpen className="h-4 w-4" /> },
  { value: 'CATEGORY_LINK', label: 'Category', icon: <FolderTree className="h-4 w-4" /> },
  { value: 'DROPDOWN', label: 'Dropdown', icon: <ChevronRight className="h-4 w-4" /> },
  { value: 'SEPARATOR', label: 'Separator', icon: <Minus className="h-4 w-4" /> },
];

function Minus({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="12" x2="20" y2="12" /></svg>;
}

// -------------------- Helper Functions --------------------

function parseItems(itemsStr: string): NavMenuItem[] {
  try {
    const parsed = JSON.parse(itemsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function flattenItems(items: NavMenuItem[]): NavMenuItem[] {
  const result: NavMenuItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children?.length) {
      result.push(...flattenItems(item.children));
    }
  }
  return result;
}

function countItems(items: NavMenuItem[]): number {
  let count = 0;
  for (const item of items) {
    count++;
    if (item.children?.length) count += countItems(item.children);
  }
  return count;
}

function getItemTypeIcon(type: NavItemType) {
  const found = ITEM_TYPE_OPTIONS.find(o => o.value === type);
  return found?.icon || <Link2 className="h-4 w-4" />;
}

function getItemUrl(item: NavMenuItem): string {
  switch (item.type) {
    case 'PAGE_LINK': return item.pageId ? `/page/${item.pageId}` : item.url || '';
    case 'CONTENT_REFERENCE': return item.contentId ? `/articles/${item.contentId}` : item.url || '';
    case 'CATEGORY_LINK': return item.categoryId ? `/category/${item.categoryId}` : item.url || '';
    default: return item.url || '';
  }
}

// -------------------- Main Component --------------------

export function NavigationPage() {
  const queryClient = useQueryClient();
  const { isAllSites, getActiveSite } = useSiteStore();
  const activeSite = getActiveSite();

  // State
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<NavMenuItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteItemRemoveChildren, setDeleteItemRemoveChildren] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localItems, setLocalItems] = useState<NavMenuItem[]>([]);
  const [editingMenu, setEditingMenu] = useState<NavigationMenu | null>(null);
  const [lookupResults, setLookupResults] = useState<LookupItem[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupSearch, setLookupSearch] = useState('');
  const [validationWarnings, setValidationWarnings] = useState<{ itemId: string; message: string; severity: string }[]>([]);

  // New menu form
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuDesc, setNewMenuDesc] = useState('');
  const [newMenuLocation, setNewMenuLocation] = useState<string>('');

  // Add/Edit item form
  const [itemForm, setItemForm] = useState<Partial<NavMenuItem>>({
    label: '',
    type: 'CUSTOM_URL',
    url: '',
    target: '_self',
    isActive: true,
    icon: '',
    description: '',
    cssClass: '',
  });
  const [selectedLookupItem, setSelectedLookupItem] = useState<LookupItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // ---------- Queries ----------

  const listParams = useMemo(() => {
    const p: Record<string, unknown> = {
      pageSize: 100,
      sort: 'createdAt',
      order: 'desc',
    };
    if (searchQuery) p.search = searchQuery;
    if (isAllSites()) p.allSites = 'true';
    return p;
  }, [searchQuery, isAllSites]);

  const { data: menusRaw, isLoading: menusLoading } = useQuery({
    queryKey: queryKeys.navigation.list(listParams),
    queryFn: () =>
      getApi<NavigationMenu[]>('/api/navigation', listParams, { raw: true }).then((r) => {
        const res = r as unknown as { data: NavigationMenu[]; meta: { pagination: { total: number } } };
        return res;
      }),
  });

  const menus = Array.isArray((menusRaw as any)?.data) ? (menusRaw as any).data as NavigationMenu[] : [];
  const totalMenus = (menusRaw as any)?.meta?.pagination?.total ?? 0;

  const selectedMenu = menus.find(m => m.id === selectedMenuId) || null;

  // Fetch selected menu detail (with items)
  const { data: menuDetail, isLoading: menuDetailLoading } = useQuery({
    queryKey: queryKeys.navigation.detail(selectedMenuId || '__none__'),
    queryFn: () => getApi<NavigationMenu>(`/api/navigation/${selectedMenuId}`),
    enabled: !!selectedMenuId,
  });

  // Sync local items with server data
  useEffect(() => {
    if (menuDetail) {
      setLocalItems(parseItems(menuDetail.items));
      setHasUnsavedChanges(false);
      setValidationWarnings([]);
    }
  }, [menuDetail]);

  // ---------- Mutations ----------

  const createMenuMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description: string; location: string }) =>
      postApi('/api/navigation', { ...data, items: '[]', status: 'DRAFT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.navigation.all });
      setCreateMenuOpen(false);
      setNewMenuName('');
      setNewMenuDesc('');
      setNewMenuLocation('');
      toast.success('Menu created successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create menu'),
  });

  const updateMenuMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      patchApi(`/api/navigation/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.navigation.all });
      if (selectedMenuId) queryClient.invalidateQueries({ queryKey: queryKeys.navigation.detail(selectedMenuId) });
      setEditMenuOpen(false);
      setEditingMenu(null);
      toast.success('Menu updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update menu'),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/navigation/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.navigation.all });
      if (selectedMenuId === deleteMenuId) setSelectedMenuId(null);
      setDeleteMenuId(null);
      toast.success('Menu deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete menu'),
  });

  const duplicateMenuMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/navigation/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.navigation.all });
      toast.success('Menu duplicated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to duplicate menu'),
  });

  const publishMenuMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/navigation/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.navigation.all });
      if (selectedMenuId) queryClient.invalidateQueries({ queryKey: queryKeys.navigation.detail(selectedMenuId) });
      toast.success('Menu published successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to publish menu'),
  });

  const saveItemsMutation = useMutation({
    mutationFn: ({ id, items }: { id: string; items: NavMenuItem[] }) =>
      patchApi(`/api/navigation/${id}`, { items: JSON.stringify(items) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.navigation.all });
      if (selectedMenuId) queryClient.invalidateQueries({ queryKey: queryKeys.navigation.detail(selectedMenuId) });
      setHasUnsavedChanges(false);
      toast.success('Changes saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save changes'),
  });

  const addItemMutation = useMutation({
    mutationFn: ({ menuId, item }: { menuId: string; item: Partial<NavMenuItem> }) =>
      postApi(`/api/navigation/${menuId}/items`, { item }),
    onSuccess: () => {
      if (selectedMenuId) queryClient.invalidateQueries({ queryKey: queryKeys.navigation.detail(selectedMenuId) });
      setAddItemOpen(false);
      resetItemForm();
      toast.success('Item added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add item'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ menuId, itemId, data }: { menuId: string; itemId: string; data: Record<string, unknown> }) =>
      patchApi(`/api/navigation/${menuId}/items/${itemId}`, data),
    onSuccess: () => {
      if (selectedMenuId) queryClient.invalidateQueries({ queryKey: queryKeys.navigation.detail(selectedMenuId) });
      setEditItem(null);
      toast.success('Item updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update item'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ menuId, itemId, removeChildren }: { menuId: string; itemId: string; removeChildren: boolean }) =>
      deleteApi(`/api/navigation/${menuId}/items/${itemId}?removeChildren=${removeChildren}`),
    onSuccess: () => {
      if (selectedMenuId) queryClient.invalidateQueries({ queryKey: queryKeys.navigation.detail(selectedMenuId) });
      setDeleteItemId(null);
      toast.success('Item removed');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to remove item'),
  });

  const validateMutation = useMutation({
    mutationFn: (id: string) => postApi<{ valid: boolean; warnings: { itemId: string; message: string; severity: string }[] }>(`/api/navigation/${id}/validate`),
    onSuccess: (data) => {
      setValidationWarnings(data.warnings || []);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ id, items }: { id: string; items: NavMenuItem[] }) =>
      postApi(`/api/navigation/${id}/reorder`, { items }),
    onSuccess: () => {
      if (selectedMenuId) queryClient.invalidateQueries({ queryKey: queryKeys.navigation.detail(selectedMenuId) });
      setHasUnsavedChanges(false);
    },
  });

  // ---------- Lookup ----------

  const searchLookup = useCallback(async (type: string, search: string) => {
    if (!search.trim()) { setLookupResults([]); return; }
    setLookupLoading(true);
    try {
      const results = await getApi<LookupItem[]>('/api/navigation/lookup', { type, search, limit: 20 });
      setLookupResults(Array.isArray(results) ? results : []);
    } catch {
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  // ---------- Handlers ----------

  const handleCreateMenu = () => {
    if (!newMenuName.trim()) return;
    const slug = slugify(newMenuName);
    createMenuMutation.mutate({
      name: newMenuName.trim(),
      slug,
      description: newMenuDesc.trim(),
      location: newMenuLocation || 'HEADER',
    });
  };

  const resetItemForm = () => {
    setItemForm({
      label: '', type: 'CUSTOM_URL', url: '', target: '_self', isActive: true, icon: '', description: '', cssClass: '',
    });
    setSelectedLookupItem(null);
    setLookupResults([]);
    setLookupSearch('');
  };

  const handleAddItem = () => {
    if (!selectedMenuId) return;
    const item: Partial<NavMenuItem> = { ...itemForm };
    // Set URL based on selected lookup item
    if (selectedLookupItem) {
      item.url = `/${selectedLookupItem.slug}`;
      if (itemForm.type === 'PAGE_LINK') item.pageId = selectedLookupItem.id;
      if (itemForm.type === 'CONTENT_REFERENCE') item.contentId = selectedLookupItem.id;
      if (itemForm.type === 'CATEGORY_LINK') item.categoryId = selectedLookupItem.id;
    }
    addItemMutation.mutate({ menuId: selectedMenuId, item });
  };

  const handleUpdateItem = () => {
    if (!selectedMenuId || !editItem) return;
    const data: Record<string, unknown> = { ...itemForm };
    if (selectedLookupItem) {
      data.url = `/${selectedLookupItem.slug}`;
      if (itemForm.type === 'PAGE_LINK') data.pageId = selectedLookupItem.id;
      if (itemForm.type === 'CONTENT_REFERENCE') data.contentId = selectedLookupItem.id;
      if (itemForm.type === 'CATEGORY_LINK') data.categoryId = selectedLookupItem.id;
    }
    updateItemMutation.mutate({ menuId: selectedMenuId, itemId: editItem.id, data });
  };

  const handleSaveChanges = () => {
    if (!selectedMenuId) return;
    saveItemsMutation.mutate({ id: selectedMenuId, items: localItems });
  };

  const handlePublish = () => {
    if (!selectedMenuId) return;
    if (hasUnsavedChanges) {
      // Save first, then publish
      saveItemsMutation.mutate(
        { id: selectedMenuId, items: localItems },
        {
          onSuccess: () => publishMenuMutation.mutate(selectedMenuId),
        },
      );
    } else {
      publishMenuMutation.mutate(selectedMenuId);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveItem = (items: NavMenuItem[], activeId: string, overId: string, newParentId?: string | null): NavMenuItem[] => {
    // Find and remove the active item
    let activeItem: NavMenuItem | null = null;
    const removeItem = (arr: NavMenuItem[]): NavMenuItem[] => {
      const result: NavMenuItem[] = [];
      for (const item of arr) {
        if (item.id === activeId) {
          activeItem = item;
          continue;
        }
        if (item.children?.length) {
          result.push({ ...item, children: removeItem(item.children) });
        } else {
          result.push(item);
        }
      }
      return result;
    };

    let newItems = removeItem(items);
    if (!activeItem) return items;

    // If new parent specified, insert under that parent
    if (newParentId !== undefined) {
      if (newParentId === null) {
        // Move to root level
        const overIdx = newItems.findIndex(i => i.id === overId);
        if (overIdx >= 0) {
          newItems.splice(overIdx + 1, 0, { ...activeItem, parentId: null, children: activeItem.children || [] });
        } else {
          newItems.push({ ...activeItem, parentId: null, children: activeItem.children || [] });
        }
      } else {
        // Insert under parent
        const insertUnder = (arr: NavMenuItem[]): boolean => {
          for (let i = 0; i < arr.length; i++) {
            if (arr[i].id === newParentId) {
              if (!arr[i].children) arr[i].children = [];
              const clean = { ...activeItem, parentId: newParentId, children: activeItem.children || [] };
              arr[i].children!.push(clean);
              return true;
            }
            if (arr[i].children && insertUnder(arr[i].children!)) return true;
          }
          return false;
        };
        insertUnder(newItems);
      }
    } else {
      // Simple reorder at same level
      const ids = newItems.map(i => i.id);
      const overIdx = ids.indexOf(overId);
      if (overIdx >= 0) {
        const clean = { ...activeItem, children: activeItem.children || [] };
        newItems.splice(overIdx + 1, 0, clean);
      } else {
        newItems.push({ ...activeItem, children: activeItem.children || [] });
      }
    }

    return newItems;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedMenuId) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Check if dragging into a nested item (shift key or indent)
    const newItems = moveItem(localItems, activeId, overId);
    setLocalItems(newItems);
    setHasUnsavedChanges(true);
  };

  const handleToggleItemActive = (itemId: string) => {
    if (!selectedMenuId) return;
    const toggle = (items: NavMenuItem[]): NavMenuItem[] =>
      items.map(item => {
        if (item.id === itemId) return { ...item, isActive: !item.isActive };
        if (item.children?.length) return { ...item, children: toggle(item.children) };
        return item;
      });
    setLocalItems(prev => toggle(prev));
    setHasUnsavedChanges(true);
  };

  const openEditItem = (item: NavMenuItem) => {
    setEditItem(item);
    setItemForm({
      label: item.label,
      type: item.type,
      url: item.url,
      target: item.target || '_self',
      isActive: item.isActive !== false,
      icon: item.icon || '',
      description: item.description || '',
      cssClass: item.cssClass || '',
    });
    setSelectedLookupItem(null);
    // Auto-search for referenced content
    if (item.pageId || item.contentId || item.categoryId) {
      const refId = item.pageId || item.contentId || item.categoryId;
      const type = item.pageId ? 'pages' : item.contentId ? 'content' : 'categories';
      searchLookup(type, refId!);
    }
  };

  const openEditMenu = (menu: NavigationMenu) => {
    setEditingMenu(menu);
    setNewMenuName(menu.name);
    setNewMenuDesc(menu.description || '');
    setNewMenuLocation(menu.location || '');
    setEditMenuOpen(true);
  };

  const handleUpdateMenu = () => {
    if (!editingMenu || !newMenuName.trim()) return;
    const data: Record<string, unknown> = { name: newMenuName.trim() };
    if (newMenuDesc !== editingMenu.description) data.description = newMenuDesc.trim() || null;
    if (newMenuLocation !== (editingMenu.location || '')) data.location = newMenuLocation || null;
    updateMenuMutation.mutate({ id: editingMenu.id, data });
  };

  // ---------- Group menus by site for All Sites view ----------

  const menusBySite = useMemo(() => {
    if (!isAllSites()) return null;
    const groups: Record<string, { name: string; slug: string; menus: NavigationMenu[] }> = {};
    for (const menu of menus) {
      const siteKey = menu.site?.name || 'Unassigned';
      const siteSlug = menu.site?.slug || 'unassigned';
      if (!groups[siteKey]) {
        groups[siteKey] = { name: siteKey, slug: siteSlug, menus: [] };
      }
      groups[siteKey].menus.push(menu);
    }
    return groups;
  }, [menus, isAllSites]);

  // ---------- Render: Menu List ----------

  const renderMenuCard = (menu: NavigationMenu) => {
    const items = parseItems(menu.items);
    const itemCount = countItems(items);
    const isSelected = menu.id === selectedMenuId;
    const statusInfo = STATUS_OPTIONS.find(s => s.value === menu.status);
    const locLabel = LOCATION_OPTIONS.find(l => l.value === menu.location)?.label;

    return (
      <Card
        key={menu.id}
        className={cn(
          'cursor-pointer transition-all hover:shadow-md border-2',
          isSelected ? 'border-primary shadow-md' : 'border-transparent',
        )}
        onClick={() => setSelectedMenuId(menu.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm truncate">{menu.name}</h3>
                {statusInfo && (
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                )}
              </div>
              {locLabel && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <MapPin className="h-3 w-3" />
                  {locLabel}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditMenu(menu); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateMenuMutation.mutate(menu.id); }}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedMenuId(menu.id); setPreviewOpen(true); }}>
                  <Eye className="h-4 w-4 mr-2" /> Preview
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteMenuId(menu.id); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {menu.site && isAllSites() && (
            <div className="mt-2 pt-2 border-t">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {menu.site.name}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ---------- Render: Sortable Item ----------

  const SortableItem = ({ item, depth = 0 }: { item: NavMenuItem; depth?: number }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.id,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedIds.has(item.id);
    const typeIcon = getItemTypeIcon(item.type);
    const isInactive = item.isActive === false;

    return (
      <div ref={setNodeRef} style={style}>
        <div
          className={cn(
            'group flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm transition-colors',
            isDragging ? 'bg-muted shadow-lg' : 'bg-card hover:bg-accent/50',
            isInactive && 'opacity-50',
          )}
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          <button
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(item.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <span className="text-muted-foreground">{typeIcon}</span>

          <span className={cn('flex-1 truncate', item.type === 'SEPARATOR' && 'text-muted-foreground italic')}>
            {item.type === 'SEPARATOR' ? '——— Separator ———' : item.label}
          </span>

          {item.url && item.type !== 'SEPARATOR' && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px] hidden sm:inline-block">
              {item.url}
            </span>
          )}

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleToggleItemActive(item.id)}
              title={isInactive ? 'Enable' : 'Disable'}
            >
              {isInactive ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => openEditItem(item)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => { setDeleteItemId(item.id); setDeleteItemRemoveChildren(false); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {item.children!.map(child => (
              <SortableItem key={child.id} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ---------- Render: Preview ----------

  const PreviewItem = ({ item, depth = 0 }: { item: NavMenuItem; depth?: number }) => {
    if (item.isActive === false) return null;
    if (item.type === 'SEPARATOR') {
      return <div className="border-t my-1" style={{ marginLeft: `${depth * 16}px` }} />;
    }
    return (
      <div style={{ marginLeft: `${depth * 16}px` }}>
        <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/30 text-sm">
          {item.children?.length ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="font-medium">{item.label}</span>
          {item.url && (
            <span className="text-xs text-muted-foreground truncate">({item.url})</span>
          )}
        </div>
        {item.children?.map(child => (
          <PreviewItem key={child.id} item={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  // ---------- Lookup type for current form ----------

  const currentLookupType = useMemo(() => {
    switch (itemForm.type) {
      case 'PAGE_LINK': return 'pages';
      case 'CONTENT_REFERENCE': return 'content';
      case 'CATEGORY_LINK': return 'categories';
      default: return null;
    }
  }, [itemForm.type]);

  useEffect(() => {
    if (currentLookupType && lookupSearch) {
      const timer = setTimeout(() => searchLookup(currentLookupType, lookupSearch), 300);
      return () => clearTimeout(timer);
    } else {
      setLookupResults([]);
    }
  }, [lookupSearch, currentLookupType, searchLookup]);

  // ---------- Main Render ----------

  return (
    <div className="space-y-4">
      <PageHeader
        title="Navigation"
        description="Manage menus and navigation structures"
        action={
          <Button onClick={() => setCreateMenuOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Create Menu
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ===== Left Panel: Menu List ===== */}
        <div className="lg:col-span-4">
          <Card>
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menus..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {menusLoading ? '...' : `${totalMenus} menu${totalMenus !== 1 ? 's' : ''}`}
              </div>
            </div>

            <div className="p-3 max-h-[calc(100vh-340px)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {menusLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2 p-4 border rounded-lg">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : menusBySite ? (
                // All Sites view
                Object.entries(menusBySite).length === 0 ? (
                  <EmptyState icon={Menu} title="No menus found" description="Create your first navigation menu to get started." />
                ) : (
                  Object.entries(menusBySite).map(([siteName, group]) => (
                    <div key={siteName} className="mb-4">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{siteName}</span>
                      </div>
                      <div className="space-y-2">
                        {group.menus.map(renderMenuCard)}
                      </div>
                    </div>
                  ))
                )
              ) : menus.length === 0 ? (
                <EmptyState icon={Menu} title="No menus created yet" description="Create your first navigation menu to get started." />
              ) : (
                <div className="space-y-2">
                  {menus.map(renderMenuCard)}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ===== Right Panel: Menu Builder ===== */}
        <div className="lg:col-span-8">
          {!selectedMenuId ? (
            <Card>
              <EmptyState
                icon={LayoutGrid}
                title="Select a menu"
                description="Choose a menu from the left panel to manage its items, or create a new menu."
              />
            </Card>
          ) : menuDetailLoading ? (
            <Card className="p-8">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading menu...</span>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              {/* Menu Header */}
              <div className="p-4 border-b bg-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-lg">{menuDetail?.name}</h2>
                      {menuDetail?.status && (
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', STATUS_OPTIONS.find(s => s.value === menuDetail.status)?.color)}>
                          {STATUS_OPTIONS.find(s => s.value === menuDetail.status)?.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {menuDetail?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {LOCATION_OPTIONS.find(l => l.value === menuDetail.location)?.label}
                        </span>
                      )}
                      <span>{countItems(localItems)} items</span>
                      {hasUnsavedChanges && (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Unsaved changes
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => validateMutation.mutate(selectedMenuId)}
                      disabled={validateMutation.isPending}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Validate
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveChanges}
                      disabled={saveItemsMutation.isPending || !hasUnsavedChanges}
                    >
                      {saveItemsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Save Changes
                    </Button>
                    <Button
                      size="sm"
                      onClick={handlePublish}
                      disabled={publishMenuMutation.isPending}
                    >
                      {publishMenuMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                      Publish
                    </Button>
                  </div>
                </div>

                {/* Validation Warnings */}
                {validationWarnings.length > 0 && (
                  <div className="mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-medium mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {validationWarnings.filter(w => w.severity === 'error').length} issue(s) found
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {validationWarnings.slice(0, 5).map((w, i) => (
                        <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• {w.message}</p>
                      ))}
                      {validationWarnings.length > 5 && (
                        <p className="text-xs text-muted-foreground">+{validationWarnings.length - 5} more...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Menu Items Builder */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Menu Items</h3>
                  <Button variant="outline" size="sm" onClick={() => { resetItemForm(); setAddItemOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                </div>

                {localItems.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Menu className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">This menu has no items yet.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => { resetItemForm(); setAddItemOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Menu Item
                    </Button>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={flattenItems(localItems).map(i => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {localItems.map(item => (
                          <SortableItem key={item.id} item={item} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ===== Create Menu Dialog ===== */}
      <Dialog open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Menu</DialogTitle>
            <DialogDescription>Create a new navigation menu for your site.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Menu Name</Label>
              <Input
                placeholder="e.g., Main Menu"
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateMenu()}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                placeholder="main-menu"
                value={slugify(newMenuName)}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Brief description..."
                value={newMenuDesc}
                onChange={(e) => setNewMenuDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={newMenuLocation} onValueChange={setNewMenuLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_OPTIONS.map(loc => (
                    <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMenuOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateMenu} disabled={!newMenuName.trim() || createMenuMutation.isPending}>
              {createMenuMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Create Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Menu Dialog ===== */}
      <Dialog open={editMenuOpen} onOpenChange={setEditMenuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Menu</DialogTitle>
            <DialogDescription>Update menu settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Menu Name</Label>
              <Input
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newMenuDesc}
                onChange={(e) => setNewMenuDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={newMenuLocation} onValueChange={setNewMenuLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_OPTIONS.map(loc => (
                    <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMenuOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateMenu} disabled={!newMenuName.trim() || updateMenuMutation.isPending}>
              {updateMenuMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Add/Edit Item Dialog ===== */}
      <Dialog
        open={addItemOpen || !!editItem}
        onOpenChange={(open) => {
          if (!open) { setAddItemOpen(false); setEditItem(null); resetItemForm(); }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
            <DialogDescription>
              {editItem ? 'Update the menu item details.' : 'Add a new item to the navigation menu.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select
                value={itemForm.type}
                onValueChange={(v) => {
                  setItemForm(prev => ({ ...prev, type: v as NavItemType }));
                  setSelectedLookupItem(null);
                  setLookupResults([]);
                  setLookupSearch('');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">{opt.icon} {opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content Lookup for non-custom types */}
            {currentLookupType && (
              <div className="space-y-2">
                <Label>
                  Select {itemForm.type === 'PAGE_LINK' ? 'Page' : itemForm.type === 'CONTENT_REFERENCE' ? 'Article' : 'Category'}
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${currentLookupType}...`}
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {lookupLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                  </div>
                )}
                {lookupResults.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {lookupResults.map((result) => (
                      <button
                        key={result.id}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors border-b last:border-b-0',
                          selectedLookupItem?.id === result.id && 'bg-accent',
                        )}
                        onClick={() => {
                          setSelectedLookupItem(result);
                          setItemForm(prev => ({
                            ...prev,
                            label: prev.label || result.title || result.name || '',
                            url: `/${result.slug}`,
                          }));
                        }}
                      >
                        <div className="font-medium">{result.title || result.name}</div>
                        <div className="text-xs text-muted-foreground">/{result.slug}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="Display text"
                value={itemForm.label}
                onChange={(e) => setItemForm(prev => ({ ...prev, label: e.target.value }))}
              />
            </div>

            {(itemForm.type === 'CUSTOM_URL' || itemForm.type === 'SEPARATOR') && (
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  placeholder="https://example.com/page"
                  value={itemForm.url}
                  onChange={(e) => setItemForm(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Target</Label>
              <Select
                value={itemForm.target || '_self'}
                onValueChange={(v) => setItemForm(prev => ({ ...prev, target: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_self">Same window</SelectItem>
                  <SelectItem value="_blank">New window</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Tooltip or description"
                value={itemForm.description || ''}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>CSS Class (optional)</Label>
              <Input
                placeholder="custom-css-class"
                value={itemForm.cssClass || ''}
                onChange={(e) => setItemForm(prev => ({ ...prev, cssClass: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Icon (optional)</Label>
              <Input
                placeholder="Icon name (e.g., lucide:home)"
                value={itemForm.icon || ''}
                onChange={(e) => setItemForm(prev => ({ ...prev, icon: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={itemForm.isActive !== false}
                onCheckedChange={(checked) => setItemForm(prev => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddItemOpen(false); setEditItem(null); resetItemForm(); }}>Cancel</Button>
            <Button
              onClick={editItem ? handleUpdateItem : handleAddItem}
              disabled={!itemForm.label?.trim() || addItemMutation.isPending || updateItemMutation.isPending}
            >
              {(addItemMutation.isPending || updateItemMutation.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editItem ? 'Update Item' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Preview Dialog ===== */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Menu Preview</DialogTitle>
            <DialogDescription>How the navigation will appear structurally.</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-background">
            {localItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No items to preview</p>
            ) : (
              localItems.map(item => <PreviewItem key={item.id} item={item} />)
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Menu Confirm ===== */}
      <ConfirmDialog
        open={!!deleteMenuId}
        onOpenChange={(open) => !open && setDeleteMenuId(null)}
        title="Delete Menu"
        description={
          menus.find(m => m.id === deleteMenuId)?.location
            ? `This menu is currently assigned to ${LOCATION_OPTIONS.find(l => l.value === menus.find(m => m.id === deleteMenuId)?.location)?.label} Navigation. Deleting it will remove the navigation for this site.`
            : 'Are you sure you want to delete this menu? This action cannot be undone.'
        }
        confirmLabel="Delete Menu"
        variant="destructive"
        onConfirm={() => deleteMenuId && deleteMenuMutation.mutate(deleteMenuId)}
        isLoading={deleteMenuMutation.isPending}
      />

      {/* ===== Delete Item Confirm ===== */}
      <Dialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Menu Item</DialogTitle>
            <DialogDescription>
              This item will be removed from the menu.
            </DialogDescription>
          </DialogHeader>

          {/* Check if item has children */}
          {(() => {
            const findItem = (items: NavMenuItem[], id: string): NavMenuItem | null => {
              for (const item of items) {
                if (item.id === id) return item;
                if (item.children?.length) {
                  const found = findItem(item.children, id);
                  if (found) return found;
                }
              }
              return null;
            };
            const item = deleteItemId ? findItem(localItems, deleteItemId) : null;
            const hasChildren = item?.children && item.children.length > 0;

            return hasChildren ? (
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  &ldquo;{item?.label}&rdquo; has <strong>{item?.children?.length}</strong> child item(s). How would you like to handle them?
                </p>
                <div className="space-y-2">
                  <label
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      !deleteItemRemoveChildren && 'border-primary bg-primary/5',
                    )}
                  >
                    <input
                      type="radio"
                      name="deleteAction"
                      checked={!deleteItemRemoveChildren}
                      onChange={() => setDeleteItemRemoveChildren(false)}
                      className="accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">Move children to parent level</p>
                      <p className="text-xs text-muted-foreground">Child items will be promoted one level up</p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      deleteItemRemoveChildren && 'border-destructive bg-destructive/5',
                    )}
                  >
                    <input
                      type="radio"
                      name="deleteAction"
                      checked={deleteItemRemoveChildren}
                      onChange={() => setDeleteItemRemoveChildren(true)}
                      className="accent-destructive"
                    />
                    <div>
                      <p className="text-sm font-medium">Delete this item and all children</p>
                      <p className="text-xs text-muted-foreground">All child items will be permanently removed</p>
                    </div>
                  </label>
                </div>
              </div>
            ) : null;
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItemId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteItemId && selectedMenuId) {
                  deleteItemMutation.mutate({ menuId: selectedMenuId, itemId: deleteItemId, removeChildren: deleteItemRemoveChildren });
                }
              }}
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Delete Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
