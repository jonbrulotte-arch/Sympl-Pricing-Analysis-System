import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    productCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
} from "@/server/services/product-category.service";
import { NotFoundError, ConflictError } from "@/lib/errors";

const mockDb = db as unknown as {
  productCategory: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const ACTOR = "actor-1";

beforeEach(() => vi.clearAllMocks());

describe("listCategories", () => {
  it("returns top-level categories with nested children", async () => {
    const cats = [{ id: "cat1", name: "Widgets", children: [] }];
    mockDb.productCategory.findMany.mockResolvedValue(cats);

    const result = await listCategories();
    expect(result).toBe(cats);
    expect(mockDb.productCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId: null } })
    );
  });
});

describe("getCategoryById", () => {
  it("returns category with children and parent", async () => {
    const cat = { id: "cat1", name: "Widgets", children: [], parent: null };
    mockDb.productCategory.findUnique.mockResolvedValue(cat);

    const result = await getCategoryById("cat1");
    expect(result).toBe(cat);
  });

  it("throws NotFoundError when category not found", async () => {
    mockDb.productCategory.findUnique.mockResolvedValue(null);
    await expect(getCategoryById("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("createCategory", () => {
  it("creates category and logs the action", async () => {
    mockDb.productCategory.findFirst.mockResolvedValue(null);
    const created = { id: "cat-new", name: "Gadgets", dunnagePercent: 0 };
    mockDb.productCategory.create.mockResolvedValue(created);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await createCategory({ name: "Gadgets", dunnagePercent: 0 }, ACTOR);
    expect(result).toBe(created);
    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });

  it("throws ConflictError when name already exists under the same parent", async () => {
    mockDb.productCategory.findFirst.mockResolvedValue({ id: "existing" });

    await expect(createCategory({ name: "Widgets", dunnagePercent: 0 }, ACTOR)).rejects.toThrow(ConflictError);
  });

  it("creates with custom dunnagePercent", async () => {
    mockDb.productCategory.findFirst.mockResolvedValue(null);
    mockDb.productCategory.create.mockResolvedValue({ id: "cat-new" });
    mockDb.auditLog.create.mockResolvedValue({});

    await createCategory({ name: "Heavy", dunnagePercent: 15 }, ACTOR);

    expect(mockDb.productCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dunnagePercent: 15 }),
      })
    );
  });
});

describe("updateCategory", () => {
  it("updates category and logs the action", async () => {
    const existing = { id: "cat1", name: "Old", children: [], parent: null };
    mockDb.productCategory.findUnique.mockResolvedValue(existing);
    mockDb.productCategory.update.mockResolvedValue({ id: "cat1", name: "New" });
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await updateCategory("cat1", { name: "New" }, ACTOR);
    expect(result.name).toBe("New");
  });

  it("throws NotFoundError when category not found", async () => {
    mockDb.productCategory.findUnique.mockResolvedValue(null);
    await expect(updateCategory("missing", { name: "X" }, ACTOR)).rejects.toThrow(NotFoundError);
  });
});
