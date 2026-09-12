import { Router } from "express";
import { PrismaClient, Role, TaskStatus } from "@prisma/client";
import { Server } from "socket.io";
import { authenticate, authorize } from "../middleware/auth";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum([
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
    "OVERDUE",
  ]),
});

export default function taskRouter(prisma: PrismaClient, io: Server) {
  const router = Router();

  router.use(authenticate);

  // =========================================================
  // GET ALL TASKS
  // =========================================================
  router.get("/", async (req, res) => {
    try {
      const { status, priority, from, to, projectId } = req.query;

      const where: any = {};

      if (status) {
        where.status = String(status);
      }

      if (priority) {
        where.priority = String(priority);
      }

      if (from || to) {
        where.dueDate = {
          ...(from
            ? {
                gte: new Date(String(from)),
              }
            : {}),
          ...(to
            ? {
                lte: new Date(String(to)),
              }
            : {}),
        };
      }

      if (projectId) {
        where.projectId = String(projectId);
      }

      // =====================================================
      // DEVELOPER → ONLY ASSIGNED TASKS
      // =====================================================
      if (req.user!.role === Role.DEVELOPER) {
        where.developerId = req.user!.userId;
      }

      // =====================================================
      // PM → ONLY THEIR OWN PROJECTS
      // =====================================================
      if (req.user!.role === Role.PM) {
        where.project = {
          ownerId: req.user!.userId,
        };
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          project: true,
          developer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          {
            priority: "desc",
          },
          {
            dueDate: "asc",
          },
        ],
      });

      res.json({ tasks });
    } catch (error) {
      console.error("Get tasks error:", error);

      res.status(500).json({
        error: {
          code: "SERVER_ERROR",
          message: "Failed to fetch tasks",
        },
      });
    }
  });

  // =========================================================
  // CREATE TASK
  // =========================================================
  router.post(
    "/",
    authorize("ADMIN", "PM"),
    async (req, res) => {
      try {
        const body = z
          .object({
            title: z.string().min(2),
            description: z.string().optional(),
            projectId: z.string(),
            developerId: z.string(),
            priority: z.enum([
              "LOW",
              "MEDIUM",
              "HIGH",
              "CRITICAL",
            ]),
            dueDate: z.coerce.date(),
          })
          .safeParse(req.body);

        if (!body.success) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid task data",
            },
          });
        }

        const project = await prisma.project.findUnique({
          where: {
            id: body.data.projectId,
          },
        });

        if (!project) {
          return res.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: "Project not found",
            },
          });
        }

        // =====================================================
        // PM → ONLY THEIR OWN PROJECT
        // =====================================================
        if (
          req.user!.role === Role.PM &&
          project.ownerId !== req.user!.userId
        ) {
          return res.status(403).json({
            error: {
              code: "FORBIDDEN",
              message:
                "Cannot manage another PM's project",
            },
          });
        }

        const task = await prisma.task.create({
          data: body.data,
        });

        // =====================================================
        // CREATE DEVELOPER NOTIFICATION
        // =====================================================
        const notification =
          await prisma.notification.create({
            data: {
              userId: task.developerId,
              message: `You were assigned task "${task.title}".`,
            },
          });

        // Send new notification in realtime
        io.to(`user:${task.developerId}`).emit(
          "notification:new",
          notification
        );

        // =====================================================
        // SEND UPDATED UNREAD COUNT
        // =====================================================
        const unreadCount =
          await prisma.notification.count({
            where: {
              userId: task.developerId,
              read: false,
            },
          });

        io.to(`user:${task.developerId}`).emit(
          "notification:count",
          unreadCount
        );

        res.status(201).json({ task });
      } catch (error) {
        console.error("Create task error:", error);

        res.status(500).json({
          error: {
            code: "SERVER_ERROR",
            message: "Failed to create task",
          },
        });
      }
    }
  );

  // =========================================================
  // UPDATE TASK STATUS
  // =========================================================
  router.patch(
    "/:id/status",
    authorize("ADMIN", "PM", "DEVELOPER"),
    async (req, res) => {
      try {
        const parsed = updateSchema.safeParse(req.body);

        if (!parsed.success) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid status",
            },
          });
        }

        const taskId = Number(req.params.id);

        if (!Number.isInteger(taskId)) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid task ID",
            },
          });
        }

        const task = await prisma.task.findUnique({
          where: {
            id: taskId,
          },
          include: {
            project: true,
          },
        });

        if (!task) {
          return res.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: "Task not found",
            },
          });
        }

        // =====================================================
        // DEVELOPER OWNERSHIP CHECK
        // =====================================================
        if (
          req.user!.role === Role.DEVELOPER &&
          task.developerId !== req.user!.userId
        ) {
          return res.status(403).json({
            error: {
              code: "FORBIDDEN",
              message:
                "You can only update your assigned tasks",
            },
          });
        }

        // =====================================================
        // PM OWNERSHIP CHECK
        // =====================================================
        if (
          req.user!.role === Role.PM &&
          task.project.ownerId !== req.user!.userId
        ) {
          return res.status(403).json({
            error: {
              code: "FORBIDDEN",
              message:
                "Cannot update another PM's task",
            },
          });
        }

        const oldStatus = task.status;

        // =====================================================
        // UPDATE TASK
        // =====================================================
        const updated = await prisma.task.update({
          where: {
            id: task.id,
          },
          data: {
            status: parsed.data.status as TaskStatus,
          },
        });

        // =====================================================
        // CREATE ACTIVITY LOG
        // =====================================================
        const activity =
          await prisma.activity.create({
            data: {
              projectId: task.projectId,
              taskId: task.id,
              userId: req.user!.userId,
              fromStatus: oldStatus,
              toStatus: updated.status,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

        // =====================================================
        // REALTIME ACTIVITY
        // =====================================================

        // PM / Admin project room
        io.to(`project:${task.projectId}`).emit(
          "activity:new",
          activity
        );

        // Developer assigned to this task
        io.to(`task:${task.id}`).emit(
          "activity:new",
          activity
        );

        // Admin global feed
        io.to("global").emit(
          "activity:new",
          activity
        );

        // =====================================================
        // NOTIFY PM WHEN TASK GOES TO IN REVIEW
        // =====================================================
        if (
          updated.status === "IN_REVIEW" &&
          task.project.ownerId !== req.user!.userId
        ) {
          const notification =
            await prisma.notification.create({
              data: {
                userId: task.project.ownerId,
                message: `Task "${task.title}" was moved to In Review.`,
              },
            });

          // Send new notification
          io.to(
            `user:${task.project.ownerId}`
          ).emit(
            "notification:new",
            notification
          );

          // ===================================================
          // SEND UPDATED PM UNREAD COUNT
          // ===================================================
          const unreadCount =
            await prisma.notification.count({
              where: {
                userId: task.project.ownerId,
                read: false,
              },
            });

          io.to(
            `user:${task.project.ownerId}`
          ).emit(
            "notification:count",
            unreadCount
          );
        }

        res.json({
          task: updated,
          activity,
        });
      } catch (error) {
        console.error(
          "Update task status error:",
          error
        );

        res.status(500).json({
          error: {
            code: "SERVER_ERROR",
            message:
              "Failed to update task status",
          },
        });
      }
    }
  );

  // =========================================================
  // GET TASK ACTIVITY
  // =========================================================
  router.get("/:id/activity", async (req, res) => {
    try {
      const taskId = Number(req.params.id);

      if (!Number.isInteger(taskId)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid task ID",
          },
        });
      }

      const task = await prisma.task.findUnique({
        where: {
          id: taskId,
        },
        include: {
          project: true,
        },
      });

      if (!task) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Task not found",
          },
        });
      }

      // =====================================================
      // DEVELOPER → ONLY ASSIGNED TASK ACTIVITY
      // =====================================================
      if (
        req.user!.role === Role.DEVELOPER &&
        task.developerId !== req.user!.userId
      ) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "No access",
          },
        });
      }

      // =====================================================
      // PM → ONLY OWN PROJECT ACTIVITY
      // =====================================================
      if (
        req.user!.role === Role.PM &&
        task.project.ownerId !== req.user!.userId
      ) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "No access",
          },
        });
      }

      const activities =
        await prisma.activity.findMany({
          where: {
            taskId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        });

      res.json({ activities });
    } catch (error) {
      console.error(
        "Get task activity error:",
        error
      );

      res.status(500).json({
        error: {
          code: "SERVER_ERROR",
          message:
            "Failed to fetch task activity",
        },
      });
    }
  });

  return router;
}