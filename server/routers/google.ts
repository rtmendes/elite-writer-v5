/**
 * Google Integration Router — 7 endpoints ported from elite-writer-app
 * Covers: google-config, google-drive, google-gmail-send,
 *         google-oauth-start, google-oauth-callback, google-oauth-refresh, google-sheets
 */
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { googleTokens, type InsertGoogleToken } from "../../drizzle/schema";

// ─── Token Management ─────────────────────────────────────

async function getGoogleAccessToken(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [token] = await db.select().from(googleTokens).where(eq(googleTokens.userId, userId));
  if (!token?.accessToken) throw new Error("Google not connected. Authorize via Settings → Google Integration.");

  // Check if token is expired
  const now = new Date();
  if (token.expiresAt && token.expiresAt < now) {
    // Refresh the token
    if (!token.refreshToken) throw new Error("Google token expired and no refresh token. Re-authorize.");
    return refreshGoogleToken(userId, token.refreshToken);
  }

  return token.accessToken;
}

async function refreshGoogleToken(userId: number, refreshToken: string): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!resp.ok) throw new Error("Failed to refresh Google token. Re-authorize via Settings.");

  const data = await resp.json() as any;
  const newAccessToken = data.access_token;
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  // Update stored token
  const db = await getDb();
  if (db) {
    await db.update(googleTokens)
      .set({ accessToken: newAccessToken, expiresAt })
      .where(eq(googleTokens.userId, userId));
  }

  return newAccessToken;
}

export const googleRouter = router({
  // Public config — returns client ID (not a secret)
  config: publicProcedure.query(() => ({
    clientId: ENV.googleClientId || null,
    configured: !!(ENV.googleClientId && ENV.googleClientSecret),
  })),

  // Get OAuth authorization URL
  getAuthUrl: protectedProcedure.query(({ ctx }) => {
    if (!ENV.googleClientId) throw new Error("GOOGLE_CLIENT_ID not configured");

    const scopes = [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const redirectUri = `${ENV.appUrl}/api/google-oauth-callback`;
    const state = String(ctx.user.id); // Pass user ID through OAuth flow

    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }),

  // Exchange OAuth code for tokens (called from callback handler)
  exchangeCode: publicProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ input }) => {
      const { code, state } = input;
      const userId = parseInt(state);
      if (!userId) throw new Error("Invalid state parameter");

      const redirectUri = `${ENV.appUrl}/api/google-oauth-callback`;

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenResp.ok) {
        const body = await tokenResp.text();
        throw new Error(`Token exchange failed: ${body.slice(0, 200)}`);
      }

      const tokens = await tokenResp.json() as any;
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      // Store tokens in DB
      const db = await getDb();
      if (db) {
        // Upsert: delete existing then insert
        await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
        await db.insert(googleTokens).values({
          userId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenType: tokens.token_type || "Bearer",
          expiresAt,
          scope: tokens.scope || "",
        });
      }

      return { success: true };
    }),

  // Check connection status
  status: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { connected: false };

    const [token] = await db.select().from(googleTokens).where(eq(googleTokens.userId, ctx.user.id));
    return {
      connected: !!token?.accessToken,
      expiresAt: token?.expiresAt?.toISOString(),
      hasRefreshToken: !!token?.refreshToken,
    };
  }),

  // Disconnect Google
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(googleTokens).where(eq(googleTokens.userId, ctx.user.id));
    return { success: true };
  }),

  // Create Google Doc
  createDoc: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = await getGoogleAccessToken(ctx.user.id);

      // Create doc
      const createResp = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: input.title }),
      });

      if (!createResp.ok) throw new Error(`Failed to create Google Doc: ${createResp.status}`);
      const doc = await createResp.json() as any;
      const docId = doc.documentId;

      // Insert content if provided
      if (input.content) {
        await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              insertText: {
                location: { index: 1 },
                text: input.content,
              },
            }],
          }),
        });
      }

      return {
        success: true,
        docId,
        docUrl: `https://docs.google.com/document/d/${docId}/edit`,
      };
    }),

  // Send email via Gmail
  sendEmail: protectedProcedure
    .input(z.object({
      to: z.string().email(),
      subject: z.string(),
      body: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = await getGoogleAccessToken(ctx.user.id);

      const rawEmail = [
        `To: ${input.to}`,
        "Content-Type: text/plain; charset=\"UTF-8\"",
        "MIME-Version: 1.0",
        `Subject: ${input.subject}`,
        "",
        input.body,
      ].join("\n");

      // Base64 URL encode
      const encoded = Buffer.from(rawEmail).toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Gmail send failed: ${resp.status} — ${body.slice(0, 200)}`);
      }

      const data = await resp.json() as any;
      return { success: true, messageId: data.id, threadId: data.threadId };
    }),

  // Read Google Sheets
  readSheet: protectedProcedure
    .input(z.object({
      sheetId: z.string(),
      range: z.string().default("Sheet1"),
    }))
    .query(async ({ ctx, input }) => {
      const token = await getGoogleAccessToken(ctx.user.id);

      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.sheetId)}/values/${encodeURIComponent(input.range)}`;
      const resp = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Sheets API error: ${resp.status} — ${body.slice(0, 200)}`);
      }

      const data = await resp.json() as any;
      return { values: data.values || [], range: data.range };
    }),

  // Write to Google Sheets
  writeSheet: protectedProcedure
    .input(z.object({
      sheetId: z.string(),
      range: z.string(),
      values: z.array(z.array(z.string())),
      mode: z.enum(["append", "update"]).default("append"),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = await getGoogleAccessToken(ctx.user.id);

      const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.sheetId)}`;

      if (input.mode === "append") {
        const resp = await fetch(
          `${baseUrl}/values/${encodeURIComponent(input.range)}:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: input.values }),
          }
        );
        if (!resp.ok) throw new Error(`Sheets append failed: ${resp.status}`);
        const data = await resp.json() as any;
        return { success: true, updatedRows: data.updates?.updatedRows || 0 };
      } else {
        const resp = await fetch(
          `${baseUrl}/values/${encodeURIComponent(input.range)}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: input.values }),
          }
        );
        if (!resp.ok) throw new Error(`Sheets update failed: ${resp.status}`);
        const data = await resp.json() as any;
        return { success: true, updatedCells: data.updatedCells || 0 };
      }
    }),
});
