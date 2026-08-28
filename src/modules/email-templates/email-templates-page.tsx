'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { TemplateList } from './template-list';
import { TemplateEditor } from './template-editor';
import { TemplatePreview } from './template-preview';

// ============================================================
// Email Templates router layer.
//
// ONE email-templates system, TWO scopes:
//   • scope='client'  (default) — the legacy Client Dashboard email
//     templates module. Navigates under the 'email-templates' module
//     name so the URL hash is #email-templates/<id>.
//   • scope='platform' — the Platform Admin email templates module.
//     Navigates under 'platform-email-templates' so the URL hash is
//     #platform-email-templates/<id>, and threads `scope='platform'`
//     down to every child (list / editor / preview) so they render
//     PlatformPageHeader, send scope=platform on every query/mutation,
//     use platform-scoped TanStack cache keys, and pass the platform
//     module name to navigate().
//
// The routing itself (currentItemId / currentSubPage from the
// navigation store) is scope-agnostic — it just reads state. The
// only scope-dependent piece is the module name passed to navigate(),
// which lives in the child components (TemplateList / TemplateEditor /
// TemplatePreview) so they can render the correct hash.
//
// This file is the SINGLE router for both scopes — there is no
// duplicate platform-side router. The Platform Admin module file
// (src/modules/platform/platform-email-templates.tsx) is a thin
// wrapper that renders <EmailTemplatesPage scope="platform" />.
// ============================================================

export function EmailTemplatesPage({ scope = 'client' }: { scope?: 'client' | 'platform' } = {}) {
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  // The module name must match the navigation-store module that
  // rendered this router. For client scope the platform sidebar /
  // module-registry registers 'email-templates'; for platform scope
  // it registers 'platform-email-templates'. The back/preview
  // navigations below use this name so the hash stays consistent
  // with the module the user is currently in.
  const moduleName = scope === 'platform' ? 'platform-email-templates' : 'email-templates';

  // Preview mode
  if (currentItemId && currentSubPage === 'preview') {
    return (
      <TemplatePreview
        templateId={currentItemId}
        scope={scope}
        onBack={() => navigate(moduleName, currentItemId)}
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
        scope={scope}
        onBack={() => navigate(moduleName)}
        onPreview={(id) => navigate(moduleName, id, 'preview')}
        onCreated={(id) => navigate(moduleName, id)}
      />
    );
  }

  // List mode (default)
  return (
    <TemplateList
      scope={scope}
      onEdit={(id) => navigate(moduleName, id)}
      onPreview={(id) => navigate(moduleName, id, 'preview')}
    />
  );
}
