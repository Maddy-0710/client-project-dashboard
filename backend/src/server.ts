import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

import authRouter from "./routes/auth";
import projectRouter from "./routes/projects";
import taskRouter from "./routes/tasks";
import notificationRouter from "./routes/notifications";
import clientRouter from "./routes/clients";
import userRouter from "./routes/users";

import {
  authenticate,
  verifyAccessToken,
} from "./middleware/auth";

const prisma = new PrismaClient();

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

// =========================================================
// ONLINE USER PRESENCE
// =========================================================
//
// Map:
// userId -> number of active Socket.IO connections
//
// This handles multiple browser tabs correctly.
// A user is considered online as long as they have
// at least one active Socket.IO connection.
//
// =========================================================

const onlineUsers = new Map<string, number>();

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use(cookieParser());

// =========================================================
// USER ROUTES
// =========================================================

app.use(
  "/api/users",
  userRouter(prisma)
);

// =========================================================
// HEALTH CHECK
// =========================================================

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "client-project-dashboard",
  });
});

// =========================================================
// AUTH ROUTES
// =========================================================

app.use(
  "/api/auth",
  authRouter(prisma)
);

// =========================================================
// PROJECT ROUTES
// =========================================================

app.use(
  "/api/projects",
  projectRouter(prisma, io)
);

// =========================================================
// TASK ROUTES
// =========================================================

app.use(
  "/api/tasks",
  taskRouter(prisma, io)
);

// =========================================================
// NOTIFICATION ROUTES
// =========================================================

app.use(
  "/api/notifications",
  notificationRouter(prisma, io)
);

// =========================================================
// CLIENT ROUTES
// =========================================================

app.use(
  "/api/clients",
  clientRouter(prisma)
);

// =========================================================
// ADMIN DASHBOARD STATISTICS
// =========================================================
//
// Admin only.
//
// Provides:
// - Total projects
// - Task status counts
// - Overdue task count
//
// =========================================================

app.get(
  "/api/admin/stats",
  authenticate,
  async (req, res) => {
    try {
      if (req.user!.role !== "ADMIN") {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Admin access required",
          },
        });
      }

      const [
        totalProjects,
        todo,
        inProgress,
        inReview,
        done,
        overdue,
      ] = await Promise.all([
        prisma.project.count(),

        prisma.task.count({
          where: {
            status: "TODO",
          },
        }),

        prisma.task.count({
          where: {
            status: "IN_PROGRESS",
          },
        }),

        prisma.task.count({
          where: {
            status: "IN_REVIEW",
          },
        }),

        prisma.task.count({
          where: {
            status: "DONE",
          },
        }),

        prisma.task.count({
          where: {
            status: "OVERDUE",
          },
        }),
      ]);

      res.json({
        totalProjects,

        tasksByStatus: {
          todo,
          inProgress,
          inReview,
          done,
        },

        overdue,
      });
    } catch (error) {
      console.error(
        "Admin stats error:",
        error
      );

      res.status(500).json({
        error: {
          code: "SERVER_ERROR",
          message:
            "Failed to fetch admin statistics",
        },
      });
    }
  }
);

// =========================================================
// LAST 20 ACTIVITY EVENTS
// =========================================================
//
// This endpoint is used when a user comes online.
//
// Activities are loaded directly from PostgreSQL.
//
// Admin:
//   -> sees all activity
//
// PM:
//   -> sees activity from projects they own
//
// Developer:
//   -> sees activity from their assigned tasks
//
// =========================================================

app.get(
  "/api/activities",
  authenticate,
  async (req, res) => {
    try {
      const user = req.user!;

      let where: any = {};

      // -----------------------------------------------------
      // ADMIN
      // -----------------------------------------------------

      if (user.role === "ADMIN") {
        where = {};
      }

      // -----------------------------------------------------
      // PROJECT MANAGER
      // -----------------------------------------------------

      if (user.role === "PM") {
        where = {
          project: {
            ownerId: user.userId,
          },
        };
      }

      // -----------------------------------------------------
      // DEVELOPER
      // -----------------------------------------------------

      if (user.role === "DEVELOPER") {
        where = {
          task: {
            developerId: user.userId,
          },
        };
      }

      const activities =
        await prisma.activity.findMany({
          where,

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

      res.json({
        activities,
      });
    } catch (error) {
      console.error(
        "Get activities error:",
        error
      );

      res.status(500).json({
        error: {
          code: "SERVER_ERROR",
          message:
            "Failed to fetch activities",
        },
      });
    }
  }
);

// =========================================================
// SOCKET.IO AUTHENTICATION
// =========================================================

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Unauthorized")
      );
    }

    socket.data.user =
      verifyAccessToken(token);

    next();
  } catch {
    next(
      new Error("Unauthorized")
    );
  }
});

// =========================================================
// SOCKET.IO CONNECTION
// =========================================================

io.on(
  "connection",
  async (socket) => {
    const user =
      socket.data.user as {
        userId: string;
        role: string;
      };

    console.log(
      `Socket connected: ${user.userId} (${user.role})`
    );

    // =====================================================
    // ONLINE PRESENCE
    // =====================================================

    const currentConnections =
      onlineUsers.get(user.userId) || 0;

    onlineUsers.set(
      user.userId,
      currentConnections + 1
    );

    // -----------------------------------------------------
    // Send current online count to Admins
    // -----------------------------------------------------

    io.to("global").emit(
      "presence:count",
      onlineUsers.size
    );

    console.log(
      `Online users: ${onlineUsers.size}`
    );

    // -------------------------------------------------------
    // PERSONAL USER ROOM
    // -------------------------------------------------------

    socket.join(
      `user:${user.userId}`
    );

    // -------------------------------------------------------
    // ADMIN GLOBAL ROOM
    // -------------------------------------------------------

    if (user.role === "ADMIN") {
      socket.join("global");

      console.log(
        `${user.userId} joined global`
      );

      // Send current count immediately
      // because the global room was joined
      // after the first presence broadcast.

      socket.emit(
        "presence:count",
        onlineUsers.size
      );
    }

    // =======================================================
    // PROJECT ROOM
    // =======================================================

    socket.on(
      "project:join",
      async (
        projectId: string
      ) => {
        try {
          const project =
            await prisma.project.findUnique({
              where: {
                id: projectId,
              },
            });

          if (!project) {
            return;
          }

          // -------------------------------------------------
          // ADMIN
          // -------------------------------------------------

          if (user.role === "ADMIN") {
            socket.join(
              `project:${projectId}`
            );

            console.log(
              `${user.userId} joined project:${projectId}`
            );

            return;
          }

          // -------------------------------------------------
          // PM
          // -------------------------------------------------

          if (
            user.role === "PM" &&
            project.ownerId ===
              user.userId
          ) {
            socket.join(
              `project:${projectId}`
            );

            console.log(
              `${user.userId} joined project:${projectId}`
            );

            return;
          }

          // -------------------------------------------------
          // DEVELOPER
          // -------------------------------------------------

          if (
            user.role ===
            "DEVELOPER"
          ) {
            console.log(
              `${user.userId} attempted project room access - using task rooms`
            );
          }
        } catch (error) {
          console.error(
            "Project room error:",
            error
          );
        }
      }
    );

    // =======================================================
    // TASK ROOM
    // =======================================================

    socket.on(
      "task:join",
      async (
        taskId: number | string
      ) => {
        try {
          const numericTaskId =
            Number(taskId);

          if (
            !Number.isInteger(
              numericTaskId
            )
          ) {
            return;
          }

          const task =
            await prisma.task.findUnique({
              where: {
                id: numericTaskId,
              },
            });

          if (!task) {
            return;
          }

          // -------------------------------------------------
          // ADMIN
          // -------------------------------------------------

          if (
            user.role === "ADMIN"
          ) {
            socket.join(
              `task:${numericTaskId}`
            );

            console.log(
              `${user.userId} joined task:${numericTaskId}`
            );

            return;
          }

          // -------------------------------------------------
          // PM
          // -------------------------------------------------

          if (
            user.role === "PM"
          ) {
            const project =
              await prisma.project.findUnique({
                where: {
                  id: task.projectId,
                },
              });

            if (
              project &&
              project.ownerId ===
                user.userId
            ) {
              socket.join(
                `task:${numericTaskId}`
              );

              console.log(
                `${user.userId} joined task:${numericTaskId}`
              );
            }

            return;
          }

          // -------------------------------------------------
          // DEVELOPER
          // -------------------------------------------------

          if (
            user.role ===
              "DEVELOPER" &&
            task.developerId ===
              user.userId
          ) {
            socket.join(
              `task:${numericTaskId}`
            );

            console.log(
              `${user.userId} joined task:${numericTaskId}`
            );
          }
        } catch (error) {
          console.error(
            "Task room error:",
            error
          );
        }
      }
    );

    // =======================================================
    // LEAVE PROJECT ROOM
    // =======================================================

    socket.on(
      "project:leave",
      (
        projectId: string
      ) => {
        socket.leave(
          `project:${projectId}`
        );
      }
    );

    // =======================================================
    // LEAVE TASK ROOM
    // =======================================================

    socket.on(
      "task:leave",
      (
        taskId: number | string
      ) => {
        const numericTaskId =
          Number(taskId);

        if (
          Number.isInteger(
            numericTaskId
          )
        ) {
          socket.leave(
            `task:${numericTaskId}`
          );
        }
      }
    );

    // =======================================================
    // DISCONNECT
    // =======================================================

    socket.on(
      "disconnect",
      (reason) => {
        const currentConnections =
          onlineUsers.get(
            user.userId
          ) || 0;

        // ---------------------------------------------------
        // Remove user completely if this was
        // their last active connection.
        // ---------------------------------------------------

        if (
          currentConnections <= 1
        ) {
          onlineUsers.delete(
            user.userId
          );
        } else {
          onlineUsers.set(
            user.userId,
            currentConnections - 1
          );
        }

        // ---------------------------------------------------
        // Broadcast updated online count
        // ---------------------------------------------------

        io.to("global").emit(
          "presence:count",
          onlineUsers.size
        );

        console.log(
          `Socket disconnected: ${user.userId} (${reason})`
        );

        console.log(
          `Online users: ${onlineUsers.size}`
        );
      }
    );
  }
);

// =========================================================
// OVERDUE TASK BACKGROUND JOB
// =========================================================
//
// Runs every 5 minutes.
//
// This intentionally does NOT depend on page loading.
//
// =========================================================

cron.schedule(
  "*/5 * * * *",
  async () => {
    try {
      const now =
        new Date();

      const result =
        await prisma.task.updateMany({
          where: {
            dueDate: {
              lt: now,
            },

            status: {
              notIn: [
                "DONE",
                "OVERDUE",
              ],
            },
          },

          data: {
            status: "OVERDUE",
          },
        });

      if (result.count) {
        console.log(
          `Marked ${result.count} tasks overdue.`
        );
      }
    } catch (error) {
      console.error(
        "Overdue job error:",
        error
      );
    }
  }
);

// =========================================================
// START SERVER
// =========================================================

const port =
  Number(
    process.env.PORT || 4000
  );

server.listen(
  port,
  () => {
    console.log(
      `API listening on http://localhost:${port}`
    );
  }
);