import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import { authenticate } from "../middleware/auth";
import { z } from "zod";

export default function notificationRouter(
  prisma: PrismaClient,
  io: Server
) {
  const router = Router();

  router.use(authenticate);

  // Get current user's notifications and unread count
  router.get("/", async (req, res) => {
    try {
      const userId = req.user!.userId;

      const notifications = await prisma.notification.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      });

      const unreadCount = await prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      res.json({
        notifications,
        unreadCount,
      });
    } catch (error) {
      console.error("Get notifications error:", error);

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to load notifications",
        },
      });
    }
  });

  // Mark one notification as read
  router.patch("/:id/read", async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid notification ID",
          },
        });
      }

      const result = await prisma.notification.updateMany({
        where: {
          id,
          userId: req.user!.userId,
        },
        data: {
          read: true,
        },
      });

      const unreadCount = await prisma.notification.count({
        where: {
          userId: req.user!.userId,
          read: false,
        },
      });

      io.to(`user:${req.user!.userId}`).emit(
        "notification:count",
        unreadCount
      );

      res.json({
        ok: result.count > 0,
        unreadCount,
      });
    } catch (error) {
      console.error("Mark notification read error:", error);

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update notification",
        },
      });
    }
  });

  // Mark all notifications as read
  router.post("/read-all", async (req, res) => {
    try {
      const userId = req.user!.userId;

      await prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      io.to(`user:${userId}`).emit("notification:count", 0);

      res.json({
        ok: true,
        unreadCount: 0,
      });
    } catch (error) {
      console.error("Mark all notifications read error:", error);

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update notifications",
        },
      });
    }
  });

  return router;
}