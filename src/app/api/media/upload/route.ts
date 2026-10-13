import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

function reqId() {
  return 'req_' + nanoid(8);
}

const mediaIncludes = {
  folder: { select: { id: true, name: true, parentId: true } },
  uploadedBy: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    const singleFile = formData.get('file') as File | null;

    const filesToProcess = files.length > 0 ? files : (singleFile ? [singleFile] : []);

    if (filesToProcess.length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_FILE', message: 'No file uploaded' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const folderId = (formData.get('folderId') as string) || null;
    let uploadedById = (formData.get('uploadedById') as string) || null;
    const urlSiteId = request.nextUrl.searchParams.get('siteId');
    const formSiteId = formData.get('siteId') as string | null;
    const siteId = formSiteId || urlSiteId || undefined;
    const purpose = (formData.get('purpose') as string) || null;
    const isAvatar = purpose === 'avatar';

    // Resolve a valid user ID for foreign key integrity
    if (uploadedById) {
      const userExists = await db.user.findUnique({
        where: { id: uploadedById },
        select: { id: true },
      });
      if (!userExists) {
        const fallbackUser = await db.user.findFirst({ select: { id: true } });
        uploadedById = fallbackUser ? fallbackUser.id : null;
      }
    } else {
      const fallbackUser = await db.user.findFirst({ select: { id: true } });
      uploadedById = fallbackUser ? fallbackUser.id : null;
    }

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const createdItems = [];

    for (const file of filesToProcess) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = path.extname(file.name) || (file.type ? `.${file.type.split('/')[1] || 'png'}` : '.png');
      const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'upload';
      const uniqueFilename = `${baseName}_${nanoid(8)}${ext}`;
      const filePath = path.join(uploadDir, uniqueFilename);

      await writeFile(filePath, buffer);

      const publicUrl = `/uploads/${uniqueFilename}`;

      let mediaItem: any = null;
      try {
        // Avatars are account profile images, not editorial media library items
        if (uploadedById && !isAvatar) {
          mediaItem = await db.media.create({
            data: {
              filename: uniqueFilename,
              originalName: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: buffer.length,
              url: publicUrl,
              siteId: siteId || undefined,
              folderId: folderId === '' ? null : folderId,
              uploadedById: uploadedById,
              processingStatus: 'READY',
            },
            include: mediaIncludes,
          });
        }
      } catch (dbErr) {
        console.warn(`[MEDIA:UPLOAD] DB create warning:`, dbErr);
      }

      // If DB record creation succeeded, use it; otherwise provide compatible shape
      const itemToReturn = mediaItem || {
        id: nanoid(12),
        filename: uniqueFilename,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: buffer.length,
        url: publicUrl,
        siteId: siteId || null,
        folderId: folderId || null,
        uploadedById: uploadedById,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      createdItems.push(itemToReturn);
    }

    const data = createdItems.length === 1 ? createdItems[0] : createdItems;
    return NextResponse.json({ data, meta: { requestId: id } }, { status: 201 });
  } catch (error: any) {
    console.error(`[MEDIA:UPLOAD] ${id} error:`, error);
    return NextResponse.json(
      { error: { code: 'UPLOAD_FAILED', message: error?.message || 'Failed to upload image' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
