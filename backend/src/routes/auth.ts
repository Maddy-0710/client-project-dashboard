import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { createAccessToken, createRefreshToken } from "../lib/tokens";
import { authenticate } from "../middleware/auth";

export default function authRouter(prisma: PrismaClient) {
  const router = Router();

  router.post("/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" }});
    }
    const { token, tokenHash } = createRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000) }
    });
    const accessToken = createAccessToken({ userId: user.id, role: user.role, name: user.name });
    res.cookie("refreshToken", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7*24*60*60*1000 });
    res.json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role }});
  });

  router.post("/refresh", async (req, res) => {
    const raw = req.cookies.refreshToken;
    if (!raw) return res.status(401).json({ error: { code: "NO_REFRESH_TOKEN", message: "Refresh token missing" }});
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: true }});
    if (!stored || stored.expiresAt < new Date()) return res.status(401).json({ error: { code: "INVALID_REFRESH_TOKEN", message: "Invalid refresh token" }});
    const accessToken = createAccessToken({ userId: stored.user.id, role: stored.user.role, name: stored.user.name });
    res.json({ accessToken, user: { id: stored.user.id, name: stored.user.name, email: stored.user.email, role: stored.user.role }});
  });

  router.post("/logout", async (req, res) => {
    const raw = req.cookies.refreshToken;
    if (raw) {
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      await prisma.refreshToken.deleteMany({ where: { tokenHash: hash }});
    }
    res.clearCookie("refreshToken");
    res.json({ ok: true });
  });

  router.get("/me", authenticate, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id:true,name:true,email:true,role:true }});
    res.json({ user });
  });

  return router;
}
