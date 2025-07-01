import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import dotenv from "dotenv";
dotenv.config();

const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers["x-access-token"] || req.headers["authorization"];
  let token: string | undefined;

  if (Array.isArray(authHeader)) {
    token = authHeader[0];
  } else if (typeof authHeader === "string") {
    token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  }
  if (!token) {
    res.status(401).json({ message: "Access denied. No token provided." });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY!) as jwt.JwtPayload;
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ message: "Session expired. Please log in again." });
    } else if (err.name === "JsonWebTokenError") {
      res.status(400).json({ message: "Invalid token. Access denied." });
    } else {
      res.status(500).json({ message: "An error occurred during authentication." });
    }
  }
};

export default authMiddleware;
