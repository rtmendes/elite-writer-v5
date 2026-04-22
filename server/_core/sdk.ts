/**
 * Standalone Auth Service — replaces Manus OAuth dependency.
 * Uses simple email/password with JWT sessions.
 * For a single-user tool like Elite Writer, this is optimal.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import crypto from "crypto";

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

// Simple password hashing with built-in crypto
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + ENV.cookieSecret).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

class SDKServer {
  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  /**
   * Authenticate with email + password, returns a session token.
   */
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    // Check against configured admin credentials
    const expectedEmail = ENV.adminEmail || "admin@elitewriter.app";
    const expectedHash = ENV.adminPasswordHash || hashPassword("admin");

    if (email !== expectedEmail || !verifyPassword(password, expectedHash)) {
      throw ForbiddenError("Invalid credentials");
    }

    // Upsert the admin user
    const openId = "admin_" + crypto.createHash("md5").update(email).digest("hex").slice(0, 16);
    await db.upsertUser({
      openId,
      name: email.split("@")[0],
      email,
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    });

    const user = await db.getUserByOpenId(openId);
    if (!user) throw ForbiddenError("User creation failed");

    const token = await this.createSessionToken(openId, { name: user.name || email });
    return { token, user };
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId,
      appId: ENV.appId,
      name: options.name || "",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (typeof openId !== "string" || !openId) return null;

      return {
        openId,
        appId: (appId as string) || ENV.appId,
        name: (name as string) || "",
      };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    // Check cookie
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);

    // Also check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    const tokenToVerify = sessionCookie || bearerToken;
    const session = await this.verifySession(tokenToVerify);

    if (!session) {
      throw ForbiddenError("Invalid session");
    }

    let user = await db.getUserByOpenId(session.openId);

    if (!user) {
      // Auto-create the user on first visit
      await db.upsertUser({
        openId: session.openId,
        name: session.name || null,
        loginMethod: "password",
        lastSignedIn: new Date(),
      });
      user = await db.getUserByOpenId(session.openId);
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    return user;
  }

  /**
   * Generate a password hash for environment variable setup.
   */
  generatePasswordHash(password: string): string {
    return hashPassword(password);
  }
}

export const sdk = new SDKServer();
