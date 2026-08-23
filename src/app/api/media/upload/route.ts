// ============================================================
// POST /api/media/upload — Multipart/form-data file upload
// ============================================================
//
// Frontend contract (matches src/modules/media/media-list-page.tsx and
// src/modules/content/content-{create,edit}-page.tsx):
//   Content-Type: multipart/form-data  (set automatically by fetch when body = FormData)
//   Fields:
//     file          File (single) — REQUIRED
//     folderId      string        — OPTIONAL (target folder, empty = root)
//     uploadedById  string        — OPTIONAL but recommended
//
// Query params (auto-injected by the api-client):
//     siteId        string        — OPTIONAL (current site DB id)
//
// Response (201): standard ApiResponse envelope, data = single Media item
// Response (4xx/5xx): standard ApiResponse error envelope
//
// Storage strategy:
//   Files are stored as base64 data URLs in the `Media.url` column —
//   identical to the pattern used by /api/media/generate (AI image
//   generation). This avoids filesystem permission/symlink issues in
//   the sandbox and matches the existing read path used by the media
//   grid (which renders `<img src={item.thumbnailUrl || item.url} />`).
//
//   For raster images (jpg/png/webp/gif) a compressed thumbnail is
//   generated via `sharp` and stored in `Media.thumbnailUrl` to keep
//   grid rendering fast. Width/height are populated from sharp
//   metadata.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const mediaIncludes = {
  folder: { select: { id: true, name: true, parentId: true } },
  uploadedBy: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

// ---------- validation ------------------------------------------------

// 25 MB hard limit per file — generous enough for photos/PDFs, strict
// enough to prevent abuse. Matches the kind of default used by WP.
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Allowed MIME prefixes and explicit mime types. We accept the
// "normal media formats" the user listed plus a few common extras.
const ALLOWED_MIME_PATTERNS: { kind: 'prefix' | 'exact'; value: string }[] = [
  { kind: 'prefix', value: 'image/' },
  { kind: 'prefix', value: 'video/' },
  { kind: 'prefix', value: 'audio/' },
  { kind: 'exact', value: 'application/pdf' },
  { kind: 'exact', value: 'application/msword' },
  { kind: 'exact', value: 'application/vnd.ms-excel' },
  { kind: 'exact', value: 'application/vnd.ms-powerpoint' },
  { kind: 'prefix', value: 'application/vnd.openxmlformats-officedocument' },
  { kind: 'prefix', value: 'application/vnd.oasis.opendocument' },
  { kind: 'exact', value: 'text/plain' },
  { kind: 'exact', value: 'text/csv' },
  { kind: 'exact', value: 'text/markdown' },
  { kind: 'exact', value: 'application/rtf' },
  { kind: 'exact', value: 'application/json' },
  { kind: 'exact', value: 'application/zip' },
];

function isAllowedMime(mime: string): boolean {
  if (!mime) return false;
  const lower = mime.toLowerCase();
  return ALLOWED_MIME_PATTERNS.some((p) =>
    p.kind === 'prefix' ? lower.startsWith(p.value) : lower === p.value,
  );
}

// Map a mime type to a safe file extension. Falls back to 'bin'.
function extForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/avif': 'avif',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.oasis.opendocument.text': 'odt',
    'application/vnd.oasis.opendocument.spreadsheet': 'ods',
    'application/vnd.oasis.opendocument.presentation': 'odp',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/markdown': 'md',
    'application/rtf': 'rtf',
    'application/json': 'json',
    'application/zip': 'zip',
  };
  return map[mime.toLowerCase()] ?? 'bin';
}

function isImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('image/');
}

function isSvgMime(mime: string): boolean {
  return mime.toLowerCase() === 'image/svg+xml';
}

// Strip any path components from a filename and trim to a safe length.
function sanitizeOriginalName(name: string): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  return base.slice(0, 490);
}

// ---------- main handler ---------------------------------------------

export async function POST(request: NextRequest) {
  const id = reqId();

  // 1. Parse multipart form
  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    console.error(`[MEDIA:UPLOAD] ${id} — formData parse failed:`, err);
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_FORM_DATA',
          message: 'Request body must be multipart/form-data with a file field.',
        },
        meta: { requestId: id },
      },
      { status: 400 },
    );
  }

  // 2. Extract the file. Accept both `file` (singular, used by all
  //    current callers) and `files` / `files[]` (plural conventions)
  //    for forward compatibility — but each request handles ONE file.
  const file = (form.get('file') ?? form.get('files') ?? form.get('files[]')) as
    | File
    | null;

  if (!file || typeof file === 'string' || !(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file provided. Send a File object under the "file" form field.',
        },
        meta: { requestId: id },
      },
      { status: 400 },
    );
  }

  // 3. Extract optional metadata fields
  const folderIdRaw = (form.get('folderId') as string | null) ?? '';
  const uploadedById = (form.get('uploadedById') as string | null) || '';
  const altText = (form.get('alt') as string | null) || '';

  // 4. Validate MIME type
  if (!isAllowedMime(file.type)) {
    return NextResponse.json(
      {
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `File type "${file.type || 'unknown'}" is not supported. Allowed: images, videos, audio, PDF, docs, text, archives.`,
        },
        meta: { requestId: id },
      },
      { status: 415 },
    );
  }

  // 5. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max allowed size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        },
        meta: { requestId: id },
      },
      { status: 413 },
    );
  }

  // 6. Read file bytes
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(await file.arrayBuffer());
  } catch (err) {
    console.error(`[MEDIA:UPLOAD] ${id} — arrayBuffer read failed:`, err);
    return NextResponse.json(
      {
        error: { code: 'READ_ERROR', message: 'Failed to read uploaded file bytes.' },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }

  // 7. Build URL + (optional) thumbnail + dimensions
  let url: string;
  let thumbnailUrl: string | null = null;
  let width: number | null = null;
  let height: number | null = null;

  const mime = file.type || 'application/octet-stream';
  const isImage = isImageMime(mime);
  const isSvg = isSvgMime(mime);

  if (isSvg) {
    // SVG: store as text-based data URL (no sharp processing — sharp
    // can rasterize SVG but we want to preserve the vector source).
    const svgText = fileBuffer.toString('utf-8');
    url = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
  } else if (isImage) {
    // Raster image: get metadata + build a compressed thumbnail.
    try {
      const meta = await sharp(fileBuffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch (err) {
      // Don't fail the upload if metadata extraction fails — just
      // log and continue without dimensions.
      console.warn(`[MEDIA:UPLOAD] ${id} — sharp metadata failed:`, err);
    }

    // Generate a small WebP thumbnail (max 400px wide) for fast
    // grid rendering.
    try {
      const thumbBuf = await sharp(fileBuffer)
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
      thumbnailUrl = `data:image/webp;base64,${thumbBuf.toString('base64')}`;
    } catch (err) {
      console.warn(`[MEDIA:UPLOAD] ${id} — thumbnail generation failed:`, err);
    }

    // Store the original file as a base64 data URL.
    url = `data:${mime};base64,${fileBuffer.toString('base64')}`;
  } else {
    // Non-image (PDF/doc/video/audio/etc.) — store as base64 data URL.
    url = `data:${mime};base64,${fileBuffer.toString('base64')}`;
  }

  // 8. Generate a unique stored filename. Use nanoid for collision
  //    resistance + keep the original extension for readability.
  const ext = extForMime(mime);
  const filename = `upload_${nanoid(10)}_${Date.now()}.${ext}`;
  const originalName = sanitizeOriginalName(file.name) || filename;

  // 9. Resolve siteId (for site-scoped storage) and folderId.
  const siteFilter = await getSiteWhere(request);
  const siteId = (siteFilter.siteId as string) || undefined;

  const folderIdValue: string | null =
    !folderIdRaw || folderIdRaw === '' || folderIdRaw === 'root' ? null : folderIdRaw;

  // 10. uploadedById: form field > fallback to "system" (matches
  //     the convention in /api/media/generate).
  const uploaderId = uploadedById || 'system';

  // 11. Persist the media record.
  try {
    const item = await db.media.create({
      data: {
        filename,
        originalName,
        mimeType: mime,
        size: file.size,
        width: width ?? undefined,
        height: height ?? undefined,
        url,
        thumbnailUrl,
        folderId: folderIdValue,
        siteId,
        uploadedById: uploaderId,
        alt: altText.trim() || null,
        processingStatus: 'READY',
        scanStatus: 'CLEAN',
      },
      include: mediaIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (err) {
    console.error(`[MEDIA:UPLOAD] ${id} — db.media.create failed:`, err);
    return NextResponse.json(
      {
        error: {
          code: 'DATABASE_ERROR',
          message: 'File was processed but the media record could not be saved.',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}
