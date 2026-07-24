import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/server/services/notification.service";

const mockDb = db as unknown as {
  notification: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const baseNotification = {
  id: "notif-1",
  userId: "user-1",
  type: "REVIEW_REQUESTED",
  title: "Review requested",
  body: null,
  entityType: "CustomerSku",
  entityId: "sku-1",
  isRead: false,
  readAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.notification.findMany.mockResolvedValue([baseNotification]);
  mockDb.notification.count.mockImplementation((args: { where?: { isRead?: boolean } }) => {
    if (args?.where?.isRead === false) return Promise.resolve(3);
    return Promise.resolve(1);
  });
  mockDb.notification.findUnique.mockResolvedValue(baseNotification);
  mockDb.notification.update.mockResolvedValue({ ...baseNotification, isRead: true });
  mockDb.notification.updateMany.mockResolvedValue({ count: 3 });
});

describe("listNotifications", () => {
  it("returns paginated notifications with unreadCount", async () => {
    const result = await listNotifications("user-1", { page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.unreadCount).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it("filters by unread when unreadOnly=true", async () => {
    await listNotifications("user-1", { page: 1, pageSize: 20, unreadOnly: true });
    expect(mockDb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isRead: false }),
      })
    );
  });
});

describe("markNotificationRead", () => {
  it("marks a notification as read", async () => {
    const result = await markNotificationRead("notif-1", "user-1");
    expect(mockDb.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notif-1" },
        data: expect.objectContaining({ isRead: true }),
      })
    );
    expect(result.isRead).toBe(true);
  });

  it("throws 404 when notification not found", async () => {
    mockDb.notification.findUnique.mockResolvedValue(null);
    await expect(markNotificationRead("bad-id", "user-1")).rejects.toThrow("Notification not found");
  });

  it("throws 403 when notification belongs to another user", async () => {
    mockDb.notification.findUnique.mockResolvedValue({ ...baseNotification, userId: "other-user" });
    await expect(markNotificationRead("notif-1", "user-1")).rejects.toThrow("Access denied");
  });
});

describe("markAllNotificationsRead", () => {
  it("bulk-marks all unread notifications as read", async () => {
    const result = await markAllNotificationsRead("user-1");
    expect(mockDb.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isRead: false },
        data: expect.objectContaining({ isRead: true }),
      })
    );
    expect(result.count).toBe(3);
  });
});
