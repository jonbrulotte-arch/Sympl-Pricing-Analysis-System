import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export async function listNotifications(
  userId: string,
  params: { page?: number; pageSize?: number; unreadOnly?: boolean }
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where = {
    userId,
    ...(params.unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { data: notifications, total, page, pageSize, unreadCount };
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const notification = await db.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new NotFoundError("Notification");
  if (notification.userId !== userId) throw new ForbiddenError("Access denied");

  return db.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { count: result.count };
}
