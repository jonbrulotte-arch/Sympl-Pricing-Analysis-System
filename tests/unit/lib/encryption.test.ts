import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VALID_KEY = "a".repeat(64);

beforeEach(() => {
  vi.stubEnv("APP_ENCRYPTION_KEY", VALID_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encryption", () => {
  it("round-trips encrypt/decrypt", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption");
    const plaintext = "my-secret-api-key";
    const { encryptedValue, iv, authTag } = encrypt(plaintext);

    expect(encryptedValue).not.toBe(plaintext);
    const decrypted = decrypt(encryptedValue, iv, authTag);
    expect(decrypted).toBe(plaintext);
  });

  it("round-trips empty string", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption");
    const { encryptedValue, iv, authTag } = encrypt("");
    expect(decrypt(encryptedValue, iv, authTag)).toBe("");
  });

  it("round-trips long string", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption");
    const long = "x".repeat(10000);
    const { encryptedValue, iv, authTag } = encrypt(long);
    expect(decrypt(encryptedValue, iv, authTag)).toBe(long);
  });

  it("compound format round-trips", async () => {
    const { encryptToCompound, decryptFromCompound } = await import("@/lib/encryption");
    const plaintext = "ups-client-secret-value";
    const compound = encryptToCompound(plaintext);

    expect(compound.split(":")).toHaveLength(3);
    expect(decryptFromCompound(compound)).toBe(plaintext);
  });

  it("throws on missing APP_ENCRYPTION_KEY", async () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    const { encrypt } = await import("@/lib/encryption");
    expect(() => encrypt("test")).toThrow("APP_ENCRYPTION_KEY");
  });

  it("throws on invalid key length", async () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "abcd1234");
    const { encrypt } = await import("@/lib/encryption");
    expect(() => encrypt("test")).toThrow("64-character hex string");
  });

  it("throws on invalid compound format", async () => {
    const { decryptFromCompound } = await import("@/lib/encryption");
    expect(() => decryptFromCompound("invalid")).toThrow("Invalid encrypted value format");
  });
});
