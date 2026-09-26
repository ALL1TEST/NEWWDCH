// ============================================================
// SITE SYNC ENGINE — Server-Side Content Synchronizer
// ============================================================

import { db } from '@/lib/db';
import { getSiteConnectionClient } from './site-client';
import { SyncReport, NormalizedSyncItem, SiteConnectionData } from './types';

/**
 * Synchronizes content from a connected external site into the CMS.
 * Idempotently creates, updates, and tracks all posts, static pages, categories, and tags.
 */
export async function syncSiteContent(siteId: string): Promise<SyncReport> {
  const startTime = new Date().toISOString();

  // 1. Fetch site and connection configuration
  const site = await db.site.findUnique({
    where: { id: siteId },
  });

  if (!site) {
    throw new Error(`Site with ID "${siteId}" not found.`);
  }

  let connectionData: SiteConnectionData | null = null;
  if (site.config) {
    try {
      const parsedConfig = typeof site.config === 'string' ? JSON.parse(site.config) : site.config;
      connectionData = (parsedConfig.connection as SiteConnectionData) || null;
    } catch (err) {
      console.error('Failed to parse site config for sync:', err);
    }
  }

  if (!connectionData || !connectionData.siteUrl) {
    throw new Error(`Site "${site.name}" does not have an external connection configured.`);
  }

  // 2. Initialize connection client
  const client = await getSiteConnectionClient(connectionData);
  if (!client) {
    throw new Error(`Failed to initialize connection client for platform "${connectionData.platform}".`);
  }

  // 3. Discover all external content
  const discovered = await client.discoverAllContent();

  const report: SyncReport = {
    siteId: site.id,
    siteName: site.name,
    platform: connectionData.platform,
    postsDiscovered: discovered.posts.length,
    pagesDiscovered: discovered.pages.length,
    categoriesDiscovered: discovered.categories.length,
    tagsDiscovered: discovered.tags.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    errors: [],
    syncedAt: startTime,
  };

  // 4. Ensure ContentTypes exist (Post and Page)
  let postContentType = await db.contentType.findFirst({
    where: { slug: 'post' },
  });
  if (!postContentType) {
    postContentType = await db.contentType.create({
      data: {
        name: 'Post',
        slug: 'post',
        description: 'Standard blog post content type',
        icon: 'FileText',
        isBuiltIn: true,
        allowedStatuses: JSON.stringify(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']),
        fields: JSON.stringify([
          { name: 'title', type: 'STRING', label: 'Title', required: true, maxLength: 500 },
          { name: 'content', type: 'JSON', label: 'Content', required: true },
          { name: 'excerpt', type: 'STRING', label: 'Excerpt', required: false, maxLength: 1000 },
          { name: 'featuredImage', type: 'FILE', label: 'Featured Image', required: false },
          { name: 'seoTitle', type: 'STRING', label: 'SEO Title', required: false, maxLength: 70 },
          { name: 'seoDescription', type: 'STRING', label: 'SEO Description', required: false, maxLength: 160 },
          { name: 'focusKeyword', type: 'STRING', label: 'Focus Keyword', required: false, maxLength: 100 },
        ]),
      },
    });
  }

  let pageContentType = await db.contentType.findFirst({
    where: { slug: 'page' },
  });
  if (!pageContentType) {
    pageContentType = await db.contentType.create({
      data: {
        name: 'Page',
        slug: 'page',
        description: 'Static page content type',
        icon: 'File',
        isBuiltIn: true,
        allowedStatuses: JSON.stringify(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
        fields: JSON.stringify([
          { name: 'title', type: 'STRING', label: 'Title', required: true, maxLength: 500 },
          { name: 'content', type: 'JSON', label: 'Content', required: true },
        ]),
      },
    });
  }

  // 5. Determine Author User
  let defaultAuthor = site.ownerId
    ? await db.user.findUnique({ where: { id: site.ownerId } })
    : null;

  if (!defaultAuthor) {
    defaultAuthor = await db.user.findFirst({
      where: { role: { in: ['ADMIN', 'OWNER', 'INTERNAL', 'PLATFORM_ADMIN'] } },
    });
  }

  if (!defaultAuthor) {
    defaultAuthor = await db.user.findFirst();
  }

  if (!defaultAuthor) {
    throw new Error('No user account available in CMS to assign authored content.');
  }

  // 6. Synchronize Categories
  const categoryMap = new Map<string, string>(); // slug -> categoryId

  for (const cat of discovered.categories) {
    try {
      const cleanSlug = cat.slug.toLowerCase().trim();
      let existingCat = await db.category.findFirst({
        where: { siteId: site.id, slug: cleanSlug },
      });

      if (!existingCat) {
        existingCat = await db.category.create({
          data: {
            name: cat.name,
            slug: cleanSlug,
            description: cat.description || null,
            siteId: site.id,
          },
        });
      } else if (existingCat.name !== cat.name || (cat.description && existingCat.description !== cat.description)) {
        existingCat = await db.category.update({
          where: { id: existingCat.id },
          data: {
            name: cat.name,
            description: cat.description ?? existingCat.description,
          },
        });
      }

      categoryMap.set(cleanSlug, existingCat.id);
    } catch (err: any) {
      console.warn(`Error syncing category "${cat.name}":`, err.message);
    }
  }

  // 7. Synchronize Tags
  const tagMap = new Map<string, string>(); // slug/name -> tagId

  for (const tag of discovered.tags) {
    try {
      const cleanSlug = tag.slug.toLowerCase().trim();
      let existingTag = await db.tag.findFirst({
        where: { siteId: site.id, slug: cleanSlug },
      });

      if (!existingTag) {
        existingTag = await db.tag.create({
          data: {
            name: tag.name,
            slug: cleanSlug,
            siteId: site.id,
          },
        });
      }

      tagMap.set(cleanSlug, existingTag.id);
      tagMap.set(tag.name.toLowerCase().trim(), existingTag.id);
    } catch (err: any) {
      console.warn(`Error syncing tag "${tag.name}":`, err.message);
    }
  }

  // 8. Helper to ensure Media record for featured images
  const mediaMap = new Map<string, string>(); // url -> mediaId

  async function resolveFeaturedImageId(imageUrl?: string, title?: string): Promise<string | null> {
    if (!imageUrl || !imageUrl.trim()) return null;
    const url = imageUrl.trim();

    if (mediaMap.has(url)) return mediaMap.get(url)!;

    let media = await db.media.findFirst({
      where: { siteId: site.id, url },
    });

    if (!media) {
      const filename = url.split('/').pop()?.split('?')[0] || 'featured-image.jpg';
      media = await db.media.create({
        data: {
          filename,
          originalName: filename,
          url,
          mimeType: 'image/jpeg',
          size: 0,
          siteId: site.id,
          uploadedById: defaultAuthor!.id,
          alt: title || filename,
        },
      });
    }

    mediaMap.set(url, media.id);
    return media.id;
  }

  // 9. Synchronize Items (Both Posts and Pages)
  const allDiscoveredItems: NormalizedSyncItem[] = [
    ...discovered.posts,
    ...discovered.pages,
  ];

  const processedSlugs = new Set<string>();

  for (const item of allDiscoveredItems) {
    try {
      const isPage = item.contentType === 'page';
      const targetContentType = isPage ? pageContentType : postContentType;
      const targetSlug = item.slug.toLowerCase().trim();
      processedSlugs.add(`${targetContentType.id}:${targetSlug}`);

      const featuredImageId = await resolveFeaturedImageId(item.featuredImageUrl, item.title);

      const categoryId = item.categorySlug
        ? categoryMap.get(item.categorySlug.toLowerCase().trim()) || null
        : null;

      const matchedTagIds: string[] = [];
      if (item.tagNames && item.tagNames.length > 0) {
        for (const tName of item.tagNames) {
          const tid = tagMap.get(tName.toLowerCase().trim());
          if (tid && !matchedTagIds.includes(tid)) {
            matchedTagIds.push(tid);
          }
        }
      }

      const publishedAtDate = item.publishedAt ? new Date(item.publishedAt) : new Date();

      // Look up existing content item by siteId, contentTypeId, and slug (ignoring soft-deleted)
      const existing = await db.contentItem.findFirst({
        where: {
          siteId: site.id,
          contentTypeId: targetContentType.id,
          slug: targetSlug,
          deletedAt: null,
        },
        include: { tags: true },
      });

      const syncMetadata = {
        externalId: item.externalId,
        source: connectionData.platform,
        syncedAt: startTime,
        ...(item.metadata || {}),
      };

      if (!existing) {
        // CREATE new CMS item
        await db.contentItem.create({
          data: {
            title: item.title,
            slug: targetSlug,
            content: item.content,
            excerpt: item.excerpt || null,
            status: item.status || 'PUBLISHED',
            contentTypeId: targetContentType.id,
            authorId: defaultAuthor.id,
            categoryId,
            featuredImageId,
            publishedAt: publishedAtDate,
            seoTitle: item.seoTitle || null,
            seoDescription: item.seoDescription || null,
            editorialReport: JSON.stringify({ externalSync: syncMetadata }),
            siteId: site.id,
            tags: matchedTagIds.length > 0
              ? { connect: matchedTagIds.map((id) => ({ id })) }
              : undefined,
          },
        });
        report.created++;
      } else {
        // Check if anything meaningful changed
        const existingTags = existing.tags.map((t) => t.id).sort().join(',');
        const newTags = [...matchedTagIds].sort().join(',');

        const isContentDifferent = (existing.content || '').trim() !== (item.content || '').trim();
        const isTitleDifferent = existing.title.trim() !== item.title.trim();
        const isExcerptDifferent = (existing.excerpt || '').trim() !== (item.excerpt || '').trim();
        const isCategoryDifferent = existing.categoryId !== categoryId;
        const isImageDifferent = existing.featuredImageId !== featuredImageId;
        const isTagsDifferent = existingTags !== newTags;
        const isSeoTitleDifferent = (existing.seoTitle || '') !== (item.seoTitle || '');
        const isSeoDescDifferent = (existing.seoDescription || '') !== (item.seoDescription || '');

        const hasChanges =
          isContentDifferent ||
          isTitleDifferent ||
          isExcerptDifferent ||
          isCategoryDifferent ||
          isImageDifferent ||
          isTagsDifferent ||
          isSeoTitleDifferent ||
          isSeoDescDifferent;

        if (hasChanges) {
          await db.contentItem.update({
            where: { id: existing.id },
            data: {
              title: item.title,
              content: item.content,
              excerpt: item.excerpt || null,
              status: item.status || existing.status,
              categoryId,
              featuredImageId,
              publishedAt: publishedAtDate,
              seoTitle: item.seoTitle || null,
              seoDescription: item.seoDescription || null,
              editorialReport: JSON.stringify({ externalSync: syncMetadata }),
              version: existing.version + 1,
              tags: {
                set: matchedTagIds.map((id) => ({ id })),
              },
            },
          });
          report.updated++;
        } else {
          report.unchanged++;
        }
      }
    } catch (err: any) {
      report.failed++;
      const errMsg = `Failed to sync item "${item.title}": ${err.message}`;
      console.error(errMsg, err);
      report.errors?.push(errMsg);
    }
  }

  // 10. Update site's lastVerifiedAt and connection status in config
  try {
    const parsedConfig = typeof site.config === 'string' ? JSON.parse(site.config) : (site.config || {});
    const existingConn = (parsedConfig.connection as Record<string, unknown>) || {};
    const updatedConfig = {
      ...parsedConfig,
      connection: {
        ...existingConn,
        status: 'CONNECTED',
        lastVerifiedAt: startTime,
        lastSyncedAt: startTime,
      },
    };
    await db.site.update({
      where: { id: site.id },
      data: { config: JSON.stringify(updatedConfig) },
    });
  } catch (err) {
    console.warn('Could not update site lastSyncedAt timestamp:', err);
  }

  return report;
}
