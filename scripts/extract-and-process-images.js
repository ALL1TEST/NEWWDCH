const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const item = await prisma.contentItem.findUnique({
    where: { id: 'cmuc02x0r004rk9tgstnztju9' },
    select: { id: true, title: true, content: true, siteId: true, authorId: true }
  });

  if (!item || !item.content) {
    console.error('Item or content not found');
    return;
  }

  // Find all base64 images in content
  const regex = /<img[^>]+src=["'](data:(image\/[^;]+);base64,([^"']+))["'][^>]*>/gi;
  const matches = [...item.content.matchAll(regex)];

  console.log(`Found ${matches.length} base64 images`);

  const cmsUploadDir = path.join(process.cwd(), 'public', 'uploads');
  const verdantImagesDir = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/public/images';

  if (!fs.existsSync(cmsUploadDir)) fs.mkdirSync(cmsUploadDir, { recursive: true });
  if (!fs.existsSync(verdantImagesDir)) fs.mkdirSync(verdantImagesDir, { recursive: true });

  const imageFilenames = [
    'dark-to-dramatic-hero.png',
    'dark-to-dramatic-step-instructions.png',
    'dark-to-dramatic-lifestyle.png',
    'dark-to-dramatic-mistakes.png'
  ];

  const publicUrls = [];
  const createdMediaIds = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const fullTag = match[0];
    const base64Data = match[3];
    const mimeType = match[2];
    const filename = imageFilenames[i] || `dark-to-dramatic-img-${i + 1}.png`;

    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`Image ${i + 1}: buffer size ${buffer.length} bytes -> ${filename}`);

    // Save to CMS public/uploads
    const cmsFilePath = path.join(cmsUploadDir, filename);
    fs.writeFileSync(cmsFilePath, buffer);

    // Save to Verdant public/images
    const verdantFilePath = path.join(verdantImagesDir, filename);
    fs.writeFileSync(verdantFilePath, buffer);

    // Extract alt text if present
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';

    // Create or update media record in CMS
    let media = await prisma.media.findFirst({
      where: { filename }
    });

    const fileUrl = `https://verdantt.vercel.app/images/${filename}`;
    publicUrls.push(fileUrl);

    if (!media) {
      media = await prisma.media.create({
        data: {
          filename,
          originalName: filename,
          mimeType,
          size: buffer.length,
          alt,
          url: fileUrl,
          thumbnailUrl: fileUrl,
          siteId: item.siteId,
          uploadedById: item.authorId,
          processingStatus: 'READY',
          scanStatus: 'CLEAN'
        }
      });
      console.log(`Created CMS Media record: ${media.id}`);
    } else {
      media = await prisma.media.update({
        where: { id: media.id },
        data: {
          url: fileUrl,
          thumbnailUrl: fileUrl,
          size: buffer.length,
          alt
        }
      });
      console.log(`Updated CMS Media record: ${media.id}`);
    }

    createdMediaIds.push(media.id);
  }

  // Update item featuredImageId to hero media
  if (createdMediaIds.length > 0) {
    await prisma.contentItem.update({
      where: { id: item.id },
      data: {
        featuredImageId: createdMediaIds[0]
      }
    });
    console.log(`Updated contentItem.featuredImageId to ${createdMediaIds[0]}`);
  }

  // Now replace base64 images in content with public URLs
  let updatedContent = item.content;
  for (let i = 0; i < matches.length; i++) {
    const dataUri = matches[i][1];
    const newUrl = publicUrls[i];
    updatedContent = updatedContent.replace(dataUri, newUrl);
  }

  console.log('Original content length:', item.content.length);
  console.log('Updated content length with public URLs:', updatedContent.length);

  // Update CMS DB content
  await prisma.contentItem.update({
    where: { id: item.id },
    data: { content: updatedContent }
  });

  console.log('CMS contentItem content updated with clean public image URLs!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
