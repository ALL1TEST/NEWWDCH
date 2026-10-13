'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface SeoStudioProps {
  title?: string;
  content?: string;
  excerpt?: string;
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  robotsDirectives?: string;
  structuredData?: string;
  featuredImageUrl?: string;
  authorName?: string;
  contentId?: string;
  isPage?: boolean;
  onUpdateSeo: (data: {
    seoTitle?: string;
    seoDescription?: string;
    focusKeyword?: string;
    canonicalUrl?: string;
    robotsDirectives?: string;
    structuredData?: string;
  }) => void;
}

export function SeoStudioCard({
  seoTitle = '',
  seoDescription = '',
  onUpdateSeo,
}: SeoStudioProps) {
  return (
    <div className="space-y-3">
      {/* Meta Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <Label htmlFor="seo-meta-title" className="font-medium text-foreground text-xs">
            Meta Title
          </Label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {(seoTitle || '').length}/60
          </span>
        </div>
        <Input
          id="seo-meta-title"
          value={seoTitle}
          onChange={(e) => onUpdateSeo({ seoTitle: e.target.value })}
          placeholder="Enter meta title..."
          className="h-8 text-sm"
        />
      </div>

      {/* Meta Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <Label htmlFor="seo-meta-desc" className="font-medium text-foreground text-xs">
            Meta Description
          </Label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {(seoDescription || '').length}/160
          </span>
        </div>
        <Textarea
          id="seo-meta-desc"
          value={seoDescription}
          onChange={(e) => onUpdateSeo({ seoDescription: e.target.value })}
          placeholder="Enter meta description..."
          rows={3}
          className="text-sm resize-none"
        />
      </div>
    </div>
  );
}
