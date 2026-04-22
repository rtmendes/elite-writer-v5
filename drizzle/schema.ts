import {
  int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal, boolean, bigint
} from "drizzle-orm/mysql-core";

// ─── Core User ────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Article Ideas ────────────────────────────────────────
export const ideas = mysqlTable("ideas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  angle: text("angle"),
  category: varchar("category", { length: 100 }),
  newsPeg: text("newsPeg"),
  status: mysqlEnum("status", ["idea", "researching", "drafting", "scoring", "pitching", "published"]).default("idea").notNull(),
  score: int("score"),
  brandId: varchar("brandId", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = typeof ideas.$inferInsert;

// ─── Articles ─────────────────────────────────────────────
export const articles = mysqlTable("articles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  template: varchar("template", { length: 100 }),
  brandVoice: varchar("brandVoice", { length: 100 }),
  wordCount: int("wordCount"),
  status: mysqlEnum("status", ["draft", "review", "scored", "pitched", "published"]).default("draft").notNull(),
  overallScore: int("overallScore"),
  scoreData: json("scoreData"),
  targetPublication: varchar("targetPublication", { length: 200 }),
  brandId: varchar("brandId", { length: 100 }),
  productId: varchar("productId", { length: 100 }),
  // Style analysis data from old app
  styleProfile: json("styleProfile"),
  importedFrom: varchar("importedFrom", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

// ─── Pitches ──────────────────────────────────────────────
export const pitches = mysqlTable("pitches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  publicationId: varchar("publicationId", { length: 100 }).notNull(),
  publicationName: varchar("publicationName", { length: 200 }),
  editorName: varchar("editorName", { length: 200 }),
  editorEmail: varchar("editorEmail", { length: 320 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body"),
  articleTitle: varchar("articleTitle", { length: 500 }),
  status: mysqlEnum("status", ["draft", "sent", "accepted", "rejected", "no_response"]).default("draft").notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Pitch = typeof pitches.$inferSelect;
export type InsertPitch = typeof pitches.$inferInsert;

// ─── Research Notes ───────────────────────────────────────
export const researchNotes = mysqlTable("research_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  sources: json("sources"),
  dataPoints: json("dataPoints"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResearchNote = typeof researchNotes.$inferSelect;
export type InsertResearchNote = typeof researchNotes.$inferInsert;

// ─── Brands ───────────────────────────────────────────────
export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  niche: varchar("niche", { length: 200 }),
  website: varchar("website", { length: 500 }),
  color: varchar("color", { length: 20 }),
  alignedPublications: json("alignedPublications"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

// ─── Products ─────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  brandId: int("brandId"),
  name: varchar("name", { length: 200 }).notNull(),
  type: varchar("type", { length: 100 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  description: text("description"),
  funnelUrl: varchar("funnelUrl", { length: 500 }),
  status: mysqlEnum("status", ["draft", "active", "paused"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Earnings ─────────────────────────────────────────────
export const earnings = mysqlTable("earnings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["content", "product"]).notNull(),
  source: varchar("source", { length: 200 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  brandId: int("brandId"),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Earning = typeof earnings.$inferSelect;
export type InsertEarning = typeof earnings.$inferInsert;

// ─── Intelligence Items ───────────────────────────────────
export const intelligenceItems = mysqlTable("intelligence_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary"),
  source: varchar("source", { length: 200 }),
  url: varchar("url", { length: 1000 }),
  category: varchar("category", { length: 100 }),
  relevanceScore: int("relevanceScore"),
  saved: int("saved").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntelligenceItem = typeof intelligenceItems.$inferSelect;
export type InsertIntelligenceItem = typeof intelligenceItems.$inferInsert;

// ═══════════════════════════════════════════════════════════
// NEW TABLES — Ported from elite-writer-app (Supabase schema)
// ═══════════════════════════════════════════════════════════

// ─── Publications ─────────────────────────────────────────
export const publications = mysqlTable("publications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  slug: varchar("slug", { length: 200 }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  url: varchar("url", { length: 500 }),
  category: varchar("category", { length: 100 }),
  payRange: varchar("payRange", { length: 100 }),
  payMin: int("payMin"),
  payMax: int("payMax"),
  acceptsFreelance: int("acceptsFreelance").default(1),
  submissionUrl: varchar("submissionUrl", { length: 500 }),
  editorName: varchar("editorName", { length: 200 }),
  editorEmail: varchar("editorEmail", { length: 320 }),
  guidelines: text("guidelines"),
  notes: text("notes"),
  topics: json("topics"),
  tier: int("tier").default(2),
  responseTime: varchar("responseTime", { length: 100 }),
  templateData: json("templateData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Publication = typeof publications.$inferSelect;
export type InsertPublication = typeof publications.$inferInsert;

// ─── Feeds (RSS + Email) ─────────────────────────────────
export const feeds = mysqlTable("feeds", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("feedType", ["rss", "email"]).default("rss").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  url: varchar("url", { length: 1000 }),
  emailFrom: varchar("emailFrom", { length: 320 }),
  keywords: json("keywords"),
  active: int("active").default(1),
  lastFetched: timestamp("lastFetched"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Feed = typeof feeds.$inferSelect;
export type InsertFeed = typeof feeds.$inferInsert;

// ─── Funnels ──────────────────────────────────────────────
export const funnels = mysqlTable("funnels", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  funnelType: varchar("funnelType", { length: 50 }),
  productName: varchar("productName", { length: 200 }),
  productDescription: text("productDescription"),
  targetAudience: text("targetAudience"),
  pricePoint: varchar("pricePoint", { length: 50 }),
  stages: json("stages"),
  score: int("score"),
  scoreData: json("scoreData"),
  optimizationData: json("optimizationData"),
  status: mysqlEnum("funnelStatus", ["draft", "active", "optimizing", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = typeof funnels.$inferInsert;

// ─── Knowledge Base Items ─────────────────────────────────
export const kbItems = mysqlTable("kb_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  tags: json("tags"),
  useCases: json("useCases"),
  source: varchar("source", { length: 300 }),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  tokenCount: int("tokenCount"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KbItem = typeof kbItems.$inferSelect;
export type InsertKbItem = typeof kbItems.$inferInsert;

// ─── Marketing Assets ─────────────────────────────────────
export const marketingAssets = mysqlTable("marketing_assets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("assetType", { length: 100 }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  content: text("content"),
  topic: varchar("topic", { length: 300 }),
  score: int("score"),
  scoreData: json("scoreData"),
  metadata: json("metadata"),
  status: mysqlEnum("assetStatus", ["draft", "approved", "published"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarketingAsset = typeof marketingAssets.$inferSelect;
export type InsertMarketingAsset = typeof marketingAssets.$inferInsert;

// ─── News Items ───────────────────────────────────────────
export const newsItems = mysqlTable("news_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  url: varchar("url", { length: 1000 }),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  source: varchar("source", { length: 200 }),
  sourceName: varchar("sourceName", { length: 200 }),
  category: varchar("category", { length: 100 }),
  publishedAt: timestamp("publishedAt"),
  relevanceScore: int("relevanceScore"),
  processed: int("processed").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NewsItem = typeof newsItems.$inferSelect;
export type InsertNewsItem = typeof newsItems.$inferInsert;

// ─── Style Profiles ───────────────────────────────────────
export const styleProfiles = mysqlTable("style_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  analysisData: json("analysisData"),
  sampleArticleIds: json("sampleArticleIds"),
  attributes: json("attributes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleProfile = typeof styleProfiles.$inferSelect;
export type InsertStyleProfile = typeof styleProfiles.$inferInsert;

// ─── Google OAuth Tokens ──────────────────────────────────
export const googleTokens = mysqlTable("google_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenType: varchar("tokenType", { length: 50 }),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleToken = typeof googleTokens.$inferSelect;
export type InsertGoogleToken = typeof googleTokens.$inferInsert;

// ─── Intelligence Learnings ───────────────────────────────
export const intelligenceLearnings = mysqlTable("intelligence_learnings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("learningType", { length: 100 }),
  pattern: text("pattern"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  sourceArticleIds: json("sourceArticleIds"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntelligenceLearning = typeof intelligenceLearnings.$inferSelect;
export type InsertIntelligenceLearning = typeof intelligenceLearnings.$inferInsert;

// ─── Daily Briefs ─────────────────────────────────────────
export const dailyBriefs = mysqlTable("daily_briefs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  content: json("content"),
  newsItemIds: json("newsItemIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailyBrief = typeof dailyBriefs.$inferSelect;
export type InsertDailyBrief = typeof dailyBriefs.$inferInsert;

// ─── Generated Images ─────────────────────────────────────
export const generatedImages = mysqlTable("generated_images", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  prompt: text("prompt"),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  model: varchar("model", { length: 100 }),
  style: varchar("style", { length: 100 }),
  articleId: int("articleId"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = typeof generatedImages.$inferInsert;
