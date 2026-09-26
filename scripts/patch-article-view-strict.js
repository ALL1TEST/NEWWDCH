const fs = require('fs');
const filePath = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/components/blog/ArticleView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Ensure import is there
if (!content.includes('import { useArticles } from "@/hooks/use-articles";')) {
  content = content.replace(
    'import { useNavigation } from "@/lib/store";',
    'import { useNavigation } from "@/lib/store";\nimport { useArticles } from "@/hooks/use-articles";'
  );
}

// Replace the function body start
const targetOld = `export function ArticleView({ slug }: { slug: string }) {
  const [article, setArticle] = useState(getArticleBySlug(slug));
  const [related, setRelated] = useState(getRelatedArticles(slug, 3));
  const { navigateTo } = useNavigation();

  useEffect(() => {
    let isMounted = true;
    fetch(\`/api/articles/\${encodeURIComponent(slug)}\`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.article) setArticle(data.article);
        if (Array.isArray(data.related) && data.related.length > 0) {
          setRelated(data.related);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [slug]);`;

const targetNew = `export function ArticleView({ slug }: { slug: string }) {
  const { articles } = useArticles();
  const contextArticle = articles.find((a) => a.slug === slug);
  const [article, setArticle] = useState(contextArticle || getArticleBySlug(slug));
  const [related, setRelated] = useState(() => {
    if (contextArticle) {
      const rel = articles
        .filter((a) => a.slug !== slug && a.categorySlug === contextArticle.categorySlug)
        .slice(0, 3);
      if (rel.length > 0) return rel;
    }
    return getRelatedArticles(slug, 3);
  });
  const { navigateTo } = useNavigation();

  useEffect(() => {
    if (contextArticle) {
      setArticle(contextArticle);
      const rel = articles
        .filter((a) => a.slug !== slug && a.categorySlug === contextArticle.categorySlug)
        .slice(0, 3);
      if (rel.length > 0) setRelated(rel);
    }
    let isMounted = true;
    fetch(\`/api/articles/\${encodeURIComponent(slug)}\`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.article) setArticle(data.article);
        if (Array.isArray(data.related) && data.related.length > 0) {
          setRelated(data.related);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [slug, contextArticle, articles]);`;

// Normalize \r\n to \n for replacement
const normContent = content.replace(/\r\n/g, '\n');
const normTargetOld = targetOld.replace(/\r\n/g, '\n');
const normTargetNew = targetNew.replace(/\r\n/g, '\n');

if (normContent.includes(normTargetOld)) {
  const replaced = normContent.replace(normTargetOld, normTargetNew);
  fs.writeFileSync(filePath, replaced, 'utf8');
  console.log('Successfully replaced ArticleView logic with contextArticle support');
} else {
  console.error('Target not found in normalized content');
}
