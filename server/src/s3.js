// Thin helper around @aws-sdk/client-s3 for product-image uploads.
// Credentials come from the ECS task role (no static keys here).

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const path = require("path");

const region = process.env.AWS_REGION || "eu-west-1";
const bucket = process.env.S3_BUCKET;

const client = new S3Client({ region });

/**
 * Upload a single image file (from multer's memoryStorage) to S3.
 * Returns { key, url }. The URL is the standard virtual-hosted-style
 * https://<bucket>.s3.<region>.amazonaws.com/<key> public URL.
 */
async function uploadProductImage(file) {
  if (!bucket) throw new Error("S3_BUCKET env var is not set");
  if (!file) throw new Error("No file provided");
  if (!file.buffer || !file.buffer.length) throw new Error("Empty file");

  const ext = (path.extname(file.originalname || "") || ".jpg").toLowerCase();
  const key = `products/${crypto.randomUUID()}${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype || "image/jpeg",
    CacheControl: "public, max-age=31536000",
  }));

  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return { key, url };
}

module.exports = { uploadProductImage };
