import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { products } from "../../drizzle/schema";
import { ENV } from "../_core/env";

function getStripe() {
  if (!ENV.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY not configured");
  // Dynamic import so the module still loads when Stripe key is absent
  const Stripe = require("stripe");
  return new Stripe(ENV.stripeSecretKey, { apiVersion: "2024-12-18.acacia" });
}

export const stripeRouter = router({
  // Public — no auth. Returns offer data for a product (only active products).
  getOffer: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (!product) throw new Error("Offer not found");
      if (product.status === "paused") throw new Error("Offer not available");
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price ? Number(product.price) : null,
        type: product.type,
        status: product.status,
        articleId: product.articleId,
        stripeEnabled: Boolean(ENV.stripeSecretKey && ENV.stripePublishableKey),
        publishableKey: ENV.stripePublishableKey || null,
      };
    }),

  // Public — creates a Stripe checkout session for a product.
  createCheckoutSession: publicProcedure
    .input(z.object({
      productId: z.number(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!product || product.status === "paused") throw new Error("Offer not available");
      if (!product.price || Number(product.price) <= 0) throw new Error("No price set for this offer");

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.description ?? undefined,
            },
            unit_amount: Math.round(Number(product.price) * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          productId: String(product.id),
          productName: product.name,
        },
      });

      return { sessionId: session.id, url: session.url };
    }),
});
