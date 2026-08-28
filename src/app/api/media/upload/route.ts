// ============================================================
// POST /api/media/upload — multipart/form-data file upload
// ============================================================
//
// Storage strategy: matches the existing /api/media/generate pattern —
// the file's bytes are encoded as a `data:<mime>;base64,...` URL and stored
// directly in `Media.url`. This keeps the CMS self-contained (no external
// blob storage / disk mount required) and consistent with AI-generated
// media, which already use the same data-URL scheme.
//
// Request (multipart/form-data):
//   - file          File      (required) — the binary file
//   - folderId      string    (optional) — target folder cuid, '' or 'root' = root
//   - uploadedById  string    (required) — uploading user's cuid
//
// Response (201): { data: MediaRow, meta: { requestId } }
// Errors: 400 (no file / empty / no uploader), 413 (too large), 415 (unsupported type), 500

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

function reqId() {
  return 'req_' + nanoid(8);
}

const mediaIncludes = {
  folder: { select: { id: true, name: true, parentId: true } },
  uploadedBy: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

// 10 MB cap — keeps the base64-encoded data URL stored in SQLite bounded.
const MAX_SIZE = 10 * 1024 * 1024;

// Extensions we never accept regardless of declared MIME type.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.dll',
  '.so', '.dylib', '.app', '.sh', '.ps1', '.jar', '.class',
]);

function fileExtension(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

function isAllowedMime(mime: string): boolean {
  const m = mime.toLowerCase();
  if (!m) return false;
  return (
    m.startsWith('image/') ||
    m.startsWith('video/') ||
    m.startsWith('audio/') ||
    m.startsWith('text/') ||
    m.startsWith('font/') ||
    m === 'application/pdf' ||
    m === 'application/msword' ||
    m === 'application/rtf' ||
    m === 'application/csv' ||
    m === 'application/json' ||
    m === 'application/xml' ||
    m.startsWith('application/vnd.openxmlformats-officedocument') ||
    m.startsWith('application/vnd.ms-') ||
    m.startsWith('application/vnd.oasis.opendocument') ||
    m === 'application/zip' ||
    m === 'application/x-zip-compressed' ||
    m === 'application/gzip' ||
    m === 'application/x-gzip' ||
    m === 'application/x-tar' ||
    m === 'application/x-7z-compressed' ||
    m === 'application/x-rar-compressed'
  );
}

// =====================================================================
// POST — upload
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_FORM', message: 'Request must be multipart/form-data' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const file = formData.get('file');
    const folderIdRaw = formData.get('folderId');
    const uploadedByIdRaw = formData.get('uploadedById');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const uploadedById =
      typeof uploadedByIdRaw === 'string' ? uploadedByIdRaw.trim() : '';
    if (!uploadedById) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Uploader ID is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const ext = fileExtension(file.name);
    if (ext && BLOCKED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED_TYPE', message: 'This file type is not allowed' }, meta: { requestId: id } },
        { status: 415 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File is empty' }, meta: { requestId: id } },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File exceeds the 10MB limit (got ${Math.max(1, Math.round(file.size / 1024 / 1024))}MB)`,
          },
          meta: { requestId: id },
        },
        { status: 413 },
      );
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!isAllowedMime(mimeType)) {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED_TYPE', message: `File type "${mimeType}" is not supported` }, meta: { requestId: id } },
        { status: 415 },
      );
    }

    // Encode bytes as a base64 data URL — matches /api/media/generate's
    // storage pattern so the rest of the stack (media list, detail, SEO)
    // can render the asset without any blob/file-storage backend.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    const base64 = buffer.toString('base64');
    const url = `data:${mimeType};base64,${base64}`;

    // Derive a filesystem-safe filename (strip path separators / odd chars)
    // and ensure it has an extension so downstream rendering is happy.
    const rawBase = file.name.replace(/[\\/]+/g, '_');
    const safeBase = (rawBase.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 200) || `upload_${nanoid(8)}`);
    const finalFilename =
      safeBase.includes('.') ? safeBase : `${safeBase}${ext || `.${nanoid(6)}`}`;

    // Normalize folderId: missing / '' / 'root' all mean "no folder".
    const folderId =
      typeof folderIdRaw === 'string' && folderIdRaw !== '' && folderIdRaw !== 'root'
        ? folderIdRaw
        : null;

    const siteFilter = await getSiteWhere(request);
    const siteId =
      (siteFilter.siteId as string | undefined) ||
      request.nextUrl.searchParams.get('siteId') ||
      undefined;

    const item = await db.media.create({
      data: {
        filename: finalFilename,
        originalName: file.name,
        mimeType,
        size: file.size,
        width: null,
        height: null,
        url,
        thumbnailUrl: null,
        alt: null,
        caption: null,
        metadata: null,
        blurhash: null,
        folderId,
        siteId: siteId || undefined,
        uploadedById,
        processingStatus: 'READY',
      },
      include: mediaIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[MEDIA:UPLOAD] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to upload file' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
