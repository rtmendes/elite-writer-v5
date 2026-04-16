import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
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

/**
 * Article Ideas — the pipeline from concept to publication
 */
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

/**
 * Articles — drafts and published content
 */
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

/**
 * Pitches — email pitches sent to publications
 */
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

/**
 * Research Notes — data, sources, and evidence for articles
 */
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

/**
 * Brands — business brands aligned with publications
 */
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

/**
 * Products — digital products tied to brands
 */
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

/**
 * Earnings — revenue tracking from content and products
 */
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

/**
 * Intelligence Feed — saved Giststack items
 */
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
