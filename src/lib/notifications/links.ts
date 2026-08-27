// Notification link resolution helpers

const SUBPAGE_KEYWORDS = new Set([
  'edit', 'create', 'preview', 'versions', 'translations',
]);

export function resolveNotificationLink(link: string | null | undefined): string | null {
  if (!link) return null;
  if (link.startsWith('#')) return link;
  const path = link.replace(/^\//, '').trim();
  if (!path) return null;
  const segments = path.split('/');
  const mod = segments[0];
  if (!mod) return null;
  if (segments[1] && SUBPAGE_KEYWORDS.has(segments[1].toLowerCase())) {
    const subPage = segments[1].toLowerCase();
    const itemId = segments[2];
    return itemId ? `#${mod}/${itemId}/${subPage}` : `#${mod}/${subPage}`;
  }
  return `#${path}`;
}

export function inferNotificationDestination(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes('media') || lower.includes('upload')) return '#media';
  if (lower.includes('backup')) return '#backups';
  if (lower.includes('comment')) return '#comments';
  if (lower.includes('newsletter') || lower.includes('subscriber')) return '#newsletter';
  if (lower.includes('content') || lower.includes('article') || lower.includes('review')) return '#content';
  if (lower.includes('user') || lower.includes('invite')) return '#users';
  if (lower.includes('seo')) return '#seo';
  if (lower.includes('automation')) return '#automation';
  if (lower.includes('ai') && (lower.includes('generat') || lower.includes('job'))) return '#ai';
  return null;
}

export function getNotificationDestination(link: string | null | undefined, title: string): string | null {
  return resolveNotificationLink(link) ?? inferNotificationDestination(title);
}

export function parseHashRoute(hash: string): { mod: string; itemId: string | null; subPage: string | null } {
  const path = hash.replace(/^#\/?/, '').trim() || 'dashboard';
  const segments = path.split('/');
  const mod = segments[0] || 'dashboard';
  const second = segments[1] ?? null;
  if (second && SUBPAGE_KEYWORDS.has(second.toLowerCase())) {
    return { mod, itemId: null, subPage: second.toLowerCase() };
  }
  const itemId = second;
  const subPage = segments[2] ? segments[2].toLowerCase() : null;
  return { mod, itemId, subPage };
}
