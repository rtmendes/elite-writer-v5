CREATE TABLE "agent_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"agentId" varchar(50) NOT NULL,
	"targetType" varchar(32) NOT NULL,
	"targetId" integer NOT NULL,
	"targetTitle" varchar(500),
	"role" varchar(200),
	"status" varchar(32) DEFAULT 'active',
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(300),
	"agentIds" jsonb NOT NULL,
	"mode" varchar(32) DEFAULT 'one_on_one',
	"status" varchar(32) DEFAULT 'active',
	"messageCount" integer DEFAULT 0,
	"lastMessageAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"agentId" varchar(50) NOT NULL,
	"fact" text NOT NULL,
	"category" varchar(100),
	"importance" integer DEFAULT 5,
	"sourceChatId" integer,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"chatId" integer NOT NULL,
	"role" varchar(32) NOT NULL,
	"agentId" varchar(50),
	"content" text NOT NULL,
	"model" varchar(100),
	"tokens" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_interviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"brandId" integer,
	"title" varchar(500) NOT NULL,
	"topic" varchar(200),
	"topicPack" varchar(32) DEFAULT 'custom' NOT NULL,
	"questions" jsonb,
	"extractedInsights" jsonb,
	"interviewStatus" varchar(32) DEFAULT 'not_started' NOT NULL,
	"completeness" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" varchar(10) NOT NULL,
	"model" varchar(200) NOT NULL,
	"promptTokens" integer DEFAULT 0 NOT NULL,
	"completionTokens" integer DEFAULT 0 NOT NULL,
	"costMicros" bigint DEFAULT 0 NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_research" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"articleId" integer NOT NULL,
	"itemId" integer NOT NULL,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"articleId" integer NOT NULL,
	"tag" varchar(100) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text,
	"template" varchar(100),
	"brandVoice" varchar(100),
	"wordCount" integer,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"overallScore" integer,
	"scoreData" jsonb,
	"targetPublication" varchar(200),
	"brandId" varchar(100),
	"productId" varchar(100),
	"styleProfile" jsonb,
	"sources" jsonb,
	"importedFrom" varchar(500),
	"article_number" integer,
	"series_id" integer,
	"is_money_page" integer DEFAULT 0 NOT NULL,
	"primary_offer_id" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_contexts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"brandId" integer,
	"name" varchar(200) NOT NULL,
	"website" varchar(500),
	"voice" text,
	"tone" text,
	"audience" text,
	"brandValues" jsonb,
	"brandKeywords" jsonb,
	"competitors" jsonb,
	"contentPillars" jsonb,
	"avoidTopics" jsonb,
	"sampleContent" jsonb,
	"languagePreferences" jsonb,
	"imagePreferences" jsonb,
	"autoResearched" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"niche" varchar(200),
	"website" varchar(500),
	"color" varchar(20),
	"alignedPublications" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"scheduledDate" varchar(10) NOT NULL,
	"scheduledTime" varchar(5),
	"calPlatform" varchar(32) DEFAULT 'linkedin' NOT NULL,
	"calContentType" varchar(32) DEFAULT 'post' NOT NULL,
	"calStatus" varchar(32) DEFAULT 'planned' NOT NULL,
	"brandId" integer,
	"contentItemId" integer,
	"assignee" varchar(200),
	"color" varchar(20),
	"calMeta" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"contentType" varchar(32) NOT NULL,
	"platform" varchar(50),
	"title" varchar(500),
	"content" text NOT NULL,
	"contentTags" jsonb,
	"brandId" integer,
	"sourcePostId" integer,
	"usageCount" integer DEFAULT 0,
	"starred" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sourceType" varchar(32) NOT NULL,
	"name" varchar(300) NOT NULL,
	"identifier" varchar(500) NOT NULL,
	"iconUrl" varchar(1000),
	"description" text,
	"category" varchar(100),
	"active" integer DEFAULT 1,
	"fetchFrequency" varchar(32) DEFAULT 'daily',
	"lastFetched" timestamp,
	"itemCount" integer DEFAULT 0,
	"sourceMeta" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"brandId" integer,
	"name" varchar(300) NOT NULL,
	"primaryKeyword" varchar(200) NOT NULL,
	"pillarTopic" varchar(500),
	"pillarContent" text,
	"clusters" jsonb,
	"enhanced" integer DEFAULT 0,
	"totalArticles" integer DEFAULT 0,
	"publishedArticles" integer DEFAULT 0,
	"strategyStatus" varchar(32) DEFAULT 'draft' NOT NULL,
	"strategyMeta" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_studio_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"body" text,
	"studioPlatform" varchar(32) DEFAULT 'linkedin' NOT NULL,
	"studioContentType" varchar(32) DEFAULT 'post' NOT NULL,
	"studioStatus" varchar(32) DEFAULT 'draft' NOT NULL,
	"charCount" integer DEFAULT 0,
	"brandId" integer,
	"sourceInsightId" integer,
	"trendingTopicId" integer,
	"studioImageUrl" varchar(1000),
	"publishUrl" varchar(1000),
	"publishedAt" timestamp,
	"studioMeta" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"date" varchar(10) NOT NULL,
	"content" jsonb,
	"newsItemIds" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"source" varchar(200) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text,
	"brandId" integer,
	"date" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_seen" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sourceId" integer NOT NULL,
	"urlHash" varchar(40) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"feedType" varchar(32) DEFAULT 'rss' NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" varchar(1000),
	"emailFrom" varchar(320),
	"keywords" jsonb,
	"active" integer DEFAULT 1,
	"lastFetched" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"funnelType" varchar(50),
	"productName" varchar(200),
	"productDescription" text,
	"targetAudience" text,
	"pricePoint" varchar(50),
	"stages" jsonb,
	"score" integer,
	"scoreData" jsonb,
	"optimizationData" jsonb,
	"funnelStatus" varchar(32) DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"prompt" text,
	"imageUrl" varchar(1000),
	"model" varchar(100),
	"style" varchar(100),
	"articleId" integer,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"websiteUrl" varchar(500) NOT NULL,
	"geoCompetitors" jsonb,
	"monitorKeywords" jsonb,
	"targetLocation" varchar(100) DEFAULT 'global',
	"lastCrawled" timestamp,
	"lastMonitored" timestamp,
	"overallGeoScore" integer,
	"geoMeta" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"userId" integer NOT NULL,
	"pageUrl" varchar(1000) NOT NULL,
	"pageTitle" varchar(500),
	"geoScore" integer,
	"aeoScore" integer,
	"seoScore" integer,
	"llmVisibility" jsonb,
	"recommendations" jsonb,
	"contentGaps" jsonb,
	"checkedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"tokenType" varchar(50),
	"expiresAt" timestamp,
	"scope" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"angle" text,
	"category" varchar(100),
	"newsPeg" text,
	"status" varchar(32) DEFAULT 'idea' NOT NULL,
	"score" integer,
	"brandId" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"imageUrl" varchar(1000) NOT NULL,
	"thumbnailUrl" varchar(1000),
	"prompt" text,
	"model" varchar(100),
	"style" varchar(100),
	"imageTags" jsonb,
	"brandId" integer,
	"width" integer,
	"height" integer,
	"presetName" varchar(200),
	"imageMeta" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"promptPrefix" text,
	"promptSuffix" text,
	"model" varchar(100),
	"style" varchar(100),
	"referenceImages" jsonb,
	"characterConsistency" integer DEFAULT 0,
	"brandId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text,
	"source" varchar(200),
	"url" varchar(1000),
	"category" varchar(100),
	"relevanceScore" integer,
	"saved" integer DEFAULT 0,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_learnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"learningType" varchar(100),
	"pattern" text,
	"confidence" numeric(5, 2),
	"sourceArticleIds" jsonb,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text,
	"category" varchar(100),
	"subcategory" varchar(100),
	"tags" jsonb,
	"useCases" jsonb,
	"source" varchar(300),
	"sourceUrl" varchar(1000),
	"tokenCount" integer,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_research" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"keyword" varchar(300) NOT NULL,
	"difficulty" integer,
	"volume" integer,
	"cpc" numeric(6, 2),
	"trend" varchar(20),
	"intent" varchar(32),
	"relatedKeywords" jsonb,
	"serps" jsonb,
	"aiVisibility" jsonb,
	"saved" integer DEFAULT 0,
	"strategyId" integer,
	"blogIdeas" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"assetType" varchar(100) NOT NULL,
	"name" varchar(300) NOT NULL,
	"content" text,
	"topic" varchar(300),
	"score" integer,
	"scoreData" jsonb,
	"metadata" jsonb,
	"assetStatus" varchar(32) DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"title" varchar(500) NOT NULL,
	"description" text,
	"url" varchar(1000),
	"imageUrl" varchar(1000),
	"source" varchar(200),
	"sourceName" varchar(200),
	"category" varchar(100),
	"publishedAt" timestamp,
	"relevanceScore" integer,
	"processed" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitches" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"publicationId" varchar(100) NOT NULL,
	"publicationName" varchar(200),
	"editorName" varchar(200),
	"editorEmail" varchar(320),
	"subject" varchar(500) NOT NULL,
	"body" text,
	"articleTitle" varchar(500),
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"brandId" integer,
	"articleId" integer,
	"name" varchar(200) NOT NULL,
	"type" varchar(100),
	"price" numeric(10, 2),
	"description" text,
	"funnelUrl" varchar(500),
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"slug" varchar(200) NOT NULL,
	"name" varchar(300) NOT NULL,
	"url" varchar(500),
	"category" varchar(100),
	"payRange" varchar(100),
	"payMin" integer,
	"payMax" integer,
	"acceptsFreelance" integer DEFAULT 1,
	"submissionUrl" varchar(500),
	"editorName" varchar(200),
	"editorEmail" varchar(320),
	"guidelines" text,
	"notes" text,
	"topics" jsonb,
	"tier" integer DEFAULT 2,
	"audienceAvatar" text,
	"editorPreferences" text,
	"responseTime" varchar(100),
	"templateData" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"externalId" integer,
	"headline" varchar(500) NOT NULL,
	"source" varchar(1000),
	"sourceDisplay" varchar(200),
	"beat" varchar(100) NOT NULL,
	"urgency" varchar(32) DEFAULT 'this_week' NOT NULL,
	"urgencyEmoji" varchar(10),
	"whyItMatters" text,
	"angle" text,
	"contentType" varchar(200),
	"priority" integer,
	"pulseStatus" varchar(32) DEFAULT 'new' NOT NULL,
	"matchedBrands" jsonb,
	"matchedPublications" jsonb,
	"analysisData" jsonb,
	"briefingDate" varchar(10) NOT NULL,
	"briefingRank" integer,
	"briefingReason" text,
	"articleId" integer,
	"ideaId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"parentId" integer,
	"color" varchar(20),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"itemId" integer NOT NULL,
	"text" text NOT NULL,
	"note" text,
	"color" varchar(20) DEFAULT 'yellow',
	"position" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"folderId" integer,
	"projectId" integer,
	"contentType" varchar(40) DEFAULT 'webpage' NOT NULL,
	"title" varchar(700) NOT NULL,
	"url" varchar(2000),
	"r2Key" varchar(500),
	"authors" jsonb,
	"year" integer,
	"doi" varchar(200),
	"publication" varchar(300),
	"abstract" text,
	"tags" jsonb,
	"refKey" varchar(100),
	"source" varchar(120),
	"citationCount" integer DEFAULT 0,
	"riStatus" varchar(32) DEFAULT 'inbox' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text,
	"sources" jsonb,
	"dataPoints" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text,
	"rpStatus" varchar(32) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(40) DEFAULT 'article' NOT NULL,
	"title" varchar(700) NOT NULL,
	"authors" jsonb,
	"year" integer,
	"doi" varchar(200),
	"url" varchar(1000),
	"abstract" text,
	"source" varchar(120),
	"citationCount" integer DEFAULT 0,
	"tags" jsonb,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_share" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"ownerType" varchar(32) NOT NULL,
	"ownerId" integer NOT NULL,
	"userId" integer NOT NULL,
	"revoked" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"brandId" integer,
	"platform" varchar(32) NOT NULL,
	"postType" varchar(32) DEFAULT 'single' NOT NULL,
	"content" text NOT NULL,
	"threadParts" jsonb,
	"hashtags" jsonb,
	"imageUrl" varchar(1000),
	"imagePrompt" text,
	"sourceArticleId" integer,
	"sourceUrl" varchar(1000),
	"sourceTitle" varchar(500),
	"tone" varchar(100),
	"language" varchar(50) DEFAULT 'en',
	"score" integer,
	"scoreData" jsonb,
	"socialPostStatus" varchar(32) DEFAULT 'draft' NOT NULL,
	"scheduledAt" timestamp,
	"publishedAt" timestamp,
	"webhookUrl" varchar(1000),
	"socialPostMeta" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sourceId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text,
	"summary" text,
	"url" varchar(1000),
	"imageUrl" varchar(1000),
	"author" varchar(200),
	"publishedAt" timestamp,
	"relevanceScore" integer,
	"viralScore" integer,
	"sentiment" varchar(20),
	"keyInsights" jsonb,
	"processed" integer DEFAULT 0,
	"saved" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"analysisData" jsonb,
	"sampleArticleIds" jsonb,
	"attributes" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_sops" (
	"id" serial PRIMARY KEY NOT NULL,
	"templateId" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"purpose" text,
	"sections" jsonb,
	"tone" text,
	"hookPattern" text,
	"evidenceRules" text,
	"visualSlots" jsonb,
	"ctaClose" text,
	"seoPattern" text,
	"publicationFit" text,
	"isSeeded" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_sops_templateId_unique" UNIQUE("templateId")
);
--> statement-breakpoint
CREATE TABLE "trending_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"platform" varchar(32) DEFAULT 'general' NOT NULL,
	"category" varchar(100),
	"trendScore" integer DEFAULT 0,
	"velocity" varchar(32) DEFAULT 'rising',
	"suggestedAngles" jsonb,
	"sampleHeadlines" jsonb,
	"relatedKeywords" jsonb,
	"sourceUrl" varchar(1000),
	"brandId" integer,
	"trendStatus" varchar(32) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"settings" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "wsDatabases" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updatedAt" bigint DEFAULT 0 NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wsPages" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updatedAt" bigint DEFAULT 0 NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wsRows" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updatedAt" bigint DEFAULT 0 NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "day_model_idx" ON "ai_usage" USING btree ("day","model");