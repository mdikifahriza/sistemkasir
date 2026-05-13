import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function uploadToR2(file: Buffer, fileName: string, contentType: string) {
  const bucketName = (process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || '').replace(/^"|"$/g, '');
  
  if (!bucketName) {
    throw new Error('R2 Bucket name is not configured (CLOUDFLARE_R2_BUCKET_NAME or S3_BUCKET_NAME)');
  }

  console.log('Uploading to R2 - Bucket:', bucketName, 'File:', fileName);

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: file,
      ContentType: contentType,
    });

    await r2Client.send(command);
  } catch (error) {
    console.error('R2 Upload Command Error:', error);
    throw error;
  }
  
  // Use internal API path for private images
  const publicUrl = `/api/upload?path=${fileName}`;
  
  return {
    fileName,
    publicUrl,
  };
}

export async function getFromR2(fileName: string) {
  const bucketName = (process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || '').replace(/^"|"$/g, '');
  
  if (!bucketName) {
    throw new Error('R2 Bucket name is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileName,
  });

  const response = await r2Client.send(command);
  return response;
}

export async function deleteFromR2(fileName: string) {
  const bucketName = (process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || '').replace(/^"|"$/g, '');
  
  if (!bucketName) {
    throw new Error('R2 Bucket name is not configured');
  }

  // Extract key if a full proxy URL is passed
  let key = fileName;
  if (fileName.includes('/api/upload?path=')) {
    key = fileName.split('/api/upload?path=')[1];
  } else if (fileName.includes('.r2.dev/')) {
    key = fileName.split('.r2.dev/')[1];
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await r2Client.send(command);
}
