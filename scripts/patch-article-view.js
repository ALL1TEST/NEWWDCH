const fs = require('fs');
const path = require('path');

// 1. Create src/app/api/articles/[slug]/route.ts in Verdant
const slugDir = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/app/api/articles/[slug]';
if (!fs.existsSync(slugDir)) {
  fs.mkdirSync(slugDir, { recursive: true });
}

const slugRouteContent = `import { NextRequest, NextResponse } from "next/server";
import { getArticleBySlugFromDb, getRelatedArticlesFromDb } from "@/lib/services/articles";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const article = await getArticleBySlugFromDb(slug);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    const related = await getRelatedArticlesFromDb(slug, 3);
    return NextResponse.json({ article, related });
  } catch (error) {
    console.error("Error in GET /api/articles/[slug]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
`;

fs.writeFileSync(path.join(slugDir, 'route.ts'), slugRouteContent, 'utf8');
console.log('Created src/app/api/articles/[slug]/route.ts');

// 2. Patch ArticleView.tsx to use useArticles()
const articleViewPath = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/components/blog/ArticleView.tsx';
let articleViewContent = fs.readFileSync(articleViewPath, 'utf8');

if (!articleViewContent.includes('useArticles')) {
  articleViewContent = articleViewContent.replace(
    'import { useNavigation } from "@/lib/store";',
    'import { useNavigation } from "@/lib/store";\nimport { useArticles } from "@/hooks/use-articles";'
  );

  const oldDef = `export function ArticleView({ slug }: { slug: string }) {
  const [article, setArticle] = useState(getArticleBySlug(slug));
  const [related, setRelated] = useState(getRelatedArticles(slug, 3));
  const { navigateTo } = useNavigation();

  useEffect(() => {
    let isMounted = true;
    fetch(\`/api/articles/\${encodeURIComponent(slug)}\`)`;

  const newDef = `export function ArticleView({ slug }: { slug: string }) {
  const { articles } = useArticles();
  const contextArticle = articles.find((a) => a.slug === slug);
  const [article, setArticle] = useState(contextArticle || getArticleBySlug(slug));
  const [related, setRelated] = useState(() => {
    if (contextArticle) {
      const rel = articles.filter((a) => a.slug !== slug && a.categorySlug === contextArticle.categorySlug).slice(0, 3);
      if (rel.length > 0) return rel;
    }
    return getRelatedArticles(slug, 3);
  });
  const { navigateTo } = useNavigation();

  useEffect(() => {
    if (contextArticle) {
      setArticle(contextArticle);
      const rel = articles.filter((a) => a.slug !== slug && a.categorySlug === contextArticle.categorySlug).slice(0, 3);
      if (rel.length > 0) setRelated(rel);
    }
    let isMounted = true;
    fetch(\`/api/articles/\${encodeURIComponent(slug)}\`)`;

  articleViewContent = articleViewContent.replace(oldDef, newDef);
  fs.writeFileSync(articleViewPath, articleViewContent, 'utf8');
  console.log('Patched ArticleView.tsx with useArticles hook');
} else {
  console.log('ArticleView.tsx already includes useArticles');
}
