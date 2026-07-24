import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    savedView: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  listSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
} from "@/server/services/saved-view.service";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

const mockDb = db as unknown as {
  savedView: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const UID = "u1";

beforeEach(() => vi.clearAllMocks());

describe("listSavedViews", () => {
  it("returns views for the user sorted default-first then by name", async () => {
    const views = [{ id: "v1", name: "Default", isDefault: true }];
    mockDb.savedView.findMany.mockResolvedValue(views);

    const result = await listSavedViews(UID);
    expect(result).toBe(views);
    expect(mockDb.savedView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: UID } })
    );
  });
});

describe("createSavedView", () => {
  it("creates a new saved view", async () => {
    const input = { name: "My View", isDefault: false, config: { columns: ["sku", "margin"] } };
    const created = { id: "v-new", userId: UID, ...input };
    mockDb.savedView.create.mockResolvedValue(created);

    const result = await createSavedView(UID, input);
    expect(result).toBe(created);
  });

  it("clears other defaults when creating a default view", async () => {
    const input = { name: "Default", isDefault: true, config: { columns: [] } };
    mockDb.savedView.updateMany.mockResolvedValue({ count: 1 });
    mockDb.savedView.create.mockResolvedValue({ id: "v-new" });

    await createSavedView(UID, input);

    expect(mockDb.savedView.updateMany).toHaveBeenCalledWith({
      where: { userId: UID, isDefault: true },
      data: { isDefault: false },
    });
  });

  it("does not clear defaults when isDefault is false", async () => {
    const input = { name: "Regular", isDefault: false, config: { columns: [] } };
    mockDb.savedView.create.mockResolvedValue({ id: "v-new" });

    await createSavedView(UID, input);

    expect(mockDb.savedView.updateMany).not.toHaveBeenCalled();
  });
});

describe("updateSavedView", () => {
  it("updates the view", async () => {
    mockDb.savedView.findUnique.mockResolvedValue({ id: "v1", userId: UID });
    mockDb.savedView.update.mockResolvedValue({ id: "v1", name: "Renamed" });

    const result = await updateSavedView("v1", UID, { name: "Renamed" });
    expect(result.name).toBe("Renamed");
  });

  it("clears other defaults when setting isDefault", async () => {
    mockDb.savedView.findUnique.mockResolvedValue({ id: "v1", userId: UID });
    mockDb.savedView.updateMany.mockResolvedValue({ count: 1 });
    mockDb.savedView.update.mockResolvedValue({ id: "v1" });

    await updateSavedView("v1", UID, { isDefault: true });

    expect(mockDb.savedView.updateMany).toHaveBeenCalledWith({
      where: { userId: UID, isDefault: true },
      data: { isDefault: false },
    });
  });

  it("throws NotFoundError when view does not exist", async () => {
    mockDb.savedView.findUnique.mockResolvedValue(null);

    await expect(updateSavedView("missing", UID, { name: "X" })).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError when view belongs to another user", async () => {
    mockDb.savedView.findUnique.mockResolvedValue({ id: "v1", userId: "other-user" });

    await expect(updateSavedView("v1", UID, { name: "X" })).rejects.toThrow(ForbiddenError);
  });
});

describe("deleteSavedView", () => {
  it("deletes the view", async () => {
    mockDb.savedView.findUnique.mockResolvedValue({ id: "v1", userId: UID });
    mockDb.savedView.delete.mockResolvedValue({});

    await deleteSavedView("v1", UID);
    expect(mockDb.savedView.delete).toHaveBeenCalledWith({ where: { id: "v1" } });
  });

  it("throws NotFoundError when view does not exist", async () => {
    mockDb.savedView.findUnique.mockResolvedValue(null);
    await expect(deleteSavedView("missing", UID)).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError when view belongs to another user", async () => {
    mockDb.savedView.findUnique.mockResolvedValue({ id: "v1", userId: "other" });
    await expect(deleteSavedView("v1", UID)).rejects.toThrow(ForbiddenError);
  });
});
