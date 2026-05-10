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
  // Gap #6: Sentiment persistence — stores sentiment, viral_score, niche_tags, etc.
  metadata: json("metadata").$type<{
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

// ─── User Settings (DB-persisted) ─────────────────────────
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  settings: json("settings").$type<{
    openai_key?: string;
    brand_voice?: string;
    daily_target?: number;
    monthly_revenue_goal?: number;
    content_revenue_goal?: number;
    product_revenue_goal?: number;
    tracked_topics?: string[];
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

// ═══════════════════════════════════════════════════════════
// NEW TABLES — Blazly + GistStack Feature Integration
// ═══════════════════════════════════════════════════════════

// ─── Social Posts (GistStack: Social Content Engine) ──────
export const socialPosts = mysqlTable("social_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  brandId: int("brandId"),
  platform: mysqlEnum("platform", ["twitter", "linkedin", "facebook", "reddit", "threads", "instagram"]).notNull(),
  postType: mysqlEnum("postType", ["single", "thread", "carousel", "poll"]).default("single").notNull(),
  content: text("content").notNull(),
  threadParts: json("threadParts").$type<string[]>(),
  hashtags: json("hashtags").$type<string[]>(),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  imagePrompt: text("imagePrompt"),
  sourceArticleId: int("sourceArticleId"),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  sourceTitle: varchar("sourceTitle", { length: 500 }),
  tone: varchar("tone", { length: 100 }),
  language: varchar("language", { length: 50 }).default("en"),
  score: int("score"),
  scoreData: json("scoreData").$type<{
    engagement_potential?: number;
    hook_strength?: number;
    cta_clarity?: number;
    brand_alignment?: number;
    platform_fit?: number;
  }>(),
  status: mysqlEnum("socialPostStatus", ["draft", "approved", "scheduled", "published"]).default("draft").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  publishedAt: timestamp("publishedAt"),
  webhookUrl: varchar("webhookUrl", { length: 1000 }),
  metadata: json("socialPostMeta").$type<{
    context_ideas?: string[];
    brand_lens?: string;
    source_insights?: string[];
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

// ─── Content Sources (GistStack: YouTube, Reddit, Newsletter, Non-RSS) ──
export const contentSources = mysqlTable("content_sources", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("sourceType", ["youtube", "reddit", "newsletter", "website", "rss"]).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  identifier: varchar("identifier", { length: 500 }).notNull(), // channel ID, subreddit, email, URL
  iconUrl: varchar("iconUrl", { length: 1000 }),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  active: int("active").default(1),
  fetchFrequency: mysqlEnum("fetchFrequency", ["hourly", "daily", "weekly"]).default("daily"),
  lastFetched: timestamp("lastFetched"),
  itemCount: int("itemCount").default(0),
  metadata: json("sourceMeta").$type<{
    subscriber_count?: number;
    subreddit_members?: number;
    newsletter_email?: string;
    scrape_selector?: string;
    youtube_playlist_id?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentSource = typeof contentSources.$inferSelect;
export type InsertContentSource = typeof contentSources.$inferInsert;

// ─── Source Items (fetched content from sources) ──────────
export const sourceItems = mysqlTable("source_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceId: int("sourceId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  summary: text("summary"),
  url: varchar("url", { length: 1000 }),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  author: varchar("author", { length: 200 }),
  publishedAt: timestamp("publishedAt"),
  relevanceScore: int("relevanceScore"),
  viralScore: int("viralScore"),
  sentiment: varchar("sentiment", { length: 20 }),
  keyInsights: json("keyInsights").$type<string[]>(),
  processed: int("processed").default(0),
  saved: int("saved").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SourceItem = typeof sourceItems.$inferSelect;
export type InsertSourceItem = typeof sourceItems.$inferInsert;

// ─── Content Library (GistStack: My Content) ─────────────
export const contentLibrary = mysqlTable("content_library", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("contentType", ["social_post", "article_excerpt", "quote", "idea", "template"]).notNull(),
  platform: varchar("platform", { length: 50 }),
  title: varchar("title", { length: 500 }),
  content: text("content").notNull(),
  tags: json("contentTags").$type<string[]>(),
  brandId: int("brandId"),
  sourcePostId: int("sourcePostId"),
  usageCount: int("usageCount").default(0),
  starred: int("starred").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentLibraryItem = typeof contentLibrary.$inferSelect;
export type InsertContentLibraryItem = typeof contentLibrary.$inferInsert;

// ─── Image Library (GistStack: Asset Library) ─────────────
export const imageLibrary = mysqlTable("image_library", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 1000 }).notNull(),
  thumbnailUrl: varchar("thumbnailUrl", { length: 1000 }),
  prompt: text("prompt"),
  model: varchar("model", { length: 100 }),
  style: varchar("style", { length: 100 }),
  tags: json("imageTags").$type<string[]>(),
  brandId: int("brandId"),
  width: int("width"),
  height: int("height"),
  presetName: varchar("presetName", { length: 200 }),
  metadata: json("imageMeta").$type<{
    reference_images?: string[];
    character_consistency?: boolean;
    brand_colors?: string[];
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImageLibraryItem = typeof imageLibrary.$inferSelect;
export type InsertImageLibraryItem = typeof imageLibrary.$inferInsert;

// ─── Brand Contexts (GistStack: Brand Context/Lens) ──────
export const brandContexts = mysqlTable("brand_contexts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  brandId: int("brandId"),
  name: varchar("name", { length: 200 }).notNull(),
  website: varchar("website", { length: 500 }),
  voice: text("voice"),
  tone: text("tone"),
  audience: text("audience"),
  values: json("brandValues").$type<string[]>(),
  keywords: json("brandKeywords").$type<string[]>(),
  competitors: json("competitors").$type<string[]>(),
  contentPillars: json("contentPillars").$type<string[]>(),
  avoidTopics: json("avoidTopics").$type<string[]>(),
  sampleContent: json("sampleContent").$type<string[]>(),
  languagePreferences: json("languagePreferences").$type<{
    primary: string;
    additional?: string[];
    formality?: string;
    jargon_level?: string;
  }>(),
  imagePreferences: json("imagePreferences").$type<{
    style?: string;
    colors?: string[];
    reference_images?: string[];
    character_refs?: string[];
    custom_prompt_prefix?: string;
  }>(),
  autoResearched: int("autoResearched").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandContext = typeof brandContexts.$inferSelect;
export type InsertBrandContext = typeof brandContexts.$inferInsert;

// ─── GEO Projects (Blazly: GEO/AEO Suite) ───────────────
export const geoProjects = mysqlTable("geo_projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  websiteUrl: varchar("websiteUrl", { length: 500 }).notNull(),
  competitors: json("geoCompetitors").$type<string[]>(),
  monitorKeywords: json("monitorKeywords").$type<string[]>(),
  targetLocation: varchar("targetLocation", { length: 100 }).default("global"),
  lastCrawled: timestamp("lastCrawled"),
  lastMonitored: timestamp("lastMonitored"),
  overallGeoScore: int("overallGeoScore"),
  metadata: json("geoMeta").$type<{
    pages_crawled?: number;
    avg_geo_score?: number;
    brand_sentiment?: Record<string, number>;
    competitor_scores?: Record<string, number>;
    llm_visibility?: Record<string, number>;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GeoProject = typeof geoProjects.$inferSelect;
export type InsertGeoProject = typeof geoProjects.$inferInsert;

// ─── GEO Scores (per-page tracking) ──────────────────────
export const geoScores = mysqlTable("geo_scores", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  pageUrl: varchar("pageUrl", { length: 1000 }).notNull(),
  pageTitle: varchar("pageTitle", { length: 500 }),
  geoScore: int("geoScore"),
  aeoScore: int("aeoScore"),
  seoScore: int("seoScore"),
  llmVisibility: json("llmVisibility").$type<{
    chatgpt?: { position?: number; cited?: boolean; sentiment?: string };
    gemini?: { position?: number; cited?: boolean; sentiment?: string };
    claude?: { position?: number; cited?: boolean; sentiment?: string };
    perplexity?: { position?: number; cited?: boolean; sentiment?: string };
  }>(),
  recommendations: json("recommendations").$type<string[]>(),
  contentGaps: json("contentGaps").$type<string[]>(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeoScore = typeof geoScores.$inferSelect;
export type InsertGeoScore = typeof geoScores.$inferInsert;

// ─── Content Strategies (Blazly: Strategy Builder) ────────
export const contentStrategies = mysqlTable("content_strategies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  brandId: int("brandId"),
  name: varchar("name", { length: 300 }).notNull(),
  primaryKeyword: varchar("primaryKeyword", { length: 200 }).notNull(),
  pillarTopic: varchar("pillarTopic", { length: 500 }),
  pillarContent: text("pillarContent"),
  clusters: json("clusters").$type<Array<{
    keyword: string;
    title: string;
    status: "planned" | "drafted" | "published";
    articleId?: number;
    difficulty?: number;
    volume?: number;
    intent?: string;
  }>>(),
  enhanced: int("enhanced").default(0),
  totalArticles: int("totalArticles").default(0),
  publishedArticles: int("publishedArticles").default(0),
  status: mysqlEnum("strategyStatus", ["draft", "active", "executing", "completed"]).default("draft").notNull(),
  metadata: json("strategyMeta").$type<{
    target_authority?: number;
    estimated_traffic?: number;
    competition_level?: string;
    content_gap_analysis?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentStrategy = typeof contentStrategies.$inferSelect;
export type InsertContentStrategy = typeof contentStrategies.$inferInsert;

// ─── Keyword Research (Blazly: Keyword Discovery) ────────
export const keywordResearch = mysqlTable("keyword_research", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  keyword: varchar("keyword", { length: 300 }).notNull(),
  difficulty: int("difficulty"),
  volume: int("volume"),
  cpc: decimal("cpc", { precision: 6, scale: 2 }),
  trend: varchar("trend", { length: 20 }),
  intent: mysqlEnum("intent", ["informational", "navigational", "commercial", "transactional"]),
  relatedKeywords: json("relatedKeywords").$type<string[]>(),
  serps: json("serps").$type<Array<{ title: string; url: string; position: number }>>(),
  aiVisibility: json("aiVisibility").$type<{
    mentioned_in_chatgpt?: boolean;
    mentioned_in_gemini?: boolean;
    ai_competition?: string;
  }>(),
  saved: int("saved").default(0),
  strategyId: int("strategyId"),
  blogIdeas: json("blogIdeas").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KeywordResearchItem = typeof keywordResearch.$inferSelect;
export type InsertKeywordResearchItem = typeof keywordResearch.$inferInsert;

// ─── Image Presets (GistStack: Custom Image Prompts) ─────
export const imagePresets = mysqlTable("image_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  promptPrefix: text("promptPrefix"),
  promptSuffix: text("promptSuffix"),
  model: varchar("model", { length: 100 }),
  style: varchar("style", { length: 100 }),
  referenceImages: json("referenceImages").$type<string[]>(),
  characterConsistency: int("characterConsistency").default(0),
  brandId: int("brandId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImagePreset = typeof imagePresets.$inferSelect;
export type InsertImagePreset = typeof imagePresets.$inferInsert;

// ─── Agent Chats (Interactive AI Agent Conversations) ────
export const agentChats = mysqlTable("agent_chats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 300 }),
  agentIds: json("agentIds").$type<string[]>().notNull(), // 1+ agent IDs in conversation
  mode: mysqlEnum("mode", ["one_on_one", "group", "meeting"]).default("one_on_one"),
  status: mysqlEnum("status", ["active", "archived"]).default("active"),
  messageCount: int("messageCount").default(0),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentChat = typeof agentChats.$inferSelect;
export type InsertAgentChat = typeof agentChats.$inferInsert;

export const agentMessages = mysqlTable("agent_messages", {
  id: int("id").autoincrement().primaryKey(),
  chatId: int("chatId").notNull(),
  role: mysqlEnum("role", ["user", "agent"]).notNull(),
  agentId: varchar("agentId", { length: 50 }), // null for user messages
  content: text("content").notNull(),
  model: varchar("model", { length: 100 }),
  tokens: int("tokens"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = typeof agentMessages.$inferInsert;

// ─── Agent Assignments (Agents assigned to articles/projects) ──
export const agentAssignments = mysqlTable("agent_assignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agentId: varchar("agentId", { length: 50 }).notNull(),
  targetType: mysqlEnum("targetType", ["article", "project", "idea", "research"]).notNull(),
  targetId: int("targetId").notNull(),
  targetTitle: varchar("targetTitle", { length: 500 }),
  role: varchar("role", { length: 200 }), // what this agent does on this assignment
  status: mysqlEnum("status", ["active", "completed", "removed"]).default("active"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentAssignment = typeof agentAssignments.$inferSelect;
export type InsertAgentAssignment = typeof agentAssignments.$inferInsert;

// ─── Agent Memories (Persistent knowledge per agent per user) ──
export const agentMemories = mysqlTable("agent_memories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agentId: varchar("agentId", { length: 50 }).notNull(),
  fact: text("fact").notNull(), // extracted fact or learning
  category: varchar("category", { length: 100 }), // preference, project, style, context
  importance: int("importance").default(5), // 1-10 scale
  sourceChatId: int("sourceChatId"), // which chat it was extracted from
  expiresAt: timestamp("expiresAt"), // null = permanent
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentMemory = typeof agentMemories.$inferSelect;
export type InsertAgentMemory = typeof agentMemories.$inferInsert;

// ─── Pulse Stories (Article Pulse → Elite Writer Pipeline) ──
export const pulseStories = mysqlTable("pulse_stories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  // Story data from Article Pulse
  externalId: int("externalId"), // original story ID from pulse briefing
  headline: varchar("headline", { length: 500 }).notNull(),
  source: varchar("source", { length: 1000 }),
  sourceDisplay: varchar("sourceDisplay", { length: 200 }),
  beat: varchar("beat", { length: 100 }).notNull(), // "AI & Enterprise Tech", "Women's Health", etc.
  urgency: mysqlEnum("urgency", ["breaking", "this_week", "evergreen"]).default("this_week").notNull(),
  urgencyEmoji: varchar("urgencyEmoji", { length: 10 }),
  whyItMatters: text("whyItMatters"),
  angle: text("angle"),
  contentType: varchar("contentType", { length: 200 }),
  priority: int("priority"),
  // Pipeline status
  status: mysqlEnum("pulseStatus", [
    "new", "reviewing", "writing", "in_pipeline", "published", "skipped"
  ]).default("new").notNull(),
  // Audience & Publication matching (AI-enriched)
  matchedBrands: json("matchedBrands").$type<{
    brandName: string;
    brandId?: number;
    relevanceScore: number;
    suggestedAngle: string;
  }[]>(),
  matchedPublications: json("matchedPublications").$type<{
    publicationName: string;
    publicationId?: number;
    matchScore: number;
    payRange: string;
    whyItFits: string;
  }[]>(),
  // Data analysis metadata
  analysisData: json("analysisData").$type<{
    sentimentScore?: number;
    viralPotential?: number;
    competitiveGap?: number;
    audienceSize?: string;
    trendDirection?: "rising" | "stable" | "declining";
    relatedStoryCount?: number;
  }>(),
  // Briefing grouping
  briefingDate: varchar("briefingDate", { length: 10 }).notNull(), // YYYY-MM-DD
  briefingRank: int("briefingRank"), // Viktor's top-5 rank if applicable
  briefingReason: text("briefingReason"), // why Viktor ranked it
  // Article pipeline link
  articleId: int("articleId"), // linked article when promoted to pipeline
  ideaId: int("ideaId"), // linked idea when converted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PulseStory = typeof pulseStories.$inferSelect;
export type InsertPulseStory = typeof pulseStories.$inferInsert;
