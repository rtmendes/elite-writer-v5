import {
  integer, pgTable, text, timestamp, varchar, jsonb, decimal, boolean, bigint, uniqueIndex, index, serial
} from "drizzle-orm/pg-core";

// MySQL→Postgres port notes:
// - int().autoincrement() → serial (allows explicit id inserts during data migration)
// - mysqlEnum → varchar(..., { enum }) — same TS union types, no DB enum types
//   (MySQL enum column names like "status" repeat across tables with different
//   value sets; Postgres named enum types would collide)
// - .onUpdateNow() → .$onUpdate(() => new Date()) — Postgres has no ON UPDATE
// - json → jsonb; tinyint flags → integer (0/1, matches other int flags)

// ─── Core User ────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 32, enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Article Ideas ────────────────────────────────────────
export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  angle: text("angle"),
  category: varchar("category", { length: 100 }),
  newsPeg: text("newsPeg"),
  status: varchar("status", { length: 32, enum: ["idea", "researching", "drafting", "scoring", "pitching", "published"] }).default("idea").notNull(),
  score: integer("score"),
  brandId: varchar("brandId", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = typeof ideas.$inferInsert;

// ─── Articles ─────────────────────────────────────────────
export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content"),
    template: varchar("template", { length: 100 }),
    brandVoice: varchar("brandVoice", { length: 100 }),
    wordCount: integer("wordCount"),
    status: varchar("status", { length: 32, enum: ["draft", "review", "scored", "pitched", "published"] }).default("draft").notNull(),
    overallScore: integer("overallScore"),
    scoreData: jsonb("scoreData"),
    targetPublication: varchar("targetPublication", { length: 200 }),
    brandId: varchar("brandId", { length: 100 }),
    productId: varchar("productId", { length: 100 }),
    // Style analysis data from old app
    styleProfile: jsonb("styleProfile"),
    // Source registry: [{title, url, note, addedAt}] — research provenance per article
    sources: jsonb("sources"),
    importedFrom: varchar("importedFrom", { length: 500 }),
    // ZimmWriter / external ingest provenance
    source: text("source"),
    sourceId: text("source_id"),
    bodyMarkdown: text("body_markdown"),
    bodyHtml: text("body_html"),
    excerpt: text("excerpt"),
    category: varchar("category", { length: 200 }),
    tags: jsonb("tags"),
    featuredImageUrl: text("featured_image_url"),
    featuredImageB64: text("featured_image_b64"),
    needsScoring: boolean("needs_scoring").default(false).notNull(),
    complianceFlag: boolean("compliance_flag").default(false).notNull(),
    neuronScore: integer("neuron_score"),
    neuronShareUrl: text("neuron_share_url"),
    // P3a: Research → Article bridge fields
    articleNumber: integer("article_number"),
    seriesId: integer("series_id"),
    isMoneyPage: integer("is_money_page").default(0).notNull(),
    primaryOfferId: integer("primary_offer_id"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex("articles_source_source_id_uidx").on(t.source, t.sourceId)]
);

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

// ─── Pitches ──────────────────────────────────────────────
export const pitches = pgTable("pitches", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  publicationId: varchar("publicationId", { length: 100 }).notNull(),
  publicationName: varchar("publicationName", { length: 200 }),
  editorName: varchar("editorName", { length: 200 }),
  editorEmail: varchar("editorEmail", { length: 320 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body"),
  articleTitle: varchar("articleTitle", { length: 500 }),
  status: varchar("status", { length: 32, enum: ["draft", "sent", "accepted", "rejected", "no_response"] }).default("draft").notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Pitch = typeof pitches.$inferSelect;
export type InsertPitch = typeof pitches.$inferInsert;

// ─── Research Notes ───────────────────────────────────────
export const researchNotes = pgTable("research_notes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  sources: jsonb("sources"),
  dataPoints: jsonb("dataPoints"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ResearchNote = typeof researchNotes.$inferSelect;
export type InsertResearchNote = typeof researchNotes.$inferInsert;

// ─── Research References (Reference Library / citation manager) ───
// Structured citations gathered by the agentic research hub or imported
// (DOI / BibTeX / RIS). Distinct from kb_items: a reference is queryable
// metadata (authors, year, DOI, citation count), not a freeform note.
export const researchReferences = pgTable("research_references", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 40 }).default("article").notNull(), // article | webpage | video | book | report
  title: varchar("title", { length: 700 }).notNull(),
  authors: jsonb("authors"),           // string[]
  year: integer("year"),
  doi: varchar("doi", { length: 200 }),
  url: varchar("url", { length: 1000 }),
  abstract: text("abstract"),
  source: varchar("source", { length: 120 }), // openalex | crossref | brave | youtube | manual | …
  citationCount: integer("citationCount").default(0),
  tags: jsonb("tags"),                 // string[]
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ResearchReference = typeof researchReferences.$inferSelect;
export type InsertResearchReference = typeof researchReferences.$inferInsert;

// ─── Brands ───────────────────────────────────────────────
export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  niche: varchar("niche", { length: 200 }),
  website: varchar("website", { length: 500 }),
  color: varchar("color", { length: 20 }),
  alignedPublications: jsonb("alignedPublications"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

// ─── Products ─────────────────────────────────────────────
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  brandId: integer("brandId"),
  articleId: integer("articleId"),
  name: varchar("name", { length: 200 }).notNull(),
  type: varchar("type", { length: 100 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  description: text("description"),
  funnelUrl: varchar("funnelUrl", { length: 500 }),
  status: varchar("status", { length: 32, enum: ["draft", "active", "paused"] }).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Earnings ─────────────────────────────────────────────
export const earnings = pgTable("earnings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 32, enum: ["content", "product"] }).notNull(),
  source: varchar("source", { length: 200 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  brandId: integer("brandId"),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Earning = typeof earnings.$inferSelect;
export type InsertEarning = typeof earnings.$inferInsert;

// ─── Intelligence Items ───────────────────────────────────
export const intelligenceItems = pgTable("intelligence_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary"),
  source: varchar("source", { length: 200 }),
  url: varchar("url", { length: 1000 }),
  category: varchar("category", { length: 100 }),
  relevanceScore: integer("relevanceScore"),
  saved: integer("saved").default(0),
  // Gap #6: Sentiment persistence — stores sentiment, viral_score, niche_tags, etc.
  metadata: jsonb("metadata").$type<{
    sentiment?: string;
    viral_score?: number;
    niche_tags?: string[];
    article_opportunity?: string;
    suggested_publications?: string[];
    source_name?: string;
    published_at?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntelligenceItem = typeof intelligenceItems.$inferSelect;
export type InsertIntelligenceItem = typeof intelligenceItems.$inferInsert;

// ═══════════════════════════════════════════════════════════
// NEW TABLES — Ported from elite-writer-app (Supabase schema)
// ═══════════════════════════════════════════════════════════

// ─── Publications ─────────────────────────────────────────
export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  slug: varchar("slug", { length: 200 }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  url: varchar("url", { length: 500 }),
  category: varchar("category", { length: 100 }),
  payRange: varchar("payRange", { length: 100 }),
  payMin: integer("payMin"),
  payMax: integer("payMax"),
  acceptsFreelance: integer("acceptsFreelance").default(1),
  submissionUrl: varchar("submissionUrl", { length: 500 }),
  editorName: varchar("editorName", { length: 200 }),
  editorEmail: varchar("editorEmail", { length: 320 }),
  guidelines: text("guidelines"),
  notes: text("notes"),
  topics: jsonb("topics"),
  tier: integer("tier").default(2),
  audienceAvatar: text("audienceAvatar"),
  editorPreferences: text("editorPreferences"),
  responseTime: varchar("responseTime", { length: 100 }),
  templateData: jsonb("templateData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Publication = typeof publications.$inferSelect;
export type InsertPublication = typeof publications.$inferInsert;

// ─── AI usage ledger (server-side, aggregated per day+model) ─────────────
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    day: varchar("day", { length: 10 }).notNull(),
    model: varchar("model", { length: 200 }).notNull(),
    promptTokens: integer("promptTokens").default(0).notNull(),
    completionTokens: integer("completionTokens").default(0).notNull(),
    costMicros: bigint("costMicros", { mode: "number" }).default(0).notNull(),
    calls: integer("calls").default(0).notNull(),
  },
  (t) => [uniqueIndex("day_model_idx").on(t.day, t.model)]
);
export type AiUsage = typeof aiUsage.$inferSelect;

// ─── Feeds (RSS + Email) ─────────────────────────────────
export const feeds = pgTable("feeds", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("feedType", { length: 32, enum: ["rss", "email"] }).default("rss").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  url: varchar("url", { length: 1000 }),
  emailFrom: varchar("emailFrom", { length: 320 }),
  keywords: jsonb("keywords"),
  active: integer("active").default(1),
  lastFetched: timestamp("lastFetched"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Feed = typeof feeds.$inferSelect;
export type InsertFeed = typeof feeds.$inferInsert;

// ─── Funnels ──────────────────────────────────────────────
export const funnels = pgTable("funnels", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  funnelType: varchar("funnelType", { length: 50 }),
  productName: varchar("productName", { length: 200 }),
  productDescription: text("productDescription"),
  targetAudience: text("targetAudience"),
  pricePoint: varchar("pricePoint", { length: 50 }),
  stages: jsonb("stages"),
  score: integer("score"),
  scoreData: jsonb("scoreData"),
  optimizationData: jsonb("optimizationData"),
  status: varchar("funnelStatus", { length: 32, enum: ["draft", "active", "optimizing", "archived"] }).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = typeof funnels.$inferInsert;

// ─── Knowledge Base Items ─────────────────────────────────
export const kbItems = pgTable("kb_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  tags: jsonb("tags"),
  useCases: jsonb("useCases"),
  source: varchar("source", { length: 300 }),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  tokenCount: integer("tokenCount"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type KbItem = typeof kbItems.$inferSelect;
export type InsertKbItem = typeof kbItems.$inferInsert;

// ─── Marketing Assets ─────────────────────────────────────
export const marketingAssets = pgTable("marketing_assets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("assetType", { length: 100 }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  content: text("content"),
  topic: varchar("topic", { length: 300 }),
  score: integer("score"),
  scoreData: jsonb("scoreData"),
  metadata: jsonb("metadata"),
  status: varchar("assetStatus", { length: 32, enum: ["draft", "approved", "published"] }).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type MarketingAsset = typeof marketingAssets.$inferSelect;
export type InsertMarketingAsset = typeof marketingAssets.$inferInsert;

// ─── News Items ───────────────────────────────────────────
export const newsItems = pgTable("news_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  url: varchar("url", { length: 1000 }),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  source: varchar("source", { length: 200 }),
  sourceName: varchar("sourceName", { length: 200 }),
  category: varchar("category", { length: 100 }),
  publishedAt: timestamp("publishedAt"),
  relevanceScore: integer("relevanceScore"),
  processed: integer("processed").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NewsItem = typeof newsItems.$inferSelect;
export type InsertNewsItem = typeof newsItems.$inferInsert;

// ─── Style Profiles ───────────────────────────────────────
export const styleProfiles = pgTable("style_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  analysisData: jsonb("analysisData"),
  sampleArticleIds: jsonb("sampleArticleIds"),
  attributes: jsonb("attributes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type StyleProfile = typeof styleProfiles.$inferSelect;
export type InsertStyleProfile = typeof styleProfiles.$inferInsert;

// ─── Google OAuth Tokens ──────────────────────────────────
export const googleTokens = pgTable("google_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenType: varchar("tokenType", { length: 50 }),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type GoogleToken = typeof googleTokens.$inferSelect;
export type InsertGoogleToken = typeof googleTokens.$inferInsert;

// ─── Intelligence Learnings ───────────────────────────────
export const intelligenceLearnings = pgTable("intelligence_learnings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("learningType", { length: 100 }),
  pattern: text("pattern"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  sourceArticleIds: jsonb("sourceArticleIds"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntelligenceLearning = typeof intelligenceLearnings.$inferSelect;
export type InsertIntelligenceLearning = typeof intelligenceLearnings.$inferInsert;

// ─── Daily Briefs ─────────────────────────────────────────
export const dailyBriefs = pgTable("daily_briefs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  content: jsonb("content"),
  newsItemIds: jsonb("newsItemIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailyBrief = typeof dailyBriefs.$inferSelect;
export type InsertDailyBrief = typeof dailyBriefs.$inferInsert;

// ─── Generated Images ─────────────────────────────────────
export const generatedImages = pgTable("generated_images", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  prompt: text("prompt"),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  model: varchar("model", { length: 100 }),
  style: varchar("style", { length: 100 }),
  articleId: integer("articleId"),
  altText: varchar("altText", { length: 500 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = typeof generatedImages.$inferInsert;

// ─── User Settings (DB-persisted) ─────────────────────────
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  settings: jsonb("settings").$type<{
    openai_key?: string;
    brand_voice?: string;
    daily_target?: number;
    monthly_revenue_goal?: number;
    content_revenue_goal?: number;
    product_revenue_goal?: number;
    tracked_topics?: string[];
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

// ─── Saved Views (Admin UX: per-user collection views) ────
// One row per named view on a collection page. config holds the full view
// state (search, filters, sort, visible columns, view mode). See PRD_ADMIN_UX.md.
export const savedViews = pgTable("saved_views", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  page: varchar("page", { length: 60 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  config: jsonb("config").$type<{
    search?: string;
    filters?: Record<string, unknown>;
    sort?: { field: string; dir: "asc" | "desc" } | null;
    columns?: string[];
    mode?: "list" | "gallery" | "kanban";
  }>().notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [index("saved_views_user_page_idx").on(t.userId, t.page)]);

export type SavedView = typeof savedViews.$inferSelect;
export type InsertSavedView = typeof savedViews.$inferInsert;

// ═══════════════════════════════════════════════════════════
// NEW TABLES — Blazly + GistStack Feature Integration
// ═══════════════════════════════════════════════════════════

// ─── Social Posts (GistStack: Social Content Engine) ──────
export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  brandId: integer("brandId"),
  platform: varchar("platform", { length: 32, enum: ["twitter", "linkedin", "facebook", "reddit", "threads", "instagram"] }).notNull(),
  postType: varchar("postType", { length: 32, enum: ["single", "thread", "carousel", "poll"] }).default("single").notNull(),
  content: text("content").notNull(),
  threadParts: jsonb("threadParts").$type<string[]>(),
  hashtags: jsonb("hashtags").$type<string[]>(),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  imagePrompt: text("imagePrompt"),
  sourceArticleId: integer("sourceArticleId"),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  sourceTitle: varchar("sourceTitle", { length: 500 }),
  tone: varchar("tone", { length: 100 }),
  language: varchar("language", { length: 50 }).default("en"),
  score: integer("score"),
  scoreData: jsonb("scoreData").$type<{
    engagement_potential?: number;
    hook_strength?: number;
    cta_clarity?: number;
    brand_alignment?: number;
    platform_fit?: number;
  }>(),
  status: varchar("socialPostStatus", { length: 32, enum: ["draft", "approved", "scheduled", "published"] }).default("draft").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  publishedAt: timestamp("publishedAt"),
  webhookUrl: varchar("webhookUrl", { length: 1000 }),
  metadata: jsonb("socialPostMeta").$type<{
    context_ideas?: string[];
    brand_lens?: string;
    source_insights?: string[];
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

// ─── Content Sources (GistStack: YouTube, Reddit, Newsletter, Non-RSS) ──
export const contentSources = pgTable("content_sources", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("sourceType", { length: 32, enum: ["youtube", "reddit", "newsletter", "website", "rss"] }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  identifier: varchar("identifier", { length: 500 }).notNull(), // channel ID, subreddit, email, URL
  iconUrl: varchar("iconUrl", { length: 1000 }),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  active: integer("active").default(1),
  fetchFrequency: varchar("fetchFrequency", { length: 32, enum: ["hourly", "daily", "weekly"] }).default("daily"),
  lastFetched: timestamp("lastFetched"),
  itemCount: integer("itemCount").default(0),
  metadata: jsonb("sourceMeta").$type<{
    subscriber_count?: number;
    subreddit_members?: number;
    newsletter_email?: string;
    scrape_selector?: string;
    youtube_playlist_id?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ContentSource = typeof contentSources.$inferSelect;
export type InsertContentSource = typeof contentSources.$inferInsert;

// ─── Source Items (fetched content from sources) ──────────
export const sourceItems = pgTable("source_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  sourceId: integer("sourceId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  summary: text("summary"),
  url: varchar("url", { length: 1000 }),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  author: varchar("author", { length: 200 }),
  publishedAt: timestamp("publishedAt"),
  relevanceScore: integer("relevanceScore"),
  viralScore: integer("viralScore"),
  sentiment: varchar("sentiment", { length: 20 }),
  keyInsights: jsonb("keyInsights").$type<string[]>(),
  processed: integer("processed").default(0),
  saved: integer("saved").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SourceItem = typeof sourceItems.$inferSelect;
export type InsertSourceItem = typeof sourceItems.$inferInsert;

// ─── Feed dedup ledger ───────────────────────────────────
// Every fetched URL is recorded here (kept OR discarded) so each URL is
// screened exactly once, ever — this is what stops the daily-pull duplicate
// explosion and the wasted re-screening. Tiny rows; auto-purged after 30 days.
export const feedSeen = pgTable("feed_seen", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  sourceId: integer("sourceId").notNull(),
  urlHash: varchar("urlHash", { length: 40 }).notNull(), // sha1(url)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FeedSeen = typeof feedSeen.$inferSelect;

// ─── Content Library (GistStack: My Content) ─────────────
export const contentLibrary = pgTable("content_library", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("contentType", { length: 32, enum: ["social_post", "article_excerpt", "quote", "idea", "template"] }).notNull(),
  platform: varchar("platform", { length: 50 }),
  title: varchar("title", { length: 500 }),
  content: text("content").notNull(),
  tags: jsonb("contentTags").$type<string[]>(),
  brandId: integer("brandId"),
  sourcePostId: integer("sourcePostId"),
  usageCount: integer("usageCount").default(0),
  starred: integer("starred").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ContentLibraryItem = typeof contentLibrary.$inferSelect;
export type InsertContentLibraryItem = typeof contentLibrary.$inferInsert;

// ─── Image Library (GistStack: Asset Library) ─────────────
export const imageLibrary = pgTable("image_library", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 1000 }).notNull(),
  thumbnailUrl: varchar("thumbnailUrl", { length: 1000 }),
  prompt: text("prompt"),
  model: varchar("model", { length: 100 }),
  style: varchar("style", { length: 100 }),
  tags: jsonb("imageTags").$type<string[]>(),
  brandId: integer("brandId"),
  width: integer("width"),
  height: integer("height"),
  altText: varchar("altText", { length: 500 }),
  contentHash: varchar("contentHash", { length: 64 }),
  presetName: varchar("presetName", { length: 200 }),
  metadata: jsonb("imageMeta").$type<{
    reference_images?: string[];
    character_consistency?: boolean;
    brand_colors?: string[];
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImageLibraryItem = typeof imageLibrary.$inferSelect;
export type InsertImageLibraryItem = typeof imageLibrary.$inferInsert;

// ─── Brand Contexts (GistStack: Brand Context/Lens) ──────
export const brandContexts = pgTable("brand_contexts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  brandId: integer("brandId"),
  name: varchar("name", { length: 200 }).notNull(),
  website: varchar("website", { length: 500 }),
  voice: text("voice"),
  tone: text("tone"),
  audience: text("audience"),
  values: jsonb("brandValues").$type<string[]>(),
  keywords: jsonb("brandKeywords").$type<string[]>(),
  competitors: jsonb("competitors").$type<string[]>(),
  contentPillars: jsonb("contentPillars").$type<string[]>(),
  avoidTopics: jsonb("avoidTopics").$type<string[]>(),
  sampleContent: jsonb("sampleContent").$type<string[]>(),
  languagePreferences: jsonb("languagePreferences").$type<{
    primary: string;
    additional?: string[];
    formality?: string;
    jargon_level?: string;
  }>(),
  imagePreferences: jsonb("imagePreferences").$type<{
    style?: string;
    colors?: string[];
    reference_images?: string[];
    character_refs?: string[];
    custom_prompt_prefix?: string;
  }>(),
  autoResearched: integer("autoResearched").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type BrandContext = typeof brandContexts.$inferSelect;
export type InsertBrandContext = typeof brandContexts.$inferInsert;

// ─── GEO Projects (Blazly: GEO/AEO Suite) ───────────────
export const geoProjects = pgTable("geo_projects", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  websiteUrl: varchar("websiteUrl", { length: 500 }).notNull(),
  competitors: jsonb("geoCompetitors").$type<string[]>(),
  monitorKeywords: jsonb("monitorKeywords").$type<string[]>(),
  targetLocation: varchar("targetLocation", { length: 100 }).default("global"),
  lastCrawled: timestamp("lastCrawled"),
  lastMonitored: timestamp("lastMonitored"),
  overallGeoScore: integer("overallGeoScore"),
  metadata: jsonb("geoMeta").$type<{
    pages_crawled?: number;
    avg_geo_score?: number;
    brand_sentiment?: Record<string, number>;
    competitor_scores?: Record<string, number>;
    llm_visibility?: Record<string, number>;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type GeoProject = typeof geoProjects.$inferSelect;
export type InsertGeoProject = typeof geoProjects.$inferInsert;

// ─── GEO Scores (per-page tracking) ──────────────────────
export const geoScores = pgTable("geo_scores", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  userId: integer("userId").notNull(),
  pageUrl: varchar("pageUrl", { length: 1000 }).notNull(),
  pageTitle: varchar("pageTitle", { length: 500 }),
  geoScore: integer("geoScore"),
  aeoScore: integer("aeoScore"),
  seoScore: integer("seoScore"),
  llmVisibility: jsonb("llmVisibility").$type<{
    chatgpt?: { position?: number; cited?: boolean; sentiment?: string };
    gemini?: { position?: number; cited?: boolean; sentiment?: string };
    claude?: { position?: number; cited?: boolean; sentiment?: string };
    perplexity?: { position?: number; cited?: boolean; sentiment?: string };
  }>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  contentGaps: jsonb("contentGaps").$type<string[]>(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeoScore = typeof geoScores.$inferSelect;
export type InsertGeoScore = typeof geoScores.$inferInsert;

// ─── Content Strategies (Blazly: Strategy Builder) ────────
export const contentStrategies = pgTable("content_strategies", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  brandId: integer("brandId"),
  name: varchar("name", { length: 300 }).notNull(),
  primaryKeyword: varchar("primaryKeyword", { length: 200 }).notNull(),
  pillarTopic: varchar("pillarTopic", { length: 500 }),
  pillarContent: text("pillarContent"),
  clusters: jsonb("clusters").$type<Array<{
    keyword: string;
    title: string;
    status: "planned" | "drafted" | "published";
    articleId?: number;
    difficulty?: number;
    volume?: number;
    intent?: string;
  }>>(),
  enhanced: integer("enhanced").default(0),
  totalArticles: integer("totalArticles").default(0),
  publishedArticles: integer("publishedArticles").default(0),
  status: varchar("strategyStatus", { length: 32, enum: ["draft", "active", "executing", "completed"] }).default("draft").notNull(),
  metadata: jsonb("strategyMeta").$type<{
    target_authority?: number;
    estimated_traffic?: number;
    competition_level?: string;
    content_gap_analysis?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ContentStrategy = typeof contentStrategies.$inferSelect;
export type InsertContentStrategy = typeof contentStrategies.$inferInsert;

// ─── Keyword Research (Blazly: Keyword Discovery) ────────
export const keywordResearch = pgTable("keyword_research", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  keyword: varchar("keyword", { length: 300 }).notNull(),
  difficulty: integer("difficulty"),
  volume: integer("volume"),
  cpc: decimal("cpc", { precision: 6, scale: 2 }),
  trend: varchar("trend", { length: 20 }),
  intent: varchar("intent", { length: 32, enum: ["informational", "navigational", "commercial", "transactional"] }),
  relatedKeywords: jsonb("relatedKeywords").$type<string[]>(),
  serps: jsonb("serps").$type<Array<{ title: string; url: string; position: number }>>(),
  aiVisibility: jsonb("aiVisibility").$type<{
    mentioned_in_chatgpt?: boolean;
    mentioned_in_gemini?: boolean;
    ai_competition?: string;
  }>(),
  saved: integer("saved").default(0),
  strategyId: integer("strategyId"),
  blogIdeas: jsonb("blogIdeas").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KeywordResearchItem = typeof keywordResearch.$inferSelect;
export type InsertKeywordResearchItem = typeof keywordResearch.$inferInsert;

// ─── Image Presets (GistStack: Custom Image Prompts) ─────
export const imagePresets = pgTable("image_presets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  promptPrefix: text("promptPrefix"),
  promptSuffix: text("promptSuffix"),
  model: varchar("model", { length: 100 }),
  style: varchar("style", { length: 100 }),
  referenceImages: jsonb("referenceImages").$type<string[]>(),
  characterConsistency: integer("characterConsistency").default(0),
  brandId: integer("brandId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ImagePreset = typeof imagePresets.$inferSelect;
export type InsertImagePreset = typeof imagePresets.$inferInsert;

// ─── Agent Chats (Interactive AI Agent Conversations) ────
export const agentChats = pgTable("agent_chats", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 300 }),
  agentIds: jsonb("agentIds").$type<string[]>().notNull(), // 1+ agent IDs in conversation
  mode: varchar("mode", { length: 32, enum: ["one_on_one", "group", "meeting"] }).default("one_on_one"),
  status: varchar("status", { length: 32, enum: ["active", "archived"] }).default("active"),
  messageCount: integer("messageCount").default(0),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type AgentChat = typeof agentChats.$inferSelect;
export type InsertAgentChat = typeof agentChats.$inferInsert;

export const agentMessages = pgTable("agent_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chatId").notNull(),
  role: varchar("role", { length: 32, enum: ["user", "agent"] }).notNull(),
  agentId: varchar("agentId", { length: 50 }), // null for user messages
  content: text("content").notNull(),
  model: varchar("model", { length: 100 }),
  tokens: integer("tokens"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = typeof agentMessages.$inferInsert;

// ─── Agent Assignments (Agents assigned to articles/projects) ──
export const agentAssignments = pgTable("agent_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  agentId: varchar("agentId", { length: 50 }).notNull(),
  targetType: varchar("targetType", { length: 32, enum: ["article", "project", "idea", "research"] }).notNull(),
  targetId: integer("targetId").notNull(),
  targetTitle: varchar("targetTitle", { length: 500 }),
  role: varchar("role", { length: 200 }), // what this agent does on this assignment
  status: varchar("status", { length: 32, enum: ["active", "completed", "removed"] }).default("active"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type AgentAssignment = typeof agentAssignments.$inferSelect;
export type InsertAgentAssignment = typeof agentAssignments.$inferInsert;

// ─── Agent Memories (Persistent knowledge per agent per user) ──
export const agentMemories = pgTable("agent_memories", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  agentId: varchar("agentId", { length: 50 }).notNull(),
  fact: text("fact").notNull(), // extracted fact or learning
  category: varchar("category", { length: 100 }), // preference, project, style, context
  importance: integer("importance").default(5), // 1-10 scale
  sourceChatId: integer("sourceChatId"), // which chat it was extracted from
  expiresAt: timestamp("expiresAt"), // null = permanent
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentMemory = typeof agentMemories.$inferSelect;
export type InsertAgentMemory = typeof agentMemories.$inferInsert;

// ─── Pulse Stories (Article Pulse → Elite Writer Pipeline) ──
export const pulseStories = pgTable("pulse_stories", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  // Story data from Article Pulse
  externalId: integer("externalId"), // original story ID from pulse briefing
  headline: varchar("headline", { length: 500 }).notNull(),
  source: varchar("source", { length: 1000 }),
  sourceDisplay: varchar("sourceDisplay", { length: 200 }),
  beat: varchar("beat", { length: 100 }).notNull(), // "AI & Enterprise Tech", "Women's Health", etc.
  urgency: varchar("urgency", { length: 32, enum: ["breaking", "this_week", "evergreen"] }).default("this_week").notNull(),
  urgencyEmoji: varchar("urgencyEmoji", { length: 10 }),
  whyItMatters: text("whyItMatters"),
  angle: text("angle"),
  contentType: varchar("contentType", { length: 200 }),
  priority: integer("priority"),
  // Pipeline status
  status: varchar("pulseStatus", { length: 32, enum: [
    "new", "reviewing", "writing", "in_pipeline", "published", "skipped"
  ] }).default("new").notNull(),
  // Audience & Publication matching (AI-enriched)
  matchedBrands: jsonb("matchedBrands").$type<{
    brandName: string;
    brandId?: number;
    relevanceScore: number;
    suggestedAngle: string;
  }[]>(),
  matchedPublications: jsonb("matchedPublications").$type<{
    publicationName: string;
    publicationId?: number;
    matchScore: number;
    payRange: string;
    whyItFits: string;
  }[]>(),
  // Data analysis metadata
  analysisData: jsonb("analysisData").$type<{
    sentimentScore?: number;
    viralPotential?: number;
    competitiveGap?: number;
    audienceSize?: string;
    trendDirection?: "rising" | "stable" | "declining";
    relatedStoryCount?: number;
  }>(),
  // Briefing grouping
  briefingDate: varchar("briefingDate", { length: 10 }).notNull(), // YYYY-MM-DD
  briefingRank: integer("briefingRank"), // Viktor's top-5 rank if applicable
  briefingReason: text("briefingReason"), // why Viktor ranked it
  // Article pipeline link
  articleId: integer("articleId"), // linked article when promoted to pipeline
  ideaId: integer("ideaId"), // linked idea when converted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type PulseStory = typeof pulseStories.$inferSelect;
export type InsertPulseStory = typeof pulseStories.$inferInsert;

// ─── Content Command HQ: Trending Topics ──────────────────
export const trendingTopics = pgTable("trending_topics", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  platform: varchar("platform", { length: 32, enum: [
    "linkedin", "twitter", "instagram", "facebook", "bluesky",
    "tiktok", "youtube", "reddit", "general"
  ] }).default("general").notNull(),
  category: varchar("category", { length: 100 }),
  trendScore: integer("trendScore").default(0),
  velocity: varchar("velocity", { length: 32, enum: ["rising", "stable", "declining"] }).default("rising"),
  suggestedAngles: jsonb("suggestedAngles").$type<string[]>(),
  sampleHeadlines: jsonb("sampleHeadlines").$type<string[]>(),
  relatedKeywords: jsonb("relatedKeywords").$type<string[]>(),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  brandId: integer("brandId"),
  status: varchar("trendStatus", { length: 32, enum: ["active", "used", "archived"] }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type TrendingTopic = typeof trendingTopics.$inferSelect;
export type InsertTrendingTopic = typeof trendingTopics.$inferInsert;

// ─── Content Command HQ: Content Calendar ─────────────────
export const contentCalendar = pgTable("content_calendar", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  scheduledDate: varchar("scheduledDate", { length: 10 }).notNull(), // YYYY-MM-DD
  scheduledTime: varchar("scheduledTime", { length: 5 }), // HH:MM
  platform: varchar("calPlatform", { length: 32, enum: [
    "linkedin", "twitter", "instagram", "facebook", "bluesky",
    "blog", "newsletter", "threads", "press", "tiktok", "youtube"
  ] }).default("linkedin").notNull(),
  contentType: varchar("calContentType", { length: 32, enum: [
    "post", "thread", "article", "carousel", "story", "reel",
    "press_release", "newsletter", "video"
  ] }).default("post").notNull(),
  status: varchar("calStatus", { length: 32, enum: [
    "planned", "drafting", "review", "approved", "scheduled", "published"
  ] }).default("planned").notNull(),
  brandId: integer("brandId"),
  contentItemId: integer("contentItemId"), // link to studio item
  assignee: varchar("assignee", { length: 200 }),
  color: varchar("color", { length: 20 }),
  metadata: jsonb("calMeta").$type<{
    notes?: string;
    tags?: string[];
    campaignId?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ContentCalendarItem = typeof contentCalendar.$inferSelect;
export type InsertContentCalendarItem = typeof contentCalendar.$inferInsert;

// ─── Content Command HQ: AI Interviews ────────────────────
export const aiInterviews = pgTable("ai_interviews", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  brandId: integer("brandId"),
  title: varchar("title", { length: 500 }).notNull(),
  topic: varchar("topic", { length: 200 }),
  topicPack: varchar("topicPack", { length: 32, enum: [
    "brand_foundations", "content_strategy", "audience_deep_dive", "custom"
  ] }).default("custom").notNull(),
  questions: jsonb("questions").$type<Array<{
    id: string;
    question: string;
    answer: string | null;
    order: number;
  }>>(),
  extractedInsights: jsonb("extractedInsights").$type<string[]>(),
  status: varchar("interviewStatus", { length: 32, enum: [
    "not_started", "in_progress", "completed", "archived"
  ] }).default("not_started").notNull(),
  completeness: integer("completeness").default(0), // 0-100
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type AiInterview = typeof aiInterviews.$inferSelect;
export type InsertAiInterview = typeof aiInterviews.$inferInsert;

// ─── Content Command HQ: Content Studio Items ─────────────
export const contentStudioItems = pgTable("content_studio_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  platform: varchar("studioPlatform", { length: 32, enum: [
    "linkedin", "twitter", "instagram", "facebook", "bluesky",
    "blog", "newsletter", "threads", "press"
  ] }).default("linkedin").notNull(),
  contentType: varchar("studioContentType", { length: 32, enum: [
    "post", "thread", "article", "carousel", "story", "reel",
    "press_release", "newsletter"
  ] }).default("post").notNull(),
  status: varchar("studioStatus", { length: 32, enum: [
    "draft", "review", "approved", "scheduled", "published", "archived"
  ] }).default("draft").notNull(),
  charCount: integer("charCount").default(0),
  brandId: integer("brandId"),
  sourceInsightId: integer("sourceInsightId"), // linked insight that inspired it
  trendingTopicId: integer("trendingTopicId"), // linked trending topic
  imageUrl: varchar("studioImageUrl", { length: 1000 }),
  publishUrl: varchar("publishUrl", { length: 1000 }),
  publishedAt: timestamp("publishedAt"),
  metadata: jsonb("studioMeta").$type<{
    hashtags?: string[];
    mentions?: string[];
    hooks?: string[];
    cta?: string;
    targetAudience?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ContentStudioItem = typeof contentStudioItems.$inferSelect;
export type InsertContentStudioItem = typeof contentStudioItems.$inferInsert;

// ─── Workspace Module (Notion/Airtable-style pages + databases) ───────────
// Generic JSON documents with last-write-wins sync; client keeps a Dexie
// cache and pushes/pulls through the workspace tRPC router.
export const wsPages = pgTable("wsPages", {
  id: varchar("id", { length: 32 }).primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull().default(0),
  deleted: boolean("deleted").notNull().default(false),
});

export const wsDatabases = pgTable("wsDatabases", {
  id: varchar("id", { length: 32 }).primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull().default(0),
  deleted: boolean("deleted").notNull().default(false),
});

export const wsRows = pgTable("wsRows", {
  id: varchar("id", { length: 32 }).primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull().default(0),
  deleted: boolean("deleted").notNull().default(false),
});

// ─── Research Library (P1) ───────────────────────────────────
// Folder hierarchy for organizing research items
export const researchFolders = pgTable("research_folders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  parentId: integer("parentId"),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ResearchFolder = typeof researchFolders.$inferSelect;
export type InsertResearchFolder = typeof researchFolders.$inferInsert;

// Projects group research items around a writing initiative
export const researchProjects = pgTable("research_projects", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  status: varchar("rpStatus", { length: 32, enum: ["active", "archived"] }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});
export type ResearchProject = typeof researchProjects.$inferSelect;
export type InsertResearchProject = typeof researchProjects.$inferInsert;

// Core library item — metadata in DB, full body in R2 (r2Key)
export const researchItems = pgTable("research_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  folderId: integer("folderId"),
  projectId: integer("projectId"),
  contentType: varchar("contentType", { length: 40 }).notNull().default("webpage"), // webpage | pdf | video | academic | manual
  title: varchar("title", { length: 700 }).notNull(),
  url: varchar("url", { length: 2000 }),
  r2Key: varchar("r2Key", { length: 500 }), // full body/PDF stored in R2
  authors: jsonb("authors"),       // string[]
  year: integer("year"),
  doi: varchar("doi", { length: 200 }),
  publication: varchar("publication", { length: 300 }),
  abstract: text("abstract"),
  tags: jsonb("tags"),             // string[]
  refKey: varchar("refKey", { length: 100 }), // user cite key e.g. smith2024a
  source: varchar("source", { length: 120 }), // academic | brave | youtube | manual | …
  citationCount: integer("citationCount").default(0),
  status: varchar("riStatus", { length: 32, enum: ["inbox", "saved", "archived"] }).default("inbox").notNull(),
  notes: text("notes"),
  metadata: jsonb("metadata"),     // flexible extras (thumbnailUrl, duration, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});
export type ResearchItem = typeof researchItems.$inferSelect;
export type InsertResearchItem = typeof researchItems.$inferInsert;

// Highlights — text selections + annotations on a research item
export const researchHighlights = pgTable("research_highlights", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  itemId: integer("itemId").notNull(),
  text: text("text").notNull(),
  note: text("note"),
  color: varchar("color", { length: 20 }).default("yellow"),
  position: jsonb("position"), // {charStart?, charEnd?, page?}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ResearchHighlight = typeof researchHighlights.$inferSelect;
export type InsertResearchHighlight = typeof researchHighlights.$inferInsert;

// Backlinks — article ↔ research item associations
export const articleResearch = pgTable("article_research", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  articleId: integer("articleId").notNull(),
  itemId: integer("itemId").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ArticleResearch = typeof articleResearch.$inferSelect;
export type InsertArticleResearch = typeof articleResearch.$inferInsert;

// P3a: Research Series — normalized series entity for grouping articles
export const researchSeries = pgTable("research_series", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ResearchSeries = typeof researchSeries.$inferSelect;
export type InsertResearchSeries = typeof researchSeries.$inferInsert;

// P3a: Article tags — normalized per-article tags (filterable)
export const articleTag = pgTable("article_tag", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  articleId: integer("articleId").notNull(),
  tag: varchar("tag", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ArticleTag = typeof articleTag.$inferSelect;
export type InsertArticleTag = typeof articleTag.$inferInsert;

// P3a: Research share links — unguessable share tokens for folders/items/projects
export const researchShare = pgTable("research_share", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  ownerType: varchar("ownerType", { length: 32, enum: ["folder", "item", "project"] }).notNull(),
  ownerId: integer("ownerId").notNull(),
  userId: integer("userId").notNull(),
  revoked: integer("revoked").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ResearchShare = typeof researchShare.$inferSelect;
export type InsertResearchShare = typeof researchShare.$inferInsert;

// Template SOPs — one per writing template, editable in-app.
// The Drafter injects the active SOP into its system prompt so output
// follows the section order, word targets, evidence rules, etc.
export const templateSops = pgTable("template_sops", {
  id: serial("id").primaryKey(),
  templateId: varchar("templateId", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  purpose: text("purpose"),
  sections: jsonb("sections"), // [{heading, h_level, wordTarget, notes}]
  tone: text("tone"),
  hookPattern: text("hookPattern"),
  evidenceRules: text("evidenceRules"),
  visualSlots: jsonb("visualSlots"), // [{afterSection, type, description}]
  ctaClose: text("ctaClose"),
  seoPattern: text("seoPattern"),
  publicationFit: text("publicationFit"),
  isSeeded: boolean("isSeeded").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().$onUpdate(() => new Date()),
});
