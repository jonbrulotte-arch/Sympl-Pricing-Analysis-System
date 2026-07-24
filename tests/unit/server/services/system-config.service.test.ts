import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/encryption", () => ({
  encryptToCompound: vi.fn((v: string) => `ENC:${v}`),
  decryptFromCompound: vi.fn((v: string) => v.replace("ENC:", "")),
}));

import { db } from "@/lib/db";
import {
  getConfigValue,
  setConfigValue,
  getConfigValues,
  listConfigKeys,
} from "@/server/services/system-config.service";

const mockDb = db as unknown as {
  systemConfig: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const UID = "u1";

beforeEach(() => vi.clearAllMocks());

describe("getConfigValue", () => {
  it("returns plain value for non-encrypted config", async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ key: "app.name", value: "PAS", isEncrypted: false });

    const result = await getConfigValue("app.name");
    expect(result).toBe("PAS");
  });

  it("returns decrypted value for encrypted config", async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ key: "api.key", value: "ENC:secret", isEncrypted: true });

    const result = await getConfigValue("api.key");
    expect(result).toBe("secret");
  });

  it("returns null when key does not exist", async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(null);

    const result = await getConfigValue("missing");
    expect(result).toBeNull();
  });
});

describe("setConfigValue", () => {
  it("upserts plain value and logs the action", async () => {
    mockDb.systemConfig.upsert.mockResolvedValue({});
    mockDb.auditLog.create.mockResolvedValue({});

    await setConfigValue("app.name", "PAS", false, UID, "App name");

    expect(mockDb.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "app.name" },
        create: expect.objectContaining({ value: "PAS", isEncrypted: false }),
        update: expect.objectContaining({ value: "PAS" }),
      })
    );
    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });

  it("encrypts the value when isEncrypted is true", async () => {
    mockDb.systemConfig.upsert.mockResolvedValue({});
    mockDb.auditLog.create.mockResolvedValue({});

    await setConfigValue("api.key", "secret", true, UID);

    expect(mockDb.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value: "ENC:secret", isEncrypted: true }),
      })
    );
  });
});

describe("getConfigValues", () => {
  it("returns values by prefix, decrypting as needed", async () => {
    mockDb.systemConfig.findMany.mockResolvedValue([
      { key: "margin.min", value: "15", isEncrypted: false },
      { key: "margin.secret", value: "ENC:data", isEncrypted: true },
    ]);

    const result = await getConfigValues("margin.");

    expect(result["margin.min"]).toBe("15");
    expect(result["margin.secret"]).toBe("data");
  });

  it("returns empty object when no keys match", async () => {
    mockDb.systemConfig.findMany.mockResolvedValue([]);

    const result = await getConfigValues("nonexistent.");
    expect(result).toEqual({});
  });
});

describe("listConfigKeys", () => {
  it("returns config keys ordered by name", async () => {
    const keys = [
      { key: "app.name", isEncrypted: false, description: "App name", updatedAt: new Date() },
    ];
    mockDb.systemConfig.findMany.mockResolvedValue(keys);

    const result = await listConfigKeys();
    expect(result).toBe(keys);
    expect(mockDb.systemConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { key: "asc" } })
    );
  });
});
