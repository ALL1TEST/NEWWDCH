'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Plus,
  FolderOpen,
  GripVertical,
  Pencil,
  Trash2,
  Loader2,
  Search,
  LayoutGrid,
  List,
  FileText,
  ChevronRight,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ConfirmDialog } from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, slugify } from '@/lib/utils';

// -------------------- Types --------------------

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  childrenCount: number;
  contentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
}

// -------------------- Flat tree cache --------------------

type CategoryMap = Record<string, CategoryNode>;
type ChildrenMap = Record<string, string[]>;

type ViewMode = 'grid' | 'list';

// -------------------- Color Palette --------------------

const COLOR_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#f97316', '#6366f1',
];

function getColorForCategory(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

// -------------------- Category Form (shared by Sheet & Edit) --------------------

interface CategoryFormProps {
  data: CategoryFormData;
  onChange: (data: CategoryFormData) => void;
  allCategories: CategoryNode[];
  excludeId?: string;
  autoFocus?: boolean;
}

function CategoryForm({ data, onChange, allCategories, excludeId, autoFocus }: CategoryFormProps) {
  const handleNameChange = useCallback(
    (name: string) => {
      onChange({ ...data, name, slug: slugify(name) });
    },
    [data, onChange],
  );

  // Build parent options (exclude self and descendants)
  const parentOptions = useMemo(() => {
    if (!excludeId) return allCategories;
    const descendantIds = new Set<string>();
    const collectDescendants = (id: string, nodes: CategoryNode[]) => {
      for (const n of nodes) {
        if (n.parentId === id) {
          descendantIds.add(n.id);
          collectDescendants(n.id, nodes);
        }
      }
    };
    collectDescendants(excludeId, allCategories);
    return allCategories.filter((c) => c.id !== excludeId && !descendantIds.has(c.id));
  }, [allCategories, excludeId]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cat-name">Name</Label>
        <Input
          id="cat-name"
          value={data.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Category name"
          autoFocus={autoFocus}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cat-slug">Slug</Label>
        <Input
          id="cat-slug"
          value={data.slug}
          onChange={(e) => onChange({ ...data, slug: e.target.value })}
          placeholder="category-slug"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cat-description">Description</Label>
        <Textarea
          id="cat-description"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Optional description"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cat-parent">Parent Category</Label>
        <Select
          value={data.parentId ?? '__root__'}
          onValueChange={(v) => onChange({ ...data, parentId: v === '__root__' ? null : v })}
        >
          <SelectTrigger id="cat-parent">
            <SelectValue placeholder="None (root level)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__root__">None (root level)</SelectItem>
            {parentOptions.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// -------------------- Grid View Category Card --------------------

interface CategoryCardProps {
  category: CategoryNode;
  categoryMap: CategoryMap;
  color: string;
  isSelected: boolean;
  isChecked: boolean;
  onCheck: (id: string, checked: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (category: CategoryNode) => void;
  onCreateSub: (parentId: string) => void;
}

function CategoryCard({
  category,
  categoryMap,
  color,
  isSelected,
  isChecked,
  onCheck,
  onEdit,
  onDelete,
  onCreateSub,
}: CategoryCardProps) {
  const parent = category.parentId ? categoryMap[category.parentId] : null;
  const hasSeo = category.description && category.description.trim().length > 0;

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card transition-all duration-200 hover:shadow-md overflow-hidden',
        isSelected && 'ring-2 ring-primary/30 border-primary/40',
      )}
    >
      {/* Color strip */}
      <div className="h-2" style={{ backgroundColor: color }} />

      {/* Checkbox (hover reveal) */}
      <div className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => onCheck(category.id, !!checked)}
          aria-label={`Select ${category.name}`}
        />
      </div>

      {/* Hover actions */}
      <div className="absolute top-4 right-12 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onEdit(category.id)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => onDelete(category)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
          {category.childrenCount === 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => onCreateSub(category.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add sub-category</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>

      {/* Card body */}
      <div className="p-4 pt-3">
        <div className="flex items-start gap-3">
          <FolderOpen className="h-5 w-5 shrink-0 mt-0.5" style={{ color }} />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate pr-16">{category.name}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{category.slug}</p>
          </div>
        </div>

        {category.description && (
          <p className="text-xs text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
            {category.description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {category.contentCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium gap-1">
              <FileText className="h-3 w-3" />
              {category.contentCount} article{category.contentCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {category.childrenCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium gap-1">
              <FolderOpen className="h-3 w-3" />
              {category.childrenCount} sub
            </Badge>
          )}
          {parent && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium gap-1">
              <ChevronRight className="h-3 w-3" />
              {parent.name}
            </Badge>
          )}
        </div>

        {/* SEO status indicator */}
        <div className="flex items-center gap-1.5 mt-2.5">
          {hasSeo ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 font-medium">SEO Ready</span>
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] text-amber-500 font-medium">No description</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------- List View Sortable Row --------------------

interface SortableRowProps {
  id: string;
  categoryMap: CategoryMap;
  childrenMap: ChildrenMap;
  expandedIds: Set<string>;
  isChecked: boolean;
  onCheck: (id: string, checked: boolean) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (category: CategoryNode) => void;
  onCreateSub: (parentId: string) => void;
  depth: number;
}

function SortableCategoryRow({
  id,
  categoryMap,
  childrenMap,
  expandedIds,
  isChecked,
  onCheck,
  onToggle,
  onEdit,
  onDelete,
  onCreateSub,
  depth,
}: SortableRowProps) {
  const node = categoryMap[id];
  const children = childrenMap[id] ?? [];
  const hasChildren = node.childrenCount > 0 || children.length > 0;
  const isExpanded = expandedIds.has(id);
  const color = getColorForCategory(id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  if (!node) return null;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-3 border-b px-3 py-2.5 transition-colors hover:bg-accent/30',
          isDragging && 'shadow-md bg-accent/50',
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {/* Drag handle */}
        <button
          className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${node.name}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Checkbox */}
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => onCheck(id, !!checked)}
          aria-label={`Select ${node.name}`}
        />

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            className="shrink-0 p-0.5 rounded-sm hover:bg-accent transition-colors"
            onClick={() => onToggle(id)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={isExpanded}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Color dot + icon */}
        <FolderOpen className="h-4 w-4 shrink-0" style={{ color }} />

        {/* Name */}
        <span className="flex-1 min-w-0 text-sm font-medium truncate">{node.name}</span>

        {/* Article count */}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {node.contentCount} article{node.contentCount !== 1 ? 's' : ''}
        </span>

        {/* SEO indicator */}
        {(node.description && node.description.trim().length > 0) ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        )}

        {/* Actions (hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => onEdit(id)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => onDelete(node)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => onCreateSub(id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add sub-category</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Children (recursive) */}
      {hasChildren && isExpanded && children.length > 0 && (
        <SortableContext items={children} strategy={verticalListSortingStrategy}>
          {children.map((childId) => (
            <SortableCategoryRow
              key={childId}
              id={childId}
              categoryMap={categoryMap}
              childrenMap={childrenMap}
              expandedIds={expandedIds}
              isChecked={isChecked}
              onCheck={onCheck}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onCreateSub={onCreateSub}
              depth={depth + 1}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

// -------------------- Main Categories Page --------------------

export function CategoriesPage() {
  const queryClient = useQueryClient();

  // State
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const emptyForm: CategoryFormData = { name: '', slug: '', description: '', parentId: null };
  const [createForm, setCreateForm] = useState<CategoryFormData>(emptyForm);
  const [editForm, setEditForm] = useState<CategoryFormData>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  // Sensors for dnd
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // -------------------- Queries --------------------

  // Fetch all categories (flat list) — used for parent select and tree building
  const { data: allCategories = [], isLoading: isLoadingAll } = useQuery({
    queryKey: queryKeys.categories.list({ flat: true }),
    queryFn: () => getApi<CategoryNode[]>('/api/categories', { flat: 'true', pageSize: 1000 }),
    staleTime: 30_000,
  });

  // Fetch root categories for tree
  const { data: rootCategories = [], isLoading: isLoadingRoots } = useQuery({
    queryKey: queryKeys.categories.list({ parentId: 'root' }),
    queryFn: () => getApi<CategoryNode[]>('/api/categories', { parentId: '' }),
    staleTime: 30_000,
  });

  // Fetch children for expanded nodes
  const expandedList = useMemo(() => Array.from(expandedIds), [expandedIds]);

  const childQueries = useQueries({
    queries: expandedList.map((parentId) => ({
      queryKey: queryKeys.categories.list({ parentId }),
      queryFn: () => getApi<CategoryNode[]>(`/api/categories`, { parentId }),
      staleTime: 30_000,
      enabled: !!parentId,
    })),
  });

  // -------------------- Derived State --------------------

  // Build flat map of all known categories
  const categoryMap = useMemo<CategoryMap>(() => {
    const map: CategoryMap = {};
    for (const cat of allCategories) {
      map[cat.id] = cat;
    }
    // Also add children from expanded queries
    for (const cq of childQueries) {
      if (cq.data) {
        for (const cat of cq.data) {
          map[cat.id] = cat;
        }
      }
    }
    return map;
  }, [allCategories, childQueries]);

  // Build children map: parentId -> [childId, ...]
  const childrenMap = useMemo<ChildrenMap>(() => {
    const map: ChildrenMap = {};

    // Roots
    const sortedRoots = [...rootCategories].sort((a, b) => a.sortOrder - b.sortOrder);
    map['root'] = sortedRoots.map((c) => c.id);

    // Expanded children
    for (let i = 0; i < expandedList.length; i++) {
      const parentId = expandedList[i];
      const data = childQueries[i]?.data;
      if (data) {
        const sorted = [...data].sort((a, b) => a.sortOrder - b.sortOrder);
        map[parentId] = sorted.map((c) => c.id);
      }
    }
    return map;
  }, [rootCategories, expandedList, childQueries]);

  // Root IDs for sortable context
  const rootIds = childrenMap['root'] ?? [];

  // Collect all visible IDs (flattened) for grid view
  const allVisibleIds = useMemo(() => {
    const ids: string[] = [];
    const collect = (parentId: string, depth: number) => {
      const childIds = childrenMap[parentId];
      if (!childIds) return;
      for (const cid of childIds) {
        ids.push(cid);
        if (expandedIds.has(cid)) {
          collect(cid, depth + 1);
        }
      }
    };
    collect('root', 0);
    return ids;
  }, [childrenMap, expandedIds]);

  // Filter by search
  const searchMatchIds = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const lower = search.toLowerCase();
    const matchIds = new Set<string>();
    // Recursively find matching categories and their ancestors
    const checkNode = (id: string, ancestors: string[]): boolean => {
      const node = categoryMap[id];
      if (!node) return false;
      const matches = node.name.toLowerCase().includes(lower);
      const children = childrenMap[id] ?? [];
      let childMatches = false;
      for (const childId of children) {
        if (checkNode(childId, [...ancestors, id])) {
          childMatches = true;
        }
      }
      if (matches || childMatches) {
        for (const aid of [...ancestors, id]) {
          matchIds.add(aid);
        }
        return true;
      }
      return false;
    };
    for (const rid of rootIds) {
      checkNode(rid, []);
    }
    return matchIds;
  }, [rootIds, search, categoryMap, childrenMap]);

  const filteredVisibleIds = useMemo(() => {
    if (searchMatchIds.size === 0) return allVisibleIds;
    return allVisibleIds.filter((id) => searchMatchIds.has(id));
  }, [allVisibleIds, searchMatchIds]);

  const filteredRootIds = useMemo(() => {
    if (searchMatchIds.size === 0) return rootIds;
    return rootIds.filter((id) => searchMatchIds.has(id));
  }, [rootIds, searchMatchIds]);

  // -------------------- Handlers --------------------

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleEdit = useCallback((id: string) => {
 const cat = categoryMap[id];
    if (cat) {
      setEditId(id);
      setEditForm({
        name: cat.name,
        slug: cat.slug,
        description: cat.description ?? '',
        parentId: cat.parentId,
      });
      setIsEditing(true);
    }
  }, [categoryMap]);

  const handleCreateSub = useCallback((parentId: string) => {
    setCreateParentId(parentId);
    setCreateForm({ name: '', slug: '', description: '', parentId });
    setIsCreateOpen(true);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setCreateParentId(null);
    setCreateForm(emptyForm);
    setIsCreateOpen(true);
  }, []);

  const handleCheck = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredVisibleIds.length && filteredVisibleIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVisibleIds));
    }
  }, [selectedIds.size, filteredVisibleIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Only handle root-level reorder for now
      const oldIndex = rootIds.indexOf(active.id as string);
      const newIndex = rootIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(rootIds, oldIndex, newIndex);
      // Update local order immediately (optimistic)
      // In production, this would call PATCH to persist
      void newOrder;
    },
    [rootIds],
  );

  // -------------------- Mutations --------------------

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      postApi<CategoryNode>('/api/categories', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      setIsCreateOpen(false);
      setCreateForm(emptyForm);
      // If created with a parent, expand that parent
      if (variables.parentId) {
        setExpandedIds((prev) => new Set([...prev, variables.parentId!]));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryFormData }) =>
      patchApi<CategoryNode>(`/api/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      setIsEditing(false);
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        // The deleted id is already removed from cache, just clear selection
        return next;
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteApi(`/api/categories/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      setSelectedIds(new Set());
    },
  });

  const isLoading = isLoadingAll || isLoadingRoots;
  const hasSelection = selectedIds.size > 0;
  const isAllSelected = filteredVisibleIds.length > 0 && selectedIds.size === filteredVisibleIds.length;

  // -------------------- Render --------------------

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Categories</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize your content with a structured category hierarchy
            </p>
          </div>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Category
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Select all + Search */}
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* Right: Count + View toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {allCategories.length} categor{allCategories.length === 1 ? 'y' : 'ies'}
            </span>
            <div className="flex items-center border rounded-lg p-0.5">
              <button
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'grid'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Selection Bar (floating) */}
        {hasSelection && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border shadow-lg rounded-xl px-4 py-2.5 animate-in slide-in-from-bottom-4 duration-200">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const ids = Array.from(selectedIds);
                bulkDeleteMutation.mutate(ids);
              }}
              disabled={bulkDeleteMutation.isPending}
              className="text-xs"
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete Selected
            </Button>
            <button
              className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleClearSelection}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredVisibleIds.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-muted/50 p-6 mb-4">
              <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              No categories yet
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
              {search
                ? 'No categories match your search. Try a different query.'
                : 'Get started by creating your first category to organize your content.'}
            </p>
            {!search && (
              <Button className="mt-4" size="sm" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Category
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVisibleIds.map((id) => {
              const cat = categoryMap[id];
              if (!cat) return null;
              return (
                <CategoryCard
                  key={id}
                  category={cat}
                  categoryMap={categoryMap}
                  color={getColorForCategory(id)}
                  isSelected={false}
                  isChecked={selectedIds.has(id)}
                  onCheck={handleCheck}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                  onCreateSub={handleCreateSub}
                />
              );
            })}
          </div>
        ) : (
          /* List View with DnD */
          <div className="border rounded-xl bg-card overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={filteredRootIds} strategy={verticalListSortingStrategy}>
                {filteredRootIds.map((id) => (
                  <SortableCategoryRow
                    key={id}
                    id={id}
                    categoryMap={categoryMap}
                    childrenMap={childrenMap}
                    expandedIds={expandedIds}
                    isChecked={selectedIds.has(id)}
                    onCheck={handleCheck}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={setDeleteTarget}
                    onCreateSub={handleCreateSub}
                    depth={0}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Create Category Sheet */}
        <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                {createParentId ? 'Create Sub-Category' : 'Create Category'}
              </SheetTitle>
              <SheetDescription>
                {createParentId
                  ? `Adding a new category under "${categoryMap[createParentId]?.name ?? ''}"`
                  : 'Add a new root-level category to your content structure'}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4">
              <CategoryForm
                data={createForm}
                onChange={setCreateForm}
                allCategories={allCategories}
                autoFocus
              />
            </div>
            <SheetFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(createForm)}
                disabled={createMutation.isPending || !createForm.name.trim()}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Category
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Edit Category Sheet */}
        <Sheet open={isEditing} onOpenChange={(open) => { if (!open) { setIsEditing(false); setEditId(null); } }}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Edit Category</SheetTitle>
              <SheetDescription>
                Update the category details below
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4">
              <CategoryForm
                data={editForm}
                onChange={setEditForm}
                allCategories={allCategories}
                excludeId={editId ?? undefined}
                autoFocus
              />
            </div>
            <SheetFooter>
              <Button
                variant="outline"
                onClick={() => { setIsEditing(false); setEditId(null); }}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editId) {
                    updateMutation.mutate({ id: editId, data: editForm });
                  }
                }}
                disabled={updateMutation.isPending || !editForm.name.trim()}
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Changes
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete Category"
          description={
            deleteTarget
              ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
              : undefined
          }
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          }}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </TooltipProvider>
  );
}