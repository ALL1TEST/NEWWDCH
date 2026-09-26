/**
 * Shared Content Normalization & Pipeline Engine
 * Used uniformly for both Pages and Articles/Posts across the CMS.
 */

import { markdownToEditorHtml } from './markdown-to-html';

/**
 * Normalizes raw database or external API content into clean, editor-ready HTML.
 * Handles:
 * - ProseMirror JSON strings
 * - Markdown strings
 * - HTML entity decoding (if HTML was stored entity-escaped)
 * - Stripping of editor-only attributes (draggable="true", contenteditable, data-pm-*, etc.)
 * - Deduplication of consecutive identical blocks caused by previous bugs
 */
export function normalizeContentForEditor(rawContent: string | null | undefined): string {
  if (!rawContent || typeof rawContent !== 'string') return '';
  let content = rawContent.trim();
  if (!content) return '';

  // 1. Decode HTML entities if the entire content was double-escaped (e.g. &lt;p&gt;)
  if (/^\s*&lt;(?:p|h[1-6]|div|article|section|ul|ol|table)\b/i.test(content)) {
    content = content
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  // 2. Detect ProseMirror JSON
  if (content.startsWith('[') || content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0]?.type) {
        content = prosemirrorNodesToHtml(parsed);
      }
    } catch {
      // Not JSON, continue
    }
  }

  // 3. Detect Markdown if contains Markdown headings and doesn't start with block HTML
  const hasMarkdownHeadings = /(?:^|\n)#{1,6}\s+/m.test(content);
  const startsWithHtmlTag = /^\s*<(?:p|h[1-6]|div|article|section|ul|ol|table|blockquote)\b/i.test(content);
  if (hasMarkdownHeadings && !startsWithHtmlTag) {
    content = markdownToEditorHtml(content);
  }

  // 4. Strip editor-only attributes
  content = sanitizeContentForStorage(content);

  // 5. Clean consecutive duplicate paragraphs if present from previous buggy saves
  content = deduplicateConsecutiveBlocks(content);

  return content.trim();
}

/**
 * Sanitizes HTML content before saving to the database or publishing to external sites.
 * Strips editor-specific noise (draggable="true", contenteditable, etc.) while preserving all
 * valid HTML tags (h1-h6, p, ul, ol, li, strong, em, a, img, table, blockquote, etc.).
 */
export function sanitizeContentForStorage(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  return rawHtml
    .replace(/\s+draggable\s*=\s*["'](?:true|false)["']/gi, '')
    .replace(/\s+contenteditable\s*=\s*["'](?:true|false)["']/gi, '')
    .replace(/\s+data-(?:pm|tiptap|node|editor)-[a-zA-Z0-9_-]+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+data-id\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+class\s*=\s*["'](?:\s*ProseMirror[^"']*)*["']/gi, '')
    .replace(/<p\s*>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '')
    .trim();
}

/**
 * Removes consecutive identical block elements (e.g. identical paragraphs)
 * to heal records damaged by previous duplicate saves.
 */
export function deduplicateConsecutiveBlocks(html: string): string {
  if (!html) return '';

  // Match block tags: <p ...>...</p> or <h[1-6] ...>...</h[1-6]>
  const blockRegex = /(<(p|h[1-6]|blockquote)\b[^>]*>[\s\S]*?<\/\2>)/gi;
  const blocks: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  let cleaned = html;

  // Simple scan for adjacent duplicate tags
  cleaned = cleaned.replace(/(<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\2>)\s*\1/gi, '$1');

  return cleaned;
}

/**
 * Converts a ProseMirror JSON node array to HTML
 */
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
