CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text,
	`template` varchar(100),
	`brandVoice` varchar(100),
	`wordCount` int,
	`status` enum('draft','review','scored','pitched','published') NOT NULL DEFAULT 'draft',
	`overallScore` int,
	`scoreData` json,
	`targetPublication` varchar(200),
	`brandId` varchar(100),
	`productId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`niche` varchar(200),
	`website` varchar(500),
	`color` varchar(20),
	`alignedPublications` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `earnings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('content','product') NOT NULL,
	`source` varchar(200) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`description` text,
	`brandId` int,
	`date` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `earnings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`angle` text,
	`category` varchar(100),
	`newsPeg` text,
	`status` enum('idea','researching','drafting','scoring','pitching','published') NOT NULL DEFAULT 'idea',
	`score` int,
	`brandId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`summary` text,
	`source` varchar(200),
	`url` varchar(1000),
	`category` varchar(100),
	`relevanceScore` int,
	`saved` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligence_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pitches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`publicationId` varchar(100) NOT NULL,
	`publicationName` varchar(200),
	`editorName` varchar(200),
	`editorEmail` varchar(320),
	`subject` varchar(500) NOT NULL,
	`body` text,
	`articleTitle` varchar(500),
	`status` enum('draft','sent','accepted','rejected','no_response') NOT NULL DEFAULT 'draft',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pitches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brandId` int,
	`name` varchar(200) NOT NULL,
	`type` varchar(100),
	`price` decimal(10,2),
	`description` text,
	`funnelUrl` varchar(500),
	`status` enum('draft','active','paused') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text,
	`sources` json,
	`dataPoints` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_notes_id` PRIMARY KEY(`id`)
);
