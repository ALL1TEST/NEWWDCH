// ============================================================
// GET /api/settings/categories — Get UI-visible settings categories
// Only returns configuration categories (excludes operational ones
// like ANALYTICS, SEARCH_CONSOLE, SITEMAP, ROBOTS, BACKUPS,
// SCHEDULER, NOTIFICATIONS which belong to their primary modules)
// ============================================================

import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getVisibleCategories } from '@/lib/settings-service';

function reqId() { return 'req_' + nanoid(8); }

export async function GET() {
  const id = reqId();

  try {
    const visibleCategories = getVisibleCategories();

    // Return category definitions with field metadata (exclude defaults for security)
    const categories = visibleCategories.map(cat => ({
      key: cat.key,
      label: cat.label,
      description: cat.description,
      icon: cat.icon,
      fieldCount: cat.fields.length,
      fields: cat.fields.map(f => ({
        key: f.key,
        label: f.label,
        description: f.description,
        type: f.type,
        control: f.control,
        group: f.group,
        options: f.options,
        placeholder: f.placeholder,
        min: f.min,
        max: f.max,
        step: f.step,
        isPublic: f.isPublic,
        isSensitive: f.isSensitive,
      })),
    }));

    return NextResponse.json({ data: categories, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SETTINGS:CATEGORIES] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
