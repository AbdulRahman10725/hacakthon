import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../../../../shared/types";

export interface AuthedRequest extends Request {
  auth?: JwtPayload;
}

export function authMiddleware(jwtSecret: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = header.slice("Bearer ".length);

    try {
      const payload = jwt.verify(token, jwtSecret) as JwtPayload;
      req.auth = payload;
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}
