const fs = require('fs');

// 1. Patch ArticleView.tsx
const articleViewPath = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/components/blog/ArticleView.tsx';
let articleViewContent = fs.readFileSync(articleViewPath, 'utf8');

const cleanFn = `
function cleanArticleHtml(html: string, title?: string, coverImage?: string): string {
  if (!html) return "";
  let cleaned = html
    .replace(/\\s+draggable\\s*=\\s*["'](?:true|false)["']/gi, "")
    .replace(/\\s+contenteditable\\s*=\\s*["'](?:true|false)["']/gi, "")
    .replace(/\\s+data-(?:pm|tiptap|node|editor)-[a-zA-Z0-9_-]+\\s*=\\s*["'][^"']*["']/gi, "")
    .replace(/\\s+data-id\\s*=\\s*["'][^"']*["']/gi, "")
    .replace(/\\s+class\\s*=\\s*["'](?:\\s*ProseMirror[^"']*)*["']/gi, "")
    .replace(/<p\\s*>\\s*(?:<br\\s*\\/?>)?\\s*<\\/p>/gi, "");

  // Strip duplicate leading H1 if it matches article title
  if (title) {
    const normTitle = title.trim().toLowerCase();
    cleaned = cleaned.replace(/^\\s*<h1\\b[^>]*>([\\s\\S]*?)<\\/h1>/i, (match, inner) => {
      const text = inner.replace(/<[^>]+>/g, "").trim().toLowerCase();
      if (text === normTitle || normTitle.includes(text) || text.includes(normTitle)) {
        return "";
      }
      return match;
    });
  }

  // Strip duplicate leading cover image
  if (coverImage) {
    cleaned = cleaned.replace(/^\\s*<p\\b[^>]*>\\s*<img\\b[^>]+src=["']([^"']+)["'][^>]*>\\s*<\\/p>/i, (match, src) => {
      if (src === coverImage || coverImage.endsWith(src) || src.endsWith(coverImage) || src.includes("hero")) {
        return "";
      }
      return match;
    });
    cleaned = cleaned.replace(/^\\s*<img\\b[^>]+src=["']([^"']+)["'][^>]*>/i, (match, src) => {
      if (src === coverImage || coverImage.endsWith(src) || src.endsWith(coverImage) || src.includes("hero")) {
        return "";
      }
      return match;
    });
  }

  return cleaned.trim();
}
`;

if (!articleViewContent.includes('function cleanArticleHtml')) {
  // Insert cleanArticleHtml before export function ArticleView
  const marker = 'export function ArticleView';
  articleViewContent = articleViewContent.replace(marker, cleanFn + '\n' + marker);
}

// Replace the ReactMarkdown rendering block
const oldBodyBlock = `{/* Article Body */}
            <div className="prose-article mt-8" itemProp="articleBody">
              <ReactMarkdown>{article.content}</ReactMarkdown>
            </div>`;

const newBodyBlock = `{/* Article Body */}
            {/<[a-z][\\s\\S]*>/i.test(article.content || "") ? (
              <div
                className="prose-article mt-8"
                itemProp="articleBody"
                dangerouslySetInnerHTML={{
                  __html: cleanArticleHtml(article.content, article.title, article.coverImage),
                }}
              />
            ) : (
              <div className="prose-article mt-8" itemProp="articleBody">
                <ReactMarkdown>{article.content}</ReactMarkdown>
              </div>
            )}`;

const normContent = articleViewContent.replace(/\r\n/g, '\n');
const normOld = oldBodyBlock.replace(/\r\n/g, '\n');
const normNew = newBodyBlock.replace(/\r\n/g, '\n');

if (normContent.includes(normOld)) {
  articleViewContent = normContent.replace(normOld, normNew);
  fs.writeFileSync(articleViewPath, articleViewContent, 'utf8');
  console.log('Successfully patched ArticleView.tsx with HTML rendering!');
} else {
  console.error('Target body block not found in ArticleView.tsx');
}

// 2. Patch globals.css
const cssPath = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/app/globals.css';
let cssContent = fs.readFileSync(cssPath, 'utf8');

const oldCss = `.prose-article img {
  border-radius: 0.625rem;
  margin: 2em 0;
}`;

const newCss = `.prose-article img {
  border-radius: 0.625rem;
  margin: 2em auto;
  max-width: 100%;
  height: auto;
  display: block;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}`;

if (cssContent.includes(oldCss)) {
  cssContent = cssContent.replace(oldCss, newCss);
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  console.log('Successfully updated globals.css with responsive image styles!');
} else {
  console.log('globals.css already updated or target not matched');
}
