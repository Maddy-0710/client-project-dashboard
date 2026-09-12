import { Router } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { Server } from "socket.io";
import { authenticate, authorize } from "../middleware/auth";
import { z } from "zod";

const projectSchema = z.object({ name: z.string().min(2), description: z.string().optional(), clientId: z.string() });

export default function projectRouter(prisma: PrismaClient, io: Server) {
  const router = Router();
  router.use(authenticate);

  router.get("/", async (req,res) => {
    const where = req.user!.role === Role.ADMIN ? {} : { ownerId: req.user!.userId };
    const projects = await prisma.project.findMany({ where, include: { client:true, owner:{select:{id:true,name:true}}, _count:{select:{tasks:true}} }, orderBy:{createdAt:"desc"} });
    res.json({ projects });
  });

  router.post("/", authorize("ADMIN","PM"), async (req,res) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:{code:"VALIDATION_ERROR",message:"Invalid project data"}});
    const project = await prisma.project.create({ data:{ ...parsed.data, ownerId:req.user!.userId }});
    res.status(201).json({ project });
  });

  router.get("/:id", async (req,res) => {
    const project = await prisma.project.findUnique({ where:{id:req.params.id}, include:{client:true,owner:{select:{id:true,name:true}},tasks:{include:{developer:{select:{id:true,name:true}}},orderBy:{dueDate:"asc"}}}});
    if (!project) return res.status(404).json({error:{code:"NOT_FOUND",message:"Project not found"}});
    if (req.user!.role !== "ADMIN" && project.ownerId !== req.user!.userId) {
      if (req.user!.role === "DEVELOPER") {
        const hasTask = project.tasks.some(t => t.developerId === req.user!.userId);
        if (!hasTask) return res.status(403).json({error:{code:"FORBIDDEN",message:"No access to this project"}});
      } else return res.status(403).json({error:{code:"FORBIDDEN",message:"No access to this project"}});
    }
    res.json({project});
  });

  return router;
}
