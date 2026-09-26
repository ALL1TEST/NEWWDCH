// ============================================================
// i18n — FRAGMENT: Categories and Tags module pages (English)
// ============================================================
// Deep page-level strings for the taxonomy area. Keys follow the
// '<prefix>.<camelCaseName>' convention used by every other
// fragment. Wired by the t() call sites in the module pages.
// en = source of truth; other locales are generated from this
// file (machine-assisted translations with the same fallback
// chain as every other fragment).
// ============================================================

export const clientTaxonomyEn: Record<string, string> = {
  // ---- Categories page ----
  'categories.pageDescription': 'Organize your content with a structured category hierarchy',
  'categories.newCategory': 'New Category',
  'categories.createCategory': 'Create Category',
  'categories.createSubCategory': 'Create Sub-Category',
  'categories.searchPlaceholder': 'Search categories...',
  'categories.categorySingular': 'category',
  'categories.categoryPlural': 'categories',
  'categories.gridView': 'Grid view',
  'categories.listView': 'List view',
  'categories.selectedCount': 'selected',
  'categories.selectAll': 'Select All',
  'categories.deselectAll': 'Deselect All',
  'categories.deleteSelected': 'Delete Selected',

  // ---- Category form ----
  'categories.slug': 'Slug',
  'categories.slugPlaceholder': 'category-slug',
  'categories.namePlaceholder': 'Category name',
  'categories.description': 'Description',
  'categories.descriptionPlaceholder': 'Optional description',
  'categories.parentCategory': 'Parent Category',
  'categories.noneRootLevel': 'None (root level)',

  // ---- Cards / rows ----
  'categories.addSubCategory': 'Add sub-category',
  'categories.selectAriaPrefix': 'Select ',
  'categories.dragAriaPrefix': 'Drag ',
  'categories.collapse': 'Collapse',
  'categories.expand': 'Expand',
  'categories.articleSingular': 'article',
  'categories.articlePlural': 'articles',
  'categories.subCount': 'sub',
  'categories.seoReady': 'SEO Ready',
  'categories.noDescription': 'No description',

  // ---- Empty state ----
  'categories.emptyTitle': 'No categories yet',
  'categories.emptySearch': 'No categories match your search. Try a different query.',
  'categories.emptyDescription':
    'Get started by creating your first category to organize your content.',

  // ---- Create sheet ----
  'categories.createSubDescriptionPrefix': 'Adding a new category under "',
  'categories.createSubDescriptionSuffix': '"',
  'categories.createRootDescription': 'Add a new root-level category to your content structure',

  // ---- Edit sheet ----
  'categories.editCategory': 'Edit Category',
  'categories.editDescription': 'Update the category details below',

  // ---- Delete dialog ----
  'categories.deleteCategory': 'Delete Category',
  'categories.deleteConfirmPrefix': 'Are you sure you want to delete "',
  'categories.deleteConfirmSuffix': '"? This action cannot be undone.',

  // ---- Tags page ----
  'tags.pageDescription': 'Manage tags for content organization and discovery',
  'tags.createTag': 'Create Tag',
  'tags.editTag': 'Edit Tag',
  'tags.popularTags': 'Popular Tags',
  'tags.noTagsYet': 'No tags yet',
  'tags.aiSuggestedTags': 'AI Suggested Tags',
  'tags.refreshSuggestions': 'Refresh suggestions',
  'tags.addTagAriaPrefix': 'Add tag ',
  'tags.searchPlaceholder': 'Search tags...',

  // ---- Sort options ----
  'tags.sortNameAsc': 'Name A-Z',
  'tags.sortNameDesc': 'Name Z-A',
  'tags.sortMostUsed': 'Most Used',
  'tags.sortLeastUsed': 'Least Used',
  'tags.sortNewest': 'Newest',
  'tags.sortOldest': 'Oldest',

  // ---- View toggle / list headers ----
  'tags.gridView': 'Grid view',
  'tags.listView': 'List view',
  'tags.slug': 'Slug',
  'tags.slugPlaceholder': 'tag-slug',
  'tags.articles': 'Articles',
  'tags.selectAll': 'Select all',

  // ---- Empty state ----
  'tags.emptySearch': 'No tags match your search',
  'tags.emptyNotFound': 'No tags found',
  'tags.createFirstTag': 'Create your first tag',

  // ---- Selection ----
  'tags.selectAriaPrefix': 'Select ',
  'tags.selectedCount': 'selected',
  'tags.clear': 'Clear',
  'tags.deleteSelected': 'Delete Selected',

  // ---- Pagination ----
  'tags.paginationTo': 'to',
  'tags.paginationUnit': 'tags',
  'tags.previousPage': 'Previous page',
  'tags.nextPage': 'Next page',

  // ---- Analytics sidebar ----
  'tags.tagAnalytics': 'Tag Analytics',
  'tags.totalTags': 'Total tags',
  'tags.avgArticlesPerTag': 'Avg articles/tag',
  'tags.mostUsed': 'Most Used',
  'tags.tagsWithNoContent': 'Tags with no content',
  'tags.recentlyUsed': 'Recently Used',
  'tags.tagRelationships': 'Tag Relationships',
  'tags.comingSoon': 'Coming soon',
  'tags.tagRelationshipsDescription': 'Visualize and manage related tags',

  // ---- Tag form ----
  'tags.namePlaceholder': 'Tag name',
  'tags.color': 'Color',
  'tags.colorHint': 'Enter a hex color code or click a preset',
  'tags.setColorAriaPrefix': 'Set color to ',
  'tags.description': 'Description',
  'tags.descriptionPlaceholder': 'Optional description',

  // ---- Create dialog ----
  'tags.createDescription': 'Add a new tag to your content tagging system',

  // ---- Edit dialog ----
  'tags.editDescriptionPrefix': 'Update tag details for “',
  'tags.editDescriptionSuffix': '”',

  // ---- Delete dialog ----
  'tags.deleteTag': 'Delete Tag',
  'tags.deleteConfirmPrefix': 'Are you sure you want to delete the tag "',
  'tags.deleteConfirmSuffix':
    '"? This will remove the tag from all associated content items.',
};
