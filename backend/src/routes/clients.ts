import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, authorize } from "../middleware/auth";

export default function clientRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(authenticate);
  router.get("/", authorize("ADMIN","PM"), async (_req,res) => {
    const clients = await prisma.client.findMany({ orderBy:{name:"asc"} });
    res.json({clients});
  });
  router.post("/", authorize("ADMIN"), async (req,res) => {
    const {name,email}=req.body??{};
    if(typeof name!=="string" || name.length<2) return res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Name is required"}});
    const client=await prisma.client.create({data:{name,email}});
    res.status(201).json({client});
  });
  return router;
}
