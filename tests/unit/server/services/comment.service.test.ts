import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customerSku: { findFirst: vi.fn() },
    customerSkuComment: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customerAssignment: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
} from "@/server/services/comment.service";
import { Permission } from "@/server/authorization/permissions";

const mockDb = db as unknown as {
  customerSku: { findFirst: ReturnType<typeof vi.fn> };
  customerSkuComment: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  customerAssignment: { findUnique: ReturnType<typeof vi.fn> };
  notification: { create: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const baseSku = { id: "sku-1", customerId: "cust-1" };
const baseComment = {
  id: "comment-1",
  customerSkuId: "sku-1",
  authorId: "user-1",
  body: "Great margin on this SKU.",
  parentCommentId: null,
  isEdited: false,
  editedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  author: { id: "user-1", firstName: "Alice", lastName: "Smith" },
  replies: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.customerAssignment.findUnique.mockResolvedValue({ userId: "user-1", customerId: "cust-1" });
  mockDb.customerSku.findFirst.mockResolvedValue(baseSku);
  mockDb.customerSkuComment.findMany.mockResolvedValue([baseComment]);
  mockDb.customerSkuComment.findFirst.mockResolvedValue(baseComment);
  mockDb.customerSkuComment.findUnique.mockResolvedValue(null);
  mockDb.customerSkuComment.create.mockResolvedValue(baseComment);
  mockDb.customerSkuComment.update.mockResolvedValue({ ...baseComment, isEdited: true });
  mockDb.auditLog.create.mockResolvedValue({});
  mockDb.notification.create.mockResolvedValue({});
});

const globalPerms = [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS, Permission.ADD_COMMENTS, Permission.MANAGE_COMMENTS];

describe("listComments", () => {
  it("returns comments for an accessible SKU", async () => {
    const result = await listComments("sku-1", "cust-1", "user-1", globalPerms);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("comment-1");
  });

  it("throws 403 when user has no customer access", async () => {
    mockDb.customerAssignment.findUnique.mockResolvedValue(null);
    await expect(listComments("sku-1", "cust-1", "user-1", [Permission.VIEW_CUSTOMERS]))
      .rejects.toThrow("Access to this customer is denied");
  });

  it("throws 404 when SKU not found", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(null);
    await expect(listComments("sku-999", "cust-1", "user-1", globalPerms))
      .rejects.toThrow("CustomerSku not found");
  });
});

describe("createComment", () => {
  it("creates a top-level comment", async () => {
    const result = await createComment("sku-1", "cust-1", { body: "Great margin!" }, "user-1", globalPerms);
    expect(mockDb.customerSkuComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: "Great margin!", parentCommentId: null }),
      })
    );
    expect(result.id).toBe("comment-1");
  });

  it("throws 403 when user lacks add_comments permission", async () => {
    await expect(
      createComment("sku-1", "cust-1", { body: "test" }, "user-1", [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS])
    ).rejects.toThrow("Permission denied: add_comments required");
  });

  it("creates a reply and notifies parent author", async () => {
    mockDb.customerSkuComment.findUnique.mockResolvedValue({ ...baseComment, authorId: "user-2" });
    await createComment(
      "sku-1", "cust-1",
      { body: "Agreed!", parentCommentId: "comment-1" },
      "user-1",
      globalPerms
    );
    expect(mockDb.notification.create).toHaveBeenCalled();
  });

  it("does not notify when replier is the same user as parent author", async () => {
    mockDb.customerSkuComment.findUnique.mockResolvedValue({ ...baseComment, authorId: "user-1" });
    await createComment(
      "sku-1", "cust-1",
      { body: "Self reply", parentCommentId: "comment-1" },
      "user-1",
      globalPerms
    );
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });
});

describe("updateComment", () => {
  it("allows author to edit their own comment", async () => {
    const result = await updateComment("comment-1", "sku-1", "cust-1", { body: "Updated" }, "user-1", globalPerms);
    expect(mockDb.customerSkuComment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: "Updated", isEdited: true }),
      })
    );
    expect(result.isEdited).toBe(true);
  });

  it("throws 403 when non-author without manage_comments tries to edit", async () => {
    await expect(
      updateComment("comment-1", "sku-1", "cust-1", { body: "Hack" }, "user-99", [
        Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS, Permission.ADD_COMMENTS,
      ])
    ).rejects.toThrow("You can only edit your own comments");
  });

  it("allows manage_comments user to edit any comment", async () => {
    await updateComment("comment-1", "sku-1", "cust-1", { body: "Moderated" }, "mod-1", [
      Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS, Permission.MANAGE_COMMENTS,
    ]);
    expect(mockDb.customerSkuComment.update).toHaveBeenCalled();
  });
});

describe("deleteComment", () => {
  it("soft-deletes a comment by the author", async () => {
    await deleteComment("comment-1", "sku-1", "cust-1", "user-1", globalPerms);
    expect(mockDb.customerSkuComment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it("throws 403 when non-author without manage_comments tries to delete", async () => {
    await expect(
      deleteComment("comment-1", "sku-1", "cust-1", "user-99", [
        Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS,
      ])
    ).rejects.toThrow("You can only delete your own comments");
  });
});
