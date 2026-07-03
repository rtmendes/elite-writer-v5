import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { initProactiveAgents } from "./proactiveAgents";
import { initAgentRegistry } from "../lib/agent-registry";
import { registerOpportunityRoutes } from "./opportunitiesApi";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { streamLLM, warmAnthropicModels } from "./llm";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Stripe webhook MUST receive raw body for signature verification.
  // Register BEFORE express.json() so it gets the raw Buffer.
  const { registerZimmwriterIngestRoute } = await import("./zimmwriter-ingest-route");
  registerZimmwriterIngestRoute(app);

  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const { ENV: e } = await import("./env");
    if (!e.stripeSecretKey) { res.status(503).json({ error: "Stripe not configured" }); return; }

    let event: any;
    try {
      const Stripe = require("stripe");
      const stripe = new Stripe(e.stripeSecretKey, { apiVersion: "2024-12-18.acacia" });
      const sig = req.headers["stripe-signature"];
      event = e.stripeWebhookSecret
        ? stripe.webhooks.constructEvent(req.body, sig, e.stripeWebhookSecret)
        : JSON.parse(req.body.toString());
    } catch (err: any) {
      console.error("[Stripe webhook] signature error:", err.message);
      res.status(400).json({ error: err.message });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const productId = session.metadata?.productId;
      const productName = session.metadata?.productName ?? "Unknown product";
      const amountTotal = session.amount_total; // cents
      if (productId && amountTotal) {
        try {
          const { getDb } = await import("../db");
          const { earnings, products } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (db) {
            const [product] = await db.select({ userId: products.userId })
              .from(products).where(eq(products.id, Number(productId))).limit(1);
            if (product) {
              await db.insert(earnings).values({
                userId: product.userId,
                type: "product",
                source: `stripe:${session.id}`,
                amount: String((amountTotal / 100).toFixed(2)),
                description: `Stripe sale — ${productName}`,
                date: new Date(),
              });
              console.log(`[Stripe] Sale recorded: $${(amountTotal / 100).toFixed(2)} for product ${productId}`);
            }
          }
        } catch (dbErr: any) {
          console.error("[Stripe webhook] DB insert error:", dbErr.message);
        }
      }
    }

    res.json({ received: true });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS for API routes
  app.use("/api", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, x-ingest-signature, x-ingest-token");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Health + integration status (booleans only — no secrets) so config can be
  // verified from outside the container (did R2/Redis env actually land?).
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      ts: Date.now(),
      integrations: {
        openrouter: Boolean(process.env.OPENROUTER_API_KEY),
        r2: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
        redis: Boolean(process.env.REDIS_URL),
        newsapi: Boolean(process.env.NEWSAPI_KEY || process.env.GNEWS_KEY),
        slack: Boolean(process.env.SLACK_WEBHOOK_URL),
        exa: Boolean(process.env.EXA_API_KEY),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY),
        supabaseRealtime: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
        imageGen: Boolean(
          process.env.OPENAI_API_KEY ||
            process.env.GEMINI_API_KEY ||
            process.env.PIAPI_KEY ||
            process.env.RUNWARE_API_KEY ||
            process.env.FAL_AI_API_KEY ||
            process.env.STABILITY_AI_KEY ||
            process.env.OPENROUTER_API_KEY,
        ),
      },
    });
  });

  // Public Opportunities API for Pipeline HQ (pipeline.insightprofit.live)
  registerOpportunityRoutes(app);

  // Auth routes (login, check, hash)
  registerOAuthRoutes(app);

  // Google OAuth callback (redirect handler)
  app.get("/api/google-oauth-callback", async (req, res) => {
    const { code, error, state } = req.query;
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

    if (error || !code) {
      res.redirect(`${appUrl}/settings?google=error&reason=${encodeURIComponent(String(error || "no_code"))}`);
      return;
    }

    try {
      // Exchange code via tRPC-like call
      const { googleRouter } = await import("../routers/google");
      // Use fetch to call our own tRPC endpoint
      const resp = await fetch(`http://localhost:${process.env.PORT || 3000}/api/trpc/google.exchangeCode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: { code: String(code), state: String(state || "") }
        }),
      });
      
      if (resp.ok) {
        res.redirect(`${appUrl}/settings?google=connected`);
      } else {
        res.redirect(`${appUrl}/settings?google=error&reason=token_exchange_failed`);
      }
    } catch (e: any) {
      res.redirect(`${appUrl}/settings?google=error&reason=${encodeURIComponent(e.message)}`);
    }
  });

  // Server-side provider status/key sync endpoint for the Settings page. The client already depended on
  // public tRPC key sync; this direct endpoint removes raw tRPC response-shape fragility in production.
  app.get("/api/server-keys", (_req, res) => {
    res.json({
      openai_key: ENV.openaiApiKey || "",
      anthropic_key: ENV.anthropicApiKey || "",
      openrouter_key: ENV.openrouterApiKey || "",
      gemini_key: ENV.geminiApiKey || "",
      newsapi_key: ENV.newsapiKey || "",
      gnews_key: ENV.gnewsKey || "",
      mediastack_key: ENV.mediastackKey || "",
      perplexity_key: ENV.perplexityApiKey || "",
      youtube_key: ENV.youtubeApiKey || "",
      google_client_id: ENV.googleClientId || "",
    });
  });

  // Streaming AI endpoint (SSE - can't go through tRPC batch)
  app.post("/api/stream", async (req, res) => {
    try {
      const { prompt, systemPrompt, maxTokens, temperature, model } = req.body;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const messages = [];
      if (systemPrompt) messages.push({ role: "system" as const, content: systemPrompt });
      messages.push({ role: "user" as const, content: prompt });

      for await (const chunk of streamLLM({ messages, maxTokens, temperature, model })) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      console.error("[Stream] Error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  // Vercel webhook → auto-wire new projects to Infisical
  const { default: webhooksRouter } = await import("../routers/webhooks");
  app.use("/api/webhooks", webhooksRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Elite Writer V5 running on http://0.0.0.0:${port}/`);
    // Warm the Anthropic model catalog so the direct-Anthropic fallback always
    // resolves a valid, account-served model id (non-blocking, best-effort).
    void warmAnthropicModels();
    initProactiveAgents();
    initAgentRegistry().then((r) => {
      if (r.configured) console.log(`   Agent registry: ${r.gbUpserted} gb.agents + ${r.aiAgentsUpserted} ai_agents synced`);
      else if (r.error) console.log(`   Agent registry: ${r.error}`);
    }).catch(() => {});
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`   Database: ${process.env.DATABASE_URL ? "configured" : "NOT configured"}`);
    console.log(`   Redis queue: ${process.env.REDIS_URL ? "configured (BullMQ)" : "optional — setInterval fallback"}`);
    console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? "configured" : "NOT configured"}`);
  });
}

startServer().catch(console.error);
