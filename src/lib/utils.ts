import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, isToday, isYesterday, isThisYear } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// -------------------- File Size -------------------

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatFileSize(bytes: number): string {
  if (bytes == null || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);

  // Show integers when >= 10, otherwise 1 decimal
  const formatted = value >= 10 ? Math.round(value) : Number(value.toFixed(1));
  return `${formatted} ${UNITS[exponent]}`;
}

// -------------------- Date/Time Formatting --------------------

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy h:mm a');
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy');
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  if (isToday(d)) {
    return `Today at ${format(d, 'h:mm a')}`;
  }
  if (isYesterday(d)) {
    return `Yesterday at ${format(d, 'h:mm a')}`;
  }
  if (isThisYear(d)) {
    return format(d, 'MMM d, h:mm a');
  }
  return format(d, 'MMM d, yyyy');
}

export function formatISODate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}

// -------------------- Slugify -------------------

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^\w\s-]/g, '') // remove non-word chars
    .replace(/[_\s]+/g, '-') // replace spaces/underscores with hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim hyphens
}

// -------------------- Request ID -------------------

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

// -------------------- Truncate -------------------

export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

// -------------------- Get Initials -------------------

export function getInitials(name: string): string {
  if (!name) return '';

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// -------------------- Misc Helpers --------------------

/** Safely parse JSON, returning fallback on failure */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Capitalize the first letter */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Convert snake_case or SCREAMING_SNAKE_CASE to readable Title Case */
export function labelize(str: string): string {
  return str
    .split('_')
    .map((word) => capitalize(word.toLowerCase()))
    .join(' ');
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// -------------------- Content Normalization -------------------

/**
 * Detects if a content string is ProseMirror JSON (not HTML) and converts it to HTML.
 * This handles the case where seed data stored content as JSON.stringify(prosemirrorDoc)
 * instead of editor.getHTML().
 *
 * ProseMirror JSON looks like: [{"type":"paragraph","content":[...]}]
 * HTML looks like: <p>...</p>
 */
export function normalizeContentToHtml(content: string | null | undefined): string {
  if (!content) return '';
  const trimmed = content.trim();
  if (!trimmed) return '';

  // If it starts with '<' it's already HTML
  if (trimmed.startsWith('<')) return trimmed;

  // Try to parse as ProseMirror JSON array
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0]?.type) {
      return prosemirrorNodesToHtml(parsed);
    }
  } catch {
    // Not JSON — return as-is (might be plain text)
  }

  return trimmed;
}

/** Convert a ProseMirror JSON node array to HTML */
function prosemirrorNodesToHtml(nodes: unknown[]): string {
  return nodes.map((node) => renderNode(node)).join('\n');
}

function renderNode(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  const type = String(n.type || '');
  const content = n.content;
  const text = typeof n.text === 'string' ? escapeHtml(n.text) : '';
  const level = typeof n.level === 'number' ? n.level : 0;
  const language = typeof n.language === 'string' ? n.language : '';

  // Inline content
  const inlineHtml = Array.isArray(content)
    ? content.map((c: unknown) => {
        if (!c || typeof c !== 'object') return '';
        const child = c as Record<string, unknown>;
        if (child.text) {
          const t = escapeHtml(String(child.text));
          const marks = child.marks;
          if (Array.isArray(marks) && marks.length > 0) {
            return applyMarks(t, marks as Record<string, unknown>[]);
          }
          return t;
        }
        return renderNode(c);
      }).join('')
    : '';

  switch (type) {
    case 'paragraph':
      return `<p>${inlineHtml || text}</p>`;
    case 'heading':
      return `<h${Math.min(Math.max(level, 1), 6)}>${inlineHtml || text}</h${Math.min(Math.max(level, 1), 6)}>`;
    case 'bulletList':
    case 'bullet_list':
      return `<ul>${Array.isArray(content) ? (content as unknown[]).map((c: unknown) => renderNode(c)).join('') : ''}</ul>`;
    case 'orderedList':
    case 'ordered_list':
      return `<ol>${Array.isArray(content) ? (content as unknown[]).map((c: unknown) => renderNode(c)).join('') : ''}</ol>`;
    case 'listItem':
    case 'list_item':
      return `<li>${inlineHtml}</li>`;
    case 'codeBlock':
    case 'code_block': {
      const codeText = getTextNode(content) || text;
      return `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(codeText)}</code></pre>`;
    }
    case 'blockquote':
      return `<blockquote>${inlineHtml}</blockquote>`;
    case 'horizontalRule':
    case 'horizontal_rule':
      return '<hr />';
    case 'image':
      return `<img src="${escapeHtml(String(n.src || ''))}" alt="${escapeHtml(String(n.alt || ''))}" />`;
    case 'hardBreak':
    case 'hard_break':
      return '<br />';
    default:
      return inlineHtml || text;
  }
}

function getTextNode(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c: unknown) => {
      if (!c || typeof c !== 'object') return '';
      const child = c as Record<string, unknown>;
      if (typeof child.text === 'string') return child.text;
      if (Array.isArray(child.content)) return getTextNode(child.content);
      return '';
    }).join('');
  }
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>;
    if (typeof c.text === 'string') return c.text;
    if (Array.isArray(c.content)) return getTextNode(c.content);
  }
  return '';
}

function applyMarks(text: string, marks: Record<string, unknown>[]): string {
  return marks.reduce((acc, mark) => {
    const t = String(mark.type || '');
    if (t === 'bold') return `<strong>${acc}</strong>`;
    if (t === 'italic') return `<em>${acc}</em>`;
    if (t === 'underline') return `<u>${acc}</u>`;
    if (t === 'strike') return `<s>${acc}</s>`;
    if (t === 'code') return `<code>${acc}</code>`;
    if (t === 'link') return `<a href="${escapeHtml(String((mark.attrs as Record<string, unknown>)?.href || ''))}">${acc}</a>`;
    return acc;
  }, text);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
