// ============================================================
// GET /api/seo/meta-analysis?resourceId=xxx — Detailed SEO meta analysis
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

type CheckStatus = 'pass' | 'warning' | 'fail' | 'info';

interface CheckResult {
  key: string;
  label: string;
  status: CheckStatus;
  value: string;
  message: string;
  points: number;
  maxPoints: number;
}

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const resourceId = sp.get('resourceId');

    if (!resourceId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAM', message: 'resourceId query parameter is required' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const siteFilter = await getSiteWhere(request);

    const contentItem = await db.contentItem.findFirst({
      where: { id: resourceId, deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        excerpt: true,
        focusKeyword: true,
        siteId: true,
        contentType: { select: { name: true } },
        category: { select: { name: true, slug: true } },
      },
    });

    if (!contentItem) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content item not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    // Fetch SEO config
    const seoConfig = await db.seoConfig.findFirst({
      where: { resourceType: 'content', resourceId: contentItem.id, ...siteFilter },
      select: { canonicalUrl: true },
    });

    // Fetch site domain for canonical auto-generation check
    const site = contentItem.siteId
      ? await db.site.findFirst({ where: { id: contentItem.siteId }, select: { domain: true } })
      : await db.site.findFirst({ select: { domain: true } });
    const siteDomain = site?.domain || null;

    const checks: CheckResult[] = [];
    const content = contentItem.content || '';
    const plainText = content.replace(/<[^>]*?>/g, '').trim();

    // 1. metaTitle
    const seoTitle = contentItem.seoTitle || '';
    if (!seoTitle || seoTitle.trim() === '') {
      checks.push({ key: 'metaTitle', label: 'Meta Title', status: 'fail', value: '', message: 'Missing meta title. Add one between 10-60 characters.', points: 0, maxPoints: 10 });
    } else if (seoTitle.length > 60) {
      checks.push({ key: 'metaTitle', label: 'Meta Title', status: 'warning', value: seoTitle, message: `Meta title is ${seoTitle.length} characters. Shorten to under 60.`, points: 5, maxPoints: 10 });
    } else if (seoTitle.length < 10) {
      checks.push({ key: 'metaTitle', label: 'Meta Title', status: 'warning', value: seoTitle, message: `Meta title is only ${seoTitle.length} characters. Aim for 10-60 characters.`, points: 5, maxPoints: 10 });
    } else {
      checks.push({ key: 'metaTitle', label: 'Meta Title', status: 'pass', value: seoTitle, message: `Meta title is ${seoTitle.length} characters.`, points: 10, maxPoints: 10 });
    }

    // 2. metaDescription
    const seoDesc = contentItem.seoDescription || '';
    if (!seoDesc || seoDesc.trim() === '') {
      checks.push({ key: 'metaDescription', label: 'Meta Description', status: 'fail', value: '', message: 'Missing meta description. Add one between 20-160 characters.', points: 0, maxPoints: 10 });
    } else if (seoDesc.length > 160) {
      checks.push({ key: 'metaDescription', label: 'Meta Description', status: 'warning', value: seoDesc.substring(0, 50) + '...', message: `Meta description is ${seoDesc.length} characters. Shorten to under 160.`, points: 5, maxPoints: 10 });
    } else if (seoDesc.length < 20) {
      checks.push({ key: 'metaDescription', label: 'Meta Description', status: 'warning', value: seoDesc, message: `Meta description is only ${seoDesc.length} characters. Aim for 20-160 characters.`, points: 5, maxPoints: 10 });
    } else {
      checks.push({ key: 'metaDescription', label: 'Meta Description', status: 'pass', value: seoDesc, message: `Meta description is ${seoDesc.length} characters.`, points: 10, maxPoints: 10 });
    }

    // 3. h1
    const hasH1 = /<h1[\s>]/i.test(content);
    if (hasH1) {
      const h1Match = content.match(/<h1[^>]*?>([^<]*(?:<[^>]*>[^<]*)*)<\/h1>/i);
      const h1Text = h1Match ? h1Match[1].replace(/<[^>]*?>/g, '').trim() : 'Found';
      checks.push({ key: 'h1', label: 'H1 Tag', status: 'pass', value: h1Text.substring(0, 60), message: 'H1 heading found.', points: 10, maxPoints: 10 });
    } else {
      checks.push({ key: 'h1', label: 'H1 Tag', status: 'fail', value: '', message: 'Missing H1 heading. Add one that includes your target keyword.', points: 0, maxPoints: 10 });
    }

    // 4. h2Structure
    const hasH2 = /<h2[\s>]/i.test(content);
    if (hasH1 && hasH2) {
      checks.push({ key: 'h2Structure', label: 'H2 Structure', status: 'pass', value: 'Has H1 + H2', message: 'Content has proper heading hierarchy.', points: 10, maxPoints: 10 });
    } else if (hasH1 && !hasH2) {
      checks.push({ key: 'h2Structure', label: 'H2 Structure', status: 'warning', value: 'H1 without H2', message: 'Content has an H1 but no H2 subheadings.', points: 5, maxPoints: 10 });
    } else {
      checks.push({ key: 'h2Structure', label: 'H2 Structure', status: 'fail', value: '', message: 'No H1 tag found.', points: 0, maxPoints: 10 });
    }

    // 5. urlSlug
    const slug = contentItem.slug || '';
    if (slug.length >= 3 && slug.length <= 75) {
      checks.push({ key: 'urlSlug', label: 'URL Slug', status: 'pass', value: `/${slug}`, message: `Slug is ${slug.length} characters.`, points: 10, maxPoints: 10 });
    } else {
      checks.push({ key: 'urlSlug', label: 'URL Slug', status: 'fail', value: `/${slug}`, message: `Slug should be 3-75 characters. Currently ${slug.length}.`, points: 0, maxPoints: 10 });
    }

    // 6. canonical
    const canonicalUrl = seoConfig?.canonicalUrl || '';
    let isAutoGenerated = false;
    if (!canonicalUrl || canonicalUrl.trim() === '') {
      checks.push({ key: 'canonical', label: 'Canonical URL', status: 'fail', value: '', message: 'No canonical URL set. Add one to avoid duplicate content issues.', points: 0, maxPoints: 10 });
    } else {
      // Check if it's auto-generated pattern
      const autoPattern = siteDomain
        ? `https://${siteDomain}/${contentItem.slug}`
        : `/${contentItem.slug}`;
      isAutoGenerated = canonicalUrl === autoPattern || canonicalUrl === `/${contentItem.slug}`;
      if (isAutoGenerated) {
        checks.push({ key: 'canonical', label: 'Canonical URL', status: 'warning', value: canonicalUrl, message: 'Canonical URL appears to be auto-generated. Consider setting a custom one if needed.', points: 7, maxPoints: 10 });
      } else {
        checks.push({ key: 'canonical', label: 'Canonical URL', status: 'pass', value: canonicalUrl, message: 'Custom canonical URL is set.', points: 10, maxPoints: 10 });
      }
    }

    // 7. imageAlt
    const imgTagRegex = /<img\s[^>]*?>/gi;
    const imgTags = content.match(imgTagRegex) || [];
    if (imgTags.length === 0) {
      checks.push({ key: 'imageAlt', label: 'Image ALT Tags', status: 'pass', value: 'No images', message: 'No images found in content. If images are added, ensure they have alt text.', points: 10, maxPoints: 10 });
    } else {
      const imagesWithoutAlt = imgTags.filter((tag) => {
        const altMatch = tag.match(/alt\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
        if (!altMatch) return true;
        const altVal = altMatch[1] ?? altMatch[2] ?? altMatch[3];
        return !altVal || altVal.trim() === '';
      });
      if (imagesWithoutAlt.length === 0) {
        checks.push({ key: 'imageAlt', label: 'Image ALT Tags', status: 'pass', value: `All ${imgTags.length} images have alt`, message: `All ${imgTags.length} images have alt text.`, points: 10, maxPoints: 10 });
      } else if (imagesWithoutAlt.length < imgTags.length) {
        checks.push({ key: 'imageAlt', label: 'Image ALT Tags', status: 'warning', value: `${imagesWithoutAlt.length}/${imgTags.length} missing alt`, message: `${imagesWithoutAlt.length} of ${imgTags.length} images are missing alt text.`, points: 5, maxPoints: 10 });
      } else {
        checks.push({ key: 'imageAlt', label: 'Image ALT Tags', status: 'fail', value: `${imgTags.length} images, 0 have alt`, message: `None of the ${imgTags.length} images have alt text.`, points: 0, maxPoints: 10 });
      }
    }

    // 8. internalLinks
    const internalLinkRegex = /<a\s[^>]*?href\s*=\s*"\//gi;
    const internalLinks = content.match(internalLinkRegex) || [];
    const internalLinkCount = internalLinks.length;
    if (internalLinkCount >= 3) {
      checks.push({ key: 'internalLinks', label: 'Internal Links', status: 'pass', value: `${internalLinkCount} links`, message: `Found ${internalLinkCount} internal links.`, points: 10, maxPoints: 10 });
    } else if (internalLinkCount >= 1) {
      checks.push({ key: 'internalLinks', label: 'Internal Links', status: 'warning', value: `${internalLinkCount} links`, message: `Only ${internalLinkCount} internal link(s). Add at least 3 for better structure.`, points: 5, maxPoints: 10 });
    } else {
      checks.push({ key: 'internalLinks', label: 'Internal Links', status: 'fail', value: '0 links', message: 'No internal links found. Add links to other pages.', points: 0, maxPoints: 10 });
    }

    // 9. externalLinks
    const externalLinkRegex = /<a\s[^>]*?href\s*=\s*"https?:\/\//gi;
    const externalLinks = content.match(externalLinkRegex) || [];
    const externalLinkCount = externalLinks.length;
    if (externalLinkCount >= 1) {
      checks.push({ key: 'externalLinks', label: 'External Links', status: 'pass', value: `${externalLinkCount} links`, message: `Found ${externalLinkCount} external link(s).`, points: 10, maxPoints: 10 });
    } else {
      checks.push({ key: 'externalLinks', label: 'External Links', status: 'info', value: '0 links', message: 'No external links found. Consider linking to authoritative sources.', points: 8, maxPoints: 10 });
    }

    // 10. keywordUsage
    const focusKeyword = contentItem.focusKeyword || '';
    if (focusKeyword && focusKeyword.trim() !== '') {
      const kw = focusKeyword.toLowerCase();
      let keywordHits = 0;
      const maxHits = 5;

      // Check title
      if (contentItem.title.toLowerCase().includes(kw)) keywordHits++;
      // Check description
      if (seoDesc.toLowerCase().includes(kw)) keywordHits++;
      // Check content
      if (plainText.toLowerCase().includes(kw)) keywordHits++;
      // Check H1
      const h1Text = content.match(/<h1[^>]*?>([^<]*(?:<[^>]*>[^<]*)*)<\/h1>/i);
      if (h1Text && h1Text[1].replace(/<[^>]*?>/g, '').trim().toLowerCase().includes(kw)) keywordHits++;
      // Check first paragraph (first 500 chars of plain text)
      const firstParagraph = plainText.substring(0, 500).toLowerCase();
      if (firstParagraph.includes(kw)) keywordHits++;

      const kwPoints = Math.round((keywordHits / maxHits) * 10);
      const kwStatus: CheckStatus = keywordHits >= 4 ? 'pass' : keywordHits >= 2 ? 'warning' : 'fail';
      checks.push({
        key: 'keywordUsage',
        label: 'Keyword Usage',
        status: kwStatus,
        value: `"${focusKeyword}" found in ${keywordHits}/${maxHits} areas`,
        message: keywordHits >= 4
          ? 'Focus keyword is well-distributed across key areas.'
          : keywordHits >= 2
            ? 'Focus keyword appears in some areas. Try to include it in title, description, H1, and first paragraph.'
            : 'Focus keyword not found in key areas. Include it in title, description, H1, and content.',
        points: kwPoints,
        maxPoints: 10,
      });
    } else {
      checks.push({
        key: 'keywordUsage',
        label: 'Keyword Usage',
        status: 'info',
        value: 'No focus keyword set',
        message: 'Set a focus keyword to track its usage across key SEO areas.',
        points: 5,
        maxPoints: 10,
      });
    }

    // 11. contentLength
    if (plainText.length >= 300) {
      checks.push({ key: 'contentLength', label: 'Content Length', status: 'pass', value: `${plainText.length} chars`, message: `Content is ${plainText.length} characters.`, points: 10, maxPoints: 10 });
    } else if (plainText.length >= 100) {
      checks.push({ key: 'contentLength', label: 'Content Length', status: 'warning', value: `${plainText.length} chars`, message: `Content is only ${plainText.length} characters. Aim for at least 300.`, points: 5, maxPoints: 10 });
    } else if (plainText.length > 0) {
      checks.push({ key: 'contentLength', label: 'Content Length', status: 'fail', value: `${plainText.length} chars`, message: `Content is too short at ${plainText.length} characters. Aim for at least 300.`, points: 0, maxPoints: 10 });
    } else {
      checks.push({ key: 'contentLength', label: 'Content Length', status: 'fail', value: '0 chars', message: 'No content found.', points: 0, maxPoints: 10 });
    }

    // 12. readability (average sentence length)
    if (plainText.length > 0) {
      const sentences = plainText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      if (sentences.length > 0) {
        const totalWords = sentences.reduce((sum, sentence) => {
          return sum + sentence.trim().split(/\s+/).filter(Boolean).length;
        }, 0);
        const avgSentenceLength = totalWords / sentences.length;

        if (avgSentenceLength < 20) {
          checks.push({ key: 'readability', label: 'Readability', status: 'pass', value: `${avgSentenceLength.toFixed(1)} words/sentence`, message: `Average sentence length is ${avgSentenceLength.toFixed(1)} words. Good readability.`, points: 10, maxPoints: 10 });
        } else if (avgSentenceLength <= 25) {
          checks.push({ key: 'readability', label: 'Readability', status: 'warning', value: `${avgSentenceLength.toFixed(1)} words/sentence`, message: `Average sentence length is ${avgSentenceLength.toFixed(1)} words. Consider shorter sentences.`, points: 5, maxPoints: 10 });
        } else {
          checks.push({ key: 'readability', label: 'Readability', status: 'fail', value: `${avgSentenceLength.toFixed(1)} words/sentence`, message: `Average sentence length is ${avgSentenceLength.toFixed(1)} words. Break up long sentences for better readability.`, points: 0, maxPoints: 10 });
        }
      } else {
        checks.push({ key: 'readability', label: 'Readability', status: 'info', value: 'N/A', message: 'Not enough sentences to assess readability.', points: 5, maxPoints: 10 });
      }
    } else {
      checks.push({ key: 'readability', label: 'Readability', status: 'fail', value: '', message: 'No content to assess readability.', points: 0, maxPoints: 10 });
    }

    // Calculate overall score
    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    const score = totalMaxPoints > 0 ? Math.round((totalPoints / totalMaxPoints) * 100) : 0;

    return NextResponse.json({
      data: {
        resourceId: contentItem.id,
        title: contentItem.title,
        slug: contentItem.slug,
        checks,
        score,
      },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:META-ANALYSIS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to perform meta analysis' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
