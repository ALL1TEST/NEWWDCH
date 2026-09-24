const fs = require('fs');
const path = require('path');

// 1. Patch BlogListing.tsx
const blogListingPath = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/components/blog/BlogListing.tsx';
let blogContent = fs.readFileSync(blogListingPath, 'utf8');

const targetStr = '  // Sync category from navigation store (e.g. clicking nav link)';
const replacementStr = `  // Dynamically derive all categories from siteConfig + articles
  const allCategories = useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>();
    categories.forEach((c) => map.set(c.slug, c));
    articles.forEach((a) => {
      if (a.categorySlug && !map.has(a.categorySlug)) {
        map.set(a.categorySlug, {
          name: a.category || a.categorySlug,
          slug: a.categorySlug,
        });
      }
    });
    return Array.from(map.values());
  }, [articles]);

  // Sync category from navigation store (e.g. clicking nav link)`;

if (!blogContent.includes('const allCategories = useMemo')) {
  if (blogContent.includes(targetStr)) {
    blogContent = blogContent.replace(targetStr, replacementStr);
  } else {
    console.error('Target string not found in BlogListing.tsx');
  }

  const catNameOld = `const categoryName = effectiveCategory
    ? categories.find((c) => c.slug === effectiveCategory)?.name
    : null;`;
  const catNameNew = `const categoryName = effectiveCategory
    ? (allCategories.find((c) => c.slug === effectiveCategory)?.name ?? categories.find((c) => c.slug === effectiveCategory)?.name)
    : null;`;

  if (blogContent.includes(catNameOld)) {
    blogContent = blogContent.replace(catNameOld, catNameNew);
  }

  fs.writeFileSync(blogListingPath, blogContent, 'utf8');
  console.log('Successfully patched BlogListing.tsx');
} else {
  console.log('BlogListing.tsx already contains allCategories');
}

// 2. Patch next.config.ts
const nextConfigPath = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/next.config.ts';
let nextConfig = fs.readFileSync(nextConfigPath, 'utf8');

const updatedNextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
`;

fs.writeFileSync(nextConfigPath, updatedNextConfig, 'utf8');
console.log('Successfully updated next.config.ts with images: { unoptimized: true }');
