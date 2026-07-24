import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { Permission } from "@/server/authorization/permissions";
import { logAction } from "./audit-log.service";
import type { CreateCommentInput, UpdateCommentInput } from "@/server/validation/comment.schema";

async function getSkuAndCheckAccess(
  customerSkuId: string,
  customerId: string,
  userId: string,
  permissions: string[]
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, permissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const sku = await db.customerSku.findFirst({
    where: { id: customerSkuId, customerId, deletedAt: null },
  });
  if (!sku) throw new NotFoundError("CustomerSku");
  return sku;
}

export async function listComments(
  customerSkuId: string,
  customerId: string,
  userId: string,
  permissions: string[]
) {
  await getSkuAndCheckAccess(customerSkuId, customerId, userId, permissions);

  const comments = await db.customerSkuComment.findMany({
    where: { customerSkuId, deletedAt: null, parentCommentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  return comments;
}

export async function createComment(
  customerSkuId: string,
  customerId: string,
  input: CreateCommentInput,
  userId: string,
  permissions: string[]
) {
  if (!permissions.includes(Permission.ADD_COMMENTS)) {
    throw new ForbiddenError("Permission denied: add_comments required");
  }
  await getSkuAndCheckAccess(customerSkuId, customerId, userId, permissions);

  if (input.parentCommentId) {
    const parent = await db.customerSkuComment.findFirst({
      where: { id: input.parentCommentId, customerSkuId, deletedAt: null },
    });
    if (!parent) throw new NotFoundError("Parent comment");
  }

  const comment = await db.customerSkuComment.create({
    data: {
      customerSkuId,
      authorId: userId,
      body: input.body,
      parentCommentId: input.parentCommentId ?? null,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await logAction({
    userId,
    action: "comment.create",
    entityType: "CustomerSkuComment",
    entityId: comment.id,
    afterValue: { customerSkuId, parentCommentId: input.parentCommentId ?? null },
  });

  // Notify parent comment author if this is a reply
  if (input.parentCommentId) {
    const parent = await db.customerSkuComment.findUnique({
      where: { id: input.parentCommentId },
    });
    if (parent && parent.authorId !== userId) {
      await db.notification.create({
        data: {
          userId: parent.authorId,
          type: "COMMENT_REPLY",
          title: "New reply to your comment",
          body: input.body.slice(0, 200),
          entityType: "CustomerSkuComment",
          entityId: comment.id,
        },
      });
    }
  }

  return comment;
}

export async function updateComment(
  commentId: string,
  customerSkuId: string,
  customerId: string,
  input: UpdateCommentInput,
  userId: string,
  permissions: string[]
) {
  await getSkuAndCheckAccess(customerSkuId, customerId, userId, permissions);

  const existing = await db.customerSkuComment.findFirst({
    where: { id: commentId, customerSkuId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Comment");

  const canManage = permissions.includes(Permission.MANAGE_COMMENTS);
  if (existing.authorId !== userId && !canManage) {
    throw new ForbiddenError("You can only edit your own comments");
  }

  const updated = await db.customerSkuComment.update({
    where: { id: commentId },
    data: { body: input.body, isEdited: true, editedAt: new Date() },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await logAction({
    userId,
    action: "comment.update",
    entityType: "CustomerSkuComment",
    entityId: commentId,
    beforeValue: { body: existing.body },
    afterValue: { body: input.body },
  });

  return updated;
}

export async function deleteComment(
  commentId: string,
  customerSkuId: string,
  customerId: string,
  userId: string,
  permissions: string[]
) {
  await getSkuAndCheckAccess(customerSkuId, customerId, userId, permissions);

  const existing = await db.customerSkuComment.findFirst({
    where: { id: commentId, customerSkuId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Comment");

  const canManage = permissions.includes(Permission.MANAGE_COMMENTS);
  if (existing.authorId !== userId && !canManage) {
    throw new ForbiddenError("You can only delete your own comments");
  }

  await db.customerSkuComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  await logAction({
    userId,
    action: "comment.delete",
    entityType: "CustomerSkuComment",
    entityId: commentId,
  });
}
