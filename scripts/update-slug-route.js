const fs = require('fs');
const p = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/app/api/articles/[slug]/route.ts';
const content = `import { NextRequest, NextResponse } from "next/server";
import { getArticleBySlugFromDb, getRelatedArticlesFromDb, deleteArticleBySlug } from "@/lib/services/articles";
import { verifyCmsAuth, cmsUnauthorizedResponse, cmsSuccessResponse, NO_CACHE_HEADERS } from "@/lib/cms/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const article = await getArticleBySlugFromDb(slug);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const related = await getRelatedArticlesFromDb(slug, 3);
    return NextResponse.json({ article, related }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("API /api/articles/[slug] error:", error);
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = verifyCmsAuth(req);
  if (!auth.authenticated) {
    return cmsUnauthorizedResponse(auth.error || "Unauthorized", auth.status || 401);
  }

  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    await deleteArticleBySlug(slug);
    return cmsSuccessResponse({ ok: true, message: \`Article \${slug} deleted successfully\` });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete article" }, { status: 500 });
  }
}
`;
fs.writeFileSync(p, content, 'utf8');
console.log('Updated route.ts with GET and DELETE handlers');
