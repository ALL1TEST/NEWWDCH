'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { TemplateList } from './template-list';
import { TemplateEditor } from './template-editor';
import { TemplatePreview } from './template-preview';

export function EmailTemplatesPage() {
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  // Preview mode
  if (currentItemId && currentSubPage === 'preview') {
    return (
      <TemplatePreview
        templateId={currentItemId}
        onBack={() => navigate('email-templates', currentItemId)}
      />
    );
  }

  // Editor mode: either existing template ID or 'new' for create
  if (currentItemId) {
    const isNew = currentItemId === 'new';
    return (
      <TemplateEditor
        templateId={currentItemId}
        isNew={isNew}
        onBack={() => navigate('email-templates')}
        onPreview={(id) => navigate('email-templates', id, 'preview')}
        onCreated={(id) => navigate('email-templates', id)}
      />
    );
  }

  // List mode (default)
  return (
    <TemplateList
      onEdit={(id) => navigate('email-templates', id)}
      onPreview={(id) => navigate('email-templates', id, 'preview')}
    />
  );
}
