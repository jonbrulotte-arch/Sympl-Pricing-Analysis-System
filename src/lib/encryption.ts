import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ValidationError } from "./errors";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex) {
    throw new ValidationError("APP_ENCRYPTION_KEY environment variable is not set");
  }
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new ValidationError(
      "APP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): {
  encryptedValue: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");
  return {
    encryptedValue: encrypted,
    iv: iv.toString("base64"),
    authTag,
  };
}

export function decrypt(
  encryptedValue: string,
  iv: string,
  authTag: string
): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  let decrypted = decipher.update(encryptedValue, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function encryptToCompound(plaintext: string): string {
  const { iv, authTag, encryptedValue } = encrypt(plaintext);
  return `${iv}:${authTag}:${encryptedValue}`;
}

export function decryptFromCompound(compound: string): string {
  const parts = compound.split(":");
  if (parts.length !== 3) {
    throw new ValidationError("Invalid encrypted value format");
  }
  const [iv, authTag, encryptedValue] = parts;
  return decrypt(encryptedValue, iv, authTag);
}
