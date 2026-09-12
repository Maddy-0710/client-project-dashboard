import { Router } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { authenticate } from "../middleware/auth";

export default function userRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(authenticate);

  // GET /api/users/developers
  router.get("/developers", async (req, res) => {
    try {
      if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.PM) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Only Admin and PM can view developers",
          },
        });
      }

      const developers = await prisma.user.findMany({
        where: {
          role: Role.DEVELOPER,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      res.json({ developers });
    } catch (error) {
      console.error("GET /users/developers error:", error);

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to load developers",
        },
      });
    }
  });

  return router;
}