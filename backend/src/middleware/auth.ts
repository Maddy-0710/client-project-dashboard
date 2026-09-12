import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = { userId: string; role: "ADMIN" | "PM" | "DEVELOPER"; name?: string };

export function verifyAccessToken(token: string): AuthUser {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AuthUser;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" }});
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Invalid or expired access token" }});
  }
}

export function authorize(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" }});
    }
    next();
  };
}

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}
