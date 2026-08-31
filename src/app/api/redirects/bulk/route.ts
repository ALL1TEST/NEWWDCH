// ============================================================
// GET  /api/redirects/bulk?action=export  — Export redirects as CSV
// POST /api/redirects/bulk?action=import  — Import redirects from CSV
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';

// ---------- Type mappings --------------------------------------------

const TYPE_TO_NUM: Record<string, string> = {
  PERMANENT_301: '301',
  TEMPORARY_302: '302',
  TEMPORARY_307: '307',
  PERMANENT_308: '308',
};

const NUM_TO_TYPE: Record<string, string> = {
  '301': 'PERMANENT_301',
  '302': 'TEMPORARY_302',
  '307': 'TEMPORARY_307',
  '308': 'PERMANENT_308',
};

const VALID_TYPES = new Set(['301', '302', '307', '308']);

// ---------- CSV escaping (RFC 4180) -----------------------------------

function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// ---------- Loop detection helper -------------------------------------

async function wouldCreateLoop(fromPath: string, toPath: string, siteFilter: Record<string, string>): Promise<boolean> {
  const directLoop = await db.redirect.findFirst({
    where: { ...siteFilter, fromPath: toPath, toPath: fromPath, isActive: true },
  });
  if (directLoop) return true;

  let current = toPath;
  const visited = new Set<string>();
  visited.add(fromPath);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);

    const next = await db.redirect.findFirst({
      where: { ...siteFilter, fromPath: current, isActive: true },
      select: { toPath: true },
    });

    if (!next) break;
    current = next.toPath;
  }

  return false;
}

// ---------- CSV parsing -----------------------------------------------

function parseCSV(csvContent: string): { headers: string[]; rows: string[][] } {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser that handles quoted fields
  function splitRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map(splitRow);
  return { headers, rows };
}

// ---------- Validation schema for import ------------------------------

const importSchema = z.object({
  csvContent: z.string().min(1, 'CSV content is required'),
});

// =====================================================================
// GET — export
// =====================================================================

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const action = sp.get('action');

    if (action !== 'export') {
      return NextResponse.json(
        { error: { code: 'INVALID_ACTION', message: 'Use ?action=export' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const siteFilter = await getSiteWhere(request);
    const redirects = await db.redirect.findMany({
      where: siteFilter,
      orderBy: { createdAt: 'desc' },
    });

    // Full export: fromPath, toPath, type, hits, createdAt, updatedAt, status
    const lines: string[] = [
      'fromPath,toPath,type,hits,createdAt,updatedAt,status',
    ];
    for (const r of redirects) {
      const typeNum = TYPE_TO_NUM[r.type] || '301';
      const status = r.isActive ? 'active' : 'inactive';
      lines.push(
        [
          escapeCsvField(r.fromPath),
          escapeCsvField(r.toPath),
          escapeCsvField(typeNum),
          escapeCsvField(String(r.hitCount ?? 0)),
          escapeCsvField(r.createdAt.toISOString()),
          escapeCsvField(r.updatedAt.toISOString()),
          escapeCsvField(status),
        ].join(','),
      );
    }

    const csv = lines.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="redirects.csv"',
      },
    });
  } catch (error) {
    console.error(`[REDIRECTS:BULK:EXPORT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to export redirects' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — import
// =====================================================================

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const action = sp.get('action');

    if (action !== 'import') {
      return NextResponse.json(
        { error: { code: 'INVALID_ACTION', message: 'Use ?action=import' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const confirm = sp.get('confirm') === 'true';

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id, timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }

    const { csvContent } = parsed.data;
    const { headers, rows } = parseCSV(csvContent);

    // Find column indices: support 'from'/'fromPath', 'to'/'toPath', 'type', 'status'/'active'
    const fromIdx = headers.findIndex((h) => h === 'from' || h === 'frompath');
    const toIdx = headers.findIndex((h) => h === 'to' || h === 'topath');
    const typeIdx = headers.findIndex((h) => h === 'type');
    const statusIdx = headers.findIndex(
      (h) => h === 'status' || h === 'active' || h === 'isactive',
    );

    if (fromIdx === -1 || toIdx === -1) {
      return NextResponse.json(
        { error: { code: 'INVALID_CSV', message: 'CSV must have "from" (or "fromPath") and "to" (or "toPath") columns' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const siteFilter = await getSiteWhere(request);
    const siteId = request.nextUrl.searchParams.get('siteId') || undefined;

    // Validate all rows
    const errors: { row: number; message: string }[] = [];
    const validRows: { fromPath: string; toPath: string; type: string; isActive: boolean; rowNum: number }[] = [];
    const seenFromPaths = new Set<string>();

    // Fetch existing active redirects' fromPaths for duplicate check
    const existingRedirects = await db.redirect.findMany({
      where: { ...siteFilter, isActive: true },
      select: { fromPath: true },
    });
    const existingFromPaths = new Set(existingRedirects.map((r) => r.fromPath));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // CSV row number (1-indexed, after header)

      const fromVal = row[fromIdx]?.trim() || '';
      const toVal = row[toIdx]?.trim() || '';
      const typeVal = typeIdx >= 0 ? (row[typeIdx]?.trim() || '301') : '301';
      const statusVal =
        statusIdx >= 0 ? (row[statusIdx]?.trim().toLowerCase() || 'active') : 'active';

      // Check from is present
      if (!fromVal) {
        errors.push({ row: rowNum, message: 'Missing "from" path' });
        continue;
      }

      // Check to is present
      if (!toVal) {
        errors.push({ row: rowNum, message: 'Missing "to" path' });
        continue;
      }

      // from must start with /
      if (!fromVal.startsWith('/')) {
        errors.push({ row: rowNum, message: `"from" path must start with /: "${fromVal}"` });
        continue;
      }

      // to must start with /
      if (!toVal.startsWith('/')) {
        errors.push({ row: rowNum, message: `"to" path must start with /: "${toVal}"` });
        continue;
      }

      // type must be valid
      if (!VALID_TYPES.has(typeVal)) {
        errors.push({ row: rowNum, message: `Invalid redirect type "${typeVal}". Must be one of: 301, 302, 307, 308` });
        continue;
      }

      // status must be valid if present
      const isActiveRow =
        statusVal === 'active' || statusVal === 'true' || statusVal === '1'
          ? true
          : statusVal === 'inactive' || statusVal === 'false' || statusVal === '0'
            ? false
            : null;
      if (isActiveRow === null) {
        errors.push({
          row: rowNum,
          message: `Invalid status "${statusVal}". Must be one of: active, inactive, true, false`,
        });
        continue;
      }

      // from and to cannot be the same
      if (fromVal === toVal) {
        errors.push({ row: rowNum, message: '"from" and "to" paths cannot be the same' });
        continue;
      }

      // Duplicate within import (only matters for active redirects — multiple
      // inactive redirects with the same fromPath are allowed).
      if (isActiveRow && seenFromPaths.has(fromVal)) {
        errors.push({ row: rowNum, message: `Duplicate active source path within import: "${fromVal}"` });
        continue;
      }
      if (isActiveRow) seenFromPaths.add(fromVal);

      // Check existing active redirect with same fromPath (only for active rows)
      if (isActiveRow && existingFromPaths.has(fromVal)) {
        errors.push({ row: rowNum, message: `An active redirect with from path "${fromVal}" already exists` });
        continue;
      }

      validRows.push({
        fromPath: fromVal,
        toPath: toVal,
        type: NUM_TO_TYPE[typeVal] || 'PERMANENT_301',
        isActive: isActiveRow,
        rowNum,
      });
    }

    // In-batch loop/chain detection: a row whose `toPath` equals another row's
    // `fromPath` in the same CSV would create a redirect chain (and potentially
    // a loop). Such rows are skipped and reported in the errors list. This is
    // necessary because the per-row DB loop check below runs before the batch
    // is committed, so it can't see sibling rows created in the same import.
    // Only active rows participate — inactive redirects never actually fire.
    const batchFromPathIdx = new Map<string, number>();
    for (let i = 0; i < validRows.length; i++) {
      if (validRows[i].isActive) {
        batchFromPathIdx.set(validRows[i].fromPath, i);
      }
    }
    const batchSkipIndices = new Set<number>();
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      if (!row.isActive) continue; // inactive rows can't chain
      const matchIdx = batchFromPathIdx.get(row.toPath);
      if (matchIdx !== undefined && matchIdx !== i) {
        batchSkipIndices.add(i);
        errors.push({
          row: row.rowNum,
          message: `In-batch loop detected: "to" path "${row.toPath}" matches another row's "from" path`,
        });
      }
    }
    const rowsToImport = validRows.filter((_, i) => !batchSkipIndices.has(i));

    // If not confirmed, return validation results only
    if (!confirm) {
      return NextResponse.json({
        data: {
          validRows: rowsToImport.length,
          invalidRows: errors.length,
          errors,
          imported: 0,
          skipped: 0,
          errorsDuringImport: 0,
        },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Confirm mode: actually import valid rows.
    // Validation (DB loop detection) runs outside the transaction; only the
    // creates are wrapped in `db.$transaction` for atomicity — if any create
    // throws, the entire batch rolls back.
    let imported = 0;
    let skipped = batchSkipIndices.size;
    let errorsDuringImport = 0;

    // Per-row DB loop check (against existing committed redirects).
    const rowsToCreate: typeof rowsToImport = [];
    for (const row of rowsToImport) {
      try {
        const loop = await wouldCreateLoop(row.fromPath, row.toPath, siteFilter);
        if (loop) {
          errorsDuringImport++;
          continue;
        }
        rowsToCreate.push(row);
      } catch {
        errorsDuringImport++;
      }
    }

    // Atomic create: all-or-nothing.
    try {
      await db.$transaction(async (tx) => {
        for (const row of rowsToCreate) {
          await tx.redirect.create({
            data: {
              fromPath: row.fromPath,
              toPath: row.toPath,
              type: row.type as 'PERMANENT_301' | 'TEMPORARY_302' | 'TEMPORARY_307' | 'PERMANENT_308',
              isActive: row.isActive,
              siteId,
            },
          });
        }
      });
      imported = rowsToCreate.length;
    } catch {
      // Entire batch rolled back; count every row as an import error.
      errorsDuringImport += rowsToCreate.length;
    }

    return NextResponse.json({
      data: {
        validRows: rowsToImport.length,
        invalidRows: errors.length,
        errors,
        imported,
        skipped,
        errorsDuringImport,
      },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[REDIRECTS:BULK:IMPORT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to import redirects' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
