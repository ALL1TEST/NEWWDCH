// ============================================================
// GET /api/backups/logs — List backup logs with filters
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const listIncludes = {
  backup: {
    select: { id: true, name: true, filename: true, status: true, scope: true },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  site: { select: { id: true, name: true, slug: true } },
} as const;

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'action', 'status', 'durationMs', 'archiveSize']);

// ---------- label maps (for search matching) -------------------------
// The UI displays labelized forms of these string/enums (e.g. "IN_PROGRESS"
// → "In Progress", "CLOUDFLARE_R2" → "Cloudflare R2"). Search must match
// what the user SEES, so for each search term we pre-compute the set of
// raw enum values whose raw form OR labelized form contains the term, then
// OR a `provider IN (...)` / `action IN (...)` / `status IN (...)` clause
// with the free-text `contains` clauses on errorMessage and backup.name.

const ACTION_VALUES = ['CREATE', 'RESTORE', 'VERIFY', 'DOWNLOAD', 'DELETE', 'SCHEDULE', 'STORAGE_TEST'] as const;

const STATUS_VALUES = ['SUCCESS', 'FAILED', 'IN_PROGRESS', 'SKIPPED', 'PENDING'] as const;

const PROVIDER_LABELS: Record<string, string> = {
  LOCAL: 'Local',
  GOOGLE_DRIVE: 'Google Drive',
  DROPBOX: 'Dropbox',
  ONEDRIVE: 'OneDrive',
  CLOUDFLARE_R2: 'Cloudflare R2',
  FTP: 'FTP',
};

/** Split on underscores, capitalize each word, join with spaces — matches
 *  the client-side `labelize` so server-side search sees the same strings
 *  the user sees in the table. */
function labelize(str: string): string {
  return str
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

// =====================================================================
// GET — list with filters
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? (sp.get('sort') as string) : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';

    // Filters
    const action = sp.get('action');
    const status = sp.get('status');
    const backupId = sp.get('backupId');
    const startDate = sp.get('startDate');;
    const endDate = sp.get('endDate');
    const search = sp.get('search')?.trim();

    const where: Record<string, unknown> = { ...(await getSiteWhere(request)) };

    if (action) where.action = action;
    if (status) where.status = status;
    if (backupId) where.backupId = backupId;

    // Date range filter
    if (startDate || endDate) {
      const createdAt: Record<string, unknown> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    if (search) {
      // Search matches: Action, Status, Backup Name, Provider, Error message.
      // For Action/Status/Provider (stored as raw enums but DISPLAYED as
      // labelized text), match against BOTH the raw enum ("IN_PROGRESS")
      // AND the human label ("In Progress") so the user can type what they
      // see. Backup Name lives on the related Backup record, so it is
      // matched via the `backup` relation. errorMessage is free-text.
      const lower = search.toLowerCase();

      const matchedActions = ACTION_VALUES.filter(
        (a) => a.toLowerCase().includes(lower) || labelize(a).toLowerCase().includes(lower),
      );
      const matchedStatuses = STATUS_VALUES.filter(
        (s) => s.toLowerCase().includes(lower) || labelize(s).toLowerCase().includes(lower),
      );
      const matchedProviders = Object.entries(PROVIDER_LABELS).filter(
        ([enumKey, label]) =>
          enumKey.toLowerCase().includes(lower) || label.toLowerCase().includes(lower),
      ).map(([enumKey]) => enumKey);

      const orClauses: Record<string, unknown>[] = [
        { errorMessage: { contains: search } },
        // Backup Name — matched via the related Backup record's name.
        { backup: { name: { contains: search } } },
      ];
      if (matchedActions.length > 0) {
        orClauses.push({ action: { in: matchedActions } });
      }
      if (matchedStatuses.length > 0) {
        orClauses.push({ status: { in: matchedStatuses } });
      }
      if (matchedProviders.length > 0) {
        orClauses.push({ storageProvider: { in: matchedProviders } });
      }
      where.OR = orClauses;
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.backupLog.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.backupLog.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[BACKUP_LOGS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backup logs' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
