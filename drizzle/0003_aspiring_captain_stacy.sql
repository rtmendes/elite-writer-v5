CREATE TABLE `agent_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentId` varchar(50) NOT NULL,
	`targetType` enum('article','project','idea','research') NOT NULL,
	`targetId` int NOT NULL,
	`targetTitle` varchar(500),
	`role` varchar(200),
	`status` enum('active','completed','removed') DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_chats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(300),
	`agentIds` json NOT NULL,
	`mode` enum('one_on_one','group','meeting') DEFAULT 'one_on_one',
	`status` enum('active','archived') DEFAULT 'active',
	`messageCount` int DEFAULT 0,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_chats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentId` varchar(50) NOT NULL,
	`fact` text NOT NULL,
	`category` varchar(100),
	`importance` int DEFAULT 5,
	`sourceChatId` int,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`role` enum('user','agent') NOT NULL,
	`agentId` varchar(50),
	`content` text NOT NULL,
	`model` varchar(100),
	`tokens` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_interviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brandId` int,
	`title` varchar(500) NOT NULL,
	`topic` varchar(200),
	`topicPack` enum('brand_foundations','content_strategy','audience_deep_dive','custom') NOT NULL DEFAULT 'custom',
	`questions` json,
	`extractedInsights` json,
	`interviewStatus` enum('not_started','in_progress','completed','archived') NOT NULL DEFAULT 'not_started',
	`completeness` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_interviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` varchar(10) NOT NULL,
	`model` varchar(200) NOT NULL,
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`costMicros` bigint NOT NULL DEFAULT 0,
	`calls` int NOT NULL DEFAULT 0,
	CONSTRAINT `ai_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `day_model_idx` UNIQUE(`day`,`model`)
);
--> statement-breakpoint
CREATE TABLE `brand_contexts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brandId` int,
	`name` varchar(200) NOT NULL,
	`website` varchar(500),
	`voice` text,
	`tone` text,
	`audience` text,
	`brandValues` json,
	`brandKeywords` json,
	`competitors` json,
	`contentPillars` json,
	`avoidTopics` json,
	`sampleContent` json,
	`languagePreferences` json,
	`imagePreferences` json,
	`autoResearched` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_contexts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_calendar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`scheduledDate` varchar(10) NOT NULL,
	`scheduledTime` varchar(5),
	`calPlatform` enum('linkedin','twitter','instagram','facebook','bluesky','blog','newsletter','threads','press','tiktok','youtube') NOT NULL DEFAULT 'linkedin',
	`calContentType` enum('post','thread','article','carousel','story','reel','press_release','newsletter','video') NOT NULL DEFAULT 'post',
	`calStatus` enum('planned','drafting','review','approved','scheduled','published') NOT NULL DEFAULT 'planned',
	`brandId` int,
	`contentItemId` int,
	`assignee` varchar(200),
	`color` varchar(20),
	`calMeta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_calendar_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contentType` enum('social_post','article_excerpt','quote','idea','template') NOT NULL,
	`platform` varchar(50),
	`title` varchar(500),
	`content` text NOT NULL,
	`contentTags` json,
	`brandId` int,
	`sourcePostId` int,
	`usageCount` int DEFAULT 0,
	`starred` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceType` enum('youtube','reddit','newsletter','website','rss') NOT NULL,
	`name` varchar(300) NOT NULL,
	`identifier` varchar(500) NOT NULL,
	`iconUrl` varchar(1000),
	`description` text,
	`category` varchar(100),
	`active` int DEFAULT 1,
	`fetchFrequency` enum('hourly','daily','weekly') DEFAULT 'daily',
	`lastFetched` timestamp,
	`itemCount` int DEFAULT 0,
	`sourceMeta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brandId` int,
	`name` varchar(300) NOT NULL,
	`primaryKeyword` varchar(200) NOT NULL,
	`pillarTopic` varchar(500),
	`pillarContent` text,
	`clusters` json,
	`enhanced` int DEFAULT 0,
	`totalArticles` int DEFAULT 0,
	`publishedArticles` int DEFAULT 0,
	`strategyStatus` enum('draft','active','executing','completed') NOT NULL DEFAULT 'draft',
	`strategyMeta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_strategies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_studio_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`body` text,
	`studioPlatform` enum('linkedin','twitter','instagram','facebook','bluesky','blog','newsletter','threads','press') NOT NULL DEFAULT 'linkedin',
	`studioContentType` enum('post','thread','article','carousel','story','reel','press_release','newsletter') NOT NULL DEFAULT 'post',
	`studioStatus` enum('draft','review','approved','scheduled','published','archived') NOT NULL DEFAULT 'draft',
	`charCount` int DEFAULT 0,
	`brandId` int,
	`sourceInsightId` int,
	`trendingTopicId` int,
	`studioImageUrl` varchar(1000),
	`publishUrl` varchar(1000),
	`publishedAt` timestamp,
	`studioMeta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_studio_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`content` json,
	`newsItemIds` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_briefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feed_seen` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceId` int NOT NULL,
	`urlHash` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feed_seen_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`feedType` enum('rss','email') NOT NULL DEFAULT 'rss',
	`name` varchar(200) NOT NULL,
	`url` varchar(1000),
	`emailFrom` varchar(320),
	`keywords` json,
	`active` int DEFAULT 1,
	`lastFetched` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feeds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(300) NOT NULL,
	`funnelType` varchar(50),
	`productName` varchar(200),
	`productDescription` text,
	`targetAudience` text,
	`pricePoint` varchar(50),
	`stages` json,
	`score` int,
	`scoreData` json,
	`optimizationData` json,
	`funnelStatus` enum('draft','active','optimizing','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`prompt` text,
	`imageUrl` varchar(1000),
	`model` varchar(100),
	`style` varchar(100),
	`articleId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(300) NOT NULL,
	`websiteUrl` varchar(500) NOT NULL,
	`geoCompetitors` json,
	`monitorKeywords` json,
	`targetLocation` varchar(100) DEFAULT 'global',
	`lastCrawled` timestamp,
	`lastMonitored` timestamp,
	`overallGeoScore` int,
	`geoMeta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`pageUrl` varchar(1000) NOT NULL,
	`pageTitle` varchar(500),
	`geoScore` int,
	`aeoScore` int,
	`seoScore` int,
	`llmVisibility` json,
	`recommendations` json,
	`contentGaps` json,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geo_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `google_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`tokenType` varchar(50),
	`expiresAt` timestamp,
	`scope` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `image_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(300) NOT NULL,
	`imageUrl` varchar(1000) NOT NULL,
	`thumbnailUrl` varchar(1000),
	`prompt` text,
	`model` varchar(100),
	`style` varchar(100),
	`imageTags` json,
	`brandId` int,
	`width` int,
	`height` int,
	`presetName` varchar(200),
	`imageMeta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `image_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `image_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`promptPrefix` text,
	`promptSuffix` text,
	`model` varchar(100),
	`style` varchar(100),
	`referenceImages` json,
	`characterConsistency` int DEFAULT 0,
	`brandId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `image_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_learnings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`learningType` varchar(100),
	`pattern` text,
	`confidence` decimal(5,2),
	`sourceArticleIds` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligence_learnings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kb_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text,
	`category` varchar(100),
	`subcategory` varchar(100),
	`tags` json,
	`useCases` json,
	`source` varchar(300),
	`sourceUrl` varchar(1000),
	`tokenCount` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kb_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keyword_research` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`keyword` varchar(300) NOT NULL,
	`difficulty` int,
	`volume` int,
	`cpc` decimal(6,2),
	`trend` varchar(20),
	`intent` enum('informational','navigational','commercial','transactional'),
	`relatedKeywords` json,
	`serps` json,
	`aiVisibility` json,
	`saved` int DEFAULT 0,
	`strategyId` int,
	`blogIdeas` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keyword_research_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetType` varchar(100) NOT NULL,
	`name` varchar(300) NOT NULL,
	`content` text,
	`topic` varchar(300),
	`score` int,
	`scoreData` json,
	`metadata` json,
	`assetStatus` enum('draft','approved','published') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`url` varchar(1000),
	`imageUrl` varchar(1000),
	`source` varchar(200),
	`sourceName` varchar(200),
	`category` varchar(100),
	`publishedAt` timestamp,
	`relevanceScore` int,
	`processed` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`slug` varchar(200) NOT NULL,
	`name` varchar(300) NOT NULL,
	`url` varchar(500),
	`category` varchar(100),
	`payRange` varchar(100),
	`payMin` int,
	`payMax` int,
	`acceptsFreelance` int DEFAULT 1,
	`submissionUrl` varchar(500),
	`editorName` varchar(200),
	`editorEmail` varchar(320),
	`guidelines` text,
	`notes` text,
	`topics` json,
	`tier` int DEFAULT 2,
	`audienceAvatar` text,
	`editorPreferences` text,
	`responseTime` varchar(100),
	`templateData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pulse_stories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`externalId` int,
	`headline` varchar(500) NOT NULL,
	`source` varchar(1000),
	`sourceDisplay` varchar(200),
	`beat` varchar(100) NOT NULL,
	`urgency` enum('breaking','this_week','evergreen') NOT NULL DEFAULT 'this_week',
	`urgencyEmoji` varchar(10),
	`whyItMatters` text,
	`angle` text,
	`contentType` varchar(200),
	`priority` int,
	`pulseStatus` enum('new','reviewing','writing','in_pipeline','published','skipped') NOT NULL DEFAULT 'new',
	`matchedBrands` json,
	`matchedPublications` json,
	`analysisData` json,
	`briefingDate` varchar(10) NOT NULL,
	`briefingRank` int,
	`briefingReason` text,
	`articleId` int,
	`ideaId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pulse_stories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_references` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(40) NOT NULL DEFAULT 'article',
	`title` varchar(700) NOT NULL,
	`authors` json,
	`year` int,
	`doi` varchar(200),
	`url` varchar(1000),
	`abstract` text,
	`source` varchar(120),
	`citationCount` int DEFAULT 0,
	`tags` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_references_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brandId` int,
	`platform` enum('twitter','linkedin','facebook','reddit','threads','instagram') NOT NULL,
	`postType` enum('single','thread','carousel','poll') NOT NULL DEFAULT 'single',
	`content` text NOT NULL,
	`threadParts` json,
	`hashtags` json,
	`imageUrl` varchar(1000),
	`imagePrompt` text,
	`sourceArticleId` int,
	`sourceUrl` varchar(1000),
	`sourceTitle` varchar(500),
	`tone` varchar(100),
	`language` varchar(50) DEFAULT 'en',
	`score` int,
	`scoreData` json,
	`socialPostStatus` enum('draft','approved','scheduled','published') NOT NULL DEFAULT 'draft',
	`scheduledAt` timestamp,
	`publishedAt` timestamp,
	`webhookUrl` varchar(1000),
	`socialPostMeta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text,
	`summary` text,
	`url` varchar(1000),
	`imageUrl` varchar(1000),
	`author` varchar(200),
	`publishedAt` timestamp,
	`relevanceScore` int,
	`viralScore` int,
	`sentiment` varchar(20),
	`keyInsights` json,
	`processed` int DEFAULT 0,
	`saved` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `style_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`analysisData` json,
	`sampleArticleIds` json,
	`attributes` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trending_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook','bluesky','tiktok','youtube','reddit','general') NOT NULL DEFAULT 'general',
	`category` varchar(100),
	`trendScore` int DEFAULT 0,
	`velocity` enum('rising','stable','declining') DEFAULT 'rising',
	`suggestedAngles` json,
	`sampleHeadlines` json,
	`relatedKeywords` json,
	`sourceUrl` varchar(1000),
	`brandId` int,
	`trendStatus` enum('active','used','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trending_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`settings` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `wsDatabases` (
	`id` varchar(32) NOT NULL,
	`data` json NOT NULL,
	`updatedAt` bigint NOT NULL DEFAULT 0,
	`deleted` boolean NOT NULL DEFAULT false,
	CONSTRAINT `wsDatabases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wsPages` (
	`id` varchar(32) NOT NULL,
	`data` json NOT NULL,
	`updatedAt` bigint NOT NULL DEFAULT 0,
	`deleted` boolean NOT NULL DEFAULT false,
	CONSTRAINT `wsPages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wsRows` (
	`id` varchar(32) NOT NULL,
	`data` json NOT NULL,
	`updatedAt` bigint NOT NULL DEFAULT 0,
	`deleted` boolean NOT NULL DEFAULT false,
	CONSTRAINT `wsRows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD `styleProfile` json;--> statement-breakpoint
ALTER TABLE `articles` ADD `sources` json;--> statement-breakpoint
ALTER TABLE `articles` ADD `importedFrom` varchar(500);--> statement-breakpoint
ALTER TABLE `intelligence_items` ADD `metadata` json;--> statement-breakpoint
ALTER TABLE `products` ADD `articleId` int;