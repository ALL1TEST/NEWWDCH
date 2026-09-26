'use client';

import React, { useState, useMemo } from 'react';
import { Tag, Search, Plus, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { postApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface TagOption {
  id: string;
  name: string;
}

export interface KeywordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags: TagOption[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onTagCreated?: (newTag: TagOption) => void;
}

export function KeywordsDialog({
  open,
  onOpenChange,
  allTags,
  selectedTagIds,
  onToggleTag,
  onTagCreated,
}: KeywordsDialogProps) {
  const [search, setSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredTags = useMemo(() => {
    if (!search.trim()) return allTags;
    const s = search.toLowerCase();
    return allTags.filter((t) => t.name.toLowerCase().includes(s));
  }, [allTags, search]);

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    // Check if tag already exists
    const existing = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) {
        onToggleTag(existing.id);
      }
      setNewTagName('');
      return;
    }

    setIsCreating(true);
    try {
      const created = await postApi<TagOption>('/api/tags', { name: trimmed });
      if (created?.id) {
        onTagCreated?.(created);
        onToggleTag(created.id);
        toast.success(`Tag "${created.name}" created and selected!`);
      }
      setNewTagName('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-amber-500" />
            Keywords & Tags
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select keywords to attach to this article or create new ones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter keywords..."
              className="pl-8 h-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Tags Chips Cloud */}
          <div className="rounded-lg border bg-muted/20 p-2.5 max-h-56 overflow-y-auto min-h-[120px]">
            {filteredTags.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {search ? 'No keywords match your search.' : 'No keywords created yet.'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filteredTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onToggleTag(tag.id)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all text-left',
                        isSelected
                          ? 'bg-amber-100 text-amber-900 border border-amber-400 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-600 shadow-2xs'
                          : 'bg-background text-muted-foreground border border-border hover:border-amber-400 hover:text-foreground hover:bg-amber-50/40 dark:hover:bg-amber-950/20',
                      )}
                    >
                      {isSelected ? (
                        <Check className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      ) : (
                        <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span>{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick create tag */}
          <div className="flex items-center gap-1.5 pt-1">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateTag();
                }
              }}
              placeholder="Add new keyword..."
              className="h-8 text-xs flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isCreating}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {selectedTagIds.length} selected
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs bg-amber-400 text-zinc-900 hover:bg-amber-500 font-semibold"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
