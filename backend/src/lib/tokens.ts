import jwt from "jsonwebtoken";
import crypto from "crypto";

export function createAccessToken(payload: { userId: string; role: string; name: string }) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: "15m" });
}
export function createRefreshToken(userId: string) {
  const token = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}
