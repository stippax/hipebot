const path = require("node:path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");

const R2_BUCKET = process.env.R2_BUCKET || "lineuplabs";
const WEBP_QUALITY = 85;

let cachedClient;

function getRequiredEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function getR2Configuration() {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = getRequiredEnv("R2_BUCKET") || R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`
  };
}

function createR2Client() {
  const config = getR2Configuration();

  if (!config) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

function getR2Client() {
  if (!cachedClient) {
    cachedClient = createR2Client();
  }

  return cachedClient;
}

function sanitizePathPart(value, fallback) {
  const normalized = String(value || fallback || "file")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return normalized || fallback;
}

function buildObjectKey({ guildId, ticketId, messageId, attachmentId, fileName }) {
  const extension = path.extname(fileName || "");
  const baseName = path.basename(fileName || "arquivo", extension);
  const safeName = sanitizePathPart(baseName, "arquivo");
  const safeExtension = extension.replace(/[^\w.]/g, "").slice(0, 20) || ".webp";

  return [
    "transcripts",
    sanitizePathPart(guildId, "guild"),
    sanitizePathPart(ticketId, "ticket"),
    sanitizePathPart(messageId, "message"),
    `${sanitizePathPart(attachmentId, "attachment")}-${safeName}${safeExtension}`
  ].join("/");
}

function isImageAttachment(attachment) {
  return typeof attachment?.contentType === "string" && attachment.contentType.startsWith("image/");
}

async function optimizeImageBuffer(buffer) {
  try {
    return await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({
        quality: WEBP_QUALITY
      })
      .toBuffer();
  } catch {
    return null;
  }
}

async function uploadAttachmentToR2({ guildId, ticketId, messageId, attachment }) {
  const config = getR2Configuration();
  const client = getR2Client();

  if (!config || !client) {
    return null;
  }

  if (!isImageAttachment(attachment)) {
    return null;
  }

  const response = await fetch(attachment.url);

  if (!response.ok) {
    throw new Error(`Falha ao baixar anexo ${attachment.id}: HTTP ${response.status}.`);
  }

  const originalBody = Buffer.from(await response.arrayBuffer());
  const body = await optimizeImageBuffer(originalBody);

  if (!body) {
    return null;
  }
  const originalExtension = path.extname(attachment.name || "");
  const optimizedName = `${path.basename(attachment.name || "imagem", originalExtension) || "imagem"}.webp`;
  const key = buildObjectKey({
    guildId,
    ticketId,
    messageId,
    attachmentId: attachment.id,
    fileName: optimizedName
  });

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: "image/webp",
    ContentDisposition: `inline; filename="${encodeURIComponent(optimizedName)}"`,
    Metadata: {
      originalname: attachment.name || "arquivo",
      optimizedname: optimizedName,
      source: "discord-ticket-transcript"
    }
  }));

  return {
    provider: "r2",
    bucket: config.bucket,
    key,
    contentType: "image/webp",
    originalName: attachment.name || "arquivo",
    fileName: optimizedName
  };
}

module.exports = {
  getR2Configuration,
  uploadAttachmentToR2
};
