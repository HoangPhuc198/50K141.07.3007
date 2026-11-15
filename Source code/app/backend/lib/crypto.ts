import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("ENCRYPTION_KEY phải là 64 ký tự hex (32 byte).");
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Mã hóa chuỗi văn bản thuần bằng AES-256-GCM.
 * Trả về định dạng: iv:tag:ciphertext (tất cả dạng base64)
 */
export function encrypt(plainText: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

/**
 * Giải mã chuỗi đã mã hóa định dạng iv:tag:ciphertext (base64).
 */
export function decrypt(cipherCombined: string): string {
  const parts = cipherCombined.split(":");
  if (parts.length !== 3) {
    throw new Error("Dữ liệu mã hóa không đúng định dạng iv:tag:ciphertext");
  }

  const [ivB64, tagB64, cipherB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(cipherB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
